import React from 'react';

export default function GeneratingMascotV3() {
  return (
    <svg
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes mascot-rock {
          0%, 100% { transform: rotate(-1.5deg); }
          50% { transform: rotate(1.5deg); }
        }
        .mascot-group {
          transform-origin: 80px 170px;
          animation: mascot-rock 4s ease-in-out infinite;
        }

        @keyframes pen-write {
          0%, 100% { transform: rotate(0deg) translate(0px, 0px); }
          15% { transform: rotate(-3deg) translate(-2px, 1px); }
          30% { transform: rotate(2deg) translate(2px, -1px); }
          45% { transform: rotate(-1deg) translate(-1px, 2px); }
          60% { transform: rotate(3deg) translate(1px, -2px); }
          75% { transform: rotate(-2deg) translate(-2px, 1px); }
          90% { transform: rotate(1deg) translate(2px, -1px); }
        }
        .writing-arm {
          transform-origin: 105px 145px;
          animation: pen-write 0.6s linear infinite;
        }

        .text-line { stroke-dasharray: 80; stroke-dashoffset: 80; }
        @keyframes draw-line1 {
          0%, 80% { stroke-dashoffset: 80; opacity: 0; }
          5%, 75% { opacity: 1; }
          20%, 75% { stroke-dashoffset: 0; }
          85%, 100% { opacity: 0; }
        }
        @keyframes draw-line2 {
          0%, 20%, 80% { stroke-dashoffset: 80; opacity: 0; }
          25%, 75% { opacity: 1; }
          40%, 75% { stroke-dashoffset: 0; }
          85%, 100% { opacity: 0; }
        }
        @keyframes draw-line3 {
          0%, 40%, 80% { stroke-dashoffset: 80; opacity: 0; }
          45%, 75% { opacity: 1; }
          60%, 75% { stroke-dashoffset: 0; }
          85%, 100% { opacity: 0; }
        }
        .line-1 { animation: draw-line1 6s infinite; }
        .line-2 { animation: draw-line2 6s infinite; }
        .line-3 { animation: draw-line3 6s infinite; }

        @keyframes eye-blink {
          0%, 94%, 100% { transform: scaleY(1); }
          97% { transform: scaleY(0.1); }
        }
        .eyes-group {
          transform-origin: 80px 100px;
          animation: eye-blink 5s infinite;
        }

        @keyframes sparkle-pop {
          0%, 100% { transform: scale(0) rotate(0deg); opacity: 0; }
          50% { transform: scale(1) rotate(90deg); opacity: 1; }
        }
        .sparkle-shape { animation: sparkle-pop 2s infinite; }
        .sp-1 .sparkle-shape { animation-delay: 0.2s; }
        .sp-2 .sparkle-shape { animation-delay: 1.1s; }
        .sp-3 .sparkle-shape { animation-delay: 1.7s; }

        @keyframes ink-splash1 {
          0%, 100% { transform: translate(0px, 0px) scale(0); opacity: 0; }
          5% { opacity: 1; transform: translate(0px, 0px) scale(1); }
          20% { transform: translate(-15px, -10px) scale(0); opacity: 0; }
        }
        @keyframes ink-splash2 {
          0%, 100% { transform: translate(0px, 0px) scale(0); opacity: 0; }
          5% { opacity: 1; transform: translate(0px, 0px) scale(1); }
          25% { transform: translate(10px, -15px) scale(0); opacity: 0; }
        }
        .ink-1 { animation: ink-splash1 3s infinite; animation-delay: 0.5s; }
        .ink-2 { animation: ink-splash2 3.5s infinite; animation-delay: 1.5s; }
      `}} />

      {/* Floor Shadow */}
      <ellipse cx="90" cy="178" rx="70" ry="8" fill="#2EC4B6" opacity="0.2" />

      {/* Static Paper Group */}
      <g className="paper-group">
        {/* Solid Teal Shadow */}
        <polygon points="120,140 185,130 195,180 130,190" fill="#2EC4B6" />
        {/* Paper Base */}
        <polygon points="120,135 185,125 195,175 130,185" fill="#FFFFFF" stroke="#2D3047" strokeWidth="3" strokeLinejoin="round"/>

        {/* Text Lines */}
        <path className="text-line line-1" d="M 130,145 Q 138,140 145,143 T 160,139 T 175,142 T 180,138" fill="none" stroke="#2D3047" strokeWidth="2.5" strokeLinecap="round"/>
        <path className="text-line line-2" d="M 133,155 Q 140,150 148,153 T 162,149 T 177,152 T 183,148" fill="none" stroke="#2D3047" strokeWidth="2.5" strokeLinecap="round"/>
        <path className="text-line line-3" d="M 136,165 Q 143,160 150,163 T 165,159 T 175,162" fill="none" stroke="#2D3047" strokeWidth="2.5" strokeLinecap="round"/>
      </g>

      {/* Mascot Group */}
      <g className="mascot-group">
        {/* Left Arm */}
        <path d="M 35,115 C 15,120 10,140 25,145 C 30,146 35,140 40,135" fill="#FF6B6B" stroke="#2D3047" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>

        {/* Antenna */}
        <path d="M 80,65 Q 90,35 105,25" fill="none" stroke="#2D3047" strokeWidth="4" strokeLinecap="round"/>
        <circle cx="105" cy="25" r="7" fill="#FFD93D" stroke="#2D3047" strokeWidth="3"/>

        {/* Body */}
        <path d="M 35,160 C 25,100 50,60 80,60 C 110,60 135,100 125,160 C 120,175 40,175 35,160 Z" fill="#FF6B6B" stroke="#2D3047" strokeWidth="4" strokeLinejoin="round" />

        {/* Face */}
        <g className="face">
          <g className="eyes-group">
            {/* Left Eye */}
            <ellipse cx="65" cy="100" rx="9" ry="13" fill="#FFFFFF" stroke="#2D3047" strokeWidth="3" />
            <circle cx="69" cy="103" r="4" fill="#2D3047" />
            <circle cx="67.5" cy="101.5" r="1.5" fill="#FFFFFF" />
            {/* Right Eye */}
            <ellipse cx="95" cy="100" rx="9" ry="13" fill="#FFFFFF" stroke="#2D3047" strokeWidth="3" />
            <circle cx="99" cy="103" r="4" fill="#2D3047" />
            <circle cx="97.5" cy="101.5" r="1.5" fill="#FFFFFF" />
          </g>
          {/* Mouth */}
          <path d="M 75,118 Q 80,122 85,118" fill="none" stroke="#2D3047" strokeWidth="3" strokeLinecap="round"/>
          {/* Tongue */}
          <path d="M 81,119.5 Q 83,127 86,126 Q 88,125 86,118.5 Z" fill="#B197FC" stroke="#2D3047" strokeWidth="2.5" strokeLinejoin="round"/>
        </g>

        {/* Writing Arm */}
        <g className="writing-arm">
          {/* Quill Feather */}
          <path d="M 152,148 C 167,118 187,98 197,93 C 187,108 182,128 152,148 Z" fill="#B197FC" stroke="#2D3047" strokeWidth="2.5" strokeLinejoin="round"/>
          <path d="M 182,106 L 172,113 M 175,120 L 165,126" fill="none" stroke="#2D3047" strokeWidth="2" strokeLinecap="round"/>
          {/* Pen Tip */}
          <polygon points="149,146 155,150 145,160" fill="#2D3047" stroke="#2D3047" strokeWidth="2" strokeLinejoin="round"/>
          {/* Arm Covering Base */}
          <path d="M 105,130 C 135,135 145,150 132,158 C 120,162 105,150 100,145 Z" fill="#FF6B6B" stroke="#2D3047" strokeWidth="3" strokeLinejoin="round"/>
        </g>
      </g>

      <defs>
        <path id="sparkle-star" d="M 0,-8 Q 0,0 8,0 Q 0,0 0,8 Q 0,0 -8,0 Q 0,0 0,-8 Z" fill="#FFD93D" />
      </defs>

      <g className="sp-1" transform="translate(140, 125)">
        <use href="#sparkle-star" className="sparkle-shape" />
      </g>
      <g className="sp-2" transform="translate(175, 150)">
        <use href="#sparkle-star" className="sparkle-shape" />
      </g>
      <g className="sp-3" transform="translate(125, 165)">
        <use href="#sparkle-star" className="sparkle-shape" />
      </g>

      <g className="ink-group" transform="translate(145, 160)">
        <circle cx="0" cy="0" r="2.5" fill="#2D3047" className="ink-drop ink-1" />
        <circle cx="0" cy="0" r="1.5" fill="#2D3047" className="ink-drop ink-2" />
      </g>
    </svg>
  );
}
