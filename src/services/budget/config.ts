/**
 * Per-site daily budget configuration with sensible defaults.
 * Stored as JSON on Site.dailyBudget — all fields optional, merged with defaults at runtime.
 */
export interface DailyBudget {
  reddit: number;
  youtube: number;
  twitter: number;
}

export const DAILY_BUDGET_DEFAULTS: DailyBudget = {
  reddit: 5,
  youtube: 5,
  twitter: 0,
};

export function parseDailyBudget(raw: unknown): DailyBudget {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const num = (key: keyof DailyBudget, min: number, max: number): number => {
    const val = obj[key];
    if (typeof val !== "number" || !Number.isFinite(val)) return DAILY_BUDGET_DEFAULTS[key];
    return Math.max(min, Math.min(max, Math.round(val)));
  };

  return {
    reddit: num("reddit", 0, 50),
    youtube: num("youtube", 0, 50),
    twitter: num("twitter", 0, 50),
  };
}
