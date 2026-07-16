import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        asphalt: {
          950: "#0B0D10",
          900: "#12151A",
          800: "#1A1F26",
          700: "#242A33",
          600: "#333B47",
        },
        signal: {
          DEFAULT: "#FF6B1A",
          dim: "#B4501A",
          soft: "#FFB088",
        },
        steel: {
          DEFAULT: "#3E7CB1",
          light: "#6FA8DC",
        },
        caution: "#F2C94C",
        ok: "#3FB27F",
        bad: "#E2543A",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
        body: ["var(--font-body)", "sans-serif"],
      },
      backgroundImage: {
        diamond:
          "repeating-linear-gradient(135deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 12px)",
      },
    },
  },
  plugins: [],
};
export default config;
