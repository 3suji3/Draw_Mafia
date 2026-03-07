"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { CanvasTool, Stroke, StrokePoint } from "@/types/canvas";

type CanvasBoardProps = {
  strokes: Stroke[];
  canDraw: boolean;
  tool: CanvasTool;
  color: string;
  size: number;
  onStrokeComplete: (stroke: Pick<Stroke, "tool" | "color" | "size" | "points">) => Promise<void>;
};

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;

function drawStroke(
  context: CanvasRenderingContext2D,
  stroke: Pick<Stroke, "tool" | "color" | "size" | "points">
) {
  if (stroke.points.length === 0) {
    return;
  }

  context.lineJoin = "round";
  context.lineCap = "round";
  context.lineWidth = stroke.size;
  context.strokeStyle = stroke.tool === "eraser" ? "#0f172a" : stroke.color;

  context.beginPath();
  context.moveTo(stroke.points[0].x, stroke.points[0].y);

  for (let index = 1; index < stroke.points.length; index += 1) {
    context.lineTo(stroke.points[index].x, stroke.points[index].y);
  }

  context.stroke();
}

export function CanvasBoard({
  strokes,
  canDraw,
  tool,
  color,
  size,
  onStrokeComplete,
}: CanvasBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [activePoints, setActivePoints] = useState<StrokePoint[]>([]);

  const activeStroke = useMemo(
    () => ({ tool, color, size, points: activePoints }),
    [activePoints, color, size, tool]
  );

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.fillStyle = "#0f172a";
    context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    strokes.forEach((stroke) => {
      drawStroke(context, stroke);
    });

    if (activeStroke.points.length > 0) {
      drawStroke(context, activeStroke);
    }
  }, [activeStroke, strokes]);

  const getPointFromEvent = (event: ReactPointerEvent<HTMLCanvasElement>): StrokePoint => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return { x: 0, y: 0 };
    }

    const rect = canvas.getBoundingClientRect();
    const ratioX = CANVAS_WIDTH / rect.width;
    const ratioY = CANVAS_HEIGHT / rect.height;

    return {
      x: (event.clientX - rect.left) * ratioX,
      y: (event.clientY - rect.top) * ratioY,
    };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canDraw) {
      return;
    }

    drawingRef.current = true;
    setActivePoints([getPointFromEvent(event)]);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canDraw || !drawingRef.current) {
      return;
    }

    const point = getPointFromEvent(event);
    setActivePoints((prev) => [...prev, point]);
  };

  const completeStroke = async () => {
    if (!canDraw || activePoints.length < 2) {
      setActivePoints([]);
      return;
    }

    await onStrokeComplete({
      tool,
      color,
      size,
      points: activePoints,
    });

    setActivePoints([]);
  };

  const handlePointerUp = async () => {
    if (!drawingRef.current) {
      return;
    }

    drawingRef.current = false;
    await completeStroke();
  };

  const handlePointerLeave = async () => {
    if (!drawingRef.current) {
      return;
    }

    drawingRef.current = false;
    await completeStroke();
  };

  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className={`h-auto w-full touch-none ${canDraw ? "cursor-crosshair" : "cursor-not-allowed opacity-80"}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
      />
    </div>
  );
}
