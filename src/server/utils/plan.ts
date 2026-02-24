import { prisma } from "@/server/utils/db";

interface UserPlan {
  planName: string;
  isPaid: boolean;
  maxKeywords: number;
  canPost: boolean;
}

const PLAN_LIMITS: Record<string, { maxKeywords: number; canPost: boolean }> = {
  Starter: { maxKeywords: 3, canPost: true },
  Growth: { maxKeywords: 10, canPost: true },
  Pro: { maxKeywords: Infinity, canPost: true },
};

const ADMIN_PLAN: UserPlan = {
  planName: "ADMIN",
  isPaid: true,
  maxKeywords: 25,
  canPost: true,
};

const FREE_PLAN: UserPlan = {
  planName: "FREE",
  isPaid: false,
  maxKeywords: 10,
  canPost: false,
};

/**
 * Resolve the user's current plan based on their active Stripe subscription.
 */
export async function getUserPlan(userId: string): Promise<UserPlan> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      stripeCustomer: {
        include: {
          subscriptions: {
            where: { status: { in: ["active", "trialing"] } },
            orderBy: { currentPeriodEnd: "desc" },
            take: 1,
            include: {
              price: {
                include: { product: true },
              },
            },
          },
        },
      },
    },
  });

  if (!user) return FREE_PLAN;

  if (user.role === "ADMIN") return ADMIN_PLAN;

  const subscription = user.stripeCustomer?.subscriptions[0];
  if (!subscription) return FREE_PLAN;

  const productName = subscription.price?.product?.name ?? "";
  const limits = PLAN_LIMITS[productName];

  if (!limits) return FREE_PLAN;

  return {
    planName: productName,
    isPaid: true,
    maxKeywords: limits.maxKeywords,
    canPost: limits.canPost,
  };
}
