import { useMemo, useRef, useState } from "react";
import ReactQuill, { Quill } from "react-quill";
import "react-quill/dist/quill.snow.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, AlignLeft, AlignCenter, AlignRight, Maximize2, Columns2 } from "lucide-react";

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

// ── Layout option definitions ─────────────────────────────────────────────────
type AlignOption = {
  id: string;
  label: string;
  className: string;
  icon: React.ReactNode;
  description: string;
};

const ALIGN_OPTIONS: AlignOption[] = [
  {
    id: "full",
    label: "Full width",
    className: "image-full",
    icon: <Maximize2 className="h-4 w-4" />,
    description: "Image spans the full column width",
  },
  {
    id: "left",
    label: "Wrap left",
    className: "image-wrap-left",
    icon: <AlignLeft className="h-4 w-4" />,
    description: "Image floats left — text wraps on the right",
  },
  {
    id: "right",
    label: "Wrap right",
    className: "image-wrap-right",
    icon: <AlignRight className="h-4 w-4" />,
    description: "Image floats right — text wraps on the left",
  },
  {
    id: "center",
    label: "Center",
    className: "image-center",
    icon: <AlignCenter className="h-4 w-4" />,
    description: "Image centred, text resumes below",
  },
  {
    id: "inline",
    label: "Inline",
    className: "image-inline",
    icon: <Columns2 className="h-4 w-4" />,
    description: "Image sits inline at its natural size",
  },
];

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
  const quillRef = useRef<ReactQuill>(null);
  const savedRange = useRef<{ index: number; length: number } | null>(null);

  const [showDialog, setShowDialog] = useState(false);
  const [imgUrl, setImgUrl]         = useState("");
  const [imgAlign, setImgAlign]     = useState("image-full");

  // ── Image toolbar handler ──────────────────────────────────────────────────
  // Defined outside useMemo but uses only stable refs/setters — safe.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const imageHandler = () => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    savedRange.current = quill.getSelection(true);
    setImgUrl("");
    setImgAlign("image-full");
    setShowDialog(true);
  };

  const insertImage = () => {
    const url = imgUrl.trim();
    if (!url) return;
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    const range = savedRange.current ?? { index: quill.getLength(), length: 0 };
    quill.insertEmbed(range.index, "image", { src: url, class: imgAlign });
    quill.setSelection(range.index + 1, 0);
    setShowDialog(false);
  };

  // ── Quill modules — stable reference, handlers capture stable refs ────────
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

  const activeOpt = ALIGN_OPTIONS.find((o) => o.className === imgAlign);

  return (
    <div className={`rich-text-editor relative ${linkedInStyle ? "linkedin-style" : ""}`}>
      {/* ── Image insert dialog ────────────────────────────────────────────── */}
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

          {/* Layout picker */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Layout</Label>
            <div className="grid grid-cols-5 gap-1.5">
              {ALIGN_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setImgAlign(opt.className)}
                  title={opt.description}
                  className={[
                    "flex flex-col items-center gap-1.5 py-2 px-1 rounded-md border text-xs transition-colors",
                    imgAlign === opt.className
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover-elevate",
                  ].join(" ")}
                >
                  {opt.icon}
                  <span className="leading-tight text-center">{opt.label}</span>
                </button>
              ))}
            </div>
            {activeOpt && (
              <p className="text-xs text-muted-foreground">{activeOpt.description}</p>
            )}
          </div>

          {/* Visual preview of wrap style */}
          <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground select-none">
            {imgAlign === "image-wrap-left" && (
              <div className="flex gap-2 items-start">
                <div className="w-12 h-8 shrink-0 rounded bg-border/60 flex items-center justify-center text-[9px]">IMG</div>
                <div className="space-y-1">
                  <div className="h-1.5 bg-border/60 rounded w-full" />
                  <div className="h-1.5 bg-border/60 rounded w-5/6" />
                  <div className="h-1.5 bg-border/60 rounded w-full" />
                </div>
              </div>
            )}
            {imgAlign === "image-wrap-right" && (
              <div className="flex gap-2 items-start">
                <div className="space-y-1 flex-1">
                  <div className="h-1.5 bg-border/60 rounded w-full" />
                  <div className="h-1.5 bg-border/60 rounded w-5/6" />
                  <div className="h-1.5 bg-border/60 rounded w-full" />
                </div>
                <div className="w-12 h-8 shrink-0 rounded bg-border/60 flex items-center justify-center text-[9px]">IMG</div>
              </div>
            )}
            {imgAlign === "image-full" && (
              <div className="space-y-1">
                <div className="h-8 bg-border/60 rounded w-full flex items-center justify-center text-[9px]">IMG — full width</div>
                <div className="h-1.5 bg-border/60 rounded w-full" />
                <div className="h-1.5 bg-border/60 rounded w-4/5" />
              </div>
            )}
            {imgAlign === "image-center" && (
              <div className="space-y-1 flex flex-col items-center">
                <div className="h-8 w-24 bg-border/60 rounded flex items-center justify-center text-[9px]">IMG</div>
                <div className="h-1.5 bg-border/60 rounded w-full" />
                <div className="h-1.5 bg-border/60 rounded w-4/5" />
              </div>
            )}
            {imgAlign === "image-inline" && (
              <div className="flex gap-2 items-center">
                <div className="w-10 h-6 shrink-0 rounded bg-border/60 flex items-center justify-center text-[9px]">IMG</div>
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

      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder || "Write your content here..."}
      />
    </div>
  );
}
