import { forwardRef, useImperativeHandle, useRef, useEffect } from "react";

export interface SignaturePadHandle {
  clear: () => void;
}

interface SignaturePadProps {
  onSign: (dataUrl: string) => void;
  onClear?: () => void;
  className?: string;
}

export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  ({ onSign, onClear, className = "" }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawing = useRef(false);
    const lastPoint = useRef<{ x: number; y: number } | null>(null);

    const getPos = (e: { clientX: number; clientY: number }, canvas: HTMLCanvasElement) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    };

    const initCanvas = (canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#1aab90";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    };

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(dpr, dpr);
      initCanvas(canvas);
    }, []);

    const startDraw = (pos: { x: number; y: number }) => {
      isDrawing.current = true;
      lastPoint.current = pos;
    };

    const draw = (pos: { x: number; y: number }) => {
      if (!isDrawing.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx || !lastPoint.current) return;

      ctx.beginPath();
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      lastPoint.current = pos;
    };

    const endDraw = () => {
      if (!isDrawing.current) return;
      isDrawing.current = false;
      lastPoint.current = null;
      const canvas = canvasRef.current;
      if (canvas) {
        onSign(canvas.toDataURL("image/png"));
      }
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      startDraw(getPos(e.nativeEvent, canvas));
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      draw(getPos(e.nativeEvent, canvas));
    };

    const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas || !e.touches[0]) return;
      startDraw(getPos(e.touches[0], canvas));
    };

    const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas || !e.touches[0]) return;
      draw(getPos(e.touches[0], canvas));
    };

    useImperativeHandle(ref, () => ({
      clear: () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        initCanvas(canvas);
        onClear?.();
      },
    }));

    return (
      <canvas
        ref={canvasRef}
        className={`w-full h-36 rounded-lg border border-border/60 cursor-crosshair touch-none ${className}`}
        style={{ background: "#ffffff" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={endDraw}
      />
    );
  }
);

SignaturePad.displayName = "SignaturePad";
