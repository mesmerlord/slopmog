import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/utils/auth";
import type { CreateNextContextOptions } from "@trpc/server/adapters/next";
import { prisma } from "@/server/utils/db";
import type { Session } from "next-auth";
import type { IncomingMessage } from "http";
import { getImpersonation, type ImpersonationData } from "@/server/utils/redis";

export const createContext = async (opts: CreateNextContextOptions) => {
  let session = null;
  try {
    session = await getServerSession(opts.req, opts.res, authOptions);
  } catch (error) {
    console.warn("Session decryption failed, clearing cookie:", error);

    const isProduction = process.env.NODE_ENV === "production";
    const cookieName = isProduction
      ? "__Secure-next-auth.session-token"
      : "slopmog-next-auth.session-token";

    opts.res.setHeader("Set-Cookie", [
      `${cookieName}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; ${isProduction ? "Secure; " : ""}SameSite=Lax`,
    ]);
  }
  return {
    session,
    prisma,
    req: opts.req || undefined,
  };
};

export type Context = {
  session: Session | null;
  prisma: typeof prisma;
  req?: IncomingMessage;
};

export type ImpersonationContext = {
  isImpersonating: boolean;
  realAdminId: string | null;
  impersonationData: ImpersonationData | null;
};

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;

// Auth middleware with impersonation support (for regular protected routes)
const isAuthedWithImpersonation = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in",
    });
  }

  const realUser = ctx.session.user;
  let effectiveUser = realUser;
  let impersonationContext: ImpersonationContext = {
    isImpersonating: false,
    realAdminId: null,
    impersonationData: null,
  };

  if (realUser.role === "ADMIN") {
    const impersonationData = await getImpersonation(realUser.id);

    if (impersonationData) {
      const targetUser = await ctx.prisma.user.findUnique({
        where: { id: impersonationData.targetUserId },
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          stripeCustomerId: true,
          role: true,
        },
      });

      if (targetUser) {
        effectiveUser = {
          ...realUser,
          id: targetUser.id,
          email: targetUser.email,
          name: targetUser.name,
          image: targetUser.image,
          stripeCustomerId: targetUser.stripeCustomerId,
          role: targetUser.role,
        };

        impersonationContext = {
          isImpersonating: true,
          realAdminId: realUser.id,
          impersonationData,
        };
      }
    }
  }

  return next({
    ctx: {
      ...ctx,
      session: {
        ...ctx.session,
        user: effectiveUser,
      },
      user: effectiveUser,
      impersonation: impersonationContext,
    },
  });
});

const isAdmin = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session?.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  if (ctx.session.user.role !== "ADMIN")
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  return next({
    ctx: { ...ctx, session: ctx.session, user: ctx.session.user },
  });
});

export const publicProcedure = t.procedure;
// Protected procedure WITH impersonation support (for regular user routes)
export const protectedProcedure = t.procedure.use(isAuthedWithImpersonation);
// Admin procedure WITHOUT impersonation swap (admins always act as themselves on admin routes)
export const adminProcedure = t.procedure.use(isAdmin);
