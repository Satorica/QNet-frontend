export const FIRST_SOLVE_POLL_DELAY_MS = 350;

// Short jobs should appear promptly; long jobs retain the existing request rate.
export const getSolvePollDelay = (startedAt: number, now = Date.now()) =>
  now - startedAt < 10_000 ? 500 : 2000;
