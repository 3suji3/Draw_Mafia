"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { GameDialog } from "@/components/modals/GameDialog";
import { PROMPT_POOL } from "@/constants/prompts";
import { PLAYER_LIMITS, DRAW_TIME_OPTIONS } from "@/constants/game";
import { db } from "@/firebase/firebase";
import type { Player, Room } from "@/types/room";
import { getOrCreatePlayerId, getStoredRoomId } from "@/utils/player";

type RoomPageProps = {
  params: Promise<{ roomId: string }>;
};

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

function shuffle<T>(items: T[]): T[] {
  const next = [...items];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    const temp = next[index];
    next[index] = next[randomIndex];
    next[randomIndex] = temp;
  }

  return next;
}

export default function RoomPage({ params }: RoomPageProps) {
  const router = useRouter();
  const [resolvedRoomId, setResolvedRoomId] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingDrawTime, setUpdatingDrawTime] = useState(false);
  const [startingGame, setStartingGame] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(INITIAL_DIALOG);

  const openDialog = (title: string, description: string) => {
    setDialog({ open: true, title, description });
  };

  useEffect(() => {
    let mounted = true;

    params.then((value) => {
      if (!mounted) {
        return;
      }

      setResolvedRoomId(value.roomId);
    });

    return () => {
      mounted = false;
    };
  }, [params]);

  useEffect(() => {
    if (!resolvedRoomId) {
      return;
    }

    const roomRef = doc(db, "rooms", resolvedRoomId);
    const playersRef = query(
      collection(db, "rooms", resolvedRoomId, "players"),
      orderBy("joinedAt", "asc")
    );

    const unsubscribeRoom = onSnapshot(roomRef, (snapshot) => {
      if (!snapshot.exists()) {
        openDialog("방 정보 없음", "존재하지 않는 방입니다.");
        setLoading(false);
        return;
      }

      setRoom(snapshot.data() as Room);
      setLoading(false);
    });

    const unsubscribePlayers = onSnapshot(playersRef, (snapshot) => {
      const nextPlayers = snapshot.docs.map((item) => item.data() as Player);
      setPlayers(nextPlayers);
      setLoading(false);
    });

    return () => {
      unsubscribeRoom();
      unsubscribePlayers();
    };
  }, [resolvedRoomId]);

  const playerId = useMemo(() => getOrCreatePlayerId(), []);
  const joinedRoomId = useMemo(() => getStoredRoomId(), []);

  const currentPlayer = useMemo(
    () => players.find((player) => player.id === playerId),
    [playerId, players]
  );

  const isHost = Boolean(currentPlayer?.isHost && room?.hostId === currentPlayer.id);
  const totalPlayers = players.length;
  const canStartCount = totalPlayers === PLAYER_LIMITS.testMin || totalPlayers >= PLAYER_LIMITS.min;

  const handleDrawTimeChange = async (nextDrawTime: number) => {
    if (!room || !isHost || room.drawTime === nextDrawTime || updatingDrawTime) {
      return;
    }

    setUpdatingDrawTime(true);

    try {
      await updateDoc(doc(db, "rooms", resolvedRoomId), {
        drawTime: nextDrawTime,
      });
    } catch {
      openDialog("설정 변경 실패", "drawTime 변경 중 오류가 발생했습니다.");
    } finally {
      setUpdatingDrawTime(false);
    }
  };

  const handleStartClick = async () => {
    if (!isHost) {
      openDialog("권한 없음", "방장만 게임을 시작할 수 있습니다.");
      return;
    }

    if (!canStartCount) {
      openDialog(
        "시작 불가",
        `최소 ${PLAYER_LIMITS.min}명이 필요합니다. 테스트 모드에서는 1명 시작이 가능합니다.`
      );
      return;
    }

    if (!room || startingGame) {
      return;
    }

    setStartingGame(true);

    try {
      const roomRef = doc(db, "rooms", resolvedRoomId);
      const playersRef = query(
        collection(db, "rooms", resolvedRoomId, "players"),
        orderBy("joinedAt", "asc")
      );

      const playerSnaps = await getDocs(playersRef);
      const currentPlayers = playerSnaps.docs.map((item) => item.data() as Player);

      if (currentPlayers.length === 0) {
        openDialog("시작 불가", "플레이어 정보가 없습니다.");
        return;
      }

      if (!(currentPlayers.length === PLAYER_LIMITS.testMin || currentPlayers.length >= PLAYER_LIMITS.min)) {
        openDialog("시작 불가", "시작 인원 조건을 만족하지 않습니다.");
        return;
      }

      const turnOrder = shuffle(currentPlayers.map((player) => player.id));
      const mafiaId = turnOrder[Math.floor(Math.random() * turnOrder.length)];
      const selectedPrompt = PROMPT_POOL[Math.floor(Math.random() * PROMPT_POOL.length)];

      const batch = writeBatch(db);

      batch.update(roomRef, {
        status: "playing",
        prompt: selectedPrompt,
        mafiaId,
        turnOrder,
        turnIndex: 0,
        round: 1,
      });

      currentPlayers.forEach((player) => {
        const role = player.id === mafiaId ? "mafia" : "citizen";
        const playerRef = doc(db, "rooms", resolvedRoomId, "players", player.id);

        batch.update(playerRef, {
          role,
          alive: true,
        });
      });

      await batch.commit();
      router.push(`/game/${resolvedRoomId}`);
    } catch {
      openDialog("게임 시작 실패", "시작 처리 중 오류가 발생했습니다.");
    } finally {
      setStartingGame(false);
    }
  };

  return (
    <>
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
        <section className="mx-auto w-full max-w-4xl rounded-2xl border border-slate-700 bg-slate-900/90 p-8 shadow-2xl">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-3xl font-bold tracking-wide">LOBBY</h1>
            <span className="rounded-md border border-slate-600 px-3 py-1 text-xs text-slate-300">
              ROOM {resolvedRoomId || "-"}
            </span>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 rounded-xl border border-slate-700 bg-slate-800/70 p-4 text-sm sm:grid-cols-3">
            <p>
              상태: <span className="font-semibold text-emerald-300">{room?.status ?? "loading"}</span>
            </p>
            <p>
              인원: <span className="font-semibold text-sky-300">{totalPlayers}</span> / {room?.maxPlayers ?? PLAYER_LIMITS.max}
            </p>
            <p>
              내 상태: <span className="font-semibold text-violet-300">{currentPlayer ? "입장됨" : "미확인"}</span>
            </p>
          </div>

          {joinedRoomId && joinedRoomId !== resolvedRoomId ? (
            <p className="mt-3 text-sm text-amber-300">
              저장된 최근 방 코드({joinedRoomId})와 현재 방 코드가 다릅니다.
            </p>
          ) : null}

          <div className="mt-8">
            <h2 className="text-lg font-semibold text-slate-100">참가자 목록</h2>
            <ul className="mt-3 space-y-2">
              {players.map((player) => (
                <li
                  key={player.id}
                  className="flex items-center justify-between rounded-md border border-slate-700 bg-slate-800/70 px-4 py-2 text-sm"
                >
                  <span className="font-medium text-slate-100">{player.nickname}</span>
                  <span className="text-xs text-slate-400">
                    {player.isHost ? "방장" : "참가자"}
                  </span>
                </li>
              ))}
            </ul>
            {!loading && players.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">아직 참가자가 없습니다.</p>
            ) : null}
          </div>

          <div className="mt-8 rounded-xl border border-slate-700 bg-slate-800/70 p-4">
            <h2 className="text-base font-semibold text-slate-100">라운드 설정</h2>
            <p className="mt-1 text-sm text-slate-300">방장만 drawTime을 변경할 수 있습니다.</p>

            <div className="mt-4 flex gap-2">
              {DRAW_TIME_OPTIONS.map((seconds) => {
                const active = room?.drawTime === seconds;

                return (
                  <button
                    key={seconds}
                    type="button"
                    onClick={() => handleDrawTimeChange(seconds)}
                    disabled={!isHost || updatingDrawTime}
                    className={`rounded-md border px-3 py-2 text-sm transition ${
                      active
                        ? "border-emerald-400 bg-emerald-500/25 text-emerald-200"
                        : "border-slate-600 bg-slate-900 text-slate-200 hover:bg-slate-700"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {seconds}초
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-300">
              시작 조건: {PLAYER_LIMITS.min}명 이상, 테스트 모드 {PLAYER_LIMITS.testMin}명 허용
            </p>
            <button
              type="button"
              onClick={handleStartClick}
              disabled={!isHost || !canStartCount || startingGame}
              className="rounded-md bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-500"
            >
              {startingGame ? "시작 중..." : "게임 시작"}
            </button>
          </div>

          <div className="mt-6">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="text-sm text-slate-400 underline underline-offset-4"
            >
              홈으로 돌아가기
            </button>
          </div>
        </section>
      </main>

      <GameDialog
        open={dialog.open}
        title={dialog.title}
        description={dialog.description}
        onOpenChange={(open) => setDialog((prev) => ({ ...prev, open }))}
      />
    </>
  );
}
