"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const MUSIC_VOLUME_KEY = "draw_mafia_music_volume";
const MUSIC_ENABLED_KEY = "draw_mafia_music_enabled";
const RETRY_EVENTS = ["pointerdown", "keydown", "touchstart", "click"] as const;

export function BackgroundMusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSrcRef = useRef("");
  const retryListenersRef = useRef<Array<[string, EventListener]>>([]);
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

    const cleanupRetryListeners = () => {
      for (const [eventName, handler] of retryListenersRef.current) {
        document.removeEventListener(eventName, handler, true);
      }
      retryListenersRef.current = [];
    };

    const attachRetryListeners = () => {
      if (retryListenersRef.current.length > 0) {
        return;
      }

      const tryResumePlayback = () => {
        const currentAudio = audioRef.current;
        const retryEnabled = window.localStorage.getItem(MUSIC_ENABLED_KEY) !== "false";

        if (!currentAudio || !retryEnabled || !currentAudio.paused) {
          cleanupRetryListeners();
          return;
        }

        void currentAudio.play()
          .then(() => {
            cleanupRetryListeners();
            console.log(
              `[배경음악] ${currentTheme === "light" ? "라이트" : "다크"}모드 음악 ${isGamePage ? "(무한 반복 중, 음소거)" : "(배경음악 재생 중)"} ✓`
            );
          })
          .catch(() => {
            // 다음 사용자 상호작용을 기다린다.
          });
      };

      retryListenersRef.current = RETRY_EVENTS.map((eventName) => {
        const handler: EventListener = () => {
          tryResumePlayback();
        };

        document.addEventListener(eventName, handler, true);
        return [eventName, handler];
      });
    };

    // 무한 반복 설정 (항상 활성화)
    audio.loop = true;

    // URL 인코딩된 파일 경로
    const themeMusicMap: Record<"light" | "dark", string> = {
      light: "/Coloring_Outside_the_Lines.mp3",
      dark: "/Charcoal_Chromatic_Chaos.mp3",
    };

    const newSrc = themeMusicMap[currentTheme];
    const volume = parseFloat(window.localStorage.getItem(MUSIC_VOLUME_KEY) || "0.2");

    audio.volume = volume;

    // 음악 파일 변경
    if (lastSrcRef.current !== newSrc) {
      audio.src = newSrc;
      lastSrcRef.current = newSrc;
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
        void audio.play()
          .then(() => {
            cleanupRetryListeners();
            console.log(
              `[배경음악] ${currentTheme === "light" ? "라이트" : "다크"}모드 음악 ${isGamePage ? "(무한 반복 중, 음소거)" : "(배경음악 재생 중)"} ✓`
            );
          })
          .catch((err: any) => {
            console.warn("[배경음악] 재생 실패:", err?.message || err);
            attachRetryListeners();
          });
      } else {
        cleanupRetryListeners();
        console.log(
          `[배경음악] ${currentTheme === "light" ? "라이트" : "다크"}모드 음악 ${isGamePage ? "(무한 반복 중, 음소거)" : "(배경음악 재생 중)"} ✓`
        );
      }
    } else {
      // 음악이 OFF일 때는 중지
      if (!audio.paused) {
        audio.pause();
      }
      cleanupRetryListeners();
    }
    return () => {
      cleanupRetryListeners();
    };
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
