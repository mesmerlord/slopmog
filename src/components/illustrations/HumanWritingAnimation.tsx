export default function HumanWritingAnimation() {
  return (
    <svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes penWrite {
            0% { transform: translate(0, 0) rotate(-30deg); }
            20% { transform: translate(8px, 2px) rotate(-28deg); }
            40% { transform: translate(16px, -1px) rotate(-32deg); }
            60% { transform: translate(24px, 2px) rotate(-28deg); }
            80% { transform: translate(32px, 0) rotate(-30deg); }
            100% { transform: translate(0, 0) rotate(-30deg); }
          }
          @keyframes textReveal {
            0% { stroke-dashoffset: 200; }
            100% { stroke-dashoffset: 0; }
          }
          @keyframes bubble1Pop {
            0%, 40% { transform: scale(0); opacity: 0; }
            50% { transform: scale(1.15); opacity: 1; }
            60%, 100% { transform: scale(1); opacity: 1; }
          }
          @keyframes bubble2Pop {
            0%, 55% { transform: scale(0); opacity: 0; }
            65% { transform: scale(1.15); opacity: 1; }
            75%, 100% { transform: scale(1); opacity: 1; }
          }
          @keyframes bubble3Pop {
            0%, 70% { transform: scale(0); opacity: 0; }
            80% { transform: scale(1.1); opacity: 1; }
            90%, 100% { transform: scale(1); opacity: 1; }
          }
          @keyframes cursorBlink {
            0%, 49% { opacity: 1; }
            50%, 100% { opacity: 0; }
          }
          @keyframes lineGrow1 {
            0%, 10% { width: 0; }
            30%, 100% { width: 110px; }
          }
          @keyframes lineGrow2 {
            0%, 25% { width: 0; }
            45%, 100% { width: 90px; }
          }
          @keyframes lineGrow3 {
            0%, 40% { width: 0; }
            60%, 100% { width: 70px; }
          }
          @keyframes checkAppear {
            0%, 85% { transform: scale(0) rotate(-45deg); opacity: 0; }
            95% { transform: scale(1.2) rotate(5deg); opacity: 1; }
            100% { transform: scale(1) rotate(0deg); opacity: 1; }
          }
          @keyframes heartFloat {
            0% { transform: translateY(0) scale(1); opacity: 0.7; }
            50% { transform: translateY(-8px) scale(1.1); opacity: 1; }
            100% { transform: translateY(0) scale(1); opacity: 0.7; }
          }
          @keyframes dotBounce1 {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-3px); }
          }
          @keyframes dotBounce2 {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-3px); }
          }
          @keyframes dotBounce3 {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-3px); }
          }
          .pen-write { animation: penWrite 3s ease-in-out infinite; transform-origin: 155px 195px; }
          .bubble-1 { animation: bubble1Pop 5s ease-out infinite; transform-origin: 85px 75px; }
          .bubble-2 { animation: bubble2Pop 5s ease-out infinite; transform-origin: 285px 55px; }
          .bubble-3 { animation: bubble3Pop 5s ease-out infinite; transform-origin: 320px 140px; }
          .cursor-blink { animation: cursorBlink 0.8s step-end infinite; }
          .line-grow-1 { animation: lineGrow1 5s ease-out infinite; }
          .line-grow-2 { animation: lineGrow2 5s ease-out infinite; }
          .line-grow-3 { animation: lineGrow3 5s ease-out infinite; }
          .check-appear { animation: checkAppear 5s ease-out infinite; transform-origin: center; }
          .heart-float { animation: heartFloat 2.5s ease-in-out infinite; }
          .dot-1 { animation: dotBounce1 1.2s ease-in-out infinite; }
          .dot-2 { animation: dotBounce2 1.2s ease-in-out infinite 0.2s; }
          .dot-3 { animation: dotBounce3 1.2s ease-in-out infinite 0.4s; }
        ` }} />
      </defs>

      {/* Comment card background */}
      <rect x="60" y="100" width="220" height="150" rx="16" fill="#fff" stroke="#2D3047" strokeWidth="1" opacity="0.08" />
      <rect x="60" y="100" width="220" height="150" rx="16" fill="#fff" />
      <rect x="60" y="100" width="220" height="150" rx="16" fill="none" stroke="#2EC4B6" strokeWidth="1.5" opacity="0.2" />

      {/* Card header — avatar + name */}
      <circle cx="88" cy="126" r="14" fill="#2EC4B6" opacity="0.15" />
      <circle cx="88" cy="126" r="10" fill="#2EC4B6" opacity="0.3" />
      <text x="88" y="130" textAnchor="middle" fontSize="10" fontWeight="700" fill="#2EC4B6" fontFamily="sans-serif">R</text>
      <text x="108" y="124" fontSize="10" fontWeight="700" fill="#2D3047" fontFamily="sans-serif">u/redditor_42</text>
      <text x="108" y="136" fontSize="7" fontWeight="500" fill="#2D3047" opacity="0.4" fontFamily="sans-serif">3 min ago</text>

      {/* Typing lines — grow in */}
      <rect x="78" y="155" height="4" rx="2" fill="#2D3047" opacity="0.12" className="line-grow-1" />
      <rect x="78" y="167" height="4" rx="2" fill="#2D3047" opacity="0.09" className="line-grow-2" />
      <rect x="78" y="179" height="4" rx="2" fill="#2D3047" opacity="0.06" className="line-grow-3" />

      {/* Blinking cursor */}
      <rect x="150" y="178" width="2" height="8" rx="1" fill="#FF6B6B" className="cursor-blink" />

      {/* Upvote section at card bottom */}
      <g>
        <path d="M78 210 L84 202 L90 210" stroke="#2EC4B6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <text x="97" y="211" fontSize="10" fontWeight="700" fill="#2EC4B6" fontFamily="sans-serif">47</text>
      </g>

      {/* Pen / pencil */}
      <g className="pen-write">
        <rect x="145" y="188" width="40" height="8" rx="3" fill="#FF6B6B" transform="rotate(-30 155 195)" />
        <polygon points="140,202 143,193 148,198" fill="#FFD93D" />
        <rect x="176" y="183" width="12" height="8" rx="2" fill="#E55A5A" transform="rotate(-30 182 187)" />
      </g>

      {/* Floating chat bubble 1 — top left */}
      <g className="bubble-1">
        <rect x="40" y="45" width="90" height="44" rx="12" fill="#2EC4B6" />
        <polygon points="75,89 85,89 70,100" fill="#2EC4B6" />
        <text x="85" y="64" textAnchor="middle" fontSize="8" fontWeight="600" fill="#fff" fontFamily="sans-serif">Honestly this</text>
        <text x="85" y="76" textAnchor="middle" fontSize="8" fontWeight="600" fill="#fff" fontFamily="sans-serif">tool is solid</text>
      </g>

      {/* Floating chat bubble 2 — top right */}
      <g className="bubble-2">
        <rect x="240" y="30" width="100" height="44" rx="12" fill="#B197FC" />
        <polygon points="310,74 320,74 325,85" fill="#B197FC" />
        <text x="290" y="49" textAnchor="middle" fontSize="8" fontWeight="600" fill="#fff" fontFamily="sans-serif">Switched from</text>
        <text x="290" y="61" textAnchor="middle" fontSize="8" fontWeight="600" fill="#fff" fontFamily="sans-serif">X, much better</text>
      </g>

      {/* Floating chat bubble 3 — right side */}
      <g className="bubble-3">
        <rect x="280" y="115" width="80" height="36" rx="12" fill="#FFD93D" />
        <polygon points="290,151 280,151 278,162" fill="#FFD93D" />
        <text x="320" y="131" textAnchor="middle" fontSize="7" fontWeight="700" fill="#2D3047" fontFamily="sans-serif">Have you tried</text>
        <text x="320" y="142" textAnchor="middle" fontSize="7" fontWeight="700" fill="#2D3047" fontFamily="sans-serif">[brand]?</text>
      </g>

      {/* Typing indicator dots */}
      <g>
        <circle cx="300" cy="180" r="2.5" fill="#2D3047" opacity="0.2" className="dot-1" />
        <circle cx="308" cy="180" r="2.5" fill="#2D3047" opacity="0.2" className="dot-2" />
        <circle cx="316" cy="180" r="2.5" fill="#2D3047" opacity="0.2" className="dot-3" />
      </g>

      {/* Approval check mark */}
      <g className="check-appear">
        <circle cx="255" cy="230" r="16" fill="#2EC4B6" />
        <path d="M247 230 L253 236 L264 224" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>

      {/* "Human Approved" label */}
      <g className="check-appear">
        <text x="255" y="258" textAnchor="middle" fontSize="8" fontWeight="700" fill="#2EC4B6" fontFamily="sans-serif">Human Approved</text>
      </g>

      {/* Heart float */}
      <g className="heart-float">
        <path d="M50 260 C50 255 55 250 60 255 C65 250 70 255 70 260 C70 268 60 275 60 275 C60 275 50 268 50 260Z" fill="#FF6B6B" opacity="0.5" />
      </g>

      {/* Ambient decorative dots */}
      <circle cx="35" cy="130" r="2" fill="#B197FC" opacity="0.15" />
      <circle cx="370" cy="95" r="2" fill="#2EC4B6" opacity="0.15" />
      <circle cx="350" cy="210" r="1.5" fill="#FF6B6B" opacity="0.2" />
      <circle cx="45" cy="200" r="1.5" fill="#FFD93D" opacity="0.2" />
    </svg>
  );
}
