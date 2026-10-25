
import { useEffect, useId, useState, type ReactNode } from "react";
import TalentLandingSignup from "@/components/join-talent/TalentLandingSignup";
import onSpotWordmark from "@/assets/onspot-white-wordmark.png";
import heroImage from "@/assets/join-talent/hero.webp";
import "./Manifesto.css";

const benefits = [
  {
    icon: "sliders",
    title: "Set your own rate",
    text: "You decide what your time is worth. Your rate sits on your profile, not in a bidding war.",
  },
  {
    icon: "wallet",
    title: "Keep every dollar",
    text: "Nothing is cut from the rate you set. What you charge is what you take home.",
  },
  {
    icon: "search",
    title: "Clients come to you",
    text: "Stop spending your week pitching. Businesses come to OnSpot looking for vetted talent.",
  },
  {
    icon: "shield",
    title: "Payroll handled",
    text: "OnSpot runs payroll, onboarding, and compliance, so you get paid without chasing invoices.",
  },
];

const skills = [
  "Virtual assistance",
  "Customer support",
  "Sales & lead generation",
  "Marketing & social media",
  "Graphic design",
  "Video editing",
  "Bookkeeping",
  "Web development",
  "Project management",
  "Admin & data entry",
];

const faqs = [
  [
    "Is it free to join OnSpot?",
    "Yes. Creating your talent profile is free, and nothing is taken out of the rate you set.",
  ],
  [
    "Who decides how much I earn?",
    "You do. You set your own rate on your profile and keep every dollar of it.",
  ],
  [
    "How do I get paid?",
    "OnSpot manages payroll, so you're paid through the platform. No invoices to send and no payments to chase.",
  ],
  [
    "Do I need to find my own clients?",
    "No. Businesses come to OnSpot looking for vetted remote talent, and we match them with professionals whose skills fit the role.",
  ],
  [
    "What happens after I sign up?",
    "We'll email you a verification code. Enter the code to verify your address, then finish your profile, go through vetting, and become visible to clients.",
  ],
];

