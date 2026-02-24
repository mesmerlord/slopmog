import { useState, useRef } from "react";
import Link from "next/link";
import {
  CheckCircle,
  XCircle,
  ThumbsUp,
  ThumbsDown,
  ArrowRight,
  DollarSign,
  Users,
  BarChart3,
  Shield,
  Zap,
  Target,
} from "lucide-react";
import Seo from "@/components/Seo";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import MascotBlob from "@/components/MascotBlob";
import PricingAnimation from "@/components/illustrations/PricingAnimation";
import KeywordTargetAnimation from "@/components/illustrations/KeywordTargetAnimation";
import AITrackingAnimation from "@/components/illustrations/AITrackingAnimation";
import HumanWritingAnimation from "@/components/illustrations/HumanWritingAnimation";
import { ALTERNATIVES } from "@/lib/constants";

/* ─── Data ─── */

const FEATURE_COMPARISON: { feature: string; competitor: string; slopmog: string; winner: "slopmog" | "competitor" | "tie" }[] = [
  {
    feature: "Monthly pricing",
    competitor: "$99/mo PRO (includes $100 credits)",
    slopmog: "$49/mo starter, $99/mo popular, $199/mo pro",
    winner: "slopmog" as const,
  },
  {
    feature: "Comments included",
    competitor: "~10 comments at $10/each from credits",
    slopmog: "15-100 comments/mo included in plan",
    winner: "slopmog" as const,
  },
  {
    feature: "Cost per comment",
    competitor: "$10-32 per comment",
    slopmog: "$1.99-3.27 per comment",
    winner: "slopmog" as const,
  },
  {
    feature: "Free trial / low entry",
    competitor: "Free signup, but $99/mo minimum to post",
    slopmog: "$49/mo starter plan",
    winner: "slopmog" as const,
  },
  {
    feature: "Managed Reddit accounts",
    competitor: "Aged, high-karma accounts (their network)",
    slopmog: "Managed accounts with natural history",
    winner: "tie" as const,
  },
  {
    feature: "Thread discovery tool",
    competitor: "Built-in tool finds Google-ranking threads",
    slopmog: "Keyword targeting across relevant subreddits",
    winner: "tie" as const,
  },
  {
    feature: "Upvote boosting",
    competitor: "Drip-feed upvotes at $0.10/each",
    slopmog: "Available as add-on across all plans",
    winner: "tie" as const,
  },
  {
    feature: "AI recommendation tracking",
    competitor: "Tracks LLM citations",
    slopmog: "Tracks ChatGPT, Gemini, Perplexity mentions",
    winner: "tie" as const,
  },
  {
    feature: "Comment removal rate",
    competitor: "~5% removal rate",
    slopmog: "Low removal rate with natural-sounding AI comments",
    winner: "tie" as const,
  },
  {
    feature: "Performance reports",
    competitor: "Dashboard analytics",
    slopmog: "Weekly reports + full dashboard",
    winner: "slopmog" as const,
  },
  {
    feature: "Sells Reddit accounts",
    competitor: "Yes (individual + bulk account sales)",
    slopmog: "No (we focus on the service, not selling accounts)",
    winner: "slopmog" as const,
  },
];

const COMPETITOR_PROS = [
  "Established platform with 30K+ comments posted",
  "Thread discovery tool that finds Google-ranking discussions",
  "Upvote boosting to push comments higher in threads",
  "4.9 stars on G2 from 16 verified reviews",
  "Credits don't expire — use at your own pace",
  "Quick turnaround — comments go live within minutes",
  "Good customer service and responsive support",
  "API available for programmatic access",
];

const COMPETITOR_CONS = [
  "$99/mo minimum to start posting (no lower tier)",
  "$10+ per comment adds up fast for volume campaigns",
  "Trustpilot profile was flagged as 'bad fit' and blocked",
  "Also sells bulk Reddit accounts separately (mixed signals on authenticity)",
  "No organic Reddit presence — ironic for a Reddit marketing platform",
  "Users write their own comments — no content creation help",
];

