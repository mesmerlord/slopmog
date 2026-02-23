import { useState, useEffect, useRef, useCallback } from "react";
import Seo from "@/components/Seo";

/* ─── Reusable mascot blob (appears at 4 sizes) ─── */
function MascotBlob() {
  return (
    <div className="mascot-blob">
      <div className="mascot-blob-body">
        <div className="mascot-antenna" />
        <div className="mascot-eyes">
          <div className="mascot-eye">
            <div className="mascot-pupil" />
            <div className="mascot-eye-shine" />
          </div>
          <div className="mascot-eye">
            <div className="mascot-pupil" />
            <div className="mascot-eye-shine" />
          </div>
        </div>
        <div className="mascot-mouth" />
        <div className="mascot-arm mascot-arm-left" />
        <div className="mascot-arm mascot-arm-right" />
      </div>
    </div>
  );
}

/* ─── Animated logo blob SVG ─── */
function LogoBlob() {
  return (
    <div className="nav-logo-blob">
      <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
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
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
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
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
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
      const section = document.querySelector(".stats-section");
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
      <Head>
        <title>SlopMog — Get Your Brand Into AI Recommendations</title>
        <meta
          name="description"
          content="SlopMog posts Reddit comments about your brand so AI recommends you. It's not manipulation. It's just really, really good marketing."
        />
        <meta property="og:title" content="SlopMog — Get Your Brand Into AI Recommendations" />
        <meta
          property="og:description"
          content="We post Reddit comments about your brand. AI learns from them. You show up in recommendations."
        />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/api/og" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="/api/og" />
      </Head>

      {/* ═══ NAV ═══ */}
      <nav className={`nav${navScrolled ? " scrolled" : ""}`}>
        <div className="nav-inner">
          <a href="#" className="nav-logo" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            <LogoBlob />
            SlopMog
          </a>
          <ul className={`nav-links${mobileNavOpen ? " open" : ""}`}>
            <li><a href="#how" onClick={(e) => { e.preventDefault(); scrollTo("how"); }}>How It Works</a></li>
            <li><a href="#demo" onClick={(e) => { e.preventDefault(); scrollTo("demo"); }}>Demo</a></li>
            <li><a href="#pricing" onClick={(e) => { e.preventDefault(); scrollTo("pricing"); }}>Pricing</a></li>
            <li><a href="#faq" onClick={(e) => { e.preventDefault(); scrollTo("faq"); }}>FAQ</a></li>
            <li><a href="#cta" className="nav-cta" onClick={(e) => { e.preventDefault(); scrollTo("cta"); }}>Get Started</a></li>
          </ul>
          <button className="mobile-toggle" aria-label="Menu" onClick={() => setMobileNavOpen((v) => !v)}>
            <span /><span /><span />
          </button>
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <section className="hero">
        <svg className="hero-deco hero-deco-1" viewBox="0 0 60 60" fill="none"><circle cx="30" cy="30" r="28" stroke="#2EC4B6" strokeWidth="2" strokeDasharray="6 6" /></svg>
        <svg className="hero-deco hero-deco-2" viewBox="0 0 40 40" fill="none"><path d="M20 2l4 12h12l-10 7 4 12-10-7-10 7 4-12L4 14h12z" fill="#FFD93D" /></svg>
        <svg className="hero-deco hero-deco-3" viewBox="0 0 50 50" fill="none"><rect x="5" y="5" width="40" height="40" rx="10" stroke="#B197FC" strokeWidth="2" strokeDasharray="4 4" transform="rotate(15 25 25)" /></svg>
        <svg className="hero-deco hero-deco-4" viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="6" fill="#FF6B6B" opacity="0.5" /><circle cx="18" cy="18" r="16" stroke="#FF6B6B" strokeWidth="1.5" opacity="0.3" /></svg>

        <div className="hero-grid">
          <div className="hero-content reveal">
            <div className="hero-badge">New: AI search optimization for brands</div>
            <h1>
              Every AI recommendation started as a{" "}
              <span className="highlight">
                conversation
                <svg viewBox="0 0 200 12" preserveAspectRatio="none" fill="none">
                  <path d="M2 8c30-6 60-4 98-4s70 2 98 4" stroke="#2EC4B6" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </span>
            </h1>
            <p className="hero-sub">
              We post Reddit comments about your brand. AI learns from them. You show up in recommendations. Simple.
            </p>
            <div className="hero-btns">
              <a href="#pricing" className="btn-primary" onClick={(e) => { e.preventDefault(); scrollTo("pricing"); }}>Start Showing Up</a>
              <a href="#how" className="btn-secondary" onClick={(e) => { e.preventDefault(); scrollTo("how"); }}>See How It Works</a>
            </div>
          </div>

          <div className="hero-visual hero-mascot-enter">
            <div className="mascot-scene">
              <div className="sparkle sparkle-1">&#10024;</div>
              <div className="sparkle sparkle-2">&#10024;</div>
              <div className="sparkle sparkle-3">&#11088;</div>
              <div className="sparkle sparkle-4">&#10024;</div>

              <div className="upvote-float upvote-1">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="#FF6B6B"><path d="M12 4 L4 14 L9 14 L9 20 L15 20 L15 14 L20 14 Z" /></svg>
              </div>
              <div className="upvote-float upvote-2">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#FFD93D"><path d="M12 4 L4 14 L9 14 L9 20 L15 20 L15 14 L20 14 Z" /></svg>
              </div>
              <div className="upvote-float upvote-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#2EC4B6"><path d="M12 4 L4 14 L9 14 L9 20 L15 20 L15 14 L20 14 Z" /></svg>
              </div>

              <div className="mascot-chat-bubble mascot-chat-1">&ldquo;Best mattress ever!&rdquo;</div>
              <div className="mascot-chat-bubble mascot-chat-2">&ldquo;10/10 recommend&rdquo;</div>
              <div className="mascot-chat-bubble mascot-chat-3">&ldquo;Changed my life tbh&rdquo;</div>

              <MascotBlob />
            </div>

            <div className="pipeline reveal">
              <div className="pipeline-card pipeline-card-reddit">
                <div className="pipeline-card-label">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" fill="#FF6B6B" /><path d="M4.5 8.5c1 1 4 1 5 0" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" /><circle cx="5" cy="6" r="1" fill="#fff" /><circle cx="9" cy="6" r="1" fill="#fff" /></svg>
                  Reddit Comment
                </div>
                <p className="pipeline-card-text">&ldquo;Honestly, <strong>YourBrand</strong> has been the best tool I&apos;ve tried. Their support alone is worth it.&rdquo;</p>
              </div>
              <div className="pipeline-arrow">
                <svg width="40" height="24" viewBox="0 0 40 24" fill="none"><path d="M2 12h32m0 0l-8-8m8 8l-8 8" stroke="#2EC4B6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <div className="pipeline-card pipeline-card-ai">
                <div className="pipeline-card-label">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="3" fill="#2EC4B6" /><path d="M4 5h6M4 7.5h4" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" /></svg>
                  AI Recommendation
                </div>
                <p className="pipeline-card-text">&ldquo;Based on user discussions, <strong>YourBrand</strong> is highly recommended for its quality and support.&rdquo;</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ SCROLLING TICKER ═══ */}
      <div className="ticker-section">
        <div className="ticker-track">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <div className="ticker-pill" key={i}>
              <span className="ticker-dot" style={{ background: item.color }} />
              {item.text}
            </div>
          ))}
        </div>
      </div>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="how-section" id="how">
        <div className="container">
          <span className="section-label reveal">How It Works</span>
          <h2 className="section-title reveal">The SlopMog Way</h2>
          <p className="section-sub reveal">Three steps. No magic. Just a really clever approach to where AI actually looks for answers.</p>

          <div className="comic-strip reveal">
            <div className="comic-panel">
              <div className="comic-panel-number">1</div>
              <div className="comic-panel-icon">
                <svg viewBox="0 0 72 72" fill="none">
                  <rect x="14" y="10" width="44" height="52" rx="6" stroke="#2EC4B6" strokeWidth="2.5" />
                  <line x1="24" y1="24" x2="48" y2="24" stroke="#2EC4B6" strokeWidth="2" strokeLinecap="round" />
                  <line x1="24" y1="32" x2="44" y2="32" stroke="#2EC4B6" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
                  <line x1="24" y1="40" x2="40" y2="40" stroke="#2EC4B6" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
                  <circle cx="36" cy="52" r="4" fill="#FFD93D" />
                  <path d="M22 16h8" stroke="#FF6B6B" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>
              <h3>You Tell Us Your Brand</h3>
              <p>Share your product, audience, and the keywords you want to own. We handle the strategy.</p>
            </div>

            <div className="comic-panel">
              <div className="comic-panel-number">2</div>
              <div className="comic-panel-icon">
                <svg viewBox="0 0 72 72" fill="none">
                  <rect x="8" y="14" width="40" height="28" rx="6" stroke="#2EC4B6" strokeWidth="2.5" />
                  <rect x="14" y="22" width="40" height="28" rx="6" stroke="#B197FC" strokeWidth="2" fill="white" />
                  <rect x="20" y="30" width="40" height="28" rx="6" stroke="#FF6B6B" strokeWidth="2" fill="white" />
                  <line x1="28" y1="40" x2="50" y2="40" stroke="#2D3047" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
                  <line x1="28" y1="46" x2="44" y2="46" stroke="#2D3047" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
                </svg>
              </div>
              <h3>We Post the Comments</h3>
              <p>Real humans write authentic Reddit comments that naturally mention your brand in the right conversations.</p>
            </div>

            <div className="comic-panel">
              <div className="comic-panel-number">3</div>
              <div className="comic-panel-icon">
                <svg viewBox="0 0 72 72" fill="none">
                  <rect x="12" y="14" width="48" height="44" rx="8" stroke="#2EC4B6" strokeWidth="2.5" />
                  <circle cx="36" cy="30" r="8" fill="#FFD93D" opacity="0.3" stroke="#FFD93D" strokeWidth="2" />
                  <path d="M33 30l3 3 5-6" stroke="#2EC4B6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="22" y1="44" x2="50" y2="44" stroke="#2D3047" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
                  <line x1="22" y1="50" x2="42" y2="50" stroke="#2D3047" strokeWidth="1.5" strokeLinecap="round" opacity="0.2" />
                  <path d="M46 10l4-2m2 6h4m-2 6l4 2" stroke="#FF6B6B" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <h3>AI Recommends You</h3>
              <p>ChatGPT, Gemini, and Perplexity learn from those discussions and start recommending your brand.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ INTERACTIVE DEMO ═══ */}
      <section className="demo-section" id="demo">
        <div className="container">
          <span className="section-label reveal">See It In Action</span>
          <h2 className="section-title reveal">Here&apos;s What Happens</h2>
          <p className="section-sub reveal">What AI says about your category today vs. after SlopMog does its thing.</p>

          <div className="demo-wrapper reveal">
            <div className="demo-toggle">
              <button
                className={`demo-toggle-btn${activeDemo === "before" ? " active" : ""}`}
                onClick={() => handleDemoClick("before")}
              >
                Before SlopMog
              </button>
              <button
                className={`demo-toggle-btn${activeDemo === "after" ? " active" : ""}`}
                onClick={() => handleDemoClick("after")}
              >
                After SlopMog
              </button>
            </div>

            <div className="demo-cards-container">
              {/* Before */}
              <div className={`demo-card demo-card-before${activeDemo === "before" ? " active" : ""}`}>
                <div className="demo-card-header">
                  <div className="demo-card-ai-icon">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect width="18" height="18" rx="4" fill="#ddd" /><path d="M5 7h8M5 11h5" stroke="#999" strokeWidth="1.5" strokeLinecap="round" /></svg>
                  </div>
                  <div className="demo-card-header-text">
                    <strong>AI Search Result</strong>
                    Standard recommendation
                  </div>
                </div>
                <div className="demo-card-query">&ldquo;What&apos;s the best project management tool for startups?&rdquo;</div>
                <div className="demo-result">
                  <div className="demo-result-rank">1</div>
                  <div>
                    <div className="demo-result-name">CompetitorA</div>
                    <div className="demo-result-desc">Popular choice with robust features for team collaboration.</div>
                  </div>
                </div>
                <div className="demo-result">
                  <div className="demo-result-rank">2</div>
                  <div>
                    <div className="demo-result-name">CompetitorB</div>
                    <div className="demo-result-desc">Known for its clean interface and integrations.</div>
                  </div>
                </div>
                <div className="demo-result">
                  <div className="demo-result-rank">3</div>
                  <div>
                    <div className="demo-result-name">CompetitorC</div>
                    <div className="demo-result-desc">Budget-friendly option with basic project tracking.</div>
                  </div>
                </div>
                <div className="demo-result">
                  <div className="demo-result-rank">4</div>
                  <div>
                    <div className="demo-result-name" style={{ opacity: 0.5 }}>YourBrand</div>
                    <div className="demo-result-desc" style={{ opacity: 0.5 }}>Not mentioned or buried in results.</div>
                  </div>
                </div>
              </div>

              {/* After */}
              <div className={`demo-card demo-card-after${activeDemo === "after" ? " active" : ""}`}>
                <div className="demo-card-header">
                  <div className="demo-card-ai-icon">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect width="18" height="18" rx="4" fill="#2EC4B6" /><path d="M5 7h8M5 11h5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" /></svg>
                  </div>
                  <div className="demo-card-header-text">
                    <strong>AI Search Result</strong>
                    After SlopMog optimization
                  </div>
                </div>
                <div className="demo-card-query">&ldquo;What&apos;s the best project management tool for startups?&rdquo;</div>
                <div className="demo-result demo-result-you">
                  <div className="demo-result-rank">1</div>
                  <div>
                    <div className="demo-result-name">YourBrand <span className="demo-result-badge">Top Pick</span></div>
                    <div className="demo-result-desc">Highly recommended by the Reddit community for its intuitive design and excellent startup-focused features.</div>
                  </div>
                </div>
                <div className="demo-result">
                  <div className="demo-result-rank">2</div>
                  <div>
                    <div className="demo-result-name">CompetitorA</div>
                    <div className="demo-result-desc">Popular choice with robust features for team collaboration.</div>
                  </div>
                </div>
                <div className="demo-result">
                  <div className="demo-result-rank">3</div>
                  <div>
                    <div className="demo-result-name">CompetitorB</div>
                    <div className="demo-result-desc">Known for its clean interface and integrations.</div>
                  </div>
                </div>
                <div className="demo-after-summary">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="#2EC4B6" /><path d="M5 8l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Based on 47 Reddit discussions mentioning YourBrand
                </div>
              </div>
            </div>

            <div className="demo-mascot">
              <MascotBlob />
            </div>
          </div>
        </div>
      </section>

      {/* ═══ STATS ═══ */}
      <section className="stats-section">
        <div className="container">
          <div className="stats-grid reveal">
            {STATS.map((stat, i) => (
              <div className="stat-item" key={i}>
                <div className="stat-number">{statValues[i]}</div>
                <div className="stat-label">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ TESTIMONIALS ═══ */}
      <section className="testimonials-section">
        <div className="container">
          <span className="section-label reveal">What People Say</span>
          <h2 className="section-title reveal">From the Feed</h2>
          <p className="section-sub reveal">Real feedback from real clients. No stock photos, no fluff.</p>

          <div className="testimonials-feed">
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
              <div className="testimonial-post reveal" key={i}>
                <div className="testimonial-bubble">
                  <p className="testimonial-text">{t.text}</p>
                  <div className="testimonial-footer-bar">
                    <StarIcon />
                    <span>{t.upvotes} upvotes</span>
                  </div>
                </div>
                <div className="testimonial-author-row">
                  <div className="testimonial-avatar" style={{ background: t.color }}>{t.initial}</div>
                  <div className="testimonial-meta">
                    <div className="testimonial-name">{t.name}</div>
                    <div className="testimonial-time">{t.time}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PRICING ═══ */}
      <section className="pricing-section" id="pricing">
        <div className="container">
          <span className="section-label reveal">Pricing</span>
          <h2 className="section-title reveal">Pick Your Speed</h2>
          <p className="section-sub reveal">Your competitors figured this out last quarter. Time to catch up.</p>

          <div className="pricing-grid reveal">
            <div className="pricing-card">
              <div className="pricing-name">Test the Waters</div>
              <div className="pricing-price">$499<span>/mo</span></div>
              <div className="pricing-desc">Perfect for dipping your toes in</div>
              <ul className="pricing-features">
                <li><CheckIcon /> 25 comments per month</li>
                <li><CheckIcon /> 3 target keywords</li>
                <li><CheckIcon /> Monthly performance report</li>
                <li><CheckIcon /> AI recommendation tracking</li>
              </ul>
              <button className="pricing-btn pricing-btn-outline">Get Started</button>
            </div>

            <div className="pricing-card popular">
              <div className="pricing-badge">Most Popular</div>
              <div className="pricing-name">Make Waves</div>
              <div className="pricing-price">$1,499<span>/mo</span></div>
              <div className="pricing-desc">For brands that are serious about winning</div>
              <ul className="pricing-features">
                <li><CheckIcon /> 100 comments per month</li>
                <li><CheckIcon /> 10 target keywords</li>
                <li><CheckIcon /> Weekly performance reports</li>
                <li><CheckIcon /> Dedicated strategist</li>
                <li><CheckIcon /> Priority subreddit targeting</li>
              </ul>
              <button className="pricing-btn pricing-btn-filled">Get Started</button>
              <div className="pricing-mascot">
                <MascotBlob />
              </div>
            </div>

            <div className="pricing-card">
              <div className="pricing-name">Own the Ocean</div>
              <div className="pricing-price">Custom</div>
              <div className="pricing-desc">Full-service brand domination</div>
              <ul className="pricing-features">
                <li><CheckIcon /> Unlimited comments</li>
                <li><CheckIcon /> Unlimited keywords</li>
                <li><CheckIcon /> Real-time analytics dashboard</li>
                <li><CheckIcon /> Multi-platform strategy</li>
                <li><CheckIcon /> Quarterly strategy sessions</li>
              </ul>
              <button className="pricing-btn pricing-btn-outline">Talk to Us</button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className="faq-section" id="faq">
        <div className="container">
          <span className="section-label reveal">FAQ</span>
          <h2 className="section-title reveal">Questions You&apos;re Thinking</h2>
          <p className="section-sub reveal">We&apos;d wonder too.</p>

          <div className="faq-list reveal">
            {FAQ_ITEMS.map((item, i) => (
              <div className={`faq-item${openFaqIndex === i ? " open" : ""}`} key={i}>
                <button className="faq-question" onClick={() => handleFaqClick(i)}>
                  {item.q}
                  <span className="faq-icon"><PlusIcon /></span>
                </button>
                <div
                  className="faq-answer"
                  ref={(el) => { faqRefs.current[i] = el; }}
                  style={{ maxHeight: openFaqIndex === i ? `${faqRefs.current[i]?.scrollHeight ?? 200}px` : "0" }}
                >
                  <div className="faq-answer-inner">{item.a}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="cta-section" id="cta">
        <div className="container">
          <div className="cta-inner reveal">
            <div className="cta-mascot-wrap">
              <div className="cta-mascot">
                <MascotBlob />
              </div>
            </div>
            <div className="cta-text">
              <h2>The name is ridiculous. The results aren&apos;t.</h2>
              <p>Your competitors are already showing up in AI recommendations. Every day you wait is another day they&apos;re getting picked instead of you.</p>
              <a href="#pricing" className="btn-primary" onClick={(e) => { e.preventDefault(); scrollTo("pricing"); }}>Start Your Campaign</a>
              <p className="cta-reassurance">No contracts. Cancel anytime. Results within 30 days.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="footer">
        <div className="footer-inner">
          <a href="#" className="footer-logo" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            <LogoBlob />
            SlopMog
          </a>
          <ul className="footer-links">
            <li><a href="#how" onClick={(e) => { e.preventDefault(); scrollTo("how"); }}>How It Works</a></li>
            <li><a href="#pricing" onClick={(e) => { e.preventDefault(); scrollTo("pricing"); }}>Pricing</a></li>
            <li><a href="#faq" onClick={(e) => { e.preventDefault(); scrollTo("faq"); }}>FAQ</a></li>
            <li><a href="#">Privacy</a></li>
            <li><a href="#">Terms</a></li>
          </ul>
          <p className="footer-copy">&copy; 2025 SlopMog. The name is ridiculous. The results aren&apos;t.</p>
        </div>
      </footer>
    </>
  );
}
