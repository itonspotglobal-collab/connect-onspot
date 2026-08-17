import { useMemo, useRef, useState } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import "./profile-rich-text.css";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Count visible characters, ignoring HTML markup. */
function countPlainText(html: string): number {
  if (!html) return 0;
  return html
    .replace(/<[^>]*>/g, "")           // strip tags
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .length;
}

/** Quill's empty-editor sentinel value. */
function isQuillEmpty(html: string): boolean {
  return !html || html === "<p><br></p>" || html.trim() === "";
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ProfileRichTextEditorProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Maximum plain-text character count (HTML markup is excluded from the count). */
  maxLength?: number;
  minHeight?: string;
}

/**
 * Focused rich-text editor for Talent Profile long-form sections (About /
 * More About Me).  Toolbar is intentionally limited to the safe subset:
 * H2 · H3 · Bold · Italic · Bullet list · Numbered list · Blockquote · Link · Clean.
 * Undo / Redo are available via Ctrl+Z / Ctrl+Y (and the history module).
 */
export function ProfileRichTextEditor({
  value,
  onChange,
  placeholder,
  maxLength,
  minHeight = "120px",
}: ProfileRichTextEditorProps) {
  const quillRef = useRef<ReactQuill>(null);
  const [charCount, setCharCount] = useState(() => countPlainText(value));

  // Modules are memo-ised so React-Quill doesn't remount on every render.
  const modules = useMemo(
    () => ({
      toolbar: {
        container: [
          [{ header: 2 }, { header: 3 }],
          ["bold", "italic"],
          [{ list: "ordered" }, { list: "bullet" }],
          ["blockquote", "link"],
          ["clean"],
        ],
      },
      history: { delay: 500, maxStack: 100, userOnly: true },
      clipboard: {
        // Paste from Word/GDocs: strip unsupported styles but keep structure.
        matchVisual: false,
      },
    }),
    []
  );

  const formats = [
    "header",
    "bold",
    "italic",
    "list",
    "blockquote",
    "link",
  ];

  function handleChange(html: string) {
    const plain = isQuillEmpty(html) ? "" : html;
    setCharCount(countPlainText(plain));
    onChange(plain);
  }

  const isOverLimit = maxLength !== undefined && charCount > maxLength;

  return (
    <div className="space-y-1">
      <div
        className={`profile-rte-container overflow-hidden rounded-md border ${
          isOverLimit ? "border-red-400" : "border-border"
        }`}
      >
        <ReactQuill
          ref={quillRef}
          value={value}
          onChange={handleChange}
          modules={modules}
          formats={formats}
          placeholder={placeholder}
          theme="snow"
          style={{ minHeight }}
        />
      </div>
      {maxLength !== undefined && (
        <p
          className={`text-right text-xs tabular-nums ${
            isOverLimit ? "text-red-500" : "text-slate-400"
          }`}
        >
          {charCount.toLocaleString()} / {maxLength.toLocaleString()}
        </p>
      )}
    </div>
  );
}
