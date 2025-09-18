import { cn } from "@/lib/utils";
import { useState } from "react";

export interface ClientLogo {
  name: string;
  logo: string;
  website?: string;
  industry?: string;
}

// Premium client logos for social proof
export const DEFAULT_CLIENT_LOGOS: ClientLogo[] = [
  { name: "Microsoft", logo: "https://logo.clearbit.com/microsoft.com", website: "microsoft.com", industry: "Technology" },
  { name: "Google", logo: "https://logo.clearbit.com/google.com", website: "google.com", industry: "Technology" },
  { name: "Amazon", logo: "https://logo.clearbit.com/amazon.com", website: "amazon.com", industry: "E-commerce" },
  { name: "Apple", logo: "https://logo.clearbit.com/apple.com", website: "apple.com", industry: "Technology" },
  { name: "Netflix", logo: "https://logo.clearbit.com/netflix.com", website: "netflix.com", industry: "Entertainment" },
  { name: "Spotify", logo: "https://logo.clearbit.com/spotify.com", website: "spotify.com", industry: "Music" },
  { name: "Shopify", logo: "https://logo.clearbit.com/shopify.com", website: "shopify.com", industry: "E-commerce" },
  { name: "Slack", logo: "https://logo.clearbit.com/slack.com", website: "slack.com", industry: "Productivity" },
  { name: "Stripe", logo: "https://logo.clearbit.com/stripe.com", website: "stripe.com", industry: "Fintech" },
  { name: "Airbnb", logo: "https://logo.clearbit.com/airbnb.com", website: "airbnb.com", industry: "Travel" },
  { name: "Uber", logo: "https://logo.clearbit.com/uber.com", website: "uber.com", industry: "Transportation" },
  { name: "LinkedIn", logo: "https://logo.clearbit.com/linkedin.com", website: "linkedin.com", industry: "Social" }
];

export interface ClientLogosProps {
  logos?: ClientLogo[];
  variant?: "default" | "minimal" | "featured" | "carousel";
  maxLogos?: number;
  showNames?: boolean;
  grayscale?: boolean;
  className?: string;
  title?: string;
  subtitle?: string;
  animateOnScroll?: boolean;
  showDisclaimer?: boolean;
  disclaimerText?: string;
}

