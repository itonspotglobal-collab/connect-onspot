/**
 * Geographic routing configuration for dual SEO (US + Philippines)
 * 
 * US-facing pages: Client/lead acquisition (hire talent, services, etc.)
 * PH-facing pages: Operations/talent recruitment (jobs, careers, etc.)
 */

export interface GeoRoute {
  pattern: RegExp;
  region: "US" | "PH";
}

export const GEO_MAP: GeoRoute[] = [
  // Philippines-facing pages (operations/talent)
  { pattern: /^\/(jobs|careers|apply|operations|talent-portal)(\/|$)/i, region: "PH" },
  
  // US-facing pages (default - clients/leads)
  { pattern: /.*/, region: "US" }
];

/**
 * Determine geographic region for a given pathname
 */
export function getRegionForPath(pathname: string): "US" | "PH" {
  const route = GEO_MAP.find(r => r.pattern.test(pathname));
  return route?.region || "US";
}
