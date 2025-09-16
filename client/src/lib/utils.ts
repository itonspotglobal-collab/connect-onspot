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
  profilePicture?: string;
  selectedSkills?: string[];
  uploadedDocuments?: Array<{ type: string }>;
  portfolioItems?: Array<{ id: string }>;
}

export function calculateProfileCompletion(data: ProfileCompletionData): number {
  let completion = 0;
  
  // Basic info (30%)
  if (data.firstName && data.lastName) completion += 10;
  if (data.title) completion += 10;
  if (data.profilePicture) completion += 10;
  
  // Professional details (30%)
  if (data.bio && data.bio.length >= 50) completion += 12;
  if (data.location) completion += 9;
  if (data.hourlyRate) completion += 9;
  
  // Skills (15%)
  if (data.selectedSkills && data.selectedSkills.length >= 3) completion += 15;
  
  // Portfolio (15%)
  if (data.portfolioItems && data.portfolioItems.length >= 1) completion += 15;
  
  // Documents (10%)
  if (data.uploadedDocuments?.some(d => d.type === "resume")) completion += 6;
  if (data.uploadedDocuments?.some(d => d.type === "video_intro")) completion += 4;
  
  return Math.min(100, completion);
}
