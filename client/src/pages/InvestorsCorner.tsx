import { useRef, useState } from "react";
import HeadSEO from "@/components/HeadSEO";
import {
  InvestorDocumentDialog,
  type InvestorDocument,
} from "@/components/InvestorDocumentDialog";
import onSpotWordmark from "@/assets/onspot-white-wordmark.png";
import "./InvestorsCorner.css";

export default function InvestorsCorner() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [requestedDocument, setRequestedDocument] =
    useState<InvestorDocument>("deck");
  const requestTriggerRef = useRef<HTMLElement | null>(null);

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
            Hi, I’m Nur Laminero and I’m the Co‑Founder and CEO of OnSpot.
          </h1>
          <p className="investor-lead">
            We’re the unified outsourcing system where businesses find, hire,
            pay, and manage vetted remote talent in one place — and talent earns
            more doing it.
          </p>
        </section>

        <section className="investor-wrap" aria-label="At a glance">
          <div className="investor-facts">
            <div className="investor-fact">
              <b>7 days</b>
              <span>
                As fast as 7 days for businesses to find, hire, and manage global
                talent
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
          className="investor-wrap investor-letter"
          aria-labelledby="investor-letter-title"
        >
          <div className="investor-aside">
            <h2 id="investor-letter-title">A letter from Nur Laminero</h2>
            <p>Co-Founder and CEO, OnSpot</p>
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
              My co-founders Jake and Mark and I spent four years running a BPO
              before building this platform.{" "}
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
            <div className="investor-sign">
              <span className="investor-monogram" aria-hidden="true">
                NL
              </span>
              <div>
                <b>Nur Laminero</b>
                <span>Co-Founder and CEO, OnSpot</span>
              </div>
            </div>
          </div>
        </section>

        <section
          className="investor-wrap investor-invest"
          aria-labelledby="investor-invest-title"
        >
          <div className="investor-invest-head">
            <h2 id="investor-invest-title">Invest in OnSpot today.</h2>
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
          © 2026 OnSpot Global. All rights reserved. This page is for information
          only and is not an offer to sell securities. Investing in early-stage
          companies is risky and you may lose your entire investment.
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
