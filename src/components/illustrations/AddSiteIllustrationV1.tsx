import React from 'react';

export default function AddSiteIllustrationV1() {
  return (
    <svg
      viewBox="0 0 280 280"
      className="w-full h-full max-w-full"
      xmlns="http://www.w3.org/2000/svg"
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes asi1-squish {
          0%, 100% { transform: scale(1, 1); }
          50% { transform: scale(1.04, 0.96) translateY(2px); }
        }

        @keyframes asi1-float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-8px) rotate(1deg); }
        }

        @keyframes asi1-float-alt {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(-1deg); }
        }

        @keyframes asi1-glow {
          0%, 100% { filter: drop-shadow(0 0 2px rgba(255, 217, 61, 0.4)); transform: scale(1); }
          50% { filter: drop-shadow(0 0 8px rgba(255, 217, 61, 0.9)); transform: scale(1.15); }
        }

        @keyframes asi1-blink {
          0%, 46%, 49%, 100% { transform: scaleY(1); }
          47%, 48% { transform: scaleY(0.1); }
        }

        @keyframes asi1-arm-wave {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(15deg); }
        }

        @keyframes asi1-arm-point {
          0%, 100% { transform: rotate(0deg) translateY(0); }
          50% { transform: rotate(-8deg) translateY(-2px); }
        }

        @keyframes asi1-flow-1 {
          0% { transform: translate(0, 0) scale(0); opacity: 0; }
          15% { transform: translate(-10px, -8px) scale(1); opacity: 1; }
          85% { transform: translate(-40px, -20px) scale(1); opacity: 1; }
          100% { transform: translate(-50px, -25px) scale(0); opacity: 0; }
        }

        @keyframes asi1-flow-2 {
          0% { transform: translate(0, 0) scale(0); opacity: 0; }
          15% { transform: translate(-12px, -2px) scale(1); opacity: 1; }
          85% { transform: translate(-35px, 5px) scale(1); opacity: 1; }
          100% { transform: translate(-45px, 8px) scale(0); opacity: 0; }
        }

        @keyframes asi1-shadow-pulse {
          0%, 100% { transform: scale(1); opacity: 0.1; }
          50% { transform: scale(0.9); opacity: 0.15; }
        }

        .asi1-blob {
          transform-origin: 90px 215px;
          animation: asi1-squish 6s ease-in-out infinite;
        }

        .asi1-browser {
          transform-origin: 195px 125px;
          animation: asi1-float 8s ease-in-out infinite;
        }

        .asi1-antenna-tip {
          transform-origin: 115px 70px;
          animation: asi1-glow 7s ease-in-out infinite;
        }

        .asi1-eyes {
          transform-origin: 90px 145px;
          animation: asi1-blink 8s linear infinite;
        }

        .asi1-arm-left {
          transform-origin: 45px 160px;
          animation: asi1-arm-wave 7s ease-in-out infinite;
        }

        .asi1-arm-right {
          transform-origin: 135px 155px;
          animation: asi1-arm-point 6.5s ease-in-out infinite;
        }

        .asi1-pill-1 {
          animation: asi1-float-alt 9s ease-in-out infinite 0s;
          transform-origin: 62px 38px;
        }

        .asi1-pill-2 {
          animation: asi1-float 8s ease-in-out infinite 1.5s;
          transform-origin: 142px 28px;
        }

        .asi1-pill-3 {
          animation: asi1-float-alt 9.5s ease-in-out infinite 3s;
          transform-origin: 227px 48px;
        }

        .asi1-particle-1 {
          animation: asi1-flow-1 6s ease-in-out infinite 0s;
          transform-origin: 130px 140px;
        }

        .asi1-particle-2 {
          animation: asi1-flow-2 7s ease-in-out infinite 2s;
          transform-origin: 140px 155px;
        }

        .asi1-particle-3 {
          animation: asi1-flow-1 6.5s ease-in-out infinite 4s;
          transform-origin: 125px 165px;
        }

        .asi1-shadow-blob {
          transform-origin: 90px 225px;
          animation: asi1-shadow-pulse 6s ease-in-out infinite;
        }

        .asi1-shadow-browser {
          transform-origin: 195px 225px;
          animation: asi1-shadow-pulse 8s ease-in-out infinite;
        }
      `}} />

      {/* Shadows */}
      <ellipse cx="90" cy="225" rx="35" ry="6" fill="#2D3047" className="asi1-shadow-blob" />
      <ellipse cx="195" cy="225" rx="55" ry="6" fill="#2D3047" className="asi1-shadow-browser" />

      {/* Floating Keyword Pills */}
      <g className="asi1-pill-1">
        <rect x="35" y="25" width="55" height="26" rx="13" fill="#B197FC" stroke="#2D3047" strokeWidth="3" />
        <text x="62.5" y="43" fontFamily="Quicksand, system-ui, sans-serif" fontSize="11" fontWeight="bold" fill="#2D3047" textAnchor="middle">SEO</text>
      </g>
      
      <g className="asi1-pill-2">
        <rect x="110" y="15" width="65" height="26" rx="13" fill="#FFD93D" stroke="#2D3047" strokeWidth="3" />
        <text x="142.5" y="33" fontFamily="Quicksand, system-ui, sans-serif" fontSize="11" fontWeight="bold" fill="#2D3047" textAnchor="middle">GROW</text>
      </g>
      
      <g className="asi1-pill-3">
        <rect x="195" y="35" width="65" height="26" rx="13" fill="#2EC4B6" stroke="#2D3047" strokeWidth="3" />
        <text x="227.5" y="53" fontFamily="Quicksand, system-ui, sans-serif" fontSize="11" fontWeight="bold" fill="#2D3047" textAnchor="middle">RANK</text>
      </g>

      {/* Data Flow Particles */}
      <g>
        {/* Teal Circle Particle */}
        <circle cx="130" cy="140" r="5" fill="#2EC4B6" stroke="#2D3047" strokeWidth="2" className="asi1-particle-1" />
        
        {/* Yellow Cross/Sparkle Particle */}
        <g className="asi1-particle-2">
          <path d="M 135 155 L 145 155 M 140 150 L 140 160" stroke="#FFD93D" strokeWidth="3" strokeLinecap="round" />
        </g>
        
        {/* Lavender Circle Particle */}
        <circle cx="125" cy="165" r="4" fill="#B197FC" stroke="#2D3047" strokeWidth="2" className="asi1-particle-3" />
      </g>

      {/* Browser Window */}
      <g className="asi1-browser">
        {/* Browser Body */}
        <rect x="130" y="80" width="130" height="95" rx="8" fill="#FFF8F0" stroke="#2D3047" strokeWidth="4" />

        {/* Browser Top Bar */}
        <path d="M 130 88 Q 130 80 138 80 L 252 80 Q 260 80 260 88 L 260 102 L 130 102 Z" fill="#2EC4B6" stroke="#2D3047" strokeWidth="4" />

        {/* Window Controls (macOS style dots) */}
        <circle cx="142" cy="91" r="3" fill="#FFF8F0" />
        <circle cx="152" cy="91" r="3" fill="#FFF8F0" />
        <circle cx="162" cy="91" r="3" fill="#FFF8F0" />

        {/* Content - Mock text blocks */}
        <rect x="145" y="115" width="70" height="8" rx="4" fill="#B197FC" />
        <rect x="145" y="133" width="100" height="8" rx="4" fill="#FFD93D" />
        <rect x="145" y="151" width="55" height="8" rx="4" fill="#FF6B6B" />

        {/* Floating Image/Graph inside browser */}
        <rect x="215" y="112" width="30" height="30" rx="6" fill="#FFF8F0" stroke="#2D3047" strokeWidth="3" />
        <path d="M 220 132 L 225 122 L 235 137 L 240 132" fill="none" stroke="#2D3047" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="235" cy="119" r="2.5" fill="#FF6B6B" />
      </g>

      {/* Mascot Blob */}
      <g className="asi1-blob">
        {/* Antenna Stem */}
        <path d="M 85 115 Q 100 85 115 70" fill="none" stroke="#2D3047" strokeWidth="4" strokeLinecap="round" />
        
        {/* Antenna Glowing Tip */}
        <circle cx="115" cy="70" r="7" fill="#FFD93D" stroke="#2D3047" strokeWidth="3" className="asi1-antenna-tip" />

        {/* Back Arm (Left, Waving) */}
        <path d="M 45 160 Q 20 140 25 115 Q 35 110 45 145 Z" fill="#FF6B6B" stroke="#2D3047" strokeWidth="3" className="asi1-arm-left" />

        {/* Organic Main Body */}
        <path 
          d="M 90 110 C 130 110, 145 140, 140 175 C 135 210, 110 215, 90 215 C 70 215, 45 210, 40 175 C 35 140, 50 110, 90 110 Z" 
          fill="#FF6B6B" 
          stroke="#2D3047" 
          strokeWidth="4" 
        />

        {/* Eyes (Blinking Group) */}
        <g className="asi1-eyes">
          {/* Left Eye */}
          <circle cx="70" cy="145" r="11" fill="#FFF8F0" stroke="#2D3047" strokeWidth="3" />
          <circle cx="75" cy="145" r="4" fill="#2D3047" />
          
          {/* Right Eye */}
          <circle cx="105" cy="145" r="11" fill="#FFF8F0" stroke="#2D3047" strokeWidth="3" />
          <circle cx="110" cy="145" r="4" fill="#2D3047" />
        </g>

        {/* Happy Smile & Cheeks */}
        <path d="M 75 165 Q 87.5 180 100 165" fill="none" stroke="#2D3047" strokeWidth="3" strokeLinecap="round" />
        <path d="M 72 162 Q 75 165 78 162" fill="none" stroke="#2D3047" strokeWidth="2" strokeLinecap="round" />
        <path d="M 97 162 Q 100 165 103 162" fill="none" stroke="#2D3047" strokeWidth="2" strokeLinecap="round" />

        {/* Front Arm (Right, Pointing) */}
        <path d="M 130 165 Q 160 170 165 150 Q 155 140 135 155 Z" fill="#FF6B6B" stroke="#2D3047" strokeWidth="3" className="asi1-arm-right" />
      </g>
    </svg>
  );
}
