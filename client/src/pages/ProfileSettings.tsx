import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  User,
  Upload,
  FileText,
  Brain,
  MapPin,
  DollarSign,
  Globe,
  Clock,
  Save,
  Plus,
  X,
  Eye,
  Settings2,
  ArrowLeft,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ObjectUploader } from "@/components/ObjectUploader";
import { TimezoneSelect } from "@/components/TimezoneSelect";
import {
  useCandidateProfileSettings,
  candidateSettingsSchema,
  CandidateSettingsFormData,
  candidatePhotoSrc,
} from "@/hooks/useCandidateProfileSettings";
import { CheckCircle2 } from "lucide-react";
import { validatePhone, validatePhoneTimezoneMatch, countryFromTimezone } from "@/lib/phoneValidation";
import { PhoneNumberInput } from "@/components/PhoneNumberInput";
import { authAPI } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const I      = "#4B51B8";
const V      = "#6E4DF5";
const NAVY   = "#171B4D";
const GOLD   = "#FFA91F";
const BG     = "#FAFAFD";
const TEXT   = "#18181F";
const MUTED  = "#6F7280";
const BORDER = "rgba(75,81,184,0.14)";
const ACTIVE_BG = "linear-gradient(135deg,#4B55D0,#7248F4)";
const SAVE_BG   = "linear-gradient(135deg,#4B55D0,#7049F4)";
const PROG_BG   = "linear-gradient(90deg,#4B55D0,#7248F4)";

const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 18,
  border: `1.5px solid ${BORDER}`,
  boxShadow: "0 2px 16px rgba(71,77,184,0.07)",
};

const inputStyle: React.CSSProperties = {
  height: 46,
  border: `1.5px solid ${BORDER}`,
  borderRadius: 10,
  background: "#fff",
  fontSize: 15,
};

const focusCls =
  "focus:border-[#525BC8] focus:ring-2 focus:ring-[rgba(82,91,200,0.12)] " +
  "focus:ring-offset-0 focus-visible:ring-2 focus-visible:ring-[rgba(82,91,200,0.12)] " +
  "focus-visible:ring-offset-0 focus-visible:border-[#525BC8]";

const labelCls = "text-[14px] font-semibold text-[#18181F] mb-1.5 flex items-center gap-2";

// ─── Sub-components (outside main component to avoid identity churn) ──────────

function StyledInput(props: React.ComponentProps<typeof Input>) {
  return (
    <Input
      {...props}
      className={cn(focusCls, props.className)}
      style={{ ...inputStyle, ...props.style }}
    />
  );
}

function StyledTextarea(props: React.ComponentProps<typeof Textarea>) {
  return (
    <Textarea
      {...props}
      className={cn(focusCls, props.className)}
      style={{
        border: `1.5px solid ${BORDER}`,
        borderRadius: 10,
        background: "#fff",
        fontSize: 15,
        ...props.style,
      }}
    />
  );
}

function StyledSelectTrigger(props: React.ComponentProps<typeof SelectTrigger>) {
  return (
    <SelectTrigger
      {...props}
      className={cn(focusCls, props.className)}
      style={{ ...inputStyle, paddingInline: 14, ...props.style }}
    />
  );
}

function SectionCard({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div style={cardStyle} className="p-7 md:p-8">
      <div className="flex items-center gap-3 mb-1">
        <div
          style={{
            width: 38, height: 38, borderRadius: 10,
            background: "#EEEDFB", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Icon style={{ width: 18, height: 18, color: I }} />
        </div>
        <div>
          <h2 className="font-bold text-[18px] leading-tight" style={{ color: TEXT }}>
            {title}
          </h2>
          <p className="text-[13px] mt-0.5" style={{ color: MUTED }}>
            {subtitle}
          </p>
        </div>
      </div>
      <div className="my-5" style={{ borderTop: `1px solid ${BORDER}` }} />
      {children}
    </div>
  );
}

interface NavItemProps {
  id: string;
  title: string;
  icon: React.ElementType;
  active: boolean;
  onClick: () => void;
}
function NavItem({ id, title, icon: Icon, active, onClick }: NavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`button-section-${id}`}
      className="w-full flex items-center gap-3 text-left transition-all duration-150"
      style={{
        height: 48, borderRadius: 10, paddingInline: 12,
        background: active ? ACTIVE_BG : "transparent",
        color: active ? "#fff" : TEXT,
        fontWeight: active ? 600 : 500, fontSize: 14,
        boxShadow: active ? "0 4px 14px rgba(75,85,208,0.22)" : "none",
        border: "none", cursor: "pointer",
      }}
      onMouseEnter={(e) => { if (!active) (e.currentTarget).style.background = "#EEEDFB"; }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget).style.background = "transparent"; }}
    >
      <Icon style={{ width: 18, height: 18, opacity: active ? 1 : 0.55, flexShrink: 0 }} />
      {title}
    </button>
  );
}

