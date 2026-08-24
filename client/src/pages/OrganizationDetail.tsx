import { useLocation, useParams, Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AlertTriangle, ArrowLeft, Building2, Globe2, Loader2, Mail, RefreshCw, Trash2, UserMinus, Users, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

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
    deleteRequestedAt: string | null;
    deleteDueAt: string | null;
  };
  membership: {
    role: string;
    status: string;
    joinedAt: string | null;
  };
};

type OrganizationMembersResponse = {
  canManage: boolean;
  members: Array<{
    id: string;
    userId: string;
    role: string;
    status: string;
    joinedAt: string | null;
    email: string;
    firstName: string | null;
    lastName: string | null;
    company: string | null;
  }>;
  invitations: Array<{
    id: string;
    email: string;
    status: string;
    emailStatus: string;
    emailError: string | null;
    inviterName: string | null;
    createdAt: string | null;
    expiresAt: string | null;
  }>;
};

const INVITATION_STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "expired", label: "Expired" },
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
  { value: "revoked", label: "Revoked" },
] as const;

type InvitationStatusFilter = typeof INVITATION_STATUS_FILTERS[number]["value"];

export default function OrganizationDetail() {
  const { organizationId } = useParams<{ organizationId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { setSelectedOrganizationId } = useAuth();
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitationStatusFilter, setInvitationStatusFilter] = useState<InvitationStatusFilter>("all");
  const [deletionDialogOpen, setDeletionDialogOpen] = useState(false);
  const [deletionConfirmName, setDeletionConfirmName] = useState("");
  const confirmInputRef = useRef<HTMLInputElement>(null);
  const { data, isLoading, isError } = useQuery<OrganizationResponse>({
    queryKey: ["/api/organizations", organizationId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/organizations/${organizationId}`);
      return response.json();
    },
    enabled: Boolean(organizationId),
  });
  useEffect(() => {
    if (data?.organization.id) {
      setSelectedOrganizationId(data.organization.id);
    }
  }, [data?.organization.id, setSelectedOrganizationId]);
  const { data: teamData, isLoading: isTeamLoading } = useQuery<OrganizationMembersResponse>({
    queryKey: ["/api/organizations", organizationId, "members", invitationStatusFilter],
    queryFn: async () => {
      const statusQuery = invitationStatusFilter === "all"
        ? ""
        : `?status=${encodeURIComponent(invitationStatusFilter)}`;
      const response = await apiRequest("GET", `/api/organizations/${organizationId}/members${statusQuery}`);
      return response.json();
    },
    enabled: Boolean(organizationId && data?.organization),
  });

  const showInvitationFeedback = (invitation?: {
    emailStatus?: string;
    emailError?: string | null;
  }) => {
    if (invitation?.emailStatus === "sent") {
      toast({ title: "Invitation sent", description: "The invitation is pending and an email is on its way." });
    } else {
      toast({
        title: "Invitation created, but email failed",
        description: invitation?.emailError
          ? `The invitation is still pending. ${invitation.emailError}`
          : "The invitation is still pending. The email could not be delivered.",
        variant: "destructive",
      });
    }
  };

  const inviteMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await apiRequest("POST", `/api/organizations/${organizationId}/invitations`, { email });
      return response.json();
    },
    onSuccess: (data) => {
      setInviteEmail("");
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "members"] });
      showInvitationFeedback(data.invitation);
    },
    onError: (error: Error) => toast({
      title: "Invitation could not be sent",
      description: error.message,
      variant: "destructive",
    }),
  });

  const revokeInvitationMutation = useMutation({
    mutationFn: (invitationId: string) =>
      apiRequest("DELETE", `/api/organizations/${organizationId}/invitations/${invitationId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "members"] });
      toast({ title: "Invitation revoked" });
    },
    onError: (error: Error) => toast({
      title: "Invitation could not be revoked",
      description: error.message,
      variant: "destructive",
    }),
  });

  const resendInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const response = await apiRequest(
        "POST",
        `/api/organizations/${organizationId}/invitations/${invitationId}/resend`,
      );
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "members"] });
      showInvitationFeedback(data.invitation);
    },
    onError: (error: Error) => toast({
      title: "Invitation could not be sent",
      description: error.message,
      variant: "destructive",
    }),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (membershipId: string) =>
      apiRequest("DELETE", `/api/organizations/${organizationId}/members/${membershipId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/me"] });
      toast({ title: "Team member removed" });
    },
    onError: (error: Error) => toast({
      title: "Team member could not be removed",
      description: error.message,
      variant: "destructive",
    }),
  });

  const requestDeletionMutation = useMutation({
    mutationFn: async (confirmName: string) => {
      const response = await apiRequest(
        "POST",
        `/api/organizations/${organizationId}/request-deletion`,
        { confirmName },
      );
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Failed to schedule deletion");
      return json;
    },
    onSuccess: () => {
      setDeletionDialogOpen(false);
      setDeletionConfirmName("");
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/me"] });
      toast({ title: "Deletion scheduled", description: "This organization will be permanently deleted after the grace period." });
    },
    onError: (error: Error) => toast({
      title: "Deletion could not be scheduled",
      description: error.message,
      variant: "destructive",
    }),
  });

  const cancelDeletionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        "DELETE",
        `/api/organizations/${organizationId}/request-deletion`,
      );
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Failed to cancel deletion");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/me"] });
      toast({ title: "Deletion cancelled", description: "The organization deletion has been cancelled." });
    },
    onError: (error: Error) => toast({
      title: "Deletion could not be cancelled",
      description: error.message,
      variant: "destructive",
    }),
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

  const isOwner = data.membership.role === "owner";
  const isPendingDeletion = Boolean(organization.deleteDueAt);
  const deleteDueAt = organization.deleteDueAt ? new Date(organization.deleteDueAt) : null;
  const selectedInvitationStatusLabel =
    INVITATION_STATUS_FILTERS.find(({ value }) => value === invitationStatusFilter)?.label ?? "All statuses";
  const handleInvite = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = inviteEmail.trim();
    if (!email || inviteMutation.isPending) return;
    inviteMutation.mutate(email);
  };

  // Countdown rendering for pending-deletion banner
  const formatDeletionCountdown = (dueAt: Date) => {
    const msLeft = dueAt.getTime() - Date.now();
    if (msLeft <= 0) return "imminently";
    const hoursLeft = Math.floor(msLeft / (1000 * 60 * 60));
    const daysLeft = Math.floor(hoursLeft / 24);
    if (daysLeft >= 2) return `in ${daysLeft} days`;
    if (hoursLeft >= 1) return `in ${hoursLeft} hour${hoursLeft !== 1 ? "s" : ""}`;
    return "very soon";
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <Link
        href="/dashboard"
        className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>

      {/* Pending-deletion warning banner */}
      {isPendingDeletion && deleteDueAt && (
        <div className="flex items-start gap-4 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">
              This organization is scheduled for deletion {formatDeletionCountdown(deleteDueAt)}.
            </p>
            <p className="mt-0.5 text-xs text-red-600">
              All members, invitations, and workspace data will be permanently removed.
              The due date is {deleteDueAt.toLocaleString()}.
            </p>
          </div>
          {isOwner && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 border-red-300 text-red-700 hover:bg-red-100"
              disabled={cancelDeletionMutation.isPending}
              onClick={() => cancelDeletionMutation.mutate()}
            >
              {cancelDeletionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel deletion"}
            </Button>
          )}
        </div>
      )}

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

          <Card className="border-slate-200 bg-slate-50/70 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-5 w-5 text-[#474ead]" />
                Team members
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {isOwner && (
                <form onSubmit={handleInvite} className="space-y-2">
                  <Label htmlFor="organization-invite-email">Invite a colleague</Label>
                  <div className="flex gap-2">
                    <Input
                      id="organization-invite-email"
                      type="email"
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                      placeholder="colleague@company.com"
                      maxLength={320}
                      required
                    />
                    <Button type="submit" disabled={inviteMutation.isPending || !inviteEmail.trim()}>
                      {inviteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Invite"}
                    </Button>
                  </div>
                  <p className="text-xs leading-5 text-slate-500">
                    The invitee must use a Client account with this email address to accept.
                    Invitations expire after 30 days and can then be resent.
                  </p>
                </form>
              )}

              {isTeamLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {teamData?.members.map((member) => {
                      const name = [member.firstName, member.lastName].filter(Boolean).join(" ") || member.email;
                      return (
                        <div key={member.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800">{name}</p>
                            <p className="truncate text-xs text-slate-500">{member.email}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Badge variant="outline" className="capitalize">{member.role}</Badge>
                            {isOwner && member.role !== "owner" && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                title={`Remove ${name}`}
                                aria-label={`Remove ${name}`}
                                disabled={removeMemberMutation.isPending}
                                onClick={() => removeMemberMutation.mutate(member.id)}
                              >
                                <UserMinus className="h-4 w-4 text-slate-500" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {!teamData?.members.length && (
                      <p className="rounded-xl border border-dashed border-slate-300 px-4 py-5 text-center text-sm text-slate-500">
                        You are the only active member of this organization.
                      </p>
                    )}
                  </div>

                  {isOwner && (
                    <div className="border-t border-slate-200 pt-4">
                      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-800">Invitations</h3>
                          <span className="text-xs text-slate-400">
                            {teamData?.invitations.length ?? 0} {invitationStatusFilter === "all" ? "total" : "matching"}
                          </span>
                        </div>
                        <div className="w-full sm:w-44">
                          <Label htmlFor="organization-invitation-status" className="text-xs font-medium text-slate-500">
                            Filter by status
                          </Label>
                          <Select
                            value={invitationStatusFilter}
                            onValueChange={(value) => setInvitationStatusFilter(value as InvitationStatusFilter)}
                          >
                            <SelectTrigger id="organization-invitation-status" className="mt-1 h-9 bg-white text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {INVITATION_STATUS_FILTERS.map((status) => (
                                <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {teamData?.invitations.map((invitation) => (
                          <div key={invitation.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
                            <div className="min-w-0">
                              <p className="flex items-center gap-1.5 truncate text-sm font-medium text-slate-800">
                                <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                {invitation.email}
                              </p>
                              <p className="text-xs text-slate-500">
                                {invitation.createdAt ? `Sent ${new Date(invitation.createdAt).toLocaleDateString()}` : ""}
                                {invitation.status === "pending" && invitation.expiresAt
                                  ? ` · Expires ${new Date(invitation.expiresAt).toLocaleDateString()}`
                                  : invitation.status === "expired" && invitation.expiresAt
                                    ? ` · Expired ${new Date(invitation.expiresAt).toLocaleDateString()}`
                                    : ""}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <Badge variant={invitation.status === "pending" ? "secondary" : "outline"} className="capitalize">
                                {invitation.status}
                              </Badge>
                              <Badge
                                variant={
                                  invitation.emailStatus === "failed"
                                    ? "destructive"
                                    : invitation.emailStatus === "sent"
                                      ? "outline"
                                      : "secondary"
                                }
                                title={invitation.emailError ?? undefined}
                              >
                                {invitation.emailStatus === "failed"
                                  ? "Email failed"
                                  : invitation.emailStatus === "sent"
                                    ? "Email sent"
                                    : "Email pending"}
                              </Badge>
                              {isOwner && (
                                invitation.status === "expired" ||
                                (invitation.status === "pending" && invitation.emailStatus === "failed")
                              ) && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  title={invitation.status === "expired" ? "Resend invitation" : "Retry invitation delivery"}
                                  aria-label={`${invitation.status === "expired" ? "Resend" : "Retry"} invitation for ${invitation.email}`}
                                  disabled={resendInvitationMutation.isPending}
                                  onClick={() => resendInvitationMutation.mutate(invitation.id)}
                                >
                                  {resendInvitationMutation.isPending
                                    ? <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                                    : <RefreshCw className="h-4 w-4 text-slate-500" />}
                                </Button>
                              )}
                              {invitation.status === "pending" && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  title="Revoke invitation"
                                  aria-label={`Revoke invitation for ${invitation.email}`}
                                  disabled={revokeInvitationMutation.isPending}
                                  onClick={() => revokeInvitationMutation.mutate(invitation.id)}
                                >
                                  <X className="h-4 w-4 text-slate-500" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                        {!teamData?.invitations.length && (
                          <p className="rounded-xl border border-dashed border-slate-300 px-4 py-5 text-center text-sm text-slate-500">
                            {invitationStatusFilter === "all"
                              ? "No invitations have been sent yet."
                              : `No invitations match the selected "${selectedInvitationStatusLabel}" status.`}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {!isOwner && (
                <p className="text-xs leading-5 text-slate-500">
                  Only organization owners can invite or remove team members.
                </p>
              )}
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      {/* Danger zone — owner-only deletion */}
      {isOwner && !isPendingDeletion && (
        <Card className="border-red-200 shadow-sm">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold text-red-700">
                <Trash2 className="h-4 w-4" />
                Delete organization
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Permanently remove this organization, its members, and all invitation history after a 3-day grace period.
                This action cannot be undone.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="shrink-0 border-red-300 text-red-700 hover:bg-red-50"
              onClick={() => {
                setDeletionConfirmName("");
                setDeletionDialogOpen(true);
                setTimeout(() => confirmInputRef.current?.focus(), 50);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete organization
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Deletion confirmation dialog */}
      <Dialog open={deletionDialogOpen} onOpenChange={(open) => {
        setDeletionDialogOpen(open);
        if (!open) setDeletionConfirmName("");
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{organization.name}&rdquo;</DialogTitle>
            <DialogDescription>
              This will permanently delete the organization, remove all members, and cancel all pending invitations
              after a 3-day grace period. You can cancel during this window.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 space-y-3">
            <Label htmlFor="deletion-confirm-name">
              Type the organization name to confirm:
              <span className="ml-1 font-semibold text-slate-900">{organization.name}</span>
            </Label>
            <Input
              id="deletion-confirm-name"
              ref={confirmInputRef}
              value={deletionConfirmName}
              onChange={(e) => setDeletionConfirmName(e.target.value)}
              placeholder={organization.name}
              autoComplete="off"
            />
          </div>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletionDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deletionConfirmName !== organization.name || requestDeletionMutation.isPending}
              onClick={() => requestDeletionMutation.mutate(deletionConfirmName)}
            >
              {requestDeletionMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Schedule deletion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
