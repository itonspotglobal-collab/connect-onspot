import { useRef, useState, type FormEvent, type RefObject } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

export type InvestorDocument = "deck" | "valuation";

type Props = {
  open: boolean;
  document: InvestorDocument;
  onOpenChange: (open: boolean) => void;
  returnFocusRef: RefObject<HTMLElement | null>;
};

type SubmissionState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "error"; message: string }
  | { kind: "sent" }
  | { kind: "saved-notification-failed" }
  | { kind: "saved-status-unknown" }
  | { kind: "unconfirmed" };

const DOCUMENTS: Record<
  InvestorDocument,
  { title: string; meta: string; action: string }
> = {
  deck: {
    title: "Get the pitch deck",
    meta: "Meet the Founders",
    action: "Get the pitch deck",
  },
  valuation: {
    title: "Download the valuation summary",
    meta: "Seedscope",
    action: "Get the valuation summary",
  },
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getServerError(value: unknown): string | null {
  if (!value || typeof value !== "object" || !("error" in value)) return null;
  return typeof value.error === "string" && value.error.trim()
    ? value.error
    : null;
}

export function InvestorDocumentDialog({
  open,
  document,
  onOpenChange,
  returnFocusRef,
}: Props) {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [invalidFields, setInvalidFields] = useState({
    firstName: false,
    email: false,
  });
  const [submission, setSubmission] = useState<SubmissionState>({
    kind: "idle",
  });
  const nameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const documentInfo = DOCUMENTS[document];
  const hasOutcome = [
    "sent",
    "saved-notification-failed",
    "saved-status-unknown",
    "unconfirmed",
  ].includes(submission.kind);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && submission.kind === "sending") return;
    onOpenChange(nextOpen);
    if (!nextOpen) {
      if (hasOutcome) {
        setFirstName("");
        setEmail("");
        setWebsite("");
      }
      setInvalidFields({ firstName: false, email: false });
      setSubmission({ kind: "idle" });
    }
  };

  const validate = () => {
    const nameValid =
      firstName.trim().length >= 1 && firstName.trim().length <= 120;
    const emailValid =
      email.trim().length <= 254 && EMAIL_PATTERN.test(email.trim());
    const nextInvalidFields = {
      firstName: !nameValid,
      email: !emailValid,
    };
    setInvalidFields(nextInvalidFields);
    if (nextInvalidFields.firstName) {
      nameInputRef.current?.focus();
      return false;
    }
    if (nextInvalidFields.email) {
      emailInputRef.current?.focus();
      return false;
    }
    return true;
  };

  const submitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submission.kind === "sending" || hasOutcome || !validate()) return;

    setSubmission({ kind: "sending" });
    try {
      const response = await fetch("/api/public/investor-document-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          email: email.trim(),
          requestedDocument: document,
          source: "investors-page",
          website,
        }),
      });

      let result: unknown;
      try {
        result = await response.json();
      } catch {
        result = null;
      }

      if (response.status !== 201) {
        setSubmission({
          kind: "error",
          message:
            getServerError(result) ??
            "We couldn’t save your request. Please try again.",
        });
        return;
      }

      if (
        !result ||
        typeof result !== "object" ||
        !("id" in result) ||
        !("notificationStatus" in result) ||
        !("documentAvailable" in result) ||
        (result.notificationStatus !== "sent" &&
          result.notificationStatus !== "failed") ||
        result.documentAvailable !== false
      ) {
        setSubmission({ kind: "saved-status-unknown" });
        return;
      }

      setSubmission(
        result.notificationStatus === "sent"
          ? { kind: "sent" }
          : { kind: "saved-notification-failed" },
      );
    } catch {
      setSubmission({ kind: "unconfirmed" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="investor-request-dialog"
        overlayClassName="investor-request-overlay"
        containerClassName="investor-request-viewport"
        hideClose
        aria-describedby="investor-document-description"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (firstName.trim() ? emailInputRef.current : nameInputRef.current)?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusRef.current?.focus();
        }}
      >
        <div className="investor-dialog-header">
          <span className="investor-dialog-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              {document === "deck" ? (
                <>
                  <rect x="3" y="4" width="18" height="12" rx="2" />
                  <path d="M12 16v4M8 20h8M7 9h6M7 12h4" />
                </>
              ) : (
                <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
              )}
            </svg>
          </span>
          <div>
            <DialogTitle>
              {hasOutcome
                ? submission.kind === "unconfirmed"
                  ? "Request status unconfirmed"
                  : "Request received"
                : documentInfo.title}
            </DialogTitle>
            <p className="investor-dialog-meta">{documentInfo.meta}</p>
          </div>
        </div>
        <p id="investor-document-description" className="sr-only">
          Documents are not available yet. You can save a request and OnSpot will
          follow up.
        </p>

        {!hasOutcome ? (
          <form className="investor-doc-form" noValidate onSubmit={submitRequest}>
            <div
              className="investor-doc-field"
              data-invalid={invalidFields.firstName || undefined}
            >
              <label htmlFor="investor-document-first-name">First name</label>
              <input
                ref={nameInputRef}
                id="investor-document-first-name"
                name="firstName"
                type="text"
                autoComplete="given-name"
                placeholder="Alex"
                maxLength={120}
                aria-invalid={invalidFields.firstName}
                aria-describedby={
                  invalidFields.firstName
                    ? "investor-document-name-error"
                    : undefined
                }
                value={firstName}
                onChange={(event) => {
                  setFirstName(event.target.value);
                  if (invalidFields.firstName) {
                    setInvalidFields((current) => ({
                      ...current,
                      firstName: false,
                    }));
                  }
                }}
              />
              <span
                id="investor-document-name-error"
                className="investor-doc-error"
              >
                Enter your first name.
              </span>
            </div>

            <div
              className="investor-doc-field"
              data-invalid={invalidFields.email || undefined}
            >
              <label htmlFor="investor-document-email">Email</label>
              <input
                ref={emailInputRef}
                id="investor-document-email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@company.com"
                maxLength={254}
                aria-invalid={invalidFields.email}
                aria-describedby={
                  invalidFields.email
                    ? "investor-document-email-error"
                    : undefined
                }
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (invalidFields.email) {
                    setInvalidFields((current) => ({
                      ...current,
                      email: false,
                    }));
                  }
                }}
              />
              <span
                id="investor-document-email-error"
                className="investor-doc-error"
              >
                Enter a valid email, like you@company.com.
              </span>
            </div>

            <div
              className="investor-doc-field investor-doc-honeypot"
              aria-hidden="true"
            >
              <label htmlFor="investor-document-website">Website</label>
              <input
                id="investor-document-website"
                name="website"
                type="text"
                autoComplete="off"
                tabIndex={-1}
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
              />
            </div>

            {submission.kind === "error" && (
              <p className="investor-doc-server-error" role="alert">
                {submission.message}
              </p>
            )}

            <button
              className="investor-doc-submit"
              type="submit"
              disabled={submission.kind === "sending"}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="2.5" />
                <path d="m4 7 8 6 8-6" />
              </svg>
              <span>
                {submission.kind === "sending"
                  ? "Saving request…"
                  : documentInfo.action}
              </span>
            </button>
            <p className="investor-doc-legal">
              We’ll only use your email for OnSpot investor communications.
              Unsubscribe anytime.
            </p>
            <p className="investor-doc-legal">
              Documents are not available yet; submit a request and we’ll follow
              up.
            </p>
          </form>
        ) : (
          <div className="investor-doc-result" role="status" aria-live="polite">
            <strong>
              {submission.kind === "sent"
                ? `Thank you, ${firstName.trim()}.`
                : submission.kind === "unconfirmed"
                  ? "We couldn’t confirm your request."
                  : "Your request is saved."}
            </strong>
            {submission.kind === "sent" ? (
              <p>
                Your request has been saved, and the notification was sent. The
                document is not available yet; OnSpot will follow up.
              </p>
            ) : submission.kind === "saved-notification-failed" ? (
              <p>
                Your request has been saved, but we couldn’t send the
                notification. The document is not available yet. We have your
                request and will follow up; please don’t submit it again.
              </p>
            ) : submission.kind === "saved-status-unknown" ? (
              <p>
                The server confirmed your request was saved, but its
                notification status could not be confirmed. The document is not
                available yet; please don’t submit another request.
              </p>
            ) : (
              <p>
                We couldn’t confirm whether your request was received. Please
                contact OnSpot before submitting another request. The document
                is not available yet.
              </p>
            )}
            <button
              className="investor-doc-submit"
              type="button"
              onClick={() => handleOpenChange(false)}
            >
              Done
            </button>
          </div>
        )}

        <DialogClose
          className="investor-dialog-close"
          aria-label="Close document request"
          disabled={submission.kind === "sending"}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 3l10 10M13 3 3 13" />
          </svg>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
