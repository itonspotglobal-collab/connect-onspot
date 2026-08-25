import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ENGAGEMENT_TYPE_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
  JOB_DURATION_OPTIONS,
  JOB_FORM_WORK_SETUPS,
  JOB_FUNCTIONS,
} from "@/lib/jobConstants";
import type { JobFormData } from "@/lib/jobFormUtils";

interface Props {
  formData: JobFormData;
  updateField: (field: keyof JobFormData, value: any) => void;
  errors: Partial<Record<keyof JobFormData, string>>;
}

export function JobBasicsStep({ formData, updateField, errors }: Props) {
  const hasLegacyLocation = Boolean(
    formData.location && !JOB_FORM_WORK_SETUPS.includes(formData.location as "Remote"),
  );
  const hasLegacyDuration = Boolean(
    formData.duration && !JOB_DURATION_OPTIONS.includes(formData.duration as (typeof JOB_DURATION_OPTIONS)[number]),
  );
  const hasLegacyExperience = Boolean(
    formData.experienceLevel &&
      !EXPERIENCE_LEVEL_OPTIONS.some((option) => option.value === formData.experienceLevel),
  );

  return (
    <div>
      <h2 className="font-serif text-2xl font-normal mb-1 tracking-tight">The basics</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Just enough to get your post live. You can polish the rest as you go.
      </p>

      {/* Job Title */}
      <div className="mb-5">
        <Label htmlFor="basics-title">
          Job Title <span className="text-red-500">*</span>
        </Label>
        <Input
          id="basics-title"
          className="mt-1.5"
          value={formData.professionalRoleName}
          onChange={(e) => updateField("professionalRoleName", e.target.value)}
          placeholder="e.g. Account Executive"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Use the title people would search for. Add an alternate name in parentheses if helpful.
        </p>
        {errors.professionalRoleName && (
          <p className="mt-1 text-xs text-red-500">{errors.professionalRoleName}</p>
        )}
      </div>

      {/* Work Setup chips */}
      <div className="mb-5">
        <Label>
          Work Setup <span className="text-red-500">*</span>
        </Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {JOB_FORM_WORK_SETUPS.map((setup) => (
            <button
              key={setup}
              type="button"
              onClick={() => updateField("location", setup)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                formData.location === setup
                  ? "border-[#474ead] bg-indigo-50 text-[#474ead] dark:bg-indigo-900/30 dark:border-indigo-400 dark:text-indigo-300"
                  : "border-border bg-background text-foreground hover:border-[#474ead]"
              }`}
            >
              {setup}
            </button>
          ))}
        </div>
        {hasLegacyLocation && (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
            This older posting uses “{formData.location}”. It will be preserved until you choose Remote.
          </p>
        )}
      </div>

      {/* Function + Experience row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <div>
          <Label htmlFor="basics-function">
            Function <span className="text-red-500">*</span>
          </Label>
          <Select
            value={formData.jobFunction}
            onValueChange={(v) => updateField("jobFunction", v)}
          >
            <SelectTrigger id="basics-function" className="mt-1.5">
              <SelectValue placeholder="Select a function…" />
            </SelectTrigger>
            <SelectContent>
              {JOB_FUNCTIONS.map((fn) => (
                <SelectItem key={fn} value={fn}>
                  {fn}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.jobFunction && (
            <p className="mt-1 text-xs text-red-500">{errors.jobFunction}</p>
          )}
        </div>

        <div>
          <Label htmlFor="basics-exp">
            Experience Level <span className="text-red-500">*</span>
          </Label>
          <Select
            value={formData.experienceLevel}
            onValueChange={(v) => updateField("experienceLevel", v)}
          >
            <SelectTrigger id="basics-exp" className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXPERIENCE_LEVEL_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
              {hasLegacyExperience && (
                <SelectItem value={formData.experienceLevel}>
                  Legacy: {formData.experienceLevel}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          {errors.experienceLevel && (
            <p className="mt-1 text-xs text-red-500">{errors.experienceLevel}</p>
          )}
        </div>
      </div>

      {/* Contract + Duration row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div>
          <Label htmlFor="basics-contract">
            Engagement Type <span className="text-red-500">*</span>
          </Label>
          <Select
            value={formData.engagementType || ""}
            onValueChange={(v) => updateField("engagementType", v)}
          >
            <SelectTrigger id="basics-contract" className="mt-1.5">
              <SelectValue placeholder="Select type…" />
            </SelectTrigger>
            <SelectContent>
              {ENGAGEMENT_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.engagementType && (
            <p className="mt-1 text-xs text-red-500">{errors.engagementType}</p>
          )}
        </div>

        <div>
          <Label htmlFor="basics-duration">
            Duration <span className="text-red-500">*</span>
          </Label>
          <Select
            value={formData.duration || ""}
            onValueChange={(v) => updateField("duration", v)}
          >
            <SelectTrigger id="basics-duration" className="mt-1.5">
              <SelectValue placeholder="Select duration…" />
            </SelectTrigger>
            <SelectContent>
              {JOB_DURATION_OPTIONS.map((duration) => (
                <SelectItem key={duration} value={duration}>
                  {duration}
                </SelectItem>
              ))}
              {hasLegacyDuration && (
                <SelectItem value={formData.duration}>
                  Legacy: {formData.duration}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          {errors.duration && (
            <p className="mt-1 text-xs text-red-500">{errors.duration}</p>
          )}
        </div>
      </div>

      {/* Company section */}
      <div className="border-t border-dashed border-border pt-5 mb-5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
          About the Company
        </p>

        <div className="mb-4">
          <Label htmlFor="basics-company">
            Company Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="basics-company"
            className="mt-1.5"
            value={formData.company}
            onChange={(e) => updateField("company", e.target.value)}
            placeholder="OnSpot"
          />
          {errors.company && (
            <p className="mt-1 text-xs text-red-500">{errors.company}</p>
          )}
        </div>

        {/* Confidential toggle */}
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 mb-4 hover:border-[#474ead] transition-colors">
          <input
            type="checkbox"
            checked={formData.isCompanyConfidential}
            onChange={(e) => updateField("isCompanyConfidential", e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded accent-[#474ead]"
          />
          <span>
            <span className="block text-sm font-semibold">Keep company confidential</span>
            <span className="block text-xs text-muted-foreground mt-0.5">
              Applicants see "Confidential Company" — the real name stays hidden.
            </span>
          </span>
        </label>

        {/* Company description (expandable) */}
        <details className="group border-t border-dashed border-border pt-2">
          <summary className="flex cursor-pointer list-none items-center gap-2 py-3 text-sm font-bold text-[#474ead] select-none">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-xs transition-transform group-open:rotate-45">
              +
            </span>
            {formData.isCompanyConfidential
              ? "Add a confidential overview"
              : "Add a company description"}
            <span className="ml-auto rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
              optional
            </span>
          </summary>
          <div className="pb-2">
            {!formData.isCompanyConfidential ? (
              <div className="mb-2">
                <Textarea
                  value={formData.companyOverview}
                  onChange={(e) => updateField("companyOverview", e.target.value)}
                  placeholder="Short overview — industry, mission, and what makes it a great place to work…"
                  className="resize-y min-h-[90px]"
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Shown publicly under "About the Company" on the job page.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-700/40 dark:bg-amber-900/10 p-3">
                <Label className="text-sm font-medium">Confidential Client Overview</Label>
                <Textarea
                  value={formData.confidentialClientOverview}
                  onChange={(e) =>
                    updateField("confidentialClientOverview", e.target.value)
                  }
                  placeholder="e.g. A fast-growing B2B SaaS company serving mid-market customers across North America…"
                  className="mt-2 min-h-[90px] resize-y bg-white dark:bg-white/5"
                />
                <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
                  Public-safe overview without revealing the company identity. Do not include the company name or identifying details.
                </p>
              </div>
            )}
          </div>
        </details>

        {/* Role details (expandable) */}
        <details className="group border-t border-dashed border-border pt-2">
          <summary className="flex cursor-pointer list-none items-center gap-2 py-3 text-sm font-bold text-[#474ead] select-none">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-xs transition-transform group-open:rotate-45">
              +
            </span>
            Role classification details
            <span className="ml-auto rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
              optional
            </span>
          </summary>
          <div className="pb-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="basics-reporting-to">Reporting To</Label>
              <Input
                id="basics-reporting-to"
                className="mt-1.5"
                value={formData.reportingTo}
                onChange={(e) => updateField("reportingTo", e.target.value)}
                placeholder="e.g. VP of Engineering"
              />
            </div>
            <div>
              <Label htmlFor="basics-division">Division</Label>
              <Input
                id="basics-division"
                className="mt-1.5"
                value={formData.division}
                onChange={(e) => updateField("division", e.target.value)}
                placeholder="e.g. Product & Engineering"
              />
            </div>
            <div>
              <Label htmlFor="basics-job-code">Job Code</Label>
              <Input
                id="basics-job-code"
                className="mt-1.5"
                value={formData.jobCode}
                onChange={(e) => updateField("jobCode", e.target.value)}
                placeholder="e.g. ENG-001"
              />
            </div>
            <div>
              <Label htmlFor="basics-job-grade">Job Grade</Label>
              <Input
                id="basics-job-grade"
                className="mt-1.5"
                value={formData.jobGrade}
                onChange={(e) => updateField("jobGrade", e.target.value)}
                placeholder="e.g. L4"
              />
            </div>
            <div>
              <Label htmlFor="basics-job-level">Job Level</Label>
              <Input
                id="basics-job-level"
                className="mt-1.5"
                value={formData.jobLevel}
                onChange={(e) => updateField("jobLevel", e.target.value)}
                placeholder="e.g. Senior"
              />
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
