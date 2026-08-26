import { useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  User,
  Mail,
  Building2,
  Phone,
  Globe,
  MapPin,
  Clock,
  Briefcase,
  Users,
  Camera,
  Loader2,
  LogOut,
  Plus,
  ChevronRight,
  Crown,
  Pencil,
  Save,
  X,
  AlertTriangle,
} from "lucide-react";

// ── Type Definitions ───────────────────────────────────────────────────────────

interface AccountInfo {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  company: string | null;
  createdAt: string;
}

interface ClientProfileData {
  id: string;
  companyName: string | null;
  contactPerson: string | null;
  email: string | null;
  phoneNumber: string | null;
  website: string | null;
  industry: string | null;
  companySize: string | null;
  location: string | null;
  about: string | null;
  hiringNeeds: string | null;
  timezone: string | null;
}

interface OrgMembership {
  organization: {
    id: string;
    name: string;
    website: string | null;
    industry: string | null;
    companySize: string | null;
    location: string | null;
    about: string | null;
    timezone: string | null;
  };
  membership: { role: string; status: string };
}

interface OrgInvitation {
  id: string;
  organizationName?: string;
  status: string;
}

// ── Small helpers ──────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#474ead]/10">
        <Icon className="h-4 w-4 text-[#474ead]" />
      </div>
      <div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white leading-tight">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</Label>
      <p className="text-sm text-slate-800 dark:text-slate-200 min-h-[32px] flex items-center">
        {value || <span className="text-slate-400 italic">Not set</span>}
      </p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ClientSettings() {
  const { user, logout, refreshAuth } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const photoInputRef = useRef<HTMLInputElement>(null);

  // ── Account identity edit state ────────────────────────────────────────────
  const [editingAccount, setEditingAccount] = useState(false);
  const [accountForm, setAccountForm] = useState({ firstName: "", lastName: "" });

  // ── Company profile edit state ─────────────────────────────────────────────
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState<Partial<ClientProfileData>>({});

  // ── Org edit state ─────────────────────────────────────────────────────────
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const [orgForm, setOrgForm] = useState<{
    name: string; website: string; industry: string; companySize: string;
    location: string; about: string; timezone: string;
  }>({ name: "", website: "", industry: "", companySize: "", location: "", about: "", timezone: "" });

  // ── Data queries ───────────────────────────────────────────────────────────
  const { data: account, isLoading: accountLoading } = useQuery<AccountInfo>({
    queryKey: ["/api/account/me"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/account/me");
      return res.json();
    },
  });

  const { data: profilePicture } = useQuery<string | null>({
    queryKey: ["/api/profile-picture", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const res = await fetch(`/api/profile-picture/${user.id}`);
      return res.ok ? `/api/profile-picture/${user.id}?v=${Date.now()}` : null;
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  const { data: clientProfile, isLoading: profileLoading } = useQuery<ClientProfileData>({
    queryKey: ["/api/client-profile/me"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/client-profile/me");
      return res.json();
    },
  });

  const { data: organizations = [], isLoading: orgsLoading } = useQuery<OrgMembership[]>({
    queryKey: ["/api/organizations/me"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/organizations/me");
      return res.json();
    },
  });

  const { data: pendingInvitations = [] } = useQuery<OrgInvitation[]>({
    queryKey: ["/api/organization-invitations"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/organization-invitations");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const updateAccountMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string }) => {
      const res = await apiRequest("PATCH", "/api/account/me", data);
      return res.json();
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["/api/account/me"] });
      // Sync localStorage so AuthContext.refreshAuth picks up the new name
      const raw = localStorage.getItem("onspot_user");
      if (raw) {
        try {
          const stored = JSON.parse(raw);
          localStorage.setItem("onspot_user", JSON.stringify({
            ...stored,
            first_name: updated.firstName,
            last_name: updated.lastName,
          }));
        } catch { /* ignore */ }
      }
      refreshAuth();
      setEditingAccount(false);
      toast({ title: "Account updated" });
    },
    onError: (err: any) => toast({ title: "Could not save", description: err.message, variant: "destructive" }),
  });

  const uploadPhotoMutation = useMutation({
    mutationFn: async (file: File) => {
      // Do NOT use apiRequest here — it always sets Content-Type: application/json
      // and JSON.stringifies the body, which breaks multipart/form-data uploads.
      // Use raw fetch so the browser sets the correct multipart boundary automatically.
      const token =
        localStorage.getItem("onspot_jwt_token") ??
        (() => {
          try { return (JSON.parse(localStorage.getItem("talent_profile_token") ?? "{}") as { token?: string }).token ?? null; } catch { return null; }
        })();
      const fd = new FormData();
      fd.append("photo", file);
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/account/me/photo", { method: "POST", headers, body: fd, credentials: "include" });
      if (!res.ok) { const txt = await res.text(); throw new Error(txt || res.statusText); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile-picture", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/me"] });
      toast({ title: "Photo updated" });
    },
    onError: (err: any) => toast({ title: "Photo upload failed", description: err.message, variant: "destructive" }),
  });

  const removePhotoMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/account/me/photo");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile-picture", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/me"] });
      toast({ title: "Photo removed" });
    },
    onError: (err: any) => toast({ title: "Could not remove photo", description: err.message, variant: "destructive" }),
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: Partial<ClientProfileData>) => {
      const res = await apiRequest("PUT", "/api/client-profile/me", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-profile/me"] });
      setEditingProfile(false);
      toast({ title: "Company profile saved" });
    },
    onError: (err: any) => toast({ title: "Could not save profile", description: err.message, variant: "destructive" }),
  });

  const updateOrgMutation = useMutation({
    mutationFn: async ({ orgId, data }: { orgId: string; data: typeof orgForm }) => {
      const res = await apiRequest("PATCH", `/api/organizations/${orgId}`, data);
      return res.json();
    },
    onSuccess: (_, { orgId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", orgId] });
      setEditingOrgId(null);
      toast({ title: "Organization updated" });
    },
    onError: (err: any) => toast({ title: "Could not save organization", description: err.message, variant: "destructive" }),
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadPhotoMutation.mutate(file);
    e.target.value = "";
  };

  const startEditAccount = () => {
    setAccountForm({
      firstName: account?.firstName ?? "",
      lastName: account?.lastName ?? "",
    });
    setEditingAccount(true);
  };

  const startEditProfile = () => {
    setProfileForm({
      companyName: clientProfile?.companyName ?? "",
      contactPerson: clientProfile?.contactPerson ?? "",
      email: clientProfile?.email ?? "",
      phoneNumber: clientProfile?.phoneNumber ?? "",
      website: clientProfile?.website ?? "",
      industry: clientProfile?.industry ?? "",
      companySize: clientProfile?.companySize ?? "",
      location: clientProfile?.location ?? "",
      timezone: clientProfile?.timezone ?? "",
      about: clientProfile?.about ?? "",
      hiringNeeds: clientProfile?.hiringNeeds ?? "",
    });
    setEditingProfile(true);
  };

  const startEditOrg = (org: OrgMembership) => {
    setOrgForm({
      name: org.organization.name ?? "",
      website: org.organization.website ?? "",
      industry: org.organization.industry ?? "",
      companySize: org.organization.companySize ?? "",
      location: org.organization.location ?? "",
      about: org.organization.about ?? "",
      timezone: org.organization.timezone ?? "",
    });
    setEditingOrgId(org.organization.id);
  };

  const handleSignOut = async () => {
    await logout();
    navigate("/");
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-20 space-y-8">

      {/* ── Page title ── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Account Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Manage your identity, company profile, and organization workspace.
        </p>
      </div>

      {/* ── 1. Account identity ─────────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-6">
          <SectionHeader icon={User} title="Account" subtitle="Your personal identity on OnSpot" />

          <div className="flex flex-col sm:flex-row gap-6">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-2 shrink-0">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-[#474ead] to-[#7c82d4] flex items-center justify-center text-white text-2xl font-bold">
                  {profilePicture ? (
                    <img src={profilePicture} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    [account?.firstName?.[0], account?.lastName?.[0]].filter(Boolean).join("").toUpperCase() ||
                    <Building2 className="w-8 h-8" />
                  )}
                </div>
                {(uploadPhotoMutation.isPending) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl">
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  </div>
                )}
              </div>
              <div className="flex gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 px-2"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadPhotoMutation.isPending || removePhotoMutation.isPending}
                >
                  <Camera className="w-3 h-3 mr-1" />
                  {profilePicture ? "Change" : "Upload"}
                </Button>
                {profilePicture && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 px-2 text-red-500 hover:text-red-600"
                    onClick={() => removePhotoMutation.mutate()}
                    disabled={removePhotoMutation.isPending}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            {/* Fields */}
            <div className="flex-1 space-y-4">
              {accountLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-full" />)}
                </div>
              ) : editingAccount ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">First Name</Label>
                      <Input
                        value={accountForm.firstName}
                        onChange={e => setAccountForm(p => ({ ...p, firstName: e.target.value }))}
                        placeholder="First name"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Last Name</Label>
                      <Input
                        value={accountForm.lastName}
                        onChange={e => setAccountForm(p => ({ ...p, lastName: e.target.value }))}
                        placeholder="Last name"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-[#474ead] text-white hover:bg-[#3d439c]"
                      onClick={() => updateAccountMutation.mutate(accountForm)}
                      disabled={updateAccountMutation.isPending}
                    >
                      {updateAccountMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                      Save
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setEditingAccount(false)}>
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <ReadOnlyField label="First Name" value={account?.firstName} />
                    <ReadOnlyField label="Last Name" value={account?.lastName} />
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-slate-500 dark:text-slate-400">Email</Label>
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <p className="text-sm text-slate-700 dark:text-slate-300 truncate">{account?.email}</p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-slate-500 dark:text-slate-400">Role</Label>
                      <Badge variant="outline" className="text-[#474ead] border-[#474ead]/30 bg-[#474ead]/5 font-medium capitalize">
                        Client
                      </Badge>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={startEditAccount}>
                    <Pencil className="w-3.5 h-3.5 mr-1.5" />Edit name
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 2. Company Profile ───────────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between mb-5">
            <SectionHeader icon={Building2} title="Company Profile" subtitle="Your business details used in hiring" />
            {!editingProfile && (
              <Button variant="outline" size="sm" onClick={startEditProfile} className="shrink-0 mt-0.5">
                <Pencil className="w-3.5 h-3.5 mr-1.5" />Edit
              </Button>
            )}
          </div>

          {profileLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : editingProfile ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {([
                  { key: "companyName",   label: "Company Name",      placeholder: "Your company name" },
                  { key: "contactPerson", label: "Contact Person",    placeholder: "Full name" },
                  { key: "phoneNumber",   label: "Phone Number",      placeholder: "+1 555 000 0000" },
                  { key: "website",       label: "Website",           placeholder: "https://example.com" },
                  { key: "industry",      label: "Industry",          placeholder: "Technology, Healthcare…" },
                  { key: "companySize",   label: "Company Size",      placeholder: "11–50 employees" },
                  { key: "location",      label: "Location / Country", placeholder: "Singapore" },
                  { key: "timezone",      label: "Timezone",          placeholder: "Asia/Singapore" },
                ] as const).map(({ key, label, placeholder }) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-xs font-medium">{label}</Label>
                    <Input
                      value={(profileForm as any)[key] ?? ""}
                      onChange={e => setProfileForm(p => ({ ...p, [key]: e.target.value }))}
                      placeholder={placeholder}
                    />
                  </div>
                ))}
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs font-medium">About the Company</Label>
                  <Textarea
                    rows={3}
                    value={profileForm.about ?? ""}
                    onChange={e => setProfileForm(p => ({ ...p, about: e.target.value }))}
                    placeholder="Brief description of your company…"
                  />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs font-medium">Hiring Needs</Label>
                  <Textarea
                    rows={2}
                    value={profileForm.hiringNeeds ?? ""}
                    onChange={e => setProfileForm(p => ({ ...p, hiringNeeds: e.target.value }))}
                    placeholder="What roles are you typically hiring for?"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-[#474ead] text-white hover:bg-[#3d439c]"
                  onClick={() => updateProfileMutation.mutate(profileForm)}
                  disabled={updateProfileMutation.isPending}
                >
                  {updateProfileMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                  Save
                </Button>
                <Button variant="outline" size="sm" onClick={() => setEditingProfile(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ReadOnlyField label="Company Name" value={clientProfile?.companyName} />
              <ReadOnlyField label="Contact Person" value={clientProfile?.contactPerson} />
              <ReadOnlyField label="Phone" value={clientProfile?.phoneNumber} />
              <ReadOnlyField label="Website" value={clientProfile?.website} />
              <ReadOnlyField label="Industry" value={clientProfile?.industry} />
              <ReadOnlyField label="Company Size" value={clientProfile?.companySize} />
              <ReadOnlyField label="Location" value={clientProfile?.location} />
              <ReadOnlyField label="Timezone" value={clientProfile?.timezone} />
              {clientProfile?.about && (
                <div className="sm:col-span-2">
                  <ReadOnlyField label="About" value={clientProfile.about} />
                </div>
              )}
              {clientProfile?.hiringNeeds && (
                <div className="sm:col-span-2">
                  <ReadOnlyField label="Hiring Needs" value={clientProfile.hiringNeeds} />
                </div>
              )}
              {!clientProfile?.companyName && !clientProfile?.about && (
                <div className="sm:col-span-2 py-4 text-center text-sm text-slate-400">
                  No company details yet — click Edit to add them.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 3. Organization ─────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between mb-5">
            <SectionHeader
              icon={Users}
              title="Organization"
              subtitle="Your shared workspace for team collaboration"
            />
            {pendingInvitations.length > 0 && (
              <Link href="/organization-invitations">
                <Button variant="outline" size="sm" className="shrink-0 mt-0.5 text-[#474ead] border-[#474ead]/40">
                  <AlertTriangle className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
                  {pendingInvitations.length} pending invite{pendingInvitations.length !== 1 ? "s" : ""}
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </Link>
            )}
          </div>

          {orgsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : organizations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 dark:border-white/10 p-6 text-center">
              <Building2 className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">No organization yet</p>
              <p className="text-xs text-slate-400 mb-4">
                Create a shared workspace to collaborate with your team.
              </p>
              <Link href="/organization/create">
                <Button size="sm" className="bg-[#474ead] text-white hover:bg-[#3d439c]">
                  <Plus className="w-3.5 h-3.5 mr-1.5" />Create organization
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {organizations.map(({ organization, membership }) => {
                const isOwner = membership.role === "owner";
                const isEditingThisOrg = editingOrgId === organization.id;

                return (
                  <div key={organization.id} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/40 p-4">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Building2 className="h-4 w-4 text-[#474ead] shrink-0" />
                        <span className="text-sm font-semibold text-slate-800 dark:text-white truncate">{organization.name}</span>
                        {isOwner && (
                          <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-600/40 text-[10px] shrink-0">
                            <Crown className="w-2.5 h-2.5 mr-1" />Owner
                          </Badge>
                        )}
                        {!isOwner && (
                          <Badge variant="outline" className="text-slate-500 border-slate-300 text-[10px] shrink-0">
                            Member
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isOwner && !isEditingThisOrg && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7 px-2"
                            onClick={() => startEditOrg({ organization, membership })}
                          >
                            <Pencil className="w-3 h-3 mr-1" />Edit
                          </Button>
                        )}
                        <Link href={`/organization/${organization.id}`}>
                          <Button variant="outline" size="sm" className="text-xs h-7 px-2">
                            Manage<ChevronRight className="w-3 h-3 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    </div>

                    {isEditingThisOrg && (
                      <div className="mt-3 space-y-3 border-t border-slate-200 dark:border-white/10 pt-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="sm:col-span-2 space-y-1.5">
                            <Label className="text-xs font-medium">Organization Name <span className="text-red-500">*</span></Label>
                            <Input
                              value={orgForm.name}
                              onChange={e => setOrgForm(p => ({ ...p, name: e.target.value }))}
                              placeholder="Organization name"
                            />
                          </div>
                          {([
                            { key: "website",     label: "Website",      placeholder: "https://example.com" },
                            { key: "industry",    label: "Industry",     placeholder: "Technology" },
                            { key: "companySize", label: "Company Size", placeholder: "11–50 employees" },
                            { key: "location",    label: "Location",     placeholder: "Singapore" },
                            { key: "timezone",    label: "Timezone",     placeholder: "Asia/Singapore" },
                          ] as const).map(({ key, label, placeholder }) => (
                            <div key={key} className="space-y-1.5">
                              <Label className="text-xs font-medium">{label}</Label>
                              <Input
                                value={(orgForm as any)[key]}
                                onChange={e => setOrgForm(p => ({ ...p, [key]: e.target.value }))}
                                placeholder={placeholder}
                              />
                            </div>
                          ))}
                          <div className="sm:col-span-2 space-y-1.5">
                            <Label className="text-xs font-medium">About</Label>
                            <Textarea
                              rows={2}
                              value={orgForm.about}
                              onChange={e => setOrgForm(p => ({ ...p, about: e.target.value }))}
                              placeholder="Short description for your team…"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-[#474ead] text-white hover:bg-[#3d439c]"
                            onClick={() => updateOrgMutation.mutate({ orgId: organization.id, data: orgForm })}
                            disabled={updateOrgMutation.isPending || !orgForm.name.trim()}
                          >
                            {updateOrgMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                            Save
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setEditingOrgId(null)}>Cancel</Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="pt-1">
                <Link href="/organization/create">
                  <Button variant="outline" size="sm" className="text-[#474ead] border-[#474ead]/40 hover:bg-[#474ead]/5">
                    <Plus className="w-3.5 h-3.5 mr-1.5" />Create another organization
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 4. Security ─────────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-6">
          <SectionHeader icon={LogOut} title="Security" />
          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-white/10">
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-white">Sign out</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">End your current session on this device</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-red-500 border-red-200 hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-900/20 shrink-0"
              onClick={handleSignOut}
            >
              <LogOut className="w-3.5 h-3.5 mr-1.5" />Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
