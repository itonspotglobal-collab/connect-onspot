import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface MessageContact {
  applicationId: string;
  jobId: string;
  jobTitle: string;
  hiredAt: string | null;
  paperworkPending: boolean;
  personName: string;
  companyName: string | null;
  contactPerson: string | null;
  otherUserId: string;
  threadId: string | null;
  unreadCount: number;
}

export interface MessageContactsResponse {
  userId: string;
  role: "client" | "talent";
  contacts: MessageContact[];
}

export const messageContactsQueryKey = ["message-contacts"] as const;

export function useMessageContacts(enabled = true) {
  return useQuery<MessageContactsResponse>({
    queryKey: messageContactsQueryKey,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/me/message-contacts");
      return response.json();
    },
    enabled,
    refetchInterval: 30_000,
  });
}
