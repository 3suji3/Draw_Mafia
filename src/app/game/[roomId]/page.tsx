"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addDoc,
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
import { CanvasBoard } from "@/components/canvas";
import { GameDialog } from "@/components/modals/GameDialog";
import { LoadingSpinner, ToastStack } from "@/components/ui";
import { db } from "@/firebase/firebase";
import type { CanvasTool, Stroke } from "@/types/canvas";
import type { Player, Room } from "@/types/room";
import { leaveRoomAndHandleHost, validateRoomState } from "@/utils/roomException";
import { getOrCreatePlayerId } from "@/utils/player";

type GamePageProps = {
  params: Promise<{ roomId: string }>;
};

type Vote = {
  voterId: string;
  targetId: string;
};

type VoteResult = {
  topTargetId: string;
  topCount: number;
  isTie: boolean;
  isSkipTop: boolean;
  shouldEliminate: boolean;
};

const TIMER_STORAGE_PREFIX = "draw_mafia_turn_started";
const VOTE_TIMER_STORAGE_PREFIX = "draw_mafia_vote_started";
const VOTE_SKIP_TARGET = "skip";

function getTurnTimerKey(roomId: string, round: number, turnIndex: number): string {
  return `${TIMER_STORAGE_PREFIX}_${roomId}_${round}_${turnIndex}`;
}

function getVoteTimerKey(roomId: string, round: number): string {
  return `${VOTE_TIMER_STORAGE_PREFIX}_${roomId}_${round}`;
}

