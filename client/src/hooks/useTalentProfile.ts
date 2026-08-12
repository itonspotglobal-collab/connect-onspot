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
  const [uploadedDocuments, setUploadedDocuments] = useState<Document[]>([]);

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

  // ---- Fetch documents ----
  const { data: documentsData } = useQuery({
    queryKey: ["/api/documents"],
    queryFn: async () => {
      if (!user || user.role !== "talent") return [];
      try {
        const data = await authAPI.get("/api/documents");
        return data;
      } catch (error: any) {
        if (error.response?.status === 404) return [];
        throw error;
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

  const persistedDocuments = useMemo<Document[]>(() => {
    if (!Array.isArray(documentsData)) return [];
    return documentsData as Document[];
  }, [documentsData]);

  const portfolioItems = useMemo<PortfolioItem[]>(() => {
    if (!Array.isArray(portfolioData)) return [];
    return portfolioData as PortfolioItem[];
  }, [portfolioData]);

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
      hasResume:      persistedDocuments.some((d) => d.type === "resume"),
      hasLinks:       portfolioItems.length > 0,
    });
    return calcCompletionPct(buildCompletionItems(input));
  }, [profile, persistedSkills, persistedDocuments, portfolioItems]);

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

  useEffect(() => {
    if (Array.isArray(documentsData)) {
      setUploadedDocuments(documentsData as Document[]);
    }
  }, [documentsData]);

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
    documents: uploadedDocuments,
    availableSkills,
    profileCompletion,
    isNewUser,
    hasCompletedOnboarding,
    isLoading,
    isUpdating: profileMutation.isPending || skillsMutation.isPending,
    error: profileError,
    updateProfile,
    updateSkills,
    getDefaultFormValues,
    toggleSkill: (skill: string) =>
      setSelectedSkills((prev) =>
        prev.includes(skill)
          ? prev.filter((s) => s !== skill)
          : [...prev, skill],
      ),
  };
}
