export type CanvasTool = "pen" | "eraser";

export type StrokePoint = {
  x: number;
  y: number;
};

export type DrawingStroke = {
  tool: CanvasTool;
  color: string;
  size: number;
  points: StrokePoint[];
  createdAtMs?: number;
};

export type Stroke = {
  id: string;
  playerId: string;
  tool: CanvasTool;
  color: string;
  size: number;
  points: StrokePoint[];
  createdAt?: unknown;
};

export type PlayerDrawing = {
  id: string;
  playerId: string;
  playerName: string;
  gameSession: number;
  round: number;
  turnOrder: number;
  strokes: DrawingStroke[];
  createdAt?: unknown;
  updatedAt?: unknown;
};
