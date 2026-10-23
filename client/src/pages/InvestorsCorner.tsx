import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import HeadSEO from "@/components/HeadSEO";
import {
  InvestorDocumentDialog,
  type InvestorDocument,
} from "@/components/InvestorDocumentDialog";
import onSpotWordmark from "@/assets/onspot-white-wordmark.png";
import jakePhoto from "@assets/Jake_1775039278985.png";
import phoneMockup from "@assets/iphone_mockup_transparent_1791189886936.png";
import "./InvestorsCorner.css";

type InvestorStats = {
  contractorAccounts: number;
  clientAccounts: number;
  asOf: string;
};

function parseInvestorStats(value: unknown): InvestorStats {
  if (!value || typeof value !== "object") {
    throw new Error("Investor statistics are unavailable.");
  }

  const stats = value as Record<string, unknown>;
  const validCount = (count: unknown): count is number =>
    typeof count === "number" && Number.isSafeInteger(count) && count >= 0;
  const validDate =
    typeof stats.asOf === "string" &&
    stats.asOf.trim().length > 0 &&
    Number.isFinite(Date.parse(stats.asOf));

  if (
    !validCount(stats.contractorAccounts) ||
    !validCount(stats.clientAccounts) ||
    typeof stats.asOf !== "string" ||
    !validDate
  ) {
    throw new Error("Investor statistics are unavailable.");
  }

  return {
    contractorAccounts: stats.contractorAccounts,
    clientAccounts: stats.clientAccounts,
    asOf: stats.asOf,
  };
}

