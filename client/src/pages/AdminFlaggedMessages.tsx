import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Flag, CheckCircle, MessageSquare, Clock, User, AlertTriangle } from "lucide-react";

interface FlaggedMessage {
  id: string;
  threadId: string;
  senderId: string;
  content: string;
  createdAt: string;
  flaggedForReview: boolean;
  messageType: string | null;
  readBy: string[] | null;
  thread: {
    id: string;
    subject: string | null;
    participants: string[];
    lastMessageAt: string | null;
  } | null;
}

function FlaggedMessageCard({
  message,
  onClear,
  isClearing,
}: {
  message: FlaggedMessage;
  onClear: (id: string) => void;
  isClearing: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="border-l-4 border-l-red-400">
      <CardContent className="py-4 px-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Header row */}
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Flag className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
              <span className="text-xs font-medium text-red-600">Flagged for review</span>
              <span className="text-muted-foreground text-xs">•</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <User className="w-3 h-3" />
                <span className="font-mono text-[11px]">{message.senderId.slice(0, 8)}…</span>
              </span>
              <span className="text-muted-foreground text-xs">•</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {new Date(message.createdAt).toLocaleString()}
              </span>
              {message.thread?.subject && (
                <>
                  <span className="text-muted-foreground text-xs">•</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MessageSquare className="w-3 h-3" />
                    {message.thread.subject}
                  </span>
                </>
              )}
            </div>

            {/* Thread context */}
            {message.thread && (
              <p className="text-xs text-muted-foreground mb-2">
                Thread ID:{" "}
                <span className="font-mono text-[11px]">{message.threadId.slice(0, 16)}…</span>
                {" · "}
                {message.thread.participants.length} participant
                {message.thread.participants.length !== 1 ? "s" : ""}
              </p>
            )}

            {/* Message content */}
            <div className="bg-muted rounded-md px-3 py-2 text-sm">
              {expanded || message.content.length <= 200 ? (
                message.content
              ) : (
                <>
                  {message.content.slice(0, 200)}…{" "}
                  <button
                    className="text-primary underline text-xs"
                    onClick={() => setExpanded(true)}
                  >
                    show more
                  </button>
                </>
              )}
              {expanded && message.content.length > 200 && (
                <button
                  className="block mt-1 text-primary underline text-xs"
                  onClick={() => setExpanded(false)}
                >
                  show less
                </button>
              )}
            </div>
          </div>

          {/* Action */}
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 border-green-500 text-green-700 hover:bg-green-50"
            onClick={() => onClear(message.id)}
            disabled={isClearing}
          >
            <CheckCircle className="w-3.5 h-3.5 mr-1" />
            Mark reviewed
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminFlaggedMessages() {
  const { token } = useAuth() as any;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [clearingId, setClearingId] = useState<string | null>(null);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const { data: messages = [], isLoading, isError } = useQuery<FlaggedMessage[]>({
    queryKey: ["/api/admin/flagged-messages"],
    queryFn: async () => {
      const res = await fetch("/api/admin/flagged-messages", { headers });
      if (!res.ok) throw new Error("Failed to load flagged messages");
      return res.json();
    },
  });

  const clearMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/messages/${id}/clear-flag`, {
        method: "PATCH",
        headers,
      });
      if (!res.ok) throw new Error("Failed to clear flag");
      return res.json();
    },
    onMutate: (id) => setClearingId(id),
    onSuccess: (_data, id) => {
      toast({ title: "Message marked as reviewed", description: "The flag has been cleared." });
      // Optimistically remove from list
      queryClient.setQueryData<FlaggedMessage[]>(
        ["/api/admin/flagged-messages"],
        (prev) => (prev ?? []).filter((m) => m.id !== id),
      );
    },
    onError: () => {
      toast({ title: "Error", description: "Could not clear the flag.", variant: "destructive" });
    },
    onSettled: () => setClearingId(null),
  });

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center gap-3 mb-6">
        <Flag className="w-5 h-5 text-red-500" />
        <h1 className="text-2xl font-bold">Flagged Messages</h1>
        {!isLoading && (
          <Badge
            variant={messages.length > 0 ? "destructive" : "secondary"}
            className="ml-auto"
          >
            {messages.length} pending
          </Badge>
        )}
      </div>

      <p className="text-muted-foreground text-sm mb-6">
        Messages automatically flagged because they may contain personally identifiable information
        (PII). Review the content below and mark each as reviewed once actioned. Messages are not
        deleted — only the flag is cleared.
      </p>

      <Separator className="mb-6" />

      {isLoading && (
        <div className="text-center text-muted-foreground py-16">Loading flagged messages…</div>
      )}

      {isError && (
        <div className="flex items-center gap-2 text-red-600 py-8 justify-center">
          <AlertTriangle className="w-4 h-4" />
          Failed to load flagged messages. Please refresh.
        </div>
      )}

      {!isLoading && !isError && messages.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-400" />
          <p className="font-medium">No flagged messages</p>
          <p className="text-sm mt-1">All messages have been reviewed.</p>
        </div>
      )}

      {!isLoading && !isError && messages.length > 0 && (
        <ScrollArea className="h-[calc(100vh-280px)]">
          <div className="space-y-3 pr-2">
            {messages.map((msg) => (
              <FlaggedMessageCard
                key={msg.id}
                message={msg}
                onClear={(id) => clearMutation.mutate(id)}
                isClearing={clearingId === msg.id}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
