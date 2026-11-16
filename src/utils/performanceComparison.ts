import type {
  CancelTaskResponse, MethodType, ModelType, TaskResults, TaskStatus,
  TaskStatusResponse, TaskSubmitRequest, TaskSubmitResponse,
} from "../types/api";

export type ComparisonInput = Pick<TaskSubmitRequest,
  "taskName" | "problemType" | "matrixSize" | "adjacencyMatrix" | "computeMode" | "deviceSelection" | "deviceIds" | "deviceCount"
> & {
  methodType: MethodType;
  [key: string]: unknown;
};
export type ComparisonStatus = "submitting" | TaskStatus;
export interface ComparisonSide {
  modelType: ModelType;
  status: ComparisonStatus;
  taskId: string | null;
  taskName: string;
  results: TaskResults | null;
  message: string;
  pollError: string;
  queuePosition?: number;
}
export interface ComparisonRun {
  id: string;
  createdAt: string;
  input: ComparisonInput;
  sides: Record<ModelType, ComparisonSide>;
}
const models: ModelType[] = ["classic", "quantum"];
export const isComparisonTerminal = (status: ComparisonStatus) =>
  status === "completed" || status === "failed" || status === "cancelled";
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export function assertComparisonMatrix(matrix: number[][], size: number) {
  if (!Number.isInteger(size) || size < 2 || size > 256 || matrix.length !== size
    || matrix.some(row => row.length !== size || row.some(value => !Number.isFinite(value)))) {
    throw new Error("矩阵数据不完整，请检查当前输入");
  }
}

export function buildComparisonRequests(input: ComparisonInput, id: string): Record<ModelType, TaskSubmitRequest> {
  const { methodType, computeMode, deviceSelection, deviceIds, deviceCount, ...common } = copy(input);
  const name = (model: ModelType) => {
    const suffix = `_${model === "classic" ? "经典" : "量子"}_${id}`;
    return `${(input.taskName || "性能对比").slice(0, Math.max(0, 64 - suffix.length))}${suffix}`;
  };
  return {
    classic: { ...copy(common), taskName: name("classic"), modelType: "classic", methodType },
    quantum: {
      ...copy(common), taskName: name("quantum"), modelType: "quantum",
      computeMode: computeMode || "single", deviceSelection: deviceSelection || "auto",
      ...(deviceIds ? { deviceIds: [...deviceIds] } : {}),
      ...(deviceCount !== undefined ? { deviceCount } : {}),
    },
  };
}

export function deviceSolveTimeMs(results: TaskResults | null): number | null {
  const value = results?.runtime;
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    && Number.isFinite(value * 1000) ? value * 1000 : null;
}

export function buildComparisonExport(run: ComparisonRun) {
  const side = (model: ModelType) => {
    const record = run.sides[model];
    return {
      taskId: record.taskId, taskName: record.taskName, status: record.status,
      deviceSolveTimeMs: deviceSolveTimeMs(record.results),
      message: record.message || null,
      ...(model === "classic" ? { methodType: run.input.methodType } : {
        requestedDevices: {
          computeMode: run.input.computeMode || "single",
          deviceSelection: run.input.deviceSelection || "auto",
          deviceIds: run.input.deviceIds || [],
          ...(run.input.deviceCount !== undefined ? { deviceCount: run.input.deviceCount } : {}),
        },
        actualDeviceIds: record.results?.fpga?.device_ids || [],
        decomposed: record.results?.fpga?.decomposed ?? null,
      }),
    };
  };
  return copy({
    schemaVersion: 1, comparisonId: run.id, createdAt: run.createdAt,
    problemType: run.input.problemType, matrixSize: run.input.matrixSize,
    input: run.input,
    timing: {
      unit: "ms", classicScope: "classical_algorithm_compute", quantumScope: "ising_device_compute",
      description: "设备计算阶段；不含量子通信与主机后处理，多设备按计算节点返回的设备求解时间统计。",
    },
    classic: side("classic"), quantum: side("quantum"),
  });
}

interface Dependencies {
  submit: (input: TaskSubmitRequest) => Promise<TaskSubmitResponse>;
  status: (id: string) => Promise<TaskStatusResponse>;
  cancel: (id: string) => Promise<CancelTaskResponse>;
  changed: (run: ComparisonRun, busy: boolean) => void;
  tasksChanged?: () => void;
  schedule?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  unschedule?: (timer: ReturnType<typeof setTimeout>) => void;
  now?: () => number;
}

