import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InvestorGauge } from "@/components/InvestorGauge";
import {
  HERO_GLASS_CTA_CLASS,
  HERO_GLASS_CTA_STYLE,
  HERO_SHARED_CSS_VARS,
  HERO_WORK_BACKGROUND,
} from "@/components/HeroPresentation";
import "./InvestorsCorner.css";

type RequestType = "meeting" | "deck" | "founder";
type InvestorStats = {
  contractorAccounts: number;
  clientAccounts: number;
  asOf: string;
};
type InvestorGoals = {
  contractorGoal2027: number | null;
  clientGoal2027: number | null;
};
type FormValues = {
  name: string;
  firm: string;
  email: string;
  requestType: RequestType;
  message: string;
};
type SubmissionState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "error"; message: string }
  | { kind: "sent" }
  | { kind: "saved-email-failed" };

const INITIAL_FORM: FormValues = {
  name: "",
  firm: "",
  email: "",
  requestType: "meeting",
  message: "",
};

const REQUESTS: { type: RequestType; label: string }[] = [
  { type: "meeting", label: "Request a Meeting" },
  { type: "deck", label: "Request the Pitch Deck" },
  { type: "founder", label: "Speak to the Founder" },
];

const REQUEST_LABELS: Record<RequestType, string> = {
  meeting: "Request a Meeting",
  deck: "Request the Pitch Deck",
  founder: "Speak to the Founder",
};

function isStatsResponse(value: unknown): value is InvestorStats {
  if (!value || typeof value !== "object") return false;
  const stats = value as Partial<InvestorStats>;
  return (
    typeof stats.contractorAccounts === "number" &&
    Number.isFinite(stats.contractorAccounts) &&
    typeof stats.clientAccounts === "number" &&
    Number.isFinite(stats.clientAccounts) &&
    typeof stats.asOf === "string"
  );
}

function isGoalsResponse(value: unknown): value is InvestorGoals {
  if (!value || typeof value !== "object") return false;
  const goals = value as Partial<InvestorGoals>;
  return (
    (goals.contractorGoal2027 === null ||
      (typeof goals.contractorGoal2027 === "number" && Number.isFinite(goals.contractorGoal2027))) &&
    (goals.clientGoal2027 === null ||
      (typeof goals.clientGoal2027 === "number" && Number.isFinite(goals.clientGoal2027)))
  );
}

