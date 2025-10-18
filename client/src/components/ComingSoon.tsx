import { useState, useEffect, useRef } from "react";
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

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  opacity: number;
  targetOpacity: number;
  scale: number;
  targetScale: number;
  twinkle: number;
}

interface Connection {
  from: number;
  to: number;
  opacity: number;
  targetOpacity: number;
  signalPosition: number;
  hasSignal: boolean;
  nextSignalTime: number;
}

export function ComingSoon({ 
  title = "The next evolution of outsourcing.",
  subtitle = "Powered by intelligence and human brilliance.",
  message = "",
  showIllustration = false
}: ComingSoonProps) {
  const [showVanessaChat, setShowVanessaChat] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [showDots, setShowDots] = useState(0);
  const [showTitle, setShowTitle] = useState(false);
  const [showSubtitle, setShowSubtitle] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const nodesRef = useRef<Node[]>([]);
  const connectionsRef = useRef<Connection[]>([]);
  const cycleStartTimeRef = useRef<number>(0);
  const prefersReducedMotion = useRef(window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const comingSoonText = "COMING SOON";
  
  useEffect(() => {
    if (prefersReducedMotion.current) {
      setTypedText(comingSoonText);
      setShowTitle(true);
      setShowSubtitle(true);
      return;
    }

    let charIndex = 0;
    const typeInterval = setInterval(() => {
      if (charIndex < comingSoonText.length) {
        setTypedText(comingSoonText.substring(0, charIndex + 1));
        charIndex++;
      } else {
        clearInterval(typeInterval);
      }
    }, 80);

    const dotsInterval = setInterval(() => {
      setShowDots(prev => (prev + 1) % 4);
    }, 400);

    setTimeout(() => setShowTitle(true), 1800);
    setTimeout(() => setShowSubtitle(true), 2400);

    return () => {
      clearInterval(typeInterval);
      clearInterval(dotsInterval);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const centerX = canvas.offsetWidth / 2;
    const centerY = canvas.offsetHeight * 0.42;
    const brainWidth = Math.min(canvas.offsetWidth * 0.35, 350);
    const brainHeight = brainWidth * 0.7;

    const springEase = (t: number): number => {
      return 1 - Math.pow(1 - t, 3) * Math.cos(t * 4 * Math.PI);
    };

    const lerp = (start: number, end: number, factor: number): number => {
      return start + (end - start) * factor;
    };

    const createNodes = (count: number) => {
      const nodes: Node[] = [];
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radiusX = (Math.random() * 0.5 + 0.5) * brainWidth / 2;
        const radiusY = (Math.random() * 0.5 + 0.5) * brainHeight / 2;
        
        const lobe = i % 2;
        const lobeOffsetX = lobe === 0 ? -brainWidth * 0.15 : brainWidth * 0.15;
        
        nodes.push({
          x: centerX + lobeOffsetX + Math.cos(angle) * radiusX,
          y: centerY + Math.sin(angle) * radiusY,
          vx: (Math.random() - 0.5) * 0.1,
          vy: (Math.random() - 0.5) * 0.1,
          opacity: 0,
          targetOpacity: 0.85,
          scale: 0,
          targetScale: 1,
          twinkle: Math.random() * Math.PI * 2
        });
      }
      return nodes;
    };

    const createConnections = (nodes: Node[], linksPerNode: number) => {
      const connections: Connection[] = [];
      nodes.forEach((node, i) => {
        const distances = nodes
          .map((other, j) => ({ index: j, dist: Math.hypot(other.x - node.x, other.y - node.y) }))
          .filter(d => d.index !== i)
          .sort((a, b) => a.dist - b.dist)
          .slice(0, linksPerNode);

        distances.forEach(({ index }) => {
          if (!connections.some(c => 
            (c.from === i && c.to === index) || 
            (c.from === index && c.to === i)
          )) {
            connections.push({
              from: i,
              to: index,
              opacity: 0,
              targetOpacity: 0.4,
              signalPosition: 0,
              hasSignal: false,
              nextSignalTime: Date.now() + Math.random() * 2000 + 1800
            });
          }
        });
      });
      return connections;
    };

    const drawBrain = (timestamp: number) => {
      if (!ctx || !canvas) return;

      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

      const cycleDuration = 6700;
      const growDuration = 1600;
      const holdDuration = 2500;
      const bloomDuration = 300;
      const dissolveDuration = 900;

      if (cycleStartTimeRef.current === 0) {
        cycleStartTimeRef.current = timestamp;
      }

      const elapsed = timestamp - cycleStartTimeRef.current;
      const cycleProgress = elapsed / cycleDuration;

      if (cycleProgress >= 1) {
        cycleStartTimeRef.current = timestamp;
        nodesRef.current = [];
        connectionsRef.current = [];
      }

      const currentElapsed = elapsed % cycleDuration;

      if (currentElapsed < growDuration) {
        const growProgress = currentElapsed / growDuration;
        const easedProgress = springEase(growProgress);

        if (nodesRef.current.length === 0) {
          const targetNodeCount = Math.floor(150 + Math.random() * 70);
          nodesRef.current = createNodes(targetNodeCount);
          connectionsRef.current = createConnections(nodesRef.current, 2 + Math.floor(Math.random() * 2));
        }

        nodesRef.current.forEach(node => {
          node.scale = easedProgress;
          node.opacity = easedProgress * node.targetOpacity;
        });

        connectionsRef.current.forEach(conn => {
          conn.opacity = easedProgress * conn.targetOpacity;
        });
      } else if (currentElapsed < growDuration + holdDuration) {
        const breathProgress = (currentElapsed - growDuration) / 6000;
        const breathScale = 0.985 + Math.sin(breathProgress * Math.PI * 2) * 0.015;

        nodesRef.current.forEach(node => {
          node.scale = breathScale;
          node.twinkle += 0.05;
          const twinkleBoost = Math.sin(node.twinkle) * 0.15;
          node.opacity = Math.min(1, node.targetOpacity + twinkleBoost);
        });

        connectionsRef.current.forEach(conn => {
          if (!conn.hasSignal && timestamp > conn.nextSignalTime) {
            conn.hasSignal = true;
            conn.signalPosition = 0;
          }

          if (conn.hasSignal) {
            conn.signalPosition += 0.02;
            if (conn.signalPosition > 1) {
              conn.hasSignal = false;
              conn.signalPosition = 0;
              conn.nextSignalTime = timestamp + Math.random() * 600 + 1800;
            }
          }
        });
      } else if (currentElapsed < growDuration + holdDuration + bloomDuration) {
        const bloomProgress = (currentElapsed - growDuration - holdDuration) / bloomDuration;
        const bloomBoost = bloomProgress * 0.08;

        nodesRef.current.forEach(node => {
          node.opacity = Math.min(1, node.targetOpacity + bloomBoost);
        });

        connectionsRef.current.forEach(conn => {
          conn.opacity = Math.min(1, conn.targetOpacity + bloomBoost);
        });
      } else {
        const dissolveProgress = (currentElapsed - growDuration - holdDuration - bloomDuration) / dissolveDuration;
        
        connectionsRef.current.forEach(conn => {
          conn.opacity = conn.targetOpacity * (1 - Math.min(1, dissolveProgress * 1.5));
        });

        nodesRef.current.forEach(node => {
          node.opacity = node.targetOpacity * (1 - Math.min(1, dissolveProgress));
          node.scale = 1 - dissolveProgress * 0.8;
        });
      }

      connectionsRef.current.forEach(conn => {
        const fromNode = nodesRef.current[conn.from];
        const toNode = nodesRef.current[conn.to];
        if (!fromNode || !toNode) return;

        const gradient = ctx.createLinearGradient(fromNode.x, fromNode.y, toNode.x, toNode.y);
        gradient.addColorStop(0, `rgba(91, 124, 255, ${conn.opacity})`);
        gradient.addColorStop(0.5, `rgba(123, 104, 238, ${conn.opacity})`);
        gradient.addColorStop(1, `rgba(155, 92, 255, ${conn.opacity})`);

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'rgba(91, 124, 255, 0.3)';
        ctx.beginPath();
        ctx.moveTo(fromNode.x, fromNode.y);
        ctx.lineTo(toNode.x, toNode.y);
        ctx.stroke();

        if (conn.hasSignal) {
          const signalX = lerp(fromNode.x, toNode.x, conn.signalPosition);
          const signalY = lerp(fromNode.y, toNode.y, conn.signalPosition);
          
          ctx.shadowBlur = 12;
          ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
          ctx.fillStyle = `rgba(255, 255, 255, ${conn.opacity * 0.9})`;
          ctx.beginPath();
          ctx.arc(signalX, signalY, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      ctx.shadowBlur = 0;

      nodesRef.current.forEach(node => {
        ctx.fillStyle = `rgba(91, 124, 255, ${node.opacity})`;
        ctx.shadowBlur = 10;
        ctx.shadowColor = `rgba(139, 92, 246, ${node.opacity * 0.5})`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 4 * node.scale, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = `rgba(255, 255, 255, ${node.opacity * 0.8})`;
        ctx.shadowBlur = 6;
        ctx.shadowColor = `rgba(255, 255, 255, ${node.opacity * 0.6})`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 2 * node.scale, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.shadowBlur = 0;

      if (!prefersReducedMotion.current) {
        animationRef.current = requestAnimationFrame(drawBrain);
      }
    };

    if (prefersReducedMotion.current) {
      nodesRef.current = createNodes(200);
      connectionsRef.current = createConnections(nodesRef.current, 3);
      nodesRef.current.forEach(node => {
        node.opacity = node.targetOpacity;
        node.scale = 1;
      });
      connectionsRef.current.forEach(conn => {
        conn.opacity = conn.targetOpacity;
      });
      drawBrain(0);
    } else {
      animationRef.current = requestAnimationFrame(drawBrain);
    }

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden bg-gradient-radial from-white via-slate-50 to-purple-50/20">
      {/* OnSpot Logo - faintly glowing at top center */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 z-20">
        <Link href="/">
          <h1 
            className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent opacity-40 hover:opacity-60 transition-opacity cursor-pointer"
            style={{ 
              textShadow: '0 0 20px rgba(139, 92, 246, 0.15)',
              letterSpacing: '-0.02em'
            }}
            data-testid="logo-onspot"
          >
            OnSpot
          </h1>
        </Link>
      </div>

      {/* Neural Network Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ opacity: 0.85 }}
      />

      {/* Content */}
      <div className="container mx-auto px-6 relative z-10 text-center max-w-5xl">
        <div className="space-y-6">
          {/* Coming soon... with typing effect */}
          <div className="min-h-[32px] backdrop-blur-sm bg-white/30 rounded-lg px-4 py-2 inline-block">
            <p 
              className="text-slate-600 font-light tracking-[0.3em] uppercase text-xs sm:text-sm"
              data-testid="text-coming-soon"
            >
              {typedText}
              {!prefersReducedMotion.current && typedText === comingSoonText && (
                <span className="inline-block ml-1">
                  {'.'.repeat(showDots)}
                </span>
              )}
            </p>
          </div>

          {/* Main Headline */}
          <div 
            className={`transition-all duration-1000 backdrop-blur-md bg-white/40 rounded-2xl px-8 py-6 inline-block ${showTitle ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            <h1 
              className="font-bold tracking-tight leading-tight bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 bg-clip-text text-transparent"
              style={{ 
                fontSize: 'clamp(2rem, 6vw, 4rem)',
                textShadow: '0 2px 20px rgba(0, 0, 0, 0.05)'
              }}
              data-testid="text-title"
            >
              {title}
            </h1>
          </div>
          
          {/* Subtext */}
          <div 
            className={`transition-all duration-1000 ${showSubtitle ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            <p 
              className="font-medium text-slate-600 leading-relaxed backdrop-blur-sm bg-white/20 rounded-xl px-6 py-3 inline-block"
              style={{ fontSize: 'clamp(1.125rem, 2.5vw, 1.5rem)' }}
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
