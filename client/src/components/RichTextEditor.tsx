import { useMemo } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  linkedInStyle?: boolean;
}

export default function RichTextEditor({ value, onChange, placeholder, linkedInStyle }: RichTextEditorProps) {
  const modules = useMemo(() => ({
    toolbar: [
      [{ header: [1, 2, 3, 4, false] }],
      ["bold", "italic", "underline", "strike"],
      [{ align: ["", "center", "right", "justify"] }],
      [{ list: "ordered" }, { list: "bullet" }],
      ["link", "image"],
      ["blockquote", "code-block"],
      ["clean"],
    ],
  }), []);

  const formats = [
    "header",
    "bold", "italic", "underline", "strike",
    "align",
    "list", "bullet",
    "link", "image",
    "blockquote", "code-block",
  ];

  return (
    <div className={`rich-text-editor ${linkedInStyle ? "linkedin-style" : ""}`}>
      <ReactQuill
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
