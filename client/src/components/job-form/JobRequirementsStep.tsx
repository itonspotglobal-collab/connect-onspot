import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import type { JobFormData, RequiredSkillRequirement } from "@/lib/jobFormUtils";
import {
  COMPENSATION_DISPLAY_OPTIONS,
  MINIMUM_EDUCATION_OPTIONS,
  SKILL_EXPERIENCE_OPTIONS,
} from "@/lib/jobConstants";
import { SUPPORTED_CURRENCIES } from "@/lib/jobUtils";

interface Props {
  formData: JobFormData;
  updateField: (field: keyof JobFormData, value: any) => void;
  errors: Partial<Record<keyof JobFormData, string>>;
}

/** Shared section heading for the four numbered Requirements sections. */
function SectionHeading({
  number,
  label,
  optional,
}: {
  number: number;
  label: string;
  optional?: boolean;
}) {
  return (
    <h3 className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-base font-bold leading-snug text-foreground">
      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-indigo-50 px-1.5 text-xs font-bold text-[#474ead] dark:bg-indigo-900/30 dark:text-indigo-300">
        {number}.
      </span>
      <span>{label}</span>
      {optional && (
        <span className="text-sm font-normal text-muted-foreground">
          — optional
        </span>
      )}
    </h3>
  );
}

export function JobRequirementsStep({ formData, updateField, errors }: Props) {
  const [isAddingSkill, setIsAddingSkill] = useState(false);
  const [pendingSkillName, setPendingSkillName] = useState("");
  const [pendingSkillYears, setPendingSkillYears] =
    useState<RequiredSkillRequirement["years"]>("any");
  const [nameDrafts, setNameDrafts] = useState<Record<number, string>>({});

  const saveSkills = (skills: RequiredSkillRequirement[]) => {
    const cleanSkills = skills
      .map((skill) => ({ ...skill, name: skill.name.trim() }))
      .filter((skill) => skill.name);
    updateField("requiredSkills", cleanSkills);
    updateField("skillTags", cleanSkills.map((skill) => skill.name).join(", "));
  };

  const addPendingSkill = () => {
    const name = pendingSkillName.trim();
    if (
      name &&
      !formData.requiredSkills.some(
        (skill) => skill.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      saveSkills([
        ...formData.requiredSkills,
        { name, years: pendingSkillYears },
      ]);
    }
    setPendingSkillName("");
    setPendingSkillYears("any");
    setIsAddingSkill(false);
  };

  const updateSkillName = (index: number, name: string) => {
    const nextDrafts = { ...nameDrafts };
    delete nextDrafts[index];
    setNameDrafts(nextDrafts);
    if (!name.trim()) {
      saveSkills(
        formData.requiredSkills.filter((_, skillIndex) => skillIndex !== index),
      );
      return;
    }
    saveSkills(
      formData.requiredSkills.map((skill, skillIndex) =>
        skillIndex === index ? { ...skill, name: name.trim() } : skill,
      ),
    );
  };

  return (
    <div>
      <h2 className="font-serif text-3xl font-semibold leading-tight tracking-tight text-foreground mb-1.5">
        Requirements
      </h2>
      <p className="text-sm text-muted-foreground mb-9">
        Tell us what you’re looking for in a strong applicant. Your choices help
        us find the best match.
      </p>

      {/* ── 1. Education ─────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <SectionHeading
          number={1}
          label="Minimum educational attainment"
          optional
        />
        <Select
          value={formData.minimumEducation}
          onValueChange={(value) => updateField("minimumEducation", value)}
        >
          <SelectTrigger id="req-education" className="mt-3">
            <SelectValue placeholder="Select attainment…" />
          </SelectTrigger>
          <SelectContent>
            {MINIMUM_EDUCATION_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.minimumEducation && (
          <p className="mt-1 text-xs text-red-500">{errors.minimumEducation}</p>
        )}
      </div>

      {/* ── 2. Required Skills ────────────────────────────────────────────────── */}
      <div className="border-t border-dashed border-border pt-7 mb-8">
        <SectionHeading number={2} label="Required Skills" />
        <p className="mt-1.5 mb-4 text-sm text-muted-foreground">
          Add the skills you want applicants to have and select the preferred
          experience level.
        </p>

        <div className="space-y-2">
          {formData.requiredSkills.map((skill, index) => (
            <div
              key={`${skill.name}-${index}`}
              className="grid grid-cols-[1fr_140px_auto] items-center gap-3 rounded-xl border border-[#474ead] bg-indigo-50/70 p-3 dark:bg-indigo-900/20"
            >
              <Input
                value={nameDrafts[index] ?? skill.name}
                onChange={(event) =>
                  setNameDrafts({ ...nameDrafts, [index]: event.target.value })
                }
                onBlur={(event) => updateSkillName(index, event.target.value)}
                placeholder="Skill name"
                className="h-9 bg-white"
              />
              <Select
                value={skill.years}
                onValueChange={(years) =>
                  saveSkills(
                    formData.requiredSkills.map((item, skillIndex) =>
                      skillIndex === index
                        ? {
                            ...item,
                            years: years as RequiredSkillRequirement["years"],
                          }
                        : item,
                    ),
                  )
                }
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SKILL_EXPERIENCE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                onClick={() =>
                  saveSkills(
                    formData.requiredSkills.filter(
                      (_, skillIndex) => skillIndex !== index,
                    ),
                  )
                }
                className="rounded p-1 text-muted-foreground hover:bg-white hover:text-foreground"
                aria-label={`Remove ${skill.name}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}

          {isAddingSkill && (
            <div className="grid grid-cols-[1fr_140px_auto] items-center gap-3 rounded-xl border border-dashed border-[#474ead] bg-indigo-50/50 p-3 dark:bg-indigo-900/20">
              <Input
                autoFocus
                value={pendingSkillName}
                onChange={(event) => setPendingSkillName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addPendingSkill();
                  }
                }}
                placeholder="Skill name"
                className="h-9 bg-white"
              />
              <Select
                value={pendingSkillYears}
                onValueChange={(years) =>
                  setPendingSkillYears(
                    years as RequiredSkillRequirement["years"],
                  )
                }
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SKILL_EXPERIENCE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                onClick={() => {
                  setPendingSkillName("");
                  setPendingSkillYears("any");
                  setIsAddingSkill(false);
                }}
                className="rounded p-1 text-muted-foreground hover:bg-white hover:text-foreground"
                aria-label="Remove unfinished skill"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {isAddingSkill ? (
          <button
            type="button"
            onClick={addPendingSkill}
            className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#474ead]"
          >
            <Plus className="h-4 w-4" /> Add skill
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsAddingSkill(true)}
            className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#474ead]"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-50 text-xs">
              +
            </span>
            Add another skill
          </button>
        )}
      </div>

      {/* ── 3. Availability ───────────────────────────────────────────────────── */}
      <div className="border-t border-dashed border-border pt-7 mb-8">
        <SectionHeading number={3} label="Availability" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 hover:border-[#474ead]">
            <input
              type="checkbox"
              checked={formData.requiresUsTimezoneOverlap}
              onChange={(event) =>
                updateField("requiresUsTimezoneOverlap", event.target.checked)
              }
              className="mt-0.5 h-4 w-4 accent-[#474ead]"
            />
            <span>
              <span className="block text-sm font-semibold">
                Must overlap with US time zones
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Applicant works hours that align with US business hours.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 hover:border-[#474ead]">
            <input
              type="checkbox"
              checked={formData.requiresFluentEnglish}
              onChange={(event) =>
                updateField("requiresFluentEnglish", event.target.checked)
              }
              className="mt-0.5 h-4 w-4 accent-[#474ead]"
            />
            <span>
              <span className="block text-sm font-semibold">
                Fluent English (written &amp; spoken)
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Required for client-facing communication.
              </span>
            </span>
          </label>
        </div>
      </div>

      {/* ── 4. Compensation ───────────────────────────────────────────────────── */}
      <div className="border-t border-dashed border-border pt-7">
        <SectionHeading number={4} label="Compensation" optional />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="req-currency">Currency</Label>
            <Select
              value={formData.currency || "PHP"}
              onValueChange={(value) => updateField("currency", value)}
            >
              <SelectTrigger id="req-currency" className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_CURRENCIES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="req-salary">Monthly rate</Label>
            <Input
              id="req-salary"
              className="mt-1.5"
              value={formData.salaryDisplay}
              onChange={(event) =>
                updateField("salaryDisplay", event.target.value)
              }
              placeholder="e.g. 45,000 – 60,000"
            />
          </div>
          <div>
            <Label htmlFor="req-compensation-display">Display as</Label>
            <Select
              value={formData.compensationDisplayType}
              onValueChange={(value) =>
                updateField("compensationDisplayType", value)
              }
            >
              <SelectTrigger id="req-compensation-display" className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMPENSATION_DISPLAY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
