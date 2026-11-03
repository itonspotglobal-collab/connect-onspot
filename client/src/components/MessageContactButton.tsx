import { useId, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageSquare } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { MessageContact } from "@/hooks/useMessageContacts";
import { messageContactsQueryKey } from "@/hooks/useMessageContacts";
import { useToast } from "@/hooks/use-toast";

export function MessageContactButton({
  contacts,
  className,
}: {
  contacts: MessageContact[];
  className?: string;
}) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const unavailableId = useId();
  const [choosing, setChoosing] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);

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
      setChoosing(false);
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

  if (contacts.length === 0) {
    return <div className="flex-1" title="Messaging is available after a hiring contract is fully signed.">
      <Button type="button" size="sm" disabled className={`w-full text-xs ${className ?? ""}`} aria-describedby={unavailableId}>
        <MessageSquare className="h-3.5 w-3.5" />Message
      </Button>
      <span className="mt-1 block text-[10px] leading-tight text-slate-400">Available after a hiring contract is fully signed.</span>
      <span id={unavailableId} className="sr-only">Messaging is available after a hiring contract is fully signed.</span>
    </div>;
  }

  return <>
    <Button type="button" size="sm" className={`flex-1 text-xs ${className ?? ""}`} onClick={() => {
      if (contacts.length === 1) void openContact(contacts[0]);
      else setChoosing(true);
    }} disabled={Boolean(openingId)}>
      {openingId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
      {openingId ? "Opening…" : "Message"}
    </Button>
    <Dialog open={choosing} onOpenChange={setChoosing}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Choose an engagement</DialogTitle>
          <DialogDescription>This team member has more than one fully signed hire. Select the job you want to discuss.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[55dvh] space-y-2 overflow-y-auto">
          {contacts.map((contact) => <Button key={contact.applicationId} type="button" variant="outline" className="h-auto w-full justify-between gap-3 py-3 text-left" disabled={Boolean(openingId)} onClick={() => void openContact(contact)}>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{contact.jobTitle}</span>
              <span className="mt-0.5 block truncate text-xs font-normal text-slate-500">Hired {contact.hiredAt ? new Date(contact.hiredAt).toLocaleDateString() : "date unavailable"}</span>
            </span>
            {openingId === contact.applicationId ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <MessageSquare className="h-4 w-4 shrink-0 text-[#474ead]" />}
          </Button>)}
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
