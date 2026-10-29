import {useState} from "react";
import {useQuery,useMutation,useQueryClient} from "@tanstack/react-query";
import {apiRequest} from "@/lib/queryClient";
import {Button} from "@/components/ui/button";
import {Dialog,DialogContent,DialogTitle,DialogHeader,DialogFooter} from "@/components/ui/dialog";
export function HiringPaymentPolicyToggle() {
  const [confirm,setConfirm]=useState(false),qc=useQueryClient();
  const settings=useQuery<{preOfferPaymentRequired:boolean;canManage:boolean}>({
    queryKey:["/api/hiring-payment-settings"],
    queryFn:async()=>(await apiRequest("GET","/api/hiring-payment-settings")).json(),retry:false,
  });
  const save=useMutation({
    mutationFn:async()=>(await apiRequest("PATCH","/api/admin/hiring-payment-settings",{preOfferPaymentRequired:!settings.data?.preOfferPaymentRequired})).json(),
    onSuccess:async()=>{setConfirm(false);await qc.invalidateQueries({queryKey:["/api/hiring-payment-settings"]});},
  });
  if(!settings.data?.canManage)return settings.isError?<p role="alert">Couldn’t load hiring payment policy. <button onClick={()=>settings.refetch()}>Retry</button></p>:null;
  return <section className="rounded-xl border bg-white p-5">
    <h2 className="font-semibold">Pre-offer payment policy</h2>
    <p className="mt-2 text-sm">Require independently verified hiring payment before offers. Application-specific skips are audited exceptions; deposits are unchanged.</p>
    <Button className="mt-3" variant="outline" role="switch" aria-checked={settings.data.preOfferPaymentRequired} onClick={()=>{save.reset();setConfirm(true);}}>
      {settings.data.preOfferPaymentRequired?"Required — turn off":"Not required — turn on"}
    </Button>
    <Dialog open={confirm} onOpenChange={v=>!save.isPending&&setConfirm(v)}><DialogContent>
      <DialogHeader><DialogTitle>Change pre-offer payment policy?</DialogTitle></DialogHeader>
      <p>This changes the global offer payment requirement to {settings.data.preOfferPaymentRequired?"OFF":"ON"}. Existing payments and deposit requirements will not be changed. This action is audited.</p>
      {save.isError&&<p role="alert">{save.error.message}</p>}
      <DialogFooter><Button variant="outline" disabled={save.isPending} onClick={()=>setConfirm(false)}>Cancel</Button><Button disabled={save.isPending} onClick={()=>save.mutate()}>Confirm change</Button></DialogFooter>
    </DialogContent></Dialog>
  </section>;
}
