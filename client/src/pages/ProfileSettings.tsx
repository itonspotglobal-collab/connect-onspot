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
  Phone,
  Globe,
  Clock,
  Save,
  Plus,
  X,
  Settings2,
  ArrowLeft,
  Loader2,
  Trash2,
  Video,
  Download,
  Camera,
  Square,
  RotateCcw,
  Award,
} from "lucide-react";
import CertificationsManagement from "@/components/CertificationsManagement";
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
import { TimezoneSelect } from "@/components/TimezoneSelect";
import {
  useCandidateProfileSettings,
  candidateSettingsSchema,
  CandidateSettingsFormData,
  candidatePhotoSrc,
  candidateToFormValues,
} from "@/hooks/useCandidateProfileSettings";
import { CheckCircle2 } from "lucide-react";
import { validatePhone, validatePhoneTimezoneMatch, countryFromTimezone } from "@/lib/phoneValidation";
import { queryClient } from "@/lib/queryClient";
import { setCandidateResumeCache, invalidateCandidateQueries } from "@/lib/candidateCache";
import { candidateQueryKeys } from "@/lib/candidateQueryKeys";
import { applyResumeToCandidate, type ResumeReviewField } from "@/lib/applyResumeToCandidate";
import { ResumeImportReviewPanel } from "@/components/ResumeImportReviewPanel";
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

