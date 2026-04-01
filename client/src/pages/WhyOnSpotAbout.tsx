import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import nurPhoto   from "@assets/Nur_1775038610216.png";
import jakePhoto  from "@assets/Jake_1775039278985.png";
import alonPhoto  from "@assets/Alon_1775039278985.png";
import shanePhoto from "@assets/Shane_1775038610216.png";
import mackyPhoto from "@assets/Macky_1775038610215.png";
import galleryLeadership from "@assets/Leadership_Lifestyle_1775042849148.png";
import galleryFounder    from "@assets/Founder_Energy_1775042849148.png";
import galleryLife       from "@assets/Life_Outside_Work_1775042849149.png";
import galleryBuilt      from "@assets/Built_to_Live_1775042849148.png";
import cultureCulture    from "@assets/Culture_Photo_1775044319871.png";
import cultureTeam       from "@assets/Team_Lifestyle_1775044319872.png";
import cultureOffsite    from "@assets/Offsite_Moment_1775044319872.png";
import cultureHappy      from "@assets/Happy_Tribe_1775044319872.png";

// ─── Data ─────────────────────────────────────────────────────────────────────

const proofStats = [
  { value: "500+",   label: "resources deployed" },
  { value: "50,000+", label: "vetted talent pool" },
  { value: "100+",   label: "SOPs and systems built" },
  { value: "$50M+",  label: "estimated value delivered" },
];

const leaders = [
  {
    name: "Nur Laminero",
    role: "CEO",
    photo: nurPhoto,
    desc: "Turns growth vision into systems, structure, and execution that scale.",
  },
  {
    name: "Jake Wainberg",
    role: "Founder & President",
    photo: jakePhoto,
    desc: "Built OnSpot from real entrepreneurial pain points while scaling businesses in New York.",
  },
  {
    name: "Alon Ben Eli",
    role: "Co-Founder",
    photo: alonPhoto,
    desc: "Helps shape long-range strategy, positioning, and global growth.",
  },
  {
    name: "Shane Limiac",
    role: "Head of Delivery",
    photo: shanePhoto,
    desc: "Leads execution and ensures the client experience translates into measurable results.",
  },
  {
    name: "Mark Apostol",
    role: "Head of People & Administration",
    photo: mackyPhoto,
    desc: "Builds the people systems and culture that power high-performance delivery.",
  },
];

const coreValues = [
  {
    title: "People First",
    body: "Everything begins with people. We do not build systems at the expense of humanity — we build systems that elevate it. When our people feel seen, supported, and empowered, they do their best work.",
    highlight: "People happiness drives client success.",
  },
  {
    title: "Beat Yesterday",
    body: "We are never finished. We chase progress daily — small improvements, better decisions, sharper execution. The standard is not perfection. The standard is growth.",
    highlight: "Progress is our baseline.",
  },
  {
    title: "Fast-Fast-Fast",
    body: "Speed is a competitive advantage. We move with urgency, but never chaos. Fast execution, clear thinking, and decisive action define how we operate.",
    highlight: "Speed with precision.",
  },
  {
    title: "Integrity Matters",
    body: "We do what is right, especially when it is difficult. Trust is earned in consistency, transparency, and accountability. We protect it at all costs.",
    highlight: "Trust is our currency.",
  },
  {
    title: "Extreme Ownership",
    body: "We do not pass problems. We own them. Every outcome, every challenge, every result is ours to solve. This is how we move fast and build trust.",
    highlight: "No excuses. Only solutions.",
  },
  {
    title: "We Are Intrapreneurs",
    body: "We think like builders inside the company. We take initiative, create opportunities, and act like owners — because this is how great companies are built.",
    highlight: "Think like an owner. Act like a founder.",
  },
];

const peoplePrinciples = [
  "A people-first leadership style that treats team members as partners, not resources.",
  "A culture of ownership and accountability where problems are solved, not passed.",
  "A team built for long-term trust, not short-term churn — our retention reflects that.",
  "A workplace where client success and employee growth move together, not in opposition.",
];

