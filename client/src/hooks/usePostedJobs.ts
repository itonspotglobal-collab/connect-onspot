import { useQuery } from "@tanstack/react-query";
import type { Job } from "@shared/schema";

// The public jobs search endpoint returns this paginated shape.
// Do NOT use /api/admin/jobs here — that is an admin-only endpoint and
// also returns the same {items, meta} object (not a bare Job[]).
interface PaginatedJobsResponse {
  items: Job[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// Safe extraction that handles any shape the API might return.
function extractJobs(
  data: PaginatedJobsResponse | Job[] | { jobs?: Job[] } | undefined,
): Job[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray((data as PaginatedJobsResponse).items))
    return (data as PaginatedJobsResponse).items;
  if (Array.isArray((data as { jobs?: Job[] }).jobs))
    return (data as { jobs?: Job[] }).jobs!;
  return [];
}

export function usePostedJobs() {
  const { data, isLoading, isError, error } = useQuery<PaginatedJobsResponse>({
    queryKey: ["/api/jobs/search", { status: "open" }],
    queryFn: async () => {
      const res = await fetch(
        "/api/jobs/search?status=open&page=1&pageSize=200",
      );
      if (!res.ok) throw new Error("Failed to load open jobs");
      const payload = await res.json();
      if (import.meta.env.DEV) {
        console.log("[usePostedJobs] response shape", {
          isArray: Array.isArray(payload),
          keys:
            payload && typeof payload === "object"
              ? Object.keys(payload)
              : [],
        });
      }
      return payload;
    },
    staleTime: 5 * 60 * 1000,
  });

  const jobs = extractJobs(data);
  const openJobs = jobs.filter((j) => j.status === "open");

  return {
    openJobs,
    isLoading,
    isError,
    error,
    hasData: data !== undefined,
  };
}
