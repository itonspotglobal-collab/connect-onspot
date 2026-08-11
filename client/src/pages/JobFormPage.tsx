import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Check, Video, Sparkles } from "lucide-react";
import {
  defaultFormData,
  jobToFormData,
  isEmptyQuill,
  type JobFormData,
} from "@/components/JobFormModal";
import { JOB_FUNCTIONS, CONTRACT_TYPE_OPTIONS, WORK_SETUPS } from "@/lib/jobConstants";
import { SUPPORTED_CURRENCIES, getCurrencySymbol } from "@/lib/jobUtils";
import type { Job } from "@shared/schema";

// ─── Quill config (same toolbar as the modal) ─────────────────────────────────
const quillModules = {
  toolbar: [["bold"], [{ list: "ordered" }, { list: "bullet" }]],
};
const quillFormats = ["bold", "list", "bullet"];

// ─── Step names ───────────────────────────────────────────────────────────────
const STEPS = ["Basics", "Description", "Requirements", "Review"] as const;

// ─── Duration options ─────────────────────────────────────────────────────────
const DURATION_OPTIONS = [
  { value: "less-than-1-month",   label: "Less than 1 month" },
  { value: "1-month",             label: "1 month" },
  { value: "2-months",            label: "2 months" },
  { value: "3-months",            label: "3 months" },
  { value: "4-months",            label: "4 months" },
  { value: "5-months",            label: "5 months" },
  { value: "6-months",            label: "6 months" },
  { value: "7-months",            label: "7 months" },
  { value: "8-months",            label: "8 months" },
  { value: "9-months",            label: "9 months" },
  { value: "10-months",           label: "10 months" },
  { value: "11-months",           label: "11 months" },
  { value: "12-months",           label: "12 months" },
  { value: "more-than-12-months", label: "More than 12 months" },
  { value: "open-ended",          label: "No fixed end date" },
] as const;

// Legacy values stored in the DB before this update — map them to the closest
// new label so edit mode never shows a blank duration pill.
const LEGACY_DURATION_LABELS: Record<string, string> = {
  "1-3-months":  "1–3 months",
  "3-6-months":  "3–6 months",
  "6-12-months": "6–12 months",
  "ongoing":     "No fixed end date",
};

/** Returns the human-readable label for any duration value (new or legacy). */
function resolveDurationLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const known = DURATION_OPTIONS.find(o => o.value === value);
  if (known) return known.label;
  return LEGACY_DURATION_LABELS[value] ?? value;
}

// ─── Small shared helpers ─────────────────────────────────────────────────────
function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-red-500 mt-1.5">{msg}</p>;
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
      {children}
    </p>
  );
}

function FieldDivider() {
  return <div className="h-px bg-border/50 my-6" />;
}

