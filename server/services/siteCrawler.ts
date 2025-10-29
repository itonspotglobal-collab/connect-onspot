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
    // Start crawling from the homepage
    await crawlRecursive(BASE_URL);

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
