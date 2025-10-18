import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Bot, Sparkles, ArrowRight } from "lucide-react";
import onspotLogo from "@assets/OnSpot Log Full Purple Blue_1757942805752.png";
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
  message = "OnSpot is crafting the next evolution of outsourcing — powered by intelligence, design, and performance. Stay close. The wait will be worth it.",
  showIllustration = true
}: ComingSoonProps) {
  const [showVanessaChat, setShowVanessaChat] = useState(false);

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden">
      {/* Airy, luminous gradient background - OnSpot blue + soft lavender/purple */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a1628] via-[#1a2f5a] to-[#2a1a4a] animate-gradient-shift">
        {/* Smooth fade animation overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-violet-500/10 via-blue-500/5 to-transparent animate-pulse-slow"></div>
      </div>

      {/* Subtle motion elements - particles, glow lines, slow waves */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Geometric light particles - slow fade-in and movement */}
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white/40 rounded-full animate-particle-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${i * 0.5}s`,
              animationDuration: `${8 + Math.random() * 4}s`,
            }}
          />
        ))}

        {/* Slow waves - subtle motion */}
        <div className="absolute top-1/4 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-400/20 to-transparent animate-wave"></div>
        <div className="absolute top-2/4 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-400/20 to-transparent animate-wave" style={{ animationDelay: "2s" }}></div>
        <div className="absolute top-3/4 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent animate-wave" style={{ animationDelay: "4s" }}></div>

        {/* Glow orbs - something powerful forming */}
        <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-gradient-radial from-violet-500/20 to-transparent rounded-full blur-3xl animate-gentle-float"></div>
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-gradient-radial from-blue-500/15 to-transparent rounded-full blur-3xl animate-gentle-float" style={{ animationDelay: "1.5s" }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-radial from-cyan-500/10 to-transparent rounded-full blur-3xl animate-gentle-float" style={{ animationDelay: "3s" }}></div>
      </div>

      <div className="container mx-auto px-6 relative z-10 text-center space-y-12 animate-fade-in">
        {/* Pulsing OnSpot Logo Orb - "charging up" */}
        <div className="flex justify-center">
          <div className="relative group">
            {/* Outer glow rings - pulsing */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-500/30 to-blue-500/30 blur-2xl animate-pulse-glow"></div>
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-500/20 to-blue-500/20 blur-3xl animate-pulse-glow" style={{ animationDelay: "0.5s" }}></div>
            
            {/* Logo container - charging up effect */}
            <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-violet-600/20 to-blue-600/20 backdrop-blur-xl border border-white/10 flex items-center justify-center p-6 animate-charge-up shadow-2xl">
              <img
                src={onspotLogo}
                alt="OnSpot"
                className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(139,92,246,0.6)] animate-gentle-float"
                data-testid="logo-onspot-orb"
              />
              
              {/* Rotating progress indicator */}
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-violet-400/60 border-r-blue-400/60 animate-spin-slow"></div>
            </div>
          </div>
        </div>

        {/* Typography - Bold, confident, smooth transitions */}
        <div className="space-y-6 max-w-4xl mx-auto animate-slide-up" style={{ animationDelay: "0.3s" }}>
          {/* Playful Expedia-style headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight leading-tight text-white" data-testid="text-title">
            {title}
          </h1>
          
          <p className="text-xl sm:text-2xl lg:text-3xl font-light text-violet-200/90 leading-relaxed" data-testid="text-subtitle">
            {subtitle}
          </p>
        </div>

        {/* Body text */}
        <div className="max-w-2xl mx-auto animate-slide-up" style={{ animationDelay: "0.6s" }}>
          <p className="text-base sm:text-lg lg:text-xl text-blue-100/80 leading-relaxed font-light" data-testid="text-message">
            {message}
          </p>
        </div>

        {/* In Progress Animation - Countdown-like aura */}
        <div className="flex items-center justify-center gap-2 animate-slide-up" style={{ animationDelay: "0.9s" }}>
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-gradient-to-r from-violet-400 to-blue-400 animate-pulse-dot"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
          <span className="text-sm text-violet-300/70 font-medium tracking-wide">Preparing your experience</span>
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-400 to-cyan-400 animate-pulse-dot"
                style={{ animationDelay: `${i * 0.2 + 0.6}s` }}
              />
            ))}
          </div>
        </div>

        {/* CTA Section - Match homepage style */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 pt-8 animate-slide-up" style={{ animationDelay: "1.2s" }}>
          {/* Primary: Launch AI Assistant */}
          <Button
            size="lg"
            onClick={() => setShowVanessaChat(true)}
            className="group relative overflow-hidden min-h-[56px] px-8 text-base sm:text-lg w-full sm:w-auto bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white font-semibold shadow-xl hover:shadow-[0_0_40px_rgba(139,92,246,0.5)] transition-all duration-500 rounded-2xl"
            data-testid="button-launch-ai"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
            <Bot className="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform" />
            Launch AI Assistant
            <Sparkles className="w-4 h-4 ml-2 group-hover:scale-110 transition-transform" />
          </Button>

          {/* Secondary: Explore OnSpot */}
          <Button
            variant="outline"
            size="lg"
            className="group relative overflow-hidden min-h-[56px] px-8 text-base sm:text-lg w-full sm:w-auto border-2 border-white/30 text-white hover:bg-white/10 hover:border-white/50 font-medium backdrop-blur-xl bg-white/5 shadow-lg hover:shadow-xl transition-all duration-500 rounded-2xl"
            asChild
            data-testid="button-explore-onspot"
          >
            <Link href="/">
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              Explore OnSpot
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </div>

        {/* Subtle footer tagline */}
        <div className="pt-8 animate-slide-up" style={{ animationDelay: "1.5s" }}>
          <p className="text-sm text-violet-300/60 font-light tracking-wide" data-testid="text-footer">
            The future of outsourcing is almost here
          </p>
        </div>
      </div>

      {/* Vanessa Avatar - Faded in corner with tooltip */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="absolute bottom-8 right-8 opacity-30 hover:opacity-60 transition-opacity duration-500 cursor-help animate-gentle-float" data-testid="vanessa-avatar">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-500/20 to-blue-500/20 rounded-full blur-xl"></div>
              <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-violet-600/30 to-blue-600/30 backdrop-blur-sm border border-white/10 flex items-center justify-center">
                <Bot className="w-8 h-8 text-violet-300" />
              </div>
              {/* Pulsing indicator */}
              <div className="absolute top-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-white/20 animate-pulse"></div>
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
