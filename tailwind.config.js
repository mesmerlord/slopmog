/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#FFF8F0",
        teal: { DEFAULT: "#2EC4B6", dark: "#25a89c", light: "#e8f8f6", bg: "#f0faf9" },
        coral: { DEFAULT: "#FF6B6B", dark: "#e55a5a", light: "#FF8E8E" },
        sunny: { DEFAULT: "#FFD93D", light: "#FFE56B", dark: "#E8C225" },
        lavender: { DEFAULT: "#B197FC", light: "#D0BFFF", dark: "#9775E6" },
        charcoal: { DEFAULT: "#2D3047", light: "#4a4d63" },
      },
      fontFamily: {
        heading: ["Quicksand", "sans-serif"],
        body: ["Nunito", "sans-serif"],
      },
      borderRadius: {
        brand: "16px",
        "brand-sm": "10px",
        "brand-lg": "24px",
      },
      boxShadow: {
        "brand-sm": "0 2px 8px rgba(45,48,71,0.06)",
        "brand-md": "0 4px 20px rgba(45,48,71,0.08)",
        "brand-lg": "0 8px 40px rgba(45,48,71,0.12)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
