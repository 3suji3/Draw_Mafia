"use client";

import { useEffect, useRef, useState } from "react";

const THEME_STORAGE_KEY = "draw_mafia_theme";
const MUSIC_VOLUME_KEY = "draw_mafia_music_volume";
const MUSIC_ENABLED_KEY = "draw_mafia_music_enabled";

export function BackgroundMusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isReady, setIsReady] = useState(false);
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

  useEffect(() => {
    if (!isReady) return;

    const initAudio = async () => {
      const musicEnabled = window.localStorage.getItem(MUSIC_ENABLED_KEY) !== "false";

      if (!audioRef.current) {
        audioRef.current = new Audio();
        audioRef.current.loop = true;
        // 음소거 상태에서 시작 (자동재생 정책 우회)
        audioRef.current.muted = true;
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
        light: "/Coloring_Outside_the_Lines.mp3",
        "dark": "/Charcoal_Chromatic_Chaos.mp3",
      };

      const newSrc = themeMusicMap[currentTheme];
      const volume = parseFloat(window.localStorage.getItem(MUSIC_VOLUME_KEY) || "0.2");

      audioRef.current.volume = volume;

      // 음악 파일 변경 또는 첫 재생
      if (audioRef.current.src !== newSrc) {
        audioRef.current.src = newSrc;
        audioRef.current.load();
      }

      try {
        // 음소거 상태에서 재생하고 바로 음소거 해제
        await audioRef.current.play();
        if (musicEnabled) {
          audioRef.current.muted = false;
        }
        console.log(`[배경음악] ${currentTheme === "light" ? "라이트" : "다크"}모드 음악 자동 재생 ✓`);
      } catch (err: any) {
        console.warn("[배경음악] 자동 재생 실패:", err?.message || err);
        // 실패해도 음소거 상태로 계속 유지
      }
    };

    initAudio();
  }, [isReady, currentTheme]);

  if (!isReady) return null;

  return (
    <audio
      ref={audioRef}
      style={{ display: "none" }}
      title="배경음악"
      onError={(e) => {
        const audio = e.currentTarget as HTMLAudioElement;
        if (audio?.error) {
          console.warn(
            `[배경음악] 재생 오류 (코드: ${audio.error.code}):`,
            audio.error.message || "알 수 없는 오류"
          );
        }
      }}
    />
  );
}
