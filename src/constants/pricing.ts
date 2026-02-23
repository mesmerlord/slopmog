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
  { feature: "AI writes comments that sound human", available: true },
  { feature: "Posted on aged Reddit accounts", available: true },
];

export const planList: Plan[] = [
  {
    plan: "starter",
    plan_name: "Starter",
    credits_per_month: 15,
    description: "Dip your toes in",
    price: {
      monthly: 49,
      yearly: 470.4,
      yearlyDiscount: 20,
    },
    popular: false,
    features: [
      {
        feature: "{{credits}} comments posted/month",
        values: { credits: 15 },
        available: true,
      },
      ...baseFeatures,
      { feature: "Target up to 3 keywords", available: true },
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
    credits_per_month: 40,
    description: "For brands ready to show up",
    price: {
      monthly: 99,
      yearly: 950.4,
      yearlyDiscount: 20,
    },
    popular: true,
    features: [
      {
        feature: "{{credits}} comments posted/month",
        values: { credits: 40 },
        available: true,
      },
      ...baseFeatures,
      { feature: "Target up to 10 keywords", available: true },
      { feature: "Track when AI chatbots mention you", available: true },
      { feature: "Weekly performance reports", available: true },
      { feature: "Priority support", available: true },
    ],
    monthlyPriceId: "",
    yearlyPriceId: "",
    id: "growth",
  },
  {
    plan: "pro",
    plan_name: "Pro",
    credits_per_month: 100,
    description: "For serious brand domination",
    price: {
      monthly: 199,
      yearly: 1910.4,
      yearlyDiscount: 20,
    },
    popular: false,
    features: [
      {
        feature: "{{credits}} comments posted/month",
        values: { credits: 100 },
        available: true,
      },
      ...baseFeatures,
      { feature: "Unlimited keyword targeting", available: true },
      { feature: "Full analytics dashboard", available: true },
      { feature: "Track when AI chatbots mention you", available: true },
      { feature: "Priority support + monthly strategy call", available: true },
    ],
    monthlyPriceId: "",
    yearlyPriceId: "",
    id: "pro",
  },
];

export const CREDIT_PRICES = {
  5: { price: 1900 },
  15: { price: 4900 },
  40: { price: 11900 },
  100: { price: 24900 },
};

export const FREE_CREDITS = 3;

export function getCreditsForPlan(planName: string | null): number {
  if (!planName || planName === "FREE") return 0;

  const plan = planList.find(
    (p) => p.plan_name.toLowerCase() === planName.toLowerCase(),
  );

  return plan?.credits_per_month ?? 0;
}
