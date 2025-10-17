import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X, Sparkles, MessageCircle, Send, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { useVanessa } from "@/contexts/VanessaContext";
import type { Message } from "@/contexts/VanessaContext";
import vanessaPhoto from "@assets/Vanessa_1760674530978.png";

interface VanessaChatProps {
  isOpen: boolean;
  onClose: () => void;
  isSticky?: boolean;
}

export function VanessaChat({
  isOpen,
  onClose,
  isSticky = false,
}: VanessaChatProps) {
  // Use shared conversation state from context
  const {
    messages,
    setMessages,
    currentMessageIndex,
    setCurrentMessageIndex,
    showOptions,
    setShowOptions,
    selectedTopic,
    setSelectedTopic,
    isMinimized,
    setIsMinimized,
    resetConversation,
  } = useVanessa();

  // Local state for input and streaming
  const [userInput, setUserInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [userHasTyped, setUserHasTyped] = useState(false);
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);
  const [showNewMessageChip, setShowNewMessageChip] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const scrollAnimationFrameRef = useRef<number | null>(null);
  const lastScrollTopRef = useRef(0);
  const hasInitializedRef = useRef(false);
  const footerRef = useRef<HTMLDivElement>(null);
  const [footerHeight, setFooterHeight] = useState(0);

  const openingMessages = useRef([
    {
      id: 1,
      text: "Hi there! I'm Vanessa, your OnSpot Virtual Assistant.",
      sender: "vanessa" as const,
    },
    {
      id: 2,
      text: "I'm currently in training — learning from the decades of experience of our founders, managers, clients, and thousands of professionals in the OnSpot network.",
      sender: "vanessa" as const,
    },
    {
      id: 3,
      text: "For now, I can help you get started with Outsourcing through OnSpot.\nWould you like to explore how it works?",
      sender: "vanessa" as const,
    },
  ]).current;

  const faqResponses: Record<string, string[]> = {
    "how-it-works": [
      "Great question! OnSpot connects you with pre-vetted Filipino talent through a unique AI-first approach.",
      "Here's how it works:\n\n1. Tell us your needs\n2. Our AI matches you with top candidates\n3. Human experts verify the match\n4. Start working within 48 hours",
      "The best part? You only pay for productive work, with built-in quality assurance and performance tracking.",
    ],
    pricing: [
      "Our pricing is simple and transparent:",
      "Hourly Rate: $8-25/hour (depending on skill level)\nMonthly Retainer: Custom packages available\nPerformance-based: Pay only for verified productive hours",
      "All pricing includes:\n• AI-powered time tracking\n• Quality assurance\n• Dedicated account manager\n• Replacement guarantee",
    ],
    "ai-human": [
      "This is where OnSpot truly shines! We combine the best of both worlds:",
      "AI handles: Talent matching, time tracking, performance analytics, workflow optimization",
      "Humans handle: Complex decisions, relationship building, quality oversight, strategic guidance",
      "Result? 40% faster hiring, 30% cost savings, and 95% client satisfaction. AI does the heavy lifting, humans ensure excellence.",
    ],
    "talk-human": [
      "Perfect! I'd love to connect you with one of our expert managers.",
      "They can provide:\n• Custom solution design\n• ROI analysis for your use case\n• Live talent preview\n• Onboarding timeline",
    ],
  };

  // Prevent body scroll when popup is open
  useEffect(() => {
    if (isOpen && !isSticky) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isOpen, isSticky]);

  // Handle iOS keyboard with visualViewport and recompute scroll on resize
  useEffect(() => {
    if (!isOpen || isSticky) return;

    const updateViewportHeight = () => {
      if (window.visualViewport) {
        const vh = window.visualViewport.height;
        document.documentElement.style.setProperty(
          "--viewport-height",
          `${vh}px`,
        );
      } else {
        document.documentElement.style.setProperty(
          "--viewport-height",
          `${window.innerHeight}px`,
        );
      }
      // Recompute pinned state on resize
      if (checkIfNearBottom() && isPinnedToBottom) {
        scrollToBottom(false);
      }
    };

    updateViewportHeight();
    window.visualViewport?.addEventListener("resize", updateViewportHeight);
    window.addEventListener("resize", updateViewportHeight);

    return () => {
      window.visualViewport?.removeEventListener(
        "resize",
        updateViewportHeight,
      );
      window.removeEventListener("resize", updateViewportHeight);
      document.documentElement.style.removeProperty("--viewport-height");
    };
  }, [isOpen, isSticky, isPinnedToBottom]);

  // Track footer height for body padding
  useEffect(() => {
    const footer = footerRef.current;
    if (!footer) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setFooterHeight(entry.contentRect.height);
      }
    });

    resizeObserver.observe(footer);
    return () => resizeObserver.disconnect();
  }, [isOpen]);

  // Attach scroll listener to messages container
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    container.addEventListener("scroll", handleScroll);
    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [isStreaming]);

  // ResizeObserver to detect choices/input height changes
  useEffect(() => {
    if (!isOpen) return;

    const resizeObserver = new ResizeObserver(() => {
      if (isPinnedToBottom) {
        scrollToBottom(false);
      }
    });

    // Observe the footer area (input + choices)
    const container = messagesContainerRef.current?.parentElement;
    if (container) {
      const footer = container.querySelector("[data-footer-area]");
      if (footer) {
        resizeObserver.observe(footer as Element);
      }
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [isOpen, isPinnedToBottom]);

  // Start message sequence when chat opens - only initialize if conversation is empty
  useEffect(() => {
    if (!isOpen) {
      hasInitializedRef.current = false;
      return;
    }

    // Prevent running multiple times when chat is already open
    if (hasInitializedRef.current) {
      return;
    }

    hasInitializedRef.current = true;

    // Only initialize if conversation is empty (first time opening)
    if (messages.length === 0) {
      setCurrentMessageIndex(0);
      setShowOptions(false);
      setSelectedTopic(null);

      const timer = setTimeout(() => {
        // Trigger first message
        const firstMessage = openingMessages[0];
        setMessages([{ ...firstMessage, isTyping: true }]);

        setTimeout(() => {
          setMessages([{ ...firstMessage, isTyping: false }]);
          setCurrentMessageIndex(1);
        }, 1200);
      }, 300);

      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Display subsequent messages sequentially with typing animation
  useEffect(() => {
    if (
      !isOpen ||
      currentMessageIndex === 0 ||
      currentMessageIndex >= openingMessages.length
    ) {
      // Show options after last opening message
      if (currentMessageIndex === openingMessages.length && !showOptions) {
        setTimeout(() => setShowOptions(true), 500);
      }
      return;
    }

    const timer = setTimeout(() => {
      const newMessage = openingMessages[currentMessageIndex];

      // Show typing indicator first
      setMessages((prev) => [...prev, { ...newMessage, isTyping: true }]);

      // Replace typing indicator with actual message after delay
      setTimeout(
        () => {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { ...newMessage, isTyping: false };
            return updated;
          });
          setCurrentMessageIndex((prev) => prev + 1);
        },
        1000 + Math.random() * 500,
      );
    }, 1500);

    return () => clearTimeout(timer);
  }, [currentMessageIndex, isOpen, showOptions]);

  const handleTopicSelect = (topic: string) => {
    setSelectedTopic(topic);
    setShowOptions(false);

    // Add user message
    const userMessages: Record<string, string> = {
      "how-it-works": "How OnSpot Outsourcing Works",
      pricing: "See Pricing Models",
      "ai-human": "AI + Human Advantage",
      "talk-human": "Talk to a Human Expert",
    };

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        text: userMessages[topic],
        sender: "user",
      },
    ]);

    // Show Vanessa's responses sequentially
    const responses = faqResponses[topic];
    let responseIndex = 0;

    const showNextResponse = () => {
      if (responseIndex < responses.length) {
        // Show typing
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + responseIndex,
            text: responses[responseIndex],
            sender: "vanessa",
            isTyping: true,
          },
        ]);

        // Replace with actual message
        setTimeout(() => {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              isTyping: false,
            };
            return updated;
          });

          responseIndex++;
          if (responseIndex < responses.length) {
            setTimeout(showNextResponse, 1500);
          } else {
            // Show follow-up options after last response
            setTimeout(() => {
              if (topic === "talk-human") {
                setMessages((prev) => [
                  ...prev,
                  {
                    id: Date.now() + 1000,
                    text: "Would you like me to connect you with an OnSpot Manager to discuss your setup?",
                    sender: "vanessa",
                  },
                ]);
                setTimeout(() => setShowOptions(true), 800);
              } else {
                setShowOptions(true);
              }
            }, 1000);
          }
        }, 1200);
      }
    };

    setTimeout(showNextResponse, 800);
  };

  const handleBookCall = () => {
    window.open(
      "https://api.leadconnectorhq.com/widget/booking/2oCPWrG6iXVnuUGRXKBK",
    );
  };

  // Auto-scroll to bottom with batching via requestAnimationFrame
  const scrollToBottom = (smooth = true) => {
    if (scrollAnimationFrameRef.current !== null) {
      cancelAnimationFrame(scrollAnimationFrameRef.current);
    }

    scrollAnimationFrameRef.current = requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
      });
      scrollAnimationFrameRef.current = null;
    });
  };

  // Check if user is near bottom (within 100px)
  const checkIfNearBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    const threshold = 100;
    return (
      container.scrollHeight - container.scrollTop - container.clientHeight <
      threshold
    );
  };

  // Handle scroll events to track pinned state
  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const isNearBottom = checkIfNearBottom();
    const scrollingDown = container.scrollTop > lastScrollTopRef.current;
    lastScrollTopRef.current = container.scrollTop;

    if (isNearBottom) {
      setIsPinnedToBottom(true);
      setShowNewMessageChip(false);
    } else if (scrollingDown === false) {
      // User scrolled up
      setIsPinnedToBottom(false);
      if (isStreaming) {
        setShowNewMessageChip(true);
      }
    }
  };

  // Auto-scroll when new messages arrive (only if pinned)
  useEffect(() => {
    if (isPinnedToBottom) {
      scrollToBottom();
    } else if (isStreaming) {
      // Show chip if user is scrolled up during streaming
      setShowNewMessageChip(true);
    }
  }, [messages, isPinnedToBottom, isStreaming]);

  // Ensure chat scrolls when new messages are added
  useEffect(() => {
    if (messagesEndRef.current) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      });
    }
  }, [messages]);

  // Scroll to bottom and dismiss chip
  const handleScrollToBottomClick = () => {
    setIsPinnedToBottom(true);
    setShowNewMessageChip(false);
    scrollToBottom(true);
  };

  // Detect FAQ topic from user input using keyword matching
  const detectFAQTopic = (input: string): string | null => {
    const lowerInput = input.toLowerCase();

    // Keywords for each topic
    const keywords = {
      "how-it-works": [
        "how",
        "work",
        "works",
        "process",
        "step",
        "start",
        "begin",
        "onboard",
        "setup",
      ],
      pricing: [
        "price",
        "pricing",
        "cost",
        "rate",
        "hour",
        "pay",
        "payment",
        "fee",
        "charge",
        "expensive",
        "cheap",
        "affordable",
      ],
      "ai-human": [
        "ai",
        "human",
        "advantage",
        "benefit",
        "automation",
        "technology",
        "difference",
        "why",
        "better",
      ],
      "talk-human": [
        "talk",
        "speak",
        "human",
        "person",
        "expert",
        "manager",
        "call",
        "meeting",
        "schedule",
        "contact",
        "help me",
      ],
    };

    // Count keyword matches for each topic
    let maxMatches = 0;
    let bestTopic = null;

    for (const [topic, topicKeywords] of Object.entries(keywords)) {
      const matches = topicKeywords.filter((keyword) =>
        lowerInput.includes(keyword),
      ).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        bestTopic = topic;
      }
    }

    // Require at least 1 match to consider it a topic
    return maxMatches > 0 ? bestTopic : null;
  };

  // Handle sending user message
  const handleSendMessage = async () => {
    if (!userInput.trim() || isStreaming) return;

    const userMessage = userInput.trim();
    setUserInput("");
    setUserHasTyped(false);
    setShowOptions(false);

    // Add user message
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        text: userMessage,
        sender: "user",
      },
    ]);

    // Detect FAQ topic
    const detectedTopic = detectFAQTopic(userMessage);

    if (detectedTopic) {
      // User asked about a FAQ topic - provide those responses
      setSelectedTopic(detectedTopic);

      const responses = faqResponses[detectedTopic];
      let responseIndex = 0;

      const showNextResponse = async () => {
        if (responseIndex < responses.length) {
          setIsStreaming(true);

          // Show typing
          const typingMessageId = Date.now() + responseIndex;
          setMessages((prev) => [
            ...prev,
            {
              id: typingMessageId,
              text: "",
              sender: "vanessa",
              isTyping: true,
            },
          ]);

          // Simulate streaming the response
          const response = responses[responseIndex];
          const words = response.split(" ");

          for (let i = 0; i < words.length; i++) {
            await new Promise((resolve) =>
              setTimeout(resolve, 40 + Math.random() * 40),
            );

            setMessages((prev) => {
              const updated = [...prev];
              const lastMessage = updated[updated.length - 1];
              if (lastMessage.id === typingMessageId) {
                lastMessage.text = words.slice(0, i + 1).join(" ");
                lastMessage.isTyping = i < words.length - 1;
              }
              return updated;
            });
          }

          setIsStreaming(false);
          responseIndex++;

          if (responseIndex < responses.length) {
            setTimeout(showNextResponse, 1200);
          } else {
            // Show options after last response
            setTimeout(() => {
              if (detectedTopic === "talk-human") {
                setMessages((prev) => [
                  ...prev,
                  {
                    id: Date.now() + 1000,
                    text: "Would you like me to connect you with an OnSpot Manager to discuss your setup?",
                    sender: "vanessa",
                  },
                ]);
              }
              setTimeout(() => setShowOptions(true), 800);
            }, 1000);
          }
        }
      };

      setTimeout(showNextResponse, 800);
    } else {
      // No FAQ topic detected - provide general response
      setIsStreaming(true);

      const assistantMessageId = Date.now() + 1;
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          text: "",
          sender: "vanessa",
          isTyping: true,
        },
      ]);

      // Simulate streaming tokens
      const response =
        "I can help you learn about OnSpot! Try asking about our pricing, how it works, our AI-human advantage, or tap one of the quick options below to get started.";
      const words = response.split(" ");

      for (let i = 0; i < words.length; i++) {
        await new Promise((resolve) =>
          setTimeout(resolve, 50 + Math.random() * 50),
        );

        setMessages((prev) => {
          const updated = [...prev];
          const lastMessage = updated[updated.length - 1];
          if (lastMessage.id === assistantMessageId) {
            lastMessage.text = words.slice(0, i + 1).join(" ");
            lastMessage.isTyping = i < words.length - 1;
          }
          return updated;
        });
      }

      setIsStreaming(false);

      // Show options after response completes
      setTimeout(() => setShowOptions(true), 500);
    }
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUserInput(e.target.value);
    if (e.target.value.trim() && !userHasTyped) {
      setUserHasTyped(true);
      setShowOptions(false);
    } else if (!e.target.value.trim() && userHasTyped) {
      setUserHasTyped(false);
    }
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) return null;

  // Sticky chat widget mode (lower right corner) - optimized for mobile
  if (isSticky) {
    return (
      <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50 animate-in slide-in-from-bottom-4 duration-500">
        {isMinimized ? (
          // Minimized floating button with luminous gradient
          <Button
            size="icon"
            onClick={() => setIsMinimized(false)}
            className="h-14 w-14 md:h-16 md:w-16 rounded-full bg-gradient-to-r from-[#3A3AF8] to-[#7F3DF4] text-white shadow-2xl hover:shadow-[0_0_40px_rgba(58,58,248,0.6)] hover:scale-105 transition-all duration-300"
            data-testid="button-open-chat-widget"
          >
            <MessageCircle className="h-6 w-6 md:h-7 md:w-7" />
          </Button>
        ) : (
          // Expanded luminous glass chat widget - responsive sizing
          <div
            className="w-[calc(100vw-32px)] max-w-[400px] h-[calc(100vh-120px)] max-h-[600px] flex flex-col relative animate-in slide-in-from-bottom-4 duration-500 rounded-3xl overflow-hidden"
            style={{
              background:
                "linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(243, 232, 255, 0.98) 100%)",
              backdropFilter: "blur(20px)",
              boxShadow:
                "0 0 60px rgba(127, 61, 244, 0.4), 0 8px 32px rgba(0, 0, 0, 0.12), inset 0 0 0 1px rgba(127, 61, 244, 0.3)",
            }}
            data-testid="vanessa-chat-widget"
          >
            {/* Animated glow accent border */}
            <div className="absolute inset-0 rounded-3xl pointer-events-none overflow-hidden">
              <div
                className="absolute inset-0 bg-gradient-to-r from-[#3A3AF8]/30 via-[#7F3DF4]/30 to-[#3A3AF8]/30 opacity-60 animate-pulse"
                style={{
                  mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                  WebkitMask:
                    "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                  maskComposite: "exclude",
                  WebkitMaskComposite: "xor",
                  padding: "2px",
                }}
              />
            </div>

            {/* Header with glass effect - pinned */}
            <div className="flex items-center gap-3 p-3 md:p-4 border-b border-violet-200/50 backdrop-blur-sm flex-shrink-0">
              <Avatar className="vanessa-avatar">
                <AvatarImage
                  src={vanessaPhoto}
                  alt="Vanessa"
                  className="vanessa-avatar"
                />
                <AvatarFallback className="bg-gradient-to-br from-violet-400 to-blue-400 text-white font-semibold">
                  VA
                </AvatarFallback>
              </Avatar>

              <div className="flex-1">
                <h3
                  className="font-bold text-gray-900"
                  data-testid="text-vanessa-name"
                >
                  Vanessa
                </h3>
                <p className="text-xs text-gray-600">
                  OnSpot Virtual Assistant
                </p>
                <p className="text-xs font-medium bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">
                  Superhuman Assistant — In Training
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    if (window.confirm("Reset conversation? This will clear all messages.")) {
                      resetConversation();
                    }
                  }}
                  className="h-8 w-8 text-gray-600 hover:text-gray-900 hover:bg-violet-100/60"
                  data-testid="button-reset-chat"
                  title="Reset conversation"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setIsMinimized(true)}
                  className="h-8 w-8 text-gray-600 hover:text-gray-900 hover:bg-violet-100/60"
                  data-testid="button-minimize-chat"
                >
                  <span className="text-lg leading-none">−</span>
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onClose}
                  className="h-8 w-8 text-gray-600 hover:text-gray-900 hover:bg-violet-100/60"
                  data-testid="button-close-chat"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Messages with enhanced contrast - scrollable with momentum */}
            <div className="flex-1 relative min-h-0 transition-all duration-500 ease-in-out">
              <div
                ref={messagesContainerRef}
                className="absolute inset-0 overflow-y-auto"
                style={{
                  maxHeight: "calc(100% - 120px)", // ensures messages can push the input up
                  WebkitOverflowScrolling: "touch",
                  overscrollBehavior: "contain",
                }}
                data-testid="chat-messages"
              >
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
                        message.sender === "user"
                          ? "bg-gradient-to-r from-[#3A3AF8] to-[#7F3DF4] text-white"
                          : "bg-white/80 text-gray-900 backdrop-blur-sm border border-violet-200/40"
                      }`}
                      data-testid={`message-${message.sender}-${message.id}`}
                    >
                      {message.isTyping ? (
                        <div
                          className="flex gap-1 py-1"
                          data-testid="typing-indicator"
                        >
                          <div
                            className="w-2 h-2 bg-violet-400 rounded-full animate-bounce"
                            style={{ animationDelay: "0ms" }}
                          />
                          <div
                            className="w-2 h-2 bg-violet-400 rounded-full animate-bounce"
                            style={{ animationDelay: "150ms" }}
                          />
                          <div
                            className="w-2 h-2 bg-violet-400 rounded-full animate-bounce"
                            style={{ animationDelay: "300ms" }}
                          />
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-line leading-relaxed">
                          {message.text}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* New messages chip - appears when user scrolls up during streaming */}
              {showNewMessageChip && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 animate-in slide-in-from-bottom-2 duration-300">
                  <Button
                    onClick={handleScrollToBottomClick}
                    size="sm"
                    className="bg-gradient-to-r from-[#3A3AF8] to-[#7F3DF4] text-white shadow-lg hover:shadow-xl transition-all"
                    data-testid="button-new-messages"
                  >
                    New messages ↓
                  </Button>
                </div>
              )}
            </div>

            {/* Footer area (input + choices) - tracked by ResizeObserver */}
            <div data-footer-area>
              {/* Sticky Input Bar - always visible */}
              <div
                className="border-t border-violet-200/50 backdrop-blur-sm flex-shrink-0"
                style={{
                  padding: "clamp(10px, 2vw, 16px)",
                  paddingBottom:
                    "max(12px, calc(10px + env(safe-area-inset-bottom)))",
                }}
              >
                <div className="flex gap-2 items-end">
                  <Textarea
                    value={userInput}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    className="flex-1 min-h-[40px] max-h-[120px] resize-none text-sm border-violet-300 focus:border-violet-500"
                    data-testid="input-message"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!userInput.trim() || isStreaming}
                    size="icon"
                    className="h-10 w-10 bg-gradient-to-r from-[#3A3AF8] to-[#7F3DF4] text-white disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all"
                    data-testid="button-send-message"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Interactive Options with glass buttons - sticky footer with safe area */}
              {showOptions && !userHasTyped && (
                <div
                  className="border-t border-violet-200/50 space-y-2 animate-in slide-in-from-bottom-2 duration-300 backdrop-blur-sm flex-shrink-0"
                  style={{
                    position: "sticky",
                    bottom: 0,
                    paddingTop: "12px",
                    paddingLeft: "16px",
                    paddingRight: "16px",
                    paddingBottom:
                      "max(16px, calc(12px + env(safe-area-inset-bottom)))",
                  }}
                >
                  {selectedTopic === "talk-human" ? (
                    <div className="flex gap-2">
                      <Button
                        onClick={handleBookCall}
                        className="flex-1 bg-gradient-to-r from-[#3A3AF8] to-[#7F3DF4] text-white hover:shadow-lg hover:scale-[1.02] transition-all duration-300"
                        data-testid="button-book-call"
                      >
                        Book a Call
                      </Button>
                      <Button
                        onClick={() => {
                          setSelectedTopic(null);
                          setShowOptions(true);
                        }}
                        variant="outline"
                        className="flex-1 border-violet-300 text-gray-700 hover:bg-violet-50 hover:border-violet-400"
                        data-testid="button-keep-exploring"
                      >
                        Keep Exploring
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Button
                        onClick={() => handleTopicSelect("how-it-works")}
                        variant="outline"
                        className="w-full justify-start text-left border-violet-300 text-gray-700 hover:bg-violet-50 hover:border-violet-400"
                        data-testid="button-how-it-works"
                      >
                        How OnSpot Outsourcing Works
                      </Button>
                      <Button
                        onClick={() => handleTopicSelect("pricing")}
                        variant="outline"
                        className="w-full justify-start text-left border-violet-300 text-gray-700 hover:bg-violet-50 hover:border-violet-400"
                        data-testid="button-pricing"
                      >
                        See Pricing Models
                      </Button>
                      <Button
                        onClick={() => handleTopicSelect("ai-human")}
                        variant="outline"
                        className="w-full justify-start text-left border-violet-300 text-gray-700 hover:bg-violet-50 hover:border-violet-400"
                        data-testid="button-ai-human"
                      >
                        AI + Human Advantage
                      </Button>
                      <Button
                        onClick={() => handleTopicSelect("talk-human")}
                        variant="outline"
                        className="w-full justify-start text-left border-violet-300 text-gray-700 hover:bg-violet-50 hover:border-violet-400"
                        data-testid="button-talk-human"
                      >
                        Talk to a Human Expert
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Luminous sparkle effects */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
              <Sparkles className="absolute top-4 right-4 h-5 w-5 text-violet-500 opacity-70 animate-pulse" />
              <Sparkles
                className="absolute bottom-20 left-6 h-4 w-4 text-blue-500 opacity-50 animate-pulse"
                style={{ animationDelay: "1s" }}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full-screen luminous glass modal mode - vertically balanced with viewport-aware height
  return (
    <div
      className="fixed inset-0 z-50 flex animate-in fade-in duration-300"
      style={{
        background:
          "radial-gradient(ellipse at center, rgba(127, 61, 244, 0.15) 0%, rgba(58, 58, 248, 0.1) 50%, rgba(0, 0, 0, 0.3) 100%)",
        backdropFilter: "blur(12px)",
        paddingInline: "clamp(12px, 4vw, 48px)",
        paddingBlock: "clamp(20px, 5vh, 48px)",
        ["--gutter" as string]: "clamp(12px, 4vw, 48px)",
        ["--vgutter" as string]: "clamp(20px, 5vh, 48px)",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        className="flex flex-col relative animate-in slide-in-from-bottom-4 duration-500 max-[360px]:!rounded-t-3xl max-[360px]:!rounded-b-none max-[360px]:self-end"
        style={{
          background:
            "linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(243, 232, 255, 0.98) 100%)",
          backdropFilter: "blur(20px)",
          boxShadow:
            "0 0 60px rgba(127, 61, 244, 0.4), 0 8px 32px rgba(0, 0, 0, 0.12), inset 0 0 0 1px rgba(127, 61, 244, 0.3)",
          width: "min(720px, calc(100vw - 2 * var(--gutter)))",
          maxHeight:
            "min(calc(var(--viewport-height, 100dvh) - 2 * var(--vgutter)), calc(100svh - 2 * var(--vgutter)))",
          borderRadius: "clamp(16px, 2vw, 24px)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
        data-testid="vanessa-chat-window"
      >
        {/* Animated glow accent border */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            borderRadius: "clamp(16px, 2vw, 24px)",
            overflow: "hidden",
          }}
        >
          <div
            className="absolute inset-0 bg-gradient-to-r from-[#3A3AF8]/30 via-[#7F3DF4]/30 to-[#3A3AF8]/30 opacity-60 animate-pulse"
            style={{
              mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              WebkitMask:
                "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              maskComposite: "exclude",
              WebkitMaskComposite: "xor",
              padding: "2px",
            }}
          />
        </div>

        {/* Header with glass effect - pinned */}
        <div
          className="flex items-center gap-3 border-b border-violet-200/50 backdrop-blur-sm flex-shrink-0"
          style={{
            padding: "clamp(12px, 3vw, 20px)",
          }}
        >
          <Avatar className="vanessa-avatar" data-testid="avatar-vanessa">
            <AvatarImage
              src={vanessaPhoto}
              alt="Vanessa"
              className="vanessa-avatar"
            />
            <AvatarFallback className="bg-gradient-to-br from-violet-400 to-blue-400 text-white font-semibold">
              VA
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h3
              className="font-bold text-gray-900"
              data-testid="text-vanessa-name"
            >
              Vanessa
            </h3>
            <p className="text-xs text-gray-600">OnSpot Virtual Assistant</p>
            <p className="text-xs font-medium bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">
              Superhuman Assistant — In Training
            </p>
          </div>
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                if (window.confirm("Reset conversation? This will clear all messages.")) {
                  resetConversation();
                }
              }}
              className="text-gray-600 hover:text-gray-900 hover:bg-violet-100/60"
              data-testid="button-reset-chat-modal"
              title="Reset conversation"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              className="text-gray-600 hover:text-gray-900 hover:bg-violet-100/60"
              data-testid="button-close-chat-modal"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Messages with enhanced contrast - scrollable section with momentum */}
        <div className="v-body flex-1 relative min-h-0">
          <div
            id="scroller"
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4 transition-all duration-500 ease-in-out"
            style={{
              WebkitOverflowScrolling: "touch",
              overscrollBehavior: "contain",
              padding: "clamp(12px, 3vw, 20px)",
              paddingBottom: "clamp(12px, 3vw, 20px)",
            }}
            data-testid="chat-messages"
          >
            <div id="messages" className="space-y-3 md:space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
                      message.sender === "user"
                        ? "bg-gradient-to-r from-[#3A3AF8] to-[#7F3DF4] text-white"
                        : "bg-white/80 text-gray-900 backdrop-blur-sm border border-violet-200/40"
                    }`}
                    data-testid={`message-${message.sender}-${message.id}`}
                  >
                    {message.isTyping ? (
                      <div
                        className="flex gap-1 py-1"
                        data-testid="typing-indicator"
                      >
                        <div
                          className="w-2 h-2 bg-violet-400 rounded-full animate-bounce"
                          style={{ animationDelay: "0ms" }}
                        />
                        <div
                          className="w-2 h-2 bg-violet-400 rounded-full animate-bounce"
                          style={{ animationDelay: "150ms" }}
                        />
                        <div
                          className="w-2 h-2 bg-violet-400 rounded-full animate-bounce"
                          style={{ animationDelay: "300ms" }}
                        />
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-line leading-relaxed">
                        {message.text}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* New messages chip - appears when user scrolls up during streaming */}
          {showNewMessageChip && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 animate-in slide-in-from-bottom-2 duration-300">
              <Button
                onClick={handleScrollToBottomClick}
                size="sm"
                className="bg-gradient-to-r from-[#3A3AF8] to-[#7F3DF4] text-white shadow-lg hover:shadow-xl transition-all"
                data-testid="button-new-messages"
              >
                New messages ↓
              </Button>
            </div>
          )}
        </div>

        {/* Footer area (input + choices) - tracked by ResizeObserver */}
        <div ref={footerRef} data-footer-area>
          {/* Sticky Input Bar - always visible */}
          <div
            className="border-t border-violet-200/50 backdrop-blur-sm flex-shrink-0"
            style={{
              padding: "clamp(12px, 3vw, 20px)",
              paddingBottom:
                "calc(clamp(12px, 3vw, 20px) + env(safe-area-inset-bottom))",
            }}
          >
            <div className="flex gap-2 items-end">
              <Textarea
                id="chatInput"
                value={userInput}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                className="flex-1 min-h-[44px] max-h-[120px] resize-none text-sm border-violet-300 focus:border-violet-500"
                data-testid="input-message"
              />
              <Button
                id="sendBtn"
                onClick={handleSendMessage}
                disabled={!userInput.trim() || isStreaming}
                size="icon"
                className="h-11 w-11 bg-gradient-to-r from-[#3A3AF8] to-[#7F3DF4] text-white disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all"
                data-testid="button-send-message"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Interactive Options with glass buttons - sticky footer with safe area */}
          {showOptions && !userHasTyped && (
            <div
              id="choices"
              className="border-t border-violet-200/50 space-y-2 animate-in slide-in-from-bottom-2 duration-300 backdrop-blur-sm flex-shrink-0"
              style={{
                position: "sticky",
                bottom: 0,
                paddingTop: "clamp(12px, 3vw, 16px)",
                paddingLeft: "clamp(12px, 3vw, 20px)",
                paddingRight: "clamp(12px, 3vw, 20px)",
                paddingBottom:
                  "calc(clamp(12px, 3vw, 20px) + env(safe-area-inset-bottom))",
              }}
            >
              {selectedTopic === "talk-human" ? (
                <div className="flex gap-2">
                  <Button
                    onClick={handleBookCall}
                    className="flex-1 bg-gradient-to-r from-[#3A3AF8] to-[#7F3DF4] text-white hover:shadow-lg hover:scale-[1.02] transition-all duration-300"
                    data-testid="button-book-call"
                  >
                    Book a Call
                  </Button>
                  <Button
                    onClick={() => {
                      setSelectedTopic(null);
                      setShowOptions(true);
                    }}
                    variant="outline"
                    className="flex-1 border-violet-300 text-gray-700 hover:bg-violet-50 hover:border-violet-400"
                    data-testid="button-keep-exploring"
                  >
                    Keep Exploring
                  </Button>
                </div>
              ) : (
                <>
                  <Button
                    onClick={() => handleTopicSelect("how-it-works")}
                    variant="outline"
                    className="w-full justify-start text-left border-violet-300 text-gray-700 hover:bg-violet-50 hover:border-violet-400"
                    data-testid="button-how-it-works"
                  >
                    How OnSpot Outsourcing Works
                  </Button>
                  <Button
                    onClick={() => handleTopicSelect("pricing")}
                    variant="outline"
                    className="w-full justify-start text-left border-violet-300 text-gray-700 hover:bg-violet-50 hover:border-violet-400"
                    data-testid="button-pricing"
                  >
                    See Pricing Models
                  </Button>
                  <Button
                    onClick={() => handleTopicSelect("ai-human")}
                    variant="outline"
                    className="w-full justify-start text-left border-violet-300 text-gray-700 hover:bg-violet-50 hover:border-violet-400"
                    data-testid="button-ai-human"
                  >
                    AI + Human Advantage
                  </Button>
                  <Button
                    onClick={() => handleTopicSelect("talk-human")}
                    variant="outline"
                    className="w-full justify-start text-left border-violet-300 text-gray-700 hover:bg-violet-50 hover:border-violet-400"
                    data-testid="button-talk-human"
                  >
                    Talk to a Human Expert
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Luminous sparkle effects */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
          <Sparkles className="absolute top-4 right-4 h-5 w-5 text-violet-500 opacity-70 animate-pulse" />
          <Sparkles
            className="absolute bottom-20 left-6 h-4 w-4 text-blue-500 opacity-50 animate-pulse"
            style={{ animationDelay: "1s" }}
          />
        </div>
      </div>
    </div>
  );
}
