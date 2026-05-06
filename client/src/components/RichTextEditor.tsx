import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ReactQuill, { Quill } from "react-quill";
import "react-quill/dist/quill.snow.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  X, AlignLeft, AlignCenter, AlignRight, Maximize2, Columns2, Trash2,
} from "lucide-react";

// ── Extended Image Blot: preserves class + style attributes ───────────────────
const BaseImage = (Quill as any).import("formats/image");

class ExtendedImageBlot extends BaseImage {
  static create(value: string | Record<string, string>) {
    const node = super.create(typeof value === "string" ? value : value.src);
    if (typeof value === "object") {
      if (value.class) node.setAttribute("class", value.class);
      if (value.alt)   node.setAttribute("alt",   value.alt);
      if (value.style) node.setAttribute("style", value.style);
    }
    return node;
  }

  static formats(node: HTMLElement) {
    return {
      src:   node.getAttribute("src")   ?? "",
      class: node.getAttribute("class") ?? "",
      alt:   node.getAttribute("alt")   ?? "",
      style: node.getAttribute("style") ?? "",
    };
  }

  static value(node: HTMLElement) {
    return {
      src:   node.getAttribute("src")   ?? "",
      class: node.getAttribute("class") ?? "",
      alt:   node.getAttribute("alt")   ?? "",
      style: node.getAttribute("style") ?? "",
    };
  }

  format(name: string, value: string) {
    if (name === "class" || name === "style") {
      value
        ? this.domNode.setAttribute(name, value)
        : this.domNode.removeAttribute(name);
    } else {
      super.format(name, value);
    }
  }
}

ExtendedImageBlot.blotName = "image";
ExtendedImageBlot.tagName  = "img";

try {
  (Quill as any).register(ExtendedImageBlot, true);
} catch {
  // already registered on HMR reload
}

// ── Constants ─────────────────────────────────────────────────────────────────
const POSITION_CLASSES = [
  "image-full", "image-wrap-left", "image-wrap-right", "image-center", "image-inline",
];
const SIZE_CLASSES = ["image-size-sm", "image-size-md", "image-size-lg"];
const MIN_W_PX   = 60;
const HANDLE_PX  = 10;

// ── Types ─────────────────────────────────────────────────────────────────────
type PosOption  = { id: string; label: string; className: string; icon: React.ReactNode; description: string };
type SizeOption = { id: string; label: string; className: string };

const POS_OPTIONS: PosOption[] = [
  { id: "full",   label: "Full",    className: "image-full",        icon: <Maximize2 className="h-3.5 w-3.5" />, description: "Spans the full column width" },
  { id: "center", label: "Center",  className: "image-center",      icon: <AlignCenter className="h-3.5 w-3.5" />, description: "Centered block — text resumes below" },
  { id: "left",   label: "Float L", className: "image-wrap-left",   icon: <AlignLeft className="h-3.5 w-3.5" />, description: "Floats left — text wraps on the right" },
  { id: "right",  label: "Float R", className: "image-wrap-right",  icon: <AlignRight className="h-3.5 w-3.5" />, description: "Floats right — text wraps on the left" },
  { id: "inline", label: "Inline",  className: "image-inline",      icon: <Columns2 className="h-3.5 w-3.5" />, description: "Sits inline at natural size within text" },
];

