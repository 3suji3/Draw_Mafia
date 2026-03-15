"use client";

import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

/** `ThemeToggle` button을 게임 페이지(/game/*)에서는 숨긴다. */
export function ConditionalThemeToggle() {
  const pathname = usePathname();
  if (pathname?.startsWith("/game/")) return null;
  return <ThemeToggle />;
}
