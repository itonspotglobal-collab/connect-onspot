import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  MessageCircle, 
  X, 
  Send, 
  Bot, 
  User, 
  Minimize2,
  Maximize2,
  Sparkles,
  AlertCircle
} from "lucide-react";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function VanessaChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm Vanessa, your OnSpot AI assistant. I'm here to help you learn about our outsourcing services, calculate potential savings, and guide you through getting started. What would you like to know?",
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [needsApiKey, setNeedsApiKey] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          setNeedsApiKey(true);
          throw new Error('OpenAI API key required');
        }
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
      setNeedsApiKey(false);
    } catch (error) {
      console.error('Chat error:', error);
      
      let errorMessage = "I apologize, but I'm having trouble connecting right now. ";
      
      if (needsApiKey || (error instanceof Error && error.message.includes('API key'))) {
        errorMessage += "It looks like the OpenAI API key needs to be configured. Please contact support or try again later.";
      } else {
        errorMessage += "Please try again in a moment, or feel free to explore our website for information about OnSpot's services.";
      }

      const errorResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorMessage,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorResponse]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const quickQuestions = [
    "How much can I save by outsourcing?",
    "What services does OnSpot offer?",
    "How does the 4-stage system work?",
    "Can I see client success stories?"
  ];

  const handleQuickQuestion = (question: string) => {
    setInputMessage(question);
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setIsOpen(true)}
          className="h-14 w-14 rounded-full shadow-2xl bg-primary hover:bg-primary/90 transition-all duration-300 hover:scale-110 group"
          data-testid="button-open-vanessa-chat"
        >
          <div className="relative">
            <MessageCircle className="w-6 h-6 text-white" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-[hsl(var(--gold-yellow))] rounded-full animate-pulse"></div>
          </div>
        </Button>
        
        {/* Floating tooltip */}
        <div className="absolute bottom-16 right-0 bg-white dark:bg-gray-800 text-gray-800 dark:text-white px-3 py-2 rounded-lg shadow-lg text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
          Chat with Vanessa
          <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-white dark:border-t-gray-800"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Card className={`w-96 shadow-2xl transition-all duration-300 ${isMinimized ? 'h-16' : 'h-[500px]'}`}>
        <CardHeader className="p-4 bg-gradient-to-r from-primary to-primary/80 text-white rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="w-8 h-8 border-2 border-white/20">
                <AvatarFallback className="bg-[hsl(var(--gold-yellow))] text-primary font-bold text-sm">
                  V
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-semibold text-sm">Vanessa</div>
                <div className="text-xs text-white/80 flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  OnSpot AI Assistant
                </div>
              </div>
              <Badge className="bg-[hsl(var(--gold-yellow))] text-primary text-xs">
                <Sparkles className="w-3 h-3 mr-1" />
                AI
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(!isMinimized)}
                className="h-8 w-8 p-0 text-white hover:bg-white/20"
                data-testid="button-minimize-vanessa-chat"
              >
                {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 p-0 text-white hover:bg-white/20"
                data-testid="button-close-vanessa-chat"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        {!isMinimized && (
          <CardContent className="p-0 flex flex-col h-[436px]">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
              {messages.map((message) => (
                <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarFallback className={message.role === 'user' ? 'bg-primary text-white' : 'bg-[hsl(var(--gold-yellow))] text-primary'}>
                      {message.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </AvatarFallback>
                  </Avatar>
                  <div className={`max-w-[250px] p-3 rounded-lg text-sm ${
                    message.role === 'user' 
                      ? 'bg-primary text-white rounded-br-none' 
                      : 'bg-white border border-gray-200 rounded-bl-none'
                  }`}>
                    {message.content}
                    {message.content.includes('API key') && (
                      <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-orange-800 text-xs flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        API key configuration needed
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-3">
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarFallback className="bg-[hsl(var(--gold-yellow))] text-primary">
                      <Bot className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-white border border-gray-200 rounded-lg rounded-bl-none p-3 text-sm">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
            
            {/* Quick Questions */}
            {messages.length === 1 && (
              <div className="p-4 border-t bg-gray-50/50">
                <div className="text-xs text-gray-600 mb-2">Quick questions:</div>
                <div className="flex flex-wrap gap-2">
                  {quickQuestions.map((question, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickQuestion(question)}
                      className="text-xs h-7 px-2"
                      data-testid={`button-quick-question-${index}`}
                    >
                      {question}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Input */}
            <div className="p-4 border-t bg-white">
              <div className="flex gap-2">
                <Input
                  placeholder="Ask me about OnSpot..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isLoading}
                  className="flex-1"
                  data-testid="input-vanessa-message"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={isLoading || !inputMessage.trim()}
                  size="sm"
                  className="px-3"
                  data-testid="button-send-vanessa-message"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}