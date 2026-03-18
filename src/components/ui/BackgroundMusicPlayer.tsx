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
    if (!isReady) return;

    const initAudio = async () => {
      const musicEnabled = window.localStorage.getItem(MUSIC_ENABLED_KEY) !== "false";

      if (!audioRef.current) {
        audioRef.current = new Audio();
        // 무한 반복 설정
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
        light: "/Coloring_Outside_the_Lines.mp3",
        "dark": "/Charcoal_Chromatic_Chaos.mp3",
      };

      const newSrc = themeMusicMap[currentTheme];
      const volume = parseFloat(window.localStorage.getItem(MUSIC_VOLUME_KEY) || "0.2");

      audioRef.current.volume = volume;

      // 음악 파일 변경
      if (audioRef.current.src !== newSrc) {
        audioRef.current.src = newSrc;
        audioRef.current.load();
      }

      // 게임 페이지 여부에 따른 음소거 상태 설정
      // 게임 플레이 중: 배경음악 항상 음소거 (효과음만 들리도록)
      // 로비/대기방: 음악 ON 상태면 음소거 해제
      const shouldBeMuted = isGamePage || !musicEnabled;
      audioRef.current.muted = shouldBeMuted;

      // 음악 ON 상태면 항상 재생 (첫 로딩 시 자동 재생 보장)
      if (musicEnabled) {
        try {
          // 이미 재생 중이면 무시, 정지 중이면 재생
          if (audioRef.current.paused) {
            await audioRef.current.play();
          }
          const status = isGamePage ? "(무한 반복 중, 음소거)" : "(배경음악 재생 중)";
          console.log(
            `[배경음악] ${currentTheme === "light" ? "라이트" : "다크"}모드 음악 ${status} ✓`
          );
        } catch (err: any) {
          console.warn("[배경음악] 자동 재생 실패:", err?.message || err);
        }
      } else {
        // 음악이 OFF일 때는 중지
        if (!audioRef.current.paused) {
          audioRef.current.pause();
        }
      }
    };

    initAudio();
  }, [isReady, currentTheme, isGamePage]);

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
