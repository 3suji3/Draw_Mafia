"use client";

import { useEffect, useState } from "react";
import { Button } from "./Button";

const MUSIC_ENABLED_KEY = "draw_mafia_music_enabled";

export function MusicToggle() {
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(MUSIC_ENABLED_KEY);
    if (saved === "false") {
      setMusicEnabled(false);
    }
    setIsReady(true);
  }, []);

  const toggleMusic = () => {
    const nextState = !musicEnabled;
    setMusicEnabled(nextState);
    window.localStorage.setItem(MUSIC_ENABLED_KEY, String(nextState));

    // 음악 즉시 제어
    const audio = document.querySelector("audio");
    if (audio) {
      if (nextState && audio.paused) {
        audio.play().catch(() => {
          console.warn("[배경음악] 재생 실패");
        });
      } else if (!nextState && !audio.paused) {
        audio.pause();
      }
    }
  };

  if (!isReady) return null;

  return (
    <Button
      type="button"
      onClick={toggleMusic}
      variant="ghost"
      className="fixed left-4 top-4 z-50 min-w-[84px] px-2 py-1 text-[10px]"
      aria-label="배경음악 전환"
    >
      {musicEnabled ? "🎵 ON" : "🔇 OFF"}
    </Button>
  );
}
