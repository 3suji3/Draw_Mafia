"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CanvasTool, DrawingStroke } from "@/types/canvas";

type CanvasBoardProps = {
  strokes: DrawingStroke[];
  canDraw: boolean;
  tool: CanvasTool;
  color: string;
  size: number;
  onStrokeComplete: (stroke: DrawingStroke) => Promise<void>;
};

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;

function resolveCanvasBackgroundColor(): string {
  if (typeof window === "undefined") {
    return "rgb(17 24 39)";
  }

  const raw = getComputedStyle(document.documentElement).getPropertyValue("--dm-card").trim();

  if (!raw) {
    return "rgb(17 24 39)";
  }

  const isRgbTriplet = /^\d+\s+\d+\s+\d+$/.test(raw);
  return isRgbTriplet ? `rgb(${raw})` : raw;
}

function drawStroke(
  context: CanvasRenderingContext2D,
  stroke: DrawingStroke,
  backgroundColor: string
) {
  if (stroke.points.length === 0) {
    return;
  }

  context.lineJoin = "round";
  context.lineCap = "round";
  context.lineWidth = stroke.size;
  context.strokeStyle = stroke.tool === "eraser" ? backgroundColor : stroke.color;

  if (stroke.points.length === 1) {
    context.beginPath();
    context.fillStyle = context.strokeStyle;
    context.arc(stroke.points[0].x, stroke.points[0].y, stroke.size / 2, 0, Math.PI * 2);
    context.fill();
    return;
  }

  context.beginPath();
  context.moveTo(stroke.points[0].x, stroke.points[0].y);

  for (let index = 1; index < stroke.points.length; index += 1) {
    context.lineTo(stroke.points[index].x, stroke.points[index].y);
  }

  context.stroke();
}

function interpolatePoints(
  from: DrawingStroke["points"][number],
  to: DrawingStroke["points"][number]
): DrawingStroke["points"] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  const stepPx = 2;
  const steps = Math.max(0, Math.floor(distance / stepPx) - 1);
  const points: DrawingStroke["points"] = [];

  for (let step = 1; step <= steps; step += 1) {
    const ratio = step / (steps + 1);
    points.push({
      x: from.x + dx * ratio,
      y: from.y + dy * ratio,
    });
  }

  return points;
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
  const drawingRef = useRef<boolean>(false);
  const [activePoints, setActivePoints] = useState<DrawingStroke["points"]>([]);
  const activePointsRef = useRef<DrawingStroke["points"]>([]);

  const canvasBackgroundColor = useMemo(() => resolveCanvasBackgroundColor(), []);

  const activeStroke = useMemo<DrawingStroke>(() => ({
    tool,
    color,
    size,
    points: activePoints,
  }), [activePoints, color, size, tool]);

  useEffect(() => {
    activePointsRef.current = activePoints;
  }, [activePoints]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.fillStyle = canvasBackgroundColor;
    context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    strokes.forEach((stroke) => {
      drawStroke(context, stroke, canvasBackgroundColor);
    });

    if (activeStroke.points.length > 0) {
      drawStroke(context, activeStroke, canvasBackgroundColor);
    }
  }, [activeStroke, canvasBackgroundColor, strokes]);

  const getPointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return { x: 0, y: 0 };
    }

    const rect = canvas.getBoundingClientRect();
    const width = rect.width || canvas.clientWidth || 1;
    const height = rect.height || canvas.clientHeight || 1;
    const ratioX = CANVAS_WIDTH / width;
    const ratioY = CANVAS_HEIGHT / height;

    return {
      x: (event.clientX - rect.left) * ratioX,
      y: (event.clientY - rect.top) * ratioY,
    };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canDraw) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    setActivePoints([getPointFromEvent(event)]);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canDraw || !drawingRef.current) {
      return;
    }

    const nextPoint = getPointFromEvent(event);

    setActivePoints((prev) => {
      const last = prev[prev.length - 1];

      if (!last) {
        return [nextPoint];
      }

      return [...prev, ...interpolatePoints(last, nextPoint), nextPoint];
    });
  };

  const completeStroke = async () => {
    const finalizedPoints = [...activePointsRef.current];

    if (!canDraw || finalizedPoints.length < 1) {
      setActivePoints([]);
      return;
    }

    try {
      await onStrokeComplete({
        tool,
        color,
        size,
        points: finalizedPoints,
        createdAtMs: Date.now(),
      });
    } catch {
      // Keep interaction stable even when remote save fails.
    }

    setActivePoints([]);
  };

  const handlePointerUp = async () => {
    if (!drawingRef.current) {
      return;
    }

    drawingRef.current = false;
    await completeStroke();
  };

  const handlePointerCancel = async () => {
    if (!drawingRef.current) {
      return;
    }

    drawingRef.current = false;
    await completeStroke();
  };

  useEffect(() => {
    if (!canDraw && activePoints.length > 0) {
      setActivePoints([]);
    }
  }, [activePoints.length, canDraw]);

  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-xl border border-dm-accent/20 bg-dm-card">
      <div className="aspect-video h-full w-full max-h-full max-w-full">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className={`h-full w-full touch-none ${canDraw ? "cursor-crosshair" : "cursor-not-allowed opacity-80"}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onPointerLeave={handlePointerCancel}
        />
      </div>
    </div>
  );
}
