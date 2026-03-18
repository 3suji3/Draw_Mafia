"use client";

import { useEffect, useRef, useState } from "react";

const THEME_STORAGE_KEY = "draw_mafia_theme";
const MUSIC_VOLUME_KEY = "draw_mafia_music_volume";
const MUSIC_ENABLED_KEY = "draw_mafia_music_enabled";

export function BackgroundMusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    setIsReady(true);
  }, []);

  // 테마 변경 감지 (MutationObserver로 html.light class 변경 감시)
  useEffect(() => {
    const checkTheme = () => {
      const theme = document.documentElement.classList.contains("light") ? "light" : "dark";
      setCurrentTheme(theme);
    };

    checkTheme();

    const observer = new MutationObserver(() => {
      checkTheme();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  // 사용자 상호작용 감지 (자동재생 정책 우회)
  useEffect(() => {
    if (hasUserInteracted) return;

    const handleInteraction = () => {
      setHasUserInteracted(true);
      document.removeEventListener("click", handleInteraction);
      document.removeEventListener("keydown", handleInteraction);
      document.removeEventListener("touchstart", handleInteraction);
    };

    document.addEventListener("click", handleInteraction);
    document.addEventListener("keydown", handleInteraction);
    document.addEventListener("touchstart", handleInteraction);

    return () => {
      document.removeEventListener("click", handleInteraction);
      document.removeEventListener("keydown", handleInteraction);
      document.removeEventListener("touchstart", handleInteraction);
    };
  }, [hasUserInteracted]);

  useEffect(() => {
    if (!isReady || !hasUserInteracted) return;

    const initAudio = async () => {
      const musicEnabled = window.localStorage.getItem(MUSIC_ENABLED_KEY) !== "false";

      if (!audioRef.current) {
        audioRef.current = new Audio();
        audioRef.current.loop = true;
      }

      // AudioContext resume (자동재생 정책용)
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
          const ctx = new AudioContext();
          if (ctx.state === "suspended") {
            await ctx.resume();
          }
        }
      } catch (err) {
        // AudioContext 초기화 실패는 무시
      }

      // URL 인코딩된 파일 경로
      const themeMusicMap: Record<"light" | "dark", string> = {
        light: "/Shtriker%20Big%20Band%20-%20Lemonade.mp3",
        "dark": "/O%20P%20Baron%20-%20Honey%20You%27re%20My%20Sweetie%20feat%20The%20Hazelnuts.mp3",
      };

      const newSrc = themeMusicMap[currentTheme];
      const volume = parseFloat(window.localStorage.getItem(MUSIC_VOLUME_KEY) || "0.2");

      audioRef.current.volume = volume;

      // 음악 파일 변경 또는 첫 재생
      if (audioRef.current.src !== newSrc) {
        audioRef.current.src = newSrc;
        audioRef.current.load(); // 새 파일 로드
      }

      if (musicEnabled && audioRef.current.paused) {
        try {
          await audioRef.current.play();
          console.log(`[배경음악] ${currentTheme === "light" ? "라이트" : "다크"}모드 음악 재생 ✓`);
        } catch (err: any) {
          console.warn("[배경음악] 재생 실패:", err?.message || err);
        }
      }
    };

    initAudio();
  }, [isReady, hasUserInteracted, currentTheme]);

  if (!isReady) return null;

  return (
    <audio
      ref={audioRef}
      style={{ display: "none" }}
      title="배경음악"
      onError={(e) => {
        console.error("[배경음악] 오류:", e);
      }}
    />
  );
}
