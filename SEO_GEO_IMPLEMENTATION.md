# Dual SEO + GEO Implementation Summary

## ✅ Implementation Complete

OnSpot now has a comprehensive dual geo-targeting SEO setup for **US (clients)** and **Philippines (talent)** audiences, with legal name hidden but active for ranking continuity.

---

## 🎯 Brand Strategy

- **Visible Brand**: "OnSpot" (all user-facing content)
- **Legal Name**: "OnSpot Global" (hidden in schema only for SEO continuity)
- **Domain**: onspotglobal.com (unchanged)

---

## 📁 Files Created/Modified

### New Files
1. `client/src/config/geo-map.ts` - Geographic routing configuration
2. `client/src/components/HeadSEO.tsx` - Dynamic SEO/schema injection component
3. `public/robots.txt` - Global crawl permissions + sitemap reference
4. `public/sitemap.xml` - Comprehensive URL mapping (US + PH pages)

### Modified Files
1. `client/src/App.tsx` - Integrated HeadSEO component
2. `client/index.html` - Removed static schemas (now dynamic)
3. `replit.md` - Updated documentation

---

## 🌍 Route Classification

### US-Facing Pages (Client/Lead Acquisition)
**Default for all routes except PH-specific**

Examples:
- `/` - Home page
- `/hire-talent` - Talent search
- `/why-onspot/*` - All Why OnSpot pages
- `/pricing`, `/enterprise`, `/ai-assistant`
- `/investors`, `/lead-intake`
- `/payment-protection`, `/trust-safety`

**SEO Configuration:**
- `geo.region`: "US"
- `geo.placename`: "United States"
- Schema: Service (AI-driven outsourcing)
- `areaServed`: "US"

### PH-Facing Pages (Operations/Talent Recruitment)
Routes: `/find-work`, `/get-hired`, `/talent-portal`, `/jobs`, `/careers`, `/apply`, `/operations`

**SEO Configuration:**
- `geo.region`: "PH"
- `geo.placename`: "Cebu City, Philippines"
- `geo.position`: "10.3157;123.8854" (Cebu coordinates)
- `ICBM`: "10.3157,123.8854"
- Schema: EmploymentAgency with Cebu City address
- `areaServed`: "PH"

---

## 📊 JSON-LD Schemas

### Global Schemas (All Pages)

#### 1. Organization Schema
```json
{
  "@type": "Organization",
  "name": "OnSpot",
  "legalName": "OnSpot Global",
  "url": "https://www.onspotglobal.com",
  "logo": "https://www.onspotglobal.com/assets/onspot-logo.png",
  "description": "The Superhuman Outsourcing System - AI-powered talent matching and performance management",
  "sameAs": [
    "https://www.linkedin.com/company/onspotglobal",
    "https://www.facebook.com/onspotglobal"
  ]
}
```

#### 2. WebSite Schema
```json
{
  "@type": "WebSite",
  "name": "OnSpot",
  "url": "https://www.onspotglobal.com",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://www.onspotglobal.com/hire-talent?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
}
```

### US Pages - Service Schema
```json
{
  "@type": "Service",
  "name": "OnSpot",
  "provider": {
    "@type": "Organization",
    "name": "OnSpot",
    "legalName": "OnSpot Global"
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
}
```

### PH Pages - EmploymentAgency Schema
```json
{
  "@type": "EmploymentAgency",
  "name": "OnSpot",
  "legalName": "OnSpot Global",
  "url": "https://www.onspotglobal.com/[pathname]",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Cebu City",
    "addressRegion": "Cebu",
    "addressCountry": "PH"
  },
  "areaServed": "PH"
}
```

---

## 🔍 QA Acceptance Criteria

### ✅ Completed Requirements

1. **No Visible Changes**: Zero layout/content/copy modifications - all changes in `<head>` only
2. **Brand Consistency**: "OnSpot" shown to users everywhere
3. **Legal Name**: "OnSpot Global" hidden in schema for ranking continuity
4. **Dynamic Canonical**: Updates to match current pathname
5. **US Pages**: 
   - ✅ `geo.region=US`
   - ✅ Service schema with `areaServed: "US"`
6. **PH Pages**:
   - ✅ `geo.region=PH`
   - ✅ EmploymentAgency schema with `addressCountry: "PH"`
   - ✅ Cebu City coordinates
7. **Organization Schema**: Present site-wide with both `name` and `legalName`
8. **Sitemap**: Includes both US and PH pages
9. **Robots.txt**: Global crawl allowed with sitemap reference

---

## 🧪 Testing Instructions

### View Source Testing

**US Page (e.g., `/hire-talent`):**
```bash
# Check for US geo tags
<meta name="geo.region" content="US">
<meta name="geo.placename" content="United States">

# Check for Service schema
"@type": "Service"
"areaServed": "US"
```

**PH Page (e.g., `/find-work`):**
```bash
# Check for PH geo tags
<meta name="geo.region" content="PH">
<meta name="geo.placename" content="Cebu City, Philippines">
<meta name="geo.position" content="10.3157;123.8854">

# Check for EmploymentAgency schema
"@type": "EmploymentAgency"
"addressCountry": "PH"
```

### Google Rich Results Test
1. Visit: https://search.google.com/test/rich-results
2. Test US page URL (e.g., `https://www.onspotglobal.com/hire-talent`)
3. Verify Service schema passes
4. Test PH page URL (e.g., `https://www.onspotglobal.com/find-work`)
5. Verify EmploymentAgency schema passes

---

## 🚀 How It Works

1. **HeadSEO Component**: Dynamically injected into App.tsx, monitors route changes via Wouter's `useLocation`
2. **Route Detection**: GEO_MAP configuration identifies region based on pathname using regex patterns
3. **Dynamic Injection**: Component programmatically creates/updates meta tags and JSON-LD scripts in `<head>`
4. **Cleanup**: Old schemas removed before new ones injected (prevents duplicates)
5. **No Rendering**: Component returns `null` - only manages `<head>`, no visible DOM output

---

## 📈 SEO Benefits

1. **Dual Targeting**: Separate optimization for US clients and PH talent pools
2. **Local Search**: Geo-specific meta tags improve regional search visibility
3. **Rich Results**: Proper schemas enable enhanced search result displays
4. **Brand Continuity**: Legal name preserved in schema maintains existing SEO equity
5. **Crawlability**: Sitemap and robots.txt ensure proper indexing
6. **Canonical URLs**: Prevent duplicate content issues

---

## 🎯 Future Enhancements (Optional)

- Add city-specific PH pages (e.g., `/careers/manila`, `/careers/davao`) with corresponding coordinates
- Implement hreflang tags if creating paired US/PH versions of same content
- Add BlogPosting schema for `/insights` articles
- Expand Service catalog with specific service pages
- Add FAQPage schema for support/help pages

---

## 📝 Notes

- Phone numbers and addresses remain in schema only (not visible content)
- All schemas use `data-schema-type` attribute for easy cleanup
- Component works seamlessly with React Router (Wouter) and handles SPA navigation
- Meta tags update instantly on route changes without page reload
- Backward compatible - works with all existing routes

---

**Implementation Date**: October 19, 2025
**Status**: ✅ Complete & Production Ready
