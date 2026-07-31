import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";

// ── Social bot detection ───────────────────────────────────────────────────────
const SOCIAL_BOT_PATTERNS = [
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
  "microsoft",
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
  // Google
  "googlebot",
  "google-inspectiontool",
  "developers.google.com/+/web/snippet",
  // Other link-preview services
  "rogerbot",
  "ia_archiver",
  "embedly",
  "outbrain",
  "quora link preview",
  "showyoubot",
  "w3c_validator",
  "vkshare",
  "xing-contenttabreceiver",
  "redditbot",
  "flipboard",
  "tumblr",
  "bitlybot",
  "semrushbot",
  "preview",
];

function isSocialBot(req: Request): boolean {
  const ua = (req.get("User-Agent") || "").toLowerCase();
  return SOCIAL_BOT_PATTERNS.some((pattern) => ua.includes(pattern));
}

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
  "The first integrator system that simplifies outsourcing management. Built by entrepreneurs, for entrepreneurs.";

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
}

// ── Per-route metadata resolver ───────────────────────────────────────────────
export async function resolveOGMeta(
  pathname: string,
  query: Record<string, string>
): Promise<OGMeta> {

  // ── Homepage ──────────────────────────────────────────────────────────────────
  if (pathname === "/" || pathname === "") {
    return {
      title: "OnSpot – Work Without Limits",
      description: DEFAULT_DESCRIPTION,
      image: DEFAULT_OG_IMAGE,
      url: `${SITE}/`,
      ogType: "website",
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
      title: "Insights – Outsourcing Intelligence | OnSpot Global",
      description:
        "Expert articles on outsourcing strategy, BPO trends, AI-driven talent matching, and building remote teams across the Philippines and beyond.",
      image: INSIGHTS_FALLBACK_IMAGE,
      url: `${SITE}/insights`,
      ogType: "website",
    };
  }

  // ── Find Work / Jobs ──────────────────────────────────────────────────────────
  if (pathname.startsWith("/jobs") || pathname.startsWith("/find-work")) {
    // Individual job page
    if (
      /^\/jobs\/[^/]+\/?$/.test(pathname) ||
      /^\/find-work\/job\/[^/]+\/?$/.test(pathname)
    ) {
      return {
        title: "Job Opening | OnSpot Global",
        description:
          "View this role and apply now. OnSpot connects top Philippine talent with global clients — remote jobs in support, development, design, and more.",
        image: DEFAULT_OG_IMAGE,
        url: `${SITE}${pathname}`,
        ogType: "website",
      };
    }
    // Jobs listing (find-work/jobs)
    if (pathname === "/find-work/jobs" || pathname === "/find-work/jobs/") {
      return {
        title: "Remote Jobs | OnSpot Global",
        description:
          "Browse remote outsourcing jobs in customer support, development, design, marketing, and more at OnSpot Global.",
        image: DEFAULT_OG_IMAGE,
        url: `${SITE}/find-work/jobs`,
        ogType: "website",
      };
    }
    // Category or generic find-work
    const cat = query.category || null;
    const catLabel =
      cat && cat !== "all"
        ? ` – ${cat.charAt(0).toUpperCase() + cat.slice(1)}`
        : "";
    return {
      title: `Find Work${catLabel} | OnSpot Global`,
      description:
        "Browse remote outsourcing jobs in customer support, development, design, marketing, and more. OnSpot connects top Philippine talent with global clients.",
      image: DEFAULT_OG_IMAGE,
      url: cat
        ? `${SITE}/find-work?category=${encodeURIComponent(cat)}`
        : `${SITE}/find-work`,
      ogType: "website",
    };
  }

  // ── Hire Talent ───────────────────────────────────────────────────────────────
  if (pathname === "/hire-talent" || pathname === "/hire-talent/") {
    return {
      title: "Hire Talent | OnSpot Global",
      description:
        "Hire pre-vetted remote professionals from the Philippines. OnSpot places top talent in customer support, development, design, and more within 72 hours.",
      image: DEFAULT_OG_IMAGE,
      url: `${SITE}/hire-talent`,
      ogType: "website",
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
      title: "Services | OnSpot Global",
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
      title: "Pricing | OnSpot Global",
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
      title: "Enterprise Solutions | OnSpot Global",
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
      title: "FAQ | OnSpot Global",
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
      title: "Legal | OnSpot Global",
      description: "OnSpot's terms, privacy policy, refund policy, and trust & safety information.",
      image: DEFAULT_OG_IMAGE,
      url: `${SITE}${pathname}`,
      ogType: "website",
    };
  }

  // ── Admin ─────────────────────────────────────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    return {
      title: "Admin | OnSpot Global",
      description: "OnSpot admin portal.",
      image: DEFAULT_OG_IMAGE,
      url: `${SITE}/admin`,
      ogType: "website",
    };
  }

  // ── Generic fallback (all other routes) ──────────────────────────────────────
  return {
    title: "OnSpot – Work Without Limits",
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

// ── Minimal bot-only HTML (for known social crawlers — lightweight, no scripts) ─
function buildBotHtml(meta: OGMeta): string {
  const t = escapeHtml(meta.title);
  const d = escapeHtml(meta.description);
  const img = escapeHtml(meta.image);
  const url = escapeHtml(meta.url);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${t}</title>
  <meta name="description" content="${d}" />
  <link rel="canonical" href="${url}" />
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
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@OnSpotGlobal" />
  <meta name="twitter:url" content="${url}" />
  <meta name="twitter:title" content="${t}" />
  <meta name="twitter:description" content="${d}" />
  <meta name="twitter:image" content="${img}" />
  <meta name="twitter:image:alt" content="${t}" />
</head>
<body>
  <h1>${t}</h1>
  <p>${d}</p>
  <p><a href="${url}">Read on OnSpot Global</a></p>
</body>
</html>`;
}

// ── Express middleware ─────────────────────────────────────────────────────────
// Intercepts known social bots and serves a minimal bot HTML page instantly.
// Regular browsers fall through to the SPA handler in serveStatic which also
// injects metadata — this is the belt-and-suspenders layer for bots.
export async function ogMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (req.method !== "GET") return next();
  if (req.path.startsWith("/api/")) return next();
  if (/\.[a-zA-Z0-9]{1,10}$/.test(req.path)) return next();
  if (!isSocialBot(req)) return next();

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
