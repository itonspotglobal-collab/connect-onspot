import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Sparkles, MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Message {
  id: number;
  text: string;
  sender: "vanessa" | "user";
  isTyping?: boolean;
}

interface VanessaChatProps {
  isOpen: boolean;
  onClose: () => void;
  isSticky?: boolean;
}

export function VanessaChat({ isOpen, onClose, isSticky = false }: VanessaChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [showOptions, setShowOptions] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  const openingMessages = [
    { id: 1, text: "Hi there! I'm Vanessa, your OnSpot Virtual Assistant.", sender: "vanessa" as const },
    { id: 2, text: "I'm currently in training — learning from the decades of experience of our founders, managers, clients, and thousands of professionals in the OnSpot network.", sender: "vanessa" as const },
    { id: 3, text: "For now, I can help you get started with Outsourcing through OnSpot.\nWould you like to explore how it works?", sender: "vanessa" as const },
  ];

  const faqResponses: Record<string, string[]> = {
    "how-it-works": [
      "Great question! OnSpot connects you with pre-vetted Filipino talent through a unique AI-first approach.",
      "Here's how it works:\n\n1. Tell us your needs\n2. Our AI matches you with top candidates\n3. Human experts verify the match\n4. Start working within 48 hours",
      "The best part? You only pay for productive work, with built-in quality assurance and performance tracking."
    ],
    "pricing": [
      "Our pricing is simple and transparent:",
      "Hourly Rate: $8-25/hour (depending on skill level)\nMonthly Retainer: Custom packages available\nPerformance-based: Pay only for verified productive hours",
      "All pricing includes:\n• AI-powered time tracking\n• Quality assurance\n• Dedicated account manager\n• Replacement guarantee"
    ],
    "ai-human": [
      "This is where OnSpot truly shines! We combine the best of both worlds:",
      "AI handles: Talent matching, time tracking, performance analytics, workflow optimization",
      "Humans handle: Complex decisions, relationship building, quality oversight, strategic guidance",
      "Result? 40% faster hiring, 30% cost savings, and 95% client satisfaction. AI does the heavy lifting, humans ensure excellence."
    ],
    "talk-human": [
      "Perfect! I'd love to connect you with one of our expert managers.",
      "They can provide:\n• Custom solution design\n• ROI analysis for your use case\n• Live talent preview\n• Onboarding timeline",
    ]
  };

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

    const timer = setTimeout(() => {
      const newMessage = openingMessages[currentMessageIndex];
      
      // Show typing indicator first
      setMessages(prev => [...prev, { ...newMessage, isTyping: true }]);
      
      // Replace typing indicator with actual message after delay
      setTimeout(() => {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...newMessage, isTyping: false };
          return updated;
        });
        setCurrentMessageIndex(prev => prev + 1);
      }, 1000 + Math.random() * 500); // 1-1.5s typing delay
      
    }, currentMessageIndex === 0 ? 300 : 1500); // First message faster

    return () => clearTimeout(timer);
  }, [currentMessageIndex, isOpen, openingMessages.length, showOptions]);

  const handleTopicSelect = (topic: string) => {
    setSelectedTopic(topic);
    setShowOptions(false);
    
    // Add user message
    const userMessages: Record<string, string> = {
      "how-it-works": "How OnSpot Outsourcing Works",
      "pricing": "See Pricing Models",
      "ai-human": "AI + Human Advantage",
      "talk-human": "Talk to a Human Expert"
    };
    
    setMessages(prev => [...prev, { 
      id: Date.now(), 
      text: userMessages[topic], 
      sender: "user" 
    }]);

    // Show Vanessa's responses sequentially
    const responses = faqResponses[topic];
    let responseIndex = 0;

    const showNextResponse = () => {
      if (responseIndex < responses.length) {
        // Show typing
        setMessages(prev => [...prev, { 
          id: Date.now() + responseIndex, 
          text: responses[responseIndex], 
          sender: "vanessa",
          isTyping: true 
        }]);

        // Replace with actual message
        setTimeout(() => {
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { 
              ...updated[updated.length - 1], 
              isTyping: false 
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
                setMessages(prev => [...prev, { 
                  id: Date.now() + 1000, 
                  text: "Would you like me to connect you with an OnSpot Manager to discuss your setup?", 
                  sender: "vanessa" 
                }]);
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
    window.open("https://calendly.com/onspot", "_blank");
  };

  if (!isOpen) return null;

  // Sticky chat widget mode (lower right corner)
  if (isSticky) {
    return (
      <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 duration-500">
        {isMinimized ? (
          // Minimized floating button
          <Button
            size="icon"
            onClick={() => setIsMinimized(false)}
            className="h-16 w-16 rounded-full bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-2xl hover:shadow-[0_0_30px_rgba(139,92,246,0.6)] hover-elevate"
            data-testid="button-open-chat-widget"
          >
            <MessageCircle className="h-7 w-7" />
          </Button>
        ) : (
          // Expanded chat widget
          <Card 
            className="w-[400px] h-[600px] flex flex-col relative animate-in slide-in-from-bottom-4 duration-500 border-violet-500/20 overflow-visible shadow-2xl"
            style={{
              background: "linear-gradient(135deg, rgba(139, 92, 246, 0.95) 0%, rgba(30, 27, 75, 0.98) 100%)",
            }}
            data-testid="vanessa-chat-widget"
          >
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-white/10">
              <Avatar className="h-12 w-12 ring-2 ring-white/20" data-testid="avatar-vanessa">
                <AvatarImage src="/placeholder-vanessa.jpg" alt="Vanessa" />
                <AvatarFallback className="bg-gradient-to-br from-violet-400 to-blue-400 text-white font-semibold">
                  VA
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="font-semibold text-white" data-testid="text-vanessa-name">Vanessa</h3>
                <p className="text-xs text-white/70">OnSpot Virtual Assistant</p>
                <p className="text-xs text-violet-300">Superhuman Assistant — In Training</p>
              </div>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setIsMinimized(true)}
                  className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
                  data-testid="button-minimize-chat"
                >
                  <span className="text-lg leading-none">−</span>
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onClose}
                  className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
                  data-testid="button-close-chat"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4" data-testid="chat-messages">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                      message.sender === "user"
                        ? "bg-white text-gray-900"
                        : "bg-white/10 text-white backdrop-blur-sm"
                    }`}
                    data-testid={`message-${message.sender}-${message.id}`}
                  >
                    {message.isTyping ? (
                      <div className="flex gap-1 py-1" data-testid="typing-indicator">
                        <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-line leading-relaxed">{message.text}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Interactive Options */}
            {showOptions && (
              <div className="p-4 border-t border-white/10 space-y-2 animate-in slide-in-from-bottom-2 duration-300">
                {selectedTopic === "talk-human" ? (
                  <div className="flex gap-2">
                    <Button
                      onClick={handleBookCall}
                      className="flex-1 bg-white text-violet-600 hover:bg-white/90"
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
                      className="flex-1 border-white/20 text-white hover:bg-white/10"
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
                      className="w-full justify-start text-left border-white/20 text-white hover:bg-white/10"
                      data-testid="button-how-it-works"
                    >
                      How OnSpot Outsourcing Works
                    </Button>
                    <Button
                      onClick={() => handleTopicSelect("pricing")}
                      variant="outline"
                      className="w-full justify-start text-left border-white/20 text-white hover:bg-white/10"
                      data-testid="button-pricing"
                    >
                      See Pricing Models
                    </Button>
                    <Button
                      onClick={() => handleTopicSelect("ai-human")}
                      variant="outline"
                      className="w-full justify-start text-left border-white/20 text-white hover:bg-white/10"
                      data-testid="button-ai-human"
                    >
                      AI + Human Advantage
                    </Button>
                    <Button
                      onClick={() => handleTopicSelect("talk-human")}
                      variant="outline"
                      className="w-full justify-start text-left border-white/20 text-white hover:bg-white/10"
                      data-testid="button-talk-human"
                    >
                      Talk to a Human Expert
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* Sparkle effect */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
              <Sparkles className="absolute top-4 right-4 h-4 w-4 text-violet-300 opacity-60 animate-pulse" />
              <Sparkles className="absolute bottom-20 left-6 h-3 w-3 text-blue-300 opacity-40 animate-pulse" style={{ animationDelay: "1s" }} />
            </div>
          </Card>
        )}
      </div>
    );
  }

  // Full-screen modal mode (default)
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300"
      style={{
        background: "radial-gradient(ellipse at center, rgba(139, 92, 246, 0.15) 0%, rgba(59, 130, 246, 0.1) 50%, rgba(0, 0, 0, 0.4) 100%)",
        backdropFilter: "blur(8px)"
      }}
      onClick={onClose}
    >
      <Card 
        className="w-full max-w-lg h-[600px] flex flex-col relative animate-in slide-in-from-bottom-4 duration-500 border-violet-500/20 overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(139, 92, 246, 0.95) 0%, rgba(30, 27, 75, 0.98) 100%)",
        }}
        onClick={(e) => e.stopPropagation()}
        data-testid="vanessa-chat-window"
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-white/10">
          <Avatar className="h-12 w-12 ring-2 ring-white/20" data-testid="avatar-vanessa">
            <AvatarImage src="/placeholder-vanessa.jpg" alt="Vanessa" />
            <AvatarFallback className="bg-gradient-to-br from-violet-400 to-blue-400 text-white font-semibold">
              VA
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h3 className="font-semibold text-white" data-testid="text-vanessa-name">Vanessa</h3>
            <p className="text-xs text-white/70">OnSpot Virtual Assistant</p>
            <p className="text-xs text-violet-300">Superhuman Assistant — In Training</p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            className="text-white/70 hover:text-white hover:bg-white/10"
            data-testid="button-close-chat"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4" data-testid="chat-messages">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                  message.sender === "user"
                    ? "bg-white text-gray-900"
                    : "bg-white/10 text-white backdrop-blur-sm"
                }`}
                data-testid={`message-${message.sender}-${message.id}`}
              >
                {message.isTyping ? (
                  <div className="flex gap-1 py-1" data-testid="typing-indicator">
                    <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-line leading-relaxed">{message.text}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Interactive Options */}
        {showOptions && (
          <div className="p-4 border-t border-white/10 space-y-2 animate-in slide-in-from-bottom-2 duration-300">
            {selectedTopic === "talk-human" ? (
              <div className="flex gap-2">
                <Button
                  onClick={handleBookCall}
                  className="flex-1 bg-white text-violet-600 hover:bg-white/90"
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
                  className="flex-1 border-white/20 text-white hover:bg-white/10"
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
                  className="w-full justify-start text-left border-white/20 text-white hover:bg-white/10"
                  data-testid="button-how-it-works"
                >
                  How OnSpot Outsourcing Works
                </Button>
                <Button
                  onClick={() => handleTopicSelect("pricing")}
                  variant="outline"
                  className="w-full justify-start text-left border-white/20 text-white hover:bg-white/10"
                  data-testid="button-pricing"
                >
                  See Pricing Models
                </Button>
                <Button
                  onClick={() => handleTopicSelect("ai-human")}
                  variant="outline"
                  className="w-full justify-start text-left border-white/20 text-white hover:bg-white/10"
                  data-testid="button-ai-human"
                >
                  AI + Human Advantage
                </Button>
                <Button
                  onClick={() => handleTopicSelect("talk-human")}
                  variant="outline"
                  className="w-full justify-start text-left border-white/20 text-white hover:bg-white/10"
                  data-testid="button-talk-human"
                >
                  Talk to a Human Expert
                </Button>
              </>
            )}
          </div>
        )}

        {/* Sparkle effect */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
          <Sparkles className="absolute top-4 right-4 h-4 w-4 text-violet-300 opacity-60 animate-pulse" />
          <Sparkles className="absolute bottom-20 left-6 h-3 w-3 text-blue-300 opacity-40 animate-pulse" style={{ animationDelay: "1s" }} />
        </div>
      </Card>
    </div>
  );
}
