/** A deadline is authoritative even before the hourly expiry worker runs. */
export function isOfferExpired(offer: { status: string; expiresAt?: string | Date | null; expires_at?: string | Date | null }, now = Date.now()) {
  const deadline = offer.expiresAt ?? offer.expires_at;
  return offer.status === "expired" || (offer.status === "sent" && !!deadline && new Date(deadline).getTime() <= now);
}
export function isActionableOffer(offer: { status: string; expiresAt?: string | Date | null; expires_at?: string | Date | null; proposerRole?: string }, now = Date.now()) {
  return offer.status === "sent" && offer.proposerRole !== "talent" && !isOfferExpired(offer, now);
}
