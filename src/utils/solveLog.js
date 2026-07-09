const SOLVE_LOG_LIMIT = 8;
export const SOLVE_LOG_IDLE_MESSAGE = "等待求解";
const IMPORTANT_LOG_PATTERN =
  /^(开始求解|提交任务中|任务已提交|排队中|任务计算中|求解完成|求解失败|提交失败|任务已取消|取消失败|取消任务失败|无法获取任务状态|请先|导入失败|数据导入成功|警告：)/;

const formatLogTime = () =>
  new Date().toLocaleTimeString("zh-CN", { hour12: false });

export const createSolveLogController = (logs) => {
  let lastProgressLogState = "";

  const addLog = (message) => {
    if (!IMPORTANT_LOG_PATTERN.test(message)) return;
    logs.value.unshift(`${formatLogTime()} - ${message}`);
    if (logs.value.length > SOLVE_LOG_LIMIT) {
      logs.value = logs.value.slice(0, SOLVE_LOG_LIMIT);
    }
  };

  const resetSolveLogs = (message) => {
    logs.value = [];
    lastProgressLogState = "";
    addLog(message);
  };

  const addTaskProgressLog = (state, queuePosition) => {
    const logKey = `${state}:${queuePosition || ""}`;
    if (lastProgressLogState === logKey) return;
    lastProgressLogState = logKey;
    addLog(
      state === "queued"
        ? `排队中${queuePosition ? `，队列第${queuePosition}位` : ""}`
        : "任务计算中"
    );
  };

  return {
    addLog,
    resetSolveLogs,
    addTaskProgressLog,
  };
};
