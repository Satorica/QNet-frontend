import type {
  ModelType,
  ProblemType,
  TaskStatus,
} from "../types/api";

export interface TaskResultExportInfo {
  taskId: string;
  taskName: string;
  problemType: ProblemType;
  modelType: ModelType;
  matrixSize: number;
  timestamp: string | null;
  status: TaskStatus;
}

const CHINA_TIME_ZONE = "Asia/Shanghai";
const LOCAL_DATE_TIME_PATTERN =
  /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.\d+)?$/;
const chinaDateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: CHINA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const SOLVE_STATE_TEXT: Record<number, string> = {
  2: "开始求解",
  3: "求解等待中",
  4: "求解成功",
  5: "求解失败",
};

export const formatExportDateTime = (value: string | null): string | null => {
  if (!value) return value;

  // 算法节点返回的是不带时区的北京时间，只统一分隔符并移除毫秒。
  const localMatch = value.match(LOCAL_DATE_TIME_PATTERN);
  if (localMatch && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) {
    return `${localMatch[1]} ${localMatch[2]}`;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  const parts = Object.fromEntries(
    chinaDateTimeFormatter
      .formatToParts(parsed)
      .filter(({ type }) => type !== "literal")
      .map(({ type, value: partValue }) => [type, partValue])
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
};

export const normalizeTaskResultsForExport = (results: unknown): unknown => {
  if (!results || typeof results !== "object" || Array.isArray(results)) {
    return results;
  }

  const normalized = { ...(results as Record<string, unknown>) };
  for (const field of ["begintime", "endtime"] as const) {
    const value = normalized[field];
    if (typeof value === "string") {
      normalized[field] = formatExportDateTime(value);
    }
  }

  const solveState = normalized.solve_state;
  if (typeof solveState === "number") {
    normalized.solve_state_text =
      SOLVE_STATE_TEXT[solveState] || `未知状态（${solveState}）`;
  }

  return normalized;
};

export const downloadTaskResultExport = <T>(
  taskInfo: TaskResultExportInfo,
  input: unknown,
  results: T,
  derivedResult: unknown = null
) => {
  const normalizedTaskInfo = {
    ...taskInfo,
    timestamp: formatExportDateTime(taskInfo.timestamp),
  };
  const data = {
    taskInfo: normalizedTaskInfo,
    input,
    results: normalizeTaskResultsForExport(results),
    derivedResult,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `task-${taskInfo.taskId}-result.json`;
  link.click();
  URL.revokeObjectURL(url);
};
