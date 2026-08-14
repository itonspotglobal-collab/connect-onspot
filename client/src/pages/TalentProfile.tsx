import { useState, useRef, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTalentApplications } from "@/hooks/useTalentApplications";
import { getStatusMeta } from "@/lib/applicationStatus";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, Briefcase, Calendar, Globe2, Mail, Phone, Linkedin,
  Github, Link2, Star, ChevronRight, Upload, Pencil, Check,
  X, Plus, Trash2, Award, BookOpen, User, FileText, ExternalLink,
  Clock, ChevronDown, Camera, Shield, AlertCircle, Download, Eye, EyeOff,
} from "lucide-react";
import {
  TalentLoginModal,
  TalentAuthState,
  loadTalentAuth,
  saveTalentAuth,
  clearTalentAuth,
} from "@/components/TalentLoginModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { isAdmin, isClient } from "@/lib/authUtils";
import { formatPublicTalentNameMasked } from "@/lib/formatPublicTalentName";
import { apiRequest } from "@/lib/queryClient";
import { TopNavigation } from "@/components/TopNavigation";
import type { Candidate } from "@shared/schema";
import {
  buildCompletionItems,
  calcCompletionPct,
  profileStrengthFromCandidate,
} from "@/lib/profileCompletion";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function photoSrc(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("/objects/candidate-photos/")) {
    return url.replace("/objects/candidate-photos/", "/api/candidate-photos/");
  }
  return url;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function pref(prefs: Record<string, string> | null, key: string) {
  return prefs?.[key] ?? null;
}

type WorkEntry = { title: string; company: string; duration: string; setup?: string; responsibilities?: string };
type EduEntry = { school: string; degree: string; yearStart?: string; yearEnd?: string };
type CertEntry = { name: string; issuer?: string; date?: string; link?: string };

