import { useEffect } from "react";
import { formatPublicTalentNameFromFull } from "@/lib/formatPublicTalentName";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  MapPin,
  Mail,
  Phone,
  Clock,
  Tag,
  Sparkles,
  CheckCircle2,
  Heart,
  Building2,
  CalendarDays,
  AlertCircle,
  Loader2,
  Star,
  BarChart2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Candidate } from "@shared/schema";

// ─── Culture evaluation type ─────────────────────────────────────────────────
interface CultureEvaluation {
  id: string;
  candidateId: string;
  answers: Record<string, string>;
  score: number;
  archetype?: string;
  primaryTraits?: string[];
  valueBreakdown?: Record<string, number>;
  alignmentLevel?: string;
  createdAt?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ProfileCompletionStatus({ candidate }: { candidate: Candidate }) {
  const fields = [
    { label: "Full Name", done: !!candidate.fullName },
    { label: "Email", done: !!candidate.email },
    { label: "Target Position", done: !!candidate.targetPosition },
    { label: "Job Category", done: !!candidate.category },
    { label: "Experience", done: !!candidate.experienceYears },
    { label: "Core Skills", done: (candidate.coreSkills ?? []).length > 0 },
    { label: "Work History", done: Array.isArray(candidate.workHistory) && (candidate.workHistory as unknown[]).length > 0 },
    { label: "Summary", done: !!candidate.summary },
    { label: "Preferences", done: !!candidate.preferences },
    { label: "Culture Score", done: candidate.cultureScore != null },
  ];
  const done = fields.filter((f) => f.done).length;
  const pct = Math.round((done / fields.length) * 100);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700">Profile completion</span>
        <span className="font-semibold text-[#474ead]">{pct}%</span>
      </div>
      <Progress value={pct} className="h-2" />
      <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {fields.map((f) => (
          <div key={f.label} className="flex items-center gap-1.5 text-xs">
            <CheckCircle2
              className={`h-3.5 w-3.5 shrink-0 ${f.done ? "text-emerald-500" : "text-slate-300"}`}
            />
            <span className={f.done ? "text-slate-600" : "text-slate-400"}>{f.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Work History Section ─────────────────────────────────────────────────────
interface WorkEntry {
  company?: string;
  title?: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  description?: string;
}

function WorkHistorySection({ workHistory }: { workHistory: unknown }) {
  const entries: WorkEntry[] = Array.isArray(workHistory) ? (workHistory as WorkEntry[]) : [];
  if (entries.length === 0) return null;
  return (
    <div className="space-y-4">
      {entries.map((entry, i) => (
        <div key={i} className="relative pl-4">
          <div className="absolute left-0 top-1.5 h-full w-px bg-slate-200" />
          <div className="absolute left-[-3px] top-1.5 h-2 w-2 rounded-full bg-[#474ead]" />
          <div className="pb-2">
            <p className="font-semibold text-slate-900">{entry.title || "Role"}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500">
              <Building2 className="h-3.5 w-3.5" />
              {entry.company || "Company"}
            </p>
            {(entry.startDate || entry.endDate) && (
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                <CalendarDays className="h-3 w-3" />
                {entry.startDate}
                {entry.current ? " — Present" : entry.endDate ? ` — ${entry.endDate}` : ""}
              </p>
            )}
            {entry.description && (
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{entry.description}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Skills Section ────────────────────────────────────────────────────────────

function SkillsSection({
  coreSkills,
  secondarySkills,
}: {
  coreSkills?: string[] | null;
  secondarySkills?: string[] | null;
}) {
  const core = coreSkills ?? [];
  const secondary = secondarySkills ?? [];
  if (core.length === 0 && secondary.length === 0) return null;
  return (
    <div className="space-y-4">
      {core.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Core Skills
          </p>
          <div className="flex flex-wrap gap-2">
            {core.map((sk) => (
              <Badge
                key={sk}
                className="rounded-full bg-[#474ead]/10 px-3 text-[#474ead] hover:bg-[#474ead]/10"
              >
                {sk}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {secondary.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Additional Skills
          </p>
          <div className="flex flex-wrap gap-2">
            {secondary.map((sk) => (
              <Badge
                key={sk}
                variant="outline"
                className="rounded-full border-slate-200 text-slate-600"
              >
                {sk}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Preferences Section ──────────────────────────────────────────────────────

function PreferencesSection({ preferences }: { preferences: unknown }) {
  if (!preferences || typeof preferences !== "object") return null;
  const prefs = preferences as Record<string, string>;
  const items = [
    { label: "Work Setup", value: prefs.setup },
    { label: "Preferred Shift", value: prefs.shift },
    { label: "Job Type", value: prefs.jobType },
    { label: "Work Environment", value: prefs.environment },
  ].filter((p) => !!p.value);
  if (items.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
          <p className="text-xs text-slate-400">{item.label}</p>
          <p className="mt-1 text-sm font-medium text-slate-700">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Culture Section ──────────────────────────────────────────────────────────

function CultureSection({
  cultureScore,
  evaluation,
}: {
  cultureScore?: number | null;
  evaluation?: CultureEvaluation | null;
}) {
  if (cultureScore == null && !evaluation) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        <Heart className="h-5 w-5 shrink-0 text-slate-300" />
        Culture evaluation not yet completed.
      </div>
    );
  }

  const score = cultureScore ?? evaluation?.score ?? 0;
  const archetype = evaluation?.archetype;
  const traits = evaluation?.primaryTraits ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#474ead]/10">
          <span className="text-lg font-bold text-[#474ead]">{score}%</span>
        </div>
        <div>
          {archetype && (
            <p className="font-semibold text-slate-900">{archetype}</p>
          )}
          <p className="text-sm text-slate-500">Culture alignment score</p>
        </div>
      </div>
      {traits.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {traits.map((t) => (
            <Badge
              key={t}
              className="rounded-full bg-rose-50 px-3 text-rose-700 hover:bg-rose-50"
            >
              <Heart className="mr-1.5 h-3 w-3" /> {t}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CandidateProfile() {
  const { candidateId } = useParams<{ candidateId: string }>();
  const [, navigate] = useLocation();

  const {
    data: candidate,
    isLoading,
    isError,
  } = useQuery<Candidate>({
    queryKey: ["/api/candidates", candidateId],
    queryFn: async () => {
      const res = await fetch(`/api/candidates/${candidateId}`);
      if (!res.ok) throw new Error("Candidate not found");
      return res.json();
    },
    enabled: !!candidateId,
    staleTime: 30_000,
  });

  const { data: cultureEval } = useQuery<CultureEvaluation | null>({
    queryKey: ["/api/candidates", candidateId, "culture-evaluation"],
    queryFn: async () => {
      const res = await fetch(`/api/candidates/${candidateId}/culture-evaluation`);
      if (!res.ok) return null;
      const data = await res.json();
      return data?.evaluation ?? null;
    },
    enabled: !!candidateId,
    staleTime: 30_000,
  });

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (!candidateId) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
        <AlertCircle className="h-10 w-10 text-slate-300" />
        <p className="text-slate-500">No candidate ID provided.</p>
        <Button variant="outline" className="rounded-full" onClick={() => navigate("/find-work")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Find Work
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-[#474ead]" />
        <p className="text-slate-500">Loading profile…</p>
      </div>
    );
  }

  if (isError || !candidate) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
        <AlertCircle className="h-10 w-10 text-rose-400" />
        <p className="font-semibold text-slate-800">Profile not found</p>
        <p className="text-sm text-slate-500">
          We couldn't load this candidate profile. It may have been removed or the link is incorrect.
        </p>
        <Button variant="outline" className="rounded-full" onClick={() => navigate("/find-best-matches")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Matching
        </Button>
      </div>
    );
  }

  const prefs = candidate.preferences as Record<string, string> | null;
  const hasWorkHistory =
    Array.isArray(candidate.workHistory) && (candidate.workHistory as unknown[]).length > 0;
  const hasCulture = candidate.cultureScore != null || !!cultureEval;
  const hasCultureComplete = candidate.cultureScore != null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
          {/* Back button */}
          <button
            onClick={() => navigate("/find-best-matches")}
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Matching
          </button>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            {/* Name + position */}
            <div>
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#474ead] text-lg font-bold text-white">
                  {(candidate.fullName || "C").slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-slate-900">
                    {formatPublicTalentNameFromFull(candidate.fullName) || "Candidate"}
                  </h1>
                  {candidate.targetPosition && (
                    <p className="text-sm text-slate-500">{candidate.targetPosition}</p>
                  )}
                </div>
              </div>

              {/* Key meta */}
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500">
                {candidate.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    {candidate.location}
                  </span>
                )}
                {candidate.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    {candidate.email}
                  </span>
                )}
                {candidate.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    {candidate.phone}
                  </span>
                )}
              </div>

              {/* Badges */}
              <div className="mt-3 flex flex-wrap gap-2">
                {candidate.category && (
                  <Badge className="rounded-full bg-slate-900 px-3 text-white hover:bg-slate-900">
                    <Tag className="mr-1.5 h-3 w-3" /> {candidate.category}
                  </Badge>
                )}
                {candidate.seniority && (
                  <Badge
                    variant="outline"
                    className="rounded-full border-slate-200 px-3 text-slate-600"
                  >
                    <Star className="mr-1.5 h-3 w-3" /> {candidate.seniority}
                  </Badge>
                )}
                {candidate.experienceYears && (
                  <Badge
                    variant="outline"
                    className="rounded-full border-slate-200 px-3 text-slate-600"
                  >
                    <Clock className="mr-1.5 h-3 w-3" /> {candidate.experienceYears}
                  </Badge>
                )}
                {prefs?.setup && (
                  <Badge
                    variant="outline"
                    className="rounded-full border-slate-200 px-3 text-slate-600"
                  >
                    {prefs.setup}
                  </Badge>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex shrink-0 flex-col gap-2 sm:items-end">
              <Button
                className="rounded-full bg-[#474ead] px-6 text-white"
                onClick={() => navigate("/find-best-matches")}
              >
                {hasCultureComplete ? (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" /> Find My Matches
                  </>
                ) : (
                  <>
                    Continue Setup <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
              {!hasCultureComplete && (
                <Button
                  variant="outline"
                  className="rounded-full border-slate-200 px-6"
                  onClick={() => navigate("/find-best-matches")}
                >
                  <Heart className="mr-2 h-4 w-4 text-rose-400" /> Take Culture Evaluation
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Profile Completion */}
        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
              <BarChart2 className="h-4 w-4" />
              Profile Completion
            </div>
            <ProfileCompletionStatus candidate={candidate} />
          </CardContent>
        </Card>

        {/* Professional Summary */}
        {candidate.summary && (
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
                <Briefcase className="h-4 w-4" />
                Professional Summary
              </div>
              <p className="leading-relaxed text-slate-700">{candidate.summary}</p>
            </CardContent>
          </Card>
        )}

        {/* Skills */}
        {((candidate.coreSkills ?? []).length > 0 ||
          (candidate.secondarySkills ?? []).length > 0) && (
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
                <Sparkles className="h-4 w-4" />
                Skills
              </div>
              <SkillsSection
                coreSkills={candidate.coreSkills}
                secondarySkills={candidate.secondarySkills}
              />
            </CardContent>
          </Card>
        )}

        {/* Work History */}
        {hasWorkHistory && (
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
                <Building2 className="h-4 w-4" />
                Work History
              </div>
              <WorkHistorySection workHistory={candidate.workHistory} />
            </CardContent>
          </Card>
        )}

        {/* Work Preferences */}
        {candidate.preferences && (
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
                <Tag className="h-4 w-4" />
                Work Preferences
              </div>
              <PreferencesSection preferences={candidate.preferences} />
            </CardContent>
          </Card>
        )}

        {/* Culture Evaluation */}
        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
              <Heart className="h-4 w-4" />
              Culture Alignment
            </div>
            <CultureSection
              cultureScore={candidate.cultureScore}
              evaluation={cultureEval}
            />
          </CardContent>
        </Card>

        {/* Bottom action strip */}
        <div className="flex flex-col gap-3 rounded-2xl border border-[#474ead]/20 bg-[#474ead]/5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-slate-900">Ready to find your best matches?</p>
            <p className="mt-0.5 text-sm text-slate-500">
              {hasCultureComplete
                ? "Your profile is complete — run the matching engine now."
                : "Complete your culture evaluation to unlock job matching."}
            </p>
          </div>
          <Button
            className="shrink-0 rounded-full bg-[#474ead] px-7 text-white"
            onClick={() => navigate("/find-best-matches")}
          >
            {hasCultureComplete ? (
              <>
                <Sparkles className="mr-2 h-4 w-4" /> Find My Matches
              </>
            ) : (
              <>
                Continue Setup <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
