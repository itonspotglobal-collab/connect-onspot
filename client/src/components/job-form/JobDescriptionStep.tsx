import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { Label } from "@/components/ui/label";
import type { JobFormData } from "@/lib/jobFormUtils";

const quillModules = {
  toolbar: [["bold"], [{ list: "ordered" }, { list: "bullet" }]],
};
const quillFormats = ["bold", "list", "bullet"];

interface Props {
  formData: JobFormData;
  updateField: (field: keyof JobFormData, value: any) => void;
  errors: Partial<Record<keyof JobFormData, string>>;
}

export function JobDescriptionStep({ formData, updateField, errors }: Props) {
  return (
    <div>
      <h2 className="font-serif text-2xl font-normal mb-1 tracking-tight">Describe the role</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Write it the way you&apos;d explain it to a great candidate.
      </p>

      <div>
        <Label>
          Job description <span className="text-xs font-normal text-muted-foreground">— optional</span>
        </Label>
        <div className="mt-1.5 overflow-hidden rounded-xl border border-input bg-background">
          <ReactQuill
            theme="snow"
            value={formData.description}
            onChange={(value) => updateField("description", value)}
            modules={quillModules}
            formats={quillFormats}
            placeholder="Describe the role, responsibilities, and what makes it a great opportunity. Bullets read best on the public page…"
            style={{ minHeight: "220px" }}
          />
        </div>
        {errors.description && (
          <p className="mt-1 text-xs text-red-500">{errors.description}</p>
        )}
      </div>
    </div>
  );
}