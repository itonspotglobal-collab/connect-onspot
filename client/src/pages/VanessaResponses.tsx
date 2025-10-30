import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Search, MessageCircle, User, Bot, ThumbsUp, ThumbsDown, Edit, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import TrainingChat from "./TrainingChat";

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
  const [trainingDialogOpen, setTrainingDialogOpen] = useState(false);
  const [feedbackDialog, setFeedbackDialog] = useState<{
    open: boolean;
    messageId: number;
    threadId: string;
    rating: "up" | "down";
  } | null>(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [correctionDialog, setCorrectionDialog] = useState<{
    open: boolean;
    logId: number;
  } | null>(null);
  const [correctionText, setCorrectionText] = useState("");
  const { toast } = useToast();

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

  const threads = threadsData?.threads || [];
  const messages = messagesData?.messages || [];

  // Client-side search filtering
  const filteredThreads = searchQuery.length > 0
    ? threads.filter(thread =>
        thread.firstMessage.toLowerCase().includes(searchQuery.toLowerCase()) ||
        thread.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : threads;

  // Feedback submission mutation
  const feedbackMutation = useMutation({
    mutationFn: async (data: { messageId: string; threadId: string; rating: "up" | "down"; comment?: string }) =>
      apiRequest("POST", "/api/feedback", data),
    onSuccess: () => {
      toast({
        title: "Feedback submitted",
        description: "Thank you for helping Vanessa improve!",
      });
      setFeedbackDialog(null);
      setFeedbackComment("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: (error as Error).message || "Failed to submit feedback",
        variant: "destructive",
      });
    },
  });

  // Correction submission mutation
  const correctionMutation = useMutation({
    mutationFn: async (data: { logId: number; correctedText: string }) =>
      apiRequest("POST", "/api/train/correct", data),
    onSuccess: () => {
      toast({
        title: "Correction submitted!",
        description: "Vanessa will remember this for next time.",
      });
      setCorrectionDialog(null);
      setCorrectionText("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: (error as Error).message || "Failed to submit correction",
        variant: "destructive",
      });
    },
  });

  // Handle feedback button click
  const handleFeedback = (messageId: number, threadId: string, rating: "up" | "down") => {
    // For positive feedback, submit immediately
    if (rating === "up") {
      feedbackMutation.mutate({
        messageId: String(messageId),
        threadId,
        rating,
      });
    } else {
      // For negative feedback, open dialog for optional comment
      setFeedbackDialog({
        open: true,
        messageId,
        threadId,
        rating,
      });
    }
  };

  // Submit feedback with comment
  const submitFeedbackWithComment = () => {
    if (feedbackDialog) {
      feedbackMutation.mutate({
        messageId: String(feedbackDialog.messageId),
        threadId: feedbackDialog.threadId,
        rating: feedbackDialog.rating,
        comment: feedbackComment.trim() || undefined,
      });
    }
  };

  // Handle correction button click
  const handleCorrection = (logId: number) => {
    setCorrectionDialog({
      open: true,
      logId,
    });
  };

  // Submit correction
  const submitCorrection = () => {
    if (correctionDialog && correctionText.trim()) {
      correctionMutation.mutate({
        logId: correctionDialog.logId,
        correctedText: correctionText.trim(),
      });
    }
  };

  // Auto-select first thread when threads load
  useEffect(() => {
    if (!selectedThreadId && threads.length > 0) {
      setSelectedThreadId(threads[0].threadId);
    }
  }, [threads, selectedThreadId]);

  return (
    <div className="flex h-screen bg-background">
      {/* Left Sidebar - Thread List */}
      <div className="w-80 border-r border-border flex flex-col bg-card">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-semibold" data-testid="text-page-title">
              Vanessa Conversations
            </h1>
            <Button
              onClick={() => setTrainingDialogOpen(true)}
              size="sm"
              className="gap-2"
              data-testid="button-train-vanessa"
            >
              <Sparkles className="w-4 h-4" />
              Train Vanessa
            </Button>
          </div>
          
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
                          <p className="text-sm whitespace-pre-wrap mb-3">{message.assistantResponse}</p>
                          
                          {/* Feedback and Correction Buttons */}
                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground mr-2">Was this helpful?</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleFeedback(message.id, message.threadId, "up")}
                                disabled={feedbackMutation.isPending}
                                className="h-7"
                                data-testid={`button-feedback-up-${message.id}`}
                              >
                                <ThumbsUp className="h-3 w-3 mr-1" />
                                <span className="text-xs">Yes</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleFeedback(message.id, message.threadId, "down")}
                                disabled={feedbackMutation.isPending}
                                className="h-7"
                                data-testid={`button-feedback-down-${message.id}`}
                              >
                                <ThumbsDown className="h-3 w-3 mr-1" />
                                <span className="text-xs">No</span>
                              </Button>
                            </div>
                            
                            {/* Admin Correction Button */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCorrection(message.id)}
                              disabled={correctionMutation.isPending}
                              className="h-7"
                              data-testid={`button-correct-${message.id}`}
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              <span className="text-xs">Correct Response</span>
                            </Button>
                          </div>
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

      {/* Feedback Comment Dialog */}
      <Dialog open={feedbackDialog?.open || false} onOpenChange={(open) => {
        if (!open) {
          setFeedbackDialog(null);
          setFeedbackComment("");
        }
      }}>
        <DialogContent data-testid="dialog-feedback-comment">
          <DialogHeader>
            <DialogTitle>Help Us Improve</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-3">
              What could Vanessa do better? Your feedback helps improve future responses.
            </p>
            <Textarea
              placeholder="Optional: Share your thoughts..."
              value={feedbackComment}
              onChange={(e) => setFeedbackComment(e.target.value)}
              className="min-h-24"
              data-testid="textarea-feedback-comment"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setFeedbackDialog(null);
                setFeedbackComment("");
              }}
              data-testid="button-cancel-feedback"
            >
              Cancel
            </Button>
            <Button
              onClick={submitFeedbackWithComment}
              disabled={feedbackMutation.isPending}
              data-testid="button-submit-feedback"
            >
              {feedbackMutation.isPending ? "Submitting..." : "Submit Feedback"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Correction Dialog */}
      <Dialog open={correctionDialog?.open || false} onOpenChange={(open) => {
        if (!open) {
          setCorrectionDialog(null);
          setCorrectionText("");
        }
      }}>
        <DialogContent data-testid="dialog-correction">
          <DialogHeader>
            <DialogTitle>Correct Vanessa's Response</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-3">
              Provide the correct response. Vanessa will learn from this and remember it for future interactions.
            </p>
            <Textarea
              placeholder="Enter the correct response..."
              value={correctionText}
              onChange={(e) => setCorrectionText(e.target.value)}
              className="min-h-32"
              data-testid="textarea-correction"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCorrectionDialog(null);
                setCorrectionText("");
              }}
              data-testid="button-cancel-correction"
            >
              Cancel
            </Button>
            <Button
              onClick={submitCorrection}
              disabled={correctionMutation.isPending || !correctionText.trim()}
              data-testid="button-submit-correction"
            >
              {correctionMutation.isPending ? "Submitting..." : "Submit Correction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Training Dialog - Full Screen */}
      <Dialog open={trainingDialogOpen} onOpenChange={setTrainingDialogOpen}>
        <DialogContent 
          className="max-w-4xl h-[80vh] p-0 gap-0" 
          data-testid="dialog-training"
        >
          <TrainingChat />
        </DialogContent>
      </Dialog>
    </div>
  );
}
