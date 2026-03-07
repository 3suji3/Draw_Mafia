"use client";

import { useState } from "react";
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
import { getOrCreatePlayerId, persistPlayerContext } from "@/utils/player";
import { generateRoomCode, normalizeRoomCode } from "@/utils/roomCode";
import type { Room, Player } from "@/types/room";

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

export default function HomePage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(INITIAL_DIALOG);

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

        const roomPayload: Room = {
          id: nextRoomId,
          hostId: playerId,
          status: "waiting",
          maxPlayers: PLAYER_LIMITS.max,
          drawTime: DEFAULT_DRAW_TIME,
          voteTime: VOTE_TIME_SECONDS,
          round: 1,
          turnIndex: 0,
          turnOrder: [],
          prompt: {
            action: "",
            subject: "",
          },
          mafiaId: "",
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
      router.push(`/room/${createdRoomId}`);
    } catch {
      openDialog("방 생성 실패", "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
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
      router.push(`/room/${roomId}`);
    } catch {
      openDialog("입장 실패", "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <main className="min-h-screen bg-dm-bg px-4 py-8 text-dm-text-primary sm:px-6 sm:py-10">
        <Card className="mx-auto w-full max-w-4xl p-5 sm:p-8" hover>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-4xl font-semibold tracking-tight">DRAW MAFIA</h1>
            <span className="rounded-md border border-dm-accent/40 px-3 py-1 text-xs text-dm-text-secondary">
              ONLINE LOBBY
            </span>
          </div>
          <p className="mt-3 text-dm-text-subtext font-medium">닉네임을 입력하고 작전을 시작하세요.</p>

          <Card className="mt-8 space-y-5 border-dm-primary/15 bg-dm-bg/35 p-4 sm:p-5">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-dm-text-secondary">닉네임</span>
              <input
                type="text"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                placeholder="닉네임 입력"
                className="w-full rounded-md border border-dm-accent/30 bg-dm-bg px-3 py-2 text-sm text-dm-text-primary outline-none ring-dm-accent/30 transition focus:ring"
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
                className="w-full rounded-md border border-dm-accent/30 bg-dm-bg px-3 py-2 text-sm uppercase text-dm-text-primary outline-none ring-dm-accent/30 transition focus:ring"
                maxLength={8}
              />
            </label>

            {isLoading ? <LoadingSpinner label="매치메이킹 연결 중..." /> : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button type="button" onClick={createRoom} disabled={isLoading} variant="primary">
                {isLoading ? "처리 중..." : "방 생성"}
              </Button>
              <Button type="button" onClick={joinRoom} disabled={isLoading} variant="ghost">
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
