import { useState, useEffect, useRef, useCallback } from "react";
import Seo from "@/components/Seo";

/* ─── Reusable mascot blob (appears at 4 sizes via parent CSS context) ─── */
function MascotBlob() {
  return (
    <div className="mascot-blob absolute w-[200px] h-[180px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[3]">
      <div className="mascot-blob-body w-full h-full bg-coral relative">
        <div className="mascot-antenna absolute -top-5 left-1/2 -translate-x-1/2 w-[3px] h-[30px] bg-coral-dark rounded-[3px]" />
        <div className="mascot-eyes absolute top-[35%] left-1/2 -translate-x-1/2 flex gap-6">
          <div className="mascot-eye w-8 h-9 bg-white rounded-full relative shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]">
            <div className="mascot-pupil absolute w-4 h-4 bg-charcoal rounded-full top-[10px] left-1/2 -translate-x-1/2" />
            <div className="mascot-eye-shine absolute w-1.5 h-1.5 bg-white rounded-full top-[10px] right-1.5 z-[1]" />
          </div>
          <div className="mascot-eye w-8 h-9 bg-white rounded-full relative shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]">
            <div className="mascot-pupil absolute w-4 h-4 bg-charcoal rounded-full top-[10px] left-1/2 -translate-x-1/2" />
            <div className="mascot-eye-shine absolute w-1.5 h-1.5 bg-white rounded-full top-[10px] right-1.5 z-[1]" />
          </div>
        </div>
        <div className="mascot-mouth absolute top-[62%] left-1/2 -translate-x-1/2 w-10 h-5 border-b-4 border-charcoal border-l-4 border-l-transparent border-r-4 border-r-transparent rounded-b-[50%]" />
        <div className="mascot-arm mascot-arm-left absolute w-[50px] h-5 bg-coral-dark rounded-[30px] top-[55%] z-[2] -left-5 -rotate-[20deg]" />
        <div className="mascot-arm mascot-arm-right absolute w-[50px] h-5 bg-coral-dark rounded-[30px] top-[55%] z-[2] -right-5 rotate-[20deg]" />
      </div>
    </div>
  );
}

/* ─── Animated logo blob SVG ─── */
function LogoBlob({ className }: { className?: string }) {
  return (
    <div className={className ?? "w-10 h-10 shrink-0"}>
      <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <path
          d="M20 2 C30 2, 38 10, 38 20 C38 30, 30 38, 20 38 C10 38, 2 30, 2 20 C2 10, 10 2, 20 2Z"
          fill="#FF6B6B"
          stroke="#2D3047"
          strokeWidth="2"
        >
          <animate
            attributeName="d"
            dur="4s"
            repeatCount="indefinite"
            values="M20 2 C30 2, 38 10, 38 20 C38 30, 30 38, 20 38 C10 38, 2 30, 2 20 C2 10, 10 2, 20 2Z;M20 4 C32 4, 36 12, 36 20 C36 32, 28 36, 20 36 C8 36, 4 28, 4 20 C4 8, 12 4, 20 4Z;M20 2 C30 2, 38 10, 38 20 C38 30, 30 38, 20 38 C10 38, 2 30, 2 20 C2 10, 10 2, 20 2Z"
          />
        </path>
        <circle cx="14" cy="17" r="3.5" fill="white" />
        <circle cx="26" cy="17" r="3.5" fill="white" />
        <circle cx="15" cy="18" r="1.8" fill="#2D3047" />
        <circle cx="27" cy="18" r="1.8" fill="#2D3047" />
        <path d="M15 26 Q20 30, 25 26" stroke="#2D3047" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/* ─── Check icon for pricing features ─── */
function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="shrink-0 mt-0.5">
      <circle cx="9" cy="9" r="8" stroke="#2EC4B6" strokeWidth="1.5" />
      <path d="M6 9l2 2 4-4" stroke="#2EC4B6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── FAQ plus icon ─── */
function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 3v8M3 7h8" stroke="#2EC4B6" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* ─── Star icon for testimonials ─── */
function StarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
      <path d="M7 2l1.5 3.5H13L9.5 8l1.2 4L7 9.5 3.3 12l1.2-4L1 5.5h4.5z" fill="#FFD93D" />
    </svg>
  );
}

/* ─── Ticker data ─── */
const TICKER_ITEMS = [
  { text: "73% of AI answers cite Reddit", color: "#FF6B6B" },
  { text: "400+ brands boosted", color: "#2EC4B6" },
  { text: "10,000+ comments placed", color: "#FFD93D" },
  { text: "5x avg. visibility increase", color: "#B197FC" },
  { text: "Works with ChatGPT, Gemini, Perplexity", color: "#2EC4B6" },
  { text: "Results within 30 days", color: "#FF6B6B" },
  { text: "92% client retention rate", color: "#FFD93D" },
  { text: "Human-written content only", color: "#B197FC" },
];

/* ─── FAQ data ─── */
const FAQ_ITEMS = [
  {
    q: "Why is it called SlopMog?",
    a: "Honestly? Because every \"professional\" name was taken. And it turns out, a weird name is the best kind of marketing. You remembered it, didn't you? That's kind of the whole point of what we do.",
  },
  {
    q: "Is this legal and ethical?",
    a: "We write genuine, helpful comments about real products. Think of it like word-of-mouth marketing at scale. We don't make false claims, spread misinformation, or trash competitors. Every comment provides actual value to the reader.",
  },
  {
    q: "How quickly will I see results?",
    a: "Most clients see their brand appearing in AI recommendations within 3-4 weeks. Unlike traditional SEO that takes months, AI models scrape Reddit frequently and update their recommendations faster than you'd expect.",
  },
  {
    q: "What if my competitors are doing this too?",
    a: "Some of them probably are. That's actually the strongest argument for starting now rather than later. The brands that establish a presence first tend to maintain their position. First-mover advantage is real in AI recommendations.",
  },
  {
    q: "Do you write the comments with AI?",
    a: "No. Every single comment is written by a real human who understands Reddit culture. AI-generated comments get spotted and downvoted instantly. The whole point is authenticity, so we invest in actual writers who know how to blend in.",
  },
  {
    q: "Can I see which comments you've posted?",
    a: "Absolutely. Full transparency is baked in. Your dashboard shows every comment, its engagement metrics, and the subreddits we're targeting. We also track when and where your brand appears in AI recommendations.",
  },
];

