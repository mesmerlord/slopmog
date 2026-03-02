import { fetchWithRetry } from "@/services/shared/http";
import type { PostingProvider } from "./provider";
import { postingRegistry } from "./provider";
import type {
  PostCommentParams,
  CreateOrderResult,
  OrderStatusResult,
  OrderStatus,
} from "./types";

// ─── UpvoteMax API types ────────────────────────────────────

/** POST /api/public/v1/orders response */
interface UMCreateOrderResponse {
  status: string;
  orderId: number;
  cost: number;
  balanceAfter: number;
}

/** POST /api/public/v1/status response */
interface UMStatusResponse {
  results: Array<{ orderId: number; status: string }>;
}

/** GET /api/public/v1/balance response */
interface UMBalanceResponse {
  balance: number;
}

// ─── Config ─────────────────────────────────────────────────

const CUSTOM_COMMENTS_SERVICE_KEY = "custom_comments";

function getConfig() {
  const apiKey = process.env.UPVOTEMAX_API_KEY;
  const baseUrl = process.env.UPVOTEMAX_BASE_URL;
  if (!apiKey || !baseUrl) {
    throw new Error("UPVOTEMAX_API_KEY and UPVOTEMAX_BASE_URL must be set");
  }
  // Ensure base URL doesn't have trailing slash
  return { apiKey, baseUrl: baseUrl.replace(/\/+$/, "") };
}

function apiUrl(path: string): string {
  const { baseUrl } = getConfig();
  return `${baseUrl}/api/public/v1${path}`;
}

function authHeaders(): Record<string, string> {
  const { apiKey } = getConfig();
  return {
    "x-api-key": apiKey,
    "Content-Type": "application/json",
  };
}

const RATE_LIMIT = {
  key: "upvotemax",
  maxRequests: 10,
  windowMs: 60 * 60 * 1000, // 10 per hour — conservative for natural patterns
};

// ─── Helpers ────────────────────────────────────────────────

function normalizeStatus(raw: string): OrderStatus {
  const lower = raw.toLowerCase();
  if (lower === "pending") return "pending";
  if (lower === "running" || lower === "in_progress" || lower === "processing") return "running";
  if (lower === "completed" || lower === "complete") return "completed";
  if (lower === "failed" || lower === "error" || lower === "cancelled" || lower === "canceled") return "failed";
  return "unknown";
}

// ─── Provider ───────────────────────────────────────────────

const upvoteMaxProvider: PostingProvider = {
  name: "upvotemax",
  platform: "REDDIT" as const,

  async createCommentOrder(params: PostCommentParams): Promise<CreateOrderResult> {
    console.log(`[upvotemax] Creating comment order: context=${params.sourceContext}, url=${params.contentUrl}`);
    try {
      const response = await fetchWithRetry<UMCreateOrderResponse>(
        apiUrl("/orders"),
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            service: CUSTOM_COMMENTS_SERVICE_KEY,
            link: params.contentUrl,
            // UpvoteMax treats \n as separate comments — flatten to a single line
            comments: params.commentText.replace(/\n+/g, " ").trim(),
          }),
          rateLimit: RATE_LIMIT,
          retry: { maxRetries: 2, baseDelayMs: 5000, maxDelayMs: 30000 },
        },
      );

      console.log(`[upvotemax] Order response:`, JSON.stringify(response));

      if (response.orderId) {
        console.log(`[upvotemax] Order created: id=${response.orderId}, cost=${response.cost}, balance=${response.balanceAfter}`);
        return {
          success: true,
          orderId: String(response.orderId),
          cost: response.cost,
          balance: response.balanceAfter,
          retryable: false,
        };
      }

      console.error(`[upvotemax] No order ID in response:`, JSON.stringify(response));
      return {
        success: false,
        error: "No order ID returned from UpvoteMax",
        retryable: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[upvotemax] createCommentOrder error: ${message}`);

      // 400 = bad request (invalid params), not retryable
      // 401/403 = bad API key, not retryable
      // 402 = insufficient balance, not retryable
      const notRetryable =
        message.includes("400") ||
        message.includes("401") ||
        message.includes("403") ||
        message.includes("402");

      console.error(`[upvotemax] Retryable: ${!notRetryable}`);

      return {
        success: false,
        error: message,
        retryable: !notRetryable,
      };
    }
  },

  async checkOrderStatus(orderId: string): Promise<OrderStatusResult> {
    console.log(`[upvotemax] Checking order status: ${orderId}`);
    try {
      // Use the status endpoint with order IDs
      const response = await fetchWithRetry<UMStatusResponse>(
        apiUrl("/status"),
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ orders: [orderId] }),
          rateLimit: RATE_LIMIT,
          retry: { maxRetries: 1, baseDelayMs: 2000, maxDelayMs: 10000 },
        },
      );

      const entry = response.results?.find((r) => String(r.orderId) === orderId);
      if (!entry) {
        console.error(`[upvotemax] Order ${orderId} not found in status response:`, JSON.stringify(response));
        return { status: "unknown", error: "Order not found in status response" };
      }

      console.log(`[upvotemax] Order ${orderId} status: ${entry.status} → ${normalizeStatus(entry.status)}`);
      return { status: normalizeStatus(entry.status) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[upvotemax] checkOrderStatus error for ${orderId}: ${message}`);
      return { status: "unknown", error: message };
    }
  },

  async checkMultipleOrderStatuses(orderIds: string[]): Promise<Map<string, OrderStatusResult>> {
    console.log(`[upvotemax] Checking status for ${orderIds.length} orders: ${orderIds.join(", ")}`);
    const results = new Map<string, OrderStatusResult>();
    try {
      const response = await fetchWithRetry<UMStatusResponse>(
        apiUrl("/status"),
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ orders: orderIds }),
          rateLimit: RATE_LIMIT,
          retry: { maxRetries: 1, baseDelayMs: 2000, maxDelayMs: 10000 },
        },
      );

      for (const id of orderIds) {
        const entry = response.results?.find((r) => String(r.orderId) === id);
        if (entry) {
          results.set(id, { status: normalizeStatus(entry.status) });
        } else {
          results.set(id, { status: "unknown", error: "Order not found in status response" });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[upvotemax] checkMultipleOrderStatuses error: ${message}`);
      for (const id of orderIds) {
        results.set(id, { status: "unknown", error: message });
      }
    }
    return results;
  },

  async isAvailable(): Promise<boolean> {
    try {
      getConfig(); // Will throw if env vars missing
      return true;
    } catch {
      return false;
    }
  },

  async getBalance(): Promise<number> {
    try {
      const response = await fetchWithRetry<UMBalanceResponse>(
        apiUrl("/balance"),
        {
          headers: authHeaders(),
          rateLimit: RATE_LIMIT,
          retry: { maxRetries: 1, baseDelayMs: 2000, maxDelayMs: 10000 },
        },
      );
      return response.balance ?? 0;
    } catch {
      return 0;
    }
  },
};

// Register on import
postingRegistry.register(upvoteMaxProvider);

export { upvoteMaxProvider };
