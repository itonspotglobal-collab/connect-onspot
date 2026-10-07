import { getSafeReturnTo } from "../../shared/internalRedirect";

/** PUBLIC_APP_URL is trusted configuration, never a request Host or dev-domain guess. */
export function getAppBaseUrl(): string {
  const configured = process.env.PUBLIC_APP_URL?.trim();
  if (!configured) throw new Error("PUBLIC_APP_URL is required for application email links");
  let url: URL;
  try { url = new URL(configured); } catch { throw new Error("PUBLIC_APP_URL must be an absolute application origin"); }
  if (/[\\\u0000-\u001f\u007f]/.test(configured) || url.username || url.password || url.search || url.hash || !/^\/*$/.test(url.pathname)
    || !["https:", "http:"].includes(url.protocol)
    || (url.protocol !== "https:" && (process.env.NODE_ENV === "production" || !["localhost","127.0.0.1","[::1]"].includes(url.hostname)))) {
    throw new Error("PUBLIC_APP_URL must be a trusted HTTPS origin (HTTP only for local development)");
  }
  return url.origin;
}

/** Protect saved/custom templates too, without rewriting intentional marketing links. */
export function canonicalizeApplicationEmailLinks(html: string): string {
  return html.replace(/(<a\b[^>]*\bhref\s*=\s*)(["'])([^"']*)\2/gi, (match, prefix, quote, href) => {
    let url: URL;
    try { url = new URL(href.replace(/&amp;|&#38;|&#x26;/gi, "&")); } catch { return match; }
    if (!["https:","http:"].includes(url.protocol)) return match;
    const knownHost = ["talent.onspotglobal.com","onspotglobal.com","www.onspotglobal.com","connect.onspotglobal.com","onspotglobal.replit.app"].includes(url.hostname);
    const appPath = /^\/(?:my-applications|contracts|hiring-pipeline|admin|client-profile|client|messages|organization-invite|organization-invitations|portal-login|sign-in|login|talent-profile|talent\/signup|settings|find-best-matches|get-hired|reset-password|forgot-password)(?:\/|$)/.test(url.pathname);
    if (!knownHost || !appPath) return match;
    const canonical = buildAppUrl(`${url.pathname}${url.search}${url.hash}`)
      .replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
    return `${prefix}${quote}${canonical}${quote}`;
  });
}

export function buildAppUrl(path: string): string {
  const safe = getSafeReturnTo(path);
  if (!safe) throw new Error("Application URL path must be internal");
  return new URL(safe, getAppBaseUrl()).href;
}

export function buildTalentApplicationsUrl(resource?: {offerId?:string;applicationId?:string;interviewId?:string}): string {
  const params = new URLSearchParams();
  if(resource?.offerId) params.set("offerId",resource.offerId);
  if(resource?.applicationId) params.set("applicationId",resource.applicationId);
  if(resource?.interviewId) params.set("interviewId",resource.interviewId);
  return buildAppUrl(`/my-applications${params.size ? `?${params}` : ""}`);
}

export function buildClientApplicationUrl(resource?: {jobId?:string|null;applicationId?:string|null;interviewId?:string|null}): string {
  const params = new URLSearchParams();
  if (resource?.jobId) params.set("jobId", resource.jobId);
  if (resource?.applicationId) params.set("applicationId", resource.applicationId);
  if (resource?.interviewId) params.set("interviewId", resource.interviewId);
  return buildAppUrl(`/client-profile${params.size ? `?${params}` : ""}`);
}
