export default function AuthIllustration() {
  // Fixed positions for floating particles to avoid hydration mismatch
  const particles = [
    { top: "15%", left: "12%", size: 8, delay: "0s" },
    { top: "35%", left: "85%", size: 4, delay: "1.2s" },
    { top: "55%", left: "25%", size: 6, delay: "2.5s" },
    { top: "75%", left: "70%", size: 8, delay: "0.8s" },
    { top: "25%", left: "60%", size: 4, delay: "3.2s" },
    { top: "85%", left: "45%", size: 6, delay: "1.8s" },
  ];

  return (
    <div className="relative w-full h-full overflow-hidden bg-gradient-to-br from-teal-bg via-bg to-lavender/5">
      <style jsx>{`
        @keyframes auth-float-slow {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(2deg); }
        }
        @keyframes auth-float-med {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(-2deg); }
        }
        @keyframes auth-float-fast {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes auth-glow {
          0%, 100% { box-shadow: 0 0 15px rgba(46, 196, 182, 0.2); }
          50% { box-shadow: 0 0 30px rgba(46, 196, 182, 0.45); }
        }
        @keyframes auth-drift {
          0% { transform: translateX(-10%) translateY(0); opacity: 0; }
          10% { opacity: 0.6; }
          90% { opacity: 0.6; }
          100% { transform: translateX(120%) translateY(-20px); opacity: 0; }
        }
        @keyframes auth-particle {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.5; }
          50% { transform: translateY(-12px) scale(1.2); opacity: 0.8; }
        }
        .af-slow { animation: auth-float-slow 8s ease-in-out infinite; }
        .af-med { animation: auth-float-med 6s ease-in-out infinite; }
        .af-fast { animation: auth-float-fast 4s ease-in-out infinite; }
        .ag { animation: auth-glow 3s infinite; }
        .ad { animation: auth-drift 6s linear infinite; }
        .ap { animation: auth-particle 4s ease-in-out infinite; }
        .glass {
          background: rgba(255, 255, 255, 0.72);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.8);
        }
      `}</style>

      {/* Blurred background shapes */}
      <div className="absolute -top-20 -right-20 w-96 h-96 bg-teal/10 rounded-full blur-3xl af-slow" />
      <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-coral/10 rounded-full blur-3xl af-slow" style={{ animationDelay: "2s" }} />
      <div className="absolute top-[40%] left-[20%] w-64 h-64 bg-sunny/10 rounded-full blur-3xl af-med" style={{ animationDelay: "1s" }} />

      {/* Flowing dashed path */}
      <svg className="absolute inset-0 w-full h-full opacity-15 pointer-events-none">
        <path
          d="M 40 120 Q 180 60 280 180 T 520 220"
          fill="none"
          stroke="#2EC4B6"
          strokeWidth="2"
          strokeDasharray="10 10"
        >
          <animate attributeName="stroke-dashoffset" from="0" to="-40" dur="3s" repeatCount="indefinite" />
        </path>
        <path
          d="M 80 350 Q 200 280 350 340 T 500 300"
          fill="none"
          stroke="#B197FC"
          strokeWidth="1.5"
          strokeDasharray="8 8"
        >
          <animate attributeName="stroke-dashoffset" from="0" to="-32" dur="4s" repeatCount="indefinite" />
        </path>
      </svg>

      <div className="relative w-full h-full flex flex-col items-center justify-center p-8">
        {/* Reddit comment card — top left */}
        <div className="absolute top-[12%] left-[6%] max-w-[220px] af-med" style={{ zIndex: 10 }}>
          <div className="glass p-4 rounded-2xl shadow-lg -rotate-6 border-l-4 border-coral">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 bg-coral rounded-full flex items-center justify-center text-white text-[0.65rem] font-bold">r/</div>
              <span className="text-[0.7rem] text-charcoal font-bold opacity-70">u/GrowthHacker</span>
            </div>
            <p className="text-[0.82rem] text-charcoal leading-snug">
              Has anyone tried <span className="font-bold text-teal">YourBrand</span>? It basically automated my entire workflow.
            </p>
            <div className="flex items-center gap-1.5 mt-3 text-coral">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4 L4 14 L9 14 L9 20 L15 20 L15 14 L20 14 Z" /></svg>
              <span className="text-[0.7rem] font-bold">4.2k</span>
            </div>
          </div>
        </div>

        {/* Mini comment — top right */}
        <div className="absolute top-[28%] right-[10%] max-w-[190px] af-slow" style={{ animationDelay: "1.5s", zIndex: 5 }}>
          <div className="glass p-3 rounded-2xl shadow-md rotate-3">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-7 h-7 rounded-full bg-lavender/30" />
              <div className="space-y-1">
                <div className="h-1.5 w-14 bg-charcoal/20 rounded" />
                <div className="h-1.5 w-20 bg-charcoal/10 rounded" />
              </div>
            </div>
            <p className="text-[0.75rem] text-charcoal/80">
              The results are insane 🚀
            </p>
          </div>
        </div>

        {/* Center mascot orb */}
        <div className="relative z-20 af-slow">
          <div className="relative">
            <div className="absolute inset-0 bg-teal/20 blur-2xl rounded-full ag" />
            <div className="w-28 h-28 bg-white rounded-[1.8rem] shadow-2xl flex items-center justify-center relative border-4 border-bg">
              <div className="absolute inset-0 rounded-[1.5rem] border-2 border-teal/30" />
              {/* Mini mascot face */}
              <div className="w-18 h-18 bg-coral rounded-full relative w-[72px] h-[72px] flex items-center justify-center"
                style={{ borderRadius: "52% 48% 46% 54% / 55% 45% 55% 45%" }}>
                <div className="absolute top-[28%] left-1/2 -translate-x-1/2 flex gap-3">
                  <div className="w-3 h-3.5 bg-white rounded-full relative">
                    <div className="w-1.5 h-1.5 bg-charcoal rounded-full absolute top-1 left-1/2 -translate-x-1/2" />
                  </div>
                  <div className="w-3 h-3.5 bg-white rounded-full relative">
                    <div className="w-1.5 h-1.5 bg-charcoal rounded-full absolute top-1 left-1/2 -translate-x-1/2" />
                  </div>
                </div>
                <div className="absolute top-[60%] left-1/2 -translate-x-1/2 w-4 h-2 border-b-2 border-charcoal rounded-b-full" />
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-[2px] h-4 bg-coral-dark rounded">
                  <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-sunny rounded-full" />
                </div>
              </div>

              {/* Sparkles */}
              <div className="absolute -top-3 -right-3 text-sunny animate-bounce" style={{ animationDuration: "2s" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" /></svg>
              </div>
              <div className="absolute -bottom-2 -left-4 text-lavender animate-bounce" style={{ animationDuration: "2.5s", animationDelay: "0.5s" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" /></svg>
              </div>
            </div>
          </div>
        </div>

        {/* AI recommendation card — bottom right */}
        <div className="absolute bottom-[18%] right-[6%] max-w-[230px] af-med" style={{ animationDelay: "0.5s", zIndex: 10 }}>
          <div className="glass p-4 rounded-xl shadow-xl border-t-4 border-teal rotate-2">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded bg-gradient-to-tr from-teal to-lavender" />
              <span className="text-[0.72rem] font-bold text-charcoal">AI Search Result</span>
            </div>
            <div className="bg-white/50 rounded p-2 mb-2">
              <div className="h-1.5 w-3/4 bg-charcoal/15 rounded mb-1" />
              <div className="h-1.5 w-1/2 bg-charcoal/10 rounded" />
            </div>
            <div className="bg-teal-bg border border-teal/30 rounded p-2 flex items-start gap-2">
              <div className="mt-0.5 w-2 h-2 rounded-full bg-teal shrink-0" />
              <div>
                <div className="text-[0.72rem] font-bold text-charcoal">1. YourBrand — Top Pick</div>
                <div className="text-[0.65rem] text-charcoal-light">Highly recommended by the Reddit community for...</div>
              </div>
            </div>
          </div>
        </div>

        {/* Star rating pill — bottom left */}
        <div className="absolute bottom-[10%] left-[12%] af-slow" style={{ animationDelay: "2.5s", zIndex: 5 }}>
          <div className="glass px-4 py-2 rounded-full shadow-md flex items-center gap-2 -rotate-3">
            <span className="text-sunny text-sm">★★★★★</span>
            <span className="text-[0.72rem] font-bold text-charcoal">Top Result</span>
          </div>
        </div>

        {/* Floating teal particles */}
        {particles.map((p, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-teal/50 ap"
            style={{
              top: p.top,
              left: p.left,
              width: p.size,
              height: p.size,
              animationDelay: p.delay,
            }}
          />
        ))}

        {/* Drifting upvote arrows */}
        <div className="absolute top-[58%] left-[38%] text-coral ad" style={{ animationDelay: "0s" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4 L4 14 L9 14 L9 20 L15 20 L15 14 L20 14 Z" /></svg>
        </div>
        <div className="absolute top-[48%] left-[28%] text-coral/70 ad" style={{ animationDelay: "2.5s", animationDuration: "7s" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4 L4 14 L9 14 L9 20 L15 20 L15 14 L20 14 Z" /></svg>
        </div>
      </div>

      {/* Brand tagline */}
      <p className="absolute bottom-8 left-0 right-0 text-center text-charcoal-light/50 text-[0.82rem] font-medium">
        The name is ridiculous. The results aren&apos;t.
      </p>
    </div>
  );
}
