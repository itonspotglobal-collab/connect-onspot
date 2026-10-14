import { Link } from "wouter";

export default function Manifesto() {
  return (
    <div className="manifesto-page">
      <style>{`
        /* The reference imports Inter only through 600, then synthesizes its
           heavier title/link weights. Isolate that face from the app's 700
           face so the approved letterforms remain identical. */
        @font-face {
          font-family: "Manifesto Inter";
          font-style: normal;
          font-weight: 600;
          font-display: swap;
          src: url("/fonts/manifesto-inter-reference-600.woff2") format("woff2");
        }

        .manifesto-page {
          display: flow-root;
          min-height: 100vh;
          background: #0A0F2E;
          color: #FFFFFF;
          font-family: Inter, sans-serif;
          font-size: 16px;
          font-weight: 400;
          line-height: normal;
          -webkit-font-smoothing: antialiased;
        }

        .manifesto-page *,
        .manifesto-page *::before,
        .manifesto-page *::after {
          box-sizing: border-box;
        }

        .manifesto-page .manifesto-wrap {
          max-width: 760px;
          margin: 0 auto;
          padding: 120px 32px 0;
        }

        .manifesto-page .manifesto-headline {
          margin: 0 0 28px;
          font-family: "Manifesto Inter", Inter, sans-serif;
          font-size: clamp(48px, 7vw, 92px);
          font-weight: 800;
          line-height: 0.9;
          letter-spacing: -0.02em;
        }

        .manifesto-page .manifesto-headline-row {
          display: block;
        }

        .manifesto-page .manifesto-headline-row:first-child {
          color: #FFFFFF;
        }

        .manifesto-page .manifesto-headline-row:last-child {
          margin-top: -0.1em;
          color: #6F72A0;
          opacity: 0.6;
        }

        .manifesto-page .manifesto-about-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin: 0 0 72px;
          color: #B8BAD6;
          font-size: 15px;
          font-weight: 500;
          text-decoration: none;
        }

        .manifesto-page .manifesto-about-link:hover {
          color: #FFFFFF;
        }

        .manifesto-page .manifesto-lead {
          margin: 0 0 36px;
          color: #FFFFFF;
          font-size: 21px;
          font-weight: 500;
          line-height: 1.75;
        }

        .manifesto-page .manifesto-copy {
          margin: 0 0 32px;
          color: #B8BAD6;
          font-size: 19px;
          line-height: 1.8;
        }

        .manifesto-page .manifesto-join-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 56px;
          margin: 16px 0 64px;
          padding: 0 28px;
          border-radius: 8px;
          background: #F5A623;
          color: #0A0F2E;
          font-family: "Manifesto Inter", Inter, sans-serif;
          font-size: 16px;
          font-weight: 700;
          text-decoration: none;
          white-space: nowrap;
          transition: transform 160ms ease, background-color 160ms ease;
        }

        .manifesto-page .manifesto-join-link:hover {
          background: #FFC05A;
          transform: translateY(-2px);
        }

        .manifesto-page .manifesto-join-link:focus-visible {
          outline: 2px solid #FFFFFF;
          outline-offset: 4px;
        }

        @media (max-width: 600px) {
          .manifesto-page .manifesto-wrap {
            padding: 88px 24px 0;
          }
        }
      `}</style>

      <main className="manifesto-wrap">
        <h1 className="manifesto-headline">
          <span className="manifesto-headline-row">Join</span>
          <span className="manifesto-headline-row">OnSpot</span>
        </h1>
        <Link href="/why-onspot/about" className="manifesto-about-link">
          ← About OnSpot
        </Link>

        <p className="manifesto-lead">
          Hi, I’m Nur Laminero and I’m the Co-Founder and CEO of OnSpot. We’re the unified outsourcing system where businesses find, hire, pay, and manage vetted remote talent in one place — and talent earns more doing it.
        </p>

        <p className="manifesto-copy">
          We’re building a platform for small and medium businesses to solve the broken choice between freelance chaos and enterprise BPO overhead.
        </p>

        <p className="manifesto-copy">
          Today, businesses that need operational support have to either manage unreliable freelancers on their own or pay enterprise prices for BPO services that were never designed for them. Meanwhile talented professionals around the world spend their time searching for clients instead of doing the work they are great at — and earn a fraction of what they are worth.
        </p>

        <p className="manifesto-copy">
          With OnSpot, businesses will be able to find, hire, and manage vetted global talent in as fast as 7 days — with the accountability of a managed service and none of the overhead — while talent sets their own rate, keeps every dollar, and builds a real international career.
        </p>

        <p className="manifesto-copy">
          My co-founders Jake and Mark and I spent four years running a BPO before building this platform — which means we did not guess at the problem. We lived inside it, encoded everything we learned into the platform, and built OnSpot from operational truth rather than theory.
        </p>

        <p className="manifesto-copy">
          We built OnSpot for you. If you are a business owner tired of managing contractors who disappear — this is your platform. If you are a talented professional earning less than your work is worth — this is your platform. We are opening our doors and we want you to be part of what we are building together.
        </p>

        <p className="manifesto-copy">
          Our mission is to liberate how the world does meaningful work — a world where anyone can work anywhere, and every company can hire anyone, without limits.
        </p>

        <p className="manifesto-copy">
          Join us in this journey. Sign up for OnSpot today.
        </p>

        <div>
          <Link href="/signup" className="manifesto-join-link">
            Join OnSpot
          </Link>
        </div>
      </main>
    </div>
  );
}