const dayInTheLife = [
  {
    time: "08:30",
    title: "The day starts with clarity",
    body: "Teams begin with focus. Priorities are clear, leaders are accessible, and everyone knows what winning looks like for the day.",
  },
  {
    time: "10:00",
    title: "Collaboration feels natural",
    body: "People check in, solve issues quickly, and move with shared responsibility. There is urgency, but there is also trust.",
  },
  {
    time: "13:00",
    title: "Clients feel the culture",
    body: "The way we work internally shows up externally. Care, accountability, responsiveness, and pride in the work are part of the client experience.",
  },
  {
    time: "15:30",
    title: "Improvement is part of the job",
    body: "At OnSpot, people are encouraged to think, suggest, refine, and improve. We do not just follow process. We help make it better.",
  },
  {
    time: "18:00",
    title: "Growth is personal too",
    body: "A day at OnSpot is not only about productivity. It is also about becoming better — as a teammate, a leader, and a builder of something meaningful.",
  },
];

const processSteps = [
  {
    step: "01",
    title: "Book a strategy call",
    body: "We understand your goals, growth bottlenecks, and where support can create the biggest leverage.",
  },
  {
    step: "02",
    title: "Design the right model",
    body: "We shape the right team, structure, and support system for your stage of business.",
  },
  {
    step: "03",
    title: "Launch with confidence",
    body: "We build and operationalize the team so you can move faster with less drag.",
  },
];

const services = [
  {
    label: "Managed Services",
    eyebrow: "Done-for-you execution",
    copy: "A fully managed operating layer — AI-first infrastructure, premium offshore talent, and active operational management in one integrated system.",
    href: "/services/managed",
  },
  {
    label: "Resourced Services",
    eyebrow: "Talent infrastructure",
    copy: "Dedicated people, flexible structure, and fast deployment — scale execution with precision while keeping control of the function.",
    href: "/services/resourced",
  },
  {
    label: "Human Virtual Assistant",
    eyebrow: "AI-enhanced support",
    copy: "Real people. Trained systems. AI-enhanced productivity that gives founders and operators back the one resource that matters most: focus.",
    href: "/services/human-virtual-assistant",
  },
  {
    label: "Enterprise Services",
    eyebrow: "Large-scale operating model",
    copy: "Strategy, operating design, delivery teams, AI systems, and governance combined into one scalable enterprise model.",
    href: "/services/enterprise",
  },
];

const faqs = [
  {
    q: "Who is OnSpot for?",
    a: "OnSpot is for founders, operators, and growth-stage companies that want to scale without building bloated internal teams or getting trapped in operational complexity.",
  },
  {
    q: "What makes OnSpot different from traditional outsourcing?",
    a: "We do not just provide people. We provide culture, structure, management rhythm, and a system designed to help people perform at a high level over time. The difference is a managed operating layer, not just manpower.",
  },
  {
    q: "Why does culture matter so much here?",
    a: "Because great delivery starts with great people. We believe people happiness drives client success, and that belief shapes how we hire, lead, support, and grow our Tribe.",
  },
];

