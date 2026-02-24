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

// ─── Helpers ──────────────────────────────────────────────────

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
  const credits = plan?.credits_per_month || 0;

  if (credits === 0) {
    console.error(
      `getCreditsFromPrice returned 0 for priceId=${priceId}, product="${product.name}". No matching plan found in planList.`,
    );
  }

  return credits;
}

async function calculateCreditProrationFactor(
  subscription: Stripe.Subscription,
): Promise<{ factor: number; debug: string }> {
  const price = await stripe.prices.retrieve(
    subscription.items.data[0].price.id,
  );
  const isYearly = price.recurring?.interval === "year";
  const now = new Date();

  if (isYearly) {
    const daysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
    ).getDate();
    const dayOfMonth = now.getDate();
    const daysRemaining = daysInMonth - dayOfMonth + 1;
    const factor = daysRemaining / daysInMonth;

    return {
      factor,
      debug: `Yearly sub: day ${dayOfMonth}/${daysInMonth}, ${daysRemaining} days remaining, factor=${factor.toFixed(3)}`,
    };
  }

  const period = getSubscriptionPeriod(subscription);
  const nowTimestamp = Math.floor(Date.now() / 1000);
  const totalSeconds = period.end - period.start;
  const remainingSeconds = Math.max(0, period.end - nowTimestamp);
  const factor = remainingSeconds / totalSeconds;
  const totalDays = Math.ceil(totalSeconds / 86400);
  const remainingDays = Math.ceil(remainingSeconds / 86400);

  return {
    factor,
    debug: `Monthly sub: ${remainingDays}/${totalDays} days remaining in period, factor=${factor.toFixed(3)}`,
  };
}

// ─── Idempotency ──────────────────────────────────────────────

async function isEventProcessed(eventId: string): Promise<boolean> {
  const existing = await prisma.stripeProcessedEvent.findUnique({
    where: { id: eventId },
  });
  return !!existing;
}

async function markEventProcessed(eventId: string, type: string): Promise<void> {
  await prisma.stripeProcessedEvent.create({
    data: { id: eventId, type },
  });
}

// ─── Types ────────────────────────────────────────────────────

interface SubscriptionPreviousAttributes {
  items?: Stripe.Subscription["items"];
}

interface CustomerWithUser {
  user: {
    id: string;
    credits: number;
    permanentCredits: number;
  };
}

// ─── Subscription Handlers ────────────────────────────────────

async function handleSubscriptionCreated(
  subscription: Stripe.Subscription,
  customer: { id: string },
) {
  const existingSubscription = await prisma.stripeSubscription.findUnique({
    where: { id: subscription.id },
  });

  if (existingSubscription) {
    console.log(
      `Subscription ${subscription.id} already exists, skipping creation`,
    );
    return;
  }

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

  console.log(
    `Subscription ${subscription.id} created with status: ${subscription.status} - credits will be granted when payment succeeds`,
  );
}

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  customer: CustomerWithUser,
  previousAttributes: SubscriptionPreviousAttributes | null,
) {
  const hasPeriodChange =
    previousAttributes?.items?.data?.[0]?.current_period_end !== undefined ||
    previousAttributes?.items?.data?.[0]?.current_period_start !== undefined;

  console.log("handleSubscriptionUpdated called with:", {
    subscriptionId: subscription.id,
    previousAttributes: previousAttributes
      ? Object.keys(previousAttributes)
      : "null",
    hasPeriodChange,
    hasItems: !!previousAttributes?.items,
  });

  const newCredits = await getCreditsFromPrice(
    subscription.items.data[0].price.id,
  );

  // For plan upgrades/downgrades, credits are handled in handleInvoicePaymentSucceeded
  if (previousAttributes?.items) {
    console.log(
      "Plan change detected - credits will be granted when invoice payment succeeds",
    );
    const oldPriceId = previousAttributes.items.data[0]?.price?.id;
    if (oldPriceId) {
      const oldCredits = await getCreditsFromPrice(oldPriceId);
      console.log("Credit difference will be:", newCredits - oldCredits);
    }
  } else if (hasPeriodChange) {
    // Renewal case - refresh subscription credits to plan amount (only if user has less)
    const previousCredits = customer.user.credits;
    const previousPermanentCredits = customer.user.permanentCredits;
    const previousTotal = previousCredits + previousPermanentCredits;

    if (previousCredits < newCredits) {
      const creditDifference = newCredits - previousCredits;

      await prisma.$transaction([
        prisma.user.update({
          where: { id: customer.user.id },
          data: { credits: newCredits },
        }),
        prisma.userCreditHistory.create({
          data: {
            userId: customer.user.id,
            credits: creditDifference,
            previousCredits: previousTotal,
            newCredits: newCredits + previousPermanentCredits,
            reason: "SUBSCRIPTION_RENEWAL",
            reasonExtra: `Subscription renewed - credits refreshed to ${newCredits}`,
          },
        }),
      ]);
      console.log(
        `Refreshed credits for user ${customer.user.id}: ${previousCredits} -> ${newCredits} (+${creditDifference})`,
      );
    } else {
      await prisma.userCreditHistory.create({
        data: {
          userId: customer.user.id,
          credits: 0,
          previousCredits: previousTotal,
          newCredits: previousTotal,
          reason: "SUBSCRIPTION_RENEWAL",
          reasonExtra: `Subscription renewed - no credits added (already has ${previousCredits} subscription + ${previousPermanentCredits} permanent credits, plan: ${newCredits})`,
        },
      });
      console.log(
        `Renewal logged for user ${customer.user.id}: no credits added (has ${previousCredits} subscription + ${previousPermanentCredits} permanent, plan: ${newCredits})`,
      );
    }
  }

  // Update subscription record
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
      metadata: {
        ...subscription.metadata,
        ended_reason: subscription.cancellation_details?.reason || "unknown",
      },
    },
  });
}

