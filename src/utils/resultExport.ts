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

export const downloadTaskResultExport = <T>(
  taskInfo: TaskResultExportInfo,
  input: unknown,
  results: T,
  derivedResult: unknown = null
) => {
  const parsedTimestamp = taskInfo.timestamp
    ? new Date(taskInfo.timestamp)
    : null;
  const normalizedTaskInfo = {
    ...taskInfo,
    timestamp:
      parsedTimestamp && !Number.isNaN(parsedTimestamp.getTime())
        ? parsedTimestamp.toISOString()
        : taskInfo.timestamp,
  };
  const data = {
    taskInfo: normalizedTaskInfo,
    input,
    results,
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
