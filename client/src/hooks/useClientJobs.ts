import { useMutation, useQuery } from "@tanstack/react-query";
import type { Job } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function useClientJobs() {
  const { toast } = useToast();
  const jobsQuery = useQuery<Job[]>({
    queryKey: ["/api/client/jobs"],
    queryFn: async () => (await apiRequest("GET", "/api/client/jobs")).json(),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/client/jobs/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client/jobs"] });
      toast({ title: "Job status updated" });
    },
    onError: (error: Error) =>
      toast({ title: "Failed to update status", description: error.message, variant: "destructive" }),
  });
  const deleteJobMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/client/jobs/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client/jobs"] });
      toast({ title: "Job deleted" });
    },
    onError: (error: Error) =>
      toast({ title: "Could not delete job", description: error.message, variant: "destructive" }),
  });

  return { jobsQuery, toggleStatusMutation, deleteJobMutation };
}
