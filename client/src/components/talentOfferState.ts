import { isActionableOffer, isOfferExpired } from "@shared/offerState";

export interface OfferWithExpiry {
  status: string;
  expiresAt?: string | null;
  expires_at?: string | null;
  proposerRole?: string | null;
  proposer_role?: string | null;
}

export function isTalentOfferExpired(offer: OfferWithExpiry, now = Date.now()): boolean {
  return isOfferExpired(offer, now);
}

export function bucketTalentOffers<T extends OfferWithExpiry>(offers: T[], now = Date.now()) {
  const pending = offers.filter((offer) =>
    isActionableOffer({ ...offer, proposerRole: offer.proposerRole ?? offer.proposer_role ?? undefined }, now),
  );
  const waitingForClient = offers.filter((offer) =>
    offer.status === "sent"
    && (offer.proposerRole ?? offer.proposer_role) === "talent"
    && !isTalentOfferExpired(offer, now),
  );
  const past = offers.filter((offer) =>
    offer.status !== "sent" || isTalentOfferExpired(offer, now),
  );
  return { pending, waitingForClient, past };
}
