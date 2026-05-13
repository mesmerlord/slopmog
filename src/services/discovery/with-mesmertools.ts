import * as Sentry from "@sentry/nextjs";

/**
 * Mesmertools-first-with-fallback HTTP helper.
 *
 * Tries mesmertools.com (our cloned scrapecreators clone) first, then falls
 * back to the upstream scrapecreators provider on ANY failure (non-2xx,
 * network error, timeout). Sentry is notified on every fallback so we can
 * see when the primary is unhealthy.
 *
 * The response shape is identical between the two providers — we cloned
 * scrapecreators precisely — so the caller can treat the result as a single
 * canonical shape regardless of which provider answered.
 */

const DEFAULT_MESMERTOOLS_BASE_URL = "https://mesmer.tools";
const SCRAPECREATORS_BASE_URL = "https://api.scrapecreators.com/v1";
const MESMERTOOLS_TIMEOUT_MS = 30_000;

function getMesmertoolsBaseUrl(): string {
  return process.env.MESMERTOOLS_API_BASE_URL || DEFAULT_MESMERTOOLS_BASE_URL;
}

function getMesmertoolsApiKey(): string | undefined {
  return process.env.MESMERTOOLS_API_KEY || undefined;
}

function buildQuery(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) sp.set(k, v);
  }
  const q = sp.toString();
  return q ? `?${q}` : "";
}

/**
 * Path under `/v1` (e.g. `/reddit/search`).
 *
 * Calls mesmertools first with a 30s timeout. On any error or non-2xx response,
 * captures a Sentry event with structured context and returns the JSON parsed
 * from a scrapecreators fallback call. The fallback's own failures bubble up.
 */
export async function mesmertoolsGetWithScrapeCreatorsFallback<T>(
  path: string,
  params: Record<string, string | undefined>,
  scrapeCreatorsFetcher: () => Promise<T>,
): Promise<T> {
  const apiKey = getMesmertoolsApiKey();

  // If no mesmertools key is configured, just go straight to scrapecreators
  // (no fallback event — operator intentionally hasn't onboarded yet).
  if (!apiKey) {
    return scrapeCreatorsFetcher();
  }

  const baseUrl = getMesmertoolsBaseUrl();
  const url = `${baseUrl}/v1${path}${buildQuery(params)}`;
  const startedAt = Date.now();

  let mesmertoolsError: Error | null = null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MESMERTOOLS_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(url, {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      mesmertoolsError = new Error(
        `Mesmertools ${res.status} ${res.statusText} on ${path}: ${body.slice(0, 300)}`,
      );
    } else {
      try {
        return (await res.json()) as T;
      } catch (parseErr) {
        mesmertoolsError =
          parseErr instanceof Error
            ? parseErr
            : new Error(`Mesmertools JSON parse error on ${path}: ${String(parseErr)}`);
      }
    }
  } catch (err) {
    mesmertoolsError = err instanceof Error ? err : new Error(String(err));
  }

  // ── Fallback path: report to Sentry then call scrapecreators ──
  const latencyMs = Date.now() - startedAt;
  const errMsg = mesmertoolsError?.message ?? "unknown mesmertools error";

  console.error(
    `[FALLBACK_TO_SCRAPECREATORS] ${path} — mesmertools failed in ${latencyMs}ms: ${errMsg}`,
  );

  try {
    Sentry.captureException(
      new Error(`mesmertools fallback to scrapecreators: ${path}`),
      {
        tags: {
          provider: "mesmertools",
          fallback: "scrapecreators",
          endpoint: path,
        },
        extra: {
          endpoint: path,
          query: params,
          mesmertoolsError: errMsg,
          mesmertoolsLatencyMs: latencyMs,
          mesmertoolsBaseUrl: baseUrl,
        },
      },
    );
  } catch {
    // Never let a broken Sentry break the fallback.
  }

  return scrapeCreatorsFetcher();
}

/**
 * Direct scrapecreators path builder — exposed so callers can construct the
 * URL the same way they would for any other scrapecreators endpoint.
 */
export function scrapeCreatorsUrl(
  path: string,
  params: Record<string, string | undefined>,
): string {
  return `${SCRAPECREATORS_BASE_URL}${path}${buildQuery(params)}`;
}