// ─── Sections ──────────────────────────────────────────────────────────────────
const sections = [
  { id: "basic",           title: "Basic Information",    icon: User     },
  { id: "professional",    title: "Professional Details",  icon: Brain    },
  { id: "skills",          title: "Skills & Expertise",   icon: FileText },
  { id: "documents",       title: "Documents",             icon: Upload   },
  { id: "certifications",  title: "Certifications",        icon: Award    },
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

  // ── Resume & video (synced with Talent Profile via candidates table) ─────
  const [resumeUploading, setResumeUploading] = useState(false);
  const [resumeAnalyzing, setResumeAnalyzing] = useState(false);
  const [resumeDeleting,  setResumeDeleting]  = useState(false);
  // Review panel shown after Vanessa auto-fills profile fields from a resume
  const [resumeReview, setResumeReview] = useState<{
    fields: ResumeReviewField[];
    source: "vanessa" | "deterministic";
  } | null>(null);
  const [videoUploading,  setVideoUploading]  = useState(false);
  const [videoDeleting,   setVideoDeleting]   = useState(false);
  const resumeFileInputRef = useRef<HTMLInputElement>(null);
  const videoFileInputRef  = useRef<HTMLInputElement>(null);

  // ── Camera recording state ──────────────────────────────────────────────
  const [videoRecordingState, setVideoRecordingState] = useState<'idle' | 'camera' | 'recording' | 'recorded'>('idle');
  const [recordedVideoBlob,   setRecordedVideoBlob]   = useState<Blob | null>(null);
  const [recordedVideoUrl,    setRecordedVideoUrl]    = useState<string | null>(null);
  const [recordingTime,       setRecordingTime]       = useState(0);
  const videoStreamRef      = useRef<MediaStream | null>(null);
  const videoPreviewRef     = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef    = useRef<MediaRecorder | null>(null);
  const videoChunksRef      = useRef<Blob[]>([]);
  const recordingTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  // Tracks in-flight getUserMedia requests so stale resolutions can be discarded.
  const cameraRequestRef    = useRef<number>(0);
  // Mirrors recordedVideoUrl in a ref so cleanup effects can revoke it without stale closures.
  const recordedVideoUrlRef = useRef<string | null>(null);

  const formatRecordingTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  /** Auth header used by resume/video fetch calls — mirrors TalentProfile pattern. */
  const getAuthHeader = () =>
    talentAuth?.token
      ? `Bearer ${talentAuth.token}`
      : `Bearer ${localStorage.getItem("onspot_jwt_token") || ""}`;

  /**
   * Invalidate candidate query keys used by photo/video mutations (not resume —
   * resume mutations use setCandidateResumeCache + invalidateCandidateQueries directly).
   */
  const invalidateCandidate = () =>
    candidateId ? invalidateCandidateQueries(queryClient, candidateId) : Promise.resolve();

  const uploadResume = async (file: File) => {
    if (!candidateId) return;
    setResumeUploading(true);
    let uploadedOk = false;
    const token = getAuthHeader().replace(/^Bearer\s+/i, "");
    try {
      const fd = new FormData();
      fd.append("resume", file);
      const res = await fetch(`/api/candidates/${candidateId}/resume`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Upload failed");
      }
      const result = await res.json();
      // Immediately patch all candidate caches with the confirmed server values so
      // TalentProfile shows the new filename without a hard refresh.
      setCandidateResumeCache(queryClient, candidateId, result);
      uploadedOk = true;
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
      return;
    } finally {
      setResumeUploading(false);
    }

    if (!uploadedOk) return;

    // ── Parse resume and apply extracted fields to the Candidate profile ────
    setResumeAnalyzing(true);
    try {
      const { appliedFields, reviewFields, parseError, analysisSource, updated } = await applyResumeToCandidate({
        file,
        candidateId,
        token,
        queryClient,
      });

      if (parseError) {
        toast({
          title: "Resume uploaded",
          description: "Resume saved successfully. Vanessa couldn't analyze all details — you can complete them manually.",
        });
      } else if (appliedFields.length > 0) {
        // Sync the form immediately with the server-confirmed data so that
        // clicking "Edit" in the review panel sees the freshly imported values,
        // not stale pre-upload values that were in the form when it first rendered.
        if (updated) {
          // Write into the query cache synchronously so React Query and the
          // useEffect form-reset both see the same fresh data.
          queryClient.setQueryData(candidateQueryKeys.profile(candidateId), (old: any) =>
            old ? { ...old, ...updated } : updated,
          );
          // Reset form in-place without waiting for the background refetch.
          form.reset(candidateToFormValues(updated));
        }
        // Open the review panel so the talent can confirm or correct each field
        setResumeReview({ fields: reviewFields, source: analysisSource });
      } else {
        toast({ title: "Resume uploaded", description: "Your resume has been saved." });
      }
    } catch {
      toast({ title: "Resume uploaded", description: "Saved. Profile auto-fill encountered an issue — you can update fields manually." });
    } finally {
      setResumeAnalyzing(false);
    }
  };

  // ── Resume review panel — route to the settings section that holds a field ──
  function handleReviewEdit(field: string) {
    setResumeReview(null);
    // Experience/education aren't editable in Settings — send to the Talent Profile page
    if (field === "workHistory" || field === "education" || field === "fullName") {
      if (candidateId) window.location.href = `/talent-profile/${candidateId}`;
      return;
    }
    const SECTION_BY_FIELD: Record<string, string> = {
      phone: "basic", location: "basic", languages: "basic",
      targetPosition: "professional", summary: "professional",
      coreSkills: "skills", secondarySkills: "skills",
      certifications: "certifications",
    };
    setActiveSection(SECTION_BY_FIELD[field] ?? "basic");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const deleteResume = async () => {
    if (!candidateId || !window.confirm("Remove your resume? This cannot be undone.")) return;
    setResumeDeleting(true);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/resume`, {
        method: "DELETE",
        headers: { Authorization: getAuthHeader() },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Delete failed");
      }
      // Immediately clear resume from all caches so TalentProfile also shows "no resume".
      setCandidateResumeCache(queryClient, candidateId, { resumeUrl: null, resumeFileName: null });
      void invalidateCandidateQueries(queryClient, candidateId);
      toast({ title: "Resume removed." });
    } catch (err: any) {
      toast({ title: "Removal failed", description: err.message, variant: "destructive" });
    } finally {
      setResumeDeleting(false);
    }
  };

  const uploadVideo = async (file: File) => {
    if (!candidateId) return;
    setVideoUploading(true);
    try {
      const fd = new FormData();
      fd.append("video", file);
      const res = await fetch(`/api/candidates/${candidateId}/video`, {
        method: "POST",
        headers: { Authorization: getAuthHeader() },
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Upload failed");
      }
      await invalidateCandidate();
      toast({ title: "Video saved", description: "Your video introduction has been updated." });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setVideoUploading(false);
    }
  };

  const deleteVideo = async () => {
    if (!candidateId || !window.confirm("Delete your video introduction? This cannot be undone.")) return;
    setVideoDeleting(true);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/video`, {
        method: "DELETE",
        headers: { Authorization: getAuthHeader() },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Delete failed");
      }
      await invalidateCandidate();
      toast({ title: "Video deleted." });
    } catch (err: any) {
      toast({ title: "Deletion failed", description: err.message, variant: "destructive" });
    } finally {
      setVideoDeleting(false);
    }
  };

  // ── Camera recording handlers ───────────────────────────────────────────
  async function startVideoCamera() {
    // Stamp this request so we can detect if the user navigated away before getUserMedia resolved.
    const requestId = ++cameraRequestRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      // If the section changed or component unmounted while awaiting permission, release immediately.
      if (cameraRequestRef.current !== requestId) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      videoStreamRef.current = stream;
      setVideoRecordingState("camera");
      setTimeout(() => {
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = stream;
          videoPreviewRef.current.play().catch(() => {});
        }
      }, 50);
    } catch {
      toast({ title: "Camera access denied", description: "Allow camera/microphone access to record.", variant: "destructive" });
    }
  }

  function stopVideoCamera() {
    // Incrementing cancels any getUserMedia still in-flight for this component.
    cameraRequestRef.current++;
    videoStreamRef.current?.getTracks().forEach((t) => t.stop());
    videoStreamRef.current = null;
    if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null;
  }

  function startVideoRecording() {
    if (!videoStreamRef.current) return;
    videoChunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";
    const recorder = new MediaRecorder(videoStreamRef.current, { mimeType });
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (e) => { if (e.data.size > 0) videoChunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(videoChunksRef.current, { type: "video/webm" });
      const objectUrl = URL.createObjectURL(blob);
      recordedVideoUrlRef.current = objectUrl;
      setRecordedVideoBlob(blob);
      setRecordedVideoUrl(objectUrl);
      setVideoRecordingState("recorded");
      stopVideoCamera();
    };
    recorder.start();
    setVideoRecordingState("recording");
    setRecordingTime(0);
    recordingTimerRef.current = setInterval(() => {
      setRecordingTime((prev) => {
        if (prev >= 120) { stopVideoRecording(); return prev; }
        return prev + 1;
      });
    }, 1000);
  }

  function stopVideoRecording() {
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
  }

  function discardVideoRecording() {
    // Stop the timer first.
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    // Neutralize MediaRecorder callbacks BEFORE stopping so that onstop cannot
    // fire and restore blob/url/state after we've already cleared them.
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      if (mediaRecorderRef.current.state === "recording") mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    // Revoke the object URL via ref so this works even from a stale closure.
    const url = recordedVideoUrlRef.current;
    if (url) URL.revokeObjectURL(url);
    recordedVideoUrlRef.current = null;
    setRecordedVideoBlob(null);
    setRecordedVideoUrl(null);
    setVideoRecordingState("idle");
    setRecordingTime(0);
  }

  async function uploadRecordedVideo() {
    if (!recordedVideoBlob) return;
    const file = new File([recordedVideoBlob], "video-intro.webm", { type: "video/webm" });
    setVideoUploading(true);
    try {
      const fd = new FormData();
      fd.append("video", file);
      const res = await fetch(`/api/candidates/${candidateId}/video`, {
        method: "POST",
        headers: { Authorization: getAuthHeader() },
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Upload failed");
      }
      await invalidateCandidate();
      toast({ title: "Video saved! 🎉", description: "Your video introduction has been saved." });
      discardVideoRecording();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setVideoUploading(false);
    }
  }

  // `documents` is now managed by the hook (useQuery) so completion recalculates
  // automatically after upload/remove without a separate local state + useEffect.

  // ── Camera cleanup when navigating away from Documents section ──────────────
  useEffect(() => {
    if (activeSection !== "documents") {
      stopVideoCamera();
      discardVideoRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection]);

  // ── Camera cleanup on unmount ────────────────────────────────────────────────
  // Uses refs directly to avoid stale closures captured by the [] dep array.
  useEffect(() => {
    return () => {
      cameraRequestRef.current++; // cancel any pending getUserMedia
      if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.ondataavailable = null;
        mediaRecorderRef.current.onstop = null;
        if (mediaRecorderRef.current.state === "recording") mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
      }
      const url = recordedVideoUrlRef.current;
      if (url) URL.revokeObjectURL(url);
      recordedVideoUrlRef.current = null;
      videoStreamRef.current?.getTracks().forEach((t) => t.stop());
      videoStreamRef.current = null;
    };
  }, []);

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
                      <FormField control={form.control} name="rateEngagementType" render={({ field }) => (
                        <FormItem>
                          <FormLabel className={labelCls}>Availability</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl>
                              <StyledSelectTrigger data-testid="select-engagement-type">
                                <SelectValue placeholder="Select…" />
                              </StyledSelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Full-Time">Full-Time</SelectItem>
                              <SelectItem value="Half-Day">Half-Day</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-[12px] mt-1" style={{ color: MUTED }}>
                            Used to boost your match score on jobs that fit your preferred schedule.
                          </p>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="rateAmount" render={({ field }) => (
                        <FormItem>
                          <FormLabel className={labelCls}>
                            <DollarSign style={{ width: 15, height: 15, color: I }} />
                            Rate Expectation
                          </FormLabel>
                          <FormControl>
                            <StyledInput type="number" placeholder="3000" {...field} data-testid="input-rate-amount" />
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
                          <FormLabel className={labelCls}>Work Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <StyledSelectTrigger data-testid="select-work-status">
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
                  <SectionCard icon={Upload} title="Documents" subtitle="Your resume and video introduction — synced with your Talent Profile.">

                    {/* ── Resume / CV ── */}
                    <div className="space-y-3 mb-7">
                      <Label className="text-[14px] font-semibold" style={{ color: TEXT }}>
                        Resume / CV
                      </Label>

                      {/* Existing resume row */}
                      {(candidate as any)?.resumeFileName ? (
                        <div
                          className="flex items-center justify-between p-4 rounded-xl"
                          style={{ border: `1.5px solid ${BORDER}`, background: BG }}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div style={{ width: 36, height: 36, borderRadius: 8, background: "#EEEDFB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <FileText style={{ width: 16, height: 16, color: I }} />
                            </div>
                            <p className="font-medium text-[14px] truncate" style={{ color: TEXT }}>
                              {(candidate as any).resumeFileName}
                            </p>
                          </div>
                          <div className="flex gap-2 shrink-0 ml-3">
                            {/* Download */}
                            <button
                              type="button"
                              title="Download resume"
                              onClick={() => {
                                fetch(`/api/candidates/${candidateId}/resume`, { headers: { Authorization: getAuthHeader() } })
                                  .then(r => r.blob())
                                  .then(blob => {
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement("a");
                                    a.href = url;
                                    a.download = (candidate as any).resumeFileName || "resume";
                                    a.click();
                                    setTimeout(() => URL.revokeObjectURL(url), 5000);
                                  })
                                  .catch(() => toast({ title: "Download failed", variant: "destructive" }));
                              }}
                              className="inline-flex items-center justify-center h-8 w-8 rounded-lg transition-colors"
                              style={{ border: `1.5px solid ${BORDER}`, background: "#fff", color: MUTED }}
                            >
                              <Download style={{ width: 14, height: 14 }} />
                            </button>
                            {/* Delete */}
                            <button
                              type="button"
                              title="Remove resume"
                              disabled={resumeDeleting}
                              onClick={deleteResume}
                              className="inline-flex items-center justify-center h-8 w-8 rounded-lg disabled:opacity-50"
                              style={{ border: "1.5px solid #FCA5A5", background: "#FFF5F5", color: "#DC2626", cursor: resumeDeleting ? "not-allowed" : "pointer" }}
                            >
                              {resumeDeleting
                                ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />
                                : <Trash2 style={{ width: 14, height: 14 }} />}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[13px]" style={{ color: MUTED }}>No resume uploaded yet.</p>
                      )}

                      {/* Upload / Replace */}
                      <input
                        ref={resumeFileInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadResume(file);
                          e.target.value = "";
                        }}
                      />
                      <button
                        type="button"
                        disabled={resumeUploading || resumeAnalyzing}
                        onClick={() => resumeFileInputRef.current?.click()}
                        className="w-full inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150 disabled:opacity-60"
                        style={{
                          height: 44, borderRadius: 11, fontSize: 14,
                          border: `1.5px solid ${I}`, background: "transparent", color: I,
                          cursor: (resumeUploading || resumeAnalyzing) ? "not-allowed" : "pointer",
                        }}
                      >
                        {resumeUploading
                          ? <><Loader2 style={{ width: 15, height: 15 }} className="animate-spin" /> Uploading…</>
                          : resumeAnalyzing
                          ? <><Loader2 style={{ width: 15, height: 15 }} className="animate-spin" /> Vanessa is analyzing…</>
                          : <><Upload style={{ width: 15, height: 15 }} /> {(candidate as any)?.resumeFileName ? "Replace Resume" : "Upload Resume (PDF, DOC, DOCX — max 10 MB)"}</>}
                      </button>
                    </div>

                    <Separator style={{ borderColor: BORDER }} />

                    {/* ── Video Introduction ── */}
                    <div className="space-y-3 mt-7">
                      <Label className="text-[14px] font-semibold" style={{ color: TEXT }}>
                        Video Introduction{" "}
                        <span className="font-normal text-[13px]" style={{ color: MUTED }}>(Optional)</span>
                      </Label>

                      {/* ── Prompt / instructions ── */}
                      <div className="rounded-xl p-4" style={{ background: "linear-gradient(135deg,#F5F3FF,#EEF2FF)" }}>
                        <p className="mb-1 text-[13px] font-bold" style={{ color: V }}>
                          We Want to Meet the Person Behind the Resume!
                        </p>
                        <p className="mb-3 text-[12px] leading-relaxed" style={{ color: "#4B5563" }}>
                          Grab your camera and record a brief 2-minute video telling us your story.
                        </p>
                        <ul className="space-y-1.5">
                          {[
                            "A quick snapshot of your relevant experience",
                            "Your biggest wins and top contributions",
                            "1–2 projects you spearheaded, including the final outcomes",
                          ].map((tip, i) => (
                            <li key={i} className="flex items-start gap-2 text-[12px]" style={{ color: "#4B5563" }}>
                              <span
                                className="shrink-0 flex items-center justify-center text-[9px] font-bold"
                                style={{
                                  marginTop: 1, width: 16, height: 16, borderRadius: "50%",
                                  background: "#DDD6FE", color: V,
                                }}
                              >
                                {i + 1}
                              </span>
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Existing saved video — shown only when not recording */}
                      {(candidate as any)?.videoIntroUrl && videoRecordingState === "idle" && (
                        <div className="overflow-hidden rounded-xl" style={{ border: `1.5px solid ${BORDER}` }}>
                          <video
                            controls
                            className="w-full"
                            src={`/api/candidates/${candidateId}/video`}
                            onError={(e) => {
                              const vid = e.currentTarget;
                              if (vid.dataset.blobLoaded) return;
                              vid.dataset.blobLoaded = "1";
                              fetch(`/api/candidates/${candidateId}/video`, { headers: { Authorization: getAuthHeader() } })
                                .then(r => r.blob())
                                .then(blob => { vid.src = URL.createObjectURL(blob); })
                                .catch(() => {});
                            }}
                          />
                          <div className="flex items-center justify-between px-3 py-2" style={{ background: BG }}>
                            <div className="flex items-center gap-2 min-w-0">
                              <Video style={{ width: 14, height: 14, color: V, flexShrink: 0 }} />
                              <span className="text-[13px] truncate" style={{ color: MUTED }}>
                                {(candidate as any).videoIntroFileName || "video-intro"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-3">
                              <span
                                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                                style={{ background: "#EDE9FE", color: V }}
                              >
                                Saved
                              </span>
                              <button
                                type="button"
                                title="Delete video"
                                disabled={videoDeleting}
                                onClick={deleteVideo}
                                className="inline-flex items-center justify-center h-7 w-7 rounded-full disabled:opacity-50 transition-colors"
                                style={{ color: MUTED, cursor: videoDeleting ? "not-allowed" : "pointer" }}
                              >
                                {videoDeleting
                                  ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />
                                  : <Trash2 style={{ width: 14, height: 14 }} />}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ── Idle: record + upload buttons ── */}
                      {videoRecordingState === "idle" && (
                        <div className="space-y-2">
                          {/* Record button */}
                          <button
                            type="button"
                            onClick={startVideoCamera}
                            className="w-full inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150"
                            style={{
                              height: 44, borderRadius: 11, fontSize: 14,
                              background: V, color: "#fff", border: "none",
                              cursor: "pointer",
                            }}
                          >
                            <Camera style={{ width: 16, height: 16 }} />
                            {(candidate as any)?.videoIntroUrl ? "Re-record Video" : "Record a Video"}
                          </button>

                          {/* Upload file */}
                          <input
                            ref={videoFileInputRef}
                            type="file"
                            accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/mpeg"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) uploadVideo(file);
                              e.target.value = "";
                            }}
                          />
                          <button
                            type="button"
                            disabled={videoUploading}
                            onClick={() => videoFileInputRef.current?.click()}
                            className="w-full inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150 disabled:opacity-60"
                            style={{
                              height: 44, borderRadius: 11, fontSize: 14,
                              border: `1.5px solid ${V}`, background: "transparent", color: V,
                              cursor: videoUploading ? "not-allowed" : "pointer",
                            }}
                          >
                            {videoUploading
                              ? <><Loader2 style={{ width: 15, height: 15 }} className="animate-spin" /> Uploading…</>
                              : <><Upload style={{ width: 15, height: 15 }} /> Upload a Video File</>}
                          </button>
                          <p className="text-center text-[11px]" style={{ color: MUTED }}>
                            MP4, WebM or MOV · max 200 MB
                            {candidateId && (
                              <> · <a href={`/talent-profile/${candidateId}`} className="underline" style={{ color: I }}>View on your profile →</a></>
                            )}
                          </p>
                        </div>
                      )}

                      {/* ── Camera preview (before/during recording) ── */}
                      {(videoRecordingState === "camera" || videoRecordingState === "recording") && (
                        <div className="space-y-3">
                          <div className="relative overflow-hidden rounded-xl bg-black" style={{ aspectRatio: "16/9" }}>
                            <video
                              ref={videoPreviewRef}
                              autoPlay
                              muted
                              playsInline
                              className="h-full w-full object-cover"
                            />
                            {videoRecordingState === "recording" && (
                              <div
                                className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
                                style={{ background: "#DC2626" }}
                              >
                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                                REC {formatRecordingTime(recordingTime)} / 2:00
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {videoRecordingState === "camera" && (
                              <>
                                <button
                                  type="button"
                                  onClick={startVideoRecording}
                                  className="flex-1 inline-flex items-center justify-center gap-2 font-semibold rounded-full text-[13px] text-white"
                                  style={{ height: 38, background: "#DC2626", border: "none", cursor: "pointer" }}
                                >
                                  <Camera style={{ width: 14, height: 14 }} /> Start Recording
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { stopVideoCamera(); setVideoRecordingState("idle"); }}
                                  className="inline-flex items-center justify-center rounded-full text-[13px] font-semibold px-4"
                                  style={{ height: 38, border: `1.5px solid ${BORDER}`, background: "#fff", color: TEXT, cursor: "pointer" }}
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                            {videoRecordingState === "recording" && (
                              <button
                                type="button"
                                onClick={stopVideoRecording}
                                className="flex-1 inline-flex items-center justify-center gap-2 font-semibold rounded-full text-[13px] text-white"
                                style={{ height: 38, background: "#DC2626", border: "none", cursor: "pointer" }}
                              >
                                <Square style={{ width: 14, height: 14 }} /> Stop Recording
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* ── Recorded preview (review before saving) ── */}
                      {videoRecordingState === "recorded" && recordedVideoUrl && (
                        <div className="space-y-3">
                          <div className="overflow-hidden rounded-xl bg-black">
                            <video src={recordedVideoUrl} controls className="h-full w-full" />
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={videoUploading}
                              onClick={uploadRecordedVideo}
                              className="flex-1 inline-flex items-center justify-center gap-2 font-semibold rounded-full text-[13px] text-white disabled:opacity-60"
                              style={{ height: 38, background: "#059669", border: "none", cursor: videoUploading ? "not-allowed" : "pointer" }}
                            >
                              {videoUploading
                                ? <><Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> Uploading…</>
                                : <><Upload style={{ width: 14, height: 14 }} /> Save to Profile</>}
                            </button>
                            <button
                              type="button"
                              disabled={videoUploading}
                              onClick={discardVideoRecording}
                              className="inline-flex items-center justify-center gap-2 rounded-full text-[13px] font-semibold px-4 disabled:opacity-60"
                              style={{ height: 38, border: `1.5px solid ${BORDER}`, background: "#fff", color: TEXT, cursor: videoUploading ? "not-allowed" : "pointer" }}
                            >
                              <RotateCcw style={{ width: 14, height: 14 }} /> Retake
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </SectionCard>
                )}

                {activeSection === "certifications" && (
                  <CertificationsManagement />
                )}

                {/* ── Save button — hidden for certifications which has its own CRUD ── */}
                {activeSection !== "certifications" && (
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
                )}
              </form>
            </Form>
          </div>
        </div>
      </div>

      {/* ── Resume import review panel ── */}
      <ResumeImportReviewPanel
        open={!!resumeReview}
        onClose={() => setResumeReview(null)}
        fields={resumeReview?.fields ?? []}
        analysisSource={resumeReview?.source ?? "vanessa"}
        onEditField={handleReviewEdit}
      />
    </div>
  );
}
