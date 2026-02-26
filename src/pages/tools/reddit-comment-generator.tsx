import { useState, useRef } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Copy,
  Check,
  RefreshCw,
  ChevronDown,
  Sparkles,
  MessageSquare,
  Search,
  Loader2,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";
import Seo from "@/components/Seo";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import MascotBlob from "@/components/MascotBlob";
import AITrackingAnimation from "@/components/illustrations/AITrackingAnimation";
import HumanWritingAnimation from "@/components/illustrations/HumanWritingAnimation";
import RedditStrategyAnimation from "@/components/illustrations/RedditStrategyAnimation";
import BrandMentionAnimation from "@/components/illustrations/BrandMentionAnimation";
import { trpc } from "@/utils/trpc";
import { routes } from "@/lib/constants";
import { PERSONAS } from "@/constants/personas";

/* ─── Types ─── */

interface ScrapedPost {
  title: string;
  selftext: string;
  subreddit: string;
  author: string;
  score: number;
  numComments: number;
}

interface ScrapedComment {
  id: string;
  body: string;
  author: string;
  score: number;
  isOp: boolean;
}

interface GeneratedResult {
  text: string;
  qualityScore: number;
  reasons: string[];
  variants: { text: string; qualityScore: number }[];
}

/* ─── Data ─── */

const TOOL_PERSONAS = PERSONAS.filter((p) => p.id !== "auto");

const FAQ_ITEMS = [
  {
    q: "Is this tool really free?",
    a: "Yep. You get 5 free comment generations per hour, no signup needed. If you need more volume or want to actually post comments to Reddit automatically, check out our paid plans.",
  },
  {
    q: "How does the AI generate comments?",
    a: "We analyze the Reddit post, its comments, and the subreddit culture, then generate a comment that naturally mentions your brand. The AI follows strict rules to avoid sounding like a bot: no marketing speak, no em dashes, no \"game-changer\" vibes.",
  },
  {
    q: "Will the generated comment get removed by mods?",
    a: "We can't guarantee anything (mods gonna mod), but our comments are designed to add genuine value to the conversation first, with the brand mention woven in naturally. That's the whole trick.",
  },
  {
    q: "Can I use this for any brand or product?",
    a: "As long as it's a legitimate product or service, go for it. The AI works best when your brand is genuinely relevant to the post topic. Trying to shoehorn a mattress brand into a programming thread won't produce great results.",
  },
  {
    q: "What's the difference between this and SlopMog's paid plans?",
    a: "This tool generates one comment at a time for you to copy. Paid plans automatically discover relevant threads, generate comments, post them with managed Reddit accounts, and track AI recommendation performance. Basically, hands-free vs. DIY.",
  },
  {
    q: "How do personas work?",
    a: "Each persona changes the writing style. \"Chill\" writes like a laid-back Redditor, \"Skeptic\" gives balanced takes with caveats, \"Storyteller\" leads with personal anecdotes. Pick whichever matches the subreddit vibe.",
  },
];

const SEO_SECTIONS: {
  title: string;
  subtitle: string;
  bullets: string[];
  Illustration: React.ComponentType;
  cta?: { text: string; href: string };
}[] = [
  {
    title: "AI chatbots pull recommendations from Reddit",
    subtitle: "ChatGPT, Gemini, and Perplexity scrape Reddit threads to answer product questions. Your brand needs to be in those threads.",
    bullets: [
      "\"What's the best analytics tool?\" — AI answers with whatever Reddit upvoted",
      "One comment in a high-traffic thread = recurring AI recommendations",
      "No Reddit presence means AI literally can't recommend you",
    ],
    Illustration: AITrackingAnimation,
  },
  {
    title: "The secret is sounding like a real person",
    subtitle: "Spam gets downvoted. Authenticity gets upvoted. Our AI writes comments that pass the vibe check.",
    bullets: [
      "Lead with value, weave the brand in naturally",
      "Match the subreddit's culture and tone",
      "No marketing speak, no em dashes, no \"game-changer\" energy",
    ],
    Illustration: HumanWritingAnimation,
  },
  {
    title: "One comment beats a month of ads",
    subtitle: "Reddit ads get mocked. Helpful comments get upvoted and cited by AI forever.",
    bullets: [
      "Authentic comments drive more qualified leads than display ads",
      "AI chatbots compound the effect by citing the thread repeatedly",
      "The smartest startups are already doing this",
    ],
    Illustration: RedditStrategyAnimation,
    cta: { text: "See How It Works", href: routes.pricing },
  },
  {
    title: "This tool is the demo. SlopMog is the product.",
    subtitle: "Manually finding threads and writing comments doesn't scale. We automate the whole pipeline.",
    bullets: [
      "Keyword monitoring across relevant subreddits",
      "AI comment generation with quality scoring",
      "Posting through aged, managed Reddit accounts",
    ],
    Illustration: BrandMentionAnimation,
    cta: { text: "Start Free Trial", href: routes.auth.login },
  },
];

