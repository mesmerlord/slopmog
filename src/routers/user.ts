import { z } from "zod";
import bcrypt from "bcryptjs";
import { router, publicProcedure, protectedProcedure } from "@/server/trpc";
import Stripe from "stripe";
import { CREDIT_PRICES, FREE_CREDITS } from "@/constants/pricing";
import { getUserPlan } from "@/server/utils/plan";
import type { PrismaClient } from "@prisma/client";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-12-15.clover",
});

/** Resolve or create a Stripe customer, ensuring DB records are in sync. */
async function resolveStripeCustomer(
  prisma: PrismaClient,
  userId: string,
  email: string,
  existingStripeCustomerId: string | null | undefined,
): Promise<Stripe.Customer> {
  // If we already have a customer ID, retrieve and verify it's not deleted
  if (existingStripeCustomerId) {
    const existing = await stripe.customers.retrieve(existingStripeCustomerId);
    if (!existing.deleted) return existing as Stripe.Customer;
    // Customer was deleted in Stripe — fall through to create a new one
  }

  // Look up by email in Stripe
  const customers = await stripe.customers.list({ email, limit: 1 });
  let customer: Stripe.Customer;

  if (customers.data.length > 0) {
    customer = customers.data[0];
  } else {
    customer = await stripe.customers.create({
      email,
      metadata: { userId },
    });
  }

  // Ensure DB records are in sync
  await prisma.$transaction([
    prisma.stripeCustomer.upsert({
      where: { id: customer.id },
      create: { id: customer.id, email, userId },
      update: { email, userId },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customer.id },
    }),
  ]);

  // Update Stripe metadata if missing
  if (!customer.metadata?.userId) {
    await stripe.customers.update(customer.id, {
      metadata: { userId },
    });
  }

  return customer;
}

export const userRouter = router({
  checkEmailExists: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { email: input.email },
        select: { id: true },
      });
      return { exists: !!user };
    }),

  register: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(8),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.user.findUnique({
        where: { email: input.email },
        select: { id: true },
      });

      if (existing) {
        throw new Error("An account with this email already exists");
      }

      const hashedPassword = await bcrypt.hash(input.password, 12);

      const user = await ctx.prisma.user.create({
        data: {
          name: input.name,
          email: input.email,
          password: hashedPassword,
          credits: FREE_CREDITS,
          emailVerified: new Date(),
        },
      });

      await ctx.prisma.userCreditHistory.create({
        data: {
          userId: user.id,
          credits: FREE_CREDITS,
          previousCredits: 0,
          newCredits: FREE_CREDITS,
          reason: "REGISTRATION_BONUS",
          reasonExtra: "Free credits on sign up",
        },
      });

      return { success: true, userId: user.id };
    }),

  getCredits: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.session.user.id },
      select: { credits: true, permanentCredits: true },
    });

    if (!user) {
      throw new Error("User not found");
    }

    return { amount: user.credits + user.permanentCredits };
  }),

  getSubscriptionStatus: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.session.user.id },
      include: {
        stripeCustomer: {
          include: {
            subscriptions: {
              where: {
                status: { in: ["active", "trialing"] },
              },
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

    if (!user) {
      throw new Error("User not found");
    }

    const subscription = user.stripeCustomer?.subscriptions[0];

    return {
      credits: user.credits + user.permanentCredits,
      monthlyCredits: user.credits,
      permanentCredits: user.permanentCredits,
      role: user.role,
      subscription: subscription
        ? {
            status: subscription.status,
            currentPeriodEnd: subscription.currentPeriodEnd,
            planName: subscription?.price?.product?.name || "FREE",
            interval: subscription?.price?.interval || "month",
            isPaid: true,
          }
        : {
            status: "FREE",
            currentPeriodEnd: null,
            planName: "FREE",
            interval: "month",
            isPaid: false,
          },
    };
  }),

  createSubscriptionSession: protectedProcedure
    .input(
      z.object({
        planName: z.string(),
        interval: z.enum(["month", "year"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { planName, interval } = input;

      // Check for existing active subscription
      const existingSubscription =
        await ctx.prisma.stripeSubscription.findFirst({
          where: {
            customer: { userId: ctx.session.user.id },
            status: { in: ["active", "trialing"] },
          },
        });

      if (existingSubscription) {
        throw new Error(
          "You already have an active subscription. Use the billing portal to change plans.",
        );
      }

      const product = await ctx.prisma.stripeProduct.findFirst({
        where: { name: planName, active: true },
        include: {
          prices: {
            where: {
              active: true,
              interval: interval === "month" ? "month" : "year",
            },
          },
        },
      });

      if (!product || !product.prices.length) {
        throw new Error("Product or price not found");
      }

      const price = product.prices[0];

      const customer = await resolveStripeCustomer(
        ctx.prisma,
        ctx.session.user.id,
        ctx.session.user.email!,
        ctx.session.user.stripeCustomerId,
      );

      const checkoutSession = await stripe.checkout.sessions.create({
        customer: customer.id,
        mode: "subscription",
        line_items: [{ price: price.id, quantity: 1 }],
        allow_promotion_codes: true,
        success_url: `${process.env.NEXTAUTH_URL}/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.NEXTAUTH_URL}/pricing?canceled=true`,
        metadata: { userId: ctx.session.user.id },
      });

      if (!checkoutSession.url) {
        throw new Error("Failed to create checkout session");
      }

      return { url: checkoutSession.url };
    }),

  createOneTimeSession: protectedProcedure
    .input(
      z.object({
        credits: z.enum(Object.keys(CREDIT_PRICES) as [string, ...string[]]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const credits = parseInt(input.credits);
      const priceInfo = CREDIT_PRICES[credits as keyof typeof CREDIT_PRICES];

      if (!priceInfo) {
        throw new Error("Invalid credit amount");
      }

      const customer = await resolveStripeCustomer(
        ctx.prisma,
        ctx.session.user.id,
        ctx.session.user.email!,
        ctx.session.user.stripeCustomerId,
      );

      const checkoutSession = await stripe.checkout.sessions.create({
        customer: customer.id,
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `${credits.toLocaleString()} Credits`,
                metadata: { credits: credits.toString() },
              },
              unit_amount: priceInfo.price,
            },
            quantity: 1,
          },
        ],
        allow_promotion_codes: true,
        success_url: `${process.env.NEXTAUTH_URL}/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.NEXTAUTH_URL}/pricing?canceled=true`,
        metadata: {
          userId: ctx.session.user.id,
          credits: credits.toString(),
        },
      });

      if (!checkoutSession.url) {
        throw new Error("Failed to create checkout session");
      }

      return { url: checkoutSession.url };
    }),

  createBillingPortalSession: protectedProcedure.mutation(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.session.user.id },
    });

    if (!user?.stripeCustomerId) {
      throw new Error("No billing information found");
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.NEXTAUTH_URL}/dashboard`,
    });

    return { url: portalSession.url };
  }),

  getPlanInfo: protectedProcedure.query(async ({ ctx }) => {
    return getUserPlan(ctx.session.user.id);
  }),
});
