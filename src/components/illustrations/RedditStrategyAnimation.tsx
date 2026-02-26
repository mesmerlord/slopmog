export default function RedditStrategyAnimation() {
  return (
    <svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes postFloat1 {
            0%, 100% { transform: translateY(0); opacity: 0.9; }
            50% { transform: translateY(-6px); opacity: 1; }
          }
          @keyframes postFloat2 {
            0%, 100% { transform: translateY(0); opacity: 0.9; }
            50% { transform: translateY(-8px); opacity: 1; }
          }
          @keyframes postFloat3 {
            0%, 100% { transform: translateY(0); opacity: 0.9; }
            50% { transform: translateY(-5px); opacity: 1; }
          }
          @keyframes flowDot {
            0% { offset-distance: 0%; opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { offset-distance: 100%; opacity: 0; }
          }
          @keyframes aiGlow {
            0%, 100% { opacity: 0.15; r: 38; }
            50% { opacity: 0.3; r: 42; }
          }
          @keyframes checkPop {
            0%, 60% { transform: scale(0); opacity: 0; }
            75% { transform: scale(1.3); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
          .post-1 { animation: postFloat1 3s ease-in-out infinite; }
          .post-2 { animation: postFloat2 3s ease-in-out infinite 0.5s; }
          .post-3 { animation: postFloat3 3s ease-in-out infinite 1s; }
          .flow-dot-1 { offset-path: path('M115 90 Q200 60 290 150'); animation: flowDot 2.5s ease-in-out infinite 0.3s; }
          .flow-dot-2 { offset-path: path('M115 150 Q200 130 290 150'); animation: flowDot 2.5s ease-in-out infinite 0.8s; }
          .flow-dot-3 { offset-path: path('M115 210 Q200 240 290 150'); animation: flowDot 2.5s ease-in-out infinite 1.3s; }
          .ai-glow { animation: aiGlow 2s ease-in-out infinite; }
          .check-1 { animation: checkPop 3s ease-out infinite; transform-origin: center; }
          .check-2 { animation: checkPop 3s ease-out infinite 0.5s; transform-origin: center; }
          .check-3 { animation: checkPop 3s ease-out infinite 1s; transform-origin: center; }
        ` }} />
      </defs>

      {/* Left side — Reddit posts */}
      <g className="post-1">
        <rect x="20" y="62" width="95" height="56" rx="8" fill="white" stroke="#FF6B6B" strokeWidth="1.5" />
        <circle cx="36" cy="78" r="6" fill="#FF6B6B" opacity="0.2" />
        <rect x="46" y="74" width="54" height="4" rx="2" fill="#2D3047" opacity="0.5" />
        <rect x="46" y="82" width="40" height="3" rx="1.5" fill="#2D3047" opacity="0.25" />
        <rect x="30" y="96" width="70" height="3" rx="1.5" fill="#2D3047" opacity="0.15" />
        <rect x="30" y="103" width="55" height="3" rx="1.5" fill="#2D3047" opacity="0.15" />
        <g className="check-1"><circle cx="104" cy="68" r="8" fill="#2EC4B6" /><path d="M99 68 L102 71 L109 64" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></g>
      </g>

      <g className="post-2">
        <rect x="20" y="122" width="95" height="56" rx="8" fill="white" stroke="#2EC4B6" strokeWidth="1.5" />
        <circle cx="36" cy="138" r="6" fill="#2EC4B6" opacity="0.2" />
        <rect x="46" y="134" width="50" height="4" rx="2" fill="#2D3047" opacity="0.5" />
        <rect x="46" y="142" width="38" height="3" rx="1.5" fill="#2D3047" opacity="0.25" />
        <rect x="30" y="156" width="65" height="3" rx="1.5" fill="#2D3047" opacity="0.15" />
        <rect x="30" y="163" width="48" height="3" rx="1.5" fill="#2D3047" opacity="0.15" />
        <g className="check-2"><circle cx="104" cy="128" r="8" fill="#2EC4B6" /><path d="M99 128 L102 131 L109 124" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></g>
      </g>

      <g className="post-3">
        <rect x="20" y="182" width="95" height="56" rx="8" fill="white" stroke="#B197FC" strokeWidth="1.5" />
        <circle cx="36" cy="198" r="6" fill="#B197FC" opacity="0.2" />
        <rect x="46" y="194" width="48" height="4" rx="2" fill="#2D3047" opacity="0.5" />
        <rect x="46" y="202" width="42" height="3" rx="1.5" fill="#2D3047" opacity="0.25" />
        <rect x="30" y="216" width="60" height="3" rx="1.5" fill="#2D3047" opacity="0.15" />
        <rect x="30" y="223" width="50" height="3" rx="1.5" fill="#2D3047" opacity="0.15" />
        <g className="check-3"><circle cx="104" cy="188" r="8" fill="#B197FC" /><path d="M99 188 L102 191 L109 184" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></g>
      </g>

      {/* Flow dots */}
      <circle r="4" fill="#FF6B6B" className="flow-dot-1" />
      <circle r="4" fill="#2EC4B6" className="flow-dot-2" />
      <circle r="4" fill="#B197FC" className="flow-dot-3" />

      {/* Connection lines (static, faint) */}
      <path d="M115 90 Q200 60 290 150" stroke="#FF6B6B" strokeWidth="1" opacity="0.12" fill="none" strokeDasharray="4 4" />
      <path d="M115 150 Q200 130 290 150" stroke="#2EC4B6" strokeWidth="1" opacity="0.12" fill="none" strokeDasharray="4 4" />
      <path d="M115 210 Q200 240 290 150" stroke="#B197FC" strokeWidth="1" opacity="0.12" fill="none" strokeDasharray="4 4" />

      {/* Right side — AI brain */}
      <circle cx="330" cy="150" r="38" className="ai-glow" fill="#2EC4B6" />
      <circle cx="330" cy="150" r="35" fill="white" stroke="#2EC4B6" strokeWidth="2" />

      {/* AI icon (sparkle) */}
      <path d="M330 132 L332 142 L342 144 L332 146 L330 156 L328 146 L318 144 L328 142 Z" fill="#2EC4B6" opacity="0.8" />
      <circle cx="320" cy="155" r="2" fill="#FFD93D" />
      <circle cx="340" cy="155" r="2" fill="#FFD93D" />

      {/* "Recommended" label */}
      <rect x="290" y="196" width="80" height="22" rx="11" fill="#2EC4B6" opacity="0.12" />
      <text x="330" y="211" textAnchor="middle" fontSize="9" fontWeight="700" fill="#2EC4B6" fontFamily="sans-serif">Recommended</text>

      {/* Decorative dots */}
      <circle cx="180" cy="40" r="2" fill="#FFD93D" opacity="0.4" />
      <circle cx="240" cy="260" r="2.5" fill="#FF6B6B" opacity="0.3" />
      <circle cx="360" cy="100" r="1.5" fill="#B197FC" opacity="0.4" />
    </svg>
  );
}
