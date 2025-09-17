import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Shield, 
  Lock, 
  Eye, 
  CheckCircle2, 
  FileCheck,
  Globe,
  Server,
  CreditCard,
  Key,
  UserCheck,
  AlertTriangle,
  Award
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface SecurityBadgeProps {
  type: "ssl" | "pci" | "gdpr" | "soc2" | "privacy" | "verified" | "encrypted" | "monitored";
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export function SecurityBadge({ 
  type, 
  size = "md", 
  showLabel = true,
  className 
}: SecurityBadgeProps) {
  const getSecurityConfig = () => {
    switch (type) {
      case "ssl":
        return {
          icon: Lock,
          label: "SSL Secured",
          bgColor: "bg-green-500/10 dark:bg-green-500/20",
          textColor: "text-green-700 dark:text-green-400",
          borderColor: "border-green-200 dark:border-green-500/30",
          iconColor: "text-green-600 dark:text-green-400"
        };
      case "pci":
        return {
          icon: CreditCard,
          label: "PCI Compliant",
          bgColor: "bg-blue-500/10 dark:bg-blue-500/20",
          textColor: "text-blue-700 dark:text-blue-400",
          borderColor: "border-blue-200 dark:border-blue-500/30",
          iconColor: "text-blue-600 dark:text-blue-400"
        };
      case "gdpr":
        return {
          icon: Eye,
          label: "GDPR Compliant",
          bgColor: "bg-purple-500/10 dark:bg-purple-500/20",
          textColor: "text-purple-700 dark:text-purple-400",
          borderColor: "border-purple-200 dark:border-purple-500/30",
          iconColor: "text-purple-600 dark:text-purple-400"
        };
      case "soc2":
        return {
          icon: Award,
          label: "SOC 2 Certified",
          bgColor: "bg-indigo-500/10 dark:bg-indigo-500/20",
          textColor: "text-indigo-700 dark:text-indigo-400",
          borderColor: "border-indigo-200 dark:border-indigo-500/30",
          iconColor: "text-indigo-600 dark:text-indigo-400"
        };
      case "privacy":
        return {
          icon: Shield,
          label: "Privacy Protected",
          bgColor: "bg-teal-500/10 dark:bg-teal-500/20",
          textColor: "text-teal-700 dark:text-teal-400",
          borderColor: "border-teal-200 dark:border-teal-500/30",
          iconColor: "text-teal-600 dark:text-teal-400"
        };
      case "verified":
        return {
          icon: UserCheck,
          label: "Identity Verified",
          bgColor: "bg-emerald-500/10 dark:bg-emerald-500/20",
          textColor: "text-emerald-700 dark:text-emerald-400",
          borderColor: "border-emerald-200 dark:border-emerald-500/30",
          iconColor: "text-emerald-600 dark:text-emerald-400"
        };
      case "encrypted":
        return {
          icon: Key,
          label: "End-to-End Encrypted",
          bgColor: "bg-orange-500/10 dark:bg-orange-500/20",
          textColor: "text-orange-700 dark:text-orange-400",
          borderColor: "border-orange-200 dark:border-orange-500/30",
          iconColor: "text-orange-600 dark:text-orange-400"
        };
      case "monitored":
        return {
          icon: Server,
          label: "24/7 Monitored",
          bgColor: "bg-red-500/10 dark:bg-red-500/20",
          textColor: "text-red-700 dark:text-red-400",
          borderColor: "border-red-200 dark:border-red-500/30",
          iconColor: "text-red-600 dark:text-red-400"
        };
      default:
        return {
          icon: CheckCircle2,
          label: "Secure",
          bgColor: "bg-muted/20",
          textColor: "text-muted-foreground",
          borderColor: "border-muted",
          iconColor: "text-muted-foreground"
        };
    }
  };

  const config = getSecurityConfig();
  const IconComponent = config.icon;

  const getSizeClasses = () => {
    switch (size) {
      case "sm":
        return {
          badge: "px-2 py-1 text-xs gap-1",
          icon: "h-3 w-3"
        };
      case "lg":
        return {
          badge: "px-4 py-2 text-sm gap-2",
          icon: "h-5 w-5"
        };
      default:
        return {
          badge: "px-3 py-1.5 text-sm gap-1.5",
          icon: "h-4 w-4"
        };
    }
  };

  const sizeClasses = getSizeClasses();

  return (
    <Badge 
      variant="outline" 
      className={cn(
        "inline-flex items-center font-medium border rounded-full transition-all duration-200",
        config.bgColor,
        config.textColor,
        config.borderColor,
        sizeClasses.badge,
        className
      )}
      data-testid={`badge-security-${type}`}
    >
      <IconComponent className={cn(sizeClasses.icon, config.iconColor)} />
      {showLabel && <span>{config.label}</span>}
    </Badge>
  );
}

export interface SecurityShowcaseProps {
  features?: ("ssl" | "pci" | "gdpr" | "privacy" | "encrypted" | "monitored")[];
  layout?: "grid" | "list" | "compact";
  className?: string;
}

export function SecurityShowcase({ 
  features = ["ssl", "pci", "gdpr", "privacy"],
  layout = "grid",
  className 
}: SecurityShowcaseProps) {
  if (layout === "compact") {
    return (
      <div className={cn("flex items-center gap-2 flex-wrap", className)}>
        {features.map((feature) => (
          <SecurityBadge key={feature} type={feature} size="sm" showLabel={false} />
        ))}
      </div>
    );
  }

  if (layout === "list") {
    return (
      <div className={cn("space-y-2", className)}>
        {features.map((feature) => (
          <SecurityBadge key={feature} type={feature} size="md" />
        ))}
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-2 gap-2", className)}>
      {features.map((feature) => (
        <SecurityBadge key={feature} type={feature} size="sm" />
      ))}
    </div>
  );
}

export interface TrustCertificationProps {
  certifications?: {
    name: string;
    description: string;
    icon?: string;
    verified: boolean;
  }[];
  className?: string;
}

export function TrustCertification({ 
  certifications = [
    {
      name: "SSL Certificate",
      description: "256-bit encryption for all data transmission",
      verified: true
    },
    {
      name: "PCI DSS Compliant", 
      description: "Secure payment processing standards",
      verified: true
    },
    {
      name: "SOC 2 Type II",
      description: "Audited security and availability controls",
      verified: true
    },
    {
      name: "GDPR Compliant",
      description: "European data protection regulations",
      verified: true
    }
  ],
  className 
}: TrustCertificationProps) {
  return (
    <Card className={cn("border-green-200 dark:border-green-500/30 bg-green-50/30 dark:bg-green-950/10", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
          <Shield className="h-5 w-5" />
          Security & Compliance Certifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {certifications.map((cert, index) => (
          <div key={index} className="flex items-start gap-3 p-3 bg-white dark:bg-background/50 rounded-lg border border-green-100 dark:border-green-500/20">
            <div className="flex-shrink-0 pt-1">
              {cert.verified ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              )}
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm text-foreground">
                {cert.name}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {cert.description}
              </div>
            </div>
          </div>
        ))}
        
        <div className="mt-4 p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg border border-blue-100 dark:border-blue-500/20">
          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
            <Eye className="h-4 w-4" />
            <span className="text-sm font-medium">Transparency Report</span>
          </div>
          <div className="text-xs text-blue-600/80 dark:text-blue-400/80 mt-1">
            Our security practices are audited monthly by independent third parties
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export interface DataProtectionIndicatorProps {
  showEncryption?: boolean;
  showPrivacy?: boolean;
  showCompliance?: boolean;
  showMonitoring?: boolean;
  compact?: boolean;
  className?: string;
}

export function DataProtectionIndicator({
  showEncryption = true,
  showPrivacy = true,
  showCompliance = true,
  showMonitoring = false,
  compact = false,
  className
}: DataProtectionIndicatorProps) {
  const protections = [];

  if (showEncryption) {
    protections.push({
      icon: Lock,
      label: "256-bit Encryption",
      description: "Military-grade data protection"
    });
  }

  if (showPrivacy) {
    protections.push({
      icon: Eye,
      label: "Privacy First",
      description: "Your data is never sold or shared"
    });
  }

  if (showCompliance) {
    protections.push({
      icon: FileCheck,
      label: "Compliance Ready",
      description: "Meets GDPR, CCPA, SOX standards"
    });
  }

  if (showMonitoring) {
    protections.push({
      icon: Server,
      label: "24/7 Monitoring",
      description: "Continuous security surveillance"
    });
  }

  if (compact) {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        {protections.map((protection, index) => {
          const IconComponent = protection.icon;
          return (
            <div key={index} className="flex items-center gap-1">
              <IconComponent className="h-3 w-3 text-green-600 dark:text-green-400" />
              {index < protections.length - 1 && (
                <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("grid gap-3", className)}>
      {protections.map((protection, index) => {
        const IconComponent = protection.icon;
        return (
          <div key={index} className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg border">
            <IconComponent className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
            <div>
              <div className="font-medium text-sm">{protection.label}</div>
              <div className="text-xs text-muted-foreground">{protection.description}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}