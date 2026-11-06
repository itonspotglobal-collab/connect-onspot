import { useEffect, useRef, useState, type PointerEvent } from "react";
import { RotateCcw, PenLine } from "lucide-react";

type SignatureInputProps = {
  value?: string | null;
  onChange: (signature: string | null) => void;
  label?: string;
  id?: string;
};

const WIDTH = 1000;
const HEIGHT = 320;

export function SignatureInput({ value, onChange, label = "Drawn signature", id = "drawn-signature" }: SignatureInputProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);
  const [hasSignature, setHasSignature] = useState(Boolean(value));

  useEffect(() => {
    let cancelled=false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, WIDTH, HEIGHT);
    if (!value) {
      hasInk.current = false;
      setHasSignature(false);
      return;
    }
    const image = new Image();
    image.onload = () => {
      if(cancelled)return;
      context.clearRect(0, 0, WIDTH, HEIGHT);
      context.drawImage(image, 0, 0, WIDTH, HEIGHT);
      hasInk.current = true;
      setHasSignature(true);
    };
    image.src = value;
    return()=>{cancelled=true;};
  }, [value]);

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * (WIDTH / bounds.width),
      y: (event.clientY - bounds.top) * (HEIGHT / bounds.height),
    };
  }

  function start(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    canvas.setPointerCapture(event.pointerId);
    drawing.current = true;
    const context = canvas.getContext("2d");
    if (!context) return;
    const p = point(event);
    context.beginPath();
    context.moveTo(p.x, p.y);
    context.lineWidth = 5;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#293b32";
  }

  function move(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const p = point(event);
    context.lineTo(p.x, p.y);
    context.stroke();
    hasInk.current = true;
    setHasSignature(true);
  }

  function finish() {
    if (!drawing.current) return;
    drawing.current = false;
    if (!hasInk.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const png = canvas.toDataURL("image/png");
    // Canvas dimensions are intentionally bounded to 1000×320; reject oversized output safely.
    const base64 = png.split(",")[1] || "";
    if (base64.length * 0.75 > 128 * 1024) {
      clear();
      return;
    }
    onChange(png);
  }

  function clear() {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, WIDTH, HEIGHT);
    drawing.current = false;
    hasInk.current = false;
    setHasSignature(false);
    onChange(null);
  }

  return <div className="space-y-1.5">
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">{label} <span className="font-normal text-slate-400">Optional</span></label>
      <button type="button" onClick={clear} disabled={!hasSignature} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Clear drawn signature"><RotateCcw className="h-3.5 w-3.5" />Clear</button>
    </div>
    <div className="relative overflow-hidden rounded-lg border border-dashed border-slate-300 bg-white">
      <canvas id={id} ref={canvasRef} width={WIDTH} height={HEIGHT} aria-label="Optional signature drawing area" className="block h-28 w-full touch-none sm:h-32"
        onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} />
      {!hasSignature && <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-xs text-slate-400"><PenLine className="h-3.5 w-3.5" />Draw with a finger, stylus, or mouse</div>}
    </div>
    <p className="text-[11px] leading-relaxed text-slate-500">Optional. Typed legal name and consent are still required. You may sign without drawing.</p>
  </div>;
}
