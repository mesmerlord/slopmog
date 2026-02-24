import { chatCompletion, MODELS } from "@/lib/openrouter";
import type {
  CommentGenerationInput,
  GeneratedComment,
  CommentGenerationResult,
} from "./types";

const BANNED_PHRASES = [
  "game-changer",
  "game changer",
  "absolutely love",
  "i can't recommend",
  "hands down the best",
  "blown away",
  "this changed my life",
  "you won't regret",
  "trust me on this",
  "not sponsored",
  "not affiliated",
  "full disclosure",
  "check it out at",
  "use my link",
  "discount code",
];

const NO_COMMENT_MARKER = "NO_RELEVANT_COMMENT";

function buildSystemPrompt(input: CommentGenerationInput): string {
  const toneGuide: Record<string, string> = {
    professional:
      "Write like a knowledgeable industry professional. Use data-driven language, reference specific features, be measured.",
    casual:
      "Write like a regular Redditor. Use casual language, maybe some slang, be relatable. Short sentences.",
    technical:
      "Write like a developer or technical user. Be precise, reference specific technical capabilities, use jargon appropriate to the subreddit.",
    friendly:
      "Write like a helpful community member. Be warm, conversational, share personal experience. Use 'I' statements.",
  };

  return `You are a genuine Reddit user participating in r/${input.subreddit}. You have personal experience with ${input.businessName} and find it genuinely useful.

## Your Persona
${toneGuide[input.brandTone] || toneGuide.friendly}

## Brand Context (for your knowledge only — weave naturally)
- Product: ${input.businessName}
- What it does: ${input.businessDescription}
- Key value: ${input.valueProps.slice(0, 3).join(", ")}
${input.websiteUrl ? `- URL: ${input.websiteUrl}` : ""}

## Critical Rules
1. **Be genuinely helpful FIRST.** Answer the question or add value. The brand mention is secondary.
2. **Never put the brand name in the first sentence.** Lead with insight, experience, or answering the question.
3. **No marketing speak.** Never use: ${BANNED_PHRASES.slice(0, 6).join(", ")}, etc.
4. **Sound human.** Vary sentence length. Use occasional typos-level informality. Don't be perfectly polished.
5. **Match the subreddit's tone.** r/${input.subreddit} has its own culture — respect it.
6. **Keep it concise.** 2-4 sentences for simple threads, up to 6 for detailed discussions. Never write essays.
7. **One brand mention max.** Don't repeat the brand name. Mention it once, naturally.
8. **Don't oversell.** It's OK to mention a limitation or say "it's not perfect for everything" — this builds credibility.
9. **If the post isn't relevant to the brand, respond with ONLY "${NO_COMMENT_MARKER}".** Don't force a mention where it doesn't fit.
10. **Never use quotation marks around the brand name.** Just use it naturally like you would any product name.

## Comment Position
${input.commentPosition === "top_level" ? "Write a top-level comment responding to the original post." : ""}${input.commentPosition === "reply_to_op" ? "Reply to the original poster's comment. Be conversational and direct." : ""}${input.commentPosition === "reply_to_question" ? `Reply to this specific comment:\n"${input.replyTarget?.commentBody}"\n— u/${input.replyTarget?.commentAuthor}\n\nAddress their question directly.` : ""}

## Output
Write ONLY the Reddit comment text. No quotes, no labels, no explanation. Just the comment as it would appear on Reddit.`;
}

function buildUserPrompt(input: CommentGenerationInput): string {
  const commentsText = input.existingComments
    .slice(0, 10)
    .map(
      (c) =>
        `[${c.score}pts${c.isOp ? ", OP" : ""}] u/${c.author}: ${c.body.slice(0, 300)}`,
    )
    .join("\n");

  return `## Post in r/${input.subreddit}
**${input.postTitle}**
${input.postBody ? `\n${input.postBody.slice(0, 1500)}` : "(no body text)"}

## Matched keyword: "${input.matchedKeyword}"

${commentsText ? `## Existing comments (${input.existingComments.length} total, top 10 shown):\n${commentsText}` : "## No comments yet"}

Write your comment now.`;
}

function scoreComment(text: string, input: CommentGenerationInput): { score: number; reasons: string[] } {
  let score = 0.5; // Base score
  const reasons: string[] = [];

  // Brand not in first sentence
  const firstSentence = text.split(/[.!?\n]/)[0] || "";
  if (!firstSentence.toLowerCase().includes(input.businessName.toLowerCase())) {
    score += 0.15;
    reasons.push("Brand not in first sentence");
  } else {
    score -= 0.2;
    reasons.push("Brand in first sentence (penalty)");
  }

  // Appropriate length (50-600 chars)
  if (text.length >= 50 && text.length <= 600) {
    score += 0.1;
    reasons.push("Good length");
  } else if (text.length < 30 || text.length > 1000) {
    score -= 0.15;
    reasons.push("Bad length");
  }

  // No banned phrases
  const hasBanned = BANNED_PHRASES.some((phrase) =>
    text.toLowerCase().includes(phrase),
  );
  if (!hasBanned) {
    score += 0.1;
    reasons.push("No banned phrases");
  } else {
    score -= 0.25;
    reasons.push("Contains banned phrase");
  }

  // Has a personal touch ("I", "my", "we")
  if (/\b(I |I'|my |we |our )/i.test(text)) {
    score += 0.05;
    reasons.push("Personal touch");
  }

  // Mentions brand exactly once
  const brandRegex = new RegExp(input.businessName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  const brandMentions = (text.match(brandRegex) || []).length;
  if (brandMentions === 1) {
    score += 0.1;
    reasons.push("Single brand mention");
  } else if (brandMentions === 0) {
    score -= 0.05;
    reasons.push("No brand mention");
  } else {
    score -= 0.15;
    reasons.push("Multiple brand mentions");
  }

  return { score: Math.max(0, Math.min(1, score)), reasons };
}

export async function generateComment(
  input: CommentGenerationInput,
): Promise<CommentGenerationResult> {
  const systemPrompt = buildSystemPrompt(input);
  const userPrompt = buildUserPrompt(input);

  // Generate 2 variants at different temperatures
  const temperatures = [0.7, 0.9];
  const variants: GeneratedComment[] = [];

  for (const temp of temperatures) {
    const text = await chatCompletion({
      model: MODELS.CLAUDE_OPUS,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: temp,
      maxTokens: 500,
    });

    const trimmed = text.trim();

    // Check for NO_RELEVANT_COMMENT escape hatch
    if (trimmed === NO_COMMENT_MARKER || trimmed.includes(NO_COMMENT_MARKER)) {
      return {
        best: { text: "", temperature: temp, qualityScore: 0, reasons: ["Model determined no relevant comment possible"] },
        variants: [],
        noRelevantComment: true,
      };
    }

    const { score, reasons } = scoreComment(trimmed, input);
    variants.push({ text: trimmed, temperature: temp, qualityScore: score, reasons });
  }

  // Pick the best variant
  variants.sort((a, b) => b.qualityScore - a.qualityScore);

  return {
    best: variants[0],
    variants,
    noRelevantComment: false,
  };
}
