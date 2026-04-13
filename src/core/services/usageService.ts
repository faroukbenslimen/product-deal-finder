import { IS_TEST, DAILY_MODEL_CALL_CAP } from '../config';

const dailyUsage = {
  dayKey: new Date().toISOString().slice(0, 10),
  modelCalls: 0,
};

/**
 * Consume Daily Model Budget.
 */
export function consumeDailyModelBudget(units = 1): boolean {
  if (IS_TEST) return true;
  const currentDay = new Date().toISOString().slice(0, 10);
  
  if (dailyUsage.dayKey !== currentDay) {
    dailyUsage.dayKey = currentDay;
    dailyUsage.modelCalls = 0;
  }

  if (dailyUsage.modelCalls + units > DAILY_MODEL_CALL_CAP) {
    return false;
  }

  dailyUsage.modelCalls += units;
  return true;
}

/**
 * Gets daily usage metrics.
 */
export function getUsageMetrics() {
  return { ...dailyUsage };
}
