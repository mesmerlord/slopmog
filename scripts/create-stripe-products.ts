import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";
import { planList } from "../src/constants/pricing";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

const prisma = new PrismaClient();

async function createStripeProducts() {
  console.log("Creating Stripe products and prices...\n");

  for (const plan of planList) {
    // Create product
    const product = await stripe.products.create({
      name: plan.plan_name,
      description: plan.description,
      metadata: {
        credits_per_month: plan.credits_per_month.toString(),
        plan_id: plan.id,
      },
    });

    console.log(`Created product: ${product.name} (${product.id})`);

    // Create monthly price
    const monthlyPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.price.monthly * 100,
      currency: "usd",
      recurring: { interval: "month" },
    });

    console.log(`  Monthly price: $${plan.price.monthly}/mo (${monthlyPrice.id})`);

    // Create yearly price
    const yearlyPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(plan.price.yearly * 100),
      currency: "usd",
      recurring: { interval: "year" },
    });

    console.log(`  Yearly price: $${plan.price.yearly}/yr (${yearlyPrice.id})`);

    // Save to database
    await prisma.stripeProduct.upsert({
      where: { id: product.id },
      create: {
        id: product.id,
        name: product.name,
        description: product.description,
        metadata: product.metadata,
      },
      update: {
        name: product.name,
        description: product.description,
        metadata: product.metadata,
      },
    });

    await prisma.stripePrice.upsert({
      where: { id: monthlyPrice.id },
      create: {
        id: monthlyPrice.id,
        productId: product.id,
        currency: "usd",
        unitAmount: plan.price.monthly * 100,
        type: "recurring",
        interval: "month",
        intervalCount: 1,
      },
      update: {
        unitAmount: plan.price.monthly * 100,
      },
    });

    await prisma.stripePrice.upsert({
      where: { id: yearlyPrice.id },
      create: {
        id: yearlyPrice.id,
        productId: product.id,
        currency: "usd",
        unitAmount: Math.round(plan.price.yearly * 100),
        type: "recurring",
        interval: "year",
        intervalCount: 1,
      },
      update: {
        unitAmount: Math.round(plan.price.yearly * 100),
      },
    });

    console.log(`  Saved to database\n`);
  }

  console.log("Done! Update pricing.ts with the price IDs above.");
  await prisma.$disconnect();
}

createStripeProducts().catch(console.error);
