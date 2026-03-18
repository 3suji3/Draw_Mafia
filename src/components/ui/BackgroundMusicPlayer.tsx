"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const MUSIC_VOLUME_KEY = "draw_mafia_music_volume";
const MUSIC_ENABLED_KEY = "draw_mafia_music_enabled";

export function BackgroundMusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<"dark" | "light">("dark");
  const pathname = usePathname();
  const isGamePage = pathname?.startsWith("/game/");

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

  // 배경음악 재생 및 상태 관리
  useEffect(() => {
    if (!isReady || !audioRef.current) return;

    const audio = audioRef.current;
    const musicEnabled = window.localStorage.getItem(MUSIC_ENABLED_KEY) !== "false";

    // 무한 반복 설정 (항상 활성화)
    audio.loop = true;

    // AudioContext resume (자동재생 정책용)
    const resumeAudioContext = async () => {
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
    };

    // URL 인코딩된 파일 경로
    const themeMusicMap: Record<"light" | "dark", string> = {
      light: "/Coloring_Outside_the_Lines.mp3",
      "dark": "/Charcoal_Chromatic_Chaos.mp3",
    };

    const newSrc = themeMusicMap[currentTheme];
    const volume = parseFloat(window.localStorage.getItem(MUSIC_VOLUME_KEY) || "0.2");

    audio.volume = volume;

    // 음악 파일 변경
    if (audio.src !== newSrc) {
      audio.src = newSrc;
      audio.load();
    }

    // 무한 반복 설정 재확인 (load 후에도 유지)
    audio.loop = true;

    // 게임 페이지 여부에 따른 음소거 상태 설정
    const shouldBeMuted = isGamePage || !musicEnabled;
    audio.muted = shouldBeMuted;

    // 음악 ON 상태면 재생
    if (musicEnabled) {
      if (audio.paused) {
        audio.play().catch((err: any) => {
          console.warn("[배경음악] 재생 실패:", err?.message || err);
        });
      }
      const status = isGamePage ? "(무한 반복 중, 음소거)" : "(배경음악 재생 중)";
      console.log(
        `[배경음악] ${currentTheme === "light" ? "라이트" : "다크"}모드 음악 ${status} ✓`
      );
    } else {
      // 음악이 OFF일 때는 중지
      if (!audio.paused) {
        audio.pause();
      }
    }
  }, [isReady, currentTheme, isGamePage]);

  if (!isReady) return null;

  return (
    <audio
      ref={audioRef}
      loop
      style={{ display: "none" }}
      title="배경음악"
      onEnded={() => {
        // loop 속성이 있어도 확실하게 처음부터 재생
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          const musicEnabled = window.localStorage.getItem(MUSIC_ENABLED_KEY) !== "false";
          if (musicEnabled && !audioRef.current.paused) {
            audioRef.current.play().catch(() => {});
          }
        }
      }}
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
