export const CREDIT_COSTS = {
  daily: { reddit: 6, youtube: 6, twitter: 100 },
  highValue: { reddit: 60, youtube: 60 },
} as const;

export type CreditCostType = keyof typeof CREDIT_COSTS;
export type CreditCostPlatform = keyof typeof CREDIT_COSTS.daily;
