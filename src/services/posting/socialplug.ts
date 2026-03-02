import type { PostingProvider } from "./provider";
import { postingRegistry } from "./provider";
import type {
  PostCommentParams,
  CreateOrderResult,
  OrderStatusResult,
} from "./types";
import { prisma } from "@/server/utils/db";

// ─── SocialPlug Panel Config ────────────────────────────────

const PANEL_BASE = "https://panel.socialplug.io";
const YOUTUBE_SERVICE_COMMENT_COUNT = 5;
const MAX_SOCIALPLUG_COMMENT_LENGTH = 500;
const ORDER_PAGE_PATH = "/order/youtube-services/portal";
const ORDER_PAGE_PATH_WITH_REF = "/order/youtube-services/portal?ref=youtubecomments";
const SOCIALPLUG_PROVIDER = "socialplug";
const COOKIE_KEY = "cookies";

const BROWSER_HEADERS: Record<string, string> = {
  "accept": "*/*",
  "accept-language": "en-US,en;q=0.9",
  "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
  "origin": PANEL_BASE,
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
  "x-requested-with": "XMLHttpRequest",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
};

let missingCookieStorageWarned = false;

async function getCookies(): Promise<string> {
  try {
    const rows = await prisma.$queryRaw<Array<{ value: string }>>`
      SELECT "value"
      FROM "ProviderCredential"
      WHERE "provider" = ${SOCIALPLUG_PROVIDER}
        AND "key" = ${COOKIE_KEY}
      ORDER BY "updatedAt" DESC
      LIMIT 1
    `;
    const dbCookies = rows[0]?.value?.trim();
    if (dbCookies) return dbCookies;
  } catch (error) {
    if (!missingCookieStorageWarned) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`[socialplug] ProviderCredential lookup failed (${msg}). Falling back to env for now.`);
      missingCookieStorageWarned = true;
    }
  }

  throw new Error(
    "Missing SocialPlug cookies. Set ProviderCredential(provider='socialplug', key='cookies') in Prisma Studio.",
  );
}

function getOrderEmail(): string | undefined {
  const email = process.env.SOCIALPLUG_EMAIL?.trim();
  return email && email.length > 0 ? email : undefined;
}

function normalizeCommentsForService(commentText: string): string[] {
  const lines = commentText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const sanitized = lines
    .map((line) =>
      line
        .normalize("NFKD")
        .replace(/https?:\/\/\S+/gi, "")
        .replace(/[^\x20-\x7E]/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean)
    // Keep user-provided copy intact; only apply a generous hard cap for panel safety.
    .map((line) => line.slice(0, MAX_SOCIALPLUG_COMMENT_LENGTH).trim());

  if (sanitized.length === 0) return [];

  const normalized = [...sanitized];
  if (normalized.length > YOUTUBE_SERVICE_COMMENT_COUNT) {
    return normalized.slice(0, YOUTUBE_SERVICE_COMMENT_COUNT);
  }

  while (normalized.length < YOUTUBE_SERVICE_COMMENT_COUNT) {
    normalized.push(sanitized[normalized.length % sanitized.length]);
  }

  return normalized;
}

// ─── CSRF Token ─────────────────────────────────────────────

async function fetchCsrfToken(orderPagePath: string): Promise<string> {
  const url = `${PANEL_BASE}${orderPagePath}`;
  console.log(`[socialplug] Fetching CSRF token from ${url}`);
  const cookies = await getCookies();

  const res = await fetch(url, {
    headers: {
      "cookie": cookies,
      "user-agent": BROWSER_HEADERS["user-agent"],
    },
  });

  if (!res.ok) {
    throw new Error(
      `[socialplug] Failed to fetch order page: ${res.status} ${res.statusText}`,
    );
  }

  const html = await res.text();

  // Laravel embeds CSRF token in a meta tag
  const metaMatch = html.match(
    /<meta\s+name="csrf-token"\s+content="([^"]+)"/,
  );
  if (metaMatch) return metaMatch[1];

  // Or in a hidden input
  const inputMatch = html.match(
    /<input[^>]+name="_token"[^>]+value="([^"]+)"/,
  );
  if (inputMatch) return inputMatch[1];

  // Or in JavaScript
  const jsMatch = html.match(/csrf[_-]?token['":\s]+['"]([^'"]+)['"]/i);
  if (jsMatch) return jsMatch[1];

  throw new Error("[socialplug] Could not find CSRF token in page HTML");
}

// ─── Provider ───────────────────────────────────────────────

