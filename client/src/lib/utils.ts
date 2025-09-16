import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Profile completion calculation
export interface ProfileCompletionData {
  firstName?: string;
  lastName?: string;
  title?: string;
  bio?: string;
  location?: string;
  hourlyRate?: string;
  selectedSkills?: string[];
  uploadedDocuments?: Array<{ type: string }>;
}

export function calculateProfileCompletion(data: ProfileCompletionData): number {
  let completion = 0;
  
  // Basic info (30%)
  if (data.firstName && data.lastName) completion += 15;
  if (data.title) completion += 15;
  
  // Professional details (35%)
  if (data.bio && data.bio.length >= 50) completion += 15;
  if (data.location) completion += 10;
  if (data.hourlyRate) completion += 10;
  
  // Skills (15%)
  if (data.selectedSkills && data.selectedSkills.length >= 3) completion += 15;
  
  // Documents (20%)
  if (data.uploadedDocuments?.some(d => d.type === "resume")) completion += 10;
  if (data.uploadedDocuments?.some(d => d.type === "video_intro")) completion += 10;
  
  return Math.min(100, completion);
}