const SWITCHING_REASONS = [
  {
    id: "pricing",
    icon: DollarSign,
    title: "Actually Affordable Pricing",
    description:
      "CrowdReply charges $10 per comment from your credit balance. At SlopMog, our Make Waves plan gets you 40 comments for $99/mo. That's $2.48 per comment vs their $10. We're not saying math is hard, but... that's 4x more comments for the same price.",
    slopmogAdvantage:
      "40 comments for $99/mo vs ~10 comments for $99/mo at CrowdReply",
    benefits: [
      "Start at $49/mo — half the cost of CrowdReply PRO",
      "$1.99-3.27 per comment depending on plan",
      "Predictable monthly cost, no credit math required",
      "Scale up anytime without nickel-and-dime pricing",
    ],
    ctaText: "See Our Pricing",
    ctaRoute: "/#pricing",
  },
  {
    id: "keywords",
    icon: Target,
    title: "Keyword-First Strategy",
    description:
      "We don't just find threads and drop comments. We start with the keywords you actually want to rank for in AI recommendations, then work backwards to find the right conversations. It's targeting, not carpet bombing.",
    slopmogAdvantage:
      "Target 3-unlimited keywords depending on your plan",
    benefits: [
      "Keyword-driven thread discovery",
      "Focus on high-intent conversations",
      "Track which keywords are converting to AI mentions",
      "Strategy built around your SEO goals",
    ],
    ctaText: "See How It Works",
    ctaRoute: "/#how",
  },
  {
    id: "ai-tracking",
    icon: BarChart3,
    title: "AI Recommendation Tracking",
    description:
      "The whole point is getting AI to recommend you, right? We track when ChatGPT, Gemini, and Perplexity actually mention your brand. Not just 'did the comment stick' but 'is it actually working.' Because vanity metrics are for LinkedIn.",
    slopmogAdvantage:
      "Track real AI recommendations across ChatGPT, Gemini, and Perplexity",
    benefits: [
      "Monitor ChatGPT, Gemini, and Perplexity mentions",
      "Weekly reports on AI recommendation changes",
      "See which comments drove which AI mentions",
      "Know your actual ROI, not just comment metrics",
    ],
    ctaText: "See the Demo",
    ctaRoute: "/#demo",
  },
  {
    id: "ai-content",
    icon: Users,
    title: "AI Writes the Comments For You",
    description:
      "CrowdReply requires you to write your own comments. Which is fine if you have the time and Reddit instincts. Our AI generates natural-sounding comments tuned for Reddit's tone — or write your own if you prefer. You approve before anything goes live.",
    slopmogAdvantage:
      "AI generates Reddit-native comments, or bring your own",
    benefits: [
      "AI writes comments that match Reddit's tone",
      "Write your own comments if you prefer",
      "You approve before anything goes live",
      "No need to become a Reddit expert yourself",
    ],
    ctaText: "Try SlopMog Free",
    ctaRoute: "/#cta",
  },
];

const COMPETITOR_REVIEWS = [
  {
    quote:
      "CrowdReply has been a game-changer for our Reddit outreach. The account quality is excellent and comments stick consistently.",
    source: "G2 Review",
    sourceUrl: "https://www.g2.com/products/crowdreply/reviews",
    sentiment: "positive" as const,
  },
  {
    quote:
      "Good service, the thread finder tool is really useful for finding Google-ranking discussions. Support is responsive when comments get removed.",
    source: "G2 Review",
    sourceUrl: "https://www.g2.com/products/crowdreply/reviews",
    sentiment: "positive" as const,
  },
  {
    quote:
      "Decent platform but the $200 minimum to start is steep when you're just testing. Wish there was a smaller trial option.",
    source: "G2 Review",
    sourceUrl: "https://www.g2.com/products/crowdreply/reviews",
    sentiment: "mixed" as const,
  },
  {
    quote:
      "The per-comment cost adds up fast. At $10-25 per comment depending on account karma, running a real campaign gets expensive quickly.",
    source: "Industry Review",
    sourceUrl: "https://atlasmarketing.ai/crowdreply-review-2026/",
    sentiment: "mixed" as const,
  },
];

