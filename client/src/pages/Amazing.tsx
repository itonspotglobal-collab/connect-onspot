import { useState, useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  Quote,
  Heart,
  Shield,
  Zap,
  Users,
  Star,
  ChevronRight,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { HeadSEO } from "@/components/HeadSEO";

// ─── Data ──────────────────────────────────────────────────────────────────────

const aprilIssue = {
  month: "April Issue",
  issueNumber: "Issue No. 04",
  date: "April 2026",
  headline: "The kind of operator you wish you'd hired five years ago.",
  name: "Alyssa Mendoza",
  role: "Client Success Operator",
  story:
    "Every month we feature one operator who quietly raises the standard at OnSpot. Alyssa keeps promises, protects quality, and makes complexity feel simple — the kind of person founders trust with the parts of the business they can't afford to drop.",
  image:
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1400&q=80",
};

const coreValueAmbassadors = [
  {
    value: "People First",
    name: "Marco Santos",
    role: "Operations Lead",
    initials: "MS",
    avatarBg: "#474ead",
    note: "Puts people first in the work and protects both the client and the team experience with care and intention.",
    quote: "When people feel supported, the work gets stronger.",
    story:
      "Marco is known for creating calm around pressure. He checks in early, communicates clearly, and makes sure both teammates and clients feel looked after — especially when work gets intense.",
    icon: Heart,
    photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80",
  },
  {
    value: "Beat Yesterday",
    name: "Jessa Villanueva",
    role: "Executive Assistant",
    initials: "JV",
    avatarBg: "#5c6bc0",
    note: "Shows daily progress, sharper thinking, and a relentless commitment to getting better over time.",
    quote: "Improvement is a daily habit, not a once-a-year event.",
    story:
      "Jessa keeps raising her own standard. She refines systems, shortens turnaround time, and consistently finds small ways to make the work cleaner than it was the day before.",
    icon: Star,
    photo: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80",
  },
  {
    value: "Relentless Speed",
    name: "Rina Dela Cruz",
    role: "Client Support Specialist",
    initials: "RD",
    avatarBg: "#3949ab",
    note: "Moves with urgency, clears bottlenecks quickly, and keeps momentum alive without losing quality.",
    quote: "Move with urgency without sacrificing care.",
    story:
      "Rina has a reputation for closing loops fast. She responds quickly, anticipates the next need, and helps clients feel like things are always moving forward.",
    icon: Zap,
    photo: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=300&q=80",
  },
  {
    value: "Extreme Ownership",
    name: "Paolo Reyes",
    role: "Workflow Strategist",
    initials: "PR",
    avatarBg: "#474ead",
    note: "Acts like an owner, solves problems before they spread, and takes responsibility for the outcome.",
    quote: "If it touches the outcome, I own it.",
    story:
      "Paolo does not wait for problems to become visible. He catches gaps early, tightens loose systems, and approaches every deliverable with an owner's mindset.",
    icon: Shield,
    photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80",
  },
  {
    value: "We are Intrapreneurs",
    name: "Camille Torres",
    role: "Team Manager",
    initials: "CT",
    avatarBg: "#5c6bc0",
    note: "Thinks beyond tasks, spots opportunities, and brings initiative that creates value inside the company.",
    quote: "We do not just execute. We help build.",
    story:
      "Camille constantly looks for ways to improve how the company works. She brings ideas, tests better approaches, and treats the business like something she is helping grow from within.",
    icon: Users,
    photo: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80",
  },
  {
    value: "Integrity Matters",
    name: "Nico Herrera",
    role: "Quality Analyst",
    initials: "NH",
    avatarBg: "#3949ab",
    note: "Protects standards, tells the truth, and does the right thing even when nobody is watching.",
    quote: "Trust is built in the moments nobody sees.",
    story:
      "Nico is steady, honest, and exacting. He speaks up when something is off, protects quality without drama, and makes sure standards are never just words on a wall.",
    icon: Sparkles,
    photo: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=300&q=80",
  },
];

const stories = [
  {
    category: "Employees",
    title: "The assistant who became an indispensable operator",
    excerpt:
      "What starts as support becomes leadership when discipline, curiosity, and client care compound over time.",
    meta: "4 min read",
    size: "large",
    image: "https://images.unsplash.com/photo-1553877522-43269d4ea984?auto=format&fit=crop&w=900&q=80",
    accent: "#474ead",
  },
  {
    category: "Clients",
    title: "How one founder got 20 hours back every week",
    excerpt:
      "A look at how structure, delegation, and better operating rhythm changed the pace of a business.",
    meta: "3 min read",
    size: "small",
    accent: "#5c6bc0",
  },
  {
    category: "Company",
    title: "Why OnSpot is building an AI-first human company",
    excerpt:
      "Inside the philosophy shaping how talent, systems, and AI come together across the business.",
    meta: "5 min read",
    size: "small",
    accent: "#3949ab",
  },
  {
    category: "Culture",
    title: "What excellence looks like on an ordinary Tuesday",
    excerpt:
      "A magazine-style look at the small habits that quietly create a premium company.",
    meta: "2 min read",
    size: "small",
    accent: "#474ead",
  },
  {
    category: "Leadership",
    title: "The standards behind the brand",
    excerpt:
      "A story about how leadership taste, discipline, and care shape what clients eventually feel.",
    meta: "4 min read",
    size: "large",
    image: "https://images.unsplash.com/photo-1560179707-f14e90ef3623?auto=format&fit=crop&w=900&q=80",
    accent: "#5c6bc0",
  },
  {
    category: "Clients",
    title: "From scattered support to one clean machine",
    excerpt:
      "When the right people and the right systems meet, the business starts breathing differently.",
    meta: "3 min read",
    size: "small",
    accent: "#3949ab",
  },
];

const amazingClients = [
  {
    name: "James K.",
    type: "Founder Story",
    details: "SaaS founder, Series A, 22 staff",
    quote:
      "OnSpot gave us 20 hours back every week and finally made follow-through feel predictable.",
  },
  {
    name: "Maria L.",
    type: "Agency Story",
    details: "Agency owner, 14-person team",
    quote:
      "Response times dropped under 24 hours, and our clients felt the difference almost immediately.",
  },
  {
    name: "Operations Director",
    type: "Team Story",
    details: "Multi-clinic dental group",
    quote:
      "We cut scheduling back-and-forth by 40% and gave our managers room to focus on patient experience.",
  },
];

const filters = ["All", "Employees", "Clients", "Culture", "Leadership", "Company"];

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionHeading({
  eyebrow,
  title,
  body,
  dark = false,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  dark?: boolean;
}) {
  return (
    <div className="max-w-3xl">
      <div
        className={`mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.24em] ${
          dark
            ? "border-white/10 bg-white/5 text-white/65"
            : "border-[#dcdff7] bg-white text-[#5b628d]"
        }`}
      >
        <Sparkles className="h-3.5 w-3.5" />
        {eyebrow}
      </div>
      <h2
        className={`text-3xl font-semibold tracking-tight sm:text-4xl ${
          dark ? "text-white" : "text-[#15192f]"
        }`}
      >
        {title}
      </h2>
      {body ? (
        <p
          className={`mt-4 text-base leading-7 sm:text-lg ${
            dark ? "text-white/70" : "text-[#5f6685]"
          }`}
        >
          {body}
        </p>
      ) : null}
    </div>
  );
}

function StoryCard({ story }: { story: (typeof stories)[number] }) {
  const large = story.size === "large";

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      className={large ? "lg:col-span-2" : "lg:col-span-1"}
    >
      <Card className="group h-full overflow-hidden rounded-[28px] border border-[#e5e8f5] bg-white shadow-[0_15px_50px_rgba(24,35,77,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_70px_rgba(24,35,77,0.1)]">
        <CardContent className="p-0">
          {/* Visual header */}
          {large && story.image ? (
            <div className={`relative overflow-hidden ${large ? "min-h-[220px]" : "min-h-[140px]"}`}>
              <img
                src={story.image}
                alt={story.title}
                className="h-full w-full object-cover"
                style={{ minHeight: large ? 220 : 140 }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#060d24]/70 via-[#060d24]/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
                <div className="text-[11px] uppercase tracking-[0.22em] text-white/70">
                  {story.category}
                </div>
                <h3 className="mt-2 max-w-2xl text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  {story.title}
                </h3>
              </div>
              <div className="absolute right-5 top-5 rounded-full border border-white/20 bg-white/15 p-2 text-white backdrop-blur transition-transform duration-300 group-hover:translate-x-0.5">
                <ChevronRight className="h-4 w-4" />
              </div>
            </div>
          ) : (
            <div
              className={`flex flex-col justify-between border-b border-[#eceef8] ${
                large ? "min-h-[220px]" : "min-h-[160px]"
              } p-6 sm:p-8`}
              style={{
                background: `linear-gradient(135deg, ${story.accent}10 0%, #f7f8ff 50%, ${story.accent}08 100%)`,
              }}
            >
              {/* Accent mark for small cards */}
              <div className="flex items-start justify-between">
                <div
                  className="h-8 w-1.5 rounded-full"
                  style={{ background: story.accent }}
                />
                <div className="rounded-full border border-[#dfe3f5] bg-white p-2 text-[#474ead] transition-transform duration-300 group-hover:translate-x-0.5">
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-[#6a7198]">
                  {story.category}
                </div>
                <h3
                  className={`mt-2 font-semibold tracking-tight text-[#171b33] ${
                    large ? "max-w-2xl text-3xl" : "text-xl"
                  }`}
                >
                  {story.title}
                </h3>
              </div>
            </div>
          )}

          <div className="p-6 sm:p-8">
            <p className="max-w-2xl text-sm leading-7 text-[#5f6685]">{story.excerpt}</p>
            <div className="mt-4 flex items-center justify-between text-sm text-[#636b8c]">
              <span>{story.meta}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function Amazing() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [captureEmail, setCaptureEmail] = useState("");
  const [captureSubmitted, setCaptureSubmitted] = useState(false);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({ target: pageRef, offset: ["start start", "end end"] });
  const chapterY = useTransform(scrollYProgress, [0.48, 0.72], [100, 0]);

  const filteredStories =
    activeFilter === "All"
      ? stories
      : stories.filter((s) => s.category === activeFilter);

  const handleCaptureSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!captureEmail) return;
    setCaptureSubmitted(true);
  };

  return (
    <div ref={pageRef} className="relative min-h-screen overflow-x-hidden bg-[#fcfcff] text-[#161a31]">
      <HeadSEO
        title="OnSpot Magazine — Inside the team that runs your business"
        description="A monthly look at the operators, values, and client stories behind OnSpot's high-standard outsourcing team."
      />

      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[#474ead]/10 blur-3xl" />
        <div className="absolute right-0 top-[220px] h-[320px] w-[320px] rounded-full bg-[#aeb6ff]/20 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(71,78,173,0.03)_1px,transparent_1px),linear-gradient(to_right,rgba(71,78,173,0.03)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      <main>
        {/* ── Hero / Cover ── */}
        <section className="w-full border-b border-[#e6e9f5] bg-white">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.92fr_1.08fr] lg:px-10 lg:py-24">
            {/* Left: editorial copy */}
            <div className="max-w-xl">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45 }}
                className="text-[11px] uppercase tracking-[0.28em] text-[#626a8e]"
              >
                OnSpot Magazine — A look inside the team that runs your business
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.04, ease: "easeOut" }}
                className="mt-5 inline-flex rounded-full border border-[#dde2f6] bg-[#f7f8ff] px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-[#474ead]"
              >
                April Issue — Cover Story
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.08, ease: "easeOut" }}
                className="mt-7 text-4xl font-semibold tracking-[-0.035em] text-[#15192f] sm:text-5xl lg:text-[3.5rem] lg:leading-[1.08]"
              >
                {aprilIssue.headline}
              </motion.h1>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.14, ease: "easeOut" }}
                className="mt-5 text-xl font-semibold tracking-[-0.02em] text-[#474ead]"
              >
                Meet {aprilIssue.name}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.2, ease: "easeOut" }}
                className="mt-1 text-sm uppercase tracking-[0.24em] text-[#6d7498]"
              >
                {aprilIssue.role}
              </motion.div>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.26, ease: "easeOut" }}
                className="mt-6 max-w-lg text-base leading-8 text-[#5f6685]"
              >
                {aprilIssue.story}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.32, ease: "easeOut" }}
                className="mt-8 flex flex-wrap gap-3"
              >
                <Button className="h-11 rounded-full bg-[#474ead] px-6 text-white hover:bg-[#3d4499]">
                  Read cover story
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <a href="/hire-talent">
                  <Button
                    variant="outline"
                    className="h-11 rounded-full border-[#dfe3f5] bg-white px-6 text-[#2a3152] hover:bg-[#f7f8ff]"
                  >
                    Hire an operator like Alyssa
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </a>
              </motion.div>
            </div>

            {/* Right: editorial cover image */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.12, ease: "easeOut" }}
              className="relative overflow-hidden rounded-[32px] border border-[#e2e6f6] bg-[#f8f9ff] shadow-[0_20px_70px_rgba(31,42,89,0.08)]"
            >
              <div className="aspect-[4/3] w-full overflow-hidden">
                <img
                  src={aprilIssue.image}
                  alt="Editorial cover — Alyssa Mendoza"
                  className="h-full w-full object-cover object-[center_24%]"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-[#060816]/45 via-transparent to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.24em] text-white/70">Feature</div>
                  <p className="mt-2 max-w-[260px] text-sm leading-6 text-white">
                    A story of discipline, calm, and world-class execution.
                  </p>
                </div>
                <div className="hidden rounded-full border border-white/20 bg-white/15 px-4 py-2 text-xs uppercase tracking-[0.18em] text-white backdrop-blur sm:block">
                  {aprilIssue.date}
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── Core Value Ambassadors ── */}
        <section className="mx-auto max-w-7xl px-6 py-12 sm:px-8 lg:px-10 lg:py-16">
          <SectionHeading
            eyebrow="Core values ambassadors"
            title="Six people. Six values. Daily proof of what the company stands for."
            body="Culture isn't what gets printed on the wall. It's what people do when no one's watching. These six operators are how we know our values are real."
          />

          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {coreValueAmbassadors.map((item, i) => {
              const Icon = item.icon;
              const featured = i === 0 || i === 3;
              return (
                <motion.div
                  key={item.value}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ delay: i * 0.05 }}
                  className={
                    featured
                      ? "md:col-span-2 xl:col-span-2"
                      : "md:col-span-1 xl:col-span-1"
                  }
                >
                  <Card
                    className={`group h-full rounded-[28px] border transition-all duration-300 hover:-translate-y-1 ${
                      featured
                        ? "border-[#d9def5] bg-[linear-gradient(135deg,#ffffff_0%,#f7f8ff_45%,#eef1ff_100%)] shadow-[0_18px_55px_rgba(25,34,74,0.08)] hover:shadow-[0_24px_70px_rgba(25,34,74,0.12)]"
                        : "border-[#e5e8f5] bg-white shadow-[0_12px_40px_rgba(25,34,74,0.05)] hover:shadow-[0_18px_55px_rgba(25,34,74,0.09)]"
                    }`}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-[11px] uppercase tracking-[0.22em] text-[#6c7397]">
                            Core value
                          </div>
                          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[#171c35]">
                            {item.value}
                          </h3>
                        </div>
                        <div
                          className={`rounded-2xl p-3 ${
                            featured
                              ? "bg-[#474ead] text-white"
                              : "bg-[#eef1ff] text-[#474ead]"
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                      </div>

                      <div
                        className={`mt-6 grid gap-4 rounded-[22px] border p-5 ${
                          featured
                            ? "border-[#d8def6] bg-white/80 sm:grid-cols-[150px_1fr]"
                            : "border-[#d5daf0] bg-[#fafbff] sm:grid-cols-[96px_1fr] sm:items-center"
                        }`}
                      >
                        {/* Avatar — portrait photo with initials fallback */}
                        <div
                          className={`overflow-hidden rounded-[18px] transition-transform duration-300 group-hover:scale-[1.02] ${
                            featured
                              ? "h-[170px] w-full"
                              : "h-24 w-24"
                          }`}
                        >
                          <img
                            src={item.photo}
                            alt={item.name}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              const target = e.currentTarget as HTMLImageElement;
                              target.style.display = "none";
                              const parent = target.parentElement;
                              if (parent) {
                                parent.style.background = item.avatarBg;
                                parent.style.display = "flex";
                                parent.style.alignItems = "center";
                                parent.style.justifyContent = "center";
                                const span = document.createElement("span");
                                span.textContent = item.initials;
                                span.style.color = "#fff";
                                span.style.fontWeight = "600";
                                span.style.fontSize = "1.25rem";
                                span.style.letterSpacing = "0.05em";
                                parent.appendChild(span);
                              }
                            }}
                          />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-[#222947]">{item.name}</div>
                          <div className="mt-1 text-sm text-[#687093]">{item.role}</div>
                          {featured ? (
                            <div className="mt-3 inline-flex rounded-full border border-[#dde2f6] bg-[#f7f8ff] px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-[#667093]">
                              Featured ambassador
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <p className="mt-5 text-sm leading-7 text-[#5f6685]">{item.note}</p>

                      <div
                        className={`mt-5 rounded-[20px] border p-4 ${
                          featured
                            ? "border-[#d9def5] bg-white/85"
                            : "border-[#e7eaf6] bg-[#f8f9ff]"
                        }`}
                      >
                        <div className="text-[10px] uppercase tracking-[0.22em] text-[#7880a5]">
                          Ambassador quote
                        </div>
                        <p className="mt-2 text-base leading-7 text-[#232845]">"{item.quote}"</p>
                      </div>

                      <div className="mt-4 border-t border-[#ebeef8] pt-4">
                        <div className="text-[10px] uppercase tracking-[0.22em] text-[#7880a5]">
                          How they live this value
                        </div>
                        <p className="mt-2 text-sm leading-7 text-[#5f6685]">{item.story}</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* ── Lead Capture Band ── */}
        <section className="mx-auto max-w-7xl px-6 py-4 sm:px-8 lg:px-10">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            className="rounded-[28px] border border-[#c8cef0] bg-gradient-to-br from-[#474ead] via-[#3d4499] to-[#3040a0] p-8 shadow-[0_16px_50px_rgba(71,78,173,0.22)] sm:p-10"
          >
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  Want operators like these on your team?
                </h2>
                <p className="mt-3 max-w-xl text-base leading-7 text-white/75">
                  Tell us what you're trying to get back — hours, quality, your weekends — and we'll show you what's possible.
                </p>
              </div>

              <div className="min-w-0 lg:min-w-[340px]">
                {captureSubmitted ? (
                  <div className="flex items-center gap-3 rounded-[18px] border border-white/20 bg-white/10 px-5 py-4 backdrop-blur">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20">
                      <Mail className="h-4 w-4 text-white" />
                    </div>
                    <p className="text-sm leading-6 text-white">
                      Thanks — we'll reach out shortly. Most founders hear back within one business day.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleCaptureSubmit} className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="Work email"
                        value={captureEmail}
                        onChange={(e) => setCaptureEmail(e.target.value)}
                        required
                        className="h-11 flex-1 rounded-full border-white/25 bg-white/10 text-white placeholder:text-white/50 focus-visible:ring-white/30"
                      />
                      <Button
                        type="submit"
                        className="h-11 shrink-0 rounded-full bg-white px-5 text-[#3d4499] hover:bg-white/90"
                      >
                        Get matched
                        <ArrowRight className="ml-1.5 h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-center text-xs text-white/55">
                      Most founders hear back within one business day.
                    </p>
                  </form>
                )}
              </div>
            </div>
          </motion.div>
        </section>

        {/* ── Magazine Stories ── */}
        <section className="mx-auto max-w-7xl px-6 py-12 sm:px-8 lg:px-10 lg:py-16">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <SectionHeading
              eyebrow="Magazine stories"
              title="The stories behind the standard."
              body="How real teams run with calm, speed, and leverage. Drawn from the operators, founders, and clients we work with every week."
            />
            <div className="flex flex-wrap gap-2">
              {filters.map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`rounded-full border px-4 py-2 text-sm transition-all ${
                    activeFilter === filter
                      ? "border-[#474ead] bg-[#474ead] text-white shadow-[0_8px_24px_rgba(71,78,173,0.18)]"
                      : "border-[#e2e5f5] bg-white text-[#626a8e] hover:bg-[#f7f8ff]"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {filteredStories.map((story) => (
              <StoryCard key={story.title} story={story} />
            ))}
          </div>
        </section>

        {/* ── Amazing Clients ── */}
        <section className="mx-auto max-w-7xl px-6 py-12 sm:px-8 lg:px-10 lg:py-16">
          <div className="overflow-hidden rounded-[34px] border border-[#e5e8f5] bg-white shadow-[0_18px_70px_rgba(31,42,89,0.07)]">
            <div className="grid lg:grid-cols-[0.95fr_1.05fr]">
              {/* Left: heading + editorial */}
              <div className="border-b border-[#eceef8] bg-gradient-to-br from-[#f7f8ff] via-white to-[#f0f3ff] px-6 py-10 sm:px-10 lg:border-b-0 lg:border-r lg:py-12">
                <SectionHeading
                  eyebrow="Amazing clients"
                  title="The clients deserve the spotlight too."
                  body="Behind every system we run is a founder who decided to stop drowning. These are some of their stories."
                />
                <div className="mt-8 rounded-[24px] border border-[#e6e9f5] bg-white p-6">
                  <p className="text-base leading-8 text-[#4e5679]">
                    We don't list logos. We tell what changed. Calm replaced chaos. Hours came back. Quality stopped depending on whether the founder was awake. These are the operators and teams who made that shift with OnSpot.
                  </p>
                  <a href="/hire-talent">
                    <Button className="mt-6 h-11 rounded-full bg-[#474ead] px-5 text-white hover:bg-[#3f469d]">
                      Explore client stories
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </a>
                </div>
              </div>

              {/* Right: client quote cards */}
              <div className="grid gap-4 px-6 py-8 sm:px-10 sm:py-10">
                {amazingClients.map((client, i) => (
                  <motion.div
                    key={client.name}
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.25 }}
                    transition={{ delay: i * 0.06 }}
                    className="rounded-[26px] border border-[#e6e9f5] bg-[#fcfcff] p-6"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.22em] text-[#6d7498]">
                          {client.type}
                        </div>
                        <div className="mt-1 text-xl font-semibold text-[#171c35]">
                          {client.name}
                        </div>
                        <div className="mt-0.5 text-sm text-[#8892b0]">{client.details}</div>
                      </div>
                      <div className="rounded-full bg-[#eef1ff] p-2 text-[#474ead]">
                        <Quote className="h-4 w-4" />
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-7 text-[#5d6587]">"{client.quote}"</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Conversion Closing Section ── */}
        <motion.section
          style={{ y: chapterY }}
          className="relative z-10 mx-auto max-w-7xl px-6 pb-24 pt-8 sm:px-8 lg:px-10 lg:pb-28"
        >
          <div className="rounded-[34px] border border-[#1f2340] bg-gradient-to-br from-[#060816] via-[#0b1022] to-[#060816] p-8 shadow-[0_16px_60px_rgba(0,0,0,0.6)] sm:p-10 lg:p-12">
            <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white/60">
                  <Sparkles className="h-3.5 w-3.5" />
                  This is the standard
                </div>
                <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  This is the standard of people you get.
                </h2>
                <p className="mt-5 max-w-xl text-base leading-7 text-white/70">
                  Every operator we place is hired, trained, and held to the bar you've just read about. If you want a team like this behind your business, let's talk about what you need.
                </p>
                <div className="mt-8 flex flex-wrap gap-4">
                  <a href="/hire-talent">
                    <Button className="h-12 rounded-full bg-white px-7 text-[#1a1f40] hover:bg-white/90">
                      Book a 20-minute call
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </a>
                  <a href="/hire-talent">
                    <Button
                      variant="outline"
                      className="h-12 rounded-full border-white/20 bg-white/5 px-7 text-white hover:bg-white/10"
                    >
                      See who's available now
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </a>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  {
                    title: "Hired to your standard",
                    body: "Every operator goes through OnSpot's sourcing, assessment, and onboarding before they touch your work.",
                  },
                  {
                    title: "Trained on your systems",
                    body: "We don't drop people into chaos. We set up the playbook so quality is consistent from day one.",
                  },
                  {
                    title: "Held to a real bar",
                    body: "Performance is tracked, reviewed, and raised — not left to drift after the first week.",
                  },
                  {
                    title: "Backed by a team",
                    body: "You get the operator and the infrastructure that makes them dependable over time.",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="rounded-[24px] border border-white/10 bg-white/8 p-5 backdrop-blur"
                    style={{ background: "rgba(255,255,255,0.06)" }}
                  >
                    <div className="text-sm font-medium text-white">{item.title}</div>
                    <div className="mt-2 text-sm leading-6 text-white/65">{item.body}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.section>
      </main>
    </div>
  );
}
