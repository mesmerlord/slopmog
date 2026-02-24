# Creating "Alternative to [Competitor]" Pages

This guide documents how to create new competitor alternative pages for SlopMog. These pages help people comparing Reddit marketing / AI recommendation services discover SlopMog as an option.

## Copy Voice & Tone

**This is critical.** SlopMog's brand voice is tongue-in-cheek, self-aware, and irreverent. We're not a corporate SaaS that takes itself too seriously. The copy on these pages should:

- Be conversational and direct — like a friend who happens to know a lot about Reddit marketing
- Use self-deprecating humor where appropriate ("Yeah, our name is weird. But you remembered it.")
- Acknowledge competitors honestly — don't trash them, roast them gently at most
- Lean into the absurdity of what we all do (paying people to post on Reddit so robots recommend your mattress brand)
- Avoid buzzword soup ("synergize your omnichannel presence" = bad, "get AI to actually recommend you" = good)
- Use Reddit-native language where it fits (upvotes, threads, subreddits, "posted by u/definitely-not-a-shill")
- Keep CTAs playful, not pushy ("Try SlopMog Free" not "UNLOCK YOUR AI POTENTIAL NOW")
- First FAQ answer should be genuinely positive about the competitor — we're confident, not insecure

**Examples of good SlopMog copy:**
- "CrowdReply is great. We just think you deserve more comments for less money. And a funnier name."
- "Look, we're both in the business of getting brands mentioned on Reddit. The difference? We won't charge you $200 just to find out if it works."
- "Is this ethical? We write genuine, helpful comments about real products. We're not inventing five-star reviews — we're just making sure the conversation includes you."

