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
} from "firebase/firestore";
import { CanvasBoard } from "@/components/canvas";
import { GameDialog } from "@/components/modals/GameDialog";
import { db } from "@/firebase/firebase";
import type { CanvasTool, Stroke } from "@/types/canvas";
import type { Player, Room } from "@/types/room";
import { getOrCreatePlayerId } from "@/utils/player";

type GamePageProps = {
  params: Promise<{ roomId: string }>;
};

const TIMER_STORAGE_PREFIX = "draw_mafia_turn_started";
const VOTE_TIMER_STORAGE_PREFIX = "draw_mafia_vote_started";
const VOTE_SKIP_TARGET = "skip";

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

export default function GamePage({ params }: GamePageProps) {
  const router = useRouter();
  const [resolvedRoomId, setResolvedRoomId] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [startDialogOpen, setStartDialogOpen] = useState(true);
  const [tool, setTool] = useState<CanvasTool>("pen");
  const [color, setColor] = useState("#f8fafc");
  const [size, setSize] = useState(4);
  const [endingTurn, setEndingTurn] = useState(false);
  const [submittingVote, setSubmittingVote] = useState(false);
  const [finalizingVote, setFinalizingVote] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [turnStartedAtMs, setTurnStartedAtMs] = useState<number | null>(null);
  const [voteStartedAtMs, setVoteStartedAtMs] = useState<number | null>(null);
  const [voteResultDialog, setVoteResultDialog] = useState<{ open: boolean; message: string }>({
    open: false,
    message: "",
  });
  const autoAdvancedTurnKeyRef = useRef<string>("");
  const autoFinalizedVoteKeyRef = useRef<string>("");

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
        router.push("/");
        return;
      }

      setRoom(snapshot.data() as Room);
    });

    const unsubscribePlayers = onSnapshot(playersRef, (snapshot) => {
      const nextPlayers = snapshot.docs.map((item) => item.data() as Player);
      setPlayers(nextPlayers);
    });

    const drawingsRef = query(
      collection(db, "rooms", resolvedRoomId, "drawings"),
      orderBy("createdAt", "asc")
    );

    const votesRef = collection(db, "rooms", resolvedRoomId, "votes");

    const unsubscribeDrawings = onSnapshot(drawingsRef, (snapshot) => {
      const nextStrokes = snapshot.docs.map((item) => {
        const data = item.data() as Omit<Stroke, "id">;
        return {
          id: item.id,
          ...data,
        } as Stroke;
      });

      setStrokes(nextStrokes);
    });

    const unsubscribeVotes = onSnapshot(votesRef, (snapshot) => {
      const nextVotes = snapshot.docs.map((item) => item.data() as Vote);
      setVotes(nextVotes);
    });

    return () => {
      unsubscribeRoom();
      unsubscribePlayers();
      unsubscribeDrawings();
      unsubscribeVotes();
    };
  }, [resolvedRoomId, router]);

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

  const alivePlayers = useMemo(() => players.filter((player) => player.alive), [players]);
  const eligibleVoterIds = useMemo(() => alivePlayers.map((player) => player.id), [alivePlayers]);
  const myVote = useMemo(
    () => votes.find((vote) => vote.voterId === playerId),
    [playerId, votes]
  );

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

      const current = tally.get(vote.targetId) ?? 0;
      tally.set(vote.targetId, current + 1);
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
      const voteDocs = await getDocs(collection(db, "rooms", resolvedRoomId, "votes"));
      const latestVotes = voteDocs.docs.map((item) => item.data() as Vote);
      const eligibleSet = new Set(alivePlayers.map((player) => player.id));
      const tally = new Map<string, number>();

      latestVotes.forEach((vote) => {
        if (!eligibleSet.has(vote.voterId)) {
          return;
        }

        tally.set(vote.targetId, (tally.get(vote.targetId) ?? 0) + 1);
      });

      let message = "집계 결과: 탈락자 없음";

      if (tally.size > 0) {
        const sorted = Array.from(tally.entries()).sort((left, right) => right[1] - left[1]);
        const [topTargetId, topCount] = sorted[0];
        const secondCount = sorted[1]?.[1] ?? -1;
        const isTie = topCount === secondCount;
        const isSkipTop = topTargetId === VOTE_SKIP_TARGET;

        if (isTie || isSkipTop) {
          message = "집계 결과: 동률 또는 넘어가기 최다로 탈락자 없음";
        } else {
          const targetPlayer = players.find((player) => player.id === topTargetId);
          message = `집계 결과: ${targetPlayer?.nickname ?? "알 수 없음"} (${topCount}표)`;
        }
      }

      setVoteResultDialog({ open: true, message });
      await updateDoc(doc(db, "rooms", resolvedRoomId), {
        status: "result",
      });
    } finally {
      setFinalizingVote(false);
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

    const votingKey = `${room.round}-${room.status}`;

    if (autoFinalizedVoteKeyRef.current === votingKey) {
      return;
    }

    autoFinalizedVoteKeyRef.current = votingKey;

    void finalizeVoting().catch(() => {
      autoFinalizedVoteKeyRef.current = "";
    });
  }, [allVotesCompleted, finalizingVote, isHost, room, voteRemainingSeconds]);

  return (
    <>
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
        <section className="mx-auto w-full max-w-5xl rounded-2xl border border-slate-700 bg-slate-900/90 p-8 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl font-bold tracking-wide">GAME START</h1>
            <span className="rounded-md border border-slate-600 px-3 py-1 text-xs text-slate-300">
              ROOM {resolvedRoomId || "-"}
            </span>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <article className="rounded-xl border border-slate-700 bg-slate-800/70 p-5">
              <h2 className="text-sm font-semibold text-slate-300">내 역할</h2>
              <p className="mt-2 text-xl font-bold text-emerald-300">
                {currentPlayer?.role === "mafia" ? "마피아" : "시민"}
              </p>
              <p className="mt-3 text-xs text-slate-400">다른 플레이어의 역할 정보는 노출되지 않습니다.</p>
            </article>

            <article className="rounded-xl border border-slate-700 bg-slate-800/70 p-5 lg:col-span-2">
              <h2 className="text-sm font-semibold text-slate-300">내 제시어</h2>
              <p className="mt-2 text-2xl font-bold text-violet-300">{visiblePrompt || "로딩 중..."}</p>
              <p className="mt-3 text-xs text-slate-400">
                시민은 전체 제시어를, 마피아는 행동/피사체 중 하나만 확인합니다.
              </p>
            </article>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <article className="rounded-xl border border-slate-700 bg-slate-800/70 p-5">
              <h2 className="text-sm font-semibold text-slate-300">턴 정보</h2>
              <p className="mt-2 text-sm text-slate-300">현재 턴</p>
              <p className="text-lg font-semibold text-sky-300">
                {currentTurnPlayer?.nickname ?? "대기 중"}
              </p>
              <p className="mt-3 text-xs text-slate-400">
                turnIndex: {room?.turnIndex ?? 0} / round: {room?.round ?? 1}
              </p>
              <div className="mt-4 rounded-md border border-slate-700 bg-slate-900/80 p-3">
                <p className="text-xs text-slate-400">DRAW TIMER</p>
                <p className="mt-1 text-2xl font-bold text-amber-300">{remainingSeconds}s</p>
                <p className="mt-1 text-xs text-slate-500">
                  제한 시간 {room?.drawTime ?? 0}초 종료 시 자동으로 다음 턴으로 이동합니다.
                </p>
              </div>
            </article>

            <article className="rounded-xl border border-slate-700 bg-slate-800/70 p-5">
              <h2 className="text-sm font-semibold text-slate-300">턴 순서</h2>
              <ol className="mt-3 space-y-2 text-sm">
                {room?.turnOrder.map((turnPlayerId, index) => {
                  const player = players.find((item) => item.id === turnPlayerId);
                  const active = room.turnIndex === index;

                  return (
                    <li
                      key={turnPlayerId}
                      className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                        active
                          ? "border-indigo-400 bg-indigo-500/20 text-indigo-100"
                          : "border-slate-700 bg-slate-900 text-slate-300"
                      }`}
                    >
                      <span>{index + 1}.</span>
                      <span>{player?.nickname ?? "알 수 없음"}</span>
                    </li>
                  );
                })}
              </ol>
            </article>
          </div>

          <div className="mt-6 rounded-xl border border-slate-700 bg-slate-800/70 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-300">DRAW BOARD</h2>
              <p className="text-xs text-slate-400">
                {room?.status === "playing"
                  ? isMyTurn
                    ? "현재 당신의 턴입니다."
                    : "다른 플레이어의 턴입니다."
                  : room?.status === "voting"
                    ? "투표가 진행 중입니다."
                    : "현재 상태에서는 입력할 수 없습니다."}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setTool("pen")}
                className={`rounded-md border px-3 py-2 text-sm ${
                  tool === "pen"
                    ? "border-sky-400 bg-sky-500/20 text-sky-100"
                    : "border-slate-600 bg-slate-900 text-slate-200"
                }`}
              >
                펜
              </button>
              <button
                type="button"
                onClick={() => setTool("eraser")}
                className={`rounded-md border px-3 py-2 text-sm ${
                  tool === "eraser"
                    ? "border-rose-400 bg-rose-500/20 text-rose-100"
                    : "border-slate-600 bg-slate-900 text-slate-200"
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
                      color === paletteColor ? "border-white" : "border-slate-600"
                    }`}
                    style={{ backgroundColor: paletteColor }}
                  />
                ))}
              </div>

              <label className="ml-auto flex items-center gap-2 text-xs text-slate-300">
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
                className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-600"
              >
                {endingTurn ? "처리 중..." : "턴 종료"}
              </button>
            </div>
          </div>

          {room?.status === "voting" ? (
            <div className="mt-6 rounded-xl border border-rose-700 bg-rose-950/30 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-rose-200">VOTING PHASE</h2>
                <div className="text-right">
                  <p className="text-xs text-rose-300">남은 시간</p>
                  <p className="text-2xl font-bold text-amber-300">{voteRemainingSeconds}s</p>
                </div>
              </div>

              <div className="mt-3 rounded-md border border-rose-800 bg-slate-900/70 p-3 text-xs text-slate-300">
                <p>
                  투표 진행: {votedCount} / {eligibleVoterIds.length}
                </p>
                <p className="mt-1">
                  {isAlive
                    ? myVote
                      ? "이미 투표를 완료했습니다."
                      : "한 번만 투표할 수 있습니다."
                    : "탈락한 플레이어는 투표할 수 없습니다."}
                </p>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {alivePlayers.map((player) => (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => handleCastVote(player.id)}
                    disabled={!isAlive || Boolean(myVote) || submittingVote}
                    className="flex items-center justify-between rounded-md border border-rose-700 bg-slate-900 px-3 py-2 text-sm text-rose-100 transition hover:bg-rose-900/40 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span>{player.nickname}</span>
                    <span className="text-xs text-rose-300">투표</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleCastVote(VOTE_SKIP_TARGET)}
                  disabled={!isAlive || Boolean(myVote) || submittingVote}
                  className="rounded-md border border-amber-600 bg-amber-900/20 px-3 py-2 text-sm font-semibold text-amber-200 transition hover:bg-amber-800/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  넘어가기 투표
                </button>
              </div>

              <div className="mt-4 rounded-md border border-slate-700 bg-slate-900/70 p-3 text-xs text-slate-300">
                <p>실시간 집계 미리보기</p>
                <p className="mt-1">
                  {voteResult.shouldEliminate
                    ? `현재 최다 득표 대상: ${players.find((player) => player.id === voteResult.topTargetId)?.nickname ?? "알 수 없음"} (${voteResult.topCount}표)`
                    : "현재 상태: 동률 또는 넘어가기 우세"}
                </p>
              </div>
            </div>
          ) : null}
        </section>
      </main>

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
