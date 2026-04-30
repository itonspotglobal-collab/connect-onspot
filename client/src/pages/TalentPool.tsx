import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Sparkles,
  Users,
  MapPin,
  Briefcase,
  Clock3,
  ChevronRight,
  Star,
  X,
  Download,
  UserCheck,
  Phone,
  Mail,
  BookOpen,
  Filter,
  Layers,
  CheckCircle2,
  Award,
  Globe2,
  FileText,
  ChevronDown,
  Bookmark,
  MessageSquare,
  ShieldCheck,
  Eye,
  EyeOff,
  ExternalLink,
  UserPlus,
  LogIn,
  Minimize2,
} from "lucide-react";
import {
  TalentLoginModal,
  loadTalentAuth,
  type TalentAuthState,
} from "@/components/TalentLoginModal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { isAdmin, isClient } from "@/lib/authUtils";
import type { Candidate } from "@shared/schema";
import { saveUserActivity } from "@/lib/userActivityMemory";

function candidatePhotoSrc(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("/objects/candidate-photos/")) {
    return url.replace("/objects/candidate-photos/", "/api/candidate-photos/");
  }
  return url;
}

// Always shows the real saved name; only falls back to "Candidate XXXXXX" when no name exists
// Priority: displayName (custom public name) → fullName (registered name) → id fallback
function getTalentDisplayName(candidate: Candidate): string {
  const name = (candidate.displayName?.trim()) || (candidate.fullName?.trim());
  if (name) return name;
  const shortId = (candidate.id ?? "").slice(0, 6).toUpperCase();
  return `Candidate ${shortId || "—"}`;
}

