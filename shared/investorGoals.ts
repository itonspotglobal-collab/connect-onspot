export const INVESTOR_GOAL_PLACEHOLDERS = {
  investor_goal_contractors_2027: "{CONTRACTOR_GOAL}",
  investor_goal_clients_2027: "{CLIENT_GOAL}",
} as const;

/** Owner-supplied 2027 targets, seeded only when a setting does not exist. */
export const INVESTOR_GOAL_DEFAULTS = {
  investor_goal_contractors_2027: "10000",
  investor_goal_clients_2027: "5000",
} as const;

export type InvestorGoalKey = keyof typeof INVESTOR_GOAL_PLACEHOLDERS;

export function isInvestorGoalKey(key: string): key is InvestorGoalKey {
  return Object.hasOwn(INVESTOR_GOAL_PLACEHOLDERS, key);
}

/** Unconfigured, placeholder, malformed and unsafe values never invent a target. */
export function parseInvestorGoal(value: unknown): number | null {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value.trim())) return null;
  const goal = Number(value.trim());
  return Number.isSafeInteger(goal) && goal > 0 ? goal : null;
}

export function isValidInvestorGoalSetting(key: InvestorGoalKey, value: string): boolean {
  return value.trim() === "" || value.trim() === INVESTOR_GOAL_PLACEHOLDERS[key] ||
    parseInvestorGoal(value) !== null;
}
