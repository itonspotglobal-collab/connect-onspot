import { Switch, Route, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { VanessaProvider, useVanessa } from "@/contexts/VanessaContext";
import { OAuthErrorDialog, useOAuthError } from "@/components/OAuthErrorDialog";
import { TopNavigation } from "@/components/TopNavigation";
import { ClientLayout } from "@/components/ClientLayout";
import { ClientProtectedRoute, TalentProtectedRoute, AdminProtectedRoute } from "@/components/ProtectedRoute";
import { NewUserOnboardingWrapper } from "@/components/NewUserOnboardingWrapper";
import { PostLoginPortalSelection } from "@/components/PostLoginPortalSelection";
import { DomainRouter } from "@/components/DomainRouter";
import { VanessaChat } from "@/components/VanessaChat";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { HeadSEO } from "@/components/HeadSEO";
import Home from "@/pages/Home";
import TalentSearch from "@/pages/TalentSearch";
import Dashboard from "@/pages/Dashboard";
import WhyOnSpot from "@/pages/WhyOnSpot";
import WhyOnSpotAbout from "@/pages/WhyOnSpotAbout";
import WhyOnSpotCaseStudies from "@/pages/WhyOnSpotCaseStudies";
import WhyOnSpotReviews from "@/pages/WhyOnSpotReviews";
import WhyOnSpotExperience from "@/pages/WhyOnSpotExperience";
import WhyOnSpotIntegratorSystem from "@/pages/WhyOnSpotIntegratorSystem";
import WhyOnSpotValueCalculator from "@/pages/WhyOnSpotValueCalculator";
import Amazing from "@/pages/Amazing";
import GetHired from "@/pages/GetHired";
import TalentPortal from "@/pages/TalentPortal";
import HiredTalentPortal from "@/pages/HiredTalentPortal";
import FindWork from "@/pages/FindWork";
import FindWorkJob from "@/pages/FindWorkJob";
import FindWorkAllJobs from "@/pages/FindWorkAllJobs";
import JobApplyPage from "@/pages/JobApplyPage";
import TalentSignupFromApplication from "@/pages/TalentSignupFromApplication";
import FindBestMatches from "@/pages/FindBestMatches";
import CandidateProfile from "@/pages/CandidateProfile";
import Insights from "@/pages/Insights";
import InsightPost from "@/pages/InsightPost";
import NotFound from "@/pages/not-found";
import ComingSoon from "@/pages/ComingSoon";
import { loadTalentAuth } from "@/components/TalentLoginModal";
import PaymentProtection from "@/pages/PaymentProtection";
import ClientVerification from "@/pages/ClientVerification";
import TrustSafety from "@/pages/TrustSafety";
import LeadIntake from "@/pages/LeadIntake";
import AdminCSVImport from "@/pages/AdminCSVImport";
import AdminDashboard from "@/pages/AdminDashboard";
import VanessaResponses from "@/pages/VanessaResponses";
import VanessaLearningDashboard from "@/pages/VanessaLearningDashboard";
import AdminVanessaRAG from "@/pages/AdminVanessaRAG";
import InvestorsCorner from "@/pages/InvestorsCorner";
import ProfileSettings from "@/pages/ProfileSettings";
import Powerapp from "@/pages/Powerapp";
import OperationsPlaybook from "@/pages/OperationsPlaybook";
import SuperhumanProject from "@/pages/SuperhumanProject";
import LegalOpsLanding from "@/pages/LegalOpsLanding";
import AdminInsights from "@/pages/AdminInsights";
import AdminInsightEditor from "@/pages/AdminInsightEditor";
import AdminImageUploader from "@/pages/AdminImageUploader";
import AdminFindWork from "@/pages/AdminFindWork";
import JobFormPage from "@/pages/JobFormPage";
import AdminJobApplications from "@/pages/AdminJobApplications";
import AdminEmailTemplates from "@/pages/AdminEmailTemplates";
import AdminEmailTemplateEditor from "@/pages/AdminEmailTemplateEditor";
import ManagedServicesPage from "@/pages/ManagedServicesPage";
import ResourcedServicesPage from "@/pages/ResourcedServicesPage";
import EnterpriseServicesPage from "@/pages/EnterpriseServicesPage";
import HumanVirtualAssistantPage from "@/pages/HumanVirtualAssistantPage";
import HireTalentPage from "@/pages/HireTalentPage";
import PilotDashboard from "@/pages/PilotDashboard";
import FAQ from "@/pages/FAQ";
import TalentPool from "@/pages/TalentPool";
import TalentProfile from "@/pages/TalentProfile";
import TalentApplications from "@/pages/TalentApplications";
import Inbox from "@/pages/Inbox";
import ClientProfile from "@/pages/ClientProfile";
import InquiryPage from "@/pages/InquiryPage";
import InquiryReview from "@/pages/InquiryReview";
import InquiryPayment from "@/pages/InquiryPayment";
import InquirySuccess from "@/pages/InquirySuccess";
import AdminInquiries from "@/pages/AdminInquiries";
import AdminScaffoldJobs from "@/pages/AdminScaffoldJobs";
import AdminFlaggedMessages from "@/pages/AdminFlaggedMessages";
import TermsAndConditions from "@/pages/TermsAndConditions";
import RefundPolicy from "@/pages/RefundPolicy";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import PortalLogin from "@/pages/PortalLogin";

// Scroll to the top of the page whenever the route changes
import Messages from "@/pages/Messages";
function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [location]);
  return null;
}

