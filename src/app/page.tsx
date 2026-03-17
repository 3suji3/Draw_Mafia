"use client";

import { useEffect, useState } from "react";
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
import { RuleGuideModal } from "@/components/modals/RuleGuideModal";
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
const THEME_STORAGE_KEY = "draw_mafia_theme";

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
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [testQuerySuffix, setTestQuerySuffix] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");

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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const root = document.documentElement;

    const syncTheme = () => {
      const hasLightClass = root.classList.contains("light");
      const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      setTheme(hasLightClass || storedTheme === "light" ? "light" : "dark");
    };

    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  const isLightTheme = theme === "light";

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
          {!isLightTheme ? (
            <>
              <div className="absolute inset-0 bg-[radial-gradient(1100px_circle_at_15%_0%,rgba(59,130,246,0.12),transparent_44%),radial-gradient(900px_circle_at_88%_12%,rgba(239,68,68,0.11),transparent_42%),linear-gradient(180deg,rgba(2,6,23,0.6)_0%,rgba(2,6,23,0.25)_42%,rgba(0,0,0,0.45)_100%)]" />
              <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-slate-900/55 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/45 to-transparent" />
            </>
          ) : (
            <>
              <div className="absolute inset-0 bg-[radial-gradient(850px_circle_at_10%_2%,rgba(125,211,252,0.25),transparent_42%),radial-gradient(820px_circle_at_92%_8%,rgba(253,224,71,0.2),transparent_40%),linear-gradient(180deg,rgba(240,249,255,0.7)_0%,rgba(236,253,245,0.45)_55%,rgba(254,249,195,0.35)_100%)]" />
              <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-cyan-100/50 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-lime-100/40 to-transparent" />
            </>
          )}
        </div>

        <section className="relative mx-auto w-full max-w-[620px] space-y-4">
          <Card className="border-dm-border/75 bg-dm-card/95 p-4 backdrop-blur" hover>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="overflow-hidden rounded-xl border border-dm-accent/35 bg-dm-muted/70">
                  <Image
                    src={mafiaImage}
                    alt="메인 로비 아트"
                    width={46}
                    height={46}
                    className="h-11 w-11 object-cover"
                    priority
                  />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-dm-text-secondary">Lobby</p>
                  <p className="mt-0.5 text-sm font-semibold text-dm-text-primary">Draw Mafia Matching Center</p>
                </div>
              </div>
              <span className="rounded-full border border-emerald-400/35 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold text-emerald-400">
                실시간 연결
              </span>
            </div>
          </Card>

          <Card className="border-dm-border/75 bg-dm-card/95 p-6 sm:p-7" hover>
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-dm-primary/25 bg-dm-primary/10 px-3 py-1 text-xs font-semibold text-dm-primary">
                QUICK START
              </div>

              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight sm:text-[2.2rem]">
                  친구들과 바로 시작하는
                  <span className="mt-1 block bg-gradient-to-r from-dm-primary via-sky-400 to-dm-accent bg-clip-text text-transparent">
                    그림 마피아 로비
                  </span>
                </h1>
                <p className="text-sm leading-relaxed text-dm-text-subtext sm:text-[15px]">
                  닉네임만 입력하면 새 방 생성 또는 코드 입장이 바로 가능합니다.
                </p>
              </div>
            </div>
          </Card>

          <Card className="border-dm-border/75 bg-dm-card/95 p-5 sm:p-6" hover>
            <div className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-dm-text-secondary">닉네임</span>
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
                <span className="mb-2 block text-sm font-semibold text-dm-text-secondary">방 코드</span>
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

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Button
                  type="button"
                  onClick={createRoom}
                  disabled={isLoading}
                  variant="primary"
                  className="h-12 w-full rounded-2xl text-[15px]"
                >
                  {isLoading ? "처리 중..." : "방 생성"}
                </Button>
                <Button
                  type="button"
                  onClick={joinRoom}
                  disabled={isLoading}
                  variant="ghost"
                  className="h-12 w-full rounded-2xl text-[15px]"
                >
                  {isLoading ? "처리 중..." : "방 입장"}
                </Button>
              </div>

              <Button
                type="button"
                variant="secondary"
                onClick={() => setRuleModalOpen(true)}
                className="h-11 w-full rounded-2xl"
              >
                룰 설명 보기
              </Button>
            </div>
          </Card>
        </section>
      </main>

      <GameDialog
        open={dialog.open}
        title={dialog.title}
        description={dialog.description}
        onOpenChange={closeDialog}
      />

      <RuleGuideModal
        open={ruleModalOpen}
        onOpenChange={setRuleModalOpen}
      />
    </>
  );
}
