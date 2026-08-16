import onspotLogo from "@assets/OnSpot_Logo_2026_1784298008227.png";
import { cn } from "@/lib/utils";

interface OnSpotLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "white";
}

export function OnSpotLogo({ className, size = "md" }: OnSpotLogoProps) {
  const heights = {
    sm: "h-6",
    md: "h-8",
    lg: "h-12",
  };

  return (
    <img
      src={onspotLogo}
      alt="OnSpot"
      className={cn(heights[size], "w-auto", className)}
    />
  );
}
