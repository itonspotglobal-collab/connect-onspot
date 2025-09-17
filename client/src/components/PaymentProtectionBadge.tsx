import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Shield, 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  Lock,
  CreditCard,
  AlertCircle,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface PaymentProtectionBadgeProps {
  variant?: "badge" | "card" | "inline" | "detailed";
  amount?: number;
  currency?: string;
  escrowDays?: number;
  size?: "sm" | "md" | "lg";
  showDetails?: boolean;
  className?: string;
}

export function PaymentProtectionBadge({ 
  variant = "badge", 
  amount, 
  currency = "USD",
  escrowDays = 7,
  size = "md",
  showDetails = false,
  className 
}: PaymentProtectionBadgeProps) {
  
  if (variant === "badge") {
    return (
      <Badge 
        variant="outline" 
        className={cn(
          "inline-flex items-center gap-1.5 font-medium border rounded-full",
          "bg-blue-500/10 dark:bg-blue-500/20",
          "text-blue-700 dark:text-blue-400",
          "border-blue-200 dark:border-blue-500/30",
          size === "sm" && "px-2 py-1 text-xs gap-1",
          size === "lg" && "px-4 py-2 text-sm gap-2",
          size === "md" && "px-3 py-1.5 text-sm gap-1.5",
          className
        )}
        data-testid="badge-payment-protected"
      >
        <Shield className={cn(
          "text-blue-600 dark:text-blue-400",
          size === "sm" && "h-3 w-3",
          size === "lg" && "h-5 w-5",
          size === "md" && "h-4 w-4"
        )} />
        <span>Payment Protected</span>
      </Badge>
    );
  }

  if (variant === "inline") {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
          <Shield className="h-4 w-4" />
          <span className="font-medium">Secured</span>
        </div>
        {amount && (
          <span>
            {currency === "USD" ? "$" : currency}{amount.toLocaleString()} in escrow
          </span>
        )}
      </div>
    );
  }

  if (variant === "card") {
    return (
      <Card className={cn("border-blue-200 dark:border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20", className)}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 p-2 rounded-full bg-blue-500/10 dark:bg-blue-500/20">
              <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-blue-700 dark:text-blue-300 mb-1">
                Payment Protected by Escrow
              </div>
              <div className="text-sm text-blue-600/80 dark:text-blue-400/80 space-y-1">
                <div>• Funds secured until work completion</div>
                <div>• Automatic release after {escrowDays} days</div>
                <div>• Dispute resolution available</div>
              </div>
              {amount && (
                <div className="mt-3 p-2 bg-blue-100/50 dark:bg-blue-900/30 rounded-md">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-blue-700 dark:text-blue-300">Secured Amount:</span>
                    <span className="font-semibold text-blue-800 dark:text-blue-200">
                      {currency === "USD" ? "$" : currency}{amount.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (variant === "detailed") {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-semibold text-blue-700 dark:text-blue-300">
            Payment Protection Guarantee
          </h3>
        </div>
        
        <div className="grid gap-3">
          <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-500/30">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-green-700 dark:text-green-300">Escrow Protection</div>
              <div className="text-sm text-green-600 dark:text-green-400">
                Your payment is held securely until work is completed to your satisfaction
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-500/30">
            <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-blue-700 dark:text-blue-300">Auto-Release</div>
              <div className="text-sm text-blue-600 dark:text-blue-400">
                Funds automatically released after {escrowDays} days of work completion
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-500/30">
            <AlertCircle className="h-5 w-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-purple-700 dark:text-purple-300">Dispute Resolution</div>
              <div className="text-sm text-purple-600 dark:text-purple-400">
                Professional mediation available if issues arise
              </div>
            </div>
          </div>
        </div>

        {amount && (
          <Card className="border-2 border-dashed border-blue-300 dark:border-blue-600 bg-blue-50/30 dark:bg-blue-950/10">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                {currency === "USD" ? "$" : currency}{amount.toLocaleString()}
              </div>
              <div className="text-sm text-blue-600 dark:text-blue-400">
                Currently Secured in Escrow
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return null;
}

export interface PaymentSecurityIndicatorProps {
  features?: ("escrow" | "insurance" | "dispute" | "ssl" | "pci")[];
  compact?: boolean;
  className?: string;
}

export function PaymentSecurityIndicator({ 
  features = ["escrow", "insurance", "dispute"],
  compact = false,
  className 
}: PaymentSecurityIndicatorProps) {
  const getFeatureConfig = (feature: string) => {
    switch (feature) {
      case "escrow":
        return {
          icon: Shield,
          label: "Escrow Protected",
          color: "text-blue-600 dark:text-blue-400"
        };
      case "insurance":
        return {
          icon: Lock,
          label: "Insured Payments",
          color: "text-green-600 dark:text-green-400"
        };
      case "dispute":
        return {
          icon: AlertCircle,
          label: "Dispute Resolution",
          color: "text-purple-600 dark:text-purple-400"
        };
      case "ssl":
        return {
          icon: Lock,
          label: "SSL Secured",
          color: "text-gray-600 dark:text-gray-400"
        };
      case "pci":
        return {
          icon: CreditCard,
          label: "PCI Compliant",
          color: "text-orange-600 dark:text-orange-400"
        };
      default:
        return {
          icon: CheckCircle2,
          label: "Secured",
          color: "text-muted-foreground"
        };
    }
  };

  if (compact) {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        {features.map((feature, index) => {
          const config = getFeatureConfig(feature);
          const IconComponent = config.icon;
          return (
            <div key={feature} className="flex items-center gap-1">
              <IconComponent className={cn("h-3 w-3", config.color)} />
              {index < features.length - 1 && (
                <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("grid gap-2", className)}>
      {features.map((feature) => {
        const config = getFeatureConfig(feature);
        const IconComponent = config.icon;
        return (
          <div key={feature} className="flex items-center gap-2 text-sm">
            <IconComponent className={cn("h-4 w-4", config.color)} />
            <span className="text-muted-foreground">{config.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export interface EscrowStatusProps {
  status: "pending" | "secured" | "released" | "disputed";
  amount?: number;
  currency?: string;
  releaseDate?: string;
  className?: string;
}

export function EscrowStatus({ 
  status, 
  amount, 
  currency = "USD", 
  releaseDate,
  className 
}: EscrowStatusProps) {
  const getStatusConfig = () => {
    switch (status) {
      case "pending":
        return {
          icon: Clock,
          label: "Escrow Pending",
          bgColor: "bg-yellow-500/10 dark:bg-yellow-500/20",
          textColor: "text-yellow-700 dark:text-yellow-400",
          borderColor: "border-yellow-200 dark:border-yellow-500/30",
          iconColor: "text-yellow-600 dark:text-yellow-400"
        };
      case "secured":
        return {
          icon: Shield,
          label: "Funds Secured",
          bgColor: "bg-blue-500/10 dark:bg-blue-500/20",
          textColor: "text-blue-700 dark:text-blue-400",
          borderColor: "border-blue-200 dark:border-blue-500/30",
          iconColor: "text-blue-600 dark:text-blue-400"
        };
      case "released":
        return {
          icon: CheckCircle2,
          label: "Payment Released",
          bgColor: "bg-green-500/10 dark:bg-green-500/20",
          textColor: "text-green-700 dark:text-green-400",
          borderColor: "border-green-200 dark:border-green-500/30",
          iconColor: "text-green-600 dark:text-green-400"
        };
      case "disputed":
        return {
          icon: AlertCircle,
          label: "Under Review",
          bgColor: "bg-red-500/10 dark:bg-red-500/20",
          textColor: "text-red-700 dark:text-red-400",
          borderColor: "border-red-200 dark:border-red-500/30",
          iconColor: "text-red-600 dark:text-red-400"
        };
      default:
        return {
          icon: Info,
          label: "Status Unknown",
          bgColor: "bg-muted/20",
          textColor: "text-muted-foreground",
          borderColor: "border-muted",
          iconColor: "text-muted-foreground"
        };
    }
  };

  const config = getStatusConfig();
  const IconComponent = config.icon;

  return (
    <Card className={cn("border", config.borderColor, config.bgColor, className)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <IconComponent className={cn("h-5 w-5", config.iconColor)} />
          </div>
          <div className="flex-1">
            <div className={cn("font-medium", config.textColor)}>
              {config.label}
            </div>
            {amount && (
              <div className="text-sm text-muted-foreground mt-1">
                Amount: {currency === "USD" ? "$" : currency}{amount.toLocaleString()}
              </div>
            )}
            {releaseDate && status === "secured" && (
              <div className="text-sm text-muted-foreground mt-1">
                Auto-release: {releaseDate}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}