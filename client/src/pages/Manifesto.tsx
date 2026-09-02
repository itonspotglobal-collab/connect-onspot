import { ArrowLeft, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Footer } from "@/components/Footer";

const INK = "#F8F7F2";
const MUTED = "rgba(248,247,242,0.68)";
const SOFT = "rgba(248,247,242,0.48)";
const GOLD = "#F5B942";
const NAVY = "#080B2A";
const NAVY_MID = "#10154A";

const freedoms = [
  "Freedom to choose the work that's actually worth your time.",
  "Freedom to earn what your work is actually worth.",
  "Freedom to hire the right person, wherever they are.",
  "Freedom to build a team without unnecessary layers in the way.",
  "Freedom to grow without being boxed in by geography or headcount.",
  "Freedom to move — between roles, between rates, between what's next.",
];

function ManifestoParagraph({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`manifesto-copy ${className}`}
      style={{
        color: MUTED,
        fontFamily: "Inter, sans-serif",
        fontSize: "clamp(1.15rem, 2vw, 1.52rem)",
        lineHeight: 1.58,
        letterSpacing: "-0.012em",
        margin: 0,
      }}
    >
      {children}
    </p>
  );
}

function Handwritten({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={className}
      style={{
        color: GOLD,
        fontFamily: "'Caveat', cursive",
        fontSize: "1.35em",
        fontWeight: 600,
        letterSpacing: "0.005em",
        lineHeight: 1,
      }}
    >
      {children}
    </span>
  );
}

