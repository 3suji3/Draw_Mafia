"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
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
import { ChatPanel } from "@/components/chat";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog";
import { GameDialog } from "@/components/modals/GameDialog";
import { Button, Card, LoadingSpinner, ToastStack } from "@/components/ui";
import { MAFIA_GUESS_TIME_SECONDS, VOTE_TIME_SECONDS } from "@/constants/game";
import { getRandomPromptPair } from "@/constants/promptPairs";
import { db } from "@/firebase/firebase";
import type { CanvasTool, DrawingStroke, PlayerDrawing } from "@/types/canvas";
import { toCitizenPromptText, toMafiaPromptText } from "@/types/prompt";
import type { Player, Room } from "@/types/room";
import { leaveRoomAndHandleHost, validateRoomState } from "@/utils/roomException";
import { getOrCreatePlayerId } from "@/utils/player";
import { resolveTestMode } from "@/utils/testMode";

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
const MAFIA_GUESS_TIMER_STORAGE_PREFIX = "draw_mafia_mafia_guess_started";
const VOTE_SKIP_TARGET = "skip";
const SOUND_STORAGE_KEY = "draw_mafia_sound_enabled";
const TEST_BOT_PREFIX = "bot";

function getTurnTimerKey(roomId: string, gameSession: number, round: number, turnIndex: number): string {
  return `${TIMER_STORAGE_PREFIX}_${roomId}_${gameSession}_${round}_${turnIndex}`;
}

function getVoteTimerKey(roomId: string, gameSession: number, round: number): string {
  return `${VOTE_TIMER_STORAGE_PREFIX}_${roomId}_${gameSession}_${round}`;
}

