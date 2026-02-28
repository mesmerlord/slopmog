import { ImageResponse } from "next/og";

export const config = {
  runtime: "edge",
};

export default async function handler(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Dynamic params with fallbacks
    const title = searchParams.get("title") || "Get Your Brand Into AI Recommendations";
    const description =
      searchParams.get("description") || "The name is ridiculous. The results aren't.";

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "row",
            position: "relative",
            backgroundColor: "#FFF8F0", // Brand cream background
            overflow: "hidden",
            fontFamily: 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          }}
        >
          {/* Background decorative grid */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.5,
              backgroundImage: "radial-gradient(#2D3047 1px, transparent 1px)",
              backgroundSize: "40px 40px",
              zIndex: 0,
            }}
          />

          {/* Top-right teal glow */}
          <div
            style={{
              position: "absolute",
              top: "-20%",
              right: "-10%",
              width: "70%",
              height: "140%",
              background: "radial-gradient(circle, rgba(46,196,182,0.12) 0%, rgba(255,248,240,0) 65%)",
              zIndex: 0,
            }}
          />

          {/* ── Left Content Column ── */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              width: "55%",
              paddingLeft: "80px",
              paddingRight: "20px",
              zIndex: 10,
              height: "100%",
            }}
          >
            {/* Logo area */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                marginBottom: "40px",
              }}
            >
              <svg width="48" height="48" viewBox="0 0 100 100">
                <line x1="50" y1="15" x2="50" y2="30" stroke="#FF6B6B" strokeWidth="5" strokeLinecap="round" />
                <circle cx="50" cy="12" r="6" fill="#FFD93D" />
                <ellipse cx="15" cy="65" rx="10" ry="7" fill="#e55a5a" transform="rotate(-20, 15, 65)" />
                <ellipse cx="85" cy="65" rx="10" ry="7" fill="#e55a5a" transform="rotate(20, 85, 65)" />
                <ellipse cx="50" cy="60" rx="40" ry="36" fill="#FF6B6B" />
                <circle cx="35" cy="52" r="10" fill="white" />
                <circle cx="65" cy="52" r="10" fill="white" />
                <circle cx="37" cy="52" r="4.5" fill="#2D3047" />
                <circle cx="67" cy="52" r="4.5" fill="#2D3047" />
                <circle cx="34" cy="49" r="2.5" fill="white" />
                <circle cx="64" cy="49" r="2.5" fill="white" />
                <path d="M 40 70 Q 50 78, 60 70" stroke="#2D3047" strokeWidth="3" fill="none" strokeLinecap="round" />
              </svg>
              <span
                style={{
                  fontSize: 32,
                  fontWeight: 800,
                  color: "#2D3047",
                  letterSpacing: "-0.5px",
                }}
              >
                SlopMog
              </span>
            </div>

            {/* Headline */}
            <div
              style={{
                fontSize: 64,
                fontWeight: 800,
                color: "#2D3047",
                lineHeight: 1.1,
                letterSpacing: "-1.5px",
                marginBottom: "24px",
                maxWidth: "600px",
              }}
            >
              {title}
            </div>

            {/* Subtitle */}
            <div
              style={{
                fontSize: 32,
                color: "#4a4d63",
                fontWeight: 500,
                lineHeight: 1.4,
                marginBottom: "48px",
                maxWidth: "520px",
              }}
            >
              {description}
            </div>

            {/* Feature Badges Row */}
            <div style={{ display: "flex", gap: "16px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "12px 24px",
                  backgroundColor: "white",
                  borderRadius: "50px",
                  border: "2px solid rgba(46,196,182,0.3)",
                  boxShadow: "0 4px 20px rgba(45,48,71,0.06)",
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" fill="#2EC4B6" />
                  <path d="M8 12L11 15L16 9" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ fontSize: 20, color: "#2D3047", fontWeight: 700 }}>AI Optimized</span>
              </div>
              
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "12px 24px",
                  backgroundColor: "white",
                  borderRadius: "50px",
                  border: "2px solid rgba(255,107,107,0.3)",
                  boxShadow: "0 4px 20px rgba(45,48,71,0.06)",
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L15 8.5L22 9.5L17 14.5L18.5 21.5L12 18L5.5 21.5L7 14.5L2 9.5L9 8.5L12 2Z" fill="#FFD93D" />
                </svg>
                <span style={{ fontSize: 20, color: "#2D3047", fontWeight: 700 }}>5x Visibility</span>
              </div>
            </div>
          </div>

          {/* ── Right Floating Composition Column ── */}
          <div
            style={{
              width: "45%",
              height: "100%",
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10,
            }}
          >
            {/* Center Coral Glow Behind Mascot */}
            <div
              style={{
                position: "absolute",
                top: "15%",
                left: "15%",
                width: "70%",
                height: "70%",
                background: "radial-gradient(circle, rgba(255,107,107,0.15) 0%, rgba(255,248,240,0) 70%)",
                borderRadius: "50%",
                zIndex: 0,
              }}
            />

            {/* Giant Mascot Blob */}
            <div style={{ display: "flex", position: "relative", zIndex: 20 }}>
              <svg width="340" height="340" viewBox="0 0 100 100">
                <line x1="50" y1="12" x2="50" y2="30" stroke="#FF6B6B" strokeWidth="5" strokeLinecap="round" />
                <circle cx="50" cy="9" r="6" fill="#FFD93D" />
                <ellipse cx="12" cy="65" rx="11" ry="8" fill="#e55a5a" transform="rotate(-20, 12, 65)" />
                <ellipse cx="88" cy="65" rx="11" ry="8" fill="#e55a5a" transform="rotate(20, 88, 65)" />
                <ellipse cx="50" cy="60" rx="42" ry="38" fill="#FF6B6B" />
                <circle cx="34" cy="52" r="11" fill="white" />
                <circle cx="66" cy="52" r="11" fill="white" />
                <circle cx="36" cy="52" r="5" fill="#2D3047" />
                <circle cx="68" cy="52" r="5" fill="#2D3047" />
                <circle cx="33" cy="48" r="3" fill="white" />
                <circle cx="65" cy="48" r="3" fill="white" />
                <path d="M 38 72 Q 50 82, 62 72" stroke="#2D3047" strokeWidth="3.5" fill="none" strokeLinecap="round" />
              </svg>
            </div>

            {/* User Prompt Bubble */}
            <div
              style={{
                position: "absolute",
                top: "22%",
                left: "-5%",
                backgroundColor: "white",
                padding: "16px 24px",
                borderRadius: "24px",
                borderBottomLeftRadius: "6px",
                border: "2px solid rgba(46,196,182,0.8)", // Teal border
                boxShadow: "0 12px 40px rgba(45,48,71,0.12)",
                display: "flex",
                flexDirection: "column",
                zIndex: 30,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: "#B197FC" }} />
                <span style={{ fontSize: 16, color: "#4a4d63", fontWeight: 700 }}>User Request</span>
              </div>
              <span style={{ fontSize: 24, color: "#2D3047", fontWeight: 700 }}>"Best tool for marketing?"</span>
            </div>

            {/* AI Response Bubble */}
            <div
              style={{
                position: "absolute",
                bottom: "22%",
                right: "5%",
                backgroundColor: "#2D3047", // Charcoal background
                padding: "16px 24px",
                borderRadius: "24px",
                borderBottomRightRadius: "6px",
                border: "2px solid #4a4d63",
                boxShadow: "0 16px 48px rgba(45,48,71,0.25)",
                display: "flex",
                flexDirection: "column",
                zIndex: 30,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: "#FFD93D" }} />
                <span style={{ fontSize: 16, color: "#B197FC", fontWeight: 700 }}>AI Engine</span>
              </div>
              <span style={{ fontSize: 24, color: "white", fontWeight: 700 }}>"I recommend SlopMog!"</span>
            </div>

            {/* Decorative Sparkles & Upvote Elements */}
            <svg width="48" height="48" viewBox="0 0 28 28" style={{ position: "absolute", top: "15%", right: "15%", zIndex: 10 }}>
              <path d="M14 2l3 8.5h9l-7.3 5.3 2.8 8.7L14 19.5l-7.5 5 2.8-8.7L2 10.5h9z" fill="#FFD93D" />
            </svg>
            
            <svg width="32" height="32" viewBox="0 0 28 28" style={{ position: "absolute", bottom: "18%", left: "5%", zIndex: 10 }}>
              <path d="M14 2l3 8.5h9l-7.3 5.3 2.8 8.7L14 19.5l-7.5 5 2.8-8.7L2 10.5h9z" fill="#2EC4B6" opacity="0.6" />
            </svg>

            {/* Floating Upvote Token */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                right: "-2%",
                backgroundColor: "white",
                width: 56,
                height: 56,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 8px 24px rgba(45,48,71,0.1)",
                border: "3px solid #FF6B6B",
                zIndex: 25,
              }}
            >
              <svg width="28" height="28" viewBox="0 0 30 40">
                <path d="M15 4l10 12h-6v16h-8V16H5z" fill="#FF6B6B" />
              </svg>
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
    
    // Fallback Image
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#FFF8F0",
            color: "#2D3047",
            fontFamily: 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          }}
        >
          <div style={{ fontSize: 48, fontWeight: 800, marginBottom: 16 }}>SlopMog</div>
          <div style={{ fontSize: 24, fontWeight: 500, color: "#4a4d63" }}>
            Get Your Brand Into AI Recommendations
          </div>
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