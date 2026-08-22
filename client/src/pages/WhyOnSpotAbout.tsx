import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { ArrowRight, ArrowUpRight, CheckCircle2, Menu, X, Mail, Phone, MapPin } from "lucide-react";
import onspotLogo from "@assets/OnSpot_Logo_2026_1784298008227.png";
import jakePhoto from "@assets/Jake_1775039278985.png";
import { Footer } from "@/components/Footer";

const nurPhoto = "/nur-ceo.jpeg";
const markPhoto = "/mark-apostol.png";

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const P = "#474EAD";
const PAPER = "#FDFCFA";
const PAPER2 = "#F7F7FA";
const LINE = "#E9E9EF";
const CHARCOAL = "#1D1D1F";
const GRAY = "#46464C";
const GRAY_LIGHT = "#7A7A82";
const GOLD = "#F5A623";

// ─── Data ─────────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { label: "Our Story", href: "#story" },
  { label: "What We Believe", href: "#beliefs" },
  { label: "Culture", href: "#culture" },
  { label: "Leadership", href: "#team" },
  { label: "Vision", href: "#vision" },
];

const beliefs = [
  {
    num: "01",
    title: "We don't create savings by paying talent less.",
    body: "We create savings by taking less in between. The margin is ours to reduce — not the talent's income.",
  },
  {
    num: "02",
    title: "Talent sets the rate. Talent keeps the rate.",
    body: "Clients pay the rate, plus one transparent fee. No hidden splits. No surprises on either side of the table.",
  },
  {
    num: "03",
    title: "One system to hire, manage, and pay.",
    body: "Not five tools and a spreadsheet. One place where both sides of the table can actually see what's happening.",
  },
];

const operatingValues = [
  {
    title: "Customer First",
    body: "Every decision starts with what's actually good for the client or the talent — not what's easiest for us.",
    cardBg: "#FBF4E2", accent: "#C49A2A",
  },
  {
    title: "Extreme Ownership",
    body: "If something's broken, we fix it. We don't wait for someone else to notice, or for it to become someone else's problem.",
    cardBg: "#FAF0EB", accent: "#C46A42",
  },
  {
    title: "Raise the Standard",
    body: '"Good enough for a traditional BPO" isn\'t good enough for us. We built this because the old bar was too low.',
    cardBg: "#EBF2EC", accent: "#4E8A5A",
  },
  {
    title: "Keep It Simple",
    body: "One system, not five tools. If it needs a manual to explain, we've already made it too complicated.",
    cardBg: "#EBF0F7", accent: "#4A6B9A",
  },
  {
    title: "Move Fast",
    body: "Speed is a feature. We'd rather ship something real and improve it than wait for it to be perfect.",
    cardBg: "#F6ECEA", accent: "#A85C54",
  },
];

const peopleValues = [
  {
    title: "Build Leaders, Not Employees",
    body: "We're not looking for people who wait for instructions. We're building people who could run their own piece of this company.",
    cardBg: "#FBF3DC", accent: "#B89020",
  },
  {
    title: "Hire Slowly, Only A-Players",
    body: "One wrong hire costs more than an empty seat. We'd rather wait for the right person than fill a role fast.",
    cardBg: "#EAF2E8", accent: "#487A54",
  },
  {
    title: "Reward Initiative Over Tenure",
    body: "What gets rewarded here is who solves the problem — not who's been here the longest.",
    cardBg: "#F7EDE6", accent: "#B06040",
  },
  {
    title: "Work Hard, Live Well",
    body: "Ambition and burnout aren't the same thing. We push hard because we care about the outcome — not to prove we can suffer for it.",
    cardBg: "#EEEDF8", accent: "#5A64A8",
  },
];

const leaders = [
  {
    name: "Nur Laminero",
    role: "Co-Founder & CEO",
    photo: nurPhoto,
    imgPos: "50% 18%",
    bio: "Nearly 20 years running BPO operations and startups before building the system that replaces them.",
  },
  {
    name: "Jake Wainberg",
    role: "Founder & President",
    photo: jakePhoto,
    imgPos: "50% 22%",
    bio: "20 years building startups in New York before leading growth and business development globally for OnSpot.",
  },
  {
    name: "Mark Apostol",
    role: "Co-Founder & COO",
    photo: markPhoto,
    imgPos: "50% 18%",
    photoBg: "linear-gradient(160deg, #1A1E5C 0%, #2D3496 38%, #474EAD 72%, #5C63BE 100%)",
    bio: "20+ years in the BPO industry and operating startups before running global operations for OnSpot.",
  },
];

