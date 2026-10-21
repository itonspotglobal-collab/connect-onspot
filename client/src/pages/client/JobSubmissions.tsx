import { useState } from "react";
import { useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ExtendOfferDialog,
  JobSubmissionsSection,
  ViewSubmissionModal,
  type JobSubmission,
} from "@/pages/ClientProfile";

export default function JobSubmissionsPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const applicationId = params.get("applicationId");
  const interviewId = params.get("interviewId");
  const [viewingSubmission, setViewingSubmission] = useState<JobSubmission | null>(null);
  const [extendingOfferFor, setExtendingOfferFor] = useState<JobSubmission | null>(null);
  const { data: settings, isLoading: settingsLoading, isError: settingsError, refetch } = useQuery<{ nameRevealThreshold: string }>({
    queryKey: ["/api/platform-settings/public"],
    queryFn: async () => (await apiRequest("GET", "/api/platform-settings/public")).json(),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="border-b border-slate-200 pb-5 dark:border-white/[0.08]">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#474ead]">Hiring workspace</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Job Submissions</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Review and manage applications submitted to your job openings.</p>
      </header>
      {settingsError ? (
        <Card><CardContent className="flex flex-col items-center py-8 text-center">
          <p role="alert" className="mb-3 text-sm text-slate-600 dark:text-slate-300">Application privacy settings could not be loaded.</p>
          <Button variant="outline" onClick={() => refetch()}><RotateCw className="mr-2 h-4 w-4" />Retry</Button>
        </CardContent></Card>
      ) : settingsLoading ? (
        <Skeleton className="h-20 w-full rounded-xl" />
      ) : (
        <JobSubmissionsSection
          workspace
          onView={setViewingSubmission}
          onExtendOffer={setExtendingOfferFor}
          requestedApplicationId={applicationId}
          requestedInterviewId={interviewId}
          nameRevealThreshold={settings?.nameRevealThreshold ?? "submitted"}
        />
      )}
      {viewingSubmission && (
        <ViewSubmissionModal
          submission={viewingSubmission}
          requestedInterviewId={interviewId}
          onClose={() => setViewingSubmission(null)}
          onStatusChange={(id, status, statusVersion) =>
            setViewingSubmission((current) => current?.id === id ? { ...current, status, statusVersion } : current)
          }
          onExtendOffer={setExtendingOfferFor}
          nameRevealThreshold={settings?.nameRevealThreshold ?? "submitted"}
        />
      )}
      {extendingOfferFor && (
        <ExtendOfferDialog
          submission={extendingOfferFor}
          onClose={() => setExtendingOfferFor(null)}
          onOfferSent={() => {
            setExtendingOfferFor(null);
            queryClient.invalidateQueries({ queryKey: ["/api/client/job-submissions"] });
          }}
        />
      )}
    </div>
  );
}
