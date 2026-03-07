"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { GameDialog } from "@/components/modals/GameDialog";
import { LoadingSpinner, ToastStack } from "@/components/ui";
import { PROMPT_POOL } from "@/constants/prompts";
import { PLAYER_LIMITS, DRAW_TIME_OPTIONS } from "@/constants/game";
import { db } from "@/firebase/firebase";
import type { Player, Room } from "@/types/room";
import { leaveRoomAndHandleHost, validateRoomState } from "@/utils/roomException";
import { getOrCreatePlayerId, getStoredNickname, getStoredRoomId } from "@/utils/player";

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
  const [recoveringPlayer, setRecoveringPlayer] = useState(false);
  const [leavingRoom, setLeavingRoom] = useState(false);
  const [networkDelayed, setNetworkDelayed] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string }>>([]);
  const [dialog, setDialog] = useState<DialogState>(INITIAL_DIALOG);
  const recoveryAttemptedRef = useRef(false);
  const prevPlayerIdsRef = useRef<string[]>([]);

  const openDialog = (title: string, description: string) => {
    setDialog({ open: true, title, description });
  };

  const pushToast = (message: string) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev.slice(-2), { id, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 2400);
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

      const roomData = snapshot.data() as Room;
      const roomError = validateRoomState(roomData);

      if (roomError) {
        openDialog("방 상태 오류", `${roomError} 홈으로 이동합니다.`);
        router.push("/");
        setLoading(false);
        return;
      }

      setRoom(roomData);
      setLoading(false);
      setNetworkDelayed(false);
    }, () => {
      openDialog("연결 지연", "방 정보를 불러오는 중 문제가 발생했습니다.");
      setLoading(false);
      setNetworkDelayed(true);
    });

    const unsubscribePlayers = onSnapshot(playersRef, (snapshot) => {
      const nextPlayers = snapshot.docs.map((item) => item.data() as Player);
      setPlayers(nextPlayers);
      setLoading(false);
      setNetworkDelayed(false);
    }, () => {
      openDialog("연결 지연", "참가자 목록을 불러오는 중 문제가 발생했습니다.");
      setLoading(false);
      setNetworkDelayed(true);
    });

    return () => {
      unsubscribeRoom();
      unsubscribePlayers();
    };
  }, [resolvedRoomId]);

  useEffect(() => {
    if (!loading) {
      setNetworkDelayed(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setNetworkDelayed(true);
    }, 5000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loading]);

  const playerId = useMemo(() => getOrCreatePlayerId(), []);
  const joinedRoomId = useMemo(() => getStoredRoomId(), []);
  const storedNickname = useMemo(() => getStoredNickname(), []);

  const currentPlayer = useMemo(
    () => players.find((player) => player.id === playerId),
    [playerId, players]
  );

  const isHost = Boolean(currentPlayer?.isHost && room?.hostId === currentPlayer.id);
  const totalPlayers = players.length;
  const canStartCount = totalPlayers === PLAYER_LIMITS.testMin || totalPlayers >= PLAYER_LIMITS.min;

  useEffect(() => {
    const currentIds = players.map((player) => player.id);
    const previousIds = prevPlayerIdsRef.current;

    if (previousIds.length > 0) {
      if (currentIds.length > previousIds.length) {
        pushToast("플레이어가 입장했습니다.");
      }
      if (currentIds.length < previousIds.length) {
        pushToast("플레이어가 퇴장했습니다.");
      }
    }

    prevPlayerIdsRef.current = currentIds;
  }, [players]);

  useEffect(() => {
    if (!room || !resolvedRoomId) {
      return;
    }

    if (room.status !== "waiting") {
      router.push(`/game/${resolvedRoomId}`);
    }
  }, [resolvedRoomId, room, router]);

  useEffect(() => {
    if (!room || room.status !== "waiting" || currentPlayer || recoveringPlayer) {
      return;
    }

    if (resolvedRoomId !== joinedRoomId || !storedNickname || recoveryAttemptedRef.current) {
      return;
    }

    recoveryAttemptedRef.current = true;
    setRecoveringPlayer(true);

    const hasDuplicateNickname = players.some(
      (player) => player.nickname.toLowerCase() === storedNickname.toLowerCase()
    );

    if (hasDuplicateNickname) {
      openDialog("복구 실패", "동일 닉네임이 이미 존재해 자동 복구할 수 없습니다.");
      setRecoveringPlayer(false);
      return;
    }

    void setDoc(doc(db, "rooms", resolvedRoomId, "players", playerId), {
      id: playerId,
      nickname: storedNickname,
      role: "citizen",
      alive: true,
      isHost: false,
      joinedAt: serverTimestamp(),
    } as Player)
      .catch(() => {
        openDialog("복구 실패", "새로고침 복구 중 오류가 발생했습니다.");
      })
      .finally(() => {
        setRecoveringPlayer(false);
      });
  }, [
    currentPlayer,
    joinedRoomId,
    playerId,
    players,
    recoveringPlayer,
    resolvedRoomId,
    room,
    storedNickname,
  ]);

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

  const handleLeaveRoom = async () => {
    if (!resolvedRoomId || leavingRoom) {
      return;
    }

    setLeavingRoom(true);

    try {
      await leaveRoomAndHandleHost({
        roomId: resolvedRoomId,
        playerId,
      });
      router.push("/");
    } catch {
      openDialog("이탈 실패", "방 이탈 처리 중 오류가 발생했습니다.");
    } finally {
      setLeavingRoom(false);
    }
  };

  return (
    <>
      <main className="min-h-screen bg-dm-bg px-4 py-8 text-dm-text-primary sm:px-6 sm:py-10">
        <section className="mx-auto w-full max-w-4xl rounded-2xl border border-dm-accent/25 bg-dm-card/90 p-5 shadow-dm-glow sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-3xl font-bold tracking-wide">LOBBY</h1>
            <span className="rounded-md border border-dm-accent/40 px-3 py-1 text-xs text-dm-text-secondary">
              ROOM {resolvedRoomId || "-"}
            </span>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 rounded-xl border border-dm-accent/20 bg-dm-bg/35 p-4 text-sm sm:grid-cols-3">
            <p>
              상태: <span className="font-semibold text-dm-accent">{room?.status ?? "loading"}</span>
            </p>
            <p>
              인원: <span className="font-semibold text-dm-secondary">{totalPlayers}</span> / {room?.maxPlayers ?? PLAYER_LIMITS.max}
            </p>
            <p>
              내 상태: <span className="font-semibold text-dm-text-primary">{currentPlayer ? "입장됨" : "미확인"}</span>
            </p>
          </div>

          {joinedRoomId && joinedRoomId !== resolvedRoomId ? (
            <p className="mt-3 text-sm text-dm-secondary">
              저장된 최근 방 코드({joinedRoomId})와 현재 방 코드가 다릅니다.
            </p>
          ) : null}

          {networkDelayed ? (
            <p className="mt-3 text-sm text-dm-secondary">네트워크 지연이 감지되었습니다. 연결 복구를 시도 중입니다.</p>
          ) : null}

          {recoveringPlayer ? (
            <div className="mt-3">
              <LoadingSpinner label="새로고침 복구를 진행 중입니다..." />
            </div>
          ) : null}

          <div className="mt-8">
            <h2 className="text-lg font-semibold text-dm-text-primary">참가자 목록</h2>
            <ul className="mt-3 space-y-2">
              {players.map((player) => (
                <li
                  key={player.id}
                  className={`flex items-center justify-between rounded-md border px-4 py-2 text-sm ${
                    player.isHost
                      ? "border-dm-accent/60 bg-dm-accent/10 shadow-dm-glow"
                      : "border-dm-accent/20 bg-dm-bg/50"
                  }`}
                >
                  <span className="font-medium text-dm-text-primary">{player.nickname}</span>
                  <span className="text-xs text-dm-text-secondary">
                    {player.isHost ? "방장" : "참가자"}
                  </span>
                </li>
              ))}
            </ul>
            {!loading && players.length === 0 ? (
              <p className="mt-3 text-sm text-dm-text-secondary">아직 참가자가 없습니다.</p>
            ) : null}
          </div>

          <div className="mt-8 rounded-xl border border-dm-accent/20 bg-dm-bg/35 p-4">
            <h2 className="text-base font-semibold text-dm-text-primary">라운드 설정</h2>
            <p className="mt-1 text-sm text-dm-text-secondary">방장만 drawTime을 변경할 수 있습니다.</p>

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
                        ? "border-dm-accent bg-dm-accent/20 text-dm-text-primary"
                        : "border-dm-accent/25 bg-dm-bg text-dm-text-secondary hover:bg-dm-card"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {seconds}초
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-dm-text-secondary">
              시작 조건: {PLAYER_LIMITS.min}명 이상, 테스트 모드 {PLAYER_LIMITS.testMin}명 허용
            </p>
            <button
              type="button"
              onClick={handleStartClick}
              disabled={!isHost || !canStartCount || startingGame}
              className="rounded-md bg-dm-accent px-5 py-2.5 text-sm font-semibold text-dm-text-primary transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {startingGame ? "시작 중..." : "게임 시작"}
            </button>
          </div>

          {startingGame ? (
            <div className="mt-4">
              <LoadingSpinner label="게임 시작 데이터를 동기화하는 중..." />
            </div>
          ) : null}

          <div className="mt-6">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="text-sm text-dm-text-secondary underline underline-offset-4"
              >
                홈으로 돌아가기
              </button>
              <button
                type="button"
                onClick={handleLeaveRoom}
                disabled={leavingRoom}
                className="text-sm text-dm-secondary underline underline-offset-4 disabled:opacity-50"
              >
                {leavingRoom ? "이탈 처리 중..." : "방 나가기"}
              </button>
            </div>
          </div>
        </section>
      </main>

      <ToastStack items={toasts} />

      <GameDialog
        open={dialog.open}
        title={dialog.title}
        description={dialog.description}
        onOpenChange={(open) => setDialog((prev) => ({ ...prev, open }))}
      />
    </>
  );
}
