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
  BookOpen,
  Zap,
  Briefcase,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface RagStatus {
  hasIndex: boolean;
  totalChunks: number;
  knowledgeChunks: number;
  siteChunks: number;
  jobChunks: number;
  pagesIndexed: number;
  jobsIndexed: number;
  knowledgeIndexed: boolean;
  jobsIndexedFlag: boolean;
  lastUpdated: string | null;
  knowledgeLastIndexed: string | null;
  siteLastIndexed: string | null;
  jobsLastIndexed: string | null;
  embeddingModel: string;
}

interface RagPage {
  url: string;
  title: string;
  chunkCount: number;
  lastIndexed: string;
  isKnowledge?: boolean;
  isJob?: boolean;
}

interface RagPagesResponse {
  lastUpdated: string | null;
  totalChunks: number;
  embeddingModel: string;
  jobsLastIndexed: string | null;
  pages: RagPage[];
}

interface SearchChunk {
  url: string;
  title: string;
  content: string;
  chunkIndex: number;
  lastIndexed: string;
  isKnowledge?: boolean;
  isJob?: boolean;
}

interface SearchResult {
  query: string;
  totalResults: number;
  chunks: SearchChunk[];
}

// ── Constants ─────────────────────────────────────────────────────────────────
const KNOWLEDGE_SOURCE = "knowledge://vanessa_knowledge.txt";
const JOB_SOURCE_PREFIX = "jobs://";

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

