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

const SUGGESTED_SKILLS = [
  "Graphic design",
  "Customer support",
  "Sales / cold outreach",
  "Bookkeeping / accounting",
  "Copywriting",
] as const;

interface Props {
  formData: JobFormData;
  updateField: (field: keyof JobFormData, value: any) => void;
  errors: Partial<Record<keyof JobFormData, string>>;
}

export function JobRequirementsStep({ formData, updateField, errors }: Props) {
  const [newSkill, setNewSkill] = useState("");
  const [newSkillYears, setNewSkillYears] = useState<RequiredSkillRequirement["years"]>("any");
  const [isAddingSkill, setIsAddingSkill] = useState(false);

  const saveSkills = (skills: RequiredSkillRequirement[]) => {
    const cleanSkills = skills
      .map((skill) => ({ ...skill, name: skill.name.trim() }))
      .filter((skill) => skill.name);
    updateField("requiredSkills", cleanSkills);
    updateField("skillTags", cleanSkills.map((skill) => skill.name).join(", "));
  };

  const selectedSkill = (name: string) =>
    formData.requiredSkills.find((skill) => skill.name.toLowerCase() === name.toLowerCase());

  const toggleSuggestedSkill = (name: string, selected: boolean) => {
    saveSkills(
      selected
        ? formData.requiredSkills.filter((skill) => skill.name.toLowerCase() !== name.toLowerCase())
        : [...formData.requiredSkills, { name, years: "any" }],
    );
  };

  const updateYears = (name: string, years: RequiredSkillRequirement["years"]) => {
    saveSkills(
      formData.requiredSkills.map((skill) =>
        skill.name.toLowerCase() === name.toLowerCase() ? { ...skill, years } : skill,
      ),
    );
  };

  const commitNewSkill = () => {
    const name = newSkill.trim();
    if (
      name &&
      !formData.requiredSkills.some((skill) => skill.name.toLowerCase() === name.toLowerCase())
    ) {
      saveSkills([...formData.requiredSkills, { name, years: newSkillYears }]);
    }
    if (name) {
      setNewSkill("");
      setNewSkillYears("any");
      setIsAddingSkill(false);
    }
  };

  const customSkills = formData.requiredSkills.filter(
    (skill) => !SUGGESTED_SKILLS.some((suggested) => suggested.toLowerCase() === skill.name.toLowerCase()),
  );

  return (
    <div>
      <h2 className="font-serif text-2xl font-normal mb-1 tracking-tight">Requirements</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Pick what a strong applicant needs. These power our matching — just tick what applies.
      </p>

      <div className="mb-6">
        <Label htmlFor="req-education">
          Minimum educational attainment <span className="text-red-500">*</span>
        </Label>
        <Select value={formData.minimumEducation} onValueChange={(value) => updateField("minimumEducation", value)}>
          <SelectTrigger id="req-education" className="mt-1.5">
            <SelectValue placeholder="Select attainment…" />
          </SelectTrigger>
          <SelectContent>
            {MINIMUM_EDUCATION_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>{option}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.minimumEducation && <p className="mt-1 text-xs text-red-500">{errors.minimumEducation}</p>}
      </div>

      <div className="border-t border-dashed border-border pt-5">
        <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Required skills</p>
        <p className="mb-3 text-xs text-muted-foreground">
          Tick each skill and set how many years of experience you&apos;d like.
        </p>

        <div className="space-y-2">
          {SUGGESTED_SKILLS.map((name) => {
            const selected = selectedSkill(name);
            return (
              <div
                key={name}
                className={`grid grid-cols-[1fr_140px] items-center gap-3 rounded-xl border p-3 transition-colors ${
                  selected ? "border-[#474ead] bg-indigo-50/70 dark:bg-indigo-900/20" : "border-border"
                }`}
              >
                <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={Boolean(selected)}
                    onChange={(event) => toggleSuggestedSkill(name, event.target.checked)}
                    className="h-4 w-4 accent-[#474ead]"
                  />
                  {name}
                </label>
                <Select
                  value={selected?.years || "any"}
                  disabled={!selected}
                  onValueChange={(years) => updateYears(name, years as RequiredSkillRequirement["years"])}
                >
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SKILL_EXPERIENCE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}

          {customSkills.map((skill) => (
            <div key={skill.name} className="grid grid-cols-[1fr_140px_auto] items-center gap-3 rounded-xl border border-[#474ead] bg-indigo-50/70 p-3 dark:bg-indigo-900/20">
              <div className="min-w-0 text-sm font-semibold">{skill.name}</div>
              <Select value={skill.years} onValueChange={(years) => updateYears(skill.name, years as RequiredSkillRequirement["years"])}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SKILL_EXPERIENCE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                onClick={() => saveSkills(formData.requiredSkills.filter((item) => item.name !== skill.name))}
                className="rounded p-1 text-muted-foreground hover:bg-white hover:text-foreground"
                aria-label={`Remove ${skill.name}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}

          {isAddingSkill && (
            <div className="grid grid-cols-[1fr_140px] items-center gap-3 rounded-xl border border-[#474ead] bg-indigo-50/70 p-3 dark:bg-indigo-900/20">
              <Input
                autoFocus
                value={newSkill}
                onChange={(event) => setNewSkill(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitNewSkill();
                  }
                }}
                placeholder="Type a skill…"
                className="h-9 bg-white"
              />
              <Select value={newSkillYears} onValueChange={(years) => setNewSkillYears(years as RequiredSkillRequirement["years"])}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SKILL_EXPERIENCE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {!isAddingSkill ? (
          <button
            type="button"
            onClick={() => {
              setNewSkill("");
              setNewSkillYears("any");
              setIsAddingSkill(true);
            }}
            className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#474ead]"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-50 text-xs">+</span>
            Add another skill
          </button>
        ) : (
          <button type="button" onClick={commitNewSkill} className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#474ead]">
            <Plus className="h-4 w-4" /> Add skill
          </button>
        )}
      </div>

      <div className="border-t border-dashed border-border pt-5 mt-6">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Availability</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 hover:border-[#474ead]">
            <input type="checkbox" checked={formData.requiresUsTimezoneOverlap} onChange={(event) => updateField("requiresUsTimezoneOverlap", event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#474ead]" />
            <span><span className="block text-sm font-semibold">Must overlap with US time zones</span><span className="mt-0.5 block text-xs text-muted-foreground">Applicant works hours that align with US business hours.</span></span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 hover:border-[#474ead]">
            <input type="checkbox" checked={formData.requiresFluentEnglish} onChange={(event) => updateField("requiresFluentEnglish", event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#474ead]" />
            <span><span className="block text-sm font-semibold">Fluent English (written &amp; spoken)</span><span className="mt-0.5 block text-xs text-muted-foreground">Required for client-facing communication.</span></span>
          </label>
        </div>
      </div>

      <div className="border-t border-dashed border-border pt-5 mt-6">
        <p className="mb-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Compensation</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="req-salary">Monthly rate (PHP) <span className="text-xs font-normal text-muted-foreground">— optional</span></Label>
            <Input id="req-salary" className="mt-1.5" value={formData.salaryDisplay} onChange={(event) => updateField("salaryDisplay", event.target.value)} placeholder="e.g. ₱45,000 – ₱60,000" />
          </div>
          <div>
            <Label htmlFor="req-compensation-display">Display as</Label>
            <Select value={formData.compensationDisplayType} onValueChange={(value) => updateField("compensationDisplayType", value)}>
              <SelectTrigger id="req-compensation-display" className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {COMPENSATION_DISPLAY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}