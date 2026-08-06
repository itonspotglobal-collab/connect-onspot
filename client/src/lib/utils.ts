import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import {
  buildCompletionItems,
  calcCompletionPct,
  profileStrengthFromProfile,
} from "@/lib/profileCompletion";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ---------------------------------------------------------------------------
// Profile completion — DEPRECATED interface kept for backward compatibility.
// All new code should import directly from "@/lib/profileCompletion".
// ---------------------------------------------------------------------------
export interface ProfileCompletionData {
  firstName?: string;
  lastName?: string;
  title?: string;
  bio?: string;
  location?: string;
  hourlyRate?: string;
  profilePicture?: string;
  selectedSkills?: string[];
  uploadedDocuments?: Array<{ type: string }>;
  portfolioItems?: Array<{ id: string }>;
}

/** @deprecated Import from "@/lib/profileCompletion" instead. */
export function calculateProfileCompletion(data: ProfileCompletionData): number {
  const input = profileStrengthFromProfile({
    firstName:      data.firstName ?? null,
    lastName:       data.lastName ?? null,
    title:          data.title ?? null,
    bio:            data.bio ?? null,
    location:       data.location ?? null,
    profilePicture: data.profilePicture ?? null,
    hasSkills:      (data.selectedSkills?.length ?? 0) > 0,
    hasResume:      data.uploadedDocuments?.some((d) => d.type === "resume") ?? false,
    hasLinks:       (data.portfolioItems?.length ?? 0) > 0,
  });
  return calcCompletionPct(buildCompletionItems(input));
}
