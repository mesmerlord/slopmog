import { router } from "@/server/trpc";
import { userRouter } from "@/routers/user";
import { campaignRouter } from "@/routers/campaign";

export const appRouter = router({
  user: userRouter,
  campaign: campaignRouter,
});

export type AppRouter = typeof appRouter;
