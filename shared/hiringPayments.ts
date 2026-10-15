import { z } from "zod";

export const OFFERABLE_PAYMENT_STAGES = [
  "shortlisted", "reviewed", "under_review", "interviewing", "offer_declined",
] as const;

const money = z.string().regex(/^(0|[1-9]\d{0,11})(\.\d{1,2})?$/, "Enter a positive amount with at most two decimal places.")
  .refine(value => Number(value) > 0, "Amount must be positive.");
const text = (max: number) => z.string().trim().min(1).max(max);
export const hiringFeePolicyInput = z.object({
  amount: money,
  currency: z.literal("USD"),
  feeBasis: z.literal("fixed_per_hiring_attempt"),
  feeDescription: text(500),
  taxTreatment: z.enum(["inclusive", "exempt"]),
  taxDescription: text(500),
  dueDays: z.number().int().min(1).max(90),
  paymentMethod: z.literal("manual_transfer"),
  paymentRecipient: text(500),
  paymentInstructions: text(4000),
});
export const hiringPaymentReviewInput = z.object({
  action: z.enum(["verify", "reject", "void", "refund", "invalidate"]),
  reason: text(2000),
  verifiedAmount: money.optional(),
  verifiedCurrency: z.literal("USD").optional(),
  verifiedReference: text(500).optional(),
  verifiedRecipient: text(500).optional(),
  independentlyVerified: z.literal(true).optional(),
}).superRefine((value, ctx) => {
  if (value.action === "verify" && (!value.verifiedAmount || !value.verifiedCurrency ||
      !value.verifiedReference || !value.verifiedRecipient || !value.independentlyVerified)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Independently verify the settled payment, amount, currency, recipient and transaction reference before confirming." });
  }
});
export type HiringFeePolicyInput = z.infer<typeof hiringFeePolicyInput>;
