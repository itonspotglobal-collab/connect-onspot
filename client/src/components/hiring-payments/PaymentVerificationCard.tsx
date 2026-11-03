import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export interface PaymentSkipStatus {
  required: boolean;
  paid: boolean;
  canManage: boolean;
  waiver: null | {
    id: string;
    waiver_type: "defer" | "waive";
    locked_at: string | null;
    deferred_invoice_id?: string | null;
    deferred_payment_required?: boolean;
  };
}

export function usePaymentSkip(submissionId: string) {
  return useQuery<PaymentSkipStatus>({
    queryKey: ["/api/hiring-payment-waivers", submissionId],
    queryFn: async () => (await apiRequest("GET", `/api/hiring-payment-waivers/${encodeURIComponent(submissionId)}`)).json(),
    retry: false,
    refetchInterval: 30_000,
  });
}

export function PaymentVerificationCard({ submissionId, client = false }: { submissionId: string; client?: boolean }) {
  const state = usePaymentSkip(submissionId);
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<"request" | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const requestMutation = useMutation({
    mutationFn: async () => (await apiRequest(
      "POST",
      `/api/client/hiring-payment-waivers/${encodeURIComponent(submissionId)}/request`,
      { reason: reason.trim(), message: reason.trim() },
    )).json(),
    onSuccess: async () => {
      setDialog(null);
      setReason("");
      setMessage("Your request was sent to OnSpot. Payment requirements have not changed.");
      await qc.invalidateQueries({ queryKey: ["/api/hiring-payment-waivers", submissionId] });
    },
  });
  const legacyArrangement = state.data?.waiver;
  if (state.data && !state.data.required) return null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <h3 className="font-semibold">Payment verification</h3>
      {state.isPending ? <p>Checking payment arrangement…</p> : state.isError ? (
        <p role="alert">Couldn’t check payment arrangement. <button className="underline" onClick={() => void state.refetch()}>Retry</button></p>
      ) : <>
        <p className="mt-2">
          {state.data?.paid ? "Paid & verified" : state.data?.required ? "Required" : "Not required by current policy"}
        </p>
        {legacyArrangement && (
          <p className="mt-2 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
            Legacy pre-offer payment arrangement ({legacyArrangement.waiver_type === "defer" ? "deferred" : "waived"}).
            This read-only record does not waive or verify the hiring security deposit.
          </p>
        )}
        {client && !legacyArrangement && state.data?.required && !state.data.paid && (
          <div className="mt-3">
            <Button size="sm" variant="outline" onClick={() => setDialog("request")}>Request payment review</Button>
          </div>
        )}
      </>}
      {message && <p role="status" className="mt-2">{message}</p>}
      {requestMutation.isError && <p role="alert" className="mt-2 text-red-700">{requestMutation.error.message}</p>}
      <Dialog open={dialog === "request"} onOpenChange={(open) => {
        if (!open && !requestMutation.isPending) {
          setDialog(null);
          requestMutation.reset();
        }
      }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request payment review</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm">
              This sends a request to OnSpot; it does not change the deposit or hiring payment requirement.
            </p>
            <label className="block">Message to OnSpot
              <Textarea value={reason} maxLength={2000} onChange={(event) => setReason(event.target.value)} placeholder="At least 10 characters" />
            </label>
            {requestMutation.isError && <p role="alert" className="text-red-700">{requestMutation.error.message}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={requestMutation.isPending} onClick={() => setDialog(null)}>Cancel</Button>
            <Button disabled={requestMutation.isPending || reason.trim().length < 10} onClick={() => requestMutation.mutate()}>
              {requestMutation.isPending ? "Sending…" : "Send request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
