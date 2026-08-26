import { useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  User,
  Mail,
  Shield,
  Camera,
  Loader2,
  LogOut,
  Save,
  Pencil,
  X,
  Users,
  Building2,
  Crown,
  ChevronRight,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface AccountInfo {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  company: string | null;
  createdAt: string;
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

// ── Helpers ────────────────────────────────────────────────────────────────────

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

export default function AdminSettings() {
  const { user, logout, refreshAuth } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [editingAccount, setEditingAccount] = useState(false);
  const [accountForm, setAccountForm] = useState({ firstName: "", lastName: "" });

  // ── Queries ────────────────────────────────────────────────────────────────

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

  // Check if admin is also a member of any organization (read-only display).
  // Admins cannot own organizations, but they can be invited as members.
  const { data: organizations = [] } = useQuery<OrgMembership[]>({
    queryKey: ["/api/organizations/me"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/organizations/me");
        return res.json();
      } catch {
        return [];
      }
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

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadPhotoMutation.mutate(file);
    e.target.value = "";
  };

  const startEditAccount = () => {
    setAccountForm({ firstName: account?.firstName ?? "", lastName: account?.lastName ?? "" });
    setEditingAccount(true);
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
          Manage your admin identity and account security.
        </p>
      </div>

      {/* ── 1. Account identity ─────────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-6">
          <SectionHeader icon={User} title="Account" subtitle="Your personal admin identity on OnSpot" />

          <div className="flex flex-col sm:flex-row gap-6">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-2 shrink-0">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-[#474ead] to-[#7c82d4] flex items-center justify-center text-white text-2xl font-bold">
                  {profilePicture ? (
                    <img src={profilePicture} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    [account?.firstName?.[0], account?.lastName?.[0]].filter(Boolean).join("").toUpperCase() ||
                    <Shield className="w-8 h-8" />
                  )}
                </div>
                {uploadPhotoMutation.isPending && (
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
                <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
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
                    <Button variant="outline" size="sm" onClick={() => setEditingAccount(false)}>Cancel</Button>
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
                      <Badge variant="outline" className="text-[#474ead] border-[#474ead]/30 bg-[#474ead]/5 font-medium">
                        <Shield className="w-3 h-3 mr-1" />Admin
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

      {/* ── 2. Organization memberships (read-only for admins) ─────────────── */}
      {organizations.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <SectionHeader
              icon={Users}
              title="Organization Memberships"
              subtitle="Organizations where you have an active membership"
            />
            <div className="space-y-2">
              {organizations.map(({ organization, membership }) => (
                <div key={organization.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/40">
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className="h-4 w-4 text-[#474ead] shrink-0" />
                    <span className="text-sm font-medium text-slate-800 dark:text-white truncate">{organization.name}</span>
                    <Badge variant="outline" className="text-slate-500 border-slate-300 text-[10px] shrink-0 capitalize">
                      {membership.role === "owner" ? <><Crown className="w-2.5 h-2.5 mr-1" />Owner</> : "Member"}
                    </Badge>
                  </div>
                  <Link href={`/organization/${organization.id}`}>
                    <Button variant="ghost" size="sm" className="text-xs h-7 shrink-0">
                      View<ChevronRight className="w-3 h-3 ml-1" />
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── 3. Security ─────────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-6">
          <SectionHeader icon={Shield} title="Security" />
          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-white/10">
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-white">Sign out</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">End your current admin session on this device</p>
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
