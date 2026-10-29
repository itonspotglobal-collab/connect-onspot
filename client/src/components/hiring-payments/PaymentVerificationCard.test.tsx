import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe,it,expect,vi} from "vitest";
import {PaymentVerificationCard} from "./PaymentVerificationCard";

const fixture=vi.hoisted(()=>({data:{} as any,isError:false,isPending:false}));
vi.mock("@tanstack/react-query",()=>({
  useQuery:()=>({...fixture,refetch:vi.fn()}),
  useQueryClient:()=>({invalidateQueries:vi.fn()}),
  useMutation:()=>({isPending:false,isError:false,mutate:vi.fn(),reset:vi.fn()}),
}));
vi.mock("@/lib/queryClient",()=>({apiRequest:vi.fn()}));
describe("payment verification controls (isolated render, not authenticated UAT)",()=>{
  it("offers the grant control only to database-authorized Super Admins",()=>{
    fixture.data={required:true,paid:false,canManage:false,waiver:null};
    expect(renderToStaticMarkup(<PaymentVerificationCard submissionId="fixture" />)).not.toContain("Skip payment verification</button>");
    fixture.data.canManage=true;
    expect(renderToStaticMarkup(<PaymentVerificationCard submissionId="fixture" />)).toContain("Skip payment verification</button>");
  });
  it("allows a Client to request, never grant or issue",()=>{
    fixture.data={required:true,paid:false,canManage:false,waiver:null};
    const html=renderToStaticMarkup(<PaymentVerificationCard submissionId="fixture" client />);
    expect(html).toContain("Request payment skip");
    expect(html).not.toContain("Send deferred hiring invoice");
    expect(html).not.toContain("Revoke skip");
  });
  it("locks accepted deferrals and shows the existing-policy invoice action",()=>{
    fixture.data={required:true,paid:false,canManage:true,waiver:{id:"w",waiver_type:"defer",locked_at:"2026-10-29",deferred_payment_required:true}};
    const html=renderToStaticMarkup(<PaymentVerificationCard submissionId="fixture" />);
    expect(html).toContain("Skipped (Deferred)");
    expect(html).toContain("Send deferred hiring invoice");
    expect(html).not.toContain("Revoke skip");
    fixture.data.waiver.waiver_type="waive";
    expect(renderToStaticMarkup(<PaymentVerificationCard submissionId="fixture" />)).not.toContain("Send deferred hiring invoice");
  });
  it("shows the special arrangement note without internal reasons",()=>{
    fixture.data={required:true,paid:false,canManage:false,waiver:{id:"w",waiver_type:"waive",locked_at:null}};
    expect(renderToStaticMarkup(<PaymentVerificationCard submissionId="fixture" client />)).toContain("(special arrangement)");
  });
});
