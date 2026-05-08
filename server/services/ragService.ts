/**
 * RAG (Retrieval-Augmented Generation) Service for Vanessa
 *
 * Architecture:
 *  1. Website pages are crawled and stored as chunks in rag_index.json
 *  2. Each chunk has an OpenAI embedding (text-embedding-3-small, 512 dims)
 *  3. On each chat request, the user's question is embedded and compared
 *     against all stored chunks using cosine similarity
 *  4. The top-K most relevant chunks are injected into Vanessa's context
 *     so she can answer with precise, website-grounded information
 */

import OpenAI from "openai";
import * as fs from "fs/promises";
import * as path from "path";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Constants ─────────────────────────────────────────────────────────────────
const RAG_INDEX_PATH = path.join(process.cwd(), "resources", "rag_index.json");
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 512;   // reduced from 1536 for smaller file size
const CHUNK_SIZE = 700;             // characters per chunk
const CHUNK_OVERLAP = 100;          // overlap between consecutive chunks
const MAX_CHUNKS_PER_PAGE = 12;     // cap chunks per page to avoid bloat
const MIN_CHUNK_LENGTH = 60;        // discard tiny fragments
const MIN_SIMILARITY = 0.30;        // minimum cosine similarity to include a result
const EMBED_DELAY_MS = 120;         // delay between embedding API calls (rate limit)

// ── Types ─────────────────────────────────────────────────────────────────────
export interface RagChunk {
  id: string;
  url: string;
  title: string;
  content: string;
  embedding: number[];
  chunkIndex: number;
  lastIndexed: string;
}

export interface RagIndex {
  lastUpdated: string;
  totalChunks: number;
  embeddingModel: string;
  dimensions: number;
  chunks: RagChunk[];
}

export interface PageContent {
  url: string;
  title: string;
  fullText: string;
}

// ── In-memory cache (avoids reloading multi-MB file on every chat) ────────────
let cachedIndex: RagIndex | null = null;

// ── Text chunking ─────────────────────────────────────────────────────────────
function chunkText(text: string): string[] {
  // Normalize whitespace
  const normalized = text.replace(/\s+/g, " ").trim();
  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    const end = Math.min(start + CHUNK_SIZE, normalized.length);
    const chunk = normalized.slice(start, end).trim();
    if (chunk.length >= MIN_CHUNK_LENGTH) {
      chunks.push(chunk);
    }
    if (end >= normalized.length) break;
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }

  return chunks;
}

// ── Embedding generation ──────────────────────────────────────────────────────
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.slice(0, 8000), // API limit
    dimensions: EMBEDDING_DIMENSIONS,
  });
  return response.data[0].embedding;
}

// ── Cosine similarity ─────────────────────────────────────────────────────────
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ── Index persistence ─────────────────────────────────────────────────────────
export async function loadRagIndex(): Promise<RagIndex | null> {
  if (cachedIndex) return cachedIndex;
  try {
    const data = await fs.readFile(RAG_INDEX_PATH, "utf-8");
    cachedIndex = JSON.parse(data);
    console.log(`📚 RAG index loaded: ${cachedIndex!.totalChunks} chunks from ${new Set(cachedIndex!.chunks.map(c => c.url)).size} pages`);
    return cachedIndex;
  } catch {
    return null;
  }
}

async function saveRagIndex(index: RagIndex): Promise<void> {
  await fs.mkdir(path.dirname(RAG_INDEX_PATH), { recursive: true });
  await fs.writeFile(RAG_INDEX_PATH, JSON.stringify(index), "utf-8");
  cachedIndex = index;
  console.log(`💾 RAG index saved: ${index.totalChunks} chunks`);
}

export function invalidateRagCache(): void {
  cachedIndex = null;
}

// ── Semantic search ───────────────────────────────────────────────────────────
/**
 * Embed the user's question and return the top-K most similar chunks.
 * Returns an empty array if the RAG index doesn't exist or OpenAI fails.
 */
export async function searchRag(
  query: string,
  topK: number = 5,
): Promise<RagChunk[]> {
  const index = await loadRagIndex();
  if (!index || index.chunks.length === 0) return [];

  try {
    const queryEmbedding = await generateEmbedding(query);

    const scored = index.chunks.map((chunk) => ({
      chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }));

    scored.sort((a, b) => b.score - a.score);

    return scored
      .filter((s) => s.score >= MIN_SIMILARITY)
      .slice(0, topK)
      .map((s) => s.chunk);
  } catch (error) {
    console.error("❌ RAG search error:", error);
    return [];
  }
}

// ── Full index build ──────────────────────────────────────────────────────────
/**
 * (Re)build the entire RAG index from an array of PageContent objects.
 * Re-uses existing embeddings for chunks whose content hasn't changed.
 */
