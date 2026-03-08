import { useCallback, useEffect, useRef } from "react";
import type { DrawingStroke, StrokePoint } from "@/types/canvas";

type UseSmoothCanvasDrawingParams = {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  committedStrokes: DrawingStroke[];
  resolveActiveStroke: () => DrawingStroke;
  backgroundColor: string;
  width: number;
  height: number;
};

type UseSmoothCanvasDrawingResult = {
  requestRender: () => void;
  mapEventToPoint: (event: React.PointerEvent<HTMLCanvasElement>) => StrokePoint;
  interpolatePoints: (from: StrokePoint, to: StrokePoint) => StrokePoint[];
};

function drawSmoothedStroke(
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
    context.arc(stroke.points[0].x, stroke.points[0].y, stroke.size / 2, 0, Math.PI * 2);
    context.fillStyle = context.strokeStyle;
    context.fill();
    return;
  }

  context.beginPath();
  context.moveTo(stroke.points[0].x, stroke.points[0].y);

  for (let index = 1; index < stroke.points.length - 1; index += 1) {
    const current = stroke.points[index];
    const next = stroke.points[index + 1];
    const midX = (current.x + next.x) / 2;
    const midY = (current.y + next.y) / 2;

    context.quadraticCurveTo(current.x, current.y, midX, midY);
  }

  const lastPoint = stroke.points[stroke.points.length - 1];
  context.lineTo(lastPoint.x, lastPoint.y);
  context.stroke();
}

export function useSmoothCanvasDrawing({
  canvasRef,
  committedStrokes,
  resolveActiveStroke,
  backgroundColor,
  width,
  height,
}: UseSmoothCanvasDrawingParams): UseSmoothCanvasDrawingResult {
  const rafRef = useRef<number | null>(null);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, width, height);

    committedStrokes.forEach((stroke) => {
      drawSmoothedStroke(context, stroke, backgroundColor);
    });

    drawSmoothedStroke(context, resolveActiveStroke(), backgroundColor);
  }, [backgroundColor, canvasRef, committedStrokes, height, resolveActiveStroke, width]);

  const requestRender = useCallback(() => {
    if (rafRef.current !== null) {
      return;
    }

    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      renderCanvas();
    });
  }, [renderCanvas]);

  useEffect(() => {
    requestRender();
  }, [requestRender]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const mapEventToPoint = useCallback((event: React.PointerEvent<HTMLCanvasElement>): StrokePoint => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return { x: 0, y: 0 };
    }

    const rect = canvas.getBoundingClientRect();
    const cssWidth = canvas.clientWidth || rect.width;
    const cssHeight = canvas.clientHeight || rect.height;

    if (!cssWidth || !cssHeight) {
      return { x: 0, y: 0 };
    }

    const ratioX = width / cssWidth;
    const ratioY = height / cssHeight;
    const fallbackOffsetX = event.nativeEvent.offsetX;
    const fallbackOffsetY = event.nativeEvent.offsetY;
    const rawX = Number.isFinite(event.clientX) ? event.clientX - rect.left : fallbackOffsetX;
    const rawY = Number.isFinite(event.clientY) ? event.clientY - rect.top : fallbackOffsetY;
    const clampedX = Math.max(0, Math.min(cssWidth, rawX));
    const clampedY = Math.max(0, Math.min(cssHeight, rawY));

    return {
      x: clampedX * ratioX,
      y: clampedY * ratioY,
    };
  }, [canvasRef, height, width]);

  const interpolatePoints = useCallback((from: StrokePoint, to: StrokePoint): StrokePoint[] => {
    const deltaX = to.x - from.x;
    const deltaY = to.y - from.y;
    const distance = Math.hypot(deltaX, deltaY);
    const segment = 2;
    const steps = Math.max(0, Math.floor(distance / segment) - 1);
    const points: StrokePoint[] = [];

    for (let step = 1; step <= steps; step += 1) {
      const ratio = step / (steps + 1);
      points.push({
        x: from.x + deltaX * ratio,
        y: from.y + deltaY * ratio,
      });
    }

    return points;
  }, []);

  return {
    requestRender,
    mapEventToPoint,
    interpolatePoints,
  };
}
