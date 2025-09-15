import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import Home from "@/pages/Home";
import TalentSearch from "@/pages/TalentSearch";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/talent" component={TalentSearch} />
      <Route path="/projects" component={() => <div className="p-6">Projects Module - Coming Soon</div>} />
      <Route path="/performance" component={() => <div className="p-6">Performance Module - Coming Soon</div>} />
      <Route path="/clients" component={() => <div className="p-6">Clients Module - Coming Soon</div>} />
      <Route path="/contracts" component={() => <div className="p-6">Contracts Module - Coming Soon</div>} />
      <Route path="/payments" component={() => <div className="p-6">Payments Module - Coming Soon</div>} />
      <Route path="/roi" component={() => <div className="p-6">ROI Analytics Module - Coming Soon</div>} />
      <Route path="/insights" component={() => <div className="p-6">AI Insights Module - Coming Soon</div>} />
      <Route path="/settings" component={() => <div className="p-6">Settings Module - Coming Soon</div>} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const sidebarStyle = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "4rem",
  } as React.CSSProperties;

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider defaultTheme="light" storageKey="onspot-ui-theme">
          <SidebarProvider style={sidebarStyle}>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <div className="flex flex-col flex-1">
                <header className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                  <div className="flex items-center gap-2">
                    <SidebarTrigger data-testid="button-sidebar-toggle" />
                    <div className="font-semibold text-lg">OnSpot Platform</div>
                    <div className="text-xs text-muted-foreground bg-primary/10 px-2 py-1 rounded">
                      MVP
                    </div>
                  </div>
                  <ThemeToggle />
                </header>
                <main className="flex-1 overflow-auto p-6">
                  <Router />
                </main>
              </div>
            </div>
          </SidebarProvider>
          <Toaster />
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