const FAQS = [
  {
    question: "Is CrowdReply worth it?",
    answer:
      "Honestly? Yes, for certain use cases. CrowdReply is a solid platform with a good track record — 30K+ comments posted, 4.9 stars on G2, and a genuinely useful thread discovery tool. If you want granular control over which threads you post in and don't mind paying per comment, it's a legitimate option. We just think most brands get more value from a flat monthly subscription with more comments included.",
  },
  {
    question: "How does SlopMog pricing compare to CrowdReply?",
    answer:
      "CrowdReply's PRO plan is $99/mo which gives you $100 in credits. At $10 per comment, that's about 10 comments. SlopMog's Make Waves plan is also $99/mo but includes 40 comments — 4x more. Our starter plan is $49/mo for 15 comments. So even our cheapest plan gives you 50% more comments than CrowdReply's PRO plan, at half the price.",
  },
  {
    question: "Does CrowdReply write comments for you?",
    answer:
      "No. CrowdReply requires you to write your own comments — you pick the thread, write the message, and they post it through their accounts. SlopMog handles the writing too. Our team drafts comments that sound natural to Reddit, and you approve them before they go live. Less work on your end.",
  },
  {
    question: "What about upvote boosting?",
    answer:
      "Both platforms offer upvote boosting. CrowdReply charges about $0.10 per upvote from your credit balance. SlopMog also offers upvote boosting as an add-on across all plans. The difference is that our comments are designed to earn organic upvotes too — we write genuinely helpful content, so the paid boost is just accelerating what would happen naturally.",
  },
  {
    question: "Why was CrowdReply's Trustpilot blocked?",
    answer:
      "Trustpilot flagged CrowdReply as a 'bad fit' for their platform, which typically happens when a business's core service conflicts with Trustpilot's guidelines. This doesn't necessarily mean the service is bad — it means Trustpilot decided the business model (posting through managed Reddit accounts) wasn't appropriate for their review platform. For what it's worth, they have solid G2 reviews.",
  },
  {
    question: "Can I switch from CrowdReply to SlopMog easily?",
    answer:
      "Since CrowdReply uses credits and SlopMog uses subscriptions, there's nothing to 'migrate.' Just sign up for a SlopMog plan and tell us your brand, keywords, and goals. You can even run both simultaneously to compare results before committing. No hard feelings.",
  },
  {
    question: "Does SlopMog sell Reddit accounts like CrowdReply does?",
    answer:
      "No. CrowdReply has separate pages for buying individual and bulk Reddit accounts. We don't sell accounts — we only use them to post comments as part of your campaign. We think selling accounts separately muddies the 'authentic marketing' message, but that's just us being opinionated.",
  },
  {
    question: "Which is better for AI recommendation optimization?",
    answer:
      "Both platforms target AI recommendations through Reddit. CrowdReply tracks which discussions get cited by AI models. SlopMog tracks actual AI mentions of your brand across ChatGPT, Gemini, and Perplexity. We focus on the end result (did AI recommend you?) rather than the intermediate step (did the thread rank?). But honestly, both approaches have merit.",
  },
];

/* ─── Pricing helper icons ─── */
function CheckIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      className="shrink-0 mt-0.5"
    >
      <circle cx="9" cy="9" r="8" stroke="#2EC4B6" strokeWidth="1.5" />
      <path
        d="M6 9l2 2 4-4"
        stroke="#2EC4B6"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M7 3v8M3 7h8"
        stroke="#2EC4B6"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ─── Page ─── */

