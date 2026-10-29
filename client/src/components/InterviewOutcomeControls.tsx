import {useEffect,useState} from "react";
import {useMutation,useQuery,useQueryClient} from "@tanstack/react-query";
import {apiRequest} from "@/lib/queryClient";
import {Button} from "@/components/ui/button";

export function InterviewOutcomeControls({interview,admin=false}:{interview:any;admin?:boolean}) {
  const cache=useQueryClient();
  const currentType=interview.interview_type??interview.interviewType??"initial";
  const [type,setType]=useState(currentType);
  const [outcome,setOutcome]=useState("advance");
  const [notes,setNotes]=useState("");
  const [final,setFinal]=useState(currentType==="final");
  useEffect(()=>{setType(currentType);setFinal(currentType==="final");},[currentType]);
  const recorded=interview.outcome;
  const confirmed=interview.confirmed_time??interview.confirmedTime;
  const past=confirmed&&new Date(confirmed).getTime()<=Date.now();
  const mayRecord=past&&(interview.status==="confirmed"||interview.status==="completed"&&recorded==="pending");
  const prefix=admin?"/api/admin":"/api/client";
  const mutation=useMutation({
    mutationFn:async(action:"type"|"outcome"|"calendar-sync")=>{
      const response=await apiRequest(action==="calendar-sync"?"POST":"PATCH",`${prefix}/interviews/${interview.id}/${action}`,
        action==="calendar-sync"?{}:action==="type"?{interviewType:type}:
          {outcome,internalNotes:notes,interviewType:final?"final":type});
      return response.json();
    },
    onSuccess:()=>cache.invalidateQueries({predicate:q=>q.queryKey.some(k=>typeof k==="string"&&/interview|application|contractor-onboarding/i.test(k))}),
    onError:()=>{void cache.invalidateQueries({queryKey:["/api/contractor-onboarding"]});},
  });
  const syncStatus=interview.calendar_sync_status??interview.calendarSyncStatus;
  if(interview.status==="cancelled")return null;
  return <div className="mt-3 space-y-2 border-t border-slate-200 pt-3 text-xs" onClick={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()}>
    {!recorded&&interview.status!=="completed"&&<div className="flex flex-wrap items-center gap-2">
      <label>Interview type <select aria-label="Interview type" className="ml-2 rounded border bg-white p-1 text-slate-900" value={type} onChange={e=>{setType(e.target.value);setFinal(e.target.value==="final");}}>
        {["initial","technical","final"].map(t=><option key={t} value={t}>{t[0].toUpperCase()+t.slice(1)}</option>)}
        {!["initial","technical","final"].includes(currentType)&&<option value={currentType}>{currentType}</option>}
      </select></label>
      {type!==currentType&&<Button size="sm" variant="outline" disabled={mutation.isPending} onClick={()=>mutation.mutate("type")}>Save type</Button>}
    </div>}
    {mayRecord&&(!recorded||recorded==="pending")&&<details>
      <summary className="cursor-pointer font-semibold text-indigo-700">Record outcome</summary>
      <div className="mt-2 space-y-2 rounded border bg-white p-3 text-slate-900">
        <label className="block">Outcome <select aria-label="Interview outcome" className="ml-2 rounded border p-1" value={outcome} onChange={e=>setOutcome(e.target.value)}>
          <option value="advance">Advance</option><option value="reject">Reject</option>{!recorded&&<option value="pending">Pending</option>}
        </select></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={final} disabled={!!recorded} onChange={e=>setFinal(e.target.checked)} />This was the final round</label>
        <label className="block">Internal notes (optional)<textarea className="mt-1 block w-full rounded border p-2" maxLength={5000} value={notes} onChange={e=>setNotes(e.target.value)} /></label>
        <Button size="sm" disabled={mutation.isPending} onClick={()=>mutation.mutate("outcome")}>Save outcome</Button>
      </div>
    </details>}
    {recorded&&<p>Outcome: <strong>{recorded}</strong>{recorded==="pending"?" — record Advance or Reject when ready.":""}</p>}
    {!admin&&syncStatus==="failed"&&<p role="status" className="text-amber-800">The interview is saved. OnSpot needs to resolve the calendar invitation.</p>}
    {admin&&syncStatus==="failed"&&<div role="status" className="rounded border border-amber-200 bg-amber-50 p-2 text-amber-900">
      Interview saved. Calendar sync needs attention.
      <Button size="sm" variant="outline" className="ml-2" disabled={mutation.isPending} onClick={()=>mutation.mutate("calendar-sync")}>Retry calendar sync</Button>
    </div>}
    {mutation.isError&&<p role="alert" className="text-red-700">{(mutation.error as Error).message}</p>}
  </div>;
}

export function InterviewOutcomeList({submissionId,admin=false,excludeId}:{submissionId:string;admin?:boolean;excludeId?:string}) {
  const {data=[]}=useQuery<any[]>({
    queryKey:[admin?"/api/admin/interviews":"/api/client/interviews","outcomes",submissionId],
    queryFn:async()=>{
      const body=await(await apiRequest("GET",admin?"/api/admin/interviews":`/api/client/interviews?submissionId=${encodeURIComponent(submissionId)}`)).json();
      return (Array.isArray(body)?body:body.interviews??[]).filter((i:any)=>(i.submission_id??i.submissionId)===submissionId);
    },
    enabled:!!submissionId,
  });
  return <div className="space-y-3">{data.filter(i=>i.id!==excludeId).map(i=><section key={i.id} className="rounded border bg-white p-3">
    <p className="text-xs font-semibold">Round {i.round_number??i.roundNumber} · {i.interview_type??i.interviewType}</p>
    <InterviewOutcomeControls interview={i} admin={admin} />
  </section>)}</div>;
}
