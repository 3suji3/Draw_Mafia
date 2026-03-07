import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/hooks/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        dm: {
          bg: "rgb(var(--dm-bg) / <alpha-value>)",
          card: "rgb(var(--dm-card) / <alpha-value>)",
          primary: "rgb(var(--dm-primary) / <alpha-value>)",
          accent: "rgb(var(--dm-accent) / <alpha-value>)",
          secondary: "rgb(var(--dm-secondary) / <alpha-value>)",
          text: {
            primary: "rgb(var(--dm-text-primary) / <alpha-value>)",
            secondary: "rgb(var(--dm-text-secondary) / <alpha-value>)",
            subtext: "rgb(var(--dm-text-subtext) / <alpha-value>)",
          },
        },
      },
      boxShadow: {
        "dm-soft": "0 10px 30px rgba(0, 0, 0, 0.08)",
        "dm-glow": "0 0 0 1px rgba(138,125,255,0.45), 0 0 28px rgba(138,125,255,0.25)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        "slide-up": "slide-up 0.2s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
