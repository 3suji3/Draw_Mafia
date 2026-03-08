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
          muted: "rgb(var(--dm-card-muted) / <alpha-value>)",
          border: "rgb(var(--dm-card-border) / <alpha-value>)",
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
        "dm-soft": "var(--dm-card-shadow)",
        "dm-glow": "0 0 0 1px rgba(124,108,255,0.38), 0 0 24px rgba(124,108,255,0.2)",
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
