import { router } from "@/server/trpc";
import { userRouter } from "@/routers/user";
import { campaignRouter } from "@/routers/campaign";
import { opportunityRouter } from "@/routers/opportunity";
import { commentRouter } from "@/routers/comment";

export const appRouter = router({
  user: userRouter,
  campaign: campaignRouter,
  opportunity: opportunityRouter,
  comment: commentRouter,
});

export type AppRouter = typeof appRouter;