function getMafiaGuessTimerKey(roomId: string, gameSession: number, round: number): string {
  return `${MAFIA_GUESS_TIMER_STORAGE_PREFIX}_${roomId}_${gameSession}_${round}`;
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

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

async function clearRoomSubcollection(roomId: string, subcollection: "drawingsByPlayer" | "votes") {
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

export default function GamePage() {
  const router = useRouter();
  const routeParams = useParams<{ roomId: string }>();
  const searchParams = useSearchParams();
  const resolvedRoomId = useMemo(
    () => (typeof routeParams.roomId === "string" ? routeParams.roomId : ""),
    [routeParams]
  );
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [drawingsByPlayer, setDrawingsByPlayer] = useState<PlayerDrawing[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);

  const [startDialogOpen, setStartDialogOpen] = useState(true);
  const [voteResultDialog, setVoteResultDialog] = useState<{ open: boolean; message: string }>({
    open: false,
    message: "",
  });
  const [winnerDialogOpen, setWinnerDialogOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [rightPanelTab, setRightPanelTab] = useState<"players" | "vote">("players");
  const [pendingMyStrokes, setPendingMyStrokes] = useState<DrawingStroke[]>([]);

  const [tool, setTool] = useState<CanvasTool>("pen");
  const [color, setColor] = useState("#f8fafc");
  const [size, setSize] = useState(4);

  const [endingTurn, setEndingTurn] = useState(false);
  const [submittingVote, setSubmittingVote] = useState(false);
  const [finalizingVote, setFinalizingVote] = useState(false);
  const [continuingRound, setContinuingRound] = useState(false);
  const [submittingGuess, setSubmittingGuess] = useState(false);
  const [mafiaGuessWord, setMafiaGuessWord] = useState("");
  const [clearingCanvas, setClearingCanvas] = useState(false);
  const [leavingRoom, setLeavingRoom] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [restartingGame, setRestartingGame] = useState(false);
  const [networkDelayed, setNetworkDelayed] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string }>>([]);

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [turnStartedAtMs, setTurnStartedAtMs] = useState<number | null>(null);
  const [voteStartedAtMs, setVoteStartedAtMs] = useState<number | null>(null);
  const [mafiaGuessStartedAtMs, setMafiaGuessStartedAtMs] = useState<number | null>(null);

  const autoAdvancedTurnKeyRef = useRef<string>("");
  const autoFinalizedVoteKeyRef = useRef<string>("");
  const previousTurnKeyRef = useRef<string>("");
  const previousVoteCountRef = useRef(0);
  const botAutoTurnKeyRef = useRef<string>("");
  const autoContinuedRoundKeyRef = useRef<string>("");
  const autoFinalizedMafiaGuessTimeoutKeyRef = useRef<string>("");
  const previousEliminatedRef = useRef<string | null>(null);
  const previousWinnerDialogKeyRef = useRef<string>("");
  const hostLeaveHandledRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  const { isTestMode, testQuerySuffix } = useMemo(
    () => resolveTestMode(searchParams),
    [searchParams]
  );

  const pushToast = (message: string) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev.slice(-2), { id, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 2200);
  };

  const playSound = (type: "turn" | "vote" | "elimination") => {
    if (!soundEnabled || typeof window === "undefined") {
      return;
    }

    try {
      const ContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (!ContextClass) {
        return;
      }

      const context = audioContextRef.current ?? new ContextClass();
      audioContextRef.current = context;

      if (context.state === "suspended") {
        void context.resume();
      }

      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      const now = context.currentTime;
      const tones = {
        turn: 510,
        vote: 390,
        elimination: 240,
      };

      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(tones[type], now);
      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.exponentialRampToValueAtTime(0.07, now + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.22);
    } catch {
      return;
    }
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
    const saved = window.localStorage.getItem(SOUND_STORAGE_KEY);

    if (saved === "false") {
      setSoundEnabled(false);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SOUND_STORAGE_KEY, String(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => {
    if (!resolvedRoomId) {
      return;
    }

    const roomRef = doc(db, "rooms", resolvedRoomId);
    const playersRef = query(
      collection(db, "rooms", resolvedRoomId, "players"),
      orderBy("joinedAt", "asc")
    );
    const drawingsRef = collection(db, "rooms", resolvedRoomId, "drawingsByPlayer");
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
      const nextDrawings = snapshot.docs.map((item) => {
        const data = item.data() as Omit<PlayerDrawing, "id">;
        return {
          id: item.id,
          ...data,
          strokes: Array.isArray(data.strokes) ? data.strokes : [],
        } as PlayerDrawing;
      });

      setDrawingsByPlayer(nextDrawings);
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

  const currentGameSession = Number(
    (room as (Room & { gameSession?: number }) | null)?.gameSession ?? 0
  );

  const currentTurnDrawing = useMemo(() => {
    if (!currentTurnPlayer || !room) {
      return null;
    }

    return (
      drawingsByPlayer.find(
        (drawing) =>
          drawing.playerId === currentTurnPlayer.id &&
          drawing.gameSession === currentGameSession &&
          drawing.round === room.round
      ) ?? null
    );
  }, [currentGameSession, currentTurnPlayer, drawingsByPlayer, room]);

  const myRoundDrawing = useMemo(() => {
    if (!room) {
      return null;
    }

    return (
      drawingsByPlayer.find(
        (drawing) =>
          drawing.playerId === playerId &&
          drawing.gameSession === currentGameSession &&
          drawing.round === room.round
      ) ?? null
    );
  }, [currentGameSession, drawingsByPlayer, playerId, room]);

  const currentCanvasStrokes = useMemo(() => myRoundDrawing?.strokes ?? [], [myRoundDrawing]);

  const isMyTurn = Boolean(
    room && room.status === "playing" && room.turnOrder[room.turnIndex] === playerId
  );
  const isAlive = Boolean(currentPlayer?.alive);
  const canDrawNow = Boolean(room?.status === "playing" && isAlive);

  const renderCanvasStrokes = useMemo(() => {
    if (!canDrawNow) {
      return currentCanvasStrokes;
    }

    return [...currentCanvasStrokes, ...pendingMyStrokes];
  }, [canDrawNow, currentCanvasStrokes, pendingMyStrokes]);

  const orderedDrawings = useMemo(() => {
    if (!room || room.turnOrder.length === 0) {
      return [] as PlayerDrawing[];
    }

    const turnOrderMap = new Map<string, number>();
    room.turnOrder.forEach((turnPlayerId, index) => {
      turnOrderMap.set(turnPlayerId, index);
    });

    return [...drawingsByPlayer]
      .filter((drawing) => drawing.gameSession === currentGameSession && drawing.round === room.round)
      .sort((left, right) => {
        const leftOrder = turnOrderMap.get(left.playerId) ?? left.turnOrder ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = turnOrderMap.get(right.playerId) ?? right.turnOrder ?? Number.MAX_SAFE_INTEGER;
        return leftOrder - rightOrder;
      });
  }, [currentGameSession, drawingsByPlayer, room]);

  const activeGalleryDrawing = useMemo(() => {
    if (orderedDrawings.length === 0) {
      return null;
    }

    const safeIndex = Math.max(0, Math.min(galleryIndex, orderedDrawings.length - 1));
    return orderedDrawings[safeIndex] ?? null;
  }, [galleryIndex, orderedDrawings]);

  const prevGalleryDrawing = useMemo(() => {
    if (orderedDrawings.length <= 1) {
      return null;
    }

    const prevIndex = (galleryIndex - 1 + orderedDrawings.length) % orderedDrawings.length;
    return orderedDrawings[prevIndex] ?? null;
  }, [galleryIndex, orderedDrawings]);

  const nextGalleryDrawing = useMemo(() => {
    if (orderedDrawings.length <= 1) {
      return null;
    }

    const nextIndex = (galleryIndex + 1) % orderedDrawings.length;
    return orderedDrawings[nextIndex] ?? null;
  }, [galleryIndex, orderedDrawings]);

  const handlePrevGallery = () => {
    if (orderedDrawings.length === 0) {
      return;
    }

    setGalleryIndex((prev) => (prev - 1 + orderedDrawings.length) % orderedDrawings.length);
  };

  const handleNextGallery = () => {
    if (orderedDrawings.length === 0) {
      return;
    }

    setGalleryIndex((prev) => (prev + 1) % orderedDrawings.length);
  };

  useEffect(() => {
    if (orderedDrawings.length === 0) {
      if (galleryIndex !== 0) {
        setGalleryIndex(0);
      }
      return;
    }

    if (galleryIndex >= orderedDrawings.length) {
      setGalleryIndex(orderedDrawings.length - 1);
    }
  }, [galleryIndex, orderedDrawings.length]);

  useEffect(() => {
    setGalleryIndex(0);
  }, [currentGameSession, room?.round, room?.status]);

  useEffect(() => {
    if (!room) {
      setRightPanelTab("players");
      return;
    }

    if (room.status === "voting") {
      setRightPanelTab("vote");
      return;
    }

    setRightPanelTab("players");
  }, [room]);

  useEffect(() => {
    if (!canDrawNow) {
      setPendingMyStrokes([]);
      return;
    }

    setPendingMyStrokes((prev) =>
      prev.filter((pendingStroke) => {
        if (!pendingStroke.createdAtMs) {
          return false;
        }

        return !currentCanvasStrokes.some(
          (savedStroke) =>
            savedStroke.createdAtMs === pendingStroke.createdAtMs &&
            savedStroke.points.length === pendingStroke.points.length
        );
      })
    );
  }, [canDrawNow, currentCanvasStrokes]);

  useEffect(() => {
    setPendingMyStrokes([]);
  }, [currentGameSession, room?.round, room?.status, room?.turnIndex]);

  const isHost = Boolean(currentPlayer?.isHost && room?.hostId === currentPlayer?.id);

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
      return toCitizenPromptText(room.prompt);
    }

    return toMafiaPromptText(room.prompt);
  }, [currentPlayer, room]);

  const citizenPromptText = useMemo(() => {
    if (!room) {
      return "";
    }

    return toCitizenPromptText(room.prompt);
  }, [room]);

  const mafiaPromptText = useMemo(() => {
    if (!room) {
      return "";
    }

    return toMafiaPromptText(room.prompt);
  }, [room]);

  const remainingSeconds = useMemo(() => {
    if (!room || room.status !== "playing" || !turnStartedAtMs) {
      return room?.drawTime ?? 0;
    }

    const elapsed = Math.max(0, Math.floor((nowMs - turnStartedAtMs) / 1000));
    return Math.max(0, room.drawTime - elapsed);
  }, [nowMs, room, turnStartedAtMs]);

  const voteRemainingSeconds = useMemo(() => {
    if (!room || room.status !== "voting" || !voteStartedAtMs) {
      return room?.voteTime ?? VOTE_TIME_SECONDS;
    }

    const elapsed = Math.max(0, Math.floor((nowMs - voteStartedAtMs) / 1000));
    return Math.max(0, (room.voteTime ?? VOTE_TIME_SECONDS) - elapsed);
  }, [nowMs, room, voteStartedAtMs]);

  const drawTimerPercent = useMemo(() => {
    if (!room || room.drawTime <= 0) {
      return 0;
    }

    return Math.max(0, Math.min(100, (remainingSeconds / room.drawTime) * 100));
  }, [remainingSeconds, room]);

  const voteTimerPercent = useMemo(() => {
    if (!room || (room.voteTime ?? 0) <= 0) {
      return 0;
    }

    return Math.max(0, Math.min(100, (voteRemainingSeconds / (room.voteTime ?? VOTE_TIME_SECONDS)) * 100));
  }, [room, voteRemainingSeconds]);

  const mafiaGuessRemainingSeconds = useMemo(() => {
    if (!room || room.status !== "result" || !room.awaitingMafiaGuess || !mafiaGuessStartedAtMs) {
      return MAFIA_GUESS_TIME_SECONDS;
    }

    const elapsed = Math.max(0, Math.floor((nowMs - mafiaGuessStartedAtMs) / 1000));
    return Math.max(0, MAFIA_GUESS_TIME_SECONDS - elapsed);
  }, [mafiaGuessStartedAtMs, nowMs, room]);

  const mafiaGuessTimerPercent = useMemo(() => {
    return Math.max(0, Math.min(100, (mafiaGuessRemainingSeconds / MAFIA_GUESS_TIME_SECONDS) * 100));
  }, [mafiaGuessRemainingSeconds]);

  const timerDisplay = useMemo(() => {
    if (!room) {
      return { seconds: 0, percent: 0 };
    }

    if (room.status === "voting") {
      return { seconds: voteRemainingSeconds, percent: voteTimerPercent };
    }

    if (room.status === "result" && room.awaitingMafiaGuess) {
      return { seconds: mafiaGuessRemainingSeconds, percent: mafiaGuessTimerPercent };
    }

    if (room.status === "playing") {
      return { seconds: remainingSeconds, percent: drawTimerPercent };
    }

    return { seconds: 0, percent: 0 };
  }, [
    drawTimerPercent,
    mafiaGuessRemainingSeconds,
    mafiaGuessTimerPercent,
    remainingSeconds,
    room,
    voteRemainingSeconds,
    voteTimerPercent,
  ]);

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

    const timerKey = getTurnTimerKey(resolvedRoomId, currentGameSession, room.round, room.turnIndex);
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
  }, [currentGameSession, resolvedRoomId, room?.round, room?.status, room?.turnIndex]);

  useEffect(() => {
    if (!room || !resolvedRoomId || room.status !== "voting") {
      setVoteStartedAtMs(null);
      return;
    }

    const timerKey = getVoteTimerKey(resolvedRoomId, currentGameSession, room.round);
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
  }, [currentGameSession, resolvedRoomId, room?.round, room?.status]);

  useEffect(() => {
    if (!room || !resolvedRoomId || room.status !== "result" || !room.awaitingMafiaGuess) {
      setMafiaGuessStartedAtMs(null);
      return;
    }

    const timerKey = getMafiaGuessTimerKey(resolvedRoomId, currentGameSession, room.round);
    const existing = window.localStorage.getItem(timerKey);

    if (existing) {
      const parsed = Number(existing);

      if (Number.isFinite(parsed) && parsed > 0) {
        setMafiaGuessStartedAtMs(parsed);
        return;
      }
    }

    const now = Date.now();
    window.localStorage.setItem(timerKey, String(now));
    setMafiaGuessStartedAtMs(now);
  }, [currentGameSession, resolvedRoomId, room?.awaitingMafiaGuess, room?.round, room?.status]);

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

  const handleStrokeComplete = async (stroke: DrawingStroke) => {
    if (!resolvedRoomId || !canDrawNow || stroke.points.length < 1) {
      return;
    }

    const strokeToSave: DrawingStroke = {
      ...stroke,
      createdAtMs: stroke.createdAtMs ?? Date.now(),
    };

    setPendingMyStrokes((prev) => [...prev, strokeToSave]);

    const drawingRef = doc(db, "rooms", resolvedRoomId, "drawingsByPlayer", playerId);
    const myTurnOrder = room?.turnOrder.findIndex((turnPlayerId) => turnPlayerId === playerId) ?? 0;
    const playerName = currentPlayer?.nickname ?? "Unknown";
    const drawingPayload = {
      playerId,
      playerName,
      gameSession: currentGameSession,
      round: room?.round ?? 1,
      turnOrder: myTurnOrder,
      strokes: arrayUnion(strokeToSave),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(drawingRef, drawingPayload, { merge: true });
    } catch {
      pushToast("그림 저장이 지연됩니다. 자동으로 다시 시도합니다.");

      window.setTimeout(() => {
        void setDoc(drawingRef, drawingPayload, { merge: true }).catch(() => {
          pushToast("그림 저장 재시도 실패: 연결 상태를 확인해 주세요.");
        });
      }, 450);
    }
  };

  const handleEndTurn = async () => {
    if (!isMyTurn || room?.status !== "playing") {
      return;
    }

    await advanceTurn();
  };

  const handleClearCanvas = async () => {
    if (!resolvedRoomId || room?.status !== "playing" || !canDrawNow || clearingCanvas) {
      return;
    }

    setClearingCanvas(true);

    try {
      await deleteDoc(doc(db, "rooms", resolvedRoomId, "drawingsByPlayer", playerId));
      setPendingMyStrokes([]);
      pushToast("캔버스를 전체 지웠습니다.");
    } catch {
      setVoteResultDialog({
        open: true,
        message: "캔버스 전체 지우기 중 오류가 발생했습니다.",
      });
    } finally {
      setClearingCanvas(false);
    }
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
        updates.resultMessage = `${resultMessage} / 마피아에게 제시어 추측 기회가 주어집니다 (${MAFIA_GUESS_TIME_SECONDS}초 제한).`;
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
      const answer = normalizeText(toCitizenPromptText(room.prompt));
      const isCorrect = guess === answer;
      const citizenPromptText = toCitizenPromptText(room.prompt);
      const mafiaPromptText = toMafiaPromptText(room.prompt);

      await updateDoc(doc(db, "rooms", resolvedRoomId), {
        status: "ended",
        winner: isCorrect ? "mafia" : "citizen",
        awaitingMafiaGuess: false,
        resultMessage: isCorrect
          ? `마피아가 시민 제시어를 맞춰 역전 승리 / 시민: ${citizenPromptText} / 마피아: ${mafiaPromptText}`
          : `마피아 추측 실패, 시민 승리 / 시민 정답: ${citizenPromptText} / 마피아 제시어: ${mafiaPromptText}`,
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
      await clearRoomSubcollection(resolvedRoomId, "drawingsByPlayer");

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

  const handleConfirmLeaveRoom = async () => {
    setLeaveConfirmOpen(false);
    await handleLeaveRoom();
  };

  useEffect(() => {
    if (!room || room.status !== "playing" || !isHost) {
      return;
    }

    if (remainingSeconds > 0 || endingTurn) {
      return;
    }

    const turnKey = `${currentGameSession}-${room.round}-${room.turnIndex}`;

    if (autoAdvancedTurnKeyRef.current === turnKey) {
      return;
    }

    autoAdvancedTurnKeyRef.current = turnKey;

    void advanceTurn().catch(() => {
      autoAdvancedTurnKeyRef.current = "";
    });
  }, [currentGameSession, endingTurn, isHost, remainingSeconds, room]);

  useEffect(() => {
    if (!room || room.status !== "voting" || !isHost) {
      return;
    }

    const shouldFinalize = voteRemainingSeconds <= 0 || allVotesCompleted;

    if (!shouldFinalize || finalizingVote) {
      return;
    }

    const voteKey = `${currentGameSession}-${room.round}-${room.status}`;

    if (autoFinalizedVoteKeyRef.current === voteKey) {
      return;
    }

    autoFinalizedVoteKeyRef.current = voteKey;

    void finalizeVoting().catch(() => {
      autoFinalizedVoteKeyRef.current = "";
    });
  }, [allVotesCompleted, currentGameSession, finalizingVote, isHost, room, voteRemainingSeconds]);

  useEffect(() => {
    if (
      !room ||
      room.status !== "result" ||
      !isHost ||
      room.winner ||
      room.awaitingMafiaGuess ||
      continuingRound
    ) {
      return;
    }

    const roundKey = `${currentGameSession}-${room.round}-${room.status}`;

    if (autoContinuedRoundKeyRef.current === roundKey) {
      return;
    }

    autoContinuedRoundKeyRef.current = roundKey;

    const timeoutId = window.setTimeout(() => {
      void handleContinueRound().catch(() => {
        autoContinuedRoundKeyRef.current = "";
      });
    }, 1800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [continuingRound, currentGameSession, isHost, room]);

  useEffect(() => {
    if (
      !room ||
      room.status !== "result" ||
      !room.awaitingMafiaGuess ||
      !isHost ||
      room.winner ||
      mafiaGuessRemainingSeconds > 0
    ) {
      return;
    }

    const timeoutKey = `${currentGameSession}-${room.round}-mafia-guess-timeout`;

    if (autoFinalizedMafiaGuessTimeoutKeyRef.current === timeoutKey) {
      return;
    }

    autoFinalizedMafiaGuessTimeoutKeyRef.current = timeoutKey;

    void (async () => {
      try {
        const roomRef = doc(db, "rooms", resolvedRoomId);
        const latestRoomSnap = await getDoc(roomRef);

        if (!latestRoomSnap.exists()) {
          return;
        }

        const latestRoom = latestRoomSnap.data() as Room;

        if (latestRoom.status !== "result" || !latestRoom.awaitingMafiaGuess || latestRoom.winner) {
          return;
        }

        await updateDoc(roomRef, {
          status: "ended",
          winner: "citizen",
          awaitingMafiaGuess: false,
          resultMessage: `마피아 추측 시간(${MAFIA_GUESS_TIME_SECONDS}초) 초과, 시민 승리 / 시민 정답: ${toCitizenPromptText(latestRoom.prompt)} / 마피아 제시어: ${toMafiaPromptText(latestRoom.prompt)}`,
        });
      } catch {
        autoFinalizedMafiaGuessTimeoutKeyRef.current = "";
      }
    })();
  }, [currentGameSession, isHost, mafiaGuessRemainingSeconds, resolvedRoomId, room]);

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

  const winnerNicknames = useMemo(() => {
    if (!room?.winner) {
      return [] as string[];
    }

    const winnerRole = room.winner === "mafia" ? "mafia" : "citizen";
    return players
      .filter((player) => player.role === winnerRole)
      .map((player) => player.nickname);
  }, [players, room?.winner]);

  const isCurrentPlayerWinner = useMemo(() => {
    if (!currentPlayer || !room?.winner) {
      return false;
    }

    const winnerRole = room.winner === "mafia" ? "mafia" : "citizen";
    return currentPlayer.role === winnerRole;
  }, [currentPlayer, room?.winner]);

  const stageGuide = useMemo(
    () => [
      { key: "playing", label: "그림 그리기" },
      { key: "voting", label: "투표" },
      { key: "result", label: "결과 공개" },
      { key: "ended", label: "종료" },
    ],
    []
  );

  const aliveBotPlayers = useMemo(
    () =>
      alivePlayers.filter(
        (player) => player.isBot || player.id.startsWith(TEST_BOT_PREFIX)
      ),
    [alivePlayers]
  );

  useEffect(() => {
    if (!room || room.status === "ended" || currentPlayer || !resolvedRoomId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      router.push(`/room/${resolvedRoomId}${testQuerySuffix}`);
    }, 3000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [currentPlayer, resolvedRoomId, room, router, testQuerySuffix]);

  useEffect(() => {
    if (!room || room.status !== "ended" || !room.endedByHostLeave || hostLeaveHandledRef.current) {
      return;
    }

    hostLeaveHandledRef.current = true;
    setVoteResultDialog({
      open: true,
      message: "방장이 퇴장하여 방이 종료되었습니다. 홈으로 이동합니다.",
    });

    const timeoutId = window.setTimeout(() => {
      router.push("/");
    }, 1200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [room, router]);

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
      playSound("turn");
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

  useEffect(() => {
    if (!room || room.status !== "ended" || !room.winner || !currentPlayer || !isCurrentPlayerWinner) {
      return;
    }

    const winnerDialogKey = `${currentGameSession}-${room.round}-${room.winner}-${currentPlayer.id}`;

    if (previousWinnerDialogKeyRef.current === winnerDialogKey) {
      return;
    }

    previousWinnerDialogKeyRef.current = winnerDialogKey;
    setWinnerDialogOpen(true);
  }, [currentPlayer, isCurrentPlayerWinner, room]);

  useEffect(() => {
    if (voteResultDialog.open) {
      playSound("vote");
    }
  }, [voteResultDialog.open]);

  useEffect(() => {
    const currentEliminated = room?.eliminatedPlayerId ?? null;

    if (currentEliminated && currentEliminated !== previousEliminatedRef.current) {
      playSound("elimination");
    }

    previousEliminatedRef.current = currentEliminated;
  }, [room?.eliminatedPlayerId]);

  useEffect(() => {
    if (!isTestMode || !isHost || !room || room.status !== "playing" || !currentTurnPlayer) {
      return;
    }

    const isBotTurn = currentTurnPlayer.isBot || currentTurnPlayer.id.startsWith(TEST_BOT_PREFIX);

    if (!isBotTurn) {
      return;
    }

    const botTurnKey = `${currentGameSession}-${room.round}-${room.turnIndex}`;

    if (botAutoTurnKeyRef.current === botTurnKey || endingTurn) {
      return;
    }

    botAutoTurnKeyRef.current = botTurnKey;

    const timeoutId = window.setTimeout(() => {
      void advanceTurn().catch(() => {
        botAutoTurnKeyRef.current = "";
      });
    }, 1200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [currentGameSession, currentTurnPlayer, endingTurn, isHost, isTestMode, room]);

  useEffect(() => {
    if (!isTestMode || !isHost || !room || room.status !== "voting" || aliveBotPlayers.length === 0) {
      return;
    }

    const alreadyVoted = new Set(votes.map((vote) => vote.voterId));
    const candidateTargets = [...alivePlayers.map((player) => player.id), VOTE_SKIP_TARGET];
    const pendingBots = aliveBotPlayers.filter((player) => !alreadyVoted.has(player.id));

    if (pendingBots.length === 0) {
      return;
    }

    void Promise.all(
      pendingBots.map((botPlayer) => {
        const randomTarget =
          candidateTargets[Math.floor(Math.random() * candidateTargets.length)] ?? VOTE_SKIP_TARGET;

        return setDoc(doc(db, "rooms", resolvedRoomId, "votes", botPlayer.id), {
          voterId: botPlayer.id,
          targetId: randomTarget,
        });
      })
    );
  }, [aliveBotPlayers, alivePlayers, isHost, isTestMode, resolvedRoomId, room, votes]);

  const handleRestartGame = async () => {
    if (!room || room.status !== "ended" || !isHost || restartingGame) {
      return;
    }

    setRestartingGame(true);

    try {
      await clearRoomSubcollection(resolvedRoomId, "votes");
      await clearRoomSubcollection(resolvedRoomId, "drawingsByPlayer");

      const playerSnaps = await getDocs(
        query(collection(db, "rooms", resolvedRoomId, "players"), orderBy("joinedAt", "asc"))
      );
      const currentPlayers = playerSnaps.docs.map((item) => item.data() as Player);

      if (currentPlayers.length === 0) {
        setVoteResultDialog({
          open: true,
          message: "재시작 실패: 플레이어 정보가 없습니다.",
        });
        return;
      }

      const turnOrder = shuffle(currentPlayers.map((player) => player.id));
      const mafiaId = turnOrder[Math.floor(Math.random() * turnOrder.length)];
      const selectedPrompt = getRandomPromptPair();

      const roomRef = doc(db, "rooms", resolvedRoomId);
      const batch = writeBatch(db);

      batch.update(roomRef, {
        status: "playing",
        gameSession: currentGameSession + 1,
        prompt: selectedPrompt,
        mafiaId,
        turnOrder,
        turnIndex: 0,
        round: 1,
        eliminatedPlayerId: null,
        eliminatedRole: null,
        resultMessage: "",
        winner: null,
        awaitingMafiaGuess: false,
      });

      currentPlayers.forEach((player) => {
        const playerRef = doc(db, "rooms", resolvedRoomId, "players", player.id);

        batch.update(playerRef, {
          role: player.id === mafiaId ? "mafia" : "citizen",
          alive: true,
        });
      });

      await batch.commit();
      setStartDialogOpen(true);
      pushToast("같은 방에서 새 게임을 시작했습니다.");
    } catch {
      setVoteResultDialog({
        open: true,
        message: "게임 재시작 중 오류가 발생했습니다.",
      });
    } finally {
      setRestartingGame(false);
    }
  };

  return (
    <>
      <main className="min-h-dvh bg-dm-bg p-2 text-dm-text-primary sm:p-4 xl:h-screen xl:overflow-hidden">
        <Card className="mx-auto flex min-h-[calc(100dvh-1rem)] w-full max-w-[1500px] flex-col p-2 sm:min-h-[calc(100dvh-2rem)] sm:p-4 xl:h-full xl:overflow-hidden" hover>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">DRAW MAFIA</h1>
              {isTestMode ? (
                <span className="rounded-full border border-dm-secondary/45 bg-dm-secondary/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-dm-secondary">
                  TEST
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${connectionClassName}`}>
                {connectionLabel}
              </span>
              <span className="rounded-md border border-dm-accent/40 px-2 py-0.5 text-[10px] text-dm-text-secondary">
                ROOM {resolvedRoomId || "-"}
              </span>
              <Button
                type="button"
                onClick={() => setSoundEnabled((prev) => !prev)}
                variant="ghost"
                className="min-w-[94px] px-2 py-1 text-[10px]"
              >
                {soundEnabled ? "SOUND ON" : "SOUND OFF"}
              </Button>
              <ChatPanel
                roomId={resolvedRoomId}
                playerId={playerId}
                nickname={currentPlayer?.nickname ?? "익명"}
                isEnabled={room?.status === "voting"}
                disabledReason={
                  room?.status === "playing"
                    ? "그림을 그리는 중에는 채팅할 수 없어요"
                    : "채팅은 대기방과 투표 단계에서만 가능합니다"
                }
              />
              <Button
                type="button"
                onClick={() => setLeaveConfirmOpen(true)}
                disabled={leavingRoom}
                variant="secondary"
                className="min-w-[98px] px-2 py-1 text-[10px]"
              >
                {leavingRoom ? "이탈 중" : "방 나가기"}
              </Button>
            </div>
          </div>

          <Card className="mt-2 shrink-0 border-dm-accent/20 bg-dm-bg/35 p-3" hover>
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
              <div>
                <p className="text-[10px] font-semibold text-dm-text-secondary">GAME STATUS</p>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {stageGuide.map((stage) => {
                    const active = room?.status === stage.key;

                    return (
                      <span
                        key={stage.key}
                        className={`rounded-full border px-2 py-0.5 text-[10px] ${
                          active
                            ? "border-dm-accent bg-dm-accent/20 text-dm-text-primary"
                            : "border-dm-accent/20 text-dm-text-secondary"
                        }`}
                      >
                        {stage.label}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-semibold text-dm-text-secondary">CURRENT PROMPT</p>
                <p className="mt-1 truncate text-sm font-semibold text-dm-secondary">{visiblePrompt || "로딩 중..."}</p>
              </div>

              <div>
                <p className="text-[10px] font-semibold text-dm-text-secondary">TIMER</p>
                <p className="mt-1 text-lg font-bold text-dm-accent">
                  {`${timerDisplay.seconds}s`}
                </p>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-dm-card">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-dm-primary to-dm-accent transition-all duration-500"
                    style={{
                      width: `${timerDisplay.percent}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </Card>

          {networkDelayed ? (
            <p className="mt-1 shrink-0 text-xs text-dm-secondary">네트워크 지연이 감지되었습니다. 동기화 재시도 중입니다.</p>
          ) : null}

          {finalizingVote || continuingRound ? (
            <div className="mt-1 shrink-0">
              <LoadingSpinner label="데이터 동기화 중..." />
            </div>
          ) : null}

          <div className="mt-3 grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_380px] xl:overflow-hidden">
            <Card className="flex min-h-[320px] flex-col border-dm-accent/20 bg-dm-bg/40 p-3 xl:min-h-0" hover>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-dm-text-secondary">DRAW BOARD</h2>
                <p className="text-[10px] text-dm-text-secondary">
                  {room?.status === "playing"
                    ? isMyTurn
                      ? "내 턴"
                      : "상대 턴"
                    : room?.status === "voting"
                      ? `그림 보기: ${activeGalleryDrawing?.playerName ?? "-"}`
                      : room?.status === "result"
                        ? `결과 보기: ${activeGalleryDrawing?.playerName ?? "-"}`
                        : "종료"}
                </p>
              </div>
              <div className="mt-2 min-h-0 flex-1">
                {room?.status === "playing" ? (
                  <CanvasBoard
                    strokes={renderCanvasStrokes}
                    canDraw={canDrawNow}
                    tool={tool}
                    color={color}
                    size={size}
                    onStrokeComplete={handleStrokeComplete}
                  />
                ) : (
                  <div className="relative h-full w-full">
                    <div className="grid h-full min-h-0 grid-cols-[0.85fr_2.3fr_0.85fr] gap-2 sm:grid-cols-[1fr_2.6fr_1fr]">
                      <div className="flex min-h-0 flex-col">
                        <p className="truncate pb-1 text-[10px] text-dm-text-secondary text-left">
                          {prevGalleryDrawing?.playerName ?? ""}
                        </p>
                        <div className="min-h-0 flex-1 opacity-35">
                          <CanvasBoard
                            strokes={prevGalleryDrawing?.strokes ?? []}
                            canDraw={false}
                            tool={tool}
                            color={color}
                            size={size}
                            onStrokeComplete={handleStrokeComplete}
                          />
                        </div>
                      </div>

                      <div className="relative min-h-0">
                        <CanvasBoard
                          strokes={activeGalleryDrawing?.strokes ?? []}
                          canDraw={false}
                          tool={tool}
                          color={color}
                          size={size}
                          onStrokeComplete={handleStrokeComplete}
                        />
                        <div className="pointer-events-none absolute left-2 top-2 rounded-md bg-dm-bg/75 px-2 py-1 text-[10px] text-dm-text-primary">
                          {prevGalleryDrawing?.playerName ?? ""}
                        </div>
                        <div className="pointer-events-none absolute right-2 top-2 rounded-md bg-dm-bg/75 px-2 py-1 text-[10px] text-dm-text-primary">
                          {nextGalleryDrawing?.playerName ?? ""}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={handlePrevGallery}
                          disabled={orderedDrawings.length <= 1}
                          className="absolute left-2 top-1/2 h-9 w-9 min-w-0 -translate-y-1/2 px-0 py-0 text-xs"
                        >
                          {"<"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={handleNextGallery}
                          disabled={orderedDrawings.length <= 1}
                          className="absolute right-2 top-1/2 h-9 w-9 min-w-0 -translate-y-1/2 px-0 py-0 text-xs"
                        >
                          {">"}
                        </Button>
                      </div>

                      <div className="flex min-h-0 flex-col">
                        <p className="truncate pb-1 text-[10px] text-dm-text-secondary text-right">
                          {nextGalleryDrawing?.playerName ?? ""}
                        </p>
                        <div className="min-h-0 flex-1 opacity-35">
                          <CanvasBoard
                            strokes={nextGalleryDrawing?.strokes ?? []}
                            canDraw={false}
                            tool={tool}
                            color={color}
                            size={size}
                            onStrokeComplete={handleStrokeComplete}
                          />
                        </div>
                      </div>
                    </div>
                    <p className="mt-1 text-center text-[10px] text-dm-text-secondary">
                      현재 {Math.min(galleryIndex + 1, orderedDrawings.length || 1)} / {Math.max(orderedDrawings.length, 1)}
                    </p>
                  </div>
                )}
              </div>
            </Card>

            <div className="flex min-h-0 flex-col gap-3 xl:overflow-y-auto xl:pr-1">
              <Card className="border-dm-accent/20 bg-dm-bg/40 p-3" hover>
                <p className="text-[10px] font-semibold text-dm-text-secondary">현재 턴 플레이어</p>
                <p className="mt-1 text-sm font-semibold text-dm-accent">{currentTurnPlayer?.nickname ?? "대기 중"}</p>
                <p className="mt-1 text-[10px] text-dm-text-secondary">내 역할: {currentPlayer?.role === "mafia" ? "마피아" : "시민"}</p>
                <p className="text-[10px] text-dm-text-secondary">투표: {votedCount} / {eligibleVoterIds.length}</p>
              </Card>

              <Card className="min-h-[190px] flex flex-1 flex-col overflow-hidden border-dm-accent/20 bg-dm-bg/40 p-3" hover>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex w-full items-center gap-1 rounded-lg border border-dm-accent/20 bg-dm-bg/70 p-1 sm:w-auto">
                    <Button
                      type="button"
                      variant={rightPanelTab === "players" ? "secondary" : "ghost"}
                      onClick={() => setRightPanelTab("players")}
                      className="h-9 flex-1 px-3 text-xs sm:h-7 sm:min-w-[74px] sm:flex-none sm:px-2 sm:text-[10px]"
                    >
                      플레이어
                    </Button>
                    <Button
                      type="button"
                      variant={rightPanelTab === "vote" ? "secondary" : "ghost"}
                      onClick={() => setRightPanelTab("vote")}
                      className="h-9 flex-1 px-3 text-xs sm:h-7 sm:min-w-[74px] sm:flex-none sm:px-2 sm:text-[10px]"
                    >
                      투표
                    </Button>
                  </div>
                </div>

                {rightPanelTab === "players" ? (
                  <>
                    <ul className="mt-2 space-y-1 overflow-y-auto text-xs">
                      {(room?.turnOrder ?? []).map((turnPlayerId, index) => {
                          const player = players.find((item) => item.id === turnPlayerId);
                          const active = room?.turnIndex === index;
                          const eliminated = !player?.alive;

                          return (
                            <li
                              key={turnPlayerId}
                              className={`flex items-center justify-between rounded-md border px-2 py-1 ${
                                active
                                  ? "border-dm-accent bg-dm-accent/18 text-dm-text-primary"
                                  : eliminated
                                    ? "border-dm-accent/10 bg-dm-bg/40 text-dm-text-secondary/50 opacity-55"
                                    : "border-dm-accent/20 bg-dm-bg text-dm-text-secondary"
                              }`}
                            >
                              <span className={eliminated ? "line-through" : ""}>{player?.nickname ?? "알 수 없음"}</span>
                              <span>{player?.alive ? "생존" : "탈락"}</span>
                            </li>
                          );
                        })}
                    </ul>
                  </>
                ) : (
                  <div className="mt-2 min-h-0 overflow-y-auto">
                    {room?.status === "voting" ? (
                      <div className="grid grid-cols-1 gap-2">
                        {alivePlayers.map((player) => (
                          <Button
                            key={player.id}
                            type="button"
                            variant="ghost"
                            onClick={() => handleCastVote(player.id)}
                            disabled={!isAlive || Boolean(myVote) || submittingVote}
                            className="flex min-h-11 items-center justify-between px-3 py-2 text-sm"
                          >
                            <span>{player.nickname}</span>
                            <span>투표</span>
                          </Button>
                        ))}
                        <Button
                          type="button"
                          onClick={() => handleCastVote(VOTE_SKIP_TARGET)}
                          disabled={!isAlive || Boolean(myVote) || submittingVote}
                          className="min-h-11 px-3 py-2 text-sm"
                        >
                          넘어가기
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-dm-text-secondary">현재는 투표 단계가 아닙니다.</p>
                    )}
                  </div>
                )}
              </Card>

              {room?.status === "result" ? (
                <Card className="border-dm-accent/35 bg-dm-bg/45 p-3" hover>
                  <h3 className="text-[10px] font-semibold text-dm-accent">RESULT</h3>
                  <p className="mt-1 text-xs text-dm-text-primary">{room.resultMessage ?? "결과 계산 중"}</p>
                  {room.awaitingMafiaGuess && currentPlayer?.role === "mafia" ? (
                    <div className="mt-2 flex gap-1">
                      <input
                        type="text"
                        value={mafiaGuessWord}
                        onChange={(event) => setMafiaGuessWord(event.target.value)}
                        placeholder="제시어 입력"
                        className="dm-input h-9 px-3 py-2 text-xs"
                      />
                      <Button
                        type="button"
                        onClick={handleMafiaGuessSubmit}
                        disabled={submittingGuess}
                        variant="secondary"
                        className="min-w-[80px] px-3 py-2 text-xs"
                      >
                        제출
                      </Button>
                    </div>
                  ) : null}
                  {room.awaitingMafiaGuess ? (
                    <p className="mt-2 text-[11px] text-dm-secondary">마피아 추측 남은 시간: {mafiaGuessRemainingSeconds}s</p>
                  ) : null}
                </Card>
              ) : null}

              {room?.status === "ended" ? (
                <Card className="border-dm-secondary/45 bg-dm-bg/50 p-3" hover>
                  <h3 className="text-sm font-bold text-dm-secondary">GAME END</h3>
                  <p className="mt-1 text-xs text-dm-text-primary">승리 팀: {room.winner === "mafia" ? "마피아" : "시민"}</p>
                  <p className="text-xs text-dm-accent">승리자: {winnerNicknames.length > 0 ? winnerNicknames.join(", ") : "확인 불가"}</p>
                  <p className="mt-2 text-[11px] text-dm-text-secondary">
                    {isHost
                      ? "다음 게임은 '같은 방 다시 시작' 버튼을 눌러 시작하세요."
                      : "방장이 다시 시작할 때까지 대기하거나 홈으로 이동할 수 있습니다."}
                  </p>
                  <p className="mt-2 text-[11px] text-dm-text-secondary">
                    시민 제시어: <span className="font-semibold text-dm-text-primary">{citizenPromptText || "-"}</span>
                  </p>
                  <p className="text-[11px] text-dm-text-secondary">
                    마피아 제시어: <span className="font-semibold text-dm-text-primary">{mafiaPromptText || "-"}</span>
                  </p>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Button
                      type="button"
                      onClick={handleRestartGame}
                      disabled={!isHost || restartingGame}
                      className="w-full px-3 py-2 text-sm"
                    >
                      {restartingGame ? "재시작 중" : "같은 방 다시 시작"}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => router.push("/")}
                      variant="secondary"
                      className="w-full px-3 py-2 text-sm"
                    >
                      홈
                    </Button>
                  </div>
                </Card>
              ) : null}
            </div>
          </div>

          <Card className="relative z-20 mt-3 shrink-0 border-dm-accent/20 bg-dm-bg/40 p-3" hover>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[auto_1fr_auto] md:items-center">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTool("pen")}
                  className={`rounded-md border px-3 py-1.5 text-xs ${
                    tool === "pen"
                      ? "border-dm-accent bg-dm-accent/20 text-dm-text-primary"
                      : "border-dm-accent/25 bg-dm-bg text-dm-text-secondary"
                  } whitespace-nowrap`}
                >
                  펜
                </button>
                <button
                  type="button"
                  onClick={() => setTool("eraser")}
                  className={`rounded-md border px-3 py-1.5 text-xs ${
                    tool === "eraser"
                      ? "border-dm-secondary bg-dm-secondary/20 text-dm-text-primary"
                      : "border-dm-secondary/30 bg-dm-bg text-dm-text-secondary"
                  } whitespace-nowrap`}
                >
                  지우개
                </button>
              </div>

              <div className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center md:justify-center">
                <div className="flex items-center gap-1.5">
                  {colorPalette.map((paletteColor) => (
                    <button
                      key={paletteColor}
                      type="button"
                      onClick={() => setColor(paletteColor)}
                      title={paletteColor}
                      className={`h-6 w-6 rounded-full border-2 ${
                        color === paletteColor ? "border-dm-text-primary shadow-dm-glow" : "border-dm-text-secondary"
                      }`}
                      style={{ backgroundColor: paletteColor }}
                    />
                  ))}
                </div>

                <label className="flex items-center gap-2 text-xs text-dm-text-secondary">
                  굵기
                  <input
                    type="range"
                    className="w-28 sm:w-32"
                    min={2}
                    max={18}
                    value={size}
                    onChange={(event) => setSize(Number(event.target.value))}
                  />
                  <span>{size}</span>
                </label>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center md:justify-end">
                <Button
                  type="button"
                  onClick={handleClearCanvas}
                  disabled={!canDrawNow || room?.status !== "playing" || clearingCanvas}
                  variant="ghost"
                  className="w-full min-w-[98px] px-3 py-2 text-xs sm:w-auto"
                >
                  {clearingCanvas ? "지우는 중" : "전체 지우기"}
                </Button>
                <Button
                  type="button"
                  onClick={handleEndTurn}
                  disabled={!isMyTurn || endingTurn || room?.status !== "playing"}
                  className="w-full min-w-[98px] px-3 py-2 text-xs sm:w-auto"
                >
                  {endingTurn ? "처리 중" : "턴 종료"}
                </Button>
              </div>
            </div>
          </Card>
        </Card>
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

      <GameDialog
        open={winnerDialogOpen}
        title="🎉 승리!"
        description={`축하합니다! ${currentPlayer?.nickname ?? "플레이어"}님이 승리 팀(${room?.winner === "mafia" ? "마피아" : "시민"})에 포함되었습니다.`}
        onOpenChange={setWinnerDialogOpen}
      />

      <ConfirmDialog
        open={leaveConfirmOpen}
        title="방을 나가시겠습니까?"
        description="나가기를 누르면 현재 방에서 퇴장하고 홈으로 이동합니다."
        confirmLabel="나가기"
        cancelLabel="취소"
        loading={leavingRoom}
        onOpenChange={setLeaveConfirmOpen}
        onConfirm={() => void handleConfirmLeaveRoom()}
      />
    </>
  );
}
