import { useEffect } from "react";
import { useLocation } from "wouter";
import { SignUpDialog } from "@/components/SignUpDialog";
import type { PortalType } from "@/hooks/usePortalLogin";

export default function PortalSignupPage() {
  const [location, navigate] = useLocation();
  const pathname = location.split("?")[0];
  const search = typeof window === "undefined" ? "" : window.location.search;
  const params = new URLSearchParams(search);
  const portal: PortalType | null =
    pathname === "/signup/client" ? "client" :
    pathname === "/signup/talent" ? "talent" :
    null;

  useEffect(() => {
    if (!portal) navigate(`/signup${search}`);
  }, [portal, navigate, search]);

  if (!portal) return null;

  return (
    <SignUpDialog
      open
      hideTrigger
      standalone
      defaultUserType={portal}
      defaultEmail={params.get("email") ?? undefined}
      returnTo={params.get("returnTo") ?? undefined}
      onOpenChange={(open) => {
        if (!open) navigate(`/signup${search}`);
      }}
      onChooseAnotherAccountType={() => navigate(`/signup${search}`)}
      onSignInInstead={() => navigate(`/login/${portal}${search}`)}
    />
  );
}