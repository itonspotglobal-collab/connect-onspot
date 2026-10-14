/** Broad landing categories are a starting point, not verified profile skills. */
export const TALENT_LANDING_SKILLS = [
  "Virtual assistance & admin",
  "Customer support",
  "Sales & lead generation",
  "Marketing & social media",
  "Graphic design & video",
  "Bookkeeping & accounting",
  "Web & software development",
  "Something else",
] as const;

export function talentLandingSkill(value: string | null): string | null {
  return value && TALENT_LANDING_SKILLS.some(skill => skill === value) ? value : null;
}

export function talentLandingReturnTo(skill: string): string {
  const category = talentLandingSkill(skill);
  return category ? `/get-hired?${new URLSearchParams({ mainSkill: category })}` : "/get-hired";
}
