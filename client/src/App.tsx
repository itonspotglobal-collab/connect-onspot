import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { TopNavigation } from "@/components/TopNavigation";
import Home from "@/pages/Home";
import TalentSearch from "@/pages/TalentSearch";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/hire-talent" component={TalentSearch} />
      <Route path="/get-hired" component={() => <div className="container mx-auto p-8 text-center">Get Hired - Coming Soon</div>} />
      <Route path="/why-onspot" component={() => <div className="container mx-auto p-8 text-center">Why OnSpot - Coming Soon</div>} />
      <Route path="/amazing" component={() => <div className="container mx-auto p-8 text-center">Amazing Stories - Coming Soon</div>} />
      <Route path="/pricing" component={() => <div className="container mx-auto p-8 text-center">Pricing - Coming Soon</div>} />
      <Route path="/enterprise" component={() => <div className="container mx-auto p-8 text-center">Enterprise Solutions - Coming Soon</div>} />
      <Route path="/insights" component={() => <div className="container mx-auto p-8 text-center">Insights - Coming Soon</div>} />
      {/* Legacy routes for backward compatibility */}
      <Route path="/talent" component={TalentSearch} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider defaultTheme="light" storageKey="onspot-ui-theme">
          <div className="min-h-screen bg-background">
            <TopNavigation />
            <main>
              <Router />
            </main>
          </div>
          <Toaster />
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
