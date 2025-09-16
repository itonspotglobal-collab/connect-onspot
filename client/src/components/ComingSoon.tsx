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
  title = "Too much of a good thing",
  subtitle = "coming soon!",
  message = "We're crafting something amazing just for you. Get ready for an incredible experience!",
  showIllustration = true
}: ComingSoonProps) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden" style={{
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #cbd5e1 100%)'
    }}>
      {/* Playful Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -left-20 w-80 h-80 bg-gradient-to-r from-purple-200/30 to-blue-200/30 rounded-full blur-3xl animate-gentle-float"></div>
        <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-gradient-to-l from-blue-200/20 to-purple-200/20 rounded-full blur-3xl animate-gentle-float delay-1000"></div>
        <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-gradient-to-br from-indigo-200/25 to-purple-200/25 rounded-full blur-2xl animate-gentle-float delay-500"></div>
        
        {/* Floating sparkles */}
        <div className="absolute top-1/4 right-1/4 text-purple-300/40">
          <Sparkles className="w-8 h-8 animate-pulse" />
        </div>
        <div className="absolute bottom-1/3 left-1/3 text-blue-300/40">
          <Sparkles className="w-6 h-6 animate-pulse delay-700" />
        </div>
        <div className="absolute top-2/3 right-1/3 text-indigo-300/40">
          <Sparkles className="w-4 h-4 animate-pulse delay-300" />
        </div>
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <Card className="max-w-4xl mx-auto bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-white/20 shadow-2xl hover-elevate">
          <CardContent className="p-12 text-center space-y-8">
            {/* Illustration */}
            {showIllustration && (
              <div className="flex justify-center mb-8">
                <div className="relative">
                  <img 
                    src={comingSoonImage} 
                    alt="Coming Soon Illustration" 
                    className="w-64 h-auto object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-700"
                    data-testid="img-coming-soon"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-white/10 to-transparent rounded-2xl"></div>
                </div>
              </div>
            )}

            {/* Main Content */}
            <div className="space-y-6">
              {/* Playful Icon */}
              <div className="flex justify-center">
                <div className="relative">
                  <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center shadow-2xl">
                    <Sparkles className="w-10 h-10 text-white animate-pulse" data-testid="icon-sparkles" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl blur-xl opacity-50 animate-pulse"></div>
                </div>
              </div>

              {/* Playful Typography */}
              <div className="space-y-4">
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-gray-900 dark:text-white leading-tight" data-testid="text-title">
                  <span className="bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    {title}
                  </span>
                  <br />
                  <span className="text-gray-800 dark:text-gray-200 font-light">
                    {subtitle}
                  </span>
                </h1>
                
                <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed font-light" data-testid="text-message">
                  {message}
                </p>
              </div>
            </div>

            <Separator className="my-8 bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent h-px" />

            {/* Call to Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Button 
                size="lg" 
                className="group relative overflow-hidden text-lg px-8 py-4 h-auto bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-2xl hover:shadow-3xl transition-all duration-500 font-medium rounded-xl min-w-[200px]" 
                asChild
                data-testid="button-go-home"
              >
                <Link href="/">
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                  <Home className="w-5 h-5 mr-3 transition-transform group-hover:scale-110" />
                  Go Home
                </Link>
              </Button>
              
              <Button 
                variant="outline" 
                size="lg" 
                className="group relative overflow-hidden text-lg px-8 py-4 h-auto border-2 border-purple-300 dark:border-purple-600 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 shadow-xl hover:shadow-2xl transition-all duration-500 font-medium rounded-xl min-w-[200px]" 
                asChild
                data-testid="button-hire-talent"
              >
                <Link href="/hire-talent">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-100/0 via-purple-100/20 to-purple-100/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                  <Users className="w-5 h-5 mr-3 transition-transform group-hover:scale-110" />
                  Hire Talent
                </Link>
              </Button>
            </div>

            {/* Playful Footer Message */}
            <div className="pt-6">
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium" data-testid="text-footer">
                ✨ Stay tuned for something extraordinary! ✨
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}