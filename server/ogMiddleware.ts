import { Request, Response, NextFunction } from "express";

const SOCIAL_BOT_PATTERNS = [
  "facebookexternalhit",
  "facebot",
  "twitterbot",
  "slackbot",
  "slack-imgproxy",
  "whatsapp",
  "discordbot",
  "linkedinbot",
  "telegrambot",
  "pinterest",
  "rogerbot",
  "ia_archiver",
  "embedly",
  "outbrain",
  "quora link preview",
  "showyoubot",
  "outbrain",
  "w3c_validator",
  "applebot",
  "developers.google.com/+/web/snippet",
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

interface OGMeta {
  title: string;
  description: string;
  image: string;
  url: string;
}

const IMAGE = "https://onspotglobal.com/heart.png";
const SITE = "https://onspotglobal.com";

function resolveOGMeta(pathname: string, query: Record<string, string>): OGMeta {
  if (pathname.startsWith("/find-work")) {
    const cat = query.category && query.category !== "all" ? query.category : null;
    const catLabel = cat ? ` – ${cat.charAt(0).toUpperCase() + cat.slice(1)}` : "";
    const url = cat
      ? `${SITE}/find-work?category=${encodeURIComponent(cat)}`
      : `${SITE}/find-work`;
    return {
      title: `Find Work${catLabel} | OnSpot Global`,
      description:
        "Browse remote outsourcing jobs in customer support, development, design, marketing, and more. OnSpot connects top Philippine talent with global clients.",
      image: IMAGE,
      url,
    };
  }

  if (pathname.startsWith("/insights") || pathname.startsWith("/blog")) {
    return {
      title: "Insights – Outsourcing Intelligence | OnSpot Global",
      description:
        "Expert articles on outsourcing strategy, BPO trends, AI-driven talent matching, and building remote teams across the Philippines and beyond.",
      image: IMAGE,
      url: `${SITE}/insights`,
    };
  }

  if (pathname.startsWith("/admin")) {
    return {
      title: "Admin Dashboard | OnSpot Global",
      description: "OnSpot admin portal.",
      image: IMAGE,
      url: `${SITE}/admin`,
    };
  }

  // Homepage / catch-all default
  return {
    title: "OnSpot – The Superhuman Outsourcing System",
    description:
      "The first integrator system that simplifies outsourcing management. Built by entrepreneurs, for entrepreneurs—fusing AI-first infrastructure with human excellence.",
    image: IMAGE,
    url: SITE,
  };
}

function buildBotHtml(meta: OGMeta): string {
  const t = escapeHtml(meta.title);
  const d = escapeHtml(meta.description);
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
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="OnSpot" />
  <meta property="og:url" content="${meta.url}" />
  <meta property="og:title" content="${t}" />
  <meta property="og:description" content="${d}" />
  <meta property="og:image" content="${meta.image}" />
  <meta property="og:image:url" content="${meta.image}" />
  <meta property="og:image:secure_url" content="${meta.image}" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="OnSpot – Superhuman Outsourcing" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@OnSpotGlobal" />
  <meta name="twitter:url" content="${meta.url}" />
  <meta name="twitter:title" content="${t}" />
  <meta name="twitter:description" content="${d}" />
  <meta name="twitter:image" content="${meta.image}" />
  <meta name="twitter:image:alt" content="OnSpot – Superhuman Outsourcing" />

  <link rel="canonical" href="${meta.url}" />
</head>
<body>
  <h1>${t}</h1>
  <p>${d}</p>
  <p><a href="${meta.url}">Visit OnSpot Global</a></p>
</body>
</html>`;
}

export function ogMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Only intercept GET requests for page routes (not API, not static assets)
  if (req.method !== "GET") return next();
  if (req.path.startsWith("/api/")) return next();
  // Let through any path that looks like a file with an extension
  if (/\.[a-zA-Z0-9]{1,10}$/.test(req.path)) return next();
  // Only respond to known social media crawlers
  if (!isSocialBot(req)) return next();

  const meta = resolveOGMeta(req.path, req.query as Record<string, string>);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300"); // 5-minute cache for bots
  res.status(200).send(buildBotHtml(meta));
}
