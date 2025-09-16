import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { TopNavigation } from "@/components/TopNavigation";
import { ClientLayout } from "@/components/ClientLayout";
import { Footer } from "@/components/Footer";
import Home from "@/pages/Home";
import TalentSearch from "@/pages/TalentSearch";
import Dashboard from "@/pages/Dashboard";
import WhyOnSpot from "@/pages/WhyOnSpot";
import Amazing from "@/pages/Amazing";
import GetHired from "@/pages/GetHired";
import NotFound from "@/pages/not-found";

// Public Routes (before login)
function PublicRouter() {
  return (
    <div className="min-h-screen bg-background">
      <TopNavigation />
      <main>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/hire-talent" component={TalentSearch} />
          <Route path="/get-hired" component={GetHired} />
          <Route path="/why-onspot" component={WhyOnSpot} />
          <Route path="/amazing" component={Amazing} />
          <Route path="/pricing" component={() => <div className="container mx-auto p-8 text-center">Pricing - Coming Soon</div>} />
          <Route path="/enterprise" component={() => <div className="container mx-auto p-8 text-center">Enterprise Solutions - Coming Soon</div>} />
          <Route path="/insights" component={() => <div className="container mx-auto p-8 text-center">Insights - Coming Soon</div>} />
          {/* Legacy routes for backward compatibility */}
          <Route path="/talent" component={TalentSearch} />
          <Route component={NotFound} />
        </Switch>
      </main>
      <Footer />
    </div>
  );
}

// Client Routes (after login)
function ClientRouter() {
  return (
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
        <Route path="/insights" component={() => <div className="p-6">AI Insights Module - Coming Soon</div>} />
        <Route path="/settings" component={() => <div className="p-6">Settings Module - Coming Soon</div>} />
        {/* Public routes accessible from client dashboard */}
        <Route path="/hire-talent" component={TalentSearch} />
        <Route component={NotFound} />
      </Switch>
    </ClientLayout>
  );
}

function AppContent() {
  const { isAuthenticated } = useAuth();
  
  return isAuthenticated ? <ClientRouter /> : <PublicRouter />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider defaultTheme="light" storageKey="onspot-ui-theme">
          <AuthProvider>
            <AppContent />
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