function isMafiaHintAction(roomId: string, mafiaId: string, round: number): boolean {
  const seed = `${roomId}-${mafiaId}-${round}`;
  const total = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return total % 2 === 0;
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

async function clearRoomSubcollection(roomId: string, subcollection: "drawings" | "votes") {
  const snapshot = await getDocs(collection(db, "rooms", roomId, subcollection));

  if (snapshot.empty) {
    return;
  }

  const batch = writeBatch(db);

  snapshot.docs.forEach((item) => {
    batch.delete(item.ref);
  });

  await batch.commit();
}

export default function GamePage({ params }: GamePageProps) {
  const router = useRouter();
  const [resolvedRoomId, setResolvedRoomId] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);

  const [startDialogOpen, setStartDialogOpen] = useState(true);
  const [voteResultDialog, setVoteResultDialog] = useState<{ open: boolean; message: string }>({
    open: false,
    message: "",
  });

  const [tool, setTool] = useState<CanvasTool>("pen");
  const [color, setColor] = useState("#f8fafc");
  const [size, setSize] = useState(4);

  const [endingTurn, setEndingTurn] = useState(false);
  const [submittingVote, setSubmittingVote] = useState(false);
  const [finalizingVote, setFinalizingVote] = useState(false);
  const [continuingRound, setContinuingRound] = useState(false);
  const [submittingGuess, setSubmittingGuess] = useState(false);
  const [mafiaGuessWord, setMafiaGuessWord] = useState("");
  const [leavingRoom, setLeavingRoom] = useState(false);
  const [networkDelayed, setNetworkDelayed] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string }>>([]);

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [turnStartedAtMs, setTurnStartedAtMs] = useState<number | null>(null);
  const [voteStartedAtMs, setVoteStartedAtMs] = useState<number | null>(null);

  const autoAdvancedTurnKeyRef = useRef<string>("");
  const autoFinalizedVoteKeyRef = useRef<string>("");
  const previousTurnKeyRef = useRef<string>("");
  const previousVoteCountRef = useRef(0);

  const pushToast = (message: string) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev.slice(-2), { id, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 2200);
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
    const drawingsRef = query(
      collection(db, "rooms", resolvedRoomId, "drawings"),
      orderBy("createdAt", "asc")
    );
    const votesRef = collection(db, "rooms", resolvedRoomId, "votes");

    const unsubscribeRoom = onSnapshot(roomRef, (snapshot) => {
      if (!snapshot.exists()) {
        router.push("/");
        return;
      }

      const roomData = snapshot.data() as Room;
      const roomError = validateRoomState(roomData);

      if (roomError) {
        setVoteResultDialog({
          open: true,
          message: `방 상태 오류: ${roomError}`,
        });
        router.push("/");
        return;
      }

      setRoom(roomData);
      setNetworkDelayed(false);
    }, () => {
      setNetworkDelayed(true);
    });

    const unsubscribePlayers = onSnapshot(playersRef, (snapshot) => {
      const nextPlayers = snapshot.docs.map((item) => item.data() as Player);
      setPlayers(nextPlayers);
      setNetworkDelayed(false);
    }, () => {
      setNetworkDelayed(true);
    });

    const unsubscribeDrawings = onSnapshot(drawingsRef, (snapshot) => {
      const nextStrokes = snapshot.docs.map((item) => {
        const data = item.data() as Omit<Stroke, "id">;
        return {
          id: item.id,
          ...data,
        } as Stroke;
      });

      setStrokes(nextStrokes);
      setNetworkDelayed(false);
    }, () => {
      setNetworkDelayed(true);
    });

    const unsubscribeVotes = onSnapshot(votesRef, (snapshot) => {
      const nextVotes = snapshot.docs.map((item) => item.data() as Vote);
      setVotes(nextVotes);
      setNetworkDelayed(false);
    }, () => {
      setNetworkDelayed(true);
    });

    return () => {
      unsubscribeRoom();
      unsubscribePlayers();
      unsubscribeDrawings();
      unsubscribeVotes();
    };
  }, [resolvedRoomId, router]);

  useEffect(() => {
    if (!resolvedRoomId || room) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setNetworkDelayed(true);
    }, 5000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [resolvedRoomId, room]);

  const playerId = useMemo(() => getOrCreatePlayerId(), []);
  const currentPlayer = useMemo(
    () => players.find((player) => player.id === playerId),
    [playerId, players]
  );

  const currentTurnPlayer = useMemo(() => {
    if (!room || room.turnOrder.length === 0) {
      return null;
    }

    const currentTurnId = room.turnOrder[room.turnIndex] ?? room.turnOrder[0];
    return players.find((player) => player.id === currentTurnId) ?? null;
  }, [players, room]);

  const isMyTurn = Boolean(
    room && room.status === "playing" && room.turnOrder[room.turnIndex] === playerId
  );
  const isHost = Boolean(currentPlayer?.isHost && room?.hostId === currentPlayer?.id);
  const isAlive = Boolean(currentPlayer?.alive);

  const alivePlayers = useMemo(() => players.filter((player) => player.alive), [players]);
  const eligibleVoterIds = useMemo(() => alivePlayers.map((player) => player.id), [alivePlayers]);
  const myVote = useMemo(() => votes.find((vote) => vote.voterId === playerId), [playerId, votes]);

  const votedCount = useMemo(() => {
    const eligibleSet = new Set(eligibleVoterIds);
    return votes.filter((vote) => eligibleSet.has(vote.voterId)).length;
  }, [eligibleVoterIds, votes]);

  const allVotesCompleted = eligibleVoterIds.length > 0 && votedCount >= eligibleVoterIds.length;

  const voteResult = useMemo<VoteResult>(() => {
    const tally = new Map<string, number>();
    const eligibleSet = new Set(eligibleVoterIds);

    votes.forEach((vote) => {
      if (!eligibleSet.has(vote.voterId)) {
        return;
      }

      tally.set(vote.targetId, (tally.get(vote.targetId) ?? 0) + 1);
    });

    if (tally.size === 0) {
      return {
        topTargetId: VOTE_SKIP_TARGET,
        topCount: 0,
        isTie: false,
        isSkipTop: true,
        shouldEliminate: false,
      };
    }

    const sorted = Array.from(tally.entries()).sort((left, right) => right[1] - left[1]);
    const [topTargetId, topCount] = sorted[0];
    const secondCount = sorted[1]?.[1] ?? -1;
    const isTie = topCount === secondCount;
    const isSkipTop = topTargetId === VOTE_SKIP_TARGET;

    return {
      topTargetId,
      topCount,
      isTie,
      isSkipTop,
      shouldEliminate: !isTie && !isSkipTop,
    };
  }, [eligibleVoterIds, votes]);

  const visiblePrompt = useMemo(() => {
    if (!room || !currentPlayer) {
      return "";
    }

    if (currentPlayer.role === "citizen") {
      return `${room.prompt.action} ${room.prompt.subject}`;
    }

    if (!room.mafiaId) {
      return "";
    }

    return isMafiaHintAction(room.id, room.mafiaId, room.round)
      ? room.prompt.action
      : room.prompt.subject;
  }, [currentPlayer, room]);

  const remainingSeconds = useMemo(() => {
    if (!room || room.status !== "playing" || !turnStartedAtMs) {
      return room?.drawTime ?? 0;
    }

    const elapsed = Math.floor((nowMs - turnStartedAtMs) / 1000);
    return Math.max(0, room.drawTime - elapsed);
  }, [nowMs, room, turnStartedAtMs]);

  const voteRemainingSeconds = useMemo(() => {
    if (!room || room.status !== "voting" || !voteStartedAtMs) {
      return room?.voteTime ?? 60;
    }

    const elapsed = Math.floor((nowMs - voteStartedAtMs) / 1000);
    return Math.max(0, (room.voteTime ?? 60) - elapsed);
  }, [nowMs, room, voteStartedAtMs]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!room || !resolvedRoomId || room.status !== "playing") {
      setTurnStartedAtMs(null);
      return;
    }

    const timerKey = getTurnTimerKey(resolvedRoomId, room.round, room.turnIndex);
    const existing = window.localStorage.getItem(timerKey);

    if (existing) {
      const parsed = Number(existing);

      if (Number.isFinite(parsed) && parsed > 0) {
        setTurnStartedAtMs(parsed);
        return;
      }
    }

    const now = Date.now();
    window.localStorage.setItem(timerKey, String(now));
    setTurnStartedAtMs(now);
  }, [resolvedRoomId, room?.round, room?.status, room?.turnIndex]);

  useEffect(() => {
    if (!room || !resolvedRoomId || room.status !== "voting") {
      setVoteStartedAtMs(null);
      return;
    }

    const timerKey = getVoteTimerKey(resolvedRoomId, room.round);
    const existing = window.localStorage.getItem(timerKey);

    if (existing) {
      const parsed = Number(existing);

      if (Number.isFinite(parsed) && parsed > 0) {
        setVoteStartedAtMs(parsed);
        return;
      }
    }

    const now = Date.now();
    window.localStorage.setItem(timerKey, String(now));
    setVoteStartedAtMs(now);
  }, [resolvedRoomId, room?.round, room?.status]);

  const advanceTurn = async () => {
    if (!room || endingTurn) {
      return;
    }

    setEndingTurn(true);

    try {
      const aliveTurnOrder = room.turnOrder.filter((turnPlayerId) => {
        const player = players.find((item) => item.id === turnPlayerId);
        return Boolean(player?.alive);
      });

      if (aliveTurnOrder.length === 0) {
        return;
      }

      const currentTurnPlayerId = room.turnOrder[room.turnIndex];
      const currentAliveIndex = aliveTurnOrder.findIndex(
        (turnPlayerId) => turnPlayerId === currentTurnPlayerId
      );

      if (currentAliveIndex < 0) {
        return;
      }

      const roomRef = doc(db, "rooms", resolvedRoomId);
      const isLastAliveTurn = currentAliveIndex === aliveTurnOrder.length - 1;

      if (isLastAliveTurn) {
        await updateDoc(roomRef, {
          status: "voting",
        });
        return;
      }

      const nextPlayerId = aliveTurnOrder[currentAliveIndex + 1];
      const nextTurnIndex = room.turnOrder.findIndex((turnPlayerId) => turnPlayerId === nextPlayerId);

      if (nextTurnIndex < 0) {
        return;
      }

      await updateDoc(roomRef, {
        turnIndex: nextTurnIndex,
      });
    } finally {
      setEndingTurn(false);
    }
  };

  const handleStrokeComplete = async (
    stroke: Pick<Stroke, "tool" | "color" | "size" | "points">
  ) => {
    if (!resolvedRoomId || !isMyTurn || stroke.points.length < 2) {
      return;
    }

    await addDoc(collection(db, "rooms", resolvedRoomId, "drawings"), {
      playerId,
      tool: stroke.tool,
      color: stroke.color,
      size: stroke.size,
      points: stroke.points,
      createdAt: serverTimestamp(),
    });
  };

  const handleEndTurn = async () => {
    if (!isMyTurn || room?.status !== "playing") {
      return;
    }

    await advanceTurn();
  };

  const handleCastVote = async (targetId: string) => {
    if (!room || room.status !== "voting" || !resolvedRoomId || !isAlive || submittingVote || myVote) {
      return;
    }

    setSubmittingVote(true);

    try {
      const voteRef = doc(db, "rooms", resolvedRoomId, "votes", playerId);
      await setDoc(voteRef, {
        voterId: playerId,
        targetId,
      });
    } finally {
      setSubmittingVote(false);
    }
  };

  const finalizeVoting = async () => {
    if (!room || room.status !== "voting" || !resolvedRoomId || finalizingVote) {
      return;
    }

    setFinalizingVote(true);

    try {
      const latestVoteDocs = await getDocs(collection(db, "rooms", resolvedRoomId, "votes"));
      const latestVotes = latestVoteDocs.docs.map((item) => item.data() as Vote);
      const eligibleSet = new Set(alivePlayers.map((player) => player.id));
      const tally = new Map<string, number>();

      latestVotes.forEach((vote) => {
        if (!eligibleSet.has(vote.voterId)) {
          return;
        }

        tally.set(vote.targetId, (tally.get(vote.targetId) ?? 0) + 1);
      });

      let eliminatedPlayerId: string | null = null;
      let eliminatedRole: Player["role"] | null = null;
      let resultMessage = "집계 결과: 탈락자 없음";

      if (tally.size > 0) {
        const sorted = Array.from(tally.entries()).sort((left, right) => right[1] - left[1]);
        const [topTargetId, topCount] = sorted[0];
        const secondCount = sorted[1]?.[1] ?? -1;
        const isTie = topCount === secondCount;
        const isSkipTop = topTargetId === VOTE_SKIP_TARGET;

        if (isTie || isSkipTop) {
          resultMessage = "집계 결과: 동률 또는 넘어가기 최다로 탈락자 없음";
        } else {
          eliminatedPlayerId = topTargetId;
          const targetPlayer = players.find((player) => player.id === topTargetId);
          eliminatedRole = targetPlayer?.role ?? null;
          resultMessage = `집계 결과: ${targetPlayer?.nickname ?? "알 수 없음"} 탈락 (${topCount}표)`;

          if (targetPlayer) {
            await updateDoc(doc(db, "rooms", resolvedRoomId, "players", targetPlayer.id), {
              alive: false,
            });
          }
        }
      }

      let mafiaAliveCount = 0;
      let citizenAliveCount = 0;

      players.forEach((player) => {
        const alive = player.alive && player.id !== eliminatedPlayerId;

        if (!alive) {
          return;
        }

        if (player.role === "mafia") {
          mafiaAliveCount += 1;
        } else {
          citizenAliveCount += 1;
        }
      });

      const roomRef = doc(db, "rooms", resolvedRoomId);
      const updates: Record<string, unknown> = {
        status: "result",
        eliminatedPlayerId,
        eliminatedRole,
        resultMessage,
        winner: null,
        awaitingMafiaGuess: false,
      };

      if (eliminatedRole === "mafia") {
        updates.awaitingMafiaGuess = true;
        updates.resultMessage = `${resultMessage} / 마피아에게 제시어 추측 기회가 주어집니다.`;
      } else if (mafiaAliveCount > 0 && mafiaAliveCount === citizenAliveCount) {
        updates.status = "ended";
        updates.winner = "mafia";
        updates.resultMessage = "마피아와 시민 수가 1:1이 되어 마피아 승리";
      }

      await updateDoc(roomRef, updates);
      setVoteResultDialog({ open: true, message: String(updates.resultMessage) });
    } finally {
      setFinalizingVote(false);
    }
  };

  const handleMafiaGuessSubmit = async () => {
    if (
      !room ||
      room.status !== "result" ||
      !room.awaitingMafiaGuess ||
      currentPlayer?.role !== "mafia" ||
      !resolvedRoomId ||
      submittingGuess
    ) {
      return;
    }

    const guess = normalizeText(mafiaGuessWord);

    if (!guess) {
      return;
    }

    setSubmittingGuess(true);

    try {
      const answer = normalizeText(`${room.prompt.action} ${room.prompt.subject}`);
      const isCorrect = guess === answer;

      await updateDoc(doc(db, "rooms", resolvedRoomId), {
        status: "ended",
        winner: isCorrect ? "mafia" : "citizen",
        awaitingMafiaGuess: false,
        resultMessage: isCorrect
          ? `마피아가 제시어를 맞춰 역전 승리: ${room.prompt.action} ${room.prompt.subject}`
          : `마피아 추측 실패, 시민 승리 / 정답: ${room.prompt.action} ${room.prompt.subject}`,
      });
    } finally {
      setSubmittingGuess(false);
    }
  };

  const handleContinueRound = async () => {
    if (
      !room ||
      room.status !== "result" ||
      room.winner ||
      room.awaitingMafiaGuess ||
      !isHost ||
      continuingRound
    ) {
      return;
    }

    setContinuingRound(true);

    try {
      await clearRoomSubcollection(resolvedRoomId, "votes");
      await clearRoomSubcollection(resolvedRoomId, "drawings");

      const nextTurnPlayerId = room.turnOrder.find((turnPlayerId) => {
        const player = players.find((item) => item.id === turnPlayerId);
        return Boolean(player?.alive);
      });

      if (!nextTurnPlayerId) {
        await updateDoc(doc(db, "rooms", resolvedRoomId), {
          status: "ended",
          winner: "citizen",
          resultMessage: "마피아가 모두 제거되어 시민 승리",
          awaitingMafiaGuess: false,
        });
        return;
      }

      const nextTurnIndex = room.turnOrder.findIndex((turnPlayerId) => turnPlayerId === nextTurnPlayerId);

      await updateDoc(doc(db, "rooms", resolvedRoomId), {
        status: "playing",
        round: room.round + 1,
        turnIndex: nextTurnIndex,
        eliminatedPlayerId: null,
        eliminatedRole: null,
        resultMessage: "",
        awaitingMafiaGuess: false,
      });
    } finally {
      setContinuingRound(false);
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
      setVoteResultDialog({
        open: true,
        message: "방 이탈 처리 중 오류가 발생했습니다.",
      });
    } finally {
      setLeavingRoom(false);
    }
  };

  useEffect(() => {
    if (!room || room.status !== "playing" || !isHost) {
      return;
    }

    if (remainingSeconds > 0 || endingTurn) {
      return;
    }

    const turnKey = `${room.round}-${room.turnIndex}`;

    if (autoAdvancedTurnKeyRef.current === turnKey) {
      return;
    }

    autoAdvancedTurnKeyRef.current = turnKey;

    void advanceTurn().catch(() => {
      autoAdvancedTurnKeyRef.current = "";
    });
  }, [endingTurn, isHost, remainingSeconds, room]);

  useEffect(() => {
    if (!room || room.status !== "voting" || !isHost) {
      return;
    }

    const shouldFinalize = voteRemainingSeconds <= 0 || allVotesCompleted;

    if (!shouldFinalize || finalizingVote) {
      return;
    }

    const voteKey = `${room.round}-${room.status}`;

    if (autoFinalizedVoteKeyRef.current === voteKey) {
      return;
    }

    autoFinalizedVoteKeyRef.current = voteKey;

    void finalizeVoting().catch(() => {
      autoFinalizedVoteKeyRef.current = "";
    });
  }, [allVotesCompleted, finalizingVote, isHost, room, voteRemainingSeconds]);

  const colorPalette = [
    "#f8fafc",
    "#ef4444",
    "#22c55e",
    "#3b82f6",
    "#eab308",
    "#ec4899",
    "#f97316",
    "#a855f7",
  ];

  const eliminatedPlayer = useMemo(
    () => players.find((player) => player.id === room?.eliminatedPlayerId),
    [players, room?.eliminatedPlayerId]
  );

  useEffect(() => {
    if (!room || room.status === "ended" || currentPlayer || !resolvedRoomId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      router.push(`/room/${resolvedRoomId}`);
    }, 3000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [currentPlayer, resolvedRoomId, room, router]);

  useEffect(() => {
    if (!room) {
      return;
    }

    const turnKey = `${room.status}-${room.round}-${room.turnIndex}`;

    if (!previousTurnKeyRef.current) {
      previousTurnKeyRef.current = turnKey;
      return;
    }

    if (previousTurnKeyRef.current !== turnKey && room.status === "playing") {
      pushToast("다음 턴이 시작되었습니다.");
    }

    previousTurnKeyRef.current = turnKey;
  }, [room]);

  useEffect(() => {
    if (previousVoteCountRef.current === 0 && votedCount === 0) {
      return;
    }

    if (votedCount > previousVoteCountRef.current) {
      pushToast("투표가 등록되었습니다.");
    }

    previousVoteCountRef.current = votedCount;
  }, [votedCount]);

  return (
    <>
      <main className="min-h-screen bg-dm-bg px-4 py-8 text-dm-text-primary sm:px-6 sm:py-10">
        <section className="mx-auto w-full max-w-6xl rounded-2xl border border-dm-accent/25 bg-dm-card/90 p-4 shadow-dm-glow sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl font-bold tracking-wide">DRAW MAFIA</h1>
            <div className="flex items-center gap-3">
              <span className="rounded-md border border-dm-accent/40 px-3 py-1 text-xs text-dm-text-secondary">
                ROOM {resolvedRoomId || "-"}
              </span>
              <button
                type="button"
                onClick={handleLeaveRoom}
                disabled={leavingRoom}
                className="rounded-md border border-dm-secondary/60 px-3 py-1 text-xs font-semibold text-dm-secondary transition hover:bg-dm-secondary/20 disabled:opacity-50"
              >
                {leavingRoom ? "나가는 중..." : "방 나가기"}
              </button>
            </div>
          </div>

          {networkDelayed ? (
            <p className="mt-3 text-sm text-dm-secondary">
              네트워크 지연이 감지되었습니다. 실시간 상태 동기화를 재시도 중입니다.
            </p>
          ) : null}

          {finalizingVote || continuingRound ? (
            <div className="mt-3">
              <LoadingSpinner label="데이터 동기화 중..." />
            </div>
          ) : null}

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <article className="rounded-xl border border-dm-accent/20 bg-dm-bg/40 p-4 sm:p-5">
              <h2 className="text-sm font-semibold text-dm-text-secondary">내 역할</h2>
              <p className="mt-2 text-xl font-bold text-dm-accent">
                {currentPlayer?.role === "mafia" ? "마피아" : "시민"}
              </p>
              <p className="mt-3 text-xs text-dm-text-secondary">내 정보만 확인 가능합니다.</p>
            </article>

            <article className="rounded-xl border border-dm-accent/20 bg-dm-bg/40 p-4 sm:p-5 lg:col-span-2">
              <h2 className="text-sm font-semibold text-dm-text-secondary">내 제시어</h2>
              <p className="mt-2 text-2xl font-bold text-dm-secondary">{visiblePrompt || "로딩 중..."}</p>
              <p className="mt-3 text-xs text-dm-text-secondary">
                시민은 전체, 마피아는 행동/피사체 하나만 확인합니다.
              </p>
            </article>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <article className="rounded-xl border border-dm-accent/20 bg-dm-bg/40 p-4 sm:p-5">
              <h2 className="text-sm font-semibold text-dm-text-secondary">턴 정보</h2>
              <p className="mt-2 text-sm text-dm-text-secondary">현재 턴</p>
              <p className="text-lg font-semibold text-dm-accent">
                {currentTurnPlayer?.nickname ?? "대기 중"}
              </p>
              <p className="mt-3 text-xs text-dm-text-secondary">
                turnIndex: {room?.turnIndex ?? 0} / round: {room?.round ?? 1}
              </p>

              {room?.status === "playing" ? (
                <div className="mt-4 rounded-md border border-dm-accent/30 bg-dm-bg/70 p-3">
                  <p className="text-xs text-dm-text-secondary">DRAW TIMER</p>
                  <p className="mt-1 text-2xl font-bold text-dm-accent">{remainingSeconds}s</p>
                </div>
              ) : null}

              {room?.status === "voting" ? (
                <div className="mt-4 rounded-md border border-dm-secondary/40 bg-dm-bg/70 p-3">
                  <p className="text-xs text-dm-secondary">VOTING TIMER</p>
                  <p className="mt-1 text-2xl font-bold text-dm-secondary">{voteRemainingSeconds}s</p>
                  <p className="mt-1 text-xs text-dm-text-secondary">
                    투표 진행: {votedCount} / {eligibleVoterIds.length}
                  </p>
                </div>
              ) : null}
            </article>

            <article className="rounded-xl border border-dm-accent/20 bg-dm-bg/40 p-4 sm:p-5">
              <h2 className="text-sm font-semibold text-dm-text-secondary">턴 순서</h2>
              <ol className="mt-3 space-y-2 text-sm">
                {room?.turnOrder.map((turnPlayerId, index) => {
                  const player = players.find((item) => item.id === turnPlayerId);
                  const active = room.turnIndex === index;

                  return (
                    <li
                      key={turnPlayerId}
                      className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                        active
                          ? "border-dm-accent bg-dm-accent/18 text-dm-text-primary shadow-dm-glow"
                          : "border-dm-accent/20 bg-dm-bg text-dm-text-secondary"
                      }`}
                    >
                      <span>{active ? "◆" : `${index + 1}.`}</span>
                      <span>{player?.nickname ?? "알 수 없음"}</span>
                    </li>
                  );
                })}
              </ol>
            </article>
          </div>

          <div className="mt-6 rounded-xl border border-dm-accent/20 bg-dm-bg/40 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-dm-text-secondary">DRAW BOARD</h2>
              <p className="text-xs text-dm-text-secondary">
                {room?.status === "playing"
                  ? isMyTurn
                    ? "현재 당신의 턴입니다."
                    : "다른 플레이어의 턴입니다."
                  : room?.status === "voting"
                    ? "투표 진행 중"
                    : room?.status === "result"
                      ? "결과 처리 단계"
                      : "게임 종료"}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setTool("pen")}
                className={`rounded-md border px-3 py-2 text-sm ${
                  tool === "pen"
                    ? "border-dm-accent bg-dm-accent/20 text-dm-text-primary"
                    : "border-dm-accent/25 bg-dm-bg text-dm-text-secondary"
                }`}
              >
                펜
              </button>
              <button
                type="button"
                onClick={() => setTool("eraser")}
                className={`rounded-md border px-3 py-2 text-sm ${
                  tool === "eraser"
                    ? "border-dm-secondary bg-dm-secondary/20 text-dm-text-primary"
                    : "border-dm-secondary/30 bg-dm-bg text-dm-text-secondary"
                }`}
              >
                지우개
              </button>

              <div className="ml-1 flex items-center gap-2">
                {colorPalette.map((paletteColor) => (
                  <button
                    key={paletteColor}
                    type="button"
                    onClick={() => setColor(paletteColor)}
                    title={paletteColor}
                    className={`h-7 w-7 rounded-full border-2 ${
                      color === paletteColor ? "border-dm-text-primary" : "border-dm-text-secondary"
                    }`}
                    style={{ backgroundColor: paletteColor }}
                  />
                ))}
              </div>

              <label className="ml-auto flex items-center gap-2 text-xs text-dm-text-secondary">
                굵기
                <input
                  type="range"
                  min={2}
                  max={18}
                  value={size}
                  onChange={(event) => setSize(Number(event.target.value))}
                />
                <span>{size}</span>
              </label>
            </div>

            <div className="mt-4">
              <CanvasBoard
                strokes={strokes}
                canDraw={isMyTurn && room?.status === "playing"}
                tool={tool}
                color={color}
                size={size}
                onStrokeComplete={handleStrokeComplete}
              />
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handleEndTurn}
                disabled={!isMyTurn || endingTurn || room?.status !== "playing"}
                className="rounded-md bg-dm-accent px-4 py-2 text-sm font-semibold text-dm-text-primary transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {endingTurn ? "처리 중..." : "턴 종료"}
              </button>
            </div>
          </div>

          {room?.status === "voting" ? (
            <div className="mt-6 rounded-xl border border-dm-secondary/40 bg-dm-bg/45 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-dm-secondary">VOTING PHASE</h2>
                <p className="text-xs text-dm-text-secondary">
                  {isAlive
                    ? myVote
                      ? "이미 투표 완료"
                      : "1인 1표"
                    : "탈락자는 투표 불가"}
                </p>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {alivePlayers.map((player) => (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => handleCastVote(player.id)}
                    disabled={!isAlive || Boolean(myVote) || submittingVote}
                    className="flex items-center justify-between rounded-md border border-dm-secondary/40 bg-dm-bg px-3 py-2 text-sm text-dm-text-primary transition hover:bg-dm-secondary/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span>{player.nickname}</span>
                    <span className="text-xs text-dm-secondary">투표</span>
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => handleCastVote(VOTE_SKIP_TARGET)}
                  disabled={!isAlive || Boolean(myVote) || submittingVote}
                  className="rounded-md border border-dm-accent/40 bg-dm-accent/15 px-3 py-2 text-sm font-semibold text-dm-text-primary transition hover:bg-dm-accent/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  넘어가기 투표
                </button>
              </div>

              <div className="mt-4 rounded-md border border-dm-accent/20 bg-dm-bg/70 p-3 text-xs text-dm-text-secondary">
                {voteResult.shouldEliminate
                  ? `현재 최다 득표: ${players.find((player) => player.id === voteResult.topTargetId)?.nickname ?? "알 수 없음"} (${voteResult.topCount}표)`
                  : "현재 집계: 동률 또는 넘어가기 우세"}
              </div>
            </div>
          ) : null}

          {room?.status === "result" ? (
            <div className="mt-6 rounded-xl border border-dm-accent/35 bg-dm-bg/45 p-4 sm:p-5">
              <h2 className="text-sm font-semibold text-dm-accent">RESULT PHASE</h2>
              <p className="mt-2 text-sm text-dm-text-primary">{room.resultMessage ?? "결과를 계산 중입니다."}</p>

              {room.eliminatedPlayerId ? (
                <p className="mt-2 text-sm text-dm-text-secondary">
                  탈락자: {eliminatedPlayer?.nickname ?? "알 수 없음"} / 정체: {room.eliminatedRole ?? "미확인"}
                </p>
              ) : (
                <p className="mt-2 text-sm text-dm-text-secondary">이번 라운드 탈락자 없음</p>
              )}

              {room.awaitingMafiaGuess ? (
                <div className="mt-4 rounded-md border border-dm-secondary/40 bg-dm-bg/70 p-4">
                  <p className="text-sm text-dm-secondary">마피아 제시어 추측 기회</p>

                  {currentPlayer?.role === "mafia" ? (
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                      <input
                        type="text"
                        value={mafiaGuessWord}
                        onChange={(event) => setMafiaGuessWord(event.target.value)}
                        placeholder="제시어 전체 입력"
                        className="w-full rounded-md border border-dm-secondary/40 bg-dm-bg px-3 py-2 text-sm text-dm-text-primary outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleMafiaGuessSubmit}
                        disabled={submittingGuess}
                        className="rounded-md bg-dm-secondary px-4 py-2 text-sm font-semibold text-dm-text-primary transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {submittingGuess ? "확인 중..." : "추측 제출"}
                      </button>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-dm-text-secondary">마피아의 추측을 기다리는 중입니다.</p>
                  )}
                </div>
              ) : null}

              {!room.awaitingMafiaGuess && !room.winner ? (
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={handleContinueRound}
                    disabled={!isHost || continuingRound}
                    className="rounded-md bg-dm-accent px-4 py-2 text-sm font-semibold text-dm-text-primary transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {continuingRound ? "준비 중..." : "다음 라운드"}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {room?.status === "ended" ? (
            <div className="mt-6 rounded-xl border border-dm-secondary/45 bg-dm-bg/50 p-4 sm:p-5">
              <h2 className="text-xl font-bold text-dm-secondary">GAME END</h2>
              <p className="mt-2 text-sm text-dm-text-primary">
                승리 팀: {room.winner === "mafia" ? "마피아" : "시민"}
              </p>
              <p className="mt-1 text-sm text-dm-text-secondary">{room.resultMessage ?? "게임 종료"}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => router.push("/")}
                  className="rounded-md bg-dm-accent px-4 py-2 text-sm font-semibold text-dm-text-primary transition hover:brightness-110"
                >
                  다시 시작
                </button>
                <button
                  type="button"
                  onClick={handleLeaveRoom}
                  disabled={leavingRoom}
                  className="rounded-md border border-dm-secondary/60 px-4 py-2 text-sm font-semibold text-dm-secondary transition hover:bg-dm-secondary/20 disabled:opacity-60"
                >
                  방 나가기
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </main>

      <ToastStack items={toasts} />

      <GameDialog
        open={startDialogOpen}
        title="게임 시작"
        description="역할과 제시어가 배정되었습니다. 내 정보만 확인하고 플레이를 시작하세요."
        onOpenChange={setStartDialogOpen}
      />

      <GameDialog
        open={voteResultDialog.open}
        title="투표 집계 완료"
        description={voteResultDialog.message}
        onOpenChange={(open) => setVoteResultDialog((prev) => ({ ...prev, open }))}
      />
    </>
  );
}
