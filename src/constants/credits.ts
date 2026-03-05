export const CREDIT_COSTS = {
  daily: { reddit: 1, youtube: 1 },
  highValue: { reddit: 3, youtube: 3 },
} as const;

export type CreditCostType = keyof typeof CREDIT_COSTS;
export type CreditCostPlatform = keyof typeof CREDIT_COSTS.daily;
