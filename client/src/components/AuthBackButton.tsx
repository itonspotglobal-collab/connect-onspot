import type { ReactNode, MouseEventHandler } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export interface AuthBackButtonProps {
  href: string;
  children?: ReactNode;
  variant?: "light" | "dark";
  disabled?: boolean;
  className?: string;
  testId?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}

export function AuthBackButton({
  href,
  children = "Back to Portal",
  variant = "light",
  disabled = false,
  className = "",
  testId,
  onClick,
}: AuthBackButtonProps) {
  const tone = variant === "dark"
    ? "border-white/20 bg-white/5 text-white/80 hover:border-white/35 hover:bg-white/10 hover:text-white focus-visible:ring-white/70"
    : "border-[#D7DCEF] bg-white/65 text-[#6D5EF7] hover:border-[#6D5EF7]/45 hover:bg-white hover:text-[#5546E0] focus-visible:ring-[#6D5EF7]";

  const classes = [
    "inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2",
    "text-sm font-medium leading-5 transition-colors duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    variant === "dark" ? "focus-visible:ring-offset-[#151545]" : "focus-visible:ring-offset-[#F4F6FF]",
    disabled ? "cursor-not-allowed opacity-50" : "",
    tone,
    className,
  ].filter(Boolean).join(" ");

  return (
    <Link
      href={disabled ? "#" : href}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : undefined}
      onClick={disabled ? (event) => event.preventDefault() : onClick}
      data-testid={testId}
      className={classes}
    >
      <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </Link>
  );
}
