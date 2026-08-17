import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
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
import { Video } from "lucide-react";
import type { JobFormData } from "@/lib/jobFormUtils";
import { SUPPORTED_CURRENCIES, getCurrencySymbol } from "@/lib/jobUtils";

const quillModules = {
  toolbar: [["bold"], [{ list: "ordered" }, { list: "bullet" }]],
};
const quillFormats = ["bold", "list", "bullet"];

interface Props {
  formData: JobFormData;
  updateField: (field: keyof JobFormData, value: any) => void;
  errors: Partial<Record<keyof JobFormData, string>>;
  isEditing: boolean;
}

export function JobRequirementsStep({ formData, updateField, errors, isEditing }: Props) {
  return (
    <div>
      <h2 className="font-serif text-2xl font-normal mb-1 tracking-tight">Requirements</h2>
      <p className="text-sm text-muted-foreground mb-6">
        What someone needs to succeed. Keep the required list tight — add setup and schedule only if they matter.
      </p>

      {/* Required Qualifications */}
      <div className="mb-5">
        <Label>
          Required Qualifications{" "}
          <span className="text-xs font-normal text-muted-foreground">— optional</span>
        </Label>
        <div className="mt-1.5 rounded-md border border-input bg-background">
          <ReactQuill
            theme="snow"
            value={formData.requirements}
            onChange={(v) => updateField("requirements", v)}
            modules={quillModules}
            formats={quillFormats}
            placeholder="List required skills, experience, and qualifications…"
            style={{ minHeight: "150px" }}
          />
        </div>
      </div>

      {/* Preferred Qualifications */}
      <div className="mb-5">
        <Label>
          Preferred Qualifications{" "}
          <span className="text-xs font-normal text-muted-foreground">— optional</span>
        </Label>
        <p className="text-xs text-muted-foreground mb-1.5">
          Optional qualifications that are beneficial but not strictly required.
        </p>
        <div className="rounded-md border border-input bg-background">
          <ReactQuill
            theme="snow"
            value={formData.preferredQualifications}
            onChange={(v) => updateField("preferredQualifications", v)}
            modules={quillModules}
            formats={quillFormats}
            placeholder="e.g. Experience with Salesforce — Familiarity with US market — Prior remote work experience…"
            style={{ minHeight: "130px" }}
          />
        </div>
      </div>

      {/* Compensation */}
      <div className="border-t border-dashed border-border pt-5 mb-5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
          Compensation
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <Label htmlFor="req-currency">Currency</Label>
            <Select
              value={formData.currency}
              onValueChange={(v) => {
                updateField("currency", v);
                if (v !== "OTHER") updateField("customCurrencyCode", "");
              }}
            >
              <SelectTrigger id="req-currency" className="mt-1.5">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_CURRENCIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formData.currency === "OTHER" && (
            <div>
              <Label htmlFor="req-custom-currency">Currency Code</Label>
              <Input
                id="req-custom-currency"
                className="mt-1.5"
                value={formData.customCurrencyCode}
                onChange={(e) =>
                  updateField(
                    "customCurrencyCode",
                    e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3)
                  )
                }
                placeholder="e.g. NZD, AED, CHF"
                maxLength={3}
              />
              {errors.customCurrencyCode && (
                <p className="mt-1 text-xs text-red-500">{errors.customCurrencyCode}</p>
              )}
            </div>
          )}
        </div>

        <div className="mb-4">
          <Label htmlFor="req-salary">
            Monthly Compensation{" "}
            {!isEditing && <span className="text-red-500">*</span>}
            {isEditing && (
              <span className="text-xs font-normal text-muted-foreground">— optional when editing</span>
            )}
          </Label>
          <Input
            id="req-salary"
            className="mt-1.5"
            type="text"
            value={formData.salaryDisplay}
            onChange={(e) => updateField("salaryDisplay", e.target.value)}
            placeholder={`e.g. ${getCurrencySymbol(formData.currency, formData.customCurrencyCode)}40,000 or 30,000 – 50,000`}
          />
          {errors.salaryDisplay ? (
            <p className="mt-1 text-xs text-red-500">{errors.salaryDisplay}</p>
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Enter the monthly amount (e.g. 40,000 or 30,000 – 50,000).
            </p>
          )}
        </div>

        {/* Commission + Equity chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          {(
            [
              { field: "hasCommission", label: "Offers commission" },
              { field: "hasEquity", label: "Offers equity" },
            ] as const
          ).map(({ field, label }) => (
            <button
              key={field}
              type="button"
              onClick={() => updateField(field, !formData[field])}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                formData[field]
                  ? "border-[#474ead] bg-indigo-50 text-[#474ead] dark:bg-indigo-900/30 dark:border-indigo-400 dark:text-indigo-300"
                  : "border-border bg-background text-foreground hover:border-[#474ead]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Compensation Notes */}
        <div className="mb-4">
          <Label htmlFor="req-compNotes">
            Compensation Notes{" "}
            <span className="text-xs font-normal text-muted-foreground">— optional</span>
          </Label>
          <Input
            id="req-compNotes"
            className="mt-1.5"
            value={formData.compensationNotes}
            onChange={(e) => updateField("compensationNotes", e.target.value)}
            placeholder="e.g. Performance bonus after 6 months"
          />
        </div>
      </div>

      {/* Application Method */}
      <div className="mb-5">
        <Label htmlFor="req-appMethod">
          Application Method{" "}
          <span className="text-xs font-normal text-muted-foreground">— optional</span>
        </Label>
        <Select
          value={formData.applicationMethod}
          onValueChange={(v) => updateField("applicationMethod", v)}
        >
          <SelectTrigger id="req-appMethod" className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="built_in_form">Built-in Application Form</SelectItem>
            <SelectItem value="external_link">External Link</SelectItem>
          </SelectContent>
        </Select>
        {formData.applicationMethod === "external_link" && (
          <div className="mt-3">
            <Label htmlFor="req-applyLink">External Apply Link</Label>
            <Input
              id="req-applyLink"
              className="mt-1.5"
              value={formData.applyLink}
              onChange={(e) => updateField("applyLink", e.target.value)}
              placeholder="https://example.com/apply"
            />
            {errors.applyLink && (
              <p className="mt-1 text-xs text-red-500">{errors.applyLink}</p>
            )}
          </div>
        )}
      </div>

      {/* Flags (Featured, Urgently Hiring) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        {(
          [
            { field: "isFeatured", label: "Featured Job", desc: "Highlighted on the job board" },
            { field: "urgentlyHiring", label: "Urgently Hiring", desc: "Shown with urgency badge" },
          ] as const
        ).map(({ field, label, desc }) => (
          <label
            key={field}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 hover:border-[#474ead] transition-colors"
          >
            <input
              type="checkbox"
              checked={formData[field] as boolean}
              onChange={(e) => updateField(field, e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded accent-[#474ead]"
            />
            <span>
              <span className="block text-sm font-semibold">{label}</span>
              <span className="block text-xs text-muted-foreground mt-0.5">{desc}</span>
            </span>
          </label>
        ))}
      </div>

      {/* Video Introduction Card */}
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 mb-5 hover:border-[#474ead] transition-colors">
        <input
          type="checkbox"
          checked={formData.requiresVideoIntro}
          onChange={(e) => updateField("requiresVideoIntro", e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded accent-[#474ead]"
        />
        <span>
          <span className="flex items-center gap-2">
            <Video className="w-4 h-4 text-[#474ead]" />
            <span className="text-sm font-semibold">Require Video Introduction</span>
          </span>
          <span className="block text-xs text-muted-foreground mt-0.5">
            Ask applicants to submit a short video introduction with their application.
          </span>
        </span>
      </label>

      {/* System & Equipment — expandable */}
      <details className="group border-t border-dashed border-border pt-2 mb-2">
        <summary className="flex cursor-pointer list-none items-center gap-2 py-3 text-sm font-bold text-[#474ead] select-none">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-xs transition-transform group-open:rotate-45">
            +
          </span>
          System &amp; equipment requirements
          <span className="ml-auto rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
            optional
          </span>
        </summary>
        <div className="pb-2 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="req-internet">Minimum Internet Speed</Label>
              <Input
                id="req-internet"
                className="mt-1.5"
                value={formData.minimumInternetSpeed}
                onChange={(e) => updateField("minimumInternetSpeed", e.target.value)}
                placeholder="e.g. 50 Mbps minimum"
              />
            </div>
            <div>
              <Label htmlFor="req-tools">Required Tools / Software</Label>
              <Input
                id="req-tools"
                className="mt-1.5"
                value={formData.requiredToolsSoftware}
                onChange={(e) => updateField("requiredToolsSoftware", e.target.value)}
                placeholder="e.g. Salesforce, Slack, Zoom"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="req-sysreq">System Requirements</Label>
            <Textarea
              id="req-sysreq"
              className="mt-1.5 resize-y min-h-[72px]"
              value={formData.systemRequirements}
              onChange={(e) => updateField("systemRequirements", e.target.value)}
              placeholder="e.g. Reliable laptop, headset, webcam, quiet professional workspace."
            />
          </div>
          <div>
            <Label htmlFor="req-otherequip">Other Equipment Requirements</Label>
            <Input
              id="req-otherequip"
              className="mt-1.5"
              value={formData.otherEquipmentRequirements}
              onChange={(e) => updateField("otherEquipmentRequirements", e.target.value)}
              placeholder="e.g. Noise-cancelling headset, external monitor"
            />
          </div>
        </div>
      </details>

      {/* Work Schedule — expandable */}
      <details className="group border-t border-dashed border-border pt-2 mb-2">
        <summary className="flex cursor-pointer list-none items-center gap-2 py-3 text-sm font-bold text-[#474ead] select-none">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-xs transition-transform group-open:rotate-45">
            +
          </span>
          Work schedule
          <span className="ml-auto rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
            optional
          </span>
        </summary>
        <div className="pb-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="req-workdays">Work Days</Label>
              <Input
                id="req-workdays"
                className="mt-1.5"
                value={formData.workDays}
                onChange={(e) => updateField("workDays", e.target.value)}
                placeholder="e.g. Monday – Friday"
              />
            </div>
            <div>
              <Label htmlFor="req-timezone">Time Zone</Label>
              <Input
                id="req-timezone"
                className="mt-1.5"
                value={formData.timeZone}
                onChange={(e) => updateField("timeZone", e.target.value)}
                placeholder="e.g. US Eastern overlap"
              />
            </div>
          </div>
        </div>
      </details>

      {/* Job Success Profile — expandable */}
      <details className="group border-t border-dashed border-border pt-2">
        <summary className="flex cursor-pointer list-none items-center gap-2 py-3 text-sm font-bold text-[#474ead] select-none">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-xs transition-transform group-open:rotate-45">
            +
          </span>
          Job success profile
          <span className="ml-auto rounded-full bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-0.5 text-[11px] font-semibold text-[#474ead]">
            boosts matching
          </span>
        </summary>
        <div className="pb-2 space-y-3">
          <div>
            <Label htmlFor="req-role-mission">Role Mission</Label>
            <Textarea
              id="req-role-mission"
              className="mt-1.5 resize-y min-h-[72px]"
              value={formData.roleMission}
              onChange={(e) => updateField("roleMission", e.target.value)}
              placeholder="What is the core purpose of this role? What does success look like…"
            />
          </div>
          <div>
            <Label htmlFor="req-key-outcomes">Key Outcomes</Label>
            <Textarea
              id="req-key-outcomes"
              className="mt-1.5 resize-y min-h-[72px]"
              value={formData.keyOutcomes}
              onChange={(e) => updateField("keyOutcomes", e.target.value)}
              placeholder="List the 3–5 measurable outcomes this role is responsible for delivering…"
            />
          </div>
          <div>
            <Label htmlFor="req-key-responsibilities-jsp">Key Responsibilities (JSP)</Label>
            <Textarea
              id="req-key-responsibilities-jsp"
              className="mt-1.5 resize-y min-h-[72px]"
              value={formData.keyResponsibilities}
              onChange={(e) => updateField("keyResponsibilities", e.target.value)}
              placeholder="Day-to-day responsibilities and accountabilities of this role…"
            />
          </div>
          <div>
            <Label htmlFor="req-skills-comp">Skills &amp; Competencies</Label>
            <Textarea
              id="req-skills-comp"
              className="mt-1.5 resize-y min-h-[72px]"
              value={formData.skillsAndCompetencies}
              onChange={(e) => updateField("skillsAndCompetencies", e.target.value)}
              placeholder="Core skills and professional competencies required…"
            />
          </div>
          <div>
            <Label htmlFor="req-behavioral">Behavioral Traits</Label>
            <Textarea
              id="req-behavioral"
              className="mt-1.5 resize-y min-h-[72px]"
              value={formData.behavioralTraits}
              onChange={(e) => updateField("behavioralTraits", e.target.value)}
              placeholder="Working style that sets top performers apart…"
            />
          </div>
          <div>
            <Label htmlFor="req-kpis">Key Performance Indicators</Label>
            <Textarea
              id="req-kpis"
              className="mt-1.5 resize-y min-h-[72px]"
              value={formData.kpis}
              onChange={(e) => updateField("kpis", e.target.value)}
              placeholder="How will performance be measured? List KPIs and targets…"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="req-training">Training &amp; Support</Label>
              <Textarea
                id="req-training"
                className="mt-1.5 resize-y min-h-[72px]"
                value={formData.trainingAndSupport}
                onChange={(e) => updateField("trainingAndSupport", e.target.value)}
                placeholder="Onboarding and ongoing support…"
              />
            </div>
            <div>
              <Label htmlFor="req-growth">Growth Path</Label>
              <Textarea
                id="req-growth"
                className="mt-1.5 resize-y min-h-[72px]"
                value={formData.growthPath}
                onChange={(e) => updateField("growthPath", e.target.value)}
                placeholder="Progression and advancement opportunities…"
              />
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}