const fmtDateShort = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString() : "Never";

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
    refetchInterval: 12000,
  });

  const pagesQuery = useQuery<RagPagesResponse>({
    queryKey: ["/api/rag/pages"],
    queryFn: () => apiRequest("GET", "/api/rag/pages"),
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const invalidateAfter = (ms = 5000) =>
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/rag/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rag/pages"] });
    }, ms);

  const reindexBoth = useMutation({
    mutationFn: () => apiRequest("POST", "/api/rag/reindex"),
    onSuccess: () => {
      toast({
        title: "Full reindex started",
        description:
          "Crawling website pages and re-indexing the knowledge file in the background. This may take 5–15 minutes.",
      });
      invalidateAfter();
    },
    onError: (err: Error) =>
      toast({ title: "Reindex failed", description: err.message, variant: "destructive" }),
  });

  const reindexKnowledge = useMutation({
    mutationFn: () => apiRequest("POST", "/api/rag/reindex-knowledge"),
    onSuccess: () => {
      toast({
        title: "Knowledge file reindex started",
        description:
          "Re-embedding vanessa_knowledge.txt in the background. Takes ~30 seconds.",
      });
      invalidateAfter(8000);
    },
    onError: (err: Error) =>
      toast({ title: "Knowledge reindex failed", description: err.message, variant: "destructive" }),
  });

  const reindexSite = useMutation({
    mutationFn: () => apiRequest("POST", "/api/rag/reindex-site"),
    onSuccess: () => {
      toast({
        title: "Site reindex started",
        description:
          "Crawling onspotglobal.com and rebuilding site embeddings in the background.",
      });
      invalidateAfter();
    },
    onError: (err: Error) =>
      toast({ title: "Site reindex failed", description: err.message, variant: "destructive" }),
  });

  const reindexJobs = useMutation({
    mutationFn: () => apiRequest("POST", "/api/rag/reindex-jobs"),
    onSuccess: () => {
      toast({
        title: "Job listings reindex started",
        description:
          "Reading all open jobs from the database and rebuilding embeddings. Takes ~30 seconds.",
      });
      invalidateAfter(8000);
    },
    onError: (err: Error) =>
      toast({ title: "Job reindex failed", description: err.message, variant: "destructive" }),
  });

  const reindexUrl = useMutation({
    mutationFn: (url: string) => apiRequest("POST", "/api/rag/reindex-url", { url }),
    onSuccess: (data) => {
      toast({ title: "Page indexed", description: `${data.title} — ~${data.chunksEstimate} chunk(s)` });
      setSingleUrl("");
      queryClient.invalidateQueries({ queryKey: ["/api/rag/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rag/pages"] });
    },
    onError: (err: Error) =>
      toast({ title: "Indexing failed", description: err.message, variant: "destructive" }),
  });

  const runSearch = useMutation({
    mutationFn: (query: string) => apiRequest("POST", "/api/rag/search", { query, topK: 7 }),
    onSuccess: (data) => setSearchResults(data),
    onError: (err: Error) =>
      toast({ title: "Search failed", description: err.message, variant: "destructive" }),
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  const status = statusQuery.data;
  const isAnyReindexPending =
    reindexBoth.isPending || reindexKnowledge.isPending || reindexSite.isPending || reindexJobs.isPending;

  // Separate chunk sources
  const knowledgePage = pagesQuery.data?.pages.find(p => p.url === KNOWLEDGE_SOURCE);
  const jobPages = pagesQuery.data?.pages.filter(p => p.isJob) ?? [];
  const sitePages = pagesQuery.data?.pages.filter(p => !p.isKnowledge && !p.isJob) ?? [];

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <Brain className="w-6 h-6 text-purple-500" />
          <h1 className="text-2xl font-semibold tracking-tight">Vanessa RAG Knowledge Base</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Three-layer semantic index — core knowledge file (high priority) + crawled website pages + live job listings.
        </p>
      </div>

      {/* Status cards — 3 rows of 3 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {/* Overall status */}
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

        {/* Total chunks */}
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Layers className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Total chunks</span>
            </div>
            <span className="text-2xl font-semibold tabular-nums">
              {statusQuery.isLoading ? "—" : (status?.totalChunks ?? 0).toLocaleString()}
            </span>
          </CardContent>
        </Card>

        {/* Site pages */}
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Site pages</span>
            </div>
            <span className="text-2xl font-semibold tabular-nums">
              {statusQuery.isLoading ? "—" : (status?.pagesIndexed ?? 0)}
            </span>
          </CardContent>
        </Card>

        {/* Knowledge file */}
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Knowledge file</span>
            </div>
            {statusQuery.isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : status?.knowledgeIndexed ? (
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-purple-500" />
                <span className="font-medium text-sm">{status.knowledgeChunks} chunks</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span className="font-medium text-sm">Not indexed</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Job listings */}
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Briefcase className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Job listings</span>
            </div>
            {statusQuery.isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : status?.jobsIndexedFlag ? (
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="font-medium text-sm">{status.jobsIndexed} jobs · {status.jobChunks} chunks</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span className="font-medium text-sm">Not indexed</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Jobs last indexed */}
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Briefcase className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Jobs updated</span>
            </div>
            <span className="text-xs text-foreground font-medium leading-tight">
              {statusQuery.isLoading ? "—" : fmtDate(status?.jobsLastIndexed ?? null)}
            </span>
          </CardContent>
        </Card>

        {/* Knowledge last indexed */}
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Knowledge updated</span>
            </div>
            <span className="text-xs text-foreground font-medium leading-tight">
              {statusQuery.isLoading ? "—" : fmtDate(status?.knowledgeLastIndexed ?? null)}
            </span>
          </CardContent>
        </Card>

        {/* Site last indexed */}
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Site updated</span>
            </div>
            <span className="text-xs text-foreground font-medium leading-tight">
              {statusQuery.isLoading ? "—" : fmtDate(status?.siteLastIndexed ?? null)}
            </span>
          </CardContent>
        </Card>

        {/* Last overall update */}
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Database className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Index updated</span>
            </div>
            <span className="text-xs text-foreground font-medium leading-tight">
              {statusQuery.isLoading ? "—" : fmtDate(status?.lastUpdated ?? null)}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Model + chunk badges */}
      {status?.embeddingModel && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Embedding model:</span>
          <Badge variant="secondary">{status.embeddingModel}</Badge>
          {status.knowledgeChunks > 0 && (
            <Badge variant="outline" className="text-xs gap-1">
              <BookOpen className="w-3 h-3" />
              {status.knowledgeChunks} knowledge
            </Badge>
          )}
          {status.siteChunks > 0 && (
            <Badge variant="outline" className="text-xs gap-1">
              <Globe className="w-3 h-3" />
              {status.siteChunks} site
            </Badge>
          )}
          {status.jobChunks > 0 && (
            <Badge variant="outline" className="text-xs gap-1">
              <Briefcase className="w-3 h-3" />
              {status.jobChunks} jobs
            </Badge>
          )}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="actions">
        <TabsList>
          <TabsTrigger value="actions">Actions</TabsTrigger>
          <TabsTrigger value="pages">Indexed Sources</TabsTrigger>
          <TabsTrigger value="search">Test Search</TabsTrigger>
        </TabsList>

        {/* ── Actions tab ─────────────────────────────────────────────────── */}
        <TabsContent value="actions" className="space-y-4 mt-4">

          {/* Selective reindex cards — 2×2 grid */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Knowledge file only */}
            <Card className="border-purple-200 dark:border-purple-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-purple-500" />
                  Knowledge File Only
                </CardTitle>
                <CardDescription className="text-xs">
                  Re-embed <code className="bg-muted px-1 rounded">vanessa_knowledge.txt</code> without
                  touching site pages or jobs. Use after manually editing Vanessa's persona or adding new FAQs.
                  Takes ~30 seconds.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => reindexKnowledge.mutate()}
                  disabled={isAnyReindexPending}
                  variant="outline"
                  className="gap-2 w-full"
                >
                  {reindexKnowledge.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <BookOpen className="w-4 h-4 text-purple-500" />
                  )}
                  {reindexKnowledge.isPending ? "Indexing…" : "Reindex Knowledge File"}
                </Button>
              </CardContent>
            </Card>

            {/* Job listings only */}
            <Card className="border-green-200 dark:border-green-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-green-600" />
                  Job Listings Only
                </CardTitle>
                <CardDescription className="text-xs">
                  Read all open jobs directly from the database and rebuild their embeddings. Knowledge
                  and site chunks are preserved. Use after adding or editing job postings. Takes ~30 seconds.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => reindexJobs.mutate()}
                  disabled={isAnyReindexPending}
                  variant="outline"
                  className="gap-2 w-full"
                >
                  {reindexJobs.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Briefcase className="w-4 h-4 text-green-600" />
                  )}
                  {reindexJobs.isPending ? "Indexing…" : "Reindex Job Listings"}
                </Button>
              </CardContent>
            </Card>

            {/* Site pages only */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Website Pages Only
                </CardTitle>
                <CardDescription className="text-xs">
                  Re-crawl onspotglobal.com and rebuild site embeddings. Knowledge file and job chunks are
                  preserved unchanged. Takes 5–15 minutes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => reindexSite.mutate()}
                  disabled={isAnyReindexPending}
                  variant="outline"
                  className="gap-2 w-full"
                >
                  {reindexSite.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Globe className="w-4 h-4" />
                  )}
                  {reindexSite.isPending ? "Crawling…" : "Reindex Website"}
                </Button>
              </CardContent>
            </Card>

            {/* Reindex everything */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Reindex Everything
                </CardTitle>
                <CardDescription className="text-xs">
                  Full rebuild — crawl all site pages, re-embed the knowledge file, and re-index all job
                  listings from scratch. Use when doing a major update to all sources.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => reindexBoth.mutate()}
                  disabled={isAnyReindexPending}
                  className="gap-2 w-full"
                >
                  {reindexBoth.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  {reindexBoth.isPending ? "Starting…" : "Reindex All"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Single URL */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Link className="w-4 h-4" />
                Index a Single Page
              </CardTitle>
              <CardDescription>
                Add or refresh one specific page without re-crawling the whole site. Knowledge file and
                job chunks are untouched.
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
              <CardTitle className="text-base">How the three-layer RAG works</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex gap-3 items-start">
                  <div className="rounded-full bg-purple-100 dark:bg-purple-900/40 p-1.5 shrink-0 mt-0.5">
                    <BookOpen className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <span className="text-foreground font-medium">Layer 1 — Core Knowledge File (HIGH PRIORITY):</span>{" "}
                    <code className="text-xs bg-muted px-1 rounded">resources/vanessa_knowledge.txt</code> is always
                    indexed into RAG. When a question matches this file (persona, values, leadership, pricing, FAQs),
                    those chunks are injected first with HIGH PRIORITY instructions.
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="rounded-full bg-green-100 dark:bg-green-900/40 p-1.5 shrink-0 mt-0.5">
                    <Briefcase className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <span className="text-foreground font-medium">Layer 2 — Live Job Listings:</span>{" "}
                    All open jobs are read directly from the database and embedded as structured text. Updated
                    automatically when admins create, edit, or delete jobs. Vanessa uses this to answer
                    "what jobs are open?", salary, location, and contract-type questions.
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="rounded-full bg-blue-100 dark:bg-blue-900/40 p-1.5 shrink-0 mt-0.5">
                    <Globe className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <span className="text-foreground font-medium">Layer 3 — Website Pages:</span>{" "}
                    onspotglobal.com is crawled nightly. Text is chunked (~700 chars, 100-char overlap) and embedded
                    with <code className="text-xs bg-muted px-1 rounded">text-embedding-3-small</code> (512 dims).
                    Used for service details, blog posts, and static marketing content.
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="rounded-full bg-gray-100 dark:bg-gray-800 p-1.5 shrink-0 mt-0.5">
                    <Zap className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div>
                    <span className="text-foreground font-medium">Retrieval:</span>{" "}
                    Each user message is embedded and cosine-similarity is used to find the most relevant
                    chunks. Knowledge chunks get priority slots; job and site chunks compete for the rest
                    by relevance score. All matched context is injected into Vanessa's prompt before she answers.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Sources tab ─────────────────────────────────────────────────── */}
        <TabsContent value="pages" className="mt-4 space-y-4">

          {/* Knowledge file entry */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-purple-500" />
                Core Knowledge File
                <Badge variant="secondary" className="text-xs ml-1">High Priority</Badge>
              </CardTitle>
              <CardDescription>
                <code>resources/vanessa_knowledge.txt</code> — Vanessa's persona, brand voice, company info,
                leadership, values, and FAQs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {statusQuery.isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : status?.knowledgeIndexed ? (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium">{status.knowledgeChunks} chunks indexed</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Last indexed: {fmtDate(status.knowledgeLastIndexed)}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => reindexKnowledge.mutate()}
                    disabled={isAnyReindexPending}
                    className="gap-1.5 ml-auto"
                  >
                    {reindexKnowledge.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3" />
                    )}
                    Re-index
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    <span className="text-sm text-muted-foreground">Not indexed yet</span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => reindexKnowledge.mutate()}
                    disabled={isAnyReindexPending}
                    className="gap-1.5 ml-auto"
                  >
                    {reindexKnowledge.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <BookOpen className="w-3 h-3" />
                    )}
                    Index Now
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Job listings entry */}
          <Card className="border-green-200 dark:border-green-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-green-600" />
                Live Job Listings
                <Badge variant="secondary" className="text-xs ml-1">From Database</Badge>
              </CardTitle>
              <CardDescription>
                All open job postings read directly from the jobs table — title, location, contract type,
                salary, description, requirements, and application link. Auto-updated when admin edits jobs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {statusQuery.isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : status?.jobsIndexedFlag ? (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium">
                      {status.jobsIndexed} job(s) · {status.jobChunks} chunks indexed
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Last indexed: {fmtDate(status.jobsLastIndexed)}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => reindexJobs.mutate()}
                    disabled={isAnyReindexPending}
                    className="gap-1.5 ml-auto"
                  >
                    {reindexJobs.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3" />
                    )}
                    Re-index Jobs
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    <span className="text-sm text-muted-foreground">Not indexed yet</span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => reindexJobs.mutate()}
                    disabled={isAnyReindexPending}
                    className="gap-1.5 ml-auto"
                  >
                    {reindexJobs.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Briefcase className="w-3 h-3" />
                    )}
                    Index Jobs Now
                  </Button>
                </div>
              )}

              {/* Individual job entries */}
              {jobPages.length > 0 && (
                <div className="mt-4 divide-y border rounded-md">
                  {jobPages.map((page) => (
                    <div key={page.url} className="flex items-center gap-3 px-4 py-2.5">
                      <Briefcase className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{page.title}</p>
                        <span className="text-xs text-muted-foreground">{fmtDateShort(page.lastIndexed)}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {page.chunkCount} chunk{page.chunkCount !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Site pages list */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Indexed Website Pages
                </CardTitle>
                <CardDescription>
                  {sitePages.length} page(s) · {status?.siteChunks ?? 0} site chunks
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
              ) : sitePages.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  No site pages indexed yet. Run "Reindex Website" or "Reindex All" to get started.
                </div>
              ) : (
                <div className="divide-y">
                  {sitePages.map((page) => (
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
                          {fmtDateShort(page.lastIndexed)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Search tab ──────────────────────────────────────────────────── */}
        <TabsContent value="search" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="w-4 h-4" />
                Test Semantic Search
              </CardTitle>
              <CardDescription>
                Simulate a user question to see exactly which chunks Vanessa would retrieve.
                Try "What jobs are open?" to verify job indexing is working.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder='e.g. "What jobs are open?" or "What are your pricing plans?"'
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
                      No relevant chunks found above the similarity threshold.
                    </p>
                  ) : (
                    searchResults.chunks.map((chunk, idx) => {
                      const isKnowledgeChunk = chunk.isKnowledge || chunk.url === KNOWLEDGE_SOURCE;
                      const isJobChunk = chunk.isJob || chunk.url.startsWith(JOB_SOURCE_PREFIX);
                      return (
                        <Card
                          key={`${chunk.url}-${chunk.chunkIndex}`}
                          className={
                            isKnowledgeChunk
                              ? "border-purple-200 dark:border-purple-800"
                              : isJobChunk
                              ? "border-green-200 dark:border-green-800"
                              : ""
                          }
                        >
                          <CardContent className="pt-4 pb-4 space-y-2">
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <div className="min-w-0 flex items-center gap-2 flex-wrap">
                                {isKnowledgeChunk ? (
                                  <Badge className="text-xs gap-1 bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 hover:bg-purple-100">
                                    <BookOpen className="w-3 h-3" />
                                    HIGH PRIORITY — Knowledge
                                  </Badge>
                                ) : isJobChunk ? (
                                  <Badge className="text-xs gap-1 bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 hover:bg-green-100">
                                    <Briefcase className="w-3 h-3" />
                                    Live Job Listing
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs gap-1">
                                    <Globe className="w-3 h-3" />
                                    Website
                                  </Badge>
                                )}
                                <p className="text-sm font-medium truncate">{chunk.title}</p>
                              </div>
                              <Badge variant="outline" className="shrink-0 text-xs">
                                #{idx + 1}
                              </Badge>
                            </div>
                            {!isKnowledgeChunk && (
                              <p className="text-xs text-muted-foreground break-all">{chunk.url}</p>
                            )}
                            <p className="text-sm text-foreground/80 leading-relaxed bg-muted rounded-md px-3 py-2 whitespace-pre-line">
                              {chunk.content}
                            </p>
                          </CardContent>
                        </Card>
                      );
                    })
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
