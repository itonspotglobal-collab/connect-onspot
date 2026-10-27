export interface ContractorOfferPolicyState {
  policy?: "legacy" | "deposit_first";
  canSendOffer?: boolean;
}

/** Preserve the established path for legacy applications; new-policy offers follow the server gate. */
export function isContractorOfferAllowed(state?: ContractorOfferPolicyState | null): boolean {
  return state?.policy !== "deposit_first" || state.canSendOffer === true;
}

