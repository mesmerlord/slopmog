import type { Platform } from "@prisma/client";
import type { ParsedCitationUrl } from "@/lib/openrouter";
import type { ParsedCitation } from "./types";

interface ClassifiedUrl {
  platform: Platform | null;
  externalId: string | null;
  normalizedUrl: string;
}

const REDDIT_PATTERNS = [
  // https://www.reddit.com/r/subreddit/comments/POST_ID/title/
  /(?:https?:\/\/)?(?:www\.|old\.)?reddit\.com\/r\/[^/]+\/comments\/([a-z0-9]+)/i,
  // https://redd.it/POST_ID
  /(?:https?:\/\/)?redd\.it\/([a-z0-9]+)/i,
];

const YOUTUBE_PATTERNS = [
  // https://www.youtube.com/watch?v=VIDEO_ID
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
  // https://youtu.be/VIDEO_ID
  /(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
  // https://www.youtube.com/embed/VIDEO_ID
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
];

export function classifyUrl(url: string): ClassifiedUrl {
  // Try Reddit patterns
  for (const pattern of REDDIT_PATTERNS) {
    const match = url.match(pattern);
    if (match?.[1]) {
      return {
        platform: "REDDIT",
        externalId: match[1],
        normalizedUrl: `https://www.reddit.com/comments/${match[1]}`,
      };
    }
  }

  // Try YouTube patterns
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = url.match(pattern);
    if (match?.[1]) {
      return {
        platform: "YOUTUBE",
        externalId: match[1],
        normalizedUrl: `https://www.youtube.com/watch?v=${match[1]}`,
      };
    }
  }

  return { platform: null, externalId: null, normalizedUrl: url };
}

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function extractCitations(
  _content: string,
  annotations: ParsedCitationUrl[],
): ParsedCitation[] {
  // Only use annotation URLs (deterministic web search results, not AI-generated text)
  const seen = new Set<string>();
  const results: ParsedCitation[] = [];

  for (const a of annotations) {
    const key = a.url.replace(/\/+$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const classified = classifyUrl(a.url);
    results.push({
      url: a.url,
      title: a.title,
      domain: extractDomain(a.url),
      platform: classified.platform,
      externalId: classified.externalId,
      normalizedUrl: classified.normalizedUrl,
    });
  }

  return results;
}
