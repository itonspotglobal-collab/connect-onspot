import axios from "axios";
import * as cheerio from "cheerio";
import OpenAI from "openai";
import * as fs from "fs/promises";
import * as path from "path";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface CrawledPage {
  url: string;
  title: string;
  summary: string;
  lastCrawled: string;
}

interface SiteIndex {
  lastUpdated: string;
  totalPages: number;
  pages: CrawledPage[];
}

const BASE_URL = "https://onspotglobal.com";
const MAX_PAGES = 200;
const MAX_DEPTH = 3;
const CRAWL_DELAY_MS = 1000; // 1 second between requests
const SITE_INDEX_PATH = path.join(process.cwd(), "resources", "site_index.json");

// URLs to exclude from crawling
const EXCLUDED_PATTERNS = [
  "/vanessa-responses",
  "/admin",
  "/dashboard",
  "/login",
  "/api/",
  "?",
  "#",
];

// Known pages for fallback when sitemap/crawling fails (client-rendered sites)
const KNOWN_PAGES = [
  "/",
  "/about",
  "/services",
  "/pricing",
  "/contact",
  "/careers",
  "/clients",
  "/talent",
  "/outsourcing",
  "/virtual-assistants",
  "/staffing",
  "/bpo",
  "/faq",
  "/privacy",
  "/terms",
  "/coming-soon",
  "/legalops",
];

// Track visited URLs to avoid duplicates
const visitedUrls = new Set<string>();
const crawledPages: CrawledPage[] = [];

/**
 * Normalizes a URL by removing trailing slashes and fragments
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove trailing slash
    let normalized = parsed.origin + parsed.pathname.replace(/\/$/, "");
    return normalized;
  } catch {
    return url;
  }
}

/**
 * Checks if a URL should be excluded from crawling
 */
function shouldExcludeUrl(url: string): boolean {
  const normalized = normalizeUrl(url);
  
  // Must be from the same domain
  if (!normalized.startsWith(BASE_URL)) {
    return true;
  }

  // Check against excluded patterns
  for (const pattern of EXCLUDED_PATTERNS) {
    if (url.includes(pattern)) {
      return true;
    }
  }

  return false;
}

/**
 * Extracts text content from a Cheerio element
 */
