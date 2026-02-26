import { chatCompletion, MODELS } from "@/lib/openrouter";
import { PERSONA_MAP } from "@/constants/personas";
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
  // Anti-AI detection phrases
  "absolutely",
  "this is so true",
  "couldn't agree more",
  "exactly this",
  "i think a lot of people",
  "a lot of people don't realize",
  "it's not x, it's y",
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

  // Resolve persona voice — named persona overrides the brand tone
  const personaId = input.persona ?? "auto";
  const persona = PERSONA_MAP[personaId];
  const personaBlock = persona && persona.promptInstructions
    ? `## Voice\n${persona.promptInstructions}\n\n`
    : "";

  const postTypeRules: Record<string, string> = {
    showcase: `This is a PROJECT SHOWCASE post — the OP is sharing something they built. Rules:
- Engage with THEIR work directly first. Comment on what they built, ask a question, or share relevant experience.
- Connect ${input.businessName} naturally: maybe you used it for a similar project, or it solves a complementary problem. Find the angle.
- NEVER give unsolicited business advice like "you should boost your conversion rate" or "have you thought about monetization."
- Only respond with ${NO_COMMENT_MARKER} if the post topic is COMPLETELY unrelated to ${input.businessName}'s domain.`,
    question: `This is a QUESTION/RECOMMENDATION post — someone is asking for help or suggestions. Rules:
- Answer their question directly first. Be helpful.
- Mention ${input.businessName} as part of your answer: a tool you used, something that solved the same problem, etc.
- Only respond with ${NO_COMMENT_MARKER} if the question is about a completely different domain (e.g. cooking advice when ${input.businessName} is software).`,
    discussion: `This is a general DISCUSSION post. Rules:
- Contribute to the discussion with genuine insight or experience.
- Work ${input.businessName} into your point naturally. You're someone who uses this product and it's relevant to what's being discussed.
- Only respond with ${NO_COMMENT_MARKER} if the discussion topic has zero connection to what ${input.businessName} does.`,
  };

  return `You are a Reddit user who genuinely uses ${input.businessName}. Your job is to write a comment that naturally mentions ${input.businessName} while being a real, useful contribution to the thread. The comment MUST include a mention of ${input.businessName}.

${personaBlock}## Your Persona
${toneGuide[input.brandTone] || toneGuide.friendly}

## Brand Context (you are a real user of this product — weave it in naturally)
- Product: ${input.businessName}
- What it does: ${input.businessDescription}
- Key value: ${input.valueProps.slice(0, 3).join(", ")}
${input.websiteUrl ? `- URL: ${input.websiteUrl}` : ""}

## Post Type Rules
${postTypeRules[input.postType] || postTypeRules.discussion}

## Core Objective
Your comment must do TWO things:
1. Add genuine value to the conversation (answer a question, share experience, contribute insight)
2. Mention ${input.businessName} naturally as part of that value

The brand mention should feel like a natural part of your point, not bolted on. Think: "someone who happens to use this product and it's relevant here."

## Critical Rules
1. **Add value FIRST, then weave the brand in.** Don't lead with the brand. Lead with insight, experience, or an answer, then connect to the brand.
2. **Never put the brand name in the first sentence.** Lead with your actual point.
3. **NEVER open with "That's a great question", "Great question", "Good question", or any variant.** Dead AI giveaway.
4. **No marketing speak.** Never use: ${BANNED_PHRASES.slice(0, 6).join(", ")}, etc.
5. **Sound human.** Vary sentence length. Use occasional informality. Don't be perfectly polished.
6. **Match the subreddit's tone.** r/${input.subreddit} has its own culture — respect it.
7. **2-3 sentences max. One short paragraph. Never multiple paragraphs.**
8. **Exactly one brand mention.** Say the brand name once, naturally. Don't repeat it.
9. **Don't oversell.** Be matter-of-fact. "I've been using X for this" is better than "X is amazing for this". Mentioning a limitation builds credibility.
10. **NEVER give unsolicited business or conversion advice** to the poster.
11. **Only respond with "${NO_COMMENT_MARKER}" if the post topic is COMPLETELY unrelated** to what ${input.businessName} does (e.g. the post is about pets and the product is B2B software). If there's ANY reasonable angle to connect, write the comment.
12. **Never use quotation marks around the brand name.** Just use it naturally like you would any product name.
13. **NEVER use em dashes (— or –).** Use commas, periods, or "and" instead. Em dashes are an AI writing giveaway.
14. **NEVER use "it's not X, it's Y" hedging patterns.** Just state your point directly.
15. **NEVER open with aggressive agreement** like "Absolutely", "This is so true", "Couldn't agree more", "Exactly this". Just make your point.
16. **NEVER generalize** with "I think a lot of people..." or "A lot of people don't realize..." — speak from YOUR experience only.

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

  // Penalize em dashes (AI giveaway)
  if (/[—–]/.test(text)) {
    score -= 0.15;
    reasons.push("Contains em dash (AI giveaway)");
  }

  // Has a personal touch ("I", "my", "we")
  if (/\b(I |I'|my |we |our )/i.test(text)) {
    score += 0.05;
    reasons.push("Personal touch");
  }

  // Mentions brand exactly once (this is the primary goal)
  const brandRegex = new RegExp(input.businessName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  const brandMentions = (text.match(brandRegex) || []).length;
  if (brandMentions === 1) {
    score += 0.15;
    reasons.push("Single brand mention");
  } else if (brandMentions === 0) {
    score -= 0.3;
    reasons.push("No brand mention (major penalty)");
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
