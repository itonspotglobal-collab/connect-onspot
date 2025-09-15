import { cn } from "@/lib/utils";

interface OnSpotLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "white";
}

export function OnSpotLogo({ className, size = "md", variant = "default" }: OnSpotLogoProps) {
  const sizes = {
    sm: "h-6",
    md: "h-8",
    lg: "h-12"
  };

  const colors = {
    default: "text-primary",
    white: "text-white"
  };

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      {/* OnSpot Icon/Symbol */}
      <div className={cn(
        "relative font-bold rounded-md flex items-center justify-center bg-primary text-primary-foreground",
        size === "sm" ? "w-6 h-6 text-sm" : size === "md" ? "w-8 h-8 text-base" : "w-12 h-12 text-xl"
      )}>
        <span className="relative">O</span>
        <div className={cn(
          "absolute rounded-full bg-primary-foreground",
          size === "sm" ? "w-1.5 h-1.5 top-1 right-1" : 
          size === "md" ? "w-2 h-2 top-1.5 right-1.5" : 
          "w-3 h-3 top-2 right-2"
        )} />
      </div>
      
      {/* OnSpot Text */}
      <div className={cn(
        "font-bold tracking-tight",
        colors[variant],
        size === "sm" ? "text-lg" : size === "md" ? "text-xl" : "text-2xl"
      )}>
        OnSpot
      </div>
    </div>
  );
}