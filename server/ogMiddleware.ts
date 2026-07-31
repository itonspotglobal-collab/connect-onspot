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
  // Microsoft Teams / Skype
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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ── Constants ─────────────────────────────────────────────────────────────────
const SITE = "https://www.onspotglobal.com";
const DEFAULT_IMAGE = "https://onspotglobal.com/onspot-social-preview-v2.png";
/** Used as fallback for Insights pages that have no cover image */
const INSIGHTS_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&h=630&fit=crop";

/**
 * Normalize a stored image URL so it always points to the production domain.
 *
 * During development, admin users upload images while running on the Replit
 * dev server (*.worf.replit.dev / *.replit.dev).  The uploader displays the
 * absolute URL for convenience, and that hostname sometimes gets pasted into
 * the "Cover Image URL" field and saved to the database.  Those dev-server
 * URLs are unreachable by external crawlers (Facebook, Slack, etc.).
 *
 * This function rewrites any such URL to use the production origin so that
 * og:image is always publicly accessible.
 */
function normalizeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Already production or an external CDN (Unsplash, etc.) — leave as-is
  if (
    trimmed.startsWith(`${SITE}/`) ||
    trimmed.startsWith("https://www.onspotglobal.com/") ||
    (!trimmed.includes(".replit.dev") && !trimmed.includes(".worf.replit.dev"))
  ) {
    return trimmed;
  }

  // Replit dev hostname: extract the pathname and rebase onto production
  try {
    const parsed = new URL(trimmed);
    return `${SITE}${parsed.pathname}`;
  } catch {
    // Malformed URL — return as-is and let the fallback handle it
    return trimmed;
  }
}

// ── OG Meta type ──────────────────────────────────────────────────────────────
interface OGMeta {
  title: string;
  description: string;
  image: string;
  url: string;
  ogType: string;
}

// ── Per-route metadata resolver — async so it can query the DB ────────────────
async function resolveOGMeta(
  pathname: string,
  query: Record<string, string>
): Promise<OGMeta> {

  // ── Individual blog post: /insights/:slug ────────────────────────────────────
  // Must be checked BEFORE the generic /insights catch-all below.
  const articleMatch = pathname.match(/^\/insights\/([^/]+)\/?$/);
  if (articleMatch) {
    const slug = articleMatch[1];
    try {
      const post = await storage.getPostBySlug(slug);
      if (post && post.status === "published") {
        const articleUrl = `${SITE}/insights/${post.slug}`;
        const coverImage =
          normalizeImageUrl(post.coverImageUrl) || INSIGHTS_FALLBACK_IMAGE;

        // Strip any HTML tags from excerpt for clean plain-text description
        const rawExcerpt = (post.excerpt || post.title || "").replace(/<[^>]+>/g, "").trim();
        const description =
          rawExcerpt.length > 200
            ? rawExcerpt.slice(0, 197) + "…"
            : rawExcerpt;

        return {
          title: `${post.title} | OnSpot Insights`,
          description,
          image: coverImage,
          url: articleUrl,
          ogType: "article",
        };
      }
    } catch (err) {
      console.error("[ogMiddleware] DB error fetching post for slug:", slug, err);
    }
    // Post not found or not published → fall through to generic Insights meta
  }

  // ── Main Insights listing page ───────────────────────────────────────────────
  if (pathname === "/insights" || pathname === "/insights/" || pathname.startsWith("/blog")) {
    return {
      title: "Insights – Outsourcing Intelligence | OnSpot Global",
      description:
        "Expert articles on outsourcing strategy, BPO trends, AI-driven talent matching, and building remote teams across the Philippines and beyond.",
      image: INSIGHTS_FALLBACK_IMAGE,
      url: `${SITE}/insights`,
      ogType: "website",
    };
  }

  // ── /jobs / /find-work ───────────────────────────────────────────────────────
  if (pathname.startsWith("/jobs") || pathname.startsWith("/find-work")) {
    const isRolePage =
      /^\/jobs\/[^/]+$/.test(pathname) ||
      /^\/find-work\/job\/[^/]+$/.test(pathname);
    if (isRolePage) {
      return {
        title: "Job Opening | OnSpot Global",
        description:
          "View this role and apply now. OnSpot connects top Philippine talent with global clients — remote jobs in support, development, design, and more.",
        image: DEFAULT_IMAGE,
        url: `${SITE}${pathname}`,
        ogType: "website",
      };
    }
    const cat = query.category || null;
    const catLabel =
      cat && cat !== "all"
        ? ` – ${cat.charAt(0).toUpperCase() + cat.slice(1)}`
        : "";
    return {
      title: `Find Work${catLabel} | OnSpot Global`,
      description:
        "Browse remote outsourcing jobs in customer support, development, design, marketing, and more. OnSpot connects top Philippine talent with global clients.",
      image: DEFAULT_IMAGE,
      url: cat
        ? `${SITE}/find-work?category=${encodeURIComponent(cat)}`
        : `${SITE}/find-work`,
      ogType: "website",
    };
  }

  // ── /admin ───────────────────────────────────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    return {
      title: "Admin Dashboard | OnSpot Global",
      description: "OnSpot admin portal.",
      image: DEFAULT_IMAGE,
      url: `${SITE}/admin`,
      ogType: "website",
    };
  }

  // ── Default / homepage ────────────────────────────────────────────────────────
  if (pathname === "/" || pathname === "") {
    return {
      title: "OnSpot – Work Without Limits",
      description:
        "The first integrator system that simplifies outsourcing management. Built by entrepreneurs, for entrepreneurs.",
      image: DEFAULT_IMAGE,
      url: `${SITE}/`,
      ogType: "website",
    };
  }

  // ── Unknown routes — generic fallback ─────────────────────────────────────────
  return {
    title: "OnSpot – Work Without Limits",
    description:
      "The first integrator system that simplifies outsourcing management. Built by entrepreneurs, for entrepreneurs.",
    image: DEFAULT_IMAGE,
    url: `${SITE}${pathname}`,
    ogType: "website",
  };
}

// ── HTML builder served to bots ───────────────────────────────────────────────
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

  <!-- Primary Meta Tags -->
  <meta name="title" content="${t}" />
  <meta name="description" content="${d}" />

  <!-- Open Graph / Facebook / Messenger / Slack -->
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

  <link rel="canonical" href="${url}" />
</head>
<body>
  <h1>${t}</h1>
  <p>${d}</p>
  <p><a href="${url}">Read on OnSpot Global</a></p>
</body>
</html>`;
}

// ── Express middleware ─────────────────────────────────────────────────────────
export async function ogMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Only handle GET page requests
  if (req.method !== "GET") return next();
  if (req.path.startsWith("/api/")) return next();
  // Let static asset requests pass through (files with extensions)
  if (/\.[a-zA-Z0-9]{1,10}$/.test(req.path)) return next();
  // Only respond to known social media crawlers — regular browsers pass through
  if (!isSocialBot(req)) return next();

  try {
    const meta = await resolveOGMeta(
      req.path,
      req.query as Record<string, string>
    );
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    // Cache bot responses for 5 minutes to avoid hammering the DB
    res.setHeader("Cache-Control", "public, max-age=300");
    res.status(200).send(buildBotHtml(meta));
  } catch (err) {
    console.error("[ogMiddleware] Unexpected error:", err);
    next(); // Fall through to the normal app on any unexpected failure
  }
}