// ─── Document row ──────────────────────────────────────────────────────────────
function DocRow({ doc, onRemove }: { doc: any; onRemove: (id: string) => void }) {
  const sizeMb = doc.fileSize ? (doc.fileSize / 1024 / 1024).toFixed(1) : null;
  const sizeKb = doc.fileSize ? Math.round(doc.fileSize / 1024) : null;
  const sizeLabel = sizeMb && parseFloat(sizeMb) >= 1 ? `${sizeMb} MB` : sizeKb ? `${sizeKb} KB` : "Unknown size";

  return (
    <div
      className="flex items-center justify-between p-4 rounded-xl"
      style={{ border: `1.5px solid ${BORDER}`, background: BG }}
    >
      <div className="flex items-center gap-3">
        <div style={{ width: 36, height: 36, borderRadius: 8, background: "#EEEDFB", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <FileText style={{ width: 16, height: 16, color: I }} />
        </div>
        <div>
          <p className="font-medium text-[14px]" style={{ color: TEXT }}>{doc.fileName}</p>
          <p className="text-[12px]" style={{ color: MUTED }}>{sizeLabel}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <a
          href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center justify-center h-8 w-8 rounded-lg transition-colors"
          style={{ border: `1.5px solid ${BORDER}`, background: "#fff", color: MUTED }}
        >
          <Eye style={{ width: 14, height: 14 }} />
        </a>
        <button
          type="button" onClick={() => onRemove(doc.id)}
          className="inline-flex items-center justify-center h-8 w-8 rounded-lg"
          style={{ border: "1.5px solid #FCA5A5", background: "#FFF5F5", color: "#DC2626", cursor: "pointer" }}
        >
          <X style={{ width: 14, height: 14 }} />
        </button>
      </div>
    </div>
  );
}

// ─── Sections ──────────────────────────────────────────────────────────────────
const sections = [
  { id: "basic",        title: "Basic Information",    icon: User     },
  { id: "professional", title: "Professional Details",  icon: Brain    },
  { id: "skills",       title: "Skills & Expertise",   icon: FileText },
  { id: "documents",    title: "Documents",             icon: Upload   },
];

// ─── Main component ────────────────────────────────────────────────────────────
export default function ProfileSettings() {
  const { toast } = useToast();

  const {
    talentAuth,
    candidateId,
    candidate,
    isLoading,
    isSaving,
    profileCompletion,
    completionItems,
    documents,
    invalidateDocuments,
    getDefaultFormValues,
    saveSettings,
    uploadPhoto,
    removePhoto,
    availableSkills,
  } = useCandidateProfileSettings();

  const [activeSection, setActiveSection]   = useState("basic");
  const [photoUploading, setPhotoUploading] = useState(false);
  // localPhotoUrl: set immediately after upload for instant avatar update.
  // Reset to undefined when the candidate query refetches with the persisted URL.
  const [localPhotoUrl, setLocalPhotoUrl]   = useState<string | undefined>(undefined);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // `documents` is now managed by the hook (useQuery) so completion recalculates
  // automatically after upload/remove without a separate local state + useEffect.

  const form = useForm<CandidateSettingsFormData>({
    resolver: zodResolver(candidateSettingsSchema),
    defaultValues: getDefaultFormValues(),
  });

  // Reset form when candidate data loads from server.
  useEffect(() => {
    if (candidate !== undefined && candidate !== null) {
      form.reset(getDefaultFormValues());
      // Clear localPhotoUrl — the persisted URL is now in candidate.profilePhotoUrl
      setLocalPhotoUrl(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate]);

  // ── Derived photo state ────────────────────────────────────────────────────
  // localPhotoUrl is set right after upload so the avatar updates immediately;
  // after the candidate query refetches, we use the persisted candidate URL.
  const persistedPhotoUrl = candidate?.profilePhotoUrl as string | null | undefined;
  const displayPhotoSrc   = candidatePhotoSrc(localPhotoUrl ?? persistedPhotoUrl ?? null);
  const hasPhoto          = !!(localPhotoUrl || persistedPhotoUrl);

  // ── Photo upload ────────────────────────────────────────────────────────────
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Unsupported file type", description: "Please upload a JPEG, PNG, or WebP image.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum photo size is 5 MB.", variant: "destructive" });
      return;
    }

    if (!talentAuth?.token) {
      toast({ title: "Not logged in", description: "Please log in to your Talent account to upload a photo.", variant: "destructive" });
      return;
    }

    setPhotoUploading(true);
    try {
      // POST /api/candidates/:id/photo — authenticateTalentJWT + multer
      const storedPath = await uploadPhoto(file);
      // Show avatar immediately using the returned path (before query refetch)
      setLocalPhotoUrl(storedPath);
      toast({ title: "Photo updated", description: "Your profile photo has been saved." });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err?.message || "Could not upload photo.", variant: "destructive" });
    } finally {
      setPhotoUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = async () => {
    if (!talentAuth?.token) return;
    setPhotoUploading(true);
    try {
      await removePhoto();
      setLocalPhotoUrl(undefined);
      toast({ title: "Photo removed", description: "Your profile photo has been removed." });
    } catch {
      toast({ title: "Removal failed", description: "Could not remove photo. Please try again.", variant: "destructive" });
    } finally {
      setPhotoUploading(false);
    }
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const onSubmit = async (data: CandidateSettingsFormData) => {
    if (!talentAuth?.token) {
      toast({ title: "Not logged in", description: "Please log in to your Talent account.", variant: "destructive" });
      return;
    }

    // Phone validation (only when a value is provided)
    if (data.phoneNumber?.trim()) {
      const country = countryFromTimezone(data.timezone);
      const phoneResult = validatePhone(data.phoneNumber.trim(), country);
      if (!phoneResult.valid) {
        toast({ title: "Invalid phone number", description: phoneResult.error ?? "Please check your phone number.", variant: "destructive" });
        return;
      }
      // Timezone ↔ phone country consistency check
      if (data.timezone) {
        const tzCheck = validatePhoneTimezoneMatch(data.phoneNumber.trim(), data.timezone);
        if (!tzCheck.ok) {
          toast({ title: "Phone / timezone mismatch", description: tzCheck.message ?? "", variant: "destructive", duration: 8000 });
          return;
        }
      }
    }

    try {
      // PATCH /api/candidates/:id — single request, includes all fields + coreSkills
      await saveSettings(data);
      toast({ title: "Settings saved successfully.", description: "Your profile has been updated.", duration: 3000 });
    } catch (error: any) {
      toast({
        title: "Unable to save settings",
        description: error?.message || "Something went wrong. Please try again.",
        variant: "destructive", duration: 6000,
      });
    }
  };

  const onInvalid = (errors: any) => {
    const firstError = Object.values(errors)[0] as any;
    toast({
      title: "Please check your information",
      description: firstError?.message || "Some fields need attention before saving.",
      variant: "destructive",
    });
  };

  // ── Document handlers (via authAPI — works with talent token fallback) ─────
  const removeDocument = async (documentId: string) => {
    try {
      await authAPI.delete(`/api/documents/${documentId}`);
      // Invalidate hook's document query → completion recalculates automatically.
      invalidateDocuments();
      toast({ title: "Document removed." });
    } catch {
      toast({ title: "Removal failed", description: "Please try again.", variant: "destructive" });
    }
  };

  const handleUploadComplete = async (result: any, type: string) => {
    if (result.successful && result.successful.length > 0) {
      const file = result.successful[0];
      try {
        await authAPI.post("/api/documents", {
          type, fileName: file.name, fileUrl: file.uploadURL,
          fileSize: file.size || null, mimeType: file.type || null,
          isPublic: false, isPrimary: false,
        });
        // Invalidate hook's document query → completion recalculates automatically.
        invalidateDocuments();
        toast({ title: "Document uploaded", description: `Your ${type === "resume" ? "resume" : "video introduction"} was saved.` });
      } catch {
        toast({ title: "Upload error", description: "File uploaded but metadata failed to save.", variant: "destructive" });
      }
    }
  };

  // ── No talent session ─────────────────────────────────────────────────────
  if (!talentAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: BG }}>
        <div className="text-center max-w-sm">
          <User style={{ width: 48, height: 48, color: I, opacity: 0.3, margin: "0 auto 16px" }} />
          <h2 className="font-bold text-[20px] mb-2" style={{ color: TEXT }}>Talent login required</h2>
          <p className="text-[14px]" style={{ color: MUTED }}>
            Please sign in to your Talent account to access your profile settings.
          </p>
        </div>
      </div>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: BG }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: I }} />
          <p className="text-[15px]" style={{ color: MUTED }}>Loading your settings…</p>
        </div>
      </div>
    );
  }

  const resumeDocs = documents.filter((d) => d.type === "resume");
  const videoDocs  = documents.filter((d) => d.type === "video_intro");

  return (
    <div className="min-h-screen" style={{ background: BG, paddingBottom: 60 }}>
      <div style={{ maxWidth: 1240, marginInline: "auto", paddingInline: "clamp(16px,4vw,32px)", paddingTop: 48 }}>

        {/* ── Back button ── */}
        <div className="mb-5">
          <button
            onClick={() => {
              if (window.history.length > 1) window.history.back();
              else window.location.href = "/talent-profile";
            }}
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              height: 40, paddingInline: 14, borderRadius: 10,
              border: `1.5px solid rgba(75,81,184,0.18)`,
              background: "rgba(75,81,184,0.07)", color: "#4B51B8",
              fontSize: 14, fontWeight: 600, cursor: "pointer",
              transition: "background 150ms ease, border-color 150ms ease",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(75,81,184,0.13)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(75,81,184,0.30)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(75,81,184,0.07)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(75,81,184,0.18)";
            }}
          >
            <ArrowLeft style={{ width: 16, height: 16 }} />
            Back
          </button>
        </div>

        {/* ── Page header ── */}
        <div className="mb-10">
          <h1
            className="font-bold leading-tight tracking-tight"
            style={{ fontSize: "clamp(30px,3.5vw,42px)", color: TEXT }}
          >
            Profile Settings
          </h1>
          <p className="mt-2 max-w-2xl" style={{ fontSize: "clamp(15px,1.5vw,17px)", color: MUTED }}>
            Manage your profile information and preferences. Keep your information up to date to attract better opportunities.
          </p>
        </div>

        {/* ── Body: sidebar + content grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[270px_minmax(0,1fr)]" style={{ gap: 28 }}>

          {/* ── Sidebar ── */}
          <div className="flex flex-col gap-5">

            {/* Nav card */}
            <div style={cardStyle} className="p-[18px]">
              <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: MUTED }}>
                Settings
              </p>
              <div className="flex flex-col gap-1">
                {sections.map(({ id, title, icon }) => (
                  <NavItem
                    key={id} id={id} title={title} icon={icon}
                    active={activeSection === id}
                    onClick={() => setActiveSection(id)}
                  />
                ))}
              </div>
            </div>

            {/* Profile Status card */}
            <div style={cardStyle} className="p-[18px]">
              <div className="flex items-center gap-2 mb-4">
                <Settings2 style={{ width: 16, height: 16, color: I }} />
                <p className="font-semibold text-[14px]" style={{ color: TEXT }}>Profile Status</p>
              </div>

              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px]" style={{ color: MUTED }}>Completion</span>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold" style={{ color: TEXT }}>{profileCompletion}%</span>
                  {profileCompletion < 100 && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#FFF3DC", color: GOLD }}>
                      Keep going
                    </span>
                  )}
                </div>
              </div>

              <div style={{ height: 7, borderRadius: 99, background: "#EEEDFB", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${profileCompletion}%`, background: PROG_BG, borderRadius: 99, transition: "width 0.5s ease" }} />
              </div>

              {profileCompletion >= 100 ? (
                <p className="text-[12px] mt-3 flex items-center gap-1" style={{ color: "#22c55e" }}>
                  <CheckCircle2 style={{ width: 13, height: 13, flexShrink: 0 }} />
                  Your profile is complete and ready for opportunities.
                </p>
              ) : (() => {
                const missing = completionItems.find((i) => !i.done);
                return (
                  <p className="text-[12px] mt-3" style={{ color: MUTED }}>
                    {missing
                      ? `Add your ${missing.label.toLowerCase()} to strengthen your profile.`
                      : "Complete your profile to attract more clients."}
                  </p>
                );
              })()}
            </div>
          </div>

          {/* ── Main content ── */}
          <div>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="flex flex-col gap-6">

                {/* ─ Basic Information ─ */}
                {activeSection === "basic" && (
                  <SectionCard icon={User} title="Basic Information" subtitle="Update your personal information and contact details.">

                    {/* Profile Photo */}
                    <div className="mb-7">
                      <label className={labelCls}>
                        <Upload style={{ width: 15, height: 15, color: I }} />
                        Profile Photo
                      </label>
                      <div className="flex items-center gap-5 mt-2">
                        {/* Avatar preview */}
                        <div
                          style={{
                            width: 84, height: 84, borderRadius: "50%", flexShrink: 0,
                            overflow: "hidden", border: `2px solid ${BORDER}`,
                            background: "#EEEDFB",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                        >
                          {displayPhotoSrc ? (
                            <img
                              key={displayPhotoSrc}
                              src={displayPhotoSrc}
                              alt="Profile"
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                            />
                          ) : (
                            <User style={{ width: 34, height: 34, color: I, opacity: 0.4 }} />
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          {/* Hidden file input */}
                          <input
                            ref={photoInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            style={{ display: "none" }}
                            onChange={handlePhotoUpload}
                          />
                          <button
                            type="button"
                            onClick={() => photoInputRef.current?.click()}
                            disabled={photoUploading}
                            className="inline-flex items-center gap-2 font-semibold text-[14px] transition-colors"
                            style={{
                              height: 38, paddingInline: 16, borderRadius: 9,
                              border: `1.5px solid ${BORDER}`, background: "#fff",
                              color: photoUploading ? MUTED : TEXT,
                              cursor: photoUploading ? "not-allowed" : "pointer",
                            }}
                          >
                            {photoUploading ? (
                              <>
                                <div className="animate-spin rounded-full border-2 border-current border-t-transparent" style={{ width: 14, height: 14 }} />
                                Uploading…
                              </>
                            ) : (
                              <>
                                <Upload style={{ width: 14, height: 14, color: I }} />
                                {hasPhoto ? "Replace Photo" : "Upload Photo"}
                              </>
                            )}
                          </button>
                          {hasPhoto && (
                            <button
                              type="button"
                              onClick={handleRemovePhoto}
                              disabled={photoUploading}
                              className="inline-flex items-center gap-2 text-[13px]"
                              style={{
                                height: 34, paddingInline: 14, borderRadius: 9,
                                border: "1.5px solid #FCA5A5", background: "#FFF5F5",
                                color: "#DC2626", cursor: photoUploading ? "not-allowed" : "pointer",
                              }}
                            >
                              <X style={{ width: 13, height: 13 }} />
                              Remove Photo
                            </button>
                          )}
                          <p className="text-[12px]" style={{ color: MUTED }}>
                            JPG, PNG, or WebP · Max 5 MB
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mb-5" style={{ borderTop: `1px solid ${BORDER}` }} />

                    {/* Row 1: First + Last name */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                      <FormField control={form.control} name="firstName" render={({ field }) => (
                        <FormItem>
                          <FormLabel className={labelCls}>First Name *</FormLabel>
                          <FormControl><StyledInput placeholder="Enter your first name" {...field} data-testid="input-first-name" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="lastName" render={({ field }) => (
                        <FormItem>
                          <FormLabel className={labelCls}>Last Name</FormLabel>
                          <FormControl><StyledInput placeholder="Enter your last name" {...field} data-testid="input-last-name" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    {/* Row 2: Phone */}
                    <div className="mb-5">
                      <FormField control={form.control} name="phoneNumber" render={({ field }) => (
                        <FormItem>
                          <PhoneNumberInput
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            country={countryFromTimezone(form.watch("timezone"))}
                            timezone={form.watch("timezone")}
                            placeholder="+63 912 345 6789"
                            label="Phone Number"
                            id="settings-phone"
                          />
                        </FormItem>
                      )} />
                    </div>

                    {/* Row 3: Location + Timezone */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                      <FormField control={form.control} name="location" render={({ field }) => (
                        <FormItem>
                          <FormLabel className={labelCls}>
                            <MapPin style={{ width: 15, height: 15, color: I }} />
                            Location
                          </FormLabel>
                          <FormControl><StyledInput placeholder="City, Country" {...field} data-testid="input-location" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="timezone" render={({ field }) => (
                        <FormItem>
                          <FormLabel className={labelCls}>
                            <Clock style={{ width: 15, height: 15, color: I }} />
                            Timezone
                          </FormLabel>
                          <FormControl>
                            <TimezoneSelect
                              value={field.value}
                              onChange={field.onChange}
                              data-testid="select-timezone"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    {/* Row 4: Languages */}
                    <FormField control={form.control} name="languages" render={({ field }) => (
                      <FormItem>
                        <FormLabel className={labelCls}>
                          <Globe style={{ width: 15, height: 15, color: I }} />
                          Languages
                        </FormLabel>
                        <FormControl>
                          <div className="space-y-3">
                            {field.value && field.value.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {field.value.map((lang, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center gap-1.5 text-[13px] font-medium px-3 py-1 rounded-full"
                                    style={{ background: "#EEEDFB", color: NAVY }}
                                  >
                                    {lang}
                                    <button
                                      type="button"
                                      onClick={() => field.onChange(field.value?.filter((_, i) => i !== idx) ?? [])}
                                      style={{ display: "flex", alignItems: "center", color: I, opacity: 0.7, cursor: "pointer", background: "none", border: "none", padding: 0 }}
                                    >
                                      <X style={{ width: 12, height: 12 }} />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                            <StyledInput
                              placeholder="Type a language and press Enter"
                              data-testid="input-languages"
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && e.currentTarget.value.trim()) {
                                  e.preventDefault();
                                  const newLang = e.currentTarget.value.trim();
                                  if (!field.value?.includes(newLang)) {
                                    field.onChange([...(field.value ?? []), newLang]);
                                  }
                                  e.currentTarget.value = "";
                                }
                              }}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </SectionCard>
                )}

                {/* ─ Professional Details ─ */}
                {activeSection === "professional" && (
                  <SectionCard icon={Brain} title="Professional Details" subtitle="Share your professional title, bio, and rates.">

                    <div className="mb-5">
                      <FormField control={form.control} name="title" render={({ field }) => (
                        <FormItem>
                          <FormLabel className={labelCls}>Professional Title</FormLabel>
                          <FormControl>
                            <StyledInput placeholder="e.g., Full Stack Developer, Virtual Assistant" {...field} data-testid="input-title" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <div className="mb-5">
                      <FormField control={form.control} name="bio" render={({ field }) => (
                        <FormItem>
                          <FormLabel className={labelCls}>Professional Bio</FormLabel>
                          <FormControl>
                            <StyledTextarea
                              placeholder="Tell clients about your experience, skills, and what makes you unique…"
                              className="min-h-32"
                              {...field}
                              data-testid="input-bio"
                            />
                          </FormControl>
                          <p className="text-[12px] mt-1" style={{ color: MUTED }}>
                            {field.value?.length ?? 0} characters (minimum 50 recommended)
                          </p>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      <FormField control={form.control} name="hourlyRate" render={({ field }) => (
                        <FormItem>
                          <FormLabel className={labelCls}>
                            <DollarSign style={{ width: 15, height: 15, color: I }} />
                            Hourly Rate
                          </FormLabel>
                          <FormControl>
                            <StyledInput type="number" placeholder="25" {...field} data-testid="input-hourly-rate" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="rateCurrency" render={({ field }) => (
                        <FormItem>
                          <FormLabel className={labelCls}>Currency</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <StyledSelectTrigger data-testid="select-currency">
                                <SelectValue />
                              </StyledSelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="USD">USD ($)</SelectItem>
                              <SelectItem value="PHP">PHP (₱)</SelectItem>
                              <SelectItem value="EUR">EUR (€)</SelectItem>
                              <SelectItem value="GBP">GBP (£)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="availability" render={({ field }) => (
                        <FormItem>
                          <FormLabel className={labelCls}>Availability</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <StyledSelectTrigger data-testid="select-availability">
                                <SelectValue />
                              </StyledSelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="available">Available Now</SelectItem>
                              <SelectItem value="busy">Busy</SelectItem>
                              <SelectItem value="unavailable">Unavailable</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </SectionCard>
                )}

                {/* ─ Skills & Expertise ─ */}
                {activeSection === "skills" && (
                  <SectionCard icon={FileText} title="Skills & Expertise" subtitle="Select your skills to help clients find you for relevant projects.">
                    <FormField control={form.control} name="coreSkills" render={({ field }) => (
                      <FormItem>
                        <div className="space-y-6">
                          {/* Selected skills */}
                          <div>
                            <Label className="text-[13px] font-semibold uppercase tracking-wider mb-3 block" style={{ color: MUTED }}>
                              Your Skills
                            </Label>
                            {field.value && field.value.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {field.value.map((skill) => (
                                  <span
                                    key={skill}
                                    className="inline-flex items-center gap-1.5 text-[13px] font-medium px-3 py-1.5 rounded-full"
                                    style={{ background: ACTIVE_BG, color: "#fff" }}
                                  >
                                    {skill}
                                    <button
                                      type="button"
                                      onClick={() => field.onChange(field.value.filter((s) => s !== skill))}
                                      style={{ display: "flex", alignItems: "center", opacity: 0.8, cursor: "pointer", background: "none", border: "none", padding: 0, color: "#fff" }}
                                    >
                                      <X style={{ width: 12, height: 12 }} />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[14px]" style={{ color: MUTED }}>No skills selected yet. Add some from the list below.</p>
                            )}
                          </div>

                          {/* Available skills */}
                          <div>
                            <Label className="text-[13px] font-semibold uppercase tracking-wider mb-3 block" style={{ color: MUTED }}>
                              Add Skills
                            </Label>
                            <div className="flex flex-wrap gap-2">
                              {availableSkills
                                .filter((s) => !field.value?.includes(s.name))
                                .map((s) => (
                                  <button
                                    key={s.id} type="button"
                                    onClick={() => field.onChange([...(field.value ?? []), s.name])}
                                    className="inline-flex items-center gap-1 text-[13px] font-medium px-3 py-1.5 rounded-full transition-all duration-100"
                                    style={{ border: `1.5px solid ${BORDER}`, background: "#fff", color: TEXT, cursor: "pointer" }}
                                    onMouseEnter={(e) => { (e.currentTarget).style.background = "#EEEDFB"; (e.currentTarget).style.borderColor = I; }}
                                    onMouseLeave={(e) => { (e.currentTarget).style.background = "#fff"; (e.currentTarget).style.borderColor = BORDER; }}
                                  >
                                    <Plus style={{ width: 12, height: 12 }} />
                                    {s.name}
                                  </button>
                                ))}
                            </div>
                          </div>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </SectionCard>
                )}

                {/* ─ Documents ─ */}
                {activeSection === "documents" && (
                  <SectionCard icon={Upload} title="Documents" subtitle="Upload your resume and video introduction to showcase your qualifications.">

                    {/* Resume / CV */}
                    <div className="space-y-3 mb-7">
                      <Label className="text-[14px] font-semibold" style={{ color: TEXT }}>
                        Resume / CV
                      </Label>
                      {resumeDocs.length > 0 ? (
                        <div className="space-y-2">
                          {resumeDocs.map((doc) => (
                            <DocRow key={doc.id} doc={doc} onRemove={removeDocument} />
                          ))}
                        </div>
                      ) : (
                        <ObjectUploader
                          maxNumberOfFiles={1}
                          maxFileSize={10485760}
                          enableTalentImport={true}
                          importType="resume"
                          onGetUploadParameters={async () => ({ method: "POST" as const, url: "/api/object-storage/upload-url" })}
                          onComplete={async (result: any) => {
                            if (result.successful && result.successful.length > 0) {
                              const file = result.successful[0];
                              try {
                                await authAPI.post("/api/documents", {
                                  type: "resume", fileName: file.name, fileUrl: file.uploadURL,
                                  fileSize: file.size || null, mimeType: file.type || null,
                                  isPublic: false, isPrimary: false,
                                });
                                invalidateDocuments();
                              } catch {
                                toast({ title: "Metadata save failed", description: "Resume uploaded but failed to save.", variant: "destructive" });
                              }
                            }
                          }}
                          buttonClassName="w-full"
                        >
                          Upload Resume (PDF, DOC, DOCX — max 10MB)
                        </ObjectUploader>
                      )}
                    </div>

                    <Separator style={{ borderColor: BORDER }} />

                    {/* Video Introduction */}
                    <div className="space-y-3 mt-7">
                      <Label className="text-[14px] font-semibold" style={{ color: TEXT }}>
                        Video Introduction{" "}
                        <span className="font-normal text-[13px]" style={{ color: MUTED }}>(Optional)</span>
                      </Label>
                      {videoDocs.length > 0 ? (
                        <div className="space-y-2">
                          {videoDocs.map((doc) => (
                            <DocRow key={doc.id} doc={doc} onRemove={removeDocument} />
                          ))}
                        </div>
                      ) : (
                        <ObjectUploader
                          maxNumberOfFiles={1}
                          maxFileSize={52428800}
                          onGetUploadParameters={async () => ({ method: "POST" as const, url: "/api/object-storage/upload-url" })}
                          onComplete={(result: any) => handleUploadComplete(result, "video_intro")}
                          buttonClassName="w-full"
                        >
                          Upload Video Introduction (MP4, MOV, AVI, WEBM — max 50MB)
                        </ObjectUploader>
                      )}
                    </div>
                  </SectionCard>
                )}

                {/* ── Save button ── */}
                <div className="flex justify-end pt-2 pb-4">
                  <button
                    type="submit"
                    disabled={isSaving}
                    data-testid="button-save-settings"
                    className="inline-flex items-center gap-2 font-semibold transition-all duration-150"
                    style={{
                      height: 46, minWidth: 170, paddingInline: 24, borderRadius: 11,
                      border: "none",
                      background: isSaving ? "#A5A9DC" : SAVE_BG,
                      color: "#fff", fontSize: 15,
                      cursor: isSaving ? "not-allowed" : "pointer",
                      boxShadow: "0 4px 18px rgba(75,85,208,0.28)",
                    }}
                    onMouseEnter={(e) => { if (!isSaving) { (e.currentTarget).style.transform = "translateY(-1px)"; (e.currentTarget).style.boxShadow = "0 6px 22px rgba(75,85,208,0.36)"; } }}
                    onMouseLeave={(e) => { (e.currentTarget).style.transform = "translateY(0)"; (e.currentTarget).style.boxShadow = "0 4px 18px rgba(75,85,208,0.28)"; }}
                  >
                    {isSaving ? (
                      <>
                        <div className="animate-spin rounded-full border-2 border-white border-t-transparent" style={{ width: 16, height: 16 }} />
                        Saving…
                      </>
                    ) : (
                      <>
                        <Save style={{ width: 16, height: 16 }} />
                        Save Settings
                      </>
                    )}
                  </button>
                </div>
              </form>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
}
