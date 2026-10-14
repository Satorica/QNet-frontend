import type { Ref } from "vue";
import type { TaskSolveLog } from "../types/api";

const presentTaskLogs = (events: TaskSolveLog[]) => {
  const entries: TaskSolveLog[] = [];
  for (const event of events) {
    const active = event.state === "queued" || event.state === "processing";
    // Keep actionable errors and cancellation notices visible during retries.
    const diagnostic = /失败|错误|异常|无法|超时|断开|重试|取消|繁忙/.test(event.message);
    const entry = active && !diagnostic
      ? { ...event, message: "任务处理中" }
      : event;
    const previous = entries[entries.length - 1];
    if (entry.message === "任务处理中" && previous?.message === entry.message) continue;
    entries.push(entry);
  }
  return entries.slice(-8).reverse();
};

export const createSolveLogController = (logs: Ref<TaskSolveLog[]>) => ({
  resetSolveLogs: () => { logs.value = []; },
  syncTaskLogs: (events?: TaskSolveLog[]) => {
    logs.value = presentTaskLogs(events || []);
  },
});
