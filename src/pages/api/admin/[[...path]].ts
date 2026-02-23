import {
  campaignQueue,
  postGenerationQueue,
  postingQueue,
} from "@/queue/queues";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import express from "express";
import { type NextApiRequest, type NextApiResponse } from "next";
import { getSession } from "next-auth/react";

const app = express();
const basePath = "/api/admin";
const serverAdapter = new ExpressAdapter();

serverAdapter.setBasePath(basePath);

const queueAdapter = (queue: ConstructorParameters<typeof BullMQAdapter>[0]) =>
  new BullMQAdapter(queue, { readOnlyMode: false, allowRetries: true });

createBullBoard({
  queues: [
    queueAdapter(campaignQueue),
    queueAdapter(postGenerationQueue),
    queueAdapter(postingQueue),
  ],
  // @ts-ignore
  serverAdapter: serverAdapter,
  options: { uiBasePath: "node_modules/@bull-board/ui", uiConfig: {} },
});

const router = app.use(basePath, serverAdapter.getRouter());

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getSession({ req });

  if (!session) {
    res.status(401).end();
    return;
  }

  return router(req, res);
}
