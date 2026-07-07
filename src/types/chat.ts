export type ChatChannel = "public" | "ghost";

export type ChatMessage = {
  id: string;
  playerId: string;
  nickname: string;
  message: string;
  audience?: ChatChannel;
  createdAt: unknown; // Firestore Timestamp
};

export const CHAT_MAX_LENGTH = 200;

export const CHAT_EMOJI_LIST = [
  "😂",
  "👍",
  "🤔",
  "😮",
  "😡",
  "👏",
  "😭",
  "👀",
] as const;
