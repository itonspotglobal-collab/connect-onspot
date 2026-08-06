import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";

// ── Web crawler / bot detection ───────────────────────────────────────────────
// Covers: social preview bots, AI/LLM crawlers, SEO audit tools, and archivers.
// All of these receive pre-rendered HTML with correct metadata instead of the
// blank SPA shell — they do not execute JavaScript.
const CRAWLER_PATTERNS = [
  // ── Social preview bots ─────────────────────────────────────────────────────
  // Facebook / Instagram / Messenger
  "facebookexternalhit",
  "facebot",
  "facebookplatform",
  // Twitter / X
  "twitterbot",
  // Slack
  "slackbot",
  "slack-imgproxy",
  // Microsoft Teams / Skype / Bing
  "skypeuripreview",
  "skype",
  "microsoftbot",
  "msnbot",
  "bingbot",
  "bingpreview",
  // WhatsApp
  "whatsapp",
  // Discord
  "discordbot",
  // LinkedIn
  "linkedinbot",
  // Telegram
  "telegrambot",
  // Pinterest
  "pinterest",
  // iMessage / Apple
  "applebot",
  "icloud",
  // Reddit
  "redditbot",
  // Flipboard / Tumblr / Bitly
  "flipboard",
  "tumblr",
  "bitlybot",
  // Link-preview services
  "rogerbot",
  "embedly",
  "outbrain",
  "quora link preview",
  "showyoubot",
  "vkshare",
  "xing-contenttabreceiver",

  // ── Search engines ──────────────────────────────────────────────────────────
  "googlebot",
  "google-inspectiontool",
  "google-extended",            // Google Gemini training / AI overviews
  "developers.google.com/+/web/snippet",
  "bingbot",
  "duckduckbot",
  "yandexbot",
  "baiduspider",
  "ia_archiver",                // Internet Archive / Wayback Machine
  "archive.org_bot",

  // ── AI / LLM crawlers ───────────────────────────────────────────────────────
  // Anthropic / Claude
  "claudebot",
  "anthropic-ai",
  "claude-web",
  // OpenAI / ChatGPT
  "gptbot",
  "chatgpt-user",
  "openai-searchbot",
  "oai-searchbot",
  // Perplexity AI
  "perplexitybot",
  // Google AI / Gemini
  "gemini",
  "google-cloudvertexbot",
  // Meta AI
  "meta-externalagent",
  "meta-externalfetcher",
  // You.com AI search
  "youbot",
  // Cohere AI
  "cohere-ai",
  // Bytedance / TikTok AI
  "bytespider",
  // Common Crawl (used by many AI training pipelines)
  "ccbot",
  // Diffbot (entity/knowledge extraction)
  "diffbot",
  // Amazon / Alexa
  "amazonbot",
  // Apple AI
  "applebot-extended",

  // ── SEO audit tools ─────────────────────────────────────────────────────────
  "semrushbot",
  "ahrefsbot",
  "mj12bot",                    // Majestic SEO
  "dotbot",                     // Moz
  "screaming frog",
  "serpstatbot",
  "seokicks",
  "preview",

  // ── Generic / validation ────────────────────────────────────────────────────
  "w3c_validator",
];

/** Returns true for any known crawler / bot User-Agent (social, AI, SEO, or archiver). */
export function isCrawler(req: Request): boolean {
  const ua = (req.get("User-Agent") || "").toLowerCase();
  return CRAWLER_PATTERNS.some((pattern) => ua.includes(pattern));
}

/** @deprecated Use isCrawler — kept for any callers that imported the old name. */
function isSocialBot(req: Request): boolean { return isCrawler(req); }

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ── Constants ─────────────────────────────────────────────────────────────────
const SITE = "https://www.onspotglobal.com";
export const DEFAULT_OG_IMAGE = "https://onspotglobal.com/onspot-social-preview-v3.png";
/** Used as fallback for Insights pages that have no cover image */
const INSIGHTS_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&h=630&fit=crop";

