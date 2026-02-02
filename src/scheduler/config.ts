export const SCHEDULER_CONFIG = {
  STALE_THRESHOLD_MS: 60 * 60 * 1000, // 1 hour
  INTERVAL_MS: Number(process.env.SCHEDULER_INTERVAL) || 3000,
};
