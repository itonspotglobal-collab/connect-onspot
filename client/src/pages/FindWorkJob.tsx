import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { TopNavigation } from "@/components/TopNavigation";
import { JobDetailModal } from "@/components/JobDetailModal";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Briefcase, Loader2 } from "lucide-react";

interface JobWithSkills {
  id: string;
  title: string;
  company?: string | null;
  location?: string | null;
  category: string;
  contractType: string;
  experienceLevel: string;
  description: string;
  budget?: string | null;
  hourlyRateMin?: string | null;
  hourlyRateMax?: string | null;
  responsibilities?: string[] | null;
  requirements?: string[] | null;
  skillTags?: string[] | null;
  skills?: string[] | null;
  createdAt?: string | Date | null;
  status?: string;
}

export default function FindWorkJob() {
  const params = useParams<{ jobId: string }>();
  const [, navigate] = useLocation();
  const [modalOpen, setModalOpen] = useState(false);
  const jobId = params?.jobId ?? "";

  // Use the standard query pattern — default fetcher joins the key array with "/"
  // so ["/api/jobs", jobId] → fetches /api/jobs/<jobId>
  const { data: rawJob, isLoading, isError } = useQuery<JobWithSkills>({
    queryKey: ["/api/jobs", jobId],
    enabled: !!jobId,
  });

  // Normalize: the single-job endpoint returns `skills`, search returns `skillTags`.
  // Merge both so JobDetailModal's `job.skillTags` always has data.
  const job: JobWithSkills | undefined = rawJob
    ? {
        ...rawJob,
        skillTags: rawJob.skillTags?.length
          ? rawJob.skillTags
          : (rawJob.skills as string[] | null | undefined) ?? null,
      }
    : undefined;

  useEffect(() => {
    if (job) setModalOpen(true);
  }, [job]);

  function handleClose() {
    setModalOpen(false);
    navigate("/find-work");
  }

  return (
    <>
      <TopNavigation />

      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 gap-6">
        {isLoading && (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-sm">Loading job details…</p>
          </div>
        )}

        {!isLoading && isError && (
          <div className="flex flex-col items-center gap-4 text-center max-w-sm">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Briefcase className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-1">Job not found</h2>
              <p className="text-sm text-muted-foreground">
                This job listing may have been removed or the link is invalid.
              </p>
            </div>
            <Button onClick={() => navigate("/find-work")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Browse all jobs
            </Button>
          </div>
        )}

        {!isLoading && !isError && !job && (
          <div className="flex flex-col items-center gap-4 text-center max-w-sm">
            <p className="text-sm text-muted-foreground">No job data found.</p>
            <Button variant="outline" onClick={() => navigate("/find-work")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Browse all jobs
            </Button>
          </div>
        )}

        {!isLoading && job && !modalOpen && (
          <Button variant="outline" onClick={() => navigate("/find-work")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to all jobs
          </Button>
        )}
      </div>

      {job && (
        <JobDetailModal
          job={job}
          open={modalOpen}
          onClose={handleClose}
          showApply={true}
        />
      )}
    </>
  );
}
