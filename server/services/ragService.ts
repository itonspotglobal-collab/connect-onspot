/**
 * RAG (Retrieval-Augmented Generation) Service for Vanessa
 *
 * Two-layer knowledge architecture:
 *
 *  Layer 1 — Core Knowledge File (resources/vanessa_knowledge.txt)
 *    • Vanessa's persona, brand voice, company info, leadership, values, FAQs
 *    • Manually maintained by the team; always given HIGH PRIORITY in answers
 *    • Source identifier: knowledge://vanessa_knowledge.txt
 *
 *  Layer 2 — Crawled Website Pages (onspotglobal.com)
 *    • Full content of every public page, auto-updated nightly and on demand
 *    • Preferred for page-specific details, pricing, blogs, new content
 *
 * On each chat request:
 *  1. User question is embedded with text-embedding-3-small
 *  2. Cosine similarity ranks all chunks (both layers)
 *  3. Top-K are injected into Vanessa's context — knowledge chunks first
 *  4. Vanessa answers with grounded, source-cited responses
 */

import OpenAI from "openai";
import * as fs from "fs/promises";
import * as path from "path";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Constants ─────────────────────────────────────────────────────────────────
const RAG_INDEX_PATH = path.join(process.cwd(), "resources", "rag_index.json");
const KNOWLEDGE_FILE_PATH = path.join(process.cwd(), "resources", "vanessa_knowledge.txt");

/** Special source URL used to identify knowledge-file chunks in the index */
export const KNOWLEDGE_FILE_SOURCE = "knowledge://vanessa_knowledge.txt";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 512;   // reduced from 1536 for smaller file size
const CHUNK_SIZE = 700;             // characters per chunk
const CHUNK_OVERLAP = 100;          // overlap between consecutive chunks
const MAX_CHUNKS_PER_PAGE = 12;     // cap per website page
const MAX_CHUNKS_KNOWLEDGE = 30;    // allow more chunks from the knowledge file
const MIN_CHUNK_LENGTH = 60;        // discard tiny fragments
const MIN_SIMILARITY = 0.28;        // minimum cosine similarity (slightly lower so knowledge hits surface)
const EMBED_DELAY_MS = 120;         // delay between API calls (rate limiting)

// ── Types ─────────────────────────────────────────────────────────────────────
export interface RagChunk {
  id: string;
  url: string;          // website URL  OR  KNOWLEDGE_FILE_SOURCE
  title: string;
  content: string;
  embedding: number[];
  chunkIndex: number;
  lastIndexed: string;
  isKnowledge?: boolean; // true for knowledge-file chunks
}

export interface RagIndex {
  lastUpdated: string;
  totalChunks: number;
  embeddingModel: string;
  dimensions: number;
  chunks: RagChunk[];
  knowledgeLastIndexed?: string | null;
  siteLastIndexed?: string | null;
}

export interface PageContent {
  url: string;
  title: string;
  fullText: string;
}

// ── In-memory cache ───────────────────────────────────────────────────────────
let cachedIndex: RagIndex | null = null;

// ── Text chunking ─────────────────────────────────────────────────────────────
function chunkText(text: string, maxChunks = MAX_CHUNKS_PER_PAGE): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    const end = Math.min(start + CHUNK_SIZE, normalized.length);
    const chunk = normalized.slice(start, end).trim();
    if (chunk.length >= MIN_CHUNK_LENGTH) chunks.push(chunk);
    if (end >= normalized.length) break;
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }

  return chunks.slice(0, maxChunks);
}

// ── Embedding ─────────────────────────────────────────────────────────────────
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.slice(0, 8000),
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
    const knowledgeCount = cachedIndex!.chunks.filter(c => c.isKnowledge).length;
    const siteCount = cachedIndex!.chunks.length - knowledgeCount;
    console.log(
      `📚 RAG index loaded: ${cachedIndex!.totalChunks} chunks` +
      ` (${knowledgeCount} knowledge + ${siteCount} site, ` +
      `${new Set(cachedIndex!.chunks.filter(c => !c.isKnowledge).map(c => c.url)).size} pages)`
    );
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
 * Embed the query and return the top-K most similar chunks.
 * Knowledge-file chunks that score above threshold are always included first;
 * website chunks fill the remaining slots.
 */
