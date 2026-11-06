import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, FileText, Loader2, Pencil, RotateCcw, Save, ShieldCheck } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { loadTalentAuth } from "@/components/TalentLoginModal";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

type ClientOrgFields = {
  legalEntityName: string | null;
  entityType: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateRegion: string | null;
  postalCode: string | null;
  country: string | null;
  signatoryName: string | null;
  signatoryTitle: string | null;
};

type TalentFields = {
  legalFullName: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateRegion: string | null;
  postalCode: string | null;
  country: string | null;
  taxIdLast4: string | null;
};

type ContractPartyFields = ClientOrgFields | TalentFields;
type Scope = "client" | "organization" | "talent";

const CLIENT_ORG_FIELDS: Array<{ key: keyof ClientOrgFields; label: string; placeholder?: string }> = [
  { key: "legalEntityName", label: "Legal entity name", placeholder: "Registered legal name" },
  { key: "entityType", label: "Entity type", placeholder: "Corporation, LLC, individual…" },
  { key: "addressLine1", label: "Address line 1", placeholder: "Street address" },
  { key: "addressLine2", label: "Address line 2", placeholder: "Suite, unit, floor (optional)" },
  { key: "city", label: "City" },
  { key: "stateRegion", label: "State / region" },
  { key: "postalCode", label: "Postal code" },
  { key: "country", label: "Country" },
  { key: "signatoryName", label: "Signatory name" },
  { key: "signatoryTitle", label: "Signatory title" },
];

const TALENT_FIELDS: Array<{ key: keyof TalentFields; label: string; placeholder?: string }> = [
  { key: "legalFullName", label: "Legal full name", placeholder: "Name used on agreements" },
  { key: "addressLine1", label: "Address line 1", placeholder: "Street address" },
  { key: "addressLine2", label: "Address line 2", placeholder: "Apartment, unit, etc. (optional)" },
  { key: "city", label: "City" },
  { key: "stateRegion", label: "State / region" },
  { key: "postalCode", label: "Postal code" },
  { key: "country", label: "Country" },
  { key: "taxIdLast4", label: "Tax ID — last 4 digits", placeholder: "Optional, four digits only" },
];

function blankValues(scope: Scope): ContractPartyFields {
  return scope === "talent"
    ? { legalFullName: null, addressLine1: null, addressLine2: null, city: null, stateRegion: null, postalCode: null, country: null, taxIdLast4: null }
    : { legalEntityName: null, entityType: null, addressLine1: null, addressLine2: null, city: null, stateRegion: null, postalCode: null, country: null, signatoryName: null, signatoryTitle: null };
}

function normalizeValues(scope: Scope, value: unknown): ContractPartyFields {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const defaults = blankValues(scope);
  return Object.fromEntries(
    Object.keys(defaults).map((key) => [key, typeof record[key] === "string" ? record[key] : null]),
  ) as ContractPartyFields;
}

function responseError(response: Response, body: any) {
  if (response.ok) return;
  throw new Error(body?.message || body?.error || `Could not save contract details (${response.status})`);
}

/**
 * Private-party details for agreement autofill. Mount this only on an owner page:
 * client profile, organization owner settings, or a TalentProfile section guarded
 * by showPrivateOwnerSections. The Talent endpoint is separate from public profiles.
 */
