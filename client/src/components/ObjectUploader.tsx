import { useState, useRef } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { authAPI } from "@/lib/api";

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  onGetUploadParameters: () => Promise<{
    method: "POST" | "PUT";
    url: string;
  }>;
  onComplete?: (result: any) => void;
  buttonClassName?: string;
  children: ReactNode;
  enableTalentImport?: boolean;
  importType?: "resume" | "csv";
}

export function ObjectUploader({
  maxNumberOfFiles = 1,
  maxFileSize = 10485760, // 10MB
  onGetUploadParameters,
  onComplete,
  buttonClassName,
  children,
  enableTalentImport = false,
  importType = "resume",
}: ObjectUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelection = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    console.log("📁 File selected:", file.name, file.size);

    if (file.size > maxFileSize) {
      toast({
        title: "File Too Large",
        description: `File size (${Math.round(
          file.size / 1024 / 1024
        )}MB) exceeds the max allowed size (${Math.round(
          maxFileSize / 1024 / 1024
        )}MB).`,
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      console.log("🔗 Requesting upload parameters...");
      const uploadParams = await onGetUploadParameters();

      // Ask backend for signed URL
      const response = await authAPI.post(uploadParams.url, {
        fileName: file.name,
        contentType: file.type,
      });

      if (!response?.data) {
        throw new Error("Invalid response from upload URL endpoint");
      }

      // ✅ Flexible mapping for different response shapes
      const uploadUrl =
        response.data.url || response.data.uploadUrl || response.data.signedUrl;
      const method = response.data.method || "PUT";
      const fileUrl = response.data.fileUrl || uploadUrl; // permanent URL if backend provides it
      const extraHeaders = response.data.headers || {};

      if (!uploadUrl) {
        throw new Error("Upload URL not returned by server");
      }

      console.log("✅ Got signed upload URL:", uploadUrl);

      // Upload to object storage
      const uploadResponse = await fetch(uploadUrl, {
        method,
        headers: {
          "Content-Type": file.type,
          ...extraHeaders,
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      console.log("🎉 File uploaded successfully!");

      // Optional: import talent profile data from file
      let importResult = null;
      if (enableTalentImport) {
        try {
          let fileContentToSend: string | undefined = undefined;
          if (file.name.toLowerCase().endsWith(".csv")) {
            fileContentToSend = await file.text();
          }

          const importResponse = await authAPI.post("/api/talent/import", {
            fileUrl,
            fileName: file.name,
            type: importType,
            fileContent: fileContentToSend,
          });

          importResult = importResponse.data;

          if (importResult.success) {
            toast({
              title: importResult.requiresManualUpdate
                ? "Resume Uploaded"
                : "Profile Updated",
              description:
                importResult.m
