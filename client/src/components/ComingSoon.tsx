import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Sparkles, Home, Users } from "lucide-react";
import comingSoonImage from "../../../Why_OnSpot_ComingSoon.png";

interface ComingSoonProps {
  title?: string;
  subtitle?: string;
  message?: string;
  showIllustration?: boolean;
}

export function ComingSoon({ 
  title = "something good, something great",
  subtitle = "is coming soon!",
  message = "We're crafting something amazing just for you. Get ready for an incredible experience!",
  showIllustration = true
}: ComingSoonProps) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden" style={{
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #cbd5e1 100%)'
    }}>
      {/* Simplified Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 w-96 h-96 bg-gradient-to-r from-purple-200/20 to-blue-200/20 rounded-full blur-3xl animate-gentle-float transform -translate-x-1/2"></div>
        <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-gradient-to-l from-blue-200/15 to-purple-200/15 rounded-full blur-2xl animate-gentle-float delay-1000"></div>
        
        {/* Minimalist sparkles */}
        <div className="absolute top-1/3 right-1/4 text-purple-300/30">
          <Sparkles className="w-6 h-6 animate-pulse" />
        </div>
        <div className="absolute bottom-1/3 left-1/4 text-blue-300/30">
          <Sparkles className="w-4 h-4 animate-pulse delay-500" />
        </div>
      </div>

      <div className="container mx-auto px-6 relative z-10 text-center space-y-8">
        {/* Compact Illustration */}
        {showIllustration && (
          <div className="flex justify-center">
            <img 
              src={comingSoonImage} 
              alt="Coming Soon Illustration" 
              className="w-48 h-auto object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-700"
              data-testid="img-coming-soon"
            />
          </div>
        )}

        {/* Minimalist Icon & Typography */}
        <div className="space-y-6">
          {/* Clean Icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center shadow-xl">
              <Sparkles className="w-8 h-8 text-white animate-pulse" data-testid="icon-sparkles" />
            </div>
          </div>

          {/* Direct Typography */}
          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 dark:text-white leading-tight" data-testid="text-title">
              <span className="bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
                {title}
              </span>
              <br />
              <span className="text-gray-700 dark:text-gray-300 font-light text-3xl md:text-4xl lg:text-5xl">
                {subtitle}
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-xl mx-auto leading-relaxed font-light" data-testid="text-message">
              {message}
            </p>
          </div>
        </div>

        {/* Simple Call-to-Action */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button 
            size="lg" 
            className="group relative overflow-hidden text-base px-6 py-3 h-auto bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-xl hover:shadow-2xl transition-all duration-500 font-medium rounded-xl min-w-[180px]" 
            asChild
            data-testid="button-go-home"
          >
            <Link href="/">
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              <Home className="w-4 h-4 mr-2 transition-transform group-hover:scale-110" />
              Go Home
            </Link>
          </Button>
          
          <Button 
            variant="outline" 
            size="lg" 
            className="group relative overflow-hidden text-base px-6 py-3 h-auto border-2 border-white/40 text-gray-700 dark:text-gray-200 hover:bg-white/20 dark:hover:bg-white/10 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-500 font-medium rounded-xl min-w-[180px]" 
            asChild
            data-testid="button-hire-talent"
          >
            <Link href="/hire-talent">
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              <Users className="w-4 h-4 mr-2 transition-transform group-hover:scale-110" />
              Hire Talent
            </Link>
          </Button>
        </div>

        {/* Minimal Footer */}
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400 font-medium" data-testid="text-footer">
            ✨ Stay tuned for something extraordinary! ✨
          </p>
        </div>
      </div>
    </div>
  );
}