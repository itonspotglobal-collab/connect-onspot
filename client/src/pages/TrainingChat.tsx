import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Send, Sparkles, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Message = {
  role: "user" | "assistant";
  content: string;
  isCorrection?: boolean;
  topic?: string;
};

export default function TrainingChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streamedResponse, setStreamedResponse] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamedResponse]);

  const sendMessage = useMutation({
    mutationFn: async (userMessage: string) => {
      // Add user message immediately
      const userMsg: Message = { role: "user", content: userMessage };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");

      // Create abort controller for this request
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        setIsStreaming(true);
        setStreamedResponse("");

        const response = await fetch("/api/train/chat/stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ message: userMessage }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || `HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullResponse = "";

        if (!reader) {
          throw new Error("No reader available");
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") {
                break;
              }
              try {
                const parsed = JSON.parse(data);
                if (parsed.text) {
                  fullResponse += parsed.text;
                  setStreamedResponse(fullResponse);
                }
              } catch (e) {
                console.error("Error parsing SSE:", e);
              }
            }
          }
        }

        // Add complete AI response to messages
        const aiMsg: Message = { role: "assistant", content: fullResponse };
        setMessages((prev) => [...prev, aiMsg]);
        setStreamedResponse("");
        setIsStreaming(false);
      } catch (error: any) {
        if (error.name === "AbortError") {
          console.log("Request aborted");
        } else {
          console.error("Error streaming response:", error);
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: "Sorry, I encountered an error. Please try again.",
            },
          ]);
        }
        setStreamedResponse("");
        setIsStreaming(false);
      } finally {
        abortControllerRef.current = null;
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sendMessage.isPending || isStreaming) return;
    sendMessage.mutate(input.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b bg-background">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Train Vanessa</h2>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Conversational training interface for administrators only
        </p>
      </div>

      <Alert className="mx-4 mt-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Training mode: Your corrections will be automatically detected and saved to Vanessa's memory.
          Use phrases like "actually", "the correct answer is", or "you should" to correct Vanessa.
        </AlertDescription>
      </Alert>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Start Training</p>
            <p className="text-sm">
              Ask questions, provide corrections, or teach Vanessa new information.
            </p>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <Card
              className={`max-w-[80%] p-4 ${
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : message.isCorrection
                  ? "bg-accent border-accent-border"
                  : "bg-card"
              }`}
            >
              <div className="flex items-start gap-2">
                {message.role === "assistant" && (
                  <Sparkles className="w-4 h-4 mt-1 flex-shrink-0" />
                )}
                <div className="flex-1 whitespace-pre-wrap break-words">
                  {message.content}
                </div>
              </div>
              {message.isCorrection && message.topic && (
                <div className="mt-2 pt-2 border-t border-accent-border text-xs opacity-70">
                  Correction saved: {message.topic}
                </div>
              )}
            </Card>
          </div>
        ))}

        {streamedResponse && (
          <div className="flex justify-start">
            <Card className="max-w-[80%] p-4 bg-card">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 mt-1 flex-shrink-0" />
                <div className="flex-1 whitespace-pre-wrap break-words">
                  {streamedResponse}
                  <span className="inline-block w-2 h-4 bg-foreground/50 ml-1 animate-pulse" />
                </div>
              </div>
            </Card>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t bg-background">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Train Vanessa... (Press Enter to send, Shift+Enter for new line)"
            className="resize-none min-h-[60px]"
            disabled={sendMessage.isPending || isStreaming}
            data-testid="input-training-message"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || sendMessage.isPending || isStreaming}
            className="flex-shrink-0"
            data-testid="button-send-training"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
