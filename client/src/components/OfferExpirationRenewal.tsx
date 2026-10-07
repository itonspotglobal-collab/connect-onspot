import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarClock, Loader2 } from "lucide-react";

/** Render only inside the owning client's offer-management flow. */
export function OfferExpirationRenewal({
  offerId,
  endpointBase = "/api/client/offers",
  onRenewed,
}: {
  offerId: string;
  endpointBase?: "/api/client/offers" | "/api/admin/offers";
  onRenewed?: () => void | Promise<void>;
}) {
  const { toast } = useToast();
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);

  async function renew() {
    if (!expiresAt || new Date(expiresAt).getTime() <= Date.now()) {
      toast({ title: "Choose a future expiration", description: "The renewal date must be in the future.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const response = await apiRequest("POST", `${endpointBase}/${encodeURIComponent(offerId)}/expiration`, {
        expiresAt: new Date(expiresAt).toISOString(),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || body.error || `Expiration could not be extended (${response.status})`);
      }
      setExpiresAt("");
      if (endpointBase === "/api/client/offers") {
        await queryClient.invalidateQueries({ queryKey: ["/api/client/offers"] });
      }
      toast({ title: "Offer expiration extended", description: "The renewal was recorded by the offer service." });
      await onRenewed?.();
    } catch (error) {
      toast({ title: "Could not extend expiration", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-2 dark:border-slate-700">
    <span className="mr-auto text-[11px] font-medium text-amber-700">Renew this expired offer</span>
    <Input aria-label="New offer expiration date" type="date" value={expiresAt} min={new Date(Date.now() + 60_000).toISOString().slice(0, 10)} onChange={(event) => setExpiresAt(event.target.value)} className="h-8 w-auto text-xs" />
    <Button size="sm" variant="outline" className="h-8" disabled={!expiresAt || busy} onClick={renew}>
      {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <CalendarClock className="mr-1 h-3.5 w-3.5" />}Extend expiration
    </Button>
  </div>;
}
