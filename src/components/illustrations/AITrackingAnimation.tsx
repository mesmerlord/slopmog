export default function AITrackingAnimation() {
  return (
    <svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes radarSweep {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes blipAppear1 {
            0%, 30% { opacity: 0; transform: scale(0); }
            35% { opacity: 1; transform: scale(1.2); }
            40%, 100% { opacity: 1; transform: scale(1); }
          }
          @keyframes blipAppear2 {
            0%, 50% { opacity: 0; transform: scale(0); }
            55% { opacity: 1; transform: scale(1.2); }
            60%, 100% { opacity: 1; transform: scale(1); }
          }
          @keyframes blipAppear3 {
            0%, 70% { opacity: 0; transform: scale(0); }
            75% { opacity: 1; transform: scale(1.2); }
            80%, 100% { opacity: 1; transform: scale(1); }
          }
          @keyframes pingDot {
            0%, 100% { r: 4; opacity: 0.8; }
            50% { r: 7; opacity: 0.4; }
          }
          @keyframes labelSlide1 {
            0%, 33% { opacity: 0; transform: translateX(-10px); }
            38%, 95% { opacity: 1; transform: translateX(0); }
            100% { opacity: 0; transform: translateX(5px); }
          }
          @keyframes labelSlide2 {
            0%, 53% { opacity: 0; transform: translateX(10px); }
            58%, 95% { opacity: 1; transform: translateX(0); }
            100% { opacity: 0; transform: translateX(-5px); }
          }
          @keyframes labelSlide3 {
            0%, 73% { opacity: 0; transform: translateY(10px); }
            78%, 95% { opacity: 1; transform: translateY(0); }
            100% { opacity: 0; transform: translateY(-5px); }
          }
          @keyframes scanLine {
            0% { opacity: 0.6; }
            50% { opacity: 0.2; }
            100% { opacity: 0.6; }
          }
          @keyframes outerRingPulse {
            0%, 100% { opacity: 0.1; }
            50% { opacity: 0.2; }
          }
          .radar-sweep { animation: radarSweep 4s linear infinite; transform-origin: 200px 155px; }
          .blip-1 { animation: blipAppear1 4s ease-out infinite; transform-origin: center; }
          .blip-2 { animation: blipAppear2 4s ease-out infinite; transform-origin: center; }
          .blip-3 { animation: blipAppear3 4s ease-out infinite; transform-origin: center; }
          .ping-1 { animation: pingDot 2s ease-in-out infinite; }
          .ping-2 { animation: pingDot 2s ease-in-out infinite 0.7s; }
          .ping-3 { animation: pingDot 2s ease-in-out infinite 1.4s; }
          .label-1 { animation: labelSlide1 4s ease-out infinite; }
          .label-2 { animation: labelSlide2 4s ease-out infinite; }
          .label-3 { animation: labelSlide3 4s ease-out infinite; }
          .scan-line { animation: scanLine 2s ease-in-out infinite; }
          .outer-pulse { animation: outerRingPulse 3s ease-in-out infinite; }
        ` }} />
      </defs>

      {/* Radar background */}
      <circle cx="200" cy="155" r="115" fill="#2D3047" opacity="0.04" />
      <circle cx="200" cy="155" r="115" fill="none" stroke="#2EC4B6" strokeWidth="1" className="outer-pulse" />
      <circle cx="200" cy="155" r="85" fill="none" stroke="#2EC4B6" strokeWidth="0.5" opacity="0.15" />
      <circle cx="200" cy="155" r="55" fill="none" stroke="#2EC4B6" strokeWidth="0.5" opacity="0.2" />
      <circle cx="200" cy="155" r="25" fill="none" stroke="#2EC4B6" strokeWidth="0.5" opacity="0.25" />

      {/* Grid lines */}
      <line x1="85" y1="155" x2="315" y2="155" stroke="#2EC4B6" strokeWidth="0.3" opacity="0.15" />
      <line x1="200" y1="40" x2="200" y2="270" stroke="#2EC4B6" strokeWidth="0.3" opacity="0.15" />
      <line x1="118" y1="73" x2="282" y2="237" stroke="#2EC4B6" strokeWidth="0.3" opacity="0.08" />
      <line x1="282" y1="73" x2="118" y2="237" stroke="#2EC4B6" strokeWidth="0.3" opacity="0.08" />

      {/* Radar sweep beam */}
      <g className="radar-sweep">
        <path d="M200 155 L200 40" stroke="url(#sweepGrad)" strokeWidth="2" />
        <path d="M200 155 L200 42 A113 113 0 0 1 260 58 Z" fill="url(#sweepFill)" />
      </g>

      <linearGradient id="sweepGrad" x1="200" y1="155" x2="200" y2="40">
        <stop offset="0%" stopColor="#2EC4B6" stopOpacity="0.8" />
        <stop offset="100%" stopColor="#2EC4B6" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="sweepFill" x1="200" y1="155" x2="230" y2="50">
        <stop offset="0%" stopColor="#2EC4B6" stopOpacity="0.15" />
        <stop offset="100%" stopColor="#2EC4B6" stopOpacity="0" />
      </linearGradient>

      {/* Center dot */}
      <circle cx="200" cy="155" r="3" fill="#2EC4B6" />

      {/* Blip 1 — ChatGPT (top-left) */}
      <g className="blip-1">
        <circle cx="145" cy="100" className="ping-1" fill="#FF6B6B" />
      </g>
      <g className="label-1">
        <rect x="90" y="72" width="72" height="20" rx="10" fill="#FF6B6B" />
        <text x="126" y="86" textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff" fontFamily="sans-serif">ChatGPT</text>
      </g>

      {/* Blip 2 — Gemini (right) */}
      <g className="blip-2">
        <circle cx="275" cy="130" className="ping-2" fill="#2EC4B6" />
      </g>
      <g className="label-2">
        <rect x="252" y="107" width="60" height="20" rx="10" fill="#2EC4B6" />
        <text x="282" y="121" textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff" fontFamily="sans-serif">Gemini</text>
      </g>

      {/* Blip 3 — Perplexity (bottom) */}
      <g className="blip-3">
        <circle cx="175" cy="215" className="ping-3" fill="#B197FC" />
      </g>
      <g className="label-3">
        <rect x="128" y="226" width="75" height="20" rx="10" fill="#B197FC" />
        <text x="165" y="240" textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff" fontFamily="sans-serif">Perplexity</text>
      </g>

      {/* Static ambient dots */}
      <circle cx="250" cy="195" r="2" fill="#2EC4B6" opacity="0.2" />
      <circle cx="130" cy="170" r="2" fill="#2EC4B6" opacity="0.15" />
      <circle cx="220" cy="90" r="1.5" fill="#2EC4B6" opacity="0.2" />
      <circle cx="160" cy="200" r="1.5" fill="#2EC4B6" opacity="0.15" />

      {/* Scan line */}
      <line x1="85" y1="155" x2="315" y2="155" stroke="#2EC4B6" strokeWidth="0.5" className="scan-line" />
    </svg>
  );
}
