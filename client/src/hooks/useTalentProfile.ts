import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { calculateProfileCompletion, ProfileCompletionData } from '@/lib/utils';
import { z } from 'zod';
import { Profile, InsertProfile, UserSkill, Skill, Document as DocumentType, PortfolioItem } from '@shared/schema';

// Profile Form Schema
export const profileFormSchema = z.object({
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(2, "Last name is required"),
  title: z.string().min(5, "Professional title is required"),
  bio: z.string().min(50, "Bio must be at least 50 characters"),
  location: z.string().min(2, "Location is required"),
  hourlyRate: z.string().min(1, "Hourly rate is required"),
  rateCurrency: z.string().default("USD"),
  availability: z.string().default("available"),
  phoneNumber: z.string().optional(),
  languages: z.array(z.string()).min(1, "At least one language is required"),
  timezone: z.string().default("Asia/Manila")
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
  type: 'resume' | 'video_intro' | 'cover_letter' | 'portfolio_file';
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

export function useTalentProfile() {
  const { user } = useAuth();
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [uploadedDocuments, setUploadedDocuments] = useState<Document[]>([]);

  // Fetch user profile
  const { data: profile, isLoading: profileLoading, error: profileError } = useQuery<Profile | null>({
    queryKey: ['/api/profiles/user', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const response = await fetch(`/api/profiles/user/${user.id}`);
      if (response.status === 404) return null; // Profile doesn't exist yet
      if (!response.ok) throw new Error('Failed to fetch profile');
      return response.json();
    },
    enabled: !!user?.id
  });

  // Fetch user skills
  const { data: userSkillsData, isLoading: skillsLoading } = useQuery({
    queryKey: ['/api/users', user?.id, 'skills'],
    queryFn: async () => {
      if (!user?.id) return [];
      const response = await fetch(`/api/users/${user.id}/skills?includeNames=true`);
      if (!response.ok) throw new Error('Failed to fetch user skills');
      return response.json();
    },
    enabled: !!user?.id
  });

  // Fetch user documents
  const { data: documentsData, isLoading: documentsLoading } = useQuery({
    queryKey: ['/api/documents'],
    enabled: !!user && user.userType === 'talent'
  });

  // Available skills for selection
  const { data: availableSkills = [] } = useQuery({
    queryKey: ['/api/skills']
  });

  // Calculate profile completion
  const profileCompletion = calculateProfileCompletion({
    firstName: profile?.firstName || undefined,
    lastName: profile?.lastName || undefined,
    title: profile?.title || undefined,
    bio: profile?.bio || undefined,
    location: profile?.location || undefined,
    hourlyRate: profile?.hourlyRate || undefined,
    selectedSkills,
    uploadedDocuments
  });

  // Determine if user is new
  const isNewUser = !profile || profileCompletion < 30;
  const hasCompletedOnboarding = profileCompletion >= 70;

  // Update local state when data is fetched
  useEffect(() => {
    if (userSkillsData && Array.isArray(userSkillsData)) {
      const skillNames = userSkillsData.map((us: any) => us.skill?.name).filter(Boolean);
      setSelectedSkills(skillNames);
    }
  }, [userSkillsData]);

  useEffect(() => {
    if (documentsData && Array.isArray(documentsData)) {
      setUploadedDocuments(documentsData);
    }
  }, [documentsData]);

  // Profile mutation
  const profileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      return profile 
        ? apiRequest('PUT', `/api/profile/${profile.id}`, data)
        : apiRequest('POST', '/api/profile', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/profile'] });
    }
  });

  // Skills mutation
  const skillsMutation = useMutation({
    mutationFn: async (skills: string[]) => {
      return apiRequest('POST', '/api/user-skills', { skills });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user-skills'] });
    }
  });

  // Document upload mutation
  const documentMutation = useMutation({
    mutationFn: async (document: Omit<Document, 'id' | 'createdAt'>) => {
      return apiRequest('POST', '/api/documents', document);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
    }
  });

  // Helper functions
  const toggleSkill = (skillName: string) => {
    setSelectedSkills(prev => 
      prev.includes(skillName)
        ? prev.filter(s => s !== skillName)
        : [...prev, skillName]
    );
  };

  const addDocument = (document: Document) => {
    setUploadedDocuments(prev => [...prev, document]);
  };

  const removeDocument = (documentId: string) => {
    setUploadedDocuments(prev => prev.filter(d => d.id !== documentId));
  };

  const updateProfile = async (data: ProfileFormData) => {
    return profileMutation.mutateAsync(data);
  };

  const updateSkills = async () => {
    return skillsMutation.mutateAsync(selectedSkills);
  };

  const uploadDocument = async (document: Omit<Document, 'id' | 'createdAt'>) => {
    return documentMutation.mutateAsync(document);
  };

  const talentProfileData: TalentProfileData = {
    profile: profile ? {
      id: profile.id,
      userId: profile.userId,
      firstName: profile.firstName,
      lastName: profile.lastName,
      title: profile.title || '',
      bio: profile.bio || '',
      location: profile.location || 'Manila, Philippines',
      hourlyRate: profile.hourlyRate || '',
      rateCurrency: profile.rateCurrency || 'USD',
      availability: profile.availability || 'available',
      phoneNumber: profile.phoneNumber || '',
      languages: profile.languages || ['English'],
      timezone: profile.timezone || 'Asia/Manila',
      profilePicture: profile.profilePicture || '',
      rating: profile.rating || '0',
      totalEarnings: profile.totalEarnings || '0',
      jobSuccessScore: profile.jobSuccessScore || 0,
      createdAt: profile.createdAt?.toString(),
      updatedAt: profile.updatedAt?.toString()
    } as TalentProfile : undefined,
    skills: selectedSkills,
    documents: uploadedDocuments,
    profileCompletion,
    isNewUser,
    hasCompletedOnboarding
  };

  return {
    // Data
    ...talentProfileData,
    availableSkills,
    
    // Loading states
    isLoading: profileLoading || skillsLoading || documentsLoading,
    isUpdating: profileMutation.isPending || skillsMutation.isPending || documentMutation.isPending,
    
    // Error states
    error: profileError,
    
    // Actions
    toggleSkill,
    addDocument,
    removeDocument,
    updateProfile,
    updateSkills,
    uploadDocument,
    
    // Form helpers
    getDefaultFormValues: (): ProfileFormData => ({
      firstName: profile?.firstName || '',
      lastName: profile?.lastName || '',
      title: profile?.title || '',
      bio: profile?.bio || '',
      location: profile?.location || 'Manila, Philippines',
      hourlyRate: profile?.hourlyRate || '',
      rateCurrency: profile?.rateCurrency || 'USD',
      availability: profile?.availability || 'available',
      phoneNumber: profile?.phoneNumber || '',
      languages: profile?.languages || ['English'],
      timezone: profile?.timezone || 'Asia/Manila'
    })
  };
}