import { router } from "@/server/trpc";
import { userRouter } from "@/routers/user";
import { siteRouter } from "@/routers/site";
import { opportunityRouter } from "@/routers/opportunity";
import { commentRouter } from "@/routers/comment";

export const appRouter = router({
  user: userRouter,
  site: siteRouter,
  opportunity: opportunityRouter,
  comment: commentRouter,
});

export type AppRouter = typeof appRouter;
