"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Cuadro blanco para firmar con el dedo (o mouse).
 * Llama onChange con un dataURL PNG cada vez que se termina un trazo,
 * o null al limpiar.
 */
export default function SignaturePad({
  value,
  onChange,
  label = "Firma",
}: {
  value?: string | null;
  onChange: (dataUrl: string | null) => void;
  label?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const [vacio, setVacio] = useState(!value);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function coords(e: React.PointerEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function iniciar(e: React.PointerEvent) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    dibujando.current = true;
    const { x, y } = coords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    canvasRef.current?.setPointerCapture(e.pointerId);
  }

  function mover(e: React.PointerEvent) {
    if (!dibujando.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = coords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function terminar() {
    if (!dibujando.current) return;
    dibujando.current = false;
    setVacio(false);
    const url = canvasRef.current?.toDataURL("image/png") ?? null;
    onChange(url);
  }

  function limpiar() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setVacio(true);
    onChange(null);
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="label mb-0">{label}</label>
        <button type="button" onClick={limpiar} className="text-xs text-marca-700 hover:underline">
          Limpiar
        </button>
      </div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          onPointerDown={iniciar}
          onPointerMove={mover}
          onPointerUp={terminar}
          onPointerLeave={terminar}
          className="h-40 w-full touch-none rounded-lg border-2 border-dashed border-slate-300 bg-white"
        />
        {vacio && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-300">
            ✍️ Firme aquí con el dedo
          </div>
        )}
      </div>
    </div>
  );
}
