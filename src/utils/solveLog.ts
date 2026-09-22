import type { Ref } from "vue";
import type { TaskSolveLog } from "../types/api";

export const createSolveLogController = (logs: Ref<TaskSolveLog[]>) => ({
  resetSolveLogs: () => { logs.value = []; },
  syncTaskLogs: (events?: TaskSolveLog[]) => {
    logs.value = (events || []).slice(-8).reverse();
  },
});
