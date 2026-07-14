import { Link } from "wouter";
import { Zap, ArrowRight, CircleDollarSign, UserCheck, Users, Shield, Rocket } from "lucide-react";
import bgHero from "@assets/bg_hero_1784053041636.png";

export default function Home() {
  return (
    <div>
      {/* ── 1. HERO ── */}
      <div
        className="relative overflow-hidden flex flex-col"
        style={{
          backgroundImage: `url(${bgHero})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          minHeight: "calc(100vh - 72px)",
        }}
      >
        {/* Solid dark navy panel — left half; blends into image on right */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, rgb(4,4,24) 0%, rgb(4,4,24) 44%, rgba(4,4,24,0.75) 56%, rgba(4,4,24,0.25) 72%, rgba(4,4,24,0.08) 100%)",
          }}
        />
        {/* Subtle top/bottom vignette */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/40 pointer-events-none" />

        {/* Main content — left-aligned */}
        <div className="relative z-10 flex flex-col justify-between min-h-[calc(100vh-72px)] px-6 sm:px-10 lg:px-20 xl:px-28 py-14 sm:py-20">

          {/* Hero text + buttons */}
          <div className="flex-1 flex items-center">
            <div className="w-full max-w-[920px]">
              {/* Headline */}
              <div className="hero-fade-up">
                <h1
                  className="font-bold tracking-tight leading-[1.05] text-white sm:whitespace-nowrap"
                  style={{ fontSize: "clamp(2.2rem, 4.4vw, 5.5rem)" }}
                >
                  Work{" "}
                  <span className="bg-gradient-to-r from-violet-300 via-blue-200 to-violet-300 bg-clip-text text-transparent drop-shadow-[0_0_24px_rgba(167,139,250,0.45)]">
                    Without Limits
                  </span>
                </h1>
              </div>

              {/* Supporting copy */}
              <div className="hero-fade-up-delay mt-5 sm:mt-7">
                <p className="text-lg sm:text-xl lg:text-2xl font-semibold text-white/90 leading-snug">
                  One Platform. Endless Opportunities.
                </p>
                <p className="mt-3 text-base sm:text-lg text-white/60 leading-relaxed">
                  Built for the Future of Work.
                </p>
              </div>

              {/* CTAs */}
              <div className="hero-fade-up-delay mt-8 sm:mt-10 flex flex-col sm:flex-row gap-4 flex-wrap">
                {/* Primary — gradient */}
                <Link href="/hire-talent">
                  <button
                    data-testid="button-hire-talent"
                    className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl font-semibold text-base text-white transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl"
                    style={{
                      background: "linear-gradient(135deg, #3A3AF8 0%, #5B7CFF 55%, #7F3DF4 100%)",
                      boxShadow: "0 8px 28px rgba(58,58,248,0.38), inset 0 1px 0 rgba(255,255,255,0.2)",
                    }}
                  >
                    <Users className="w-4 h-4" />
                    Hire Talent
                  </button>
                </Link>

                {/* Secondary — outlined/glass */}
                <Link href="/find-work">
                  <button
                    data-testid="button-find-work"
                    className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl font-semibold text-base text-white/90 border border-white/30 bg-white/[0.06] backdrop-blur-sm transition-all duration-300 hover:bg-white/10 hover:border-white/50 hover:scale-[1.02]"
                  >
                    Find Work
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </Link>
              </div>
            </div>
          </div>

          {/* Feature strip — bottom of hero */}
          <div className="hero-fade-up-delay mt-10">
            <div
              className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-0 w-full max-w-[760px] rounded-2xl overflow-hidden"
              style={{
                background: "rgba(10,10,40,0.65)",
                border: "1px solid rgba(91,124,255,0.2)",
                backdropFilter: "blur(12px)",
              }}
            >
              {/* Top Talent */}
              <div className="flex items-start gap-4 px-6 py-5 sm:border-r border-white/10">
                <div
                  className="flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(58,58,248,0.3)" }}
                >
                  <Users className="w-7 h-7 text-violet-300" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Top Talent</p>
                  <p className="text-xs text-white/50 mt-0.5 leading-snug">Verified professionals ready to deliver</p>
                </div>
              </div>

              {/* Trusted Platform */}
              <div className="flex items-start gap-4 px-6 py-5 sm:border-r border-white/10">
                <div
                  className="flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(58,58,248,0.3)" }}
                >
                  <Shield className="w-7 h-7 text-violet-300" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Trusted Platform</p>
                  <p className="text-xs text-white/50 mt-0.5 leading-snug">Secure, reliable, and built for you</p>
                </div>
              </div>

              {/* Endless Opportunities */}
              <div className="flex items-start gap-4 px-6 py-5">
                <div
                  className="flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(58,58,248,0.3)" }}
                >
                  <Rocket className="w-7 h-7 text-violet-300" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Endless Opportunities</p>
                  <p className="text-xs text-white/50 mt-0.5 leading-snug">Find the right match. Grow your career.</p>
                </div>
              </div>
            </div>
          </div>

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