async function fetchInvestorStats(): Promise<InvestorStats> {
  const response = await fetch("/api/public/investor-stats", {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Investor statistics are unavailable.");
  }
  return parseInvestorStats(await response.json());
}

export default function InvestorsCorner() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [requestedDocument, setRequestedDocument] =
    useState<InvestorDocument>("deck");
  const requestTriggerRef = useRef<HTMLElement | null>(null);
  const investorStatsQuery = useQuery({
    queryKey: ["/api/public/investor-stats"],
    queryFn: fetchInvestorStats,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const openDocumentRequest = (
    document: InvestorDocument,
    trigger: HTMLElement,
  ) => {
    requestTriggerRef.current = trigger;
    setRequestedDocument(document);
    setDialogOpen(true);
  };

  return (
    <div className="onspot-investors-page">
      <HeadSEO
        title="Invest in OnSpot — A Letter From Our CEO"
        description="A letter from Nur Laminero, Co-Founder and CEO of OnSpot. Get the pitch deck, view the Wefunder opportunity profile, or download the valuation summary."
        ogType="website"
      />

      <header className="investor-wrap investor-top">
        <a className="investor-logo" href="/" aria-label="OnSpot home">
          <img src={onSpotWordmark} alt="OnSpot" />
        </a>
        <span>Investors</span>
      </header>

      <div>
        <section
          className="investor-wrap investor-open"
          aria-labelledby="investor-open-title"
        >
          <h1 id="investor-open-title">
            OnSpot is the unified outsourcing system where businesses find,
            hire, pay, and manage vetted remote talent in one place — and talent
            earns more doing it.
          </h1>
          <div className="investor-phone-frame">
            <img
              className="investor-phone-art"
              src={phoneMockup}
              alt="OnSpot shown on a smartphone"
            />
          </div>
        </section>

        <section className="investor-wrap" aria-label="At a glance">
          <div className="investor-facts">
            <div className="investor-fact">
              <b>7 days</b>
              <span>
                As fast as 7 days for businesses to find, hire, and to start
                global talent
              </span>
            </div>
            <div className="investor-fact">
              <b>4 years</b>
              <span>Running a BPO before building this platform</span>
            </div>
            <div className="investor-fact">
              <b>Self‑sustaining</b>
              <span>
                Operations fully covered by revenue before external investment
              </span>
            </div>
          </div>
        </section>

        <section
          className="investor-wrap investor-traction"
          aria-labelledby="investor-traction-title"
          aria-live="polite"
        >
          <div className="investor-traction-heading">
            <div>
              <h2 id="investor-traction-title">Our Traction</h2>
              <p>
                Growing a global community of businesses and professionals on
                OnSpot.
              </p>
            </div>
            {investorStatsQuery.data && !investorStatsQuery.isError && (
              <span className="investor-traction-updated">
                Updated{" "}
                {new Date(investorStatsQuery.data.asOf).toLocaleDateString()}
              </span>
            )}
          </div>
          {investorStatsQuery.isLoading ? (
            <div className="investor-traction-grid" role="status">
              <div className="investor-traction-card investor-traction-loading">
                <span className="investor-traction-skeleton" aria-hidden="true" />
                <span>Registered Talent</span>
              </div>
              <div className="investor-traction-card investor-traction-loading">
                <span className="investor-traction-skeleton" aria-hidden="true" />
                <span>Registered Clients</span>
              </div>
              <span className="sr-only">Loading platform statistics.</span>
            </div>
          ) : investorStatsQuery.isError || !investorStatsQuery.data ? (
            <div className="investor-traction-unavailable" role="status">
              <p>
                Platform statistics are currently unavailable. Please try again
                shortly.
              </p>
              <button
                type="button"
                onClick={() => void investorStatsQuery.refetch()}
                disabled={investorStatsQuery.isFetching}
              >
                {investorStatsQuery.isFetching ? "Checking…" : "Try again"}
              </button>
            </div>
          ) : (
            <div className="investor-traction-grid">
              <div className="investor-traction-card">
                <b>
                  {investorStatsQuery.data.contractorAccounts.toLocaleString()}
                </b>
                <span>Registered Talent</span>
              </div>
              <div className="investor-traction-card">
                <b>{investorStatsQuery.data.clientAccounts.toLocaleString()}</b>
                <span>Registered Clients</span>
              </div>
            </div>
          )}
        </section>

        <section
          className="investor-wrap investor-letter"
          aria-labelledby="investor-letter-title"
        >
          <div className="investor-aside">
            <h2 id="investor-letter-title">A letter from the founders.</h2>
            <p>The Founders of OnSpot</p>
          </div>
          <div className="investor-letter-body">
            <p className="investor-letter-first">
              We built a system for small and medium businesses to solve the
              broken choice between freelance chaos and enterprise BPO overhead.
            </p>
            <div className="investor-compare">
              <div>
                <h3>The problem</h3>
                <p>
                  Today, businesses that need operational support have to either
                  manage unreliable freelancers on their own or pay enterprise
                  prices for BPO services that were never designed for them.
                  Meanwhile talented professionals around the world spend their
                  time searching for clients instead of doing the work they are
                  great at — and earn a fraction of what they are worth.
                </p>
              </div>
              <div className="investor-now">
                <h3>Our solution</h3>
                <p>
                  With OnSpot, businesses find, hire, and manage vetted global
                  talent in as fast as 7 days — with the accountability of a
                  managed service and none of the overhead — while talent sets
                  their own rate, keeps every dollar, and builds a real
                  international career.
                </p>
              </div>
            </div>
            <p>
              We spent four years running a BPO before building this platform.{" "}
              <strong>
                We did not guess at the problem. We lived inside it
              </strong>{" "}
              — and we built OnSpot from operational truth rather than theory.{" "}
              <strong>We are already self-sustaining.</strong> Operations are
              fully covered by revenue before a single dollar of external
              investment.
            </p>
            <p className="investor-vision">
              We are raising to launch, to scale, and to liberate how the world
              does meaningful work. A world where anyone can work anywhere — and
              every company can hire anyone, without limits.
            </p>
            <div className="investor-signatures">
              <h3>The Founders of OnSpot</h3>
              <div className="investor-signature-list">
                <div className="investor-sign">
                  <img
                    className="investor-monogram"
                    src="/nur-ceo.jpeg"
                    alt="Nur Laminero"
                  />
                  <div>
                    <b>Nur Laminero</b>
                    <span>Co-Founder &amp; CEO</span>
                  </div>
                </div>
                <div className="investor-sign">
                  <img
                    className="investor-monogram"
                    src={jakePhoto}
                    alt="Jake Wainberg"
                  />
                  <div>
                    <b>Jake Wainberg</b>
                    <span>Co-Founder &amp; President</span>
                  </div>
                </div>
                <div className="investor-sign">
                  <img
                    className="investor-monogram"
                    src="/mark-apostol.png"
                    alt="Mark Apostol"
                  />
                  <div>
                    <b>Mark Apostol</b>
                    <span>Co-Founder &amp; COO</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          className="investor-wrap investor-invest"
          aria-labelledby="investor-invest-title"
        >
          <div className="investor-invest-head">
            <h2 id="investor-invest-title">
              Invest in the <span className="investor-invest-title-accent">Future of Work</span> today.
            </h2>
          </div>
          <div className="investor-cards">
            <button
              className="investor-card investor-card-primary"
              type="button"
              onClick={(event) =>
                openDocumentRequest("deck", event.currentTarget)
              }
            >
              <span className="investor-card-kicker">
                Pitch deck
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="12" rx="2" />
                  <path d="M12 16v4M8 20h8M7 9h6M7 12h4" />
                </svg>
              </span>
              <span>
                <span className="investor-card-title">Meet the Founders</span>
                <span className="investor-card-link">
                  Get the pitch deck
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 4v12M6.5 10.5 12 16l5.5-5.5M5 20h14" />
                  </svg>
                </span>
              </span>
            </button>

            <a
              className="investor-card ext"
              href="https://wefunder.com/onspot"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="investor-card-kicker">
                Opportunity profile
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="16" rx="2.5" />
                  <circle cx="9" cy="11" r="2.5" />
                  <path d="M5.5 17c.6-1.8 2-2.8 3.5-2.8s2.9 1 3.5 2.8M15 9.5h3M15 13h3" />
                </svg>
              </span>
              <span>
                <span className="investor-card-title">WeFunder</span>
                <span className="investor-card-link">
                  View opportunity profile
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M7 17 17 7M8 7h9v9" />
                  </svg>
                </span>
              </span>
            </a>

            <button
              className="investor-card"
              type="button"
              onClick={(event) =>
                openDocumentRequest("valuation", event.currentTarget)
              }
            >
              <span className="investor-card-kicker">
                Valuation summary
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
                </svg>
              </span>
              <span>
                <span className="investor-card-title">Seedscope</span>
                <span className="investor-card-link">
                  Download the valuation summary
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 4v12M6.5 10.5 12 16l5.5-5.5M5 20h14" />
                  </svg>
                </span>
              </span>
            </button>
          </div>
        </section>
      </div>

      <footer className="investor-wrap investor-footer">
        <a className="investor-logo" href="/" aria-label="OnSpot home">
          <img src={onSpotWordmark} alt="OnSpot" />
        </a>
        <p>
          © 2026 OnSpot. All rights reserved. This page is for information only
          and is not an offer to sell securities.
        </p>
      </footer>

      <InvestorDocumentDialog
        open={dialogOpen}
        document={requestedDocument}
        onOpenChange={setDialogOpen}
        returnFocusRef={requestTriggerRef}
      />
    </div>
  );
}
