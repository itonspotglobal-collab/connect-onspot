import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Bot, ArrowRight } from "lucide-react";
import { VanessaChat } from "@/components/VanessaChat";
import { BrainGradient } from "@/components/BrainGradient";

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
  const [typedText, setTypedText] = useState("");
  const [showDots, setShowDots] = useState(0);
  const [showContent, setShowContent] = useState(false);
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const comingSoonText = "COMING SOON";
  
  useEffect(() => {
    if (prefersReducedMotion) {
      setTypedText(comingSoonText);
      setShowContent(true);
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

    setTimeout(() => setShowContent(true), 800);

    return () => {
      clearInterval(typeInterval);
      clearInterval(dotsInterval);
    };
  }, []);

  return (
    <div 
      className="w-full relative overflow-hidden"
      style={{
        minHeight: '100svh',
        background: 'radial-gradient(ellipse at center, #ffffff 0%, #fdfbff 40%, #f8f6fe 100%)'
      }}
    >
      {/* OnSpot Logo - Top Center */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 z-30">
        <Link href="/">
          <h1 
            className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent opacity-40 hover:opacity-70 transition-opacity cursor-pointer"
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

      {/* 12-Column Grid Container */}
      <div 
        className="mx-auto relative flex items-center justify-center"
        style={{
          maxWidth: 'clamp(1280px, 90vw, 1440px)',
          padding: '0 clamp(16px, 4vw, 48px)',
          minHeight: '100svh'
        }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 w-full items-center relative">
          
          {/* Left Side: Content (Cols 1-6) */}
          <div 
            className="lg:col-span-6 relative z-20 flex flex-col"
            style={{
              gap: 'clamp(12px, 2.8vh, 28px)'
            }}
          >
            {/* Coming Soon - Plain Text */}
            <div 
              className={`transition-all duration-1000 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            >
              <p 
                className="font-medium tracking-[0.25em] uppercase text-xs sm:text-sm bg-gradient-to-r from-violet-600/90 to-blue-600/90 bg-clip-text text-transparent"
                data-testid="text-coming-soon"
              >
                {typedText}
                {!prefersReducedMotion && typedText === comingSoonText && (
                  <span className="inline-block ml-1">
                    {'.'.repeat(showDots)}
                  </span>
                )}
              </p>
            </div>

            {/* H1 - Main Headline */}
            <div 
              className={`transition-all duration-1000 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              style={{ transitionDelay: '0.1s' }}
            >
              <h1 
                className="font-bold tracking-tight bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 bg-clip-text text-transparent"
                style={{ 
                  fontSize: 'clamp(34px, 7vw, 96px)',
                  lineHeight: '1.05',
                  letterSpacing: '-0.01em',
                  maxWidth: '68ch',
                  textShadow: '0 1px 0 #fff, 0 0 24px rgba(140, 120, 255, 0.25)'
                }}
                data-testid="text-title"
              >
                {title}
              </h1>
            </div>
            
            {/* Subline */}
            <div 
              className={`transition-all duration-1000 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              style={{ transitionDelay: '0.2s' }}
            >
              <p 
                className="font-medium text-slate-600 leading-relaxed"
                style={{ 
                  fontSize: 'clamp(16px, 2.2vw, 22px)',
                  opacity: 0.8,
                  maxWidth: '68ch'
                }}
                data-testid="text-subtitle"
              >
                {subtitle}
              </p>
            </div>

            {/* CTAs - Homepage Style */}
            <div 
              className={`flex flex-col sm:flex-row items-start gap-3 sm:gap-4 transition-all duration-1000 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              style={{ 
                transitionDelay: '0.3s',
                paddingTop: 'clamp(1rem, 2vh, 2rem)'
              }}
            >
              {/* Primary: Launch AI Assistant */}
              <Button
                size="lg"
                onClick={() => setShowVanessaChat(true)}
                className="group relative overflow-hidden min-h-[54px] px-8 text-base w-full sm:w-auto bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white font-semibold transition-all duration-300 rounded-2xl shadow-lg hover:shadow-xl"
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
                className="group relative overflow-hidden min-h-[54px] px-8 text-base w-full sm:w-auto border-2 border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 font-medium backdrop-blur-sm bg-white/60 transition-all duration-300 rounded-2xl shadow-sm hover:shadow-md"
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

          {/* Right Side: Brain Image (Cols 7-12) - Desktop Only */}
          <div 
            className="hidden lg:block lg:col-span-6 relative"
            style={{
              position: 'relative',
              overflow: 'visible'
            }}
          >
            <div
              className="brain-container"
              style={{
                position: 'absolute',
                right: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 'clamp(420px, 44vw, 800px)',
                marginLeft: '-2%',
                willChange: 'transform, opacity'
              }}
            >
              {/* Rotating hue sweep overlay */}
              <div 
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, rgba(59, 130, 246, 0.2) 50%, transparent 100%)',
                  mixBlendMode: 'screen',
                  opacity: 0.15,
                  animation: 'rotateSlow 18s linear infinite'
                }}
              />
              
              <div
                style={{
                  animation: prefersReducedMotion ? 'none' : 'brainPulse 6s ease-in-out infinite',
                  willChange: 'transform, opacity'
                }}
                data-testid="brain-image"
              >
                <BrainGradient />
              </div>
            </div>
          </div>

          {/* Mobile: Brain Behind Text */}
          <div 
            className="lg:hidden absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{
              zIndex: 1
            }}
          >
            <div
              style={{
                width: 'clamp(420px, 84vw, 820px)',
                maxWidth: '90vw',
                opacity: 0.5,
                animation: prefersReducedMotion ? 'none' : 'brainPulse 6s ease-in-out infinite',
                willChange: 'transform, opacity'
              }}
            >
              <BrainGradient />
            </div>
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

      <style>{`
        @keyframes brainPulse {
          0% {
            transform: translateY(-50%) scale(0.96);
            opacity: 0.9;
          }
          50% {
            transform: translateY(-50%) scale(1.06);
            opacity: 0.55;
          }
          100% {
            transform: translateY(-50%) scale(0.96);
            opacity: 0.9;
          }
        }

        @keyframes rotateSlow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1024px) {
          .brain-container {
            display: none;
          }
        }

        @media (max-width: 640px) {
          .flex-col.sm\\:flex-row {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}
