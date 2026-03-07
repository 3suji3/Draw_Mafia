export type CanvasTool = "pen" | "eraser";

export type StrokePoint = {
  x: number;
  y: number;
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
