/**
 * TalentMatchedJobs — Suggested for You feed
 *
 * Reads from GET /api/talent/matches (persisted job_matches table, server scorer).
 * Display score is capped at 100% regardless of raw score.
 * Each card shows match factors (the "why this match" explainability).
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sparkles, MapPin, Briefcase, DollarSign, Clock, RefreshCw, AlertCircle } from "lucide-react";

interface MatchReasons {
  skillOverlap: string[];
  engagementMatch: boolean;
  rateMatch: boolean;
  rateRatio: number | null;
  timezoneMatch: "exact" | "region" | "none";
  categoryMatch: boolean;
  experienceMatch: boolean;
  factors: string[];
}

interface MatchedJob {
  job: {
    id: string;
    title: string;
    company: string | null;
    location: string | null;
    budget: string | null;
    budgetCurrency: string | null;
    engagementType: string | null;
    category: string | null;
    experienceLevel: string | null;
    status: string;
    skills: string[];
  };
  score: number;
  matchReasons: MatchReasons;
  computedAt: string;
}

function ScoreBadge({ score }: { score: number }) {
  const display = Math.min(100, score);
  const colour =
    display >= 80 ? "bg-emerald-500" :
    display >= 60 ? "bg-amber-500"   :
    display >= 40 ? "bg-blue-500"    : "bg-slate-400";
  return (
    <span className={`inline-flex items-center gap-1 text-white text-xs font-semibold px-2 py-0.5 rounded-full ${colour}`}>
      <Sparkles className="w-3 h-3" />
      {display}%
    </span>
  );
}

function FactorChip({ label }: { label: string }) {
  return (
    <span className="inline-block bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
      {label}
    </span>
  );
}

function MatchCard({ match }: { match: MatchedJob }) {
  const [, setLocation] = useLocation();
  const { job, score, matchReasons } = match;
  const displayScore = Math.min(100, score);
  const factors = matchReasons.factors ?? [];

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-5 pb-4 px-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-base leading-tight truncate">{job.title}</h3>
            {job.company && (
              <p className="text-sm text-muted-foreground truncate">{job.company}</p>
            )}
          </div>
          <ScoreBadge score={score} />
        </div>

        {/* Meta chips */}
        <div className="flex flex-wrap gap-1.5 mb-3 text-xs text-muted-foreground">
          {job.location && (
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location}</span>
          )}
          {job.engagementType && (
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{job.engagementType}</span>
          )}
          {job.budget && (
            <span className="flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              {Number(job.budget).toLocaleString()} {job.budgetCurrency ?? ""}
            </span>
          )}
          {job.category && (
            <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{job.category}</span>
          )}
        </div>

        {/* Match score bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">Match strength</span>
            <span className="font-medium">{displayScore}%</span>
          </div>
          <Progress value={displayScore} className="h-1.5" />
        </div>

        {/* Explainability factors */}
        {factors.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {factors.map((f, i) => <FactorChip key={i} label={f} />)}
          </div>
        )}

        <Button
          size="sm"
          className="w-full"
          onClick={() => setLocation(`/jobs/${job.id}/apply`)}
        >
          View & Apply
        </Button>
      </CardContent>
    </Card>
  );
}

interface TalentMatchedJobsProps {
  talentToken: string; // Talent JWT for the Authorization header
}

export default function TalentMatchedJobs({ talentToken }: TalentMatchedJobsProps) {
  const [matches, setMatches] = useState<MatchedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMatches = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/talent/matches", {
        headers: { Authorization: `Bearer ${talentToken}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: MatchedJob[] = await res.json();
      setMatches(data);
    } catch (e: any) {
      setError(e.message ?? "Failed to load matches");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMatches(); }, [talentToken]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="pt-5 pb-4 px-5 space-y-3">
              <div className="h-4 bg-muted rounded w-2/3" />
              <div className="h-3 bg-muted rounded w-1/2" />
              <div className="h-2 bg-muted rounded w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="pt-5 pb-4 flex items-center gap-3 text-destructive">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm">Could not load matches: {error}</span>
          <Button size="sm" variant="outline" onClick={fetchMatches} className="ml-auto">
            <RefreshCw className="w-3 h-3 mr-1" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (matches.length === 0) {
    return (
      <Card>
        <CardContent className="pt-8 pb-8 text-center text-muted-foreground">
          <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="font-medium mb-1">No matches yet</p>
          <p className="text-sm">
            Complete your profile — add skills, set your rate, and choose your
            availability — to see personalised job recommendations here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Suggested for You
          </h2>
          <p className="text-sm text-muted-foreground">
            {matches.length} job{matches.length !== 1 ? "s" : ""} ranked by compatibility
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={fetchMatches}>
          <RefreshCw className="w-3 h-3 mr-1" /> Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {matches.map(m => (
          <MatchCard key={m.job.id} match={m} />
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center pt-1">
        Scores update automatically when you edit your profile or new jobs are posted.
      </p>
    </div>
  );
}