function getTalentInitials(candidate: Candidate): string {
  const name = getTalentDisplayName(candidate);
  if (name.startsWith("Candidate ")) {
    const code = name.replace("Candidate ", "");
    return code.slice(0, 2).toUpperCase() || "TA";
  }
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || "TA"
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchResult {
  candidate: Candidate;
  score: number;
  label: string | null;
  matchedSkills: string[];
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

const MATCH_THRESHOLD = 30;

function computeMatch(
  candidate: Candidate,
  query: string,
  category: string,
  experience: string,
  location: string,
  workSetup: string,
): MatchResult {
  let score = 0;
  const matchedSkills: string[] = [];
  const q = query.trim().toLowerCase();
  const allSkills = [
    ...(candidate.coreSkills ?? []),
    ...(candidate.secondarySkills ?? []),
  ];

  if (q) {
    // Text match: position, category, summary, skills
    const haystack = [
      candidate.targetPosition ?? "",
      candidate.category ?? "",
      candidate.summary ?? "",
      candidate.seniority ?? "",
      ...allSkills,
    ]
      .join(" ")
      .toLowerCase();

    if (haystack.includes(q)) score += 25;

    // Skill-by-skill match for display
    const terms = q.split(/\s+/);
    allSkills.forEach((sk) => {
      if (terms.some((t) => sk.toLowerCase().includes(t))) {
        matchedSkills.push(sk);
        score += 5;
      }
    });
    if ((candidate.targetPosition ?? "").toLowerCase().includes(q)) score += 20;
  } else {
    // No query — everyone starts with baseline score so all are visible
    score += 50;
  }

  // Category filter
  if (category !== "All") {
    if (
      (candidate.category ?? "").toLowerCase() === category.toLowerCase()
    ) {
      score += 25;
    } else {
      score -= 40; // hard penalty for category mismatch
    }
  }

  // Experience level filter
  if (experience !== "Any") {
    const seniority = (candidate.seniority ?? "").toLowerCase();
    const expYears = parseInt(candidate.experienceYears ?? "0", 10) || 0;
    const matches =
      (experience === "Entry" && (seniority.includes("entry") || seniority.includes("junior") || expYears <= 2)) ||
      (experience === "Mid" && (seniority.includes("mid") || (expYears >= 2 && expYears <= 5))) ||
      (experience === "Senior" && (seniority.includes("senior") || seniority.includes("lead") || expYears >= 5));
    if (matches) score += 20;
    else score -= 20;
  }

  // Location filter
  if (location.trim()) {
    if (
      (candidate.location ?? "")
        .toLowerCase()
        .includes(location.trim().toLowerCase())
    ) {
      score += 15;
    }
  }

  // Work setup preference filter
  if (workSetup !== "Any") {
    const prefs = candidate.preferences as Record<string, string> | null;
    const setup = (prefs?.workSetup ?? prefs?.setup ?? "").toLowerCase();
    if (setup.includes(workSetup.toLowerCase())) score += 15;
  }

  // Dedupe matched skills
  const uniqueSkills = [...new Set(matchedSkills)].slice(0, 4);

  // Compute label
  let label: string | null = null;
  if (score >= 85) label = "Best Match";
  else if (score >= 70) label = "Strong Match";
  else if (score >= 50) label = "Possible Match";

  return { candidate, score: Math.min(100, Math.max(0, score)), label, matchedSkills: uniqueSkills };
}

const LABEL_COLORS: Record<string, string> = {
  "Best Match": "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  "Strong Match": "bg-[#474ead]/10 text-[#474ead]",
  "Possible Match": "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

// ─── Profile Modal ─────────────────────────────────────────────────────────────

function ProfileModal({
  result,
  onClose,
  canSeeContact,
}: {
  result: MatchResult;
  onClose: () => void;
  canSeeContact: boolean;
}) {
  const { candidate } = result;
  const prefs = candidate.preferences as Record<string, string> | null;
  const workHistory = (candidate.workHistory as Array<{
    jobTitle?: string;
    company?: string;
    duration?: string;
    responsibilities?: string;
  }> | null) ?? [];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center p-0 sm:items-center sm:p-4 md:p-6"
      aria-modal="true"
      role="dialog"
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.98 }}
        transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
        className="relative z-10 flex w-[95vw] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_32px_80px_rgba(0,0,0,0.32)] dark:bg-[#0f172a] sm:w-[92vw] sm:rounded-[28px] lg:w-[820px] xl:w-[920px]"
        style={{ maxHeight: "92vh" }}
      >
        {/* Header */}
        <div className="relative shrink-0 overflow-hidden bg-[#0f172a] px-6 pb-6 pt-5 md:px-10">
          <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-[#474ead]/30 blur-[70px]" />

          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/50 transition hover:bg-white/20 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="relative mb-4 flex flex-wrap items-center gap-2">
            {result.label && (
              <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${LABEL_COLORS[result.label] ?? ""}`}>
                {result.label}
              </span>
            )}
            <span className="rounded-full border border-white/15 bg-white/[0.08] px-3 py-1 text-[11px] text-white/60">
              {candidate.seniority ?? "Experienced"}
            </span>
            {result.score > 0 && (
              <span className="ml-auto rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-bold text-emerald-400">
                {result.score}% match
              </span>
            )}
          </div>

          <h2 className="relative text-2xl font-bold leading-tight text-white md:text-[28px]">
            {getTalentDisplayName(candidate)}
          </h2>
          <p className="mt-1.5 text-sm text-slate-400">{candidate.targetPosition}</p>

          <div className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:flex md:gap-3">
            {[
              { Icon: Briefcase, label: "Category", value: candidate.category || "—" },
              { Icon: Clock3, label: "Experience", value: candidate.experienceYears ? `${candidate.experienceYears} yrs` : "—" },
              { Icon: Globe2, label: "Location", value: candidate.location || "Philippines" },
            ].map(({ Icon, label, value }) => (
              <div key={label} className="rounded-xl bg-white/[0.06] p-2.5 md:flex-1">
                <div className="flex items-center gap-1 text-[10px] text-white/40">
                  <Icon className="h-2.5 w-2.5" />
                  {label}
                </div>
                <div className="mt-1 text-xs font-bold text-white/90">{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 divide-y divide-slate-100 overflow-y-auto dark:divide-white/10">
          {/* Summary */}
          {candidate.summary && (
            <div className="bg-[#474ead]/[0.04] px-6 py-5 md:px-10">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#474ead]" />
                <div>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-[#474ead]">
                    Profile Summary
                  </p>
                  <p className="text-sm leading-6 text-slate-700 dark:text-slate-300">
                    {candidate.summary}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Skills */}
          {((candidate.coreSkills ?? []).length > 0 || (candidate.secondarySkills ?? []).length > 0) && (
            <div className="px-6 py-5 md:px-10">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                Skills
              </p>
              <div className="space-y-3">
                {(candidate.coreSkills ?? []).length > 0 && (
                  <div>
                    <p className="mb-2 text-xs text-slate-500">Core Skills</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(candidate.coreSkills ?? []).map((sk) => (
                        <span
                          key={sk}
                          className="rounded-full bg-[#474ead]/10 px-3 py-1 text-xs font-medium text-[#474ead]"
                        >
                          {sk}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {(candidate.secondarySkills ?? []).length > 0 && (
                  <div>
                    <p className="mb-2 text-xs text-slate-500">Secondary Skills</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(candidate.secondarySkills ?? []).map((sk) => (
                        <span
                          key={sk}
                          className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 dark:bg-white/[0.06] dark:text-slate-300"
                        >
                          {sk}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Work History */}
          {workHistory.length > 0 && (
            <div className="px-6 py-5 md:px-10">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                Work History
              </p>
              <div className="space-y-4">
                {workHistory.map((wh, i) => (
                  <div key={i} className="rounded-xl border border-slate-100 p-4 dark:border-white/[0.06]">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{wh.jobTitle ?? "Role"}</p>
                        <p className="text-sm text-slate-500">{wh.company}</p>
                      </div>
                      {wh.duration && (
                        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-500 dark:bg-white/[0.06]">
                          {wh.duration}
                        </span>
                      )}
                    </div>
                    {wh.responsibilities && (
                      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                        {wh.responsibilities}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Culture Score */}
          {candidate.cultureScore != null && (
            <div className="px-6 py-5 md:px-10">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                  <Award className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    Values Alignment
                  </p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {candidate.cultureScore}%
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Contact (admin/ta only) */}
          {canSeeContact && (candidate.email || candidate.phone) && (
            <div className="px-6 py-5 md:px-10">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                Contact
              </p>
              <div className="space-y-2">
                {candidate.email && (
                  <a
                    href={`mailto:${candidate.email}`}
                    className="flex items-center gap-3 text-sm text-slate-700 hover:text-[#474ead] dark:text-slate-300"
                  >
                    <Mail className="h-4 w-4 shrink-0" />
                    {candidate.email}
                  </a>
                )}
                {candidate.phone && (
                  <a
                    href={`tel:${candidate.phone}`}
                    className="flex items-center gap-3 text-sm text-slate-700 hover:text-[#474ead] dark:text-slate-300"
                  >
                    <Phone className="h-4 w-4 shrink-0" />
                    {candidate.phone}
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Work Preferences */}
          {prefs && Object.keys(prefs).length > 0 && (
            <div className="px-6 py-5 md:px-10">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                Preferences
              </p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(prefs).map(([k, v]) =>
                  v ? (
                    <span
                      key={k}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 dark:bg-white/[0.06] dark:text-slate-300"
                    >
                      {v}
                    </span>
                  ) : null,
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="shrink-0 border-t border-slate-100 px-6 py-4 dark:border-white/10 md:px-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {canSeeContact && candidate.email && (
                <Button
                  size="sm"
                  className="rounded-full bg-[#474ead] text-white hover:bg-[#3d439c]"
                  onClick={() => window.open(`mailto:${candidate.email}`, "_blank")}
                >
                  <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                  Contact
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={onClose}
              >
                Close
              </Button>
            </div>
            {!canSeeContact && (
              <p className="flex items-center gap-1.5 text-xs text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                Contact details visible to admins only
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Talent Card ───────────────────────────────────────────────────────────────

function TalentCard({
  result,
  onViewProfile,
  isShortlisted,
  onToggleShortlist,
  canSeeContact,
}: {
  result: MatchResult;
  onViewProfile: (r: MatchResult) => void;
  isShortlisted: boolean;
  onToggleShortlist: (id: string) => void;
  canSeeContact: boolean;
}) {
  const [, navigate] = useLocation();
  const { candidate } = result;
  const allSkills = [...(candidate.coreSkills ?? []), ...(candidate.secondarySkills ?? [])];
  const displaySkills = allSkills.slice(0, 4);
  const prefs = candidate.preferences as Record<string, string> | null;
  const workSetup = prefs?.workSetup ?? prefs?.setup ?? null;
  const displayName = getTalentDisplayName(candidate);
  const photoUrl = candidatePhotoSrc(candidate.profilePhotoUrl);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="group flex h-full flex-col rounded-3xl border-slate-200/70 bg-white/90 transition-all hover:border-[#474ead]/25 hover:shadow-[0_16px_48px_rgba(71,78,173,0.10)] dark:border-white/10 dark:bg-white/[0.03]">
        <CardContent className="flex flex-1 flex-col p-6">
          {/* Header */}
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {/* Avatar */}
              <Avatar className="h-11 w-11 shrink-0 rounded-full border border-slate-200 dark:border-white/10">
                <AvatarImage src={photoUrl} alt={displayName} className="rounded-full object-cover" />
                <AvatarFallback className="rounded-full bg-[#474ead]/10 text-sm font-semibold text-[#474ead]">
                  {getTalentInitials(candidate)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                {/* Match label */}
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  {result.label && (
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${LABEL_COLORS[result.label]}`}>
                      {result.label}
                    </span>
                  )}
                  {candidate.cultureScore != null && (
                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      {candidate.cultureScore}% values fit
                    </span>
                  )}
                </div>
                {/* Name / Position */}
                <h3 className="text-base font-semibold leading-snug text-slate-900 dark:text-white">
                  {displayName}
                </h3>
                <p className="mt-0.5 text-sm text-slate-500">{candidate.targetPosition || "Open to Opportunities"}</p>
              </div>
            </div>

            {/* Shortlist toggle */}
            <button
              onClick={() => onToggleShortlist(candidate.id)}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors ${
                isShortlisted
                  ? "border-[#474ead] bg-[#474ead]/10 text-[#474ead]"
                  : "border-slate-200 text-slate-400 hover:border-[#474ead]/40 hover:text-[#474ead] dark:border-white/10"
              }`}
              aria-label={isShortlisted ? "Remove from shortlist" : "Shortlist"}
            >
              <Bookmark className={`h-4 w-4 ${isShortlisted ? "fill-current" : ""}`} />
            </button>
          </div>

          {/* Meta pills */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-white/[0.04]">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <Clock3 className="h-3 w-3" /> Experience
              </div>
              <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">
                {candidate.experienceYears ? `${candidate.experienceYears} yrs` : "—"}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-white/[0.04]">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <MapPin className="h-3 w-3" /> Location
              </div>
              <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">
                {candidate.location || "Philippines"}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-white/[0.04]">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <Layers className="h-3 w-3" /> Level
              </div>
              <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">
                {candidate.seniority || "—"}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-white/[0.04]">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <Globe2 className="h-3 w-3" /> Setup
              </div>
              <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">
                {workSetup || "Remote"}
              </div>
            </div>
          </div>

          {/* Summary snippet */}
          {candidate.summary && (
            <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
              {candidate.summary}
            </p>
          )}

          {/* Skills */}
          {displaySkills.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {displaySkills.map((sk) => (
                <span
                  key={sk}
                  className={`rounded-full px-3 py-1 text-xs ${
                    result.matchedSkills.includes(sk)
                      ? "bg-[#474ead]/10 text-[#474ead] font-medium"
                      : "bg-slate-100 text-slate-700 dark:bg-white/[0.06] dark:text-slate-300"
                  }`}
                >
                  {sk}
                </span>
              ))}
              {allSkills.length > 4 && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500 dark:bg-white/[0.06]">
                  +{allSkills.length - 4} more
                </span>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="mt-5 flex flex-wrap items-center gap-2 pt-1">
            <Button
              className="rounded-full bg-[#474ead] px-5 text-white"
              onClick={() => navigate(`/talent-profile/${candidate.id}`)}
            >
              <ExternalLink className="mr-1.5 h-4 w-4" /> Full Profile
            </Button>
            <button
              onClick={() => onViewProfile(result)}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-[#474ead] dark:text-slate-300"
            >
              Quick View <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Category filter chips ─────────────────────────────────────────────────────

// ─── Talent Account Prompt ─────────────────────────────────────────────────────

const PROMPT_DELAY_MS = 5 * 1000; // 5 seconds

function TalentAccountPrompt() {
  const [, navigate] = useLocation();
  // showPopup: full card is visible | minimized: only floating pill is visible
  const [showPopup, setShowPopup] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAuthenticated = Boolean(loadTalentAuth());

  useEffect(() => {
    // Never show for already-authenticated talent users
    if (isAuthenticated) return;

    timerRef.current = setTimeout(() => {
      // Re-check at trigger time in case they authenticated while the timer ran
      if (!loadTalentAuth()) setShowPopup(true);
    }, PROMPT_DELAY_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Minimize (both X and minimize button do the same thing — never permanently dismiss)
  function minimize() {
    setShowPopup(false);
    setMinimized(true);
  }

  // Reopen from floating pill
  function reopen() {
    setMinimized(false);
    setShowPopup(true);
  }

  function handleLoginSuccess(auth: TalentAuthState) {
    setShowLogin(false);
    setShowPopup(false);
    setMinimized(false);
    navigate(`/talent-profile/${auth.candidateId}`);
  }

  // Never render anything for authenticated users
  if (isAuthenticated) return null;

  const prompt = (
    <>
      {/* Full popup card */}
      <AnimatePresence>
        {showPopup && (
          <motion.div
            key="talent-prompt-modal"
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.96 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="fixed bottom-6 right-6 z-[9999] w-80 rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
          >
            {/* Header */}
            <div className="flex items-center justify-between rounded-t-xl bg-gradient-to-r from-[#474ead] to-[#6366f1] px-4 py-3">
              <span className="text-sm font-semibold text-white">Are you a talent?</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={minimize}
                  className="rounded p-1 text-white/70 transition-colors hover:text-white"
                  aria-label="Minimize"
                >
                  <Minimize2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={minimize}
                  className="rounded p-1 text-white/70 transition-colors hover:text-white"
                  aria-label="Close"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            {/* Body */}
            <div className="px-4 py-4">
              <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
                Create a free talent account to get discovered by top clients and get matched to the best opportunities.
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  className="w-full rounded-full"
                  onClick={() => { minimize(); navigate("/find-best-matches"); }}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Create Talent Account
                </Button>
                <Button
                  variant="outline"
                  className="w-full rounded-full"
                  onClick={() => setShowLogin(true)}
                >
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign in
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating pill — shown when minimized (whether via minimize or close button) */}
      <AnimatePresence>
        {minimized && !showPopup && (
          <motion.button
            key="talent-prompt-pill"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            onClick={reopen}
            className="fixed bottom-6 right-6 z-[9999] flex items-center gap-2 rounded-full bg-gradient-to-r from-[#474ead] to-[#6366f1] px-4 py-2.5 text-sm font-medium text-white shadow-lg"
          >
            <UserPlus className="h-4 w-4" />
            Join as Talent
          </motion.button>
        )}
      </AnimatePresence>

      {/* Sign-in modal (no profileId = sign-in only mode) */}
      <TalentLoginModal
        open={showLogin}
        onClose={() => setShowLogin(false)}
        onSuccess={handleLoginSuccess}
      />
    </>
  );

  return createPortal(prompt, document.body);
}

const CATEGORIES = ["All", "Admin", "Support", "Finance", "Sales", "Marketing", "Technical", "Operations", "Design", "Writing"];
const EXPERIENCE_LEVELS = ["Any", "Entry", "Mid", "Senior"];
const WORK_SETUPS = ["Any", "Remote", "Hybrid", "Onsite"];

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function TalentPool() {
  const { user } = useAuth();
  const canSeeContact = isAdmin(user) || user?.role === "talent_acquisition";
  const isClientUser = isClient(user);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [experienceFilter, setExperienceFilter] = useState("Any");
  const [locationFilter, setLocationFilter] = useState("");
  const [workSetupFilter, setWorkSetupFilter] = useState("Any");
  const [showFilters, setShowFilters] = useState(false);
  const [shortlisted, setShortlisted] = useState<Set<string>>(new Set());
  const [selectedResult, setSelectedResult] = useState<MatchResult | null>(null);
  const [showShortlistedOnly, setShowShortlistedOnly] = useState(false);

  // Debounced talent search tracking
  useEffect(() => {
    if (!searchQuery.trim()) return;
    const timer = setTimeout(() => {
      saveUserActivity({
        activityType: "TalentSearch",
        keyword: searchQuery.trim(),
        category: activeCategory !== "All" ? activeCategory : undefined,
        page: "TalentPool",
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [searchQuery, activeCategory]);

  // Fetch candidates — always refetch when page gains focus so profile edits reflect immediately
  const { data: candidates = [], isLoading, isError } = useQuery<Candidate[]>({
    queryKey: ["/api/candidates"],
    queryFn: async () => {
      const res = await fetch("/api/candidates");
      if (!res.ok) throw new Error("Failed to fetch candidates");
      return res.json();
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Only show candidates who have at least completed their basic profile
  const eligibleCandidates = useMemo(
    () => candidates.filter((c) => c.targetPosition || c.fullName),
    [candidates],
  );

  // Compute matches
  const matchResults = useMemo<MatchResult[]>(() => {
    const results = eligibleCandidates
      .map((c) =>
        computeMatch(c, searchQuery, activeCategory, experienceFilter, locationFilter, workSetupFilter),
      )
      .filter((r) => r.score >= MATCH_THRESHOLD);

    // Sort: best score first
    results.sort((a, b) => b.score - a.score);
    return results;
  }, [eligibleCandidates, searchQuery, activeCategory, experienceFilter, locationFilter, workSetupFilter]);

  const displayResults = useMemo(
    () =>
      showShortlistedOnly
        ? matchResults.filter((r) => shortlisted.has(r.candidate.id))
        : matchResults,
    [matchResults, showShortlistedOnly, shortlisted],
  );

  function toggleShortlist(id: string) {
    setShortlisted((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const searchPrompts = [
    "Virtual assistant with admin experience",
    "Customer support specialist, night shift",
    "Finance or bookkeeping background",
    "Remote-ready, senior level",
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(71,78,173,0.12),transparent_32%),linear-gradient(to_bottom,#f8fafc,white)] text-slate-900 dark:bg-[#060816] dark:text-white">
      {/* Talent account prompt (after 5 min, for non-authenticated visitors) */}
      <TalentAccountPrompt />

      {/* Profile modal */}
      <AnimatePresence>
        {selectedResult && (
          <ProfileModal
            result={selectedResult}
            onClose={() => setSelectedResult(null)}
            canSeeContact={canSeeContact}
          />
        )}
      </AnimatePresence>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden border-b border-slate-200/70 dark:border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(71,78,173,0.18),transparent_28%),radial-gradient(circle_at_80%_0%,rgba(99,102,241,0.12),transparent_24%)]" />
        <div className="relative mx-auto max-w-7xl px-6 pb-16 pt-10 md:px-8 md:pb-24 md:pt-14">
          <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <Badge className="mb-5 rounded-full bg-[#474ead]/10 px-4 py-1.5 text-[#474ead] hover:bg-[#474ead]/10">
                  {isClientUser ? "Discover pre-vetted remote talent" : "Talent Pool — Internal Access"}
                </Badge>
                <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl md:leading-[1.04] dark:text-white">
                  Find talent that fits — and delivers results.
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 md:text-lg dark:text-slate-300">
                  Search our pool of pre-assessed candidates across admin, support, finance, sales, and more.
                  Filtered by your criteria. Ranked by match score.
                </p>
              </motion.div>

              {/* Search box */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="mt-8 rounded-[28px] border border-slate-200/80 bg-white/90 p-4 shadow-[0_20px_80px_rgba(71,78,173,0.12)] backdrop-blur dark:border-white/10 dark:bg-white/[0.04]"
              >
                <div className="flex items-start gap-3 rounded-[22px] border border-slate-200/80 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#474ead] text-white">
                    <Search className="h-4 w-4" />
                  </div>
                  <div className="w-full min-w-0">
                    <div className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                      Search criteria
                    </div>
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-auto border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0 md:text-lg"
                      placeholder="Role, skills, category, or keywords…"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {searchPrompts.map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => setSearchQuery(prompt)}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-[#474ead]/30 hover:text-[#474ead] dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Right: Stats panel */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="hidden lg:block"
            >
              <div className="rounded-[28px] border border-slate-200/80 bg-white/90 p-6 shadow-[0_20px_60px_rgba(71,78,173,0.10)] dark:border-white/10 dark:bg-white/[0.04]">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    Pool Overview
                  </span>
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    {eligibleCandidates.length} candidates
                  </span>
                </div>
                <div className="space-y-3">
                  {[
                    { icon: UserCheck, label: "Profile Completed", value: candidates.filter((c) => c.profileCompleted).length.toString() },
                    { icon: Star, label: "With Culture Score", value: candidates.filter((c) => c.cultureScore != null).length.toString() },
                    { icon: Award, label: "Senior Level", value: candidates.filter((c) => (c.seniority ?? "").toLowerCase().includes("senior")).length.toString() },
                    { icon: Globe2, label: "Remote Ready", value: "Most" },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-white/[0.04]">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#474ead]/10">
                        <Icon className="h-4 w-4 text-[#474ead]" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-slate-500">{label}</p>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {!canSeeContact && (
                  <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-slate-400" />
                    <p className="text-xs text-slate-500">
                      Contact details and resumes visible to admins only.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Filters + Results ── */}
      <section className="mx-auto max-w-7xl px-6 py-10 md:px-8 md:py-14">
        {/* Filter bar */}
        <div className="mb-8 space-y-4">
          {/* Category chips */}
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setActiveCategory(cat);
                  if (cat !== "All") {
                    saveUserActivity({
                      activityType: "CategoryClick",
                      category: cat,
                      page: "TalentPool",
                    });
                  }
                }}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                  activeCategory === cat
                    ? "bg-[#474ead] text-white shadow-sm"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-[#474ead]/30 hover:text-[#474ead] dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
                }`}
              >
                {cat}
              </button>
            ))}

            {/* Advanced filters toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="ml-auto flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-600 transition hover:border-[#474ead]/30 hover:text-[#474ead] dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
            >
              <Filter className="h-3.5 w-3.5" />
              Filters
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showFilters ? "rotate-180" : ""}`} />
            </button>
          </div>

          {/* Advanced filter panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200/80 bg-white/80 p-5 backdrop-blur dark:border-white/10 dark:bg-white/[0.03] sm:grid-cols-2 lg:grid-cols-4">
                  {/* Experience */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">Experience Level</label>
                    <div className="flex flex-wrap gap-1.5">
                      {EXPERIENCE_LEVELS.map((lvl) => (
                        <button
                          key={lvl}
                          onClick={() => setExperienceFilter(lvl)}
                          className={`rounded-full px-3 py-1 text-xs transition ${
                            experienceFilter === lvl
                              ? "bg-[#474ead] text-white"
                              : "border border-slate-200 text-slate-600 hover:border-[#474ead]/30 dark:border-white/10 dark:text-slate-300"
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Location */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">Location</label>
                    <Input
                      value={locationFilter}
                      onChange={(e) => setLocationFilter(e.target.value)}
                      placeholder="City, country…"
                      className="h-9 rounded-full border-slate-200 bg-slate-50 text-sm dark:border-white/10 dark:bg-white/[0.04]"
                    />
                  </div>

                  {/* Work Setup */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">Work Setup</label>
                    <div className="flex flex-wrap gap-1.5">
                      {WORK_SETUPS.map((ws) => (
                        <button
                          key={ws}
                          onClick={() => setWorkSetupFilter(ws)}
                          className={`rounded-full px-3 py-1 text-xs transition ${
                            workSetupFilter === ws
                              ? "bg-[#474ead] text-white"
                              : "border border-slate-200 text-slate-600 hover:border-[#474ead]/30 dark:border-white/10 dark:text-slate-300"
                          }`}
                        >
                          {ws}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Clear */}
                  <div className="flex items-end">
                    <button
                      onClick={() => {
                        setExperienceFilter("Any");
                        setLocationFilter("");
                        setWorkSetupFilter("Any");
                      }}
                      className="text-sm text-slate-400 underline-offset-2 hover:text-[#474ead] hover:underline"
                    >
                      Clear filters
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Result count + shortlist toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              {isLoading ? (
                "Loading candidates…"
              ) : (
                <>
                  <span className="font-semibold text-slate-900 dark:text-white">{displayResults.length}</span>{" "}
                  {displayResults.length === 1 ? "candidate" : "candidates"} found
                  {searchQuery || activeCategory !== "All" ? " for your criteria" : ""}
                </>
              )}
            </p>
            <button
              onClick={() => setShowShortlistedOnly(!showShortlistedOnly)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm transition ${
                showShortlistedOnly
                  ? "bg-[#474ead] text-white"
                  : "border border-slate-200 text-slate-600 dark:border-white/10 dark:text-slate-300"
              }`}
            >
              <Bookmark className={`h-3.5 w-3.5 ${showShortlistedOnly ? "fill-current" : ""}`} />
              Shortlisted ({shortlisted.size})
            </button>
          </div>
        </div>

        {/* Results grid */}
        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-64 animate-pulse rounded-3xl bg-slate-100 dark:bg-white/[0.04]"
              />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20">
              <X className="h-7 w-7 text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Failed to load candidates</h3>
            <p className="mt-2 text-sm text-slate-500">Please try again later or contact support.</p>
          </div>
        ) : displayResults.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#474ead]/10">
              <Users className="h-7 w-7 text-[#474ead]" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
              {showShortlistedOnly ? "No shortlisted candidates" : "No matches found"}
            </h3>
            <p className="mt-2 max-w-sm text-sm text-slate-500">
              {showShortlistedOnly
                ? "Bookmark candidates using the shortlist button to see them here."
                : "Try broadening your search or adjusting the filters."}
            </p>
            {(searchQuery || activeCategory !== "All" || experienceFilter !== "Any") && !showShortlistedOnly && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setActiveCategory("All");
                  setExperienceFilter("Any");
                  setLocationFilter("");
                  setWorkSetupFilter("Any");
                }}
                className="mt-4 rounded-full border border-slate-200 px-5 py-2 text-sm text-slate-600 transition hover:border-[#474ead]/30 hover:text-[#474ead] dark:border-white/10 dark:text-slate-300"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {displayResults.map((result) => (
              <TalentCard
                key={result.candidate.id}
                result={result}
                onViewProfile={(r) => {
                  saveUserActivity({
                    activityType: "TalentView",
                    referenceId: r.candidate.id,
                    title: r.candidate.targetPosition ?? undefined,
                    category: r.candidate.category ?? undefined,
                    skills: [
                      ...(r.candidate.coreSkills ?? []),
                      ...(r.candidate.secondarySkills ?? []),
                    ].slice(0, 5),
                    page: "TalentPool",
                  });
                  setSelectedResult(r);
                }}
                isShortlisted={shortlisted.has(result.candidate.id)}
                onToggleShortlist={toggleShortlist}
                canSeeContact={canSeeContact}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
