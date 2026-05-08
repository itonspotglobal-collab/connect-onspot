import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  RefreshCw,
  Search,
  Database,
  Globe,
  Link,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileText,
  Brain,
  Layers,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface RagStatus {
  hasIndex: boolean;
  totalChunks: number;
  pagesIndexed: number;
  lastUpdated: string | null;
  embeddingModel: string;
}

interface RagPage {
  url: string;
  title: string;
  chunkCount: number;
  lastIndexed: string;
}

interface RagPagesResponse {
  lastUpdated: string | null;
  totalChunks: number;
  embeddingModel: string;
  pages: RagPage[];
}

interface SearchChunk {
  url: string;
  title: string;
  content: string;
  chunkIndex: number;
  lastIndexed: string;
}

interface SearchResult {
  query: string;
  totalResults: number;
  chunks: SearchChunk[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const apiRequest = async (method: string, path: string, body?: object) => {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
};

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString() : "Never";

// ── Component ─────────────────────────────────────────────────────────────────
export default function AdminVanessaRAG() {
  const { toast } = useToast();
  const [singleUrl, setSingleUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);

  // ── Queries ────────────────────────────────────────────────────────────────
  const statusQuery = useQuery<RagStatus>({
    queryKey: ["/api/rag/status"],
    queryFn: () => apiRequest("GET", "/api/rag/status"),
    refetchInterval: 15000,
  });

  const pagesQuery = useQuery<RagPagesResponse>({
    queryKey: ["/api/rag/pages"],
    queryFn: () => apiRequest("GET", "/api/rag/pages"),
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const reindexAll = useMutation({
    mutationFn: () => apiRequest("POST", "/api/rag/reindex"),
    onSuccess: () => {
      toast({
        title: "Full reindex started",
        description: "Crawling the website and rebuilding embeddings in the background. This may take several minutes.",
      });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/rag/status"] });
        queryClient.invalidateQueries({ queryKey: ["/api/rag/pages"] });
      }, 5000);
    },
    onError: (err: Error) => toast({ title: "Reindex failed", description: err.message, variant: "destructive" }),
  });

  const reindexUrl = useMutation({
    mutationFn: (url: string) => apiRequest("POST", "/api/rag/reindex-url", { url }),
    onSuccess: (data) => {
      toast({ title: "Page indexed", description: `${data.title} — ${data.chunksEstimate} chunk(s)` });
      setSingleUrl("");
      queryClient.invalidateQueries({ queryKey: ["/api/rag/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rag/pages"] });
    },
    onError: (err: Error) => toast({ title: "Indexing failed", description: err.message, variant: "destructive" }),
  });

  const runSearch = useMutation({
    mutationFn: (query: string) => apiRequest("POST", "/api/rag/search", { query, topK: 6 }),
    onSuccess: (data) => setSearchResults(data),
    onError: (err: Error) => toast({ title: "Search failed", description: err.message, variant: "destructive" }),
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  const status = statusQuery.data;

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <Brain className="w-6 h-6 text-purple-500" />
          <h1 className="text-2xl font-semibold tracking-tight">Vanessa RAG Knowledge Base</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Manage the semantic search index that powers Vanessa's website-aware answers.
        </p>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Database className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Status</span>
            </div>
            {statusQuery.isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : status?.hasIndex ? (
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="font-medium text-sm">Ready</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span className="font-medium text-sm">Not indexed</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Layers className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Chunks</span>
            </div>
            <span className="text-2xl font-semibold tabular-nums">
              {statusQuery.isLoading ? "—" : (status?.totalChunks ?? 0).toLocaleString()}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Pages</span>
            </div>
            <span className="text-2xl font-semibold tabular-nums">
              {statusQuery.isLoading ? "—" : (status?.pagesIndexed ?? 0)}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Last indexed</span>
            </div>
            <span className="text-xs text-foreground font-medium leading-tight">
              {statusQuery.isLoading ? "—" : fmtDate(status?.lastUpdated ?? null)}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Model badge */}
      {status?.embeddingModel && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Embedding model:</span>
          <Badge variant="secondary">{status.embeddingModel}</Badge>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="actions">
        <TabsList>
          <TabsTrigger value="actions">Actions</TabsTrigger>
          <TabsTrigger value="pages">Indexed Pages</TabsTrigger>
          <TabsTrigger value="search">Test Search</TabsTrigger>
        </TabsList>

        {/* Actions tab */}
        <TabsContent value="actions" className="space-y-4 mt-4">
          {/* Full reindex */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Full Site Reindex
              </CardTitle>
              <CardDescription>
                Re-crawl all pages on onspotglobal.com, extract full content, and rebuild all
                embeddings. Unchanged chunks reuse existing embeddings to save cost. This runs in
                the background and can take 5–15 minutes depending on site size.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => reindexAll.mutate()}
                disabled={reindexAll.isPending}
                className="gap-2"
              >
                {reindexAll.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {reindexAll.isPending ? "Starting…" : "Reindex all pages"}
              </Button>
            </CardContent>
          </Card>

          {/* Single URL */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Link className="w-4 h-4" />
                Index a Single Page
              </CardTitle>
              <CardDescription>
                Add or refresh one specific page without re-crawling the whole site. Useful when
                you've just added or updated a single page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="https://onspotglobal.com/pricing"
                  value={singleUrl}
                  onChange={(e) => setSingleUrl(e.target.value)}
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && singleUrl.trim()) reindexUrl.mutate(singleUrl.trim());
                  }}
                />
                <Button
                  onClick={() => singleUrl.trim() && reindexUrl.mutate(singleUrl.trim())}
                  disabled={reindexUrl.isPending || !singleUrl.trim()}
                  className="gap-2 shrink-0"
                >
                  {reindexUrl.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Link className="w-4 h-4" />
                  )}
                  {reindexUrl.isPending ? "Indexing…" : "Index URL"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* How it works */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">How RAG works</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                <li>The crawler visits all pages on onspotglobal.com and extracts clean body text.</li>
                <li>Each page's text is split into ~700-character chunks with 100-character overlap.</li>
                <li>Every chunk is converted to a 512-dimensional vector using OpenAI <code className="text-xs bg-muted px-1 rounded">text-embedding-3-small</code>.</li>
                <li>Vectors are saved to <code className="text-xs bg-muted px-1 rounded">resources/rag_index.json</code> and cached in memory.</li>
                <li>When a user asks Vanessa a question, the question is also embedded.</li>
                <li>Cosine similarity finds the 6 most relevant chunks (above 0.30 threshold).</li>
                <li>Those chunks are injected into Vanessa's context before the AI generates a response.</li>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pages tab */}
        <TabsContent value="pages" className="mt-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Indexed Pages</CardTitle>
                <CardDescription>
                  {pagesQuery.data?.pages.length ?? 0} page(s) · {pagesQuery.data?.totalChunks ?? 0} total chunks
                </CardDescription>
              </div>
              <Button
                size="default"
                variant="outline"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/rag/pages"] })}
                className="gap-2 shrink-0"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {pagesQuery.isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : !pagesQuery.data?.pages.length ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  No pages indexed yet. Run a full reindex to get started.
                </div>
              ) : (
                <div className="divide-y">
                  {pagesQuery.data.pages.map((page) => (
                    <div key={page.url} className="flex items-start gap-3 px-6 py-3">
                      <Globe className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{page.title}</p>
                        <a
                          href={page.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:underline break-all"
                        >
                          {page.url}
                        </a>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge variant="secondary" className="text-xs">
                          {page.chunkCount} chunk{page.chunkCount !== 1 ? "s" : ""}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(page.lastIndexed).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Search tab */}
        <TabsContent value="search" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="w-4 h-4" />
                Test Semantic Search
              </CardTitle>
              <CardDescription>
                Simulate a user question to see which chunks Vanessa would retrieve.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. What are your pricing plans?"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && searchQuery.trim()) runSearch.mutate(searchQuery.trim());
                  }}
                />
                <Button
                  onClick={() => searchQuery.trim() && runSearch.mutate(searchQuery.trim())}
                  disabled={runSearch.isPending || !searchQuery.trim()}
                  className="gap-2 shrink-0"
                >
                  {runSearch.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  {runSearch.isPending ? "Searching…" : "Search"}
                </Button>
              </div>

              {searchResults && (
                <div className="space-y-3 pt-2">
                  <p className="text-xs text-muted-foreground">
                    {searchResults.totalResults} result(s) for &ldquo;{searchResults.query}&rdquo;
                  </p>
                  {searchResults.chunks.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No relevant chunks found above the similarity threshold (0.30).
                    </p>
                  ) : (
                    searchResults.chunks.map((chunk, idx) => (
                      <Card key={`${chunk.url}-${chunk.chunkIndex}`}>
                        <CardContent className="pt-4 pb-4 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{chunk.title}</p>
                              <a
                                href={chunk.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-muted-foreground hover:underline"
                              >
                                {chunk.url}
                              </a>
                            </div>
                            <Badge variant="outline" className="shrink-0 text-xs">
                              #{idx + 1}
                            </Badge>
                          </div>
                          <p className="text-sm text-foreground/80 leading-relaxed bg-muted rounded-md px-3 py-2">
                            {chunk.content}
                          </p>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
