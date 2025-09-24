import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import api from '@/lib/api';
import { calculateProfileCompletion, ProfileCompletionData } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
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
  const { toast } = useToast();
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [uploadedDocuments, setUploadedDocuments] = useState<Document[]>([]);

  // Fetch user profile using authAPI with enhanced error handling
  const { data: profileResponse, isLoading: profileLoading, error: profileError } = useQuery<{success: boolean, profile?: Profile} | null>({
    queryKey: ['/api/profiles/me'],
    queryFn: async () => {
      if (!user?.id) return null;
      
      // Debug authentication before making request
      const token = localStorage.getItem("onspot_jwt_token");
      const storedUser = localStorage.getItem("onspot_user");
      
      console.log('🔍 Profile API Debug:', {
        userId: user.id,
        hasToken: !!token,
        hasStoredUser: !!storedUser,
        environment: window.location.origin,
        apiEndpoint: '/api/profiles/me'
        // Token details intentionally excluded to prevent exposure
      });
      
      try {
        const response = await api.get('/api/profiles/me');
        console.log('✅ Profile API Success:', response.data);
        return response.data;
      } catch (error: any) {
        console.error('🚨 Profile API Error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          message: error.message,
          url: error.config?.url,
          method: error.config?.method,
          hasToken: !!token,
          environment: window.location.origin
          // Response data and headers excluded to prevent token/sensitive data exposure
        });
        
        if (error.response?.status === 404) {
          console.log('📝 Profile not found - will create on first save');
          return { success: false, profile: undefined }; // Profile doesn't exist yet
        }
        
        if (error.response?.status === 401) {
          console.warn('🔒 Authentication failed for profile request');
          // Clear invalid authentication
          localStorage.removeItem("onspot_jwt_token");
          localStorage.removeItem("onspot_user");
          window.dispatchEvent(new CustomEvent("jwt-expired"));
        }
        
        throw error;
      }
    },
    enabled: !!user?.id,
    retry: (failureCount, error: any) => {
      // Don't retry 401/403 errors (authentication issues)
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return false;
      }
      // Retry other errors up to 2 times
      return failureCount < 2;
    },
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000)
  });

  // Extract profile from response
  const profile = profileResponse?.profile;

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
    enabled: !!user && user.role === 'talent'
  });

  // Fetch portfolio items
  const { data: portfolioItems = [], isLoading: portfolioLoading } = useQuery({
    queryKey: ['/api/portfolio', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const response = await fetch(`/api/portfolio/user/${user.id}`);
      if (response.status === 404) return []; // No portfolio items yet
      if (!response.ok) throw new Error('Failed to fetch portfolio items');
      return response.json();
    },
    enabled: !!user?.id
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
    profilePicture: profile?.profilePicture || undefined,
    selectedSkills,
    uploadedDocuments,
    portfolioItems
  });

  // Determine if user is new and completion status
  const isNewUser = !profile || profileCompletion < 30;
  const hasCompletedOnboarding = profileCompletion >= 70;
  
  // Loading state for profile data
  const isLoading = profileLoading || skillsLoading || documentsLoading || portfolioLoading;

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
      // Use PUT /api/profiles/me - no need to send userId as it's from JWT token
      const response = await api.put('/api/profiles/me', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/profiles/me'] });
      
      // Show appropriate success message based on whether it's creating or updating
      if (!profile) {
        // New profile created
        toast({
          title: "Profile Created Successfully!",
          description: "Welcome to OnSpot! Your talent profile is now active.",
        });
      } else {
        // Existing profile updated
        toast({
          title: "Profile Updated!",
          description: "Your profile information has been saved successfully.",
        });
      }
    }
  });

  // Skills mutation
  const skillsMutation = useMutation({
    mutationFn: async (skillNames: string[]) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      // Convert skill names to skill IDs
      const skillPromises = skillNames.map(async (skillName) => {
        const skill = (availableSkills as any[]).find(s => s.name === skillName);
        if (!skill) throw new Error(`Skill not found: ${skillName}`);
        
        return apiRequest('POST', `/api/users/${user.id}/skills`, {
          skillId: skill.id,
          level: 'intermediate', // Default level
          yearsExperience: 1 // Default experience
        });
      });
      
      return Promise.all(skillPromises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users', user?.id, 'skills'] });
      
      // Show success message for skills update
      toast({
        title: "Skills Updated!",
        description: "Your skills have been saved successfully.",
      });
    }
  });

  // Document upload mutation
  const documentMutation = useMutation({
    mutationFn: async (document: Omit<Document, 'id' | 'createdAt'>) => {
      return apiRequest('POST', '/api/documents', document);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      
      // Show success message for document upload
      toast({
        title: "Document Uploaded!",
        description: "Your document has been uploaded successfully.",
      });
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

  // Form helpers - MUST be called at top level before return
  const getDefaultFormValues = useCallback((): ProfileFormData => ({
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
  }), [profile]);

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
    getDefaultFormValues
  };
}