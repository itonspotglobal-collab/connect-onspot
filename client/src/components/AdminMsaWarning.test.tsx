import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe,it,expect,vi} from "vitest";
const readySetup={canManage:true,wiseReady:true,msaReady:true,wiseUrl:"/admin/ledger",msaUrl:"/admin/msa-documents"};
const state=vi.hoisted(()=>({data:undefined as undefined|{canManage:boolean;wiseReady:boolean;msaReady:boolean;wiseUrl:string;msaUrl:string},isError:false}));
vi.mock("@tanstack/react-query",()=>({useQuery:()=>state}));
vi.mock("@/lib/queryClient",()=>({apiRequest:vi.fn()}));
import {AdminMsaWarning} from "./AdminMsaWarning";
describe("dashboard MSA readiness warning",()=>{
  it("warns even with no accepted onboarding records",()=>{
    state.data={...readySetup,msaReady:false};state.isError=false;
    const html=renderToStaticMarkup(<AdminMsaWarning />);
    expect(html).toContain("New engagements cannot be activated until an MSA is uploaded");
    expect(html).toContain("activate the approved version");
    expect(html).toContain('role="alert"');
  });
  it("does not warn when an effective active MSA exists",()=>{
    state.data={...readySetup};state.isError=false;
    expect(renderToStaticMarkup(<AdminMsaWarning />)).toBe("");
  });
  it("reports inability to check instead of falsely reporting readiness",()=>{
    state.data=undefined;state.isError=true;
    expect(renderToStaticMarkup(<AdminMsaWarning />)).toContain("Unable to check MSA readiness");
  });
});
