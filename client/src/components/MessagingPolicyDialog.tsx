import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck } from "lucide-react";

export interface MessagingPolicyStatus {
  accepted: boolean;
  acceptedAt: string | null;
  version: string | null;
  currentVersion: string;
}

interface MessagingPolicyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status?: MessagingPolicyStatus;
  isAccepting: boolean;
  error?: string | null;
  onAccept: () => void;
}

export function MessagingPolicyDialog({
  open,
  onOpenChange,
  status,
  isAccepting,
  error,
  onAccept,
}: MessagingPolicyDialogProps) {
  const [agreed, setAgreed] = useState(Boolean(status?.accepted));
  const isAccepted = Boolean(status?.accepted);

  useEffect(() => {
    if (open) setAgreed(isAccepted);
  }, [open, isAccepted]);

  const acceptedDate = status?.acceptedAt
    ? new Date(status.acceptedAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[85vh] max-w-lg overflow-y-auto"
        data-testid="dialog-messaging-policy"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            <ShieldCheck className="h-5 w-5 text-[#474ead]" />
            Messaging &amp; Communication Policy
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 pt-2 text-left leading-relaxed">
              <p>
                OnSpot Messages is designed to keep communication between
                clients and talent secure and on-platform.
              </p>
              <p>
                Please do not share personal or sensitive information in chat,
                including:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Email addresses</li>
                <li>Personal phone numbers</li>
                <li>External usernames or contact handles</li>
                <li>Passwords, PINs, or one-time passwords</li>
                <li>Login credentials</li>
                <li>API keys or access tokens</li>
                <li>Other private account or contact information</li>
              </ul>
              <p>
                OnSpot may automatically detect and hide sensitive information
                before a message is delivered. Repeated attempts to bypass
                these protections may be reviewed.
              </p>
              <p>
                Use Messages to discuss job requirements, interviews,
                schedules, deliverables, and other work-related communication.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        {isAccepted && acceptedDate ? (
          <p
            className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
            data-testid="text-policy-accepted"
          >
            ✓ You accepted this policy on {acceptedDate}.
          </p>
        ) : (
          <label
            htmlFor="messaging-policy-agreement"
            className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 p-3 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200"
          >
            <Checkbox
              id="messaging-policy-agreement"
              checked={agreed}
              onCheckedChange={(checked) => setAgreed(checked === true)}
              aria-describedby="messaging-policy-agreement-label"
              data-testid="checkbox-messaging-policy"
            />
            <span id="messaging-policy-agreement-label">
              I understand and agree to keep communication on-platform and
              follow the Messaging &amp; Communication Policy.
            </span>
          </label>
        )}

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <DialogFooter>
          {isAccepted ? (
            <Button
              type="button"
              onClick={() => onOpenChange(false)}
              data-testid="button-close-messaging-policy"
            >
              Done
            </Button>
          ) : (
            <Button
              type="button"
              disabled={!agreed || isAccepting || !status?.currentVersion}
              onClick={onAccept}
              data-testid="button-accept-messaging-policy"
            >
              {isAccepting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Agree and Continue
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}