const socialPlugProvider: PostingProvider = {
  name: "socialplug",
  platform: "YOUTUBE" as const,

  async createCommentOrder(
    params: PostCommentParams,
  ): Promise<CreateOrderResult> {
    console.log(
      `[socialplug] Creating YouTube comment order: context=${params.sourceContext}, url=${params.contentUrl}`,
    );

    try {
      // Get fresh CSRF token from the YouTube order page
      const csrfToken = await fetchCsrfToken(ORDER_PAGE_PATH);

      // Service 144 is a fixed "5 Comments / Custom Comments" tier.
      const comments = normalizeCommentsForService(params.commentText);
      if (comments.length === 0) {
        return {
          success: false,
          error: "No valid comment text provided for SocialPlug order",
          retryable: false,
        };
      }
      const commentCountLabel = `${YOUTUBE_SERVICE_COMMENT_COUNT} Comments`;
      const commentsText = comments.join("\n");

      const trySubmit = async (mode: "captured" | "legacy") => {
        const formData = new URLSearchParams();
        formData.set("_token", csrfToken);
        formData.set("orderform", "youtube-services");
        if (mode === "legacy") {
          const email = getOrderEmail();
          if (email) formData.set("email", email);
          formData.set("dynamic-radio", commentCountLabel);
        }
        formData.set("field_1[3]", "144");
        formData.set("options_1[3][0]", commentCountLabel);
        formData.set("options_1[3][1]", "Custom Comments");
        formData.set("field_4", "");
        formData.set("field_5", params.contentUrl);
        formData.set("field_7", "");
        formData.set("field_10", commentsText);
        formData.set("field_15", "");
        formData.set("field_18", "");
        formData.set("field_19", "");
        formData.set("processor", "balance");
        formData.set("payment-method", "balance");
        formData.set("coupon", "");

        const res = await fetch(`${PANEL_BASE}/orderform/submit`, {
          method: "POST",
          headers: {
            ...BROWSER_HEADERS,
            "cookie": await getCookies(),
            "referer": `${PANEL_BASE}${mode === "captured" ? ORDER_PAGE_PATH : ORDER_PAGE_PATH_WITH_REF}`,
          },
          body: formData.toString(),
        });
        const responseText = await res.text();
        return { res, responseText };
      };

      // First try to mirror your latest captured request.
      let { res, responseText } = await trySubmit("captured");

      // Fallback to legacy payload if account/session expects older fields.
      if (!res.ok && res.status === 422 && responseText.toLowerCase().includes("email")) {
        console.warn("[socialplug] Captured payload asked for email; retrying with legacy email/dynamic-radio fields");
        ({ res, responseText } = await trySubmit("legacy"));
      }

      if (!res.ok) {
        console.error(
          `[socialplug] Submit failed: ${res.status}`,
          responseText.slice(0, 500),
        );
        return {
          success: false,
          error: `HTTP ${res.status}: ${responseText.slice(0, 200)}`,
          retryable: res.status >= 500,
        };
      }

      // Try to parse JSON response
      try {
        const json = JSON.parse(responseText) as Record<string, unknown>;
        console.log(`[socialplug] Response:`, JSON.stringify(json));

        const status = String(json.status ?? "").toLowerCase();
        if (
          json.success ||
          status === "succeeded" ||
          status === "success" ||
          json.order_id ||
          json.orderId ||
          json.success_link
        ) {
          return {
            success: true,
            orderId: String(
              json.order_id ?? json.orderId ?? "socialplug-instant",
            ),
            retryable: false,
          };
        }

        return {
          success: false,
          error:
            String(json.message ?? json.error ?? `Unexpected status: ${json.status}`),
          retryable: false,
        };
      } catch {
        // Response might be HTML or plain text
        const isSuccess =
          responseText.toLowerCase().includes("success") ||
          responseText.toLowerCase().includes("order placed");
        if (isSuccess) {
          return {
            success: true,
            orderId: "socialplug-instant",
            retryable: false,
          };
        }
        return {
          success: false,
          error: `Unexpected response: ${responseText.slice(0, 200)}`,
          retryable: false,
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[socialplug] createCommentOrder error: ${message}`);

      const notRetryable =
        message.includes("CSRF") ||
        message.includes("ProviderCredential");

      return {
        success: false,
        error: message,
        retryable: !notRetryable,
      };
    }
  },

  async checkOrderStatus(_orderId: string): Promise<OrderStatusResult> {
    // SocialPlug orders complete instantly once submitted
    return { status: "completed" };
  },

  async isAvailable(): Promise<boolean> {
    try {
      await getCookies();

      // Try to fetch the CSRF token to verify the session is still valid
      await fetchCsrfToken(
        "/order/youtube-services/portal?ref=youtubecomments",
      );
      return true;
    } catch (error) {
      console.warn(
        `[socialplug] isAvailable check failed:`,
        error instanceof Error ? error.message : String(error),
      );
      return false;
    }
  },

  async getBalance(): Promise<number> {
    try {
      const cookies = await getCookies();
      const res = await fetch(`${PANEL_BASE}/dashboard`, {
        headers: {
          "cookie": cookies,
          "user-agent": BROWSER_HEADERS["user-agent"],
        },
      });

      if (!res.ok) return 0;

      const html = await res.text();
      const balanceMatch =
        html.match(/balance[^$]*\$([0-9.,]+)/i) ?? html.match(/\$([0-9.,]+)/);

      if (balanceMatch) {
        return parseFloat(balanceMatch[1].replace(",", ""));
      }
      return 0;
    } catch {
      return 0;
    }
  },
};

// Register on import
postingRegistry.register(socialPlugProvider);

export { socialPlugProvider };
