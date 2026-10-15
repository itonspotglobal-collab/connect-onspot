import type { ReactNode } from "react";
import { useLocation, useSearch } from "wouter";
import onspotLogo from "@/assets/onspot-white-wordmark.png";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAuthModalPresentation } from "@/components/AuthModalPresentation";
import { authBackDestination } from "@/lib/authBackNavigation";

interface AuthModalFrameProps {
  children: ReactNode;
  title: string;
  wide?: boolean;
}

/** Shared dark auth modal shell, visually aligned with the signup dialog. */
export function AuthModalFrame({ children, title, wide = false }: AuthModalFrameProps) {
  const [, navigate] = useLocation();
  const search = useSearch();
  const presentation = useAuthModalPresentation();

  const dismiss = () => {
    if (presentation?.onClose) {
      presentation.onClose();
      return;
    }
    navigate(authBackDestination(search));
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) dismiss(); }}>
      <DialogContent
        aria-describedby={undefined}
        className={[
          "p-0 border-0 bg-transparent shadow-none overflow-visible motion-reduce:animate-none",
          wide ? "w-[min(780px,calc(100vw-1.5rem))]" : "w-[min(520px,calc(100vw-1.5rem))]",
          "max-w-none sm:max-w-none",
        ].join(" ")}
        overlayClassName="bg-black/45 backdrop-blur-[4px] z-[10000]"
        containerClassName="z-[10000] [&>div]:!items-center [&>div]:!pt-4 [&>div]:!pb-4 [&>div]:!px-3 sm:[&>div]:!px-6"
        closeClassName="flex h-11 w-11 items-center justify-center rounded-xl border border-white/20 bg-white/5 text-white opacity-100 hover:bg-white/10 focus:ring-white/70 data-[state=open]:bg-white/10 data-[state=open]:text-white z-10"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <section
          className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-2xl"
          style={{
            background: "linear-gradient(135deg, #0f0f3c 0%, #1a1a4e 40%, #1e1e55 70%, #1a1a4e 100%)",
            border: "1px solid rgba(91,124,255,0.2)",
            boxShadow: "0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(91,124,255,0.1)",
          }}
        >
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <div className="flex shrink-0 justify-center px-5 pt-5 pb-4 sm:px-6">
            <img src={onspotLogo} alt="OnSpot" className="h-auto w-[min(140px,55vw)]" />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 sm:px-6 sm:pb-6">
            {children}
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}