const visionItems = [
  {
    title: "Any role, anywhere",
    body: "As more talent joins, whatever role you need — not just the categories we started with — becomes something we can match, fast.",
  },
  {
    title: "A growing bench of proven talent",
    body: "Every completed engagement adds to a real track record. Clients get a deeper pool with verified performance history — not just a profile.",
  },
  {
    title: "Faster matches, not slower",
    body: "More people on one system means better matches over time, not more noise. Growth should make this easier — not harder.",
  },
  {
    title: "OnSpot Plus",
    body: "Every person who joins adds to the group buying power behind OnSpot Plus — real savings on health coverage and insurance at rates individuals can't get alone.",
  },
  {
    title: "OnSpot Loyalty",
    body: "OnSpot Loyalty rewards what actually matters — performance, tenure, and the value you bring — not just how long you've been around.",
  },
  {
    title: "The same standard, at any size",
    body: "No matter how big this gets, vetting stays real and the fee stays transparent. Scale means more people getting the same deal — not a worse one.",
  },
];

// ─── Shared sub-components ────────────────────────────────────────────────────

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontSize: 12,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.09em",
        color: P,
        marginBottom: 14,
      }}
    >
      <span
        style={{
          display: "inline-block",
          width: 16,
          height: 2,
          background: P,
          borderRadius: 2,
          flexShrink: 0,
        }}
      />
      {children}
    </p>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WhyOnSpotAbout() {
  const [navVisible, setNavVisible] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [beliefsVisible, setBeliefsVisible] = useState(false);
  const [cultureVisible, setCultureVisible] = useState(false);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);
  const beliefsRef = useRef<HTMLDivElement>(null);
  const cultureRef = useRef<HTMLDivElement>(null);

  // Scroll-hide nav
  useEffect(() => {
    const onScroll = () => {
      if (ticking.current) return;
      requestAnimationFrame(() => {
        const y = Math.max(0, window.scrollY);
        const delta = Math.abs(y - lastScrollY.current);
        if (delta >= 8) {
          if (y < 100) setNavVisible(true);
          else if (y > lastScrollY.current && y > 160) setNavVisible(false);
          else if (y < lastScrollY.current) setNavVisible(true);
          lastScrollY.current = y;
        }
        ticking.current = false;
      });
      ticking.current = true;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Beliefs section entrance observer
  useEffect(() => {
    const el = beliefsRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setBeliefsVisible(true); obs.disconnect(); } },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Culture section entrance observer
  useEffect(() => {
    const el = cultureRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setCultureVisible(true); obs.disconnect(); } },
      { threshold: 0.08 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Smooth scroll for anchor links
  const scrollTo = (href: string) => {
    setMobileOpen(false);
    if (!href.startsWith("#")) return;
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div style={{ background: PAPER, color: CHARCOAL, fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif", overflowX: "hidden", WebkitFontSmoothing: "antialiased" }}>

      {/* ── Page-specific sticky navigation ─────────────────────────────────── */}
      <header
        style={{
          position: "fixed",
          inset: "0 0 auto 0",
          zIndex: 1000,
          background: "linear-gradient(90deg,#4B55BD 0%,#3A47A8 45%,#2F327F 100%)",
          transform: navVisible ? "translateY(0)" : "translateY(-100%)",
          transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1), box-shadow 0.3s ease",
          boxShadow: "0 1px 0 rgba(255,255,255,0.08)",
          height: 80,
          display: "flex",
          alignItems: "center",
        }}
      >
        <div style={{ width: "100%", padding: "0 clamp(24px,2.5vw,40px)", display: "flex", alignItems: "center", gap: 0 }}>

          {/* Logo */}
          <Link to="/" style={{ display: "flex", alignItems: "center", flexShrink: 0, marginRight: "auto" }}>
            <img src={onspotLogo} alt="OnSpot" style={{ height: 80, width: "auto", objectFit: "contain" }} />
          </Link>

          {/* Desktop nav links — hidden on mobile */}
          <nav style={{ display: "flex", alignItems: "center", gap: 4, marginRight: 32 }} className="hidden md:flex">
            {NAV_LINKS.map((l) => (
              <button
                key={l.label}
                onClick={() => scrollTo(l.href)}
                className="nav-glow-item"
                style={{ fontSize: 14, fontWeight: 500, color: "#fff", padding: "8px clamp(10px,1.2vw,16px)", borderRadius: 8, background: "transparent", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}
              >
                {l.label}
              </button>
            ))}
          </nav>

          {/* Right CTAs */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <Link
              to="/"
              className="hidden md:block px-5 py-2.5 rounded-lg font-semibold text-sm text-white/90 border border-white/25 hover:bg-white/10 hover:border-white/40 hover:text-white transition-all duration-200 whitespace-nowrap"
            >
              Log In
            </Link>
            <Link
              to="/"
              className="hidden md:block text-[13px] font-medium text-white/55 hover:text-white/85 hover:underline transition-colors duration-200 whitespace-nowrap"
            >
              Sign Up
            </Link>

            {/* Mobile hamburger — only on small screens */}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 8, padding: 8, cursor: "pointer", color: "#fff" }}
              className="md:hidden"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile drawer — slides in below header on small screens */}
        {mobileOpen && (
          <div style={{ position: "absolute", top: 80, left: 0, right: 0, background: "#2F327F", borderTop: "1px solid rgba(255,255,255,0.1)", padding: "12px 24px 20px", zIndex: 999 }}>
            {NAV_LINKS.map((l) => (
              <button
                key={l.label}
                onClick={() => scrollTo(l.href)}
                style={{ display: "block", width: "100%", textAlign: "left", fontSize: 15, fontWeight: 500, color: "rgba(255,255,255,0.84)", padding: "11px 0", background: "transparent", border: "none", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.07)" }}
              >
                {l.label}
              </button>
            ))}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <Link to="/" style={{ flex: 1, textAlign: "center", fontSize: 13.5, fontWeight: 600, color: "rgba(255,255,255,0.82)", border: "1px solid rgba(255,255,255,0.25)", padding: "10px 0", borderRadius: 8 }} onClick={() => setMobileOpen(false)}>Log In</Link>
              <a href="https://calendly.com/hello-onspotglobal/lead-intake-schedule" target="_blank" rel="noopener noreferrer" style={{ flex: 1, textAlign: "center", fontSize: 13.5, fontWeight: 600, color: P, background: "#fff", padding: "10px 0", borderRadius: 8 }}>Sign Up</a>
            </div>
          </div>
        )}
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section
        className="about-hero"
        style={{
          background: "linear-gradient(180deg, #3A47A8 0%, #2F327F 28%, #1D1F40 62%, #0F0F13 100%)",
          display: "flex",
          alignItems: "center",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >

        <div style={{ maxWidth: 800, margin: "0 auto", padding: "80px 32px", position: "relative", width: "100%" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.48)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 999, padding: "6px 16px", marginBottom: 32 }}>
            About OnSpot
          </div>

          <h1
            style={{
              fontFamily: "'Bricolage Grotesque',sans-serif",
              fontSize: "clamp(38px, 6.2vw, 68px)",
              fontWeight: 700,
              lineHeight: 1.06,
              letterSpacing: "-0.02em",
              color: "#fff",
              margin: "0 0 24px",
            }}
          >
            Built by people who{" "}
            <span style={{ color: GOLD }}>lived</span>{" "}
            the problem.
          </h1>

          <p style={{ fontSize: 18, lineHeight: 1.65, color: "rgba(255,255,255,0.58)", maxWidth: 540, margin: "0 auto 40px" }}>
            OnSpot exists because we ran the old model ourselves — and watched it fail the people it was supposed to serve.
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => scrollTo("#story")}
              style={{ fontSize: 14, fontWeight: 600, color: CHARCOAL, background: "#fff", padding: "12px 24px", borderRadius: 8, border: "none", cursor: "pointer", transition: "opacity 0.14s" }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              Our story
            </button>
            <button
              onClick={() => scrollTo("#team")}
              style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.76)", background: "rgba(255,255,255,0.08)", padding: "12px 24px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer", transition: "background 0.14s" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
            >
              Meet the team
            </button>
          </div>
        </div>
      </section>

      {/* ── Our Story ────────────────────────────────────────────────────────── */}
      <section id="story" style={{ background: PAPER2, padding: "96px 0" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 32px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }} className="about-grid-2">
          {/* Left: Story */}
          <div>
            <Kicker>Why we exist</Kicker>
            <h2 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: "clamp(26px,3.2vw,36px)", fontWeight: 700, lineHeight: 1.2, letterSpacing: "-0.02em", color: CHARCOAL, marginBottom: 20 }}>
              We didn't start with a pitch deck.
              <br />
              We started with a failure.
            </h2>
            <p style={{ fontSize: 15.5, lineHeight: 1.75, color: GRAY, marginBottom: 14 }}>
              For nearly two decades, our team built and ran traditional BPO operations — the management layers, the client accounts, the billing structures that everyone in the industry just accepts as "how it's done."
            </p>
            <p style={{ fontSize: 15.5, lineHeight: 1.75, color: GRAY, marginBottom: 14 }}>
              We saw the model from the inside: clients paying for overhead they never asked for. Talented people underpaid for work that mattered. When that structure eventually broke down — clients leaving because of the very layers we were selling them — we didn't patch it. We rebuilt from scratch.
            </p>
            <p style={{ fontSize: 15.5, lineHeight: 1.75, color: GRAY }}>
              OnSpot is what came out the other side: a system clients and talent both actually want, built by people who've been stuck in the one that came before it.
            </p>
          </div>

          {/* Right: Founder quote card */}
          <div>
            <div style={{
              position: "relative",
              background: "linear-gradient(145deg, #2F327F 0%, #1D1F40 60%, #12131F 100%)",
              borderRadius: 24,
              padding: "44px 40px 36px",
              overflow: "hidden",
              boxShadow: "0 32px 64px rgba(15,23,42,0.18), 0 0 0 1px rgba(255,255,255,0.06)",
            }}>
              {/* Glow accent top-right */}
              <div style={{ position: "absolute", top: -60, right: -40, width: 220, height: 220, background: `radial-gradient(circle, ${P}55 0%, transparent 70%)`, pointerEvents: "none" }} />

              {/* Giant decorative quote mark */}
              <div style={{
                position: "absolute",
                top: 16,
                left: 32,
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontSize: 160,
                lineHeight: 1,
                fontWeight: 800,
                color: "rgba(255,255,255,0.055)",
                userSelect: "none",
                pointerEvents: "none",
              }}>"</div>

              {/* Gold accent bar */}
              <div style={{ width: 40, height: 3, background: GOLD, borderRadius: 2, marginBottom: 28, position: "relative" }} />

              <blockquote style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontSize: "clamp(17px,1.6vw,20px)",
                fontWeight: 600,
                lineHeight: 1.58,
                color: "rgba(255,255,255,0.92)",
                margin: "0 0 36px",
                position: "relative",
              }}>
                "We've watched good companies get stuck choosing between marketplace chaos and outsourcing overhead — and good talent get squeezed by both sides of that same trade-off. So we built OnSpot the way operators build things — not software developers guessing at the problem from the outside."
              </blockquote>

              {/* Divider */}
              <div style={{ height: 1, background: "rgba(255,255,255,0.08)", marginBottom: 24 }} />

              {/* Attribution */}
              <div style={{ display: "flex", alignItems: "center", gap: 14, position: "relative" }}>
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <img
                    src={nurPhoto}
                    alt="Nur Laminero"
                    style={{ width: 52, height: 52, borderRadius: "50%", objectFit: "cover", objectPosition: "50% 18%", display: "block", border: "2px solid rgba(255,255,255,0.15)" }}
                  />
                  {/* Online indicator */}
                  <div style={{ position: "absolute", bottom: 2, right: 2, width: 10, height: 10, borderRadius: "50%", background: GOLD, border: "2px solid #1D1F40" }} />
                </div>
                <div>
                  <p style={{ fontSize: 14.5, fontWeight: 700, color: "#fff", margin: "0 0 2px" }}>Nur Laminero</p>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", margin: 0, letterSpacing: "0.04em", fontWeight: 500 }}>Co-Founder & CEO</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── What We Believe ──────────────────────────────────────────────────── */}
      <section id="beliefs" style={{ background: PAPER, padding: "96px 0" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 32px" }}>
          <div style={{ textAlign: "center", maxWidth: 600, margin: "0 auto 56px" }}>
            <Kicker>What we believe</Kicker>
            <h2 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: "clamp(26px,3.2vw,36px)", fontWeight: 700, lineHeight: 1.2, letterSpacing: "-0.02em", color: CHARCOAL }}>
              Not a marketplace. Not a BPO.
              <br />
              <span style={{ color: P }}>Something we built in between.</span>
            </h2>
          </div>

          <div ref={beliefsRef} style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }} className="about-grid-beliefs">
            {beliefs.map((b, i) => (
              <div
                key={b.num}
                className={beliefsVisible ? "belief-card-in" : "belief-card-pre"}
                style={{
                  background: "#fff",
                  border: `1px solid ${LINE}`,
                  borderRadius: 20,
                  padding: "36px 28px",
                  display: "flex",
                  flexDirection: "column",
                  animationDelay: `${i * 130}ms`,
                  transition: "box-shadow 0.25s, transform 0.25s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = `0 20px 48px rgba(71,78,173,0.13)`;
                  e.currentTarget.style.transform = "translateY(-5px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <span
                  className={beliefsVisible ? "belief-num-in" : ""}
                  style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 52, fontWeight: 800, lineHeight: 1, color: P, opacity: 0.1, marginBottom: 16, letterSpacing: "-0.04em", animationDelay: `${i * 130 + 260}ms` }}
                >{b.num}</span>
                <h3 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 19, fontWeight: 700, lineHeight: 1.3, letterSpacing: "-0.01em", color: CHARCOAL, marginBottom: 14 }}>{b.title}</h3>
                <p style={{ fontSize: 14.5, lineHeight: 1.72, color: GRAY, flexGrow: 1 }}>{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Culture ──────────────────────────────────────────────────────────── */}
      <section id="culture" style={{ background: PAPER2, borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}`, padding: "96px 0" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 32px" }}>

          {/* Culture header */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, alignItems: "end", marginBottom: 64 }} className="about-grid-2">
            <div>
              <Kicker>Our culture</Kicker>
              <h2 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: "clamp(26px,3.2vw,36px)", fontWeight: 700, lineHeight: 1.2, letterSpacing: "-0.02em", color: CHARCOAL, margin: 0 }}>
                High trust.{" "}
                <span style={{ color: P }}>High accountability.</span>
                <br />
                Low politics.
              </h2>
            </div>
            <div>
              <p style={{ fontSize: 15.5, lineHeight: 1.75, color: GRAY }}>
                We hire slowly and coach continuously — but we don't carry people who aren't pulling their weight. Everyone here owns their piece of the system, end to end. We're not building a company of employees waiting for instructions; we're building a company of people who notice what's broken and fix it before they're asked to.
              </p>
            </div>
          </div>

          {/* How we operate */}
          <div style={{ marginBottom: 52 }} ref={cultureRef}>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.09em", color: GRAY_LIGHT, marginBottom: 20 }}>How we operate</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14 }} className="about-grid-5">
              {operatingValues.map((v, i) => (
                <div
                  key={v.title}
                  className={cultureVisible ? "culture-card-in" : "culture-card-pre"}
                  style={{
                    background: v.cardBg,
                    border: `1px solid ${v.accent}22`,
                    borderRadius: 16,
                    padding: "22px 20px",
                    transition: "transform 0.22s cubic-bezier(0.22,1,0.36,1), box-shadow 0.22s",
                    animationDelay: cultureVisible ? `${i * 80}ms` : "0ms",
                    cursor: "default",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-5px)";
                    e.currentTarget.style.boxShadow = `0 12px 32px ${v.accent}28`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div style={{ width: 28, height: 3, background: v.accent, borderRadius: 2, marginBottom: 14 }} />
                  <h3 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 15, fontWeight: 700, color: CHARCOAL, marginBottom: 8, lineHeight: 1.3 }}>{v.title}</h3>
                  <p style={{ fontSize: 13, lineHeight: 1.68, color: GRAY }}>{v.body}</p>
                </div>
              ))}
            </div>
          </div>

          {/* How we grow our people */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.09em", color: GRAY_LIGHT, marginBottom: 20 }}>How we grow our people</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }} className="about-grid-4">
              {peopleValues.map((v, i) => (
                <div
                  key={v.title}
                  className={cultureVisible ? "culture-card-in" : "culture-card-pre"}
                  style={{
                    background: v.cardBg,
                    border: `1px solid ${v.accent}22`,
                    borderRadius: 16,
                    padding: "24px 20px",
                    transition: "transform 0.22s cubic-bezier(0.22,1,0.36,1), box-shadow 0.22s",
                    animationDelay: cultureVisible ? `${(operatingValues.length + i) * 80}ms` : "0ms",
                    cursor: "default",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-5px)";
                    e.currentTarget.style.boxShadow = `0 12px 32px ${v.accent}28`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <CheckCircle2 size={18} style={{ color: v.accent, marginBottom: 12 }} />
                  <h3 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 15, fontWeight: 700, color: CHARCOAL, marginBottom: 8, lineHeight: 1.3 }}>{v.title}</h3>
                  <p style={{ fontSize: 13, lineHeight: 1.68, color: GRAY }}>{v.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Leadership ───────────────────────────────────────────────────────── */}
      <section id="team" style={{ background: PAPER, padding: "96px 0" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 32px" }}>
          <div style={{ marginBottom: 48 }}>
            <Kicker>Leadership</Kicker>
            <h2 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: "clamp(26px,3.2vw,36px)", fontWeight: 700, lineHeight: 1.2, letterSpacing: "-0.02em", color: CHARCOAL, marginBottom: 12 }}>
              The people building it.
            </h2>
            <p style={{ fontSize: 15.5, lineHeight: 1.7, color: GRAY, maxWidth: 520 }}>
              Operators, founders, and specialists who built careers in the model they eventually replaced.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 18 }} className="about-grid-leaders">
            {leaders.map((l) => (
              <div
                key={l.name}
                style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 20, overflow: "hidden", transition: "box-shadow 0.22s, transform 0.22s" }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 16px 48px rgba(15,23,42,0.11)"; e.currentTarget.style.transform = "translateY(-3px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "translateY(0)"; }}
              >
                {/* Photo */}
                <div style={{ height: 220, background: (l as any).photoBg ?? "#f0eff4", overflow: "hidden", position: "relative" }}>
                  <div style={{ position: "absolute", inset: 0, transform: (l as any).imgScale || "none", transformOrigin: "50% 42%" }}>
                    <img
                      src={l.photo}
                      alt={l.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: l.imgPos, transition: "transform 0.5s" }}
                    />
                  </div>
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 48, background: "linear-gradient(to top, rgba(255,255,255,0.5), transparent)" }} />
                </div>

                {/* Text */}
                <div style={{ padding: "18px 18px 22px" }}>
                  <p style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 15.5, fontWeight: 700, color: CHARCOAL, marginBottom: 3 }}>{l.name}</p>
                  <p style={{ fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: P, marginBottom: 10 }}>{l.role}</p>
                  <p style={{ fontSize: 13, lineHeight: 1.65, color: GRAY }}>{l.bio}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Vision / Where We're Headed ──────────────────────────────────────── */}
      <section
        id="vision"
        style={{
          background: "linear-gradient(160deg, #1D1F40 0%, #0F0F13 50%, #1A1015 100%)",
          padding: "96px 0",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Accent glow */}
        <div style={{ position: "absolute", top: "-20%", right: "-10%", width: 600, height: 600, background: `radial-gradient(circle, ${P}22 0%, transparent 70%)`, pointerEvents: "none" }} />

        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 32px", position: "relative" }}>
          {/* Header */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, marginBottom: 64, alignItems: "end" }} className="about-grid-2">
            <div>
              <p style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.09em", color: GOLD, marginBottom: 14 }}>
                <span style={{ display: "inline-block", width: 16, height: 2, background: GOLD, borderRadius: 2 }} />
                Where we're headed
              </p>
              <h2 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: "clamp(26px,3.2vw,36px)", fontWeight: 700, lineHeight: 1.2, letterSpacing: "-0.02em", color: "#fff", margin: 0 }}>
                Work Without Limits,{" "}
                <span style={{ color: GOLD }}>at scale.</span>
              </h2>
            </div>
            <div>
              <p style={{ fontSize: 15.5, lineHeight: 1.75, color: "rgba(255,255,255,0.54)" }}>
                Growth isn't the goal. It's what growth lets us do for the people who actually use this — more roles covered, faster matches, and a system that gets better for everyone the bigger it gets.
              </p>
            </div>
          </div>

          {/* Vision grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18 }} className="about-grid-3">
            {visionItems.map((item, i) => (
              <div
                key={item.title}
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "28px 24px" }}
              >
                <span style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: GOLD, opacity: 0.7, display: "block", marginBottom: 14 }}>
                  0{i + 1}
                </span>
                <h3 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 17, fontWeight: 700, lineHeight: 1.3, color: "#fff", marginBottom: 10 }}>{item.title}</h3>
                <p style={{ fontSize: 13.5, lineHeight: 1.7, color: "rgba(255,255,255,0.5)" }}>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────────── */}
      <section style={{ background: P, padding: "80px 0 64px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 32px", textAlign: "center" }}>
          <p style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.55)", marginBottom: 18 }}>Ready to work without limits?</p>
          <h2 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: "clamp(28px,4vw,44px)", fontWeight: 700, lineHeight: 1.12, letterSpacing: "-0.02em", color: "#fff", margin: "0 0 16px" }}>
            Join the companies and talent already building this with us.
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.65, color: "rgba(255,255,255,0.62)", marginBottom: 36 }}>
            One conversation is all it takes to find out if OnSpot is the right fit.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a
              href="https://calendly.com/hello-onspotglobal/lead-intake-schedule"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: P, background: "#fff", padding: "13px 26px", borderRadius: 8, textDecoration: "none", transition: "opacity 0.14s" }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              Hire talent
              <ArrowRight size={15} />
            </a>
            <Link
              to="/find-work"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.82)", background: "rgba(255,255,255,0.12)", padding: "13px 26px", borderRadius: 8, textDecoration: "none", border: "1px solid rgba(255,255,255,0.15)" }}
            >
              Find work
              <ArrowUpRight size={15} />
            </Link>
          </div>
        </div>

      </section>

      <Footer variant="indigo" />

      {/* ── Responsive grid helpers (injected as a style tag) ─────────────────── */}
      <style>{`
        @keyframes _belief-in {
          from { opacity: 0; transform: translateY(36px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes _num-pop {
          0%   { opacity: 0; transform: scale(0.6); }
          70%  { transform: scale(1.12); }
          100% { opacity: 0.1; transform: scale(1); }
        }
        @keyframes _culture-in {
          from { opacity: 0; transform: translateY(28px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .about-hero {
          min-height: 100vh;
          min-height: 100dvh;
        }
        .belief-card-pre {
          opacity: 0;
          transform: translateY(36px);
        }
        .belief-card-in {
          animation: _belief-in 0.55s cubic-bezier(0.22,1,0.36,1) both;
        }
        .belief-num-in {
          animation: _num-pop 0.5s cubic-bezier(0.22,1,0.36,1) both;
        }
        .culture-card-pre {
          opacity: 0;
          transform: translateY(28px) scale(0.97);
        }
        .culture-card-in {
          animation: _culture-in 0.5s cubic-bezier(0.22,1,0.36,1) both;
        }
        .about-footer-grid {
          grid-template-columns: 1fr 1fr 1fr;
        }
        @media (max-width: 768px) {
          .about-footer-grid {
            grid-template-columns: 1fr !important;
            gap: 32px !important;
          }
        }
        @media (max-width: 1024px) {
          .about-grid-5 { grid-template-columns: repeat(3,1fr) !important; }
          .about-grid-leaders { grid-template-columns: repeat(3,1fr) !important; }
          .about-grid-4 { grid-template-columns: repeat(2,1fr) !important; }
        }
        @media (max-width: 768px) {
          .about-grid-2 { grid-template-columns: 1fr !important; gap: 32px !important; }
          .about-grid-3 { grid-template-columns: 1fr 1fr !important; }
          .about-grid-4 { grid-template-columns: 1fr 1fr !important; }
          .about-grid-5 { grid-template-columns: 1fr 1fr !important; }
          .about-grid-beliefs { grid-template-columns: 1fr !important; }
          .about-grid-leaders { grid-template-columns: repeat(2,1fr) !important; }
        }
        @media (max-width: 480px) {
          .about-grid-3 { grid-template-columns: 1fr !important; }
          .about-grid-leaders { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  );
}
