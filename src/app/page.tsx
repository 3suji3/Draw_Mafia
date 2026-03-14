"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { GameDialog } from "@/components/modals/GameDialog";
import { Button, Card, LoadingSpinner } from "@/components/ui";
import { PLAYER_LIMITS, DRAW_TIME_OPTIONS, VOTE_TIME_SECONDS } from "@/constants/game";
import { db } from "@/firebase/firebase";
import { getOrCreatePlayerId, getStoredNickname, persistPlayerContext } from "@/utils/player";
import { generateRoomCode, normalizeRoomCode } from "@/utils/roomCode";
import { resolveTestMode } from "@/utils/testMode";
import type { Room, Player } from "@/types/room";
import mafiaImage from "@/public/mafia.png";

const DEFAULT_DRAW_TIME = DRAW_TIME_OPTIONS[0];
const MAX_ROOM_CODE_RETRY = 10;

type DialogState = {
  open: boolean;
  title: string;
  description: string;
};

const INITIAL_DIALOG: DialogState = {
  open: false,
  title: "",
  description: "",
};

function formatFirestoreError(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code: unknown }).code ?? "");

    if (code.includes("permission-denied")) {
      return "권한 오류(permission-denied): Firestore Rules 또는 Firebase 설정을 확인해주세요.";
    }

    if (code.includes("unavailable")) {
      return "네트워크 오류(unavailable): 잠시 후 다시 시도해주세요.";
    }

    if (code.includes("invalid-argument")) {
      return "요청 형식 오류(invalid-argument): 입력값을 다시 확인해주세요.";
    }

    return `오류 코드: ${code}`;
  }

  return "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
}

