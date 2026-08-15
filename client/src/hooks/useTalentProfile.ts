import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { authAPI } from "@/lib/api";
import {
  buildCompletionItems,
  calcCompletionPct,
  profileStrengthFromProfile,
} from "@/lib/profileCompletion";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { Profile, PortfolioItem } from "@shared/schema";
// Note: Document type kept for the exported interface; no longer fetched from /api/documents

// ---------------------
// Schema + Types
// ---------------------
export const profileFormSchema = z.object({
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(2, "Last name is required"),
  // Optional — users saving Basic Info must not be blocked by empty Professional Details
  title: z.string().optional(),
  bio: z.string().optional(),
  location: z.string().optional(),
  hourlyRate: z.string().optional(),
  rateCurrency: z.string().default("USD"),
  availability: z.string().default("available"),
  phoneNumber: z.string().optional(),
  // Allow empty array so users can clear all languages
  languages: z.array(z.string()).default([]),
  timezone: z.string().default("UTC"),
});

export type ProfileFormData = z.infer<typeof profileFormSchema>;

export interface TalentProfile extends ProfileFormData {
  id?: string;
  userId?: string;
  profilePicture?: string;
  rating?: string;
  totalEarnings?: string;
  jobSuccessScore?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Document {
  id: string;
  type: "resume" | "video_intro" | "cover_letter" | "portfolio_file";
  fileName: string;
  fileUrl: string;
  createdAt: string;
}

export interface TalentProfileData {
  profile?: TalentProfile;
  skills?: string[];
  documents?: Document[];
  portfolioItems?: PortfolioItem[];
  profileCompletion: number;
  isNewUser: boolean;
  hasCompletedOnboarding: boolean;
}

// ---------------------
// Hook implementation
// ---------------------
export function useTalentProfile() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Local skill selection state — used for the toggle UI in ProfileOnboarding.
  // Initialised from server data via useEffect below.
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  // Local documents added optimistically (e.g. immediately after upload before server re-fetch)
  const [localDocuments, setLocalDocuments] = useState<Document[]>([]);

  // ---- Fetch profile ----
  const {
    data: profileResponse,
    isLoading: profileLoading,
    error: profileError,
  } = useQuery<{ success: boolean; profile?: Profile } | null>({
    queryKey: ["/api/profiles/me"],
    queryFn: async () => {
      if (!user?.id) return null;
      try {
        const data = await authAPI.get("/api/profiles/me");
        return data;
      } catch (error: any) {
        if (error.response?.status === 404) {
          return { success: false, profile: undefined };
        }
        throw error;
      }
    },
    enabled: !!user?.id,
  });
  const profile = profileResponse?.profile;

  // ---- Fetch skills ----
  const { data: userSkillsData } = useQuery({
    queryKey: ["/api/users", user?.id, "skills"],
    queryFn: async () => {
      if (!user?.id) return [];
      const data = await authAPI.get(
        `/api/users/${user.id}/skills?includeNames=true`,
      );
      return data;
    },
    enabled: !!user?.id,
  });

  // ---- Fetch resume status (replaces legacy /api/documents) ----
  const { data: resumeStatusData } = useQuery<{ hasResume: boolean; resumeUrl: string | null; hasVideoIntro: boolean; videoIntroUrl: string | null } | null>({
    queryKey: ["/api/talent/me/resume-status"],
    queryFn: async () => {
      if (!user || user.role !== "talent") return null;
      try {
        return await authAPI.get("/api/talent/me/resume-status");
      } catch {
        return null;
      }
    },
    enabled: !!user && user.role === "talent",
  });

  // ---- Fetch portfolio items ----
  const { data: portfolioData } = useQuery({
    queryKey: ["/api/talents", user?.id, "portfolio"],
    queryFn: async () => {
      if (!user?.id) return [];
      try {
        const res = await fetch(`/api/talents/${user.id}/portfolio`);
        if (!res.ok) return [];
        return res.json();
      } catch {
        return [];
      }
    },
    enabled: !!user?.id,
  });

