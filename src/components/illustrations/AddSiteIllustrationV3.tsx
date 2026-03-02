import React from 'react';

export default function AddSiteIllustrationV3() {
  return (
    <svg viewBox="0 0 300 280" className="w-full h-full max-w-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="asi3-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#2EC4B6" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#2EC4B6" stopOpacity="0" />
        </radialGradient>
      </defs>

      <style dangerouslySetInnerHTML={{ __html: `
        .asi3-bounce {
          animation: asi3-bounce 8s ease-in-out infinite;
        }
        .asi3-pulse {
          animation: asi3-pulse 6s ease-in-out infinite;
          transform-origin: center;
          transform-box: fill-box;
        }
        .asi3-pulse-fast {
          animation: asi3-pulse-fast 3s ease-in-out infinite;
          transform-origin: center;
          transform-box: fill-box;
        }
        .asi3-float1 {
          animation: asi3-float1 9s ease-in-out infinite;
          transform-origin: center;
          transform-box: fill-box;
        }
        .asi3-float2 {
          animation: asi3-float2 10s ease-in-out infinite;
          transform-origin: center;
          transform-box: fill-box;
        }
        .asi3-drift {
          animation: asi3-drift linear infinite;
        }
        .asi3-blink {
          animation: asi3-blink 6s infinite;
          transform-origin: 0px -15px;
        }
        .asi3-arm-left {
          animation: asi3-arm-wave-left 7s ease-in-out infinite;
          transform-origin: -45px 10px;
        }
        .asi3-arm-right {
          animation: asi3-arm-wave-right 7.5s ease-in-out infinite;
          transform-origin: 45px 10px;
        }

        @keyframes asi3-bounce {
          0%, 100% { transform: translateY(0) scale(1, 1); }
          50% { transform: translateY(-12px) scale(0.96, 1.04); }
        }
        @keyframes asi3-pulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.15); }
        }
        @keyframes asi3-pulse-fast {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes asi3-float1 {
          0%, 100% { transform: translateY(0) rotate(-3deg); }
          50% { transform: translateY(-14px) rotate(4deg); }
        }
        @keyframes asi3-float2 {
          0%, 100% { transform: translateY(0) rotate(4deg); }
          50% { transform: translateY(-16px) rotate(-3deg); }
        }
        @keyframes asi3-drift {
          0% { transform: translateY(20px) scale(0.8); opacity: 0; }
          15% { opacity: 1; transform: translateY(0px) scale(1); }
          80% { opacity: 1; }
          100% { transform: translateY(-90px) scale(1.2); opacity: 0; }
        }
        @keyframes asi3-blink {
          0%, 94%, 98%, 100% { transform: scaleY(1); }
          96% { transform: scaleY(0.1); }
        }
        @keyframes asi3-arm-wave-left {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(-15deg); }
        }
        @keyframes asi3-arm-wave-right {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(15deg); }
        }
      `}} />

      {/* Background glow ring */}
      <circle cx="100" cy="160" r="85" fill="url(#asi3-glow)" className="asi3-pulse" />

      {/* Background Particles (drift behind cards) */}
      <g style={{ transform: 'translate(140px, 120px)' }}>
        <g className="asi3-drift" style={{ animationDelay: '0s', animationDuration: '7s' }}>
          <path d="M-6,0 L0,-8 L6,0 M0,-8 L0,8" stroke="#FF6B6B" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </g>
      </g>

      <g style={{ transform: 'translate(250px, 100px)' }}>
        <g className="asi3-drift" style={{ animationDelay: '-3s', animationDuration: '8s' }}>
          <path d="M0,4 C-5,0 -8,-4 -4,-7 C-2,-8 0,-6 0,-4 C0,-6 2,-8 4,-7 C8,-4 5,0 0,4 Z" fill="#B197FC" />
        </g>
      </g>

      <g style={{ transform: 'translate(280px, 180px)' }}>
        <g className="asi3-drift" style={{ animationDelay: '-1s', animationDuration: '9s' }}>
          <path d="M-5,0 L0,-7 L5,0 M0,-7 L0,7" stroke="#2EC4B6" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </g>
      </g>

      {/* Cards */}
      {/* Reddit-style Card */}
      <g className="asi3-float1" style={{ animationDelay: '-2s' }}>
        <rect x="160" y="50" width="110" height="75" rx="12" fill="#2D3047" opacity="0.05" transform="translate(0, 8)"/>
        <rect x="160" y="50" width="110" height="75" rx="12" fill="#FFFFFF" stroke="#2EC4B6" strokeWidth="2"/>
        
        <circle cx="180" cy="70" r="10" fill="#FF6B6B" opacity="0.2"/>
        <circle cx="180" cy="70" r="4" fill="#FF6B6B"/>
        <path d="M175,70 Q180,78 185,70" stroke="#FF6B6B" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        
        <rect x="200" y="65" width="50" height="4" rx="2" fill="#2D3047" opacity="0.2"/>
        <rect x="200" y="73" width="30" height="4" rx="2" fill="#2D3047" opacity="0.1"/>

        <rect x="172" y="90" width="86" height="6" rx="3" fill="#B197FC" opacity="0.4"/>
        <rect x="172" y="102" width="60" height="6" rx="3" fill="#B197FC" opacity="0.4"/>
        
        <path d="M172,118 L176,112 L180,118" stroke="#FF6B6B" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M185,112 L189,118 L193,112" stroke="#2D3047" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.3"/>
      </g>

      {/* YouTube-style Card */}
      <g className="asi3-float2" style={{ animationDelay: '-5s' }}>
        <rect x="190" y="145" width="100" height="85" rx="12" fill="#2D3047" opacity="0.05" transform="translate(0, 8)"/>
        <rect x="190" y="145" width="100" height="85" rx="12" fill="#FFFFFF" stroke="#B197FC" strokeWidth="2"/>
        
        <rect x="196" y="151" width="88" height="45" rx="6" fill="#FFD93D" opacity="0.3"/>
        
        <rect x="225" y="161" width="30" height="25" rx="6" fill="#FF6B6B"/>
        <polygon points="237,169 237,178 245,173.5" fill="#FFFFFF"/>
        
        <rect x="196" y="206" width="70" height="5" rx="2.5" fill="#2D3047" opacity="0.3"/>
        <rect x="196" y="217" width="40" height="4" rx="2" fill="#2D3047" opacity="0.15"/>
      </g>

      {/* Foreground Particles */}
      <g style={{ transform: 'translate(180px, 250px)' }}>
        <g className="asi3-drift" style={{ animationDelay: '-5s', animationDuration: '8.5s' }}>
          <path d="M0,5 C-6,0 -10,-5 -5,-8.5 C-2.5,-10 0,-7.5 0,-5 C0,-7.5 2.5,-10 5,-8.5 C10,-5 6,0 0,5 Z" fill="#FFD93D" />
        </g>
      </g>

      <g style={{ transform: 'translate(150px, 200px)' }}>
        <g className="asi3-drift" style={{ animationDelay: '-7s', animationDuration: '7.5s' }}>
          <path d="M0,-8 Q0,0 8,0 Q0,0 0,8 Q0,0 -8,0 Q0,0 0,-8 Z" fill="#FFD93D"/>
        </g>
      </g>

      <g style={{ transform: 'translate(290px, 130px)' }}>
        <g className="asi3-drift" style={{ animationDelay: '-6s', animationDuration: '10s' }}>
          <path d="M0,3 C-4,0 -6,-3 -3,-5 C-1.5,-6 0,-4.5 0,-3 C0,-4.5 1.5,-6 3,-5 C6,-3 4,0 0,3 Z" fill="#FF6B6B" opacity="0.7"/>
        </g>
      </g>

      {/* Mascot */}
      <g style={{ transform: 'translate(100px, 160px)' }}>
        <g className="asi3-bounce">
          {/* Antenna */}
          <path d="M0,-55 Q-15,-80 5,-105" stroke="#FF6B6B" strokeWidth="7" fill="none" strokeLinecap="round"/>
          {/* Glowing tip */}
          <circle cx="5" cy="-105" r="10" fill="#FFD93D" className="asi3-pulse-fast"/>
          <circle cx="5" cy="-105" r="5" fill="#FFFFFF"/>

          {/* Left Arm (raised) */}
          <g className="asi3-arm-left">
            <path d="M-40,10 Q-70,-15 -60,-45" stroke="#FF6B6B" strokeWidth="14" fill="none" strokeLinecap="round"/>
          </g>

          {/* Right Arm (raised) */}
          <g className="asi3-arm-right">
            <path d="M40,10 Q70,-15 60,-45" stroke="#FF6B6B" strokeWidth="14" fill="none" strokeLinecap="round"/>
          </g>

          {/* Body Blob */}
          <path d="M-55,10 C-55,-40 -35,-65 0,-65 C35,-65 55,-40 55,10 C55,55 40,80 0,80 C-40,80 -55,55 -55,10 Z" fill="#FF6B6B" />

          {/* Face Elements */}
          <g className="asi3-blink">
            {/* Left Eye */}
            <ellipse cx="-20" cy="-15" rx="12" ry="16" fill="#FFFFFF"/>
            <circle cx="-16" cy="-13" r="5" fill="#2D3047"/>
            <circle cx="-18" cy="-15" r="2" fill="#FFFFFF"/>

            {/* Right Eye */}
            <ellipse cx="20" cy="-15" rx="12" ry="16" fill="#FFFFFF"/>
            <circle cx="16" cy="-13" r="5" fill="#2D3047"/>
            <circle cx="14" cy="-15" r="2" fill="#FFFFFF"/>
          </g>

          {/* Wide Smile */}
          <path d="M-18,10 Q0,20 18,10 Q0,38 -18,10 Z" fill="#2D3047"/>
          <path d="M-8,18 Q0,12 8,18 Q0,28 -8,18 Z" fill="#FF6B6B" opacity="0.9"/>
          <path d="M-18,10 Q0,20 18,10" stroke="#2D3047" strokeWidth="3" fill="none" strokeLinecap="round"/>
        </g>
      </g>
    </svg>
  );
}
