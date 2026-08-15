import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles } from "lucide-react";
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
        Write it the way you'd explain it to a great candidate. Bullets read best on the public page.
      </p>

      {/* Card Preview Summary */}
      <div className="mb-5">
        <Label htmlFor="desc-summary">
          Card Preview Summary{" "}
          <span className="text-xs font-normal text-muted-foreground">— optional, job card only</span>
        </Label>
        <Textarea
          id="desc-summary"
          className="mt-1.5 resize-none min-h-[64px]"
          value={formData.jobSummary}
          onChange={(e) => updateField("jobSummary", e.target.value)}
          placeholder="Write a short hook that appears on the public job card — 1–2 sentences max."
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Shown on the job card preview only — does not appear on the full job details page.
        </p>
      </div>

      {/* Role Overview */}
      <div className="mb-5">
        <Label htmlFor="desc-overview">
          Role Overview <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="desc-overview"
          className="mt-1.5 resize-y min-h-[96px]"
          value={formData.description}
          onChange={(e) => updateField("description", e.target.value)}
          placeholder="Brief overview of the role and what makes it great…"
        />
        {errors.description && (
          <p className="mt-1 text-xs text-red-500">{errors.description}</p>
        )}
      </div>

      {/* Key Responsibilities (Quill) */}
      <div className="mb-5">
        <Label>
          Key Responsibilities{" "}
          <span className="text-xs font-normal text-muted-foreground">— optional</span>
        </Label>
        <div className="mt-1.5 rounded-md border border-input bg-background">
          <ReactQuill
            theme="snow"
            value={formData.responsibilities}
            onChange={(v) => updateField("responsibilities", v)}
            modules={quillModules}
            formats={quillFormats}
            placeholder="List responsibilities using bullets or a numbered list…"
            style={{ minHeight: "150px" }}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Use bullet or numbered lists for best readability on the public page.
        </p>
      </div>

      {/* Skill Tags */}
      <div className="mb-5">
        <Label htmlFor="desc-tags">
          Skill Tags{" "}
          <span className="text-xs font-normal text-muted-foreground">— optional</span>
        </Label>
        <Input
          id="desc-tags"
          className="mt-1.5"
          value={formData.skillTags}
          onChange={(e) => updateField("skillTags", e.target.value)}
          placeholder="e.g. Customer Support, Communication, CRM"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Comma-separated — shown as badges on the card and job page.
        </p>
      </div>

      {/* Cultural Fit */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-3.5 h-3.5 text-[#474ead]" />
          <Label className="text-[#474ead] font-bold uppercase tracking-widest text-[11px]">
            Cultural Fit
          </Label>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          Personality traits, work habits, and values that make someone a great fit. Shown on the job page.
        </p>
        <div className="rounded-md border border-input bg-background">
          <ReactQuill
            theme="snow"
            value={formData.culturalFit}
            onChange={(v) => updateField("culturalFit", v)}
            modules={quillModules}
            formats={quillFormats}
            placeholder="e.g. Thrives in a fast-paced remote environment — Communicates proactively with clients…"
            style={{ minHeight: "130px" }}
          />
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          Use bullet list for best results. If left empty, default cultural values will be shown on the public page.
        </p>
      </div>

      {/* What We Offer + Benefits — expandable */}
      <details className="group border-t border-dashed border-border pt-2">
        <summary className="flex cursor-pointer list-none items-center gap-2 py-3 text-sm font-bold text-[#474ead] select-none">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-xs transition-transform group-open:rotate-45">
            +
          </span>
          Add "What we offer" &amp; benefits
          <span className="ml-auto rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
            optional
          </span>
        </summary>
        <div className="pb-2 space-y-4">
          <div>
            <Label>What We Offer</Label>
            <div className="mt-1.5 rounded-md border border-input bg-background">
              <ReactQuill
                theme="snow"
                value={formData.whatWeOffer}
                onChange={(v) => updateField("whatWeOffer", v)}
                modules={quillModules}
                formats={quillFormats}
                placeholder="e.g. Flexible remote work — Long-term engagement — Performance incentives…"
                style={{ minHeight: "120px" }}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="desc-benefits">Benefits / Perks Tags</Label>
            <Input
              id="desc-benefits"
              className="mt-1.5"
              value={formData.benefits}
              onChange={(e) => updateField("benefits", e.target.value)}
              placeholder="e.g. HMO, SSS, PhilHealth, Pag-IBIG, paid leave, internet allowance"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Comma-separated. Displayed as pills below "What we offer".
            </p>
          </div>
        </div>
      </details>
    </div>
  );
}
