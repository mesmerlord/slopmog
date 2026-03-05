/**
 * Per-site discovery configuration with sensible defaults.
 * Stored as JSON on Site.discoveryConfig — all fields optional, merged with defaults at runtime.
 */
export interface DiscoveryConfig {
  minRedditUpvotes: number;
  minRedditComments: number;
  minSubredditSubscribers: number;
  minYoutubeViews: number;
  maxYoutubeAgeDays: number;
  maxRedditPages: number;
  autoGenerateTopN: number;
  autoGenerateMinScore: number;
  dailyKeywordLimit: number;
}

export const DISCOVERY_DEFAULTS: DiscoveryConfig = {
  minRedditUpvotes: 3,
  minRedditComments: 2,
  minSubredditSubscribers: 10_000,
  minYoutubeViews: 1000,
  maxYoutubeAgeDays: 365,
  maxRedditPages: 10,
  autoGenerateTopN: 10,
  autoGenerateMinScore: 0.9,
  dailyKeywordLimit: 25,
};

export function parseDiscoveryConfig(raw: unknown): DiscoveryConfig {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const num = (key: keyof DiscoveryConfig, min: number, max: number): number => {
    const val = obj[key];
    if (typeof val !== "number" || !Number.isFinite(val)) return DISCOVERY_DEFAULTS[key];
    return Math.max(min, Math.min(max, Math.round(val)));
  };

  return {
    minRedditUpvotes: num("minRedditUpvotes", 0, 100),
    minRedditComments: num("minRedditComments", 0, 100),
    minSubredditSubscribers: num("minSubredditSubscribers", 0, 1_000_000),
    minYoutubeViews: num("minYoutubeViews", 0, 1_000_000),
    maxYoutubeAgeDays: num("maxYoutubeAgeDays", 1, 365),
    maxRedditPages: num("maxRedditPages", 1, 20),
    autoGenerateTopN: num("autoGenerateTopN", 0, 50),
    autoGenerateMinScore: (() => {
      const val = obj.autoGenerateMinScore;
      if (typeof val !== "number" || !Number.isFinite(val)) return DISCOVERY_DEFAULTS.autoGenerateMinScore;
      return Math.max(0, Math.min(1, val));
    })(),
    dailyKeywordLimit: num("dailyKeywordLimit", 1, 30),
  };
}