export default function InvestorsCorner() {
  const [stats, setStats] = useState<InvestorStats | null>(null);
  const [goals, setGoals] = useState<InvestorGoals | null>(null);
  const [statsUnavailable, setStatsUnavailable] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormValues>(INITIAL_FORM);
  const [submission, setSubmission] = useState<SubmissionState>({
    kind: "idle",
  });

  const fetchStats = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/public/investor-stats", { signal });
      if (!response.ok) throw new Error("Stats unavailable");
      const result: unknown = await response.json();
      if (!isStatsResponse(result)) throw new Error("Invalid stats response");
      setStats(result);
      setStatsUnavailable(false);
    } catch {
      if (signal?.aborted) return;
      setStats(null);
      setStatsUnavailable(true);
    }
  }, []);

  const fetchGoals = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/public/investor-goals", { signal });
      if (!response.ok) throw new Error("Goals unavailable");
      const result: unknown = await response.json();
      if (!isGoalsResponse(result)) throw new Error("Invalid goals response");
      setGoals(result);
    } catch {
      // Goal configuration is optional; a failure must not affect live account totals.
      if (signal?.aborted) return;
    }
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    let controller: AbortController | undefined;
    const refreshWhenVisible = () => {
      if (document.visibilityState !== "visible") {
        if (interval) clearInterval(interval);
        interval = undefined;
        controller?.abort();
        return;
      }
      controller?.abort();
      controller = new AbortController();
      void fetchStats(controller.signal);
      void fetchGoals(controller.signal);
      if (!interval) {
        interval = setInterval(() => {
          if (document.visibilityState === "visible") {
            controller?.abort();
            controller = new AbortController();
            void fetchStats(controller.signal);
            void fetchGoals(controller.signal);
          }
        }, 60_000);
      }
    };

    refreshWhenVisible();
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      if (interval) clearInterval(interval);
      controller?.abort();
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [fetchGoals, fetchStats]);

  useEffect(() => {
    document.title = "For Investors | OnSpot";
    return () => {
      document.title = "Work Without Limits | OnSpot";
    };
  }, []);

  const openRequest = (requestType: RequestType) => {
    setForm((current) => ({ ...current, requestType }));
    setSubmission({ kind: "idle" });
    setDialogOpen(true);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && submission.kind === "sending") return;
    setDialogOpen(open);
    if (!open && submission.kind !== "sending") {
      if (submission.kind === "sent" || submission.kind === "saved-email-failed") {
        setForm(INITIAL_FORM);
      }
      setSubmission({ kind: "idle" });
    }
  };

  const updateField = (
    field: keyof FormValues,
    value: string | RequestType,
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submission.kind === "sending") return;
    setSubmission({ kind: "sending" });

    const payload = {
      name: form.name.trim(),
      firm: form.firm.trim(),
      email: form.email.trim(),
      requestType: form.requestType,
      ...(form.message.trim() ? { message: form.message.trim() } : {}),
    };

    try {
      const response = await fetch("/api/public/investor-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.status !== 201) {
        throw new Error(
          response.status === 429
            ? "Too many requests. Please try again later."
            : "We couldn’t submit your request. Your details are still here; please try again.",
        );
      }
      const result: unknown = await response.json();
      if (
        !result ||
        typeof result !== "object" ||
        !("notificationStatus" in result) ||
        (result.notificationStatus !== "sent" &&
          result.notificationStatus !== "failed")
      ) {
        throw new Error(
          "We couldn’t confirm the request status. Your details are still here; please try again.",
        );
      }
      setSubmission(
        result.notificationStatus === "sent"
          ? { kind: "sent" }
          : { kind: "saved-email-failed" },
      );
    } catch (error) {
      setSubmission({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "We couldn’t submit your request. Your details are still here; please try again.",
      });
    }
  };

  const hasSubmissionResult =
    submission.kind === "sent" || submission.kind === "saved-email-failed";

  return (
    <div
      className="investors-page"
      style={{ ...HERO_SHARED_CSS_VARS, background: HERO_WORK_BACKGROUND }}
    >
      <div className="investors-shell">
        <section className="investors-intro" aria-labelledby="investor-headline">
          <div className="investors-eyebrow">
            <span className="investors-eyebrow-rule" aria-hidden="true" />
            FOR INVESTORS
          </div>

          <h1 id="investor-headline">
            A world where anyone can work anywhere. And every company can hire
            anyone to work without limits.
          </h1>

          <p className="investors-subhead">Talent earns more. Clients pay less.</p>

          <div className="investors-counts" aria-label="OnSpot marketplace account totals">
            <InvestorGauge
              count={stats?.contractorAccounts ?? null}
              goal={goals?.contractorGoal2027 ?? null}
              label="Contractors"
            />
            <InvestorGauge
              count={stats?.clientAccounts ?? null}
              goal={goals?.clientGoal2027 ?? null}
              label="Clients"
            />
          </div>
          {statsUnavailable && (
            <p className="investor-stats-note" role="status">
              Account totals are temporarily unavailable.
            </p>
          )}

          <div className="investor-raise">
            <span className="investor-raise-mark" aria-hidden="true" />
            <span>Currently raising our seed round.</span>
          </div>

          <div className="investor-actions" aria-label="Investor inquiries">
            {REQUESTS.map(({ type, label }) => (
              <button
                key={type}
                type="button"
                className={`investor-action ${HERO_GLASS_CTA_CLASS}`}
                style={HERO_GLASS_CTA_STYLE}
                onClick={() => openRequest(type)}
              >
                <span>{label}</span>
                <span className="investor-action-arrow" aria-hidden="true">
                  ↗
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="investor-dialog">
          <DialogHeader className="investor-dialog-header">
            <span className="investor-dialog-kicker">ONSPOT · INVESTOR INTRODUCTION</span>
            <DialogTitle>
              {hasSubmissionResult ? "Request received" : "Start a conversation"}
            </DialogTitle>
            <DialogDescription>
              {hasSubmissionResult
                ? "Your investor request has been recorded."
                : "Share a few details and we’ll follow up."}
            </DialogDescription>
          </DialogHeader>

          {submission.kind === "sent" ? (
            <div className="investor-result investor-result-success" role="status">
              <span className="investor-result-mark" aria-hidden="true">✓</span>
              <p>Your request is saved and a notification was sent to Nur.</p>
              <button
                type="button"
                className="investor-form-submit"
                onClick={() => handleOpenChange(false)}
              >
                Done
              </button>
            </div>
          ) : submission.kind === "saved-email-failed" ? (
            <div className="investor-result investor-result-warning" role="status">
              <p>
                Your request is saved, but the email notification to Nur was not
                sent. For an urgent follow-up, email{" "}
                <a href="mailto:nur@onspotglobal.com">nur@onspotglobal.com</a>.
              </p>
              <button
                type="button"
                className="investor-form-submit"
                onClick={() => handleOpenChange(false)}
              >
                Done
              </button>
            </div>
          ) : (
            <form className="investor-form" onSubmit={submitRequest}>
              <div className="investor-field">
                <label htmlFor="investor-name">Name</label>
                <input
                  id="investor-name"
                  name="name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={120}
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                />
              </div>
              <div className="investor-field">
                <label htmlFor="investor-firm">Firm or Affiliation</label>
                <input
                  id="investor-firm"
                  name="firm"
                  autoComplete="organization"
                  required
                  minLength={2}
                  maxLength={160}
                  value={form.firm}
                  onChange={(event) => updateField("firm", event.target.value)}
                />
              </div>
              <div className="investor-field">
                <label htmlFor="investor-email">Email</label>
                <input
                  id="investor-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                />
              </div>
              <div className="investor-field">
                <label htmlFor="investor-request-type">Request type</label>
                <select
                  id="investor-request-type"
                  name="requestType"
                  value={form.requestType}
                  onChange={(event) =>
                    updateField("requestType", event.target.value as RequestType)
                  }
                >
                  {REQUESTS.map(({ type }) => (
                    <option value={type} key={type}>
                      {REQUEST_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="investor-field">
                <label htmlFor="investor-message">Message (optional)</label>
                <textarea
                  id="investor-message"
                  name="message"
                  rows={3}
                  maxLength={1500}
                  value={form.message}
                  onChange={(event) => updateField("message", event.target.value)}
                />
              </div>

              {submission.kind === "error" && (
                <p className="investor-form-error" role="alert">
                  {submission.message}
                </p>
              )}
              <button
                type="submit"
                className="investor-form-submit"
                disabled={submission.kind === "sending"}
              >
                {submission.kind === "sending"
                  ? "Sending request…"
                  : "Send request"}
              </button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}