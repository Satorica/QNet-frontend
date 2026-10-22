import type { Ref } from "vue";
import type { TaskSolveLog } from "../types/api";

const retryNotices = new Map([
  ["无法连接到计算节点", "计算节点暂时无法连接，系统正在重试"],
  ["无法连接到计算节点查询状态", "计算节点暂时无法连接，系统正在重试"],
  ["提交计算任务到校内节点超时", "计算节点暂时无法连接，系统正在重试"],
  ["查询计算节点状态超时", "计算节点暂时无法连接，系统正在重试"],
  ["计算节点暂不可用，等待重试", "计算节点暂时无法连接，系统正在重试"],
  ["计算节点繁忙，等待重试", "计算节点繁忙，任务正在等待"],
  ["校内计算节点繁忙，任务已重新排队", "计算节点繁忙，任务正在等待"],
]);

const retryProgressMessages = new Set([
  "任务开始调度，准备提交计算节点",
  "正在轮询计算节点状态",
  "正在等待计算节点状态同步",
  "检测到任务处理中断，已重新排队",
  "检测到队列状态丢失，已重新排队",
]);

const presentTaskLogs = (events: TaskSolveLog[]) => {
  const entries: TaskSolveLog[] = [];
  let retryNotice: string | undefined;
  for (const event of events) {
    const active = event.state === "queued" || event.state === "processing";
    const notice = active ? retryNotices.get(event.message) : undefined;
    if (notice) {
      // Retrying dispatch is not a new user-visible failure. Keep the first
      // backend timestamp until the node reports progress or the task ends.
      if (notice !== retryNotice) entries.push({ ...event, message: notice });
      retryNotice = notice;
      continue;
    }
    if (active && retryNotice && retryProgressMessages.has(event.message)) continue;
    // Preserve other diagnostics, cancellation, and terminal failures verbatim.
    const diagnostic = /失败|错误|异常|无法|超时|断开|重试|取消|繁忙/.test(event.message);
    if (!active || !diagnostic) retryNotice = undefined;
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
