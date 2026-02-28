import { requireEnv } from "./env";

// ─── SocialPlug Panel Form Submission ───────────────────────
//
// Replicates the browser form submission to panel.socialplug.io.
// Uses session cookies stored in env. Update SOCIALPLUG_COOKIES
// when they expire (copy from browser dev tools Network tab).
//
// YouTube comment order fields (from captured request):
//   orderform = "youtube-services"
//   field_1[3] = 144  (Custom Comments tier)
//   options_1[3][0] = "5 Comments"
//   options_1[3][1] = "Custom Comments"
//   field_5 = <video URL>
//   field_10 = <comments, newline-separated>
//   dynamic-radio = "5 Comments"
//   processor = balance
//   payment-method = balance

const PANEL_BASE = "https://panel.socialplug.io";

// Shared headers that mimic the browser
const BROWSER_HEADERS: Record<string, string> = {
  "accept": "*/*",
  "accept-language": "en-US,en;q=0.9",
  "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
  "origin": PANEL_BASE,
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
  "x-requested-with": "XMLHttpRequest",
  "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
};

function getCookies(): string {
  return requireEnv("SOCIALPLUG_COOKIES");
}

// ─── CSRF Token ─────────────────────────────────────────────

async function fetchCsrfToken(orderPagePath: string): Promise<string> {
  const url = `${PANEL_BASE}${orderPagePath}`;
  console.log(`[socialplug] Fetching CSRF token from ${url}`);

  const res = await fetch(url, {
    headers: {
      "cookie": getCookies(),
      "user-agent": BROWSER_HEADERS["user-agent"],
    },
  });

  if (!res.ok) {
    throw new Error(`[socialplug] Failed to fetch order page: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();

  // Laravel embeds CSRF token in a meta tag
  const metaMatch = html.match(/<meta\s+name="csrf-token"\s+content="([^"]+)"/);
  if (metaMatch) return metaMatch[1];

  // Or in a hidden input
  const inputMatch = html.match(/<input[^>]+name="_token"[^>]+value="([^"]+)"/);
  if (inputMatch) return inputMatch[1];

  // Or in JavaScript
  const jsMatch = html.match(/csrf[_-]?token['":\s]+['"]([^'"]+)['"]/i);
  if (jsMatch) return jsMatch[1];

  throw new Error("[socialplug] Could not find CSRF token in page HTML");
}

// ─── YouTube Comments ───────────────────────────────────────

export interface YouTubeCommentOrder {
  videoUrl: string;
  comments: string[];    // Each string is one comment
}

export interface OrderResult {
  success: boolean;
  message?: string;
  error?: string;
  raw?: unknown;
}

export async function submitYouTubeComments(order: YouTubeCommentOrder): Promise<OrderResult> {
  const { videoUrl, comments } = order;

  if (comments.length === 0) {
    return { success: false, error: "No comments provided" };
  }

  console.log(`[socialplug] Posting ${comments.length} YouTube comments to ${videoUrl}`);

  // Get fresh CSRF token
  const csrfToken = await fetchCsrfToken("/order/youtube-services/portal?ref=youtubecomments");

  // Map comment count to the right tier
  // From the captured request: field_1[3] = 144 for "5 Custom Comments"
  // We'll use field index [3] and service 144 as the default
  const commentCountLabel = `${comments.length} Comments`;
  const commentsText = comments.join("\n");

  const formData = new URLSearchParams();
  formData.set("_token", csrfToken);
  formData.set("orderform", "youtube-services");
  formData.set("dynamic-radio", commentCountLabel);
  formData.set("field_1[3]", "144");
  formData.set("options_1[3][0]", commentCountLabel);
  formData.set("options_1[3][1]", "Custom Comments");
  formData.set("field_4", "");
  formData.set("field_5", videoUrl);
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
      "cookie": getCookies(),
      "referer": `${PANEL_BASE}/order/youtube-services/portal?ref=youtubecomments`,
    },
    body: formData.toString(),
  });

  const responseText = await res.text();

  if (!res.ok) {
    console.error(`[socialplug] Submit failed: ${res.status}`, responseText.slice(0, 500));
    return { success: false, error: `HTTP ${res.status}: ${responseText.slice(0, 200)}`, raw: responseText };
  }

  // Try to parse JSON response
  try {
    const json = JSON.parse(responseText);
    console.log(`[socialplug] Response:`, JSON.stringify(json));

    // Check for success indicators
    // SocialPlug returns { "status": "succeeded", "success_link": "..." }
    const status = String(json.status ?? "").toLowerCase();
    if (json.success || status === "succeeded" || status === "success" || json.order_id || json.orderId || json.success_link) {
      return {
        success: true,
        message: json.message ?? json.success_link ?? "Order submitted",
        raw: json,
      };
    }

    return {
      success: false,
      error: json.message ?? json.error ?? `Unexpected status: ${json.status}`,
      raw: json,
    };
  } catch {
    // Response might be HTML or plain text
    const isSuccess = responseText.toLowerCase().includes("success") ||
                      responseText.toLowerCase().includes("order placed");
    return {
      success: isSuccess,
      message: isSuccess ? "Order submitted (HTML response)" : undefined,
      error: isSuccess ? undefined : `Unexpected response: ${responseText.slice(0, 200)}`,
      raw: responseText.slice(0, 500),
    };
  }
}

// ─── Twitter Comments ───────────────────────────────────────
// TODO: Capture the Twitter form submission curl and add here.
// The field names/IDs will be different from YouTube.

export interface TwitterCommentOrder {
  tweetUrl: string;
  comments: string[];
}

export async function submitTwitterComments(_order: TwitterCommentOrder): Promise<OrderResult> {
  // Placeholder - need to capture the Twitter order form from SocialPlug
  return {
    success: false,
    error: "Twitter comments not yet implemented. Capture the SocialPlug Twitter form submission curl and add the field mappings.",
  };
}

// ─── Balance Check ──────────────────────────────────────────

export async function checkBalance(): Promise<string> {
  console.log(`[socialplug] Checking balance...`);

  const res = await fetch(`${PANEL_BASE}/dashboard`, {
    headers: {
      "cookie": getCookies(),
      "user-agent": BROWSER_HEADERS["user-agent"],
    },
  });

  if (!res.ok) {
    return "Could not fetch balance (cookies may be expired)";
  }

  const html = await res.text();
  // Try to extract balance from dashboard HTML
  const balanceMatch = html.match(/balance[^$]*\$([0-9.,]+)/i) ??
                       html.match(/\$([0-9.,]+)/);

  return balanceMatch ? `$${balanceMatch[1]}` : "Balance not found in page (cookies may be expired)";
}
