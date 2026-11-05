import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import HeadSEO from "@/components/HeadSEO";
import {
  InvestorDocumentDialog,
  type InvestorDocument,
} from "@/components/InvestorDocumentDialog";
import onSpotWordmark from "@/assets/onspot-white-wordmark.png";
import foundersTeamPhoto from "@/assets/investors/onspot-founders-team.webp";
import investorHeroMapSvg from "@/assets/investors/investor-hero-map.svg?raw";
import tractionTeamPhoto from "@/assets/investors/traction-team.webp";
import tractionPlanningPhoto from "@/assets/investors/traction-planning.webp";
import visionPhoto from "@/assets/investors/earth-at-night.webp";
import investPhoto from "@/assets/investors/invest-office.webp";
import jakePhoto from "@/assets/investors/jake-wainberg.webp";
import "./InvestorsCorner.css";

type InvestorStats = {
  contractorAccounts: number;
  clientAccounts: number;
  asOf: string;
};

type InvestorGoals = {
  contractorGoal2027: number | null;
  clientGoal2027: number | null;
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

function parseInvestorGoals(value: unknown): InvestorGoals {
  if (!value || typeof value !== "object") {
    throw new Error("Investor goals are unavailable.");
  }
  const goals = value as Record<string, unknown>;
  const validGoal = (goal: unknown): goal is number | null =>
    goal === null ||
    (typeof goal === "number" && Number.isSafeInteger(goal) && goal > 0);
  if (
    !validGoal(goals.contractorGoal2027) ||
    !validGoal(goals.clientGoal2027)
  ) {
    throw new Error("Investor goals are unavailable.");
  }
  return {
    contractorGoal2027: goals.contractorGoal2027,
    clientGoal2027: goals.clientGoal2027,
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

async function fetchInvestorGoals(): Promise<InvestorGoals> {
  const response = await fetch("/api/public/investor-goals", {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Investor goals are unavailable.");
  }
  return parseInvestorGoals(await response.json());
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
  const investorGoalsQuery = useQuery({
    queryKey: ["/api/public/investor-goals"],
    queryFn: fetchInvestorGoals,
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

      <header className="investor-top">
        <div className="investor-wrap investor-nav">
          <a className="investor-logo" href="/" aria-label="OnSpot home">
            <img src={onSpotWordmark} alt="OnSpot" width={1013} height={319} />
          </a>
          <span aria-current="page">Investors</span>
        </div>
      </header>

      <main>
        <section
          className="investor-open"
          aria-labelledby="investor-open-title"
        >
          <div className="investor-hero-grid" aria-hidden="true" />
          <span
            className="investor-map-holder"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: investorHeroMapSvg }}
          />
          <div className="investor-wrap investor-hero-inner">
            <div className="investor-hero-copy">
              <span className="h-accent" aria-hidden="true"><i /><i /><i /></span>
              <h1 id="investor-open-title">
                OnSpot is the <span className="investor-highlight">unified outsourcing system</span> where businesses find, hire, pay, and manage vetted remote talent in one place, and talent <span className="investor-highlight">earns more</span> doing it.
              </h1>
            </div>
            <div className="investor-phone-stage" aria-hidden="true">
              <span className="investor-phone-ring" />
              <span className="investor-phone-glow" />
              <span className="investor-orbit"><i /><i /><i /></span>
              <span className="investor-badge investor-badge-globe">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z" />
                </svg>
              </span>
              <span className="investor-badge investor-badge-check">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m5 12.5 4.5 4.5L19 7.5" />
                </svg>
              </span>
              <span className="investor-badge investor-badge-nur" />
              <span className="investor-badge investor-badge-mark" />
              <div className="phone-wrap">
                <span className="phone-shadow" />
              <div className="investor-phone">
                <span className="investor-phone-island" />
                <div className="investor-phone-screen">
                  <div className="investor-phone-status">
                    <span>6:23</span>
                    <span className="investor-phone-system">
                      <span className="investor-phone-bars"><span /><span /><span /><span /></span>
                      <span className="investor-phone-network">5G</span>
                      <span className="investor-phone-battery" />
                    </span>
                  </div>
                  <div className="investor-phone-appbar">
                    <span className="investor-phone-wordmark">
                      <img src={onSpotWordmark} alt="" width={1013} height={319} />
                    </span>
                    <span className="investor-phone-menu"><span /></span>
                  </div>
                  <div className="investor-phone-content">
                    <span className="investor-phone-pill">ABOUT ONSPOT</span>
                  <div className="investor-phone-headline">
                      Built by people who <span>lived</span> the problem.
                    </div>
                    <p className="investor-phone-description">
                      OnSpot exists because we ran the old model ourselves, and watched it fail the people it was supposed to serve.
                    </p>
                    <div className="investor-phone-actions">
                      <span className="investor-phone-action investor-phone-action-primary">Our story</span>
                      <span className="investor-phone-action investor-phone-action-secondary">Meet the team</span>
                    </div>
                  </div>
                  <span className="investor-phone-chat" />
                  <span className="investor-phone-home-indicator" />
                </div>
              </div>
              </div>
            </div>
          </div>
        </section>

        <section className="investor-trustbar" aria-label="At a glance">
          <div className="investor-wrap investor-facts">
            <div className="investor-fact">
              <span className="investor-trust-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></svg>
              </span>
              <span className="investor-fact-copy"><b>7 days</b><span>As fast as 7 days for businesses to find, hire, and to start global talent</span></span>
            </div>
            <div className="investor-fact">
              <span className="investor-trust-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" /></svg>
              </span>
              <span className="investor-fact-copy"><b>4 years</b><span>Running a BPO before building this platform</span></span>
            </div>
            <div className="investor-fact">
              <span className="investor-trust-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="m3 17 6-6 4 4 8-9" /><path d="M15 6h6v6" /></svg>
              </span>
              <span className="investor-fact-copy"><b>Self‑sustaining</b><span>Operations fully covered by revenue before external investment</span></span>
            </div>
          </div>
        </section>

        <section
          className="investor-traction"
          aria-labelledby="investor-traction-title"
          aria-live="polite"
        >
          <span className="investor-dots investor-traction-dots" aria-hidden="true" />
          <div className="investor-wrap investor-traction-grid-layout">
            <div className="investor-traction-content">
              <div className="investor-traction-heading">
                <div>
                  <h2 id="investor-traction-title">Our Traction</h2>
                  <p>Growing a global community of businesses and professionals on OnSpot.</p>
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
                    <span className="investor-traction-icon investor-talent-icon" aria-hidden="true" />
                    <span>Registered Talent</span>
                  </div>
                  <div className="investor-traction-card investor-traction-loading">
                    <span className="investor-traction-skeleton" aria-hidden="true" />
                    <span className="investor-traction-icon investor-client-icon" aria-hidden="true" />
                    <span>Registered Clients</span>
                  </div>
                  <span className="sr-only">Loading platform statistics.</span>
                </div>
              ) : investorStatsQuery.isError || !investorStatsQuery.data ? (
                <div className="investor-traction-unavailable" role="status">
                  <p>Platform statistics are currently unavailable. Please try again shortly.</p>
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
                  <InvestorRoleGoalMeter
                    kind="talent"
                    label="Registered Talent"
                    count={investorStatsQuery.data.contractorAccounts}
                    goal={investorGoalsQuery.data?.contractorGoal2027 ?? null}
                    goalStatus={investorGoalsQuery.isError ? "error" : investorGoalsQuery.isLoading ? "loading" : "ready"}
                  />
                  <InvestorRoleGoalMeter
                    kind="clients"
                    label="Registered Clients"
                    count={investorStatsQuery.data.clientAccounts}
                    goal={investorGoalsQuery.data?.clientGoal2027 ?? null}
                    goalStatus={investorGoalsQuery.isError ? "error" : investorGoalsQuery.isLoading ? "loading" : "ready"}
                  />
                </div>
              )}
              {investorStatsQuery.data && investorGoalsQuery.isError && (
                <div className="investor-goal-message" role="status">
                  <span>Account goals are temporarily unavailable.</span>
                  <button
                    type="button"
                    onClick={() => void investorGoalsQuery.refetch()}
                    disabled={investorGoalsQuery.isFetching}
                  >
                    {investorGoalsQuery.isFetching ? "Checking…" : "Try again"}
                  </button>
                </div>
              )}
            </div>
            <div className="investor-collage">
              <span
                className="investor-collage-photo investor-collage-primary"
                aria-hidden="true"
                style={{
                  backgroundImage: `linear-gradient(0deg, rgba(19, 23, 106, .25), transparent), url(${tractionTeamPhoto})`,
                }}
              />
              <span
                className="investor-collage-photo investor-collage-secondary"
                aria-hidden="true"
                style={{ backgroundImage: `url(${tractionPlanningPhoto})` }}
              />
              <span className="investor-collage-shape investor-collage-circle" aria-hidden="true" />
              <span className="investor-collage-shape investor-collage-square" aria-hidden="true" />
              <span className="investor-dots investor-collage-dots" aria-hidden="true" />
            </div>
          </div>
        </section>

        <section
          className="investor-letter"
          aria-labelledby="investor-letter-title"
        >
          <span className="investor-letter-blob" aria-hidden="true" />
          <div className="investor-wrap investor-letter-grid">
              <div
                className="investor-letter-visual"
              >
                <img
                  className="investor-founders-photo"
                  src={foundersTeamPhoto}
                  alt="OnSpot co-founders Mark Apostol, Jake Wainberg, and Nur Laminero"
                  width={819}
                  height={1024}
                  loading="lazy"
                  decoding="async"
                />
                <span className="investor-letter-clip" aria-hidden="true" />
                <span className="investor-dots investor-letter-dots" aria-hidden="true" />
                <div className="investor-visual-note">
                  <h2 id="investor-letter-title">A letter from the founders.</h2>
                  <p>The Founders of OnSpot</p>
                </div>
              </div>
              <div className="investor-letter-body">
              <p className="investor-letter-first">
                We built a system for small and medium businesses to solve the
                broken choice between freelance chaos and enterprise BPO overhead.
              </p>
              <div className="investor-compare">
                <div className="investor-problem">
                  <h3><span className="investor-compare-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 17h.01" /></svg></span>The problem</h3>
                  <p>
                    Today, businesses that need operational support have to either
                    manage unreliable freelancers on their own or pay enterprise
                    prices for BPO services that were never designed for them.
                    Meanwhile talented professionals around the world spend their
                    time searching for clients instead of doing the work they are
                    great at, and earn a fraction of what they are worth.
                  </p>
                </div>
                <div className="investor-now">
                  <h3><span className="investor-compare-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg></span>Our solution</h3>
                  <p>
                    With OnSpot, businesses find, hire, and manage vetted global
                    talent in as fast as 7 days, with the accountability of a
                    managed service and none of the overhead, while talent sets
                    their own rate, keeps every dollar, and builds a real
                    international career.
                  </p>
                </div>
              </div>
              <p className="investor-letter-origin">
                We spent four years running a BPO before building this platform.{" "}
                <strong>
                  We did not guess at the problem. We lived inside it
                </strong>, and we built OnSpot from operational truth rather than theory.{" "}
                <strong>We are already self-sustaining.</strong> Operations are
                fully covered by revenue before a single dollar of external
                investment.
              </p>
            </div>
          </div>
        </section>

        <section
          className="investor-ai"
          aria-labelledby="investor-ai-title"
        >
          <span className="investor-ai-pattern" aria-hidden="true" />
          <div className="investor-ai-grid">
            <div className="investor-ai-side">
              <h2 className="investor-ai-lead" id="investor-ai-title">
                Every major technological revolution has transformed the workforce. Artificial intelligence will be no different, but its impact will extend further into cognitive and professional work.
              </h2>
              <svg className="investor-ai-art" viewBox="0 0 360 300" aria-hidden="true">
                <defs>
                  <linearGradient id="investorAiGradient" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#2533A2" />
                    <stop offset="1" stopColor="#13176A" />
                  </linearGradient>
                </defs>
                <circle cx="180" cy="150" r="128" fill="none" stroke="#D5DAF5" strokeWidth="1.5" />
                <circle cx="180" cy="150" r="88" fill="none" stroke="#D5DAF5" strokeWidth="1.5" strokeDasharray="4 7" />
                <path className="investor-ai-link" d="M98 150 C130 96 230 96 262 150" fill="none" stroke="#FAC333" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="6 8" />
                <path className="investor-ai-link" d="M98 150 C130 204 230 204 262 150" fill="none" stroke="#2533A2" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="6 8" style={{ animationDirection: "reverse" }} />
                <g transform="translate(58 110)">
                  <rect width="80" height="80" rx="22" fill="url(#investorAiGradient)" />
                  <rect x="22" y="22" width="36" height="36" rx="7" fill="none" stroke="#fff" strokeWidth="2.4" />
                  <rect x="31" y="31" width="18" height="18" rx="3" fill="#FAC333" />
                  <path d="M30 14v8M40 14v8M50 14v8M30 58v8M40 58v8M50 58v8M14 30h8M14 40h8M14 50h8M58 30h8M58 40h8M58 50h8" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
                </g>
                <g transform="translate(222 110)">
                  <rect width="80" height="80" rx="40" fill="#FAC333" />
                  <circle cx="40" cy="31" r="11" fill="none" stroke="#13176A" strokeWidth="3" />
                  <path d="M20 62c3-11 11-17 20-17s17 6 20 17" fill="none" stroke="#13176A" strokeWidth="3" strokeLinecap="round" />
                </g>
                <circle cx="180" cy="22" r="6" fill="#FAC333" />
                <circle cx="180" cy="278" r="6" fill="#2533A2" />
                <circle cx="308" cy="150" r="4" fill="#9AA4E6" />
                <circle cx="52" cy="150" r="4" fill="#9AA4E6" />
              </svg>
            </div>
            <div className="investor-ai-main">
              <p className="investor-ai-body">
                As AI becomes increasingly accessible, automation will cease to be a differentiator in many industries. It will become standard infrastructure. Businesses will compete not only on how effectively they automate, but also on where they deliberately preserve human involvement.
              </p>

              <div className="investor-ai-shift">
                <div className="investor-ai-shift-item">
                  <span className="investor-ai-shift-ic investor-ai-s-out" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 12h12" /></svg>
                  </span>
                  <p>Some jobs will disappear.</p>
                </div>
                <div className="investor-ai-shift-item">
                  <span className="investor-ai-shift-ic investor-ai-s-mid" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4" /></svg>
                  </span>
                  <p>Others will evolve.</p>
                </div>
                <div className="investor-ai-shift-item">
                  <span className="investor-ai-shift-ic investor-ai-s-in" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 6v12M6 12h12" /></svg>
                  </span>
                  <p>New roles will emerge around AI systems.</p>
                </div>
              </div>

              <p className="investor-ai-premium">
                And in certain markets, <span>human attention</span>, <span>judgment</span>, <span>creativity</span>, and <span>relationships</span> may become premium services.
                <strong>OnSpot is building for that transition.</strong>
              </p>

              <p className="investor-ai-body investor-ai-system">
                As a unified outsourcing system, OnSpot combines technology with human deployment and operational accountability. Our long-term opportunity is to identify the capabilities businesses will continue to value, prepare professionals to deliver them, and make those capabilities accessible globally.
              </p>

              <div className="investor-ai-close">
                <p>
                  We are not building a company that depends on the survival of traditional outsourcing jobs.
                  <strong>We are building a company designed to evolve with the future of work.</strong>
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="investor-vision-section" aria-label="Our vision and founders">
          <img
            className="investor-vision-photo"
            src={visionPhoto}
            alt="Earth illuminated at night, representing work across borders and time zones"
            width={1800}
            height={1198}
            loading="lazy"
            decoding="async"
          />
          <div className="investor-vision-glow investor-vision-glow-one" aria-hidden="true" />
          <div className="investor-vision-glow investor-vision-glow-two" aria-hidden="true" />
          <div className="investor-wrap investor-vision-content">
            <div className="investor-quote">
              <svg className="investor-quote-mark" viewBox="0 0 48 36" aria-hidden="true">
                <path d="M0 36V20C0 8 6 1 18 0v8C12 9 9 13 9 19h9v17H0Zm30 0V20C30 8 36 1 48 0v8c-6 1-9 5-9 11h9v17H30Z" />
              </svg>
              <p className="investor-vision">
                We are raising capital to launch, to scale, and to liberate how the world
                does meaningful work. A world where anyone can work anywhere, and
                every company can hire anyone, without limits.
              </p>
            </div>
            <div className="investor-signatures">
              <h3>The Founders of OnSpot</h3>
              <div className="investor-signature-list">
                <div className="investor-sign">
                  <img className="investor-monogram" src="/nur-ceo.jpeg" alt="Nur Laminero, OnSpot co-founder and CEO" width={512} height={512} loading="lazy" decoding="async" />
                  <div><b>Nur Laminero</b><span>Co-Founder &amp; CEO</span></div>
                </div>
                <div className="investor-sign">
                  <img className="investor-monogram" src={jakePhoto} alt="Jake Wainberg, OnSpot co-founder and President" width={428} height={570} loading="lazy" decoding="async" />
                  <div><b>Jake Wainberg</b><span>Co-Founder &amp; President</span></div>
                </div>
                <div className="investor-sign">
                  <img
                    className="investor-monogram"
                    src="/mark-apostol.png"
                    alt="Mark Apostol, OnSpot co-founder and COO"
                    width={220}
                    height={283}
                    loading="lazy"
                    decoding="async"
                  />
                  <div><b>Mark Apostol</b><span>Co-Founder &amp; COO</span></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          className="investor-invest"
          aria-labelledby="investor-invest-title"
        >
          <div className="investor-wrap">
            <div
              className="investor-cta-panel"
              style={{
                backgroundImage: `linear-gradient(110deg, rgba(37, 51, 162, .96), rgba(19, 23, 106, .9)), url(${investPhoto})`,
              }}
            >
              <span className="investor-cta-rings" aria-hidden="true" />
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
            </div>
            <span className="investor-dots investor-invest-dots" aria-hidden="true" />
          </div>
        </section>
      </main>

      <footer className="investor-footer">
        <div className="investor-wrap investor-footer-inner">
          <a className="investor-logo" href="/" aria-label="OnSpot home">
            <img
              src={onSpotWordmark}
              alt="OnSpot"
              width={1013}
              height={319}
              loading="lazy"
              decoding="async"
            />
          </a>
          <p>
            © 2026 OnSpot. All rights reserved. This page is for information only
            and is not an offer to sell securities.
          </p>
        </div>
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

function formatGoalPercent(value: number): string {
  if (value === 0) return "0%";
  if (value < 1) return `${value.toFixed(2)}%`;
  if (value < 10) return `${value.toFixed(1)}%`;
  return `${Math.round(value)}%`;
}

function InvestorRoleGoalMeter({
  kind,
  label,
  count,
  goal,
  goalStatus,
}: {
  kind: "talent" | "clients";
  label: string;
  count: number;
  goal: number | null;
  goalStatus: "loading" | "error" | "ready";
}) {
  const validCount = Number.isSafeInteger(count) && count >= 0;
  const progress = goal && validCount ? Math.min((count / goal) * 100, 100) : 0;
  const displayPercent = progress;
  const [animatedProgress, setAnimatedProgress] = useState(0);

  useEffect(() => {
    setAnimatedProgress(progress);
  }, [progress]);

  return (
    <article className={`investor-traction-card investor-goal-card investor-goal-${kind}`}>
      <div className="investor-goal-card-top">
        <div className="investor-goal-identity">
          <span className={`investor-traction-icon ${kind === "talent" ? "investor-talent-icon" : "investor-client-icon"}`} aria-hidden="true">
            {kind === "talent" ? (
              <svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5" /><path d="M3 20v-1a6 6 0 0 1 12 0v1M16 5.2a3.5 3.5 0 0 1 0 6.6M18 14a5 5 0 0 1 3 4.6V20" /></svg>
            ) : (
              <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 9h8M8 13h8M8 17h4" /></svg>
            )}
          </span>
          <div>
            <b>{validCount ? count.toLocaleString() : "—"}</b>
            <span>{label}</span>
          </div>
        </div>
      </div>
      {goalStatus === "loading" ? (
        <div className="investor-goal-progress-loading" role="status" aria-label={`Loading ${label.toLowerCase()} goal progress`} />
      ) : goalStatus === "ready" && goal === null ? (
        <p className="investor-goal-copy">A 2027 goal has not been set.</p>
      ) : goalStatus === "ready" && goal !== null ? (
        <>
          <div className="investor-goal-copy">
            <span>Progress to our {goal.toLocaleString()} goal</span>
            <strong className="investor-goal-percent">{formatGoalPercent(displayPercent)}</strong>
          </div>
          <div
            className="investor-meter investor-goal-progress"
            role="progressbar"
            aria-label={`${label}: ${count.toLocaleString()} of ${goal.toLocaleString()}`}
            aria-valuemin={0}
            aria-valuemax={goal}
            aria-valuenow={Math.min(count, goal)}
            aria-valuetext={`${count.toLocaleString()} of ${goal.toLocaleString()}, ${formatGoalPercent(displayPercent)}`}
          >
            <span className="investor-meter-fill" style={{ width: `${animatedProgress}%` }} />
            <span className="investor-meter-knob" style={{
              left: `clamp(10px, ${animatedProgress}%, calc(100% - 10px))`,
            }} />
            {[25, 50, 75].map((tick) => (
              <span key={tick} className="investor-meter-tick" style={{ left: `${tick}%` }} aria-hidden="true" />
            ))}
          </div>
          <div className="investor-meter-scale" aria-hidden="true">
            <span>0</span><span>{formatScale(goal * 0.25)}</span><span>{formatScale(goal * 0.5)}</span><span>{formatScale(goal * 0.75)}</span><span>{formatScale(goal)}</span>
          </div>
        </>
      ) : (
        <span className="investor-goal-progress-placeholder" aria-hidden="true" />
      )}
    </article>
  );
}

function formatScale(value: number): string {
  if (value >= 1000) {
    const thousands = value / 1000;
    return `${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}K`;
  }
  return value.toLocaleString();
}
