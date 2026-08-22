import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export const clientShortlistsQueryKey = ["/api/client/shortlists"];

export type ClientShortlist = {
  id: string;
  jobId: string;
  talentId: string;
  candidateId?: string | null;
  status: "shortlisted";
  applicantName?: string | null;
  jobTitle?: string | null;
  jobStatus?: string | null;
  approvalStatus?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

async function loadShortlists(): Promise<ClientShortlist[]> {
  const response = await apiRequest("GET", "/api/client/shortlists");
  const body = await response.json();
  return Array.isArray(body) ? body : (body.shortlists ?? []);
}

export function useClientShortlists(enabled: boolean) {
  const queryClient = useQueryClient();
  const query = useQuery<ClientShortlist[]>({
    queryKey: clientShortlistsQueryKey,
    queryFn: loadShortlists,
    enabled,
    staleTime: 30_000,
  });

  const create = useMutation({
    mutationFn: async (payload: { jobId: string; talentUserId?: string; candidateId?: string }) => {
      const response = await apiRequest("POST", "/api/client/shortlists", payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientShortlistsQueryKey });
    },
  });

  const remove = useMutation({
    mutationFn: async (shortlistId: string) => {
      await apiRequest("DELETE", `/api/client/shortlists/${encodeURIComponent(shortlistId)}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientShortlistsQueryKey });
    },
  });

  return { ...query, shortlists: query.data ?? [], create, remove };
}