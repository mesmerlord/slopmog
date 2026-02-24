export default function PricingAnimation() {
  return (
    <svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes coinStack1 {
            0%, 100% { transform: translateY(0); opacity: 1; }
            50% { transform: translateY(-8px); opacity: 0.85; }
          }
          @keyframes coinStack2 {
            0%, 100% { transform: translateY(0); opacity: 1; }
            50% { transform: translateY(-6px); opacity: 0.9; }
          }
          @keyframes coinStack3 {
            0%, 100% { transform: translateY(0); opacity: 1; }
            50% { transform: translateY(-10px); opacity: 0.8; }
          }
          @keyframes badgePulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.12); }
          }
          @keyframes badgeGlow {
            0%, 100% { filter: drop-shadow(0 0 6px rgba(46,196,182,0.3)); }
            50% { filter: drop-shadow(0 0 18px rgba(46,196,182,0.6)); }
          }
          @keyframes dollarFloat1 {
            0% { transform: translate(0, 0) rotate(0deg); opacity: 0; }
            15% { opacity: 1; }
            85% { opacity: 1; }
            100% { transform: translate(15px, -70px) rotate(20deg); opacity: 0; }
          }
          @keyframes dollarFloat2 {
            0% { transform: translate(0, 0) rotate(0deg); opacity: 0; }
            15% { opacity: 0.8; }
            85% { opacity: 0.8; }
            100% { transform: translate(-20px, -80px) rotate(-15deg); opacity: 0; }
          }
          @keyframes dollarFloat3 {
            0% { transform: translate(0, 0) rotate(0deg); opacity: 0; }
            15% { opacity: 0.7; }
            85% { opacity: 0.7; }
            100% { transform: translate(25px, -60px) rotate(25deg); opacity: 0; }
          }
          @keyframes sparkle {
            0%, 100% { opacity: 0; transform: scale(0.5) rotate(0deg); }
            50% { opacity: 1; transform: scale(1) rotate(180deg); }
          }
          @keyframes arrowBounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-5px); }
          }
          .coin-stack-1 { animation: coinStack1 3s ease-in-out infinite; }
          .coin-stack-2 { animation: coinStack2 3s ease-in-out infinite 0.3s; }
          .coin-stack-3 { animation: coinStack3 3s ease-in-out infinite 0.6s; }
          .badge-pulse { animation: badgePulse 2s ease-in-out infinite; transform-origin: center; }
          .badge-glow { animation: badgeGlow 2s ease-in-out infinite; }
          .dollar-1 { animation: dollarFloat1 2.8s ease-out infinite; }
          .dollar-2 { animation: dollarFloat2 3.2s ease-out infinite 0.8s; }
          .dollar-3 { animation: dollarFloat3 2.5s ease-out infinite 1.5s; }
          .sparkle-1 { animation: sparkle 2s ease-in-out infinite 0.2s; }
          .sparkle-2 { animation: sparkle 2s ease-in-out infinite 1s; }
          .sparkle-3 { animation: sparkle 2s ease-in-out infinite 1.6s; }
          .arrow-bounce { animation: arrowBounce 1.5s ease-in-out infinite; }
        ` }} />
      </defs>

      {/* Background subtle grid */}
      <pattern id="priceDots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
        <circle cx="10" cy="10" r="0.8" fill="#2D3047" opacity="0.06" />
      </pattern>
      <rect width="400" height="300" fill="url(#priceDots)" />

      {/* Left coin stack — small (competitor) */}
      <g className="coin-stack-1" opacity="0.5">
        <ellipse cx="110" cy="210" rx="32" ry="10" fill="#2D3047" opacity="0.08" />
        {[0, 1, 2].map((i) => (
          <g key={`left-${i}`}>
            <ellipse cx="110" cy={200 - i * 16} rx="28" ry="9" fill={i === 2 ? "#e0e0e0" : "#d0d0d0"} />
            <rect x="82" y={192 - i * 16} width="56" height="8" fill="#c8c8c8" />
            <ellipse cx="110" cy={192 - i * 16} rx="28" ry="9" fill={i === 2 ? "#d8d8d8" : "#c8c8c8"} />
            <text x="110" y={196 - i * 16} textAnchor="middle" fontSize="8" fontWeight="700" fill="#999">$</text>
          </g>
        ))}
        <text x="110" y="236" textAnchor="middle" fontSize="11" fontWeight="600" fill="#2D3047" opacity="0.5" fontFamily="sans-serif">~10</text>
      </g>

      {/* Arrow */}
      <g className="arrow-bounce">
        <path d="M165 185 L195 185" stroke="#2EC4B6" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 3" />
        <path d="M190 180 L198 185 L190 190" stroke="#2EC4B6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>

      {/* Right coin stack — tall (SlopMog) */}
      <g className="coin-stack-2">
        <ellipse cx="270" cy="220" rx="36" ry="11" fill="#2D3047" opacity="0.1" />
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => {
          const isHighlight = i >= 7;
          return (
            <g key={`right-${i}`}>
              <ellipse cx="270" cy={210 - i * 14} rx="32" ry="10" fill={isHighlight ? "#FFD93D" : "#2EC4B6"} />
              <rect x="238" y={201 - i * 14} width="64" height="9" fill={isHighlight ? "#E8C225" : "#25a89c"} />
              <ellipse cx="270" cy={201 - i * 14} rx="32" ry="10" fill={isHighlight ? "#FFD93D" : "#2EC4B6"} />
              <text x="270" y={205 - i * 14} textAnchor="middle" fontSize="9" fontWeight="700" fill={isHighlight ? "#2D3047" : "#fff"} fontFamily="sans-serif">$</text>
            </g>
          );
        })}
        <text x="270" y="246" textAnchor="middle" fontSize="11" fontWeight="700" fill="#2D3047" fontFamily="sans-serif">40</text>
      </g>

      {/* Floating dollars */}
      <g className="dollar-1">
        <text x="310" y="140" fontSize="18" fontWeight="700" fill="#2EC4B6" opacity="0.6" fontFamily="sans-serif">$</text>
      </g>
      <g className="dollar-2">
        <text x="240" y="100" fontSize="14" fontWeight="700" fill="#FFD93D" opacity="0.5" fontFamily="sans-serif">$</text>
      </g>
      <g className="dollar-3">
        <text x="295" y="110" fontSize="16" fontWeight="700" fill="#2EC4B6" opacity="0.4" fontFamily="sans-serif">$</text>
      </g>

      {/* 4x Badge */}
      <g className="badge-pulse badge-glow">
        <circle cx="340" cy="70" r="30" fill="#2EC4B6" />
        <circle cx="340" cy="70" r="26" fill="none" stroke="#fff" strokeWidth="1.5" strokeDasharray="3 2" />
        <text x="340" y="65" textAnchor="middle" fontSize="20" fontWeight="800" fill="#fff" fontFamily="sans-serif">4x</text>
        <text x="340" y="80" textAnchor="middle" fontSize="8" fontWeight="600" fill="#fff" opacity="0.85" fontFamily="sans-serif">MORE</text>
      </g>

      {/* Sparkles */}
      <g className="sparkle-1">
        <path d="M320 120 L323 126 L329 129 L323 132 L320 138 L317 132 L311 129 L317 126Z" fill="#FFD93D" />
      </g>
      <g className="sparkle-2">
        <path d="M230 55 L232 59 L236 61 L232 63 L230 67 L228 63 L224 61 L228 59Z" fill="#FF6B6B" />
      </g>
      <g className="sparkle-3">
        <path d="M355 130 L357 134 L361 136 L357 138 L355 142 L353 138 L349 136 L353 134Z" fill="#B197FC" />
      </g>

      {/* Labels */}
      <text x="110" y="260" textAnchor="middle" fontSize="10" fontWeight="700" fill="#2D3047" opacity="0.4" fontFamily="sans-serif">Them</text>
      <text x="270" y="268" textAnchor="middle" fontSize="10" fontWeight="700" fill="#2EC4B6" fontFamily="sans-serif">SlopMog</text>
    </svg>
  );
}
