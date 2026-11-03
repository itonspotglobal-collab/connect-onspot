import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Loader2, MessageSquare, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { messageContactsQueryKey, type MessageContact } from "@/hooks/useMessageContacts";

function hiredDate(value: string | null) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function ContactsList({
  contacts,
  role,
  isLoading,
  isError,
  onRetry,
}: {
  contacts: MessageContact[];
  role: "client" | "talent";
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [openingId, setOpeningId] = useState<string | null>(null);
  const isTalent = role === "talent";

  async function openContact(contact: MessageContact) {
    if (openingId) return;
    setOpeningId(contact.applicationId);
    try {
      let threadId = contact.threadId;
      if (!threadId) {
        const response = await apiRequest("POST", `/api/applications/${encodeURIComponent(contact.applicationId)}/message-thread`);
        const result = await response.json() as { threadId?: string };
        threadId = result.threadId ?? null;
      }
      if (!threadId) throw new Error("No conversation was returned.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: messageContactsQueryKey }),
        queryClient.invalidateQueries({ queryKey: ["my-message-threads"] }),
      ]);
      navigate(`/messages/${threadId}`);
    } catch (error) {
      toast({
        title: "Unable to open conversation",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setOpeningId(null);
    }
  }

  if (isLoading) {
    return <div className="space-y-3 p-4" aria-label="Loading contacts">
      {[0, 1, 2].map((item) => <div key={item} className="animate-pulse space-y-2 rounded-lg border border-slate-100 p-3 dark:border-slate-800">
        <div className="h-3 w-2/3 rounded bg-slate-100 dark:bg-slate-800" />
        <div className="h-2.5 w-1/2 rounded bg-slate-100 dark:bg-slate-800" />
        <div className="h-8 rounded bg-slate-100 dark:bg-slate-800" />
      </div>)}
    </div>;
  }

  if (isError) {
    return <div className="m-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
      <p>Could not load hired contacts. Please try again.</p>
      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onRetry}>
        <RefreshCw className="mr-2 h-3.5 w-3.5" />Try again
      </Button>
    </div>;
  }

  if (contacts.length === 0) {
    return <div className="p-6 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-[#474ead] dark:bg-indigo-950/50 dark:text-indigo-300">
        <MessageSquare className="h-4 w-4" />
      </div>
      <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
        {isTalent
          ? "You'll see clients here once a hiring contract is fully signed."
          : "Hired talent will appear here once their contract is fully signed."}
      </p>
    </div>;
  }

  return <div className="divide-y divide-slate-100 dark:divide-slate-800">
    {contacts.map((contact) => {
      const title = isTalent ? contact.companyName || contact.personName : contact.personName;
      const detail = isTalent ? contact.contactPerson : contact.companyName;
      const opening = openingId === contact.applicationId;
      return <article key={contact.applicationId} className="px-4 py-4 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50" data-testid={`message-contact-${contact.applicationId}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
            {detail && <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{detail}</p>}
          </div>
          {contact.unreadCount > 0 && <span className="mt-1 inline-flex min-w-[19px] shrink-0 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white" aria-label={`${contact.unreadCount} unread messages`}>
            {contact.unreadCount > 99 ? "99+" : contact.unreadCount}
          </span>}
        </div>
        <p className="mt-2 truncate text-xs font-medium text-slate-600 dark:text-slate-300">{contact.jobTitle}</p>
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
          <CalendarDays className="h-3 w-3" />Hired {hiredDate(contact.hiredAt)}
        </p>
        <Button type="button" size="sm" variant={contact.threadId ? "outline" : "default"}
          className={`mt-3 h-8 w-full text-xs ${contact.threadId ? "" : "bg-[#474ead] text-white hover:bg-[#3d439c]"}`}
          disabled={opening}
          onClick={() => void openContact(contact)}
          data-testid={`button-message-contact-${contact.applicationId}`}>
          {opening ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="mr-1.5 h-3.5 w-3.5" />}
          {opening ? "Opening…" : contact.threadId ? "Open chat" : "Message"}
        </Button>
      </article>;
    })}
  </div>;
}
