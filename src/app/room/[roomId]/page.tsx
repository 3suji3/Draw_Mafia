"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { Button, Card, LoadingSpinner, ToastStack } from "@/components/ui";
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

const TEST_BOT_COUNT = 3;
const TEST_BOT_PREFIX = "bot";

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
  const searchParams = useSearchParams();
  const [resolvedRoomId, setResolvedRoomId] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingDrawTime, setUpdatingDrawTime] = useState(false);
  const [startingGame, setStartingGame] = useState(false);
  const [recoveringPlayer, setRecoveringPlayer] = useState(false);
  const [leavingRoom, setLeavingRoom] = useState(false);
  const [networkDelayed, setNetworkDelayed] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string }>>([]);
  const [dialog, setDialog] = useState<DialogState>(INITIAL_DIALOG);
  const recoveryAttemptedRef = useRef(false);
  const prevPlayerIdsRef = useRef<string[]>([]);
  const creatingBotsRef = useRef(false);

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
    const syncOnlineState = () => {
      setIsOnline(window.navigator.onLine);
    };

    syncOnlineState();
    window.addEventListener("online", syncOnlineState);
    window.addEventListener("offline", syncOnlineState);

    return () => {
      window.removeEventListener("online", syncOnlineState);
      window.removeEventListener("offline", syncOnlineState);
    };
  }, []);

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
  const isTestMode = useMemo(() => {
    if (process.env.NODE_ENV !== "development") {
      return false;
    }

    const raw = searchParams.get("test");

    if (raw === null) {
      return true;
    }

    return raw === "true";
  }, [searchParams]);

  const currentPlayer = useMemo(
    () => players.find((player) => player.id === playerId),
    [playerId, players]
  );

  const isHost = Boolean(currentPlayer?.isHost && room?.hostId === currentPlayer.id);
  const totalPlayers = players.length;
  const canStartCount =
    totalPlayers >= PLAYER_LIMITS.min ||
    (isTestMode && totalPlayers === PLAYER_LIMITS.testMin);

  const connectionLabel = !isOnline
    ? "오프라인"
    : networkDelayed
      ? "동기화 중"
      : "연결됨";

  const connectionClassName = !isOnline
    ? "border-dm-secondary/50 text-dm-secondary"
    : networkDelayed
      ? "border-dm-accent/50 text-dm-accent animate-pulse"
      : "border-dm-primary/45 text-dm-primary";

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
    if (!isTestMode || !room || room.status !== "waiting" || !isHost || creatingBotsRef.current) {
      return;
    }

    const existingIds = new Set(players.map((player) => player.id));
    const missingBotIds = Array.from({ length: TEST_BOT_COUNT }, (_, index) => `${TEST_BOT_PREFIX}${index + 1}`)
      .filter((botId) => !existingIds.has(botId));

    if (missingBotIds.length === 0) {
      return;
    }

    creatingBotsRef.current = true;

    void Promise.all(
      missingBotIds.map((botId, index) => {
        const nickname = `bot${Number(botId.replace(TEST_BOT_PREFIX, "")) || index + 1}`;

        return setDoc(doc(db, "rooms", resolvedRoomId, "players", botId), {
          id: botId,
          nickname,
          role: "citizen",
          alive: true,
          isHost: false,
          isBot: true,
          joinedAt: serverTimestamp(),
        } as Player);
      })
    )
      .then(() => {
        pushToast("테스트 봇이 자동으로 배치되었습니다.");
      })
      .catch(() => {
        openDialog("테스트 모드 오류", "더미 플레이어 생성에 실패했습니다.");
      })
      .finally(() => {
        creatingBotsRef.current = false;
      });
  }, [isHost, isTestMode, players, resolvedRoomId, room]);

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

      if (!(currentPlayers.length >= PLAYER_LIMITS.min || (isTestMode && currentPlayers.length === PLAYER_LIMITS.testMin))) {
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
        <Card className="mx-auto w-full max-w-4xl p-5 sm:p-8" hover>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-tight">LOBBY</h1>
              {isTestMode ? (
                <span className="rounded-full border border-dm-secondary/45 bg-dm-secondary/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-dm-secondary">
                  Test Mode
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${connectionClassName}`}>
                {connectionLabel}
              </span>
              <span className="rounded-md border border-dm-accent/40 px-3 py-1 text-xs text-dm-text-secondary">
                ROOM {resolvedRoomId || "-"}
              </span>
            </div>
          </div>

          <Card className="mt-6 grid grid-cols-1 gap-3 border-dm-accent/20 bg-dm-bg/35 p-4 text-sm sm:grid-cols-3">
            <p>
              상태: <span className="font-semibold text-dm-accent">{room?.status ?? "loading"}</span>
            </p>
            <p>
              인원: <span className="font-semibold text-dm-secondary">{totalPlayers}</span> / {room?.maxPlayers ?? PLAYER_LIMITS.max}
            </p>
            <p>
              내 상태: <span className="font-semibold text-dm-text-primary">{currentPlayer ? "입장됨" : "미확인"}</span>
            </p>
          </Card>

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
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-dm-text-primary">{player.nickname}</span>
                    {player.id === playerId ? (
                      <span className="rounded-full border border-dm-primary/35 px-2 py-0.5 text-[10px] text-dm-primary">
                        나
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-dm-text-secondary">
                    {player.isBot ? (
                      <span className="rounded-full border border-dm-secondary/40 px-2 py-0.5 text-dm-secondary">
                        BOT
                      </span>
                    ) : null}
                    <span>{player.isHost ? "방장" : "참가자"}</span>
                  </div>
                </li>
              ))}
            </ul>
            {!loading && players.length === 0 ? (
              <p className="mt-3 text-sm text-dm-text-secondary">아직 참가자가 없습니다.</p>
            ) : null}
          </div>

          <Card className="mt-8 border-dm-accent/20 bg-dm-bg/35 p-4">
            <h2 className="text-base font-semibold text-dm-text-primary">라운드 설정</h2>
            <p className="mt-1 text-sm text-dm-text-secondary">방장만 drawTime을 변경할 수 있습니다.</p>

            <div className="mt-4 flex gap-2">
              {DRAW_TIME_OPTIONS.map((seconds) => {
                const active = room?.drawTime === seconds;

                return (
                  <Button
                    key={seconds}
                    type="button"
                    onClick={() => handleDrawTimeChange(seconds)}
                    disabled={!isHost || updatingDrawTime}
                    variant={active ? "secondary" : "ghost"}
                    className="rounded-xl px-3 py-2 text-sm"
                  >
                    {seconds}초
                  </Button>
                );
              })}
            </div>
          </Card>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-dm-text-secondary">
              시작 조건: 기본 {PLAYER_LIMITS.min}명 이상 / 테스트 모드 {PLAYER_LIMITS.testMin}명 허용
            </p>
            <Button
              type="button"
              onClick={handleStartClick}
              disabled={!isHost || !canStartCount || startingGame}
              variant="primary"
              className="px-5 py-2.5"
            >
              {startingGame ? "시작 중..." : "게임 시작"}
            </Button>
          </div>

          {startingGame ? (
            <div className="mt-4">
              <LoadingSpinner label="게임 시작 데이터를 동기화하는 중..." />
            </div>
          ) : null}

          <div className="mt-6">
            <div className="flex items-center gap-4">
              <Button
                type="button"
                onClick={() => router.push("/")}
                variant="ghost"
                className="px-3 py-1 text-sm"
              >
                홈으로 돌아가기
              </Button>
              <Button
                type="button"
                onClick={handleLeaveRoom}
                disabled={leavingRoom}
                variant="secondary"
                className="px-3 py-1 text-sm"
              >
                {leavingRoom ? "이탈 처리 중..." : "방 나가기"}
              </Button>
            </div>
          </div>
        </Card>
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
