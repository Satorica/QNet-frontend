/**
 * 任务历史表格等场景：最优值至多保留两位小数；整数不补小数位。
 */
export function formatBestValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "--";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return Number.isInteger(num) ? String(num) : num.toFixed(2);
}

/**
 * 候选结果目标值：固定保留两位小数，避免 -92.9 / -84.399999 这类展示抖动。
 */
export function formatCandidateValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "--";
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  return num.toFixed(2);
}

/**
 * 求解时间字符串（可带末尾 s）；数值部分至多保留两位小数。
 */
export function formatSolveTime(value: unknown): string {
  if (value === null || value === undefined || value === "") return "--";
  let str = String(value).trim();
  const hasSuffix = str.endsWith("s");
  if (hasSuffix) str = str.slice(0, -1);
  const num = Number(str);
  if (Number.isNaN(num)) return String(value);
  const formatted = Number.isInteger(num) ? String(num) : num.toFixed(2);
  return hasSuffix ? formatted + "s" : formatted;
}
