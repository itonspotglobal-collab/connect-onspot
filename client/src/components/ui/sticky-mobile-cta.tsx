import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface MobileCTAAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "outline" | "ghost" | "secondary" | "destructive";
  size?: "default" | "sm" | "lg";
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  testId?: string;
}

interface StickyMobileCTAProps {
  /** Primary action button (typically Save, Continue, Submit) */
  primaryAction: MobileCTAAction;
  /** Optional secondary action button (typically Cancel, Back, Skip) */
  secondaryAction?: MobileCTAAction;
  /** Additional custom content to display above the buttons */
  children?: ReactNode;
  /** Whether to show the sticky CTA (defaults to true) */
  show?: boolean;
  /** Custom className for styling */
  className?: string;
  /** Background color variant */
  background?: "default" | "card" | "muted";
}

/**
 * StickyMobileCTA - A bottom-fixed CTA component optimized for mobile devices
 * 
 * Features:
 * - Fixed positioning at bottom on mobile only (hidden on desktop)
 * - Safe area padding for modern mobile devices
 * - Backdrop blur and shadow for visual separation
 * - Support for primary and secondary actions
 * - Loading states and accessibility features
 * - Responsive behavior with proper touch targets
 * 
 * Usage:
 * ```tsx
 * <StickyMobileCTA
 *   primaryAction={{
 *     label: "Save & Continue",
 *     onClick: handleSave,
 *     loading: isLoading,
 *     testId: "button-save-continue"
 *   }}
 *   secondaryAction={{
 *     label: "Skip for now",
 *     onClick: handleSkip,
 *     variant: "outline",
 *     testId: "button-skip"
 *   }}
 * />
 * ```
 */
export function StickyMobileCTA({
  primaryAction,
  secondaryAction,
  children,
  show = true,
  className,
  background = "default"
}: StickyMobileCTAProps) {
  if (!show) return null;

  const backgroundClasses = {
    default: "bg-background/95",
    card: "bg-card/95", 
    muted: "bg-muted/95"
  };

  return (
    <div
      className={cn(
        // Mobile-only sticky positioning
        "fixed bottom-0 left-0 right-0 z-50",
        "md:hidden", // Hidden on desktop and tablet
        // Background and visual effects
        backgroundClasses[background],
        "backdrop-blur-sm",
        "border-t border-border/50",
        "shadow-lg shadow-black/10",
        // Safe area padding for modern mobile devices
        "pb-safe-area",
        // Internal spacing and layout
        "px-4 pt-4 pb-6",
        className
      )}
      role="complementary"
      aria-label="Mobile actions"
    >
      {/* Optional custom content */}
      {children && (
        <div className="mb-4">
          {children}
        </div>
      )}
      
      {/* Action buttons */}
      <div className="flex gap-3">
        {/* Secondary action (if provided) */}
        {secondaryAction && (
          <Button
            variant={secondaryAction.variant || "outline"}
            size={secondaryAction.size || "default"}
            onClick={secondaryAction.onClick}
            disabled={secondaryAction.disabled || primaryAction.loading}
            className="flex-1 min-h-12 text-base" // Enhanced touch target
            data-testid={secondaryAction.testId}
          >
            {secondaryAction.icon && (
              <span className="mr-2">
                {secondaryAction.icon}
              </span>
            )}
            {secondaryAction.label}
          </Button>
        )}
        
        {/* Primary action */}
        <Button
          variant={primaryAction.variant || "default"}
          size={primaryAction.size || "default"}
          onClick={primaryAction.onClick}
          disabled={primaryAction.disabled || primaryAction.loading}
          className={cn(
            // Responsive sizing
            secondaryAction ? "flex-2" : "w-full",
            // Enhanced touch target
            "min-h-12 text-base font-semibold",
            // Loading state styling
            primaryAction.loading && "cursor-not-allowed"
          )}
          data-testid={primaryAction.testId}
        >
          {primaryAction.loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading...
            </>
          ) : (
            <>
              {primaryAction.icon && (
                <span className="mr-2">
                  {primaryAction.icon}
                </span>
              )}
              {primaryAction.label}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/**
 * Hook to manage sticky CTA state and provide scroll-based visibility
 * Useful for showing/hiding CTAs based on form validity or scroll position
 */
export function useStickyMobileCTA(initialShow: boolean = true) {
  return {
    show: initialShow,
    // Future: Could add scroll-based logic, form validation state, etc.
  };
}

/**
 * Higher-order component wrapper for pages that use sticky mobile CTAs
 * Adds bottom padding to prevent content from being hidden behind the CTA
 */
export function WithStickyMobileCTA({ 
  children, 
  className 
}: { 
  children: ReactNode; 
  className?: string; 
}) {
  return (
    <div className={cn("pb-20 md:pb-0", className)}>
      {children}
    </div>
  );
}