import { useQuery } from "@tanstack/react-query";
import type { Job } from "@shared/schema";

export function usePostedJobs() {
  const { data, isLoading } = useQuery<Job[]>({
    queryKey: ["/api/admin/jobs"],
    queryFn: async () => {
      const res = await fetch("/api/admin/jobs");
      if (!res.ok) throw new Error("Failed to load jobs");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const openJobs = (data ?? []).filter((j) => j.status === "open");
  return { openJobs, isLoading, hasData: data !== undefined };
}
