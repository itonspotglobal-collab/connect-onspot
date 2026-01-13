import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Upload, Copy, Check, Loader2, Image as ImageIcon, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AdminImageUploader() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show local preview
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    setUploadedUrl(null);
    setCopied(false);

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image under 5MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch("/api/admin/upload-image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Upload failed");
      }

      const data = await response.json();
      
      // Add cache-busting timestamp
      const urlWithCacheBust = `${data.url}?v=${Date.now()}`;
      setUploadedUrl(urlWithCacheBust);
      
      toast({
        title: "Upload successful",
        description: "Image URL is ready to copy",
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleCopyUrl = async () => {
    if (!uploadedUrl) return;
    
    try {
      await navigator.clipboard.writeText(uploadedUrl);
      setCopied(true);
      toast({
        title: "Copied",
        description: "URL copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Copy failed",
        description: "Please copy the URL manually",
        variant: "destructive",
      });
    }
  };

  const handleSelectFile = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.close()}
            title="Close this tab"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Image Uploader</h1>
            <p className="text-muted-foreground">
              Upload images for blog post covers
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Upload Image
            </CardTitle>
            <CardDescription>
              Select an image file (JPEG, PNG, GIF, WebP, AVIF) up to 5MB
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
              onChange={handleFileChange}
              className="hidden"
            />

            <Button
              onClick={handleSelectFile}
              disabled={isUploading}
              className="w-full"
              size="lg"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Select Image
                </>
              )}
            </Button>

            {previewUrl && (
              <div className="space-y-4">
                <div className="border rounded-lg overflow-hidden">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-48 object-cover"
                  />
                </div>

                {uploadedUrl && (
                  <div className="space-y-3">
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium mb-1">Public URL:</p>
                      <code className="text-xs break-all block text-muted-foreground">
                        {uploadedUrl}
                      </code>
                    </div>

                    <Button
                      onClick={handleCopyUrl}
                      variant="outline"
                      className="w-full"
                      size="lg"
                    >
                      {copied ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy URL
                        </>
                      )}
                    </Button>

                    <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        Paste this URL into the "Cover Image URL" field in the post editor.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
