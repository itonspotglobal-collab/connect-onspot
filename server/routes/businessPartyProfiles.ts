import type { RequestHandler } from "express";
import { z } from "zod";
import { businessPartyColumns, businessPartyShape } from "../../shared/contractPartyDetails";

type Query = (sql: string, params: any[]) => Promise<{ rows: any[] }>;
type Mapper = (row: any, includePartyDetails?: boolean) => any;
const clientColumns = {
  companyName: "company_name", contactPerson: "contact_person", email: "email",
  phoneNumber: "phone_number", website: "website", industry: "industry",
  companySize: "company_size", location: "location", about: "about",
  hiringNeeds: "hiring_needs", timezone: "timezone", ...businessPartyColumns,
};
const clientSchema = z.object({
  ...Object.fromEntries(Object.keys(clientColumns).map(key =>
    [key, z.string().max(10000).nullable().optional()])),
  ...businessPartyShape,
}).strict();
const optionalText = (max: number) => z.string().trim().max(max).optional();
const organizationSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  website: optionalText(2048), industry: optionalText(120),
  companySize: optionalText(80), location: optionalText(200),
  about: optionalText(5000), timezone: optionalText(120), ...businessPartyShape,
}).strict();
const organizationColumns = {
  name: "name", website: "website", industry: "industry", companySize: "company_size",
  location: "location", about: "about", timezone: "timezone", ...businessPartyColumns,
};
function updateStatement(table: string, columns: Record<string, string>, payload: Record<string, unknown>, ownerColumn: string, owner: string) {
  const fields = Object.entries(payload).filter(([, value]) => value !== undefined);
  if (!fields.length) return null;
  const params: any[] = fields.map(([, value]) => value);
  const sets = fields.map(([key], index) => `${columns[key]} = $${index + 1}`);
  params.push(owner);
  return { sql: `UPDATE ${table} SET ${sets.join(", ")}, updated_at = NOW()
    WHERE ${ownerColumn} = $${params.length} RETURNING *`, params };
}
/** Mounted behind the existing authenticateJWT + requireClient middleware. */
export function createClientProfileUpdateHandler(query: Query, mapRow: Mapper): RequestHandler {
  return async (req: any, res) => {
    if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
    const parsed = clientSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid profile fields" });
    const update = updateStatement("client_profiles", clientColumns, parsed.data, "user_id", req.user.id);
    if (!update) return res.status(400).json({ error: "No fields provided" });
    try {
      const result = await query(update.sql, update.params);
      if (!result.rows[0]) return res.status(404).json({ error: "Profile not found" });
      return res.json(mapRow(result.rows[0]));
    } catch {
      return res.status(500).json({ error: "Unable to save profile" });
    }
  };
}
/** Existing owner authority stays authoritative; no field may change membership. */
export function createOrganizationUpdateHandler(
  query: Query, requireOwner: (id: string, userId: string) => Promise<any>, mapRow: Mapper,
): RequestHandler {
  return async (req: any, res) => {
    if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
    try {
      if (!await requireOwner(req.params.organizationId, req.user.id)) {
        return res.status(403).json({ error: "Only organization owners can update organization details" });
      }
      const parsed = organizationSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid organization fields" });
      const payload: Record<string, unknown> = { ...parsed.data };
      // Preserve the pre-existing empty-string-to-NULL behavior for optional org fields.
      for (const key of ["website", "industry", "companySize", "location", "about", "timezone"]) {
        if (payload[key] === "") payload[key] = null;
      }
      const update = updateStatement("organizations", organizationColumns, payload, "id", req.params.organizationId);
      if (!update) return res.status(400).json({ error: "No fields provided to update" });
      const result = await query(update.sql, update.params);
      if (!result.rows[0]) return res.status(404).json({ error: "Organization not found" });
      return res.json({ organization: mapRow(result.rows[0], true) });
    } catch {
      return res.status(500).json({ error: "Failed to update organization" });
    }
  };
}
