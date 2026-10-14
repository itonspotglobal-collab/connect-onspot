import onspotLogo from "@assets/OnSpot_Logo_2026_1784298008227.png";

interface AuthBrandLogoProps {
  size?: "compact" | "standard";
  /** Adds a restrained dark edge so the white mark remains legible on light surfaces. */
  tone?: "navy" | "light";
  className?: string;
}

export function AuthBrandLogo({ size = "standard", tone = "navy", className = "" }: AuthBrandLogoProps) {
  return (
    <img
      src={onspotLogo}
      alt="OnSpot"
      className={`auth-brand-logo block h-auto max-w-full shrink-0 ${size === "compact" ? "w-[168px]" : "w-[208px]"} ${tone === "light" ? "auth-brand-logo-light" : ""} ${className}`}
    />
  );
}