const DEFAULT_DESCRIPTION =
  "Work Without Limits. OnSpot connects companies with vetted, accountable talent — no marketplace chaos, no outsourcing overhead.";

/**
 * Normalize a stored image URL so it always points to the production domain.
 * Dev-server URLs (*.replit.dev) are rewritten to the production origin so
 * og:image is always publicly accessible to crawlers.
 */
function normalizeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (
    trimmed.startsWith(`${SITE}/`) ||
    trimmed.startsWith("https://www.onspotglobal.com/") ||
    (!trimmed.includes(".replit.dev") && !trimmed.includes(".worf.replit.dev"))
  ) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    return `${SITE}${parsed.pathname}`;
  } catch {
    return trimmed;
  }
}

// ── OG Meta type ──────────────────────────────────────────────────────────────
export interface OGMeta {
  title: string;
  description: string;
  image: string;
  url: string;
  ogType: string;
  /** Optional rich text block injected into the bot HTML <main> for AI crawlers. */
  pageContent?: string;
}

// ── Per-route metadata resolver ───────────────────────────────────────────────
export async function resolveOGMeta(
  pathname: string,
  query: Record<string, string>
): Promise<OGMeta> {

  // ── Homepage ──────────────────────────────────────────────────────────────────
  if (pathname === "/" || pathname === "") {
    return {
      title: "Work Without Limits | OnSpot",
      description: "Work Without Limits. OnSpot connects companies with vetted, accountable talent — without the chaos of a freelance marketplace or the overhead of a traditional outsourcing firm. Talent earns more. Clients pay less.",
      image: DEFAULT_OG_IMAGE,
      url: `${SITE}/`,
      ogType: "website",
      pageContent: `
        <section>
          <h2>AI-Powered Outsourcing for US Businesses</h2>
          <p>OnSpot is the first integrator system that fuses AI-first infrastructure with Philippine operational excellence to scale businesses and empower people to work without limits.</p>
          <h3>What We Do</h3>
          <ul>
            <li><strong>Hire Talent:</strong> Pre-vetted remote professionals placed within 72 hours</li>
            <li><strong>AI Assistant (Vanessa):</strong> Intelligent business operations powered by AI</li>
            <li><strong>Find Work:</strong> Remote jobs in customer support, development, design, and more</li>
            <li><strong>Managed Services:</strong> End-to-end team management and performance tracking</li>
          </ul>
          <h3>Who We Serve</h3>
          <p>U.S. entrepreneurs, SMBs, and enterprise teams looking to scale operations cost-effectively with top Philippine talent and AI infrastructure.</p>
        </section>`,
    };
  }

  // ── Individual blog post: /insights/:slug ─────────────────────────────────────
  const articleMatch = pathname.match(/^\/insights\/([^/]+)\/?$/);
  if (articleMatch) {
    const slug = articleMatch[1];
    try {
      const post = await storage.getPostBySlug(slug);
      if (post && post.status === "published") {
        const coverImage =
          normalizeImageUrl(post.coverImageUrl) || INSIGHTS_FALLBACK_IMAGE;
        const rawExcerpt = (post.excerpt || post.title || "")
          .replace(/<[^>]+>/g, "")
          .trim();
        const description =
          rawExcerpt.length > 200
            ? rawExcerpt.slice(0, 197) + "…"
            : rawExcerpt;
        return {
          title: `${post.title} | OnSpot Insights`,
          description,
          image: coverImage,
          url: `${SITE}/insights/${post.slug}`,
          ogType: "article",
        };
      }
    } catch (err) {
      console.error("[ogMiddleware] DB error fetching post:", slug, err);
    }
    // Post not found → fall through to Insights listing
  }

  // ── Insights listing / blog ───────────────────────────────────────────────────
  if (
    pathname === "/insights" ||
    pathname === "/insights/" ||
    pathname.startsWith("/blog")
  ) {
    return {
      title: "Insights – Outsourcing Intelligence | OnSpot",
      description:
        "Expert articles on outsourcing strategy, BPO trends, AI-driven talent matching, and building remote teams across the Philippines and beyond.",
      image: INSIGHTS_FALLBACK_IMAGE,
      url: `${SITE}/insights`,
      ogType: "website",
    };
  }

  // ── Find Work / Jobs ──────────────────────────────────────────────────────────
  if (pathname.startsWith("/jobs") || pathname.startsWith("/find-work")) {
    // Individual job detail page — try to pull the actual title from DB
    const jobDetailMatch = pathname.match(/^\/jobs\/([a-f0-9-]{8,})\/?$/i);
    if (jobDetailMatch) {
      const jobId = jobDetailMatch[1];
      try {
        const job = await storage.getJob(jobId);
        if (job) {
          const roleTitle = (job as any).professionalRoleName || job.title || "Open Role";
          const company = job.company || "a global employer";
          const location = job.location || "Remote";
          const contractType = job.contractType ? ` · ${job.contractType}` : "";
          return {
            title: `${roleTitle} at ${company} | OnSpot`,
            description: `Apply for ${roleTitle} at ${company}. ${location}${contractType}. Browse and apply for remote outsourcing jobs on OnSpot — no experience required, top Philippine talent welcome.`,
            image: DEFAULT_OG_IMAGE,
            url: `${SITE}/jobs/${jobId}`,
            ogType: "website",
            pageContent: `
              <section>
                <h2>${escapeHtml(roleTitle)}</h2>
                <p><strong>Company:</strong> ${escapeHtml(company)}</p>
                <p><strong>Location:</strong> ${escapeHtml(location)}</p>
                ${contractType ? `<p><strong>Type:</strong> ${escapeHtml(job.contractType || "")}</p>` : ""}
                <p>Apply now on <a href="${SITE}/jobs/${jobId}"</a>.</p>
              </section>`,
          };
        }
      } catch (err) {
        console.error("[ogMiddleware] DB error fetching job:", jobId, err);
      }
      // Job not found → fall through to generic response
      return {
        title: "Job Opening | OnSpot",
        description: "View this role and apply now. OnSpot connects top Philippine talent with global clients — remote jobs in support, development, design, and more.",
        image: DEFAULT_OG_IMAGE,
        url: `${SITE}${pathname}`,
        ogType: "website",
      };
    }

    // Old find-work/job/:id pattern
    if (/^\/find-work\/job\/[^/]+\/?$/.test(pathname)) {
      return {
        title: "Job Opening | OnSpot",
        description: "View this role and apply now. OnSpot connects top Philippine talent with global clients — remote jobs in support, development, design, and more.",
        image: DEFAULT_OG_IMAGE,
        url: `${SITE}${pathname}`,
        ogType: "website",
      };
    }

    // All-jobs browse page
    if (pathname === "/find-work/all-jobs" || pathname === "/find-work/all-jobs/") {
      return {
        title: "Browse All Remote Jobs | OnSpot",
        description: "Explore all open remote jobs on OnSpot — customer support, software development, design, marketing, virtual assistant roles, and more.",
        image: DEFAULT_OG_IMAGE,
        url: `${SITE}/find-work/all-jobs`,
        ogType: "website",
        pageContent: `
          <section>
            <h2>Open Remote Job Categories</h2>
            <ul>
              <li>Customer Support &amp; Virtual Assistance</li>
              <li>Software Development &amp; Engineering</li>
              <li>Design &amp; Creative</li>
              <li>Marketing &amp; Lead Generation</li>
              <li>Finance, Accounting &amp; Admin</li>
              <li>Sales &amp; Business Development</li>
            </ul>
          </section>`,
      };
    }

    // Jobs listing (find-work/jobs)
    if (pathname === "/find-work/jobs" || pathname === "/find-work/jobs/") {
      return {
        title: "Remote Jobs | OnSpot",
        description: "Browse remote outsourcing jobs in customer support, development, design, marketing, and more at OnSpot.",
        image: DEFAULT_OG_IMAGE,
        url: `${SITE}/find-work/jobs`,
        ogType: "website",
      };
    }

    // Category or generic find-work
    const cat = query.category || null;
    const catLabel = cat && cat !== "all"
      ? ` – ${cat.charAt(0).toUpperCase() + cat.slice(1)}`
      : "";
    return {
      title: `Find Work${catLabel} | OnSpot`,
      description: "Browse remote outsourcing jobs in customer support, development, design, marketing, and more. OnSpot connects top Philippine talent with global clients.",
      image: DEFAULT_OG_IMAGE,
      url: cat ? `${SITE}/find-work?category=${encodeURIComponent(cat)}` : `${SITE}/find-work`,
      ogType: "website",
      pageContent: `
        <section>
          <h2>Why Work Through OnSpot?</h2>
          <ul>
            <li>Remote jobs with US and global companies</li>
            <li>Full-time, part-time, and contract opportunities</li>
            <li>Fast application process — apply once, get matched to multiple roles</li>
            <li>Competitive pay in USD</li>
          </ul>
        </section>`,
    };
  }

  // ── Hire Talent ───────────────────────────────────────────────────────────────
  if (pathname === "/hire-talent" || pathname === "/hire-talent/") {
    return {
      title: "Hire Talent | OnSpot",
      description: "Hire pre-vetted remote professionals from the Philippines. OnSpot places top talent in customer support, development, design, and more within 72 hours.",
      image: DEFAULT_OG_IMAGE,
      url: `${SITE}/hire-talent`,
      ogType: "website",
      pageContent: `
        <section>
          <h2>How Hiring Works</h2>
          <ol>
            <li>Tell us what you need — role, skills, hours, and budget</li>
            <li>OnSpot AI matches your requirements to pre-vetted Filipino professionals</li>
            <li>Review top candidates within 24 hours</li>
            <li>Hire and onboard in as little as 72 hours</li>
          </ol>
          <h3>Roles We Fill</h3>
          <ul>
            <li>Customer support agents and virtual assistants</li>
            <li>Software engineers and web developers</li>
            <li>Graphic designers and content creators</li>
            <li>Marketing specialists and SEO experts</li>
            <li>Accountants, bookkeepers, and finance ops</li>
          </ul>
        </section>`,
    };
  }

  // ── Why OnSpot / About ────────────────────────────────────────────────────────
  if (pathname.startsWith("/why-onspot")) {
    if (pathname.includes("/about")) {
      return {
        title: "About OnSpot | Work Without Limits",
        description:
          "Learn how OnSpot is building the future of work — connecting entrepreneurs with world-class remote talent and AI-powered outsourcing.",
        image: DEFAULT_OG_IMAGE,
        url: `${SITE}${pathname}`,
        ogType: "website",
      };
    }
    return {
      title: "Why OnSpot | Outsourcing, Simplified",
      description:
        "Discover why leading companies choose OnSpot to scale with remote talent — transparent pricing, AI matching, and guaranteed performance.",
      image: DEFAULT_OG_IMAGE,
      url: `${SITE}${pathname}`,
      ogType: "website",
    };
  }

  // ── Services ──────────────────────────────────────────────────────────────────
  if (pathname.startsWith("/services")) {
    return {
      title: "Services | OnSpot",
      description:
        "Explore OnSpot's outsourcing service tiers — from Managed and Resourced to Enterprise and AI-powered assistants.",
      image: DEFAULT_OG_IMAGE,
      url: `${SITE}${pathname}`,
      ogType: "website",
    };
  }

  // ── Pricing ───────────────────────────────────────────────────────────────────
  if (pathname === "/pricing" || pathname === "/pricing/") {
    return {
      title: "Pricing | OnSpot",
      description:
        "Transparent outsourcing pricing with no hidden fees. Choose a plan that scales with your business.",
      image: DEFAULT_OG_IMAGE,
      url: `${SITE}/pricing`,
      ogType: "website",
    };
  }

  // ── Enterprise ────────────────────────────────────────────────────────────────
  if (pathname === "/enterprise" || pathname === "/enterprise/") {
    return {
      title: "Enterprise Solutions | OnSpot",
      description:
        "Custom outsourcing solutions for enterprise teams. Scale operations with dedicated OnSpot talent and AI infrastructure.",
      image: DEFAULT_OG_IMAGE,
      url: `${SITE}/enterprise`,
      ogType: "website",
    };
  }

  // ── FAQ ───────────────────────────────────────────────────────────────────────
  if (pathname === "/faq" || pathname === "/faq/") {
    return {
      title: "FAQ | OnSpot",
      description:
        "Answers to common questions about OnSpot's remote outsourcing services, hiring process, pricing, and platform.",
      image: DEFAULT_OG_IMAGE,
      url: `${SITE}/faq`,
      ogType: "website",
    };
  }

  // ── Contact / Inquiry ─────────────────────────────────────────────────────────
  if (pathname === "/contact" || pathname.startsWith("/inquiry")) {
    return {
      title: "Contact OnSpot | Get in Touch",
      description:
        "Ready to scale your team? Contact OnSpot to get started with pre-vetted remote talent today.",
      image: DEFAULT_OG_IMAGE,
      url: `${SITE}/contact`,
      ogType: "website",
    };
  }

  // ── Legal pages ───────────────────────────────────────────────────────────────
  if (
    pathname.startsWith("/terms") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/refund") ||
    pathname.startsWith("/trust") ||
    pathname.startsWith("/payment-protection")
  ) {
    return {
      title: "Legal | OnSpot",
      description: "OnSpot's terms, privacy policy, refund policy, and trust & safety information.",
      image: DEFAULT_OG_IMAGE,
      url: `${SITE}${pathname}`,
      ogType: "website",
    };
  }

  // ── Admin ─────────────────────────────────────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    return {
      title: "Admin | OnSpot",
      description: "OnSpot admin portal.",
      image: DEFAULT_OG_IMAGE,
      url: `${SITE}/admin`,
      ogType: "website",
    };
  }

  // ── Generic fallback (all other routes) ──────────────────────────────────────
  return {
    title: "Work Without Limits | OnSpot",
    description: DEFAULT_DESCRIPTION,
    image: DEFAULT_OG_IMAGE,
    url: `${SITE}${pathname}`,
    ogType: "website",
  };
}

