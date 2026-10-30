import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";

export function PendingDeposits() {
  const result=useQuery<{id:string;amount:string;currency:string;job_title:string}[]>({
    queryKey:["/api/client/pending-deposits"],
    queryFn:async()=>(await apiRequest("GET","/api/client/pending-deposits")).json(),
    refetchInterval:30_000,
  });
  if(result.isError)return <p role="alert" className="mb-4 text-sm text-amber-800">Deposit status is unavailable. <button onClick={()=>result.refetch()} className="underline">Retry</button></p>;
  if(!result.data?.length)return null;
  return <section aria-label="Deposits required" className="mb-6 space-y-3">
    {result.data.map(d=><div key={d.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="font-semibold">Deposit required · {d.currency} {d.amount}</p>
      <p className="text-sm">{d.job_title}</p>
      <Link className="mt-2 inline-block text-sm font-semibold underline" href={`/client/payments/deposit/${d.id}`}>Review deposit invoice</Link>
    </div>)}
  </section>;
}
