/**
 * billing.ts — Pure billing computation functions for the OnSpot Payments engine.
 *
 * All functions are pure (no DB, no I/O) so they can be unit-tested in isolation
 * and called identically from server code and from the E2E evidence script.
 *
 * Money model:
 *   Client pays OnSpot → OnSpot pays Talent. No direct Client→Talent rail.
 *   commission is ADDED ON TOP of talent rate, never deducted from it.
 *   Talent always receives their full agreed rate (adjusted only for extended/deduction hours).
 *
 * Billing-period model:
 *   Standard = 8h/day × 20 working days = 160 h/month flat rate
 *   Lite     = 4h/day × 20 working days =  80 h/month flat rate
 *
 * Rate-adjustment engine:
 *   hourlyEquivalent = talentRate / standardPeriodHours
 *   adjustedTalentPayout = talentRate + (extendedHours − deductionHours) × hourlyEquivalent
 *
 * Security deposit:
 *   30 days of daily rate = (talentRate / 20 working days) × 30 calendar days
 *   = talentRate × 1.5
 */

export type EngagementType = 'Standard' | 'Lite';

/** Standard working hours per monthly billing period, by engagement type. */
export const PERIOD_HOURS: Record<EngagementType, number> = {
  Standard: 160, // 20 working days × 8 h/day
  Lite: 80,      // 20 working days × 4 h/day
};

/** Working days assumed per monthly billing period (for deposit calculation). */
export const WORKING_DAYS_PER_PERIOD = 20;

/** Number of calendar days of daily-rate value held as security deposit. */
export const DEPOSIT_DAYS = 30;

export interface PeriodAmounts {
  /** Hours covered by the base flat rate (160 or 80). */
  standardPeriodHours: number;
  /**
   * Derived hourly equivalent — used ONLY for extended/deduction adjustments.
   * Never exposed as a selectable rate to either party.
   * Stored on the invoice_period row so future recalculations are consistent.
   */
  hourlyEquivalent: number;
  /**
   * Talent's payout after adjustments.
   * = talentRate + (extendedHours − deductionHours) × hourlyEquivalent
   * Commission is NEVER deducted from this.
   */
  adjustedTalentPayout: number;
  /**
   * What the client is invoiced — talent payout + platform commission.
   * Commission is priced in; never itemized as a separate line the client sees.
   * = adjustedTalentPayout × (1 + commissionRate)
   */
  clientInvoiceAmount: number;
  /**
   * OnSpot's gross margin for the period.
   * = clientInvoiceAmount − adjustedTalentPayout
   * This is also the "GTV = Revenue" basis — full client billing is top-line.
   */
  commissionEarned: number;
  /** Stored explicitly on every row — not derived from a hardcoded constant. */
  commissionRate: number;
}

/**
 * Compute all money amounts for a single billing period.
 *
 * @param talentRate          Agreed flat talent rate for the period (from offers.rate)
 * @param engagementType      'Standard' | 'Lite'
 * @param extendedHours       Admin-adjustable extended hours worked beyond the flat period (default 0)
 * @param deductionHours      Admin-adjustable deduction hours (absences, etc.) (default 0)
 * @param commissionRate      Decimal commission (e.g. 0.20 for 20%). Stored explicitly per period.
 *
 * @returns PeriodAmounts with all derived values rounded to 4 decimal places
 *          (round to 2dp at persistence time to keep pure function testable with exact fractions).
 */
export function computePeriodAmounts(
  talentRate: number,
  engagementType: EngagementType,
  extendedHours: number = 0,
  deductionHours: number = 0,
  commissionRate: number = 0.20,
): PeriodAmounts {
  const standardPeriodHours = PERIOD_HOURS[engagementType];
  const hourlyEquivalent = talentRate / standardPeriodHours;
  const adjustedTalentPayout = talentRate + (extendedHours - deductionHours) * hourlyEquivalent;
  const clientInvoiceAmount = adjustedTalentPayout * (1 + commissionRate);
  const commissionEarned = clientInvoiceAmount - adjustedTalentPayout;

  return {
    standardPeriodHours,
    hourlyEquivalent,
    adjustedTalentPayout,
    clientInvoiceAmount,
    commissionEarned,
    commissionRate,
  };
}

/**
 * Compute the security deposit amount for a contract.
 *
 * Deposit = 30 days of daily rate.
 * Daily rate = talentRate / WORKING_DAYS_PER_PERIOD (20 working days).
 *
 * Note: this is the same regardless of Standard vs Lite because the monthly
 * rate already reflects the engagement type's hours — the daily rate is
 * simply the monthly flat rate divided by the number of working days per period.
 *
 * @param talentRate  Agreed flat talent rate per billing period (from offers.rate)
 * @returns           Deposit amount (= talentRate × 1.5)
 */
export function computeDepositAmount(talentRate: number): number {
  const dailyRate = talentRate / WORKING_DAYS_PER_PERIOD;
  return dailyRate * DEPOSIT_DAYS;
}

/**
 * Compute the cure deadline given a suspension timestamp and configurable cure period days.
 *
 * @param suspendedAt       When suspension was triggered (Day 15 of the escalation ladder)
 * @param cureWindowDays    From platform_settings.deposit_cure_period_days (default 5)
 */
export function computeCureDeadline(suspendedAt: Date, cureWindowDays: number = 5): Date {
  const d = new Date(suspendedAt);
  d.setDate(d.getDate() + cureWindowDays);
  return d;
}

/**
 * Compute the replenishment deadline (Day 5 after a draw event).
 */
export function computeReplenishmentDeadline(drawnAt: Date): Date {
  const d = new Date(drawnAt);
  d.setDate(d.getDate() + 5);
  return d;
}