export async function buildRagIndex(pages: PageContent[]): Promise<RagIndex> {
  console.log(`🔧 Building RAG index for ${pages.length} pages…`);

  const now = new Date().toISOString();

  // Load existing index to reuse unchanged embeddings
  const existingIndex = await loadRagIndex().catch(() => null);
  const existingMap = new Map<string, RagChunk>();
  if (existingIndex) {
    for (const chunk of existingIndex.chunks) {
      existingMap.set(chunk.id, chunk);
    }
  }

  const allChunks: RagChunk[] = [];
  let newEmbeddings = 0;
  let reusedEmbeddings = 0;

  for (const page of pages) {
    if (!page.fullText || page.fullText.length < MIN_CHUNK_LENGTH) continue;

    const textChunks = chunkText(page.fullText).slice(0, MAX_CHUNKS_PER_PAGE);
    console.log(`  📄 ${page.url}: ${textChunks.length} chunk(s)`);

    for (let i = 0; i < textChunks.length; i++) {
      const chunkId = `${page.url}#${i}`;
      const content = textChunks[i];

      // Reuse existing embedding if content is identical
      const existing = existingMap.get(chunkId);
      if (existing && existing.content === content) {
        allChunks.push({ ...existing, lastIndexed: now });
        reusedEmbeddings++;
        continue;
      }

      // Generate new embedding
      try {
        // Prepend title so the embedding carries page context
        const embeddingInput = `${page.title}\n\n${content}`;
        const embedding = await generateEmbedding(embeddingInput);
        allChunks.push({
          id: chunkId,
          url: page.url,
          title: page.title,
          content,
          embedding,
          chunkIndex: i,
          lastIndexed: now,
        });
        newEmbeddings++;

        // Rate-limit: pause between API calls
        await new Promise((r) => setTimeout(r, EMBED_DELAY_MS));
      } catch (error) {
        console.error(`⚠️ Failed to embed chunk ${chunkId}:`, error);
      }
    }
  }

  const ragIndex: RagIndex = {
    lastUpdated: now,
    totalChunks: allChunks.length,
    embeddingModel: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    chunks: allChunks,
  };

  await saveRagIndex(ragIndex);
  console.log(
    `✅ RAG index built: ${allChunks.length} chunks (${newEmbeddings} new, ${reusedEmbeddings} reused)`
  );

  return ragIndex;
}

// ── Single-page upsert ────────────────────────────────────────────────────────
/**
 * Add or re-index a single page without rebuilding the entire index.
 */
export async function addPageToRagIndex(page: PageContent): Promise<void> {
  const index: RagIndex = (await loadRagIndex()) ?? {
    lastUpdated: new Date().toISOString(),
    totalChunks: 0,
    embeddingModel: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    chunks: [],
  };

  // Remove old chunks for this URL
  index.chunks = index.chunks.filter((c) => c.url !== page.url);

  const textChunks = chunkText(page.fullText).slice(0, MAX_CHUNKS_PER_PAGE);
  const now = new Date().toISOString();

  for (let i = 0; i < textChunks.length; i++) {
    try {
      const embedding = await generateEmbedding(`${page.title}\n\n${textChunks[i]}`);
      index.chunks.push({
        id: `${page.url}#${i}`,
        url: page.url,
        title: page.title,
        content: textChunks[i],
        embedding,
        chunkIndex: i,
        lastIndexed: now,
      });
      await new Promise((r) => setTimeout(r, EMBED_DELAY_MS));
    } catch (error) {
      console.error(`⚠️ Failed to embed chunk for ${page.url}:`, error);
    }
  }

  index.lastUpdated = now;
  index.totalChunks = index.chunks.length;

  await saveRagIndex(index);
  console.log(`✅ Page indexed: ${page.url} (${textChunks.length} chunks)`);
}

// ── Status ────────────────────────────────────────────────────────────────────
export async function getRagStatus(): Promise<{
  hasIndex: boolean;
  totalChunks: number;
  pagesIndexed: number;
  lastUpdated: string | null;
  embeddingModel: string;
}> {
  const index = await loadRagIndex();
  if (!index) {
    return {
      hasIndex: false,
      totalChunks: 0,
      pagesIndexed: 0,
      lastUpdated: null,
      embeddingModel: EMBEDDING_MODEL,
    };
  }
  return {
    hasIndex: true,
    totalChunks: index.totalChunks,
    pagesIndexed: new Set(index.chunks.map((c) => c.url)).size,
    lastUpdated: index.lastUpdated,
    embeddingModel: index.embeddingModel,
  };
}