// Redirect /find-work → /find-work/jobs (URL changes in browser)
function FindWorkRedirect() {
  const [, navigate] = useLocation();
  useEffect(() => { navigate("/find-work/jobs"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

// TODO: Restore Talent Dashboard routes when the final Talent Dashboard design is ready.
// Temporarily redirects talent-dashboard and talent-portal to the public homepage.
function RedirectToHome() {
  const [, navigate] = useLocation();
  useEffect(() => { navigate("/"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

// /client-search is replaced by /hire-talent (merged, single page).
// This redirect keeps any bookmarked or linked URLs working.
function ClientSearchRedirect() {
  const [, navigate] = useLocation();
  useEffect(() => { navigate("/hire-talent", { replace: true }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

// Immersive Page Wrapper - Full screen without navigation (for campaigns and reveals)
function ImmersivePage() {
  return <ComingSoon />;
}

// Superhuman Immersive Wrapper - Full screen cinematic experience
function SuperhumanImmersive() {
  return <SuperhumanProject />;
}

// LegalOps Landing Wrapper - Clean landing page without navigation
function LegalOpsImmersive() {
  return <LegalOpsLanding />;
}

// Public Routes - Always available regardless of authentication
function PublicRouter() {
  const { isAuthenticated, user } = useAuth();
  const [location] = useLocation();
  // TEMPORARY DEV BYPASS: Admin authentication disabled for testing.
  // Restore AdminProtectedRoute before production by setting VITE_BYPASS_ADMIN_AUTH=false
  // or removing the env var.
  const bypassAdminAuth = import.meta.env.VITE_BYPASS_ADMIN_AUTH === "true";
  const hideTopNav =
    location === "/why-onspot/about" ||
    location === "/insights" ||
    location.startsWith("/insights/");

  return (
    <div className="min-h-screen bg-background">
      <ScrollToTop />
      {!hideTopNav && <TopNavigation />}
      <main>
        <Switch>
          <Route path="/" component={() => {
            // TODO: Restore Talent Dashboard routes when the final Talent Dashboard design is ready.
            // Talent users see the public homepage — do not auto-route them to TalentPortal.
            if (isAuthenticated && user?.role !== 'talent') {
              return <PostLoginPortalSelection />;
            }
            return <Home />;
          }} />
          <Route path="/client-dashboard" component={() => {
            if (isAuthenticated) {
              return <PostLoginPortalSelection />;
            }
            return <Home />;
          }} />
          {/* TODO: Restore Talent Dashboard routes when the final Talent Dashboard design is ready. */}
          <Route path="/talent-dashboard" component={RedirectToHome} />
          <Route path="/hire-talent" component={HireTalentPage} />
          <Route path="/client-profile" component={ClientProfile} />
          <Route path="/talent-pool" component={TalentPool} />
          <Route path="/client-search" component={ClientSearchRedirect} />
          <Route path="/pilot/:pilotId" component={PilotDashboard} />
          <Route path="/pilot" component={PilotDashboard} />
          <Route path="/find-work" component={FindWorkRedirect} />
          <Route path="/find-best-matches" component={FindBestMatches} />
          <Route path="/candidate-profile/:candidateId" component={CandidateProfile} />
          <Route path="/find-work/jobs" component={FindWorkAllJobs} />
          <Route path="/find-work/job/:jobId" component={FindWorkJob} />
          <Route path="/find-work/:category" component={FindWorkAllJobs} />
          <Route path="/jobs" component={FindWorkAllJobs} />
          <Route path="/jobs/:jobId/apply" component={JobApplyPage} />
          <Route path="/jobs/:jobId" component={FindWorkJob} />
          <Route path="/my-applications" component={TalentApplications} />
          <Route path="/inbox" component={Inbox} />
          <Route path="/talent/signup" component={TalentSignupFromApplication} />
          {/* TODO: Restore Talent Dashboard routes when the final Talent Dashboard design is ready. */}
          {/* Previously authenticated talent users were routed to TalentPortal here. */}
          <Route path="/get-hired" component={GetHired} />
          <Route path="/why-onspot" component={WhyOnSpot} />
          <Route path="/why-onspot/about" component={WhyOnSpotAbout} />
          <Route path="/why-onspot/case-studies" component={WhyOnSpotCaseStudies} />
          <Route path="/why-onspot/reviews" component={WhyOnSpotReviews} />
          <Route path="/why-onspot/experience" component={WhyOnSpotExperience} />
          <Route path="/why-onspot/integrator-system" component={WhyOnSpotIntegratorSystem} />
          <Route path="/why-onspot/value-calculator" component={WhyOnSpotValueCalculator} />
          <Route path="/faq" component={FAQ} />
          <Route path="/amazing" component={Amazing} />
          <Route path="/insights" component={Insights} />
          <Route path="/insights/:slug" component={InsightPost} />
          <Route path="/payment-protection" component={PaymentProtection} />
          <Route path="/client-verification" component={ClientVerification} />
          <Route path="/trust-safety" component={TrustSafety} />
          <Route path="/lead-intake" component={LeadIntake} />
          <Route path="/inquiry" component={InquiryPage} />
          <Route path="/inquiry/:id/review" component={InquiryReview} />
          <Route path="/inquiry/:id/payment" component={InquiryPayment} />
          <Route path="/inquiry/:id/success" component={InquirySuccess} />
          <Route path="/terms-and-conditions" component={TermsAndConditions} />
          <Route path="/refund-policy" component={RefundPolicy} />
          <Route path="/privacy-policy" component={PrivacyPolicy} />
          <Route path="/investors" component={InvestorsCorner} />
          <Route path="/powerapp" component={Powerapp} />
          <Route path="/operations-playbook" component={OperationsPlaybook} />
          <Route path="/admin/vanessa-responses" component={VanessaResponses} />
          <Route path="/admin/vanessa-learning" component={VanessaLearningDashboard} />
          <Route path="/admin/vanessa-rag" component={AdminVanessaRAG} />
          <Route path="/admin/insights" component={AdminInsights} />
          <Route path="/admin/insights/create" component={AdminInsightEditor} />
          <Route path="/admin/insights/:id/edit" component={AdminInsightEditor} />
          {/* Admin routes — protected when VITE_BYPASS_ADMIN_AUTH is not "true" */}
          <Route path="/admin/dashboard" component={() => bypassAdminAuth ? <AdminDashboard /> : <AdminProtectedRoute><AdminDashboard /></AdminProtectedRoute>} />
          <Route path="/admin/find-work" component={() => bypassAdminAuth ? <AdminFindWork /> : <AdminProtectedRoute><AdminFindWork /></AdminProtectedRoute>} />
          <Route path="/admin/find-work/jobs/new" component={() => bypassAdminAuth ? <JobFormPage /> : <AdminProtectedRoute><JobFormPage /></AdminProtectedRoute>} />
          <Route path="/admin/find-work/jobs/:jobId/edit" component={() => bypassAdminAuth ? <JobFormPage /> : <AdminProtectedRoute><JobFormPage /></AdminProtectedRoute>} />
          <Route path="/admin/job-applications" component={() => bypassAdminAuth ? <AdminJobApplications /> : <AdminProtectedRoute><AdminJobApplications /></AdminProtectedRoute>} />
          <Route path="/admin/email-templates" component={() => bypassAdminAuth ? <AdminEmailTemplates /> : <AdminProtectedRoute><AdminEmailTemplates /></AdminProtectedRoute>} />
          <Route path="/admin/email-templates/create" component={() => bypassAdminAuth ? <AdminEmailTemplateEditor /> : <AdminProtectedRoute><AdminEmailTemplateEditor /></AdminProtectedRoute>} />
          <Route path="/admin/email-templates/:id/edit" component={() => bypassAdminAuth ? <AdminEmailTemplateEditor /> : <AdminProtectedRoute><AdminEmailTemplateEditor /></AdminProtectedRoute>} />
          <Route path="/admin/image-uploader" component={() => bypassAdminAuth ? <AdminImageUploader /> : <AdminProtectedRoute><AdminImageUploader /></AdminProtectedRoute>} />
          <Route path="/admin/inquiries" component={() => bypassAdminAuth ? <AdminInquiries /> : <AdminProtectedRoute><AdminInquiries /></AdminProtectedRoute>} />
          <Route path="/admin/scaffold-jobs" component={() => bypassAdminAuth ? <AdminScaffoldJobs /> : <AdminProtectedRoute><AdminScaffoldJobs /></AdminProtectedRoute>} />
          <Route path="/admin/flagged-messages" component={() => bypassAdminAuth ? <AdminFlaggedMessages /> : <AdminProtectedRoute><AdminFlaggedMessages /></AdminProtectedRoute>} />
          {/* Service pages — with TopNavigation */}
          <Route path="/services/managed" component={ManagedServicesPage} />
          <Route path="/services/resourced" component={ResourcedServicesPage} />
          <Route path="/services/enterprise" component={EnterpriseServicesPage} />
          <Route path="/services/human-va" component={HumanVirtualAssistantPage} />
          <Route path="/services/human-virtual-assistant" component={HumanVirtualAssistantPage} />
          {/* Legacy routes for backward compatibility */}
          <Route path="/talent" component={TalentSearch} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function MessagesRoute() {
  // Talent users authenticate with a talent token and don't get the client sidebar;
  // client users are routed through ClientRouter (which includes /messages routes).
  const talentAuth = loadTalentAuth();
  const hasLegacyJwt = !!localStorage.getItem("onspot_jwt_token");
  if (talentAuth && !hasLegacyJwt) {
    return (
      <>
        <TopNavigation />
        <main>
          <Messages />
        </main>
      </>
    );
  }
  return <ClientRouter />;
}
function ClientRouter() {
  return (
    <ClientProtectedRoute>
      <ClientLayout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/talent" component={TalentSearch} />
          <Route path="/projects" component={() => <div className="p-6">Projects Module - Coming Soon</div>} />
          <Route path="/performance" component={() => <div className="p-6">Performance Module - Coming Soon</div>} />
          <Route path="/clients" component={() => <div className="p-6">Client Management Module - Coming Soon</div>} />
          <Route path="/contracts" component={() => <div className="p-6">Contracts Module - Coming Soon</div>} />
          <Route path="/payments" component={() => <div className="p-6">Payments Module - Coming Soon</div>} />
          <Route path="/roi" component={() => <div className="p-6">ROI Analytics Module - Coming Soon</div>} />
          <Route path="/insights" component={Insights} />
          <Route path="/insights/:slug" component={InsightPost} />
          <Route path="/admin/csv-import" component={() => (
            <AdminProtectedRoute>
              <AdminCSVImport />
            </AdminProtectedRoute>
          )} />
          <Route path="/settings" component={ProfileSettings} />
          <Route path="/messages/:threadId" component={Messages} />
          <Route path="/messages" component={Messages} />
          {/* Public routes accessible from client dashboard */}
          <Route path="/hire-talent" component={HireTalentPage} />
          <Route path="/talent-pool" component={TalentPool} />
          <Route path="/client-search" component={ClientSearchRedirect} />
          <Route path="/find-work" component={FindWorkRedirect} />
          <Route path="/find-best-matches" component={FindBestMatches} />
          <Route path="/find-work/jobs" component={FindWorkAllJobs} />
          <Route path="/find-work/job/:jobId" component={FindWorkJob} />
          <Route path="/find-work/:category" component={FindWorkAllJobs} />
          <Route path="/jobs" component={FindWorkAllJobs} />
          <Route path="/jobs/:jobId/apply" component={JobApplyPage} />
          <Route path="/jobs/:jobId" component={FindWorkJob} />
          <Route path="/talent/signup" component={TalentSignupFromApplication} />
          <Route component={NotFound} />
        </Switch>
      </ClientLayout>
    </ClientProtectedRoute>
  );
}

// Talent Routes (protected by authentication and role)
function TalentRouter() {
  return (
    <TalentProtectedRoute>
      <div className="min-h-screen bg-background">
        <Switch>
          <Route path="/" component={TalentPortal} />
          <Route path="/get-hired" component={TalentPortal} />
          <Route path="/talent-portal" component={TalentPortal} />
          <Route path="/hired-talent-portal" component={HiredTalentPortal} />
          <Route path="/settings" component={ProfileSettings} />
          {/* Redirect any other paths to talent portal */}
          <Route component={TalentPortal} />
        </Switch>
      </div>
    </TalentProtectedRoute>
  );
}

// SettingsRoute — named component so React preserves its identity across
// renders. Handles TWO separate auth systems that coexist in this app:
//
//   1. JWT auth (useAuth)      — client / admin / general-talent sessions.
//   2. Talent-only auth        — stored in localStorage via TalentLoginModal,
//                                used by /api/talent-auth/login. useAuth()
//                                does NOT know about this session, so we call
//                                loadTalentAuth() directly.
//
// Without checking both systems, a talent-only user sees user===null and gets
// bounced to /login, which then redirects them back to /talent-profile/:id —
// making it look like Settings "redirects to Talent Profile."
function SettingsRoute() {
  const { isLoading, user } = useAuth();
  const [, navigate] = useLocation();

  // Read talent-only localStorage session once on mount.
  const [talentOnlyAuth] = useState(() => loadTalentAuth());

  // All hooks at top level — no hooks after conditional returns.
  // Only redirect to login once JWT auth has resolved AND there is no
  // talent-only session either.
  useEffect(() => {
    if (!isLoading && !user && !talentOnlyAuth) {
      navigate("/login");
    }
  }, [isLoading, user, talentOnlyAuth]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show spinner while JWT auth is still initialising.
  // (Talent-only auth is synchronous, so no spinner needed for that path.)
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading settings…</p>
        </div>
      </div>
    );
  }

  // Talent-only session (separate from JWT auth) — render directly.
  if (talentOnlyAuth) {
    return (
      <div className="min-h-screen bg-background">
        <ProfileSettings />
      </div>
    );
  }

  // JWT session: talent or client.
  if (user?.role === "talent") {
    return (
      <div className="min-h-screen bg-background">
        <ProfileSettings />
      </div>
    );
  }

  if (user?.role === "client") {
    return (
      <ClientLayout>
        <ProfileSettings />
      </ClientLayout>
    );
  }

  // No valid session — useEffect above navigates to /login.
  return null;
}

function AppContent() {
  const { isAuthenticated, isLoading, user } = useAuth();
  
  // Always show public routes, but protected routes will handle their own redirects
  return (
    <Switch>
      {/* Immersive Routes - Full screen without navigation */}
      <Route path="/ai-assistant" component={ImmersivePage} />
      <Route path="/waitlist" component={ImmersivePage} />
      <Route path="/pricing" component={ImmersivePage} />
      <Route path="/enterprise" component={ImmersivePage} />
      <Route path="/affiliate-marketing" component={ImmersivePage} />
      <Route path="/bpo-partner" component={ImmersivePage} />
      
      {/* Service Routes */}
      <Route path="/services/ai-assistant" component={ImmersivePage} />
      
      {/* Superhuman Project - Immersive cinematic experience */}
      <Route path="/superhuman" component={SuperhumanImmersive} />
      
      {/* LegalOps Landing - Clean landing page without navigation */}
      <Route path="/legal-ops" component={LegalOpsImmersive} />
      
      {/* Public Routes - Always available */}
      <Route path="/" component={PublicRouter} />
      <Route path="/hire-talent" component={PublicRouter} />
      <Route path="/talent-pool" component={PublicRouter} />
      <Route path="/find-work" component={PublicRouter} />
      <Route path="/find-best-matches" component={PublicRouter} />
      <Route path="/candidate-profile/:candidateId" component={CandidateProfile} />
      <Route path="/talent-profile/:id" component={TalentProfile} />
      <Route path="/find-work/jobs" component={PublicRouter} />
      <Route path="/find-work/job/:jobId" component={PublicRouter} />
      <Route path="/find-work/:category" component={PublicRouter} />
      <Route path="/jobs" component={PublicRouter} />
      <Route path="/jobs/:jobId/apply" component={JobApplyPage} />
      <Route path="/jobs/:jobId" component={PublicRouter} />
      <Route path="/my-applications" component={TalentApplications} />
      <Route path="/inbox" component={Inbox} />
      <Route path="/talent/signup" component={TalentSignupFromApplication} />
      <Route path="/get-hired" component={PublicRouter} />
      <Route path="/why-onspot" component={PublicRouter} />
      <Route path="/why-onspot/:page" component={PublicRouter} />
      <Route path="/amazing" component={PublicRouter} />
      <Route path="/insights" component={PublicRouter} />
      <Route path="/insights/:slug" component={PublicRouter} />
      <Route path="/payment-protection" component={PublicRouter} />
      <Route path="/client-verification" component={PublicRouter} />
      <Route path="/trust-safety" component={PublicRouter} />
      <Route path="/lead-intake" component={PublicRouter} />
      <Route path="/inquiry" component={PublicRouter} />
      <Route path="/inquiry/:id/review" component={PublicRouter} />
      <Route path="/inquiry/:id/payment" component={PublicRouter} />
      <Route path="/inquiry/:id/success" component={PublicRouter} />
      <Route path="/investors" component={PublicRouter} />
      <Route path="/talent" component={PublicRouter} />
      <Route path="/operations-playbook" component={PublicRouter} />
      <Route path="/powerapp" component={PublicRouter} />
      <Route path="/admin/vanessa-responses" component={PublicRouter} />
      <Route path="/admin/vanessa-learning" component={PublicRouter} />
      
      {/* Client Protected Routes */}
      <Route path="/dashboard" component={ClientRouter} />
      <Route path="/projects" component={ClientRouter} />
      <Route path="/performance" component={ClientRouter} />
      <Route path="/clients" component={ClientRouter} />
      <Route path="/contracts" component={ClientRouter} />
      <Route path="/payments" component={ClientRouter} />
      <Route path="/roi" component={ClientRouter} />
      {/* Messages — available for both client (sidebar layout) and talent (standalone) */}
      <Route path="/messages/:threadId" component={MessagesRoute} />
      <Route path="/messages" component={MessagesRoute} />
      {/* Old /talent-portal/applications URL — redirect FIRST, before /talent-portal prefix can match it */}
      <Route path="/talent-portal/applications" component={() => { const [, nav] = useLocation(); useEffect(() => { nav("/my-applications"); }, []); return null; }} />
      {/* TODO: Restore Talent Dashboard routes when the final Talent Dashboard design is ready. */}
      {/* Talent Portal routes temporarily redirect to the public homepage. */}
      <Route path="/talent-portal" component={RedirectToHome} />
      <Route path="/hired-talent-portal" component={RedirectToHome} />
      
      {/* Settings Routes - Available for both client and talent */}
      <Route path="/settings" component={SettingsRoute} />
      {/* Profile Settings Route - Alias for /settings */}
      <Route path="/profile-settings" component={SettingsRoute} />
      
      {/* Standalone Login Page — must be before catch-all */}
      <Route path="/login" component={PortalLogin} />
      <Route path="/sign-in" component={PortalLogin} />
      {/* Portal login — used by the job-apply flow when an existing email is detected */}
      <Route path="/portal-login" component={PortalLogin} />

      {/* Catch all */}
      <Route component={() => <PublicRouter />} />
    </Switch>
  );
}

function GlobalVanessaWidget() {
  const { showVanessaChat, isMinimized, openVanessa, closeVanessa } = useVanessa();

  return (
    <>
      {/* Global Vanessa AI Assistant */}
      <VanessaChat 
        isOpen={showVanessaChat} 
        onClose={closeVanessa}
        isSticky={true}
      />
      
      {/* Global Persistent Floating Button — visible whenever chat is fully closed */}
      {!showVanessaChat && (
        <button
          onClick={openVanessa}
          aria-label="Open Vanessa AI assistant"
          data-testid="button-open-vanessa-global"
          style={{
            position: "fixed",
            bottom: "var(--vanessa-launcher-bottom, 24px)",
            right: "var(--vanessa-launcher-right, 24px)",
            zIndex: 9000,
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            cursor: "pointer",
            boxShadow: "0 8px 32px rgba(124, 58, 237, 0.45)",
            transition: "box-shadow 0.2s ease, transform 0.15s ease, bottom 0.3s ease",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 40px rgba(124, 58, 237, 0.7)";
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.05)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 32px rgba(124, 58, 237, 0.45)";
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
          }}
        >
          <MessageCircle size={28} />
        </button>
      )}
    </>
  );
}

function App() {
  const oauthError = useOAuthError();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider defaultTheme="light" storageKey="onspot-ui-theme">
          <AuthProvider>
            <VanessaProvider>
              {/* Dynamic SEO + GEO meta tags and schemas (US/PH) */}
              <HeadSEO />
              <DomainRouter>
                <NewUserOnboardingWrapper>
                  <AppContent />
                </NewUserOnboardingWrapper>
              </DomainRouter>
              <OAuthErrorDialog {...oauthError} open={oauthError.show} />
              <Toaster />
              <GlobalVanessaWidget />
            </VanessaProvider>
          </AuthProvider>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
