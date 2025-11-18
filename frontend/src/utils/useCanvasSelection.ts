import { useState, useCallback, RefObject } from 'react';

export interface Point {
  x: number;
  y: number;
}

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Hook to handle rubber-band selection on a canvas
 * Returns normalized rectangle coordinates relative to canvas
 */
export const useCanvasSelection = (canvasRef: RefObject<HTMLCanvasElement>) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [endPoint, setEndPoint] = useState<Point | null>(null);

  const getCanvasCoordinates = useCallback((e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }, [canvasRef]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasCoordinates(e);
    setIsDrawing(true);
    setStartPoint(point);
    setEndPoint(point);
  }, [getCanvasCoordinates]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const point = getCanvasCoordinates(e);
    setEndPoint(point);
  }, [isDrawing, getCanvasCoordinates]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>): SelectionRect | null => {
    if (!isDrawing || !startPoint) return null;

    const point = getCanvasCoordinates(e);
    setEndPoint(point);
    setIsDrawing(false);

    // Calculate rectangle
    const x = Math.min(startPoint.x, point.x);
    const y = Math.min(startPoint.y, point.y);
    const width = Math.abs(point.x - startPoint.x);
    const height = Math.abs(point.y - startPoint.y);

    // Minimum size threshold
    if (width < 10 || height < 10) {
      setStartPoint(null);
      setEndPoint(null);
      return null;
    }

    const rect = { x, y, width, height };

    // Reset for next selection
    setStartPoint(null);
    setEndPoint(null);

    return rect;
  }, [isDrawing, startPoint, getCanvasCoordinates]);

  const reset = useCallback(() => {
    setIsDrawing(false);
    setStartPoint(null);
    setEndPoint(null);
  }, []);

  return {
    isDrawing,
    startPoint,
    endPoint,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    reset
  };
};
