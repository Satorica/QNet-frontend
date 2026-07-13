export const createAsyncScope = () => {
  let version = 0;
  let timerId: ReturnType<typeof setTimeout> | null = null;

  const clearTimer = () => {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  };

  return {
    begin: () => {
      clearTimer();
      version += 1;
      return version;
    },

    isCurrent: (token: number) => token === version,

    schedule: (token: number, callback: () => void | Promise<void>, delay: number) => {
      if (token !== version) return;
      clearTimer();
      timerId = setTimeout(() => {
        timerId = null;
        if (token === version) callback();
      }, delay);
    },

    invalidate: () => {
      clearTimer();
      version += 1;
    },
  };
};

export const createLatestRequestGuard = () => {
  let latestRequestId = 0;

  return {
    begin: () => {
      latestRequestId += 1;
      return latestRequestId;
    },
    isLatest: (requestId: number) => requestId === latestRequestId,
    invalidate: () => {
      latestRequestId += 1;
    },
  };
};
