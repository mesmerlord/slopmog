export default function LogoBlob({ className }: { className?: string }) {
  return (
    <div className={className ?? "w-10 h-10 shrink-0"}>
      <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <path
          d="M20 2 C30 2, 38 10, 38 20 C38 30, 30 38, 20 38 C10 38, 2 30, 2 20 C2 10, 10 2, 20 2Z"
          fill="#FF6B6B"
          stroke="#2D3047"
          strokeWidth="2"
        >
          <animate
            attributeName="d"
            dur="4s"
            repeatCount="indefinite"
            values="M20 2 C30 2, 38 10, 38 20 C38 30, 30 38, 20 38 C10 38, 2 30, 2 20 C2 10, 10 2, 20 2Z;M20 4 C32 4, 36 12, 36 20 C36 32, 28 36, 20 36 C8 36, 4 28, 4 20 C4 8, 12 4, 20 4Z;M20 2 C30 2, 38 10, 38 20 C38 30, 30 38, 20 38 C10 38, 2 30, 2 20 C2 10, 10 2, 20 2Z"
          />
        </path>
        <circle cx="14" cy="17" r="3.5" fill="white" />
        <circle cx="26" cy="17" r="3.5" fill="white" />
        <circle cx="15" cy="18" r="1.8" fill="#2D3047" />
        <circle cx="27" cy="18" r="1.8" fill="#2D3047" />
        <path d="M15 26 Q20 30, 25 26" stroke="#2D3047" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
    </div>
  );
}
