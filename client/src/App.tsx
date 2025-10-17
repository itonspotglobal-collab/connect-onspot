import { Switch, Route } from "wouter";
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
import Insights from "@/pages/Insights";
import NotFound from "@/pages/not-found";
import ComingSoon from "@/pages/ComingSoon";
import PaymentProtection from "@/pages/PaymentProtection";
import ClientVerification from "@/pages/ClientVerification";
import TrustSafety from "@/pages/TrustSafety";
import LeadIntake from "@/pages/LeadIntake";
import AdminCSVImport from "@/pages/AdminCSVImport";
import AdminDashboard from "@/pages/AdminDashboard";
import InvestorsCorner from "@/pages/InvestorsCorner";
import ProfileSettings from "@/pages/ProfileSettings";
import Powerapp from "@/pages/Powerapp";

// Public Routes - Always available regardless of authentication
function PublicRouter() {
  const { isAuthenticated, user } = useAuth();
  
  return (
    <div className="min-h-screen bg-background">
      <TopNavigation />
      <main>
        <Switch>
          <Route path="/" component={() => {
            if (isAuthenticated) {
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
          <Route path="/talent-dashboard" component={() => {
            if (isAuthenticated) {
              return <PostLoginPortalSelection />;
            }
            return <Home />;
          }} />
          <Route path="/hire-talent" component={TalentSearch} />
          <Route path="/find-work" component={FindWork} />
          <Route path="/find-work/:category" component={FindWork} />
          <Route path="/get-hired" component={() => {
            // Allow both authenticated and non-authenticated access to GetHired
            if (isAuthenticated && user?.userType === 'talent') {
              return <TalentPortal />;
            }
            return <GetHired />;
          }} />
          <Route path="/why-onspot" component={WhyOnSpot} />
          <Route path="/why-onspot/about" component={WhyOnSpotAbout} />
          <Route path="/why-onspot/case-studies" component={WhyOnSpotCaseStudies} />
          <Route path="/why-onspot/reviews" component={WhyOnSpotReviews} />
          <Route path="/why-onspot/experience" component={WhyOnSpotExperience} />
          <Route path="/why-onspot/integrator-system" component={WhyOnSpotIntegratorSystem} />
          <Route path="/why-onspot/value-calculator" component={WhyOnSpotValueCalculator} />
          <Route path="/amazing" component={Amazing} />
          <Route path="/pricing" component={ComingSoon} />
          <Route path="/enterprise" component={ComingSoon} />
          <Route path="/affiliate-marketing" component={ComingSoon} />
          <Route path="/bpo-partner" component={ComingSoon} />
          <Route path="/insights" component={Insights} />
          <Route path="/payment-protection" component={PaymentProtection} />
          <Route path="/client-verification" component={ClientVerification} />
          <Route path="/trust-safety" component={TrustSafety} />
          <Route path="/lead-intake" component={LeadIntake} />
          <Route path="/investors" component={InvestorsCorner} />
          <Route path="/powerapp" component={Powerapp} />
          {/* Legacy routes for backward compatibility */}
          <Route path="/talent" component={TalentSearch} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

// Client Routes (protected by authentication and role)
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
          <Route path="/admin/csv-import" component={() => (
            <AdminProtectedRoute>
              <AdminCSVImport />
            </AdminProtectedRoute>
          )} />
          <Route path="/admin/dashboard" component={() => (
            <AdminProtectedRoute>
              <AdminDashboard />
            </AdminProtectedRoute>
          )} />
          <Route path="/settings" component={ProfileSettings} />
          {/* Public routes accessible from client dashboard */}
          <Route path="/hire-talent" component={TalentSearch} />
          <Route path="/find-work" component={FindWork} />
          <Route path="/find-work/:category" component={FindWork} />
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

function AppContent() {
  const { isAuthenticated, isLoading, user } = useAuth();
  
  // Always show public routes, but protected routes will handle their own redirects
  return (
    <Switch>
      {/* Public Routes - Always available */}
      <Route path="/" component={PublicRouter} />
      <Route path="/hire-talent" component={PublicRouter} />
      <Route path="/find-work" component={PublicRouter} />
      <Route path="/find-work/:category" component={PublicRouter} />
      <Route path="/get-hired" component={PublicRouter} />
      <Route path="/why-onspot" component={PublicRouter} />
      <Route path="/why-onspot/:page" component={PublicRouter} />
      <Route path="/amazing" component={PublicRouter} />
      <Route path="/pricing" component={PublicRouter} />
      <Route path="/enterprise" component={PublicRouter} />
      <Route path="/affiliate-marketing" component={PublicRouter} />
      <Route path="/bpo-partner" component={PublicRouter} />
      <Route path="/insights" component={PublicRouter} />
      <Route path="/payment-protection" component={PublicRouter} />
      <Route path="/client-verification" component={PublicRouter} />
      <Route path="/trust-safety" component={PublicRouter} />
      <Route path="/lead-intake" component={PublicRouter} />
      <Route path="/investors" component={PublicRouter} />
      <Route path="/talent" component={PublicRouter} />
      
      {/* Client Protected Routes */}
      <Route path="/dashboard" component={ClientRouter} />
      <Route path="/projects" component={ClientRouter} />
      <Route path="/performance" component={ClientRouter} />
      <Route path="/clients" component={ClientRouter} />
      <Route path="/contracts" component={ClientRouter} />
      <Route path="/payments" component={ClientRouter} />
      <Route path="/roi" component={ClientRouter} />
      {/* Talent Protected Routes */}
      <Route path="/talent-portal" component={TalentRouter} />
      <Route path="/hired-talent-portal" component={TalentRouter} />
      
      {/* Settings Routes - Available for both client and talent */}
      <Route path="/settings" component={() => {
        const { user } = useAuth();
        if (user?.role === "client") {
          return (
            <ClientProtectedRoute>
              <ClientLayout>
                <ProfileSettings />
              </ClientLayout>
            </ClientProtectedRoute>
          );
        } else if (user?.role === "talent") {
          return (
            <TalentProtectedRoute>
              <div className="min-h-screen bg-background">
                <ProfileSettings />
              </div>
            </TalentProtectedRoute>
          );
        }
        return <PublicRouter />;
      }} />
      
      {/* Profile Settings Route - Alias for /settings */}
      <Route path="/profile-settings" component={() => {
        const { user } = useAuth();
        if (user?.role === "client") {
          return (
            <ClientProtectedRoute>
              <ClientLayout>
                <ProfileSettings />
              </ClientLayout>
            </ClientProtectedRoute>
          );
        } else if (user?.role === "talent") {
          return (
            <TalentProtectedRoute>
              <div className="min-h-screen bg-background">
                <ProfileSettings />
              </div>
            </TalentProtectedRoute>
          );
        }
        return <PublicRouter />;
      }} />
      
      {/* Catch all */}
      <Route component={() => <PublicRouter />} />
    </Switch>
  );
}

function GlobalVanessaWidget() {
  const { showVanessaChat, hasInteractedWithVanessa, isMinimized, openVanessa, closeVanessa } = useVanessa();

  return (
    <>
      {/* Global Vanessa AI Assistant */}
      <VanessaChat 
        isOpen={showVanessaChat} 
        onClose={closeVanessa}
        isSticky={true}
      />
      
      {/* Global Persistent Floating Button (shows when minimized or chat closed, after first interaction) */}
      {hasInteractedWithVanessa && (!showVanessaChat || isMinimized) && (
        <Button
          size="icon"
          onClick={openVanessa}
          className="fixed bottom-6 right-6 z-50 h-16 w-16 rounded-full bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-2xl hover:shadow-[0_0_30px_rgba(139,92,246,0.6)] hover-elevate animate-in slide-in-from-bottom-4 duration-500"
          data-testid="button-open-vanessa-global"
        >
          <MessageCircle className="h-7 w-7" />
        </Button>
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
