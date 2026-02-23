import { ImageResponse } from "next/og";

export const config = {
  runtime: "edge",
};

export default async function handler() {
  try {
    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            position: "relative",
            backgroundColor: "#2D3047",
            overflow: "hidden",
          }}
        >
          {/* ── Decorative background elements ── */}

          {/* Coral blob circles (mascot vibes) */}
          <div
            style={{
              position: "absolute",
              top: 40,
              left: 80,
              width: 120,
              height: 120,
              borderRadius: "50%",
              backgroundColor: "#FF6B6B",
              opacity: 0.15,
              display: "flex",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 160,
              right: 140,
              width: 80,
              height: 80,
              borderRadius: "50%",
              backgroundColor: "#FF6B6B",
              opacity: 0.12,
              display: "flex",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 60,
              right: 320,
              width: 50,
              height: 50,
              borderRadius: "50%",
              backgroundColor: "#FF6B6B",
              opacity: 0.1,
              display: "flex",
            }}
          />

          {/* Teal dashed circles */}
          <svg
            width="90"
            height="90"
            viewBox="0 0 90 90"
            style={{ position: "absolute", top: 30, right: 80 }}
          >
            <circle
              cx="45"
              cy="45"
              r="40"
              stroke="#2EC4B6"
              strokeWidth="2.5"
              strokeDasharray="8 6"
              fill="none"
              opacity="0.25"
            />
          </svg>
          <svg
            width="60"
            height="60"
            viewBox="0 0 60 60"
            style={{ position: "absolute", top: 180, left: 300 }}
          >
            <circle
              cx="30"
              cy="30"
              r="26"
              stroke="#2EC4B6"
              strokeWidth="2"
              strokeDasharray="6 5"
              fill="none"
              opacity="0.2"
            />
          </svg>

          {/* Yellow stars/sparkles */}
          <svg
            width="28"
            height="28"
            viewBox="0 0 28 28"
            style={{ position: "absolute", top: 50, left: 350 }}
          >
            <path
              d="M14 2l3 8.5h9l-7.3 5.3 2.8 8.7L14 19.5l-7.5 5 2.8-8.7L2 10.5h9z"
              fill="#FFD93D"
              opacity="0.3"
            />
          </svg>
          <svg
            width="22"
            height="22"
            viewBox="0 0 28 28"
            style={{ position: "absolute", top: 140, right: 380 }}
          >
            <path
              d="M14 2l3 8.5h9l-7.3 5.3 2.8 8.7L14 19.5l-7.5 5 2.8-8.7L2 10.5h9z"
              fill="#FFD93D"
              opacity="0.25"
            />
          </svg>
          <svg
            width="18"
            height="18"
            viewBox="0 0 28 28"
            style={{ position: "absolute", top: 90, right: 200 }}
          >
            <path
              d="M14 2l3 8.5h9l-7.3 5.3 2.8 8.7L14 19.5l-7.5 5 2.8-8.7L2 10.5h9z"
              fill="#FFD93D"
              opacity="0.2"
            />
          </svg>

          {/* Lavender rounded rects */}
          <div
            style={{
              position: "absolute",
              top: 100,
              left: 600,
              width: 70,
              height: 35,
              borderRadius: 12,
              backgroundColor: "#B197FC",
              opacity: 0.12,
              display: "flex",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 40,
              left: 500,
              width: 45,
              height: 25,
              borderRadius: 10,
              backgroundColor: "#B197FC",
              opacity: 0.1,
              display: "flex",
            }}
          />

          {/* Speech bubble shapes */}
          <svg
            width="70"
            height="55"
            viewBox="0 0 70 55"
            style={{ position: "absolute", top: 120, left: 140 }}
          >
            <rect
              x="2"
              y="2"
              width="66"
              height="40"
              rx="12"
              fill="none"
              stroke="#2EC4B6"
              strokeWidth="2"
              opacity="0.15"
            />
            <path
              d="M18 42l8-0 -4 10z"
              fill="none"
              stroke="#2EC4B6"
              strokeWidth="2"
              opacity="0.15"
            />
          </svg>
          <svg
            width="55"
            height="45"
            viewBox="0 0 55 45"
            style={{ position: "absolute", top: 50, right: 500 }}
          >
            <rect
              x="2"
              y="2"
              width="51"
              height="32"
              rx="10"
              fill="none"
              stroke="#FF6B6B"
              strokeWidth="2"
              opacity="0.12"
            />
            <path
              d="M14 34l6-0 -3 8z"
              fill="none"
              stroke="#FF6B6B"
              strokeWidth="2"
              opacity="0.12"
            />
          </svg>

          {/* Reddit upvote arrow */}
          <svg
            width="30"
            height="40"
            viewBox="0 0 30 40"
            style={{ position: "absolute", top: 160, left: 500 }}
          >
            <path
              d="M15 4l10 12h-6v16h-8V16H5z"
              fill="#FF6B6B"
              opacity="0.18"
            />
          </svg>
          <svg
            width="24"
            height="32"
            viewBox="0 0 30 40"
            style={{ position: "absolute", top: 80, left: 780 }}
          >
            <path
              d="M15 4l10 12h-6v16h-8V16H5z"
              fill="#FF6B6B"
              opacity="0.14"
            />
          </svg>

          {/* ── Gradient overlay for bottom content area ── */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 400,
              background:
                "linear-gradient(to bottom, rgba(45,48,71,0) 0%, rgba(45,48,71,0.85) 40%, rgba(45,48,71,1) 70%)",
              display: "flex",
            }}
          />

          {/* ── Content section ── */}
          <div
            style={{
              position: "absolute",
              bottom: 50,
              left: 70,
              right: 70,
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            {/* Logo blob + brand name */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
            >
              {/* Mascot blob SVG */}
              <svg
                width="56"
                height="56"
                viewBox="0 0 56 56"
              >
                {/* Antenna */}
                <line
                  x1="28"
                  y1="6"
                  x2="28"
                  y2="14"
                  stroke="#FF6B6B"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <circle cx="28" cy="4" r="3" fill="#FFD93D" />
                {/* Body */}
                <ellipse
                  cx="28"
                  cy="33"
                  rx="22"
                  ry="20"
                  fill="#FF6B6B"
                />
                {/* Eyes */}
                <circle cx="20" cy="29" r="5" fill="white" />
                <circle cx="36" cy="29" r="5" fill="white" />
                <circle cx="21" cy="30" r="2.5" fill="#2D3047" />
                <circle cx="37" cy="30" r="2.5" fill="#2D3047" />
                {/* Eye shine */}
                <circle cx="19" cy="28" r="1.2" fill="white" opacity="0.8" />
                <circle cx="35" cy="28" r="1.2" fill="white" opacity="0.8" />
                {/* Smile */}
                <path
                  d="M22 37 Q28 42, 34 37"
                  stroke="#2D3047"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />
                {/* Arms */}
                <ellipse
                  cx="5"
                  cy="35"
                  rx="5"
                  ry="3.5"
                  fill="#e55a5a"
                  transform="rotate(-20, 5, 35)"
                />
                <ellipse
                  cx="51"
                  cy="35"
                  rx="5"
                  ry="3.5"
                  fill="#e55a5a"
                  transform="rotate(20, 51, 35)"
                />
              </svg>
              <div
                style={{
                  fontSize: 38,
                  fontWeight: 700,
                  color: "white",
                  letterSpacing: "-0.5px",
                }}
              >
                SlopMog
              </div>
            </div>

            {/* Headline */}
            <div
              style={{
                fontSize: 52,
                fontWeight: 700,
                color: "white",
                lineHeight: 1.15,
                maxWidth: 800,
              }}
            >
              Get Your Brand Into AI Recommendations
            </div>

            {/* Social proof line */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 24,
                marginTop: 4,
              }}
            >
              <div
                style={{
                  fontSize: 20,
                  color: "#2EC4B6",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <circle cx="9" cy="9" r="8" fill="#2EC4B6" />
                  <path
                    d="M6 9l2 2 4-4"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
                10,000+ comments placed
              </div>
              <div
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  backgroundColor: "#4a4d63",
                  display: "flex",
                }}
              />
              <div
                style={{
                  fontSize: 20,
                  color: "#2EC4B6",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <circle cx="9" cy="9" r="8" fill="#2EC4B6" />
                  <path
                    d="M6 9l2 2 4-4"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
                400+ brands boosted
              </div>
              <div
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  backgroundColor: "#4a4d63",
                  display: "flex",
                }}
              />
              <div
                style={{
                  fontSize: 20,
                  color: "#FFD93D",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 28 28">
                  <path
                    d="M14 2l3 8.5h9l-7.3 5.3 2.8 8.7L14 19.5l-7.5 5 2.8-8.7L2 10.5h9z"
                    fill="#FFD93D"
                  />
                </svg>
                5x avg. visibility lift
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.log(message);
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#2D3047",
            color: "white",
            fontSize: 24,
          }}
        >
          SlopMog — Get Your Brand Into AI Recommendations
        </div>
      ),
      {
        width: 1200,
        height: 630,
        status: 500,
      }
    );
  }
}
