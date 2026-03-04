import React from "react";

export default function UpgradeUpsellMascot({ className = "", style = {} }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 300 200"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ width: "100%", height: "100%", ...style }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        .upsell-bounce { animation: upsellBounce 2s ease-in-out infinite; transform-origin: 150px 100px; }
        .upsell-wave { animation: upsellWave 1.2s ease-in-out infinite; transform-origin: 195px 85px; }
        .upsell-blink { animation: upsellBlink 4s infinite; transform-origin: 150px 78px; }
        .upsell-lid { animation: upsellLid 2.5s ease-in-out infinite; transform-origin: 150px 130px; }
        .upsell-sparkle { opacity: 0; }
        .upsell-s1 { animation: upsellFloat 1.8s ease-out infinite 0s; }
        .upsell-s2 { animation: upsellFloat 1.6s ease-out infinite 0.4s; }
        .upsell-s3 { animation: upsellFloat 2s ease-out infinite 0.8s; }
        .upsell-s4 { animation: upsellFloat 1.7s ease-out infinite 1.2s; }
        .upsell-s5 { animation: upsellFloat 1.9s ease-out infinite 0.6s; }

        @keyframes upsellBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes upsellWave {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-20deg); }
          75% { transform: rotate(15deg); }
        }
        @keyframes upsellBlink {
          0%, 44%, 48%, 100% { transform: scaleY(1); }
          46% { transform: scaleY(0.1); }
        }
        @keyframes upsellLid {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(-3deg); }
        }
        @keyframes upsellFloat {
          0% { transform: translateY(0) scale(0.3); opacity: 0; }
          15% { opacity: 1; transform: translateY(-8px) scale(1); }
          70% { opacity: 0.7; transform: translateY(-40px) scale(0.9); }
          100% { transform: translateY(-55px) scale(0.4); opacity: 0; }
        }
      `}} />

      {/* Sparkles floating from chest */}
      <g>
        <polygon points="120,120 123,112 126,120 123,116" fill="#FFD93D" className="upsell-sparkle upsell-s1" />
        <circle cx="145" cy="115" r="3" fill="#FFD93D" className="upsell-sparkle upsell-s2" />
        <polygon points="165,118 168,110 171,118 168,114" fill="#FFD93D" className="upsell-sparkle upsell-s3" />
        <circle cx="185" cy="120" r="2.5" fill="#B197FC" className="upsell-sparkle upsell-s4" />
        <polygon points="135,122 137,116 139,122 137,119" fill="#FFD93D" className="upsell-sparkle upsell-s5" />
      </g>

      {/* Mascot peeking from behind chest */}
      <g className="upsell-bounce">
        {/* Antenna */}
        <path d="M 150 52 Q 158 35 155 22" fill="none" stroke="#2D3047" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="155" cy="22" r="4.5" fill="#FFD93D" />

        {/* Body (partially hidden behind chest) */}
        <path d="M 115 145
                 C 108 145, 106 115, 110 95
                 C 118 65, 135 55, 150 55
                 C 165 55, 182 65, 190 95
                 C 194 115, 192 145, 185 145
                 C 175 152, 125 152, 115 145 Z" fill="#FF6B6B" />

        {/* Left arm (resting) */}
        <path d="M 117 90 Q 98 108 112 125" fill="none" stroke="#FF6B6B" strokeWidth="12" strokeLinecap="round" />

        {/* Right arm (waving) */}
        <path d="M 183 85 Q 205 70 210 55" fill="none" stroke="#FF6B6B" strokeWidth="12" strokeLinecap="round" className="upsell-wave" />
        {/* Hand circle */}
        <circle cx="210" cy="55" r="6" fill="#FF8E8E" className="upsell-wave" />

        {/* Face */}
        <g className="upsell-blink">
          <ellipse cx="136" cy="80" rx="6" ry="10" fill="#FFFFFF" />
          <ellipse cx="164" cy="80" rx="6" ry="10" fill="#FFFFFF" />
          <circle cx="137" cy="83" r="3.5" fill="#2D3047" />
          <circle cx="165" cy="83" r="3.5" fill="#2D3047" />
          {/* Excited eye sparkles */}
          <circle cx="134" cy="78" r="1.5" fill="#FFFFFF" />
          <circle cx="162" cy="78" r="1.5" fill="#FFFFFF" />
        </g>
        {/* Excited open mouth */}
        <ellipse cx="150" cy="98" rx="8" ry="5" fill="#2D3047" />
        <ellipse cx="150" cy="96" rx="5" ry="2" fill="#FFFFFF" opacity="0.3" />
      </g>

      {/* Treasure chest */}
      <g>
        {/* Chest body */}
        <rect x="95" y="132" width="110" height="45" rx="6" fill="#2EC4B6" />
        <rect x="95" y="132" width="110" height="8" fill="#2D3047" opacity="0.15" />
        {/* Chest band */}
        <rect x="140" y="132" width="20" height="45" fill="#2D3047" opacity="0.1" />
        {/* Lock */}
        <circle cx="150" cy="155" r="6" fill="#FFD93D" />
        <rect x="147" y="155" width="6" height="8" rx="1" fill="#FFD93D" />
        <circle cx="150" cy="155" r="3" fill="#2D3047" opacity="0.2" />

        {/* Chest lid (slightly open) */}
        <g className="upsell-lid">
          <path d="M 93 132 L 93 120 Q 93 114 99 114 L 201 114 Q 207 114 207 120 L 207 132 Z" fill="#2EC4B6" />
          <path d="M 93 132 L 207 132" stroke="#2D3047" strokeWidth="1" opacity="0.2" />
          {/* Lid highlight */}
          <rect x="100" y="118" width="100" height="4" rx="2" fill="#FFFFFF" opacity="0.2" />
        </g>
      </g>

      {/* Ground shadow */}
      <ellipse cx="150" cy="178" rx="70" ry="5" fill="#2D3047" opacity="0.08" />
    </svg>
  );
}
