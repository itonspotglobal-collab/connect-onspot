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
    <footer className="relative overflow-hidden bg-sidebar">
      {/* Enhanced Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-sidebar-accent/20 rounded-full blur-2xl animate-pulse"></div>
        <div className="absolute -top-10 -right-10 w-56 h-56 bg-sidebar-accent/15 rounded-full blur-2xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/3 w-32 h-32 bg-sidebar-accent/10 rounded-full blur-xl animate-pulse delay-500"></div>
        {/* Geometric accents */}
        <div className="absolute top-8 right-1/4 w-2 h-16 bg-sidebar-accent/25 rounded-full rotate-12 animate-pulse delay-700"></div>
        <div className="absolute bottom-12 left-1/4 w-2 h-12 bg-sidebar-accent/20 rounded-full -rotate-12 animate-pulse delay-300"></div>
      </div>
      
      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* Company Info and Navigation */}
        <div className="space-y-6">
          {/* Company Info */}
          <div className="space-y-4">
            <div className="relative">
              <img 
                src={onspotLogo} 
                alt="OnSpot" 
                className="h-10 w-auto drop-shadow-lg relative z-10"
              />
            </div>
            <p className="text-sidebar-foreground/90 max-w-lg leading-relaxed text-sm font-light">
              The growth engine behind modern businesses—built by entrepreneurs, for entrepreneurs. We deliver world-class teams and performance systems that slash costs by up to 70% while unlocking up to 8X faster growth.
            </p>
            <div className="flex space-x-2">
              <Button variant="ghost" size="sm" className="text-sidebar-foreground border border-sidebar-border hover-elevate" asChild data-testid="social-facebook">
                <a href="https://facebook.com/onspot" target="_blank" rel="noopener noreferrer" aria-label="Follow us on Facebook">
                  <Facebook className="h-4 w-4" />
                </a>
              </Button>
              <Button variant="ghost" size="sm" className="text-sidebar-foreground border border-sidebar-border hover-elevate" asChild data-testid="social-twitter">
                <a href="https://twitter.com/onspot" target="_blank" rel="noopener noreferrer" aria-label="Follow us on Twitter">
                  <Twitter className="h-4 w-4" />
                </a>
              </Button>
              <Button variant="ghost" size="sm" className="text-sidebar-foreground border border-sidebar-border hover-elevate" asChild data-testid="social-linkedin">
                <a href="https://linkedin.com/company/onspot" target="_blank" rel="noopener noreferrer" aria-label="Follow us on LinkedIn">
                  <Linkedin className="h-4 w-4" />
                </a>
              </Button>
              <Button variant="ghost" size="sm" className="text-sidebar-foreground border border-sidebar-border hover-elevate" asChild data-testid="social-youtube">
                <a href="https://youtube.com/onspot" target="_blank" rel="noopener noreferrer" aria-label="Subscribe to our YouTube channel">
                  <Youtube className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>

          {/* Compact Navigation Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {/* Services */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sidebar-foreground text-base tracking-wide border-b border-sidebar-border pb-2">Solutions</h3>
              <ul className="space-y-2 text-sidebar-foreground/80 text-sm">
                <li><Link href="/hire-talent" className="hover:text-sidebar-foreground transition-all duration-200 hover:translate-x-1" data-testid="footer-hire-talent">Hire Talent</Link></li>
                <li><Link href="/get-hired" className="hover:text-sidebar-foreground transition-all duration-200 hover:translate-x-1" data-testid="footer-careers">Careers</Link></li>
                <li><Link href="/pricing" className="hover:text-sidebar-foreground transition-all duration-200 hover:translate-x-1" data-testid="footer-pricing">Pricing</Link></li>
                <li><Link href="/enterprise" className="hover:text-sidebar-foreground transition-all duration-200 hover:translate-x-1" data-testid="footer-enterprise">Enterprise Solutions</Link></li>
              </ul>
            </div>

            {/* Company */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sidebar-foreground text-base tracking-wide border-b border-sidebar-border pb-2">Company</h3>
              <ul className="space-y-2 text-sidebar-foreground/80 text-sm">
                <li><Link href="/why-onspot" className="hover:text-sidebar-foreground transition-all duration-200 hover:translate-x-1" data-testid="footer-why-onspot">Why OnSpot</Link></li>
                <li><Link href="/amazing" className="hover:text-sidebar-foreground transition-all duration-200 hover:translate-x-1" data-testid="footer-amazing">Amazing Stories</Link></li>
                <li><Link href="/insights" className="hover:text-sidebar-foreground transition-all duration-200 hover:translate-x-1" data-testid="footer-insights">Insights</Link></li>
                <li><Link href="/affiliate-marketing" className="hover:text-sidebar-foreground transition-all duration-200 hover:translate-x-1" data-testid="footer-affiliate-marketing">Affiliate Marketing</Link></li>
                <li><Link href="/bpo-partner" className="hover:text-sidebar-foreground transition-all duration-200 hover:translate-x-1" data-testid="footer-bpo-partner">BPO Partner</Link></li>
                <li><Link href="/investors" className="hover:text-sidebar-foreground transition-all duration-200 hover:translate-x-1" data-testid="footer-investors">Investors Corner</Link></li>
                <li><a href="#" className="hover:text-sidebar-foreground transition-all duration-200 hover:translate-x-1" data-testid="footer-about">About Us</a></li>
              </ul>
            </div>

            {/* Contact */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sidebar-foreground text-base tracking-wide border-b border-sidebar-border pb-2">Contact Us</h3>
              <ul className="space-y-2.5 text-sidebar-foreground/80 text-sm">
                <li className="flex items-center space-x-3 hover:text-sidebar-foreground transition-colors duration-200">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>hello@onspot.com</span>
                </li>
                <li className="flex items-center space-x-3 hover:text-sidebar-foreground transition-colors duration-200">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>1 718 540 5053</span>
                </li>
                <li className="flex items-start space-x-3 hover:text-sidebar-foreground transition-colors duration-200">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <span>New York, NY<br />Manila, Philippines</span>
                </li>
              </ul>
              
              <div className="mt-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="border-sidebar-border hover-elevate w-full"
                  asChild
                  data-testid="footer-contact-cta"
                >
                  <Link href="/lead-intake">
                    <Mail className="h-4 w-4 mr-2" />
                    Contact Us
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <Separator className="my-6 bg-sidebar-border" />

        {/* Bottom Row */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end space-y-4 lg:space-y-0">
          {/* Left Side - Tagline and Rights */}
          <div className="space-y-1.5">
            <p className="text-base font-semibold text-sidebar-foreground tracking-wide">
              Making Outsourcing Easy
            </p>
            <div className="text-xs text-muted-foreground">
              © 2024 OnSpot. All rights reserved.
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-1">
              <a href="#" className="hover:text-sidebar-foreground transition-colors duration-200" data-testid="footer-privacy">Privacy Policy</a>
              <a href="#" className="hover:text-sidebar-foreground transition-colors duration-200" data-testid="footer-terms">Terms of Service</a>
              <a href="#" className="hover:text-sidebar-foreground transition-colors duration-200" data-testid="footer-cookies">Cookie Policy</a>
            </div>
          </div>
          
          {/* Right Side - Download Platform */}
          <div className="space-y-3">
            <div className="flex items-center justify-start lg:justify-end space-x-2">
              <Smartphone className="h-5 w-5 text-sidebar-foreground" />
              <h3 className="text-lg font-semibold text-sidebar-foreground">Download Our Platform</h3>
            </div>
            <p className="text-sidebar-foreground/80 text-xs max-w-xs lg:text-right leading-relaxed">
              Take OnSpot with you wherever you go. Manage projects and track progress on the move.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-2 lg:justify-end">
              <Button 
                variant="outline" 
                size="sm" 
                className="border-sidebar-border hover-elevate"
                asChild
                data-testid="download-ios"
              >
                <a href="#" aria-label="Download on App Store">
                  <SiApple className="h-4 w-4 mr-2" />
                  <div className="text-left">
                    <div className="text-xs opacity-90">Download on the</div>
                    <div className="font-semibold text-xs">App Store</div>
                  </div>
                </a>
              </Button>
              
              <Button 
                variant="outline" 
                size="sm" 
                className="border-sidebar-border hover-elevate"
                asChild
                data-testid="download-android"
              >
                <a href="#" aria-label="Get it on Google Play">
                  <SiGoogleplay className="h-4 w-4 mr-2" />
                  <div className="text-left">
                    <div className="text-xs opacity-90">Get it on</div>
                    <div className="font-semibold text-xs">Google Play</div>
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