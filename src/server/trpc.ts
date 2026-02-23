import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/utils/auth";
import type { CreateNextContextOptions } from "@trpc/server/adapters/next";
import { prisma } from "@/server/utils/db";
import type { Session } from "next-auth";

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
};

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;

const isAuthed = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in",
    });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      user: ctx.session.user,
    },
  });
});

export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(isAuthed);
