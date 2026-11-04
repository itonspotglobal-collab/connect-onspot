import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi } from "vitest";
import { DepositBillingCard } from "./DepositBillingCard";
import { OnboardingRepairs } from "./OnboardingRepairs";
import { depositToolError } from "./useSuperAdminTools";
import { ApiRequestError } from "@/lib/queryClient";

const fixture = vi.hoisted(() => ({ capability: { canManage: true, canRevert: false }, error: null as Error | null }));
vi.mock("@/components/admin-hiring-overrides/OverrideControls", () => ({
  useHiringOverrideCapability: () => ({ data: fixture.capability }),
}));
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...await importOriginal<typeof import("@tanstack/react-query")>(),
  useQuery: ({ queryKey }: any) => ({
    data: queryKey[0] === "/api/admin/onboarding-prerequisites" ? {canManage:true}
      : queryKey[0] === "/api/admin/onboarding-repairs" ? {items:[]}
      : { canManage:true, deposit:{id:"fixture",currency:"USD",amount:"100",status:"pending"}, waiver:null },
    isPending:false, isError:!!fixture.error, error:fixture.error, refetch:vi.fn(),
  }),
  useQueryClient: () => ({invalidateQueries:vi.fn()}),
  useMutation: () => ({isPending:false,isError:false,mutate:vi.fn(),reset:vi.fn()}),
}));

describe("Super Admin deposit tools (isolated renders, not account UAT)", () => {
  it("hides billing, offline MSA and repairs from every non-Super Admin", () => {
    fixture.capability = {canManage:true,canRevert:false};
    expect(renderToStaticMarkup(<DepositBillingCard submissionId="fixture" />)).toBe("");
    expect(renderToStaticMarkup(<OnboardingRepairs />)).toBe("");
    fixture.capability = {canManage:false,canRevert:false};
    expect(renderToStaticMarkup(<DepositBillingCard submissionId="fixture" />)).toBe("");
    expect(renderToStaticMarkup(<OnboardingRepairs />)).toBe("");
  });
  it("shows financial/legal tools only with the Super Admin capability", () => {
    fixture.capability = {canManage:true,canRevert:true};
    const html = renderToStaticMarkup(<DepositBillingCard submissionId="fixture" />);
    for (const label of ["Record payment","Defer","Waive","Resend invoice","Upload signed MSA"]) expect(html).toContain(label);
    expect(renderToStaticMarkup(<OnboardingRepairs />)).toContain("Onboarding repairs");
  });
  it("shows the server message when Super Admin authorization is denied", () => {
    const message = "Only a Super Admin may manage deposit billing, offline MSAs or onboarding repairs.";
    fixture.capability = {canManage:true,canRevert:true};
    fixture.error = new ApiRequestError(403,"denied",{code:"SUPER_ADMIN_REQUIRED",message});
    expect(depositToolError(fixture.error,"generic")).toBe(message);
    expect(renderToStaticMarkup(<DepositBillingCard submissionId="fixture" />)).toContain(message);
    expect(renderToStaticMarkup(<OnboardingRepairs />)).toContain(message);
    fixture.error = null;
  });
});
