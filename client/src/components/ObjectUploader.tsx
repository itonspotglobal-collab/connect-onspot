import { useState, useRef } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { authAPI } from "@/lib/api";

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  onGetUploadParameters: () => Promise<{
    method: "PUT";
    url: string;
  }>;
  onComplete?: (result: any) => void;
  buttonClassName?: string;
  children: ReactNode;
}

/**
 * A simple file upload component that uses native file input for better reliability.
 * 
 * Features:
 * - Simple file selection via native file input
 * - Direct upload to object storage
 * - Progress indication
 * - Error handling
 */
export function ObjectUploader({
  maxNumberOfFiles = 1,
  maxFileSize = 10485760, // 10MB default
  onGetUploadParameters,
  onComplete,
  buttonClassName,
  children,
}: ObjectUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleButtonClick = () => {
    console.log("🎯 ObjectUploader button clicked, opening file picker...");
    fileInputRef.current?.click();
  };

  const handleFileSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0]; // Take first file for single upload
    console.log("📁 File selected:", file.name, "Size:", file.size);

    // Validate file size
    if (file.size > maxFileSize) {
      toast({
        title: "File Too Large",
        description: `File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds the maximum allowed size (${Math.round(maxFileSize / 1024 / 1024)}MB).`,
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Get upload parameters endpoint from onGetUploadParameters 
      console.log("🔗 Getting upload parameters...");
      const uploadParams = await onGetUploadParameters();
      
      console.log("📤 Requesting signed upload URL from:", uploadParams.url);
      
      // Request signed upload URL from backend
      const response = await authAPI.post(uploadParams.url, {
        fileName: file.name,
        contentType: file.type,
      });

      const { url, method, headers, fileUrl } = response.data;
      console.log("✅ Got signed upload URL:", url);

      // Upload file directly to the signed URL
      console.log("⬆️ Uploading file to object storage...");
      const uploadResponse = await fetch(url, {
        method: method || 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
          ...(headers || {}),
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      console.log("🎉 File uploaded successfully!");

      // Call completion callback with result structure matching original Uppy format
      if (onComplete) {
        const result = {
          successful: [{
            name: file.name,
            type: file.type,
            size: file.size,
            uploadURL: fileUrl || url, // Use permanent fileUrl if available, fallback to upload URL
          }],
          failed: [],
        };
        
        await onComplete(result);
      }

      toast({
        title: "Upload Successful",
        description: `${file.name} has been uploaded successfully.`,
      });

    } catch (error: any) {
      console.error("❌ Upload failed:", error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={handleFileSelection}
        multiple={maxNumberOfFiles > 1}
        accept=".pdf,.doc,.docx,.mp4,.mov,.avi,.webm"
      />
      
      <Button 
        type="button" 
        onClick={handleButtonClick}
        className={buttonClassName}
        disabled={isUploading}
      >
        {isUploading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
            Uploading...
          </>
        ) : (
          children
        )}
      </Button>
    </div>
  );
}