/**
 * useCandidateResume — canonical hook for reading and mutating a candidate's resume.
 *
 * Single source of truth: candidates.resume_url / candidates.resume_file_name
 * Single upload API:      POST   /api/candidates/:id/resume
 * Single delete API:      DELETE /api/candidates/:id/resume
 *
 * On every mutation, ALL query-key variants that represent the same candidate are
 * invalidated so every page (TalentProfile, ProfileSettings, GetHired) reflects the
 * change without a hard refresh:
 *
 *   ["/api/candidates", candidateId]    — TalentProfile
 *   ["candidate-profile", candidateId]  — ProfileSettings / useCandidateProfileSettings
 *   ["/api/talent/me/resume-status"]    — GetHired / useTalentProfile
 */

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { loadTalentAuth } from "@/components/TalentLoginModal";
import { setCandidateResumeCache, invalidateCandidateQueries } from "@/lib/candidateCache";
import { candidateQueryKeys } from "@/lib/candidateQueryKeys";

export interface CandidateResumeState {
  resumeUrl: string | null;
  resumeFileName: string | null;
  isLoading: boolean;
  isUploading: boolean;
  isDeleting: boolean;
  uploadResume: (file: File) => Promise<void>;
  deleteResume: () => Promise<void>;
  refreshResume: () => Promise<void>;
}

/** @deprecated Use invalidateCandidateQueries from candidateCache instead. */
export async function invalidateAllCandidateResumeKeys(candidateId?: string | null) {
  if (candidateId) {
    await invalidateCandidateQueries(queryClient, candidateId);
  } else {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/talent/me/resume-status"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] }),
      queryClient.invalidateQueries({ queryKey: ["candidate-profile"] }),
    ]);
  }
}

export function useCandidateResume(candidateId: string | null | undefined): CandidateResumeState {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: candidate, isLoading } = useQuery<any>({
    queryKey: ["/api/candidates", candidateId],
    queryFn: async () => {
      if (!candidateId) return null;
      const res = await fetch(`/api/candidates/${candidateId}`);
      if (!res.ok) throw new Error("Failed to load candidate");
      return res.json();
    },
    enabled: !!candidateId,
    staleTime: 30_000,
  });

  const getAuthHeader = (): string => {
    const talentAuth = loadTalentAuth();
    return talentAuth?.token
      ? `Bearer ${talentAuth.token}`
      : `Bearer ${localStorage.getItem("onspot_jwt_token") || ""}`;
  };

  const uploadResume = async (file: File): Promise<void> => {
    if (!candidateId) return;
    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append("resume", file);
      const res = await fetch(`/api/candidates/${candidateId}/resume`, {
        method: "POST",
        headers: { Authorization: getAuthHeader() },
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || "Upload failed");
      }
      const result = await res.json();
      setCandidateResumeCache(queryClient, candidateId, result);
      void invalidateCandidateQueries(queryClient, candidateId);
      toast({ title: "Resume saved", description: "Your resume has been updated." });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const deleteResume = async (): Promise<void> => {
    if (!candidateId) return;
    if (!window.confirm("Remove your resume? This cannot be undone.")) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/resume`, {
        method: "DELETE",
        headers: { Authorization: getAuthHeader() },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || "Delete failed");
      }
      setCandidateResumeCache(queryClient, candidateId, { resumeUrl: null, resumeFileName: null });
      void invalidateCandidateQueries(queryClient, candidateId);
      toast({ title: "Resume removed." });
    } catch (err: any) {
      toast({ title: "Removal failed", description: err.message, variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const refreshResume = async (): Promise<void> => {
    if (candidateId) await invalidateCandidateQueries(queryClient, candidateId);
  };

  return {
    resumeUrl: candidate?.resumeUrl ?? null,
    resumeFileName: candidate?.resumeFileName ?? null,
    isLoading,
    isUploading,
    isDeleting,
    uploadResume,
    deleteResume,
    refreshResume,
  };
}
