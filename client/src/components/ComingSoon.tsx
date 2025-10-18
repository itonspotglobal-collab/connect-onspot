import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Bot, ArrowRight } from "lucide-react";
import { VanessaChat } from "@/components/VanessaChat";
import onspotLogo from "@assets/OnSpot Log Full Purple Blue_1757942805752.png";

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
    <div className="w-full relative overflow-hidden" style={{ minHeight: '100svh' }}>
      {/* AI + Human Advantage Style Section */}
      <div className="relative py-24 sm:py-32 lg:py-40 flex items-center" style={{ minHeight: '100svh', overflow: 'visible' }}>
        {/* Luminous gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-background via-violet-500/5 to-background"></div>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-violet-500/20 via-blue-500/10 to-transparent rounded-full blur-3xl opacity-60"></div>
        </div>
        
        <div className="relative z-10 w-full" style={{ overflow: 'visible' }}>
          <div 
            className="relative"
            style={{ 
              overflow: 'visible',
              maxWidth: '1200px',
              marginLeft: 'clamp(1rem, 5vw, 3rem)',
              marginRight: 'auto',
              paddingLeft: 'clamp(1rem, 3vw, 2rem)',
              paddingRight: 'clamp(1rem, 3vw, 2rem)'
            }}
          >
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center relative" style={{ overflow: 'visible' }}>
              
              {/* Left Side: Typography */}
              <div className="space-y-6 sm:space-y-8 relative z-10" style={{ 
                overflow: 'visible',
                width: '100%',
                maxWidth: 'clamp(100%, 90vw, 600px)',
                marginLeft: 'clamp(0px, calc((100vw - 1024px) / 2), auto)',
                marginRight: 'auto'
              }}>
                {/* Coming Soon Label */}
                <div 
                  className={`transition-all duration-1000 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                  style={{ textAlign: 'left' }}
                >
                  <p 
                    className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wider"
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

                {/* OnSpot Logo - blends with headline */}
                <div 
                  className={`transition-all duration-1000 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                  style={{ transitionDelay: '0.1s', textAlign: 'left' }}
                >
                  <Link href="/">
                    <img
                      src={onspotLogo}
                      alt="OnSpot"
                      className="opacity-85 hover:opacity-100 transition-all duration-300 cursor-pointer"
                      style={{
                        width: 'clamp(120px, 12vw, 200px)',
                        height: 'auto',
                        filter: 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.12))'
                      }}
                      data-testid="logo-onspot"
                    />
                  </Link>
                </div>

                {/* Main Headline */}
                <div 
                  className={`transition-all duration-1000 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                  style={{ transitionDelay: '0.2s', overflow: 'visible' }}
                >
                  <h2 
                    className="text-4xl sm:text-5xl lg:text-6xl font-bold"
                    style={{
                      lineHeight: '1.08',
                      paddingBottom: '0.08em',
                      textWrap: 'balance',
                      hyphens: 'none',
                      WebkitTransform: 'translateZ(0)',
                      overflow: 'visible'
                    } as React.CSSProperties}
                  >
                    <span className="block bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
                      The next evolution of{" "}
                    </span>
                    <span className="block bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">
                      outsourcing.
                    </span>
                  </h2>
                </div>
                
                {/* Subtitle */}
                <div 
                  className={`transition-all duration-1000 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                  style={{ transitionDelay: '0.3s' }}
                >
                  <div className="space-y-4">
                    <p className="text-lg sm:text-xl lg:text-2xl font-light text-foreground/90 leading-relaxed">
                      {subtitle}
                    </p>
                  </div>
                </div>

                {/* CTAs */}
                <div 
                  className={`flex flex-col sm:flex-row items-stretch sm:items-start gap-3 transition-all duration-1000 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                  style={{ 
                    transitionDelay: '0.4s',
                    paddingBottom: 'max(12px, env(safe-area-inset-bottom))'
                  }}
                >
                  {/* Primary: Launch AI Assistant */}
                  <Button
                    size="lg"
                    onClick={() => setShowVanessaChat(true)}
                    className="group relative overflow-hidden px-8 text-base bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white font-semibold transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-[0_0_30px_rgba(139,92,246,0.4)]"
                    style={{
                      minHeight: '56px',
                      borderRadius: '14px',
                      width: '100%',
                      maxWidth: 'clamp(100%, 100%, 280px)'
                    }}
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
                    className="group relative overflow-hidden px-8 text-base border-2 border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 font-medium backdrop-blur-sm bg-white/60 transition-all duration-300 shadow-sm hover:shadow-md"
                    style={{
                      minHeight: '56px',
                      borderRadius: '14px',
                      width: '100%',
                      maxWidth: 'clamp(100%, 100%, 280px)'
                    }}
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

              {/* Right Side: Breathing Radial Orb */}
              <div className="absolute lg:relative inset-0 lg:inset-auto flex items-center justify-center lg:justify-end pointer-events-none -z-10 lg:z-auto">
                <div 
                  className="relative"
                  style={{
                    width: typeof window !== 'undefined' && window.innerWidth <= 640 
                      ? 'clamp(680px, 120vw, 1200px)' 
                      : 'clamp(420px, 44vw, 820px)',
                    aspectRatio: '1/1',
                    opacity: 1,
                    overflow: 'visible'
                  }}
                >
                  {/* Fixed container - light flows inside, no shape scaling */}
                  <div className="absolute inset-0" style={{ overflow: 'visible' }}>
                    {/* First flowing gradient layer - light pulses from center outward */}
                    <div 
                      className="absolute inset-0 bg-gradient-to-tr from-violet-500/30 via-blue-500/30 to-cyan-500/30 rounded-full"
                      style={{
                        animation: prefersReducedMotion ? 'none' : 'organicFloat 7s ease-in-out infinite, flowingGradient1 7s ease-in-out infinite',
                        backgroundPosition: 'center',
                        transformOrigin: '50% 50%'
                      }}
                    ></div>
                    {/* Second flowing gradient layer - synchronized energy flow */}
                    <div 
                      className="absolute inset-0 bg-gradient-to-bl from-blue-500/40 via-violet-500/40 to-purple-500/40 rounded-full"
                      style={{
                        animation: prefersReducedMotion ? 'none' : 'organicSpin 20s linear infinite, flowingGradient2 7s ease-in-out infinite',
                        backgroundPosition: 'center',
                        transformOrigin: '50% 50%'
                      }}
                    ></div>
                  </div>
                </div>
              </div>

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
    </div>
  );
}