function Collapsible({
  label,
  badge,
  children,
}: {
  label: string;
  badge?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-dashed border-border/60 pt-1 mt-2">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-2.5 py-3 px-0.5 font-semibold text-sm text-[#474ead] hover:text-[#3d439c] transition-colors"
      >
        <span
          className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-[#474ead]/10 text-[#474ead] text-xs font-bold flex-none"
          style={{ transition: "transform 0.2s", transform: open ? "rotate(45deg)" : "none" }}
        >
          +
        </span>
        {label}
        {badge && (
          <span className="ml-auto text-[11px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </button>
      {open && <div className="pb-4 space-y-4">{children}</div>}
    </div>
  );
}

// ─── Step 1 · Basics ──────────────────────────────────────────────────────────
function BasicsStep({
  formData, updateField, errors,
}: {
  formData: JobFormData;
  updateField: (field: keyof JobFormData, value: any) => void;
  errors: Partial<Record<keyof JobFormData, string>>;
}) {
  return (
    <div className="space-y-5">
      {/* Job title */}
      <div>
        <Label htmlFor="jfp-title">
          Job title <span className="text-red-500">*</span>
        </Label>
        <Input
          id="jfp-title"
          value={formData.professionalRoleName}
          onChange={e => updateField("professionalRoleName", e.target.value)}
          placeholder="e.g. Senior Account Executive"
          className="mt-1.5"
        />
        <p className="text-xs text-muted-foreground mt-1.5">
          Use the title candidates are most likely to search for.
        </p>
        <FieldError msg={errors.professionalRoleName} />
      </div>

      {/* Alternative title (optional) */}
      <div>
        <Label htmlFor="jfp-alt-title">
          Alternative title{" "}
          <span className="text-xs text-muted-foreground font-normal ml-1">— optional</span>
        </Label>
        <Input
          id="jfp-alt-title"
          value={formData.originalRoleName}
          onChange={e => updateField("originalRoleName", e.target.value)}
          placeholder="e.g. Account Executive / Business Development Representative"
          className="mt-1.5"
        />
        <p className="text-xs text-muted-foreground mt-1.5">
          Original client title, internal title, or common alternative names.
        </p>
      </div>

      {/* Work setup chips */}
      <div>
        <Label>
          Work setup <span className="text-red-500">*</span>
        </Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {WORK_SETUPS.map(setup => (
            <button
              key={setup}
              type="button"
              onClick={() => updateField("location", setup)}
              className={`px-4 py-2 rounded-full text-sm font-semibold border-[1.5px] transition-colors ${
                formData.location === setup
                  ? "bg-[#474ead]/10 border-[#474ead] text-[#474ead]"
                  : "border-border bg-white hover:border-[#474ead]/50 text-foreground"
              }`}
            >
              {setup}
            </button>
          ))}
        </div>
      </div>

      {/* Function + Experience */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="jfp-function">
            Function <span className="text-red-500">*</span>
          </Label>
          <Select value={formData.jobFunction} onValueChange={v => updateField("jobFunction", v)}>
            <SelectTrigger id="jfp-function" className="mt-1.5">
              <SelectValue placeholder="Select a function…" />
            </SelectTrigger>
            <SelectContent>
              {JOB_FUNCTIONS.map(fn => (
                <SelectItem key={fn} value={fn}>{fn}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError msg={errors.jobFunction} />
        </div>
        <div>
          <Label htmlFor="jfp-exp">
            Experience level <span className="text-red-500">*</span>
          </Label>
          <Select value={formData.experienceLevel} onValueChange={v => updateField("experienceLevel", v)}>
            <SelectTrigger id="jfp-exp" className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="entry">Entry Level</SelectItem>
              <SelectItem value="intermediate">Intermediate</SelectItem>
              <SelectItem value="expert">Expert</SelectItem>
            </SelectContent>
          </Select>
          <FieldError msg={errors.experienceLevel} />
        </div>
      </div>

      {/* Engagement type + Duration */}
      <div className={`grid grid-cols-1 gap-4 ${formData.contractType !== "full-time" ? "sm:grid-cols-2" : ""}`}>
        <div>
          <Label htmlFor="jfp-contract">
            Engagement type <span className="text-red-500">*</span>
          </Label>
          <Select value={formData.contractType} onValueChange={v => updateField("contractType", v)}>
            <SelectTrigger id="jfp-contract" className="mt-1.5">
              <SelectValue placeholder="Select type…" />
            </SelectTrigger>
            <SelectContent>
              {CONTRACT_TYPE_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError msg={errors.contractType} />
        </div>
        {formData.contractType !== "full-time" && (
          <div>
            <Label htmlFor="jfp-duration">
              Duration{" "}
              <span className="text-xs text-muted-foreground font-normal ml-1">— optional</span>
            </Label>
            <Select value={formData.duration || ""} onValueChange={v => updateField("duration", v)}>
              <SelectTrigger id="jfp-duration" className="mt-1.5">
                <SelectValue placeholder="Optional" />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
                {/* Render legacy value as a selectable item if the job has one */}
                {formData.duration && !DURATION_OPTIONS.find(o => o.value === formData.duration) && (
                  <SelectItem value={formData.duration}>
                    {LEGACY_DURATION_LABELS[formData.duration] ?? formData.duration}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <FieldDivider />
      <SectionEyebrow>About the company</SectionEyebrow>

      {/* Company name */}
      <div>
        <Label htmlFor="jfp-company">
          Company Name or Industry <span className="text-red-500">*</span>
        </Label>
        <Input
          id="jfp-company"
          value={formData.company}
          onChange={e => updateField("company", e.target.value)}
          placeholder="e.g. OnSpot, Information Technology, Healthcare, BPO, Construction"
          className="mt-1.5"
        />
        <p className="text-xs text-muted-foreground mt-1.5">
          Enter the company name or, if preferred, the industry this role belongs to.
        </p>
        <FieldError msg={errors.company} />
      </div>

      {/* Company description — expandable */}
      <Collapsible label="Add a company description" badge="optional">
        <div>
          <Label htmlFor="jfp-company-overview">Company description</Label>
          <Textarea
            id="jfp-company-overview"
            value={formData.companyOverview}
            onChange={e => updateField("companyOverview", e.target.value)}
            placeholder="Short overview — industry, mission, and what makes it a great place to work…"
            className="mt-1.5 min-h-[80px] resize-y"
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            Shown publicly under "About the Company" on the job details page.
          </p>
        </div>
      </Collapsible>
    </div>
  );
}

// ─── Step 2 · Description ─────────────────────────────────────────────────────
function DescriptionStep({
  formData, updateField, errors,
}: {
  formData: JobFormData;
  updateField: (field: keyof JobFormData, value: any) => void;
  errors: Partial<Record<keyof JobFormData, string>>;
}) {
  return (
    <div className="space-y-5">
      {/* Role overview */}
      <div>
        <Label htmlFor="jfp-overview">
          Role overview <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="jfp-overview"
          value={formData.description}
          onChange={e => updateField("description", e.target.value)}
          placeholder="Brief overview of the role and what makes it great…"
          className="mt-1.5 min-h-[96px]"
        />
        <FieldError msg={errors.description} />
      </div>

      {/* Card summary (optional) */}
      <div>
        <Label htmlFor="jfp-summary">
          Card preview summary{" "}
          <span className="text-xs text-muted-foreground font-normal ml-1">— optional, job card only</span>
        </Label>
        <Textarea
          id="jfp-summary"
          value={formData.jobSummary}
          onChange={e => updateField("jobSummary", e.target.value)}
          placeholder="Short hook that appears on the public job card — 1–2 sentences max."
          className="mt-1.5 min-h-[60px] resize-none"
        />
        <p className="text-xs text-muted-foreground mt-1.5">
          Shown on the card only — not repeated on the full job page.
        </p>
      </div>

      {/* Key responsibilities */}
      <div>
        <Label>
          Key responsibilities <span className="text-red-500">*</span>
        </Label>
        <div className="rounded-md border border-input bg-background mt-1.5">
          <ReactQuill
            theme="snow"
            value={formData.responsibilities}
            onChange={v => updateField("responsibilities", v)}
            modules={quillModules}
            formats={quillFormats}
            placeholder="List responsibilities using bullets or a numbered list…"
            style={{ minHeight: "140px" }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          Use bullet or numbered lists for best readability on the public page.
        </p>
      </div>

      {/* Skill tags */}
      <div>
        <Label htmlFor="jfp-tags">
          Skill tags{" "}
          <span className="text-xs text-muted-foreground font-normal ml-1">— optional</span>
        </Label>
        <Input
          id="jfp-tags"
          value={formData.skillTags}
          onChange={e => updateField("skillTags", e.target.value)}
          placeholder="e.g. Customer Support, Communication, CRM"
          className="mt-1.5"
        />
        <p className="text-xs text-muted-foreground mt-1.5">
          Comma-separated — shown as badges on the card and job details page.
        </p>
      </div>

      {/* What we offer + benefits — expandable */}
      <Collapsible label='Add "What we offer" & benefits' badge="optional">
        <div>
          <Label>What we offer</Label>
          <div className="rounded-md border border-input bg-background mt-1.5">
            <ReactQuill
              theme="snow"
              value={formData.whatWeOffer}
              onChange={v => updateField("whatWeOffer", v)}
              modules={quillModules}
              formats={quillFormats}
              placeholder="e.g. Flexible remote work — Long-term engagement — Performance incentives…"
              style={{ minHeight: "110px" }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Use bullet list for best results. Shown publicly under "What We Offer".
          </p>
        </div>
        <div>
          <Label htmlFor="jfp-benefits">Benefits / perks tags</Label>
          <Textarea
            id="jfp-benefits"
            value={formData.benefits}
            onChange={e => updateField("benefits", e.target.value)}
            placeholder="e.g. HMO, SSS, PhilHealth, Pag-IBIG, paid leave, internet allowance"
            className="mt-1.5 min-h-[56px] resize-y"
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            Comma-separated. Displayed as pills below the What We Offer list.
          </p>
        </div>
      </Collapsible>

      {/* Cultural fit — expandable */}
      <Collapsible label="Add cultural fit" badge="optional">
        <div>
          <Label>Cultural fit</Label>
          <div className="rounded-md border border-input bg-background mt-1.5">
            <ReactQuill
              theme="snow"
              value={formData.culturalFit}
              onChange={v => updateField("culturalFit", v)}
              modules={quillModules}
              formats={quillFormats}
              placeholder="e.g. Thrives in a fast-paced remote environment — Communicates proactively with clients…"
              style={{ minHeight: "110px" }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Personality traits and values that make someone a great fit. Use bullet list for best results.
          </p>
        </div>
      </Collapsible>
    </div>
  );
}

// ─── Step 3 · Requirements ────────────────────────────────────────────────────
function RequirementsStep({
  formData, updateField, errors, isEditing,
}: {
  formData: JobFormData;
  updateField: (field: keyof JobFormData, value: any) => void;
  errors: Partial<Record<keyof JobFormData, string>>;
  isEditing: boolean;
}) {
  return (
    <div className="space-y-5">
      {/* Required qualifications */}
      <div>
        <Label>
          Required qualifications <span className="text-red-500">*</span>
        </Label>
        <div className="rounded-md border border-input bg-background mt-1.5">
          <ReactQuill
            theme="snow"
            value={formData.requirements}
            onChange={v => updateField("requirements", v)}
            modules={quillModules}
            formats={quillFormats}
            placeholder="List required skills, experience, and qualifications…"
            style={{ minHeight: "150px" }}
          />
        </div>
        <FieldError msg={errors.requirements} />
      </div>

      {/* Preferred qualifications — expandable */}
      <Collapsible label="Add preferred qualifications" badge="optional">
        <div>
          <Label>Preferred qualifications</Label>
          <div className="rounded-md border border-input bg-background mt-1.5">
            <ReactQuill
              theme="snow"
              value={formData.preferredQualifications}
              onChange={v => updateField("preferredQualifications", v)}
              modules={quillModules}
              formats={quillFormats}
              placeholder="e.g. Experience with Salesforce — Familiarity with US market — Prior remote work experience…"
              style={{ minHeight: "110px" }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Shown on the public job page under "Preferred Qualifications". Leave blank to omit.
          </p>
        </div>
      </Collapsible>

      <FieldDivider />
      <SectionEyebrow>Compensation</SectionEyebrow>

      {/* Currency */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="jfp-currency">Currency</Label>
          <Select
            value={formData.currency}
            onValueChange={v => {
              updateField("currency", v);
              if (v !== "OTHER") updateField("customCurrencyCode", "");
            }}
          >
            <SelectTrigger id="jfp-currency" className="mt-1.5">
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_CURRENCIES.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {formData.currency === "OTHER" && (
          <div>
            <Label htmlFor="jfp-custom-currency">Currency code</Label>
            <Input
              id="jfp-custom-currency"
              value={formData.customCurrencyCode}
              onChange={e =>
                updateField(
                  "customCurrencyCode",
                  e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3)
                )
              }
              placeholder="e.g. NZD, AED, CHF"
              maxLength={3}
              className="mt-1.5"
            />
            <FieldError msg={errors.customCurrencyCode} />
          </div>
        )}
      </div>

      {/* Monthly compensation */}
      <div>
        <Label htmlFor="jfp-salary">
          Monthly compensation{" "}
          {!isEditing ? (
            <span className="text-red-500">*</span>
          ) : (
            <span className="text-xs text-muted-foreground font-normal ml-1">— optional when editing</span>
          )}
        </Label>
        <Input
          id="jfp-salary"
          value={formData.salaryDisplay}
          onChange={e => updateField("salaryDisplay", e.target.value)}
          placeholder={`e.g. ${getCurrencySymbol(formData.currency, formData.customCurrencyCode)}40,000 or 30,000 – 50,000`}
          className="mt-1.5"
        />
        {errors.salaryDisplay ? (
          <FieldError msg={errors.salaryDisplay} />
        ) : (
          <p className="text-xs text-muted-foreground mt-1.5">
            Enter the monthly amount. All jobs use monthly compensation.
          </p>
        )}
      </div>

      {/* Payment freq + notes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="jfp-pay-freq">Payment frequency</Label>
          <Input
            id="jfp-pay-freq"
            value={formData.paymentFrequency}
            onChange={e => updateField("paymentFrequency", e.target.value)}
            placeholder="e.g. Monthly"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="jfp-comp-notes">
            Compensation notes{" "}
            <span className="text-xs text-muted-foreground font-normal ml-1">— optional</span>
          </Label>
          <Input
            id="jfp-comp-notes"
            value={formData.compensationNotes}
            onChange={e => updateField("compensationNotes", e.target.value)}
            placeholder="e.g. Includes performance-based incentives"
            className="mt-1.5"
          />
        </div>
      </div>

      {/* Commission / equity */}
      <div className="flex flex-wrap gap-3">
        <label className="flex items-start gap-2.5 cursor-pointer p-3 rounded-lg border border-border hover:border-[#474ead]/50 transition-colors">
          <input
            type="checkbox"
            checked={formData.hasCommission}
            onChange={e => updateField("hasCommission", e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#474ead] flex-none"
          />
          <span>
            <span className="block text-sm font-semibold">Offers commission</span>
            <span className="text-xs text-muted-foreground">Performance- or sales-based additional pay</span>
          </span>
        </label>
        <label className="flex items-start gap-2.5 cursor-pointer p-3 rounded-lg border border-border hover:border-[#474ead]/50 transition-colors">
          <input
            type="checkbox"
            checked={formData.hasEquity}
            onChange={e => updateField("hasEquity", e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#474ead] flex-none"
          />
          <span>
            <span className="block text-sm font-semibold">Offers equity</span>
            <span className="text-xs text-muted-foreground">Stock, ownership, or equity-based compensation</span>
          </span>
        </label>
      </div>

      {/* System & equipment — expandable */}
      <Collapsible label="System & equipment requirements" badge="optional">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="jfp-internet">Minimum internet speed</Label>
            <Input
              id="jfp-internet"
              value={formData.minimumInternetSpeed}
              onChange={e => updateField("minimumInternetSpeed", e.target.value)}
              placeholder="e.g. 50 Mbps minimum"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="jfp-tools">Required tools / software</Label>
            <Input
              id="jfp-tools"
              value={formData.requiredToolsSoftware}
              onChange={e => updateField("requiredToolsSoftware", e.target.value)}
              placeholder="e.g. Salesforce, Slack, Zoom"
              className="mt-1.5"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="jfp-sys-reqs">Equipment & workspace</Label>
          <Textarea
            id="jfp-sys-reqs"
            value={formData.systemRequirements}
            onChange={e => updateField("systemRequirements", e.target.value)}
            placeholder="e.g. Reliable laptop, headset, webcam, quiet professional workspace."
            className="mt-1.5 min-h-[72px] resize-y"
          />
        </div>
        <div>
          <Label htmlFor="jfp-other-equip">
            Other equipment{" "}
            <span className="text-xs text-muted-foreground font-normal ml-1">— optional</span>
          </Label>
          <Input
            id="jfp-other-equip"
            value={formData.otherEquipmentRequirements}
            onChange={e => updateField("otherEquipmentRequirements", e.target.value)}
            placeholder="e.g. Noise-cancelling headset, external monitor"
            className="mt-1.5"
          />
        </div>
      </Collapsible>

      {/* Work schedule — expandable */}
      <Collapsible label="Work schedule" badge="optional">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="jfp-workdays">Work days</Label>
            <Input id="jfp-workdays" value={formData.workDays} onChange={e => updateField("workDays", e.target.value)} placeholder="e.g. Monday – Friday" className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="jfp-timezone">Time zone</Label>
            <Input id="jfp-timezone" value={formData.timeZone} onChange={e => updateField("timeZone", e.target.value)} placeholder="e.g. US Eastern overlap" className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="jfp-hours">Weekly hours</Label>
            <Input id="jfp-hours" value={formData.weeklyHours} onChange={e => updateField("weeklyHours", e.target.value)} placeholder="e.g. 40 hours" className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="jfp-flex">Flexibility</Label>
            <Input id="jfp-flex" value={formData.scheduleFlexibility} onChange={e => updateField("scheduleFlexibility", e.target.value)} placeholder="e.g. Some flexibility" className="mt-1.5" />
          </div>
        </div>
      </Collapsible>

      {/* Job success profile — expandable */}
      <Collapsible label="Job success profile" badge="boosts matching">
        <div className="space-y-4">
          {(
            [
              { id: "jfp-mission", field: "roleMission" as const, label: "Role mission", placeholder: "What is the core purpose of this role? What does success look like…" },
              { id: "jfp-outcomes", field: "keyOutcomes" as const, label: "Key outcomes", placeholder: "List the 3–5 measurable outcomes this role is responsible for delivering…" },
              { id: "jfp-keyresp", field: "keyResponsibilities" as const, label: "Key responsibilities (JSP)", placeholder: "Day-to-day responsibilities and accountabilities…" },
              { id: "jfp-skills-comp", field: "skillsAndCompetencies" as const, label: "Skills & competencies", placeholder: "Core skills, technical knowledge, and professional competencies…" },
              { id: "jfp-traits", field: "behavioralTraits" as const, label: "Behavioral traits", placeholder: "Personality traits and working style that set top performers apart…" },
              { id: "jfp-kpis", field: "kpis" as const, label: "KPIs", placeholder: "How will performance be measured? List KPIs and targets…" },
              { id: "jfp-training", field: "trainingAndSupport" as const, label: "Training & support", placeholder: "What onboarding, training, and ongoing support does this role receive…" },
              { id: "jfp-growth", field: "growthPath" as const, label: "Growth path", placeholder: "What career progression or advancement opportunities are available…" },
            ] as const
          ).map(({ id, field, label, placeholder }) => (
            <div key={field}>
              <Label htmlFor={id}>{label}</Label>
              <Textarea
                id={id}
                value={formData[field]}
                onChange={e => updateField(field, e.target.value)}
                placeholder={placeholder}
                className="mt-1.5 min-h-[80px] resize-y"
              />
            </div>
          ))}

          {/* Internal role details */}
          <div className="border-t border-border/60 pt-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
              Role details (internal)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(
                [
                  { id: "jfp-reporting", field: "reportingTo" as const, label: "Reporting to", placeholder: "e.g. Team Manager" },
                  { id: "jfp-division", field: "division" as const, label: "Division", placeholder: "e.g. Delivery" },
                  { id: "jfp-jobcode", field: "jobCode" as const, label: "Job code", placeholder: "e.g. CSR-LTS-001" },
                  { id: "jfp-jobgrade", field: "jobGrade" as const, label: "Job grade", placeholder: "e.g. 3" },
                  { id: "jfp-joblevel", field: "jobLevel" as const, label: "Job level", placeholder: "e.g. P13" },
                ] as const
              ).map(({ id, field, label, placeholder }) => (
                <div key={field}>
                  <Label htmlFor={id}>{label}</Label>
                  <Input
                    id={id}
                    value={formData[field]}
                    onChange={e => updateField(field, e.target.value)}
                    placeholder={placeholder}
                    className="mt-1.5"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </Collapsible>

      <FieldDivider />

      {/* Video introduction toggle */}
      <label
        className={`flex cursor-pointer items-start gap-3 p-4 rounded-xl border-[1.5px] transition-colors ${
          formData.requiresVideoIntro
            ? "border-violet-400 bg-violet-50/50 dark:bg-violet-950/20"
            : "border-border hover:border-violet-300"
        }`}
      >
        <input
          type="checkbox"
          checked={formData.requiresVideoIntro}
          onChange={e => updateField("requiresVideoIntro", e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-violet-600 flex-none"
        />
        <span>
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <Video className="w-4 h-4 text-violet-600" />
            Video introduction
          </span>
          <span className="text-xs text-muted-foreground mt-0.5 block">
            {formData.requiresVideoIntro
              ? "Applicants must upload a short video introduction (MP4, MOV, or WebM · max 200 MB) to submit their application."
              : "Require applicants to submit a video introduction when applying for this role."}
          </span>
        </span>
      </label>
    </div>
  );
}

// ─── Step 4 · Review ──────────────────────────────────────────────────────────
function ReviewStep({
  formData, updateField, goToStep, isEditing, errors,
}: {
  formData: JobFormData;
  updateField: (field: keyof JobFormData, value: any) => void;
  goToStep: (s: number) => void;
  isEditing: boolean;
  errors: Partial<Record<keyof JobFormData, string>>;
}) {
  const expLabel: Record<string, string> = {
    entry: "Entry level",
    intermediate: "Intermediate",
    expert: "Expert",
  };
  const contractLabel =
    CONTRACT_TYPE_OPTIONS.find(o => o.value === formData.contractType)?.label ??
    formData.contractType;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Here's a preview of how your post will look. Tap <strong>Edit</strong> on any section to jump back and change it.
      </p>

      {/* Preview card */}
      <div className="rounded-2xl border border-border overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-[#474ead] to-[#6ee7b7]" />
        <div className="p-5">
          <p className="text-sm text-muted-foreground font-semibold">
            {formData.company || "Company"} ·{" "}
            {formData.location}
          </p>
          <h3 className="text-xl font-bold mt-1">
            {formData.professionalRoleName || "Job title"}
          </h3>
          <div className="flex flex-wrap gap-2 mt-3">
            {formData.jobFunction && (
              <span className="text-xs font-semibold bg-[#474ead]/10 text-[#474ead] px-3 py-1.5 rounded-full">
                {formData.jobFunction}
              </span>
            )}
            {formData.experienceLevel && (
              <span className="text-xs font-semibold bg-[#474ead]/10 text-[#474ead] px-3 py-1.5 rounded-full">
                {expLabel[formData.experienceLevel] ?? formData.experienceLevel}
              </span>
            )}
            {formData.contractType && (
              <span className="text-xs font-semibold bg-[#474ead]/10 text-[#474ead] px-3 py-1.5 rounded-full">
                {contractLabel}
                {formData.contractType !== "full-time" && formData.duration
                  ? ` · ${resolveDurationLabel(formData.duration)}`
                  : ""}
              </span>
            )}
            {formData.salaryDisplay && (
              <span className="text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-3 py-1.5 rounded-full">
                {formData.salaryDisplay} / mo
              </span>
            )}
          </div>
          {formData.description && (
            <p className="text-sm text-muted-foreground mt-3 line-clamp-3">
              {formData.description}
            </p>
          )}
        </div>
      </div>

      {/* Summary review cards */}
      <div className="grid gap-3">
        {[
          {
            step: 0,
            label: "BASICS",
            summary:
              [
                formData.location,
                expLabel[formData.experienceLevel] ?? formData.experienceLevel,
                contractLabel,
                formData.contractType !== "full-time"
                  ? resolveDurationLabel(formData.duration)
                  : null,
              ]
                .filter(Boolean)
                .join(" · ") || "Not yet filled in",
          },
          {
            step: 1,
            label: "DESCRIPTION",
            summary: formData.description
              ? `Overview added${!isEmptyQuill(formData.responsibilities) ? " · Responsibilities added" : ""}${
                  formData.skillTags
                    ? ` · ${formData.skillTags.split(",").filter(Boolean).length} skill tag(s)`
                    : ""
                }`
              : "Not yet filled in",
          },
          {
            step: 2,
            label: "REQUIREMENTS",
            summary: !isEmptyQuill(formData.requirements)
              ? `Qualifications added${formData.salaryDisplay ? ` · ${formData.salaryDisplay}/mo` : ""}${
                  formData.requiresVideoIntro ? " · Video intro required" : ""
                }`
              : "Not yet filled in",
          },
        ].map(({ step, label, summary }) => (
          <div
            key={step}
            className="flex items-center gap-3 p-4 rounded-xl border border-border bg-white dark:bg-card"
          >
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                {label}
              </p>
              <p className="text-sm font-semibold mt-0.5 truncate">{summary}</p>
            </div>
            <button
              type="button"
              onClick={() => goToStep(step)}
              className="text-xs font-bold text-[#474ead] hover:text-[#3d439c] flex-none transition-colors"
            >
              Edit
            </button>
          </div>
        ))}
      </div>

      <FieldDivider />
      <SectionEyebrow>Posting options</SectionEyebrow>

      <div className="space-y-2">
        <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-amber-200/60 bg-amber-50/40 dark:border-amber-800/30 dark:bg-amber-950/20">
          <input
            type="checkbox"
            checked={formData.isFeatured}
            onChange={e => updateField("isFeatured", e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-amber-500 flex-none"
          />
          <span>
            <span className="block text-sm font-semibold">Feature this job</span>
            <span className="text-xs text-muted-foreground">
              Highlighted on the public Find Work page and prioritized near the top of listings.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-border hover:border-[#474ead]/40 transition-colors">
          <input
            type="checkbox"
            checked={formData.urgentlyHiring}
            onChange={e => updateField("urgentlyHiring", e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#474ead] flex-none"
          />
          <span>
            <span className="block text-sm font-semibold">Mark as urgently hiring</span>
            <span className="text-xs text-muted-foreground">
              Displays the Urgently Hiring badge on the job card and listing page.
            </span>
          </span>
        </label>
      </div>

      <FieldDivider />
      <SectionEyebrow>Application & publishing</SectionEyebrow>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>Application method</Label>
          <Select
            value={formData.applicationMethod}
            onValueChange={v => updateField("applicationMethod", v)}
          >
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="built_in_form">Built-in form (apply on OnSpot)</SelectItem>
              <SelectItem value="external_link">External link (redirect to URL)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1.5">
            {formData.applicationMethod === "built_in_form"
              ? "Candidates apply directly on OnSpot."
              : "Candidates are redirected to the external URL."}
          </p>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={formData.status} onValueChange={v => updateField("status", v)}>
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {formData.applicationMethod === "external_link" && (
        <div>
          <Label htmlFor="jfp-apply-link">Apply link</Label>
          <Input
            id="jfp-apply-link"
            value={formData.applyLink}
            onChange={e => updateField("applyLink", e.target.value)}
            placeholder="https://example.com/apply"
            className="mt-1.5"
          />
          {errors.applyLink ? (
            <FieldError msg={errors.applyLink} />
          ) : (
            <p className="text-xs text-muted-foreground mt-1.5">
              Where candidates click "Apply Now". Leave blank to disable the button.
            </p>
          )}
        </div>
      )}

      {isEditing && (
        <a
          href={`/find-work/job/${window.location.pathname.split("/")[4]}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
        >
          Preview public page ↗
        </a>
      )}
    </div>
  );
}

// ─── Main page component ──────────────────────────────────────────────────────
export default function JobFormPage() {
  const params = useParams<{ jobId?: string }>();
  const jobId = params.jobId;
  const isEditing = !!jobId;
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<JobFormData>(defaultFormData);
  const [errors, setErrors] = useState<Partial<Record<keyof JobFormData, string>>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<any>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // ─── Fetch job in edit mode ───────────────────────────────────────────────
  const { data: existingJob, isLoading: isLoadingJob } = useQuery<Job>({
    queryKey: ["/api/admin/jobs", jobId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/jobs/${jobId}`);
      return res.json();
    },
    enabled: isEditing,
  });

  // Seed form once existing job loads
  useEffect(() => {
    if (existingJob) {
      setFormData(jobToFormData(existingJob));
    }
  }, [existingJob]);

  const updateField = (field: keyof JobFormData, value: any) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      // Switching to Full Time: duration is irrelevant — clear it immediately.
      if (field === "contractType" && value === "full-time") {
        next.duration = "";
      }
      return next;
    });
    setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const scrollTop = () =>
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  // ─── Per-step validation ──────────────────────────────────────────────────
  const validateStep = (s: number): Partial<Record<keyof JobFormData, string>> => {
    const next: Partial<Record<keyof JobFormData, string>> = {};
    if (s === 0) {
      if (!formData.professionalRoleName.trim()) next.professionalRoleName = "Job title is required";
      if (!formData.company.trim()) next.company = "Company name is required";
      if (!formData.jobFunction.trim()) next.jobFunction = "Function is required";
      if (!formData.contractType.trim()) next.contractType = "Engagement type is required";
      if (!formData.experienceLevel) next.experienceLevel = "Experience level is required";
    }
    if (s === 1) {
      if (!formData.description.trim()) next.description = "Role overview is required";
    }
    if (s === 2) {
      if (isEmptyQuill(formData.requirements))
        next.requirements = "Required qualifications are needed";
      if (!isEditing && !formData.salaryDisplay.trim())
        next.salaryDisplay = "Monthly compensation is required for new jobs";
      if (formData.currency === "OTHER") {
        const code = formData.customCurrencyCode.trim().toUpperCase();
        if (!code) next.customCurrencyCode = "Currency code is required";
        else if (!/^[A-Z]{3}$/.test(code))
          next.customCurrencyCode = "Enter exactly 3 letters (e.g. NZD, AED, CHF)";
      }
    }
    if (s === 3) {
      if (formData.applicationMethod === "external_link" && formData.applyLink.trim()) {
        const url = /^https?:\/\//i.test(formData.applyLink.trim())
          ? formData.applyLink.trim()
          : `https://${formData.applyLink.trim()}`;
        try { new URL(url); }
        catch { next.applyLink = "Please enter a valid URL (e.g. https://example.com/apply)"; }
      }
    }
    return next;
  };

  const handleContinue = () => {
    const errs = validateStep(step);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      scrollTop();
      return;
    }
    setErrors({});
    if (step < 3) {
      setStep(s => s + 1);
      scrollTop();
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    setStep(s => Math.max(0, s - 1));
    scrollTop();
  };

  const goToStep = (s: number) => {
    if (s < step) {
      setStep(s);
      scrollTop();
    }
  };

  // ─── Build payload (mirrors JobFormModal logic exactly) ───────────────────
  const buildPayload = () => {
    const normalizeUrl = (url: string) => {
      const t = url.trim();
      if (!t) return "";
      return /^https?:\/\//i.test(t) ? t : `https://${t}`;
    };
    const payload: any = {
      professionalRoleName: formData.professionalRoleName.trim(),
      title: formData.professionalRoleName.trim(),
      originalRoleName: formData.originalRoleName.trim() || null,
      jobFunction: formData.jobFunction.trim(),
      company: formData.company.trim() || "OnSpot",
      location: formData.location,
      category: formData.jobFunction.trim(),
      contractType: formData.contractType.trim(),
      experienceLevel: formData.experienceLevel,
      description: formData.description.trim(),
      jobSummary: formData.jobSummary.trim() || null,
      status: formData.status,
      budgetCurrency:
        formData.currency === "OTHER"
          ? formData.customCurrencyCode.trim().toUpperCase() || "PHP"
          : formData.currency,
      customCurrencyCode:
        formData.currency === "OTHER"
          ? formData.customCurrencyCode.trim().toUpperCase() || null
          : null,
      salaryDisplay: formData.salaryDisplay.trim() || null,
      duration: formData.duration || null,
      responsibilities: !isEmptyQuill(formData.responsibilities) ? [formData.responsibilities] : [],
      requirements: !isEmptyQuill(formData.requirements) ? [formData.requirements] : [],
      skillTags: formData.skillTags
        ? formData.skillTags.split(",").map(s => s.trim()).filter(Boolean)
        : [],
      culturalFit: !isEmptyQuill(formData.culturalFit) ? [formData.culturalFit] : [],
      preferredQualifications: !isEmptyQuill(formData.preferredQualifications)
        ? formData.preferredQualifications
        : null,
      whatWeOffer: !isEmptyQuill(formData.whatWeOffer) ? formData.whatWeOffer : null,
      benefits: formData.benefits.trim() || null,
      companyOverview: formData.companyOverview.trim(),
      roleMission: formData.roleMission.trim(),
      keyOutcomes: formData.keyOutcomes.trim(),
      keyResponsibilities: formData.keyResponsibilities.trim(),
      skillsAndCompetencies: formData.skillsAndCompetencies.trim(),
      behavioralTraits: formData.behavioralTraits.trim(),
      kpis: formData.kpis.trim(),
      trainingAndSupport: formData.trainingAndSupport.trim(),
      growthPath: formData.growthPath.trim(),
      minimumInternetSpeed: formData.minimumInternetSpeed.trim() || null,
      systemRequirements: formData.systemRequirements.trim(),
      requiredToolsSoftware: formData.requiredToolsSoftware.trim() || null,
      otherEquipmentRequirements: formData.otherEquipmentRequirements.trim() || null,
      workDays: formData.workDays.trim() || null,
      timeZone: formData.timeZone.trim() || null,
      weeklyHours: formData.weeklyHours.trim() || null,
      scheduleFlexibility: formData.scheduleFlexibility.trim() || null,
      paymentFrequency: formData.paymentFrequency.trim() || null,
      compensationNotes: formData.compensationNotes.trim() || null,
      reportingTo: formData.reportingTo.trim() || null,
      division: formData.division.trim() || null,
      jobCode: formData.jobCode.trim() || null,
      jobGrade: formData.jobGrade.trim() || null,
      jobLevel: formData.jobLevel.trim() || null,
      isFeatured: formData.isFeatured,
      urgentlyHiring: formData.urgentlyHiring,
      requiresVideoIntro: formData.requiresVideoIntro,

      compensationType: formData.compensationType || null,
      hasCommission: formData.hasCommission,
      hasEquity: formData.hasEquity,
      applicationMethod: formData.applicationMethod,
      applyLink:
        formData.applicationMethod === "external_link" && formData.applyLink.trim()
          ? normalizeUrl(formData.applyLink)
          : null,
    };
    if (!isEditing) payload.clientId = "admin-system";
    return payload;
  };

  // ─── Mutations ────────────────────────────────────────────────────────────
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
    queryClient.invalidateQueries({ queryKey: ["/api/jobs/search"] });
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/admin/jobs", data),
    onSuccess: () => {
      invalidate();
      toast({ title: "Job posting created — pending approval" });
      navigate("/admin/find-work");
    },
    onError: (err: any) =>
      toast({ title: "Failed to create job", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/admin/jobs/${id}`, data),
    onSuccess: () => {
      invalidate();
      toast({ title: "Job posting updated" });
      navigate("/admin/find-work");
    },
    onError: (err: any) =>
      toast({ title: "Failed to update job", description: err.message, variant: "destructive" }),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = () => {
    const errs = validateStep(3);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    const payload = buildPayload();
    if (isEditing && jobId) {
      updateMutation.mutate({ id: jobId, data: payload });
    } else {
      setPendingPayload(payload);
      setConfirmOpen(true);
    }
  };

  const handleSaveExit = () => {
    if (window.confirm("Leave without saving? Any unsaved changes will be lost.")) {
      navigate("/admin/find-work");
    }
  };

  // ─── Loading state ────────────────────────────────────────────────────────
  if (isEditing && isLoadingJob) {
    return (
      <div className="min-h-screen bg-[#f7f5fb] flex items-center justify-center">
        <p className="text-muted-foreground animate-pulse">Loading job…</p>
      </div>
    );
  }

  // ─── Per-step copy ────────────────────────────────────────────────────────
  const stepTitles: [string, string][] = isEditing
    ? [
        ["Edit job", "Update any details — all fields are pre-filled from the existing record."],
        ["Describe the role", "Write it the way you'd explain it to a great candidate."],
        ["Requirements", "What someone needs to succeed. Keep the required list tight."],
        ["Review & update", "Here's how your post looks. Tap Edit to jump back and change anything."],
      ]
    : [
        ["Post a job", "Four short steps. The essentials get you posted fast — everything else is optional."],
        ["Describe the role", "Write it the way you'd explain it to a great candidate."],
        ["Requirements", "What someone needs to succeed. Keep the required list tight."],
        ["Review & post", "Here's how your post will look. Tap Edit to jump back and change anything."],
      ];

  const [pageTitle, pageSub] = stepTitles[step];

  const heroHeading =
    step === 0 && !isEditing ? (
      <>Let's find your <em className="not-italic text-[#474ead]">match.</em></>
    ) : step === 0 && isEditing ? (
      <>Make this <em className="not-italic text-[#474ead]">even better.</em></>
    ) : (
      <span>{pageTitle}</span>
    );

  return (
    <>
      {/* ── Submit for approval confirmation ─────────────────────────────────── */}
      <Dialog open={confirmOpen} onOpenChange={o => { if (!o) setConfirmOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#474ead]" />
              Submit job for approval?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 dark:text-slate-300 py-1">
            This role will remain hidden from the public Find Work page until it is approved.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#474ead] text-white hover:bg-[#3d439c]"
              disabled={createMutation.isPending}
              onClick={() => {
                if (pendingPayload) {
                  createMutation.mutate(pendingPayload);
                  setConfirmOpen(false);
                }
              }}
            >
              {createMutation.isPending ? "Submitting…" : "Submit for Approval"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Page shell ───────────────────────────────────────────────────────── */}
      <div className="min-h-screen bg-[#f7f5fb]">

        {/* Top bar */}
        <div className="max-w-[1080px] mx-auto flex items-center justify-between px-4 sm:px-8 py-4">
          <button
            type="button"
            onClick={handleSaveExit}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Jobs admin
          </button>
          <button
            type="button"
            onClick={handleSaveExit}
            className="text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-white px-3 py-2 rounded-lg transition-colors"
          >
            Save &amp; exit
          </button>
        </div>

        {/* Main content */}
        <div ref={topRef} className="max-w-[760px] mx-auto px-4 sm:px-8 pb-32">

          {/* Page heading */}
          <div className="mb-5 mt-1">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#474ead] mb-2">
              {isEditing ? "Edit job" : "Post a job"}
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
              {heroHeading}
            </h1>
            {step === 0 && (
              <p className="text-muted-foreground text-sm mt-2 max-w-[52ch]">
                {pageSub}
              </p>
            )}
          </div>

          {/* Progress stepper */}
          <ol className="flex gap-1.5 mb-6">
            {STEPS.map((label, i) => (
              <li
                key={label}
                className={`flex-1 flex flex-col gap-2 ${i < step ? "cursor-pointer" : "cursor-default"}`}
                onClick={() => goToStep(i)}
              >
                <div
                  className={`h-[5px] rounded-full transition-colors ${
                    i <= step ? "bg-[#474ead]" : "bg-border"
                  }`}
                />
                <span
                  className={`flex items-center gap-1.5 text-[12px] font-semibold transition-colors ${
                    i === step
                      ? "text-foreground"
                      : i < step
                      ? "text-[#474ead]"
                      : "text-muted-foreground"
                  }`}
                >
                  <span
                    className={`inline-flex items-center justify-center w-[19px] h-[19px] rounded-full border-[1.5px] text-[10px] flex-none transition-colors ${
                      i < step
                        ? "bg-[#474ead] border-[#474ead] text-white"
                        : i === step
                        ? "border-[#474ead] text-[#474ead]"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {i < step ? <Check className="w-2.5 h-2.5" strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="hidden sm:inline">{label}</span>
                </span>
              </li>
            ))}
          </ol>

          {/* Step card */}
          <div className="bg-white rounded-2xl border border-border shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_32px_-8px_rgba(71,78,173,0.12)] p-6 sm:p-8">
            <h2 className="text-xl font-bold mb-1">{pageTitle}</h2>
            <p className="text-sm text-muted-foreground mb-6">{pageSub}</p>

            {step === 0 && (
              <BasicsStep formData={formData} updateField={updateField} errors={errors} />
            )}
            {step === 1 && (
              <DescriptionStep formData={formData} updateField={updateField} errors={errors} />
            )}
            {step === 2 && (
              <RequirementsStep
                formData={formData}
                updateField={updateField}
                errors={errors}
                isEditing={isEditing}
              />
            )}
            {step === 3 && (
              <ReviewStep
                formData={formData}
                updateField={updateField}
                goToStep={goToStep}
                isEditing={isEditing}
                errors={errors}
              />
            )}
          </div>
        </div>

        {/* Sticky footer navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-background/90 backdrop-blur-md border-t border-border z-20">
          <div className="max-w-[760px] mx-auto px-4 sm:px-8 py-3.5 flex items-center gap-3">
            <span className="text-sm font-semibold text-muted-foreground mr-auto">
              Step <strong className="text-foreground">{step + 1}</strong> of 4
            </span>
            {step > 0 && (
              <Button type="button" variant="outline" onClick={handleBack} disabled={isPending}>
                Back
              </Button>
            )}
            <Button
              type="button"
              onClick={handleContinue}
              disabled={isPending}
              className="bg-[#474ead] text-white hover:bg-[#3d439c] shadow-[0_4px_16px_rgba(71,78,173,0.35)]"
            >
              {isPending
                ? "Saving…"
                : step === 3
                ? isEditing
                  ? "Update Job"
                  : "Submit for Approval"
                : "Continue"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