// ── Meta tags block — injected into the SPA shell by serveStatic ──────────────
export function buildMetaTagsHtml(meta: OGMeta): string {
  const t = escapeHtml(meta.title);
  const d = escapeHtml(meta.description);
  const img = escapeHtml(meta.image);
  const url = escapeHtml(meta.url);
  return `  <!-- Primary Meta Tags (server-rendered) -->
  <meta name="description" content="${d}" />
  <link rel="canonical" href="${url}" />

  <!-- Open Graph -->
  <meta property="og:type" content="${meta.ogType}" />
  <meta property="og:site_name" content="OnSpot" />
  <meta property="og:url" content="${url}" />
  <meta property="og:title" content="${t}" />
  <meta property="og:description" content="${d}" />
  <meta property="og:image" content="${img}" />
  <meta property="og:image:url" content="${img}" />
  <meta property="og:image:secure_url" content="${img}" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${t}" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@OnSpotGlobal" />
  <meta name="twitter:url" content="${url}" />
  <meta name="twitter:title" content="${t}" />
  <meta name="twitter:description" content="${d}" />
  <meta name="twitter:image" content="${img}" />
  <meta name="twitter:image:alt" content="${t}" />`;
}

// ── Rich crawler HTML ─────────────────────────────────────────────────────────
// Served to all detected web crawlers (social bots, AI indexers, SEO tools).
// Includes complete head metadata, structured JSON-LD, nav links, and
// route-specific body content so AI/LLM crawlers can understand every page
// without executing JavaScript.
function buildBotHtml(meta: OGMeta): string {
  const t = escapeHtml(meta.title);
  const d = escapeHtml(meta.description);
  const img = escapeHtml(meta.image);
  const url = escapeHtml(meta.url);

  const orgSchema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "OnSpot",
    legalName: "OnSpot",
    url: "https://www.onspotglobal.com",
    logo: "https://www.onspotglobal.com/assets/onspot-logo.png",
    description: "AI-powered outsourcing platform connecting US businesses with top Philippine talent.",
    sameAs: [
      "https://www.linkedin.com/company/onspotglobal",
      "https://www.facebook.com/onspotglobal",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "sales",
      url: "https://www.onspotglobal.com/hire-talent",
    },
  });

  const websiteSchema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "OnSpot",
    url: "https://www.onspotglobal.com",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://www.onspotglobal.com/find-work/all-jobs?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  });

  const pageContent = meta.pageContent ?? "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${t}</title>
  <meta name="description" content="${d}" />
  <link rel="canonical" href="${url}" />

  <!-- Open Graph -->
  <meta property="og:type" content="${meta.ogType}" />
  <meta property="og:site_name" content="OnSpot" />
  <meta property="og:url" content="${url}" />
  <meta property="og:title" content="${t}" />
  <meta property="og:description" content="${d}" />
  <meta property="og:image" content="${img}" />
  <meta property="og:image:url" content="${img}" />
  <meta property="og:image:secure_url" content="${img}" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${t}" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@OnSpotGlobal" />
  <meta name="twitter:url" content="${url}" />
  <meta name="twitter:title" content="${t}" />
  <meta name="twitter:description" content="${d}" />
  <meta name="twitter:image" content="${img}" />
  <meta name="twitter:image:alt" content="${t}" />

  <!-- Structured Data -->
  <script type="application/ld+json">${orgSchema}</script>
  <script type="application/ld+json">${websiteSchema}</script>