export async function searchRag(
  query: string,
  topK: number = 6,
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

    const relevant = scored.filter(s => s.score >= MIN_SIMILARITY);

    // Prioritise knowledge chunks: take up to 2 from knowledge file (if relevant),
    // then fill remaining slots with site chunks
    const knowledgeHits = relevant.filter(s => s.chunk.isKnowledge).slice(0, 2);
    const siteHits = relevant.filter(s => !s.chunk.isKnowledge).slice(0, topK - knowledgeHits.length);

    return [...knowledgeHits, ...siteHits].map(s => s.chunk);
  } catch (error) {
    console.error("❌ RAG search error:", error);
    return [];
  }
}

// ── Knowledge file indexing ───────────────────────────────────────────────────
/**
 * Read resources/vanessa_knowledge.txt, chunk it, embed each chunk,
 * and upsert those chunks into the RAG index.
 * All existing site-page chunks are preserved unchanged.
 */
export async function indexKnowledgeFile(): Promise<{ chunksAdded: number }> {
  console.log(`📖 Indexing knowledge file: vanessa_knowledge.txt`);

  let fileText: string;
  try {
    fileText = await fs.readFile(KNOWLEDGE_FILE_PATH, "utf-8");
  } catch {
    throw new Error(`Knowledge file not found at ${KNOWLEDGE_FILE_PATH}`);
  }

  const now = new Date().toISOString();

  // Load existing index (preserving site chunks)
  const existingIndex = await loadRagIndex();
  const existingKnowledgeMap = new Map<string, RagChunk>();
  if (existingIndex) {
    for (const chunk of existingIndex.chunks) {
      if (chunk.isKnowledge) existingKnowledgeMap.set(chunk.id, chunk);
    }
  }

  // Preserve all non-knowledge chunks
  const siteChunks: RagChunk[] = existingIndex
    ? existingIndex.chunks.filter(c => !c.isKnowledge)
    : [];

  // Chunk the knowledge file
  const textChunks = chunkText(fileText, MAX_CHUNKS_KNOWLEDGE);
  console.log(`  📝 vanessa_knowledge.txt: ${textChunks.length} chunk(s)`);

  const knowledgeChunks: RagChunk[] = [];
  let newEmbeddings = 0;
  let reusedEmbeddings = 0;

  for (let i = 0; i < textChunks.length; i++) {
    const chunkId = `${KNOWLEDGE_FILE_SOURCE}#${i}`;
    const content = textChunks[i];

    // Reuse existing embedding if content hasn't changed
    const existing = existingKnowledgeMap.get(chunkId);
    if (existing && existing.content === content) {
      knowledgeChunks.push({ ...existing, lastIndexed: now });
      reusedEmbeddings++;
      continue;
    }

    try {
      const embeddingInput = `Vanessa Core Knowledge Base\n\n${content}`;
      const embedding = await generateEmbedding(embeddingInput);
      knowledgeChunks.push({
        id: chunkId,
        url: KNOWLEDGE_FILE_SOURCE,
        title: "Vanessa Core Knowledge Base",
        content,
        embedding,
        chunkIndex: i,
        lastIndexed: now,
        isKnowledge: true,
      });
      newEmbeddings++;
      await new Promise(r => setTimeout(r, EMBED_DELAY_MS));
    } catch (error) {
      console.error(`⚠️ Failed to embed knowledge chunk ${chunkId}:`, error);
    }
  }

  const allChunks = [...siteChunks, ...knowledgeChunks];
  const newIndex: RagIndex = {
    lastUpdated: now,
    totalChunks: allChunks.length,
    embeddingModel: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    chunks: allChunks,
    knowledgeLastIndexed: now,
    siteLastIndexed: existingIndex?.siteLastIndexed ?? null,
  };

  await saveRagIndex(newIndex);
  console.log(
    `✅ Knowledge file indexed: ${knowledgeChunks.length} chunks` +
    ` (${newEmbeddings} new, ${reusedEmbeddings} reused)`
  );

  return { chunksAdded: knowledgeChunks.length };
}

// ── Site-only reindex ─────────────────────────────────────────────────────────
/**
 * Rebuild the site-page portion of the RAG index from an array of PageContent.
 * All existing knowledge-file chunks are preserved unchanged.
 * Re-uses existing embeddings for chunks whose content hasn't changed.
 */
