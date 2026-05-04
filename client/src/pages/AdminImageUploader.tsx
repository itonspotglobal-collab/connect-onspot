import * as React from "react";

type UploadResponse = {
  proxyUrl: string;      // e.g. "/public/blog-images/cover-xxxx.png"
  directGcsUrl?: string; // we IGNORE this
};

export default function AdminImageUploader() {
  const [isUploading, setIsUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setCopied(false);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/admin/upload-image", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `Upload failed (${res.status}): ${text.slice(0, 200) || "Unknown"}`
        );
      }

      const json = (await res.json()) as UploadResponse;

      // IMPORTANT: we ONLY use proxyUrl – never directGcsUrl
      if (!json.proxyUrl) {
        throw new Error("Server response missing proxyUrl field");
      }

      // Always convert to an absolute production URL so the value copied into
      // the editor is publicly reachable by Facebook / Slack crawlers.
      const proxyPath = json.proxyUrl.startsWith("/")
        ? json.proxyUrl
        : `/${json.proxyUrl}`;
      setImageUrl(`https://www.onspotglobal.com${proxyPath}`);
    } catch (err: any) {
      console.error("Image upload error", err);
      setError(err.message || "Upload failed");
      setImageUrl(null);
    } finally {
      setIsUploading(false);
      // reset the file input so we can choose same file again if we want
      e.target.value = "";
    }
  }

  async function handleCopy() {
    if (!imageUrl) return;
    try {
      await navigator.clipboard.writeText(imageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Clipboard error", err);
      setError("Could not copy URL to clipboard");
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold mb-1">Image Uploader</h1>
      <p className="text-sm text-neutral-500 mb-6">
        Upload images for blog post covers.
      </p>

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-medium">Upload Image</h2>
        <p className="mb-4 text-xs text-neutral-500">
          Select an image file (JPEG, PNG, GIF, WebP, AVIF) up to 5MB.
        </p>

        <label className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 cursor-pointer">
          {isUploading ? "Uploading..." : "Select Image"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
            className="hidden"
            onChange={handleFileChange}
            disabled={isUploading}
          />
        </label>

        {error && (
          <p className="mt-4 text-sm text-red-600">
            {error}
          </p>
        )}

        {/* Preview + URL block */}
        {imageUrl && (
          <div className="mt-6 space-y-4">
            <p className="text-sm font-medium text-neutral-700">
              Upload complete! Preview:
            </p>

            <div className="flex justify-center">
              <img
                src={imageUrl}
                alt="Uploaded preview"
                className="max-h-72 rounded-lg border object-contain"
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs text-neutral-500">
                Use this URL in the “Cover Image URL” field when editing a post:
              </p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  className="w-full rounded-md border px-2 py-1 text-xs font-mono bg-neutral-50"
                  value={imageUrl}
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="rounded-md border px-3 py-1 text-xs font-medium hover:bg-neutral-50"
                >
                  {copied ? "Copied!" : "Copy URL"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
