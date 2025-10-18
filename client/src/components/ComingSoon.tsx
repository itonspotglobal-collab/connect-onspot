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
  opacity: number;
  twinkle: number;
}

interface Connection {
  from: number;
  to: number;
  opacity: number;
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
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const nodesRef = useRef<Node[]>([]);
  const connectionsRef = useRef<Connection[]>([]);
  const breathPhaseRef = useRef<number>(0);
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
    }, 120);

    const dotsInterval = setInterval(() => {
      setShowDots(prev => (prev + 1) % 4);
    }, 500);

    setTimeout(() => setShowTitle(true), 1800);
    setTimeout(() => setShowSubtitle(true), 2400);

    return () => {
      clearInterval(typeInterval);
      clearInterval(dotsInterval);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const containerWidth = container.offsetWidth;
      const containerHeight = container.offsetHeight;
      
      canvas.width = containerWidth * dpr;
      canvas.height = containerHeight * dpr;
      ctx.scale(dpr, dpr);
      
      if (nodesRef.current.length > 0) {
        initializeNetwork();
      }
    };

    const isMobile = window.innerWidth < 768;
    const nodeCount = isMobile 
      ? Math.floor(220 + Math.random() * 100)
      : Math.floor(360 + Math.random() * 160);

    const initializeNetwork = () => {
      const containerWidth = container.offsetWidth;
      const containerHeight = container.offsetHeight;
      const centerX = containerWidth / 2;
      const centerY = containerHeight / 2;
      const brainWidth = containerWidth * 0.7;
      const brainHeight = containerHeight * 0.65;

      const nodes: Node[] = [];
      for (let i = 0; i < nodeCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radiusX = (Math.random() * 0.5 + 0.5) * brainWidth / 2;
        const radiusY = (Math.random() * 0.5 + 0.5) * brainHeight / 2;
        
        const lobe = i % 2;
        const lobeOffsetX = lobe === 0 ? -brainWidth * 0.12 : brainWidth * 0.12;
        
        nodes.push({
          x: centerX + lobeOffsetX + Math.cos(angle) * radiusX,
          y: centerY + Math.sin(angle) * radiusY,
          opacity: 1,
          twinkle: Math.random() * Math.PI * 2
        });
      }

      const connections: Connection[] = [];
      const linksPerNode = 3 + Math.floor(Math.random() * 3);
      
      nodes.forEach((node, i) => {
        const distances = nodes
          .map((other, j) => ({ 
            index: j, 
            dist: Math.hypot(other.x - node.x, other.y - node.y) 
          }))
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
              opacity: 1,
              signalPosition: 0,
              hasSignal: false,
              nextSignalTime: Date.now() + Math.random() * 600 + 1800
            });
          }
        });
      });

      nodesRef.current = nodes;
      connectionsRef.current = connections;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const drawNetwork = (timestamp: number) => {
      if (!ctx || !canvas) return;

      const containerWidth = container.offsetWidth;
      const containerHeight = container.offsetHeight;
      
      ctx.clearRect(0, 0, containerWidth, containerHeight);

      if (!prefersReducedMotion.current) {
        breathPhaseRef.current += 0.01;
        const sineWave = Math.sin(breathPhaseRef.current);
        const currentScale = 0.96 + (sineWave * 0.04);
        const normalizedScale = (currentScale - 0.96) / 0.08;
        const globalOpacity = 0.9 - (normalizedScale * 0.35);

        ctx.save();
        ctx.translate(containerWidth / 2, containerHeight / 2);
        ctx.scale(currentScale, currentScale);
        ctx.translate(-containerWidth / 2, -containerHeight / 2);

        const lineWidth = 1 + Math.random() * 0.6;
        const nodeSize = 2 + Math.random() * 1.5;

        connectionsRef.current.forEach(conn => {
          const fromNode = nodesRef.current[conn.from];
          const toNode = nodesRef.current[conn.to];
          if (!fromNode || !toNode) return;

          const gradient = ctx.createLinearGradient(
            fromNode.x, fromNode.y, 
            toNode.x, toNode.y
          );
          gradient.addColorStop(0, `rgba(91, 124, 255, ${conn.opacity * globalOpacity})`);
          gradient.addColorStop(0.5, `rgba(123, 104, 238, ${conn.opacity * globalOpacity})`);
          gradient.addColorStop(1, `rgba(155, 92, 255, ${conn.opacity * globalOpacity})`);

          ctx.strokeStyle = gradient;
          ctx.lineWidth = lineWidth;
          ctx.shadowBlur = 8;
          ctx.shadowColor = `rgba(91, 124, 255, ${globalOpacity * 0.3})`;
          ctx.beginPath();
          ctx.moveTo(fromNode.x, fromNode.y);
          ctx.lineTo(toNode.x, toNode.y);
          ctx.stroke();

          if (!conn.hasSignal && timestamp > conn.nextSignalTime) {
            conn.hasSignal = true;
            conn.signalPosition = 0;
          }

          if (conn.hasSignal) {
            conn.signalPosition += 0.018;
            if (conn.signalPosition > 1) {
              conn.hasSignal = false;
              conn.signalPosition = 0;
              conn.nextSignalTime = timestamp + Math.random() * 600 + 1800;
            } else {
              const signalX = fromNode.x + (toNode.x - fromNode.x) * conn.signalPosition;
              const signalY = fromNode.y + (toNode.y - fromNode.y) * conn.signalPosition;
              
              ctx.shadowBlur = 10;
              ctx.shadowColor = 'rgba(255, 255, 255, 0.9)';
              ctx.fillStyle = `rgba(255, 255, 255, ${globalOpacity * 0.95})`;
              ctx.beginPath();
              ctx.arc(signalX, signalY, 2.5, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        });

        ctx.shadowBlur = 0;

        nodesRef.current.forEach(node => {
          node.twinkle += 0.03;
          const twinkleBoost = Math.sin(node.twinkle) * 0.1;
          const shouldTwinkle = Math.random() > 0.98;
          const twinkleEffect = shouldTwinkle ? twinkleBoost : 0;

          const nodeOpacity = (node.opacity + twinkleEffect) * globalOpacity;
          
          ctx.fillStyle = `rgba(91, 124, 255, ${nodeOpacity})`;
          ctx.shadowBlur = 10;
          ctx.shadowColor = `rgba(139, 92, 246, ${nodeOpacity * 0.5})`;
          ctx.beginPath();
          ctx.arc(node.x, node.y, nodeSize, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.fillStyle = `rgba(255, 255, 255, ${nodeOpacity * 0.85})`;
          ctx.shadowBlur = 6;
          ctx.shadowColor = `rgba(255, 255, 255, ${nodeOpacity * 0.6})`;
          ctx.beginPath();
          ctx.arc(node.x, node.y, nodeSize * 0.5, 0, Math.PI * 2);
          ctx.fill();
        });

        ctx.restore();
      } else {
        const lineWidth = 1.2;
        const nodeSize = 2.5;
        const staticOpacity = 0.7;

        connectionsRef.current.forEach(conn => {
          const fromNode = nodesRef.current[conn.from];
          const toNode = nodesRef.current[conn.to];
          if (!fromNode || !toNode) return;

          const gradient = ctx.createLinearGradient(
            fromNode.x, fromNode.y, 
            toNode.x, toNode.y
          );
          gradient.addColorStop(0, `rgba(91, 124, 255, ${staticOpacity})`);
          gradient.addColorStop(0.5, `rgba(123, 104, 238, ${staticOpacity})`);
          gradient.addColorStop(1, `rgba(155, 92, 255, ${staticOpacity})`);

          ctx.strokeStyle = gradient;
          ctx.lineWidth = lineWidth;
          ctx.beginPath();
          ctx.moveTo(fromNode.x, fromNode.y);
          ctx.lineTo(toNode.x, toNode.y);
          ctx.stroke();
        });

        nodesRef.current.forEach(node => {
          ctx.fillStyle = `rgba(91, 124, 255, ${staticOpacity})`;
          ctx.beginPath();
          ctx.arc(node.x, node.y, nodeSize, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.fillStyle = `rgba(255, 255, 255, ${staticOpacity * 0.85})`;
          ctx.beginPath();
          ctx.arc(node.x, node.y, nodeSize * 0.5, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      if (!prefersReducedMotion.current) {
        animationRef.current = requestAnimationFrame(drawNetwork);
      }
    };

    initializeNetwork();
    
    if (prefersReducedMotion.current) {
      drawNetwork(0);
    } else {
      animationRef.current = requestAnimationFrame(drawNetwork);
    }

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div 
      className="w-full flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        minHeight: '100svh',
        background: 'radial-gradient(ellipse at center, #ffffff 0%, #fdfbff 40%, #f8f6fe 100%)'
      }}
    >
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

      {/* Fixed Neural Brain Container - centered, size clamp, animates internally */}
      <div 
        ref={containerRef}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{
          width: 'clamp(520px, 52vw, 980px)',
          height: 'clamp(520px, 52vw, 980px)',
          maxWidth: '95vw',
          maxHeight: '95vh'
        }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full"
        />
      </div>

      {/* Content - perfectly centered grid */}
      <div className="container mx-auto px-6 relative z-10 flex items-center justify-center" style={{ minHeight: '100svh' }}>
        <div 
          className="text-center flex flex-col items-center"
          style={{
            gap: 'clamp(12px, 2.5vh, 28px)',
            maxWidth: '68ch'
          }}
        >
          {/* Coming soon tag - always visible */}
          <div 
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg"
            style={{
              backdropFilter: 'blur(4px)',
              backgroundColor: 'rgba(255, 255, 255, 0.4)',
              textShadow: '0 1px 2px rgba(255, 255, 255, 0.8)'
            }}
          >
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
            className={`transition-all duration-1000 ${showTitle ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            <h1 
              className="font-bold tracking-tight leading-tight bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 bg-clip-text text-transparent"
              style={{ 
                fontSize: 'clamp(34px, 7vw, 84px)',
                backdropFilter: 'blur(5px)',
                textShadow: '0 0 1px rgba(255, 255, 255, 0.9), 0 2px 8px rgba(255, 255, 255, 0.6)',
                WebkitTextStroke: '0.5px rgba(255, 255, 255, 0.3)'
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
              className="font-medium text-slate-600 leading-relaxed"
              style={{ 
                fontSize: 'clamp(16px, 2.2vw, 22px)',
                backdropFilter: 'blur(6px)',
                textShadow: '0 0 1px rgba(255, 255, 255, 0.95), 0 1px 4px rgba(255, 255, 255, 0.7)'
              }}
              data-testid="text-subtitle"
            >
              {subtitle}
            </p>
          </div>

          {/* CTA Buttons */}
          <div 
            className={`flex flex-col sm:flex-row items-center justify-center transition-all duration-1000 ${showSubtitle ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            style={{ 
              paddingTop: 'clamp(2rem, 5vw, 4rem)',
              gap: 'clamp(12px, 2vh, 20px)',
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
