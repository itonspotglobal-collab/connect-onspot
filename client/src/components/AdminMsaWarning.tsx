import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AlertCircle } from "lucide-react";

/** Uses the same effective-date condition as the activation gate; no signer PII. */
export function AdminMsaWarning() {
  const { data, isError } = useQuery<{ activeMsaExists: boolean;canManageMsa?:boolean }>({
    queryKey: ["/api/admin/contractor-onboarding"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/contractor-onboarding")).json(),
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
  if (isError||!data?.canManageMsa||data.activeMsaExists) return null;
  return <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
    <AlertCircle className="mr-2 inline h-5 w-5" aria-hidden="true" />
    New engagements cannot be activated until an MSA is uploaded
    <p className="mt-1 text-sm">A Super Admin must review and activate the approved document. Uploading a draft alone does not unblock activation.</p>
    <a className="mt-2 inline-block text-sm underline" href="/admin/contractor-onboarding">View onboarding readiness</a>
  </div>;
}
