import type { PostingProvider } from "./provider";
import { postingRegistry } from "./provider";
import type {
  PostCommentParams,
  CreateOrderResult,
  OrderStatusResult,
} from "./types";

const twitterStubProvider: PostingProvider = {
  name: "twitter-stub",
  platform: "TWITTER" as const,

  async createCommentOrder(
    _params: PostCommentParams,
  ): Promise<CreateOrderResult> {
    return {
      success: false,
      error: "Twitter posting coming soon",
      retryable: false,
    };
  },

  async checkOrderStatus(
    _orderId: string,
  ): Promise<OrderStatusResult> {
    return {
      status: "unknown",
      error: "Twitter posting not yet implemented",
    };
  },

  async isAvailable(): Promise<boolean> {
    return false;
  },
};

postingRegistry.register(twitterStubProvider);

export { twitterStubProvider };
