import React from 'react';

export default function GeneratingMascotV1({ className = "", style = {} }: { className?: string, style?: React.CSSProperties }) {
  return (
    <svg 
      viewBox="0 0 200 200" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className} 
      style={{ width: "100%", height: "100%", ...style }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        .shadow { animation: shadowPulse 1.2s ease-in-out infinite; transform-origin: 100px 152px; }
        .mascot-bounce { animation: bodyBounce 1.2s ease-in-out infinite; transform-origin: 100px 145px; }
        .arm-left { animation: typeLeft 0.15s infinite alternate ease-in-out; transform-origin: 62px 105px; }
        .arm-right { animation: typeRight 0.18s infinite alternate ease-in-out; transform-origin: 138px 105px; }
        .blink { animation: blinkAnim 4s infinite; transform-origin: 100px 98px; }
        
        .particle { opacity: 0; }
        .p1 { animation: floatUp1 1.4s linear infinite 0s; }
        .p2 { animation: floatUp2 1.3s linear infinite 0.3s; }
        .p3 { animation: floatUp1 1.5s linear infinite 0.7s; }
        .p4 { animation: floatUp2 1.4s linear infinite 0.9s; }
        .p5 { animation: floatUp1 1.2s linear infinite 0.5s; }

        @keyframes shadowPulse {
          0%, 100% { transform: scaleX(1); opacity: 0.2; }
          50% { transform: scaleX(1.05); opacity: 0.15; }
        }
        @keyframes bodyBounce {
          0%, 100% { transform: scaleY(1) scaleX(1) translateY(0); }
          50% { transform: scaleY(0.96) scaleX(1.02) translateY(2px); }
        }
        @keyframes typeLeft {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(15deg); }
        }
        @keyframes typeRight {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(-15deg); }
        }
        @keyframes blinkAnim {
          0%, 46%, 50%, 100% { transform: scaleY(1); }
          48% { transform: scaleY(0.1); }
        }
        @keyframes floatUp1 {
          0% { transform: translate(0px, 0px) scale(0.5); opacity: 0; }
          20% { opacity: 1; transform: translate(-3px, -15px) scale(1); }
          80% { opacity: 0.8; transform: translate(3px, -45px) scale(1.1); }
          100% { transform: translate(0px, -60px) scale(0.5); opacity: 0; }
        }
        @keyframes floatUp2 {
          0% { transform: translate(0px, 0px) scale(0.5); opacity: 0; }
          20% { opacity: 1; transform: translate(3px, -15px) scale(1); }
          80% { opacity: 0.8; transform: translate(-3px, -45px) scale(1.1); }
          100% { transform: translate(0px, -60px) scale(0.5); opacity: 0; }
        }
      `}} />
      
      {/* Shadow */}
      <ellipse cx="100" cy="152" rx="55" ry="6" fill="#2D3047" opacity="0.2" className="shadow" />

      {/* Particles (Behind laptop) */}
      <g>
        <rect x="75" y="125" width="8" height="8" rx="2" fill="#FFD93D" className="particle p1" />
        <circle cx="120" cy="120" r="4" fill="#B197FC" className="particle p2" />
        <rect x="95" y="128" width="12" height="4" rx="2" fill="#FFFFFF" className="particle p3" />
        <polygon points="105,115 110,123 100,123" fill="#2EC4B6" className="particle p4" />
        <circle cx="85" cy="122" r="3" fill="#FF6B6B" className="particle p5" />
      </g>

      {/* Mascot */}
      <g className="mascot-bounce">
        {/* Antenna */}
        <path d="M 100 55 Q 110 35 105 20" fill="none" stroke="#2D3047" strokeWidth="3" strokeLinecap="round" />
        <circle cx="105" cy="20" r="5" fill="#FFD93D" />

        {/* Body */}
        <path d="M 60 145 
                 C 50 145, 50 110, 55 90
                 C 65 60, 85 55, 100 55
                 C 115 55, 135 60, 145 90
                 C 150 110, 150 145, 140 145
                 C 130 155, 70 155, 60 145 Z" fill="#FF6B6B" />

        {/* Arms */}
        <path d="M 62 105 Q 40 125 60 140" fill="none" stroke="#FF6B6B" strokeWidth="14" strokeLinecap="round" className="arm-left" />
        <path d="M 138 105 Q 160 125 140 140" fill="none" stroke="#FF6B6B" strokeWidth="14" strokeLinecap="round" className="arm-right" />

        {/* Face */}
        <g className="blink">
          <ellipse cx="82" cy="95" rx="7" ry="12" fill="#FFFFFF" />
          <ellipse cx="118" cy="95" rx="7" ry="12" fill="#FFFFFF" />
          <circle cx="82" cy="98" r="4" fill="#2D3047" />
          <circle cx="118" cy="98" r="4" fill="#2D3047" />
        </g>
        <path d="M 92 110 Q 100 118 108 110" fill="none" stroke="#2D3047" strokeWidth="3" strokeLinecap="round" />
      </g>

      {/* Laptop */}
      <g>
        {/* Screen back */}
        <path d="M 55 145 L 68 115 L 132 115 L 145 145 Z" fill="#2EC4B6" />
        {/* Base */}
        <rect x="50" y="145" width="100" height="6" rx="3" fill="#2D3047" />
        <rect x="54" y="145" width="92" height="2" fill="#FFFFFF" opacity="0.2" />
        {/* Logo */}
        <circle cx="100" cy="132" r="6" fill="#FFFFFF" opacity="0.9" />
      </g>
    </svg>
  );
}
