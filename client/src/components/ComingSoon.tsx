import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Bot, ArrowRight } from "lucide-react";
import { VanessaChat } from "@/components/VanessaChat";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ComingSoonProps {
  title?: string;
  subtitle?: string;
  message?: string;
  showIllustration?: boolean;
}

export function ComingSoon({ 
  title = "Too much brilliance loading at once.",
  subtitle = "We're optimizing your experience — the best is about to go live.",
  message = "OnSpot is crafting the next evolution of outsourcing — powered by intelligence, design, and performance.",
  showIllustration = false
}: ComingSoonProps) {
  const [showVanessaChat, setShowVanessaChat] = useState(false);

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-[#474EAD] to-[#6A4CFF]">
      {/* Soft radial glow behind headline */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="container mx-auto px-6 relative z-10 text-center max-w-5xl">
        <div className="space-y-8 animate-fade-in-up">
          {/* Headline */}
          <h1 
            className="font-bold tracking-tight leading-tight text-white"
            style={{ fontSize: 'clamp(2rem, 6vw, 4rem)' }}
            data-testid="text-title"
          >
            {title}
          </h1>
          
          {/* Kicker */}
          <p 
            className="font-medium text-white/90 leading-relaxed"
            style={{ fontSize: 'clamp(1.125rem, 2.5vw, 1.5rem)' }}
            data-testid="text-subtitle"
          >
            {subtitle}
          </p>

          {/* Subtext */}
          <p 
            className="text-white/80 leading-relaxed mx-auto"
            style={{ 
              fontSize: 'clamp(1rem, 1.5vw, 1.125rem)',
              maxWidth: '68ch'
            }}
            data-testid="text-message"
          >
            {message}
          </p>

          {/* CTA Buttons */}
          <div 
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
            style={{ paddingTop: 'clamp(1rem, 3vw, 2rem)' }}
          >
            {/* Primary: Launch AI Assistant */}
            <Button
              size="lg"
              onClick={() => setShowVanessaChat(true)}
              className="group relative overflow-hidden min-h-[56px] px-8 text-base sm:text-lg w-full sm:w-auto bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white font-semibold shadow-xl hover:shadow-2xl transition-all duration-300 rounded-2xl"
              data-testid="button-launch-ai"
            >
              <Bot className="w-5 h-5 mr-2" />
              Launch AI Assistant
            </Button>

            {/* Secondary: Explore OnSpot */}
            <Button
              variant="outline"
              size="lg"
              className="group relative overflow-hidden min-h-[56px] px-8 text-base sm:text-lg w-full sm:w-auto border-2 border-white/30 text-white hover:bg-white/10 hover:border-white/50 font-medium backdrop-blur-xl bg-white/5 shadow-lg hover:shadow-xl transition-all duration-300 rounded-2xl"
              asChild
              data-testid="button-explore-onspot"
            >
              <Link href="/">
                Explore OnSpot
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </div>

          {/* Animated progress bar */}
          <div 
            className="flex flex-col items-center gap-3"
            style={{ paddingTop: 'clamp(2rem, 4vw, 3rem)' }}
          >
            <div className="w-full max-w-xs h-1 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full w-full bg-gradient-to-r from-white/40 via-white/80 to-white/40 animate-shimmer-progress"></div>
            </div>
            <p className="text-sm text-white/70 font-light tracking-wide" data-testid="text-progress">
              Preparing your experience…
            </p>
          </div>
        </div>
      </div>

      {/* Vanessa Avatar - Bottom corner with tooltip */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className="absolute bottom-8 right-8 opacity-40 hover:opacity-70 transition-opacity duration-300 cursor-help hidden sm:block" 
            data-testid="vanessa-avatar"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-white/20 rounded-full blur-xl"></div>
              <div className="relative w-14 h-14 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                <Bot className="w-7 h-7 text-white/90" />
              </div>
              {/* Pulse indicator */}
              <div className="absolute top-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-white/30 animate-pulse"></div>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="bg-white/10 backdrop-blur-xl border-white/20 text-white">
          <p className="text-sm">Vanessa is getting ready to assist you soon</p>
        </TooltipContent>
      </Tooltip>

      {/* Vanessa Chat Integration */}
      {showVanessaChat && (
        <VanessaChat
          isOpen={showVanessaChat}
          onClose={() => setShowVanessaChat(false)}
        />
      )}
    </div>
  );
}
