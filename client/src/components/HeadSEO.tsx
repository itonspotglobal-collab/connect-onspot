import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { getRegionForPath } from '@/config/geo-map';

/**
 * HeadSEO - Dynamic SEO and schema injection for dual geo-targeting (US + PH)
 * 
 * Features:
 * - Brand visible: "OnSpot"
 * - Legal name hidden in schema: "OnSpot Global" (ranking continuity)
 * - US pages: Service schema with US area served
 * - PH pages: EmploymentAgency schema with Cebu City location
 * - No visible content changes - all meta/schema only
 */

interface HeadSEOProps {
  title?: string;
  description?: string;
  ogImage?: string;
  /** Override og:type (default "website"). Use "article" for blog posts. */
  ogType?: string;
  /** Explicit canonical URL override. Falls back to domain + current location. */
  canonical?: string;
  /** Optional Article JSON-LD data for blog posts */
  articleSchema?: {
    headline: string;
    description: string;
    image: string;
    datePublished: string;
    dateModified?: string;
    author: string;
    url: string;
  };
}

export function HeadSEO({ 
  title = "Work Without Limits | OnSpot",
  description = "Work Without Limits. OnSpot connects companies with vetted, accountable talent — no marketplace chaos, no outsourcing overhead.",
  ogImage = "https://onspotglobal.com/new-onspot.png",
  ogType = "website",
  canonical,
  articleSchema,
}: HeadSEOProps) {
  const [location] = useLocation();
  const region = getRegionForPath(location);

  useEffect(() => {
    // Update page title
    document.title = title;

    // Helper to update/create meta tags
    const updateMetaTag = (property: string, content: string) => {
      let meta = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("property", property);
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", content);
    };

    const updateMetaName = (name: string, content: string) => {
      let meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", name);
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", content);
    };

    // Resolve canonical URL: explicit override wins, otherwise derive from domain + path
    const canonicalHref = canonical ?? `https://www.onspotglobal.com${location}`;

    // Update canonical link tag
    let canonicalEl = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonicalEl) {
      canonicalEl = document.createElement("link");
      canonicalEl.setAttribute("rel", "canonical");
      document.head.appendChild(canonicalEl);
    }
    canonicalEl.setAttribute("href", canonicalHref);

    // Update basic meta tags
    updateMetaName("description", description);
    updateMetaName("application-name", "OnSpot");
    
    // Update Open Graph tags
    updateMetaTag("og:site_name", "OnSpot");
    updateMetaTag("og:title", title);
    updateMetaTag("og:description", description);
    updateMetaTag("og:type", ogType);
    updateMetaTag("og:url", canonicalHref);
    updateMetaTag("og:image", ogImage);
    
    // Update Twitter Card tags
    updateMetaName("twitter:card", "summary_large_image");
    updateMetaName("twitter:title", title);
    updateMetaName("twitter:description", description);
    updateMetaName("twitter:image", ogImage);

    // GEO-specific meta tags
    if (region === "US") {
      updateMetaName("geo.region", "US");
      updateMetaName("geo.placename", "United States");
      
      // Remove PH-specific tags if they exist
      document.querySelector('meta[name="geo.position"]')?.remove();
      document.querySelector('meta[name="ICBM"]')?.remove();
    } else {
      updateMetaName("geo.region", "PH");
      updateMetaName("geo.placename", "Cebu City, Philippines");
      updateMetaName("geo.position", "10.3157;123.8854");
      updateMetaName("ICBM", "10.3157,123.8854");
    }

    // Clean up old schemas before injecting new ones
    const oldSchemas = document.querySelectorAll('script[data-schema-type]');
    oldSchemas.forEach(schema => schema.remove());

    // Inject Organization schema (global - always present)
    const orgSchema = document.createElement('script');
    orgSchema.type = 'application/ld+json';
    orgSchema.setAttribute('data-schema-type', 'organization');
    orgSchema.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "OnSpot",
      "legalName": "OnSpot Global",
      "url": "https://www.onspotglobal.com",
      "logo": "https://www.onspotglobal.com/assets/onspot-logo.png",
      "description": "Work Without Limits - AI-powered talent matching and performance management",
      "sameAs": [
        "https://www.linkedin.com/company/onspotglobal",
        "https://www.facebook.com/onspotglobal"
      ]
    });
    document.head.appendChild(orgSchema);

    // Inject WebSite schema (global - always present)
    const websiteSchema = document.createElement('script');
    websiteSchema.type = 'application/ld+json';
    websiteSchema.setAttribute('data-schema-type', 'website');
    websiteSchema.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "OnSpot",
      "url": "https://www.onspotglobal.com",
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://www.onspotglobal.com/hire-talent?q={search_term_string}",
        "query-input": "required name=search_term_string"
      }
    });
    document.head.appendChild(websiteSchema);

    // Region-specific schemas
    if (region === "US") {
      // Service schema for US audience (client-facing)
      const serviceSchema = document.createElement('script');
      serviceSchema.type = 'application/ld+json';
      serviceSchema.setAttribute('data-schema-type', 'service');
      serviceSchema.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Service",
        "name": "OnSpot",
        "provider": {
          "@type": "Organization",
          "name": "OnSpot",
          "legalName": "OnSpot Global",
          "url": "https://www.onspotglobal.com"
        },
        "serviceType": "AI-driven outsourcing and managed teams",
        "areaServed": "US",
        "hasOfferCatalog": {
          "@type": "OfferCatalog",
          "name": "OnSpot Services",
          "itemListElement": [
            { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "AI Virtual Assistant" } },
            { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Managed Services" } },
            { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Resourced Services" } }
          ]
        }
      });
      document.head.appendChild(serviceSchema);
    } else {
      // EmploymentAgency schema for PH audience (talent/operations)
      const employmentSchema = document.createElement('script');
      employmentSchema.type = 'application/ld+json';
      employmentSchema.setAttribute('data-schema-type', 'employment');
      employmentSchema.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "EmploymentAgency",
        "name": "OnSpot",
        "legalName": "OnSpot Global",
        "url": `https://www.onspotglobal.com${location}`,
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "Cebu City",
          "addressRegion": "Cebu",
          "addressCountry": "PH"
        },
        "areaServed": "PH"
      });
      document.head.appendChild(employmentSchema);
    }

    // Inject Article schema for blog posts when articleSchema is provided
    if (articleSchema) {
      const artSchema = document.createElement('script');
      artSchema.type = 'application/ld+json';
      artSchema.setAttribute('data-schema-type', 'article');
      artSchema.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": articleSchema.headline,
        "description": articleSchema.description,
        "image": articleSchema.image,
        "datePublished": articleSchema.datePublished,
        "dateModified": articleSchema.dateModified ?? articleSchema.datePublished,
        "author": {
          "@type": "Person",
          "name": articleSchema.author
        },
        "publisher": {
          "@type": "Organization",
          "name": "OnSpot",
          "logo": {
            "@type": "ImageObject",
            "url": "https://www.onspotglobal.com/assets/onspot-logo.png"
          }
        },
        "mainEntityOfPage": {
          "@type": "WebPage",
          "@id": articleSchema.url
        },
        "url": articleSchema.url
      });
      document.head.appendChild(artSchema);
    }
  }, [location, region, title, description, ogImage, ogType, canonical, articleSchema]);

  // This component only manages <head> - no visible output
  return null;
}

export default HeadSEO;
