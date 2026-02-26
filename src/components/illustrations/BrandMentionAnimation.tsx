export default function BrandMentionAnimation() {
  return (
    <svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes typeReveal {
            0% { width: 0; }
            60% { width: 240px; }
            100% { width: 240px; }
          }
          @keyframes cursorBlink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
          }
          @keyframes personaBadgePop1 {
            0%, 20% { transform: scale(0); opacity: 0; }
            30% { transform: scale(1.15); opacity: 1; }
            40%, 100% { transform: scale(1); opacity: 1; }
          }
          @keyframes personaBadgePop2 {
            0%, 35% { transform: scale(0); opacity: 0; }
            45% { transform: scale(1.15); opacity: 1; }
            55%, 100% { transform: scale(1); opacity: 1; }
          }
          @keyframes personaBadgePop3 {
            0%, 50% { transform: scale(0); opacity: 0; }
            60% { transform: scale(1.15); opacity: 1; }
            70%, 100% { transform: scale(1); opacity: 1; }
          }
          @keyframes brandHighlight {
            0%, 55% { opacity: 0; }
            65% { opacity: 1; }
            100% { opacity: 1; }
          }
          @keyframes scoreFill {
            0%, 65% { width: 0; }
            100% { width: 72px; }
          }
          @keyframes starAppear {
            0%, 70% { opacity: 0; transform: scale(0); }
            80% { opacity: 1; transform: scale(1.2); }
            90%, 100% { opacity: 1; transform: scale(1); }
          }
          .type-line { animation: typeReveal 4s ease-out infinite; overflow: hidden; }
          .cursor { animation: cursorBlink 0.8s step-end infinite; }
          .badge-1 { animation: personaBadgePop1 4s ease-out infinite; transform-origin: center; }
          .badge-2 { animation: personaBadgePop2 4s ease-out infinite; transform-origin: center; }
          .badge-3 { animation: personaBadgePop3 4s ease-out infinite; transform-origin: center; }
          .brand-hl { animation: brandHighlight 4s ease-out infinite; }
          .score-bar { animation: scoreFill 4s ease-out infinite; }
          .star-pop { animation: starAppear 4s ease-out infinite; transform-origin: center; }
        ` }} />
      </defs>

      {/* Comment card background */}
      <rect x="30" y="30" width="340" height="200" rx="12" fill="white" stroke="#2D3047" strokeWidth="1" opacity="0.08" />
      <rect x="30" y="30" width="340" height="200" rx="12" fill="white" />
      <rect x="30" y="30" width="340" height="200" rx="12" fill="none" stroke="#2EC4B6" strokeWidth="1.5" opacity="0.3" />

      {/* User avatar */}
      <circle cx="58" cy="58" r="14" fill="#2EC4B6" opacity="0.15" />
      <circle cx="58" cy="54" r="5" fill="#2EC4B6" opacity="0.5" />
      <path d="M48 67 Q58 62 68 67" stroke="#2EC4B6" strokeWidth="2" opacity="0.4" fill="none" />

      {/* Username + timestamp */}
      <rect x="80" y="49" width="60" height="5" rx="2.5" fill="#2EC4B6" opacity="0.4" />
      <rect x="146" y="50" width="30" height="3" rx="1.5" fill="#2D3047" opacity="0.12" />

      {/* Comment text lines */}
      <rect x="50" y="82" width="220" height="4" rx="2" fill="#2D3047" opacity="0.25" />
      <rect x="50" y="92" width="195" height="4" rx="2" fill="#2D3047" opacity="0.2" />

      {/* Brand mention highlight */}
      <g className="brand-hl">
        <rect x="50" y="106" width="48" height="5" rx="2.5" fill="#FF6B6B" opacity="0.15" />
        <rect x="50" y="106" width="48" height="5" rx="2.5" fill="none" stroke="#FF6B6B" strokeWidth="0.5" opacity="0.4" />
      </g>
      <rect x="102" y="107" width="160" height="4" rx="2" fill="#2D3047" opacity="0.2" />
      <rect x="50" y="118" width="180" height="4" rx="2" fill="#2D3047" opacity="0.15" />

      {/* Upvote indicator */}
      <path d="M50 140 L55 134 L60 140" stroke="#2EC4B6" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <text x="55" y="152" textAnchor="middle" fontSize="9" fontWeight="700" fill="#2EC4B6" fontFamily="sans-serif">42</text>
      <path d="M50 158 L55 164 L60 158" stroke="#2D3047" strokeWidth="1" strokeLinecap="round" opacity="0.2" fill="none" />

      {/* Reply icon */}
      <path d="M80 150 L88 145 L88 149 L96 149 L96 155 L88 155 L88 159 Z" fill="#2D3047" opacity="0.12" />

      {/* Persona badges on right */}
      <g className="badge-1">
        <rect x="280" y="82" width="72" height="22" rx="11" fill="#B197FC" opacity="0.15" />
        <text x="316" y="97" textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#B197FC" fontFamily="sans-serif">Chill</text>
      </g>
      <g className="badge-2">
        <rect x="280" y="110" width="72" height="22" rx="11" fill="#2EC4B6" opacity="0.15" />
        <text x="316" y="125" textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#2EC4B6" fontFamily="sans-serif">Helpful</text>
      </g>
      <g className="badge-3">
        <rect x="280" y="138" width="72" height="22" rx="11" fill="#FF6B6B" opacity="0.15" />
        <text x="316" y="153" textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#FF6B6B" fontFamily="sans-serif">Skeptic</text>
      </g>

      {/* Quality score bar */}
      <rect x="50" y="185" width="90" height="6" rx="3" fill="#2D3047" opacity="0.06" />
      <rect x="50" y="185" className="score-bar" height="6" rx="3" fill="#2EC4B6" opacity="0.5" />
      <text x="148" y="191" fontSize="8" fontWeight="700" fill="#2EC4B6" fontFamily="sans-serif">Quality: 0.85</text>

      {/* Star rating */}
      <g className="star-pop">
        <path d="M310 186 L313 182 L316 186 L321 187 L317 191 L318 196 L313 193 L308 196 L309 191 L305 187 Z" fill="#FFD93D" />
      </g>

      {/* Decorative sparkles */}
      <circle cx="380" cy="40" r="2" fill="#FFD93D" opacity="0.4" />
      <circle cx="20" cy="260" r="2.5" fill="#B197FC" opacity="0.3" />
      <circle cx="350" cy="270" r="1.5" fill="#FF6B6B" opacity="0.35" />

      {/* Bottom tagline */}
      <text x="200" y="268" textAnchor="middle" fontSize="10" fontWeight="600" fill="#2D3047" opacity="0.25" fontFamily="sans-serif">Natural. Authentic. On-brand.</text>
    </svg>
  );
}