// ─── Completion score — delegates to shared profileCompletion module ───────────
// buildCompletionItems + calcCompletionPct are imported at the top of the file.

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  id,
  title,
  icon: Icon,
  children,
  action,
}: {
  id?: string;
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-28 rounded-2xl border-slate-200/70 bg-white dark:border-white/10 dark:bg-white/[0.03]">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#474ead]/10">
            <Icon className="h-4 w-4 text-[#474ead]" />
          </div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// ─── Inline edit field ────────────────────────────────────────────────────────

function EditField({
  label,
  value,
  onSave,
  multiline = false,
  placeholder,
  canEdit = true,
  nameMode = false,
  minHeight,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
  canEdit?: boolean;
  nameMode?: boolean;
  minHeight?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  // Sync draft when the server value changes after a successful save
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);
  function commit() {
    onSave(draft);
    setEditing(false);
  }
  function cancel() {
    setDraft(value);
    setEditing(false);
  }
  if (!editing) {
    if (nameMode) {
      return (
        <div className="group flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white md:text-3xl">
            {value || <span className="text-slate-400">{placeholder ?? "Your name"}</span>}
          </h1>
          {canEdit && (
            <button
              onClick={() => setEditing(true)}
              className="invisible shrink-0 rounded p-1 text-slate-400 transition hover:text-[#474ead] group-hover:visible"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>
      );
    }
    return (
      <div className="group flex items-start gap-2">
        <div className="flex-1 min-w-0">
          {multiline && value ? (
            // Multi-paragraph rendering — split on blank lines, preserve intra-paragraph newlines
            <div className="space-y-3">
              {value.split(/\n[ \t]*\n/).map((para, i) => (
                <p key={i} className="text-sm leading-7 text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                  {para.trim()}
                </p>
              ))}
            </div>
          ) : (
            <span className="text-sm text-slate-700 dark:text-slate-300">
              {value || <span className="text-slate-400">{placeholder ?? `Add ${label.toLowerCase()}…`}</span>}
            </span>
          )}
        </div>
        {canEdit && (
          <button
            onClick={() => setEditing(true)}
            className="invisible mt-0.5 shrink-0 rounded p-1 text-slate-400 transition hover:text-[#474ead] group-hover:visible"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {multiline ? (
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="text-sm"
          style={{ minHeight: minHeight ?? "100px" }}
          placeholder={placeholder}
          autoFocus
        />
      ) : (
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          className={nameMode ? "h-10 text-xl font-bold" : "h-9 text-sm"}
          autoFocus
        />
      )}
      <div className="flex gap-2">
        <Button size="sm" onClick={commit} className="h-8 rounded-full bg-[#474ead] text-white text-xs">
          <Check className="mr-1 h-3 w-3" /> Save
        </Button>
        <Button size="sm" variant="ghost" onClick={cancel} className="h-8 rounded-full text-xs">
          <X className="mr-1 h-3 w-3" /> Cancel
        </Button>
      </div>
    </div>
  );
}

// ─── Photo upload zone ────────────────────────────────────────────────────────

function PhotoUploader({
  candidateId,
  current,
  talentToken,
  onUploaded,
}: {
  candidateId: string;
  current: string;
  talentToken: string;
  onUploaded: (url: string) => void;
}) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast({ title: "Invalid file", description: "Only JPG, PNG, or WEBP images allowed.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 5 MB for profile photos.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("photo", file);
      const res = await fetch(`/api/candidates/${candidateId}/photo`, {
        method: "POST",
        headers: { Authorization: `Bearer ${talentToken}` },
        body: form,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      onUploaded(data.profilePhotoUrl);
      toast({ title: "Photo updated", description: "Your profile photo has been saved." });
    } catch {
      toast({ title: "Upload failed", description: "Could not upload photo. Try again.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="absolute inset-0 flex items-end justify-center rounded-full bg-black/0 pb-2 opacity-0 transition-all hover:bg-black/40 hover:opacity-100"
        aria-label="Change profile photo"
      >
        <div className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10px] text-white">
          <Camera className="h-3 w-3" />
          {uploading ? "Saving…" : "Change"}
        </div>
      </button>
    </>
  );
}

// ─── Section Tabs ──────────────────────────────────────────────────────────────

const SECTION_TABS = [
  { id: "section-overview", label: "Overview" },
  { id: "section-about",    label: "About" },
  { id: "section-more-about", label: "More About Me" },
  { id: "section-skills",   label: "Skills" },
  { id: "section-experience", label: "Experience" },
  { id: "section-education", label: "Education" },
  { id: "section-certifications", label: "Certifications" },
  { id: "section-portfolio", label: "Portfolio" },
  { id: "section-resume",   label: "Resume" },
  { id: "section-applications", label: "Applications" },
  { id: "section-preferences", label: "Preferences" },
  { id: "section-contact",  label: "Contact" },
];

// --nav-h is 80px (see index.css); tab bar renders at ~48px.
const NAVBAR_H = 80;
const TABBAR_H = 48;

function SectionTabs({ visibleIds, navbarVisible }: { visibleIds: Set<string>; navbarVisible: boolean }) {
  const [active, setActive] = useState("section-overview");
  const tabsRef = useRef<HTMLDivElement>(null);

  // Track which section is in view
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    SECTION_TABS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActive(id); },
        { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (el) {
      // When navbar is visible: nav (80px) + tab bar (48px) + margin (8px) = 136px
      // When navbar is hidden: tab bar (48px) + margin (8px) = 56px
      const HEADER_OFFSET = navbarVisible ? NAVBAR_H + TABBAR_H + 8 : TABBAR_H + 8;
      const top = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      setActive(id);
    }
    // Scroll tab button into view
    const btn = tabsRef.current?.querySelector(`[data-tab="${id}"]`);
    btn?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }

  const tabs = SECTION_TABS.filter((t) => visibleIds.has(t.id));

  return (
    <div className={`sticky z-40 transition-[top] duration-300 border-b border-slate-200/60 bg-white/90 backdrop-blur-md dark:border-white/10 dark:bg-[#060816]/90 ${navbarVisible ? "top-[var(--nav-h)]" : "top-0"}`}>
      <div className="mx-auto max-w-4xl px-4 md:px-8">
        <div
          ref={tabsRef}
          className="flex items-center gap-0.5 overflow-x-auto py-1.5 scrollbar-none"
        >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            data-tab={tab.id}
            onClick={() => scrollTo(tab.id)}
            className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              active === tab.id
                ? "bg-[#474ead]/10 text-[#474ead]"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
        </div>
      </div>
    </div>
  );
}

// ─── EditSkillsModal ───────────────────────────────────────────────────────────

const MAX_CORE = 10;
const MAX_SKILL_LEN = 50;

function normalizeSkill(s: string) { return s.trim(); }

function EditSkillsModal({
  open,
  onClose,
  initialCore,
  initialSecondary,
  onSave,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  initialCore: string[];
  initialSecondary: string[];
  onSave: (core: string[], secondary: string[]) => void;
  saving: boolean;
}) {
  const [coreSkills, setCoreSkills] = useState<string[]>([]);
  const [secondarySkills, setSecondarySkills] = useState<string[]>([]);
  const [coreInput, setCoreInput] = useState("");
  const [secInput, setSecInput] = useState("");
  const coreRef = useRef<HTMLInputElement>(null);
  const secRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setCoreSkills(initialCore);
      setSecondarySkills(initialSecondary);
      setCoreInput("");
      setSecInput("");
    }
  }, [open, initialCore, initialSecondary]);

  function allLower() {
    return [...coreSkills, ...secondarySkills].map((s) => s.toLowerCase());
  }

  function addSkill(raw: string, type: "core" | "secondary") {
    const val = normalizeSkill(raw);
    if (!val || val.length > MAX_SKILL_LEN) return false;
    if (allLower().includes(val.toLowerCase())) return false;
    if (type === "core") {
      if (coreSkills.length >= MAX_CORE) return false;
      setCoreSkills((p) => [...p, val]);
    } else {
      setSecondarySkills((p) => [...p, val]);
    }
    return true;
  }

  function removeSkill(skill: string, type: "core" | "secondary") {
    if (type === "core") setCoreSkills((p) => p.filter((s) => s !== skill));
    else setSecondarySkills((p) => p.filter((s) => s !== skill));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, type: "core" | "secondary") {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const raw = type === "core" ? coreInput : secInput;
      if (addSkill(raw, type)) {
        if (type === "core") setCoreInput("");
        else setSecInput("");
      }
    }
    if (e.key === "Backspace") {
      const raw = type === "core" ? coreInput : secInput;
      if (!raw) {
        if (type === "core" && coreSkills.length > 0)
          setCoreSkills((p) => p.slice(0, -1));
        else if (type === "secondary" && secondarySkills.length > 0)
          setSecondarySkills((p) => p.slice(0, -1));
      }
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.18 }}
            className="relative z-10 mx-4 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900"
          >
            {/* Header */}
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Edit Skills</h2>
                <p className="mt-0.5 text-xs text-slate-500">Type a skill and press Enter to add it.</p>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Core Skills */}
            <div className="mb-4">
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Core Skills <span className="ml-1 text-slate-300">({coreSkills.length}/{MAX_CORE})</span>
                </label>
              </div>
              <div
                className="flex min-h-[44px] cursor-text flex-wrap gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/5"
                onClick={() => coreRef.current?.focus()}
              >
                {coreSkills.map((sk) => (
                  <span
                    key={sk}
                    className="flex items-center gap-1 rounded-full bg-[#474ead]/10 px-2.5 py-0.5 text-xs font-medium text-[#474ead]"
                  >
                    {sk}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeSkill(sk, "core"); }}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-[#474ead]/20"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
                {coreSkills.length < MAX_CORE && (
                  <input
                    ref={coreRef}
                    value={coreInput}
                    onChange={(e) => setCoreInput(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, "core")}
                    onBlur={() => { if (coreInput.trim()) { addSkill(coreInput, "core"); setCoreInput(""); }}}
                    placeholder={coreSkills.length === 0 ? "e.g. React, TypeScript…" : ""}
                    maxLength={MAX_SKILL_LEN}
                    className="min-w-[120px] flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-300 dark:text-slate-200"
                  />
                )}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">Your top skills — highlight what you do best (max {MAX_CORE}).</p>
            </div>

            {/* Secondary Skills */}
            <div className="mb-6">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Secondary Skills
              </label>
              <div
                className="flex min-h-[44px] cursor-text flex-wrap gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/5"
                onClick={() => secRef.current?.focus()}
              >
                {secondarySkills.map((sk) => (
                  <span
                    key={sk}
                    className="flex items-center gap-1 rounded-full bg-slate-200/70 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-white/10 dark:text-slate-300"
                  >
                    {sk}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeSkill(sk, "secondary"); }}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-slate-300 dark:hover:bg-white/20"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
                <input
                  ref={secRef}
                  value={secInput}
                  onChange={(e) => setSecInput(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, "secondary")}
                  onBlur={() => { if (secInput.trim()) { addSkill(secInput, "secondary"); setSecInput(""); }}}
                  placeholder={secondarySkills.length === 0 ? "e.g. Git, Agile, Figma…" : ""}
                  maxLength={MAX_SKILL_LEN}
                  className="min-w-[120px] flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-300 dark:text-slate-200"
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-400">Supporting skills, tools, and technologies.</p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={saving}
                onClick={() => onSave(coreSkills, secondarySkills)}
                className="bg-[#474ead] text-white hover:bg-[#3a3e99]"
              >
                {saving ? (
                  <><span className="mr-2 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Saving…</>
                ) : (
                  <><Check className="mr-1.5 h-3.5 w-3.5" /> Save Skills</>
                )}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function TalentProfile() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isAdminUser = isAdmin(user);
  const isTalentAcquisition = user?.role === "talent_acquisition";
  const isClientUser = isClient(user);
  // "Client viewer" = any account that should see recruiter actions (Back to Pool, Contact)
  const isClientViewer = isAdminUser || isTalentAcquisition || isClientUser;
  const canSeeContact = isClientViewer;

  // ── Navbar visibility tracking (mirrors TopNavigation scroll logic) ────────
  // Lets SectionTabs know whether the fixed nav is currently in view so it
  // can shift its own sticky offset from top-[80px] to top-0 seamlessly.
  const [isNavbarVisible, setIsNavbarVisible] = useState(true);
  const profileLastScrollY = useRef(0);
  const profileTicking = useRef(false);

  useEffect(() => {
    const controlNavVisibility = () => {
      const currentScrollY = Math.max(0, window.scrollY);
      const scrollDelta = Math.abs(currentScrollY - profileLastScrollY.current);
      if (scrollDelta < 10) { profileTicking.current = false; return; }
      if (currentScrollY < 100) {
        setIsNavbarVisible(true);
      } else if (currentScrollY > profileLastScrollY.current && currentScrollY > 200) {
        setIsNavbarVisible(false);
      } else if (currentScrollY < profileLastScrollY.current) {
        setIsNavbarVisible(true);
      }
      profileLastScrollY.current = currentScrollY;
      profileTicking.current = false;
    };
    const handleScroll = () => {
      if (!profileTicking.current) {
        requestAnimationFrame(controlNavVisibility);
        profileTicking.current = true;
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // ── Talent auth state ──────────────────────────────────────────────────────
  const [talentAuth, setTalentAuth] = useState<TalentAuthState | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSkillsModal, setShowSkillsModal] = useState(false);

  useEffect(() => {
    // Always restore the viewer's own auth session — do not gate it on which
    // profile is being viewed.  isOwner (below) controls edit permissions.
    const stored = loadTalentAuth();
    if (stored) {
      setTalentAuth(stored);
    }
  }, [id]);

  const isOwner = talentAuth?.candidateId === id;
  // Public View: owner visits their own profile with ?view=public — disables all editing controls
  const isPublicPreview = isOwner && new URLSearchParams(window.location.search).get("view") === "public";
  // Admins can also edit; otherwise must be the authenticated owner and NOT in public preview
  const canEdit = (isOwner || isAdminUser) && !isPublicPreview;
  // Sections that are private to the authenticated owner (hidden when previewing as a visitor)
  const showPrivateOwnerSections = isOwner && !isPublicPreview;

  // Local state for optimistic photo update
  const [localPhoto, setLocalPhoto] = useState<string | null>(null);

  const { data: candidate, isLoading, isError } = useQuery<Candidate>({
    queryKey: ["/api/candidates", id],
    queryFn: async () => {
      const res = await fetch(`/api/candidates/${id}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!id,
  });

  const { data: culture } = useQuery<any>({
    queryKey: ["/api/candidates", id, "culture-evaluation"],
    queryFn: async () => {
      const res = await fetch(`/api/candidates/${id}/culture-evaluation`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!id,
  });

  const patchMutation = useMutation({
    mutationFn: async (updates: Partial<Candidate>) => {
      // Talent owners send their talent JWT; admins fallback to their session JWT
      const authHeader = talentAuth?.token
        ? `Bearer ${talentAuth.token}`
        : `Bearer ${localStorage.getItem("onspot_jwt_token") || ""}`;
      const res = await fetch(`/api/candidates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw Object.assign(new Error(err.error || `HTTP ${res.status}`), { status: res.status });
      }
      return res.json();
    },
    onSuccess: () => {
      // Invalidate both the individual profile and the talent list so TalentPool reflects changes
      qc.invalidateQueries({ queryKey: ["/api/candidates", id] });
      qc.invalidateQueries({ queryKey: ["/api/candidates"] });
    },
    onError: (err: any) => {
      if (err?.status === 401 || err?.status === 403) {
        toast({ title: "Session expired", description: "Please sign in again to edit.", variant: "destructive" });
        setTalentAuth(null);
        clearTalentAuth();
        setShowLoginModal(true);
        return;
      }
      toast({ title: "Save failed", description: "Could not save changes.", variant: "destructive" });
    },
  });

  function save(field: string, value: unknown) {
    if (!canEdit) {
      setShowLoginModal(true);
      return;
    }
    patchMutation.mutate({ [field]: value } as any);
  }

  function handleSaveSkills(core: string[], secondary: string[]) {
    patchMutation.mutate(
      { coreSkills: core, secondarySkills: secondary } as any,
      {
        onSuccess: () => {
          setShowSkillsModal(false);
          toast({ title: "Skills saved", description: "Your skills have been updated." });
        },
      }
    );
  }

  if (isLoading) {
    return (
      <>
        <TopNavigation />
        <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-[#060816]">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#474ead] border-t-transparent" />
            <p className="text-sm text-slate-500">Loading profile…</p>
          </div>
        </div>
      </>
    );
  }

  if (isError || !candidate) {
    // IMPORTANT: Do NOT redirect authenticated talent users to /find-best-matches here.
    // Doing so causes the completion loop (talent completes onboarding → navigates to profile
    // → gets sent back to Find Best Matches). Show the "not found" state instead.
    return (
      <>
        <TopNavigation />
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-[#060816]">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-500">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Profile not found</h1>
          <p className="text-sm text-slate-500">This talent profile doesn't exist or has been removed.</p>
          <Button onClick={() => navigate("/talent-pool")} className="mt-2 rounded-full bg-[#474ead] text-white">
            Back to Talent Pool
          </Button>
        </div>
      </>
    );
  }

  const prefs = candidate.preferences as Record<string, string> | null;
  const workHistory = (candidate.workHistory ?? []) as WorkEntry[];
  const education = (candidate.education ?? []) as EduEntry[];
  const certifications = (candidate.certifications ?? []) as CertEntry[];
  const allSkills = [...(candidate.coreSkills ?? []), ...(candidate.secondarySkills ?? [])];
  // Name shown to the public — the raw preferred name is computed first, then
  // masked for unauthenticated visitors.  Authorized viewers (owner, admin,
  // client, talent-acquisition) keep the unmasked name.
  const rawDisplayName =
    candidate.displayName?.trim() ||
    candidate.fullName?.trim() ||
    `Candidate ${(candidate.id ?? "").slice(0, 6).toUpperCase()}`;
  const isAuthorizedViewer = canEdit || isClientViewer;
  const displayName = isAuthorizedViewer
    ? rawDisplayName
    : formatPublicTalentNameMasked(rawDisplayName);
  const displayPhoto = localPhoto || candidate.profilePhotoUrl;
  const photoUrl = photoSrc(displayPhoto);
  // Use the shared profileCompletion module — single source of truth for the number.
  const completion = buildCompletionItems(profileStrengthFromCandidate(candidate));
  const completionPct = calcCompletionPct(completion);

  // Determine which section tabs are visible
  const visibleSectionIds = new Set([
    "section-overview",
    "section-about",
    // More About Me: visible to owner always, visible to others only when non-empty
    ...(candidate.moreAboutMe?.trim() || showPrivateOwnerSections ? ["section-more-about"] : []),
    "section-skills",
    "section-experience",
    "section-education",
    "section-certifications",
    "section-portfolio",
    "section-resume",
    // Applications are private — hidden in public preview and from non-owners
    ...(showPrivateOwnerSections ? ["section-applications"] : []),
    "section-preferences",
    ...(canSeeContact || isOwner ? ["section-contact"] : []),
  ]);

  return (
    <>
    <TopNavigation />
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#060816] dark:text-white">

      {/* ── Talent Login Modal ── */}
      {id && (
        <TalentLoginModal
          profileId={id}
          open={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          onSuccess={(auth) => setTalentAuth(auth)}
        />
      )}

      {/* ── Edit Skills Modal ── */}
      {canEdit && (
        <EditSkillsModal
          open={showSkillsModal}
          onClose={() => setShowSkillsModal(false)}
          initialCore={candidate.coreSkills ?? []}
          initialSecondary={candidate.secondarySkills ?? []}
          onSave={handleSaveSkills}
          saving={patchMutation.isPending}
        />
      )}

      {/* ── Cover Banner ── */}
      <div id="section-overview" className="relative h-48 overflow-hidden bg-gradient-to-br from-[#474ead] via-[#5b61c0] to-[#6366f1] md:h-64">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.12),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(99,102,241,0.35),transparent_55%)]" />
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-slate-50 dark:from-[#060816]" />
      </div>

      {/* ── Profile header ── */}
      <div className="mx-auto max-w-4xl px-4 md:px-8">
        {/* Row 1: Avatar overlapping cover */}
        <div className="-mt-20 md:-mt-24">
          <div className="relative inline-block">
            <div className="relative h-32 w-32 rounded-full border-4 border-slate-50 shadow-lg dark:border-[#060816] md:h-36 md:w-36">
              <Avatar className="h-full w-full rounded-full">
                <AvatarImage src={photoUrl} alt={displayName} className="rounded-full object-cover" />
                <AvatarFallback className="rounded-full bg-[#474ead] text-3xl font-bold text-white">
                  {initials(displayName)}
                </AvatarFallback>
              </Avatar>
              {canEdit && talentAuth?.token && (
                <PhotoUploader
                  candidateId={candidate.id}
                  current={photoUrl}
                  talentToken={talentAuth.token}
                  onUploaded={(url) => {
                    setLocalPhoto(url);
                    qc.invalidateQueries({ queryKey: ["/api/candidates", id] });
                  }}
                />
              )}
            </div>
            {/* Completion ring indicator */}
            <div
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-50 bg-white text-[10px] font-bold shadow dark:border-[#060816] dark:bg-slate-800"
              style={{ color: completionPct >= 80 ? "#22c55e" : completionPct >= 50 ? "#f59e0b" : "#ef4444" }}
            >
              {completionPct}%
            </div>
          </div>
        </div>

        {/* Row 2: Name + meta + action buttons */}
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          {/* Left: name, headline, location tags, badges */}
          <div className="min-w-0">
            {/* Display name — editable for owner, static otherwise */}
            {canEdit ? (
              <EditField
                label="Display Name"
                value={candidate.displayName || candidate.fullName || ""}
                placeholder="How you want your name to appear publicly"
                onSave={(v) => {
                  const trimmed = v.trim().slice(0, 80);
                  if (trimmed) save("displayName", trimmed);
                }}
                canEdit={canEdit}
                nameMode
              />
            ) : (
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white md:text-3xl">
                {displayName}
              </h1>
            )}
            {/* Show registered name as a subtle note when a custom display name differs */}
            {canEdit && candidate.displayName?.trim() && candidate.fullName?.trim() &&
              candidate.displayName.trim() !== candidate.fullName.trim() && (
              <p className="mt-0.5 text-xs text-slate-400">
                Registered: {candidate.fullName}
              </p>
            )}
            <div className="mt-1 min-h-[1.5rem]">
              <EditField
                label="Headline"
                value={candidate.headline ?? ""}
                placeholder="e.g. Senior Virtual Assistant | Remote-ready"
                onSave={(v) => save("headline", v)}
                canEdit={canEdit}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
              {candidate.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {candidate.location}
                </span>
              )}
              {candidate.availability && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> {candidate.availability}
                </span>
              )}
              {pref(prefs, "workSetup") && (
                <span className="flex items-center gap-1">
                  <Globe2 className="h-3.5 w-3.5" /> {pref(prefs, "workSetup")}
                </span>
              )}
            </div>
            {/* Badges */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {candidate.seniority && (
                <Badge className="rounded-full border-[#474ead]/20 bg-[#474ead]/10 text-[#474ead]">
                  {candidate.seniority}
                </Badge>
              )}
              {candidate.cultureScore != null && (
                <Badge className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/30 dark:bg-emerald-900/20 dark:text-emerald-400">
                  {candidate.cultureScore}% values fit
                </Badge>
              )}
            </div>
          </div>

          {/* Right: action buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
              {isClientViewer && (
                <Button
                  onClick={() => navigate("/talent-pool")}
                  variant="outline"
                  className="rounded-full text-sm"
                >
                  <ChevronRight className="mr-1 h-4 w-4 rotate-180" /> Back to Pool
                </Button>
              )}
              {candidate.resumeUrl && (
                <Button
                  variant="outline"
                  className="rounded-full text-sm"
                  onClick={() => window.open(`/api/candidates/${id}/resume-download`, "_blank")}
                >
                  <FileText className="mr-1.5 h-4 w-4" /> View Resume
                </Button>
              )}
              {isClientViewer && candidate.email && (
                <Button className="rounded-full bg-[#474ead] text-sm text-white" asChild>
                  <a href={`mailto:${candidate.email}`}>
                    <Mail className="mr-1.5 h-4 w-4" /> Contact
                  </a>
                </Button>
              )}

              {/* Public View + Copy Link — profile owner only, not while already in preview */}
              {isOwner && !isPublicPreview && (
                <>
                  <Button
                    variant="outline"
                    className="rounded-full text-sm"
                    aria-label="Preview public profile"
                    onClick={() => navigate(`/talent-profile/${id}?view=public`)}
                  >
                    <Eye className="mr-1.5 h-4 w-4" /> Public View
                  </Button>
                  <Button
                    variant="ghost"
                    className="rounded-full text-sm text-slate-500 hover:text-slate-700"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/talent-profile/${id}`);
                      toast({ title: "Profile link copied" });
                    }}
                  >
                    Copy Link
                  </Button>
                </>
              )}
              {/* Return to Edit View banner button (also shown inline in action area) */}
              {isPublicPreview && (
                <Button
                  variant="outline"
                  className="rounded-full text-sm border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300"
                  aria-label="Return to profile editing"
                  onClick={() => navigate(`/talent-profile/${id}`)}
                >
                  <EyeOff className="mr-1.5 h-4 w-4" /> Edit View
                </Button>
              )}

            </div>
          </div>
      </div>

      {/* ── Section Tabs ── */}
      <SectionTabs visibleIds={visibleSectionIds} navbarVisible={isNavbarVisible} />

      {/* ── Public View preview banner ── */}
      {isPublicPreview && (
        <div className="mx-auto mt-3 max-w-4xl px-4 md:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 dark:border-indigo-900/40 dark:bg-indigo-950/20">
            <div className="flex items-center gap-2.5 text-sm text-indigo-700 dark:text-indigo-300">
              <Eye className="h-4 w-4 shrink-0" />
              <span>You are viewing your profile as visitors see it.</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-8 shrink-0 rounded-full border-indigo-300 text-xs text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
              aria-label="Return to profile editing"
              onClick={() => navigate(`/talent-profile/${id}`)}
            >
              Return to Edit View
            </Button>
          </div>
        </div>
      )}

      {/* ── Complete Profile CTA (owner only, shown when profile is incomplete) ── */}
      {showPrivateOwnerSections && completionPct < 100 && (
        <div className="mx-auto mt-4 max-w-4xl px-4 md:px-8">
          <div
            className="relative overflow-hidden rounded-2xl p-5 sm:p-6"
            style={{
              background: "linear-gradient(135deg, #474ead 0%, #6366f1 60%, #818cf8 100%)",
            }}
          >
            {/* Decorative background circle */}
            <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10" />
            <div className="pointer-events-none absolute -bottom-6 right-16 h-24 w-24 rounded-full bg-white/5" />

            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="mb-1.5 flex items-center gap-2">
                  {/* Mini progress pill */}
                  <span className="inline-flex items-center rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white backdrop-blur-sm">
                    {completionPct}% complete
                  </span>
                </div>
                <p className="text-lg font-bold text-white sm:text-xl">
                  Complete Your Profile
                </p>
                <p className="mt-1 text-sm text-indigo-100">
                  A complete profile improves your job matches and makes you stand out to clients.
                </p>
              </div>

              <Button
                size="lg"
                className="shrink-0 rounded-full bg-white px-6 font-semibold text-[#474ead] shadow-lg hover:bg-indigo-50 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#474ead]"
                onClick={() => navigate("/settings")}
              >
                Finish Setting Up →
              </Button>
            </div>

            {/* Progress bar */}
            <div className="relative mt-4 h-1.5 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-white transition-all duration-700"
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Body content ── */}
      <div className="mx-auto mt-6 max-w-4xl px-4 pb-20 md:px-8">
        <div className="grid gap-4 md:grid-cols-[1fr_280px]">
          {/* Left column — main sections */}
          <div className="space-y-4">

            {/* About */}
            <Section id="section-about" title="About" icon={User}>
              <EditField
                label="Summary"
                value={candidate.summary ?? ""}
                multiline
                minHeight="120px"
                placeholder="Write a short professional summary…"
                onSave={(v) => save("summary", v)}
                canEdit={canEdit}
              />
            </Section>

            {/* More About Me — hidden for public visitors when empty */}
            {(canEdit || candidate.moreAboutMe?.trim()) && (
              <Section id="section-more-about" title="More About Me" icon={BookOpen}>
                <EditField
                  label="More About Me"
                  value={candidate.moreAboutMe ?? ""}
                  multiline
                  minHeight="180px"
                  placeholder="Share more about yourself, your working style, goals, interests, or what you'd like potential employers to know…"
                  onSave={(v) => save("moreAboutMe", v)}
                  canEdit={canEdit}
                />
              </Section>
            )}

            {/* Skills */}
            <Section
              id="section-skills"
              title="Skills"
              icon={Star}
              action={canEdit ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 rounded-full text-xs"
                  onClick={() => setShowSkillsModal(true)}
                >
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                </Button>
              ) : undefined}
            >
              {allSkills.length === 0 ? (
                <div className="flex flex-col items-start gap-3">
                  <p className="text-sm text-slate-400">No skills added yet.</p>
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full text-xs"
                      onClick={() => setShowSkillsModal(true)}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" /> Add Skills
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {(candidate.coreSkills?.length ?? 0) > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Core Skills</p>
                      <div className="flex flex-wrap gap-2">
                        {candidate.coreSkills!.map((sk) => (
                          <span key={sk} className="rounded-full bg-[#474ead]/10 px-3 py-1 text-sm font-medium text-[#474ead]">
                            {sk}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {(candidate.secondarySkills?.length ?? 0) > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Secondary Skills</p>
                      <div className="flex flex-wrap gap-2">
                        {candidate.secondarySkills!.map((sk) => (
                          <span key={sk} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700 dark:bg-white/[0.06] dark:text-slate-300">
                            {sk}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Section>

            {/* Experience */}
            <Section
              id="section-experience"
              title="Experience"
              icon={Briefcase}
              action={canEdit ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 rounded-full text-xs"
                  onClick={() => {
                    const newEntry: WorkEntry = { title: "New Role", company: "Company", duration: "Present" };
                    save("workHistory", [...workHistory, newEntry]);
                  }}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add
                </Button>
              ) : undefined}
            >
              {workHistory.length === 0 ? (
                <p className="text-sm text-slate-400">No work history added yet.</p>
              ) : (
                <div className="space-y-5">
                  {workHistory.map((job, idx) => (
                    <WorkEntryCard
                      key={idx}
                      entry={job}
                      canEdit={canEdit}
                      onSave={(updated) => {
                        const next = [...workHistory];
                        next[idx] = updated;
                        save("workHistory", next);
                      }}
                      onDelete={() => {
                        const next = workHistory.filter((_, i) => i !== idx);
                        save("workHistory", next);
                      }}
                    />
                  ))}
                </div>
              )}
            </Section>

            {/* Education */}
            <Section
              id="section-education"
              title="Education"
              icon={BookOpen}
              action={canEdit ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 rounded-full text-xs"
                  onClick={() => {
                    const newEntry: EduEntry = { school: "University", degree: "Degree" };
                    save("education", [...education, newEntry]);
                  }}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add
                </Button>
              ) : undefined}
            >
              {education.length === 0 ? (
                <p className="text-sm text-slate-400">No education added yet.</p>
              ) : (
                <div className="space-y-4">
                  {education.map((edu, idx) => (
                    <EduEntryCard
                      key={idx}
                      entry={edu}
                      canEdit={canEdit}
                      onSave={(updated) => {
                        const next = [...education];
                        next[idx] = updated;
                        save("education", next);
                      }}
                      onDelete={() => {
                        const next = education.filter((_, i) => i !== idx);
                        save("education", next);
                      }}
                    />
                  ))}
                </div>
              )}
            </Section>

            {/* Certifications */}
            <Section
              id="section-certifications"
              title="Certifications"
              icon={Award}
              action={canEdit ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 rounded-full text-xs"
                  onClick={() => {
                    const newEntry: CertEntry = { name: "Certification Name" };
                    save("certifications", [...certifications, newEntry]);
                  }}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add
                </Button>
              ) : undefined}
            >
              {certifications.length === 0 ? (
                <p className="text-sm text-slate-400">No certifications added yet.</p>
              ) : (
                <div className="space-y-3">
                  {certifications.map((cert, idx) => (
                    <CertCard
                      key={idx}
                      entry={cert}
                      canEdit={canEdit}
                      onSave={(updated) => {
                        const next = [...certifications];
                        next[idx] = updated;
                        save("certifications", next);
                      }}
                      onDelete={() => {
                        const next = certifications.filter((_, i) => i !== idx);
                        save("certifications", next);
                      }}
                    />
                  ))}
                </div>
              )}
            </Section>

            {/* Culture alignment */}
            {culture && (
              <Section title="Values Alignment" icon={Star}>
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    {culture.overallScore}%
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {culture.alignmentLevel || "Values Aligned"}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-500">{culture.summary}</p>
                    {(culture.traits ?? []).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {culture.traits.map((t: string) => (
                          <span key={t} className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Section>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">

            {/* Profile completion */}
            <Card className="rounded-2xl border-slate-200/70 bg-white dark:border-white/10 dark:bg-white/[0.03]">
              <CardContent className="p-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Profile Strength</p>
                <div className="mb-3 flex items-center gap-3">
                  <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{ backgroundColor: completionPct >= 80 ? "#22c55e" : completionPct >= 50 ? "#f59e0b" : "#ef4444" }}
                      initial={{ width: 0 }}
                      animate={{ width: `${completionPct}%` }}
                      transition={{ duration: 0.6 }}
                    />
                  </div>
                  <span className="shrink-0 text-sm font-bold" style={{ color: completionPct >= 80 ? "#22c55e" : completionPct >= 50 ? "#f59e0b" : "#ef4444" }}>
                    {completionPct}%
                  </span>
                </div>
                <div className="space-y-1.5">
                  {completion.map((item) => (
                    <div key={item.label} className="flex items-center gap-2 text-xs">
                      <div className={`h-4 w-4 shrink-0 rounded-full flex items-center justify-center ${item.done ? "bg-emerald-500/10 text-emerald-600" : "bg-slate-100 text-slate-400 dark:bg-white/10"}`}>
                        {item.done ? <Check className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                      </div>
                      <span className={item.done ? "text-slate-700 dark:text-slate-300" : "text-slate-400"}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Preferences */}
            <Section id="section-preferences" title="Preferences" icon={Globe2}>
              <PreferencesDisplay
                prefs={prefs}
                availability={candidate.availability ?? null}
                canEdit={canEdit}
                onSave={(field, val) => {
                  if (field === "availability") {
                    save("availability", val);
                  } else {
                    save("preferences", { ...prefs, [field]: val });
                  }
                }}
              />
            </Section>

            {/* Portfolio & Links */}
            <Section id="section-portfolio" title="Portfolio & Links" icon={Link2}>
              <div className="space-y-2">
                <LinkField
                  icon={Linkedin}
                  label="LinkedIn"
                  value={candidate.linkedinUrl ?? ""}
                  onSave={(v) => save("linkedinUrl", v)}
                  placeholder="https://linkedin.com/in/…"
                  canEdit={canEdit}
                />
                <LinkField
                  icon={Github}
                  label="GitHub"
                  value={candidate.githubUrl ?? ""}
                  onSave={(v) => save("githubUrl", v)}
                  placeholder="https://github.com/…"
                  canEdit={canEdit}
                />
                <LinkField
                  icon={Globe2}
                  label="Portfolio"
                  value={candidate.portfolioUrl ?? ""}
                  onSave={(v) => save("portfolioUrl", v)}
                  placeholder="https://portfolio.com"
                  canEdit={canEdit}
                />
                <LinkField
                  icon={Link2}
                  label="Website"
                  value={candidate.websiteUrl ?? ""}
                  onSave={(v) => save("websiteUrl", v)}
                  placeholder="https://website.com"
                  canEdit={canEdit}
                />
              </div>
            </Section>

            {/* Resume */}
            <Section id="section-resume" title="Resume" icon={FileText}>
              <ResumeSection candidateId={candidate.id} candidate={candidate} canEdit={canEdit} talentToken={talentAuth?.token} />
            </Section>

            {/* Applications — private, only visible to authenticated owner (hidden in public preview) */}
            {showPrivateOwnerSections && <ApplicationsSection candidateId={candidate.id} talentToken={talentAuth?.token} />}

            {/* Contact (role-gated) */}
            {canSeeContact && (
              <Section id="section-contact" title="Contact" icon={Shield}>
                <div className="space-y-2 text-sm">
                  {candidate.email && (
                    <a href={`mailto:${candidate.email}`} className="flex items-center gap-2 text-slate-700 hover:text-[#474ead] dark:text-slate-300">
                      <Mail className="h-4 w-4" /> {candidate.email}
                    </a>
                  )}
                  {candidate.phone && (
                    <a href={`tel:${candidate.phone}`} className="flex items-center gap-2 text-slate-700 hover:text-[#474ead] dark:text-slate-300">
                      <Phone className="h-4 w-4" /> {candidate.phone}
                    </a>
                  )}
                  {!candidate.email && !candidate.phone && (
                    <p className="text-slate-400">No contact info provided.</p>
                  )}
                </div>
              </Section>
            )}
          </div>
        </div>
      </div>

      {/* Discreet owner sign-in hint — only visible to completely unauthenticated visitors */}
      {!talentAuth && !isAdminUser && id && (
        <div className="mx-auto max-w-4xl px-4 pb-10 md:px-8">
          <p className="text-center text-xs text-slate-400">
            Own this profile?{" "}
            <button
              onClick={() => setShowLoginModal(true)}
              className="underline underline-offset-2 hover:text-slate-600 transition-colors"
            >
              Sign in to manage it
            </button>
          </p>
        </div>
      )}
    </div>
    </>
  );
}

// ─── Applications Section (profile owner only) ────────────────────────────────

function ApplicationsSection({ candidateId, talentToken }: { candidateId: string; talentToken?: string }) {
  const [, navigate] = useLocation();
  const { data: applications, isLoading } = useTalentApplications();

  const apps = (applications ?? []).slice(0, 5);

  return (
    <Section id="section-applications" title="Applications" icon={Briefcase}>
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : apps.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-slate-800/50">
          <p className="text-sm text-slate-500 dark:text-slate-400">No applications yet.</p>
          <p className="mt-1 text-xs text-slate-400">
            Explore open roles and find your next opportunity.
          </p>
          <button
            onClick={() => navigate("/find-work/jobs")}
            className="mt-3 text-xs font-medium text-[#474ead] hover:underline dark:text-indigo-400"
          >
            Browse Roles →
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {apps.map((app) => {
            const meta = getStatusMeta(app.applicationStatus);
            const dateStr = app.submittedAt
              ? new Date(app.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
              : null;
            return (
              <div
                key={app.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{app.job.title}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {app.job.companyName}
                    {dateStr && <span className="text-slate-400"> · Applied {dateStr}</span>}
                  </p>
                </div>
                <span
                  className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.bgClass} ${meta.textClass} ${meta.borderClass}`}
                >
                  {meta.talentLabel}
                </span>
              </div>
            );
          })}

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => navigate("/my-applications")}
              className="text-xs font-medium text-[#474ead] hover:underline dark:text-indigo-400"
            >
              View All Applications →
            </button>
            <button
              onClick={() => navigate("/find-work/jobs")}
              className="text-xs font-medium text-slate-500 hover:text-[#474ead] dark:text-slate-400 dark:hover:text-indigo-400"
            >
              Browse More Roles →
            </button>
          </div>
        </div>
      )}
    </Section>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function WorkEntryCard({
  entry,
  onSave,
  onDelete,
  canEdit = true,
}: {
  entry: WorkEntry;
  onSave: (e: WorkEntry) => void;
  onDelete: () => void;
  canEdit?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ ...entry });

  if (!editing) {
    return (
      <div className="group relative flex gap-4">
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#474ead]/10">
          <Briefcase className="h-4 w-4 text-[#474ead]" />
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">{entry.title}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">{entry.company}</p>
              <p className="mt-0.5 text-xs text-slate-400">{entry.duration}</p>
              {entry.setup && <p className="text-xs text-slate-400">{entry.setup}</p>}
            </div>
            {canEdit && (
              <div className="invisible flex gap-1 group-hover:visible">
                <button onClick={() => setEditing(true)} className="rounded p-1 text-slate-400 hover:text-[#474ead]">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={onDelete} className="rounded p-1 text-slate-400 hover:text-red-500">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
          {entry.responsibilities && (
            <p className="mt-1.5 text-sm text-slate-500">{entry.responsibilities}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="space-y-3">
        <Input placeholder="Job title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="h-9 text-sm" />
        <Input placeholder="Company" value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} className="h-9 text-sm" />
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Duration (e.g. 2021–2023)" value={draft.duration} onChange={(e) => setDraft({ ...draft, duration: e.target.value })} className="h-9 text-sm" />
          <Input placeholder="Work setup" value={draft.setup ?? ""} onChange={(e) => setDraft({ ...draft, setup: e.target.value })} className="h-9 text-sm" />
        </div>
        <Textarea
          placeholder="Responsibilities / achievements…"
          value={draft.responsibilities ?? ""}
          onChange={(e) => setDraft({ ...draft, responsibilities: e.target.value })}
          className="min-h-[80px] text-sm"
        />
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={() => { onSave(draft); setEditing(false); }} className="h-8 rounded-full bg-[#474ead] text-white text-xs">
          <Check className="mr-1 h-3 w-3" /> Save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setDraft({ ...entry }); setEditing(false); }} className="h-8 rounded-full text-xs">
          Cancel
        </Button>
      </div>
    </div>
  );
}

function EduEntryCard({ entry, onSave, onDelete, canEdit = true }: { entry: EduEntry; onSave: (e: EduEntry) => void; onDelete: () => void; canEdit?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ ...entry });

  if (!editing) {
    return (
      <div className="group flex items-start gap-4">
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#474ead]/10">
          <BookOpen className="h-4 w-4 text-[#474ead]" />
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">{entry.degree}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">{entry.school}</p>
              {(entry.yearStart || entry.yearEnd) && (
                <p className="mt-0.5 text-xs text-slate-400">
                  {entry.yearStart ?? ""}{entry.yearStart && entry.yearEnd ? "–" : ""}{entry.yearEnd ?? ""}
                </p>
              )}
            </div>
            {canEdit && (
              <div className="invisible flex gap-1 group-hover:visible">
                <button onClick={() => setEditing(true)} className="rounded p-1 text-slate-400 hover:text-[#474ead]">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={onDelete} className="rounded p-1 text-slate-400 hover:text-red-500">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="space-y-2">
        <Input placeholder="School / University" value={draft.school} onChange={(e) => setDraft({ ...draft, school: e.target.value })} className="h-9 text-sm" />
        <Input placeholder="Degree / Course" value={draft.degree} onChange={(e) => setDraft({ ...draft, degree: e.target.value })} className="h-9 text-sm" />
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Year start" value={draft.yearStart ?? ""} onChange={(e) => setDraft({ ...draft, yearStart: e.target.value })} className="h-9 text-sm" />
          <Input placeholder="Year end" value={draft.yearEnd ?? ""} onChange={(e) => setDraft({ ...draft, yearEnd: e.target.value })} className="h-9 text-sm" />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={() => { onSave(draft); setEditing(false); }} className="h-8 rounded-full bg-[#474ead] text-white text-xs">
          <Check className="mr-1 h-3 w-3" /> Save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setDraft({ ...entry }); setEditing(false); }} className="h-8 rounded-full text-xs">
          Cancel
        </Button>
      </div>
    </div>
  );
}

function CertCard({ entry, onSave, onDelete, canEdit = true }: { entry: CertEntry; onSave: (e: CertEntry) => void; onDelete: () => void; canEdit?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ ...entry });

  if (!editing) {
    return (
      <div className="group flex items-start gap-4">
        <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
          <Award className="h-3.5 w-3.5 text-amber-600" />
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{entry.name}</p>
              {entry.issuer && <p className="text-xs text-slate-500">{entry.issuer}</p>}
              {entry.date && <p className="text-xs text-slate-400">{entry.date}</p>}
              {entry.link && (
                <a href={entry.link} target="_blank" rel="noopener noreferrer" className="mt-0.5 flex items-center gap-1 text-xs text-[#474ead] hover:underline">
                  <ExternalLink className="h-3 w-3" /> View certificate
                </a>
              )}
            </div>
            {canEdit && (
              <div className="invisible flex gap-1 group-hover:visible">
                <button onClick={() => setEditing(true)} className="rounded p-1 text-slate-400 hover:text-[#474ead]">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={onDelete} className="rounded p-1 text-slate-400 hover:text-red-500">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="space-y-2">
        <Input placeholder="Certificate name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="h-9 text-sm" />
        <Input placeholder="Issuing organization" value={draft.issuer ?? ""} onChange={(e) => setDraft({ ...draft, issuer: e.target.value })} className="h-9 text-sm" />
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Date issued" value={draft.date ?? ""} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className="h-9 text-sm" />
          <Input placeholder="Certificate link" value={draft.link ?? ""} onChange={(e) => setDraft({ ...draft, link: e.target.value })} className="h-9 text-sm" />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={() => { onSave(draft); setEditing(false); }} className="h-8 rounded-full bg-[#474ead] text-white text-xs">
          <Check className="mr-1 h-3 w-3" /> Save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setDraft({ ...entry }); setEditing(false); }} className="h-8 rounded-full text-xs">
          Cancel
        </Button>
      </div>
    </div>
  );
}

function LinkField({
  icon: Icon,
  label,
  value,
  onSave,
  placeholder,
  canEdit = true,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  onSave: (v: string) => void;
  placeholder: string;
  canEdit?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <div className="group flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-slate-400" />
        {value ? (
          <a href={value} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-sm text-[#474ead] hover:underline">
            {label}
          </a>
        ) : (
          <span className="flex-1 text-sm text-slate-400">{canEdit ? `Add ${label}` : `—`}</span>
        )}
        {canEdit && (
          <button
            onClick={() => setEditing(true)}
            className="invisible shrink-0 rounded p-1 text-slate-400 hover:text-[#474ead] group-hover:visible"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        className="h-9 text-sm"
        autoFocus
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => { onSave(draft); setEditing(false); }} className="h-7 rounded-full bg-[#474ead] text-white text-xs">
          <Check className="mr-1 h-3 w-3" /> Save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setDraft(value); setEditing(false); }} className="h-7 rounded-full text-xs">
          Cancel
        </Button>
      </div>
    </div>
  );
}

function PreferencesDisplay({
  prefs,
  availability,
  onSave,
  canEdit = true,
}: {
  prefs: Record<string, string> | null;
  availability: string | null;
  onSave: (field: string, val: string) => void;
  canEdit?: boolean;
}) {
  const fields: Array<{ key: string; label: string; placeholder: string }> = [
    { key: "workSetup", label: "Work Setup", placeholder: "Remote / Hybrid / Onsite" },
    { key: "shift", label: "Shift", placeholder: "Day / Night / Flexible" },
    { key: "jobType", label: "Job Type", placeholder: "Full-time / Part-time / Contract" },
    { key: "environment", label: "Environment", placeholder: "e.g. Quiet office, Remote team" },
  ];
  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1 text-xs text-slate-400">Availability</p>
        <EditField
          label="Availability"
          value={availability ?? ""}
          placeholder="e.g. Immediately available, 2 weeks notice"
          onSave={(v) => onSave("availability", v)}
          canEdit={canEdit}
        />
      </div>
      {fields.map(({ key, label, placeholder }) => (
        <div key={key}>
          <p className="mb-1 text-xs text-slate-400">{label}</p>
          <EditField
            label={label}
            value={prefs?.[key] ?? ""}
            placeholder={placeholder}
            onSave={(v) => onSave(key, v)}
            canEdit={canEdit}
          />
        </div>
      ))}
    </div>
  );
}

function ResumeSection({
  candidateId,
  candidate,
  canEdit = true,
  talentToken,
}: {
  candidateId: string;
  candidate: Candidate;
  canEdit?: boolean;
  talentToken?: string;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    const allowed = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowed.includes(file.type)) {
      toast({ title: "Invalid file", description: "Only PDF or Word documents allowed.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 10 MB for resumes.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("resume", file);
      const headers: HeadersInit = {};
      if (talentToken) headers["Authorization"] = `Bearer ${talentToken}`;
      const res = await fetch(`/api/candidates/${candidateId}/resume`, { method: "POST", headers, body: form });
      if (!res.ok) throw new Error(await res.text());
      qc.invalidateQueries({ queryKey: ["/api/candidates", candidateId] });
      toast({ title: "Resume uploaded", description: "Your resume has been saved." });
    } catch {
      toast({ title: "Upload failed", description: "Could not upload resume. Try again.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      {canEdit && (
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.doc,.docx"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      )}
      {candidate.resumeUrl ? (
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-white/[0.04]">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#474ead]/10">
            <FileText className="h-4 w-4 text-[#474ead]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
              {candidate.resumeFileName ?? "Resume"}
            </p>
            <p className="text-xs text-slate-400">Uploaded</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-400">No resume uploaded yet.</p>
      )}
      {canEdit && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full rounded-full text-xs"
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          {uploading ? "Uploading…" : candidate.resumeUrl ? "Replace Resume" : "Upload Resume"}
        </Button>
      )}
    </div>
  );
}
