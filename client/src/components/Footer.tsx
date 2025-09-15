import { Link } from "wouter";
import onspotLogo from "@assets/OnSpot Log Full Purple Blue_1757942805752.png";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Facebook, 
  Twitter, 
  Linkedin, 
  Youtube,
  Mail,
  Phone,
  MapPin,
  Smartphone,
} from "lucide-react";
import { SiApple, SiGoogleplay } from "react-icons/si";

export function Footer() {
  return (
    <footer className="relative overflow-hidden" style={{
      background: 'linear-gradient(135deg, #474ead 0%, #5a5dc7 50%, #6366f1 100%)'
    }}>
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-white/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-white/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>
      
      <div className="container mx-auto px-4 py-12 relative z-10">
        {/* Company Info and Navigation */}
        <div className="space-y-8">
          {/* Company Info */}
          <div className="space-y-6">
            <img 
              src={onspotLogo} 
              alt="OnSpot" 
              className="h-10 w-auto brightness-0 saturate-100 invert drop-shadow-sm"
            />
            <p className="text-white/90 max-w-md leading-relaxed">
              The growth engine behind modern businesses—built by entrepreneurs, for entrepreneurs. We deliver world-class teams and performance systems that slash costs by up to 70% while unlocking up to 8X faster growth.
            </p>
            <div className="flex space-x-3">
              <Button variant="ghost" size="sm" className="text-white/80 border border-white/30" asChild data-testid="social-facebook">
                <a href="https://facebook.com/onspot" target="_blank" rel="noopener noreferrer" aria-label="Follow us on Facebook">
                  <Facebook className="h-5 w-5" />
                </a>
              </Button>
              <Button variant="ghost" size="sm" className="text-white/80 border border-white/30" asChild data-testid="social-twitter">
                <a href="https://twitter.com/onspot" target="_blank" rel="noopener noreferrer" aria-label="Follow us on Twitter">
                  <Twitter className="h-5 w-5" />
                </a>
              </Button>
              <Button variant="ghost" size="sm" className="text-white/80 border border-white/30" asChild data-testid="social-linkedin">
                <a href="https://linkedin.com/company/onspot" target="_blank" rel="noopener noreferrer" aria-label="Follow us on LinkedIn">
                  <Linkedin className="h-5 w-5" />
                </a>
              </Button>
              <Button variant="ghost" size="sm" className="text-white/80 border border-white/30" asChild data-testid="social-youtube">
                <a href="https://youtube.com/onspot" target="_blank" rel="noopener noreferrer" aria-label="Subscribe to our YouTube channel">
                  <Youtube className="h-5 w-5" />
                </a>
              </Button>
            </div>
          </div>

          {/* Left Side Navigation Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Services */}
            <div className="space-y-4">
              <h3 className="font-semibold text-white text-lg">Services</h3>
              <ul className="space-y-3 text-white/80">
                <li><Link href="/hire-talent" className="hover:text-white transition-colors" data-testid="footer-hire-talent">Hire Talent</Link></li>
                <li><Link href="/get-hired" className="hover:text-white transition-colors" data-testid="footer-get-hired">Get Hired</Link></li>
                <li><Link href="/pricing" className="hover:text-white transition-colors" data-testid="footer-pricing">Pricing</Link></li>
                <li><Link href="/enterprise" className="hover:text-white transition-colors" data-testid="footer-enterprise">Enterprise Solutions</Link></li>
              </ul>
            </div>

            {/* Company */}
            <div className="space-y-4">
              <h3 className="font-semibold text-white text-lg">Company</h3>
              <ul className="space-y-3 text-white/80">
                <li><Link href="/why-onspot" className="hover:text-white transition-colors" data-testid="footer-why-onspot">Why OnSpot</Link></li>
                <li><Link href="/amazing" className="hover:text-white transition-colors" data-testid="footer-amazing">Amazing Stories</Link></li>
                <li><Link href="/insights" className="hover:text-white transition-colors" data-testid="footer-insights">Insights</Link></li>
                <li><a href="#" className="hover:text-white transition-colors" data-testid="footer-careers">Careers</a></li>
                <li><a href="#" className="hover:text-white transition-colors" data-testid="footer-about">About Us</a></li>
              </ul>
            </div>

            {/* Contact */}
            <div className="space-y-4">
              <h3 className="font-semibold text-white text-lg">Contact Us</h3>
              <ul className="space-y-4 text-white/80">
                <li className="flex items-center space-x-3">
                  <Mail className="h-5 w-5 text-white/60" />
                  <span>hello@onspot.com</span>
                </li>
                <li className="flex items-center space-x-3">
                  <Phone className="h-5 w-5 text-white/60" />
                  <span>+1 (555) 123-4567</span>
                </li>
                <li className="flex items-start space-x-3">
                  <MapPin className="h-5 w-5 mt-0.5 text-white/60" />
                  <span>New York, NY<br />Manila, Philippines</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <Separator className="my-8 bg-white/20" />

        {/* Bottom Row */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end space-y-6 lg:space-y-0">
          {/* Left Side - Tagline and Rights */}
          <div className="space-y-2">
            <p className="text-lg font-medium text-white">
              Making Outsourcing Easy
            </p>
            <div className="text-sm text-white/70">
              © 2024 OnSpot. All rights reserved.
            </div>
            <div className="flex flex-wrap gap-6 text-sm text-white/70 pt-2">
              <a href="#" className="hover:text-white transition-colors" data-testid="footer-privacy">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors" data-testid="footer-terms">Terms of Service</a>
              <a href="#" className="hover:text-white transition-colors" data-testid="footer-cookies">Cookie Policy</a>
            </div>
          </div>
          
          {/* Right Side - Download Platform */}
          <div className="space-y-4">
            <div className="flex items-center justify-start lg:justify-end space-x-3">
              <Smartphone className="h-6 w-6 text-white" />
              <h3 className="text-xl font-bold text-white">Download Our Platform</h3>
            </div>
            <p className="text-white/90 text-sm max-w-sm lg:text-right">
              Take OnSpot with you wherever you go. Manage projects and track progress on the move.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 lg:justify-end">
              <Button 
                variant="outline" 
                size="sm" 
                className="bg-black text-white border-white/30"
                asChild
                data-testid="download-ios"
              >
                <a href="#" aria-label="Download on App Store">
                  <SiApple className="h-5 w-5 mr-2" />
                  <div className="text-left">
                    <div className="text-xs opacity-80">Download on the</div>
                    <div className="font-semibold text-sm">App Store</div>
                  </div>
                </a>
              </Button>
              
              <Button 
                variant="outline" 
                size="sm" 
                className="bg-black text-white border-white/30"
                asChild
                data-testid="download-android"
              >
                <a href="#" aria-label="Get it on Google Play">
                  <SiGoogleplay className="h-5 w-5 mr-2" />
                  <div className="text-left">
                    <div className="text-xs opacity-80">Get it on</div>
                    <div className="font-semibold text-sm">Google Play</div>
                  </div>
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}