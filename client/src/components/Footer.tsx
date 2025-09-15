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
  MapPin
} from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-background border-t">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          
          {/* Company Info */}
          <div className="space-y-4">
            <img 
              src={onspotLogo} 
              alt="OnSpot" 
              className="h-8 w-auto"
            />
            <p className="text-sm text-muted-foreground max-w-xs">
              Making Outsourcing Easy. Built by entrepreneurs, for entrepreneurs—OnSpot delivers premium teams that cut costs by up to 70% and fuel 8X business growth.
            </p>
            <div className="flex space-x-4">
              <Button variant="ghost" size="sm" data-testid="social-facebook">
                <Facebook className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" data-testid="social-twitter">
                <Twitter className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" data-testid="social-linkedin">
                <Linkedin className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" data-testid="social-youtube">
                <Youtube className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Services */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Services</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/hire-talent" data-testid="footer-hire-talent">Hire Talent</Link></li>
              <li><Link href="/get-hired" data-testid="footer-get-hired">Get Hired</Link></li>
              <li><Link href="/pricing" data-testid="footer-pricing">Pricing</Link></li>
              <li><Link href="/enterprise" data-testid="footer-enterprise">Enterprise Solutions</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Company</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/why-onspot" data-testid="footer-why-onspot">Why OnSpot</Link></li>
              <li><Link href="/amazing" data-testid="footer-amazing">Amazing Stories</Link></li>
              <li><Link href="/insights" data-testid="footer-insights">Insights</Link></li>
              <li><a href="#" data-testid="footer-careers">Careers</a></li>
              <li><a href="#" data-testid="footer-about">About Us</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Contact Us</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center space-x-2">
                <Mail className="h-4 w-4" />
                <span>hello@onspot.com</span>
              </li>
              <li className="flex items-center space-x-2">
                <Phone className="h-4 w-4" />
                <span>+1 (555) 123-4567</span>
              </li>
              <li className="flex items-start space-x-2">
                <MapPin className="h-4 w-4 mt-0.5" />
                <span>New York, NY<br />Manila, Philippines</span>
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-8" />

        {/* Bottom Row */}
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="text-sm text-muted-foreground">
            © 2024 OnSpot. All rights reserved.
          </div>
          <div className="flex space-x-6 text-sm text-muted-foreground">
            <a href="#" data-testid="footer-privacy">Privacy Policy</a>
            <a href="#" data-testid="footer-terms">Terms of Service</a>
            <a href="#" data-testid="footer-cookies">Cookie Policy</a>
          </div>
        </div>

        {/* Tagline */}
        <div className="text-center mt-8">
          <p className="text-sm font-medium text-primary">
            Making Outsourcing Easy
          </p>
        </div>
      </div>
    </footer>
  );
}