import { Link } from "wouter";

const freedoms = [
  "Freedom to choose the work that's actually worth your time.",
  "Freedom to earn what your work is actually worth.",
  "Freedom to hire the right person, wherever they are.",
  "Freedom to build a team without unnecessary layers in the way.",
];

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

        .manifesto-page .manifesto-emphasis {
          margin: 48px 0;
          color: #F5A623;
          font-family: Caveat, cursive;
          font-size: 30px;
          font-weight: 600;
          line-height: 1.3;
        }

        .manifesto-page .manifesto-divider {
          width: 48px;
          height: 2px;
          margin: 56px 0;
          background: linear-gradient(90deg, #F5A623 0 8px, #6F72A0 8px 100%);
          opacity: 0.4;
        }

        .manifesto-page .manifesto-freedoms {
          margin: 0 0 32px;
          padding: 0;
          list-style: none;
        }

        .manifesto-page .manifesto-freedoms li {
          position: relative;
          margin: 0 0 20px;
          padding-left: 24px;
          color: #B8BAD6;
          font-size: 19px;
          line-height: 1.7;
        }

        .manifesto-page .manifesto-freedoms li::before {
          position: absolute;
          top: 11px;
          left: 0;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #F5A623;
          content: "";
        }

        .manifesto-page .manifesto-signature {
          margin: 72px 0 56px;
        }

        .manifesto-page .manifesto-signature-line {
          margin: 0 0 8px;
          color: #F5A623;
          font-family: Caveat, cursive;
          font-size: 38px;
          font-weight: 600;
        }

        .manifesto-page .manifesto-signature-role {
          margin: 0;
          color: #6F72A0;
          font-size: 15px;
        }

        .manifesto-page .manifesto-closing {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 64px;
          padding: 36px 40px;
          border-radius: 16px;
          background: #12183F;
        }

        .manifesto-page .manifesto-closing-copy {
          max-width: 460px;
          line-height: 1.8;
          margin: 0;
          color: #B8BAD6;
          font-size: 17px;
        }

        .manifesto-page .manifesto-closing-link {
          font-family: "Manifesto Inter", Inter, sans-serif;
          color: #F5A623;
          font-size: 16px;
          font-weight: 700;
          text-decoration: none;
          white-space: nowrap;
        }

        .manifesto-page .manifesto-closing-link:hover {
          color: #FFFFFF;
        }

        @media (max-width: 600px) {
          .manifesto-page .manifesto-closing {
            flex-direction: column;
            align-items: flex-start;
            padding: 28px 24px;
          }
        }
      `}</style>

      <main className="manifesto-wrap">
        <h1 className="manifesto-headline">
          <span className="manifesto-headline-row">The OnSpot</span>
          <span className="manifesto-headline-row">Manifesto</span>
        </h1>
        <Link href="/why-onspot/about" className="manifesto-about-link">
          ← About OnSpot
        </Link>

        <p className="manifesto-lead">
          Somewhere along the way, work got complicated. Not the work itself — the systems built up around it.
        </p>

        <p className="manifesto-copy">
          Talent stopped setting their own value. Someone else decided what you were worth, where you could work, who you could work for, and how much of what the client paid would actually reach you.
        </p>

        <p className="manifesto-copy">
          Businesses got boxed in too — by headcount, by geography, by recruiting cycles that take months, by layer after layer of markup standing between a great person and the company that needed them.
        </p>

        <div className="manifesto-emphasis">We don't accept that.</div>

        <p className="manifesto-copy">
          The problem was never each other. It was everything standing in between — and how much of it stayed hidden.
        </p>

        <p className="manifesto-copy">
          People should be free to work on their terms. Businesses should be free to grow on theirs.
        </p>

        <ul className="manifesto-freedoms">
          {freedoms.map((freedom) => (
            <li key={freedom}>{freedom}</li>
          ))}
        </ul>

        <div className="manifesto-divider" aria-hidden="true" />

        <p className="manifesto-copy">
          This isn't a freelance platform. It isn't an outsourcing firm. Freedom is the reason any of this exists at all.
        </p>

        <p className="manifesto-copy">
          We're not free either — we don't pretend to be. OnSpot takes a fee, same as anyone standing between a client and the work getting done. The difference is what that fee is, and what it isn't.
        </p>

        <p className="manifesto-copy">
          It's small. It's the only cut anywhere in the transaction — not one of several nobody can see. Talent sets a rate and keeps every bit of it.
        </p>

        <div className="manifesto-signature">
          <div className="manifesto-signature-line">Work Without Limits.</div>
          <div className="manifesto-signature-role">— Nur Laminero, Co-Founder &amp; CEO</div>
        </div>

        <div className="manifesto-closing">
          <p className="manifesto-closing-copy">
            OnSpot exists to make the way work happens more direct, more visible, and more fair.
          </p>
          <Link href="/why-onspot/about" className="manifesto-closing-link">
            More about OnSpot →
          </Link>
        </div>
      </main>
    </div>
  );
}