**Examples of bad copy (don't do this):**
- "SlopMog offers superior AI recommendation optimization solutions"
- "Leverage our cutting-edge platform to maximize your Reddit ROI"
- "CrowdReply's subpar service pales in comparison to our robust offering"

## File Location

All alternatives pages go in: `src/pages/alternatives-to/[competitor-slug].tsx`

Example: `src/pages/alternatives-to/crowdreply.tsx` -> `/alternatives-to/crowdreply`

## Routes Setup

Add the new route to `src/lib/constants.ts`:

```typescript
alternatives: {
  index: "/alternatives-to",
  crowdreply: "/alternatives-to/crowdreply",
  // Add new alternatives here:
  // subtleai: "/alternatives-to/subtle-ai",
},
```

Also add to `ALTERNATIVES` config array (see Data Structures below).

## Required Research

Before creating a page, research the competitor thoroughly:

1. **Pricing** - Document their pricing tiers, calculate cost-per-comment
2. **Trustpilot reviews** - Get balanced mix of positive and mixed feedback
3. **G2/Capterra reviews** - Additional review sources
4. **Reddit** - Search for real feedback about the competitor
5. **Features** - List what they offer vs SlopMog
6. **Strengths** - What they do well (be honest — our brand is confident, not threatened)
7. **Screenshot** - Take a screenshot of their homepage (see below)

### Competitor Screenshot Requirement

**REQUIRED**: Take a screenshot of the competitor's website homepage for the alternatives index page.

Use the Playwright MCP tool:

1. Navigate to the competitor's website
2. Close any popups, cookie banners, or chat widgets
3. Take the screenshot at 1200x800 resolution
4. Save to `public/alternatives-images/[competitor-slug]-demo.png`

#### Screenshot Guidelines:

- **Resolution**: 1200x800 pixels
- **Format**: PNG
- **Naming**: `[competitor-slug]-demo.png`
- **Location**: `public/alternatives-images/`
- **Content**: Homepage hero section, no popups/dialogs visible

### Research Sources

- Trustpilot: `https://www.trustpilot.com/review/[competitor-domain]`
- G2: `https://www.g2.com/products/[competitor]/reviews`
- Reddit: `"[competitor]" site:reddit.com review`
- Their own website for accurate feature/pricing info

## Page Structure

### 1. Hero Section

- H1 headline: "Alternative to [Competitor]" with teal gradient text on the competitor name
- Tone: confident but not aggressive
- Include key differentiators as badge list
- CTA buttons: "Try SlopMog Free" + "See Full Comparison"
- Social proof badges (monthly comment counts, keywords, AI tracking)

### 2. Stats Bar

- 4 key comparison metrics (e.g., "3x more comments per dollar", "$3.27/comment")
- Use teal for stat values
- Calculate using SlopMog pricing:
  - Test the Waters: $49/mo = 15 comments ($3.27/comment)
  - Make Waves: $99/mo = 40 comments ($2.48/comment)
  - Own the Ocean: $199/mo = 100 comments ($1.99/comment)

### 3. Feature Comparison Table

- Side-by-side comparison of key features
- Be accurate about competitor's capabilities — don't lie
- Mark winner per row (competitor, slopmog, or tie)
- Use teal checkmarks for the winner column

### 4. Honest Pros & Cons

- Green card for competitor pros, red card for cons
- Be generous with pros (6+ items) — we're confident enough to compliment them
- Keep cons factual and sourced from real reviews
- Use ThumbsUp/ThumbsDown icons from Lucide

### 5. "Why Consider SlopMog" Section (Alternating Layout)

- Uses alternating visual layout (content left/right with gradient panels)
- Each reason includes:
  - Title and description (keep it punchy, not corporate)
  - "SlopMog Advantage" callout (teal-bg background)
  - Benefits list
  - CTA button linking to relevant SlopMog page
- CTAs should use routes from `src/lib/constants.ts`

### 6. Pricing Comparison

- Show competitor's plans with limitations
- Calculate and show cost-per-comment
- Embed the pricing section inline (use the same pricing card structure from the landing page)

### 7. User Reviews Section

- Show BALANCED reviews (mix of positive and mixed)
- Use sentiment tags: "Positive" (green), "Mixed" (yellow)
- Link to sources (Trustpilot, G2, Capterra)
- DO NOT cherry-pick only negative reviews — that's tacky and our brand is better than that

### 8. "Which Tool is Right for You?" Section

- Two columns: "Competitor might be better if..." and "SlopMog might be better if..."
- Frame BOTH options positively
- Include "Common Reddit Marketing Limitations" note (be real about what neither tool can guarantee)

### 9. FAQ Section

- 6-8 switching-specific questions
- First question should acknowledge competitor is a solid tool
- Don't attack competitor in answers — be the bigger blob
- Include pricing comparison, feature gap, and free trial questions
- Write answers in SlopMog voice (conversational, slightly cheeky)

### 10. Final CTA

- Use charcoal background (matching landing page CTA section)
- Neutral: "Try SlopMog Free" not "Switch from [Competitor]"
- Trust signals (no contracts, cancel anytime, results within 30 days)
- Include the mascot via MascotBlob component with cta-mascot-ctx

### 11. Related Alternatives

- Cross-links to other comparison pages
- Filter out current page from `ALTERNATIVES` array
- Show up to 3 related comparisons

## Tone Guidelines

### DO:

- Present facts objectively
- Acknowledge competitor strengths honestly (and mean it)
- Use "might be better if you..." language
- Use specific metrics ("3x more comments", "$2.48 per comment")
- Use Reddit-native terminology (subreddits, karma, threads, upvotes)
- Link to sources for claims
- Be funny where it makes sense ("Their Trustpilot got banned. Ours doesn't exist yet. We're both winning.")
- Self-deprecate about SlopMog's name — it's our best marketing

### DON'T:

- Use corporate attack language ("poor reviews", "terrible", "don't work")
- Cherry-pick only negative reviews
- Set unrealistic expectations about SlopMog
- Claim SlopMog doesn't have issues that all Reddit marketing tools have
- Make unsupported claims without data
- Sound like a LinkedIn thought leader
- Use buzzwords ("leverage", "synergize", "holistic approach")

## External Links

**IMPORTANT**: All external links must include `nofollow`:

```tsx
<a href="..." target="_blank" rel="noopener noreferrer nofollow">
```

All internal links should use Next.js `<Link>` component with routes from constants.

Target 8-12 internal links per page to: `/`, `/#pricing`, `/#how`, `/#demo`, `/#faq`, and other `/alternatives-to/*` pages.

## Data Structures

### Alternatives Config (in `src/lib/constants.ts`)

```typescript
export interface AlternativeConfig {
  name: string;
  slug: string;
  description: string;
  image: string;
  url: string;
}

export const ALTERNATIVES: AlternativeConfig[] = [
  {
    name: "CrowdReply",
    slug: "crowdreply",
    description: "Reddit marketing platform with managed accounts. PRO plan at $99/mo includes $100 in credits.",
    image: "/alternatives-images/crowdreply-demo.png",
    url: "/alternatives-to/crowdreply",
  },
];
```

### User Reviews

```typescript
const COMPETITOR_REVIEWS = [
  {
    quote: "Actual quote from user",
    source: "G2 Review",
    sentiment: "positive" | "mixed", // Keep it balanced
  },
];
```

### Feature Comparison

```typescript
const FEATURE_COMPARISON = [
  {
    feature: "Feature Name",
    competitor: "What they offer",
    slopmog: "What we offer",
    winner: "competitor" | "slopmog" | "tie",
  },
];
```

### Switching Reasons

```typescript
const SWITCHING_REASONS = [
  {
    id: "unique-id",
    title: "Feature Title",
    description: "Full balanced description in SlopMog voice",
    slopmogAdvantage: "One-line advantage summary",
    benefits: ["Benefit 1", "Benefit 2", "Benefit 3", "Benefit 4"],
    ctaText: "CTA Button Text",
    ctaRoute: "/#pricing",
  },
];
```

### FAQs

```typescript
const FAQS = [
  { question: "Is [Competitor] worth it?", answer: "Honest balanced assessment in SlopMog voice..." },
  { question: "How does pricing compare?", answer: "Specific numbers, not weasel words..." },
];
```

## SlopMog Key Differentiators

Emphasize these across all alternative pages:

1. **Subscription pricing** — Flat monthly fee vs credit-based nickle-and-diming
   - Test the Waters: $49/mo = 15 comments ($3.27/comment)
   - Make Waves: $99/mo = 40 comments ($2.48/comment)
   - Own the Ocean: $199/mo = 100 comments ($1.99/comment)
2. **Low barrier to entry** — $49/mo starter vs competitors' $200 minimums
3. **Keyword targeting** — We target specific keywords, not just random threads
4. **AI recommendation tracking** — Track when ChatGPT, Gemini, Perplexity mention your brand
5. **Human-written comments** — No AI slop (ironic given our name, and yes, we're aware)
6. **Weekly performance reports** — Know exactly what's happening
7. **Full transparency** — See every comment, every metric, every subreddit

## Components Used

- `Seo` from `@/components/Seo` — SEO meta tags, OpenGraph, JSON-LD
- `Nav` from `@/components/Nav` — Site navigation (use variant="app")
- `Footer` from `@/components/Footer` — Site footer
- `MascotBlob` from `@/components/MascotBlob` — The beloved coral blob
- `routes`, `ALTERNATIVES` from `@/lib/constants` — Route constants
- Lucide icons (`CheckCircle`, `XCircle`, `ThumbsUp`, `ThumbsDown`, `ArrowRight`, etc.)

## SEO Configuration

```typescript
<Seo
  title="CrowdReply Alternative: [Key Benefit] | SlopMog"
  description="Looking for a CrowdReply alternative? Compare features and pricing. [Key differentiators]. Start at $49/mo."
  jsonLd={{
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "CrowdReply Alternative: Complete Comparison Guide 2026",
  }}
/>
```

Title tag max: 60 characters. Meta description max: 155 characters.

## Priority Competitors

Create pages in this order:

1. **CrowdReply** — $99/mo PRO + credits, managed accounts, most popular
2. **Subtle AI** — $99-299/mo, AI-powered Reddit engagement
3. **ReplyAgent** — $3/post success-based, automated replies
4. **GummySearch** — Research-only (no posting), shut down Dec 2025
5. **Socinator** — $9.99-29.99/mo, multi-platform automation

## Checklist for New Alternative Pages

- [ ] Research competitor thoroughly (pricing, G2, Reddit, Trustpilot)
- [ ] Calculate cost-per-comment for competitor plans
- [ ] **Take screenshot of competitor's homepage** (1200x800, no popups)
- [ ] Save screenshot to `public/alternatives-images/[slug]-demo.png`
- [ ] Add route to `routes.alternatives` in `src/lib/constants.ts`
- [ ] Add to `ALTERNATIVES` config array in `src/lib/constants.ts`
- [ ] Create page file in `src/pages/alternatives-to/[slug].tsx`
- [ ] Update index page `src/pages/alternatives-to/index.tsx`
- [ ] Include all 11 sections (hero, stats, comparison, pros/cons, features, pricing, reviews, which tool, FAQ, CTA, related)
- [ ] Include balanced user reviews (positive + mixed, with sources)
- [ ] Feature comparison is accurate and fair
- [ ] "Why Consider" sections have CTAs with proper routes
- [ ] Pros & Cons section is generous to competitor
- [ ] "Which Tool" section frames both options positively
- [ ] FAQ answers are balanced and in SlopMog voice
- [ ] External links use `rel="noopener noreferrer nofollow"`
- [ ] 8-12 internal links included
- [ ] Pricing section uses same card structure as landing page
- [ ] Final CTA is neutral ("Try SlopMog Free" not "Switch from")
- [ ] CTA section includes MascotBlob with cta-mascot-ctx
- [ ] Copy is tongue-in-cheek, not corporate
- [ ] Run `npm run tsc` to verify no type errors
- [ ] Test page locally at `/alternatives-to/[slug]`
