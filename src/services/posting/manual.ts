import type { PostingProvider } from "./provider";
import { postingRegistry } from "./provider";
import type {
  PostCommentParams,
  CreateOrderResult,
  OrderStatusResult,
} from "./types";

/**
 * Manual posting provider for Reddit HV opportunities.
 *
 * Marks comments as "posted" immediately so we can verify them
 * ourselves via daily health checks (Reddit / YouTube).
 * No external API calls — just returns success with a tracking ID.
 */
const manualProvider: PostingProvider = {
  name: "manual",
  platform: "REDDIT" as const,

  async createCommentOrder(params: PostCommentParams): Promise<CreateOrderResult> {
    console.log(`[manual] Marking comment as posted: url=${params.contentUrl}`);
    return {
      success: true,
      orderId: `manual-${Date.now()}`,
      retryable: false,
    };
  },

  async checkOrderStatus(): Promise<OrderStatusResult> {
    // Manual posts are always "completed" — real verification
    // happens via the daily health check
    return { status: "completed" };
  },

  async isAvailable(): Promise<boolean> {
    return true;
  },
};

postingRegistry.register(manualProvider);

export { manualProvider };
