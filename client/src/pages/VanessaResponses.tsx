import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, MessageCircle, User, Bot } from "lucide-react";
import { format } from "date-fns";

interface VanessaLog {
  id: number;
  threadId: string;
  userMessage: string;
  assistantResponse: string;
  createdAt: string;
}

interface ThreadSummary {
  threadId: string;
  firstMessage: string;
  lastMessage: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function VanessaResponses() {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch all conversation threads
  const { data: threadsData, isLoading: threadsLoading } = useQuery<{
    success: boolean;
    threads: ThreadSummary[];
  }>({
    queryKey: ["/api/vanessa/responses"],
  });

  // Fetch messages for selected thread
  const { data: messagesData, isLoading: messagesLoading } = useQuery<{
    success: boolean;
    messages: VanessaLog[];
  }>({
    queryKey: ["/api/vanessa/responses", selectedThreadId],
    enabled: !!selectedThreadId,
  });

  // Search conversations
  const { data: searchData, isLoading: searchLoading } = useQuery<{
    success: boolean;
    results: VanessaLog[];
  }>({
    queryKey: ["/api/vanessa/search", searchQuery],
    enabled: searchQuery.length > 2,
  });

  const threads = threadsData?.threads || [];
  const messages = messagesData?.messages || [];
  const searchResults = searchData?.results || [];

  // Filter threads by search query
  const filteredThreads = searchQuery.length > 2
    ? threads.filter(thread =>
        thread.firstMessage.toLowerCase().includes(searchQuery.toLowerCase()) ||
        thread.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : threads;

  // Auto-select first thread if none selected
  if (!selectedThreadId && threads.length > 0) {
    setSelectedThreadId(threads[0].threadId);
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Left Sidebar - Thread List */}
      <div className="w-80 border-r border-border flex flex-col bg-card">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <h1 className="text-lg font-semibold mb-3" data-testid="text-page-title">
            Vanessa Conversations
          </h1>
          
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-conversations"
            />
          </div>
        </div>

        {/* Thread List */}
        <div className="flex-1 overflow-y-auto">
          {threadsLoading ? (
            <div className="p-4 text-center text-muted-foreground">
              Loading conversations...
            </div>
          ) : filteredThreads.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No conversations found</p>
            </div>
          ) : (
            filteredThreads.map((thread) => (
              <button
                key={thread.threadId}
                onClick={() => setSelectedThreadId(thread.threadId)}
                className={`w-full text-left p-4 border-b border-border hover-elevate transition-colors ${
                  selectedThreadId === thread.threadId
                    ? "bg-accent"
                    : "bg-card"
                }`}
                data-testid={`button-thread-${thread.threadId}`}
              >
                <div className="flex items-start gap-3">
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate mb-1">
                      {thread.firstMessage.substring(0, 50)}
                      {thread.firstMessage.length > 50 ? "..." : ""}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {thread.lastMessage.substring(0, 60)}
                      {thread.lastMessage.length > 60 ? "..." : ""}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {thread.messageCount} {thread.messageCount === 1 ? "message" : "messages"}
                      </span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(thread.updatedAt), "MMM d, h:mm a")}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Panel - Chat Messages */}
      <div className="flex-1 flex flex-col bg-background">
        {selectedThreadId ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-border bg-card">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-primary" />
                <h2 className="font-semibold" data-testid="text-thread-title">
                  Thread: {selectedThreadId.substring(0, 20)}...
                </h2>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {messagesLoading ? (
                <div className="text-center text-muted-foreground">
                  Loading messages...
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-muted-foreground">
                  No messages in this conversation
                </div>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className="space-y-4">
                    {/* User Message */}
                    <div className="flex items-start gap-3" data-testid={`message-user-${message.id}`}>
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback className="bg-muted">
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">User</span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(message.createdAt), "MMM d, yyyy • h:mm a")}
                          </span>
                        </div>
                        <Card className="p-4 bg-muted">
                          <p className="text-sm whitespace-pre-wrap">{message.userMessage}</p>
                        </Card>
                      </div>
                    </div>

                    {/* Assistant Response */}
                    <div className="flex items-start gap-3" data-testid={`message-assistant-${message.id}`}>
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          <Bot className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">Vanessa</span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(message.createdAt), "MMM d, yyyy • h:mm a")}
                          </span>
                        </div>
                        <Card className="p-4 bg-card">
                          <p className="text-sm whitespace-pre-wrap">{message.assistantResponse}</p>
                        </Card>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">Select a conversation</p>
              <p className="text-sm">Choose a thread from the sidebar to view messages</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