function extractText($: cheerio.CheerioAPI, selector: string): string {
  return $(selector)
    .map((_, el) => $(el).text().trim())
    .get()
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Summarizes page content using OpenAI
 */
async function summarizeContent(
  title: string,
  headings: string,
  content: string
): Promise<string> {
  try {
    const prompt = `Summarize this webpage in 1-2 concise sentences:

Title: ${title}
Headings: ${headings}
Content: ${content.substring(0, 1500)}

Provide a clear, user-friendly summary of what this page is about.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that creates concise webpage summaries.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 100,
      temperature: 0.3,
    });

    return response.choices[0]?.message?.content?.trim() || title;
  } catch (error) {
    console.error(`⚠️ Failed to summarize content for ${title}:`, error);
    return title;
  }
}

/**
 * Crawls a single page and extracts content
 */
async function crawlPage(url: string): Promise<CrawledPage | null> {
  try {
    console.log(`📄 Crawling: ${url}`);

    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        "User-Agent": "OnSpot-Vanessa-Bot/1.0",
      },
    });

    const $ = cheerio.load(response.data);

    // Extract page title
    const title = $("title").text().trim() || $("h1").first().text().trim() || "Untitled Page";

    // Extract headings
    const headings = extractText($, "h1, h2, h3");

    // Extract paragraph content
    const paragraphs = extractText($, "p");

    // Combine content for summarization
    const contentPreview = `${headings} ${paragraphs}`.substring(0, 2000);

    // Generate summary using OpenAI
    const summary = await summarizeContent(title, headings, contentPreview);

    return {
      url: normalizeUrl(url),
      title,
      summary,
      lastCrawled: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error(`❌ Failed to crawl ${url}:`, error.message);
    return null;
  }
}

/**
 * Fetches sitemap.xml and extracts URLs
 */
async function discoverFromSitemap(): Promise<string[]> {
  const sitemapUrls = [
    `${BASE_URL}/sitemap.xml`,
    `${BASE_URL}/sitemap-0.xml`,
    `${BASE_URL}/sitemap_index.xml`,
  ];
  
  const links: string[] = [];
  
  for (const sitemapUrl of sitemapUrls) {
    try {
      console.log(`📍 Checking sitemap: ${sitemapUrl}`);
      const response = await axios.get(sitemapUrl, {
        timeout: 10000,
        headers: { "User-Agent": "OnSpot-Vanessa-Bot/1.0" },
      });
      
      const $ = cheerio.load(response.data, { xmlMode: true });
      
      // Extract URLs from sitemap
      $("url loc, sitemap loc").each((_, el) => {
        const loc = $(el).text().trim();
        if (loc && loc.startsWith(BASE_URL) && !shouldExcludeUrl(loc)) {
          links.push(normalizeUrl(loc));
        }
      });
      
      if (links.length > 0) {
        console.log(`✅ Found ${links.length} URLs in sitemap`);
        break; // Use first successful sitemap
      }
    } catch (error) {
      // Sitemap not found, continue to next
    }
  }
  
  return links;
}

/**
 * Extracts links from Next.js __NEXT_DATA__ script tag
 */
function extractNextDataLinks($: cheerio.CheerioAPI): string[] {
  const links: string[] = [];
  
  try {
    const nextDataScript = $("#__NEXT_DATA__").html();
    if (nextDataScript) {
      const nextData = JSON.parse(nextDataScript);
      
      // Extract page paths from buildManifest or props
      const extractPaths = (obj: any, paths: string[] = []): string[] => {
        if (!obj || typeof obj !== "object") return paths;
        
        for (const [key, value] of Object.entries(obj)) {
          if (key === "href" || key === "url" || key === "pathname" || key === "path") {
            if (typeof value === "string" && value.startsWith("/") && !value.includes("?")) {
              const fullUrl = `${BASE_URL}${value}`;
              if (!shouldExcludeUrl(fullUrl)) {
                paths.push(normalizeUrl(fullUrl));
              }
            }
          }
          if (typeof value === "object") {
            extractPaths(value, paths);
          }
        }
        return paths;
      };
      
      const extracted = extractPaths(nextData);
      links.push(...extracted);
    }
  } catch (error) {
    // JSON parse failed, skip
  }
  
  return links;
}

/**
 * Discovers internal links on a page
 */
async function discoverLinks(url: string): Promise<string[]> {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        "User-Agent": "OnSpot-Vanessa-Bot/1.0",
      },
    });

    const $ = cheerio.load(response.data);
    const links: string[] = [];

    // Standard anchor tag discovery
    $("a[href]").each((_, element) => {
      const href = $(element).attr("href");
      if (!href) return;

      // Convert relative URLs to absolute
      let absoluteUrl: string;
      try {
        absoluteUrl = new URL(href, url).href;
      } catch {
        return;
      }

      const normalized = normalizeUrl(absoluteUrl);

      // Only include if it's from our domain and not excluded
      if (!shouldExcludeUrl(normalized) && !visitedUrls.has(normalized)) {
        links.push(normalized);
      }
    });

    // Also check for Next.js __NEXT_DATA__ links
    const nextLinks = extractNextDataLinks($);
    for (const link of nextLinks) {
      if (!visitedUrls.has(link) && !links.includes(link)) {
        links.push(link);
      }
    }

    return links;
  } catch (error) {
    console.error(`❌ Failed to discover links from ${url}`);
    return [];
  }
}

/**
 * Recursive crawler with depth limit
 */
async function crawlRecursive(url: string, depth: number = 0): Promise<void> {
  // Check depth limit
  if (depth > MAX_DEPTH) {
    return;
  }

  // Check page limit
  if (crawledPages.length >= MAX_PAGES) {
    return;
  }

  const normalized = normalizeUrl(url);

  // Skip if already visited or excluded
  if (visitedUrls.has(normalized) || shouldExcludeUrl(normalized)) {
    return;
  }

  // Mark as visited
  visitedUrls.add(normalized);

  // Crawl the page
  const pageData = await crawlPage(normalized);
  if (pageData) {
    crawledPages.push(pageData);
  }

  // Delay between requests
  await new Promise((resolve) => setTimeout(resolve, CRAWL_DELAY_MS));

  // Discover and crawl child links
  const links = await discoverLinks(normalized);
  for (const link of links) {
    if (crawledPages.length >= MAX_PAGES) break;
    await crawlRecursive(link, depth + 1);
  }
}

/**
 * Main crawl function that orchestrates the entire crawling process
 */
export async function crawlWebsite(): Promise<SiteIndex> {
  console.log(`🌐 Starting crawl of ${BASE_URL}...`);

  // Reset state
  visitedUrls.clear();
  crawledPages.length = 0;

  const startTime = Date.now();

  try {
    // First, try to discover URLs from sitemap
    const sitemapUrls = await discoverFromSitemap();
    
    if (sitemapUrls.length > 0) {
      console.log(`📍 Crawling ${sitemapUrls.length} URLs from sitemap...`);
      for (const url of sitemapUrls) {
        if (crawledPages.length >= MAX_PAGES) break;
        
        const normalized = normalizeUrl(url);
        if (visitedUrls.has(normalized) || shouldExcludeUrl(normalized)) continue;
        
        visitedUrls.add(normalized);
        const pageData = await crawlPage(normalized);
        if (pageData) {
          crawledPages.push(pageData);
        }
        await new Promise((resolve) => setTimeout(resolve, CRAWL_DELAY_MS));
      }
    }
    
    // Then do recursive crawl from homepage for any pages not in sitemap
    await crawlRecursive(BASE_URL);
    
    // If very few pages found, use known pages fallback (for client-rendered sites)
    if (crawledPages.length < 5) {
      console.log(`📍 Using known pages fallback (${KNOWN_PAGES.length} pages)...`);
      for (const pagePath of KNOWN_PAGES) {
        if (crawledPages.length >= MAX_PAGES) break;
        
        const fullUrl = `${BASE_URL}${pagePath}`;
        const normalized = normalizeUrl(fullUrl);
        
        if (visitedUrls.has(normalized)) continue;
        
        visitedUrls.add(normalized);
        const pageData = await crawlPage(normalized);
        if (pageData) {
          crawledPages.push(pageData);
        }
        await new Promise((resolve) => setTimeout(resolve, CRAWL_DELAY_MS));
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Crawl completed in ${duration}s — ${crawledPages.length} pages indexed`);

    // Create site index
    const siteIndex: SiteIndex = {
      lastUpdated: new Date().toISOString(),
      totalPages: crawledPages.length,
      pages: crawledPages,
    };

    // Save to file
    await saveSiteIndex(siteIndex);

    return siteIndex;
  } catch (error: any) {
    console.error(`❌ Crawl failed:`, error);
    throw error;
  }
}

