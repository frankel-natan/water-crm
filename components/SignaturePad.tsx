"use client";

import React, { useRef, useState, useEffect } from "react";

interface SignaturePadProps {
  onSave: (signatureDataUrl: string | null) => void;
}

export default function SignaturePad({ onSave }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: (e as React.MouseEvent).clientX - rect.left,
      y: (e as React.MouseEvent).clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasSignature) setHasSignature(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (canvasRef.current && hasSignature) {
      onSave(canvasRef.current.toDataURL("image/png"));
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onSave(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-xs text-slate-400">
        <span>חתימת הלקוח לאישור קבלת שירות וחלפים:</span>
        {hasSignature && (
          <button
            type="button"
            onClick={clearSignature}
            className="text-rose-400 hover:text-rose-300 underline"
          >
            נקה חתימה
          </button>
        )}
      </div>
      <div className="relative rounded-xl overflow-hidden border-2 border-dashed border-slate-600 bg-white">
        <canvas
          ref={canvasRef}
          width={360}
          height={140}
          className="w-full h-36 touch-none cursor-crosshair block"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {!hasSignature && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
            חתום כאן עם האצבע או העכבר
          </div>
        )}
      </div>
    </div>
  );
}