  // ---- Fetch available skills ----
  const { data: availableSkills = [] } = useQuery({
    queryKey: ["/api/skills"],
    queryFn: async () => {
      const data = await authAPI.get("/api/skills");
      return data;
    },
  });

  // ---- Derive persisted values directly from query data (for completion calc) ----
  // These are derived from the server response WITHOUT going through useState/useEffect,
  // so they are synchronously available on the same render that query data arrives.
  // This eliminates the race condition where profileCompletion showed 0 for skills/docs
  // until the useEffect had time to fire.
  const persistedSkills = useMemo<string[]>(() => {
    if (!Array.isArray(userSkillsData)) return [];
    return (userSkillsData as any[]).map((us) => us.skill?.name).filter(Boolean);
  }, [userSkillsData]);

  const portfolioItems = useMemo<PortfolioItem[]>(() => {
    if (!Array.isArray(portfolioData)) return [];
    return portfolioData as PortfolioItem[];
  }, [portfolioData]);

  // ---- Synthetic documents derived from candidates table (resume_url / video_intro_url) ----
  // Merges server-confirmed docs with any optimistically added local docs so the UI
  // stays responsive immediately after an upload without waiting for a refetch.
  const documents = useMemo<Document[]>(() => {
    const serverDocs: Document[] = [];
    if (resumeStatusData?.hasResume && resumeStatusData.resumeUrl) {
      serverDocs.push({ id: "resume", type: "resume", fileName: "resume", fileUrl: resumeStatusData.resumeUrl, createdAt: "" });
    }
    if (resumeStatusData?.hasVideoIntro && resumeStatusData.videoIntroUrl) {
      serverDocs.push({ id: "video_intro", type: "video_intro", fileName: "video-intro", fileUrl: resumeStatusData.videoIntroUrl, createdAt: "" });
    }
    // Optimistic local additions — keep only types not yet confirmed by the server
    const serverTypes = new Set(serverDocs.map((d) => d.type));
    const pendingLocal = localDocuments.filter((d) => !serverTypes.has(d.type));
    return [...serverDocs, ...pendingLocal];
  }, [resumeStatusData, localDocuments]);

  // ---- Profile completion — computed ONLY from persisted server data ----
  // Uses the shared profileCompletion module (single source of truth).
  // Never computed from form state or local toggle state.
  const profileCompletion = useMemo(() => {
    const input = profileStrengthFromProfile({
      firstName:      profile?.firstName ?? null,
      lastName:       profile?.lastName ?? null,
      title:          profile?.title ?? null,
      bio:            profile?.bio ?? null,
      location:       profile?.location ?? null,
      profilePicture: profile?.profilePicture ?? null,
      hasSkills:      persistedSkills.length > 0,
      hasResume:      !!resumeStatusData?.hasResume,
      hasLinks:       portfolioItems.length > 0,
    });
    return calcCompletionPct(buildCompletionItems(input));
  }, [profile, persistedSkills, resumeStatusData, portfolioItems]);

  const isNewUser = !profile || profileCompletion < 30;
  const hasCompletedOnboarding = profileCompletion >= 70;
  const isLoading = profileLoading;

  // ---- Effects: sync query data into local UI toggle state ----
  // selectedSkills local state is used for the skill toggle UI in ProfileOnboarding.
  // It is only used for mutations (updateSkills), never for profileCompletion.
  useEffect(() => {
    if (Array.isArray(userSkillsData)) {
      const skillNames = (userSkillsData as any[])
        .map((us: any) => us.skill?.name)
        .filter(Boolean);
      setSelectedSkills(skillNames);
    }
  }, [userSkillsData]);

