import { buffer } from "micro";
import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { prisma } from "@/server/utils/db";
import { addPermanentCredits } from "@/server/utils/credits";
import { planList } from "@/constants/pricing";

export const config = {
  api: {
    bodyParser: false,
  },
};

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

if (!process.env.STRIPE_WEBHOOK_SECRET) {
  throw new Error("STRIPE_WEBHOOK_SECRET is not set");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-12-15.clover",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

function getSubscriptionPeriod(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0];
  return {
    start: item.current_period_start,
    end: item.current_period_end,
  };
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const subDetails = invoice.parent?.subscription_details;
  if (subDetails?.subscription) {
    const sub = subDetails.subscription;
    return typeof sub === "string" ? sub : sub.id;
  }
  return null;
}

async function getCreditsFromPrice(priceId: string): Promise<number> {
  const price = await stripe.prices.retrieve(priceId);
  const product = await stripe.products.retrieve(price.product as string);
  const plan = planList.find((p) => p.plan_name === product.name);
  return plan?.credits_per_month || 0;
}

async function handleSubscriptionCreated(
  subscription: Stripe.Subscription,
  customer: { id: string },
) {
  const existingSubscription = await prisma.stripeSubscription.findUnique({
    where: { id: subscription.id },
  });

  if (existingSubscription) return;

  const period = getSubscriptionPeriod(subscription);
  await prisma.stripeSubscription.create({
    data: {
      id: subscription.id,
      customer: { connect: { id: customer.id } },
      price: { connect: { id: subscription.items.data[0].price.id } },
      status: subscription.status,
      currentPeriodStart: new Date(period.start * 1000),
      currentPeriodEnd: new Date(period.end * 1000),
      canceledAt: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000)
        : null,
      metadata: subscription.metadata || {},
    },
  });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const period = getSubscriptionPeriod(subscription);
  await prisma.stripeSubscription.update({
    where: { id: subscription.id },
    data: {
      status: subscription.status,
      price: { connect: { id: subscription.items.data[0].price.id } },
      currentPeriodStart: new Date(period.start * 1000),
      currentPeriodEnd: new Date(period.end * 1000),
      canceledAt: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000)
        : null,
      metadata: subscription.metadata || {},
    },
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  await prisma.stripeSubscription.update({
    where: { id: subscription.id },
    data: {
      status: subscription.status,
      canceledAt: new Date(),
    },
  });
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  if (!subscriptionId) return;

  if (
    invoice.billing_reason === "subscription_create" ||
    invoice.billing_reason === "subscription_cycle"
  ) {
    const customer = await prisma.stripeCustomer.findUnique({
      where: { id: invoice.customer as string },
      include: { user: true },
    });

    if (!customer?.user) return;

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const credits = await getCreditsFromPrice(
      subscription.items.data[0].price.id,
    );
    const previousCredits = customer.user.credits;

    if (invoice.billing_reason === "subscription_create") {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: customer.user.id },
          data: { credits: { increment: credits } },
        }),
        prisma.userCreditHistory.create({
          data: {
            userId: customer.user.id,
            credits,
            previousCredits,
            newCredits: previousCredits + credits,
            reason: "SUBSCRIPTION_CREATE",
            reasonExtra: `Initial subscription: ${subscription.id}`,
          },
        }),
      ]);
    } else if (previousCredits < credits) {
      const creditDifference = credits - previousCredits;
      await prisma.$transaction([
        prisma.user.update({
          where: { id: customer.user.id },
          data: { credits },
        }),
        prisma.userCreditHistory.create({
          data: {
            userId: customer.user.id,
            credits: creditDifference,
            previousCredits: previousCredits + customer.user.permanentCredits,
            newCredits: credits + customer.user.permanentCredits,
            reason: "SUBSCRIPTION_RENEWAL",
            reasonExtra: `Credits refreshed to ${credits}`,
          },
        }),
      ]);
    }
  }
}

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
) {
  if (!session.metadata?.userId) return;

  const user = await prisma.user.findUnique({
    where: { id: session.metadata.userId },
  });

  if (!user) return;

  if (session.mode === "payment") {
    const credits = session.metadata?.credits
      ? parseInt(session.metadata.credits)
      : 0;

    if (credits > 0) {
      await addPermanentCredits({
        userId: user.id,
        amount: credits,
        reason: "PURCHASE",
        reasonExtra: "One-time credit purchase via checkout",
      });
    }
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).end("Method Not Allowed");
    return;
  }

  const buf = await buffer(req);
  const sig = req.headers["stripe-signature"];

  if (!sig || !webhookSecret) {
    return res.status(400).send("Webhook signature or secret missing");
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error(`Webhook signature verification failed: ${errorMessage}`);
    return res.status(400).send(`Webhook Error: ${errorMessage}`);
  }

  try {
    const eventType = event.type.trim();

    switch (eventType) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      case "invoice.payment_succeeded":
      case "invoice_payment.paid":
        await handleInvoicePaymentSucceeded(
          event.data.object as Stripe.Invoice,
        );
        break;
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        const customer = await prisma.stripeCustomer.findUnique({
          where: { id: sub.customer as string },
        });
        if (customer) await handleSubscriptionCreated(sub, customer);
        break;
      }
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
        );
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
        );
        break;
      default:
        console.log(`Unhandled event type: ${eventType}`);
    }

    res.json({ received: true });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error(`Error processing webhook: ${errorMessage}`);
    res.status(500).send(`Server error: ${errorMessage}`);
  }
}
