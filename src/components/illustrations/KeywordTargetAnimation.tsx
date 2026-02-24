export default function KeywordTargetAnimation() {
  return (
    <svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes crosshairSpin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes crosshairPulse {
            0%, 100% { opacity: 0.3; r: 60; }
            50% { opacity: 0.15; r: 70; }
          }
          @keyframes pillFloat1 {
            0% { transform: translate(120px, -40px); opacity: 0; }
            20% { opacity: 1; }
            100% { transform: translate(0, 0); opacity: 1; }
          }
          @keyframes pillFloat2 {
            0% { transform: translate(-100px, 60px); opacity: 0; }
            25% { opacity: 1; }
            100% { transform: translate(0, 0); opacity: 1; }
          }
          @keyframes pillFloat3 {
            0% { transform: translate(80px, 80px); opacity: 0; }
            30% { opacity: 1; }
            100% { transform: translate(0, 0); opacity: 1; }
          }
          @keyframes pillFloat4 {
            0% { transform: translate(-120px, -60px); opacity: 0; }
            20% { opacity: 1; }
            100% { transform: translate(0, 0); opacity: 1; }
          }
          @keyframes pillFloat5 {
            0% { transform: translate(60px, -90px); opacity: 0; }
            35% { opacity: 1; }
            100% { transform: translate(0, 0); opacity: 1; }
          }
          @keyframes lockOn {
            0%, 80% { stroke-dashoffset: 160; }
            100% { stroke-dashoffset: 0; }
          }
          @keyframes ripple {
            0% { r: 20; opacity: 0.4; }
            100% { r: 80; opacity: 0; }
          }
          @keyframes dotPing {
            0%, 100% { r: 3; opacity: 1; }
            50% { r: 5; opacity: 0.7; }
          }
          .crosshair-ring { animation: crosshairSpin 12s linear infinite; transform-origin: 200px 150px; }
          .crosshair-pulse { animation: crosshairPulse 3s ease-in-out infinite; }
          .pill-1 { animation: pillFloat1 4s ease-out infinite; }
          .pill-2 { animation: pillFloat2 4s ease-out infinite 0.5s; }
          .pill-3 { animation: pillFloat3 4s ease-out infinite 1s; }
          .pill-4 { animation: pillFloat4 4s ease-out infinite 1.5s; }
          .pill-5 { animation: pillFloat5 4s ease-out infinite 0.8s; }
          .lock-circle { animation: lockOn 4s ease-out infinite; stroke-dasharray: 160; }
          .ripple-1 { animation: ripple 3s ease-out infinite; }
          .ripple-2 { animation: ripple 3s ease-out infinite 1s; }
          .ripple-3 { animation: ripple 3s ease-out infinite 2s; }
          .dot-ping { animation: dotPing 2s ease-in-out infinite; }
        ` }} />
      </defs>

      {/* Subtle bg pattern */}
      <pattern id="targetGrid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
        <line x1="0" y1="0" x2="40" y2="0" stroke="#2D3047" strokeWidth="0.3" opacity="0.05" />
        <line x1="0" y1="0" x2="0" y2="40" stroke="#2D3047" strokeWidth="0.3" opacity="0.05" />
      </pattern>
      <rect width="400" height="300" fill="url(#targetGrid)" />

      {/* Ripple rings */}
      <circle cx="200" cy="150" className="ripple-1" fill="none" stroke="#2EC4B6" strokeWidth="1" />
      <circle cx="200" cy="150" className="ripple-2" fill="none" stroke="#2EC4B6" strokeWidth="1" />
      <circle cx="200" cy="150" className="ripple-3" fill="none" stroke="#2EC4B6" strokeWidth="1" />

      {/* Target rings */}
      <circle cx="200" cy="150" r="60" fill="none" stroke="#2EC4B6" strokeWidth="1" opacity="0.15" />
      <circle cx="200" cy="150" r="40" fill="none" stroke="#2EC4B6" strokeWidth="1" opacity="0.25" />
      <circle cx="200" cy="150" r="20" fill="#2EC4B6" opacity="0.08" />

      {/* Crosshair rotating ring */}
      <g className="crosshair-ring">
        <circle cx="200" cy="150" r="50" fill="none" stroke="#2EC4B6" strokeWidth="1.5" strokeDasharray="8 12" opacity="0.4" />
      </g>

      {/* Crosshair lines */}
      <line x1="200" y1="110" x2="200" y2="135" stroke="#2EC4B6" strokeWidth="1.5" opacity="0.6" />
      <line x1="200" y1="165" x2="200" y2="190" stroke="#2EC4B6" strokeWidth="1.5" opacity="0.6" />
      <line x1="160" y1="150" x2="185" y2="150" stroke="#2EC4B6" strokeWidth="1.5" opacity="0.6" />
      <line x1="215" y1="150" x2="240" y2="150" stroke="#2EC4B6" strokeWidth="1.5" opacity="0.6" />

      {/* Center dot */}
      <circle cx="200" cy="150" r="4" fill="#FF6B6B" className="dot-ping" />

      {/* Lock-on circle */}
      <circle cx="200" cy="150" r="25" fill="none" stroke="#FF6B6B" strokeWidth="2" className="lock-circle" opacity="0.7" />

      {/* Keyword pills floating in */}
      <g className="pill-1">
        <rect x="155" y="80" width="90" height="26" rx="13" fill="#2EC4B6" />
        <text x="200" y="97" textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff" fontFamily="sans-serif">best mattress</text>
      </g>

      <g className="pill-2">
        <rect x="80" y="140" width="70" height="24" rx="12" fill="#FF6B6B" />
        <text x="115" y="156" textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff" fontFamily="sans-serif">top CRM</text>
      </g>

      <g className="pill-3">
        <rect x="255" y="180" width="85" height="24" rx="12" fill="#B197FC" />
        <text x="297" y="196" textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff" fontFamily="sans-serif">AI tool 2026</text>
      </g>

      <g className="pill-4">
        <rect x="100" y="210" width="95" height="24" rx="12" fill="#FFD93D" />
        <text x="147" y="226" textAnchor="middle" fontSize="9" fontWeight="700" fill="#2D3047" fontFamily="sans-serif">SaaS reviews</text>
      </g>

      <g className="pill-5">
        <rect x="260" y="95" width="80" height="24" rx="12" fill="#2EC4B6" opacity="0.8" />
        <text x="300" y="111" textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff" fontFamily="sans-serif">alternatives</text>
      </g>

      {/* Connecting trail lines */}
      <line x1="200" y1="106" x2="200" y2="93" stroke="#2EC4B6" strokeWidth="0.8" opacity="0.3" strokeDasharray="2 2" />
      <line x1="165" y1="150" x2="150" y2="152" stroke="#FF6B6B" strokeWidth="0.8" opacity="0.3" strokeDasharray="2 2" />
      <line x1="235" y1="165" x2="255" y2="192" stroke="#B197FC" strokeWidth="0.8" opacity="0.3" strokeDasharray="2 2" />
    </svg>
  );
}
