"use client";

import { useEffect, useState } from "react";
import { Button } from "./Button";

const MUSIC_ENABLED_KEY = "draw_mafia_music_enabled";

export function MusicToggle() {
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(MUSIC_ENABLED_KEY);
    if (saved === "true") {
      setMusicEnabled(true);
    }
    setIsReady(true);
  }, []);

  const toggleMusic = () => {
    const nextState = !musicEnabled;
    setMusicEnabled(nextState);
    window.localStorage.setItem(MUSIC_ENABLED_KEY, String(nextState));

    // 음악 즉시 제어
    const audio = document.querySelector<HTMLAudioElement>('audio[title="배경음악"]');
    if (audio) {
      if (nextState) {
        // ON으로 토글할 때: loop 재설정 후 재생
        audio.loop = true;
        audio.play().catch((err) => {
          console.warn("[배경음악] 재생 실패:", err);
        });
      } else {
        // OFF로 토글할 때: 정지
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
      className="fixed left-4 top-4 z-50 hidden min-w-[84px] px-2 py-1 text-[10px] md:inline-flex"
      aria-label="배경음악 전환"
    >
      {musicEnabled ? "🎵 ON" : "🔇 OFF"}
    </Button>
  );
}
