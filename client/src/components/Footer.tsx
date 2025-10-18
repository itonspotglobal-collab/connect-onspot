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

      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 relative z-10">
        {/* Company Info and Navigation */}
        <div className="space-y-8 sm:space-y-10">
          {/* Company Info */}
          <div className="space-y-4 sm:space-y-5">
            <div className="relative">
              <img
                src={onspotLogo}
                alt="OnSpot"
                className="h-8 sm:h-10 w-auto brightness-0 saturate-100 invert drop-shadow-lg relative z-10"
              />
              {/* Logo glow effect */}
              <div className="absolute inset-0 bg-white/20 blur-lg rounded-lg opacity-30"></div>
            </div>
            <p className="text-white/95 max-w-lg leading-relaxed text-sm sm:text-base font-light">
              The growth engine of the modern era. Built by entrepreneurs, for entrepreneurs—our Superhuman System fuses AI-first infrastructure with human excellence to scale businesses and empower people to perform beyond limits.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-white/90 border border-white/20 bg-white/5 hover-elevate min-h-[44px] min-w-[44px]"
                asChild
                data-testid="social-facebook"
              >
                <a
                  href="https://facebook.com/onspot"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Follow us on Facebook"
                >
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
                <a
                  href="https://twitter.com/onspot"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Follow us on Twitter"
                >
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
                <a
                  href="https://linkedin.com/company/onspot"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Follow us on LinkedIn"
                >
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
                <a
                  href="https://youtube.com/onspot"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Subscribe to our YouTube channel"
                >
                  <Youtube className="h-5 w-5 sm:h-4 sm:w-4" />
                </a>
              </Button>
            </div>
          </div>

          {/* Compact Navigation Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-10">
            {/* Services */}
            <div className="space-y-5">
              <h3 className="font-semibold text-white text-base sm:text-lg tracking-wide border-b border-white/20 pb-2">
                Solutions
              </h3>
              <ul className="space-y-2.5 sm:space-y-2 text-white/85 text-sm sm:text-base pt-1">
                <li>
                  <Link
                    href="/hire-talent"
                    className="hover:text-white transition-all duration-200 hover:translate-x-1 inline-block py-1"
                    data-testid="footer-hire-talent"
                  >
                    Hire Talent
                  </Link>
                </li>
                <li>
                  <Link
                    href="/get-hired"
                    className="hover:text-white transition-all duration-200 hover:translate-x-1"
                    data-testid="footer-careers"
                  >
                    Careers
                  </Link>
                </li>
                <li>
                  <Link
                    href="/powerapp"
                    className="hover:text-white transition-all duration-200 hover:translate-x-1"
                    data-testid="footer-powerapp"
                  >
                    Powerapp
                  </Link>
                </li>
                <li>
                  <Link
                    href="/pricing"
                    className="hover:text-white transition-all duration-200 hover:translate-x-1"
                    data-testid="footer-pricing"
                  >
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link
                    href="/enterprise"
                    className="hover:text-white transition-all duration-200 hover:translate-x-1"
                    data-testid="footer-enterprise"
                  >
                    Enterprise Solutions
                  </Link>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div className="space-y-5">
              <h3 className="font-semibold text-white text-base sm:text-lg tracking-wide border-b border-white/20 pb-2">
                Company
              </h3>
              <ul className="space-y-2.5 sm:space-y-2 text-white/85 text-sm sm:text-base pt-1">
                <li>
                  <Link
                    href="/why-onspot"
                    className="hover:text-white transition-all duration-200 hover:translate-x-1"
                    data-testid="footer-why-onspot"
                  >
                    Why OnSpot
                  </Link>
                </li>
                <li>
                  <Link
                    href="/amazing"
                    className="hover:text-white transition-all duration-200 hover:translate-x-1"
                    data-testid="footer-amazing"
                  >
                    Amazing Stories
                  </Link>
                </li>
                <li>
                  <Link
                    href="/insights"
                    className="hover:text-white transition-all duration-200 hover:translate-x-1"
                    data-testid="footer-insights"
                  >
                    Insights
                  </Link>
                </li>
                <li>
                  <Link
                    href="/affiliate-marketing"
                    className="hover:text-white transition-all duration-200 hover:translate-x-1"
                    data-testid="footer-affiliate-marketing"
                  >
                    Affiliate Marketing
                  </Link>
                </li>
                <li>
                  <Link
                    href="/bpo-partner"
                    className="hover:text-white transition-all duration-200 hover:translate-x-1"
                    data-testid="footer-bpo-partner"
                  >
                    BPO Partner
                  </Link>
                </li>
                <li>
                  <Link
                    href="/investors"
                    className="hover:text-white transition-all duration-200 hover:translate-x-1"
                    data-testid="footer-investors"
                  >
                    Investors Corner
                  </Link>
                </li>
                <li>
                  <a
                    href="#"
                    className="hover:text-white transition-all duration-200 hover:translate-x-1"
                    data-testid="footer-about"
                  >
                    About Us
                  </a>
                </li>
              </ul>
            </div>

            {/* Contact */}
            <div className="space-y-5">
              <h3 className="font-semibold text-white text-base sm:text-lg tracking-wide border-b border-white/20 pb-2">
                Contact Us
              </h3>
              <ul className="space-y-3 sm:space-y-2.5 text-white/85 text-sm sm:text-base pt-1">
                <li className="flex items-center space-x-3 hover:text-white transition-colors duration-200">
                  <Mail className="h-4 w-4 text-white/70" />
                  <span>hello@onspot.com</span>
                </li>
                <li className="flex items-center space-x-3 hover:text-white transition-colors duration-200">
                  <Phone className="h-4 w-4 text-white/70" />
                  <span>1 718 540 5053</span>
                </li>
                <li className="flex items-start space-x-3 hover:text-white transition-colors duration-200">
                  <MapPin className="h-4 w-4 mt-0.5 text-white/70" />
                  <span>
                    New York, NY
                    <br />
                    Manila, Philippines
                  </span>
                </li>
              </ul>

              <div className="mt-4 sm:mt-5">
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
        </div>

        <Separator className="my-8 sm:my-10 bg-white/30" />

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

          {/* Right Side - Download Platform */}
          <div className="space-y-3 sm:space-y-4 w-full lg:w-auto">
            <div className="flex items-center justify-start lg:justify-end space-x-2">
              <Smartphone className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              <h3 className="text-base sm:text-lg font-semibold text-white">
                Download Our Platform
              </h3>
            </div>
            <p className="text-white/90 text-xs sm:text-sm max-w-xs lg:text-right leading-relaxed">
              Take OnSpot with you wherever you go. Manage projects and track
              progress on the move.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 lg:justify-end">
              <Button
                variant="outline"
                size="sm"
                className="bg-black/80 text-white border-white/40 hover-elevate backdrop-blur-sm min-h-[48px] sm:min-h-[44px]"
                asChild
                data-testid="download-ios"
              >
                <Link href="/pricing" aria-label="Download on App Store">
                  <SiApple className="h-5 w-5 sm:h-4 sm:w-4 mr-2" />
                  <div className="text-left">
                    <div className="text-xs opacity-90">Download on the</div>
                    <div className="font-semibold text-sm sm:text-xs">App Store</div>
                  </div>
                </Link>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="bg-black/80 text-white border-white/40 hover-elevate backdrop-blur-sm min-h-[48px] sm:min-h-[44px]"
                asChild
                data-testid="download-android"
              >
                <Link href="/pricing" aria-label="Get it on Google Play">
                  <SiGoogleplay className="h-5 w-5 sm:h-4 sm:w-4 mr-2" />
                  <div className="text-left">
                    <div className="text-xs opacity-90">Get it on</div>
                    <div className="font-semibold text-sm sm:text-xs">Google Play</div>
                  </div>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
