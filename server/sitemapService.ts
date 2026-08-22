/**
 * Dynamic Sitemap Generator
 *
 * Generates a standards-compliant XML sitemap that includes:
 *  - All static public routes with hand-tuned priorities
 *  - Every published blog/Insights post (with accurate lastmod from publishedAt)
 *  - Every currently open and approved job listing
 *
 * Served at GET /sitemap.xml (takes precedence over the static public/sitemap.xml
 * because the Express route is registered before express.static middleware).
 */

import { storage } from "./storage";

const SITE = "https://www.onspotglobal.com";
const TODAY = new Date().toISOString().split("T")[0];

interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority: string;
}

// ── Static route matrix ────────────────────────────────────────────────────────
const STATIC_ROUTES: SitemapEntry[] = [
  // High-priority marketing pages
  { loc: "/",                              changefreq: "weekly",  priority: "1.0" },
  { loc: "/hire-talent",                   changefreq: "weekly",  priority: "0.9" },
  { loc: "/find-work",                     changefreq: "weekly",  priority: "0.9" },
  { loc: "/find-work/all-jobs",            changefreq: "daily",   priority: "0.9" },
  { loc: "/pricing",                       changefreq: "monthly", priority: "0.8" },
  { loc: "/enterprise",                    changefreq: "monthly", priority: "0.8" },
  { loc: "/insights",                      changefreq: "weekly",  priority: "0.8" },
  { loc: "/ai-assistant",                  changefreq: "monthly", priority: "0.8" },
  { loc: "/investors",                     changefreq: "monthly", priority: "0.8" },

  // Why OnSpot section
  { loc: "/why-onspot",                    changefreq: "monthly", priority: "0.8" },
  { loc: "/why-onspot/about",              changefreq: "monthly", priority: "0.7" },
  { loc: "/why-onspot/case-studies",       changefreq: "monthly", priority: "0.7" },
  { loc: "/why-onspot/reviews",            changefreq: "monthly", priority: "0.7" },
  { loc: "/why-onspot/experience",         changefreq: "monthly", priority: "0.7" },
  { loc: "/why-onspot/integrator-system",  changefreq: "monthly", priority: "0.7" },
  { loc: "/why-onspot/value-calculator",   changefreq: "monthly", priority: "0.7" },

  // Services
  { loc: "/services/ai-assistant",         changefreq: "monthly", priority: "0.8" },
  { loc: "/services/managed",              changefreq: "monthly", priority: "0.8" },
  { loc: "/services/resourced",            changefreq: "monthly", priority: "0.8" },
  { loc: "/services/enterprise",           changefreq: "monthly", priority: "0.8" },
  { loc: "/services/human-va",             changefreq: "monthly", priority: "0.8" },

  // Discovery / lead-gen
  { loc: "/faq",                           changefreq: "monthly", priority: "0.7" },
  { loc: "/lead-intake",                   changefreq: "monthly", priority: "0.7" },
  { loc: "/affiliate-marketing",           changefreq: "monthly", priority: "0.7" },
  { loc: "/bpo-partner",                   changefreq: "monthly", priority: "0.7" },
  { loc: "/waitlist",                      changefreq: "monthly", priority: "0.7" },

  // Trust / legal
  { loc: "/payment-protection",            changefreq: "monthly", priority: "0.6" },
  { loc: "/client-verification",           changefreq: "monthly", priority: "0.6" },
  { loc: "/trust-safety",                  changefreq: "monthly", priority: "0.6" },
  { loc: "/terms-and-conditions",          changefreq: "yearly",  priority: "0.3" },
  { loc: "/privacy",                       changefreq: "yearly",  priority: "0.3" },
  { loc: "/refund-policy",                 changefreq: "yearly",  priority: "0.3" },

  // PH-facing talent pages
  { loc: "/get-hired",                     changefreq: "weekly",  priority: "0.9" },
];

// ── XML helpers ────────────────────────────────────────────────────────────────
function xmlEscape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function urlEntry(e: SitemapEntry): string {
  const loc = xmlEscape(`${SITE}${e.loc}`);
  return [
    "  <url>",
    `    <loc>${loc}</loc>`,
    `    <lastmod>${e.lastmod ?? TODAY}</lastmod>`,
    `    <changefreq>${e.changefreq}</changefreq>`,
    `    <priority>${e.priority}</priority>`,
    "  </url>",
  ].join("\n");
}

// ── Main generator ─────────────────────────────────────────────────────────────
export async function generateSitemapXml(): Promise<string> {
  // Fetch dynamic content in parallel
  const [publishedPosts, openJobs] = await Promise.allSettled([
    storage.listPublishedPosts(),
    storage.searchJobs({ status: "open" }),
  ]);

  const entries: SitemapEntry[] = [...STATIC_ROUTES];

  // ── Insights / blog posts ──────────────────────────────────────────────────
  if (publishedPosts.status === "fulfilled") {
    for (const post of publishedPosts.value) {
      if (!post.slug) continue;
      const lastmod = post.publishedAt
        ? new Date(post.publishedAt).toISOString().split("T")[0]
        : TODAY;
      entries.push({
        loc: `/insights/${post.slug}`,
        lastmod,
        changefreq: "monthly",
        priority: "0.7",
      });
    }
  } else {
    console.error("[sitemap] Failed to fetch posts:", publishedPosts.reason);
  }

  // ── Open job listings ──────────────────────────────────────────────────────
  if (openJobs.status === "fulfilled") {
    for (const job of openJobs.value) {
      if (!job.id) continue;
      // Only include approved jobs
      if ((job as any).approvalStatus && (job as any).approvalStatus !== "approved") continue;
      const lastmod = job.createdAt
        ? new Date(job.createdAt).toISOString().split("T")[0]
        : TODAY;
      entries.push({
        loc: `/jobs/${job.id}`,
        lastmod,
        changefreq: "weekly",
        priority: "0.6",
      });
    }
  } else {
    console.error("[sitemap] Failed to fetch jobs:", openJobs.reason);
  }

  const urlBlocks = entries.map(urlEntry).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urlBlocks}
</urlset>`;
}
