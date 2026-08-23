import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { createPortal } from "react-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import {
  TALENT_BROWSE_CATEGORIES,
  TALENT_CATEGORY_PHRASES,
  resolveBrowseCategory,
  type TalentBrowseCategory,
} from "@/lib/jobConstants";
import { cn } from "@/lib/utils";
import { isInvitableJob, type InvitationPickerJob, type InvitationReadiness } from "@/lib/invitationReadiness";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Check, Loader2, AlertCircle, Eye, MapPin, Briefcase, Clock, Clock3, Globe2, Sparkles, Star, X, Link, DollarSign, MessageSquare } from "lucide-react";
import { TopNavigation } from "@/components/TopNavigation";
import { SignUpDialog } from "@/components/SignUpDialog";
import { LoginDialog } from "@/components/LoginDialog";
import { ClientTalentShortlistDialog } from "@/components/ClientTalentShortlistDialog";
import { useClientShortlists } from "@/hooks/useClientShortlists";
import type { ClientTalentInviteTarget } from "@/components/ClientTalentInviteDialog";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TalentResult {
  candidateId: string;

  userId: string;

  score: number;

  overlapSkills: string[];

  matchReasons: Record<string, any>;

  candidate: {
    // Sanitizer returns fullName (masked "Jane S." or "Talent Profile")
    fullName?: string | null;
    full_name?: string | null;
    targetPosition?: string;
    target_position?: string;
    location?: string;
    seniority?: string;
    experienceYears?: string | number | null;
    headline?: string | null;
    summary?: string | null;
    coreSkills?: string[];
    core_skills?: string[];
    secondarySkills?: string[];
    secondary_skills?: string[];
    category?: string;
    availability?: string;
    preferences?: {
      rateAmount?: string | null;
      rateEngagementType?: string | null;
      rateCurrency?: string | null;
      [key: string]: string | null | undefined;
    } | null;
    workHistory?: Array<{
      company?: string;
      role?: string;
      jobTitle?: string;
      startDate?: string;
      endDate?: string;
      duration?: string;
      description?: string;
      responsibilities?: string;
    }> | null;
  };
}

/** Shape returned by GET /api/client/talent-profile/:userId (full profile extras only). */
interface FullProfileData {
  education: Array<Record<string, string | null | undefined>>;
  certifications: Array<Record<string, string | null | undefined>>;
}

interface SearchResults {
  results: TalentResult[];
}

// Server returns one of two shapes depending on how much real data exists:
//   real-query mode  → { query: string; count: number }
//   fallback mode    → { category: string }
interface Suggestion {
  query?: string;     // real-query mode
  count?: number;
  category?: string;  // fallback mode
}

interface PendingSearchState {
  query: string;
  engagementType: string;
  pendingTalentId: string | null;
  pendingTalentName: string | null;
}

const STORAGE_KEY = "onspot_pending_search";

function getInitials(name?: string | null): string {
  if (!name || name.toLowerCase() === "talent profile") return "TA";
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || "TA"
  );
}
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", PHP: "\u20b1", EUR: "\u20ac", GBP: "\u00a3", AUD: "A$", CAD: "C$",
};

function formatRateDisplay(
  amount: string,
  currency: string,
  engagementType?: string | null,
): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  const base = `${symbol}${amount}`;
  return engagementType ? `${base} / ${engagementType}` : base;
}

// ─── Profile Preview Modal ─────────────────────────────────────────────────────
// Same popup design as TalentPool ProfileModal — dark header, motion popup,
// scrollable body, sticky footer CTA. Uses sanitized candidate data.

