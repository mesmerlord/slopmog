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
  id: number;
  cost: number;
  balance: number;
}

/** POST /api/public/v1/status response — map of order ID → status string */
type UMStatusResponse = Record<string, string>;

/** GET /api/public/v1/balance response */
interface UMBalanceResponse {
  balance: number;
}

// ─── Config ─────────────────────────────────────────────────

const CUSTOM_COMMENTS_SERVICE_ID = 5;

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

  async createCommentOrder(params: PostCommentParams): Promise<CreateOrderResult> {
    try {
      const response = await fetchWithRetry<UMCreateOrderResponse>(
        apiUrl("/orders"),
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            service: CUSTOM_COMMENTS_SERVICE_ID,
            link: params.threadUrl,
            comments: params.commentText,
          }),
          rateLimit: RATE_LIMIT,
          retry: { maxRetries: 2, baseDelayMs: 5000, maxDelayMs: 30000 },
        },
      );

      if (response.id) {
        return {
          success: true,
          orderId: String(response.id),
          cost: response.cost,
          balance: response.balance,
          retryable: false,
        };
      }

      return {
        success: false,
        error: "No order ID returned from UpvoteMax",
        retryable: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // 401/403 = bad API key, not retryable
      // 402 = insufficient balance, not retryable
      const notRetryable =
        message.includes("401") ||
        message.includes("403") ||
        message.includes("402");

      return {
        success: false,
        error: message,
        retryable: !notRetryable,
      };
    }
  },

  async checkOrderStatus(orderId: string): Promise<OrderStatusResult> {
    try {
      // Use the status endpoint with order IDs
      const response = await fetchWithRetry<UMStatusResponse>(
        apiUrl("/status"),
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify([orderId]),
          rateLimit: RATE_LIMIT,
          retry: { maxRetries: 1, baseDelayMs: 2000, maxDelayMs: 10000 },
        },
      );

      const rawStatus = response[orderId];
      if (!rawStatus) {
        return { status: "unknown", error: "Order not found in status response" };
      }

      return { status: normalizeStatus(rawStatus) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { status: "unknown", error: message };
    }
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
