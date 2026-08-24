import { useMutation, useQuery } from "@tanstack/react-query";
import { Building2, Check, Loader2, Mail, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

type OrganizationInvitation = {
  id: string;
  organizationId: string;
  organizationName?: string;
  email: string;
  status: string;
  inviterName: string | null;
  createdAt: string | null;
  expiresAt: string | null;
};

export default function OrganizationInvitations() {
  const { toast } = useToast();
  const { data: invitations = [], isLoading, isError } = useQuery<OrganizationInvitation[]>({
    queryKey: ["/api/organization-invitations"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/organization-invitations");
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const respondMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "accept" | "decline" }) => {
      const response = await apiRequest("POST", `/api/organization-invitations/${id}/respond`, { action });
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/organization-invitations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/me"] });
      if (data.organization?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/organizations", data.organization.id, "members"] });
      }
      toast({
        title: variables.action === "accept" ? "Invitation accepted" : "Invitation declined",
        description: variables.action === "accept"
          ? `You are now a member of ${data.organization?.name ?? "the organization"}.`
          : "The organization owner has been notified.",
      });
    },
    onError: (error: Error) => toast({
      title: "Invitation response failed",
      description: error.message,
      variant: "destructive",
    }),
  });

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-7 flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#474ead]/10 text-[#474ead]">
          <Mail className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#474ead]">Organization workspace</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Organization invitations</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Review invitations to join Client organization workspaces.
          </p>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5 text-[#474ead]" />
            Pending invitations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}
          {isError && (
            <p className="text-sm text-red-600">Invitations could not be loaded. Please try again.</p>
          )}
          {!isLoading && !isError && !invitations.length && (
            <div className="py-8 text-center">
              <Mail className="mx-auto h-9 w-9 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-700">No pending invitations</p>
              <p className="mt-1 text-sm text-slate-500">New organization invitations will appear here.</p>
            </div>
          )}
          <div className="space-y-3">
            {invitations.map((invitation) => (
              <div key={invitation.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-slate-900">{invitation.organizationName ?? "Organization"}</h2>
                      <Badge variant="secondary" className="capitalize">{invitation.status}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {invitation.inviterName || "An organization owner"} invited you to join this workspace.
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{invitation.email}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={respondMutation.isPending}
                      onClick={() => respondMutation.mutate({ id: invitation.id, action: "decline" })}
                    >
                      {respondMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="mr-1.5 h-4 w-4" />}
                      Decline
                    </Button>
                    <Button
                      type="button"
                      disabled={respondMutation.isPending}
                      onClick={() => respondMutation.mutate({ id: invitation.id, action: "accept" })}
                    >
                      {respondMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
                      Accept
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}