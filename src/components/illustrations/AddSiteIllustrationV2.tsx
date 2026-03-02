import React from 'react';

export default function AddSiteIllustrationV2() {
  return (
    <svg
      viewBox="0 0 240 280"
      className="w-full h-full max-w-full"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes asi2-float-body {
          0%, 100% { transform: translateY(0px) scaleY(1) scaleX(1); }
          50% { transform: translateY(-4px) scaleY(0.98) scaleX(1.02); }
        }
        @keyframes asi2-blink {
          0%, 46%, 49%, 100% { transform: scaleY(1); }
          47%, 48% { transform: scaleY(0.1); }
        }
        @keyframes asi2-glow {
          0%, 100% { filter: drop-shadow(0 0 2px #FFD93D) drop-shadow(0 0 4px #FFD93D); transform: scale(1); }
          50% { filter: drop-shadow(0 0 4px #FFD93D) drop-shadow(0 0 8px #FFD93D); transform: scale(1.1); }
        }
        @keyframes asi2-arm-tap {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(-6deg) translateY(-2px); }
        }
        @keyframes asi2-float-cloud {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          50% { transform: translateY(-6px) translateX(3px); }
        }
        @keyframes asi2-bubble-rise {
          0% { opacity: 0; transform: translate(0, 10px) scale(0.6); }
          20% { opacity: 1; transform: translate(-2px, 0) scale(1); }
          80% { opacity: 1; transform: translate(3px, -20px) scale(1.1); }
          100% { opacity: 0; transform: translate(5px, -25px) scale(1.2); }
        }
        @keyframes asi2-fade-1 {
          0%, 25% { opacity: 1; transform: scale(1) translateY(0); }
          33%, 92% { opacity: 0; transform: scale(0.8) translateY(4px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes asi2-fade-2 {
          0%, 25%, 66%, 100% { opacity: 0; transform: scale(0.8) translateY(4px); }
          33%, 58% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes asi2-fade-3 {
          0%, 58%, 100% { opacity: 0; transform: scale(0.8) translateY(4px); }
          66%, 92% { opacity: 1; transform: scale(1) translateY(0); }
        }

        .asi2-mascot-group {
          animation: asi2-float-body 8s ease-in-out infinite;
          transform-origin: 120px 240px;
        }
        .asi2-eye-group {
          animation: asi2-blink 7s infinite;
          transform-origin: 125px 150px;
        }
        .asi2-antenna-tip {
          animation: asi2-glow 4s ease-in-out infinite;
          transform-origin: 110px 50px;
        }
        .asi2-arm-think {
          animation: asi2-arm-tap 6s ease-in-out infinite;
          transform-origin: 175px 200px;
        }
        .asi2-cloud-group {
          animation: asi2-float-cloud 10s ease-in-out infinite;
        }
        .asi2-bubble-1 { animation: asi2-bubble-rise 6s ease-in-out infinite 0s; }
        .asi2-bubble-2 { animation: asi2-bubble-rise 6s ease-in-out infinite 2s; }
        .asi2-bubble-3 { animation: asi2-bubble-rise 6s ease-in-out infinite 4s; }
        
        .asi2-icon-1 { animation: asi2-fade-1 9s infinite; }
        .asi2-icon-2 { animation: asi2-fade-2 9s infinite; }
        .asi2-icon-3 { animation: asi2-fade-3 9s infinite; }
      `}} />

      {/* Subtle floor shadow */}
      <ellipse cx="120" cy="245" rx="65" ry="8" fill="#2EC4B6" opacity="0.15" />

      {/* Cloud & Bubbles Layer */}
      <g>
        {/* Ascending Thought Bubbles */}
        <circle cx="140" cy="130" r="4.5" fill="#B197FC" className="asi2-bubble-1" />
        <circle cx="152" cy="110" r="8" fill="#B197FC" className="asi2-bubble-2" />
        <circle cx="165" cy="85" r="12" fill="#B197FC" className="asi2-bubble-3" />

        {/* Thought Cloud Group */}
        <g className="asi2-cloud-group">
          {/* Main Cloud Body */}
          <path 
            d="M135,75 C125,75 120,60 130,50 C130,35 150,20 170,25 C185,15 210,15 220,35 C235,40 240,60 225,75 C230,90 205,100 190,95 C175,105 145,100 135,75 Z" 
            fill="#FFF8F0" 
            stroke="#2EC4B6" 
            strokeWidth="4" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
          />
          
          {/* Cycling Icons (Centered at 180, 55) */}
          <g transform="translate(180, 55)">
            {/* Magnifying Glass (Charcoal) */}
            <g className="asi2-icon-1" stroke="#2D3047" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none">
              <circle cx="-3" cy="-3" r="9" />
              <line x1="3.5" y1="3.5" x2="11" y2="11" />
            </g>
            
            {/* Chat Bubble (Lavender) */}
            <g className="asi2-icon-2" stroke="#B197FC" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none">
              <path d="M-12,-8 H12 A4,4 0 0,1 16,-4 V6 A4,4 0 0,1 12,10 H4 L-4,16 L-2,10 H-12 A4,4 0 0,1 -16,6 V-4 A4,4 0 0,1 -12,-8 Z" />
            </g>

            {/* Star (Sunny Yellow) */}
            <g className="asi2-icon-3" fill="#FFD93D" stroke="#FFD93D" strokeWidth="2" strokeLinejoin="round">
              <path d="M0,-14 L4,-4 L14,-3 L6,4 L8,14 L0,9 L-8,14 L-6,4 L-14,-3 L-4,-4 Z" />
            </g>
          </g>
        </g>
      </g>

      {/* Mascot Layer */}
      <g className="asi2-mascot-group">
        {/* Left Arm (Resting back) */}
        <path d="M65,165 C40,185 45,215 60,230" fill="none" stroke="#FF6B6B" strokeWidth="16" strokeLinecap="round" />
        
        {/* Antenna Stem */}
        <path d="M115,110 C95,85 105,65 110,50" fill="none" stroke="#FF6B6B" strokeWidth="5" strokeLinecap="round" />
        
        {/* Antenna Glowing Tip */}
        <circle cx="110" cy="50" r="7" fill="#FFD93D" className="asi2-antenna-tip" />

        {/* Bouncy Organic Body Blob */}
        <path 
          d="M70,235 C40,235 45,180 55,145 C65,110 100,105 135,115 C170,125 195,155 190,195 C185,235 150,245 110,245 C90,245 80,235 70,235 Z" 
          fill="#FF6B6B" 
        />

        {/* Expressive Face */}
        <g className="asi2-eye-group">
          {/* Left Eye Whites */}
          <ellipse cx="105" cy="155" rx="14" ry="18" fill="#FFF" />
          {/* Left Pupil (Looking up right at thought cloud) */}
          <circle cx="110" cy="150" r="6" fill="#2D3047" />
          <circle cx="112" cy="148" r="2" fill="#FFF" />

          {/* Right Eye Whites */}
          <ellipse cx="155" cy="150" rx="16" ry="20" fill="#FFF" />
          {/* Right Pupil (Looking up right at thought cloud) */}
          <circle cx="162" cy="144" r="7" fill="#2D3047" />
          <circle cx="164" cy="142" r="2.5" fill="#FFF" />
        </g>

        {/* Tiny Pondering Mouth */}
        <path d="M125,180 Q130,177 135,180" fill="none" stroke="#2D3047" strokeWidth="2.5" strokeLinecap="round" />

        {/* Right Arm (Raised to chin in 'thinking' pose) */}
        <g className="asi2-arm-think">
          {/* Curved stubby arm connecting from right body edge to chin */}
          <path d="M185,195 C195,180 160,165 135,185" fill="none" stroke="#FF6B6B" strokeWidth="16" strokeLinecap="round" />
          {/* Fingers/Chin-touching definition line to separate arm from body color */}
          <path d="M135,185 C132,187 132,190 137,192" fill="none" stroke="#2D3047" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  );
}
