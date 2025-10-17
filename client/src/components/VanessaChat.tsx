import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X, Sparkles, MessageCircle, Send } from "lucide-react";
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
  } = useVanessa();

  // Local state for input and streaming
  const [userInput, setUserInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [userHasTyped, setUserHasTyped] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const openingMessages = [
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
  ];

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
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, isSticky]);

  // Handle iOS keyboard with visualViewport
  useEffect(() => {
    if (!isOpen || isSticky) return;

    const updateViewportHeight = () => {
      if (window.visualViewport) {
        const vh = window.visualViewport.height;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
      }
    };

    updateViewportHeight();
    window.visualViewport?.addEventListener('resize', updateViewportHeight);

    return () => {
      window.visualViewport?.removeEventListener('resize', updateViewportHeight);
      document.documentElement.style.removeProperty('--vh');
    };
  }, [isOpen, isSticky]);

  // Start message sequence when chat opens
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setCurrentMessageIndex(0);
    }
  }, [isOpen, messages.length]);

  // Display messages sequentially with typing animation
  useEffect(() => {
    if (!isOpen || currentMessageIndex >= openingMessages.length) {
      if (currentMessageIndex === openingMessages.length && !showOptions) {
        setTimeout(() => setShowOptions(true), 500);
      }
      return;
    }

    const timer = setTimeout(
      () => {
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
        ); // 1-1.5s typing delay
      },
      currentMessageIndex === 0 ? 300 : 1500,
    ); // First message faster

    return () => clearTimeout(timer);
  }, [currentMessageIndex, isOpen, openingMessages.length, showOptions]);

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

  // Auto-scroll to bottom when near the bottom
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  // Check if user is near bottom (within 100px)
  const isNearBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    const threshold = 100;
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  };

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (isNearBottom()) {
      scrollToBottom();
    }
  }, [messages]);

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

    // Simulate streaming response
    setIsStreaming(true);
    
    // Create empty assistant message
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
    const response = "I'm currently in training and learning from real conversations. For now, I can help you explore our services through the quick options, or you can chat with a human expert who can provide detailed assistance!";
    const words = response.split(' ');
    
    for (let i = 0; i < words.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 50));
      
      setMessages((prev) => {
        const updated = [...prev];
        const lastMessage = updated[updated.length - 1];
        if (lastMessage.id === assistantMessageId) {
          lastMessage.text = words.slice(0, i + 1).join(' ');
          lastMessage.isTyping = i < words.length - 1;
        }
        return updated;
      });
    }

    setIsStreaming(false);
    
    // Show options after response completes
    setTimeout(() => setShowOptions(true), 500);
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
    if (e.key === 'Enter' && !e.shiftKey) {
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
              <div className="absolute inset-0 bg-gradient-to-r from-[#3A3AF8]/30 via-[#7F3DF4]/30 to-[#3A3AF8]/30 opacity-60 animate-pulse" 
                   style={{ 
                     mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                     WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                     maskComposite: 'exclude',
                     WebkitMaskComposite: 'xor',
                     padding: '2px'
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
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4 min-h-0"
              style={{
                WebkitOverflowScrolling: 'touch',
                overscrollBehavior: 'contain',
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

            {/* Sticky Input Bar - always visible */}
            <div 
              className="border-t border-violet-200/50 backdrop-blur-sm flex-shrink-0"
              style={{
                padding: 'clamp(10px, 2vw, 16px)',
                paddingBottom: 'max(12px, calc(10px + env(safe-area-inset-bottom)))',
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
                  position: 'sticky',
                  bottom: 0,
                  paddingTop: '12px',
                  paddingLeft: '16px',
                  paddingRight: '16px',
                  paddingBottom: 'max(16px, calc(12px + env(safe-area-inset-bottom)))',
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

  // Full-screen luminous glass modal mode - responsive gutters for all screens
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-300"
      style={{
        background:
          "radial-gradient(ellipse at center, rgba(127, 61, 244, 0.15) 0%, rgba(58, 58, 248, 0.1) 50%, rgba(0, 0, 0, 0.3) 100%)",
        backdropFilter: "blur(12px)",
        paddingInline: "clamp(12px, 4vw, 48px)",
        paddingBlock: "clamp(12px, 4vh, 48px)",
        ["--gutter" as string]: "clamp(12px, 4vw, 48px)",
        ["--vgutter" as string]: "clamp(12px, 4vh, 48px)",
      }}
      onClick={onClose}
    >
      <div
        className="flex flex-col relative animate-in slide-in-from-bottom-4 duration-500"
        style={{
          background:
            "linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(243, 232, 255, 0.98) 100%)",
          backdropFilter: "blur(20px)",
          boxShadow:
            "0 0 60px rgba(127, 61, 244, 0.4), 0 8px 32px rgba(0, 0, 0, 0.12), inset 0 0 0 1px rgba(127, 61, 244, 0.3)",
          width: "min(720px, calc(100vw - 2 * var(--gutter)))",
          height: "auto",
          maxHeight: "calc(100dvh - 96px)",
          borderRadius: "clamp(16px, 2vw, 24px)",
          overflow: "visible",
        }}
        onClick={(e) => e.stopPropagation()}
        data-testid="vanessa-chat-window"
      >
        {/* Animated glow accent border */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{ 
            borderRadius: "clamp(16px, 2vw, 24px)",
            overflow: "hidden"
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[#3A3AF8]/30 via-[#7F3DF4]/30 to-[#3A3AF8]/30 opacity-60 animate-pulse" 
               style={{ 
                 mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                 WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                 maskComposite: 'exclude',
                 WebkitMaskComposite: 'xor',
                 padding: '2px'
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
          <Avatar
            className="vanessa-avatar"
            data-testid="avatar-vanessa"
          >
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
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            className="text-gray-600 hover:text-gray-900 hover:bg-violet-100/60"
            data-testid="button-minimize-chat"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Messages with enhanced contrast - scrollable section with momentum */}
        <div
          ref={messagesContainerRef}
          className="v-body flex-1 overflow-y-auto space-y-3 md:space-y-4 min-h-0"
          style={{
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            padding: "clamp(12px, 3vw, 20px)",
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

        {/* Sticky Input Bar - always visible */}
        <div 
          className="border-t border-violet-200/50 backdrop-blur-sm flex-shrink-0"
          style={{
            padding: "clamp(12px, 3vw, 20px)",
            paddingBottom: 'calc(clamp(12px, 3vw, 20px) + env(safe-area-inset-bottom))',
          }}
        >
          <div className="flex gap-2 items-end">
            <Textarea
              value={userInput}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="flex-1 min-h-[44px] max-h-[120px] resize-none text-sm border-violet-300 focus:border-violet-500"
              data-testid="input-message"
            />
            <Button
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
            className="border-t border-violet-200/50 space-y-2 animate-in slide-in-from-bottom-2 duration-300 backdrop-blur-sm flex-shrink-0"
            style={{
              position: 'sticky',
              bottom: 0,
              paddingTop: 'clamp(12px, 3vw, 16px)',
              paddingLeft: 'clamp(12px, 3vw, 20px)',
              paddingRight: 'clamp(12px, 3vw, 20px)',
              paddingBottom: 'calc(clamp(12px, 3vw, 20px) + env(safe-area-inset-bottom))',
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
