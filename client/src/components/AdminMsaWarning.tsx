import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AlertCircle, ExternalLink } from "lucide-react";

type OnboardingPrerequisites = {
  canManage: boolean;
  wiseReady: boolean;
  msaReady: boolean;
  wiseUrl: string;
  msaUrl: string;
};

/** Shared admin setup warning; readiness is reported by the server's canonical gate. */
export function AdminMsaWarning() {
  const { data, isError, error } = useQuery<OnboardingPrerequisites>({
    queryKey: ["/api/admin/onboarding-prerequisites"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/onboarding-prerequisites")).json(),
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
  if (isError) {
    if ((error as { status?: number })?.status === 403) return null;
    return <div role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-950"><AlertCircle className="mr-2 inline h-5 w-5" aria-hidden="true" />Unable to check MSA readiness or Wise readiness. Retry by refreshing the page.</div>;
  }
  if (!data?.canManage || (data.wiseReady && data.msaReady)) return null;
  return <div role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 p-4 text-red-950">
    <AlertCircle className="mr-2 inline h-5 w-5" aria-hidden="true" />
    <strong>New engagements cannot be activated until payment and agreement setup is ready.</strong>
    {!data.wiseReady && <p className="mt-2 text-sm">Clients can't pay deposits — add payment instructions. <a className="inline-flex items-center gap-1 underline" href={data.wiseUrl}>Review Wise setup <ExternalLink className="h-3 w-3" /></a></p>}
    {!data.msaReady && <p className="mt-1 text-sm">New engagements cannot be activated until an MSA is uploaded. Upload and activate the approved version; a draft alone does not unblock activation. <a className="inline-flex items-center gap-1 underline" href={data.msaUrl}>Review MSA setup <ExternalLink className="h-3 w-3" /></a></p>}
    <a className="mt-2 inline-block text-sm underline" href="/admin/contractor-onboarding">View onboarding readiness</a>
  </div>;
}