</head>
<body>
  <!-- OnSpot — AI-powered outsourcing platform for US businesses. -->
  <header>
    <a href="https://www.onspotglobal.com"><strong>OnSpot</strong></a>
    <nav>
      <a href="https://www.onspotglobal.com/hire-talent">Hire Talent</a>
      <a href="https://www.onspotglobal.com/find-work/all-jobs">Browse Jobs</a>
      <a href="https://www.onspotglobal.com/pricing">Pricing</a>
      <a href="https://www.onspotglobal.com/insights">Insights</a>
      <a href="https://www.onspotglobal.com/why-onspot">About</a>
      <a href="https://www.onspotglobal.com/faq">FAQ</a>
    </nav>
  </header>
  <main>
    <article>
      <h1>${t}</h1>
      <p>${d}</p>
      ${pageContent}
      <p><a href="${url}">View on OnSpot →</a></p>
    </article>
  </main>
  <footer>
    <p><strong>OnSpot</strong> — Work Without Limits</p>
    <p>AI-powered outsourcing platform connecting U.S. businesses with top Philippine talent in customer support, software development, design, marketing, and more.</p>
    <nav>
      <a href="https://www.onspotglobal.com/hire-talent">Hire Talent</a> ·
      <a href="https://www.onspotglobal.com/find-work/all-jobs">Browse Jobs</a> ·
      <a href="https://www.onspotglobal.com/pricing">Pricing</a> ·
      <a href="https://www.onspotglobal.com/insights">Insights</a> ·
      <a href="https://www.onspotglobal.com/why-onspot/about">About</a> ·
      <a href="https://www.onspotglobal.com/sitemap.xml">Sitemap</a>
    </nav>
  </footer>
</body>
</html>`;
}

// ── Express middleware ─────────────────────────────────────────────────────────
// Intercepts all known web crawlers (social, AI, SEO) before the Vite/static
// catch-all and serves structured HTML with full metadata and body content.
// Regular browsers pass through to the SPA unchanged.
export async function ogMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (req.method !== "GET") return next();
  if (req.path.startsWith("/api/")) return next();
  if (/\.[a-zA-Z0-9]{1,10}$/.test(req.path)) return next();
  if (!isCrawler(req)) return next();

  try {
    const meta = await resolveOGMeta(
      req.path,
      req.query as Record<string, string>
    );
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.status(200).send(buildBotHtml(meta));
  } catch (err) {
    console.error("[ogMiddleware] Unexpected error:", err);
    next();
  }
}
