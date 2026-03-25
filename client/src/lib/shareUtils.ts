export function buildJobUrl(jobId: string): string {
  return `${window.location.origin}/find-work/job/${jobId}`;
}

export function buildLinkedInShareUrl(jobUrl: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(jobUrl)}`;
}

export function buildFacebookShareUrl(jobUrl: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(jobUrl)}`;
}

export function buildTwitterShareUrl(jobUrl: string, title: string): string {
  return `https://twitter.com/intent/tweet?url=${encodeURIComponent(jobUrl)}&text=${encodeURIComponent(title)}`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.left = "-9999px";
    document.body.appendChild(el);
    el.focus();
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

export async function shareNative(data: ShareData): Promise<boolean> {
  if (!navigator.share) return false;
  try {
    await navigator.share(data);
    return true;
  } catch {
    return false;
  }
}
