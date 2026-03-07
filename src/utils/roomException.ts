import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/firebase/firebase";
import type { Player, Room } from "@/types/room";

type LeaveRoomOptions = {
  roomId: string;
  playerId: string;
};

const VALID_ROOM_STATUS = new Set(["waiting", "playing", "voting", "result", "ended"]);

export function validateRoomState(room: Room): string | null {
  if (!VALID_ROOM_STATUS.has(room.status)) {
    return "지원하지 않는 room status 입니다.";
  }

  if (!Number.isFinite(room.drawTime) || room.drawTime <= 0 || room.drawTime > 300) {
    return "잘못된 drawTime 값입니다.";
  }

  if (!Number.isFinite(room.voteTime) || room.voteTime <= 0 || room.voteTime > 300) {
    return "잘못된 voteTime 값입니다.";
  }

  if (!Array.isArray(room.turnOrder)) {
    return "잘못된 turnOrder 구조입니다.";
  }

  if (room.turnOrder.length > 0 && (room.turnIndex < 0 || room.turnIndex >= room.turnOrder.length)) {
    return "turnIndex 범위가 유효하지 않습니다.";
  }

  return null;
}

export async function leaveRoomAndHandleHost(options: LeaveRoomOptions): Promise<void> {
  const { roomId, playerId } = options;
  const roomRef = doc(db, "rooms", roomId);
  const roomSnap = await getDoc(roomRef);

  if (!roomSnap.exists()) {
    return;
  }

  const room = roomSnap.data() as Room;
  const playersSnap = await getDocs(
    query(collection(db, "rooms", roomId, "players"), orderBy("joinedAt", "asc"))
  );

  const players = playersSnap.docs.map((item) => item.data() as Player);
  const leavingPlayer = players.find((player) => player.id === playerId);

  if (!leavingPlayer) {
    return;
  }

  const batch = writeBatch(db);
  const leavingPlayerRef = doc(db, "rooms", roomId, "players", playerId);
  const isHostLeaving = leavingPlayer.isHost || room.hostId === playerId;

  if (room.status === "waiting") {
    batch.delete(leavingPlayerRef);
  } else {
    batch.update(leavingPlayerRef, {
      alive: false,
      isHost: false,
    });
  }

  if (isHostLeaving) {
    batch.update(roomRef, {
      status: "ended",
      endedByHostLeave: true,
      resultMessage: "방장이 퇴장하여 방이 종료되었습니다.",
      awaitingMafiaGuess: false,
    });
  }

  await batch.commit();
}
