import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  Zap,
  ArrowRight,
  CircleDollarSign,
  UserCheck,
  Users,
  Shield,
  Rocket,
  Briefcase,
} from "lucide-react";

// ── Carousel slide data ────────────────────────────────────────────────────
const heroSlides = [
  {
    audience: "everyone" as const,
    label: "For Everyone",
    title: "Lower cost for companies. Higher pay for talent.",
    description:
      "One marketplace where great work gets done — matched in 72 hours, with no middlemen taking a cut.",
    primaryLabel: "Hire Talent",
    primaryRoute: "/hire-talent",
    secondaryLabel: "Find Work",
    secondaryRoute: "/find-work",
    image:
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1920&q=80",
    imagePosition: "center",
    alt: "Remote team collaborating",
  },
  {
    audience: "client" as const,
    label: "For Companies",
    title: "The talent you need, for up to 70% less",
    description:
      "Skip marketplace chaos and agency overhead. Get matched with skilled professionals in 72 hours — direct, no middlemen.",
    primaryLabel: "Hire Talent",
    primaryRoute: "/hire-talent",
    secondaryLabel: "See how it works",
    secondaryRoute: "/hire-talent",
    image:
      "https://images.unsplash.com/photo-1573497491208-6b1acb260507?auto=format&fit=crop&w=1920&q=80",
    imagePosition: "center right",
    alt: "Professional working at laptop",
  },
  {
    audience: "talent" as const,
    label: "For Talent",
    title: "Paid what your work is actually worth",
    description:
      "Real opportunities with global clients — no bidding wars, no cut taken off the top. Work from wherever you call home.",
    primaryLabel: "Find Work",
    primaryRoute: "/find-work",
    secondaryLabel: "Browse roles",
    secondaryRoute: "/find-work/jobs",
    image:
      "https://images.unsplash.com/photo-1600880292630-ee8a00403024?auto=format&fit=crop&w=1920&q=80",
    imagePosition: "center",
    alt: "Engaged professional in career growth",
  },
];

const SLIDE_DURATION = 7000; // ms

