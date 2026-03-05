import { z } from "zod";
import { chatCompletionJSON, MODELS } from "@/lib/openrouter";
import { PERSONA_MAP, PERSONAS } from "@/constants/personas";
import type {
  CommentGenerationInput,
  CommentGenerationResult,
  GeneratedComment,
} from "@/services/generation/types";

const VariantSchema = z.object({
  text: z.string(),
  qualityScore: z.number().min(0).max(1),
  reasons: z.array(z.string()),
});

const GenerationSchema = (count: number) =>
  z.object({
    noRelevantComment: z.boolean(),
    variants: z.array(VariantSchema).length(count),
  });

function selectPersona(postType: string, specifiedPersona?: string): string {
  if (specifiedPersona && specifiedPersona !== "auto" && PERSONA_MAP[specifiedPersona]) {
    return specifiedPersona;
  }

  // Auto-select based on post type
  const mapping: Record<string, string> = {
    question: "helpful",
    recommendation: "chill",
    comparison: "skeptic",
    discussion: "storyteller",
    showcase: "chill",
    complaint: "helpful",
    other: "straight",
  };

  return mapping[postType] ?? "chill";
}

function getPlatformRules(platform?: string): string {
  if (platform === "YOUTUBE") {
    return `Platform: YouTube
- STRICT LENGTH LIMIT: Each comment MUST be under 300 characters. This is a hard limit. Count carefully.
- Keep comments to 1-2 sentences. YouTube comments are short and punchy, not essays.
- No Reddit-specific language (no "OP", no "upvoted", no subreddit references)
- YouTube comments are casual, direct, and low-effort. Think quick reactions, not blog posts.
- Emojis are acceptable but use sparingly
- Don't reference "threads" or "posts" — say "video" or "this"
- Don't tell a long story or provide detailed background. Be brief.`;
  }

  return `Platform: Reddit
- Match the subreddit's tone and formality level
- Reddit-native language is fine ("OP", references to the post)
- Longer comments are acceptable if they add value (3-6 sentences)
- No emojis unless the subreddit culture uses them
- Don't be overly formatted — minimal markdown`;
}

export async function generateComment(
  input: CommentGenerationInput,
): Promise<CommentGenerationResult> {
  const personaId = selectPersona(input.postType, input.persona);
  const persona = PERSONA_MAP[personaId] ?? PERSONAS[1]; // fallback to "chill"

  const existingCommentsText = input.existingComments.length > 0
    ? input.existingComments
        .slice(0, 10)
        .map((c) => `${c.author}${c.isOp ? " (OP)" : ""}: ${c.body.slice(0, 200)}`)
        .join("\n")
    : "No existing comments";

  const replyContext = input.replyTarget
    ? `\nYou are REPLYING to this comment by ${input.replyTarget.commentAuthor}: "${input.replyTarget.commentBody}"`
    : "";

  const variantCount = 1;

  const result = await chatCompletionJSON({
    model: MODELS.CLAUDE_SONNET,
    messages: [
      {
        role: "system",
        content: `You generate authentic social media comments that naturally mention a brand. Your goal is to write comments that sound like a real person — not an ad.

${getPlatformRules(input.platform)}

${persona.promptInstructions || "Write in a natural, casual tone. No specific persona rules — just be authentic."}

CRITICAL RULES:
- The comment MUST feel like a genuine contribution to the conversation
- The brand mention should be natural and contextual, not forced
- If there is NO natural way to mention the brand, set noRelevantComment to true
- Never use phrases like "I highly recommend", "game-changer", "Check out [brand]!"
- Never start with the brand name
- The comment should provide value even WITHOUT the brand mention
- Read the existing comments to avoid repeating what's already been said

ANTI-AI-SLOP RULES (these are dead giveaways that get comments flagged):
- NEVER use em-dashes (\u2014). Use commas, periods, or parentheses instead
- NEVER use "It's not X, it's Y" or "It's less about X and more about Y" constructions
- NEVER use "I'd argue", "One thing I'd add", "What's interesting is"
- NEVER use "game-changer", "honestly", "incredible" as filler
- NEVER write perfectly balanced paragraphs or use parallel structure
- NEVER list more than 2 examples in a row
- Keep sentences varied in length. Mix short punchy ones with longer ones
- Use contractions inconsistently (sometimes "don't", sometimes "do not")
- It's OK to have a slightly rambling or imperfect structure
- Real people make typos, use incomplete thoughts, and trail off
- Real Reddit comments are messy, opinionated, and sometimes tangential

Generate exactly ${variantCount} comment variant${variantCount > 1 ? "s" : ""}. For each, include:
- text: the comment text
- qualityScore: 0.0-1.0 self-assessment (0.8+ = sounds genuinely human, 0.5-0.8 = decent, <0.5 = feels like an ad)
- reasons: 2-3 bullet points explaining the score

Return JSON: { noRelevantComment: boolean, variants: [...] }`,
      },
      {
        role: "user",
        content: `Write a comment for this ${input.platform ?? "REDDIT"} ${input.postType}.

Title: ${input.postTitle}
${input.postBody ? `Body: ${input.postBody.slice(0, 1500)}` : ""}
Source: ${input.sourceContext}
Matched keyword: ${input.matchedKeyword}
${replyContext}

Brand: ${input.businessName}
What they do: ${input.businessDescription}
Value props: ${input.valueProps.join(", ")}
${input.websiteUrl && !input.noLink ? `URL: ${input.websiteUrl}` : ""}${input.noLink ? "\nIMPORTANT: Do NOT include any URLs, links, or website addresses in the comment. No domain names or web addresses." : ""}
Brand tone: ${input.brandTone}

Existing comments:
${existingCommentsText}`,
      },
    ],
    temperature: 0.85,
    schema: GenerationSchema(variantCount),
  });

  if (result.noRelevantComment || result.variants.length === 0) {
    return {
      best: { text: "", temperature: 0.85, qualityScore: 0, reasons: ["No natural comment possible"] },
      variants: [],
      noRelevantComment: true,
    };
  }

  const variants: GeneratedComment[] = result.variants.map((v) => ({
    text: v.text,
    temperature: 0.85,
    qualityScore: v.qualityScore,
    reasons: v.reasons,
  }));

  // Sort by quality score descending
  variants.sort((a, b) => b.qualityScore - a.qualityScore);

  return {
    best: variants[0],
    variants,
    noRelevantComment: false,
  };
}
