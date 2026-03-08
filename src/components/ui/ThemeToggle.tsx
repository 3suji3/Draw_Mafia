"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

const THEME_STORAGE_KEY = "draw_mafia_theme";

function applyTheme(theme: Theme) {
  const root = document.documentElement;

  if (theme === "light") {
    root.classList.add("light");
    return;
  }

  root.classList.remove("light");
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);

    if (stored === "light" || stored === "dark") {
      setTheme(stored);
      applyTheme(stored);
      return;
    }

    applyTheme("dark");
  }, []);

  const toggleTheme = () => {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="fixed right-4 top-4 z-50 inline-flex min-h-[38px] min-w-[96px] items-center justify-center whitespace-nowrap rounded-full border border-dm-primary/35 bg-dm-card/95 px-3 py-1.5 text-xs font-semibold text-dm-text-primary shadow-dm-soft transition hover:-translate-y-[1px] hover:brightness-110"
      aria-label="테마 전환"
    >
      {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
    </button>
  );
}
