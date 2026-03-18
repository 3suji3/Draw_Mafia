"use client";

import { useEffect, useRef, useState } from "react";

const THEME_STORAGE_KEY = "draw_mafia_theme";
const MUSIC_VOLUME_KEY = "draw_mafia_music_volume";

export function BackgroundMusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // 클라이언트 사이드만 실행
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady) return;

    const updateMusic = () => {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      const theme: "dark" | "light" = stored === "light" ? "light" : "dark";

      // 라이트 모드: S로 시작, 다크 모드: O로 시작
      const musicPrefix = theme === "light" ? "S" : "O";

      // public 폴더에서 해당 prefix로 시작하는 파일 찾기
      if (!audioRef.current) {
        audioRef.current = new Audio();
        audioRef.current.loop = true;
        audioRef.current.volume = parseFloat(
          window.localStorage.getItem(MUSIC_VOLUME_KEY) || "0.3"
        );
      }

      // 현재 재생중인 음악
      const currentSrc = audioRef.current.src;
      const themeMusicMap: Record<"light" | "dark", string> = {
        light: "/Shtriker Big Band - Lemonade.mp3",
        "dark": "/O P Baron - Honey You're My Sweetie feat The Hazelnuts.mp3",
      };
      const newSrc = themeMusicMap[theme];

      // 음악 파일이 변경되었으면 바꾸기
      if (!currentSrc.includes(newSrc)) {
        audioRef.current.src = newSrc;
        audioRef.current.play().catch(() => {
          // 자동 재생 정책으로 인해 실패할 수 있음
        });
      }
    };

    // 초기 설정
    updateMusic();

    // 테마 변경 감지 (storage 이벤트)
    window.addEventListener("storage", updateMusic);
    return () => window.removeEventListener("storage", updateMusic);
  }, [isReady]);

  if (!isReady) return null;

  return (
    <audio
      ref={audioRef}
      style={{ display: "none" }}
      title="배경음악"
    />
  );
}