/** Both submissions share one immutable input; neither side can stop the other's polling. */
export function createPerformanceComparison(deps: Dependencies) {
  const schedule = deps.schedule || setTimeout;
  const unschedule = deps.unschedule || clearTimeout;
  const now = deps.now || Date.now;
  let run: ComparisonRun | null = null;
  let version = 0;
  let disposed = false;
  let cancelRequested = false;
  const timers: Partial<Record<ModelType, ReturnType<typeof setTimeout>>> = {};
  const revisions = { classic: 0, quantum: 0 };
  const failures = { classic: 0, quantum: 0 };
  const cancelling = new Set<ModelType>();
  const busy = () => Boolean(run && models.some(model => !isComparisonTerminal(run!.sides[model].status)));
  const current = (token: number) => !disposed && version === token && run !== null;
  const publish = () => {
    if (!run || disposed) return;
    deps.changed({ ...run, sides: { classic: { ...run.sides.classic }, quantum: { ...run.sides.quantum } } }, busy());
  };
  const clearTimer = (model: ModelType) => {
    if (timers[model] !== undefined) unschedule(timers[model]!);
    delete timers[model];
  };
  const errorText = (error: unknown) => {
    const response = (error as { response?: { data?: { message?: string } } })?.response?.data;
    return response?.message || (error as Error)?.message || "请求失败，请稍后重试";
  };
  const later = (model: ModelType, token: number, delay = 500) => {
    clearTimer(model);
    if (!current(token) || isComparisonTerminal(run!.sides[model].status)) return;
    timers[model] = schedule(() => { delete timers[model]; void poll(model, token); }, delay);
  };
  async function poll(model: ModelType, token: number) {
    if (!current(token)) return;
    const record = run!.sides[model];
    if (!record.taskId || isComparisonTerminal(record.status)) return;
    const revision = revisions[model];
    try {
      const result = await deps.status(record.taskId);
      if (!current(token) || revision !== revisions[model] || isComparisonTerminal(record.status)) return;
      if (!["queued", "processing", "completed", "failed", "cancelled"].includes(result.state)) throw new Error("任务状态无效，正在重试");
      record.status = result.state;
      record.message = result.message || "";
      record.pollError = "";
      record.queuePosition = result.queuePosition;
      if (result.results) record.results = copy(result.results);
      failures[model] = 0;
      publish();
      if (isComparisonTerminal(record.status)) deps.tasksChanged?.();
      else later(model, token, now() - Date.parse(run!.createdAt) < 10_000 ? 500 : 2000);
    } catch (error) {
      if (!current(token) || revision !== revisions[model] || isComparisonTerminal(record.status)) return;
      record.pollError = `${errorText(error)}；正在重试，可取消任务`;
      publish();
      later(model, token, Math.min(10_000, 1000 * 2 ** Math.min(failures[model]++, 4)));
    }
  }
  async function cancelSide(model: ModelType, token: number) {
    if (!current(token) || cancelling.has(model)) return;
    const record = run!.sides[model];
    if (!record.taskId || isComparisonTerminal(record.status)) return;
    cancelling.add(model);
    revisions[model] += 1;
    clearTimer(model);
    try {
      const response = await deps.cancel(record.taskId);
      if (!current(token)) return;
      record.message = response.message || "";
      if (response.taskStatus === "cancelled" || response.taskStatus === "failed") {
        record.status = response.taskStatus;
        record.pollError = "";
        deps.tasksChanged?.();
      } else {
        // Completion may win the race; fetch its real result rather than inventing a runtime.
        later(model, token, 0);
      }
    } catch (error) {
      if (!current(token)) return;
      record.message = `取消未成功：${errorText(error)}`;
      later(model, token, 500);
    } finally {
      cancelling.delete(model);
      if (current(token)) publish();
    }
  }
  return {
    async start(input: ComparisonInput) {
      if (disposed || busy()) return;
      const token = ++version;
      cancelRequested = false;
      const id = `${now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
      const snapshot = copy(input);
      const requests = buildComparisonRequests(snapshot, id);
      const makeSide = (model: ModelType): ComparisonSide => ({
        modelType: model, status: "submitting", taskId: null, taskName: requests[model].taskName,
        results: null, message: "", pollError: "",
      });
      for (const model of models) { clearTimer(model); failures[model] = 0; revisions[model] += 1; }
      run = { id, createdAt: new Date(now()).toISOString(), input: snapshot, sides: { classic: makeSide("classic"), quantum: makeSide("quantum") } };
      publish();
      await Promise.allSettled(models.map(async model => {
        try {
          const response = await deps.submit(requests[model]);
          if (!current(token)) return;
          if (!response.success || !response.taskId) throw new Error(response.message || "任务提交失败");
          const record = run!.sides[model];
          record.taskId = response.taskId;
          record.status = "queued";
          record.queuePosition = response.queuePosition;
          publish();
          deps.tasksChanged?.();
          if (cancelRequested) await cancelSide(model, token);
          else later(model, token, 350);
        } catch (error) {
          if (!current(token)) return;
          run!.sides[model].status = "failed";
          run!.sides[model].message = errorText(error);
          publish();
        }
      }));
    },
    async cancel() {
      if (!run || !busy() || disposed) return;
      cancelRequested = true;
      const token = version;
      await Promise.allSettled(models.map(model => cancelSide(model, token)));
    },
    dispose() {
      disposed = true;
      version += 1;
      models.forEach(clearTimer);
    },
  };
}
