"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
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
  const activePointerIdRef = useRef<number | null>(null);
  const devicePixelRatioRef = useRef(1);
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

    const syncCanvasResolution = () => {
      const nextDevicePixelRatio = Math.max(window.devicePixelRatio || 1, 1);
      devicePixelRatioRef.current = nextDevicePixelRatio;
      canvas.width = Math.round(CANVAS_WIDTH * nextDevicePixelRatio);
      canvas.height = Math.round(CANVAS_HEIGHT * nextDevicePixelRatio);

      const context = canvas.getContext("2d");

      if (!context) {
        return;
      }

      context.setTransform(nextDevicePixelRatio, 0, 0, nextDevicePixelRatio, 0, 0);
    };

    syncCanvasResolution();
    window.addEventListener("resize", syncCanvasResolution);

    return () => {
      window.removeEventListener("resize", syncCanvasResolution);
    };
  }, []);

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

  const getCanvasPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
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

  const beginStroke = (point: DrawingStroke["points"][number]) => {
    drawingRef.current = true;
    setActivePoints([point]);
  };

  const extendStroke = (point: DrawingStroke["points"][number]) => {
    setActivePoints((prev) => {
      const last = prev[prev.length - 1];

      if (!last) {
        return [point];
      }

      return [...prev, ...interpolatePoints(last, point), point];
    });
  };

  const releasePointerCapture = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      return;
    }

    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!canDraw || !event.isPrimary) {
      return;
    }

    event.preventDefault();
    activePointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    beginStroke(getCanvasPoint(event));
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (
      !canDraw ||
      !drawingRef.current ||
      !event.isPrimary ||
      activePointerIdRef.current !== event.pointerId
    ) {
      return;
    }

    event.preventDefault();
    extendStroke(getCanvasPoint(event));
  };

  const endStroke = async () => {
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
    activePointerIdRef.current = null;
    await endStroke();
  };

  const handlePointerUpEvent = async (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!event.isPrimary || activePointerIdRef.current !== event.pointerId) {
      return;
    }

    event.preventDefault();
    releasePointerCapture(event);
    await handlePointerUp();
  };

  const handlePointerCancel = async (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || activePointerIdRef.current !== event.pointerId) {
      return;
    }

    event.preventDefault();
    releasePointerCapture(event);
    drawingRef.current = false;
    activePointerIdRef.current = null;
    await endStroke();
  };

  useEffect(() => {
    if (!canDraw && activePoints.length > 0) {
      setActivePoints([]);
    }
  }, [activePoints.length, canDraw]);

  useEffect(() => {
    if (canDraw) {
      return;
    }

    drawingRef.current = false;
    activePointerIdRef.current = null;
  }, [canDraw]);

  return (
    <div
      className="flex h-full w-full items-center justify-center overflow-hidden rounded-xl border border-dm-accent/20 bg-dm-card"
      style={{ touchAction: canDraw ? "none" : "auto" }}
    >
      <div className="aspect-video h-full w-full max-h-full max-w-full">
        <canvas
          ref={canvasRef}
          className={`h-full w-full touch-none ${canDraw ? "cursor-crosshair" : "cursor-not-allowed opacity-80"}`}
          style={{ touchAction: canDraw ? "none" : "auto" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUpEvent}
          onPointerCancel={handlePointerCancel}
          onPointerLeave={handlePointerCancel}
        />
      </div>
    </div>
  );
}