// ─── Invoice Handler ──────────────────────────────────────────

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  if (!subscriptionId) return;

  // Handle initial subscription creation
  if (invoice.billing_reason === "subscription_create") {
    console.log("Processing initial subscription payment:", {
      id: invoice.id,
      subscription: subscriptionId,
    });

    const customer = await prisma.stripeCustomer.findUnique({
      where: { id: invoice.customer as string },
      include: { user: true },
    });

    if (!customer?.user) {
      console.error(`No user found for customer ${invoice.customer}`);
      return;
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const credits = await getCreditsFromPrice(
      subscription.items.data[0].price.id,
    );
    const previousCredits = customer.user.credits;

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
          reasonExtra: `Initial subscription payment: ${subscription.id}`,
        },
      }),
    ]);

    console.log(
      `Granted ${credits} credits for initial subscription payment to user ${customer.user.id}`,
    );
    return;
  }

  // Handle subscription renewals
  if (invoice.billing_reason === "subscription_cycle") {
    console.log("Processing subscription renewal via invoice:", {
      id: invoice.id,
      subscription: subscriptionId,
    });

    const customer = await prisma.stripeCustomer.findUnique({
      where: { id: invoice.customer as string },
      include: { user: true },
    });

    if (!customer?.user) {
      console.error(`No user found for customer ${invoice.customer}`);
      return;
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const credits = await getCreditsFromPrice(
      subscription.items.data[0].price.id,
    );

    const previousCredits = customer.user.credits;
    const previousPermanentCredits = customer.user.permanentCredits;
    const previousTotal = previousCredits + previousPermanentCredits;

    if (previousCredits < credits) {
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
            previousCredits: previousTotal,
            newCredits: credits + previousPermanentCredits,
            reason: "SUBSCRIPTION_RENEWAL",
            reasonExtra: `Subscription renewal via invoice - credits refreshed to ${credits}`,
          },
        }),
      ]);

      console.log(
        `Refreshed credits for user ${customer.user.id}: ${previousCredits} -> ${credits} (+${creditDifference}) via invoice payment`,
      );
    } else {
      await prisma.userCreditHistory.create({
        data: {
          userId: customer.user.id,
          credits: 0,
          previousCredits: previousTotal,
          newCredits: previousTotal,
          reason: "SUBSCRIPTION_RENEWAL",
          reasonExtra: `Subscription renewal via invoice - no credits added (already has ${previousCredits} subscription + ${previousPermanentCredits} permanent credits, plan: ${credits})`,
        },
      });
      console.log(
        `Renewal logged for user ${customer.user.id}: no credits added`,
      );
    }
    return;
  }

  // Handle subscription updates (plan changes mid-cycle)
  if (invoice.billing_reason !== "subscription_update") return;

  console.log("Processing subscription update via invoice:", {
    id: invoice.id,
    subscription: subscriptionId,
  });

  const customer = await prisma.stripeCustomer.findUnique({
    where: { id: invoice.customer as string },
    include: { user: true },
  });

  if (!customer?.user) {
    console.error(`No user found for customer ${invoice.customer}`);
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0].price.id;
  const newCredits = await getCreditsFromPrice(priceId);

  // Find the old plan from proration line items
  const prorationCreditLine = invoice.lines.data.find(
    (line) => line.amount < 0 && line.description?.includes("Unused time"),
  );

  const oldPriceFromLine = prorationCreditLine?.pricing?.price_details?.price;

  if (!oldPriceFromLine) {
    console.error(
      `No proration credit line found in invoice ${invoice.id}. Cannot determine old plan credits.`,
    );
    return;
  }

  const oldPriceId =
    typeof oldPriceFromLine === "string"
      ? oldPriceFromLine
      : oldPriceFromLine.id;
  const oldCredits = await getCreditsFromPrice(oldPriceId);

  // Calculate prorated credit difference
  const { factor: prorationFactor, debug: prorationDebug } =
    await calculateCreditProrationFactor(subscription);

  const fullCreditDifference = newCredits - oldCredits;
  const proratedCredits = Math.floor(fullCreditDifference * prorationFactor);

  console.log("Plan change proration calculation:", {
    oldCredits,
    newCredits,
    fullDifference: fullCreditDifference,
    prorationFactor: prorationFactor.toFixed(3),
    proratedCredits,
    prorationDebug,
  });

  // Grant prorated credits (only for upgrades)
  if (proratedCredits > 0) {
    const previousCredits = customer.user.credits;
    await prisma.$transaction([
      prisma.user.update({
        where: { id: customer.user.id },
        data: { credits: { increment: proratedCredits } },
      }),
      prisma.userCreditHistory.create({
        data: {
          userId: customer.user.id,
          credits: proratedCredits,
          previousCredits,
          newCredits: previousCredits + proratedCredits,
          reason: "SUBSCRIPTION_UPDATE",
          reasonExtra: `Plan upgraded (prorated ${Math.round(prorationFactor * 100)}% of ${fullCreditDifference} = ${proratedCredits} credits)`,
        },
      }),
    ]);
    console.log(
      `Granted ${proratedCredits} prorated credits to user ${customer.user.id} for plan upgrade`,
    );
  } else if (fullCreditDifference > 0 && proratedCredits === 0) {
    // Edge case: upgrade at end of billing period rounds to 0 - grant at least 1
    const previousCredits = customer.user.credits;
    await prisma.$transaction([
      prisma.user.update({
        where: { id: customer.user.id },
        data: { credits: { increment: 1 } },
      }),
      prisma.userCreditHistory.create({
        data: {
          userId: customer.user.id,
          credits: 1,
          previousCredits,
          newCredits: previousCredits + 1,
          reason: "SUBSCRIPTION_UPDATE",
          reasonExtra: "Plan upgraded at end of period (minimum 1 credit granted)",
        },
      }),
    ]);
    console.log(
      `Granted 1 minimum credit to user ${customer.user.id} (upgrade at end of billing period)`,
    );
  } else {
    console.log(
      `No credits granted - downgrade or same plan (full difference: ${fullCreditDifference}, prorated: ${proratedCredits})`,
    );
  }
}

