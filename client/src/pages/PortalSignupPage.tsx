import { useLayoutEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { SignUpDialog } from "@/components/SignUpDialog";
import type { PortalType } from "@/hooks/usePortalLogin";
import { TopNavigation } from "@/components/TopNavigation";
import { Footer } from "@/components/Footer";
import Home from "@/pages/Home";
import FindWorkAllJobs from "@/pages/FindWorkAllJobs";
import HireTalentPage from "@/pages/HireTalentPage";

export default function PortalSignupPage() {
  const [location, navigate] = useLocation();
  const pathname = location.split("?")[0].replace(/\/$/, "");
  const query = useSearch();
  const params = new URLSearchParams(query);
  // Legacy role hints must not turn /portal back into a preselected form.
  params.delete("portal");
  const search = params.size ? `?${params.toString()}` : "";
  const portal: PortalType | null =
    pathname === "/signup/client" ? "client" :
    pathname === "/signup/talent" ? "talent" :
    null;

  const landing = portal === "talent" ? "/find-work/jobs" : portal === "client" ? "/hire-talent" : "/";
  useLayoutEffect(() => {
    // Direct auth routes must not inherit the preceding route's scroll offset.
    // In-place signup uses SignupModalProvider instead, and keeps its scroll.
    window.scrollTo({ left: 0, top: 0, behavior: "instant" });
  }, [portal]);
  const close = () => {
    const publicParams = new URLSearchParams(params);
    for (const key of ["email", "returnTo", "backTo", "applicationToken", "verification", "code"]) publicParams.delete(key);
    const suffix = publicParams.size ? `?${publicParams.toString()}` : "";
    navigate(`${landing}${suffix}`);
  };

  return (
    <>
    <div className="fixed inset-0 overflow-hidden bg-background" data-signup-background={portal ?? "portal"}>
      <TopNavigation />
      <main>{portal === "talent" ? <FindWorkAllJobs /> : portal === "client" ? <HireTalentPage /> : <Home />}</main>
      <Footer />
    </div>
    <SignUpDialog
      open
      hideTrigger
      standalone
      modalOverlay
      portalHref={`/portal${search}`}
      defaultUserType={portal ?? undefined}
      defaultEmail={params.get("email") ?? undefined}
      returnTo={params.get("returnTo") ?? undefined}
      onOpenChange={(open, handoff) => {
        // Successful registration and OAuth already own their destination.
        if (!open && !handoff) close();
      }}
      onChooseAnotherAccountType={() => navigate(`/portal${search}`)}
      onChooseUserType={selected => navigate(`/signup/${selected}${search}`)}
      onSignInInstead={selected => navigate(`${selected ? `/login/${selected}` : "/login"}${search}`)}
    />
    </>
  );
}