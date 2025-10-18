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
  const [showTitle, setShowTitle] = useState(false);
  const [showSubtitle, setShowSubtitle] = useState(false);
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const comingSoonText = "COMING SOON";
  
  useEffect(() => {
    if (prefersReducedMotion) {
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

  return (
    <div 
      className="w-full flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        minHeight: '100svh',
        background: 'radial-gradient(ellipse at center, #ffffff 0%, #fdfbff 40%, #f8f6fe 100%)'
      }}
    >
      {/* Ambient glow orbs for depth */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-gradient-radial from-violet-500/10 to-transparent rounded-full blur-3xl animate-gentle-pulse"></div>
        <div className="absolute bottom-1/4 right-1/3 w-[500px] h-[500px] bg-gradient-radial from-blue-500/10 to-transparent rounded-full blur-3xl animate-gentle-pulse" style={{ animationDelay: '1.5s' }}></div>
      </div>

      {/* Content Container - perfectly centered */}
      <div className="container mx-auto px-6 relative z-10 flex items-center justify-center" style={{ minHeight: '100svh' }}>
        <div 
          className="text-center flex flex-col items-center w-full max-w-5xl"
          style={{
            gap: 'clamp(16px, 3vh, 40px)'
          }}
        >
          {/* Pulsing OnSpot Logo - Main Focus */}
          <div className="relative mb-8">
            <div className="relative group">
              {/* Pulsing gradient glow effect - similar to homepage */}
              <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-blue-600 rounded-full blur-3xl opacity-40 group-hover:opacity-60 transition-opacity duration-500 animate-gentle-pulse"></div>
              
              {/* OnSpot Logo Container */}
              <div 
                className="relative bg-white/80 backdrop-blur-sm rounded-3xl p-8 sm:p-10 lg:p-12 border border-white/40 shadow-xl"
                style={{
                  width: 'clamp(280px, 40vw, 420px)',
                  height: 'auto'
                }}
              >
                <img
                  src={onspotLogo}
                  alt="OnSpot"
                  className="w-full h-auto"
                  data-testid="logo-onspot"
                />
              </div>

              {/* Secondary outer glow ring */}
              <div className="absolute inset-0 bg-gradient-to-r from-violet-400/20 to-blue-400/20 rounded-full blur-2xl opacity-60 animate-gentle-pulse scale-110" style={{ animationDelay: '1s' }}></div>
            </div>
          </div>

          {/* Coming soon tag - always visible */}
          <div 
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-full border border-violet-200/60 bg-white/70 backdrop-blur-sm shadow-sm"
            data-testid="badge-coming-soon"
          >
            <p 
              className="font-medium tracking-[0.3em] uppercase text-sm bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent"
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

          {/* Main Headline - Large, Bold, Exciting */}
          <div 
            className={`transition-all duration-1000 ${showTitle ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            <h1 
              className="font-bold tracking-tight leading-[1.1] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 bg-clip-text text-transparent"
              style={{ 
                fontSize: 'clamp(34px, 7vw, 84px)',
                maxWidth: '68ch',
                textWrap: 'balance'
              }}
              data-testid="text-title"
            >
              {title}
            </h1>
          </div>
          
          {/* Subtext - Clean, Readable */}
          <div 
            className={`transition-all duration-1000 ${showSubtitle ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            <p 
              className="font-medium text-slate-600 leading-relaxed"
              style={{ 
                fontSize: 'clamp(16px, 2.2vw, 22px)',
                maxWidth: '68ch',
                textWrap: 'balance'
              }}
              data-testid="text-subtitle"
            >
              {subtitle}
            </p>
          </div>

          {/* CTA Buttons - Gradient Primary + Glass Secondary */}
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
              className="group relative overflow-hidden min-h-[56px] px-8 text-base sm:text-lg w-full sm:w-auto bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 rounded-2xl hover:shadow-[0_0_30px_rgba(139,92,246,0.4)]"
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

          {/* Small tagline at bottom */}
          <div 
            className={`transition-all duration-1000 mt-8 ${showSubtitle ? 'opacity-100' : 'opacity-0'}`}
            style={{ transitionDelay: '0.6s' }}
          >
            <p className="text-sm text-slate-500 font-light italic">
              Where AI meets human brilliance
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
