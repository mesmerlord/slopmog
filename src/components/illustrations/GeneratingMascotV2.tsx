import React from 'react';

export default function GeneratingMascotV2() {
  const styles = `
    .mascot-container {
      width: 100%;
      height: 100%;
    }

    /* Core breathing animation for the whole body */
    .blob-body {
      transform-origin: 100px 165px;
      animation: breathe 3s infinite ease-in-out;
    }
    @keyframes breathe {
      0%, 100% { transform: scaleY(1) scaleX(1); }
      50% { transform: scaleY(0.96) scaleX(1.02); }
    }

    /* Floor shadow breathes in reverse to body */
    .floor-shadow {
      transform-origin: 100px 175px;
      animation: shadowBreathe 3s infinite ease-in-out;
    }
    @keyframes shadowBreathe {
      0%, 100% { transform: scaleX(1); opacity: 0.1; }
      50% { transform: scaleX(1.05); opacity: 0.08; }
    }

    /* Antenna ball glowing and pulsing */
    .antenna-ball {
      transform-origin: 120px 45px;
      animation: pulseGlow 2s infinite ease-in-out;
    }
    @keyframes pulseGlow {
      0%, 100% { transform: scale(1); opacity: 0.8; filter: drop-shadow(0px 0px 2px #2EC4B6); }
      50% { transform: scale(1.25); opacity: 1; filter: drop-shadow(0px 0px 6px #2EC4B6); }
    }

    /* Eyes looking around */
    .pupil {
      animation: lookAround 6s infinite ease-in-out;
    }
    @keyframes lookAround {
      0%, 15% { transform: translate(0px, 0px); } /* center-up */
      20%, 35% { transform: translate(-4px, 1px); } /* look left */
      40%, 55% { transform: translate(4px, 1px); } /* look right */
      60%, 75% { transform: translate(-2px, -3px); } /* look up-left */
      80%, 100% { transform: translate(0px, 0px); } /* center-up */
    }

    /* Arm tapping cheek */
    .thinking-arm {
      transform-origin: 150px 135px;
      animation: tapChin 3s infinite ease-in-out;
    }
    @keyframes tapChin {
      0%, 100% { transform: rotate(0deg); }
      50% { transform: rotate(-6deg); }
    }

    /* Thought bubbles bobbing */
    .bubble-1 { animation: floatBob 3.5s infinite ease-in-out 0s; }
    .bubble-2 { animation: floatBob 3.5s infinite ease-in-out 0.8s; }
    .bubble-3 { animation: floatBob 3.5s infinite ease-in-out 1.5s; }
    @keyframes floatBob {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-6px); }
    }

    /* Icons popping inside the big thought bubble */
    .icon {
      transform-origin: 150px 30px;
      opacity: 0;
    }
    .icon-1 { animation: cycleIcon 9s infinite 0s; } /* Lightbulb */
    .icon-2 { animation: cycleIcon 9s infinite 3s; } /* Speech Bubble */
    .icon-3 { animation: cycleIcon 9s infinite 6s; } /* Star */
    @keyframes cycleIcon {
      0%, 5% { opacity: 0; transform: scale(0.5); }
      10%, 25% { opacity: 1; transform: scale(1); }
      30%, 100% { opacity: 0; transform: scale(1.1); }
    }

    /* Sparkles twinkling in background */
    .sparkle {
      opacity: 0;
    }
    .sp-1 { animation: twinkle 4s infinite 0.5s; transform-origin: 30px 48px; }
    .sp-2 { animation: twinkle 5s infinite 2s; transform-origin: 170px 126px; }
    .sp-3 { animation: twinkle 3.5s infinite 1s; transform-origin: 20px 120px; }
    .sp-4 { animation: twinkle 4.5s infinite 3s; transform-origin: 70px 40px; }
    @keyframes twinkle {
      0%, 100% { opacity: 0; transform: scale(0.2) rotate(0deg); }
      50% { opacity: 1; transform: scale(1) rotate(45deg); }
    }
  `;

  return (
    <svg
      className="mascot-container"
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
    >
      <style dangerouslySetInnerHTML={{ __html: styles }} />

      <defs>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Background Sparkles */}
      <g>
        <path className="sparkle sp-1" d="M30 40 L32 46 L38 48 L32 50 L30 56 L28 50 L22 48 L28 46 Z" fill="#FFD93D" />
        <path className="sparkle sp-2" d="M170 120 L172 124 L176 126 L172 128 L170 132 L168 128 L164 126 L168 124 Z" fill="#FFD93D" />
        <path className="sparkle sp-3" d="M20 114 L22 118 L26 120 L22 122 L20 126 L18 122 L14 120 L18 118 Z" fill="#FFD93D" />
        <path className="sparkle sp-4" d="M70 34 L72 38 L76 40 L72 42 L70 46 L68 42 L64 40 L68 38 Z" fill="#FFD93D" />
      </g>

      {/* Floor Shadow */}
      <ellipse className="floor-shadow" cx="100" cy="175" rx="45" ry="8" fill="#2D3047" />

      {/* Main Mascot (Animated to breathe together) */}
      <g className="blob-body">

        {/* Antenna Base/Line */}
        <path d="M100,80 Q105,55 120,45" stroke="#2D3047" strokeWidth="3" fill="none" strokeLinecap="round" />

        {/* Antenna Ball */}
        <circle className="antenna-ball" cx="120" cy="45" r="7" fill="#2EC4B6" />

        {/* Resting Left Arm (Shadow + Arm) */}
        <g>
          <path d="M50,135 Q30,145 40,155" stroke="#2D3047" strokeWidth="14" strokeLinecap="round" fill="none" opacity="0.1" transform="translate(0, 3)" />
          <path d="M50,135 Q30,145 40,155" stroke="#FF6B6B" strokeWidth="14" strokeLinecap="round" fill="none" />
        </g>

        {/* Main Blob Body */}
        <path
          d="M100,170 C50,170 35,145 35,120 C35,85 70,75 100,75 C130,75 165,85 165,120 C165,145 150,170 100,170 Z"
          fill="#FF6B6B"
        />

        {/* Cheeks (Cute subtle marks) */}
        <ellipse cx="68" cy="116" rx="6" ry="3" fill="#2D3047" opacity="0.12" />
        <ellipse cx="132" cy="116" rx="6" ry="3" fill="#2D3047" opacity="0.12" />

        {/* Thinking Right Arm (Animated tap) */}
        <g className="thinking-arm">
          <path d="M150,135 Q165,115 130,112" stroke="#2D3047" strokeWidth="14" strokeLinecap="round" fill="none" opacity="0.1" transform="translate(0, 3)" />
          <path d="M150,135 Q165,115 130,112" stroke="#FF6B6B" strokeWidth="14" strokeLinecap="round" fill="none" />
        </g>

        {/* Face Elements */}
        {/* Whites of Eyes */}
        <ellipse cx="82" cy="105" rx="10" ry="14" fill="#FFFFFF" />
        <ellipse cx="118" cy="105" rx="10" ry="14" fill="#FFFFFF" />

        {/* Moving Pupils */}
        <g className="pupil">
          <circle cx="82" cy="102" r="5" fill="#2D3047" />
          <circle cx="80" cy="100" r="1.5" fill="#FFFFFF" />
        </g>
        <g className="pupil">
          <circle cx="118" cy="102" r="5" fill="#2D3047" />
          <circle cx="116" cy="100" r="1.5" fill="#FFFFFF" />
        </g>

        {/* Thinking 'o' Mouth */}
        <circle cx="100" cy="118" r="3.5" fill="#2D3047" />
      </g>

      {/* Thought Bubbles */}
      <g className="bubble-1">
        <circle cx="145" cy="85" r="5" fill="#FFFFFF" filter="url(#glow)" opacity="0.9" />
      </g>

      <g className="bubble-2">
        <circle cx="158" cy="65" r="9" fill="#FFFFFF" filter="url(#glow)" opacity="0.95" />
      </g>

      <g className="bubble-3">
        {/* Main Big Bubble */}
        <circle cx="150" cy="30" r="24" fill="#FFFFFF" filter="url(#glow)" />

        {/* Cycling Icons (Centered inside the 150,30 bubble) */}
        {/* Icon 1: Lightbulb */}
        <g className="icon icon-1">
          <g transform="translate(138, 18)" stroke="#FFD93D" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5.4 2.1 2.1 3 3 3s2.6-.9 3-3z" />
            <path d="M9 18h6" />
            <path d="M10 22h4" />
          </g>
        </g>

        {/* Icon 2: Speech Bubble */}
        <g className="icon icon-2">
          <g transform="translate(138, 18)" stroke="#B197FC" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </g>
        </g>

        {/* Icon 3: Star */}
        <g className="icon icon-3">
          <g transform="translate(138, 18)" stroke="#2EC4B6" strokeWidth="2" fill="#2EC4B6" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </g>
        </g>
      </g>
    </svg>
  );
}
