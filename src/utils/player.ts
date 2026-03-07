export function getOrCreatePlayerId(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const storageKey = "draw_mafia_player_id";
  const existing = window.localStorage.getItem(storageKey);

  if (existing) {
    return existing;
  }

  const nextId = crypto.randomUUID();
  window.localStorage.setItem(storageKey, nextId);
  return nextId;
}

export function persistPlayerContext(nickname: string, roomId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem("draw_mafia_nickname", nickname);
  window.localStorage.setItem("draw_mafia_room_id", roomId);
}

export function getStoredNickname(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem("draw_mafia_nickname") ?? "";
}

export function getStoredRoomId(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem("draw_mafia_room_id") ?? "";
}