/**
 * Saves the site index to the JSON file
 */
async function saveSiteIndex(siteIndex: SiteIndex): Promise<void> {
  try {
    const dirPath = path.dirname(SITE_INDEX_PATH);
    
    // Ensure directory exists
    await fs.mkdir(dirPath, { recursive: true });

    // Write to file
    await fs.writeFile(SITE_INDEX_PATH, JSON.stringify(siteIndex, null, 2), "utf-8");

    console.log(`💾 Site index saved to ${SITE_INDEX_PATH}`);
  } catch (error: any) {
    console.error(`❌ Failed to save site index:`, error);
    throw error;
  }
}

/**
 * Loads the site index from the JSON file
 */
export async function loadSiteIndex(): Promise<SiteIndex | null> {
  try {
    const data = await fs.readFile(SITE_INDEX_PATH, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.log(`⚠️ No existing site index found`);
    return null;
  }
}

/**
 * Searches the site index for pages matching a query
 */
export function searchSiteIndex(siteIndex: SiteIndex, query: string): CrawledPage[] {
  const lowerQuery = query.toLowerCase();
  
  return siteIndex.pages.filter((page) => {
    const titleMatch = page.title.toLowerCase().includes(lowerQuery);
    const summaryMatch = page.summary.toLowerCase().includes(lowerQuery);
    const urlMatch = page.url.toLowerCase().includes(lowerQuery);
    
    return titleMatch || summaryMatch || urlMatch;
  });
}
