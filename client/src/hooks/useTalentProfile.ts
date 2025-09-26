import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { authAPI } from "@/lib/api";
import { calculateProfileCompletion } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { Profile, Skill, PortfolioItem } from "@shared/schema";

// ---------------------
// Schema + Types
// ---------------------
export const profileFormSchema = z.object({
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(2, "Last name is required"),
  title: z.string().min(2, "Professional title is required"),
  bio: z.string().optional(),
  location: z.string().min(2, "Location is required"),
  hourlyRate: z.string().min(1, "Hourly rate is required"),
  rateCurrency: z.string().default("USD"),
  availability: z.string().default("available"),
  phoneNumber: z.string().optional(),
  languages: z.array(z.string()).min(1, "At least one language is required"),
  timezone: z.string().default("Asia/Manila"),
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
// Normalize profile payload for backend
// ---------------------
function normalizeProfileData(data: ProfileFormData) {
  return {
    first_name: data.firstName,
    last_name: data.lastName,
    title: data.title,
    bio: data.bio ?? "",
    location: data.location,
    hourly_rate: parseFloat(data.hourlyRate) || 0,
    rate_currency: data.rateCurrency,
    availability: data.availability,
    phone_number: data.phoneNumber ?? "",
    languages: data.languages,
    timezone: data.timezone,
  };
}

// ---------------------
// Hook Implementation
// ---------------------
export function useTalentProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
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
        return await authAPI.get("/api/profiles/me");
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
      return await authAPI.get(
        `/api/users/${user.id}/skills?includeNames=true`,
      );
    },
    enabled: !!user?.id,
  });

  // ---- Fetch documents ----
  const { data: documentsData } = useQuery({
    queryKey: ["/api/documents"],
    queryFn: async () => {
      if (!user || user.role !== "talent") return [];
      try {
        return await authAPI.get("/api/documents");
      } catch (error: any) {
        if (error.response?.status === 404) return [];
        throw error;
      }
    },
    enabled: !!user && user.role === "talent",
  });

  // ---- Fetch available skills ----
  const { data: availableSkills = [] } = useQuery({
    queryKey: ["/api/skills"],
    queryFn: async () => authAPI.get("/api/skills"),
  });

  // ---- Derived states ----
  const profileCompletion = calculateProfileCompletion({
    firstName: profile?.firstName,
    lastName: profile?.lastName,
    title: profile?.title,
    bio: profile?.bio,
    location: profile?.location,
    hourlyRate: profile?.hourlyRate,
    profilePicture: profile?.profilePicture,
    selectedSkills,
    uploadedDocuments,
    portfolioItems: [],
  });

  const isNewUser = !profile || profileCompletion < 30;
  const hasCompletedOnboarding = profileCompletion >= 70;
  const isLoading = profileLoading;

  // ---- Effects ----
  useEffect(() => {
    if (userSkillsData && Array.isArray(userSkillsData)) {
      const skillNames = userSkillsData
        .map((us: any) => us.skill?.name)
        .filter(Boolean);
      setSelectedSkills(skillNames);
    }
  }, [userSkillsData]);

  useEffect(() => {
    if (documentsData && Array.isArray(documentsData)) {
      setUploadedDocuments(documentsData);
    }
  }, [documentsData]);

  // ---- Mutations ----
  const profileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      const payload = normalizeProfileData(data);
      console.log("🚀 Profile Update Payload:", payload);
      return await authAPI.put("/api/profiles/me", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/me"] });
      toast({
        title: "Profile Saved!",
        description: "Your profile information has been saved successfully.",
      });
    },
    onError: (error: any) => {
      console.error("❌ Profile Update Error:", error);
      toast({
        title: "Profile Save Failed",
        description: error?.message || "Could not save profile",
        variant: "destructive",
      });
    },
  });

  const skillsMutation = useMutation({
    mutationFn: async (skillNames: string[]) => {
      if (!user?.id) throw new Error("User not authenticated");

      const skillsToAdd = skillNames
        .map((skillName) => {
          const skill = (availableSkills as Skill[]).find(
            (s) => s.name === skillName,
          );
          return skill
            ? { skillId: skill.id, level: "intermediate", yearsExperience: 1 }
            : null;
        })
        .filter(Boolean);

      console.log("🚀 Skills Update Payload:", skillsToAdd);

      return await Promise.all(
        skillsToAdd.map((skill) =>
          authAPI.post(`/api/users/${user.id}/skills`, skill),
        ),
      );
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
  const updateProfile = (data: ProfileFormData) =>
    profileMutation.mutateAsync(data);
  const updateSkills = () => skillsMutation.mutateAsync(selectedSkills);

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
      languages: profile?.languages || ["English"],
      timezone: profile?.timezone || "Asia/Manila",
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
