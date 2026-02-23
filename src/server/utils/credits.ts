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

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true, permanentCredits: true },
  });

  if (!user) {
    throw new Error(`User ${userId} not found`);
  }

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

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        credits: { decrement: creditsToDeduct },
        permanentCredits: { decrement: permanentCreditsToDeduct },
      },
    }),
    prisma.userCreditHistory.create({
      data: {
        userId,
        credits: -amount,
        previousCredits: user.credits + user.permanentCredits,
        newCredits: newCredits + newPermanentCredits,
        reason,
        reasonExtra: reasonExtra || undefined,
      },
    }),
  ]);

  return {
    success: true,
    creditsDeducted: creditsToDeduct,
    permanentCreditsDeducted: permanentCreditsToDeduct,
    totalDeducted: amount,
    remainingCredits: newCredits,
    remainingPermanentCredits: newPermanentCredits,
  };
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
