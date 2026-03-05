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
  { feature: "AI-generated comments on Reddit & YouTube", available: true },
  { feature: "Posted from aged Reddit accounts", available: true },
];

export const planList: Plan[] = [
  {
    plan: "starter",
    plan_name: "Starter",
    credits_per_month: 500,
    description: "Dip your toes in",
    price: {
      monthly: 49,
      yearly: 470.4,
      yearlyDiscount: 20,
    },
    popular: false,
    features: [
      {
        feature: "{{credits}} credits/month",
        values: { credits: 500 },
        available: true,
      },
      ...baseFeatures,
      { feature: "Hands-free daily posting", available: true },
      { feature: "Target up to 5 keywords", available: true },
      { feature: "High-value comment targeting", available: true },
      { feature: "See which comments are live", available: true },
      { feature: "AI mention tracking", available: false },
      { feature: "Priority support", available: false },
    ],
    monthlyPriceId: "", // TODO: Set after running stripe:products
    yearlyPriceId: "",
    id: "starter",
  },
  {
    plan: "growth",
    plan_name: "Growth",
    credits_per_month: 1000,
    description: "For brands ready to show up",
    price: {
      monthly: 99,
      yearly: 950.4,
      yearlyDiscount: 20,
    },
    popular: true,
    features: [
      {
        feature: "{{credits}} credits/month",
        values: { credits: 1000 },
        available: true,
      },
      ...baseFeatures,
      { feature: "Hands-free daily posting", available: true },
      { feature: "Target up to 10 keywords", available: true },
      { feature: "High-value comment targeting", available: true },
      { feature: "Track when AI chatbots mention you", available: true },
      { feature: "Customizable discovery filters", available: true },
      { feature: "Priority support", available: true },
    ],
    monthlyPriceId: "",
    yearlyPriceId: "",
    id: "growth",
  },
  {
    plan: "pro",
    plan_name: "Pro",
    credits_per_month: 2000,
    description: "For serious brand domination",
    price: {
      monthly: 199,
      yearly: 1910.4,
      yearlyDiscount: 20,
    },
    popular: false,
    features: [
      {
        feature: "{{credits}} credits/month",
        values: { credits: 2000 },
        available: true,
      },
      ...baseFeatures,
      { feature: "Hands-free daily posting", available: true },
      { feature: "Unlimited keyword targeting", available: true },
      { feature: "High-value comment targeting", available: true },
      { feature: "Track when AI chatbots mention you", available: true },
      { feature: "Customizable discovery filters", available: true },
      { feature: "Full analytics dashboard", available: true },
      { feature: "Priority support + monthly strategy call", available: true },
    ],
    monthlyPriceId: "",
    yearlyPriceId: "",
    id: "pro",
  },
];

export const CREDIT_PRICES = {
  100: { price: 1400 },
  300: { price: 3900 },
  600: { price: 7500 },
  1200: { price: 14400 },
};

export const FREE_CREDITS = 18;

export function getCreditsForPlan(planName: string | null): number {
  if (!planName || planName === "FREE") return 0;

  const plan = planList.find(
    (p) => p.plan_name.toLowerCase() === planName.toLowerCase(),
  );

  return plan?.credits_per_month ?? 0;
}