  // ---- Mutations ----
  const profileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      // Ensure languages is always an array before sending to the server
      const normalizedData = {
        ...data,
        languages: Array.isArray(data.languages)
          ? data.languages
          : [data.languages || "English"],
      };

      const response = await authAPI.put("/api/profiles/me", normalizedData);
      return response;
    },
    onSuccess: () => {
      // Invalidating all relevant queries causes React Query to re-fetch, which
      // then re-derives persistedSkills/persistedDocuments/portfolioItems via useMemo,
      // which then recomputes profileCompletion — all from fresh server data.
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/me"] });
    },
    // Error toasts are intentionally handled by the caller (ProfileSettings.onSubmit)
    // to avoid duplicate toasts when mutateAsync is used in a try/catch.
    onError: (error: any) => {
      console.error("Profile update failed:", error?.response?.data || error?.message);
    },
  });

  const skillsMutation = useMutation({
    mutationFn: async (skillNames: string[]) => {
      if (!user?.id) throw new Error("User not authenticated");

      const skillsToAdd = skillNames
        .map((skillName) => {
          const skill = (availableSkills as any[]).find(
            (s) => s.name === skillName,
          );
          if (!skill) return null;
          return {
            skillId: skill.id,
            level: "intermediate",
            yearsExperience: 1,
          };
        })
        .filter(Boolean);

      const results = await Promise.all(
        skillsToAdd.map((skill) =>
          authAPI.post(`/api/users/${user.id}/skills`, skill),
        ),
      );

      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/users", user?.id, "skills"],
      });
      toast({
        title: "Skills Updated!",
        description: "Your skills have been saved successfully.",
      });
    },
  });

  // ---- Document helpers (backed by candidates table, with optimistic local state) ----
  const addDocument = (doc: Document) => {
    setLocalDocuments((prev) => [...prev, doc]);
    queryClient.invalidateQueries({ queryKey: ["/api/talent/me/resume-status"] });
  };
  const removeDocument = (id: string) => {
    setLocalDocuments((prev) => prev.filter((d) => d.id !== id));
    queryClient.invalidateQueries({ queryKey: ["/api/talent/me/resume-status"] });
  };
  // uploadDocument is an alias for addDocument — callers use it to signal the upload
  // is done and the local state should reflect the new document immediately.
  const uploadDocument = addDocument;

  // ---- Exposed helpers ----
  const updateProfile = async (data: ProfileFormData) =>
    profileMutation.mutateAsync(data);
  const updateSkills = async () => skillsMutation.mutateAsync(selectedSkills);

  const getDefaultFormValues = useCallback(
    (): ProfileFormData => ({
      firstName: profile?.firstName || user?.firstName || "",
      lastName: profile?.lastName || user?.lastName || "",
      title: profile?.title || "",
      bio: profile?.bio || "",
      location: profile?.location || "Manila, Philippines",
      hourlyRate: profile?.hourlyRate?.toString() || "",
      rateCurrency: profile?.rateCurrency || "USD",
      availability: profile?.availability || "available",
      phoneNumber: profile?.phoneNumber || "",
      // ✅ Always return an array for languages
      languages: Array.isArray(profile?.languages)
        ? profile.languages
        : ["English"],
      timezone: profile?.timezone || (() => {
        try {
          return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
        } catch {
          return "UTC";
        }
      })(),
    }),
    [profile, user],
  );

  return {
    profile,
    skills: selectedSkills,
    documents,
    availableSkills,
    profileCompletion,
    isNewUser,
    hasCompletedOnboarding,
    isLoading,
    isUpdating: profileMutation.isPending || skillsMutation.isPending,
    error: profileError,
    updateProfile,
    updateSkills,
    addDocument,
    removeDocument,
    uploadDocument,
    getDefaultFormValues,
    toggleSkill: (skill: string) =>
      setSelectedSkills((prev) =>
        prev.includes(skill)
          ? prev.filter((s) => s !== skill)
          : [...prev, skill],
      ),
  };
}