export function ContractPartyDetails({
  scope,
  organizationId,
  candidateId,
  canEdit = true,
}: {
  scope: Scope;
  organizationId?: string;
  candidateId?: string;
  canEdit?: boolean;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ContractPartyFields>(() => blankValues(scope));
  const [taxIdError, setTaxIdError] = useState("");
  const queryKey = scope === "client"
    ? ["/api/client-profile/me", "contract-party-details"]
    : scope === "organization"
      ? ["/api/organizations", organizationId, "contract-party-details"]
      : ["/api/candidates", candidateId, "contract-party-details"];
  const enabled = scope === "client" || (scope === "organization" ? Boolean(organizationId) : Boolean(candidateId && canEdit));

  const detailsQuery = useQuery<ContractPartyFields>({
    queryKey,
    enabled,
    queryFn: async () => {
      let result: unknown;
      if (scope === "client") {
        const response = await apiRequest("GET", "/api/client-profile/me");
        result = await response.json();
      } else if (scope === "organization") {
        const response = await apiRequest("GET", `/api/organizations/${encodeURIComponent(organizationId!)}`);
        const json = await response.json();
        result = json.organization ?? json;
      } else {
        // Candidate contract data is intentionally fetched only from the private
        // endpoint. Never read it from the ordinary/public candidate response.
        const auth = loadTalentAuth();
        const token = auth && auth.candidateId === candidateId
          ? auth.token
          : localStorage.getItem("onspot_jwt_token");
        const response = await fetch(`/api/candidates/${encodeURIComponent(candidateId!)}/contract-party-details`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: "include",
        });
        const json = await response.json().catch(() => ({}));
        responseError(response, json);
        result = json;
      }
      return normalizeValues(scope, result);
    },
    refetchOnMount: "always",
  });

  useEffect(() => {
    if (!editing && detailsQuery.data) setDraft(detailsQuery.data);
  }, [detailsQuery.data, editing]);

  const saveMutation = useMutation({
    mutationFn: async (values: ContractPartyFields) => {
      const payload = Object.fromEntries(
        Object.entries(values).map(([key, value]) => [key, value?.trim() || null]),
      );
      if (scope === "client") return apiRequest("PUT", "/api/client-profile/me", payload);
      if (scope === "organization") {
        return apiRequest("PATCH", `/api/organizations/${encodeURIComponent(organizationId!)}`, payload);
      }
      const auth = loadTalentAuth();
      const token = auth && auth.candidateId === candidateId
        ? auth.token
        : localStorage.getItem("onspot_jwt_token");
      const response = await fetch(`/api/candidates/${encodeURIComponent(candidateId!)}/contract-party-details`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const json = await response.json().catch(() => ({}));
      responseError(response, json);
      return json;
    },
    onSuccess: async () => {
      // Invalidate the existing parent profile/settings query. TanStack Query
      // prefix matching also refreshes the private child key without merging
      // its fields into the parent cache value.
      const refreshKey = scope === "client"
        ? ["/api/client-profile/me"]
        : scope === "organization"
          ? ["/api/organizations", organizationId]
          : queryKey;
      await queryClient.invalidateQueries({ queryKey: refreshKey });
      setEditing(false);
      setTaxIdError("");
      toast({ title: "Contract details saved", description: "These private details are ready for future agreement autofill." });
    },
    onError: (error: Error) => toast({
      title: "Could not save contract details",
      description: error.message,
      variant: "destructive",
    }),
  });

  if (!enabled) return null;

  const isTalent = scope === "talent";
  const fields = isTalent ? TALENT_FIELDS : CLIENT_ORG_FIELDS;
  const title = isTalent ? "Private contract details" : "Legal details for agreements";
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (scope === "talent") {
      const lastFour = (draft as TalentFields).taxIdLast4 ?? "";
      if (lastFour && !/^\d{4}$/.test(lastFour)) {
        setTaxIdError("Enter exactly four digits, or leave this optional field blank.");
        return;
      }
    }
    setTaxIdError("");
    saveMutation.mutate(draft);
  };

  return (
    <Card className="border-slate-200 shadow-sm dark:border-white/10">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#474ead]/10">
            {isTalent ? <ShieldCheck className="h-4 w-4 text-[#474ead]" /> : <FileText className="h-4 w-4 text-[#474ead]" />}
          </div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <p className="mt-1 max-w-2xl text-sm leading-5 text-slate-500">
              Used privately to prepare agreements and autofill party details. Not shown on public profiles.
            </p>
          </div>
        </div>
        {canEdit && !detailsQuery.isLoading && !detailsQuery.isError && (
          editing ? (
            <div className="flex shrink-0 gap-2">
              <Button type="button" size="sm" variant="outline" disabled={saveMutation.isPending} onClick={() => {
                setDraft(detailsQuery.data ?? blankValues(scope));
                setTaxIdError("");
                setEditing(false);
              }}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />Cancel
              </Button>
              <Button type="submit" form="contract-party-details-form" size="sm" disabled={saveMutation.isPending} className="bg-[#474ead] text-white hover:bg-[#3d439c]">
                {saveMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                Save
              </Button>
            </div>
          ) : (
            <Button type="button" size="sm" variant="outline" onClick={() => {
              setDraft(detailsQuery.data ?? blankValues(scope));
              setEditing(true);
            }}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />Edit
            </Button>
          )
        )}
      </CardHeader>
      <CardContent>
        {detailsQuery.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map(({ key }) => <Skeleton key={key} className="h-10 w-full" />)}
          </div>
        ) : detailsQuery.isError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <span>Private contract details could not be loaded.</span>
              <Button type="button" size="sm" variant="outline" onClick={() => void detailsQuery.refetch()}>Try again</Button>
            </AlertDescription>
          </Alert>
        ) : (
          <form id="contract-party-details-form" onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            {fields.map(({ key, label, placeholder }) => {
              const value = (draft as unknown as Record<string, string | null>)[key] ?? "";
              const isLastFour = key === "taxIdLast4";
              return (
                <div key={key} className={key === "addressLine1" || key === "addressLine2" ? "sm:col-span-2" : ""}>
                  <Label htmlFor={`contract-party-${scope}-${key}`}>{label}{isLastFour && <span className="ml-1 font-normal text-slate-400">Optional</span>}</Label>
                  {editing ? (
                    <Input
                      id={`contract-party-${scope}-${key}`}
                      className="mt-1"
                      value={value}
                      onChange={(event) => {
                        const next = event.target.value;
                        setDraft((current) => ({ ...current, [key]: next || null } as ContractPartyFields));
                        if (isLastFour) setTaxIdError("");
                      }}
                      placeholder={placeholder}
                      maxLength={isLastFour ? 4 : 160}
                      inputMode={isLastFour ? "numeric" : undefined}
                      autoComplete={key === "legalFullName" || key === "signatoryName" ? "name" : undefined}
                      aria-invalid={isLastFour && Boolean(taxIdError)}
                    />
                  ) : (
                    <p className="mt-1 min-h-5 break-words text-sm text-slate-800 dark:text-slate-200">
                      {value || <span className="text-slate-400">Not provided</span>}
                    </p>
                  )}
                  {isLastFour && editing && taxIdError && <p role="alert" className="mt-1 text-xs text-destructive">{taxIdError}</p>}
                </div>
              );
            })}
            {editing && (
              <p className="sm:col-span-2 text-xs leading-5 text-slate-500">
                You can clear any field. Do not enter a full tax ID or any payment, card, or bank details.
              </p>
            )}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
