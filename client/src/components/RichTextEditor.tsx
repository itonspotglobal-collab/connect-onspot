import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactQuill, { Quill } from "react-quill";
import "react-quill/dist/quill.snow.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  X, AlignLeft, AlignCenter, AlignRight, Maximize2, Columns2, Trash2,
} from "lucide-react";

// ── Extended Image Blot: preserves `class` attribute through Quill serialisation ──
const BaseImage = (Quill as any).import("formats/image");

class ExtendedImageBlot extends BaseImage {
  static create(value: string | Record<string, string>) {
    const node = super.create(typeof value === "string" ? value : value.src);
    if (typeof value === "object") {
      if (value.class) node.setAttribute("class", value.class);
      if (value.alt)   node.setAttribute("alt",   value.alt);
    }
    return node;
  }

  static formats(node: HTMLElement) {
    return {
      src:   node.getAttribute("src")   ?? "",
      class: node.getAttribute("class") ?? "",
      alt:   node.getAttribute("alt")   ?? "",
    };
  }

  static value(node: HTMLElement) {
    return {
      src:   node.getAttribute("src")   ?? "",
      class: node.getAttribute("class") ?? "",
      alt:   node.getAttribute("alt")   ?? "",
    };
  }

  format(name: string, value: string) {
    if (name === "class") {
      value
        ? this.domNode.setAttribute("class", value)
        : this.domNode.removeAttribute("class");
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
  // already registered on HMR reload — safe to ignore
}

// ── Class name constants ───────────────────────────────────────────────────────
const POSITION_CLASSES = [
  "image-full",
  "image-wrap-left",
  "image-wrap-right",
  "image-center",
  "image-inline",
];
const SIZE_CLASSES = ["image-size-sm", "image-size-md", "image-size-lg"];

// ── Option definitions ────────────────────────────────────────────────────────
type PosOption = {
  id: string;
  label: string;
  className: string;
  icon: React.ReactNode;
  description: string;
};
type SizeOption = { id: string; label: string; className: string };

const POS_OPTIONS: PosOption[] = [
  {
    id: "full",
    label: "Full",
    className: "image-full",
    icon: <Maximize2 className="h-3.5 w-3.5" />,
    description: "Spans the full column width",
  },
  {
    id: "center",
    label: "Center",
    className: "image-center",
    icon: <AlignCenter className="h-3.5 w-3.5" />,
    description: "Centered block — text resumes below",
  },
  {
    id: "left",
    label: "Float L",
    className: "image-wrap-left",
    icon: <AlignLeft className="h-3.5 w-3.5" />,
    description: "Floats left — text wraps on the right",
  },
  {
    id: "right",
    label: "Float R",
    className: "image-wrap-right",
    icon: <AlignRight className="h-3.5 w-3.5" />,
    description: "Floats right — text wraps on the left",
  },
  {
    id: "inline",
    label: "Inline",
    className: "image-inline",
    icon: <Columns2 className="h-3.5 w-3.5" />,
    description: "Sits inline at natural size within text",
  },
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
  const size = classes.find((c) => SIZE_CLASSES.includes(c)) ?? null;
  return { pos, size };
}

// ── Component ─────────────────────────────────────────────────────────────────
interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  linkedInStyle?: boolean;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
  linkedInStyle,
}: RichTextEditorProps) {
  const quillRef    = useRef<ReactQuill>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const savedRange  = useRef<{ index: number; length: number } | null>(null);
  const selectedImg = useRef<HTMLElement | null>(null);

  // ── Insert dialog state ────────────────────────────────────────────────────
  const [showDialog, setShowDialog] = useState(false);
  const [imgUrl,     setImgUrl]     = useState("");
  const [insertPos,  setInsertPos]  = useState("image-full");
  const [insertSize, setInsertSize] = useState<string | null>(null);

  // ── Floating image-toolbar state ───────────────────────────────────────────
  const [showToolbar, setShowToolbar]   = useState(false);
  const [toolbarPos,  setToolbarPos]    = useState({ top: 0, left: 0 });
  const [activePos,   setActivePos]     = useState("image-full");
  const [activeSize,  setActiveSize]    = useState<string | null>(null);

  // ── Sync quill content, stripping any stale selection markers ─────────────
  const handleQuillChange = useCallback(
    (html: string) => {
      onChange(html);
    },
    [onChange]
  );

  // ── Position the floating toolbar relative to clicked image ───────────────
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
      Math.max(0, container.clientWidth - 348)
    );
    setToolbarPos({ top: topAbove >= 8 ? topAbove : topBelow, left });
  }, []);

  // ── Click listener on the Quill editor root ────────────────────────────────
  useEffect(() => {
    // Poll briefly to ensure Quill has mounted (ReactQuill mounts async in Strict Mode)
    const attach = () => {
      const quill = quillRef.current?.getEditor();
      if (!quill) return false;

      const editorEl = quill.root;

      const onClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.tagName === "IMG") {
          selectedImg.current = target;
          const { pos, size } = parseImageClasses(target);
          setActivePos(pos);
          setActiveSize(size);
          positionToolbar(target);
          setShowToolbar(true);
          setShowDialog(false); // close insert dialog if open
        } else {
          setShowToolbar(false);
          selectedImg.current = null;
        }
      };

      editorEl.addEventListener("click", onClick);
      return () => editorEl.removeEventListener("click", onClick);
    };

    let cleanup: (() => void) | false = attach();
    if (!cleanup) {
      const t = setTimeout(() => { cleanup = attach(); }, 150);
      return () => { clearTimeout(t); if (cleanup) cleanup(); };
    }
    return cleanup as () => void;
  }, [positionToolbar]);

  // ── Apply position/size to the currently-selected image ───────────────────
  const applyToSelected = useCallback(
    (newPos: string | null, newSize: string | null | undefined) => {
      const img   = selectedImg.current;
      const quill = quillRef.current?.getEditor();
      if (!img || !quill) return;

      const { pos: curPos, size: curSize } = parseImageClasses(img);
      const pos  = newPos  ?? curPos;
      const size = newSize === undefined ? curSize : newSize;

      img.setAttribute("class", buildClassString(pos, size));
      setActivePos(pos);
      setActiveSize(size);
      onChange(quill.root.innerHTML);
    },
    [onChange]
  );

  // ── Delete the selected image ──────────────────────────────────────────────
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
    selectedImg.current = null;
  }, [onChange]);

  // ── Image toolbar handler (opens insert dialog) ───────────────────────────
  const imageHandler = useCallback(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    savedRange.current = quill.getSelection(true);
    setImgUrl("");
    setInsertPos("image-full");
    setInsertSize(null);
    setShowToolbar(false);
    setShowDialog(true);
  }, []);

  // ── Insert image at saved cursor position ─────────────────────────────────
  const insertImage = useCallback(() => {
    const url = imgUrl.trim();
    if (!url) return;
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    const range = savedRange.current ?? { index: quill.getLength(), length: 0 };
    quill.insertEmbed(
      range.index,
      "image",
      { src: url, class: buildClassString(insertPos, insertSize) }
    );
    quill.setSelection(range.index + 1, 0);
    setShowDialog(false);
  }, [imgUrl, insertPos, insertSize]);

  // ── Quill module config ────────────────────────────────────────────────────
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

          {/* Size picker — hidden when Full is chosen */}
          {insertPos !== "image-full" && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Size</Label>
              <div className="flex items-center gap-2">
                {SIZE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      setInsertSize(insertSize === opt.className ? null : opt.className)
                    }
                    className={[
                      "w-10 h-8 rounded-md border text-xs font-medium transition-colors",
                      insertSize === opt.className
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover-elevate",
                    ].join(" ")}
                  >
                    {opt.label}
                  </button>
                ))}
                {insertSize && (
                  <button
                    type="button"
                    onClick={() => setInsertSize(null)}
                    className="text-xs text-muted-foreground underline"
                  >
                    Reset
                  </button>
                )}
                <span className="text-xs text-muted-foreground ml-1">
                  {insertSize === "image-size-sm"
                    ? "Small"
                    : insertSize === "image-size-md"
                    ? "Medium"
                    : insertSize === "image-size-lg"
                    ? "Large"
                    : "Default"}
                </span>
              </div>
            </div>
          )}

          {/* Visual preview */}
          <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground select-none">
            {insertPos === "image-wrap-left" && (
              <div className="flex gap-2 items-start">
                <div
                  className={[
                    "shrink-0 rounded bg-border/60 flex items-center justify-center text-[9px]",
                    insertSize === "image-size-sm"
                      ? "w-8 h-7"
                      : insertSize === "image-size-lg"
                      ? "w-16 h-10"
                      : "w-12 h-8",
                  ].join(" ")}
                >
                  IMG
                </div>
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
                <div
                  className={[
                    "shrink-0 rounded bg-border/60 flex items-center justify-center text-[9px]",
                    insertSize === "image-size-sm"
                      ? "w-8 h-7"
                      : insertSize === "image-size-lg"
                      ? "w-16 h-10"
                      : "w-12 h-8",
                  ].join(" ")}
                >
                  IMG
                </div>
              </div>
            )}
            {insertPos === "image-full" && (
              <div className="space-y-1">
                <div className="h-8 bg-border/60 rounded w-full flex items-center justify-center text-[9px]">
                  IMG — full width
                </div>
                <div className="h-1.5 bg-border/60 rounded w-full" />
                <div className="h-1.5 bg-border/60 rounded w-4/5" />
              </div>
            )}
            {insertPos === "image-center" && (
              <div className="space-y-1 flex flex-col items-center">
                <div
                  className={[
                    "rounded bg-border/60 flex items-center justify-center text-[9px]",
                    insertSize === "image-size-sm"
                      ? "h-6 w-14"
                      : insertSize === "image-size-lg"
                      ? "h-10 w-36"
                      : "h-8 w-24",
                  ].join(" ")}
                >
                  IMG
                </div>
                <div className="h-1.5 bg-border/60 rounded w-full" />
                <div className="h-1.5 bg-border/60 rounded w-4/5" />
              </div>
            )}
            {insertPos === "image-inline" && (
              <div className="flex gap-2 items-center">
                <div
                  className={[
                    "shrink-0 rounded bg-border/60 flex items-center justify-center text-[9px]",
                    insertSize === "image-size-sm"
                      ? "w-8 h-5"
                      : insertSize === "image-size-lg"
                      ? "w-16 h-9"
                      : "w-10 h-6",
                  ].join(" ")}
                >
                  IMG
                </div>
                <div className="h-1.5 bg-border/60 rounded flex-1" />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={insertImage} disabled={!imgUrl.trim()}>
              Insert Image
            </Button>
          </div>
        </div>
      )}

      {/* ── Floating Image Toolbar (shown on image click) ─────────────────────── */}
      {showToolbar && (
        <div
          style={{ top: toolbarPos.top, left: toolbarPos.left }}
          className="absolute z-40 bg-popover border border-border rounded-lg shadow-lg p-2 space-y-1.5 w-auto min-w-[320px]"
          onMouseDown={(e) => e.preventDefault()} // prevent editor losing focus
        >
          {/* Header */}
          <div className="flex items-center justify-between px-0.5 pb-0.5">
            <span className="text-xs font-medium text-muted-foreground">Image settings</span>
            <Button
              size="icon"
              variant="ghost"
              className="h-5 w-5"
              onClick={() => { setShowToolbar(false); selectedImg.current = null; }}
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

          {/* Size row + Delete */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground w-12 shrink-0">Size</span>
            <div className="flex items-center gap-1 flex-1">
              {activePos !== "image-full" ? (
                <>
                  {SIZE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      title={`${opt.id === "sm" ? "Small" : opt.id === "md" ? "Medium" : "Large"}`}
                      onClick={() =>
                        applyToSelected(null, activeSize === opt.className ? null : opt.className)
                      }
                      className={[
                        "w-8 h-7 rounded-md border text-xs font-medium transition-colors",
                        activeSize === opt.className
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover-elevate",
                      ].join(" ")}
                    >
                      {opt.label}
                    </button>
                  ))}
                </>
              ) : (
                <span className="text-xs text-muted-foreground italic">Full width — size N/A</span>
              )}
            </div>
            <Button
              size="icon"
              variant="ghost"
              title="Remove image"
              className="h-7 w-7 ml-auto text-destructive"
              onClick={deleteSelectedImage}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
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
    </div>
  );
}
