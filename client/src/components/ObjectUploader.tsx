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
  enableTalentImport?: boolean; // If true, automatically parse and import talent profile data
  importType?: 'resume' | 'csv'; // Type of file being imported for talent profile
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
  enableTalentImport = false,
  importType = 'resume',
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

      // Check if response and response.data exist
      if (!response || !response.data) {
        throw new Error("Invalid response from upload URL endpoint");
      }

      const { url, method, headers, fileUrl } = response.data;
      
      // Validate required response properties
      if (!url) {
        throw new Error("Upload URL not returned by server");
      }

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

      // If talent import is enabled, call the import endpoint
      let importResult = null;
      if (enableTalentImport) {
        try {
          console.log("📊 Initiating talent profile import...");
          
          // For CSV files, read the content and send it with the request
          // This allows parsing even in development where object storage is simulated
          let fileContentToSend = undefined;
          const fileExtension = file.name.toLowerCase().split('.').pop();
          
          if (fileExtension === 'csv') {
            console.log("📖 Reading CSV file content...");
            fileContentToSend = await file.text();
            console.log(`✅ CSV content read (${fileContentToSend.length} bytes)`);
          }
          
          const importResponse = await authAPI.post('/api/talent/import', {
            fileUrl: fileUrl || url,
            fileName: file.name,
            type: importType,
            fileContent: fileContentToSend // Include file content for CSV files
          });

          importResult = importResponse.data;
          console.log("✅ Talent profile import completed:", importResult);

          // Show success toast for import
          if (importResult.success) {
            toast({
              title: importResult.requiresManualUpdate ? "Resume Uploaded" : "Profile Updated",
              description: importResult.message || "Your talent profile has been updated from the uploaded file.",
            });
          }
        } catch (importError: any) {
          console.error("❌ Talent import failed:", importError);
          // Show error toast but don't fail the entire upload
          toast({
            title: "Import Failed",
            description: importError.response?.data?.error || "File uploaded but profile import failed. Please update manually.",
            variant: "destructive",
          });
        }
      } else {
        // Show standard upload success toast if not importing
        toast({
          title: "Upload Successful",
          description: `${file.name} has been uploaded successfully.`,
        });
      }

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
          importResult, // Include import result if available
        };
        
        await onComplete(result);
      }

    } catch (error: any) {
      console.error("❌ Upload failed:", error);
      
      // Provide user-friendly error messages
      let errorMessage = "Failed to upload file. Please try again.";
      
      if (error.message) {
        if (error.message.includes("Upload URL not returned")) {
          errorMessage = "Server error: Upload URL not received. Please try again.";
        } else if (error.message.includes("Invalid response")) {
          errorMessage = "Server communication error. Please try again.";
        } else if (error.message.includes("Upload failed:")) {
          errorMessage = `Upload failed: ${error.message.split(': ')[1] || 'Unknown error'}`;
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Upload Failed",
        description: errorMessage,
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