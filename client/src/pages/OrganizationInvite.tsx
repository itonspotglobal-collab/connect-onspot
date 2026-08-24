/**
 * Public token-based organization invitation page.
 *
 * Accessible to signed-out visitors and signed-in users. The page:
 * - Loads invitation details from the public endpoint (no auth required).
 * - If the visitor is not signed in, prompts them to sign in or create an
 *   account, preserving the token through the sign-in redirect.
 * - If the signed-in user's email does not match the invitation, shows a
 *   mismatch message.
 * - If the signed-in user is Talent or Admin, shows a role explanation.
 * - If the signed-in user is the correct Client, lets them accept or decline.
 */

import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Building2, Check, Loader2, Mail, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { SignUpDialog } from "@/components/SignUpDialog";

type PublicInvitationDetails = {
  id: string;
  organizationId: string;
  organizationName: string;
  email: string;
  status: string;
  inviterName: string | null;
  expiresAt: string | null;
  createdAt: string | null;
};

export default function OrganizationInvite() {
  const { token } = useParams<{ token: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: isAuthLoading, user } = useAuth();
  const [signupOpen, setSignupOpen] = useState(false);

  const { data: invitation, isLoading, isError } = useQuery<PublicInvitationDetails>({
    queryKey: ["/api/organization-invitations/public", token],
    queryFn: async () => {
      const response = await fetch(`/api/organization-invitations/public/${encodeURIComponent(token ?? "")}`);
      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.error || "Invitation not found");
      }
      return response.json();
    },
    enabled: Boolean(token),
    retry: false,
  });

  const respondMutation = useMutation({
    mutationFn: async (action: "accept" | "decline") => {
      const response = await apiRequest("POST", "/api/organization-invitations/accept-by-token", {
        token,
        action,
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.message || json.error || "Failed to respond to invitation");
      }
      return json;
    },
    onSuccess: (data, action) => {
      queryClient.invalidateQueries({ queryKey: ["/api/organization-invitations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/me"] });
      if (action === "accept" && data.organization?.id) {
        // Refresh the organization detail and members list so the new member appears
        // immediately in OrganizationDetail without requiring a manual reload.
        // Prefix invalidation on [orgId, "members"] covers all invitationStatusFilter variants.
        queryClient.invalidateQueries({ queryKey: ["/api/organizations", data.organization.id, "members"] });
        queryClient.invalidateQueries({ queryKey: ["/api/organizations", data.organization.id] });
        toast({
          title: "Invitation accepted",
          description: `You are now a member of ${data.organization.name}.`,
        });
        navigate(`/organization/${data.organization.id}`);
      } else {
        toast({ title: "Invitation declined" });
        navigate("/dashboard");
      }
    },
    onError: (error: Error) => {
      toast({ title: "Could not respond to invitation", description: error.message, variant: "destructive" });
    },
  });

  // ── Loading state ────────────────────────────────────────────────────────
  if (isLoading || isAuthLoading) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-xl items-center justify-center p-6">
        <Card className="w-full border-slate-200 shadow-sm">
          <CardContent className="space-y-4 p-8">
            <Skeleton className="h-12 w-12 rounded-2xl" />
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-4 w-72" />
            <div className="flex gap-3 pt-2">
              <Skeleton className="h-10 w-28" />
              <Skeleton className="h-10 w-28" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Invitation not found / invalid ───────────────────────────────────────
  if (isError || !invitation) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-xl items-center justify-center p-6">
        <Card className="w-full border-slate-200 shadow-sm">
          <CardContent className="p-8 text-center">
            <Mail className="mx-auto h-10 w-10 text-slate-300" />
            <h1 className="mt-4 text-xl font-semibold text-slate-900">Invitation not found</h1>
            <p className="mt-2 text-sm text-slate-500">
              This invitation link is invalid, has already been used, or may have expired.
            </p>
            {isAuthenticated && user?.role === "client" && (
              <Button className="mt-6" onClick={() => navigate("/organization-invitations")}>
                View my invitations
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Invitation has a non-pending status ──────────────────────────────────
  if (invitation.status !== "pending") {
    const statusMessages: Record<string, string> = {
      accepted: "This invitation has already been accepted.",
      declined: "This invitation has already been declined.",
      revoked: "This invitation has been revoked by the organization owner.",
      expired: "This invitation has expired. Ask the organization owner to resend it.",
    };
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-xl items-center justify-center p-6">
        <Card className="w-full border-slate-200 shadow-sm">
          <CardContent className="p-8 text-center">
            <Building2 className="mx-auto h-10 w-10 text-slate-300" />
            <h1 className="mt-4 text-xl font-semibold text-slate-900 capitalize">{invitation.status} invitation</h1>
            <p className="mt-2 text-sm text-slate-500">
              {statusMessages[invitation.status] ?? "This invitation is no longer active."}
            </p>
            {isAuthenticated && user?.role === "client" && (
              <Button className="mt-6" variant="outline" onClick={() => navigate("/dashboard")}>
                Go to dashboard
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Signed-out visitor ───────────────────────────────────────────────────
  if (!isAuthenticated || !user) {
    const signInUrl = `/sign-in?portal=client&email=${encodeURIComponent(invitation.email)}&returnTo=${encodeURIComponent(`/organization-invite/${token}`)}`;
    const inviteReturnTo = `/organization-invite/${token}`;
    return (
      <>
        <div className="mx-auto flex min-h-[60vh] w-full max-w-xl items-center justify-center p-6">
          <Card className="w-full border-slate-200 shadow-sm">
            <CardContent className="p-8">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#474ead]/10 text-[#474ead]">
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#474ead]">Organization invitation</p>
                  <h1 className="mt-1 text-xl font-semibold text-slate-900">{invitation.organizationName}</h1>
                  <p className="mt-2 text-sm text-slate-600">
                    {invitation.inviterName || "An organization owner"} has invited{" "}
                    <span className="font-medium">{invitation.email}</span> to join this workspace.
                  </p>
                </div>
              </div>
              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">
                Sign in with your Client account — or create one — to accept this invitation.
                Use the email address <span className="font-medium">{invitation.email}</span> to proceed.
              </div>
              <div className="mt-6 flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => navigate(signInUrl)}>
                  Sign in
                </Button>
                <Button className="flex-1" onClick={() => setSignupOpen(true)}>
                  Create account
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <SignUpDialog
          open={signupOpen}
          onOpenChange={setSignupOpen}
          hideTrigger
          defaultUserType="client"
          defaultEmail={invitation.email}
          returnTo={inviteReturnTo}
          onSignInInstead={() => { setSignupOpen(false); navigate(signInUrl); }}
        />
      </>
    );
  }

  // ── Talent or Admin account ──────────────────────────────────────────────
  if (user.role !== "client") {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-xl items-center justify-center p-6">
        <Card className="w-full border-slate-200 shadow-sm">
          <CardContent className="p-8 text-center">
            <Building2 className="mx-auto h-10 w-10 text-slate-300" />
            <h1 className="mt-4 text-xl font-semibold text-slate-900">Client account required</h1>
            <p className="mt-2 text-sm text-slate-500">
              Organization invitations can only be accepted with a Client account. You are currently signed in as{" "}
              {user.role}. Sign in with a Client account whose email matches{" "}
              <span className="font-medium">{invitation.email}</span> to accept this invitation.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Email mismatch ───────────────────────────────────────────────────────
  if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-xl items-center justify-center p-6">
        <Card className="w-full border-slate-200 shadow-sm">
          <CardContent className="p-8 text-center">
            <Mail className="mx-auto h-10 w-10 text-slate-300" />
            <h1 className="mt-4 text-xl font-semibold text-slate-900">Wrong account</h1>
            <p className="mt-2 text-sm text-slate-500">
              This invitation was sent to <span className="font-medium">{invitation.email}</span>.{" "}
              You are signed in as <span className="font-medium">{user.email}</span>. Sign in with the
              correct email address to accept this invitation.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Correct Client user — can accept or decline ──────────────────────────
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-xl items-center justify-center p-6">
      <Card className="w-full border-slate-200 shadow-sm">
        <CardContent className="p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#474ead]/10 text-[#474ead]">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#474ead]">Organization invitation</p>
              <h1 className="mt-1 text-xl font-semibold text-slate-900">{invitation.organizationName}</h1>
              <p className="mt-2 text-sm text-slate-600">
                {invitation.inviterName || "An organization owner"} has invited you to join this workspace.
              </p>
              {invitation.expiresAt && (
                <p className="mt-1 text-xs text-slate-400">
                  Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
          <div className="mt-6 flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              disabled={respondMutation.isPending}
              onClick={() => respondMutation.mutate("decline")}
            >
              {respondMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <X className="mr-1.5 h-4 w-4" />
              )}
              Decline
            </Button>
            <Button
              className="flex-1"
              disabled={respondMutation.isPending}
              onClick={() => respondMutation.mutate("accept")}
            >
              {respondMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-1.5 h-4 w-4" />
              )}
              Accept invitation
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