export function ClientLogos({
  logos = DEFAULT_CLIENT_LOGOS,
  variant = "default",
  maxLogos = 8,
  showNames = false,
  grayscale = true,
  className,
  title = "OnSpot talent have worked with teams at leading companies worldwide",
  subtitle,
  animateOnScroll = false,
  showDisclaimer = true,
  disclaimerText = "Logos are for illustrative purposes only and do not imply endorsement or partnership. Experience reflects work histories of individual talent, not formal affiliations."
}: ClientLogosProps) {
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  
  const displayLogos = logos.slice(0, maxLogos);

  const handleImageError = (logoName: string) => {
    setImageErrors(prev => new Set(prev).add(logoName));
  };

  const getVariantClasses = () => {
    switch (variant) {
      case "minimal":
        return {
          container: "py-8",
          logoGrid: "flex flex-wrap items-center justify-center gap-4 md:gap-6",
          logoContainer: "flex items-center justify-center h-8",
          logoImage: "h-6 w-auto",
          logoText: "text-sm font-medium text-muted-foreground"
        };
      case "featured":
        return {
          container: "py-16",
          logoGrid: "grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-8",
          logoContainer: "flex items-center justify-center p-6 bg-background rounded-lg hover-elevate h-20",
          logoImage: "h-10 w-auto",
          logoText: "text-base font-semibold text-foreground mt-2"
        };
      case "carousel":
        return {
          container: "py-12 overflow-hidden",
          logoGrid: "flex items-center gap-12 animate-scroll",
          logoContainer: "flex items-center justify-center flex-shrink-0 h-12",
          logoImage: "h-8 w-auto",
          logoText: "text-sm font-medium text-muted-foreground mt-1"
        };
      default:
        return {
          container: "py-12",
          logoGrid: "flex flex-wrap items-center justify-center gap-6 md:gap-8",
          logoContainer: "flex items-center justify-center h-12",
          logoImage: "h-8 w-auto",
          logoText: "text-sm font-medium text-muted-foreground"
        };
    }
  };

  const variantClasses = getVariantClasses();

  return (
    <section className={cn(variantClasses.container, className)} data-testid="client-logos">
      {(title || subtitle) && (
        <div className="text-center mb-8 md:mb-12">
          {subtitle && (
            <div className="text-sm text-primary font-medium mb-2">
              {subtitle}
            </div>
          )}
          {title && (
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              {title}
            </p>
          )}
        </div>
      )}

      <div className={cn(
        variantClasses.logoGrid,
        grayscale && "opacity-70 hover:opacity-100 transition-opacity duration-300"
      )}>
        {displayLogos.map((client, index) => (
          <div
            key={index}
            className={cn(
              variantClasses.logoContainer,
              "group transition-all duration-300",
              animateOnScroll && "opacity-0 translate-y-4 transition-all duration-700"
            )}
            style={{ 
              animationDelay: animateOnScroll ? `${index * 100}ms` : undefined 
            }}
            data-testid={`client-logo-${index}`}
            title={client.industry ? `${client.name} - ${client.industry}` : client.name}
          >
            {!imageErrors.has(client.name) ? (
              <img 
                src={client.logo} 
                alt={`${client.name} logo`} 
                className={cn(
                  variantClasses.logoImage,
                  grayscale && "grayscale transition-all duration-300"
                )}
                onError={() => handleImageError(client.name)}
                loading="lazy"
              />
            ) : (
              // Fallback to text if logo fails to load
              <div className={cn(
                "text-center",
                variantClasses.logoText
              )}>
                {client.name}
              </div>
            )}
            
            {showNames && !imageErrors.has(client.name) && (
              <div className={cn(variantClasses.logoText, "text-center")}>
                {client.name}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Industry Tags for Featured Variant */}
      {variant === "featured" && (
        <div className="flex flex-wrap justify-center gap-2 mt-8">
          {Array.from(new Set(displayLogos.map(logo => logo.industry).filter(Boolean))).map((industry, index) => (
            <span 
              key={index}
              className="px-3 py-1 text-xs bg-muted text-muted-foreground rounded-full"
            >
              {industry}
            </span>
          ))}
        </div>
      )}

      {/* Legal Disclaimer */}
      {showDisclaimer && (
        <div className="text-center mt-6">
          <p className="text-xs text-muted-foreground max-w-2xl mx-auto leading-relaxed" data-testid="client-logos-disclaimer">
            {disclaimerText}
          </p>
        </div>
      )}
    </section>
  );
}

export interface ClientShowcaseProps {
  logos?: ClientLogo[];
  testimonialQuote?: string;
  testimonialAuthor?: string;
  testimonialCompany?: string;
  className?: string;
  showDisclaimer?: boolean;
  disclaimerText?: string;
}

// Enhanced version with testimonial integration
export function ClientShowcase({
  logos = DEFAULT_CLIENT_LOGOS.slice(0, 6),
  testimonialQuote = "OnSpot delivers exceptional talent that transforms our projects.",
  testimonialAuthor = "Sarah Mitchell",
  testimonialCompany = "TechForward Solutions",
  className,
  showDisclaimer = true,
  disclaimerText = "Logos are for illustrative purposes only and do not imply endorsement or partnership. Experience reflects work histories of individual talent, not formal affiliations."
}: ClientShowcaseProps) {
  return (
    <section className={cn("py-16 bg-muted/30", className)} data-testid="client-showcase">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Client Logos */}
          <div>
            <h3 className="text-xl font-semibold text-foreground mb-8 text-center lg:text-left">
              Trusted by Leading Companies
            </h3>
            <div className="grid grid-cols-3 gap-6">
              {logos.map((client, index) => (
                <div
                  key={index}
                  className="flex items-center justify-center p-4 bg-background rounded-lg h-16"
                  data-testid={`showcase-logo-${index}`}
                >
                  <img 
                    src={client.logo} 
                    alt={`${client.name} logo`} 
                    className="h-8 w-auto grayscale opacity-70 transition-all duration-300"
                    onError={(e) => {
                      const target = e.currentTarget as HTMLElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        parent.innerHTML = `<span class="text-sm font-medium text-muted-foreground">${client.name}</span>`;
                      }
                    }}
                  />
                </div>
              ))}
            </div>
            
            {/* Legal Disclaimer for Showcase */}
            {showDisclaimer && (
              <div className="text-center lg:text-left mt-4">
                <p className="text-xs text-muted-foreground leading-relaxed" data-testid="client-showcase-disclaimer">
                  {disclaimerText}
                </p>
              </div>
            )}
          </div>

          {/* Testimonial */}
          <div className="text-center lg:text-left">
            <blockquote className="text-2xl font-medium text-foreground mb-6 leading-relaxed">
              "{testimonialQuote}"
            </blockquote>
            <div>
              <div className="font-semibold text-foreground">{testimonialAuthor}</div>
              <div className="text-muted-foreground">{testimonialCompany}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// CSS for carousel animation (add to global styles)
export const CLIENT_LOGOS_STYLES = `
@keyframes scroll {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}

.animate-scroll {
  animation: scroll 30s linear infinite;
}
`;