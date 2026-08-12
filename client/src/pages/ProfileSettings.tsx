import { useState, useRef } from "react";
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
  Phone,
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
  useTalentProfile,
  profileFormSchema,
  ProfileFormData,
} from "@/hooks/useTalentProfile";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { authAPI } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const I = "#4B51B8";       // primary indigo
const V = "#6E4DF5";       // violet accent
const NAVY = "#171B4D";
const GOLD = "#FFA91F";
const BG = "#FAFAFD";
const TEXT = "#18181F";
const MUTED = "#6F7280";
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

// ─── Main component ────────────────────────────────────────────────────────────
const sections = [
  { id: "basic",        title: "Basic Information",   icon: User    },
  { id: "professional", title: "Professional Details", icon: Brain   },
  { id: "skills",       title: "Skills & Expertise",  icon: FileText },
  { id: "documents",    title: "Documents",            icon: Upload  },
];

export default function ProfileSettings() {
  const { toast } = useToast();
  const authContext = useAuth();
  const user = authContext?.user;

  const {
    profile,
    skills,
    documents,
    availableSkills,
    profileCompletion,
    isLoading,
    isUpdating,
    toggleSkill,
    updateProfile,
    updateSkills,
    getDefaultFormValues,
  } = useTalentProfile();

  const [activeSection, setActiveSection] = useState("basic");
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // photoVersion forces the <img> to re-fetch after upload/removal (same URL, new content)
  const [photoVersion, setPhotoVersion] = useState(0);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum photo size is 5 MB.", variant: "destructive" });
      return;
    }
    setPhotoUploading(true);
    try {
      // Use dedicated photo endpoint — server validates MIME type and size
      const formData = new FormData();
      formData.append("photo", file);
      // authAPI.post returns the parsed response body directly
      const response = await authAPI.post("/api/profiles/me/photo", formData);
      if (!response?.success) throw new Error(response?.error || "Upload failed");
      // Refresh profile data and bump version so the avatar re-fetches
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/me"] });
      setPhotoVersion((v) => v + 1);
      toast({ title: "Photo updated", description: "Your profile photo has been saved." });
    } catch (error: any) {
      toast({ title: "Upload failed", description: error?.message || "Could not upload photo.", variant: "destructive" });
    } finally {
      setPhotoUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = async () => {
    setPhotoUploading(true);
    try {
      // authAPI.delete returns the parsed body directly
      await authAPI.delete("/api/profiles/me/photo");
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/me"] });
      setPhotoVersion((v) => v + 1);
      toast({ title: "Photo removed", description: "Your profile photo has been removed." });
    } catch {
      toast({ title: "Removal failed", description: "Could not remove photo. Please try again.", variant: "destructive" });
    } finally {
      setPhotoUploading(false);
    }
  };

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: getDefaultFormValues(),
    values: getDefaultFormValues(),
  });

  // ── Save ──────────────────────────────────────────────────────────────────
  const onSubmit = async (data: ProfileFormData) => {
    if (!authContext?.isAuthenticated || !user?.id) {
      toast({ title: "Authentication Required", description: "Please sign in.", variant: "destructive" });
      return;
    }
    try {
      await updateProfile(data);
      if (skills && skills.length > 0) await updateSkills();
      toast({ title: "Settings saved successfully.", description: "Your profile has been updated.", duration: 3000 });
    } catch (error: any) {
      toast({
        title: "Unable to save settings",
        description: `${error?.message || "Something went wrong"}. Please try again.`,
        variant: "destructive", duration: 6000,
      });
    }
  };

  // ── Document handlers ─────────────────────────────────────────────────────
  const removeDocument = async (documentId: string) => {
    try {
      await authAPI.delete(`/api/documents/${documentId}`);
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/me"] });
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
        queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
        queryClient.invalidateQueries({ queryKey: ["/api/profiles/me"] });
        toast({ title: "Document uploaded", description: `Your ${type === "resume" ? "resume" : "video introduction"} was saved.` });
      } catch {
        toast({ title: "Upload error", description: "File uploaded but metadata failed to save.", variant: "destructive" });
      }
    }
  };

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

  const resumeDocs   = documents?.filter((d) => d.type === "resume")     ?? [];
  const videoDocs    = documents?.filter((d) => d.type === "video_intro") ?? [];

  return (
    <div className="min-h-screen" style={{ background: BG, paddingBottom: 60 }}>
      <div style={{ maxWidth: 1240, marginInline: "auto", paddingInline: "clamp(16px,4vw,32px)", paddingTop: 48 }}>

        {/* ── Back button ── */}
        <div className="mb-5">
          <button
            onClick={() => {
              if (window.history.length > 1) {
                window.history.back();
              } else {
                window.location.href = "/talent-profile";
              }
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              height: 40,
              paddingInline: 14,
              borderRadius: 10,
              border: `1.5px solid rgba(75,81,184,0.18)`,
              background: "rgba(75,81,184,0.07)",
              color: "#4B51B8",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
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

              <p className="text-[12px] mt-3" style={{ color: MUTED }}>
                Complete your profile to attract more clients.
              </p>
            </div>
          </div>

          {/* ── Main content ── */}
          <div>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">

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
                          {profile?.profilePicture && user?.id ? (
                            <img
                              src={`/api/profile-picture/${user.id}?v=${photoVersion}`}
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
                            accept="image/jpeg,image/png,image/webp,image/gif"
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
                                {profile?.profilePicture ? "Replace Photo" : "Upload Photo"}
                              </>
                            )}
                          </button>
                          {profile?.profilePicture && (
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
                            JPG, PNG, WebP or GIF · Max 5 MB
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
                          <FormLabel className={labelCls}>Last Name *</FormLabel>
                          <FormControl><StyledInput placeholder="Enter your last name" {...field} data-testid="input-last-name" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    {/* Row 2: Phone (full) */}
                    <div className="mb-5">
                      <FormField control={form.control} name="phoneNumber" render={({ field }) => (
                        <FormItem>
                          <FormLabel className={labelCls}>
                            <Phone style={{ width: 15, height: 15, color: I }} />
                            Phone Number
                          </FormLabel>
                          <FormControl><StyledInput placeholder="Enter your phone number" {...field} data-testid="input-phone" /></FormControl>
                          <FormMessage />
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

                    {/* Row 4: Languages (full) */}
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
                          <FormLabel className={labelCls}>Professional Title *</FormLabel>
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
                    <div className="space-y-6">

                      {/* Selected */}
                      <div>
                        <Label className="text-[13px] font-semibold uppercase tracking-wider mb-3 block" style={{ color: MUTED }}>
                          Your Skills
                        </Label>
                        {skills && skills.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {skills.map((skill) => (
                              <span
                                key={skill}
                                className="inline-flex items-center gap-1.5 text-[13px] font-medium px-3 py-1.5 rounded-full"
                                style={{ background: ACTIVE_BG, color: "#fff" }}
                              >
                                {skill}
                                <button
                                  type="button" onClick={() => toggleSkill(skill)}
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

                      {/* Available */}
                      <div>
                        <Label className="text-[13px] font-semibold uppercase tracking-wider mb-3 block" style={{ color: MUTED }}>
                          Add Skills
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {availableSkills
                            ?.filter((s: any) => !skills?.includes(s.name))
                            ?.map((s: any) => (
                              <button
                                key={s.id} type="button"
                                onClick={() => toggleSkill(s.name)}
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
                                queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
                                queryClient.invalidateQueries({ queryKey: ["/api/profiles/me"] });
                                if (user?.id) queryClient.invalidateQueries({ queryKey: ["/api/users", user.id, "skills"] });
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
                    disabled={isUpdating}
                    data-testid="button-save-settings"
                    className="inline-flex items-center gap-2 font-semibold transition-all duration-150"
                    style={{
                      height: 46, minWidth: 170, paddingInline: 24, borderRadius: 11,
                      border: "none",
                      background: isUpdating ? "#A5A9DC" : SAVE_BG,
                      color: "#fff", fontSize: 15,
                      cursor: isUpdating ? "not-allowed" : "pointer",
                      boxShadow: "0 4px 18px rgba(75,85,208,0.28)",
                    }}
                    onMouseEnter={(e) => { if (!isUpdating) { (e.currentTarget).style.transform = "translateY(-1px)"; (e.currentTarget).style.boxShadow = "0 6px 22px rgba(75,85,208,0.36)"; } }}
                    onMouseLeave={(e) => { (e.currentTarget).style.transform = "translateY(0)"; (e.currentTarget).style.boxShadow = "0 4px 18px rgba(75,85,208,0.28)"; }}
                  >
                    {isUpdating ? (
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
