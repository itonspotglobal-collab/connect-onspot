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
} from "lucide-react";

export function Footer() {
  return (
    <footer
      className="relative overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, #474ead 0%, #5a5dc7 50%, #6366f1 100%)",
      }}
    >
      {/* Enhanced Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-white/8 rounded-full blur-2xl animate-pulse"></div>
        <div className="absolute -top-10 -right-10 w-56 h-56 bg-white/6 rounded-full blur-2xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/3 w-32 h-32 bg-white/4 rounded-full blur-xl animate-pulse delay-500"></div>
        {/* Geometric accents */}
        <div className="absolute top-8 right-1/4 w-2 h-16 bg-white/10 rounded-full rotate-12 animate-pulse delay-700"></div>
        <div className="absolute bottom-12 left-1/4 w-2 h-12 bg-white/8 rounded-full -rotate-12 animate-pulse delay-300"></div>
      </div>

      <div className="container mx-auto px-6 py-8 sm:py-10 relative z-10">
        {/* Single unified grid: brand col-span-2, then 5 nav columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.9fr_1fr_1fr_1fr_1fr_1.4fr] gap-y-10 lg:gap-x-16 items-start">

          {/* Brand — naturally wider via grid template */}
          <div className="space-y-4 text-left">
            <div className="relative">
              <img
                src={onspotLogo}
                alt="OnSpot"
                className="h-8 sm:h-10 w-auto brightness-0 saturate-100 invert drop-shadow-lg relative z-10"
              />
              <div className="absolute inset-0 bg-white/20 blur-lg rounded-lg opacity-30"></div>
            </div>
            <p className="text-white/95 max-w-lg leading-relaxed text-sm sm:text-base font-light">
              The growth engine of modern business. Built by entrepreneurs, for
              entrepreneurs—our Superhuman Outsourcing System fuses AI-first
              infrastructure with human excellence to scale businesses and
              empower people to perform beyond limits.
            </p>
            <div className="flex flex-wrap lg:flex-nowrap gap-3">
              <Button
                variant="ghost"
                size="sm"
                className="text-white/90 border border-white/20 bg-white/5 hover-elevate min-h-[44px] min-w-[44px]"
                asChild
                data-testid="social-facebook"
              >
                <a href="https://facebook.com/onspot" target="_blank" rel="noopener noreferrer" aria-label="Follow us on Facebook">
                  <Facebook className="h-5 w-5 sm:h-4 sm:w-4" />
                </a>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-white/90 border border-white/20 bg-white/5 hover-elevate min-h-[44px] min-w-[44px]"
                asChild
                data-testid="social-twitter"
              >
                <a href="https://twitter.com/onspot" target="_blank" rel="noopener noreferrer" aria-label="Follow us on Twitter">
                  <Twitter className="h-5 w-5 sm:h-4 sm:w-4" />
                </a>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-white/90 border border-white/20 bg-white/5 hover-elevate min-h-[44px] min-w-[44px]"
                asChild
                data-testid="social-linkedin"
              >
                <a href="https://linkedin.com/company/onspot" target="_blank" rel="noopener noreferrer" aria-label="Follow us on LinkedIn">
                  <Linkedin className="h-5 w-5 sm:h-4 sm:w-4" />
                </a>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-white/90 border border-white/20 bg-white/5 hover-elevate min-h-[44px] min-w-[44px]"
                asChild
                data-testid="social-youtube"
              >
                <a href="https://youtube.com/onspot" target="_blank" rel="noopener noreferrer" aria-label="Subscribe to our YouTube channel">
                  <Youtube className="h-5 w-5 sm:h-4 sm:w-4" />
                </a>
              </Button>
            </div>
          </div>

          {/* Navigation */}
          <div className="space-y-3">
            <h3 className="font-semibold text-white text-base sm:text-lg tracking-wide border-b border-white/20 pb-2 mb-3">
              Navigation
            </h3>
            <ul className="space-y-2 text-white/85 text-sm sm:text-base">
              <li><Link href="/legal-ops" className="hover:text-white transition-all duration-200 hover:translate-x-1 block" data-testid="footer-nav-legal-ops">LegalOps NY</Link></li>
              <li><Link href="/powerapp" className="hover:text-white transition-all duration-200 hover:translate-x-1 block" data-testid="footer-nav-powerapp">Powerapp</Link></li>
              <li><Link href="/ai-assistant" className="hover:text-white transition-all duration-200 hover:translate-x-1 block" data-testid="footer-nav-ai-assistant">AI Assistant</Link></li>
              <li><Link href="/operations-playbook" className="hover:text-white transition-all duration-200 hover:translate-x-1 block" data-testid="footer-nav-operations-playbook">Delivery Playbook</Link></li>
            </ul>
          </div>

          {/* Solutions */}
          <div className="space-y-3">
            <h3 className="font-semibold text-white text-base sm:text-lg tracking-wide border-b border-white/20 pb-2 mb-3">
              Solutions
            </h3>
            <ul className="space-y-2 text-white/85 text-sm sm:text-base">
              <li><Link href="/hire-talent" className="hover:text-white transition-all duration-200 hover:translate-x-1 block" data-testid="footer-hire-talent">Hire Talent</Link></li>
              <li><Link href="/get-hired" className="hover:text-white transition-all duration-200 hover:translate-x-1 block" data-testid="footer-careers">Careers</Link></li>
              <li><Link href="/powerapp" className="hover:text-white transition-all duration-200 hover:translate-x-1 block" data-testid="footer-powerapp">Powerapp</Link></li>
              <li><Link href="/ai-assistant" className="hover:text-white transition-all duration-200 hover:translate-x-1 block" data-testid="footer-ai-assistant">AI Assistant</Link></li>
              <li><Link href="/enterprise" className="hover:text-white transition-all duration-200 hover:translate-x-1 block" data-testid="footer-enterprise">Enterprise Solutions</Link></li>
              <li><Link href="/legal-ops" className="hover:text-white transition-all duration-200 hover:translate-x-1 block" data-testid="footer-legal-ops">LegalOps NY</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div className="space-y-3">
            <h3 className="font-semibold text-white text-base sm:text-lg tracking-wide border-b border-white/20 pb-2 mb-3">
              Company
            </h3>
            <ul className="space-y-2 text-white/85 text-sm sm:text-base">
              <li><Link href="/why-onspot" className="hover:text-white transition-all duration-200 hover:translate-x-1 block" data-testid="footer-why-onspot">Why OnSpot</Link></li>
              <li><Link href="/amazing" className="hover:text-white transition-all duration-200 hover:translate-x-1 block" data-testid="footer-amazing">Amazing Stories</Link></li>
              <li><Link href="/insights" className="hover:text-white transition-all duration-200 hover:translate-x-1 block" data-testid="footer-insights">Insights</Link></li>
              <li><Link href="/affiliate-marketing" className="hover:text-white transition-all duration-200 hover:translate-x-1 block" data-testid="footer-affiliate-marketing">Affiliate Marketing</Link></li>
              <li><Link href="/bpo-partner" className="hover:text-white transition-all duration-200 hover:translate-x-1 block" data-testid="footer-bpo-partner">BPO Partner</Link></li>
              <li><Link href="/investors" className="hover:text-white transition-all duration-200 hover:translate-x-1 block" data-testid="footer-investors">Investors Corner</Link></li>
              <li><a href="#" className="hover:text-white transition-all duration-200 hover:translate-x-1 block" data-testid="footer-about">About Us</a></li>
              <li><Link href="/operations-playbook" className="hover:text-white transition-all duration-200 hover:translate-x-1 block" data-testid="footer-operations-playbook">Delivery Playbook</Link></li>
            </ul>
          </div>

          {/* New Verticals */}
          <div className="space-y-3">
            <h3 className="font-semibold text-white text-base sm:text-lg tracking-wide border-b border-white/20 pb-2 mb-3">
              New Verticals
            </h3>
            <ul className="space-y-2 text-white/85 text-sm sm:text-base">
              <li><a href="#" className="hover:text-white transition-all duration-200 hover:translate-x-1 block">AI Human-in-the-Loop</a></li>
              <li><a href="#" className="hover:text-white transition-all duration-200 hover:translate-x-1 block">Founder Ops</a></li>
              <li><a href="#" className="hover:text-white transition-all duration-200 hover:translate-x-1 block">Healthcare Micro-Admin</a></li>
              <li><a href="#" className="hover:text-white transition-all duration-200 hover:translate-x-1 block">E-commerce Ops</a></li>
              <li><a href="#" className="hover:text-white font-medium transition-all duration-200 hover:translate-x-1 block">View all 10 →</a></li>
            </ul>
          </div>

          {/* Contact Us */}
          <div className="space-y-3">
            <h3 className="font-semibold text-white text-base sm:text-lg tracking-wide border-b border-white/20 pb-2 mb-3">
              Contact Us
            </h3>
            <ul className="space-y-2 text-white/85 text-sm sm:text-base">
              <li className="flex items-center gap-3 hover:text-white transition-colors duration-200">
                <Mail className="h-4 w-4 shrink-0 text-white/70" />
                <span>hello@onspot.com</span>
              </li>
              <li className="flex items-center gap-3 hover:text-white transition-colors duration-200">
                <Phone className="h-4 w-4 shrink-0 text-white/70" />
                <span>1-718 540 5053</span>
              </li>
              <li className="flex items-start gap-3 hover:text-white transition-colors duration-200">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-white/70" />
                <span className="max-w-[16rem] break-words">
                  US - 2248 Broadway, New York, 10024
                  <br />
                  PH - Unit No. 1702, 17th Floor High Street South Corporate Plaza Tower 2, 11th Ave Cor 26th St, Bonifacio Global City, Taguig
                </span>
              </li>
            </ul>
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                className="bg-white/10 text-white border-white/30 hover-elevate backdrop-blur-sm w-full min-h-[44px] text-sm sm:text-base"
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

        <Separator className="my-6 sm:my-8 bg-white/30" />

        {/* Bottom Row */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end space-y-6 sm:space-y-8 lg:space-y-0 gap-6">
          {/* Left Side - Tagline and Rights */}
          <div className="space-y-2 sm:space-y-2.5">
            <p className="text-base sm:text-lg font-semibold text-white tracking-wide">
              Making Outsourcing Easy
            </p>
            <div className="text-xs sm:text-sm text-white/70">
              © 2024 OnSpot. All rights reserved.
            </div>
            <div className="flex flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm text-white/70 pt-1">
              <a
                href="#"
                className="hover:text-white transition-colors duration-200"
                data-testid="footer-privacy"
              >
                Privacy Policy
              </a>
              <a
                href="#"
                className="hover:text-white transition-colors duration-200"
                data-testid="footer-terms"
              >
                Terms of Service
              </a>
              <a
                href="#"
                className="hover:text-white transition-colors duration-200"
                data-testid="footer-cookies"
              >
                Cookie Policy
              </a>
            </div>
          </div>

        </div>
      </div>
    </footer>
  );
}
