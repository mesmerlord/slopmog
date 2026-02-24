import { prisma } from "./db";
import type { CreditReason } from "@prisma/client";

export interface DeductCreditsResult {
  success: boolean;
  creditsDeducted: number;
  permanentCreditsDeducted: number;
  totalDeducted: number;
  remainingCredits: number;
  remainingPermanentCredits: number;
  error?: string;
}

export interface DeductCreditsOptions {
  userId: string;
  amount: number;
  reason: CreditReason;
  reasonExtra?: string;
  throwOnInsufficient?: boolean;
}

export async function deductCredits(
  options: DeductCreditsOptions,
): Promise<DeductCreditsResult> {
  const { userId, amount, reason, reasonExtra, throwOnInsufficient = true } = options;

  if (amount <= 0) {
    throw new Error("Deduction amount must be positive");
  }

  // Use interactive transaction with row-level locking to prevent race conditions
  return prisma.$transaction(async (tx) => {
    // SELECT ... FOR UPDATE to lock the user row
    const rows = await tx.$queryRawUnsafe<
      Array<{ credits: number; permanentCredits: number }>
    >(
      `SELECT "credits", "permanentCredits" FROM "User" WHERE "id" = $1 FOR UPDATE`,
      userId,
    );

    if (!rows.length) {
      throw new Error(`User ${userId} not found`);
    }

    const user = rows[0];
    const totalAvailable = user.credits + user.permanentCredits;

    if (totalAvailable < amount) {
      if (throwOnInsufficient) {
        throw new Error(
          `Insufficient credits. Required: ${amount}, Available: ${totalAvailable}`,
        );
      }
      return {
        success: false,
        creditsDeducted: 0,
        permanentCreditsDeducted: 0,
        totalDeducted: 0,
        remainingCredits: user.credits,
        remainingPermanentCredits: user.permanentCredits,
        error: `Insufficient credits. Required: ${amount}, Available: ${totalAvailable}`,
      };
    }

    const creditsToDeduct = Math.min(user.credits, amount);
    const permanentCreditsToDeduct = amount - creditsToDeduct;

    const newCredits = user.credits - creditsToDeduct;
    const newPermanentCredits = user.permanentCredits - permanentCreditsToDeduct;

    await tx.user.update({
      where: { id: userId },
      data: {
        credits: { decrement: creditsToDeduct },
        permanentCredits: { decrement: permanentCreditsToDeduct },
      },
    });

    await tx.userCreditHistory.create({
      data: {
        userId,
        credits: -amount,
        previousCredits: user.credits + user.permanentCredits,
        newCredits: newCredits + newPermanentCredits,
        reason,
        reasonExtra: reasonExtra || undefined,
      },
    });

    return {
      success: true,
      creditsDeducted: creditsToDeduct,
      permanentCreditsDeducted: permanentCreditsToDeduct,
      totalDeducted: amount,
      remainingCredits: newCredits,
      remainingPermanentCredits: newPermanentCredits,
    };
  });
}

export async function addPermanentCredits(options: {
  userId: string;
  amount: number;
  reason: CreditReason;
  reasonExtra?: string;
}): Promise<{ newPermanentCredits: number; newTotalCredits: number }> {
  const { userId, amount, reason, reasonExtra } = options;

  if (amount <= 0) {
    throw new Error("Credit amount must be positive");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true, permanentCredits: true },
  });

  if (!user) {
    throw new Error(`User ${userId} not found`);
  }

  const previousTotal = user.credits + user.permanentCredits;
  const newPermanentCredits = user.permanentCredits + amount;
  const newTotal = user.credits + newPermanentCredits;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { permanentCredits: { increment: amount } },
    }),
    prisma.userCreditHistory.create({
      data: {
        userId,
        credits: amount,
        previousCredits: previousTotal,
        newCredits: newTotal,
        reason,
        reasonExtra: reasonExtra
          ? `${reasonExtra} [Permanent credits]`
          : "[Permanent credits]",
      },
    }),
  ]);

  return { newPermanentCredits, newTotalCredits: newTotal };
}

export async function hasEnoughCredits(
  userId: string,
  amount: number,
): Promise<{
  hasEnough: boolean;
  totalCredits: number;
  credits: number;
  permanentCredits: number;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true, permanentCredits: true },
  });

  if (!user) {
    return { hasEnough: false, totalCredits: 0, credits: 0, permanentCredits: 0 };
  }

  const totalCredits = user.credits + user.permanentCredits;
  return {
    hasEnough: totalCredits >= amount,
    totalCredits,
    credits: user.credits,
    permanentCredits: user.permanentCredits,
  };
}

export async function refundCredits(options: {
  userId: string;
  amount: number;
  reason: CreditReason;
  reasonExtra?: string;
}): Promise<void> {
  const { userId, amount, reason, reasonExtra } = options;

  if (amount <= 0) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true, permanentCredits: true },
  });

  if (!user) return;

  const previousTotal = user.credits + user.permanentCredits;
  const newTotal = previousTotal + amount;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { credits: { increment: amount } },
    }),
    prisma.userCreditHistory.create({
      data: {
        userId,
        credits: amount,
        previousCredits: previousTotal,
        newCredits: newTotal,
        reason,
        reasonExtra: reasonExtra
          ? `${reasonExtra} [Refund]`
          : "[Refund]",
      },
    }),
  ]);
}

export async function getTotalCredits(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true, permanentCredits: true },
  });

  if (!user) return 0;

  return user.credits + user.permanentCredits;
}
