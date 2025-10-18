import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Bot, ArrowRight } from "lucide-react";
import { VanessaChat } from "@/components/VanessaChat";

interface ComingSoonProps {
  title?: string;
  subtitle?: string;
  message?: string;
  showIllustration?: boolean;
}

export function ComingSoon({ 
  title = "The next evolution of outsourcing.",
  subtitle = "Powered by intelligence and human brilliance.",
  message = "",
  showIllustration = false
}: ComingSoonProps) {
  const [showVanessaChat, setShowVanessaChat] = useState(false);
  const [nodes, setNodes] = useState<Array<{ x: number; y: number; delay: number }>>([]);

  useEffect(() => {
    const generateNodes = () => {
      const nodeCount = 30;
      const newNodes = [];
      for (let i = 0; i < nodeCount; i++) {
        newNodes.push({
          x: Math.random() * 100,
          y: Math.random() * 100,
          delay: Math.random() * 4
        });
      }
      setNodes(newNodes);
    };
    generateNodes();
  }, []);

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-[#0F103F] via-[#1a1a5e] to-[#6A4CFF]">
      {/* Neural mesh background with nodes */}
      <svg 
        className="absolute inset-0 w-full h-full opacity-20 pointer-events-none"
        style={{ filter: 'blur(0.5px)' }}
      >
        <defs>
          <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#6A4CFF" stopOpacity="0" />
          </radialGradient>
        </defs>
        
        {/* Connection lines */}
        {nodes.map((node, i) => 
          nodes.slice(i + 1).map((otherNode, j) => {
            const distance = Math.sqrt(
              Math.pow(node.x - otherNode.x, 2) + 
              Math.pow(node.y - otherNode.y, 2)
            );
            if (distance < 20) {
              return (
                <line
                  key={`line-${i}-${j}`}
                  x1={`${node.x}%`}
                  y1={`${node.y}%`}
                  x2={`${otherNode.x}%`}
                  y2={`${otherNode.y}%`}
                  stroke="rgba(106, 76, 255, 0.3)"
                  strokeWidth="1"
                  className="animate-pulse-slow"
                  style={{ animationDelay: `${node.delay}s` }}
                />
              );
            }
            return null;
          })
        )}

        {/* Glowing nodes */}
        {nodes.map((node, i) => (
          <circle
            key={`node-${i}`}
            cx={`${node.x}%`}
            cy={`${node.y}%`}
            r="2"
            fill="url(#nodeGlow)"
            className="animate-pulse-dot"
            style={{ animationDelay: `${node.delay}s` }}
          />
        ))}
      </svg>

      {/* Central AI brain glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        {/* Outer ripple */}
        <div className="absolute inset-0 w-[600px] h-[600px] -ml-[300px] -mt-[300px] rounded-full bg-gradient-radial from-violet-500/20 to-transparent animate-pulse-glow"></div>
        
        {/* Middle ripple */}
        <div className="absolute inset-0 w-[400px] h-[400px] -ml-[200px] -mt-[200px] rounded-full bg-gradient-radial from-blue-500/30 to-transparent animate-pulse-glow" style={{ animationDelay: '0.5s' }}></div>
        
        {/* Core brain */}
        <div className="absolute inset-0 w-[200px] h-[200px] -ml-[100px] -mt-[100px] rounded-full bg-gradient-radial from-white/40 via-violet-400/30 to-transparent animate-charge-up"></div>
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <div
            key={`particle-${i}`}
            className="absolute w-1 h-1 bg-white/40 rounded-full animate-particle-float"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${i * 0.8}s`,
              animationDuration: `${10 + Math.random() * 4}s`
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 relative z-10 text-center max-w-5xl">
        <div className="space-y-8 animate-fade-in-up">
          {/* Headline */}
          <h1 
            className="font-bold tracking-tight leading-tight text-white drop-shadow-2xl"
            style={{ fontSize: 'clamp(2.5rem, 7vw, 5rem)' }}
            data-testid="text-title"
          >
            {title}
          </h1>
          
          {/* Subtext */}
          <p 
            className="font-medium text-white/90 leading-relaxed drop-shadow-lg"
            style={{ fontSize: 'clamp(1.25rem, 3vw, 1.75rem)' }}
            data-testid="text-subtitle"
          >
            {subtitle}
          </p>

          {/* CTA Buttons */}
          <div 
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
            style={{ paddingTop: 'clamp(2rem, 5vw, 4rem)' }}
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

          {/* Status indicator */}
          <div 
            className="flex items-center justify-center gap-2 opacity-60"
            style={{ paddingTop: 'clamp(2rem, 4vw, 3rem)' }}
          >
            <div className="flex gap-1.5">
              <div className="w-2 h-2 rounded-full bg-white/60 animate-pulse-dot"></div>
              <div className="w-2 h-2 rounded-full bg-white/60 animate-pulse-dot" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2 h-2 rounded-full bg-white/60 animate-pulse-dot" style={{ animationDelay: '0.4s' }}></div>
            </div>
            <p className="text-sm text-white/70 font-light tracking-wide ml-2" data-testid="text-status">
              Preparing your experience
            </p>
          </div>
        </div>
      </div>

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
