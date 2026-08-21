import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Building2, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type OrganizationForm = {
  name: string;
  website: string;
  industry: string;
  companySize: string;
  location: string;
  about: string;
  timezone: string;
};

const initialForm: OrganizationForm = {
  name: "",
  website: "",
  industry: "",
  companySize: "",
  location: "",
  about: "",
  timezone: "",
};

export default function OrganizationCreate() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [form, setForm] = useState<OrganizationForm>(initialForm);

  const createOrganization = useMutation({
    mutationFn: async (payload: OrganizationForm) => {
      const response = await apiRequest("POST", "/api/organizations", payload);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/me"] });
      toast({
        title: "Organization created",
        description: `${data.organization.name} is ready for your team.`,
      });
      navigate(`/organization/${data.organization.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Organization could not be created",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateField = (field: keyof OrganizationForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (createOrganization.isPending) return;

    const name = form.name.trim();
    if (!name) {
      toast({
        title: "Organization name required",
        description: "Enter a name before creating your organization.",
        variant: "destructive",
      });
      return;
    }

    createOrganization.mutate({
      ...form,
      name,
      website: form.website.trim(),
      industry: form.industry.trim(),
      companySize: form.companySize.trim(),
      location: form.location.trim(),
      about: form.about.trim(),
      timezone: form.timezone.trim(),
    });
  };

  return (
    <div className="mx-auto w-full max-w-4xl">
      <Link
        href="/dashboard"
        className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>

      <div className="mb-7 flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#474ead]/10 text-[#474ead]">
          <Building2 className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#474ead]">
            Organization workspace
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
            Create your organization
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Set up a shared company space while keeping your existing Client account and jobs exactly as they are.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Company details</CardTitle>
            <p className="text-sm text-slate-500">Start with the information your team will recognize.</p>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="organization-name">Organization name <span className="text-red-500">*</span></Label>
              <Input
                id="organization-name"
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="e.g. Acme Corporation"
                maxLength={200}
                autoFocus
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="organization-website">Website</Label>
              <Input
                id="organization-website"
                type="url"
                value={form.website}
                onChange={(event) => updateField("website", event.target.value)}
                placeholder="https://example.com"
                maxLength={2048}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="organization-industry">Industry</Label>
              <Input
                id="organization-industry"
                value={form.industry}
                onChange={(event) => updateField("industry", event.target.value)}
                placeholder="e.g. Technology"
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="organization-size">Company size</Label>
              <Input
                id="organization-size"
                value={form.companySize}
                onChange={(event) => updateField("companySize", event.target.value)}
                placeholder="e.g. 11–50 employees"
                maxLength={80}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="organization-location">Location</Label>
              <Input
                id="organization-location"
                value={form.location}
                onChange={(event) => updateField("location", event.target.value)}
                placeholder="e.g. Singapore"
                maxLength={200}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="organization-timezone">Timezone</Label>
              <Input
                id="organization-timezone"
                value={form.timezone}
                onChange={(event) => updateField("timezone", event.target.value)}
                placeholder="e.g. Asia/Singapore"
                maxLength={120}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="organization-about">About the organization</Label>
              <Textarea
                id="organization-about"
                value={form.about}
                onChange={(event) => updateField("about", event.target.value)}
                placeholder="Share a short description for future organization members."
                maxLength={5000}
                rows={5}
              />
              <p className="text-xs text-slate-400">{form.about.length}/5000</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => navigate("/dashboard")} disabled={createOrganization.isPending}>
            Cancel
          </Button>
          <Button type="submit" className="bg-[#474ead] text-white hover:bg-[#3a3d8f]" disabled={createOrganization.isPending}>
            {createOrganization.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {createOrganization.isPending ? "Creating organization…" : "Create organization"}
          </Button>
        </div>
      </form>
    </div>
  );
}