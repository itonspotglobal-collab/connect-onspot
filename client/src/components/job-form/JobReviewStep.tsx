import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import type { JobFormData } from "@/lib/jobFormUtils";
import { isEmptyQuill } from "@/lib/jobFormUtils";
import { getCurrencySymbol } from "@/lib/jobUtils";
import { CONTRACT_TYPE_OPTIONS } from "@/lib/jobConstants";

interface Props {
  formData: JobFormData;
  isEditing: boolean;
  onGoToStep: (step: number) => void;
  isPending: boolean;
  onSubmit: () => void;
}

function ReviewCard({
  title,
  step,
  onEdit,
  children,
}: {
  title: string;
  step: number;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          {title}
        </h4>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto py-0 px-1 text-xs font-bold text-[#474ead] hover:text-[#474ead]"
          onClick={onEdit}
        >
          <Pencil className="w-3 h-3 mr-1" />
          Edit
        </Button>
      </div>
      <div className="text-sm text-foreground space-y-1">{children}</div>
    </div>
  );
}

function MetaChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-1 text-xs font-semibold text-[#474ead] dark:text-indigo-300">
      {label}
    </span>
  );
}

export function JobReviewStep({
  formData,
  isEditing,
  onGoToStep,
  isPending,
  onSubmit,
}: Props) {
  const contractLabel =
    CONTRACT_TYPE_OPTIONS.find((o) => o.value === formData.contractType)?.label ||
    formData.contractType;

  const expLabel =
    formData.experienceLevel === "entry"
      ? "Entry Level"
      : formData.experienceLevel === "intermediate"
        ? "Intermediate"
        : "Expert / Senior";

  const currSymbol = getCurrencySymbol(formData.currency, formData.customCurrencyCode);

  // Basics summary
  const basicsSummary = [formData.location, expLabel, contractLabel]
    .filter(Boolean)
    .join(" · ");

  // Description summary
  const descParts: string[] = [];
  if (formData.description.trim()) descParts.push("Overview added");
  if (!isEmptyQuill(formData.responsibilities)) descParts.push("Responsibilities added");
  const tagCount = formData.skillTags
    ? formData.skillTags.split(",").filter((t) => t.trim()).length
    : 0;
  if (tagCount > 0) descParts.push(`${tagCount} skill tag${tagCount !== 1 ? "s" : ""}`);

  // Requirements summary
  const reqParts: string[] = [];
  if (!isEmptyQuill(formData.requirements)) reqParts.push("Qualifications added");
  if (formData.salaryDisplay.trim())
    reqParts.push(`${currSymbol}${formData.salaryDisplay}/month`);
  if (formData.workDays || formData.timeZone) reqParts.push("Schedule added");

  return (
    <div>
      <h2 className="font-serif text-2xl font-normal mb-1 tracking-tight">Review &amp; post</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Here's how your post will look. Tap any field to jump back and edit.
      </p>

      {/* Live preview card */}
      <div className="rounded-2xl border border-border overflow-hidden mb-5">
        <div className="h-2 bg-gradient-to-r from-[#474ead] to-teal-400" />
        <div className="p-5">
          <p className="text-xs font-semibold text-muted-foreground mb-1">
            {formData.isCompanyConfidential ? "Confidential Company" : formData.company || "OnSpot"} ·{" "}
            {formData.location || "Remote"}
          </p>
          <h3 className="font-serif text-xl font-normal mb-3 leading-tight">
            {formData.professionalRoleName || (
              <span className="text-muted-foreground italic">Job title will appear here</span>
            )}
          </h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {formData.jobFunction && <MetaChip label={formData.jobFunction} />}
            {expLabel && <MetaChip label={expLabel} />}
            {contractLabel && <MetaChip label={contractLabel} />}
            {formData.salaryDisplay && (
              <MetaChip label={`${currSymbol}${formData.salaryDisplay}/mo`} />
            )}
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {formData.description || (
              <span className="italic">
                Your role overview and responsibilities appear here on the public job page, followed by requirements, what you offer, and benefits.
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Review cards */}
      <div className="space-y-3 mb-6">
        <ReviewCard title="Basics" step={0} onEdit={() => onGoToStep(0)}>
          <p className="font-semibold">
            {formData.professionalRoleName || (
              <span className="text-muted-foreground italic">No title yet</span>
            )}
          </p>
          <p className="text-muted-foreground text-xs">{basicsSummary}</p>
        </ReviewCard>

        <ReviewCard title="Description" step={1} onEdit={() => onGoToStep(1)}>
          {descParts.length > 0 ? (
            <p className="text-muted-foreground text-xs">{descParts.join(" · ")}</p>
          ) : (
            <p className="text-muted-foreground text-xs italic">No description yet</p>
          )}
        </ReviewCard>

        <ReviewCard title="Requirements" step={2} onEdit={() => onGoToStep(2)}>
          {reqParts.length > 0 ? (
            <p className="text-muted-foreground text-xs">{reqParts.join(" · ")}</p>
          ) : (
            <p className="text-muted-foreground text-xs italic">No requirements yet</p>
          )}
        </ReviewCard>
      </div>

      {/* Submit button (also in footer, but mirrored here for clarity) */}
      <div className="rounded-xl border border-border bg-muted/30 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">
            {isEditing ? "Update this job posting" : "Submit for approval"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isEditing
              ? "Changes take effect immediately after saving."
              : "An admin will review and approve the posting before it goes live."}
          </p>
        </div>
        <Button
          type="button"
          className="bg-[#474ead] hover:bg-[#3c3f9e] text-white shrink-0"
          disabled={isPending}
          onClick={onSubmit}
        >
          {isPending
            ? isEditing
              ? "Saving…"
              : "Submitting…"
            : isEditing
              ? "Update Job"
              : "Submit for Approval"}
        </Button>
      </div>
    </div>
  );
}
