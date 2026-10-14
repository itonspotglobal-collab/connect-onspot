import onspotLogo from "@assets/OnSpot_Logo_2026_1784298008227.png";

interface AuthBrandLogoProps {
  /** Width includes the transparent padding in the supplied brand asset. */
  size?: "compact" | "standard";
  className?: string;
}

export function AuthBrandLogo({ size = "standard", className = "" }: AuthBrandLogoProps) {
  return (
    <span
      className={`auth-brand-logo inline-flex shrink-0 items-center justify-center rounded-xl bg-[#12143f] px-2.5 py-1.5 ${className}`}
    >
      <img
        src={onspotLogo}
        alt="OnSpot"
        className={size === "compact" ? "block h-auto w-[168px] max-w-full" : "block h-auto w-[208px] max-w-full"}
      />
    </span>
  );
}
