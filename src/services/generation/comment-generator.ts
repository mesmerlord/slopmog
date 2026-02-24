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
  "that's a great question",
  "that's a really good question",
  "great question",
  "good question",
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

  const postTypeRules: Record<string, string> = {
    showcase: `This is a PROJECT SHOWCASE post — the OP is sharing something they built. Rules:
- Engage with THEIR work directly. Comment on what they built, ask a question, share relevant experience.
- Only mention ${input.businessName} if it solves a CLEARLY DIFFERENT problem or genuinely adds value they'd care about.
- If there's no natural connection, just be a helpful community member WITHOUT mentioning the brand. Respond with ${NO_COMMENT_MARKER} if you can't add value without forcing a mention.
- NEVER give unsolicited business advice like "you should boost your conversion rate" or "have you thought about monetization."`,
    question: `This is a QUESTION/RECOMMENDATION post — someone is asking for help or suggestions. Rules:
- Answer their question directly first. Be helpful.
- If ${input.businessName} is genuinely relevant to what they're asking, mention it naturally as one option.
- If the question has nothing to do with what ${input.businessName} does, respond with ${NO_COMMENT_MARKER}.`,
    discussion: `This is a general DISCUSSION post. Rules:
- Contribute to the discussion with genuine insight or experience.
- Only mention ${input.businessName} if it naturally fits the conversation topic.
- If the brand can't be mentioned without feeling like an ad, respond with ${NO_COMMENT_MARKER}.`,
  };

  return `You are a genuine Reddit user participating in r/${input.subreddit}. You may or may not have experience with ${input.businessName} — only mention it if it's truly relevant to this specific discussion.

## Your Persona
${toneGuide[input.brandTone] || toneGuide.friendly}

## Brand Context (for your knowledge only — weave naturally IF relevant)
- Product: ${input.businessName}
- What it does: ${input.businessDescription}
- Key value: ${input.valueProps.slice(0, 3).join(", ")}
${input.websiteUrl ? `- URL: ${input.websiteUrl}` : ""}

## Post Type Rules
${postTypeRules[input.postType] || postTypeRules.discussion}

## Critical Rules
1. **Be genuinely helpful FIRST.** Answer the question or add value. The brand mention is secondary.
2. **Never put the brand name in the first sentence.** Lead with insight, experience, or answering the question.
3. **NEVER open with "That's a great question", "Great question", "Good question", or any variant.** It's a dead giveaway for AI-generated text.
4. **No marketing speak.** Never use: ${BANNED_PHRASES.slice(0, 6).join(", ")}, etc.
5. **Sound human.** Vary sentence length. Use occasional typos-level informality. Don't be perfectly polished.
6. **Match the subreddit's tone.** r/${input.subreddit} has its own culture — respect it.
7. **2-3 sentences max. One short paragraph. Never multiple paragraphs.**
8. **One brand mention max.** Don't repeat the brand name. Mention it once, naturally. Zero mentions is fine if the brand isn't relevant.
9. **Don't oversell.** It's OK to mention a limitation or say "it's not perfect for everything" — this builds credibility.
10. **NEVER give unsolicited business or conversion advice** to the poster.
11. **If the brand can't be mentioned WITHOUT feeling like an ad, respond with ONLY "${NO_COMMENT_MARKER}".** It's better to skip than to force it.
12. **Never use quotation marks around the brand name.** Just use it naturally like you would any product name.

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

  const postTypeLabel = input.postType === "showcase"
    ? "Project showcase (OP sharing their work)"
    : input.postType === "question"
      ? "Question/recommendation request"
      : "Discussion";

  return `## Post in r/${input.subreddit}
**${input.postTitle}**
${input.postBody ? `\n${input.postBody.slice(0, 1500)}` : "(no body text)"}

## Post type: ${postTypeLabel}

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