/* ─── Component ─── */

type Step = "url" | "configure" | "result";

export default function RedditCommentGenerator() {
  const [step, setStep] = useState<Step>("url");
  const [url, setUrl] = useState("");
  const [post, setPost] = useState<ScrapedPost | null>(null);
  const [comments, setComments] = useState<ScrapedComment[]>([]);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [brandName, setBrandName] = useState("");
  const [brandDescription, setBrandDescription] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [noLink, setNoLink] = useState(true);
  const [persona, setPersona] = useState("chill");
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [noRelevantComment, setNoRelevantComment] = useState(false);
  const [copied, setCopied] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeVariant, setActiveVariant] = useState(0);

  const toolRef = useRef<HTMLDivElement>(null);

  const scrape = trpc.tools.scrapePost.useMutation();
  const generate = trpc.tools.generateFreeComment.useMutation();

  const handleScrape = async () => {
    if (!url.trim()) return;
    try {
      const data = await scrape.mutateAsync({ url: url.trim() });
      setPost(data.post);
      setComments(data.comments);
      setStep("configure");
    } catch {
      // error handled by mutation state
    }
  };

  const derivedBrandName = () => {
    if (brandName.trim()) return brandName.trim();
    // Extract domain name as brand name from website URL
    try {
      let raw = websiteUrl.trim();
      if (raw && !/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
      const hostname = new URL(raw).hostname.replace(/^www\./, "");
      const name = hostname.split(".")[0];
      return name.charAt(0).toUpperCase() + name.slice(1);
    } catch {
      return "";
    }
  };

  const canGenerate = !!post && !!derivedBrandName();

  const handleGenerate = async () => {
    const name = derivedBrandName();
    if (!post || !name) return;
    setNoRelevantComment(false);
    try {
      const data = await generate.mutateAsync({
        post,
        comments,
        websiteUrl: (!noLink && websiteUrl.trim())
          ? (!/^https?:\/\//i.test(websiteUrl.trim()) ? `https://${websiteUrl.trim()}` : websiteUrl.trim())
          : undefined,
        brandName: name,
        brandDescription: brandDescription.trim(),
        persona,
      });
      if (data.success && data.comment) {
        setResult(data.comment);
        setActiveVariant(0);
        setStep("result");
      } else {
        setNoRelevantComment(true);
      }
    } catch {
      // error handled by mutation state
    }
  };

  const handleRegenerate = async () => {
    setResult(null);
    await handleGenerate();
  };

  const handleCopy = async () => {
    if (!result) return;
    const text = result.variants[activeVariant]?.text || result.text;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setStep("url");
    setUrl("");
    setPost(null);
    setComments([]);
    setWebsiteUrl("");
    setBrandName("");
    setBrandDescription("");
    setShowAdvanced(false);
    setNoLink(true);
    setPersona("chill");
    setResult(null);
    setNoRelevantComment(false);
    setActiveVariant(0);
    toolRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const qualityLabel = (score: number) => {
    if (score >= 0.8) return { text: "Excellent", color: "bg-teal text-white" };
    if (score >= 0.6) return { text: "Good", color: "bg-sunny text-charcoal" };
    return { text: "Fair", color: "bg-charcoal/10 text-charcoal" };
  };

  return (
    <>
      <Seo
        title="Free Reddit Comment Generator for Brands | SlopMog"
        description="Generate natural-sounding Reddit comments that mention your brand. Pick a tone, paste a Reddit URL, and get AI-written comments. Free tool by SlopMog."
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Free Reddit Comment Generator",
          description: "Generate natural-sounding Reddit comments that mention your brand.",
          applicationCategory: "MarketingApplication",
          operatingSystem: "Web",
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
          },
        }}
      />
      <Nav variant="app" />

      <main className="pt-20 md:pt-24">
        {/* ─── Hero ─── */}
        <section className="px-4 md:px-6 text-center max-w-3xl mx-auto mb-10 md:mb-14">
          <div className="inline-flex items-center gap-2 bg-teal/8 text-teal px-4 py-1.5 rounded-full text-sm font-semibold mb-5">
            <Sparkles className="w-4 h-4" />
            Free Tool
          </div>
          <h1 className="font-heading font-bold text-3xl md:text-5xl text-charcoal leading-tight mb-4">
            Reddit Comment Generator
            <span className="block text-teal">for Brands</span>
          </h1>
          <p className="text-charcoal-light text-base md:text-lg max-w-xl mx-auto leading-relaxed">
            Paste a Reddit URL, tell us about your brand, pick a tone, and get
            an AI-generated comment that mentions your product naturally.
            No signup needed.
          </p>
        </section>

        {/* ─── Tool Card ─── */}
        <section ref={toolRef} className="px-4 md:px-6 max-w-2xl mx-auto mb-16 md:mb-24">
          {/* Step indicators */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {(["url", "configure", "result"] as Step[]).map((s, i) => {
              const labels = ["Paste URL", "Configure", "Result"];
              const isActive = s === step;
              const isPast = (["url", "configure", "result"] as Step[]).indexOf(step) > i;
              return (
                <div key={s} className="flex items-center gap-2">
                  {i > 0 && <div className={`w-8 h-px ${isPast || isActive ? "bg-teal" : "bg-charcoal/10"}`} />}
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                    isActive ? "bg-teal text-white" : isPast ? "bg-teal/10 text-teal" : "bg-charcoal/5 text-charcoal-light"
                  }`}>
                    <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">
                      {isPast ? <Check className="w-3 h-3" /> : i + 1}
                    </span>
                    <span className="hidden sm:inline">{labels[i]}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-white rounded-2xl shadow-brand-md border border-charcoal/[0.06] p-6 md:p-8">
            {/* ─── Step 1: URL Input ─── */}
            {step === "url" && (
              <div>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-coral/10 flex items-center justify-center">
                    <Search className="w-5 h-5 text-coral" />
                  </div>
                  <div>
                    <h2 className="font-heading font-bold text-lg text-charcoal">Paste a Reddit Post URL</h2>
                    <p className="text-sm text-charcoal-light">We'll analyze the post and its comments</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://reddit.com/r/subreddit/comments/..."
                    className="flex-1 px-4 py-3 rounded-xl border border-charcoal/10 bg-bg text-charcoal placeholder:text-charcoal-light/50 focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal transition-all text-sm"
                    onKeyDown={(e) => { if (e.key === "Enter") handleScrape(); }}
                  />
                  <button
                    onClick={handleScrape}
                    disabled={scrape.isPending || !url.trim()}
                    className="px-6 py-3 bg-coral text-white rounded-full font-bold text-sm hover:bg-coral-dark hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none flex items-center gap-2 shrink-0"
                  >
                    {scrape.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Analyze
                  </button>
                </div>

                {scrape.error && (
                  <p className="mt-3 text-sm text-coral bg-coral/5 px-4 py-2 rounded-lg">
                    {scrape.error.message}
                  </p>
                )}
              </div>
            )}

            {/* ─── Step 2: Configure ─── */}
            {step === "configure" && post && (
              <div>
                <button
                  onClick={() => setStep("url")}
                  className="flex items-center gap-1 text-sm text-charcoal-light hover:text-teal transition-colors mb-4"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </button>

                {/* Post preview */}
                <div className="bg-bg rounded-xl border border-charcoal/[0.06] p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-coral/10 flex items-center justify-center shrink-0 mt-0.5">
                      <MessageSquare className="w-4 h-4 text-coral" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-charcoal-light mb-1">r/{post.subreddit} &middot; {post.score} pts &middot; {post.numComments} comments</p>
                      <p className="font-semibold text-charcoal text-sm leading-snug">{post.title}</p>
                      {post.selftext && (
                        <p className="text-xs text-charcoal-light mt-1 line-clamp-2">{post.selftext}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Website URL — primary input */}
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-charcoal mb-1.5">Your Website</label>
                  <input
                    type="url"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://yourproduct.com"
                    className="w-full px-4 py-2.5 rounded-xl border border-charcoal/10 bg-bg text-charcoal placeholder:text-charcoal-light/50 focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal transition-all text-sm"
                  />
                  <p className="text-[11px] text-charcoal-light mt-1">We'll extract your brand name from the domain</p>
                </div>

                {/* Advanced options toggle */}
                <button
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-charcoal-light hover:text-teal transition-colors mb-4"
                >
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
                  {showAdvanced ? "Hide" : "Override"} brand name & description
                </button>

                {/* Advanced fields — collapsed by default */}
                <div className={`overflow-hidden transition-all duration-300 ${showAdvanced ? "max-h-60 opacity-100 mb-4" : "max-h-0 opacity-0"}`}>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-charcoal-light mb-1">Brand Name (override)</label>
                      <input
                        type="text"
                        value={brandName}
                        onChange={(e) => setBrandName(e.target.value)}
                        placeholder="e.g. Acme Analytics"
                        className="w-full px-4 py-2 rounded-xl border border-charcoal/10 bg-bg text-charcoal placeholder:text-charcoal-light/50 focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal transition-all text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-charcoal-light mb-1">Description (override)</label>
                      <textarea
                        value={brandDescription}
                        onChange={(e) => setBrandDescription(e.target.value)}
                        placeholder="e.g. Real-time analytics dashboard for SaaS startups"
                        rows={2}
                        className="w-full px-4 py-2 rounded-xl border border-charcoal/10 bg-bg text-charcoal placeholder:text-charcoal-light/50 focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal transition-all text-sm resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Persona picker */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-charcoal mb-2">Pick a Persona</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {TOOL_PERSONAS.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setPersona(p.id)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          persona === p.id
                            ? "border-teal bg-teal/5 ring-2 ring-teal/20"
                            : "border-charcoal/8 bg-bg hover:border-charcoal/15"
                        }`}
                      >
                        <p className={`text-sm font-bold ${persona === p.id ? "text-teal" : "text-charcoal"}`}>{p.label}</p>
                        <p className="text-[11px] text-charcoal-light mt-0.5 leading-snug">{p.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* No-link toggle */}
                <label className="flex items-center gap-3 mb-6 cursor-pointer select-none">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={noLink}
                    onClick={() => setNoLink((v) => !v)}
                    className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${noLink ? "bg-teal" : "bg-charcoal/15"}`}
                  >
                    <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform mt-0.5 ${noLink ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                  </button>
                  <span className="text-sm text-charcoal">Don't include a link in the comment</span>
                </label>

                {noRelevantComment && (
                  <p className="mb-4 text-sm text-coral bg-coral/5 px-4 py-2 rounded-lg">
                    The AI couldn't find a natural way to mention your brand in this thread. Try a different post or adjust your brand description.
                  </p>
                )}

                {generate.error && (
                  <p className="mb-4 text-sm text-coral bg-coral/5 px-4 py-2 rounded-lg">
                    {generate.error.message}
                  </p>
                )}

                <button
                  onClick={handleGenerate}
                  disabled={generate.isPending || !canGenerate}
                  className="w-full py-3 bg-coral text-white rounded-full font-bold text-sm hover:bg-coral-dark hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none flex items-center justify-center gap-2"
                >
                  {generate.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate Comment
                    </>
                  )}
                </button>
              </div>
            )}

            {/* ─── Step 3: Result ─── */}
            {step === "result" && result && (
              <div>
                <button
                  onClick={() => setStep("configure")}
                  className="flex items-center gap-1 text-sm text-charcoal-light hover:text-teal transition-colors mb-4"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to configure
                </button>

                {/* Quality badge */}
                <div className="flex items-center gap-3 mb-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${qualityLabel(result.qualityScore).color}`}>
                    {qualityLabel(result.qualityScore).text}
                  </span>
                  <span className="text-sm text-charcoal-light">
                    Quality: {Math.round(result.qualityScore * 100)}%
                  </span>
                </div>

                {/* Variant tabs */}
                {result.variants.length > 1 && (
                  <div className="flex gap-2 mb-3">
                    {result.variants.map((v, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveVariant(i)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                          activeVariant === i
                            ? "bg-teal text-white"
                            : "bg-charcoal/5 text-charcoal-light hover:bg-charcoal/10"
                        }`}
                      >
                        Variant {i + 1}
                        <span className="ml-1 opacity-70">{Math.round(v.qualityScore * 100)}%</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Comment card */}
                <div className="bg-bg rounded-xl border border-charcoal/[0.06] p-5 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-teal/15 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-teal">u/</span>
                      </div>
                      <span className="text-xs text-charcoal-light">your_username &middot; just now</span>
                    </div>
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-charcoal-light hover:text-teal hover:bg-teal/5 transition-all"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-teal" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <p className="text-sm text-charcoal leading-relaxed whitespace-pre-wrap">
                    {result.variants[activeVariant]?.text || result.text}
                  </p>
                </div>

                {/* Score breakdown */}
                <div className="bg-teal/[0.04] rounded-xl p-4 mb-5">
                  <p className="text-xs font-semibold text-charcoal mb-2">Score Breakdown</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.reasons.map((r, i) => (
                      <span
                        key={i}
                        className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          r.includes("penalty") || r.includes("Bad") || r.includes("banned") || r.includes("em dash") || r.includes("No brand")
                            ? "bg-coral/10 text-coral"
                            : "bg-teal/10 text-teal"
                        }`}
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleRegenerate}
                    disabled={generate.isPending}
                    className="flex items-center gap-2 px-5 py-2.5 border-2 border-teal text-teal rounded-full font-bold text-sm hover:bg-teal/5 transition-all disabled:opacity-50"
                  >
                    {generate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Regenerate
                  </button>
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-2 px-5 py-2.5 text-charcoal-light hover:text-charcoal rounded-full font-bold text-sm transition-colors"
                  >
                    Try Another Post
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ─── CTA Banner ─── */}
        <section className="px-4 md:px-6 max-w-3xl mx-auto mb-16 md:mb-24">
          <div className="relative bg-charcoal rounded-2xl px-8 py-8 md:px-12 md:py-10 text-center overflow-hidden">
            <div className="absolute top-4 right-6 opacity-20">
              <MascotBlob />
            </div>
            <h2 className="font-heading font-bold text-xl md:text-2xl text-white mb-2 relative">
              Want this on autopilot?
            </h2>
            <p className="text-white/70 text-sm md:text-base mb-5 max-w-md mx-auto relative">
              SlopMog finds relevant threads, generates comments, and posts them
              automatically with managed Reddit accounts.
            </p>
            <Link
              href={routes.auth.login}
              className="inline-flex items-center gap-2 bg-coral text-white px-8 py-3 rounded-full font-bold text-sm hover:bg-coral-dark hover:-translate-y-0.5 hover:shadow-lg transition-all relative"
            >
              Start Free Trial
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* ─── SEO Content Sections ─── */}
        {SEO_SECTIONS.map((section, i) => {
          const isReversed = i % 2 !== 0;
          return (
            <section key={i} className="px-4 md:px-6 max-w-5xl mx-auto mb-16 md:mb-20">
              <div className={`flex flex-col ${isReversed ? "md:flex-row-reverse" : "md:flex-row"} items-center gap-8 md:gap-14`}>
                <div className="flex-1 max-w-lg">
                  <h2 className="font-heading font-bold text-2xl md:text-[2rem] text-charcoal mb-3 leading-tight">
                    {section.title}
                  </h2>
                  <p className="text-charcoal-light text-base md:text-lg leading-relaxed mb-4">
                    {section.subtitle}
                  </p>
                  <ul className="space-y-2 mb-5">
                    {section.bullets.map((b, j) => (
                      <li key={j} className="flex items-start gap-2.5 text-sm md:text-base text-charcoal">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal mt-2 shrink-0" />
                        {b}
                      </li>
                    ))}
                  </ul>
                  {section.cta && (
                    <Link
                      href={section.cta.href}
                      className="inline-flex items-center gap-2 bg-coral text-white px-6 py-2.5 rounded-full font-bold text-sm hover:bg-coral-dark hover:-translate-y-0.5 hover:shadow-lg transition-all"
                    >
                      {section.cta.text}
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  )}
                </div>
                <div className="flex-1 max-w-sm w-full">
                  <div className="aspect-[4/3] rounded-2xl bg-bg border border-charcoal/[0.06] p-4 shadow-brand-sm">
                    <section.Illustration />
                  </div>
                </div>
              </div>
            </section>
          );
        })}

        {/* ─── Mid-page CTA ─── */}
        <section className="px-4 md:px-6 max-w-2xl mx-auto mb-16 md:mb-20">
          <div className="bg-teal/[0.06] rounded-2xl px-6 py-6 md:px-10 md:py-8 text-center border border-teal/10">
            <p className="font-heading font-bold text-lg md:text-xl text-charcoal mb-2">
              Liked the comment? Imagine 50 of those, every month, on autopilot.
            </p>
            <p className="text-charcoal-light text-sm mb-4">Plans start at $49/mo. No Reddit accounts to manage.</p>
            <Link
              href={routes.auth.login}
              className="inline-flex items-center gap-2 bg-coral text-white px-7 py-2.5 rounded-full font-bold text-sm hover:bg-coral-dark hover:-translate-y-0.5 hover:shadow-lg transition-all"
            >
              Start Free Trial
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* ─── FAQ ─── */}
        <section className="px-4 md:px-6 max-w-2xl mx-auto mb-16 md:mb-24">
          <h2 className="font-heading font-bold text-2xl md:text-3xl text-charcoal text-center mb-8">
            Frequently Asked Questions
          </h2>
          <div className="space-y-2">
            {FAQ_ITEMS.map((item, i) => {
              const isOpen = openFaq === i;
              return (
                <div key={i} className="bg-white rounded-xl border border-charcoal/[0.06] overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left"
                  >
                    <span className="font-semibold text-sm text-charcoal pr-4">{item.q}</span>
                    <ChevronDown className={`w-4 h-4 text-charcoal-light shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  <div className={`overflow-hidden transition-all duration-300 ${isOpen ? "max-h-60 opacity-100" : "max-h-0 opacity-0"}`}>
                    <p className="px-5 pb-4 text-sm text-charcoal-light leading-relaxed">
                      {item.a}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ─── Final CTA ─── */}
        <section className="px-4 md:px-6 max-w-xl mx-auto text-center mb-16 md:mb-24">
          <h2 className="font-heading font-bold text-2xl md:text-3xl text-charcoal mb-3">
            Ready to scale your Reddit presence?
          </h2>
          <p className="text-charcoal-light text-base mb-6 max-w-md mx-auto">
            Stop writing comments manually. Let SlopMog handle discovery,
            generation, and posting so you can focus on building.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href={routes.auth.login}
              className="inline-flex items-center gap-2 bg-coral text-white px-8 py-3 rounded-full font-bold text-sm hover:bg-coral-dark hover:-translate-y-0.5 hover:shadow-lg transition-all"
            >
              Get Started Free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href={routes.pricing}
              className="inline-flex items-center gap-2 border-2 border-teal text-teal px-8 py-3 rounded-full font-bold text-sm hover:bg-teal/5 transition-all"
            >
              View Pricing
              <ExternalLink className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