export async function buildRagIndex(pages: PageContent[]): Promise<RagIndex> {
  console.log(`🔧 Building RAG index for ${pages.length} site page(s)…`);

  const now = new Date().toISOString();

  // Load existing index to reuse embeddings
  const existingIndex = await loadRagIndex().catch(() => null);
  const existingMap = new Map<string, RagChunk>();
  if (existingIndex) {
    for (const chunk of existingIndex.chunks) {
      existingMap.set(chunk.id, chunk);
    }
  }

  // Always preserve knowledge-file chunks
  const knowledgeChunks: RagChunk[] = existingIndex
    ? existingIndex.chunks.filter(c => c.isKnowledge)
    : [];

  const siteChunks: RagChunk[] = [];
  let newEmbeddings = 0;
  let reusedEmbeddings = 0;

  for (const page of pages) {
    if (!page.fullText || page.fullText.length < MIN_CHUNK_LENGTH) continue;

    const textChunks = chunkText(page.fullText, MAX_CHUNKS_PER_PAGE);
    console.log(`  📄 ${page.url}: ${textChunks.length} chunk(s)`);

    for (let i = 0; i < textChunks.length; i++) {
      const chunkId = `${page.url}#${i}`;
      const content = textChunks[i];

      // Reuse existing embedding if content is identical
      const existing = existingMap.get(chunkId);
      if (existing && existing.content === content) {
        siteChunks.push({ ...existing, lastIndexed: now });
        reusedEmbeddings++;
        continue;
      }

      try {
        const embedding = await generateEmbedding(`${page.title}\n\n${content}`);
        siteChunks.push({
          id: chunkId,
          url: page.url,
          title: page.title,
          content,
          embedding,
          chunkIndex: i,
          lastIndexed: now,
          isKnowledge: false,
        });
        newEmbeddings++;
        await new Promise(r => setTimeout(r, EMBED_DELAY_MS));
      } catch (error) {
        console.error(`⚠️ Failed to embed chunk ${chunkId}:`, error);
      }
    }
  }

  const allChunks = [...siteChunks, ...knowledgeChunks];
  const ragIndex: RagIndex = {
    lastUpdated: now,
    totalChunks: allChunks.length,
    embeddingModel: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    chunks: allChunks,
    siteLastIndexed: now,
    knowledgeLastIndexed: existingIndex?.knowledgeLastIndexed ?? null,
  };

  await saveRagIndex(ragIndex);
  console.log(
    `✅ RAG site index built: ${siteChunks.length} site chunks (${newEmbeddings} new, ${reusedEmbeddings} reused)` +
    ` + ${knowledgeChunks.length} preserved knowledge chunks`
  );

  return ragIndex;
}

// ── Single-page upsert ────────────────────────────────────────────────────────
/**
 * Add or re-index a single website page without touching other chunks.
 */
export async function addPageToRagIndex(page: PageContent): Promise<void> {
  const index: RagIndex = (await loadRagIndex()) ?? {
    lastUpdated: new Date().toISOString(),
    totalChunks: 0,
    embeddingModel: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    chunks: [],
    knowledgeLastIndexed: null,
    siteLastIndexed: null,
  };

  // Remove old chunks for this URL only (preserve everything else)
  index.chunks = index.chunks.filter(c => c.url !== page.url);

  const textChunks = chunkText(page.fullText, MAX_CHUNKS_PER_PAGE);
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
        isKnowledge: false,
      });
      await new Promise(r => setTimeout(r, EMBED_DELAY_MS));
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
  knowledgeChunks: number;
  siteChunks: number;
  pagesIndexed: number;
  knowledgeIndexed: boolean;
  lastUpdated: string | null;
  knowledgeLastIndexed: string | null;
  siteLastIndexed: string | null;
  embeddingModel: string;
}> {
  const index = await loadRagIndex();
  if (!index) {
    return {
      hasIndex: false,
      totalChunks: 0,
      knowledgeChunks: 0,
      siteChunks: 0,
      pagesIndexed: 0,
      knowledgeIndexed: false,
      lastUpdated: null,
      knowledgeLastIndexed: null,
      siteLastIndexed: null,
      embeddingModel: EMBEDDING_MODEL,
    };
  }

  const knowledgeChunks = index.chunks.filter(c => c.isKnowledge).length;
  const siteChunks = index.chunks.length - knowledgeChunks;

  return {
    hasIndex: true,
    totalChunks: index.totalChunks,
    knowledgeChunks,
    siteChunks,
    pagesIndexed: new Set(index.chunks.filter(c => !c.isKnowledge).map(c => c.url)).size,
    knowledgeIndexed: knowledgeChunks > 0,
    lastUpdated: index.lastUpdated,
    knowledgeLastIndexed: index.knowledgeLastIndexed ?? null,
    siteLastIndexed: index.siteLastIndexed ?? null,
    embeddingModel: index.embeddingModel,
  };
}