export default function HomePage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(INITIAL_DIALOG);
  const [testQuerySuffix, setTestQuerySuffix] = useState("");

  useEffect(() => {
    const storedNickname = getStoredNickname();

    if (storedNickname) {
      setNickname(storedNickname);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const result = resolveTestMode(new URLSearchParams(window.location.search));
    setTestQuerySuffix(result.testQuerySuffix);
  }, []);

  const openDialog = (title: string, description: string) => {
    setDialog({ open: true, title, description });
  };

  const closeDialog = (open: boolean) => {
    setDialog((prev) => ({ ...prev, open }));
  };

  const validateNickname = (): string | null => {
    const trimmed = nickname.trim();

    if (!trimmed) {
      return "닉네임을 입력해주세요.";
    }

    return null;
  };

  const createRoom = async () => {
    const nicknameError = validateNickname();

    if (nicknameError) {
      openDialog("입력 확인", nicknameError);
      return;
    }

    setIsLoading(true);

    try {
      const playerId = getOrCreatePlayerId();
      const trimmedNickname = nickname.trim();

      if (!playerId) {
        openDialog("오류", "플레이어 정보를 생성할 수 없습니다.");
        return;
      }

      let createdRoomId = "";

      for (let attempt = 0; attempt < MAX_ROOM_CODE_RETRY; attempt += 1) {
        const nextRoomId = generateRoomCode();
        const roomRef = doc(db, "rooms", nextRoomId);
        const roomSnap = await getDoc(roomRef);

        if (roomSnap.exists()) {
          continue;
        }

        const roomPayload = {
          id: nextRoomId,
          hostId: playerId,
          status: "waiting",
          maxPlayers: PLAYER_LIMITS.max,
          drawTime: DEFAULT_DRAW_TIME,
          voteTime: VOTE_TIME_SECONDS,
          gameSession: 0,
          round: 1,
          turnIndex: 0,
          turnOrder: [],
          prompt: {
            citizenAction: "",
            mafiaAction: "",
            citizenSubject: "",
            mafiaSubject: "",
            category: "",
          },
          mafiaId: "",
          endedByHostLeave: false,
        };

        const hostPayload: Player = {
          id: playerId,
          nickname: trimmedNickname,
          role: "citizen",
          alive: true,
          isHost: true,
          joinedAt: serverTimestamp(),
        };

        await setDoc(roomRef, roomPayload);
        await setDoc(doc(db, "rooms", nextRoomId, "players", playerId), hostPayload);

        createdRoomId = nextRoomId;
        break;
      }

      if (!createdRoomId) {
        openDialog("방 생성 실패", "방 코드를 생성하지 못했습니다. 다시 시도해주세요.");
        return;
      }

      persistPlayerContext(trimmedNickname, createdRoomId);
      router.push(`/room/${createdRoomId}${testQuerySuffix}`);
    } catch (error) {
      console.error("[createRoom] failed", error);
      openDialog("방 생성 실패", formatFirestoreError(error));
    } finally {
      setIsLoading(false);
    }
  };

  const joinRoom = async () => {
    const nicknameError = validateNickname();

    if (nicknameError) {
      openDialog("입력 확인", nicknameError);
      return;
    }

    const roomId = normalizeRoomCode(roomCodeInput);

    if (!roomId) {
      openDialog("입력 확인", "방 코드를 입력해주세요.");
      return;
    }

    setIsLoading(true);

    try {
      const playerId = getOrCreatePlayerId();
      const trimmedNickname = nickname.trim();
      const roomRef = doc(db, "rooms", roomId);
      const roomSnap = await getDoc(roomRef);

      if (!roomSnap.exists()) {
        openDialog("입장 실패", "존재하지 않는 방 코드입니다.");
        return;
      }

      const room = roomSnap.data() as Room;

      if (room.status === "ended") {
        openDialog("입장 불가", "이미 종료된 게임입니다. 새 방을 생성해주세요.");
        return;
      }

      if (room.status !== "waiting") {
        openDialog("입장 불가", "이미 게임이 진행 중인 방입니다.");
        return;
      }

      const playersRef = collection(db, "rooms", roomId, "players");
      const playerSnaps = await getDocs(playersRef);

      if (playerSnaps.size >= room.maxPlayers) {
        openDialog("입장 불가", "방 정원이 가득 찼습니다.");
        return;
      }

      const hasDuplicateNickname = playerSnaps.docs.some((playerDoc) => {
        const player = playerDoc.data() as Partial<Player>;
        return player.nickname?.toLowerCase() === trimmedNickname.toLowerCase();
      });

      if (hasDuplicateNickname) {
        openDialog("입장 불가", "이미 사용 중인 닉네임입니다.");
        return;
      }

      const joinPayload: Player = {
        id: playerId,
        nickname: trimmedNickname,
        role: "citizen",
        alive: true,
        isHost: false,
        joinedAt: serverTimestamp(),
      };

      await setDoc(doc(db, "rooms", roomId, "players", playerId), joinPayload);

      persistPlayerContext(trimmedNickname, roomId);
      router.push(`/room/${roomId}${testQuerySuffix}`);
    } catch (error) {
      console.error("[joinRoom] failed", error);
      openDialog("입장 실패", formatFirestoreError(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <main className="relative min-h-screen overflow-hidden bg-dm-bg px-4 py-8 text-dm-text-primary sm:px-6 sm:py-10">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-12 top-16 h-56 w-56 rounded-full bg-dm-primary/20 blur-3xl" />
          <div className="absolute right-0 top-4 h-72 w-72 rounded-full bg-dm-secondary/20 blur-3xl" />
          <div className="absolute bottom-10 left-1/3 h-60 w-60 rounded-full bg-dm-accent/20 blur-3xl" />
        </div>

        <Card className="relative mx-auto w-full max-w-[560px] space-y-4 p-4 sm:p-6" hover>
          <Card className="border-dm-border/80 bg-dm-muted p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="overflow-hidden rounded-lg border border-dm-accent/35">
                  <Image
                    src={mafiaImage}
                    alt="메인 로비 아트"
                    width={44}
                    height={44}
                    className="h-11 w-11 object-cover"
                    priority
                  />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-dm-text-secondary">Main Lobby</p>
                  <p className="text-sm font-semibold text-dm-text-primary">DRAW MAFIA Command Center</p>
                </div>
              </div>
              <span className="rounded-full border border-dm-primary/30 bg-dm-primary/10 px-3 py-1 text-[11px] font-semibold text-dm-primary animate-pulse">
                ONLINE
              </span>
            </div>
          </Card>

          <Card className="border-dm-border/80 bg-dm-card p-5 sm:p-6" hover>
            <div className="mx-auto text-center">
              <div className="flex items-center justify-center gap-2">
                <span className="rounded-full border border-dm-secondary/45 bg-dm-secondary/10 px-2 py-0.5 text-xs text-dm-secondary">
                  MAIN SCREEN
                </span>
                <span className="rounded-full border border-dm-accent/45 bg-dm-accent/10 px-2 py-0.5 text-xs text-dm-accent">
                  READY TO PLAY
                </span>
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                DRAW MAFIA
                <span className="block bg-gradient-to-r from-dm-primary to-dm-accent bg-clip-text text-transparent">
                  MAIN LOBBY
                </span>
              </h1>
              <p className="mt-4 text-sm font-medium text-dm-text-subtext sm:text-base">
                닉네임을 입력하고 바로 방을 생성하거나, 코드로 입장해 라운드를 시작하세요.
              </p>
            </div>
          </Card>

          <Card className="mx-auto w-full space-y-5 border-dm-border/80 bg-dm-card p-4 sm:p-5" hover>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-dm-text-secondary">닉네임</span>
              <input
                type="text"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                placeholder="닉네임 입력"
                className="dm-input"
                maxLength={20}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-dm-text-secondary">방 코드</span>
              <input
                type="text"
                value={roomCodeInput}
                onChange={(event) => setRoomCodeInput(normalizeRoomCode(event.target.value))}
                placeholder="예: AB12CD"
                className="dm-input uppercase"
                maxLength={8}
              />
            </label>

            {isLoading ? <LoadingSpinner label="매치메이킹 연결 중..." /> : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="button" onClick={createRoom} disabled={isLoading} variant="primary" className="w-full sm:flex-1">
                {isLoading ? "처리 중..." : "방 생성"}
              </Button>
              <Button type="button" onClick={joinRoom} disabled={isLoading} variant="ghost" className="w-full sm:flex-1">
                {isLoading ? "처리 중..." : "방 입장"}
              </Button>
            </div>
          </Card>
        </Card>
      </main>

      <GameDialog
        open={dialog.open}
        title={dialog.title}
        description={dialog.description}
        onOpenChange={closeDialog}
      />
    </>
  );
}
