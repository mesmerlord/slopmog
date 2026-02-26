import { router } from "@/server/trpc";
import { userRouter } from "@/routers/user";
import { campaignRouter } from "@/routers/campaign";
import { opportunityRouter } from "@/routers/opportunity";
import { commentRouter } from "@/routers/comment";
import { toolsRouter } from "@/routers/tools";

export const appRouter = router({
  user: userRouter,
  campaign: campaignRouter,
  opportunity: opportunityRouter,
  comment: commentRouter,
  tools: toolsRouter,
});

export type AppRouter = typeof appRouter;