export default function Manifesto() {
  return (
    <div
      className="manifesto-page min-h-screen"
      style={{
        background: `radial-gradient(circle at 84% 8%, rgba(71,78,173,0.32), transparent 29rem), linear-gradient(160deg, ${NAVY_MID} 0%, ${NAVY} 48%, #050614 100%)`,
        color: INK,
      }}
    >
      <main>
        <section className="mx-auto max-w-[1000px] px-6 pb-4 pt-12 sm:px-10 sm:pb-6 sm:pt-20 lg:px-14 lg:pb-8 lg:pt-28">
          <div className="max-w-[840px]">
            <p className="mb-7 flex items-center gap-3 text-[0.68rem] font-bold uppercase tracking-[0.22em] text-[#F5B942]">
              <span aria-hidden className="h-px w-9 bg-[#F5B942]" />
              Why We Built OnSpot
            </p>
            <h1
              className="max-w-[800px] text-white"
              style={{
                fontFamily: "'Bricolage Grotesque', sans-serif",
                fontSize: "clamp(3.3rem, 10vw, 8.5rem)",
                lineHeight: 0.92,
                letterSpacing: "-0.075em",
                fontWeight: 700,
                margin: 0,
              }}
            >
              The OnSpot
              <br />
              <span style={{ color: "rgba(248,247,242,0.72)" }}>Manifesto</span>
            </h1>
            <Link href="/why-onspot/about">
              <span className="mt-6 inline-flex min-h-11 cursor-pointer items-center gap-2 text-xs font-semibold text-white/55 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F5B942]">
                <ArrowLeft className="h-3.5 w-3.5" />
                About OnSpot
              </span>
            </Link>
          </div>

          <div className="mt-20 max-w-[680px] lg:mt-32">
            <article className="space-y-9 sm:space-y-12">
              <ManifestoParagraph>
                Somewhere along the way, work got complicated. Not the work itself — the systems built up around it.
              </ManifestoParagraph>

              <ManifestoParagraph>
                Talent stopped setting their own value. Someone else decided what you were worth, where you could work, who you could work for, and how much of what the client paid would actually reach you.
              </ManifestoParagraph>

              <ManifestoParagraph>
                Businesses got boxed in too — by headcount, by geography, by recruiting cycles that take months, by layer after layer of markup standing between a great person and the company that needed them.
              </ManifestoParagraph>

              <ManifestoParagraph>
                Neither side asked for this. Both sides just accepted it, because that's how it's always been done.
              </ManifestoParagraph>

              <p
                className="py-2"
                style={{
                  color: INK,
                  fontFamily: "'Caveat', cursive",
                  fontSize: "clamp(1.35rem, 3vw, 2rem)",
                  fontWeight: 600,
                  lineHeight: 1.2,
                  letterSpacing: "-0.02em",
                  margin: 0,
                }}
              >
                We don't accept that.
              </p>

              <ManifestoParagraph>
                The problem was never each other. It was everything standing in between — and how much of it stayed hidden.
              </ManifestoParagraph>

              <ManifestoParagraph>
                People should be free to work on their terms. Businesses should be free to grow on theirs.
              </ManifestoParagraph>

              <ul
                aria-label="The freedoms OnSpot stands for"
                className="manifesto-freedom-list list-none space-y-6 border-y border-white/15 py-9 sm:space-y-8 sm:py-12"
              >
                {freedoms.map((freedom) => (
                  <li key={freedom} className="flex gap-4">
                    <span aria-hidden className="mt-[0.8em] h-1.5 w-1.5 shrink-0 rounded-full bg-[#F5B942]" />
                    <span
                      style={{
                        color: INK,
                        fontFamily: "Inter, sans-serif",
                        fontSize: "clamp(1.35rem, 2.8vw, 2.1rem)",
                        lineHeight: 1.24,
                        letterSpacing: "-0.025em",
                      }}
                    >
                      {freedom}
                    </span>
                  </li>
                ))}
              </ul>

              <ManifestoParagraph>
                This isn't a freelance platform. It isn't an outsourcing firm. Those are mechanisms — ways of getting work done. Freedom is the reason any of this exists at all.
              </ManifestoParagraph>

              <ManifestoParagraph>
                We're not free either — we don't pretend to be. OnSpot takes a fee, same as anyone standing between a client and the work getting done. The difference is what that fee is, and what it isn't.
              </ManifestoParagraph>

              <ManifestoParagraph>
                It's small. It's the same for everyone. And it's the only cut anywhere in the transaction — not one of several nobody can see. Talent sets a rate and keeps every bit of it. Clients see exactly what they're paying and exactly why. Nothing hidden, nothing padded, nothing added in the fine print.
              </ManifestoParagraph>

              <ManifestoParagraph>
                That's not a discount. It's not a compromise. It's what happens when you replace an invisible cut with a visible one.
              </ManifestoParagraph>

              <ManifestoParagraph>
                We're not on the side of the client. We're not on the side of the talent.
              </ManifestoParagraph>

              <ManifestoParagraph>
                We're on the side of the transaction actually being fair to both.
              </ManifestoParagraph>

              <div className="border-t border-white/15 pt-10 sm:pt-14">
                <p
                  style={{
                    color: INK,
                    fontFamily: "'Caveat', cursive",
                    fontSize: "clamp(1.5rem, 3.2vw, 2.25rem)",
                    fontWeight: 600,
                    lineHeight: 1.15,
                    letterSpacing: "-0.02em",
                    margin: 0,
                  }}
                >
                  Work Without Limits.
                </p>
                <p
                  className="mt-8"
                  style={{
                    color: SOFT,
                    fontFamily: "'Caveat', cursive",
                    fontSize: "clamp(1.1rem, 1.8vw, 1.35rem)",
                    lineHeight: 1.2,
                    margin: 0,
                  }}
                >
                  — Nur Laminero, Co-Founder &amp; CEO
                </p>
              </div>
            </article>
          </div>
        </section>

        <section className="border-t border-white/10 bg-black/10">
          <div className="mx-auto flex max-w-[1000px] flex-col gap-5 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-10 sm:py-6 lg:px-14">
            <p className="max-w-xl text-sm leading-relaxed text-white/50">
              OnSpot exists to make the way work happens more direct, more visible, and more fair.
            </p>
            <Link href="/why-onspot/about">
              <span className="inline-flex min-h-12 cursor-pointer items-center gap-2 text-sm font-semibold text-[#F5B942] transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F5B942]">
                More about OnSpot <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </div>
        </section>
      </main>

      <Footer variant="dark" separator />
    </div>
  );
}