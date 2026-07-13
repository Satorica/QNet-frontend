export const EMAIL_REGEX = /^[^\s@]+@(?:[^\s@.]+\.)+[^\s@.]+$/;

export const parsePositiveSafeInteger = (value: string): number => {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error("请输入有效的正整数，非法内容请先删除");
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`数字 ${value} 超出安全整数范围`);
  }

  return parsed;
};

export const assertSafeIntegerSum = (values: number[]): number => {
  const sum = values.reduce((total, value) => total + value, 0);
  if (!Number.isSafeInteger(sum)) {
    throw new Error("数字总和超出安全整数范围，请减小输入值");
  }
  return sum;
};

export const parseStrictNonNegativeNumber = (value: unknown): number => {
  const normalized = String(value).trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(normalized)) {
    throw new Error(`不是有效数值：${value}`);
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`不是有效数值：${value}`);
  }

  return parsed;
};
