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
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [showTitle, setShowTitle] = useState(false);
  const [showSubtitle, setShowSubtitle] = useState(false);

  useEffect(() => {
    const generateNodes = () => {
      const nodeCount = 25;
      const newNodes = [];
      const centerX = 50;
      const centerY = 40;
      const radius = 15;
      
      for (let i = 0; i < nodeCount; i++) {
        const angle = (i / nodeCount) * Math.PI * 2;
        const r = radius * (0.5 + Math.random() * 0.5);
        const x = centerX + Math.cos(angle) * r + (Math.random() - 0.5) * 5;
        const y = centerY + Math.sin(angle) * r + (Math.random() - 0.5) * 5;
        
        newNodes.push({
          x,
          y,
          delay: Math.random() * 3
        });
      }
      setNodes(newNodes);
    };
    generateNodes();

    setTimeout(() => setShowComingSoon(true), 300);
    setTimeout(() => setShowTitle(true), 1800);
    setTimeout(() => setShowSubtitle(true), 2600);
  }, []);

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-white via-slate-50 to-blue-50/30">
      {/* Soft radial glow */}
      <div className="absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-blue-100/40 via-violet-50/20 to-transparent rounded-full blur-3xl pointer-events-none"></div>

      {/* Neural mesh background with elegant light lines */}
      <svg 
        className="absolute inset-0 w-full h-full opacity-30 pointer-events-none"
        style={{ filter: 'blur(0.3px)' }}
      >
        <defs>
          <radialGradient id="nodeLightGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        
        {/* Connection lines - elegant and minimal */}
        {nodes.map((node, i) => 
          nodes.slice(i + 1).map((otherNode, j) => {
            const distance = Math.sqrt(
              Math.pow(node.x - otherNode.x, 2) + 
              Math.pow(node.y - otherNode.y, 2)
            );
            if (distance < 12) {
              return (
                <line
                  key={`line-${i}-${j}`}
                  x1={`${node.x}%`}
                  y1={`${node.y}%`}
                  x2={`${otherNode.x}%`}
                  y2={`${otherNode.y}%`}
                  stroke="url(#lineGradient)"
                  strokeWidth="1.5"
                  className="animate-brain-connection"
                  style={{ 
                    animationDelay: `${node.delay}s`,
                    strokeDasharray: '100',
                    strokeDashoffset: '100'
                  }}
                />
              );
            }
            return null;
          })
        )}

        {/* Light nodes - gradually activating */}
        {nodes.map((node, i) => (
          <g key={`node-${i}`}>
            <circle
              cx={`${node.x}%`}
              cy={`${node.y}%`}
              r="4"
              fill="url(#nodeLightGlow)"
              className="animate-node-activate"
              style={{ 
                animationDelay: `${node.delay}s`,
                opacity: 0
              }}
            />
            <circle
              cx={`${node.x}%`}
              cy={`${node.y}%`}
              r="2"
              fill="#6366f1"
              className="animate-node-activate"
              style={{ 
                animationDelay: `${node.delay + 0.2}s`,
                opacity: 0
              }}
            />
          </g>
        ))}

        {/* Energy waves through the brain */}
        <circle
          cx="50%"
          cy="40%"
          r="15%"
          fill="none"
          stroke="rgba(99, 102, 241, 0.2)"
          strokeWidth="1"
          className="animate-energy-wave"
        />
        <circle
          cx="50%"
          cy="40%"
          r="15%"
          fill="none"
          stroke="rgba(139, 92, 246, 0.15)"
          strokeWidth="1"
          className="animate-energy-wave"
          style={{ animationDelay: '1s' }}
        />
      </svg>

      {/* Content */}
      <div className="container mx-auto px-6 relative z-10 text-center max-w-5xl">
        <div className="space-y-6">
          {/* Coming soon... (appears first) */}
          <div 
            className={`transition-all duration-1000 ${showComingSoon ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            style={{ minHeight: '40px' }}
          >
            <p 
              className="text-slate-500 font-light tracking-wider uppercase text-sm"
              data-testid="text-coming-soon"
            >
              Coming soon…
            </p>
          </div>

          {/* Main Headline (appears second) */}
          <div 
            className={`transition-all duration-1000 ${showTitle ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            <h1 
              className="font-bold tracking-tight leading-tight bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 bg-clip-text text-transparent"
              style={{ fontSize: 'clamp(2.5rem, 7vw, 5rem)' }}
              data-testid="text-title"
            >
              {title}
            </h1>
          </div>
          
          {/* Subtext (appears third) */}
          <div 
            className={`transition-all duration-1000 ${showSubtitle ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            <p 
              className="font-medium text-slate-600 leading-relaxed"
              style={{ fontSize: 'clamp(1.25rem, 3vw, 1.75rem)' }}
              data-testid="text-subtitle"
            >
              {subtitle}
            </p>
          </div>

          {/* CTA Buttons */}
          <div 
            className={`flex flex-col sm:flex-row items-center justify-center gap-4 transition-all duration-1000 ${showSubtitle ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            style={{ 
              paddingTop: 'clamp(2rem, 5vw, 4rem)',
              transitionDelay: '0.3s'
            }}
          >
            {/* Primary: Launch AI Assistant */}
            <Button
              size="lg"
              onClick={() => setShowVanessaChat(true)}
              className="group relative overflow-hidden min-h-[56px] px-8 text-base sm:text-lg w-full sm:w-auto bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 rounded-2xl"
              data-testid="button-launch-ai"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
              <Bot className="w-5 h-5 mr-2 relative z-10" />
              <span className="relative z-10">Launch AI Assistant</span>
            </Button>

            {/* Secondary: Explore OnSpot */}
            <Button
              variant="outline"
              size="lg"
              className="group relative overflow-hidden min-h-[56px] px-8 text-base sm:text-lg w-full sm:w-auto border-2 border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 font-medium backdrop-blur-sm bg-white/60 shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl"
              asChild
              data-testid="button-explore-onspot"
            >
              <Link href="/">
                Explore OnSpot
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
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