function Icon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    sliders: (
      <>
        <path d="M4 7h10M4 17h6M18 7h2M14 17h6" />
        <circle cx="16" cy="7" r="2.2" />
        <circle cx="12" cy="17" r="2.2" />
      </>
    ),
    wallet: (
      <>
        <rect x="3" y="6" width="18" height="13" rx="2.5" />
        <path d="M3 10h18M7 15h3" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m20 20-4.3-4.3" />
      </>
    ),
    shield: (
      <>
        <path d="m12 3 7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z" />
        <path d="m8.5 12 2.5 2.5 4.5-5" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

function Swoosh() {
  return (
    <svg className="tl-swoosh" viewBox="0 0 300 22" aria-hidden="true">
      <path d="M3 17C70 7 170 2 297 5c-1 2-1 4-3 5-114-2-204 3-288 11-3 0-4-2-3-4Z" />
    </svg>
  );
}

function Check() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

function WorkweekIllustration() {
  const clipId = useId();
  const barX = 36;
  const barWidth = 488;
  const barHeight = 24;
  const barRadius = barHeight / 2;
  const freelanceY = 132;
  const onSpotY = 259;
  const findingWidth = 174;
  const adminWidth = 104;
  const lessAdminWidth = 70;
  const workWidth = barWidth - findingWidth - adminWidth;
  const onSpotWorkWidth = barWidth - lessAdminWidth;
  const headingOffset = -14;
  const labelOffset = barHeight + 29;

  return (
    <svg
      className="tl-week-illustration"
      viewBox="0 0 560 400"
      role="img"
      aria-labelledby="week-title week-desc"
    >
      <title id="week-title">Where your work week goes</title>
      <desc id="week-desc">
        An illustrative comparison: working alone leaves time for client-finding
        and payment chasing, while OnSpot keeps more time focused on the work.
      </desc>
      <defs>
        <clipPath id={`${clipId}-freelance`}>
          <rect x={barX} y={freelanceY} width={barWidth} height={barHeight} rx={barRadius} />
        </clipPath>
        <clipPath id={`${clipId}-onspot`}>
          <rect x={barX} y={onSpotY} width={barWidth} height={barHeight} rx={barRadius} />
        </clipPath>
      </defs>
      <rect
        x="1"
        y="1"
        width="558"
        height="398"
        rx="28"
        fill="rgba(255,255,255,.055)"
        stroke="rgba(255,255,255,.15)"
      />
      <text x="36" y="62" fill="#fff" fontSize="21" fontWeight="800">
        Where your work week goes
      </text>
      <text x={barX} y={freelanceY + headingOffset} fill="#e5e8ff" fontSize="15" fontWeight="700">
        Freelancing on your own
      </text>
      <g clipPath={`url(#${clipId}-freelance)`}>
        <rect x={barX} y={freelanceY} width={findingWidth} height={barHeight} fill="#ffc72c" />
        <rect x={barX + findingWidth} y={freelanceY} width={adminWidth} height={barHeight} fill="#8290ee" />
        <rect x={barX + findingWidth + adminWidth} y={freelanceY} width={workWidth} height={barHeight} fill="#2639bc" />
      </g>
      <text x={barX + findingWidth / 2} y={freelanceY + labelOffset} textAnchor="middle" fill="#cbd1f7" fontSize="11">
        Finding clients
      </text>
      <text x={barX + findingWidth + adminWidth / 2} y={freelanceY + labelOffset} textAnchor="middle" fill="#cbd1f7" fontSize="11">
        Admin &amp; chasing
      </text>
      <text x={barX + findingWidth + adminWidth + workWidth / 2} y={freelanceY + labelOffset} textAnchor="middle" fill="#cbd1f7" fontSize="11">
        The actual work
      </text>
      <text x={barX} y={onSpotY + headingOffset} fill="#fff" fontSize="15" fontWeight="700">
        Working with OnSpot
      </text>
      <g clipPath={`url(#${clipId}-onspot)`}>
        <rect x={barX} y={onSpotY} width={lessAdminWidth} height={barHeight} fill="#8290ee" />
        <rect x={barX + lessAdminWidth} y={onSpotY} width={onSpotWorkWidth} height={barHeight} fill="#ffc72c" />
      </g>
      <text x={barX + lessAdminWidth / 2} y={onSpotY + labelOffset} textAnchor="middle" fill="#cbd1f7" fontSize="11">
        Less admin
      </text>
      <text x={barX + lessAdminWidth + onSpotWorkWidth / 2} y={onSpotY + labelOffset} textAnchor="middle" fill="#cbd1f7" fontSize="11">
        More time for the work you love
      </text>
      <path d="M36 348h488" stroke="rgba(255,255,255,.15)" />
      <text x="36" y="375" fill="#aeb8f1" fontSize="11">
        Illustrative comparison, not measured results.
      </text>
    </svg>
  );
}

export default function Manifesto() {
  const [stickyVisible, setStickyVisible] = useState(false);
  const scrollToSection = (id: string) => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    document
      .getElementById(id)
      ?.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start",
      });
  };

  const focusSignup = () => {
    const form = document.getElementById("signup");
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    form?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "center",
    });
    window.setTimeout(
      () =>
        document
          .getElementById("talent-first-name")
          ?.focus({ preventScroll: true }),
      reducedMotion ? 0 : 450,
    );
  };

  useEffect(() => {
    const form = document.getElementById("signup");
    const closing = document.getElementById("join");
    if (!form || !closing || !("IntersectionObserver" in window)) return;
    let formVisible = false;
    let closingVisible = false;
    let modalOpen = false;
    let formFocused = false;
    const update = () => {
      modalOpen = Boolean(
        document.querySelector('[role="dialog"], dialog[open]'),
      );
      const mobile = window.matchMedia("(max-width: 900px)").matches;
      const hasForm = form.getBoundingClientRect().bottom > 0;
      const shouldShow =
        mobile &&
        !formVisible &&
        !hasForm &&
        !closingVisible &&
        !modalOpen &&
        !formFocused;
      setStickyVisible(shouldShow);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.target === form) formVisible = entry.isIntersecting;
          if (entry.target === closing) closingVisible = entry.isIntersecting;
        });
        update();
      },
      { threshold: 0.08 },
    );
    observer.observe(form);
    observer.observe(closing);
    const modalObserver = new MutationObserver(() => {
      modalOpen = Boolean(
        document.querySelector('[role="dialog"], dialog[open]'),
      );
      update();
    });
    modalObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["open", "aria-modal"],
    });
    const onFocus = (event: FocusEvent) => {
      formFocused = Boolean(
        event.target instanceof Node && form.contains(event.target),
      );
      update();
    };
    const onBlur = () =>
      window.setTimeout(() => {
        formFocused = Boolean(
          document.activeElement instanceof Node &&
            form.contains(document.activeElement),
        );
        update();
      }, 0);
    window.addEventListener("resize", update);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onBlur);
    update();
    return () => {
      observer.disconnect();
      modalObserver.disconnect();
      window.removeEventListener("resize", update);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onBlur);
    };
  }, []);

  return (
    <div className="talent-landing">
      <div className="tl-shell">
        <nav className="tl-nav" aria-label="Main">
          <a className="tl-logo" href="/" aria-label="OnSpot home">
            <img src={onSpotWordmark} alt="OnSpot" />
          </a>
          <div className="tl-nav-links">
            <a
              href="#how"
              onClick={(event) => {
                event.preventDefault();
                scrollToSection("how");
              }}
            >
              How it works
            </a>
            <a
              href="#faq"
              onClick={(event) => {
                event.preventDefault();
                scrollToSection("faq");
              }}
            >
              FAQ
            </a>
            <a
              className="tl-nav-cta"
              href="#signup"
              onClick={(event) => {
                event.preventDefault();
                focusSignup();
              }}
            >
              Sign up free
            </a>
          </div>
        </nav>

        <header className="tl-hero">
          <div className="tl-hero-copy">
            <p className="tl-eyebrow">
              <span /> Remote work, on your terms
            </p>
            <h1>
              Do the work you love.{" "}
              <span className="tl-script">Keep every dollar.</span>
            </h1>
            <Swoosh />
            <p className="tl-hero-sub">
              OnSpot matches remote professionals with global clients. You set
              your rate, we handle payroll and compliance, and every dollar of
              your rate is yours.
            </p>
            <TalentLandingSignup />
          </div>
          <div className="tl-hero-art">
            <div className="tl-art-halo" aria-hidden="true" />
            <img
              className="tl-hero-image"
              src={heroImage}
              alt="Laptop showing a video call with four remote professionals, with a globe behind it"
              width="495"
              height="670"
              loading="eager"
            />
            <div className="tl-work-note" aria-hidden="true">
              work from
              <br />
              anywhere
              <svg viewBox="0 0 46 46">
                <path d="M30 4C34 18 26 32 8 40M8 40l3-10M8 40l10-2" />
              </svg>
            </div>
            <div className="tl-chip tl-chip-pay" aria-hidden="true">
              <span className="tl-chip-icon">$</span>
              <span>
                <small>Payment received</small>
                <b>100% of your rate</b>
              </span>
            </div>
            <div className="tl-chip tl-chip-match" aria-hidden="true">
              <span className="tl-chip-icon">
                <Icon name="search" />
              </span>
              <span>
                <small>New client match</small>
                <b>Customer Support Lead</b>
              </span>
            </div>
          </div>
        </header>

        <main>
          <section className="tl-benefits" aria-label="Why talent joins OnSpot">
            {benefits.map((benefit) => (
              <article className="tl-benefit" key={benefit.title}>
                <span className="tl-benefit-icon">
                  <Icon name={benefit.icon} />
                </span>
                <h3>{benefit.title}</h3>
                <p>{benefit.text}</p>
              </article>
            ))}
          </section>

          <section className="tl-row tl-row-flip">
            <div className="tl-copy">
              <p className="tl-kicker">A better use of your time</p>
              <h2>
                Stop chasing clients.{" "}
                <span className="tl-script">Start doing the work.</span>
              </h2>
              <Swoosh />
              <p className="tl-lead">
                Working on your own means half the job is finding the job.
              </p>
              <p>
                Pitching, following up, invoicing, and waiting on late payments
                eat the hours you could spend on work you're great at. OnSpot
                takes that off your plate, so your time goes into the work and
                your career.
              </p>
            </div>
            <WorkweekIllustration />
          </section>

          <section className="tl-row tl-rate-row">
            <div className="tl-copy">
              <p className="tl-kicker">Your work. Your worth.</p>
              <h2>
                Your rate. <span className="tl-script">Your rules.</span>
              </h2>
              <Swoosh />
              <p className="tl-lead">
                Too many talented professionals earn a fraction of what their
                work is worth. We built OnSpot to change that.
              </p>
              <ul className="tl-ticks">
                <li>
                  <Check />
                  Set your flat monthly rate on your profile and update it as
                  you grow
                </li>
                <li>
                  <Check />
                  Keep 100% of the rate you set
                </li>
                <li>
                  <Check />
                  Work with international clients and build a real global career
                </li>
              </ul>
            </div>
            <figure
              className="tl-ratecard"
              aria-label="Illustrative talent rate card; rates and earnings are not guaranteed"
            >
              <span className="tl-rate-note" aria-hidden="true">
                set by you!
              </span>
              <div className="tl-rate-top">
                <span className="tl-rate-avatar">MS</span>
                <div>
                  <b>Maria Santos</b>
                  <span>Customer Support Specialist</span>
                </div>
                <span className="tl-vetted">
                  <Check />
                  Vetted
                </span>
              </div>
              <div className="tl-rate-main">
                <small>Illustrative monthly rate</small>
                <div className="tl-amount">
                  <b>$1,200</b>
                  <span>/ month</span>
                </div>
                <div className="tl-rate-slider">
                  <i />
                </div>
              </div>
              <div className="tl-rate-keep">
                <span>Rate shown is an example</span>
                <b>USD</b>
              </div>
              <div className="tl-rate-bar" aria-hidden="true" />
              <div className="tl-rate-skills">
                <span>Live chat</span>
                <span>Email support</span>
                <span>Zendesk</span>
                <span>Onboarding calls</span>
              </div>
              <figcaption>
                Illustration only. Work and rates vary; earnings are not
                guaranteed.
              </figcaption>
            </figure>
          </section>

          <section className="tl-how tl-center" id="how">
            <p className="tl-kicker">A clear path forward</p>
            <h2>
              Get started in <span className="tl-script">three steps.</span>
            </h2>
            <Swoosh />
            <ol className="tl-steps">
              <li>
                <span className="tl-step-number">1</span>
                <h3>Create your profile</h3>
                <p>
                  Sign up free, add your skills and experience, and set your
                  rate.
                </p>
              </li>
              <li>
                <span className="tl-step-number">2</span>
                <h3>Get vetted</h3>
                <p>
                  We review your profile so clients know they're hiring someone
                  proven.
                </p>
              </li>
              <li>
                <span className="tl-step-number">3</span>
                <h3>Get matched and start working</h3>
                <p>
                  Clients looking for your skills find you. We handle payroll
                  and paperwork.
                </p>
              </li>
            </ol>
          </section>

          <section className="tl-row tl-skill-row">
            <div className="tl-copy">
              <p className="tl-kicker">Bring what you do best</p>
              <h2>
                Work that fits <span className="tl-script">your skills.</span>
              </h2>
              <Swoosh />
              <p>
                Businesses on OnSpot hire remote professionals for the roles
                that keep them running, including:
              </p>
              <ul className="tl-roles">
                {skills.map((skill) => (
                  <li key={skill}>{skill}</li>
                ))}
              </ul>
            </div>
            <aside className="tl-built">
              <span className="tl-built-scribble">
                Built by people
                <br />
                who lived it.
              </span>
              <p>
                Our founders ran a BPO before building OnSpot. Everything we
                learned about what remote professionals need to do great work is
                built into the platform.
              </p>
              <div className="tl-years">
                <b>4</b>
                <span>years running a BPO before we built OnSpot</span>
              </div>
              <div className="tl-built-orbit" aria-hidden="true" />
            </aside>
          </section>

          <section className="tl-faq tl-center" id="faq">
            <p className="tl-kicker">Good to know</p>
            <h2>
              Questions? <span className="tl-script">We've got answers.</span>
            </h2>
            <Swoosh />
            <div className="tl-qa">
              {faqs.map(([question, answer]) => (
                <details key={question}>
                  <summary>
                    {question}
                    <span className="tl-plus" aria-hidden="true" />
                  </summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="tl-closing tl-center" id="join">
            <p className="tl-kicker">Your next chapter starts here</p>
            <h2>
              Work without <span className="tl-script">limits.</span>
            </h2>
            <Swoosh />
            <p className="tl-cta-line">
              Set your rate, keep every dollar, and build your international
              career with OnSpot.
            </p>
            <a
              className="tl-button"
              href="#signup"
              onClick={(event) => {
                event.preventDefault();
                focusSignup();
              }}
            >
              Create my free profile <span aria-hidden="true">↗</span>
            </a>
            <span className="tl-small">
              Free to join. It only takes a few minutes.
            </span>
          </section>
        </main>

        <footer className="tl-footer">
          <a className="tl-footer-logo" href="/">
            <img src={onSpotWordmark} alt="OnSpot" />
          </a>
          <span>
            Hiring talent? <a href="/hire-talent">OnSpot for businesses</a>
          </span>
          <div className="tl-legal-links">
            <a href="/terms-and-conditions">Terms</a>
            <a href="/privacy-policy">Privacy</a>
          </div>
          <span>© 2026 OnSpot</span>
        </footer>
      </div>
      <div
        className={`tl-sticky${stickyVisible ? " is-visible" : ""}`}
        aria-hidden={!stickyVisible}
      >
        <a
          className="tl-button"
          href="#signup"
          tabIndex={stickyVisible ? 0 : -1}
          onClick={(event) => {
            event.preventDefault();
            focusSignup();
          }}
        >
          Create my free profile <span aria-hidden="true">↗</span>
        </a>
      </div>
    </div>
  );
}