function ProfilePreviewModal({
  result,
  open,
  onClose,
  isInvited,
  isInviting,
  isAnonymous,
  onShortlist,
  onInterview,
  isShortlisted,
  onSignIn,
  onMessage,
  isMessaging,
}: {
  result: TalentResult | null;
  open: boolean;
  onClose: () => void;
  isInvited: boolean;
  isInviting: boolean;
  isAnonymous: boolean;
  onShortlist: () => void;
  onInterview: () => void;
  isShortlisted: boolean;
  onSignIn?: () => void;
  onMessage?: () => void;
  isMessaging?: boolean;
}) {
  // Full-profile state — populated when the client clicks "Full profile"
  const [fullProfile, setFullProfile] = useState<FullProfileData | null>(null);
  const [loadingFull, setLoadingFull] = useState(false);
  useEffect(() => {
    if (!open) { setFullProfile(null); setLoadingFull(false); }
  }, [open]);

  if (!result) return null;

  const { candidate } = result;

  const handleViewFullProfile = async () => {
    if (loadingFull || fullProfile) return;
    setLoadingFull(true);
    try {
      // Use apiRequest so the correct auth token is sent (onspot_jwt_token / talent_profile_token).
      // A raw localStorage.getItem("token") always returns null — that key is never written
      // by any login flow in this codebase, causing a silent 401.
      // apiRequest returns a Response object — call .json() to get the parsed body.
      const res = await apiRequest("GET", `/api/client/talent-profile/${result.userId}`);
      const data = await res.json();
      setFullProfile(data);
    } catch {
      // silent — user can retry
    } finally {
      setLoadingFull(false);
    }
  };
  const name = candidate.fullName ?? (candidate as any).full_name ?? "Talent Profile";

  const prefs = candidate.preferences as Record<string, string> | null | undefined;
  const rateAmount  = prefs?.rateAmount  ?? null;
  const rateCurrency = prefs?.rateCurrency ?? "USD";
  const rateET = prefs?.rateEngagementType ?? null;
  const rateDisplay = rateAmount ? formatRateDisplay(rateAmount, rateCurrency, rateET) : null;
  const workHistory = (candidate.workHistory as Array<Record<string, string>> | null) ?? [];

  const portal = (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center p-0 sm:items-center sm:p-4 md:p-6"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
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
        {/* ── Dark header ── */}
        <div className="relative shrink-0 overflow-hidden bg-[#0f172a] px-6 pb-6 pt-5 md:px-10">
          <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-[#474ead]/30 blur-[70px]" />

          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/50 transition hover:bg-white/20 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Badges */}
          <div className="relative mb-4 flex flex-wrap items-center gap-2">
            {candidate.seniority && (
              <span className="rounded-full border border-white/15 bg-white/[0.08] px-3 py-1 text-[11px] text-white/60">
                {candidate.seniority}
              </span>
            )}
            {result.score > 0 && (
              <span className="ml-auto rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-bold text-emerald-400">
                {result.score}% match
              </span>
            )}
          </div>

          <h2 className="relative text-2xl font-bold leading-tight text-white md:text-[28px]">
            {name}
          </h2>
          {(candidate.targetPosition ?? (candidate as any).target_position) && (
            <p className="mt-1.5 text-sm text-slate-400">
              {candidate.targetPosition ?? (candidate as any).target_position}
            </p>
          )}

          {/* Stat cards */}
          <div className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:flex md:gap-3">
            {[
              {
                Icon: Briefcase,
                label: "Category",
                value: candidate.category
                  ? (resolveBrowseCategory(candidate.category) ?? candidate.category)
                  : "—",
              },
              {
                Icon: Clock3,
                label: "Experience",
                value: candidate.experienceYears ? `${candidate.experienceYears} yrs` : "—",
              },
              {
                Icon: Globe2,
                label: "Location",
                value: candidate.location ?? "Philippines",
              },
              ...(rateDisplay ? [{ Icon: Star, label: "Rate", value: rateDisplay }] : []),
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

        {/* ── Scrollable body ── */}
        <div className="flex-1 divide-y divide-slate-100 overflow-y-auto dark:divide-white/10">

          {/* Summary */}
          {(candidate.headline || candidate.summary) && (
            <div className="bg-[#474ead]/[0.04] px-6 py-5 md:px-10">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#474ead]" />
                <div>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-[#474ead]">
                    Profile Summary
                  </p>
                  {candidate.headline && (
                    <p className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {candidate.headline}
                    </p>
                  )}
                  {candidate.summary && (
                    <p className="text-sm leading-6 text-slate-700 dark:text-slate-300">
                      {candidate.summary}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Matched skills */}
          {result.overlapSkills.length > 0 && (
            <div className="px-6 py-5 md:px-10">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                Matched Skills
              </p>
              <div className="flex flex-wrap gap-1.5">
                {result.overlapSkills.map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-[#474ead]/10 px-3 py-1 text-xs font-medium text-[#474ead]"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* All skills */}
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
                        <span key={sk} className="rounded-full bg-[#474ead]/10 px-3 py-1 text-xs font-medium text-[#474ead]">
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
                        <span key={sk} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 dark:bg-white/[0.06] dark:text-slate-300">
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
                {workHistory.map((wh, i) => {
                  const role = wh.role ?? wh.jobTitle ?? "Role";
                  const duration = wh.duration
                    ?? (wh.startDate ? `${wh.startDate} – ${wh.endDate ?? "Present"}` : null);
                  const desc = wh.description ?? wh.responsibilities ?? null;
                  return (
                    <div key={i} className="rounded-xl border border-slate-100 p-4 dark:border-white/[0.06]">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">{role}</p>
                          {wh.company && <p className="text-sm text-slate-500">{wh.company}</p>}
                        </div>
                        {duration && (
                          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-500 dark:bg-white/[0.06]">
                            {duration}
                          </span>
                        )}
                      </div>
                      {desc && (
                        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{desc}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Education — shown when "Full profile" is loaded */}
          {fullProfile && (fullProfile.education?.length ?? 0) > 0 && (
            <div className="px-6 py-5 md:px-10">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                Education
              </p>
              <div className="space-y-4">
                {fullProfile.education.map((ed, i) => {
                  const institution = ed.institution ?? ed.school ?? "Institution";
                  const degree = [ed.degree, ed.field].filter(Boolean).join(", ");
                  const period = ed.endDate
                    ? `${ed.startDate ?? ""} – ${ed.endDate}`.replace(/^\s*–\s*/, "").trim()
                    : (ed.startDate ?? null);
                  return (
                    <div key={i} className="rounded-xl border border-slate-100 p-4 dark:border-white/[0.06]">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">{institution}</p>
                          {degree && <p className="text-sm text-slate-500">{degree}</p>}
                        </div>
                        {period && (
                          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-500 dark:bg-white/[0.06]">
                            {period}
                          </span>
                        )}
                      </div>
                      {ed.description && (
                        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{ed.description}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Certifications — shown when "Full profile" is loaded */}
          {fullProfile && (fullProfile.certifications?.length ?? 0) > 0 && (
            <div className="px-6 py-5 md:px-10">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                Certifications
              </p>
              <div className="space-y-3">
                {fullProfile.certifications.map((cert, i) => {
                  const name = cert.name ?? cert.title ?? "Certification";
                  return (
                    <div key={i} className="rounded-xl border border-slate-100 p-4 dark:border-white/[0.06]">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">{name}</p>
                          {cert.issuer && <p className="text-sm text-slate-500">{cert.issuer}</p>}
                        </div>
                        {cert.date && (
                          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-500 dark:bg-white/[0.06]">
                            {cert.date}
                          </span>
                        )}
                      </div>
                      {cert.description && (
                        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{cert.description}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Preferences */}
          {prefs && Object.keys(prefs).length > 0 && (
            <div className="px-6 py-5 md:px-10">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                Preferences
              </p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(prefs).map(([k, v]) =>
                  v ? (
                    <span key={k} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 dark:bg-white/[0.06] dark:text-slate-300">
                      {v}
                    </span>
                  ) : null,
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer CTA ── */}
        <div className="shrink-0 border-t border-slate-100 px-6 py-4 dark:border-white/10 md:px-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              disabled={isInvited || isInviting}
              onClick={() => { onShortlist(); onClose(); }}
              className={cn(
                "rounded-full px-5 py-2 text-sm font-semibold transition-colors",
                isInvited || isShortlisted
                  ? "border border-emerald-400 text-emerald-600 cursor-default"
                  : "bg-[#474ead] hover:bg-[#3d439c] text-white",
              )}
            >
              {isInviting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing…
                </span>
              ) : isInvited ? (
                <span className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5" /> Invited
                </span>
              ) : isShortlisted ? (
                <span className="flex items-center gap-2"><Check className="h-3.5 w-3.5" /> Shortlisted</span>
              ) : isAnonymous ? (
                "Create account to shortlist"
              ) : (
                "Shortlist this talent"
              )}
            </button>
            <div className="flex items-center gap-2">
              {!isAnonymous && !isInvited && (
                <button
                  onClick={() => { onInterview(); onClose(); }}
                  disabled={isInviting}
                  className="rounded-full border border-[#474ead] px-5 py-2 text-sm font-semibold text-[#474ead] hover:bg-[#474ead] hover:text-white disabled:opacity-50"
                >
                  Interview this talent
                </button>
              )}
              {!isAnonymous && !fullProfile && (
                <button
                  onClick={handleViewFullProfile}
                  disabled={loadingFull}
                  className="flex items-center gap-1.5 rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors disabled:opacity-50 dark:border-white/10 dark:text-slate-400"
                >
                  {loadingFull ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</>
                  ) : (
                    <><Eye className="h-3.5 w-3.5" /> Full profile</>
                  )}
                </button>
              )}
              {!isAnonymous && onMessage && (
                <button
                  onClick={onMessage}
                  disabled={isMessaging}
                  className="flex items-center gap-1.5 rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors disabled:opacity-50 dark:border-white/10 dark:text-slate-400"
                >
                  {isMessaging ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Opening…</>
                  ) : (
                    <><MessageSquare className="h-3.5 w-3.5" /> Message</>
                  )}
                </button>
              )}
              <button
                onClick={onClose}
                className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors dark:border-white/10 dark:text-slate-400"
              >
                Close
              </button>
            </div>
          </div>
          {/* Sign-in nudge for anonymous visitors — shown below the action row */}
          {isAnonymous && (
            <p className="mt-2 text-center text-[12px] text-slate-400">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => { onSignIn?.(); onClose(); }}
                className="text-[#474ead] font-semibold hover:underline"
              >
                Sign in
              </button>
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );

  return open ? createPortal(portal, document.body) : null;
}

// ─── Result Row ───────────────────────────────────────────────────────────────

function ResultRow({
  result,
  isInvited,
  isInviting,
  isAnonymous,
  onShortlist,
  onInterview,
  isShortlisted,
  onPreview,
}: {
  result: TalentResult;
  isInvited: boolean;
  isInviting: boolean;
  isAnonymous: boolean;
  onShortlist: () => void;
  onInterview: () => void;
  isShortlisted: boolean;
  onPreview: () => void;
}) {
  const { candidate } = result;

  // sanitizeSearchCandidate returns fullName (server-masked to "Jane S." or "Talent Profile")
  const name = candidate.fullName ?? candidate.full_name ?? null;
  const position = candidate.targetPosition ?? candidate.target_position;

  const isAvailable = !candidate.seniority?.toLowerCase().includes("unavailable");

  const signal = isAvailable
    ? `Available now · ${result.score}% AI-matched profile`
    : `${result.score}% AI-matched profile`;

  const desc = candidate.category
    ? `${resolveBrowseCategory(candidate.category) ?? candidate.category} specialist`
    : position
      ? `Experienced ${position.toLowerCase()}`
      : "Experienced professional available for remote work.";

  return (
    <div className="flex items-center gap-4 py-5 border-b border-slate-200 dark:border-slate-700 last:border-b-0">
      {/* Avatar */}
      <Avatar className="h-10 w-10 shrink-0 rounded-[10px]">
        <AvatarFallback
          className={cn(
            "rounded-[10px] font-bold text-[13px]",
            isAvailable
              ? "bg-[#EFEFFA] text-[#474ead]"
              : "bg-slate-100 text-slate-400",
          )}
        >
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>

      {/* Name + signal + description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap mb-0.5">
          <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">
            {name ?? "Talent Profile"}
          </h3>
          <span
            className={cn(
              "inline-flex items-center gap-[5px] text-[12.5px] font-semibold",
              isAvailable ? "text-[#B8790F]" : "text-slate-400 dark:text-slate-500",
            )}
          >
            {isAvailable && (
              <span className="w-[5px] h-[5px] rounded-full bg-[#F5A623] inline-block shrink-0" />
            )}
            {signal}
          </span>
        </div>
        <p className="text-[13.5px] text-slate-500 dark:text-slate-400 truncate leading-snug">
          {desc}
        </p>
      </div>

      {/* Action buttons */}
      <div className="shrink-0 flex items-center gap-2">
        {/* Preview */}
        <button
          onClick={onPreview}
          className="rounded-[10px] px-3.5 py-[7px] text-[13.5px] font-semibold border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-[#474ead] hover:text-[#474ead] transition-colors duration-150 flex items-center gap-1.5"
        >
          <Eye className="h-3.5 w-3.5" />
          Preview
        </button>

        {/* Shortlist */}
      <button
        disabled={isInvited || isInviting}
        onClick={onShortlist}
        className={cn(
          "rounded-[10px] px-4 py-[7px] text-[13.5px] font-semibold border transition-colors duration-150",
          isInvited || isShortlisted
            ? "border-emerald-400 text-emerald-600 cursor-default"
            : isAnonymous
              ? "border-[#474ead] text-[#474ead] hover:bg-[#474ead] hover:text-white"
              : "border-[#474ead] text-[#474ead] hover:bg-[#474ead] hover:text-white",
        )}
      >
        {isInviting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : isInvited ? (
          <span className="flex items-center gap-1">
            <Check className="h-3.5 w-3.5" />
            Invited
          </span>
        ) : isShortlisted ? (
          <span className="flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Shortlisted</span>
        ) : (
          "Shortlist"
        )}
      </button>
      {!isAnonymous && !isInvited && (
        <button
          onClick={onInterview}
          disabled={isInviting}
          className="rounded-[10px] bg-[#474ead] px-4 py-[7px] text-[13.5px] font-semibold text-white hover:bg-[#363c87] disabled:opacity-60"
        >
          Interview
        </button>
      )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const ENGAGEMENT_OPTIONS = ["All", "Standard", "Lite"] as const;
type EngagementFilter = (typeof ENGAGEMENT_OPTIONS)[number];

export default function HireTalentPage() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();

  // A visitor is treated as an authenticated client only when they have a
  // client role — talent users should use the anonymous/public path.
  const isClient = isAuthenticated && user?.role === "client";
  const isAnonymous = !isClient;

  // ── Auth modals ───────────────────────────────────────────────────────────────
  const [showSignUp, setShowSignUp] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  // ── Stage ─────────────────────────────────────────────────────────────────────
  const [stage, setStage] = useState<"initial" | "active">("initial");
  const isInitial = stage === "initial";

  // ── Search inputs ─────────────────────────────────────────────────────────────
  const [searchText, setSearchText] = useState("");
  const [engagementType, setEngagementType] = useState<"Standard" | "Lite">("Standard");

  // ── Post-search filters (client-side) ─────────────────────────────────────────
  const [categoryFilter, setCategoryFilter] = useState<TalentBrowseCategory | null>(null);
  const [engagementFilter, setEngagementFilter] = useState<EngagementFilter>("All");

  // ── Refine panel ──────────────────────────────────────────────────────────────
  const [refineOpen, setRefineOpen] = useState(false);

  // ── Results ───────────────────────────────────────────────────────────────────
  const [baseResults, setBaseResults] = useState<SearchResults | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [shortlistTarget, setShortlistTarget] = useState<ClientTalentInviteTarget | null>(null);
  const { shortlists } = useClientShortlists(isClient);
  const shortlistedTalentIds = useMemo(
    () => new Set(shortlists.flatMap((item) => [item.talentId, item.candidateId].filter(Boolean) as string[])),
    [shortlists],
  );

  // ── Profile preview sheet ──────────────────────────────────────────────────────
  const [previewResult, setPreviewResult] = useState<TalentResult | null>(null);

  // ── Direct message from preview modal ─────────────────────────────────────────
  const [messagingTalentId, setMessagingTalentId] = useState<string | null>(null);

  const handleOpenMessage = async (talentUserId: string) => {
    if (messagingTalentId) return;
    setMessagingTalentId(talentUserId);
    try {
      const res = await apiRequest("POST", "/api/client/message-talent", { talentUserId });
      if (!res.ok) throw new Error("Failed to open thread");
      const data = await res.json();
      navigate(`/messages/${data.threadId}`);
    } catch {
      toast({ title: "Couldn't open message thread", description: "Please try again.", variant: "destructive" });
    } finally {
      setMessagingTalentId(null);
    }
  };

  // ── Pending invite confirmation (restored after sign-up) ──────────────────────
  const [pendingInvite, setPendingInvite] = useState<{
    talentUserId: string;
    talentName: string;
    query: string;
  } | null>(null);
  // ── Job picker (used when client clicks Invite/Shortlist) ─────────────────────
  // pickerTarget: who is being invited; null = picker closed
  // pickerJobs: client's open approved real postings, fetched when picker opens
  // pickerSelectedJobId: which job the client picked (only relevant with 2+ jobs)
  // pickerSending: invite API call in-flight
  const [pickerTarget, setPickerTarget] = useState<{ talentUserId: string; talentName: string } | null>(null);
  const [pickerJobs, setPickerJobs] = useState<InvitationPickerJob[]>([]);
  const [pickerReadiness, setPickerReadiness] = useState<InvitationReadiness | null>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerSelectedJobId, setPickerSelectedJobId] = useState<string | null>(null);
  const [pickerSending, setPickerSending] = useState(false);
  const [inviteDateTime, setInviteDateTime] = useState("");

  const [copiedLink, setCopiedLink] = useState(false);

  // ── Suggestion chips ──────────────────────────────────────────────────────────
  // Suggestions endpoint is public — no auth required.
  const { data: suggestions = [] } = useQuery<Suggestion[]>({
    queryKey: ["talent-search-suggestions"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/client/talent-search/suggestions");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const suggestionChips = useMemo(
    () =>
      suggestions.map((s) => {
        // real-query mode: server sends { query, count }
        if (s.query) return { key: s.query, phrase: s.query };
        // fallback mode: server sends { category }
        const cat = s.category ?? "";
        return {
          key: cat,
          phrase: TALENT_CATEGORY_PHRASES[cat as TalentBrowseCategory] ?? cat,
        };
      }),
    [suggestions],
  );

  // ── Search mutation ───────────────────────────────────────────────────────────
  const searchMutation = useMutation({
    mutationFn: async ({
      text,
      engType,
      isBaseSearch,
      pendingTalentId,
      pendingTalentName,
    }: {
      text: string;
      engType: "Standard" | "Lite";
      isBaseSearch: boolean;
      pendingTalentId?: string | null;
      pendingTalentName?: string | null;
    }) => {
      // Use the public endpoint for anonymous visitors — no DB write.
      // Use the authenticated endpoint for clients — creates scaffold job + returns jobId.
      const endpoint = isClient
        ? "/api/client/talent-search"
        : "/api/talent-search";

      const res = await apiRequest("POST", endpoint, {
        searchText: text,
        category: null,
        engagementType: engType,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Search failed");
      }
      return {
        data: (await res.json()) as SearchResults,
        isBaseSearch,
        pendingTalentId: pendingTalentId ?? null,
        pendingTalentName: pendingTalentName ?? null,
      };
    },
    onSuccess: async ({ data, isBaseSearch, pendingTalentId, pendingTalentName }) => {
      setSearchResults(data);
      if (isBaseSearch) {
        setBaseResults(data);
        setCategoryFilter(null);
        setEngagementFilter("All");
      }
      // After auth-restore: if the visitor had clicked Shortlist before signing up,
      // surface a confirmation banner — do NOT auto-fire the invite.
      if (pendingTalentId && pendingTalentName) {
        setPendingInvite({
          talentUserId: pendingTalentId,
          talentName: pendingTalentName,
          query: searchText,
        });
      }
      // For authenticated clients, check which returned talent are already invited
      // so we can pre-populate invitedIds and show the correct button state.
      // We reconcile: for each ID in this result set, the server is authoritative —
      // remove ones that are no longer invited (e.g. declined) and add current ones.
      if (isClient && data.results.length > 0) {
        try {
          const resultIds = data.results.map((r) => r.userId).filter(Boolean);
          const params = resultIds.map((id) => encodeURIComponent(id)).join(",");
          const checkRes = await apiRequest("GET", `/api/client/invitations/check?talentUserIds=${params}`);
          if (checkRes.ok) {
            const body = await checkRes.json() as { invitedIds: string[] };
            const serverInvited = new Set(body.invitedIds);
            setInvitedIds((prev) => {
              const next = new Set(prev);
              // For every ID in this result set, defer to the server's answer
              for (const id of resultIds) {
                if (serverInvited.has(id)) {
                  next.add(id);
                } else {
                  next.delete(id);
                }
              }
              return next;
            });
          }
        } catch {
          // Non-critical — silently ignore; the user can still see the Shortlist button
        }
      }
    },
    onError: (err: any) => {
      toast({ title: "Search failed", description: err.message, variant: "destructive" });
    },
  });

  // ── Shared flag: prevents both init paths from firing a search ───────────────
  // Declared before both init effects so both can read/write it in declaration
  // order within the same React commit. The sessionStorage restore effect is
  // listed first and sets the flag when it consumes valid saved state; the URL
  // hydration effect (listed second) checks the flag and skips if already set.
  const didAutoSearch = useRef(false);

  // ── Restore pending search state after authentication ────────────────────────
  // When a visitor clicks Shortlist while logged out, their search params +
  // intended talentId are saved to sessionStorage. After they sign up/log in
  // (same tab), this effect fires, restores the search, and queues a confirmation
  // prompt. sessionStorage.removeItem runs immediately to prevent double-fire.
  useEffect(() => {
    if (isLoading) return;
    if (!isClient) return;

    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    sessionStorage.removeItem(STORAGE_KEY);

    try {
      const saved: PendingSearchState = JSON.parse(raw);
      if (!saved.query?.trim()) return;

      // Mark first so the URL-hydration effect (runs after this one) skips.
      didAutoSearch.current = true;

      const engType =
        saved.engagementType === "Lite" ? "Lite" : "Standard";

      setSearchText(saved.query);
      setEngagementType(engType);
      setStage("active");
      searchMutation.mutate({
        text: saved.query,
        engType,
        isBaseSearch: true,
        pendingTalentId: saved.pendingTalentId,
        pendingTalentName: saved.pendingTalentName,
      });
    } catch {
      // Malformed storage — silently ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, isLoading]);

  // ── Filtered results (client-side category filter) ────────────────────────────
  const filteredResults = useMemo(() => {
    if (!searchResults) return [];
    return searchResults.results.filter((r) => {
      if (categoryFilter) {
        const cat = resolveBrowseCategory(r.candidate.category ?? "");
        if (cat !== categoryFilter && (r.candidate.category ?? "") !== categoryFilter) return false;
      }
      return true;
    });
  }, [searchResults, categoryFilter]);

  // ── URL param sync — read on mount, write on every search ────────────────────
  // On mount (once auth resolves), read ?q and ?type from the URL and auto-fire.
  // Priority is controlled by didAutoSearch: the sessionStorage restore effect
  // (declared before this one) sets the flag when it consumes valid saved state,
  // so this effect simply skips if the flag is already set — one search maximum.
  useEffect(() => {
    if (isLoading) return;
    if (didAutoSearch.current) return;

    const params = new URLSearchParams(window.location.search);
    const q = params.get("q")?.trim();
    const type = params.get("type");

    if (!q) return;
    didAutoSearch.current = true;

    const engType: "Standard" | "Lite" = type === "Lite" ? "Lite" : "Standard";
    setSearchText(q);
    setEngagementType(engType);
    setStage("active");
    searchMutation.mutate({ text: q, engType, isBaseSearch: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  // ── Trigger search ────────────────────────────────────────────────────────────
  function runSearch(text?: string, engType?: "Standard" | "Lite", isBaseSearch = true) {
    const q = (text ?? searchText).trim();
    if (!q) { toast({ title: "Enter a search term" }); return; }
    const et = engType ?? engagementType;
    setSearchText(q);
    setEngagementType(et);
    setStage("active");
    // Push search state into the URL so it can be copied and shared.
    const urlParams = new URLSearchParams();
    urlParams.set("q", q);
    urlParams.set("type", et);
    history.replaceState(null, "", `?${urlParams.toString()}`);
    searchMutation.mutate({ text: q, engType: et, isBaseSearch });
  }

  // Formal interview invitation flow.
  function handleInterview(talentUserId: string, talentName: string) {
    if (isAnonymous) {
      // Save search state + intended invite target, then prompt sign-up.
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          query: searchText,
          engagementType,
          pendingTalentId: talentUserId,
          pendingTalentName: talentName,
        } satisfies PendingSearchState),
      );
      setShowSignUp(true);
      return;
    }
    // Authenticated client — open the job picker.
    openPicker(talentUserId, talentName);
  }

  function handleShortlist(talentUserId: string, talentName: string) {
    if (isAnonymous) {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          query: searchText,
          engagementType,
          pendingTalentId: talentUserId,
          pendingTalentName: talentName,
        } satisfies PendingSearchState),
      );
      setShowSignUp(true);
      return;
    }
    setShortlistTarget({ id: talentUserId, idType: "talentUser", name: talentName });
  }

  // ── Job picker — open, confirm, close ─────────────────────────────────────────
  // Design: the Hire Talent search bar never creates a jobs row.  Invitations
  // must reference one of the client's own real open/approved job postings.
  // The picker fetches those jobs on demand and branches on count (0 / 1 / 2+).
  function closePicker() {
    setPickerTarget(null);
    setPickerJobs([]);
    setPickerReadiness(null);
    setPickerError(null);
    setPickerSelectedJobId(null);
    setInviteDateTime("");
  }

  async function openPicker(talentUserId: string, talentName: string) {
    setPickerTarget({ talentUserId, talentName });
    setPickerLoading(true);
    setPickerError(null);
    setPickerReadiness(null);
    setPickerSelectedJobId(null);
    try {
      const res = await apiRequest("GET", "/api/client/invitation-readiness");
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(data.jobs) || !data.summary || !data.msa) {
        throw new Error(data.message || data.error || "Could not load your job postings");
      }
      setPickerReadiness(data as InvitationReadiness);
      setPickerJobs(data.jobs.filter(isInvitableJob));
    } catch (err: any) {
      setPickerJobs([]);
      setPickerError(err.message || "Could not load your job postings");
    } finally {
      setPickerLoading(false);
    }
  }

  async function confirmInvite(jobId: string) {
    if (!pickerTarget) return;
    if (!inviteDateTime) {
      toast({
        title: "Choose an interview time",
        description: "Every new invitation includes an initial interview proposal.",
        variant: "destructive",
      });
      return;
    }
    const { talentUserId } = pickerTarget;
    setPickerSending(true);
    setInvitingId(talentUserId);
    try {
      const invitePayload = {
        jobId,
        talentUserId,
        proposedTimes: inviteDateTime
          ? [{ start: new Date(inviteDateTime).toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }]
          : undefined,
      };
      let res = await apiRequest("POST", "/api/client/invitations", invitePayload);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.error === "already_invited") {
          setInvitedIds((p) => new Set(p).add(talentUserId));
          closePicker();
          return;
        }
        if (body.error === "msa_required") {
          window.open(body.termsUrl || "/terms-and-conditions", "_blank", "noopener,noreferrer");
          const accepted = window.confirm(
            "Please review the Terms of Service in the opened tab. Press OK only if you accept them to record acceptance and send this invitation.",
          );
          if (!accepted) return;
          const msaRes = await apiRequest("POST", "/api/client/msa-acceptance", { accepted: true });
          if (!msaRes.ok) {
            const msaBody = await msaRes.json().catch(() => ({}));
            throw new Error(msaBody.message || msaBody.error || "Please accept the Terms of Service first");
          }
          res = await apiRequest("POST", "/api/client/invitations", invitePayload);
        }
        if (!res.ok) {
          const retryBody = await res.json().catch(() => ({}));
          throw new Error(retryBody.message || retryBody.error || "Failed to send invitation");
        }
      }
      setInvitedIds((p) => new Set(p).add(talentUserId));
      toast({ title: "Invitation sent", description: "The talent will see your invitation on their dashboard." });
      closePicker();
    } catch (err: any) {
      // Keep picker open on error so the client can retry or cancel.
      toast({ title: "Could not send invitation", description: err.message, variant: "destructive" });
    } finally {
      setPickerSending(false);
      setInvitingId(null);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  const pickerState = pickerReadiness?.summary.state;
  return (
    <div className="min-h-screen bg-[#F7F7FA] dark:bg-[#060816]">
      <TopNavigation />

      {/* ── Search zone — transitions from centered to compact strip ── */}
      <div
        className={cn(
          "transition-[padding,background-color,border-color,box-shadow] duration-500 ease-in-out",
          isInitial
            ? "flex items-center justify-center min-h-[calc(100vh-4rem)] py-10"
            : "bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm py-5",
        )}
      >
        <div
          className={cn(
            "w-full transition-[max-width] duration-500 ease-in-out px-5",
            isInitial ? "max-w-2xl" : "max-w-5xl mx-auto",
          )}
        >
          {/* Search input */}
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2 shadow-[0_8px_24px_-12px_rgba(20,20,60,0.12)]">
            <Search className="h-[18px] w-[18px] text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }}
              placeholder="Tell us what you need"
              className="flex-1 bg-transparent border-none outline-none text-[15.5px] font-medium text-slate-800 dark:text-white placeholder:text-slate-400 placeholder:font-normal py-2.5"
            />
            <button
              onClick={() => runSearch()}
              disabled={searchMutation.isPending}
              className="bg-[#474ead] hover:bg-[#363c87] text-white font-semibold text-[15px] rounded-[10px] px-[22px] py-[11px] shrink-0 transition-colors disabled:opacity-60 flex items-center gap-2 whitespace-nowrap"
            >
              {searchMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Hire Talent →"
              )}
            </button>
          </div>

          {/* Suggestion chips — real query frequency when enough data, else category volume */}
          {suggestionChips.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {suggestionChips.map(({ key, phrase }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => runSearch(phrase)}
                  className="text-[13px] font-medium text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-[13px] py-[6px] hover:border-[#474ead] hover:text-[#474ead] transition-[border-color,color] duration-150 cursor-pointer"
                >
                  {phrase}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Results — revealed on action ── */}
      <AnimatePresence>
        {stage === "active" && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
            className="max-w-5xl mx-auto px-5 pt-8 pb-20"
          >
            {/* Pending invite banner — shown after auth restores search */}
            {pendingInvite && (
              <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#474ead]/30 bg-[#EFEFFA] px-4 py-4">
                <AlertCircle className="h-4 w-4 text-[#474ead] shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-semibold text-slate-800">
                    You were about to invite{" "}
                    <span className="text-[#474ead]">{pendingInvite.talentName}</span>{" "}
                    for &ldquo;{pendingInvite.query}&rdquo; — pick a role to invite them to.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      const inv = pendingInvite;
                      setPendingInvite(null);
                      openPicker(inv.talentUserId, inv.talentName);
                    }}
                    className="rounded-[8px] bg-[#474ead] px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-[#363c87] transition-colors"
                  >
                    Choose role
                  </button>
                  <button
                    onClick={() => setPendingInvite(null)}
                    className="rounded-[8px] border border-slate-200 px-3 py-1.5 text-[12.5px] font-semibold text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* Results header — heading + Refine toggle */}
            <div className="flex items-center justify-between mb-5 pb-5 border-b border-slate-200 dark:border-slate-700">
              <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900 dark:text-white">
                {searchMutation.isPending
                  ? "Searching…"
                  : searchResults
                    ? `Matches for "${searchText}"`
                    : "Matches"}
              </h1>
              <div className="flex items-center gap-3">
                {/* Copy link button — only shown once results are present */}
                {searchResults && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href).then(() => {
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 2000);
                      });
                    }}
                    title="Copy link to this search"
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors duration-150",
                      copiedLink
                        ? "border-emerald-400 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
                        : "border-slate-200 dark:border-slate-700 text-slate-500 hover:border-[#474ead] hover:text-[#474ead]",
                    )}
                  >
                    {copiedLink ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Link className="h-3.5 w-3.5" />
                        Copy link
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={() => setRefineOpen((o) => !o)}
                  className="text-[13.5px] font-semibold text-slate-500 hover:text-[#474ead] transition-colors duration-150 py-1"
                >
                  {refineOpen ? "Refine ▴" : "Refine ▾"}
                </button>
              </div>
            </div>

            {/* Collapsible filter row */}
            {refineOpen && (
              <div className="flex flex-col gap-3 pb-5 mb-2 border-b border-slate-200 dark:border-slate-700">
                {/* Role / category chips */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] text-slate-400 font-semibold mr-0.5">Role:</span>
                  <button
                    onClick={() => setCategoryFilter(null)}
                    className={cn(
                      "text-[13.5px] font-semibold rounded-full px-[14px] py-[7px] border transition-colors duration-150",
                      !categoryFilter
                        ? "bg-[#EFEFFA] text-[#474ead] border-[#EFEFFA]"
                        : "text-slate-500 border-slate-200 dark:border-slate-700 hover:border-[#474ead]",
                    )}
                  >
                    All roles
                  </button>
                  {TALENT_BROWSE_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter((prev) => (prev === cat ? null : cat))}
                      className={cn(
                        "text-[13.5px] font-semibold rounded-full px-[14px] py-[7px] border transition-colors duration-150",
                        categoryFilter === cat
                          ? "bg-[#EFEFFA] text-[#474ead] border-[#EFEFFA]"
                          : "text-slate-500 border-slate-200 dark:border-slate-700 hover:border-[#474ead]",
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Engagement Type — Lite / Standard only */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] text-slate-400 font-semibold">Engagement Type:</span>
                  {ENGAGEMENT_OPTIONS.map((et) => (
                    <button
                      key={et}
                      onClick={() => {
                        setEngagementFilter(et);
                        if (et === "All") {
                          if (baseResults) setSearchResults(baseResults);
                        } else {
                          setEngagementType(et);
                          runSearch(searchText, et, false);
                        }
                      }}
                      className={cn(
                        "text-[13.5px] font-semibold rounded-full px-[14px] py-[7px] border transition-colors duration-150",
                        engagementFilter === et
                          ? "bg-[#EFEFFA] text-[#474ead] border-[#EFEFFA]"
                          : "text-slate-500 border-slate-200 dark:border-slate-700 hover:border-[#474ead]",
                      )}
                    >
                      {et}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Loading */}
            {searchMutation.isPending && (
              <div className="flex flex-col items-center gap-3 py-16 text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin text-[#474ead]" />
                <p className="text-sm">Scoring talent profiles…</p>
              </div>
            )}

            {/* Results list — single column, hairline-separated rows */}
            {!searchMutation.isPending && filteredResults.length > 0 && (
              <div className="flex flex-col">
                {filteredResults.map((r) => (
                  <ResultRow
                    key={r.candidateId}
                    result={r}
                    isAnonymous={isAnonymous}
                    isInvited={invitedIds.has(r.userId)}
                    isInviting={invitingId === r.userId}
                    isShortlisted={shortlistedTalentIds.has(r.userId)}
                    onPreview={() => setPreviewResult(r)}
                    onShortlist={() =>
                      handleShortlist(
                        r.userId,
                        r.candidate.fullName ?? r.candidate.full_name ?? "Talent Profile",
                      )
                    }
                    onInterview={() =>
                      handleInterview(
                        r.userId,
                        r.candidate.fullName ?? r.candidate.full_name ?? "Talent Profile",
                      )
                    }
                  />
                ))}
              </div>
            )}

            {/* Empty results */}
            {!searchMutation.isPending && searchResults && filteredResults.length === 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
                <p className="font-semibold text-slate-700 dark:text-slate-300">
                  No matching profiles found
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {categoryFilter
                    ? `No results in "${categoryFilter}" — try All roles or a different category.`
                    : "Try broadening your search."}
                </p>
                {categoryFilter && (
                  <button
                    onClick={() => setCategoryFilter(null)}
                    className="mt-3 text-sm text-[#474ead] font-semibold hover:underline"
                  >
                    Clear filter
                  </button>
                )}
              </div>
            )}

            {/* Invited summary */}
            {invitedIds.size > 0 && (
              <div className="mt-8 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800/40 dark:bg-emerald-950/20">
                <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                <p className="text-sm text-emerald-700 dark:text-emerald-400">
                  <span className="font-semibold">
                    {invitedIds.size} invitation{invitedIds.size !== 1 ? "s" : ""} sent.
                  </span>{" "}
                  Invited talent can accept or decline directly from their dashboard.
                </p>
              </div>
            )}

            {/* Sign-up nudge for anonymous visitors who haven't clicked Shortlist yet */}
            {isAnonymous && !searchMutation.isPending && searchResults && filteredResults.length > 0 && (
              <p className="mt-8 text-center text-[13.5px] text-slate-400 dark:text-slate-500">
                Ready to invite?{" "}
                <button
                  onClick={() => setShowSignUp(true)}
                  className="text-[#474ead] font-semibold hover:underline"
                >
                  Create a free account
                </button>{" "}
                to shortlist and send invitations.
              </p>
            )}

            {/* Assist line for authenticated clients */}
            {!isAnonymous && !searchMutation.isPending && searchResults && (
              <p className="mt-8 text-center text-[13.5px] text-slate-400 dark:text-slate-500">
                Don&apos;t see the right fit?{" "}
                <a
                  href="mailto:careers@onspotglobal.com"
                  className="text-[#474ead] font-semibold hover:underline"
                >
                  Request a shortlist
                </a>{" "}
                — same rate, we do the searching.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Auth modals ── */}
      <SignUpDialog
        open={showSignUp}
        onOpenChange={setShowSignUp}
        hideTrigger
        onSignInInstead={() => { setShowSignUp(false); setShowLogin(true); }}
      />

      <LoginDialog open={showLogin} onOpenChange={setShowLogin} />

      {/* ── Job picker modal ─────────────────────────────────────────────────────
          Shown when a client clicks Invite/Shortlist on a talent card.
          Branches on the count of their open approved job postings:
            0 → "Post a job first" CTA
            1 → single-confirm (no list needed)
            2+ → scrollable picker, confirm disabled until one is selected
          Cancel always closes cleanly with no network call and no state residue.
      ──────────────────────────────────────────────────────────────────────── */}
      {pickerTarget &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={closePicker}
          >
            <div
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {pickerLoading ? (
                <div className="flex flex-col items-center gap-3 py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-[#474ead]" />
                  <p className="text-sm text-slate-500">Loading your job postings…</p>
                </div>
              ) : pickerError ? (
                <div className="p-6">
                  <h3 className="text-[17px] font-bold text-slate-900 dark:text-white mb-2">
                    We couldn’t load your job postings
                  </h3>
                  <p className="text-[13.5px] text-slate-500 dark:text-slate-400 mb-5">
                    {pickerError}
                  </p>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={closePicker}
                      className="rounded-[10px] border border-slate-200 px-4 py-2 text-[13.5px] font-semibold text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      Close
                    </button>
                    <button
                      onClick={() => pickerTarget && openPicker(pickerTarget.talentUserId, pickerTarget.talentName)}
                      className="rounded-[10px] bg-[#474ead] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#363c87] transition-colors"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              ) : pickerJobs.length === 0 ? (
                /* ── Zero open jobs ── */
                <div className="p-6">
                  {pickerReadiness?.msa.required && (
                    <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/40 dark:bg-amber-950/20">
                      <p className="text-[13px] font-semibold text-amber-900 dark:text-amber-300">
                        Terms acceptance required for your first invitation
                      </p>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-amber-800/80 dark:text-amber-400/80">
                        <a href={pickerReadiness.msa.termsUrl} target="_blank" rel="noreferrer" className="font-semibold underline">Read the Terms of Service</a>. Acceptance is recorded when you send your first invitation.
                      </p>
                    </div>
                  )}
                  <h3 className="text-[17px] font-bold text-slate-900 dark:text-white mb-2">
                    {pickerState === "pending_approval"
                      ? "Your job is awaiting approval"
                      : pickerState === "closed_jobs"
                        ? "Your job postings are closed"
                        : pickerState === "scaffold_only"
                          ? "Create a real job posting to invite talent"
                          : pickerState === "not_ready"
                            ? "Your job posting isn’t ready yet"
                          : "No job postings yet"}
                  </h3>
                  <p className="text-[13.5px] text-slate-500 dark:text-slate-400 mb-5">
                    {pickerState === "pending_approval"
                      ? <>Your job posting is being reviewed. You don’t need to create another one — we’ll let you know when it is approved and ready for an invitation to <span className="font-semibold text-slate-700 dark:text-slate-300">{pickerTarget.talentName}</span>.</>
                      : pickerState === "closed_jobs"
                        ? <>Your job postings are closed. Reopen an approved posting before inviting <span className="font-semibold text-slate-700 dark:text-slate-300">{pickerTarget.talentName}</span>.</>
                        : pickerState === "scaffold_only"
                          ? <>Your search has a saved placeholder, but invitations require a real approved job posting for <span className="font-semibold text-slate-700 dark:text-slate-300">{pickerTarget.talentName}</span>.</>
                          : pickerState === "not_ready"
                            ? <>Your job posting must be open and approved before you can invite <span className="font-semibold text-slate-700 dark:text-slate-300">{pickerTarget.talentName}</span>.</>
                          : <>You need an active, approved job posting to invite <span className="font-semibold text-slate-700 dark:text-slate-300">{pickerTarget.talentName}</span>. Create one first, then come back to send the invitation.</>}
                  </p>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={closePicker}
                      className="rounded-[10px] border border-slate-200 px-4 py-2 text-[13.5px] font-semibold text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <a
                      href="/client-profile"
                      className="rounded-[10px] bg-[#474ead] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#363c87] transition-colors"
                    >
                      {pickerState === "pending_approval" || pickerState === "closed_jobs" || pickerState === "not_ready"
                        ? "View job postings →"
                        : "Post a Job →"}
                    </a>
                  </div>
                </div>
              ) : pickerJobs.length === 1 ? (
                /* ── Single job — direct confirm ── */
                <div className="p-6">
                  {pickerReadiness?.msa.required && (
                    <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/40 dark:bg-amber-950/20">
                      <p className="text-[13px] font-semibold text-amber-900 dark:text-amber-300">
                        Terms acceptance required for your first invitation
                      </p>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-amber-800/80 dark:text-amber-400/80">
                        <a href={pickerReadiness.msa.termsUrl} target="_blank" rel="noreferrer" className="font-semibold underline">Read the Terms of Service</a>. When you send this invitation, you’ll be asked to confirm acceptance so we can record it.
                      </p>
                    </div>
                  )}
                  <h3 className="text-[17px] font-bold text-slate-900 dark:text-white mb-1">
                    Invite {pickerTarget.talentName}?
                  </h3>
                  <p className="text-[13.5px] text-slate-500 dark:text-slate-400 mb-5">
                    They'll be invited to:{" "}
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {pickerJobs[0].title}
                    </span>
                    {pickerJobs[0].engagementType && (
                      <span className="ml-1 text-slate-400">· {pickerJobs[0].engagementType}</span>
                    )}
                  </p>
                 <label className="block mb-5">
                   <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                     Propose an initial interview time
                   </span>
                   <input
                     type="datetime-local"
                     value={inviteDateTime}
                     onChange={(e) => setInviteDateTime(e.target.value)}
                     className="w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#474ead] focus:ring-2 focus:ring-[#474ead]/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                     required
                   />
                   <span className="mt-1 block text-[11px] text-slate-400">
                     The talent can accept this time or suggest alternatives.
                   </span>
                 </label>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={closePicker}
                       disabled={pickerSending || !inviteDateTime}
                      className="rounded-[10px] border border-slate-200 px-4 py-2 text-[13.5px] font-semibold text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-60"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => confirmInvite(pickerJobs[0].id)}
                       disabled={pickerSending || !inviteDateTime}
                      className="rounded-[10px] bg-[#474ead] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#363c87] transition-colors disabled:opacity-60 flex items-center gap-1.5"
                    >
                      {pickerSending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        "Send invitation"
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Multiple jobs — scrollable picker ── */
                <div className="p-6">
                  {pickerReadiness?.msa.required && (
                    <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/40 dark:bg-amber-950/20">
                      <p className="text-[13px] font-semibold text-amber-900 dark:text-amber-300">
                        Terms acceptance required for your first invitation
                      </p>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-amber-800/80 dark:text-amber-400/80">
                        <a href={pickerReadiness.msa.termsUrl} target="_blank" rel="noreferrer" className="font-semibold underline">Read the Terms of Service</a>. When you send this invitation, you’ll be asked to confirm acceptance so we can record it.
                      </p>
                    </div>
                  )}
                  <h3 className="text-[17px] font-bold text-slate-900 dark:text-white mb-1">
                    Invite {pickerTarget.talentName} to which role?
                  </h3>
                  <p className="text-[13.5px] text-slate-400 mb-4">
                    Select one of your open job postings.
                  </p>
                   <label className="block mb-4">
                     <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                       Propose an initial interview time
                     </span>
                     <input
                       type="datetime-local"
                       value={inviteDateTime}
                       onChange={(e) => setInviteDateTime(e.target.value)}
                       className="w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#474ead] focus:ring-2 focus:ring-[#474ead]/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                       required
                     />
                   </label>
                  <div className="flex flex-col gap-2 max-h-64 overflow-y-auto mb-5 pr-1">
                    {pickerJobs.map((job) => (
                      <button
                        key={job.id}
                        onClick={() => setPickerSelectedJobId(job.id)}
                        className={cn(
                          "text-left rounded-[10px] px-4 py-3 border text-[13.5px] font-semibold transition-colors duration-150",
                          pickerSelectedJobId === job.id
                            ? "border-[#474ead] bg-[#EFEFFA] text-[#474ead]"
                            : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-[#474ead] hover:text-[#474ead]",
                        )}
                      >
                        {job.title}
                        {job.engagementType && (
                          <span className="ml-2 text-[12px] font-normal text-slate-400">
                            {job.engagementType}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={closePicker}
                      disabled={pickerSending}
                      className="rounded-[10px] border border-slate-200 px-4 py-2 text-[13.5px] font-semibold text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-60"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => pickerSelectedJobId && confirmInvite(pickerSelectedJobId)}
                      disabled={!pickerSelectedJobId || !inviteDateTime || pickerSending}
                      className="rounded-[10px] bg-[#474ead] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#363c87] transition-colors disabled:opacity-60 flex items-center gap-1.5"
                    >
                      {pickerSending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        "Send invitation"
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}

      <ClientTalentShortlistDialog
        target={shortlistTarget}
        onClose={() => setShortlistTarget(null)}
      />

      {/* ── Profile preview modal ── */}
      <ProfilePreviewModal
        result={previewResult}
        open={previewResult !== null}
        onClose={() => setPreviewResult(null)}
        isAnonymous={isAnonymous}
        isInvited={previewResult ? invitedIds.has(previewResult.userId) : false}
        isInviting={previewResult ? invitingId === previewResult.userId : false}
        isShortlisted={previewResult ? shortlistedTalentIds.has(previewResult.userId) : false}
        onShortlist={() => {
          if (!previewResult) return;
          handleShortlist(
            previewResult.userId,
            previewResult.candidate.fullName ?? (previewResult.candidate as any).full_name ?? "Talent Profile",
          );
        }}
        onInterview={() => {
          if (!previewResult) return;
          handleInterview(
            previewResult.userId,
            previewResult.candidate.fullName ?? (previewResult.candidate as any).full_name ?? "Talent Profile",
          );
        }}
        onSignIn={() => {
          if (!previewResult) return;
          // Save pending invite state so after login the shortlist flow resumes.
          sessionStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              query: searchText,
              engagementType,
              pendingTalentId: previewResult.userId,
              pendingTalentName: previewResult.candidate.fullName ?? (previewResult.candidate as any).full_name ?? "Talent Profile",
            } satisfies PendingSearchState),
          );
          setShowLogin(true);
        }}
        onMessage={previewResult ? () => handleOpenMessage(previewResult.userId) : undefined}
        isMessaging={previewResult ? messagingTalentId === previewResult.userId : false}
      />
    </div>
  );
}
