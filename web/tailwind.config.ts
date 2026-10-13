import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#12142B",
        night: "#1C2052",
        dusk: "#2E3274",
        tide: "#3E4A9A",
        paper: "#F3ECDC",
        parchment: "#E7DCC2",
        lantern: "#F2C94C",
        moss: "#5DCAA5",
        petal: "#F4A0BC",
        ember: "#E8704A",
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        sans: ["Figtree", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      keyframes: {
        drift: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        twinkle: {
          "0%, 100%": { opacity: "0.35" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        drift: "drift 7s ease-in-out infinite",
        "drift-slow": "drift 11s ease-in-out infinite",
        twinkle: "twinkle 3.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