export default function CrowdReplyAlternative() {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const faqRefs = useRef<(HTMLDivElement | null)[]>([]);

  const relatedAlternatives = ALTERNATIVES.filter(
    (a) => a.slug !== "crowdreply"
  ).slice(0, 3);

  return (
    <>
      <Seo
        title="CrowdReply Alternative: More Comments, Less Cost | SlopMog"
        description="Looking for a CrowdReply alternative? SlopMog offers 4x more Reddit comments per dollar with flat monthly pricing. Start at $49/mo."
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline:
            "CrowdReply Alternative: Complete Comparison Guide 2026",
          description:
            "Detailed comparison of CrowdReply vs SlopMog for Reddit marketing and AI recommendation optimization.",
        }}
      />

      <Nav variant="app" />

      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden pt-24 pb-16 md:pt-32 md:pb-20 px-4 md:px-6">
        <div className="max-w-[1140px] mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-teal-bg text-charcoal px-4 py-1.5 rounded-full text-xs font-bold mb-6 border border-teal/20">
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
            >
              <path
                d="M7 2l1.5 3.5H13L9.5 8l1.2 4L7 9.5 3.3 12l1.2-4L1 5.5h4.5z"
                fill="#2EC4B6"
              />
            </svg>
            Honest Comparison — Updated 2026
          </div>

          <h1 className="font-heading font-bold text-3xl md:text-5xl lg:text-[3.2rem] text-charcoal mb-5 leading-tight">
            Alternative to{" "}
            <span className="text-teal">CrowdReply</span>
          </h1>
          <p className="text-base md:text-lg text-charcoal-light max-w-[620px] mx-auto mb-8 leading-relaxed">
            CrowdReply is solid. But $10 per comment adds up fast. SlopMog
            gives you 4x more comments for the same price — and we write
            them for you. Also our name is funnier.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
            <Link
              href="/#cta"
              className="bg-coral text-white px-8 py-3.5 rounded-full font-bold text-sm md:text-base text-center shadow-lg shadow-coral/25 hover:bg-coral-dark hover:-translate-y-0.5 hover:shadow-xl hover:shadow-coral/30 transition-all"
            >
              Try SlopMog Free
            </Link>
            <a
              href="#comparison"
              className="bg-white text-charcoal px-8 py-3.5 rounded-full font-bold text-sm md:text-base text-center border-2 border-charcoal/10 hover:border-teal hover:text-teal hover:-translate-y-0.5 transition-all"
              onClick={(e) => {
                e.preventDefault();
                document
                  .getElementById("comparison")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              See Full Comparison
            </a>
          </div>

          {/* Social proof badges */}
          <div className="flex flex-wrap justify-center gap-3">
            {[
              "Starts at $49/mo",
              "15-100 comments/mo",
              "AI-generated content",
              "AI tracking included",
            ].map((badge) => (
              <span
                key={badge}
                className="bg-white px-4 py-2 rounded-full text-xs font-semibold text-charcoal-light border border-charcoal/[0.06] shadow-brand-sm"
              >
                {badge}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ STATS BAR ═══ */}
      <section className="py-12 px-4 md:px-6 bg-teal">
        <div className="max-w-[1140px] mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 text-center text-white">
            {[
              { value: "4x", label: "More comments per dollar" },
              { value: "$2.48", label: "Per comment (Make Waves)" },
              { value: "$49", label: "Starting monthly price" },
              { value: "100%", label: "Approve before posting" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="font-heading text-3xl md:text-4xl font-bold mb-1">
                  {stat.value}
                </div>
                <div className="text-sm opacity-85 font-medium">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FEATURE COMPARISON TABLE ═══ */}
      <section
        className="py-16 md:py-24 px-4 md:px-6"
        id="comparison"
      >
        <div className="max-w-[1140px] mx-auto">
          <div className="text-center mb-12">
            <span className="inline-block text-xs font-bold uppercase tracking-[1.5px] text-teal mb-3">
              Feature Comparison
            </span>
            <h2 className="font-heading font-bold text-2xl md:text-4xl text-charcoal mb-4">
              The Honest Side-by-Side
            </h2>
            <p className="text-base text-charcoal-light max-w-[540px] mx-auto">
              We&apos;re not going to pretend CrowdReply doesn&apos;t do
              anything well. Here&apos;s the actual breakdown.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] bg-white rounded-brand-lg shadow-brand-md border border-charcoal/[0.06]">
              <thead>
                <tr className="border-b-2 border-charcoal/[0.08]">
                  <th className="text-left py-4 px-6 text-sm font-bold text-charcoal-light uppercase tracking-wide">
                    Feature
                  </th>
                  <th className="text-left py-4 px-6 text-sm font-bold text-charcoal-light uppercase tracking-wide">
                    CrowdReply
                  </th>
                  <th className="text-left py-4 px-6 text-sm font-bold text-teal uppercase tracking-wide">
                    SlopMog
                  </th>
                </tr>
              </thead>
              <tbody>
                {FEATURE_COMPARISON.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-charcoal/[0.04] last:border-b-0 hover:bg-teal-bg/30 transition-colors"
                  >
                    <td className="py-3.5 px-6 text-sm font-semibold text-charcoal">
                      {row.feature}
                    </td>
                    <td className="py-3.5 px-6 text-sm text-charcoal-light">
                      <span className="flex items-start gap-2">
                        {row.winner === "competitor" ? (
                          <CheckCircle
                            size={16}
                            className="text-teal shrink-0 mt-0.5"
                          />
                        ) : null}
                        {row.competitor}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-sm text-charcoal-light">
                      <span className="flex items-start gap-2">
                        {row.winner === "slopmog" ? (
                          <CheckCircle
                            size={16}
                            className="text-teal shrink-0 mt-0.5"
                          />
                        ) : null}
                        {row.slopmog}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ═══ HONEST PROS & CONS ═══ */}
      <section className="py-16 md:py-24 px-4 md:px-6 bg-teal-bg">
        <div className="max-w-[1140px] mx-auto">
          <div className="text-center mb-12">
            <span className="inline-block text-xs font-bold uppercase tracking-[1.5px] text-teal mb-3">
              Real Talk
            </span>
            <h2 className="font-heading font-bold text-2xl md:text-4xl text-charcoal mb-4">
              CrowdReply: The Good and the Meh
            </h2>
            <p className="text-base text-charcoal-light max-w-[540px] mx-auto">
              We could pretend they&apos;re terrible. But they&apos;re not.
              Here&apos;s an honest take.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-[900px] mx-auto">
            {/* Pros */}
            <div className="bg-white rounded-brand-lg p-7 shadow-brand-sm border-2 border-teal/20">
              <div className="flex items-center gap-2.5 mb-5">
                <ThumbsUp size={20} className="text-teal" />
                <h3 className="font-heading font-bold text-lg text-charcoal">
                  What CrowdReply Does Well
                </h3>
              </div>
              <ul className="space-y-3">
                {COMPETITOR_PROS.map((pro, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 text-sm text-charcoal-light"
                  >
                    <CheckCircle
                      size={16}
                      className="text-teal shrink-0 mt-0.5"
                    />
                    {pro}
                  </li>
                ))}
              </ul>
            </div>

            {/* Cons */}
            <div className="bg-white rounded-brand-lg p-7 shadow-brand-sm border-2 border-coral/20">
              <div className="flex items-center gap-2.5 mb-5">
                <ThumbsDown size={20} className="text-coral" />
                <h3 className="font-heading font-bold text-lg text-charcoal">
                  Where It Falls Short
                </h3>
              </div>
              <ul className="space-y-3">
                {COMPETITOR_CONS.map((con, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 text-sm text-charcoal-light"
                  >
                    <XCircle
                      size={16}
                      className="text-coral shrink-0 mt-0.5"
                    />
                    {con}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ WHY CONSIDER SLOPMOG ═══ */}
      <section className="py-16 md:py-24 px-4 md:px-6">
        <div className="max-w-[1140px] mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block text-xs font-bold uppercase tracking-[1.5px] text-teal mb-3">
              The Pitch
            </span>
            <h2 className="font-heading font-bold text-2xl md:text-4xl text-charcoal mb-4">
              Why Consider SlopMog Instead
            </h2>
            <p className="text-base text-charcoal-light max-w-[540px] mx-auto">
              Besides the obviously superior name? Here are some actual
              reasons.
            </p>
          </div>

          <div className="space-y-16">
            {SWITCHING_REASONS.map((reason, i) => {
              const Icon = reason.icon;
              const isReversed = i % 2 === 1;

              return (
                <div
                  key={reason.id}
                  className={`flex flex-col ${isReversed ? "md:flex-row-reverse" : "md:flex-row"} gap-8 md:gap-12 items-center`}
                >
                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-teal/10 flex items-center justify-center">
                        <Icon size={20} className="text-teal" />
                      </div>
                      <h3 className="font-heading font-bold text-xl text-charcoal">
                        {reason.title}
                      </h3>
                    </div>
                    <p className="text-sm text-charcoal-light leading-relaxed mb-5">
                      {reason.description}
                    </p>

                    {/* Advantage callout */}
                    <div className="bg-teal-bg rounded-brand-sm p-4 mb-5 border border-teal/15">
                      <div className="text-xs font-bold uppercase tracking-wide text-teal mb-1">
                        SlopMog Advantage
                      </div>
                      <div className="text-sm font-medium text-charcoal">
                        {reason.slopmogAdvantage}
                      </div>
                    </div>

                    <ul className="space-y-2 mb-6">
                      {reason.benefits.map((benefit, j) => (
                        <li
                          key={j}
                          className="flex items-start gap-2 text-sm text-charcoal-light"
                        >
                          <CheckCircle
                            size={14}
                            className="text-teal shrink-0 mt-0.5"
                          />
                          {benefit}
                        </li>
                      ))}
                    </ul>

                    <Link
                      href={reason.ctaRoute}
                      className="inline-flex items-center gap-2 bg-coral text-white px-6 py-2.5 rounded-full font-bold text-sm shadow-md shadow-coral/20 hover:bg-coral-dark hover:-translate-y-0.5 hover:shadow-lg transition-all"
                    >
                      {reason.ctaText}
                      <ArrowRight size={16} />
                    </Link>
                  </div>

                  {/* Animated visual */}
                  <div className="flex-1 w-full">
                    <div className="bg-gradient-to-br from-teal/5 to-lavender/10 rounded-brand-lg p-4 md:p-6 border border-charcoal/[0.04]">
                      {reason.id === "pricing" && <PricingAnimation />}
                      {reason.id === "keywords" && <KeywordTargetAnimation />}
                      {reason.id === "ai-tracking" && <AITrackingAnimation />}
                      {reason.id === "human-content" && <HumanWritingAnimation />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ PRICING COMPARISON ═══ */}
      <section className="py-16 md:py-24 px-4 md:px-6 bg-teal-bg">
        <div className="max-w-[1140px] mx-auto">
          <div className="text-center mb-12">
            <span className="inline-block text-xs font-bold uppercase tracking-[1.5px] text-teal mb-3">
              Pricing
            </span>
            <h2 className="font-heading font-bold text-2xl md:text-4xl text-charcoal mb-4">
              Let&apos;s Talk Money
            </h2>
            <p className="text-base text-charcoal-light max-w-[540px] mx-auto">
              Same $99. Very different results.
            </p>
          </div>

          {/* Head-to-head $99 comparison */}
          <div className="max-w-[800px] mx-auto mb-14">
            <div className="grid md:grid-cols-[1fr_auto_1fr] gap-0 items-stretch">
              {/* CrowdReply side */}
              <div className="bg-white rounded-brand-lg md:rounded-r-none p-6 border border-charcoal/[0.06] border-r-0 max-md:border-r max-md:rounded-b-none">
                <div className="text-xs font-bold uppercase tracking-wide text-charcoal-light mb-3">CrowdReply PRO</div>
                <div className="font-heading text-3xl font-bold text-charcoal mb-1">$99<span className="text-sm font-medium text-charcoal-light">/mo</span></div>
                <div className="text-sm text-charcoal-light mb-5">$100 in credits included</div>
                <div className="space-y-3 mb-5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-charcoal-light">Comments</span>
                    <span className="font-bold text-charcoal">~10</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-charcoal-light">Cost/comment</span>
                    <span className="font-bold text-charcoal">$10.00</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-charcoal-light">Content writing</span>
                    <span className="font-bold text-coral">You write it</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-charcoal-light">Upvote boost</span>
                    <span className="font-bold text-charcoal">$0.10/each extra</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-charcoal-light">Keywords</span>
                    <span className="font-bold text-charcoal-light">Manual thread picking</span>
                  </div>
                </div>
              </div>

              {/* VS divider */}
              <div className="hidden md:flex items-center justify-center bg-charcoal w-14 text-white font-heading font-bold text-sm z-[1] rounded-brand-sm shadow-brand-md">
                VS
              </div>
              <div className="md:hidden flex items-center justify-center bg-charcoal py-2 text-white font-heading font-bold text-sm">
                VS
              </div>

              {/* SlopMog side */}
              <div className="bg-white rounded-brand-lg md:rounded-l-none p-6 border-2 border-teal max-md:rounded-t-none">
                <div className="text-xs font-bold uppercase tracking-wide text-teal mb-3">SlopMog Make Waves</div>
                <div className="font-heading text-3xl font-bold text-charcoal mb-1">$99<span className="text-sm font-medium text-charcoal-light">/mo</span></div>
                <div className="text-sm text-teal font-medium mb-5">Everything included</div>
                <div className="space-y-3 mb-5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-charcoal-light">Comments</span>
                    <span className="font-bold text-teal">40</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-charcoal-light">Cost/comment</span>
                    <span className="font-bold text-teal">$2.48</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-charcoal-light">Content writing</span>
                    <span className="font-bold text-teal">We write it</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-charcoal-light">Upvote boost</span>
                    <span className="font-bold text-teal">Available add-on</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-charcoal-light">Keywords</span>
                    <span className="font-bold text-teal">10 targeted keywords</span>
                  </div>
                </div>
                <div className="bg-teal/10 rounded-full px-4 py-1.5 text-xs font-bold text-teal text-center">
                  4x more comments for the same price
                </div>
              </div>
            </div>
          </div>

          {/* All SlopMog plans */}
          <h3 className="font-heading font-bold text-xl text-charcoal text-center mb-2">
            All SlopMog Plans
          </h3>
          <p className="text-sm text-charcoal-light text-center mb-8 max-w-[400px] mx-auto">
            Pick a plan. All include upvote boosting as an add-on.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-[960px] mx-auto items-start">
            {/* Tier 1 */}
            <div className="bg-white rounded-brand-lg px-7 py-9 shadow-brand-sm border-2 border-charcoal/[0.06] hover:-translate-y-1 hover:shadow-brand-lg transition-all relative">
              <div className="font-heading text-lg font-bold text-charcoal mb-2">
                Test the Waters
              </div>
              <div className="font-heading text-4xl font-bold text-charcoal mb-1">
                $49
                <span className="text-sm font-medium text-charcoal-light">
                  /mo
                </span>
              </div>
              <div className="text-sm text-charcoal-light mb-6">
                Dip your toes in
              </div>
              <ul className="list-none mb-7 space-y-2">
                {[
                  "15 comments posted per month",
                  "Target up to 3 keywords",
                  "See which comments are live",
                  "AI writes them, you just approve",
                ].map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2.5 text-sm text-charcoal"
                  >
                    <CheckIcon /> {f}
                  </li>
                ))}
              </ul>
              <div className="bg-teal-bg rounded-brand-sm px-4 py-2 text-xs font-semibold text-teal-dark text-center">
                $3.27 per comment
              </div>
            </div>

            {/* Tier 2 — Popular */}
            <div className="bg-white rounded-brand-lg px-7 py-9 shadow-brand-md border-2 border-teal md:scale-[1.04] z-[2] hover:-translate-y-1 transition-all relative">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-teal text-white px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide whitespace-nowrap">
                Most Popular
              </div>
              <div className="font-heading text-lg font-bold text-charcoal mb-2">
                Make Waves
              </div>
              <div className="font-heading text-4xl font-bold text-charcoal mb-1">
                $99
                <span className="text-sm font-medium text-charcoal-light">
                  /mo
                </span>
              </div>
              <div className="text-sm text-charcoal-light mb-6">
                For brands ready to show up
              </div>
              <ul className="list-none mb-7 space-y-2">
                {[
                  "40 comments posted per month",
                  "Target up to 10 keywords",
                  "Track when AI chatbots mention you",
                  "Weekly performance reports",
                  "Priority support",
                ].map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2.5 text-sm text-charcoal"
                  >
                    <CheckIcon /> {f}
                  </li>
                ))}
              </ul>
              <div className="bg-teal-bg rounded-brand-sm px-4 py-2 text-xs font-semibold text-teal-dark text-center">
                $2.48 per comment — 4x better than CrowdReply
              </div>
            </div>

            {/* Tier 3 */}
            <div className="bg-white rounded-brand-lg px-7 py-9 shadow-brand-sm border-2 border-charcoal/[0.06] hover:-translate-y-1 hover:shadow-brand-lg transition-all relative">
              <div className="font-heading text-lg font-bold text-charcoal mb-2">
                Own the Ocean
              </div>
              <div className="font-heading text-4xl font-bold text-charcoal mb-1">
                $199
                <span className="text-sm font-medium text-charcoal-light">
                  /mo
                </span>
              </div>
              <div className="text-sm text-charcoal-light mb-6">
                Serious brand domination
              </div>
              <ul className="list-none mb-7 space-y-2">
                {[
                  "100 comments posted per month",
                  "Unlimited keyword targeting",
                  "Full analytics dashboard",
                  "Track AI chatbot mentions",
                  "Priority support + strategy call",
                ].map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2.5 text-sm text-charcoal"
                  >
                    <CheckIcon /> {f}
                  </li>
                ))}
              </ul>
              <div className="bg-teal-bg rounded-brand-sm px-4 py-2 text-xs font-semibold text-teal-dark text-center">
                $1.99 per comment — 5x better than CrowdReply
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ USER REVIEWS ═══ */}
      <section className="py-16 md:py-24 px-4 md:px-6">
        <div className="max-w-[1140px] mx-auto">
          <div className="text-center mb-12">
            <span className="inline-block text-xs font-bold uppercase tracking-[1.5px] text-teal mb-3">
              Reviews
            </span>
            <h2 className="font-heading font-bold text-2xl md:text-4xl text-charcoal mb-4">
              What People Say About CrowdReply
            </h2>
            <p className="text-base text-charcoal-light max-w-[540px] mx-auto">
              Real reviews from real users. We didn&apos;t cherry-pick the
              bad ones — that would be ironic for a brand reputation company.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-[800px] mx-auto">
            {COMPETITOR_REVIEWS.map((review, i) => (
              <div
                key={i}
                className="bg-white rounded-brand-lg p-6 shadow-brand-sm border border-charcoal/[0.06] hover:shadow-brand-md transition-shadow"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                      review.sentiment === "positive"
                        ? "bg-teal/10 text-teal"
                        : "bg-sunny/20 text-sunny-dark"
                    }`}
                  >
                    {review.sentiment === "positive"
                      ? "Positive"
                      : "Mixed"}
                  </span>
                </div>
                <p className="text-sm text-charcoal-light leading-relaxed italic mb-3">
                  &ldquo;{review.quote}&rdquo;
                </p>
                <a
                  href={review.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="text-xs font-semibold text-teal hover:underline"
                >
                  {review.source}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ WHICH TOOL IS RIGHT ═══ */}
      <section className="py-16 md:py-24 px-4 md:px-6 bg-teal-bg">
        <div className="max-w-[1140px] mx-auto">
          <div className="text-center mb-12">
            <span className="inline-block text-xs font-bold uppercase tracking-[1.5px] text-teal mb-3">
              The Verdict
            </span>
            <h2 className="font-heading font-bold text-2xl md:text-4xl text-charcoal mb-4">
              Which Tool is Right for You?
            </h2>
            <p className="text-base text-charcoal-light max-w-[540px] mx-auto">
              No tool is perfect for everyone. Here&apos;s an honest take
              on who should use what.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-[900px] mx-auto mb-8">
            {/* CrowdReply might be better */}
            <div className="bg-white rounded-brand-lg p-7 shadow-brand-sm border border-charcoal/[0.06]">
              <h3 className="font-heading font-bold text-lg text-charcoal mb-5">
                CrowdReply might be better if...
              </h3>
              <ul className="space-y-3">
                {[
                  "You want to pick exact threads to post in",
                  "You need upvote boosting for existing comments",
                  "You prefer writing your own comment copy",
                  "You want pay-as-you-go with no subscription",
                  "You need API access for automation",
                  "You want to buy aged Reddit accounts outright",
                ].map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-charcoal-light"
                  >
                    <CheckCircle
                      size={14}
                      className="text-teal shrink-0 mt-0.5"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* SlopMog might be better */}
            <div className="bg-white rounded-brand-lg p-7 shadow-brand-sm border-2 border-teal/20">
              <h3 className="font-heading font-bold text-lg text-teal-dark mb-5">
                SlopMog might be better if...
              </h3>
              <ul className="space-y-3">
                {[
                  "You want more comments for less money",
                  "You prefer a flat monthly price with no credit math",
                  "You'd rather not write your own Reddit comments",
                  "You want keyword-driven strategy, not manual thread picking",
                  "You care about tracking actual AI recommendations",
                  "You want to start at $49/mo instead of $99/mo",
                ].map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-charcoal-light"
                  >
                    <CheckCircle
                      size={14}
                      className="text-teal shrink-0 mt-0.5"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Common limitations */}
          <div className="max-w-[900px] mx-auto bg-white rounded-brand p-5 border border-charcoal/[0.06]">
            <div className="flex items-start gap-3">
              <Shield
                size={20}
                className="text-charcoal-light shrink-0 mt-0.5"
              />
              <div>
                <h4 className="font-bold text-sm text-charcoal mb-1">
                  Real talk: what neither tool can guarantee
                </h4>
                <p className="text-xs text-charcoal-light leading-relaxed">
                  No Reddit marketing service can guarantee specific AI
                  recommendation placements, permanent comment survival, or
                  immunity from Reddit&apos;s spam detection. Both SlopMog
                  and CrowdReply operate in a space where platform policies
                  can change. Any service promising guaranteed results is
                  lying to you.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className="py-16 md:py-24 px-4 md:px-6">
        <div className="max-w-[1140px] mx-auto">
          <div className="text-center mb-12">
            <span className="inline-block text-xs font-bold uppercase tracking-[1.5px] text-teal mb-3">
              FAQ
            </span>
            <h2 className="font-heading font-bold text-2xl md:text-4xl text-charcoal mb-4">
              Questions You Probably Have
            </h2>
            <p className="text-base text-charcoal-light max-w-[540px] mx-auto">
              We tried to answer them before you asked. How considerate of
              us.
            </p>
          </div>

          <div className="max-w-[680px] mx-auto">
            {FAQS.map((item, i) => (
              <div
                key={i}
                className={`border-b border-charcoal/[0.08]${openFaqIndex === i ? " faq-item-open" : ""}`}
              >
                <button
                  className="w-full flex justify-between items-center py-5 bg-transparent font-heading text-base font-bold text-charcoal text-left gap-4 hover:text-teal transition-colors"
                  onClick={() =>
                    setOpenFaqIndex((prev) =>
                      prev === i ? null : i
                    )
                  }
                >
                  {item.question}
                  <span className="faq-icon w-7 h-7 rounded-full bg-teal/[0.08] flex items-center justify-center shrink-0 transition-all duration-300">
                    <PlusIcon />
                  </span>
                </button>
                <div
                  className="faq-answer"
                  ref={(el) => {
                    faqRefs.current[i] = el;
                  }}
                  style={{
                    maxHeight:
                      openFaqIndex === i
                        ? `${faqRefs.current[i]?.scrollHeight ?? 200}px`
                        : "0",
                  }}
                >
                  <div className="pb-5 text-sm text-charcoal-light leading-[1.7]">
                    {item.answer}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section className="relative overflow-hidden py-20 md:py-24 px-4 md:px-6 bg-charcoal">
        <div className="max-w-[1140px] mx-auto">
          <div className="max-w-[900px] mx-auto flex items-center gap-12 max-md:flex-col max-md:text-center max-md:gap-7 relative z-[1]">
            <div className="cta-mascot-ctx shrink-0">
              <MascotBlob />
            </div>
            <div>
              <h2 className="font-heading font-bold text-2xl md:text-3xl text-white mb-4">
                CrowdReply is fine. SlopMog is funnier and cheaper.
              </h2>
              <p className="text-white/70 text-base mb-7 leading-relaxed">
                4x more comments per dollar. AI-generated content you
                approve before posting. AI recommendation tracking. And a
                name you&apos;ll never forget. What&apos;s not to love?
              </p>
              <Link
                href="/#pricing"
                className="inline-block bg-coral text-white px-8 py-3.5 rounded-full font-bold text-base shadow-lg shadow-coral/25 hover:bg-coral-dark hover:-translate-y-0.5 hover:shadow-xl transition-all"
              >
                Try SlopMog Free
              </Link>
              <p className="mt-3.5 text-xs text-white/[0.45]">
                No contracts. Cancel anytime. Results within 30 days.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ RELATED ALTERNATIVES ═══ */}
      {relatedAlternatives.length > 0 && (
        <section className="py-16 md:py-20 px-4 md:px-6">
          <div className="max-w-[1140px] mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-heading font-bold text-xl md:text-2xl text-charcoal mb-3">
                Other Comparisons
              </h2>
              <p className="text-sm text-charcoal-light">
                See how SlopMog stacks up against other tools.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-6 max-w-[900px] mx-auto">
              {relatedAlternatives.map((alt) => (
                <Link
                  key={alt.slug}
                  href={alt.url}
                  className="bg-white rounded-brand-lg p-6 shadow-brand-sm border border-charcoal/[0.06] hover:shadow-brand-md hover:-translate-y-0.5 transition-all group"
                >
                  <h3 className="font-heading font-bold text-base text-charcoal mb-2 group-hover:text-teal transition-colors">
                    SlopMog vs {alt.name}
                  </h3>
                  <p className="text-xs text-charcoal-light leading-relaxed">
                    {alt.description}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <Footer />
    </>
  );
}