const galleryPlaceholders = [
  { label: "Leadership Lifestyle", photo: galleryLeadership },
  { label: "Founder Energy",       photo: galleryFounder    },
  { label: "Life Outside Work",    photo: galleryLife       },
  { label: "Built to Live",        photo: galleryBuilt      },
];
const cultureGallery = [
  { label: "Culture Photo",   photo: cultureCulture },
  { label: "Team Lifestyle",  photo: cultureTeam    },
  { label: "Offsite Moment",  photo: cultureOffsite },
  { label: "Happy Tribe",     photo: cultureHappy   },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function WhyOnSpotAbout() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-white text-slate-950">

      {/* ── Sticky Header ──────────────────────────────────────────────────── */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-800/60 bg-slate-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#474ead] text-sm font-semibold text-white shadow-sm">
              O
            </div>
            <span className="text-sm font-semibold tracking-[0.2em] text-white">ONSPOT</span>
          </Link>

          <nav className="hidden items-center gap-6 lg:flex">
            {[
              { label: "Our Story",   href: "#the-why" },
              { label: "Our People",  href: "#the-who" },
              { label: "Our Culture", href: "#culture" },
              { label: "Our Systems", href: "#process" },
              { label: "Services",    href: "#services" },
            ].map((link) => (
              <a key={link.label} href={link.href}
                className="text-sm text-slate-300 transition hover:text-white">
                {link.label}
              </a>
            ))}
          </nav>

          <a
            href="#contact"
            className="rounded-full bg-[#474ead] px-5 py-2 text-sm font-semibold text-white transition hover:scale-[1.02] hover:bg-[#5b63d6]"
          >
            Book a Strategy Call
          </a>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-slate-950 px-6 pb-24 pt-36 text-white lg:px-8 lg:pb-32 lg:pt-44">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(71,78,173,0.26),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(142,147,255,0.18),transparent_24%),linear-gradient(to_bottom,rgba(15,23,42,1),rgba(2,6,23,1))]" />

        <div className="relative mx-auto grid max-w-7xl gap-16 lg:grid-cols-12">
          {/* Left — headline + CTAs */}
          <div className="lg:col-span-7">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.3em] text-slate-300">
              AI First. Humans When It Matters.
            </div>
            <h1 className="text-[clamp(2.6rem,6vw,5.6rem)] font-semibold leading-[0.94] tracking-tight">
              Built by people{" "}
              <span className="block bg-gradient-to-r from-white via-[#e4e7ff] to-[#8e93ff] bg-clip-text text-transparent">
                who understand the weight of growth.
              </span>
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-8 text-slate-300">
              OnSpot exists because scaling a business should not mean drowning in hiring, management, and
              operational drag. AI should handle what can be systemized, and humans should step in where
              judgment, care, and leadership matter most. When the right people are supported by the right
              culture and the right intelligence layer, businesses grow better.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <button className="rounded-full bg-[#474ead] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#474ead]/25 transition hover:scale-[1.02] hover:bg-[#5b63d6]">
                Talk to OnSpot
              </button>
              <a
                href="#the-who"
                className="rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Meet the Leadership Team
              </a>
            </div>
          </div>

          {/* Right — stats card */}
          <div className="flex items-start lg:col-span-5 lg:pt-4">
            <div className="w-full rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <div className="text-xs uppercase tracking-[0.3em] text-slate-400">At a glance</div>
              <div className="mt-5 grid gap-3">
                {proofStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4"
                  >
                    <div className="text-3xl font-semibold text-white">{stat.value}</div>
                    <div className="mt-1 text-sm leading-6 text-slate-300">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Our Story / The Why ────────────────────────────────────────────── */}
      <section id="the-why" className="mx-auto max-w-7xl px-6 py-24 lg:px-8 lg:py-32">
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-4">
            <div className="sticky top-28">
              <div className="text-sm font-semibold uppercase tracking-[0.28em] text-[#474ead]">The Why</div>
              <h2 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                OnSpot started from a real problem.
              </h2>
            </div>
          </div>

          <div className="lg:col-span-8">
            <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-8 sm:p-10 lg:p-14">
              <p className="text-2xl leading-[1.45] tracking-tight text-slate-900 sm:text-3xl">
                Our founders were building businesses and ran into the same wall most operators eventually hit:
                growth was possible, but operations were becoming the bottleneck.
              </p>
              <div className="mt-8 space-y-6 text-lg leading-8 text-slate-600">
                <p>
                  Hiring took too long. Costs kept rising. Teams became harder to manage. Founder time was
                  being consumed by work that should have been systemized.
                </p>
                <p>
                  So instead of accepting that as normal, they built a better way. What began as an internal
                  solution became a company built to help other businesses scale with more clarity, better
                  people, and less friction.
                </p>
                <p>
                  That is why OnSpot exists. Not to be another outsourcing provider, but to become a trusted
                  growth partner for businesses that need more than manpower. They need intelligence that
                  removes drag, people who can lead and execute, and a support system that makes both work
                  as one.
                </p>
              </div>
              <a
                href="#services"
                className="mt-10 inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:scale-[1.02]"
              >
                Explore How We Can Help
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Leadership / The Who ───────────────────────────────────────────── */}
      <section id="the-who" className="bg-white py-24 lg:py-32">
        {/* Gallery row */}
        <div className="mx-auto mb-16 max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-4 md:flex md:h-56 md:gap-4">
            {galleryPlaceholders.map((item) => (
              <div
                key={item.label}
                className="group relative overflow-hidden rounded-2xl transition-all duration-700 ease-out aspect-[4/3] md:h-56 md:flex-[1] md:min-w-0 md:hover:flex-[2.4]"
              >
                {/* Real photo */}
                <img
                  src={item.photo}
                  alt={item.label}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 group-hover:scale-110"
                />
                {/* Dark gradient overlay for text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                {/* Label */}
                <div className="absolute bottom-4 left-4 text-xs font-semibold uppercase tracking-[0.18em] text-white/80 opacity-0 transition duration-500 group-hover:opacity-100">
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Leadership cards */}
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mb-12">
            <div className="text-sm font-semibold uppercase tracking-[0.28em] text-[#474ead]">The Who</div>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              The people who built OnSpot.
            </h2>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
              A team that combines entrepreneurial instinct, operational depth, and genuine care for the
              people who power the work.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {leaders.map((leader) => (
              <div
                key={leader.name}
                className="group overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#474ead]/25 hover:shadow-xl"
              >
                {/* Portrait photo */}
                <div className="relative h-64 w-full overflow-hidden bg-slate-100">
                  <img
                    src={leader.photo}
                    alt={leader.name}
                    className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                  />
                  {/* Subtle gradient at bottom to blend into card */}
                  <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white/60 to-transparent" />
                </div>

                {/* Text content */}
                <div className="px-5 pb-6 pt-4">
                  <div className="text-base font-semibold text-slate-950">{leader.name}</div>
                  <div className="mt-0.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#474ead]">
                    {leader.role}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{leader.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Culture Section ─────────────────────────────────────────────────── */}
      <section id="culture" className="border-y border-slate-200 bg-[#f5f8ff] py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          {/* Culture gallery */}
          <div className="mb-16 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {cultureGallery.map((item) => (
              <div
                key={item.label}
                className="group relative overflow-hidden rounded-2xl aspect-[4/3]"
              >
                {/* Real photo */}
                <img
                  src={item.photo}
                  alt={item.label}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 group-hover:scale-110"
                />
                {/* Dark gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                {/* Label */}
                <div className="absolute bottom-3 left-3 text-xs font-semibold uppercase tracking-[0.16em] text-white/80 opacity-0 transition duration-500 group-hover:opacity-100">
                  {item.label}
                </div>
              </div>
            ))}
          </div>

          <div className="mb-14 max-w-3xl">
            <div className="text-sm font-semibold uppercase tracking-[0.28em] text-[#474ead]">Our Culture</div>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Culture is not decoration here. It is the engine.
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              The "Happy Tribe" philosophy is built on a simple truth: when people feel valued, trusted, and
              empowered, they bring their best. That is when clients notice the difference.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {coreValues.map((value) => (
              <div
                key={value.title}
                className="rounded-[1.75rem] border border-white bg-white p-6 shadow-[0_10px_34px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <h3 className="text-xl font-semibold text-slate-950">{value.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{value.body}</p>
                <div className="mt-5 rounded-2xl border border-[#474ead]/15 bg-[#474ead]/5 px-4 py-3 text-sm font-semibold text-[#474ead]">
                  {value.highlight}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Our People / Internal Philosophy ───────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 py-24 lg:px-8 lg:py-32">
        <div className="grid gap-14 lg:grid-cols-2 lg:gap-20">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.28em] text-[#474ead]">Our People</div>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Great client work starts with how people are treated internally.
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              OnSpot is not just an outsourcing company. It is a team that believes the quality of a
              client's experience is a direct reflection of how the people delivering it are supported,
              developed, and led.
            </p>
          </div>

          <div className="flex flex-col justify-center gap-4">
            {peoplePrinciples.map((principle, i) => (
              <div
                key={i}
                className="flex items-start gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-[#474ead]/10">
                  <CheckCircle2 className="h-4 w-4 text-[#474ead]" />
                </div>
                <p className="text-base leading-7 text-slate-700">{principle}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Day in the Life ─────────────────────────────────────────────────── */}
      <section className="border-y border-slate-200 bg-white py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mb-14 max-w-3xl">
            <div className="text-sm font-semibold uppercase tracking-[0.28em] text-[#474ead]">A Day at OnSpot</div>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              What a typical day looks like inside the Tribe.
            </h2>
          </div>

          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
            {/* Timeline */}
            <div className="relative">
              <div className="absolute left-[1.75rem] top-0 h-full w-px bg-slate-200" aria-hidden="true" />
              <div className="space-y-8">
                {dayInTheLife.map((entry) => (
                  <div key={entry.time} className="relative flex gap-6">
                    <div className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl border border-white bg-[#474ead]/10 text-xs font-bold text-[#474ead] shadow-sm z-10">
                      {entry.time}
                    </div>
                    <div className="pb-2 pt-3">
                      <div className="text-base font-semibold text-slate-950">{entry.title}</div>
                      <p className="mt-1.5 text-sm leading-7 text-slate-600">{entry.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Visual placeholder grid */}
            <div className="grid grid-cols-2 gap-4 self-start">
              {["Work + Life", "Deep Work", "Team Flow", "Client Energy"].map((label) => (
                <div key={label} className="group relative aspect-square overflow-hidden rounded-2xl">
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-indigo-100 transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 flex items-end p-4">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 opacity-0 transition duration-500 group-hover:opacity-100">
                      {label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Process Section ─────────────────────────────────────────────────── */}
      <section id="process" className="bg-[linear-gradient(180deg,_#eef7ff_0%,_#f5f8ff_100%)] py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mb-14 max-w-3xl">
            <div className="text-sm font-semibold uppercase tracking-[0.28em] text-[#474ead]">How OnSpot Works</div>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Three steps from conversation to execution.
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              We keep the process simple on purpose — complexity belongs in the solution, not the journey to get there.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {processSteps.map((item) => (
              <div
                key={item.step}
                className="rounded-[1.75rem] border border-white bg-white/90 p-8 shadow-[0_12px_34px_rgba(15,23,42,0.06)] backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#474ead]">
                  Step {item.step}
                </div>
                <h3 className="mt-4 text-2xl font-semibold text-slate-950">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Services Hub ────────────────────────────────────────────────────── */}
      <section id="services" className="border-t border-slate-200 bg-white py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mb-14 max-w-3xl">
            <div className="text-sm font-semibold uppercase tracking-[0.28em] text-[#474ead]">Our Service Models</div>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Explore Our Service Models
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              Every organization is different. We built four distinct service models so the right level of
              support meets the right stage of growth.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {services.map((service) => (
              <a
                key={service.label}
                href={service.href}
                className="group flex flex-col rounded-[1.75rem] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fbff_100%)] p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#474ead]/30 hover:shadow-xl"
              >
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#474ead]">
                  {service.eyebrow}
                </div>
                <h3 className="mt-3 text-xl font-semibold text-slate-950">{service.label}</h3>
                <p className="mt-3 flex-1 text-sm leading-7 text-slate-600">{service.copy}</p>
                <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-[#474ead] transition-all group-hover:gap-3">
                  Explore Service
                  <ArrowRight className="h-4 w-4" />
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────────── */}
      <section className="border-y border-slate-200 bg-[#f5f8ff] py-24 lg:py-32">
        <div className="mx-auto max-w-4xl px-6 lg:px-8">
          <div className="mb-14">
            <div className="text-sm font-semibold uppercase tracking-[0.28em] text-[#474ead]">Questions</div>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Common questions about OnSpot.
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div
                  key={index}
                  className="rounded-[1.75rem] border border-slate-200 bg-white shadow-sm transition-all duration-200"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="flex w-full items-center justify-between gap-6 px-7 py-6 text-left"
                  >
                    <span className="text-lg font-semibold text-slate-950">{faq.q}</span>
                    <span className="flex-shrink-0 rounded-xl border border-slate-200 p-1.5 text-slate-400 transition hover:border-[#474ead]/30 hover:text-[#474ead]">
                      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-slate-100 px-7 pb-7 pt-5 text-base leading-8 text-slate-600">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────────────── */}
      <section
        id="contact"
        className="relative overflow-hidden bg-slate-950 px-6 py-28 text-white lg:px-8 lg:py-36"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(71,78,173,0.3),transparent_28%),radial-gradient(circle_at_75%_70%,rgba(142,147,255,0.15),transparent_24%)]" />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.3em] text-slate-300">
            Ready to scale?
          </div>
          <h2 className="text-[clamp(2rem,5vw,4.5rem)] font-semibold leading-[0.96] tracking-tight">
            The right people.{" "}
            <span className="bg-gradient-to-r from-white via-[#e4e7ff] to-[#8e93ff] bg-clip-text text-transparent">
              The right systems.
            </span>
            <br />
            The right way to scale.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Whether you are building your first outsourced team or transforming an enterprise operation,
            OnSpot is built to move with you.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <button className="rounded-full bg-[#474ead] px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#474ead]/25 transition hover:scale-[1.02] hover:bg-[#5b63d6]">
              Book a Strategy Call
            </button>
            <a
              href="#services"
              className="rounded-full border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Explore Our Services
            </a>
          </div>
        </div>
      </section>

    </div>
  );
}
