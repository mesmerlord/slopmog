import type { PostCommentParams, PostCommentResult, CommentStatus } from "./types";

export interface PostingProvider {
  name: string;
  postComment(params: PostCommentParams): Promise<PostCommentResult>;
  checkCommentStatus?(commentId: string): Promise<CommentStatus>;
  isAvailable(): Promise<boolean>;
  getRemainingCapacity?(): Promise<number>;
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

  getAll(): PostingProvider[] {
    return [...this.providers];
  }
}

export const postingRegistry = new PostingProviderRegistry();
