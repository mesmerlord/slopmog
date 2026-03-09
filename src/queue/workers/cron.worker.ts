import { Worker } from "bullmq";
import { redisConnection } from "@/server/utils/redis";
import { prisma } from "@/server/utils/db";
import {
  discoveryQueue,
  hvDiscoveryQueue,
  type DiscoveryJobData,
  type HVDiscoveryJobData,
} from "@/queue/queues";

const PAID_USER_FILTER = {
  OR: [
    { role: "ADMIN" as const },
    {
      stripeCustomer: {
        subscriptions: {
          some: { status: { in: ["active", "trialing"] } },
        },
      },
    },
  ],
};

const getActiveSites = () =>
  prisma.site.findMany({
    where: {
      active: true,
      mode: "AUTO",
      user: PAID_USER_FILTER,
    },
    select: { id: true },
  });

new Worker(
  "cron",
  async (job) => {
    switch (job.name) {
      case "daily-discovery": {
        const sites = await getActiveSites();
        console.log(`[cron] daily-discovery: enqueueing ${sites.length} sites`);

        for (const site of sites) {
          const data: DiscoveryJobData = {
            siteId: site.id,
            triggeredBy: "schedule",
          };
          await discoveryQueue.add(`discovery-${site.id}`, data, {
            jobId: `sched-disc-${site.id}-${Date.now()}`,
          });
        }
        break;
      }

      case "weekly-hv-discovery": {
        const sites = await getActiveSites();
        console.log(
          `[cron] weekly-hv-discovery: enqueueing ${sites.length} sites`,
        );

        for (const site of sites) {
          const data: HVDiscoveryJobData = {
            siteId: site.id,
            triggeredBy: "schedule",
          };
          await hvDiscoveryQueue.add(`hv-discovery-${site.id}`, data, {
            jobId: `sched-hv-${site.id}-${Date.now()}`,
          });
        }
        break;
      }

      default:
        console.warn(`[cron] Unknown job name: ${job.name}`);
    }
  },
  { connection: redisConnection, concurrency: 1 },
);

console.log("Cron worker registered");
