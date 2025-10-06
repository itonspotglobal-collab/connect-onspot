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
      console.log("🔗 Starting direct file upload...");

      // Create FormData for multipart upload
      const formData = new FormData();
      formData.append("file", file);

      console.log("📤 Uploading file directly to backend:", file.name, file.size);
      
      // Upload directly to backend (which handles object storage)
      const uploadResponse = await authAPI.post("/api/object-storage/upload", formData);

      if (!uploadResponse?.data?.success) {
        throw new Error(uploadResponse?.data?.error || "Upload failed");
      }

      const fileUrl = uploadResponse.data.fileUrl;
      console.log("🎉 File uploaded successfully! Path:", fileUrl);

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
                importResult.message ||
                "Your profile has been updated from the uploaded file.",
            });
          }
        } catch (importError: any) {
          console.error("❌ Talent import failed:", importError);
          toast({
            title: "Import Failed",
            description:
              importError.response?.data?.error ||
              "File uploaded but profile import failed. Please update manually.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Upload Successful",
          description: `${file.name} uploaded successfully.`,
        });
      }

      if (onComplete) {
        await onComplete({
          successful: [
            {
              name: file.name,
              type: file.type,
              size: file.size,
              uploadURL: fileUrl,
            },
          ],
          failed: [],
          importResult,
        });
      }
    } catch (error: any) {
      console.error("❌ Upload failed:", error);
      toast({
        title: "Upload Failed",
        description:
          error?.message ||
          "Failed to upload file. Please check server response and try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: "none" }}
        onChange={handleFileSelection}
        multiple={maxNumberOfFiles > 1}
        accept=".pdf,.doc,.docx,.csv,.mp4,.mov,.avi,.webm"
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
