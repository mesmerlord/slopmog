import { z } from "zod";

export const siteAnalysisSchema = z.object({
  businessName: z.string(),
  description: z.string(),
  valueProps: z.array(z.string()),
  targetAudience: z.string(),
  keyFeatures: z.array(z.string()),
  pricingModel: z.string().optional(),
  primaryKeywords: z.array(z.string()),
  problemKeywords: z.array(z.string()),
  competitorKeywords: z.array(z.string()),
  longTailKeywords: z.array(z.string()),
  suggestedSubreddits: z.array(
    z.object({
      name: z.string(),
      reason: z.string(),
      memberCount: z.number().optional(),
      expectedTone: z.string().optional(),
    }),
  ),
  brandTone: z.enum(["professional", "casual", "technical", "friendly"]),
});

export type SiteAnalysisResult = z.infer<typeof siteAnalysisSchema>;
