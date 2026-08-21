import { useLocation, useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Building2, Globe2, Users } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type OrganizationResponse = {
  organization: {
    id: string;
    name: string;
    website: string | null;
    industry: string | null;
    companySize: string | null;
    location: string | null;
    about: string | null;
    timezone: string | null;
    createdAt: string | null;
  };
  membership: {
    role: string;
    status: string;
    joinedAt: string | null;
  };
};

export default function OrganizationDetail() {
  const { organizationId } = useParams<{ organizationId: string }>();
  const [, navigate] = useLocation();
  const { data, isLoading, isError } = useQuery<OrganizationResponse>({
    queryKey: ["/api/organizations", organizationId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/organizations/${organizationId}`);
      return response.json();
    },
    enabled: Boolean(organizationId),
  });

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-36 w-full rounded-2xl" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (isError || !data?.organization) {
    return (
      <div className="mx-auto flex min-h-[55vh] w-full max-w-xl items-center justify-center">
        <Card className="w-full border-slate-200 shadow-sm">
          <CardContent className="p-8 text-center">
            <Building2 className="mx-auto h-10 w-10 text-slate-300" />
            <h1 className="mt-4 text-xl font-semibold text-slate-900">Organization not found</h1>
            <p className="mt-2 text-sm text-slate-500">
              This organization may no longer be available to your account.
            </p>
            <Button className="mt-6" onClick={() => navigate("/dashboard")}>Back to dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const organization = data.organization;
  const details = [
    ["Industry", organization.industry],
    ["Company size", organization.companySize],
    ["Location", organization.location],
    ["Timezone", organization.timezone],
  ].filter(([, value]) => value);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <Link
        href="/dashboard"
        className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>

      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <div className="bg-gradient-to-br from-[#474ead] to-[#6366c8] px-6 py-8 text-white sm:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15">
                <Building2 className="h-7 w-7" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">Organization workspace</p>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight">{organization.name}</h1>
                <p className="mt-2 text-sm text-white/75">
                  You are an {data.membership.role} of this organization.
                </p>
              </div>
            </div>
            <span className="inline-flex w-fit items-center rounded-full bg-white/15 px-3 py-1 text-xs font-semibold capitalize">
              {data.membership.status}
            </span>
          </div>
        </div>

        <CardContent className="grid gap-8 p-6 sm:p-8 md:grid-cols-[1.25fr_1fr]">
          <div>
            <h2 className="text-base font-semibold text-slate-900">About</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
              {organization.about || "Add a short description of your organization when you are ready."}
            </p>

            {details.length > 0 && (
              <div className="mt-7 grid gap-4 sm:grid-cols-2">
                {details.map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
                    <p className="mt-1 text-sm text-slate-800">{value}</p>
                  </div>
                ))}
              </div>
            )}

            {organization.website && (
              <a
                href={organization.website}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-[#474ead] hover:underline"
              >
                <Globe2 className="h-4 w-4" />
                Visit organization website
              </a>
            )}
          </div>

          <Card className="border-dashed border-slate-300 bg-slate-50/70 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-5 w-5 text-[#474ead]" />
                Team members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-slate-500">
                Invite and manage team members from this workspace in a future update.
              </p>
              <Button variant="outline" className="mt-5 w-full" disabled>
                Team management coming soon
              </Button>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}