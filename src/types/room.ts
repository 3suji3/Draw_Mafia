export type PlayerRole = "citizen" | "mafia";

export type RoomStatus = "waiting" | "playing" | "voting" | "result" | "ended";

export type RoomPrompt = {
  action: string;
  subject: string;
};

export type Room = {
  id: string;
  hostId: string;
  status: RoomStatus;
  maxPlayers: number;
  drawTime: number;
  voteTime: number;
  round: number;
  turnIndex: number;
  turnOrder: string[];
  prompt: RoomPrompt;
  mafiaId: string;
  eliminatedPlayerId?: string | null;
  eliminatedRole?: PlayerRole | null;
  resultMessage?: string;
  winner?: "mafia" | "citizen" | null;
  awaitingMafiaGuess?: boolean;
};

export type Player = {
  id: string;
  nickname: string;
  role: PlayerRole;
  alive: boolean;
  isHost: boolean;
  isBot?: boolean;
  joinedAt: unknown;
};
