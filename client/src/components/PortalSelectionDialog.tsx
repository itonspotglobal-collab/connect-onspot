import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Building, User, Shield, Zap, Mail, CheckCircle, AlertCircle, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import onspotLogo from "@assets/OnSpot Log Full Purple Blue_1757942805752.png";

interface PortalSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type PortalType = "client" | "talent";

export function PortalSelectionDialog({ open, onOpenChange }: PortalSelectionDialogProps) {
  const [selectedPortal, setSelectedPortal] = useState<PortalType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const { user, enterPortal } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const userRole = user?.role as PortalType;

  const handlePortalSelect = async (portalType: PortalType) => {
    setSelectedPortal(portalType);
    setError(null);
    setIsNavigating(true);

    try {
      // Validate role against selected portal
      if (userRole !== portalType) {
        const errorMessage = `You do not have access to this portal. Please use your ${userRole} account.`;
        setError(errorMessage);
        
        toast({
          title: "Access Denied",
          description: errorMessage,
          variant: "destructive",
        });
        
        setIsNavigating(false);
        return;
      }

      // Role matches - proceed with navigation
      if (enterPortal) {
        const success = await enterPortal(portalType);
        if (success) {
          // Navigate to appropriate dashboard
          const dashboardPath = portalType === "client" ? "/client-dashboard" : "/talent-dashboard";
          setLocation(dashboardPath);
          
          toast({
            title: "Welcome!",
            description: `Welcome to your ${portalType} dashboard`,
          });
          
          onOpenChange(false);
        } else {
          setError("Failed to access portal. Please try again.");
        }
      } else {
        // Fallback navigation if enterPortal not available
        const dashboardPath = portalType === "client" ? "/dashboard" : "/talent-portal";
        setLocation(dashboardPath);
        onOpenChange(false);
      }
    } catch (error: any) {
      console.error('Portal selection error:', error);
      setError("An error occurred while accessing the portal. Please try again.");
      
      toast({
        title: "Portal Access Error",
        description: "An error occurred while accessing the portal. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsNavigating(false);
      setSelectedPortal(null);
    }
  };

  const getPortalAccess = (portalType: PortalType) => {
    return userRole === portalType;
  };

  const getPortalButtonState = (portalType: PortalType) => {
    const hasAccess = getPortalAccess(portalType);
    const isSelected = selectedPortal === portalType;
    
    return {
      hasAccess,
      isSelected,
      isLoading: isSelected && isNavigating,
      buttonText: hasAccess 
        ? (isSelected && isNavigating ? "Entering..." : "Enter Portal")
        : "Access Denied",
      variant: (hasAccess ? "default" : "secondary") as "default" | "secondary",
      disabled: !hasAccess || isNavigating
    };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()} // Prevent closing by clicking outside
        onEscapeKeyDown={(e) => e.preventDefault()} // Prevent closing with ESC
      >
        <DialogHeader className="space-y-4">
          <div className="flex items-center justify-center mb-4">
            <img 
              src={onspotLogo} 
              alt="OnSpot Logo" 
              className="h-12 w-auto"
            />
          </div>
          
          <DialogTitle className="text-2xl text-center">
            Welcome to OnSpot, {user?.firstName}!
          </DialogTitle>
          
          <DialogDescription className="text-base text-center">
            Please select your portal to continue to your dashboard
          </DialogDescription>
          
          {user?.role && (
            <div className="text-center">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary/10 text-primary">
                <CheckCircle className="w-4 h-4 mr-2" />
                Authenticated as: {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
              </span>
            </div>
          )}
        </DialogHeader>

        <div className="space-y-6">
          {error && (
            <div className="flex items-center gap-2 p-4 border border-destructive/20 bg-destructive/5 rounded-lg">
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}

          {/* Portal Selection Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Client Portal Card */}
            <Card 
              className={`relative cursor-pointer transition-all duration-300 border-2 ${
                getPortalAccess("client") 
                  ? "hover-elevate hover:border-primary/50" 
                  : "opacity-60 cursor-not-allowed border-muted"
              }`}
              onClick={() => getPortalAccess("client") && handlePortalSelect("client")}
              data-testid="card-client-portal"
            >
              <CardContent className="p-6 text-center relative">
                <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center transition-colors ${
                  getPortalAccess("client")
                    ? "bg-primary/10 group-hover:bg-primary/20"
                    : "bg-muted"
                }`}>
                  <Building className={`w-8 h-8 ${
                    getPortalAccess("client") ? "text-primary" : "text-muted-foreground"
                  }`} />
                </div>
                
                <h3 className="text-xl font-semibold mb-3">Client Portal</h3>
                <p className="text-muted-foreground mb-4 leading-relaxed text-sm">
                  Access your hiring dashboard, manage projects, and track performance.
                </p>
                
                <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground mb-4">
                  <div className="text-center">
                    <Shield className="h-4 w-4 mx-auto text-primary mb-1" />
                    <span>70% Savings</span>
                  </div>
                  <div className="text-center">
                    <Zap className="h-4 w-4 mx-auto text-primary mb-1" />
                    <span>8X Growth</span>
                  </div>
                  <div className="text-center">
                    <Mail className="h-4 w-4 mx-auto text-primary mb-1" />
                    <span>24/7 Support</span>
                  </div>
                </div>

                {(() => {
                  const state = getPortalButtonState("client");
                  return (
                    <Button
                      variant={state.variant}
                      size="sm"
                      disabled={state.disabled}
                      className="w-full"
                      aria-label="Enter Client Portal"
                      data-testid="button-enter-client-portal"
                    >
                      {state.isLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                          {state.buttonText}
                        </>
                      ) : (
                        <>
                          {state.buttonText}
                          {state.hasAccess && <ArrowRight className="w-4 h-4 ml-2" />}
                        </>
                      )}
                    </Button>
                  );
                })()}

                {!getPortalAccess("client") && (
                  <div className="absolute inset-0 bg-background/50 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground font-medium">Requires Client Account</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Talent Portal Card */}
            <Card 
              className={`relative cursor-pointer transition-all duration-300 border-2 ${
                getPortalAccess("talent") 
                  ? "hover-elevate hover:border-[hsl(var(--gold-yellow)/0.5)]" 
                  : "opacity-60 cursor-not-allowed border-muted"
              }`}
              onClick={() => getPortalAccess("talent") && handlePortalSelect("talent")}
              data-testid="card-talent-portal"
            >
              <CardContent className="p-6 text-center relative">
                <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center transition-colors ${
                  getPortalAccess("talent")
                    ? "bg-[hsl(var(--gold-yellow)/0.1)] group-hover:bg-[hsl(var(--gold-yellow)/0.2)]"
                    : "bg-muted"
                }`}>
                  <User className={`w-8 h-8 ${
                    getPortalAccess("talent") ? "text-[hsl(var(--gold-yellow)/0.8)]" : "text-muted-foreground"
                  }`} />
                </div>
                
                <h3 className="text-xl font-semibold mb-3">Talent Portal</h3>
                <p className="text-muted-foreground mb-4 leading-relaxed text-sm">
                  Find amazing projects, showcase your skills, and grow your career.
                </p>
                
                <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground mb-4">
                  <div className="text-center">
                    <CheckCircle className="h-4 w-4 mx-auto text-[hsl(var(--gold-yellow)/0.8)] mb-1" />
                    <span>Vetted Jobs</span>
                  </div>
                  <div className="text-center">
                    <Zap className="h-4 w-4 mx-auto text-[hsl(var(--gold-yellow)/0.8)] mb-1" />
                    <span>Fast Payout</span>
                  </div>
                  <div className="text-center">
                    <Shield className="h-4 w-4 mx-auto text-[hsl(var(--gold-yellow)/0.8)] mb-1" />
                    <span>Protection</span>
                  </div>
                </div>

                {(() => {
                  const state = getPortalButtonState("talent");
                  return (
                    <Button
                      variant={state.variant}
                      size="sm"
                      disabled={state.disabled}
                      className="w-full"
                      aria-label="Enter Talent Portal"
                      data-testid="button-enter-talent-portal"
                    >
                      {state.isLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                          {state.buttonText}
                        </>
                      ) : (
                        <>
                          {state.buttonText}
                          {state.hasAccess && <ArrowRight className="w-4 h-4 ml-2" />}
                        </>
                      )}
                    </Button>
                  );
                })()}

                {!getPortalAccess("talent") && (
                  <div className="absolute inset-0 bg-background/50 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground font-medium">Requires Talent Account</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Help Text */}
          <div className="text-center text-sm text-muted-foreground">
            <p>
              Having trouble? Contact our support team at{" "}
              <a href="mailto:support@onspotglobal.com" className="text-primary hover:underline">
                support@onspotglobal.com
              </a>
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}