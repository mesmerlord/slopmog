import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import express from "express";
import { type NextApiRequest, type NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/utils/auth";
import { discoveryQueue, generationQueue, postingQueue, healthCheckQueue } from "@/queue/queues";

const app = express();
const basePath = "/api/admin";
const serverAdapter = new ExpressAdapter();

serverAdapter.setBasePath(basePath);

const queueAdapter = (queue: ConstructorParameters<typeof BullMQAdapter>[0]) =>
  new BullMQAdapter(queue, { readOnlyMode: false, allowRetries: true });

createBullBoard({
  queues: [
    queueAdapter(discoveryQueue),
    queueAdapter(generationQueue),
    queueAdapter(postingQueue),
    queueAdapter(healthCheckQueue),
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
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    res.status(401).end();
    return;
  }

  if (session.user.role !== "ADMIN") {
    res.status(403).end();
    return;
  }

  return router(req, res);
}
