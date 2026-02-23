import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "@/server/trpc";
import Stripe from "stripe";
import { CREDIT_PRICES } from "@/constants/pricing";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-12-15.clover",
});

export const userRouter = router({
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

      let customer;
      if (ctx.session.user.stripeCustomerId) {
        customer = await stripe.customers.retrieve(
          ctx.session.user.stripeCustomerId,
        );
      } else {
        const customers = await stripe.customers.list({
          email: ctx.session.user.email!,
          limit: 1,
        });

        if (customers.data.length > 0) {
          customer = customers.data[0];
        } else {
          customer = await stripe.customers.create({
            email: ctx.session.user.email!,
            metadata: { userId: ctx.session.user.id },
          });
        }

        await ctx.prisma.$transaction([
          ctx.prisma.stripeCustomer.upsert({
            where: { id: customer.id },
            create: {
              id: customer.id,
              email: ctx.session.user.email!,
              userId: ctx.session.user.id,
            },
            update: {
              email: ctx.session.user.email!,
              userId: ctx.session.user.id,
            },
          }),
          ctx.prisma.user.update({
            where: { id: ctx.session.user.id },
            data: { stripeCustomerId: customer.id },
          }),
        ]);
      }

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

      let customer;
      if (ctx.session.user.stripeCustomerId) {
        customer = await stripe.customers.retrieve(
          ctx.session.user.stripeCustomerId,
        );
      } else {
        const customers = await stripe.customers.list({
          email: ctx.session.user.email!,
          limit: 1,
        });

        if (customers.data.length > 0) {
          customer = customers.data[0];
        } else {
          customer = await stripe.customers.create({
            email: ctx.session.user.email!,
            metadata: { userId: ctx.session.user.id },
          });
        }

        await ctx.prisma.$transaction([
          ctx.prisma.stripeCustomer.upsert({
            where: { id: customer.id },
            create: {
              id: customer.id,
              email: ctx.session.user.email!,
              userId: ctx.session.user.id,
            },
            update: {
              email: ctx.session.user.email!,
              userId: ctx.session.user.id,
            },
          }),
          ctx.prisma.user.update({
            where: { id: ctx.session.user.id },
            data: { stripeCustomerId: customer.id },
          }),
        ]);
      }

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
});
