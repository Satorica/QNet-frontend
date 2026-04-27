export const TERMINAL_TASK_STATUSES = ["completed", "failed", "cancelled"];

export const isTaskDeletable = (status) =>
  TERMINAL_TASK_STATUSES.includes(status);

export const getDeleteAllResultMessage = (
  deletedCount = 0,
  skippedNonTerminalCount = 0,
) => {
  if (skippedNonTerminalCount > 0) {
    return `已删除 ${deletedCount} 个任务，跳过 ${skippedNonTerminalCount} 个进行中的任务`;
  }

  return `已删除 ${deletedCount} 个任务`;
};
