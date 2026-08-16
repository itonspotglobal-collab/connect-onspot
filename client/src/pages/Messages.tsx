import { useEffect, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MessageSquare, Send, ArrowLeft } from "lucide-react";

interface MessageThread {
  id: string;
  jobId: string | null;
  participants: string[];
  subject: string | null;
  lastMessageAt: string | null;
  createdAt: string | null;
}

interface ThreadsResponse {
  userId: string;
  threads: MessageThread[];
  participantNames: Record<string, string>;
}

interface ThreadMessage {
  id: string;
  threadId: string;
  senderId: string;
  content: string;
  messageType: string | null;
  createdAt: string | null;
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" }) +
        " " +
        d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function ThreadView({
  thread,
  meId,
  otherName,
  onBack,
}: {
  thread: MessageThread;
  meId: string;
  otherName: string;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useQuery<ThreadMessage[]>({
    queryKey: ["thread-messages", thread.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/message-threads/${thread.id}/messages`);
      return res.json();
    },
    refetchInterval: 10_000,
  });

  // Mark thread as read when opened
  useEffect(() => {
    apiRequest("POST", `/api/message-threads/${thread.id}/mark-read`, {}).catch(() => {});
  }, [thread.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", "/api/messages", {
        threadId: thread.id,
        content,
      });
      return res.json();
    },
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["thread-messages", thread.id] });
      queryClient.invalidateQueries({ queryKey: ["my-message-threads"] });
    },
  });

  const handleSend = () => {
    const content = draft.trim();
    if (content && !sendMutation.isPending) sendMutation.mutate(content);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" onClick={onBack} data-testid="button-back-to-threads">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white" data-testid="text-thread-other-name">
            {otherName}
          </p>
          {thread.subject && (
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{thread.subject}</p>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">No messages yet. Say hello!</p>
        ) : (
          messages.map((m) =>
            m.messageType === "system" ? (
              <p key={m.id} className="mx-auto max-w-md text-center text-xs italic text-slate-400">
                {m.content}
              </p>
            ) : (
              <div
                key={m.id}
                className={`flex ${m.senderId === meId ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                    m.senderId === meId
                      ? "bg-[#474ead] text-white"
                      : "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  <p
                    className={`mt-1 text-[10px] ${
                      m.senderId === meId ? "text-indigo-200" : "text-slate-400"
                    }`}
                  >
                    {formatTime(m.createdAt)}
                  </p>
                </div>
              </div>
            ),
          )
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-slate-200 p-3 dark:border-slate-700">
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Write a message… (please keep communication on-platform)"
            className="min-h-[44px] max-h-32 resize-none text-sm"
            data-testid="input-message"
          />
          <Button
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full bg-[#474ead] hover:bg-[#3d439c]"
            disabled={!draft.trim() || sendMutation.isPending}
            onClick={handleSend}
            data-testid="button-send-message"
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        {sendMutation.isError && (
          <p className="mt-1 text-xs text-red-500">Failed to send. Please try again.</p>
        )}
      </div>
    </div>
  );
}

export default function Messages() {
  const [, navigate] = useLocation();
  const [matched, params] = useRoute("/messages/:threadId");
  const activeThreadId = matched ? params?.threadId : undefined;

  const { data, isLoading, isError } = useQuery<ThreadsResponse>({
    queryKey: ["my-message-threads"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/me/message-threads");
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const threads = data?.threads ?? [];
  const meId = data?.userId ?? "";
  const names = data?.participantNames ?? {};

  const otherOf = (t: MessageThread) => t.participants.find((p) => p !== meId) ?? "";
  const nameOf = (t: MessageThread) => names[otherOf(t)] || "Member";
  const activeThread = threads.find((t) => t.id === activeThreadId);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4 flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-[#474ead]" />
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Messages</h1>
      </div>
      <p className="mb-4 text-xs text-slate-400">
        Use messages to coordinate next steps like interview scheduling. Please keep all
        communication on the platform.
      </p>

      <div className="flex h-[70vh] overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        {/* Thread list */}
        <div
          className={`w-full shrink-0 overflow-y-auto border-r border-slate-200 dark:border-slate-700 md:w-72 ${
            activeThread ? "hidden md:block" : "block"
          }`}
        >
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : isError ? (
            <p className="p-4 text-sm text-red-500">
              Could not load your messages. Please make sure you are signed in.
            </p>
          ) : threads.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">No conversations yet.</p>
              <p className="mt-1 text-xs text-slate-400">
                You can start a conversation from a talent's profile, or when an invitation is accepted.
              </p>
            </div>
          ) : (
            threads.map((t) => (
              <button
                key={t.id}
                onClick={() => navigate(`/messages/${t.id}`)}
                className={`block w-full border-b border-slate-100 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800 ${
                  t.id === activeThreadId ? "bg-indigo-50/60 dark:bg-indigo-950/20" : ""
                }`}
                data-testid={`thread-item-${t.id}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                    {nameOf(t)}
                  </p>
                  <span className="shrink-0 text-[10px] text-slate-400">
                    {formatTime(t.lastMessageAt)}
                  </span>
                </div>
                {t.subject && (
                  <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                    {t.subject}
                  </p>
                )}
              </button>
            ))
          )}
        </div>

        {/* Active thread */}
        <div className={`flex-1 ${activeThread ? "block" : "hidden md:block"}`}>
          {activeThread ? (
            <ThreadView
              thread={activeThread}
              meId={meId}
              otherName={nameOf(activeThread)}
              onBack={() => navigate("/messages")}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-slate-400">Select a conversation</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
