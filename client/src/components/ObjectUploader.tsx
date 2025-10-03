import { useState, useRef } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { authAPI } from "@/lib/api";

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  onComplete?: (result: any) => void;
  buttonClassName?: string;
  children: ReactNode;
  enableTalentImport?: boolean;
  importType?: "resume" | "csv";
}

export function ObjectUploader({
  maxNumberOfFiles = 1,
  maxFileSize = 10485760, // 10MB default
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
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file.size > maxFileSize) {
      toast({
        title: "File Too Large",
        description: `Max allowed size is ${Math.round(maxFileSize / 1024 / 1024)}MB.`,
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // 1️⃣ Ask backend for a signed upload URL
      const response = await authAPI.post("/api/object-storage/upload-url", {
        fileName: file.name,
        contentType: file.type,
      });

      if (!response?.data?.url) {
        throw new Error("Upload URL not received from server");
      }

      const { url, method, headers, fileUrl } = response.data;

      // 2️⃣ Upload the file to signed URL
      const uploadRes = await fetch(url, {
        method: method || "PUT",
        headers: { ...(headers || {}), "Content-Type": file.type },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error(`Upload failed: ${uploadRes.statusText}`);
      }

      // 3️⃣ If enabled, trigger talent import
      let importResult = null;
      if (enableTalentImport) {
        try {
          let fileContentToSend;
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
              title: "Resume Imported",
              description:
                importResult.message || "Talent profile updated successfully.",
            });
          } else {
            throw new Error(importResult.error || "Import failed");
          }
        } catch (err: any) {
          toast({
            title: "Import Failed",
            description: err.message || "Resume uploaded but import failed.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Upload Successful",
          description: `${file.name} has been uploaded.`,
        });
      }

      // 4️⃣ Notify parent
      onComplete?.({
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
    } catch (err: any) {
      console.error("❌ Upload failed:", err);
      toast({
        title: "Upload Failed",
        description: err.message || "Server error while uploading file.",
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
        accept=".pdf,.doc,.docx,.csv"
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