const SIZE_OPTIONS: SizeOption[] = [
  { id: "sm", label: "S", className: "image-size-sm" },
  { id: "md", label: "M", className: "image-size-md" },
  { id: "lg", label: "L", className: "image-size-lg" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildClassString(pos: string, size: string | null): string {
  const parts = [pos];
  if (size && pos !== "image-full") parts.push(size);
  return parts.join(" ");
}

function parseImageClasses(el: HTMLElement): { pos: string; size: string | null } {
  const classes = (el.getAttribute("class") || "").split(/\s+/).filter(Boolean);
  const pos  = classes.find((c) => POSITION_CLASSES.includes(c)) ?? "image-full";
  const size = classes.find((c) => SIZE_CLASSES.includes(c))     ?? null;
  return { pos, size };
}

function parseCustomWidth(el: HTMLElement): string | null {
  const style = el.getAttribute("style") || "";
  const m = style.match(/width\s*:\s*([^;]+)/i);
  return m ? m[1].trim() : null;
}

// ── Drag data ref shape ────────────────────────────────────────────────────────
interface DragData {
  handle:     string;
  startX:     number;
  startY:     number;
  startW_px:  number;
  editorW_px: number;
  imgEl:      HTMLImageElement;
}

// ── Resize handle component ────────────────────────────────────────────────────
const HANDLE_CURSORS: Record<string, string> = {
  nw: "nw-resize", n: "n-resize",  ne: "ne-resize",
  e:  "e-resize",  se: "se-resize", s:  "s-resize",
  sw: "sw-resize", w:  "w-resize",
};
const HANDLE_OFFSETS: Record<string, React.CSSProperties> = {
  nw: { top: -5,              left: -5 },
  n:  { top: -5,              left: "calc(50% - 5px)" },
  ne: { top: -5,              right: -5 },
  e:  { top: "calc(50% - 5px)", right: -5 },
  se: { bottom: -5,           right: -5 },
  s:  { bottom: -5,           left: "calc(50% - 5px)" },
  sw: { bottom: -5,           left: -5 },
  w:  { top: "calc(50% - 5px)", left: -5 },
};

function ResizeHandle({
  handle,
  onPointerDown,
}: {
  handle: string;
  onPointerDown: (handle: string, e: React.PointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      style={{
        position: "absolute",
        width:  HANDLE_PX,
        height: HANDLE_PX,
        background: "#ffffff",
        border: "1.5px solid #4f46e5",
        borderRadius: 2,
        cursor: HANDLE_CURSORS[handle],
        pointerEvents: "auto",
        zIndex: 60,
        boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
        ...HANDLE_OFFSETS[handle],
      }}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onPointerDown(handle, e);
      }}
    />
  );
}

// ── Component props ───────────────────────────────────────────────────────────
interface RichTextEditorProps {
  value:        string;
  onChange:     (value: string) => void;
  placeholder?: string;
  linkedInStyle?: boolean;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
  linkedInStyle,
}: RichTextEditorProps) {
  const quillRef     = useRef<ReactQuill>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const savedRange   = useRef<{ index: number; length: number } | null>(null);
  const selectedImg  = useRef<HTMLElement | null>(null);
  const dragDataRef  = useRef<DragData | null>(null);

  // ── Insert dialog state ────────────────────────────────────────────────────
  const [showDialog,        setShowDialog]        = useState(false);
  const [imgUrl,            setImgUrl]            = useState("");
  const [insertPos,         setInsertPos]         = useState("image-full");
  const [insertSize,        setInsertSize]        = useState<string | null>(null);
  const [insertCustomWidth, setInsertCustomWidth] = useState("");

  // ── Floating toolbar state ─────────────────────────────────────────────────
  const [showToolbar,   setShowToolbar]   = useState(false);
  const [toolbarPos,    setToolbarPos]    = useState({ top: 0, left: 0 });
  const [activePos,     setActivePos]     = useState("image-full");
  const [activeSize,    setActiveSize]    = useState<string | null>(null);
  const [activeCustomW, setActiveCustomW] = useState<string | null>(null);
  const [widthInput,    setWidthInput]    = useState("");

  // ── Resize overlay state (position: fixed via portal) ─────────────────────
  const [resizeOverlay, setResizeOverlay] = useState<{
    top: number; left: number; width: number; height: number;
  } | null>(null);
  const [isDragging,  setIsDragging]  = useState(false);
  const [dragLabel,   setDragLabel]   = useState("");

  // ── Quill change handler ───────────────────────────────────────────────────
  const handleQuillChange = useCallback((html: string) => { onChange(html); }, [onChange]);

  // ── Update resize overlay from img's current bounding rect ────────────────
  const updateResizeOverlay = useCallback((img: HTMLElement) => {
    const rect = img.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setResizeOverlay({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    }
  }, []);

  // ── Position the floating toolbar ─────────────────────────────────────────
  const positionToolbar = useCallback((img: HTMLElement) => {
    const container = containerRef.current;
    if (!container) return;
    const cRect = container.getBoundingClientRect();
    const iRect = img.getBoundingClientRect();
    const TOOLBAR_H = 80;
    const topAbove  = iRect.top  - cRect.top  - TOOLBAR_H - 6;
    const topBelow  = iRect.bottom - cRect.top + 6;
    const left      = Math.min(
      Math.max(0, iRect.left - cRect.left),
      Math.max(0, container.clientWidth - 360)
    );
    setToolbarPos({ top: topAbove >= 8 ? topAbove : topBelow, left });
  }, []);

  // ── Sync toolbar state from selected image ─────────────────────────────────
  const syncToolbarState = useCallback((img: HTMLElement) => {
    const { pos, size } = parseImageClasses(img);
    const cw = parseCustomWidth(img);
    setActivePos(pos);
    setActiveSize(size);
    setActiveCustomW(cw);
    setWidthInput(cw ? cw.replace(/%$/, "") : "");
  }, []);

  // ── Click listener on the Quill editor root ────────────────────────────────
  useEffect(() => {
    const attach = () => {
      const quill = quillRef.current?.getEditor();
      if (!quill) return false;
      const editorEl = quill.root;

      const onClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.tagName === "IMG") {
          selectedImg.current = target;
          syncToolbarState(target);
          positionToolbar(target);
          updateResizeOverlay(target);
          setShowToolbar(true);
          setShowDialog(false);
        } else {
          setShowToolbar(false);
          setResizeOverlay(null);
          selectedImg.current = null;
        }
      };

      // Reposition overlay on editor scroll
      const onScroll = () => {
        if (selectedImg.current) {
          updateResizeOverlay(selectedImg.current);
          positionToolbar(selectedImg.current);
        }
      };

      editorEl.addEventListener("click",  onClick);
      editorEl.addEventListener("scroll", onScroll);
      return () => {
        editorEl.removeEventListener("click",  onClick);
        editorEl.removeEventListener("scroll", onScroll);
      };
    };

    let cleanup: (() => void) | false = attach();
    if (!cleanup) {
      const t = setTimeout(() => { cleanup = attach(); }, 150);
      return () => { clearTimeout(t); if (cleanup) cleanup(); };
    }
    return cleanup as () => void;
  }, [positionToolbar, updateResizeOverlay, syncToolbarState]);

  // ── Window resize: reposition overlay ─────────────────────────────────────
  useEffect(() => {
    const onWindowResize = () => {
      if (selectedImg.current) updateResizeOverlay(selectedImg.current);
    };
    window.addEventListener("resize", onWindowResize);
    return () => window.removeEventListener("resize", onWindowResize);
  }, [updateResizeOverlay]);

  // ── Drag resize start ──────────────────────────────────────────────────────
  const handleResizeStart = useCallback(
    (handle: string, e: React.PointerEvent<HTMLDivElement>) => {
      const img   = selectedImg.current as HTMLImageElement | null;
      const quill = quillRef.current?.getEditor();
      if (!img || !quill) return;

      const startW_px  = img.getBoundingClientRect().width;
      const editorW_px = quill.root.offsetWidth;

      dragDataRef.current = {
        handle,
        startX:     e.clientX,
        startY:     e.clientY,
        startW_px,
        editorW_px,
        imgEl:      img,
      };
      setIsDragging(true);
      setShowToolbar(false);

      const initPct = Math.round((startW_px / editorW_px) * 100);
      setDragLabel(`${initPct}%`);

      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    []
  );

  // ── Drag pointer move / up ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isDragging) return;

    const onMove = (e: PointerEvent) => {
      const d = dragDataRef.current;
      if (!d) return;

      const deltaX = e.clientX - d.startX;
      const deltaY = e.clientY - d.startY;

      // Determine effective delta by handle direction
      let delta: number;
      switch (d.handle) {
        case "e": case "ne": case "se": delta =  deltaX; break;
        case "w": case "nw": case "sw": delta = -deltaX; break;
        case "s": delta =  deltaY; break;
        case "n": delta = -deltaY; break;
        default:  delta =  deltaX;
      }

      const newW_px = Math.min(Math.max(d.startW_px + delta, MIN_W_PX), d.editorW_px);
      const newPct  = Math.round((newW_px / d.editorW_px) * 100);

      // Apply directly to DOM (no Quill API — avoids losing cursor)
      // Set both width AND max-width so class-based max-width constraints don't cap the drag size
      d.imgEl.style.width    = `${newPct}%`;
      d.imgEl.style.maxWidth = `${newPct}%`;
      d.imgEl.style.height   = "auto";

      setDragLabel(`${newPct}%`);
      updateResizeOverlay(d.imgEl);
    };

    const onUp = (e: PointerEvent) => {
      const d = dragDataRef.current;
      if (!d) return;

      // Finalize width in %
      const quill = quillRef.current?.getEditor();
      if (quill) onChange(quill.root.innerHTML);

      // Refresh toolbar state
      syncToolbarState(d.imgEl);
      positionToolbar(d.imgEl);
      setShowToolbar(true);
      setIsDragging(false);
      dragDataRef.current = null;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup",   onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup",   onUp);
    };
  }, [isDragging, onChange, updateResizeOverlay, syncToolbarState, positionToolbar]);

  // ── Apply position / size / custom width to selected image ────────────────
  const applyToSelected = useCallback(
    (newPos: string | null, newSize: string | null | undefined, newCustomW?: string | null) => {
      const img   = selectedImg.current;
      const quill = quillRef.current?.getEditor();
      if (!img || !quill) return;

      const { pos: curPos, size: curSize } = parseImageClasses(img);
      const pos  = newPos  ?? curPos;
      const size = newSize === undefined ? curSize : newSize;

      img.setAttribute("class", buildClassString(pos, size));

      // Handle custom width
      if (newCustomW !== undefined) {
        if (newCustomW) {
          const pct = newCustomW.replace(/%$/, "").trim();
          const num = parseInt(pct, 10);
          if (!isNaN(num) && num > 0 && num <= 100) {
            img.style.width    = `${num}%`;
            img.style.maxWidth = `${num}%`;
            img.style.height   = "auto";
          }
        } else {
          img.style.removeProperty("width");
          img.style.removeProperty("max-width");
          img.style.removeProperty("height");
        }
      } else if (newSize !== undefined && newSize !== null) {
        // Choosing a size preset clears custom width
        img.style.removeProperty("width");
        img.style.removeProperty("max-width");
        img.style.removeProperty("height");
      }

      setActivePos(pos);
      setActiveSize(size);
      const cw = parseCustomWidth(img);
      setActiveCustomW(cw);
      setWidthInput(cw ? cw.replace(/%$/, "") : "");
      onChange(quill.root.innerHTML);
    },
    [onChange]
  );

  // ── Delete selected image ──────────────────────────────────────────────────
  const deleteSelectedImage = useCallback(() => {
    const img   = selectedImg.current;
    const quill = quillRef.current?.getEditor();
    if (!img || !quill) return;

    const blot = (Quill as any).find(img);
    if (blot) {
      const index = quill.getIndex(blot);
      quill.deleteText(index, 1);
    } else {
      img.remove();
      onChange(quill.root.innerHTML);
    }
    setShowToolbar(false);
    setResizeOverlay(null);
    selectedImg.current = null;
  }, [onChange]);

  // ── Image insert handler (opens dialog) ───────────────────────────────────
  const imageHandler = useCallback(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    savedRange.current = quill.getSelection(true);
    setImgUrl("");
    setInsertPos("image-full");
    setInsertSize(null);
    setInsertCustomWidth("");
    setShowToolbar(false);
    setResizeOverlay(null);
    setShowDialog(true);
  }, []);

  // ── Insert image at cursor ─────────────────────────────────────────────────
  const insertImage = useCallback(() => {
    const url = imgUrl.trim();
    if (!url) return;
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const range = savedRange.current ?? { index: quill.getLength(), length: 0 };
    const cls   = buildClassString(insertPos, insertSize);

    // Build inline style if custom width is set
    const cwNum = parseInt(insertCustomWidth.trim(), 10);
    const styleAttr = (!isNaN(cwNum) && cwNum > 0 && cwNum <= 100)
      ? `width: ${cwNum}%; max-width: ${cwNum}%; height: auto;`
      : "";

    quill.insertEmbed(range.index, "image", { src: url, class: cls, style: styleAttr });
    quill.setSelection(range.index + 1, 0);
    setShowDialog(false);
  }, [imgUrl, insertPos, insertSize, insertCustomWidth]);

  // ── Quill modules ──────────────────────────────────────────────────────────
  const modules = useMemo(
    () => ({
      toolbar: {
        container: [
          [{ header: [1, 2, 3, 4, false] }],
          ["bold", "italic", "underline", "strike"],
          [{ align: ["", "center", "right", "justify"] }],
          [{ list: "ordered" }, { list: "bullet" }],
          ["link", "image"],
          ["blockquote", "code-block"],
          ["clean"],
        ],
        handlers: { image: imageHandler },
      },
    }),
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const formats = [
    "header",
    "bold", "italic", "underline", "strike",
    "align",
    "list", "bullet",
    "link", "image",
    "blockquote", "code-block",
  ];

  const activePosOpt = POS_OPTIONS.find((o) => o.className === insertPos);

  // ── Resize overlay portal ──────────────────────────────────────────────────
  const resizePortal = resizeOverlay
    ? createPortal(
        <div
          style={{
            position: "fixed",
            top:    resizeOverlay.top,
            left:   resizeOverlay.left,
            width:  resizeOverlay.width,
            height: resizeOverlay.height,
            border: "1.5px solid #4f46e5",
            pointerEvents: "none",
            zIndex: 9999,
            boxSizing: "border-box",
          }}
        >
          {(["nw","n","ne","e","se","s","sw","w"] as const).map((h) => (
            <ResizeHandle key={h} handle={h} onPointerDown={handleResizeStart} />
          ))}
          {isDragging && dragLabel && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                background: "#4f46e5",
                color: "#ffffff",
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 7px",
                borderRadius: 4,
                pointerEvents: "none",
                whiteSpace: "nowrap",
                boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
              }}
            >
              {dragLabel}
            </div>
          )}
        </div>,
        document.body
      )
    : null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className={`rich-text-editor relative ${linkedInStyle ? "linkedin-style" : ""}`}
    >
      {/* ── Insert Image Dialog ──────────────────────────────────────────────── */}
      {showDialog && (
        <div className="absolute top-10 left-0 right-0 z-50 bg-popover border border-border rounded-lg shadow-lg p-4 space-y-4 mx-1">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Insert Image</p>
            <Button size="icon" variant="ghost" onClick={() => setShowDialog(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* URL input */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Image URL</Label>
            <Input
              autoFocus
              value={imgUrl}
              onChange={(e) => setImgUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && insertImage()}
              placeholder="https://example.com/image.jpg"
            />
          </div>

          {/* Position picker */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Position</Label>
            <div className="grid grid-cols-5 gap-1.5">
              {POS_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setInsertPos(opt.className)}
                  title={opt.description}
                  className={[
                    "flex flex-col items-center gap-1.5 py-2 px-1 rounded-md border text-xs transition-colors",
                    insertPos === opt.className
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover-elevate",
                  ].join(" ")}
                >
                  {opt.icon}
                  <span className="leading-tight text-center">{opt.label}</span>
                </button>
              ))}
            </div>
            {activePosOpt && (
              <p className="text-xs text-muted-foreground">{activePosOpt.description}</p>
            )}
          </div>

          {/* Size + custom width */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Size</Label>

            {/* Preset S / M / L — only relevant for non-full positions */}
            {insertPos !== "image-full" && (
              <div className="flex items-center gap-2 flex-wrap">
                {SIZE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setInsertSize(insertSize === opt.className ? null : opt.className);
                      setInsertCustomWidth(""); // clear custom if preset chosen
                    }}
                    className={[
                      "w-10 h-8 rounded-md border text-xs font-medium transition-colors",
                      insertSize === opt.className && !insertCustomWidth
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover-elevate",
                    ].join(" ")}
                  >
                    {opt.label}
                  </button>
                ))}
                {(insertSize || insertCustomWidth) && (
                  <button
                    type="button"
                    onClick={() => { setInsertSize(null); setInsertCustomWidth(""); }}
                    className="text-xs text-muted-foreground underline"
                  >
                    Reset
                  </button>
                )}
              </div>
            )}

            {/* Custom width % input — available for all positions */}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground w-24 shrink-0">Custom width %</Label>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={5}
                  max={100}
                  value={insertCustomWidth}
                  onChange={(e) => {
                    setInsertCustomWidth(e.target.value);
                    if (e.target.value) setInsertSize(null); // clear preset
                  }}
                  placeholder="e.g. 65"
                  className="h-8 w-20 text-xs"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
              <span className="text-xs text-muted-foreground italic">
                {insertCustomWidth ? `Will insert at ${insertCustomWidth}% width` : "or drag handles after inserting"}
              </span>
            </div>
          </div>

          {/* Visual preview */}
          <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground select-none">
            {insertPos === "image-wrap-left" && (
              <div className="flex gap-2 items-start">
                <div className={[
                  "shrink-0 rounded bg-border/60 flex items-center justify-center text-[9px]",
                  insertSize === "image-size-sm" ? "w-8 h-7" : insertSize === "image-size-lg" ? "w-16 h-10" : "w-12 h-8",
                ].join(" ")}>IMG</div>
                <div className="space-y-1 flex-1">
                  <div className="h-1.5 bg-border/60 rounded w-full" />
                  <div className="h-1.5 bg-border/60 rounded w-5/6" />
                  <div className="h-1.5 bg-border/60 rounded w-full" />
                </div>
              </div>
            )}
            {insertPos === "image-wrap-right" && (
              <div className="flex gap-2 items-start">
                <div className="space-y-1 flex-1">
                  <div className="h-1.5 bg-border/60 rounded w-full" />
                  <div className="h-1.5 bg-border/60 rounded w-5/6" />
                  <div className="h-1.5 bg-border/60 rounded w-full" />
                </div>
                <div className={[
                  "shrink-0 rounded bg-border/60 flex items-center justify-center text-[9px]",
                  insertSize === "image-size-sm" ? "w-8 h-7" : insertSize === "image-size-lg" ? "w-16 h-10" : "w-12 h-8",
                ].join(" ")}>IMG</div>
              </div>
            )}
            {insertPos === "image-full" && (
              <div className="space-y-1">
                <div className="h-8 bg-border/60 rounded w-full flex items-center justify-center text-[9px]">IMG — full width</div>
                <div className="h-1.5 bg-border/60 rounded w-full" />
                <div className="h-1.5 bg-border/60 rounded w-4/5" />
              </div>
            )}
            {insertPos === "image-center" && (
              <div className="space-y-1 flex flex-col items-center">
                <div className={[
                  "rounded bg-border/60 flex items-center justify-center text-[9px]",
                  insertSize === "image-size-sm" ? "h-6 w-14" : insertSize === "image-size-lg" ? "h-10 w-36" : "h-8 w-24",
                ].join(" ")}>IMG</div>
                <div className="h-1.5 bg-border/60 rounded w-full" />
                <div className="h-1.5 bg-border/60 rounded w-4/5" />
              </div>
            )}
            {insertPos === "image-inline" && (
              <div className="flex gap-2 items-center">
                <div className={[
                  "shrink-0 rounded bg-border/60 flex items-center justify-center text-[9px]",
                  insertSize === "image-size-sm" ? "w-8 h-5" : insertSize === "image-size-lg" ? "w-16 h-9" : "w-10 h-6",
                ].join(" ")}>IMG</div>
                <div className="h-1.5 bg-border/60 rounded flex-1" />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button size="sm" onClick={insertImage} disabled={!imgUrl.trim()}>Insert Image</Button>
          </div>
        </div>
      )}

      {/* ── Floating Image Toolbar ────────────────────────────────────────────── */}
      {showToolbar && (
        <div
          style={{ top: toolbarPos.top, left: toolbarPos.left }}
          className="absolute z-40 bg-popover border border-border rounded-lg shadow-lg p-2 space-y-1.5 w-auto min-w-[340px]"
          onMouseDown={(e) => e.preventDefault()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-0.5 pb-0.5">
            <span className="text-xs font-medium text-muted-foreground">Image settings</span>
            <Button
              size="icon" variant="ghost" className="h-5 w-5"
              onClick={() => { setShowToolbar(false); selectedImg.current = null; setResizeOverlay(null); }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>

          {/* Position row */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground w-12 shrink-0">Position</span>
            <div className="flex items-center gap-1 flex-wrap">
              {POS_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  title={opt.description}
                  onClick={() => applyToSelected(opt.className, undefined)}
                  className={[
                    "flex items-center gap-1 px-2 py-1 rounded-md border text-xs transition-colors",
                    activePos === opt.className
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover-elevate",
                  ].join(" ")}
                >
                  {opt.icon}
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Size row */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground w-12 shrink-0">Size</span>
            <div className="flex items-center gap-1 flex-1">
              {activePos !== "image-full" ? (
                <>
                  {SIZE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => applyToSelected(null, activeSize === opt.className ? null : opt.className)}
                      className={[
                        "w-8 h-7 rounded-md border text-xs font-medium transition-colors",
                        activeSize === opt.className && !activeCustomW
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover-elevate",
                      ].join(" ")}
                    >
                      {opt.label}
                    </button>
                  ))}
                </>
              ) : (
                <span className="text-xs text-muted-foreground italic">Drag handles or set Width below</span>
              )}
            </div>
            <Button
              size="icon" variant="ghost" title="Remove image"
              className="h-7 w-7 ml-auto text-destructive"
              onClick={deleteSelectedImage}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Custom width row — visible for all positions */}
          <div className="flex items-center gap-1 pt-0.5 border-t border-border/40">
            <span className="text-[10px] text-muted-foreground w-12 shrink-0">Width</span>
            <div className="flex items-center gap-1.5 flex-1">
              <Input
                type="number"
                min={5}
                max={100}
                value={widthInput}
                onChange={(e) => setWidthInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    applyToSelected(null, null, widthInput || null);
                  }
                }}
                onBlur={() => applyToSelected(null, null, widthInput || null)}
                placeholder="custom"
                className="h-7 w-20 text-xs"
              />
              <span className="text-xs text-muted-foreground">%</span>
              {activeCustomW && (
                <button
                  type="button"
                  onClick={() => {
                    applyToSelected(null, null, "");
                    setWidthInput("");
                  }}
                  className="text-xs text-muted-foreground underline"
                >
                  Clear
                </button>
              )}
              <span className="text-xs text-muted-foreground italic ml-1">
                {activeCustomW
                  ? <span className="text-primary font-medium">{activeCustomW}</span>
                  : "or drag blue handles"}
              </span>
            </div>
          </div>

          {/* Drag hint */}
          <p className="text-[9px] text-muted-foreground px-0.5">
            Drag the blue handles around the image to resize freely.
          </p>
        </div>
      )}

      {/* ── Quill Editor ─────────────────────────────────────────────────────── */}
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={handleQuillChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder || "Write your content here..."}
      />

      {/* ── Resize overlay (portal to document.body) ─────────────────────────── */}
      {resizePortal}
    </div>
  );
}
