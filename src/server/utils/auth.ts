import { type GetServerSidePropsContext } from "next";
import {
  getServerSession,
  type DefaultSession,
  type NextAuthOptions,
} from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/server/utils/db";
import { FREE_CREDITS } from "@/constants/pricing";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      stripeCustomerId?: string | null;
      role?: string;
    } & DefaultSession["user"];
  }

  interface User {
    stripeCustomerId?: string | null;
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password) {
          throw new Error("Invalid credentials");
        }

        // TODO: Add bcrypt comparison when password auth is needed
        // const isValid = await bcrypt.compare(credentials.password, user.password);
        // if (!isValid) throw new Error("Invalid credentials");

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          stripeCustomerId: user.stripeCustomerId,
        };
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  events: {
    async createUser({ user }) {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: {
            credits: FREE_CREDITS,
            emailVerified: new Date(),
          },
        }),
        prisma.userCreditHistory.create({
          data: {
            userId: user.id,
            credits: FREE_CREDITS,
            previousCredits: 0,
            newCredits: FREE_CREDITS,
            reason: "REGISTRATION_BONUS",
            reasonExtra: "Free credits on sign up",
          },
        }),
      ]);
    },
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.stripeCustomerId = user.stripeCustomerId;
      }

      if (account?.provider === "google" && token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.stripeCustomerId = dbUser.stripeCustomerId;
          token.role = dbUser.role;
        }
      }

      return token;
    },
    session: ({ session, token }) => ({
      ...session,
      user: {
        ...session.user,
        id: token.id,
        stripeCustomerId: token.stripeCustomerId,
        role: token.role,
      },
    }),
  },
  pages: {
    signIn: "/auth/login",
    newUser: "/auth/register",
    error: "/auth/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-next-auth.session-token"
          : "slopmog-next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 24 * 60 * 60,
      },
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
};

export function getServerAuthSession(ctx: {
  req: GetServerSidePropsContext["req"];
  res: GetServerSidePropsContext["res"];
}) {
  return getServerSession(ctx.req, ctx.res, authOptions);
}
