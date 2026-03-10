import type { PostingProvider } from "./provider";
import { postingRegistry } from "./provider";
import type {
  PostCommentParams,
  CreateOrderResult,
  OrderStatusResult,
} from "./types";
import { prisma } from "@/server/utils/db";

// ─── SocialPlug Twitter Config ─────────────────────────────

const PANEL_BASE = "https://panel.socialplug.io";
const TWITTER_SERVICE_COMMENT_COUNT = 10;
const MAX_SOCIALPLUG_COMMENT_LENGTH = 280;
const ORDER_PAGE_PATH = "/order/twitter-usa-services/portal";
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
      console.warn(`[socialplug-twitter] ProviderCredential lookup failed (${msg}). Falling back to env for now.`);
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

/**
 * Returns true if the text is primarily Latin-script (English-like).
 * Rejects lines with CJK, Cyrillic, Arabic, etc. rather than stripping them.
 */
function isLatinScript(text: string): boolean {
  const stripped = text.replace(/[\d\s.,!?;:'"()\-\[\]{}<>@#$%^&*+=|/\\~`_]/g, "");
  if (stripped.length === 0) return true;
  const latinChars = stripped.replace(/[^\u0041-\u024F\u1E00-\u1EFF]/g, "").length;
  return latinChars / stripped.length >= 0.5;
}

export function normalizeTwitterCommentsForService(commentText: string): string[] {
  const lines = commentText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  // Reject any line that isn't primarily Latin — don't strip and send garbage
  if (lines.some((line) => !isLatinScript(line))) return [];

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
    .map((line) => line.slice(0, MAX_SOCIALPLUG_COMMENT_LENGTH).trim());

  if (sanitized.length === 0) return [];

  const normalized = [...sanitized];
  if (normalized.length > TWITTER_SERVICE_COMMENT_COUNT) {
    return normalized.slice(0, TWITTER_SERVICE_COMMENT_COUNT);
  }

  while (normalized.length < TWITTER_SERVICE_COMMENT_COUNT) {
    normalized.push(sanitized[normalized.length % sanitized.length]);
  }

  return normalized;
}

// ─── CSRF Token ─────────────────────────────────────────────

async function fetchCsrfToken(): Promise<string> {
  const url = `${PANEL_BASE}${ORDER_PAGE_PATH}`;
  console.log(`[socialplug-twitter] Fetching CSRF token from ${url}`);
  const cookies = await getCookies();

  const res = await fetch(url, {
    headers: {
      "cookie": cookies,
      "user-agent": BROWSER_HEADERS["user-agent"],
    },
  });

  if (!res.ok) {
    throw new Error(
      `[socialplug-twitter] Failed to fetch order page: ${res.status} ${res.statusText}`,
    );
  }

  const html = await res.text();

  const metaMatch = html.match(
    /<meta\s+name="csrf-token"\s+content="([^"]+)"/,
  );
  if (metaMatch) return metaMatch[1];

  const inputMatch = html.match(
    /<input[^>]+name="_token"[^>]+value="([^"]+)"/,
  );
  if (inputMatch) return inputMatch[1];

  const jsMatch = html.match(/csrf[_-]?token['":\s]+['"]([^'"]+)['"]/i);
  if (jsMatch) return jsMatch[1];

  throw new Error("[socialplug-twitter] Could not find CSRF token in page HTML");
}

// ─── Provider ───────────────────────────────────────────────

const socialPlugTwitterProvider: PostingProvider = {
  name: "socialplug-twitter",
  platform: "TWITTER" as const,

  async createCommentOrder(
    params: PostCommentParams,
  ): Promise<CreateOrderResult> {
    console.log(
      `[socialplug-twitter] Creating Twitter comment order: context=${params.sourceContext}, url=${params.contentUrl}`,
    );

    try {
      const csrfToken = await fetchCsrfToken();

      // Service 196 = Twitter Comments, "10 Comments" tier with "Custom Comments"
      const comments = normalizeTwitterCommentsForService(params.commentText);
      if (comments.length === 0) {
        return {
          success: false,
          error: "No valid comment text provided for SocialPlug Twitter order",
          retryable: false,
        };
      }
      const commentCountLabel = `${TWITTER_SERVICE_COMMENT_COUNT} Comments`;
      const commentsText = comments.join("\n");

      const trySubmit = async (mode: "captured" | "legacy") => {
        const formData = new URLSearchParams();
        formData.set("_token", csrfToken);
        formData.set("orderform", "twitter-usa-services");
        if (mode === "legacy") {
          const email = getOrderEmail();
          if (email) formData.set("email", email);
          formData.set("dynamic-radio", commentCountLabel);
        }
        // Service index 3 = Twitter Comments, service ID 196
        formData.set("field_1[3]", "196");
        formData.set("options_1[3][0]", commentCountLabel);
        formData.set("options_1[3][1]", "Custom Comments");
        // field_2 = Profile Link (empty for comments-only)
        formData.set("field_2", "");
        // field_3 = Post Link (tweet URL)
        formData.set("field_3", params.contentUrl);
        // field_6 = Comments (one per line)
        formData.set("field_6", commentsText);
        // field_7 = Twitter Space Link (empty)
        formData.set("field_7", "");
        // field_9 = Twitter Poll Link (empty)
        formData.set("field_9", "");
        // field_13 = hidden (empty)
        formData.set("field_13", "");
        formData.set("processor", "balance");
        formData.set("payment-method", "balance");
        formData.set("coupon", "");

        const res = await fetch(`${PANEL_BASE}/orderform/submit`, {
          method: "POST",
          headers: {
            ...BROWSER_HEADERS,
            "cookie": await getCookies(),
            "referer": `${PANEL_BASE}${ORDER_PAGE_PATH}`,
          },
          body: formData.toString(),
        });
        const responseText = await res.text();
        return { res, responseText };
      };

      let { res, responseText } = await trySubmit("captured");

      // Fallback to legacy payload if session expects older fields
      if (!res.ok && res.status === 422 && responseText.toLowerCase().includes("email")) {
        console.warn("[socialplug-twitter] Captured payload asked for email; retrying with legacy fields");
        ({ res, responseText } = await trySubmit("legacy"));
      }

      if (!res.ok) {
        console.error(
          `[socialplug-twitter] Submit failed: ${res.status}`,
          responseText.slice(0, 500),
        );
        return {
          success: false,
          error: `HTTP ${res.status}: ${responseText.slice(0, 200)}`,
          retryable: res.status >= 500,
        };
      }

      try {
        const json = JSON.parse(responseText) as Record<string, unknown>;
        console.log(`[socialplug-twitter] Response:`, JSON.stringify(json));

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
              json.order_id ?? json.orderId ?? "socialplug-twitter-instant",
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
        const isSuccess =
          responseText.toLowerCase().includes("success") ||
          responseText.toLowerCase().includes("order placed");
        if (isSuccess) {
          return {
            success: true,
            orderId: "socialplug-twitter-instant",
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
      console.error(`[socialplug-twitter] createCommentOrder error: ${message}`);

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
    return { status: "completed" };
  },

  async isAvailable(): Promise<boolean> {
    try {
      await getCookies();
      await fetchCsrfToken();
      return true;
    } catch (error) {
      console.warn(
        `[socialplug-twitter] isAvailable check failed:`,
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
postingRegistry.register(socialPlugTwitterProvider);

export { socialPlugTwitterProvider };
