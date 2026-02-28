import type {
  PostCommentParams,
  CreateOrderResult,
  OrderStatusResult,
} from "./types";

export interface PostingProvider {
  name: string;
  platform: "REDDIT" | "YOUTUBE" | "TWITTER";
  createCommentOrder(params: PostCommentParams): Promise<CreateOrderResult>;
  checkOrderStatus(orderId: string): Promise<OrderStatusResult>;
  checkMultipleOrderStatuses?(orderIds: string[]): Promise<Map<string, OrderStatusResult>>;
  isAvailable(): Promise<boolean>;
  getBalance?(): Promise<number>;
}

class PostingProviderRegistry {
  private providers: PostingProvider[] = [];

  register(provider: PostingProvider): void {
    this.providers.push(provider);
  }

  getPrimary(): PostingProvider | undefined {
    return this.providers[0];
  }

  async getFirstAvailable(): Promise<PostingProvider | undefined> {
    for (const provider of this.providers) {
      const available = await provider.isAvailable();
      if (available) return provider;
    }
    return undefined;
  }

  getForPlatform(platform: string): PostingProvider | undefined {
    return this.providers.find((p) => p.platform === platform);
  }

  getAll(): PostingProvider[] {
    return [...this.providers];
  }
}

export const postingRegistry = new PostingProviderRegistry();
