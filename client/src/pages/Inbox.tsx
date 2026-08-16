import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { TopNavigation } from "@/components/TopNavigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageSquare,
  Send,
  ArrowLeft,
  InboxIcon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface MessageThread {
  id: string;
  jobId: string | null;
  participants: string[];
  subject: string | null;
  lastMessageAt: string | null;
  createdAt: string | null;
}

interface Message {
  id: string;
  threadId: string;
  senderId: string;
  content: string;
  readBy: string[] | null;
  createdAt: string | null;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function Inbox() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [mobileView, setMobileView] = useState<"list" | "thread">("list");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      const role = window.localStorage.getItem("talent_profile_token") ? "talent" : "client";
      navigate(`/portal-login?portal=${role}&returnTo=/inbox`);
    }
  }, [authLoading, isAuthenticated, navigate]);

  const userId = user?.id;

  // Thread list
  const { data: threads = [], isLoading: threadsLoading } = useQuery<MessageThread[]>({
    queryKey: ["message-threads", userId],
    queryFn: async () => {
      if (!userId) return [];
      const res = await apiRequest("GET", `/api/users/${userId}/message-threads`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!userId,
    refetchInterval: 10_000,
  });

  // Messages for selected thread
  const { data: messages = [], isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ["messages", selectedThreadId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/message-threads/${selectedThreadId}/messages`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedThreadId,
    refetchInterval: 5_000,
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Mark as read when thread becomes active
  useEffect(() => {
    if (!selectedThreadId || !userId) return;
    apiRequest("POST", `/api/message-threads/${selectedThreadId}/mark-read`, {}).catch(() => {});
    qc.invalidateQueries({ queryKey: ["message-threads", userId] });
  }, [selectedThreadId, messages.length]);

  const selectedThread = threads.find((t) => t.id === selectedThreadId) ?? null;

  const unreadCount = (thread: MessageThread): number => {
    if (!messages.length || thread.id !== selectedThreadId) return 0;
    return messages.filter((m) => !m.readBy?.includes(userId ?? "")).length;
  };

  const globalUnread = threads.reduce((acc, t) => {
    // rough indicator — we don't have per-thread unread until messages are loaded
    return acc;
  }, 0);

  // Send message
  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", "/api/messages", {
        threadId: selectedThreadId,
        content,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error ?? "Failed to send message");
      }
      return res.json();
    },
    onSuccess: () => {
      setMessageText("");
      qc.invalidateQueries({ queryKey: ["messages", selectedThreadId] });
      qc.invalidateQueries({ queryKey: ["message-threads", userId] });
      textareaRef.current?.focus();
    },
    onError: (err: Error) => {
      toast({ title: "Could not send message", description: err.message, variant: "destructive" });
    },
  });

  const handleSend = () => {
    const text = messageText.trim();
    if (!text || !selectedThreadId) return;
    sendMutation.mutate(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const selectThread = (threadId: string) => {
    setSelectedThreadId(threadId);
    setMobileView("thread");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center">
        <div className="text-slate-400">Loading…</div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-[#0a0a1a] flex flex-col">
      <TopNavigation />

      {/* Page header */}
      <div className="border-b border-slate-800 bg-[#0d0d22] px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <MessageSquare className="h-5 w-5 text-indigo-400" />
          <h1 className="text-lg font-semibold text-white">Messages</h1>
          {threads.length > 0 && (
            <Badge variant="secondary" className="bg-indigo-900/50 text-indigo-300 text-xs">
              {threads.length} conversation{threads.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex-1 max-w-6xl mx-auto w-full flex min-h-0">
        {/* ── Thread list (left panel / mobile full) ───────────────────── */}
        <div
          className={cn(
            "w-full sm:w-80 lg:w-96 border-r border-slate-800 flex flex-col flex-shrink-0",
            mobileView === "thread" && "hidden sm:flex",
          )}
        >
          <div className="p-3 border-b border-slate-800">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Conversations</p>
          </div>

          {threadsLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full bg-slate-800" />
              ))}
            </div>
          ) : threads.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <InboxIcon className="h-10 w-10 text-slate-700 mb-3" />
              <p className="text-slate-400 text-sm font-medium">No conversations yet</p>
              <p className="text-slate-600 text-xs mt-1">
                Conversations appear here when a client invitation is accepted.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {threads.map((thread) => {
                const isActive = thread.id === selectedThreadId;
                const label = thread.subject ?? "Conversation";
                return (
                  <button
                    key={thread.id}
                    onClick={() => selectThread(thread.id)}
                    className={cn(
                      "w-full text-left px-4 py-3 border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors",
                      isActive && "bg-indigo-950/50 border-l-2 border-l-indigo-500",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold",
                            isActive
                              ? "bg-indigo-600 text-white"
                              : "bg-slate-700 text-slate-300",
                          )}
                        >
                          {label.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-200 truncate">{label}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {thread.participants.length} participants
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-slate-600 flex-shrink-0 mt-0.5">
                        {timeAgo(thread.lastMessageAt)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Conversation panel (right / mobile full) ─────────────────── */}
        <div
          className={cn(
            "flex-1 flex flex-col min-h-0",
            mobileView === "list" && "hidden sm:flex",
          )}
        >
          {!selectedThreadId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <MessageSquare className="h-12 w-12 text-slate-700 mb-4" />
              <p className="text-slate-400 font-medium">Select a conversation</p>
              <p className="text-slate-600 text-sm mt-1">Choose a thread from the list to view messages</p>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="px-4 py-3 border-b border-slate-800 bg-[#0d0d22] flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="sm:hidden text-slate-400 hover:text-white p-1"
                  onClick={() => setMobileView("list")}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {selectedThread?.subject ?? "Conversation"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {selectedThread?.participants.length ?? 0} participants
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messagesLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className={cn("h-12 w-2/3 bg-slate-800", i % 2 === 1 && "ml-auto")} />
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <MessageSquare className="h-8 w-8 text-slate-700 mb-3" />
                    <p className="text-slate-500 text-sm">No messages yet — say hello!</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMine = msg.senderId === userId;
                    return (
                      <div
                        key={msg.id}
                        className={cn("flex", isMine ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={cn(
                            "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
                            isMine
                              ? "bg-indigo-600 text-white rounded-br-sm"
                              : "bg-slate-800 text-slate-200 rounded-bl-sm",
                          )}
                        >
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          <p
                            className={cn(
                              "text-[10px] mt-1",
                              isMine ? "text-indigo-300" : "text-slate-500",
                            )}
                          >
                            {isMine ? "You" : "Other party"} · {formatTime(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              {/* Compose box */}
              <div className="border-t border-slate-800 p-3 bg-[#0d0d22]">
                <div className="flex gap-2 items-end">
                  <Textarea
                    ref={textareaRef}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
                    className="flex-1 bg-slate-900 border-slate-700 text-slate-200 placeholder-slate-600 resize-none min-h-[44px] max-h-32 text-sm focus:border-indigo-500 focus:ring-indigo-500/20"
                    rows={1}
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!messageText.trim() || sendMutation.isPending}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white flex-shrink-0 h-11 w-11 p-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-[10px] text-slate-700 mt-1.5 px-1">
                  Do not share personal contact details (email, phone) in messages.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