// ─── Checkout Handler ─────────────────────────────────────────

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
) {
  console.log("Processing checkout session:", {
    id: session.id,
    mode: session.mode,
    metadata: session.metadata,
  });

  if (!session.metadata?.userId) {
    console.error("No userId in checkout session metadata");
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.metadata.userId },
  });

  if (!user) {
    console.error(`No user found for id ${session.metadata.userId}`);
    return;
  }

  // For subscriptions, credits are handled via invoice.payment_succeeded
  if (session.mode === "subscription") {
    console.log(
      `Checkout completed for subscription ${session.subscription}, credits will be granted via invoice.payment_succeeded`,
    );
    return;
  }

  // Handle one-time credit purchase
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
      console.log(`Granted ${credits} permanent credits to user ${user.id}`);
    }
  }
}

// ─── Centralized Subscription Event Handler ───────────────────

async function handleSubscriptionEvent(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;
  const previousAttributes = event.data
    .previous_attributes as SubscriptionPreviousAttributes | null;

  const customer = await prisma.stripeCustomer.findUnique({
    where: { id: subscription.customer as string },
    include: {
      user: true,
      subscriptions: {
        where: { status: { in: ["active", "trialing"] } },
        include: {
          price: { include: { product: true } },
        },
      },
    },
  });

  if (!customer) {
    console.error(
      `Customer ${subscription.customer} not found in database`,
    );
    return;
  }

  if (!customer.user) {
    console.error(
      `No user found for customer ${subscription.customer}`,
    );
    return;
  }

  const verifiedCustomer: CustomerWithUser = {
    user: customer.user,
  };

  switch (event.type) {
    case "customer.subscription.created":
      await handleSubscriptionCreated(subscription, customer);
      break;

    case "customer.subscription.updated":
      await handleSubscriptionUpdated(
        subscription,
        verifiedCustomer,
        previousAttributes,
      );
      break;

    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(subscription);
      break;
  }
}

// ─── Main Handler ─────────────────────────────────────────────

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

    // Idempotency: skip already-processed events
    if (await isEventProcessed(event.id)) {
      console.log(`Event ${event.id} already processed, skipping`);
      return res.json({ received: true });
    }

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
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionEvent(event);
        break;
      default:
        console.log(`Unhandled event type: ${eventType}`);
    }

    // Mark event as processed for idempotency
    await markEventProcessed(event.id, eventType);

    res.json({ received: true });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error(`Error processing webhook: ${errorMessage}`);
    res.status(500).send(`Server error: ${errorMessage}`);
  }
}