export default function Home() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const activeSlide = heroSlides[currentSlide];

  // Detect reduced-motion preference
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Auto-advance timer — resets whenever slide changes or pause toggles
  useEffect(() => {
    if (isPaused) return;
    const timer = setTimeout(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, SLIDE_DURATION);
    return () => clearTimeout(timer);
  }, [currentSlide, isPaused]);

  // Pause when tab is hidden
  useEffect(() => {
    const handler = () => setIsPaused(document.hidden);
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  // Preload all images after initial render
  useEffect(() => {
    heroSlides.forEach((slide, i) => {
      if (i === 0) return;
      const img = new Image();
      img.src = slide.image;
    });
  }, []);

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  // Pill styles per audience
  const pillStyle =
    activeSlide.audience === "client"
      ? {
          background: "rgba(58,58,248,0.18)",
          border: "1px solid rgba(91,124,255,0.45)",
          color: "#C4C8FF",
        }
      : activeSlide.audience === "talent"
      ? {
          background: "rgba(16,185,129,0.15)",
          border: "1px solid rgba(52,211,153,0.4)",
          color: "#6EE7C0",
        }
      : /* everyone — soft lavender/neutral */ {
          background: "rgba(196,184,255,0.12)",
          border: "1px solid rgba(196,184,255,0.3)",
          color: "#E2DCFF",
        };

  const dotColor =
    activeSlide.audience === "client"
      ? "#A5B4FC"
      : activeSlide.audience === "talent"
      ? "#6EE7C0"
      : "#C4C8FF";

  return (
    <div>
      {/* ── 1. HERO ── */}
      <div
        className="relative overflow-hidden flex flex-col"
        style={{ minHeight: "calc(100dvh - 72px)" }}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* ── Slide backgrounds ── */}
        {heroSlides.map((slide, i) => (
          <div
            key={i}
            aria-hidden="true"
            className={i === currentSlide ? "hero-slide" : ""}
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${slide.image})`,
              backgroundSize: "cover",
              backgroundPosition: slide.imagePosition,
              backgroundRepeat: "no-repeat",
              opacity: i === currentSlide ? 1 : 0,
              transition: reducedMotion
                ? "opacity 0.15s ease"
                : "opacity 1s ease-in-out",
              animation:
                !reducedMotion && i === currentSlide
                  ? "heroKenBurns 8s ease forwards"
                  : "none",
            }}
          />
        ))}

        {/* Gradient overlay */}
        <div
          className="absolute inset-0 z-[1]"
          style={{
            background:
              "linear-gradient(90deg, rgba(4,5,36,0.98) 0%, rgba(8,9,49,0.92) 40%, rgba(8,9,49,0.55) 68%, rgba(8,9,49,0.15) 100%)",
          }}
        />
        {/* Vignette */}
        <div className="absolute inset-0 z-[1] bg-gradient-to-b from-black/25 via-transparent to-black/40 pointer-events-none" />

        {/* ── Main content ── */}
        <div className="relative z-10 flex flex-col justify-between min-h-[calc(100dvh-72px)] px-6 sm:px-10 lg:px-16 xl:px-20 py-10 sm:py-12">
          <div className="flex-1 flex items-start pt-10 sm:pt-16">
            <div className="w-full max-w-[860px]">

              {/* 1 ── Static main heading ── */}
              <div className="hero-fade-up">
                <h1
                  className="font-bold tracking-tight leading-[0.97] text-white sm:whitespace-nowrap"
                  style={{ fontSize: "clamp(2.8rem, 4vw, 5rem)" }}
                >
                  Work{" "}
                  <span className="bg-gradient-to-r from-violet-300 via-blue-200 to-violet-300 bg-clip-text text-transparent drop-shadow-[0_0_24px_rgba(167,139,250,0.45)]">
                    Without Limits
                  </span>
                </h1>
              </div>

              {/* 2 ── Static supporting line ── */}
              <div className="hero-fade-up-delay mt-3 sm:mt-4">
                <p
                  className="font-semibold text-white/90 leading-snug"
                  style={{ fontSize: "clamp(1rem, 1.6vw, 1.5rem)" }}
                >
                  One Platform. Endless Opportunity. Built for the Future of Work.
                </p>
              </div>

              {/* 3–6 ── Rotating block: badge → headline → description → CTAs ── */}
              <div
                key={`slide-${currentSlide}`}
                style={{
                  animation: reducedMotion
                    ? "none"
                    : "heroSlideContentIn 0.55s ease forwards",
                  opacity: reducedMotion ? 1 : 0,
                }}
              >
                {/* 3 — Audience badge */}
                <div className="mt-5 sm:mt-6">
                  <span
                    className="inline-flex items-center gap-2 rounded-full font-bold uppercase tracking-widest"
                    style={{
                      fontSize: "clamp(0.6rem, 0.75vw, 0.72rem)",
                      padding: "5px 13px",
                      ...pillStyle,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: dotColor,
                        flexShrink: 0,
                        display: "inline-block",
                      }}
                    />
                    {activeSlide.label}
                  </span>
                </div>

                {/* 4 — Slide headline */}
                <h2
                  className="font-bold text-white leading-tight mt-3"
                  style={{
                    fontSize: "clamp(1.4rem, 2.4vw, 2.4rem)",
                    letterSpacing: "-0.02em",
                    maxWidth: "680px",
                  }}
                >
                  {activeSlide.title}
                </h2>

                {/* 5 — Slide description */}
                <p
                  className="text-white/65 mt-2 leading-relaxed"
                  style={{
                    fontSize: "clamp(0.85rem, 1vw, 1rem)",
                    maxWidth: "540px",
                  }}
                >
                  {activeSlide.description}
                </p>

                {/* 6 — Rotating CTAs */}
                <div className="mt-5 sm:mt-6 flex flex-col sm:flex-row gap-4 sm:gap-5 flex-wrap">
                  {/* Primary */}
                  <Link href={activeSlide.primaryRoute}>
                    <button
                      className="w-full sm:w-auto flex items-center justify-center gap-3 rounded-xl font-semibold text-white transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl"
                      style={{
                        background:
                          "linear-gradient(135deg, #3A3AF8 0%, #5B7CFF 55%, #7F3DF4 100%)",
                        boxShadow:
                          "0 8px 28px rgba(58,58,248,0.38), inset 0 1px 0 rgba(255,255,255,0.2)",
                        fontSize: "clamp(0.88rem, 1vw, 1.05rem)",
                        padding:
                          "clamp(12px, 1.3vw, 16px) clamp(22px, 2.2vw, 32px)",
                      }}
                    >
                      {activeSlide.audience === "client" ? (
                        <Users className="w-5 h-5 flex-shrink-0" />
                      ) : (
                        <Briefcase className="w-5 h-5 flex-shrink-0" />
                      )}
                      {activeSlide.primaryLabel}
                    </button>
                  </Link>

                  {/* Secondary */}
                  <Link href={activeSlide.secondaryRoute}>
                    <button
                      className="w-full sm:w-auto flex items-center justify-center gap-3 rounded-xl font-semibold text-white/90 border border-white/30 bg-white/[0.06] backdrop-blur-sm transition-all duration-300 hover:bg-white/10 hover:border-white/50 hover:scale-[1.02]"
                      style={{
                        fontSize: "clamp(0.88rem, 1vw, 1.05rem)",
                        padding:
                          "clamp(12px, 1.3vw, 16px) clamp(22px, 2.2vw, 32px)",
                      }}
                    >
                      {activeSlide.secondaryLabel}
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* ── Feature strip — static, bottom of hero (above controls) ── */}
          <div className="hero-fade-up-delay mt-7 pb-16 sm:pb-14">
            <div
              className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-0 w-full max-w-[1080px] rounded-3xl overflow-hidden"
              style={{
                background: "rgba(8,8,42,0.72)",
                border: "1px solid rgba(91,124,255,0.22)",
                backdropFilter: "blur(16px)",
                minHeight: "130px",
              }}
            >
              {/* Top Talent */}
              <div className="flex items-center gap-4 px-6 py-5 sm:border-r border-white/10">
                <div
                  className="flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: "rgba(58,58,248,0.35)" }}
                >
                  <Users className="w-7 h-7 text-violet-300" />
                </div>
                <div>
                  <p
                    className="font-bold text-white leading-tight"
                    style={{ fontSize: "clamp(0.875rem, 1.2vw, 1.2rem)" }}
                  >
                    Top Talent
                  </p>
                  <p
                    className="text-white/55 mt-1.5 leading-snug"
                    style={{ fontSize: "clamp(0.78rem, 0.9vw, 0.95rem)" }}
                  >
                    Verified professionals ready to deliver
                  </p>
                </div>
              </div>

              {/* Trusted Platform */}
              <div className="flex items-center gap-4 px-6 py-5 sm:border-r border-white/10">
                <div
                  className="flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: "rgba(58,58,248,0.35)" }}
                >
                  <Shield className="w-7 h-7 text-violet-300" />
                </div>
                <div>
                  <p
                    className="font-bold text-white leading-tight"
                    style={{ fontSize: "clamp(0.875rem, 1.2vw, 1.2rem)" }}
                  >
                    Trusted Platform
                  </p>
                  <p
                    className="text-white/55 mt-1.5 leading-snug"
                    style={{ fontSize: "clamp(0.78rem, 0.9vw, 0.95rem)" }}
                  >
                    Secure, reliable, and built for you
                  </p>
                </div>
              </div>

              {/* Endless Opportunities */}
              <div className="flex items-center gap-4 px-6 py-5">
                <div
                  className="flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: "rgba(58,58,248,0.35)" }}
                >
                  <Rocket className="w-7 h-7 text-violet-300" />
                </div>
                <div>
                  <p
                    className="font-bold text-white leading-tight"
                    style={{ fontSize: "clamp(0.875rem, 1.2vw, 1.2rem)" }}
                  >
                    Endless Opportunities
                  </p>
                  <p
                    className="text-white/55 mt-1.5 leading-snug"
                    style={{ fontSize: "clamp(0.78rem, 0.9vw, 0.95rem)" }}
                  >
                    Find the right match. Grow your career.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Carousel controls — progress bars ── */}
        <div
          className="absolute bottom-5 z-20 flex items-center gap-3"
          style={{ left: "clamp(24px, 5vw, 80px)" }}
          role="tablist"
          aria-label="Hero carousel slides"
        >
          {heroSlides.map((slide, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === currentSlide}
              aria-label={`Slide ${i + 1}: ${slide.label} — ${slide.title}`}
              onClick={() => goToSlide(i)}
              style={{
                position: "relative",
                width: 56,
                height: 4,
                borderRadius: 4,
                background: "rgba(255,255,255,0.2)",
                cursor: "pointer",
                border: "none",
                padding: 0,
                overflow: "hidden",
                outline: "none",
              }}
              onFocus={(e) =>
                (e.currentTarget.style.outline =
                  "2px solid rgba(255,255,255,0.6)")
              }
              onBlur={(e) => (e.currentTarget.style.outline = "none")}
            >
              {/* Past slides */}
              {i < currentSlide && (
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(255,255,255,0.55)",
                    borderRadius: 4,
                  }}
                />
              )}
              {/* Active slide — animated progress fill */}
              {i === currentSlide && (
                <span
                  key={`fill-${currentSlide}`}
                  aria-hidden="true"
                  className="hero-progress-fill"
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: reducedMotion ? "100%" : 0,
                    background: "white",
                    borderRadius: 4,
                    animation: reducedMotion
                      ? "none"
                      : `heroProgress ${SLIDE_DURATION}ms linear forwards`,
                  }}
                />
              )}
            </button>
          ))}
        </div>

        {/* ── Slide counter ── */}
        <div
          className="absolute bottom-5 z-20"
          style={{
            right: "clamp(24px, 5vw, 80px)",
            fontSize: 14,
            fontWeight: 600,
            color: "rgba(255,255,255,0.65)",
            fontVariantNumeric: "tabular-nums",
          }}
          aria-live="polite"
          aria-atomic="true"
          aria-label={`Slide ${currentSlide + 1} of ${heroSlides.length}`}
        >
          <span style={{ color: "white", fontSize: 18, fontWeight: 700 }}>
            {String(currentSlide + 1).padStart(2, "0")}
          </span>
          {" / "}
          {String(heroSlides.length).padStart(2, "0")}
        </div>
      </div>

      {/* ── 2. GET MATCHED FINAL CTA ── */}
      <section className="relative w-full overflow-hidden bg-[linear-gradient(110deg,#D6D8FF_0%,#C9D8F8_52%,#BCE8F2_100%)] px-6 py-24 sm:px-10 md:py-28 lg:px-16 lg:py-32">
        {/* Background glows */}
        <div className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-violet-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-blue-300/20 blur-3xl" />

        <div className="relative z-10 mx-auto flex w-full max-w-[1100px] flex-col items-center text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/35 px-5 py-2.5 text-[15px] font-semibold text-[#315FCB] backdrop-blur-sm">
            <Zap className="h-4 w-4" />
            72-hour match average
          </div>

          {/* Headline */}
          <h2 className="mt-8 max-w-[900px] text-[48px] font-semibold leading-[1.02] tracking-[-0.045em] text-[#080B1C] md:text-[62px] lg:text-[72px]">
            Get matched with vetted Philippine talent in 72 hours
          </h2>

          {/* Supporting copy */}
          <p className="mt-6 max-w-[700px] text-[19px] leading-[1.5] text-[#53627A] md:text-[21px]">
            Tell us what you need. We'll line up pre-vetted candidates — no
            markups, no middlemen, no obligation.
          </p>

          {/* Primary CTA */}
          <a
            href="/find-best-matches"
            className="mt-10 inline-flex h-[60px] items-center justify-center gap-3 rounded-[14px] bg-[linear-gradient(90deg,#6F35E8_0%,#2368E8_100%)] px-8 text-[18px] font-semibold text-white shadow-[0_12px_30px_rgba(62,67,193,0.28)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(62,67,193,0.34)]"
          >
            Get matched — it's free
            <ArrowRight className="h-5 w-5" />
          </a>

          {/* Reassurance */}
          <p className="mt-4 text-[14px] text-[#66758A] md:text-[15px]">
            Takes 2 minutes · No credit card · First candidates in days
          </p>

          {/* Stats row */}
          <div className="mt-12 grid w-full max-w-[760px] grid-cols-1 gap-5 divide-y divide-[#C9D3E6] border-t border-[#66758A]/20 pt-10 text-center sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-y-0">
            {/* Stat 1 — Save 70% */}
            <div className="px-4 py-3 sm:py-0">
              <div className="mx-auto mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/55 text-[#2F6FD6] shadow-[0_8px_22px_rgba(47,111,214,0.12)]">
                <CircleDollarSign className="h-4 w-4" strokeWidth={2.2} />
              </div>
              <p className="text-[clamp(20px,2vw,30px)] font-bold leading-tight tracking-[-0.035em] text-[#050A1F]">
                Save 70%
              </p>
              <p className="mt-1 text-sm leading-snug text-[#536077]">
                vs. hiring locally
              </p>
            </div>
            {/* Stat 2 — Hire in days */}
            <div className="px-4 py-3 sm:py-0">
              <div className="mx-auto mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/55 text-[#2F6FD6] shadow-[0_8px_22px_rgba(47,111,214,0.12)]">
                <Zap className="h-4 w-4" strokeWidth={2.2} />
              </div>
              <p className="text-[clamp(20px,2vw,30px)] font-bold leading-tight tracking-[-0.035em] text-[#050A1F]">
                Hire in days
              </p>
              <p className="mt-1 text-sm leading-snug text-[#536077]">
                not months
              </p>
            </div>
            {/* Stat 3 — Fully dedicated */}
            <div className="px-4 py-3 sm:py-0">
              <div className="mx-auto mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/55 text-[#2F6FD6] shadow-[0_8px_22px_rgba(47,111,214,0.12)]">
                <UserCheck className="h-4 w-4" strokeWidth={2.2} />
              </div>
              <p className="text-[clamp(20px,2vw,30px)] font-bold leading-tight tracking-[-0.035em] text-[#050A1F]">
                Fully dedicated
              </p>
              <p className="mt-1 text-sm leading-snug text-[#536077]">
                your team, full-time
              </p>
            </div>
          </div>

          {/* Talent link */}
          <p className="mt-10 text-[15px] text-[#56647A]">
            Looking for work instead?{" "}
            <a
              href="/find-best-matches"
              className="font-medium text-[#2C3A52] underline underline-offset-4"
            >
              Join as talent →
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}
