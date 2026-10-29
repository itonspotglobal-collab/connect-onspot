import {useState} from "react";
import {useQuery,useMutation,useQueryClient} from "@tanstack/react-query";
import {apiRequest} from "@/lib/queryClient";
import {Button} from "@/components/ui/button";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogFooter} from "@/components/ui/dialog";
import {Textarea} from "@/components/ui/textarea";

export interface PaymentSkipStatus {
  required:boolean;paid:boolean;canManage:boolean;
  waiver:null|{id:string;waiver_type:"defer"|"waive";locked_at:string|null;deferred_invoice_id?:string|null;deferred_payment_required?:boolean};
}
export function usePaymentSkip(submissionId:string) {
  return useQuery<PaymentSkipStatus>({
    queryKey:["/api/hiring-payment-waivers",submissionId],
    queryFn:async()=> (await apiRequest("GET",`/api/hiring-payment-waivers/${encodeURIComponent(submissionId)}`)).json(),
    retry:false,refetchInterval:30_000,
  });
}
export function PaymentVerificationCard({submissionId,client=false}:{submissionId:string;client?:boolean}) {
  const state=usePaymentSkip(submissionId),qc=useQueryClient();
  const [dialog,setDialog]=useState<"grant"|"revoke"|"request"|null>(null);
  const [type,setType]=useState("defer"),[reason,setReason]=useState(""),[note,setNote]=useState("");
  const [message,setMessage]=useState("");
  const mutation=useMutation({
    mutationFn:async(action:"grant"|"revoke"|"request"|"invoice")=>{
      const path=`/api/${action==="request"?"client":"admin"}/hiring-payment-waivers/${encodeURIComponent(submissionId)}/${action}`;
      return (await apiRequest("POST",path,{waiverType:type,reason,message:reason,arrangementNote:note})).json();
    },
    onSuccess:async(_data,action)=>{
      setDialog(null);setReason("");setNote("");
      setMessage(action==="request"?"Your request was sent to OnSpot. Payment requirements have not changed.":action==="invoice"?"Deferred hiring invoice issued.":"Payment arrangement updated.");
      await qc.invalidateQueries({queryKey:["/api/hiring-payment-waivers",submissionId]});
      await qc.invalidateQueries({queryKey:["/api/client/hiring-invoices",submissionId]});
      await qc.invalidateQueries({queryKey:["/api/admin/contractor-onboarding"]});
    },
  });
  const w=state.data?.waiver;
  return <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
    <h3 className="font-semibold">Payment verification</h3>
    {state.isPending?<p>Checking payment arrangement…</p>:state.isError?<p role="alert">Couldn’t check payment arrangement. <button className="underline" onClick={()=>state.refetch()}>Retry</button></p>:<>
      <p className="mt-2">{w?`Skipped (${w.waiver_type==="defer"?"Deferred":"Waived"})`:state.data?.paid?"Paid & verified":state.data?.required?"Required":"Not required by current policy"}</p>
      {client&&w&&<p className="mt-1 text-xs text-slate-600">Payment verification skipped by OnSpot {w.waiver_type==="defer"?"(deferred until acceptance)":"(special arrangement)"}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {!client&&state.data?.canManage&&!w&&<Button size="sm" variant="outline" onClick={()=>setDialog("grant")}>Skip payment verification</Button>}
        {!client&&state.data?.canManage&&w&&!w.locked_at&&<Button size="sm" variant="outline" onClick={()=>setDialog("revoke")}>Revoke skip</Button>}
        {!client&&state.data?.canManage&&w?.waiver_type==="defer"&&w.locked_at&&w.deferred_payment_required&&!w.deferred_invoice_id&&<Button size="sm" disabled={mutation.isPending} onClick={()=>mutation.mutate("invoice")}>Send deferred hiring invoice</Button>}
        {client&&!w&&state.data?.required&&!state.data.paid&&<Button size="sm" variant="outline" onClick={()=>setDialog("request")}>Request payment skip</Button>}
      </div>
      {w?.locked_at&&!client&&<p className="mt-2 text-xs text-slate-500">Locked at offer acceptance. This arrangement cannot be revoked.</p>}
    </>}
    {message&&<p role="status" className="mt-2">{message}</p>}
    {mutation.isError&&<p role="alert" className="mt-2 text-red-700">{mutation.error.message}</p>}
    <Dialog open={!!dialog} onOpenChange={open=>{if(!open&&!mutation.isPending){setDialog(null);mutation.reset();}}}>
      <DialogContent><DialogHeader><DialogTitle>{dialog==="grant"?"Skip payment verification":dialog==="revoke"?"Revoke payment skip":"Request payment skip"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {dialog==="grant"&&<>
            <label className="block">Skip type<select className="mt-1 block w-full rounded border p-2" value={type} onChange={e=>setType(e.target.value)}>
              <option value="defer">Defer — invoice after acceptance</option><option value="waive">Waive — special arrangement</option></select></label>
            <p className="rounded border border-amber-200 bg-amber-50 p-3">The offer can be sent without payment. This is recorded with your name.</p>
          </>}
          <label className="block">{dialog==="request"?"Message to OnSpot":"Written reason"}<Textarea value={reason} maxLength={2000} onChange={e=>setReason(e.target.value)} placeholder="At least 10 characters" /></label>
          {dialog==="grant"&&<label className="block">Arrangement note (optional)<Textarea value={note} maxLength={2000} onChange={e=>setNote(e.target.value)} /></label>}
          {mutation.isError&&<p role="alert" className="text-red-700">{mutation.error.message}</p>}
        </div>
        <DialogFooter><Button variant="outline" disabled={mutation.isPending} onClick={()=>setDialog(null)}>Cancel</Button>
          <Button disabled={mutation.isPending||reason.trim().length<10} onClick={()=>dialog&&mutation.mutate(dialog)}>{mutation.isPending?"Saving…":dialog==="request"?"Send request":"Confirm"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}