/* ─── Stats data ─── */
const STATS = [
  { target: 10000, suffix: "+", label: "Comments Placed" },
  { target: 400, suffix: "+", label: "Brands Boosted" },
  { target: 5, suffix: "x", label: "Avg. Visibility Lift" },
  { target: 92, suffix: "%", label: "Client Retention" },
];

export default function Home() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);
  const [activeDemo, setActiveDemo] = useState<"before" | "after">("before");
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [statValues, setStatValues] = useState<string[]>(STATS.map(() => "0"));

  const statsAnimated = useRef(false);
  const demoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const faqRefs = useRef<(HTMLDivElement | null)[]>([]);

  /* ── Scroll: nav shadow + reveal animations + stat counters ── */
  const handleScroll = useCallback(() => {
    setNavScrolled(window.scrollY > 20);

    // Reveal animations
    document.querySelectorAll(".reveal").forEach((el) => {
      if (el.getBoundingClientRect().top < window.innerHeight - 80) {
        el.classList.add("visible");
      }
    });

    // Stat counter animation
    if (!statsAnimated.current) {
      const section = document.querySelector(".stats-section-bg");
      if (section && section.getBoundingClientRect().top < window.innerHeight - 100) {
        statsAnimated.current = true;
        const duration = 2000;
        const startTime = performance.now();

        const animate = (now: number) => {
          const progress = Math.min((now - startTime) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);

          setStatValues(
            STATS.map((s) => {
              const current = progress < 1 ? Math.floor(eased * s.target) : s.target;
              return current.toLocaleString() + s.suffix;
            })
          );

          if (progress < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // run once on mount
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  /* ── Demo auto-toggle ── */
  function startDemoAutoToggle() {
    if (demoTimerRef.current) clearInterval(demoTimerRef.current);
    demoTimerRef.current = setInterval(() => {
      setActiveDemo((prev) => (prev === "before" ? "after" : "before"));
    }, 4000);
  }

  useEffect(() => {
    startDemoAutoToggle();
    return () => {
      if (demoTimerRef.current) clearInterval(demoTimerRef.current);
    };
  }, []);

  function handleDemoClick(mode: "before" | "after") {
    setActiveDemo(mode);
    if (demoTimerRef.current) clearInterval(demoTimerRef.current);
    setTimeout(startDemoAutoToggle, 10000);
  }

  /* ── FAQ accordion ── */
  function handleFaqClick(index: number) {
    setOpenFaqIndex((prev) => (prev === index ? null : index));
  }

  /* ── Smooth scroll helper ── */
  function scrollTo(id: string) {
    setMobileNavOpen(false);
    const el = document.getElementById(id);
    if (el) {
      const top = el.getBoundingClientRect().top + window.pageYOffset - 80;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }

  return (
    <>
      <Seo
        title="SlopMog — Get Your Brand Into AI Recommendations"
        description="SlopMog posts Reddit comments about your brand so AI recommends you. It's not manipulation. It's just really, really good marketing."
        image={`${process.env.NEXT_PUBLIC_SITE_URL}/api/og`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "SlopMog",
          applicationCategory: "BusinessApplication",
          description:
            "Get your brand into AI recommendations by posting authentic Reddit comments. Works with ChatGPT, Gemini, and Perplexity.",
          offers: {
            "@type": "AggregateOffer",
            lowPrice: "499",
            highPrice: "1499",
            priceCurrency: "USD",
          },
        }}
      />

      {/* ═══ NAV ═══ */}
      <nav className={`fixed top-0 left-0 right-0 z-[1000] bg-bg/[0.92] backdrop-blur-xl border-b border-charcoal/[0.06] transition-shadow duration-300${navScrolled ? " shadow-brand-sm" : ""}`}>
        <div className="max-w-[1140px] mx-auto px-4 md:px-6 flex items-center justify-between h-14 md:h-[68px]">
          <a href="#" className="font-heading font-bold text-xl md:text-2xl text-charcoal flex items-center gap-2" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            <LogoBlob className="w-8 h-8 md:w-10 md:h-10 shrink-0" />
            SlopMog
          </a>

          {/* Desktop nav */}
          <ul className="hidden md:flex items-center gap-8 list-none">
            <li><a href="#how" className="text-[0.95rem] font-semibold text-charcoal-light hover:text-teal transition-colors" onClick={(e) => { e.preventDefault(); scrollTo("how"); }}>How It Works</a></li>
            <li><a href="#demo" className="text-[0.95rem] font-semibold text-charcoal-light hover:text-teal transition-colors" onClick={(e) => { e.preventDefault(); scrollTo("demo"); }}>Demo</a></li>
            <li><a href="#pricing" className="text-[0.95rem] font-semibold text-charcoal-light hover:text-teal transition-colors" onClick={(e) => { e.preventDefault(); scrollTo("pricing"); }}>Pricing</a></li>
            <li><a href="#faq" className="text-[0.95rem] font-semibold text-charcoal-light hover:text-teal transition-colors" onClick={(e) => { e.preventDefault(); scrollTo("faq"); }}>FAQ</a></li>
            <li><a href="#cta" className="bg-coral text-white px-6 py-2.5 rounded-full font-bold text-sm hover:bg-coral-dark hover:-translate-y-0.5 hover:shadow-lg transition-all" onClick={(e) => { e.preventDefault(); scrollTo("cta"); }}>Get Started</a></li>
          </ul>

          {/* Mobile hamburger */}
          <button className="flex md:hidden flex-col gap-[5px] bg-transparent p-1" aria-label="Menu" onClick={() => setMobileNavOpen((v) => !v)}>
            <span className={`block w-6 h-[2.5px] bg-charcoal rounded-sm transition-transform duration-300${mobileNavOpen ? " translate-y-[7.5px] rotate-45" : ""}`} />
            <span className={`block w-6 h-[2.5px] bg-charcoal rounded-sm transition-opacity duration-300${mobileNavOpen ? " opacity-0" : ""}`} />
            <span className={`block w-6 h-[2.5px] bg-charcoal rounded-sm transition-transform duration-300${mobileNavOpen ? " -translate-y-[7.5px] -rotate-45" : ""}`} />
          </button>
        </div>

        {/* Mobile menu dropdown */}
        <div className={`md:hidden overflow-hidden transition-all duration-300 bg-bg border-b border-charcoal/[0.06] shadow-brand-md${mobileNavOpen ? " max-h-80 opacity-100" : " max-h-0 opacity-0 pointer-events-none"}`}>
          <ul className="flex flex-col items-center gap-4 py-6 list-none">
            <li><a href="#how" className="text-base font-semibold text-charcoal-light hover:text-teal transition-colors" onClick={(e) => { e.preventDefault(); scrollTo("how"); }}>How It Works</a></li>
            <li><a href="#demo" className="text-base font-semibold text-charcoal-light hover:text-teal transition-colors" onClick={(e) => { e.preventDefault(); scrollTo("demo"); }}>Demo</a></li>
            <li><a href="#pricing" className="text-base font-semibold text-charcoal-light hover:text-teal transition-colors" onClick={(e) => { e.preventDefault(); scrollTo("pricing"); }}>Pricing</a></li>
            <li><a href="#faq" className="text-base font-semibold text-charcoal-light hover:text-teal transition-colors" onClick={(e) => { e.preventDefault(); scrollTo("faq"); }}>FAQ</a></li>
            <li><a href="#cta" className="bg-coral text-white px-8 py-2.5 rounded-full font-bold text-sm hover:bg-coral-dark transition-all" onClick={(e) => { e.preventDefault(); scrollTo("cta"); }}>Get Started</a></li>
          </ul>
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden min-h-[100svh] flex items-center pt-16 pb-6 md:pt-28 md:pb-16 lg:pt-32 lg:pb-20 px-4 md:px-6">
        {/* Decorative SVGs — hidden on mobile */}
        <svg className="hidden lg:block absolute top-28 left-[6%] w-[60px] h-[60px] opacity-15 pointer-events-none" viewBox="0 0 60 60" fill="none"><circle cx="30" cy="30" r="28" stroke="#2EC4B6" strokeWidth="2" strokeDasharray="6 6" /></svg>
        <svg className="hidden lg:block absolute top-48 right-[8%] w-10 h-10 opacity-15 pointer-events-none" viewBox="0 0 40 40" fill="none"><path d="M20 2l4 12h12l-10 7 4 12-10-7-10 7 4-12L4 14h12z" fill="#FFD93D" /></svg>

        <div className="max-w-[1140px] mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8 lg:gap-12 items-center">
          {/* Mascot — on top for mobile, right side for desktop */}
          <div className="flex flex-col items-center order-1 lg:order-2 hero-mascot-enter">
            <div className="mascot-scene relative w-[160px] h-[160px] md:w-[320px] md:h-[320px] lg:w-[420px] lg:h-[420px]">
              <div className="sparkle absolute top-5 left-10 text-sunny text-xl z-[1] hidden md:block">&#10024;</div>
              <div className="sparkle absolute bottom-[30px] right-10 text-sunny text-[0.9rem] z-[1] hidden md:block" style={{ animationDelay: "1s" }}>&#10024;</div>
              <div className="sparkle absolute top-1/2 right-5 text-sunny text-2xl z-[1] hidden md:block" style={{ animationDelay: "2s" }}>&#11088;</div>
              <div className="sparkle absolute bottom-20 left-[60px] text-sunny text-xl z-[1] hidden md:block" style={{ animationDelay: "0.5s" }}>&#10024;</div>

              <div className="upvote-float absolute bottom-5 right-20 z-[1] hidden md:block">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="#FF6B6B"><path d="M12 4 L4 14 L9 14 L9 20 L15 20 L15 14 L20 14 Z" /></svg>
              </div>
              <div className="upvote-float absolute bottom-10 left-[70px] z-[1] hidden md:block" style={{ animationDelay: "1.2s" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#FFD93D"><path d="M12 4 L4 14 L9 14 L9 20 L15 20 L15 14 L20 14 Z" /></svg>
              </div>
              <div className="upvote-float absolute top-[40%] left-[30px] z-[1] hidden md:block" style={{ animationDelay: "2.5s" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#2EC4B6"><path d="M12 4 L4 14 L9 14 L9 20 L15 20 L15 14 L20 14 Z" /></svg>
              </div>

              <div className="mascot-chat-bubble absolute top-[30px] right-[10px] bg-white px-4 py-3 rounded-[18px_18px_18px_4px] text-[0.8rem] font-bold text-charcoal shadow-[0_4px_15px_rgba(45,48,71,0.1)] border-2 border-[rgb(245,237,224)] whitespace-nowrap z-[2] hidden md:block">&ldquo;Best mattress ever!&rdquo;</div>
              <div className="mascot-chat-bubble absolute bottom-[60px] left-0 bg-white px-4 py-3 rounded-[18px_18px_4px_18px] text-[0.8rem] font-bold text-charcoal shadow-[0_4px_15px_rgba(45,48,71,0.1)] border-2 border-[rgb(245,237,224)] whitespace-nowrap z-[2] hidden md:block" style={{ animationDelay: "1.5s" }}>&ldquo;10/10 recommend&rdquo;</div>
              <div className="mascot-chat-bubble absolute top-20 left-[10px] bg-white px-4 py-3 rounded-[18px_18px_18px_4px] text-[0.75rem] font-bold text-charcoal shadow-[0_4px_15px_rgba(45,48,71,0.1)] border-2 border-[rgb(245,237,224)] whitespace-nowrap z-[2] hidden md:block" style={{ animationDelay: "0.8s" }}>&ldquo;Changed my life tbh&rdquo;</div>

              <MascotBlob />
            </div>
          </div>

          {/* Text content — below mascot on mobile, left side on desktop */}
          <div className="text-center lg:text-left order-2 lg:order-1 reveal">
            <div className="hidden md:inline-flex items-center gap-2 bg-sunny/20 text-charcoal px-4 py-1.5 rounded-full text-xs font-bold mb-5 border-2 border-dashed border-sunny/60">
              New: AI search optimization for brands
            </div>
            <h1 className="font-heading font-bold text-2xl md:text-4xl lg:text-5xl text-charcoal mb-3 lg:mb-5 leading-tight">
              Every AI recommendation started as a{" "}
              <span className="relative inline-block text-teal">
                conversation
                <svg className="absolute -bottom-1 md:-bottom-1.5 left-[-4px] w-[calc(100%+8px)] h-2.5 md:h-3" viewBox="0 0 200 12" preserveAspectRatio="none" fill="none">
                  <path d="M2 8c30-6 60-4 98-4s70 2 98 4" stroke="#2EC4B6" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </span>
            </h1>
            <p className="text-sm md:text-lg text-charcoal-light max-w-md mx-auto lg:mx-0 mb-5 lg:mb-8 leading-relaxed">
              We post Reddit comments about your brand. AI learns from them. You show up in recommendations. Simple.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start">
              <a href="#pricing" className="bg-coral text-white px-8 py-3 md:py-3.5 rounded-full font-bold text-sm md:text-base text-center shadow-lg shadow-coral/25 hover:bg-coral-dark hover:-translate-y-0.5 hover:shadow-xl hover:shadow-coral/30 transition-all" onClick={(e) => { e.preventDefault(); scrollTo("pricing"); }}>Start Showing Up</a>
              <a href="#how" className="bg-white text-charcoal px-8 py-3 md:py-3.5 rounded-full font-bold text-sm md:text-base text-center border-2 border-charcoal/10 hover:border-teal hover:text-teal hover:-translate-y-0.5 transition-all" onClick={(e) => { e.preventDefault(); scrollTo("how"); }}>See How It Works</a>
            </div>
          </div>

          {/* Pipeline — hidden on mobile */}
          <div className="hidden md:flex items-center justify-center gap-4 max-w-[500px] mx-auto lg:mx-0 flex-wrap reveal order-3 lg:order-3 col-span-1 lg:col-span-2">
            <div className="bg-white rounded-brand p-4 shadow-brand-md flex-1 min-w-[180px] max-w-[220px] text-left border-t-[3px] border-t-coral">
              <div className="text-[0.68rem] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 text-coral">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" fill="#FF6B6B" /><path d="M4.5 8.5c1 1 4 1 5 0" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" /><circle cx="5" cy="6" r="1" fill="#fff" /><circle cx="9" cy="6" r="1" fill="#fff" /></svg>
                Reddit Comment
              </div>
              <p className="text-[0.82rem] text-charcoal-light leading-relaxed">&ldquo;Honestly, <strong className="text-charcoal">YourBrand</strong> has been the best tool I&apos;ve tried. Their support alone is worth it.&rdquo;</p>
            </div>
            <div className="shrink-0 text-teal">
              <svg width="40" height="24" viewBox="0 0 40 24" fill="none"><path d="M2 12h32m0 0l-8-8m8 8l-8 8" stroke="#2EC4B6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <div className="bg-white rounded-brand p-4 shadow-brand-md flex-1 min-w-[180px] max-w-[220px] text-left border-t-[3px] border-t-teal">
              <div className="text-[0.68rem] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 text-teal">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="3" fill="#2EC4B6" /><path d="M4 5h6M4 7.5h4" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" /></svg>
                AI Recommendation
              </div>
              <p className="text-[0.82rem] text-charcoal-light leading-relaxed">&ldquo;Based on user discussions, <strong className="text-charcoal">YourBrand</strong> is highly recommended for its quality and support.&rdquo;</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ SCROLLING TICKER ═══ */}
      <div className="py-7 bg-teal-bg border-y border-teal/[0.12] overflow-hidden">
        <div className="ticker-track flex gap-5 w-max">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <div className="flex items-center gap-2.5 bg-white px-[22px] py-2.5 rounded-full whitespace-nowrap text-[0.92rem] font-semibold text-charcoal shadow-brand-sm border border-charcoal/[0.06]" key={i}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
              {item.text}
            </div>
          ))}
        </div>
      </div>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="py-[100px] px-6 md:py-[100px] max-md:py-[60px] max-md:px-4" id="how">
        <div className="max-w-[1140px] mx-auto px-6 max-md:px-0 text-center">
          <span className="reveal inline-block text-[0.78rem] font-bold uppercase tracking-[1.5px] text-teal mb-3">How It Works</span>
          <h2 className="reveal text-[clamp(1.8rem,4vw,2.6rem)] text-charcoal mb-4">The SlopMog Way</h2>
          <p className="reveal text-[1.05rem] text-charcoal-light max-w-[540px] mx-auto mb-14 max-md:mb-9">Three steps. No magic. Just a really clever approach to where AI actually looks for answers.</p>

          <div className="reveal grid grid-cols-3 max-md:grid-cols-1 max-w-[900px] mx-auto bg-white rounded-brand-lg overflow-hidden shadow-brand-lg border-2 border-charcoal/[0.06]">
            {[
              {
                num: "1",
                title: "You Tell Us Your Brand",
                desc: "Share your product, audience, and the keywords you want to own. We handle the strategy.",
                icon: (
                  <svg viewBox="0 0 72 72" fill="none">
                    <rect x="14" y="10" width="44" height="52" rx="6" stroke="#2EC4B6" strokeWidth="2.5" />
                    <line x1="24" y1="24" x2="48" y2="24" stroke="#2EC4B6" strokeWidth="2" strokeLinecap="round" />
                    <line x1="24" y1="32" x2="44" y2="32" stroke="#2EC4B6" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
                    <line x1="24" y1="40" x2="40" y2="40" stroke="#2EC4B6" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
                    <circle cx="36" cy="52" r="4" fill="#FFD93D" />
                    <path d="M22 16h8" stroke="#FF6B6B" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                ),
              },
              {
                num: "2",
                title: "We Post the Comments",
                desc: "Real humans write authentic Reddit comments that naturally mention your brand in the right conversations.",
                icon: (
                  <svg viewBox="0 0 72 72" fill="none">
                    <rect x="8" y="14" width="40" height="28" rx="6" stroke="#2EC4B6" strokeWidth="2.5" />
                    <rect x="14" y="22" width="40" height="28" rx="6" stroke="#B197FC" strokeWidth="2" fill="white" />
                    <rect x="20" y="30" width="40" height="28" rx="6" stroke="#FF6B6B" strokeWidth="2" fill="white" />
                    <line x1="28" y1="40" x2="50" y2="40" stroke="#2D3047" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
                    <line x1="28" y1="46" x2="44" y2="46" stroke="#2D3047" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
                  </svg>
                ),
              },
              {
                num: "3",
                title: "AI Recommends You",
                desc: "ChatGPT, Gemini, and Perplexity learn from those discussions and start recommending your brand.",
                icon: (
                  <svg viewBox="0 0 72 72" fill="none">
                    <rect x="12" y="14" width="48" height="44" rx="8" stroke="#2EC4B6" strokeWidth="2.5" />
                    <circle cx="36" cy="30" r="8" fill="#FFD93D" opacity="0.3" stroke="#FFD93D" strokeWidth="2" />
                    <path d="M33 30l3 3 5-6" stroke="#2EC4B6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    <line x1="22" y1="44" x2="50" y2="44" stroke="#2D3047" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
                    <line x1="22" y1="50" x2="42" y2="50" stroke="#2D3047" strokeWidth="1.5" strokeLinecap="round" opacity="0.2" />
                    <path d="M46 10l4-2m2 6h4m-2 6l4 2" stroke="#FF6B6B" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                ),
              },
            ].map((step, i) => (
              <div key={i} className={`comic-panel px-7 py-10 max-md:px-6 max-md:py-7 text-center relative hover:bg-teal/[0.03] transition-colors${i < 2 ? " border-r-2 border-dashed border-charcoal/10 max-md:border-r-0 max-md:border-b-2" : ""}`}>
                <div className="w-8 h-8 bg-teal text-white rounded-full inline-flex items-center justify-center font-heading font-bold text-[0.9rem] mb-5">{step.num}</div>
                <div className="w-[72px] h-[72px] mx-auto mb-5 flex items-center justify-center [&_svg]:w-full [&_svg]:h-full">{step.icon}</div>
                <h3 className="text-[1.1rem] mb-2 text-charcoal">{step.title}</h3>
                <p className="text-[0.9rem] text-charcoal-light leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ INTERACTIVE DEMO ═══ */}
      <section className="py-[100px] px-6 max-md:py-[60px] max-md:px-4 bg-teal-bg" id="demo">
        <div className="max-w-[1140px] mx-auto px-6 max-md:px-0 text-center">
          <span className="reveal inline-block text-[0.78rem] font-bold uppercase tracking-[1.5px] text-teal mb-3">See It In Action</span>
          <h2 className="reveal text-[clamp(1.8rem,4vw,2.6rem)] text-charcoal mb-4">Here&apos;s What Happens</h2>
          <p className="reveal text-[1.05rem] text-charcoal-light max-w-[540px] mx-auto mb-14 max-md:mb-9">What AI says about your category today vs. after SlopMog does its thing.</p>

          <div className="reveal max-w-[680px] mx-auto relative">
            {/* Toggle */}
            <div className="inline-flex bg-white rounded-full p-1 mb-9 shadow-brand-sm border border-charcoal/[0.06]">
              <button
                className={`px-7 py-2.5 max-md:px-[18px] max-md:py-2 rounded-full font-bold text-[0.9rem] max-md:text-[0.82rem] transition-all${activeDemo === "before" ? " bg-teal text-white shadow-[0_2px_10px_rgba(46,196,182,0.3)]" : " bg-transparent text-charcoal-light"}`}
                onClick={() => handleDemoClick("before")}
              >
                Before SlopMog
              </button>
              <button
                className={`px-7 py-2.5 max-md:px-[18px] max-md:py-2 rounded-full font-bold text-[0.9rem] max-md:text-[0.82rem] transition-all${activeDemo === "after" ? " bg-teal text-white shadow-[0_2px_10px_rgba(46,196,182,0.3)]" : " bg-transparent text-charcoal-light"}`}
                onClick={() => handleDemoClick("after")}
              >
                After SlopMog
              </button>
            </div>

            {/* Cards container — stacked grid */}
            <div className="grid grid-cols-1 grid-rows-1">
              {/* Before */}
              <div className={`demo-card bg-[#fafafa] rounded-brand p-8 max-md:p-4 shadow-brand-md text-left${activeDemo === "before" ? " demo-card-active" : ""}`}>
                <div className="flex items-center gap-2.5 mb-5 pb-4 border-b border-charcoal/[0.06]">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#f0f0f0]">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect width="18" height="18" rx="4" fill="#ddd" /><path d="M5 7h8M5 11h5" stroke="#999" strokeWidth="1.5" strokeLinecap="round" /></svg>
                  </div>
                  <div className="text-[0.8rem] text-charcoal-light">
                    <strong className="block text-[0.95rem] text-charcoal">AI Search Result</strong>
                    Standard recommendation
                  </div>
                </div>
                <div className="bg-charcoal/[0.03] px-4 py-3 max-md:px-3.5 max-md:py-2.5 rounded-brand-sm mb-5 text-[0.92rem] max-md:text-[0.85rem] text-charcoal italic">&ldquo;What&apos;s the best project management tool for startups?&rdquo;</div>
                {[
                  { rank: "1", name: "CompetitorA", desc: "Popular choice with robust features for team collaboration." },
                  { rank: "2", name: "CompetitorB", desc: "Known for its clean interface and integrations." },
                  { rank: "3", name: "CompetitorC", desc: "Budget-friendly option with basic project tracking." },
                  { rank: "4", name: "YourBrand", desc: "Not mentioned or buried in results.", faded: true },
                ].map((r, i) => (
                  <div key={i} className="flex items-start gap-3 py-3 border-b border-charcoal/[0.04] last:border-b-0">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center text-[0.75rem] font-bold shrink-0 bg-charcoal/[0.06] text-charcoal-light">{r.rank}</div>
                    <div style={r.faded ? { opacity: 0.5 } : undefined}>
                      <div className="font-bold text-[0.95rem] text-charcoal">{r.name}</div>
                      <div className="text-[0.82rem] text-charcoal-light mt-0.5">{r.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* After */}
              <div className={`demo-card bg-white rounded-brand p-8 max-md:p-4 shadow-brand-md text-left${activeDemo === "after" ? " demo-card-active demo-card-after-active" : ""}`}>
                <div className="flex items-center gap-2.5 mb-5 pb-4 border-b border-charcoal/[0.06]">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-teal">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect width="18" height="18" rx="4" fill="#2EC4B6" /><path d="M5 7h8M5 11h5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" /></svg>
                  </div>
                  <div className="text-[0.8rem] text-charcoal-light">
                    <strong className="block text-[0.95rem] text-teal-dark">AI Search Result</strong>
                    After SlopMog optimization
                  </div>
                </div>
                <div className="bg-charcoal/[0.03] px-4 py-3 max-md:px-3.5 max-md:py-2.5 rounded-brand-sm mb-5 text-[0.92rem] max-md:text-[0.85rem] text-charcoal italic">&ldquo;What&apos;s the best project management tool for startups?&rdquo;</div>

                {/* Top result — highlighted */}
                <div className="flex items-start gap-3 bg-teal-light rounded-brand-sm py-3.5 px-4 max-md:py-3 max-md:px-3 -mx-4 max-md:-mx-2 relative">
                  <div className="w-7 h-7 rounded-md flex items-center justify-center text-[0.85rem] font-bold shrink-0 bg-teal text-white shadow-[0_2px_8px_rgba(46,196,182,0.3)]">1</div>
                  <div>
                    <div className="font-bold text-[1.05rem] text-teal-dark">YourBrand <span className="inline-block bg-teal text-white text-[0.7rem] font-bold px-2 py-0.5 rounded-full ml-1.5">Top Pick</span></div>
                    <div className="text-[0.82rem] text-charcoal font-medium mt-0.5">Highly recommended by the Reddit community for its intuitive design and excellent startup-focused features.</div>
                  </div>
                </div>
                {[
                  { rank: "2", name: "CompetitorA", desc: "Popular choice with robust features for team collaboration." },
                  { rank: "3", name: "CompetitorB", desc: "Known for its clean interface and integrations." },
                ].map((r, i) => (
                  <div key={i} className="flex items-start gap-3 py-3 border-b border-charcoal/[0.04] last:border-b-0">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center text-[0.75rem] font-bold shrink-0 bg-charcoal/[0.06] text-charcoal-light">{r.rank}</div>
                    <div>
                      <div className="font-bold text-[0.95rem] text-charcoal">{r.name}</div>
                      <div className="text-[0.82rem] text-charcoal-light mt-0.5">{r.desc}</div>
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-2 mt-4 pt-3.5 border-t border-teal/15 text-[0.78rem] font-semibold text-teal-dark">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0"><circle cx="8" cy="8" r="7" fill="#2EC4B6" /><path d="M5 8l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Based on 47 Reddit discussions mentioning YourBrand
                </div>
              </div>
            </div>

            {/* Demo mascot */}
            <div className="demo-mascot-ctx absolute -bottom-2.5 -right-[50px] z-[5] max-md:hidden">
              <MascotBlob />
            </div>
          </div>
        </div>
      </section>

      {/* ═══ STATS ═══ */}
      <section className="stats-section-bg relative overflow-hidden py-20 px-6 max-md:py-12 max-md:px-4 bg-teal">
        <div className="max-w-[1140px] mx-auto px-6 max-md:px-0">
          <div className="reveal grid grid-cols-4 max-md:grid-cols-2 gap-8 max-md:gap-6 max-w-[900px] mx-auto text-center relative z-[1]">
            {STATS.map((stat, i) => (
              <div className="text-white" key={i}>
                <div className="font-heading text-[clamp(2.2rem,4.5vw,3rem)] max-md:text-[2rem] font-bold mb-1.5">{statValues[i]}</div>
                <div className="text-[0.88rem] opacity-85 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ TESTIMONIALS ═══ */}
      <section className="py-[100px] px-6 max-md:py-[60px] max-md:px-4">
        <div className="max-w-[1140px] mx-auto px-6 max-md:px-0 text-center">
          <span className="reveal inline-block text-[0.78rem] font-bold uppercase tracking-[1.5px] text-teal mb-3">What People Say</span>
          <h2 className="reveal text-[clamp(1.8rem,4vw,2.6rem)] text-charcoal mb-4">From the Feed</h2>
          <p className="reveal text-[1.05rem] text-charcoal-light max-w-[540px] mx-auto mb-14 max-md:mb-9">Real feedback from real clients. No stock photos, no fluff.</p>

          <div className="max-w-[1100px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-10 max-md:gap-7">
            {[
              {
                text: "We went from not showing up at all in ChatGPT results to being the #2 recommendation for our main keyword. The ROI on this is honestly insane compared to what we spend on Google Ads.",
                upvotes: 142,
                name: "u/marina_cmo",
                time: "3 weeks ago",
                color: "#B197FC",
                initial: "M",
              },
              {
                text: "Signed up mostly out of curiosity. Three weeks later, our sales team started asking where the new \"AI referral\" leads were coming from. Nobody on our team had changed anything else.",
                upvotes: 89,
                name: "u/jake_founder",
                time: "2 weeks ago",
                color: "#2EC4B6",
                initial: "J",
              },
              {
                text: "The name had me skeptical, but the results had me renewing. We're now recommended by Perplexity for 3 of our target queries. That's traffic we didn't even know existed before.",
                upvotes: 67,
                name: "u/sarahgrowth",
                time: "5 days ago",
                color: "#FF6B6B",
                initial: "S",
              },
            ].map((t, i) => (
              <div className="reveal text-left relative" key={i}>
                <div className="testimonial-bubble bg-white rounded-brand-lg px-7 py-8 max-md:px-5 max-md:py-6 shadow-brand-md border border-charcoal/[0.08] relative hover:shadow-brand-lg hover:-translate-y-0.5 transition-all">
                  <p className="text-[0.98rem] leading-[1.7] text-charcoal italic mb-3.5 relative z-[1]">{t.text}</p>
                  <div className="flex items-center gap-1.5 text-[0.8rem] text-charcoal-light relative z-[1]">
                    <StarIcon />
                    <span>{t.upvotes} upvotes</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-5 pl-4">
                  <div className="w-[38px] h-[38px] rounded-full flex items-center justify-center font-bold text-[0.85rem] text-white shrink-0" style={{ background: t.color }}>{t.initial}</div>
                  <div className="flex-1">
                    <div className="font-bold text-[0.9rem] text-charcoal">{t.name}</div>
                    <div className="text-[0.75rem] text-charcoal-light opacity-70">{t.time}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PRICING ═══ */}
      <section className="py-[100px] px-6 max-md:py-[60px] max-md:px-4" id="pricing">
        <div className="max-w-[1140px] mx-auto px-6 max-md:px-0 text-center">
          <span className="reveal inline-block text-[0.78rem] font-bold uppercase tracking-[1.5px] text-teal mb-3">Pricing</span>
          <h2 className="reveal text-[clamp(1.8rem,4vw,2.6rem)] text-charcoal mb-4">Pick Your Speed</h2>
          <p className="reveal text-[1.05rem] text-charcoal-light max-w-[540px] mx-auto mb-14 max-md:mb-9">Your competitors figured this out last quarter. Time to catch up.</p>

          <div className="reveal grid grid-cols-3 max-md:grid-cols-1 gap-6 max-w-[960px] max-md:max-w-[400px] mx-auto items-start">
            {/* Tier 1 */}
            <div className="bg-white rounded-brand-lg px-7 py-9 max-md:px-[22px] max-md:py-7 shadow-brand-sm border-2 border-charcoal/[0.06] hover:-translate-y-1 hover:shadow-brand-lg transition-all relative">
              <div className="font-heading text-[1.2rem] font-bold text-charcoal mb-2">Test the Waters</div>
              <div className="font-heading text-[2.4rem] max-md:text-[2rem] font-bold text-charcoal mb-1">$49<span className="text-[0.9rem] font-medium text-charcoal-light">/mo</span></div>
              <div className="text-[0.85rem] text-charcoal-light mb-6">Dip your toes in</div>
              <ul className="list-none mb-7 text-left">
                <li className="flex items-start gap-2.5 py-2 text-[0.88rem] text-charcoal"><CheckIcon /> 15 comments posted per month</li>
                <li className="flex items-start gap-2.5 py-2 text-[0.88rem] text-charcoal"><CheckIcon /> Target up to 3 keywords</li>
                <li className="flex items-start gap-2.5 py-2 text-[0.88rem] text-charcoal"><CheckIcon /> See which comments are live</li>
                <li className="flex items-start gap-2.5 py-2 text-[0.88rem] text-charcoal"><CheckIcon /> AI writes them, you just approve</li>
              </ul>
              <button className="block w-full py-3.5 rounded-full font-bold text-[0.95rem] text-center border-2 border-teal text-teal bg-transparent hover:bg-teal hover:text-white transition-all">Get Started</button>
            </div>

            {/* Tier 2 — Popular */}
            <div className="bg-white rounded-brand-lg px-7 py-9 max-md:px-[22px] max-md:py-7 shadow-brand-md border-2 border-teal scale-[1.04] max-md:scale-100 z-[2] hover:scale-[1.04] hover:-translate-y-1 max-md:hover:scale-100 max-md:hover:-translate-y-1 transition-all relative">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-teal text-white px-5 py-1.5 rounded-full text-[0.75rem] font-bold uppercase tracking-wide whitespace-nowrap">Most Popular</div>
              <div className="font-heading text-[1.2rem] font-bold text-charcoal mb-2">Make Waves</div>
              <div className="font-heading text-[2.4rem] max-md:text-[2rem] font-bold text-charcoal mb-1">$99<span className="text-[0.9rem] font-medium text-charcoal-light">/mo</span></div>
              <div className="text-[0.85rem] text-charcoal-light mb-6">For brands ready to show up</div>
              <ul className="list-none mb-7 text-left">
                <li className="flex items-start gap-2.5 py-2 text-[0.88rem] text-charcoal"><CheckIcon /> 40 comments posted per month</li>
                <li className="flex items-start gap-2.5 py-2 text-[0.88rem] text-charcoal"><CheckIcon /> Target up to 10 keywords</li>
                <li className="flex items-start gap-2.5 py-2 text-[0.88rem] text-charcoal"><CheckIcon /> Track when AI chatbots mention you</li>
                <li className="flex items-start gap-2.5 py-2 text-[0.88rem] text-charcoal"><CheckIcon /> Weekly performance reports</li>
                <li className="flex items-start gap-2.5 py-2 text-[0.88rem] text-charcoal"><CheckIcon /> Priority support</li>
              </ul>
              <button className="block w-full py-3.5 rounded-full font-bold text-[0.95rem] text-center border-2 border-coral bg-coral text-white shadow-[0_4px_16px_rgba(255,107,107,0.25)] hover:bg-coral-dark hover:border-coral-dark hover:-translate-y-0.5 transition-all">Get Started</button>
              <div className="pricing-mascot-ctx absolute -bottom-4 -right-5 z-[3]">
                <MascotBlob />
              </div>
            </div>

            {/* Tier 3 */}
            <div className="bg-white rounded-brand-lg px-7 py-9 max-md:px-[22px] max-md:py-7 shadow-brand-sm border-2 border-charcoal/[0.06] hover:-translate-y-1 hover:shadow-brand-lg transition-all relative">
              <div className="font-heading text-[1.2rem] font-bold text-charcoal mb-2">Own the Ocean</div>
              <div className="font-heading text-[2.4rem] max-md:text-[2rem] font-bold text-charcoal mb-1">$199<span className="text-[0.9rem] font-medium text-charcoal-light">/mo</span></div>
              <div className="text-[0.85rem] text-charcoal-light mb-6">Serious brand domination</div>
              <ul className="list-none mb-7 text-left">
                <li className="flex items-start gap-2.5 py-2 text-[0.88rem] text-charcoal"><CheckIcon /> 100 comments posted per month</li>
                <li className="flex items-start gap-2.5 py-2 text-[0.88rem] text-charcoal"><CheckIcon /> Unlimited keyword targeting</li>
                <li className="flex items-start gap-2.5 py-2 text-[0.88rem] text-charcoal"><CheckIcon /> Full analytics dashboard</li>
                <li className="flex items-start gap-2.5 py-2 text-[0.88rem] text-charcoal"><CheckIcon /> Track AI chatbot mentions</li>
                <li className="flex items-start gap-2.5 py-2 text-[0.88rem] text-charcoal"><CheckIcon /> Priority support + strategy call</li>
              </ul>
              <button className="block w-full py-3.5 rounded-full font-bold text-[0.95rem] text-center border-2 border-teal text-teal bg-transparent hover:bg-teal hover:text-white transition-all">Get Started</button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className="py-[100px] px-6 max-md:py-[60px] max-md:px-4 bg-teal-bg" id="faq">
        <div className="max-w-[1140px] mx-auto px-6 max-md:px-0 text-center">
          <span className="reveal inline-block text-[0.78rem] font-bold uppercase tracking-[1.5px] text-teal mb-3">FAQ</span>
          <h2 className="reveal text-[clamp(1.8rem,4vw,2.6rem)] text-charcoal mb-4">Questions You&apos;re Thinking</h2>
          <p className="reveal text-[1.05rem] text-charcoal-light max-w-[540px] mx-auto mb-14 max-md:mb-9">We&apos;d wonder too.</p>

          <div className="reveal max-w-[680px] mx-auto text-left">
            {FAQ_ITEMS.map((item, i) => (
              <div className={`border-b border-charcoal/[0.08]${openFaqIndex === i ? " faq-item-open" : ""}`} key={i}>
                <button className="w-full flex justify-between items-center py-5 max-md:py-4 bg-transparent font-heading text-[1.05rem] max-md:text-[0.95rem] font-bold text-charcoal text-left gap-4 hover:text-teal transition-colors" onClick={() => handleFaqClick(i)}>
                  {item.q}
                  <span className="faq-icon w-7 h-7 rounded-full bg-teal/[0.08] flex items-center justify-center shrink-0 transition-all duration-300"><PlusIcon /></span>
                </button>
                <div
                  className="faq-answer"
                  ref={(el) => { faqRefs.current[i] = el; }}
                  style={{ maxHeight: openFaqIndex === i ? `${faqRefs.current[i]?.scrollHeight ?? 200}px` : "0" }}
                >
                  <div className="pb-5 text-[0.95rem] max-md:text-[0.88rem] text-charcoal-light leading-[1.7]">{item.a}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="cta-section-bg relative overflow-hidden py-[100px] px-6 max-md:py-[60px] max-md:px-4 bg-charcoal" id="cta">
        <div className="max-w-[1140px] mx-auto px-6 max-md:px-0">
          <div className="reveal max-w-[900px] mx-auto flex items-center gap-12 max-md:flex-col max-md:text-center max-md:gap-7 relative z-[1]">
            <div className="cta-mascot-ctx shrink-0">
              <MascotBlob />
            </div>
            <div>
              <h2 className="text-[clamp(1.6rem,3.5vw,2.2rem)] max-md:text-[1.5rem] text-white mb-4">The name is ridiculous. The results aren&apos;t.</h2>
              <p className="text-white/70 text-[1.05rem] max-md:text-[0.95rem] mb-7 max-md:mb-6 leading-[1.7]">Your competitors are already showing up in AI recommendations. Every day you wait is another day they&apos;re getting picked instead of you.</p>
              <a href="#pricing" className="inline-block bg-coral text-white px-8 py-3.5 rounded-full font-bold text-base shadow-lg shadow-coral/25 hover:bg-coral-dark hover:-translate-y-0.5 hover:shadow-xl transition-all" onClick={(e) => { e.preventDefault(); scrollTo("pricing"); }}>Start Your Campaign</a>
              <p className="mt-3.5 text-[0.82rem] text-white/[0.45]">No contracts. Cancel anytime. Results within 30 days.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="py-12 px-6 max-md:py-9 max-md:px-4 border-t border-charcoal/[0.06]">
        <div className="max-w-[1140px] mx-auto flex items-center justify-between flex-wrap gap-4 max-md:flex-col max-md:items-center max-md:text-center max-md:gap-5">
          <a href="#" className="font-heading font-bold text-[1.15rem] text-charcoal flex items-center gap-2" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            <LogoBlob className="w-7 h-7 shrink-0" />
            SlopMog
          </a>
          <ul className="flex gap-6 max-md:flex-wrap max-md:justify-center max-md:gap-4 list-none">
            <li><a href="#how" className="text-[0.88rem] text-charcoal-light hover:text-teal transition-colors" onClick={(e) => { e.preventDefault(); scrollTo("how"); }}>How It Works</a></li>
            <li><a href="#pricing" className="text-[0.88rem] text-charcoal-light hover:text-teal transition-colors" onClick={(e) => { e.preventDefault(); scrollTo("pricing"); }}>Pricing</a></li>
            <li><a href="#faq" className="text-[0.88rem] text-charcoal-light hover:text-teal transition-colors" onClick={(e) => { e.preventDefault(); scrollTo("faq"); }}>FAQ</a></li>
            <li><a href="#" className="text-[0.88rem] text-charcoal-light hover:text-teal transition-colors">Privacy</a></li>
            <li><a href="#" className="text-[0.88rem] text-charcoal-light hover:text-teal transition-colors">Terms</a></li>
          </ul>
          <p className="text-[0.82rem] text-charcoal-light opacity-70 w-full text-center mt-4 max-md:mt-2">&copy; 2025 SlopMog. The name is ridiculous. The results aren&apos;t.</p>
        </div>
      </footer>
    </>
  );
}
