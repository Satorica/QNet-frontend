import type { TaskStatus } from "../types/api";

export const TERMINAL_TASK_STATUSES = ["completed", "failed", "cancelled"] as const;
export const CANCELLABLE_TASK_STATUSES = ["queued", "processing"] as const;

export const isTaskDeletable = (status: TaskStatus): boolean =>
  TERMINAL_TASK_STATUSES.some((terminalStatus) => terminalStatus === status);

export const isTaskCancellable = (status: TaskStatus): boolean =>
  CANCELLABLE_TASK_STATUSES.some((cancellableStatus) => cancellableStatus === status);

export const isDialogDismissed = (error: unknown): boolean =>
  error === "cancel" || error === "close";

export const getDeleteAllResultMessage = (
  deletedCount = 0,
  skippedNonTerminalCount = 0,
): string => {
  if (skippedNonTerminalCount > 0) {
    return `已删除 ${deletedCount} 个任务，跳过 ${skippedNonTerminalCount} 个进行中的任务`;
  }

  return `已删除 ${deletedCount} 个任务`;
};
