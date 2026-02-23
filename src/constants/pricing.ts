type Feature = {
  feature: string;
  available: boolean;
  values?: Record<string, number>;
};

export type PlanPrice = {
  monthly: number;
  yearly: number;
  yearlyDiscount: number;
};

export type Plan = {
  plan: string;
  plan_name: string;
  price: PlanPrice;
  popular: boolean;
  features: Feature[];
  monthlyPriceId: string;
  yearlyPriceId: string;
  id: string;
  credits_per_month: number;
  description: string;
};

const baseFeatures = [
  { feature: "AI-Generated Comments", available: true },
  { feature: "Keyword Targeting", available: true },
];

export const planList: Plan[] = [
  {
    plan: "basic",
    plan_name: "Basic",
    credits_per_month: 300,
    description: "For trying things out",
    price: {
      monthly: 14,
      yearly: 92.4,
      yearlyDiscount: 45,
    },
    popular: false,
    features: [
      {
        feature: "{{credits}} credits/month",
        values: { credits: 300 },
        available: true,
      },
      ...baseFeatures,
      { feature: "Basic Analytics", available: true },
      { feature: "Priority Support", available: false },
    ],
    monthlyPriceId: "", // TODO: Set after running stripe:products
    yearlyPriceId: "",
    id: "basic",
  },
  {
    plan: "starter",
    plan_name: "Starter",
    credits_per_month: 1000,
    description: "For small brands getting started",
    price: {
      monthly: 29,
      yearly: 208.8,
      yearlyDiscount: 40,
    },
    popular: true,
    features: [
      {
        feature: "{{credits}} credits/month",
        values: { credits: 1000 },
        available: true,
      },
      ...baseFeatures,
      { feature: "Advanced Analytics", available: true },
      { feature: "Priority Support", available: false },
    ],
    monthlyPriceId: "",
    yearlyPriceId: "",
    id: "starter",
  },
  {
    plan: "hobby",
    plan_name: "Hobby",
    credits_per_month: 2200,
    description: "For growing brands",
    price: {
      monthly: 49,
      yearly: 411.6,
      yearlyDiscount: 30,
    },
    popular: false,
    features: [
      {
        feature: "{{credits}} credits/month",
        values: { credits: 2200 },
        available: true,
      },
      ...baseFeatures,
      { feature: "Advanced Analytics", available: true },
      { feature: "Priority Support", available: true },
    ],
    monthlyPriceId: "",
    yearlyPriceId: "",
    id: "hobby",
  },
  {
    plan: "pro",
    plan_name: "Pro",
    credits_per_month: 4000,
    description: "For serious operations",
    price: {
      monthly: 99,
      yearly: 950.4,
      yearlyDiscount: 20,
    },
    popular: false,
    features: [
      {
        feature: "{{credits}} credits/month",
        values: { credits: 4000 },
        available: true,
      },
      ...baseFeatures,
      { feature: "Advanced Analytics", available: true },
      { feature: "Priority Support", available: true },
    ],
    monthlyPriceId: "",
    yearlyPriceId: "",
    id: "pro",
  },
];

export const CREDIT_PRICES = {
  200: { price: 999 },
  500: { price: 1799 },
  1500: { price: 4999 },
  4000: { price: 9999 },
};

export const FREE_CREDITS = 20;

export function getCreditsForPlan(planName: string | null): number {
  if (!planName || planName === "FREE") return 0;

  const plan = planList.find(
    (p) => p.plan_name.toLowerCase() === planName.toLowerCase(),
  );

  return plan?.credits_per_month ?? 0;
}
