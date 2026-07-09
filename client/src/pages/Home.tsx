import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Zap,
  ArrowRight,
  CircleDollarSign,
  UserCheck,
} from "lucide-react";
import onspotLogoHero from "@assets/onspot-logo-hero.png";

export default function Home() {
  return (
    <div>
      {/* ── 1. HERO ── */}
      <div className="relative overflow-hidden flex flex-col hero-investor">
        {/* Elegant Gradient Overlay for Depth */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/30"></div>

        {/* Subtle Animated Accents */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/3 left-1/4 w-[600px] h-[600px] bg-gradient-radial from-white/5 to-transparent rounded-full blur-3xl animate-gentle-float"></div>
          <div className="absolute bottom-1/3 right-1/4 w-[500px] h-[500px] bg-gradient-radial from-blue-500/10 to-transparent rounded-full blur-3xl animate-slow-spin"></div>
        </div>

        {/* Main content — centered, occupies first viewport so stats fall below fold */}
        <div className="min-h-[calc(100vh-72px)] flex items-center justify-center relative z-20 px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-center text-center">
            {/* Logo above headline */}
            <div className="hero-fade-up" data-testid="badge-superhuman-bpo">
              <img
                src={onspotLogoHero}
                alt="OnSpot"
                style={{
                  width: 'clamp(180px, 22vw, 260px)',
                  height: 'auto',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </div>

            {/* Headline */}
            <div className="hero-fade-up mt-8 sm:mt-10">
              <h1 className="text-6xl sm:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.05] text-white">
                Work{" "}
                <span className="bg-gradient-to-r from-violet-300 via-blue-200 to-violet-300 bg-clip-text text-transparent drop-shadow-[0_0_24px_rgba(167,139,250,0.45)]">
                  Without Limits
                </span>
              </h1>
            </div>

            {/* Supporting copy */}
            <div className="hero-fade-up-delay mx-auto mt-8 max-w-3xl">
              <p className="text-base font-semibold leading-snug text-white/80 sm:text-lg lg:text-xl">
                One System. Your unfair Advantage.
              </p>
              <p className="mt-3 text-base sm:text-lg md:text-xl leading-relaxed text-white/55">
                The only outsourcing system built for the world that's coming
              </p>
              <p className="mt-3 text-base sm:text-lg md:text-xl leading-relaxed text-white/55">
                — not the one that's leaving.
              </p>
            </div>

            {/* CTAs */}
            <div className="hero-fade-up-delay mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 flex-wrap">
              <Button
                variant="outline"
                size="lg"
                className="text-sm sm:text-base px-6 sm:px-8 h-auto border-2 border-white/30 text-white font-medium backdrop-blur-xl bg-white/5 rounded-2xl w-full sm:w-auto py-3.5 min-h-[48px]"
                asChild
                data-testid="button-hire-talent"
              >
                <Link href="/hire-talent">Hire Talent</Link>
              </Button>

              <Button
                variant="outline"
                size="lg"
                className="text-sm sm:text-base px-6 sm:px-8 h-auto border-2 border-white/20 text-white/85 font-medium backdrop-blur-xl bg-white/[0.03] rounded-2xl w-full sm:w-auto py-3.5 min-h-[48px]"
                asChild
                data-testid="button-find-work"
              >
                <Link href="/find-work">Find Work</Link>
              </Button>
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
