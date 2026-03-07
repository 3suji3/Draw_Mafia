const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRoomCode(length = ROOM_CODE_LENGTH): string {
  let code = "";

  for (let i = 0; i < length; i += 1) {
    const randomIndex = Math.floor(Math.random() * ROOM_CODE_CHARS.length);
    code += ROOM_CODE_CHARS[randomIndex];
  }

  return code;
}

export function normalizeRoomCode(value: string): string {
  return value.trim().toUpperCase();
}
