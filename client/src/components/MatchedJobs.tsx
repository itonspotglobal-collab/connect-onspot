import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  DollarSign,
  Target,
} from "lucide-react";

export interface MatchedJob {
  job: {
    id: string;
    title: string;
    companyName?: string | null;
    company?: string | null;
    location?: string | null;
    engagementType?: string | null;
    budget?: string | number | null;
    budgetCurrency?: string | null;
    skills: string[];
  };
  score: number;
  overlapSkills: string[];
  factors: {
    skillOverlapCount: number;
    engagementMatch: boolean;
    rateMatch: boolean;
  };
}

// Talent JWT may live under either storage convention
export function getTalentToken(): string | null {
  try {
    const raw = localStorage.getItem("talent_profile_token");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.token) return parsed.token as string;
    }
  } catch {
    // fall through to legacy key
  }
  return localStorage.getItem("onspot_jwt_token");
}

// Decode the candidateId from the talent JWT payload (no verification — display scoping only)
function getTalentIdentity(): string | null {
  const token = getTalentToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return (payload.candidateId as string) ?? (payload.userId as string) ?? null;
  } catch {
    return null;
  }
}

export function useMatchedJobs(enabled: boolean) {
  // Scope the cache to the authenticated candidate so switching accounts in the
  // same browser never shows another talent's cached matches.
  const identity = getTalentIdentity();
  return useQuery<MatchedJob[]>({
    queryKey: ["/api/talent/matches", identity],
    queryFn: async () => {
      const token = getTalentToken();
      const res = await fetch("/api/talent/matches", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to load job matches");
      return res.json();
    },
    enabled: enabled && !!identity,
    staleTime: 60_000,
  });
}

export function MatchedJobsList({ matches, isLoading }: { matches?: MatchedJob[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-3 text-muted-foreground py-8">
        <Clock className="h-5 w-5 animate-pulse" />
        <span>Finding your best matches…</span>
      </div>
    );
  }
  if (!matches || matches.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 flex flex-col items-center gap-4 text-center">
          <Target className="h-10 w-10 text-muted-foreground/50" />
          <div>
            <p className="font-medium text-foreground">No matches yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add skills and set your rate preferences in Settings to get matched with roles
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="grid gap-4">
      {matches.map((m) => (
        <Card key={m.job.id} className="hover-elevate" data-testid={`card-matched-job-${m.job.id}`}>
          <CardContent className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              {/* Job info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Target className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{m.job.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {m.job.companyName || m.job.company || "OnSpot Client"}
                      {m.job.location && <span> · {m.job.location}</span>}
                    </p>
                    {/* Match factors */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {(m.overlapSkills ?? []).slice(0, 4).map((skill) => (
                        <Badge key={skill} variant="secondary" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                      {m.factors.engagementMatch && (
                        <Badge variant="outline" className="text-xs border-green-500/50 text-green-600 dark:text-green-400">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Engagement match
                        </Badge>
                      )}
                      {m.factors.rateMatch && (
                        <Badge variant="outline" className="text-xs border-green-500/50 text-green-600 dark:text-green-400">
                          <DollarSign className="h-3 w-3 mr-1" />
                          Rate match
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Score & action */}
              <div className="flex flex-col sm:items-end gap-2 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Match score</span>
                  <Badge className="w-fit" data-testid={`badge-match-score-${m.job.id}`}>
                    {m.score}
                  </Badge>
                </div>
                <Link href={`/jobs/${m.job.id}`}>
                  <Button variant="outline" size="sm">
                    View Job
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
