"use client";

import { usePathname } from "next/navigation";
import { MusicToggle } from "./MusicToggle";

/** 게임 페이지(/game/*)를 제외한 모든 페이지에서 음악 토글 버튼을 표시한다. */
export function ConditionalMusicToggle() {
  const pathname = usePathname();
  if (pathname?.startsWith("/game/")) return null;
  return <MusicToggle />;
}
