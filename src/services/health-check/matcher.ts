/**
 * Normalize text for comparison: strip markdown, HTML entities, normalize whitespace, lowercase.
 */
export function normalizeForComparison(text: string): string {
  return text
    // Strip markdown bold/italic
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
    // Strip markdown links [text](url)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Decode common HTML entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    // Strip remaining HTML tags
    .replace(/<[^>]+>/g, "")
    // Normalize whitespace
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Generate character bigrams from a string.
 */
function getBigrams(text: string): Map<string, number> {
  const bigrams = new Map<string, number>();
  for (let i = 0; i < text.length - 1; i++) {
    const bigram = text.substring(i, i + 2);
    bigrams.set(bigram, (bigrams.get(bigram) ?? 0) + 1);
  }
  return bigrams;
}

/**
 * Dice coefficient similarity using character bigrams.
 * Returns 0-1 where 1 = identical.
 */
export function bigramSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigramsA = getBigrams(a);
  const bigramsB = getBigrams(b);

  let intersection = 0;
  bigramsA.forEach((count, bigram) => {
    const countB = bigramsB.get(bigram) ?? 0;
    intersection += Math.min(count, countB);
  });

  const totalBigrams = a.length - 1 + (b.length - 1);
  return (2 * intersection) / totalBigrams;
}

/**
 * Find the best matching external text for our comment text.
 * Returns best similarity score and which external text matched.
 */
export function findBestMatch(
  ourText: string,
  externalTexts: string[],
): { score: number; matchedText: string | null } {
  const normalizedOurs = normalizeForComparison(ourText);
  let bestScore = 0;
  let matchedText: string | null = null;

  for (const ext of externalTexts) {
    const normalizedExt = normalizeForComparison(ext);
    const score = bigramSimilarity(normalizedOurs, normalizedExt);
    if (score > bestScore) {
      bestScore = score;
      matchedText = ext;
    }
  }

  return { score: Math.round(bestScore * 100) / 100, matchedText };
}
