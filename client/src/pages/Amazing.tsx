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
  Phone,
  MapPinIcon,
  Linkedin,
  Facebook,
  Instagram,
  ChevronDown,
  TrendingUp,
  CheckCircle2,
  Clock,
  Globe,
  SlidersHorizontal,
  User,
  Bot,
} from "lucide-react";
import { SiX, SiThreads, SiTiktok, SiYoutube } from "react-icons/si";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { HeadSEO } from "@/components/HeadSEO";

import onspotLogoCropped from "@assets/onspot-logo-cropped.png";

import FlashLogo from "../assets/logos/Flash.png";
import FutureEVLogo from "../assets/logos/FutureEV.png";
import IPSLogo from "../assets/logos/IPS.png";
import PinetechLogo from "../assets/logos/Pinetech.png";
import SafewayLogo from "../assets/logos/Safeway.png";
import VertexLogo from "../assets/logos/Vertex.png";

import CollaborationThatScales from "@assets/Collaboration-that-scales_1780059195131.png";
import ExecutiveSupport from "@assets/Executive_Support_1780638507560.png";
import AlwaysConnected from "@assets/Always_Connected_1780638514689.png";
import FutureOfWork from "@assets/Built_for_the_future_of_work_1780638559714.png";
import FocusedExpertise from "@assets/Focused_expertise_1780638559714.png";
import EngineeringTalent from "@assets/Engineering_talent_1780638559714.png";
import AlignedEveryDay from "@assets/Aligned,_every_day_1780638559713.png";
import WinningTogether from "@assets/winning_together_1780638637254.png";
import CultureFirst from "@assets/Culture_first_1780638648875.png";

import NurLamineroPhoto from "@assets/Nur_1780574815788.png";
import JakeWainbergPhoto from "@assets/Jake_1780574815787.png";
import MarkApostolPhoto from "@assets/Macky_1780574815788.png";
import RenierMacalinoPhoto from "@assets/REN_1780657869137.png";
import JaelAtendidoPhoto from "@assets/Jael_1780909035045.png";
import ChristopherAlbaPhoto from "@assets/Christopher_Alba_1774264095055.jpg";
import ShaneRubioPhoto from "@assets/Shane_1780657863305.png";
import RachelCastroPhoto from "@assets/Rachel_Caztro_1774264095056.jpg";
import JenniferDizonPhoto from "@assets/Jennifer_Dizon_1774430604160.jpg";
import MarielTolentinoPhoto from "@assets/Mariel_Tolentino_1781014693257.png";
import MelissaRayosPhoto from "@assets/Melissa_Nicka_Mae_Rayos_-_Talent_Acquisition_Specialist_1781015117632.png";

const trustedBrands = [
  { name: "Flash Justice", logo: FlashLogo },
  { name: "Future Motors EV", logo: FutureEVLogo },
  { name: "IPS by Meest", logo: IPSLogo },
  { name: "Pinetech", logo: PinetechLogo },
  { name: "Safeway Moving", logo: SafewayLogo },
  { name: "Vertex Education", logo: VertexLogo },
];

function TrustedLogos() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(5);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startAutoPlay = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (!isPaused) {
        setCurrentIndex((prev) => (prev + 1) % trustedBrands.length);
      }
    }, 2500);
  };

  const visibleBrands = Array.from(
    { length: visibleCount },
    (_, i) => trustedBrands[(currentIndex + i) % trustedBrands.length]
  );

  return (
    <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 lg:gap-12">
      {visibleBrands.map((brand) => (
        <div
          key={brand.name}
          className="flex items-center justify-center opacity-60 grayscale transition hover:opacity-100 hover:grayscale-0"
        >
          <img
            src={brand.logo}
            alt={brand.name}
            className="h-8 w-auto object-contain sm:h-10"
          />
        </div>
      ))}
    </div>
  );
}

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
  const [expandedFooterSection, setExpandedFooterSection] = useState<string | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);

  const toggleFooterSection = (section: string) => {
    setExpandedFooterSection((prev) => (prev === section ? null : section));
  };
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

        {/* ── Stats strip ── */}
        <div className="relative w-full border-y border-slate-200 bg-[#F1F2F6]">
          <div className="mx-auto grid max-w-[1600px] grid-cols-2 divide-y divide-slate-200 md:grid-cols-4 md:divide-x md:divide-y-0 xl:grid-cols-[repeat(4,1fr)_auto]">
            {[
              { value: "72hrs", label: "AVG. TIME TO HIRE" },
              { value: "200+", label: "GLOBAL CLIENTS SERVED" },
              { value: "60%", label: "CLIENT COST SAVINGS" },
              { value: "2,000+", label: "TALENTS MATCHED" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="flex min-h-[120px] flex-col items-center justify-center px-6 py-7 text-center"
              >
                <span className="text-4xl font-bold tracking-tight text-[#3F4698] sm:text-5xl">
                  {stat.value}
                </span>
                <span className="mt-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  {stat.label}
                </span>
              </div>
            ))}
            <div className="col-span-2 flex items-center justify-center border-t border-slate-200 px-6 py-5 md:col-span-4 md:border-l-0 md:border-t xl:col-span-1 xl:border-l xl:border-t-0">
              <a
                href="/value-calculator"
                className="inline-flex h-[64px] min-w-[260px] w-full items-center justify-center gap-3 whitespace-nowrap rounded-[14px] border border-[#D9DDEB] bg-[#EEF0F8] px-8 text-[17px] font-semibold text-[#40499D] shadow-[0_6px_16px_rgba(63,73,157,0.12)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#E3E6F2] hover:shadow-[0_8px_18px_rgba(63,73,157,0.16)] focus:outline-none focus:ring-2 focus:ring-[#40499D]/25 focus:ring-offset-2 sm:w-auto"
              >
                <ArrowRight className="h-4 w-4" />
                Calculate your Savings
              </a>
            </div>
          </div>
        </div>

        {/* ── Featured Insights ── */}
        <section className="relative bg-[#F5F7FC] px-6 py-20 sm:py-24 lg:py-28">
          <div className="mx-auto max-w-[1320px]">
            <div className="rounded-[40px] bg-gradient-to-br from-[#4B4FC4] via-[#3568E8] to-[#13B8C8] p-8 shadow-[0_28px_90px_rgba(44,63,170,0.22)] sm:p-10 lg:p-12">
              <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.32em] text-white/65">
                    Insights
                  </p>
                  <h2 className="max-w-[640px] text-[clamp(32px,4vw,56px)] font-bold leading-[0.96] tracking-[-0.055em] text-white">
                    Ideas worth sharing.
                  </h2>
                  <p className="mt-4 max-w-[540px] text-[15px] leading-relaxed text-white/75">
                    Perspectives on customer experience, global talent, and the future of work.
                  </p>
                </div>
                <div className="shrink-0">
                  <Link
                    href="/insights"
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/30 bg-white/12 px-6 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
                  >
                    Explore all →
                  </Link>
                </div>
              </div>
              <div className="grid gap-5 lg:grid-cols-3">
                {[
                  { slug: "checklist-winning-virtual-interviews", category: "INDUSTRY TRENDS", title: "Checklist for Winning Virtual Interviews", readTime: "5 min read" },
                  { slug: "leveraging-ghanas-tech-talent-philippines-customer-service", category: "GLOBAL OUTSOURCING", title: "Leveraging Ghana's Tech Talent and the World-Class Customer Service of the Philippines", readTime: "5 min read" },
                  { slug: "ghana-software-development-outsourcing-goldmine", category: "TECHNOLOGY", title: "Ghana's Software Development Capabilities: An Untapped Goldmine for Outsourcing", readTime: "4 min read" },
                ].map((post) => (
                  <a
                    key={post.slug}
                    href={`/insights/${post.slug}`}
                    className="group flex min-h-[230px] flex-col justify-between rounded-[28px] border border-white/20 bg-white/14 p-7 text-white backdrop-blur-md transition hover:-translate-y-1 hover:bg-white/20 hover:shadow-[0_22px_60px_rgba(0,0,0,0.18)]"
                  >
                    <div>
                      <p className="mb-6 text-xs font-bold uppercase tracking-[0.22em] text-white/70">{post.category}</p>
                      <h3 className="text-[24px] font-bold leading-[1.12] tracking-[-0.025em] text-white">{post.title}</h3>
                    </div>
                    <div className="mt-8 flex items-center justify-between">
                      <span className="text-sm font-medium text-white/75">{post.readTime}</span>
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/16 text-white transition group-hover:bg-white group-hover:text-[#4B4FC4]">→</span>
                    </div>
                  </a>
                ))}
              </div>
              <div className="mt-10 flex justify-center">
                <Link
                  href="/lead-intake"
                  className="inline-flex h-14 items-center justify-center gap-3 rounded-full bg-white px-8 text-base font-bold text-[#3F46A8] shadow-[0_18px_45px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(0,0,0,0.22)]"
                >
                  Talk to an Expert →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── Work Differently ── */}
        <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.28),transparent_34%),linear-gradient(135deg,#151632_0%,#232B74_52%,#11142B_100%)] px-6 py-12 text-white sm:py-14 lg:py-16">
          <div className="container relative z-10 mx-auto px-4 sm:px-6">
            <div className="mx-auto max-w-[1120px] text-center mb-10">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.34em] text-white/60">Work Differently</p>
              <h2 className="mx-auto max-w-[1100px] text-center text-[clamp(28px,3.4vw,50px)] font-bold leading-[1.04] tracking-[-0.05em] text-white">
                <span className="block lg:whitespace-nowrap">Whether you're scaling a team or growing a career</span>
                <span className="mt-1 block lg:whitespace-nowrap">— OnSpot is built for both sides of{" "}
                  <span className="bg-gradient-to-r from-[#AFA8FF] via-[#8B7CFF] to-[#5AA7FF] bg-clip-text text-transparent">great work.</span>
                </span>
              </h2>
            </div>
            <div className="mx-auto mt-8 grid max-w-[1040px] items-stretch gap-5 lg:grid-cols-2">
              <article className="relative flex h-full flex-col overflow-hidden rounded-[26px] border border-white/16 bg-[linear-gradient(135deg,#303276_0%,#3266B4_58%,#1D9CC2_100%)] p-6 text-white shadow-[0_22px_60px_rgba(0,0,0,0.22)] sm:p-7">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.10),transparent_34%)]" />
                <div className="relative z-10 flex h-full flex-col">
                  <div className="min-h-[145px]">
                    <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.24em] text-white/70">For Companies</p>
                    <h3 className="max-w-[440px] text-[clamp(26px,2.5vw,36px)] font-bold leading-[1.02] tracking-[-0.045em] text-white">Hire faster. Spend less.</h3>
                    <p className="mt-3 max-w-[480px] text-[15px] font-semibold leading-relaxed text-white/80">Build your team with direct access, flexible engagement models, and talent matched around how your work actually runs.</p>
                  </div>
                  <div className="mt-5 grid gap-2.5">
                    {[
                      { icon: <Zap className="h-5 w-5" strokeWidth={2.2} />, title: "Hire in days", sub: "72-hour match average" },
                      { icon: <SlidersHorizontal className="h-5 w-5" strokeWidth={2.2} />, title: "Hire your way", sub: "Contract, project, full-time" },
                      { icon: <Users className="h-5 w-5" strokeWidth={2.2} />, title: "No middlemen", sub: "Direct access, zero markups" },
                      { icon: <Globe className="h-5 w-5" strokeWidth={2.2} />, title: "50+ countries", sub: "Global reach, local expertise" },
                    ].map((item) => (
                      <div key={item.title} className="grid min-h-[72px] grid-cols-[38px_1fr] items-center gap-3 rounded-[18px] border border-white/16 bg-white/10 px-4 py-3 backdrop-blur">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/12 text-[#6EF3F1]">{item.icon}</div>
                        <div className="min-w-0">
                          <h4 className="text-[15px] font-bold leading-tight text-white">{item.title}</h4>
                          <p className="mt-0.5 text-[13px] leading-snug text-white/68">{item.sub}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-auto flex justify-center pt-5">
                    <Link href="/hire-talent" className="inline-flex h-11 min-w-[210px] items-center justify-center gap-2 rounded-full bg-white px-5 text-[13px] font-bold text-[#2E3FA8] shadow-[0_12px_28px_rgba(0,0,0,0.16)] transition hover:-translate-y-0.5">
                      Find the right talent →
                    </Link>
                  </div>
                </div>
              </article>
              <article className="relative flex h-full flex-col overflow-hidden rounded-[26px] border border-white/16 bg-[linear-gradient(135deg,#392B77_0%,#6642D6_52%,#319DB0_100%)] p-6 text-white shadow-[0_22px_60px_rgba(0,0,0,0.22)] sm:p-7">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.10),transparent_34%)]" />
                <div className="relative z-10 flex h-full flex-col">
                  <div className="min-h-[145px]">
                    <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.24em] text-white/70">For Professionals</p>
                    <h3 className="max-w-[440px] text-[clamp(26px,2.5vw,36px)] font-bold leading-[1.02] tracking-[-0.045em] text-white">Real work. Real growth.</h3>
                    <p className="mt-3 max-w-[480px] text-[15px] font-semibold leading-relaxed text-white/80">Get matched with quality opportunities, steady pipelines, and flexible work that respects your terms.</p>
                  </div>
                  <div className="mt-5 grid gap-2.5">
                    {[
                      { icon: <TrendingUp className="h-5 w-5" strokeWidth={2.2} />, title: "Steady pipeline", sub: "No gaps, no chasing" },
                      { icon: <Star className="h-5 w-5" strokeWidth={2.2} />, title: "Top global brands", sub: "Builds your reputation fast" },
                      { icon: <Clock className="h-5 w-5" strokeWidth={2.2} />, title: "Your terms", sub: "Remote, flexible schedule" },
                      { icon: <CheckCircle2 className="h-5 w-5" strokeWidth={2.2} />, title: "Zero gatekeeping", sub: "Pure merit, open access" },
                    ].map((item) => (
                      <div key={item.title} className="grid min-h-[72px] grid-cols-[38px_1fr] items-center gap-3 rounded-[18px] border border-white/16 bg-white/10 px-4 py-3 backdrop-blur">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/12 text-[#D7C9FF]">{item.icon}</div>
                        <div className="min-w-0">
                          <h4 className="text-[15px] font-bold leading-tight text-white">{item.title}</h4>
                          <p className="mt-0.5 text-[13px] leading-snug text-white/68">{item.sub}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-auto flex justify-center pt-5">
                    <Link href="/find-best-matches" className="inline-flex h-11 min-w-[210px] items-center justify-center gap-2 rounded-full bg-white px-5 text-[13px] font-bold text-[#4B35A8] shadow-[0_12px_28px_rgba(0,0,0,0.16)] transition hover:-translate-y-0.5">
                      Find your next opportunity →
                    </Link>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* ── Trusted By ── */}
        <div className="relative bg-[#F5F7FC] pt-20 pb-20 sm:pt-24 sm:pb-24 lg:pt-28 lg:pb-28">
          <div className="container mx-auto px-4 sm:px-6 relative z-10">
            <div className="text-center space-y-10 sm:space-y-14">
              <h2 className="mx-auto font-medium leading-[1.12] tracking-[-0.035em] text-slate-900 text-[clamp(30px,3vw,48px)]" style={{ textWrap: "balance", maxWidth: "58ch" }}>
                Trusted by global brands, hundreds of entrepreneurs, and thousands of professionals worldwide.
              </h2>
              <TrustedLogos />
              <div className="flex justify-center">
                <a href="/find-best-matches" className="inline-flex items-center justify-center gap-2 rounded-full border border-violet-300 bg-white/80 px-7 py-3.5 text-base font-semibold text-violet-700 shadow-sm backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-violet-50 hover:shadow-md">
                  Join 100+ companies hiring with OnSpot
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* ── Superhuman Network ── */}
        <div className="relative overflow-hidden bg-[#17152E] py-14 text-white sm:py-16 lg:py-20">
          <div className="pointer-events-none absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-[#3F4698]/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-10 h-64 w-64 rounded-full bg-[#3F4698]/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 right-10 h-64 w-64 rounded-full bg-violet-700/10 blur-3xl" />
          <div className="relative z-10 px-4 text-center">
            <h2 className="mx-auto mt-5 max-w-[900px] px-6 text-center font-bold leading-[0.98] tracking-[-0.055em] text-white text-[clamp(36px,4.4vw,62px)]">
              <span className="block">Real people. Real work.</span>
              <span className="mt-1 block text-[#AAA8FF]">Real impact.</span>
            </h2>
          </div>
          <div className="relative z-10 mx-auto mt-8 grid max-w-[1180px] grid-cols-2 gap-1.5 px-4 [grid-auto-rows:118px] md:grid-cols-12 md:[grid-auto-rows:138px] lg:[grid-auto-rows:155px]">
            {[
              { src: CollaborationThatScales, alt: "Collaboration that scales", cls: "col-span-2 row-span-2 md:col-span-6 md:row-span-2" },
              { src: ExecutiveSupport, alt: "Executive Support", cls: "md:col-span-3" },
              { src: AlwaysConnected, alt: "Always Connected", cls: "md:col-span-3" },
              { src: FutureOfWork, alt: "Built for the future of work", cls: "md:col-span-3" },
              { src: FocusedExpertise, alt: "Focused expertise", cls: "md:col-span-3" },
              { src: EngineeringTalent, alt: "Engineering talent", cls: "md:col-span-3" },
              { src: AlignedEveryDay, alt: "Aligned, every day", cls: "md:col-span-3" },
              { src: WinningTogether, alt: "Winning together", cls: "md:col-span-3" },
              { src: CultureFirst, alt: "Culture first", cls: "md:col-span-3" },
            ].map((tile) => (
              <div key={tile.alt} className={`group relative overflow-hidden bg-slate-800 ${tile.cls}`}>
                <img src={tile.src} alt={tile.alt} loading="lazy" decoding="async" className="h-full w-full object-cover object-center transition duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#17152E]/55 via-[#17152E]/10 to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-80" />
                <div className="absolute bottom-3 left-3 z-20 translate-y-2 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white opacity-0 backdrop-blur-md transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">{tile.alt}</div>
              </div>
            ))}
          </div>
          <p className="relative z-10 mx-auto mt-7 max-w-[900px] px-6 text-center text-[clamp(17px,1.35vw,22px)] font-semibold leading-snug text-white/62">
            Behind every workflow is a <span className="text-white">real person</span> making the work better.
          </p>
          <div className="relative z-10 mt-5 flex justify-center">
            <a href="/about" className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#7C4DFF] to-[#5B5CF6] px-6 text-sm font-bold text-white shadow-[0_16px_38px_rgba(91,92,246,0.28)] transition hover:-translate-y-0.5">
              Meet the people behind the work →
            </a>
          </div>
        </div>

        {/* ── Transformation Stories ── */}
        <div className="relative overflow-hidden bg-[#F6F7FB] py-14 sm:py-16 lg:py-20">
          <div className="pointer-events-none absolute -top-32 right-0 h-96 w-96 rounded-full bg-indigo-400/8 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-80 w-80 rounded-full bg-violet-400/6 blur-3xl" />
          <div className="container relative z-10 mx-auto px-4 sm:px-6">
            <div className="mb-8 mx-auto w-full max-w-[1500px] px-0">
              <p className="text-[13px] font-bold uppercase tracking-[0.28em] text-[#4B46C8]">Transformations</p>
              <h2 className="mt-3 max-w-[1000px] text-[clamp(40px,5vw,72px)] font-semibold tracking-[-0.045em] leading-[0.98] text-slate-950">
                Real change. <span className="text-[#4B46C8]">Real results.</span>
              </h2>
              <p className="mt-4 max-w-[720px] text-[clamp(16px,1.5vw,20px)] leading-[1.35] text-[#536077]">
                See how OnSpot helps teams move from overloaded operations to intelligent, scalable outsourcing partnerships.
              </p>
            </div>
            <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_0.95fr] lg:items-stretch">
              <div className="relative flex h-full flex-col overflow-hidden rounded-[28px] border border-indigo-200/70 bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-900 p-7 shadow-[0_20px_60px_rgba(49,46,129,0.22)] lg:p-8">
                <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-indigo-400/20 blur-3xl" />
                <div className="pointer-events-none absolute -left-16 bottom-0 h-56 w-56 rounded-full bg-violet-400/15 blur-3xl" />
                <span className="pointer-events-none absolute right-8 top-4 select-none font-serif text-[120px] leading-none text-white/10">&#8220;</span>
                <div className="relative flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/20"><User className="h-6 w-6" /></div>
                    <div>
                      <p className="text-base font-semibold text-white">Elad B.</p>
                      <p className="mt-0.5 text-sm text-white/65">CEO / Founder, PineTech</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/15">
                    <Zap className="h-3.5 w-3.5" />40% time saved
                  </span>
                </div>
                <div className="relative mt-7">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Before</p>
                  <h3 className="mt-1 text-2xl font-semibold leading-snug text-white sm:text-3xl">12-Hour Workdays</h3>
                  <div className="my-3 flex items-center gap-3">
                    <span className="h-px flex-1 bg-white/20" />
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/15">transformed into</span>
                    <span className="h-px flex-1 bg-white/20" />
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">After</p>
                  <h3 className="mt-1 text-2xl font-semibold italic leading-snug text-violet-200 sm:text-3xl">Automated Excellence</h3>
                </div>
                <p className="relative mt-4 text-base leading-relaxed text-white/75">"The professionalism and consistency of the OnSpot team. Communication is always clear, and the structured daily and weekly updates make it simple to stay aligned."</p>
                <div className="mt-auto pt-5">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-white/85 ring-1 ring-white/15">
                    <TrendingUp className="h-3 w-3" />Client transformation
                  </div>
                </div>
              </div>
              <div className="grid gap-5">
                {[
                  { name: "Eric M.", role: "Operations Director, Flash Justice", metric: "3 weeks to full team", before: "Scattered Processes", after: "Seamless Orchestration", quote: "I've worked with several outsourcing companies, but none delivered like OnSpot. Shane and Ria helped me build my team, stayed involved, and ensured success. I finally feel like I'm working with a true partner." },
                  { name: "Fernando C.", role: "CTO, Pinetech", metric: "24/7 coverage", before: "Constant Firefighting", after: "Proactive Innovation", quote: "OnSpot's team is professional, responsive, and reliable — always going above and beyond. The efficiency and consistency they deliver gives me complete confidence." },
                ].map((story) => (
                  <div key={story.name} className="group relative flex flex-col overflow-hidden rounded-[26px] border border-white/70 bg-white/75 p-6 shadow-[0_14px_50px_rgba(80,80,180,0.09)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_70px_rgba(80,80,180,0.14)] lg:p-7">
                    <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-[1.75rem] bg-gradient-to-r from-indigo-500/70 via-violet-400/70 to-cyan-300/70" />
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100"><User className="h-4 w-4" /></div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{story.name}</p>
                          <p className="text-xs text-slate-500">{story.role}</p>
                        </div>
                      </div>
                      <span className="inline-flex items-center rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200/70">{story.metric}</span>
                    </div>
                    <h3 className="mt-4 text-[clamp(19px,2vw,26px)] font-semibold leading-snug text-slate-950">
                      From <span className="text-slate-700">{story.before}</span>
                      <span className="mx-2 text-indigo-400"><ArrowRight className="inline h-4 w-4" /></span>
                      <span className="italic text-indigo-700">{story.after}</span>
                    </h3>
                    <p className="mt-3 flex-1 text-[15px] leading-relaxed text-slate-600">"{story.quote}"</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-8 flex justify-center">
              <a href="/hire-talent" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-700 to-violet-600 px-7 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(67,56,202,0.25)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(67,56,202,0.35)]">
                <Sparkles className="h-4 w-4" />Start your transformation
              </a>
            </div>
          </div>
        </div>

        {/* ── The Why / Origin Story ── */}
        <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.24),transparent_34%),linear-gradient(135deg,#11142B_0%,#1D2360_48%,#151632_100%)] px-6 py-12 text-white sm:py-14 lg:py-16">
          <div className="pointer-events-none absolute right-[-12%] top-[-20%] h-[420px] w-[420px] rounded-full bg-[#2F7CF6]/20 blur-[90px]" />
          <div className="relative z-10 mx-auto grid max-w-[1120px] gap-7 lg:grid-cols-[0.68fr_1.32fr] lg:items-start">
            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.30em] text-[#AFA8FF]/75">The Why</p>
              <h2 className="max-w-[360px] text-[clamp(32px,3.6vw,50px)] font-bold leading-[0.98] tracking-[-0.055em] text-white">
                OnSpot started<br />from a real<br />problem.
              </h2>
            </div>
            <div className="rounded-[28px] border border-white/18 bg-white/[0.08] p-6 shadow-[0_22px_62px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:p-7 lg:p-8">
              <h3 className="max-w-[760px] text-[clamp(24px,2.45vw,36px)] font-bold leading-[1.04] tracking-[-0.045em] text-white">
                <span className="block">Our founders were building businesses</span>
                <span className="mt-1 block text-white/88">and ran into the same wall most operators hit:</span>
                <span className="mt-2 block max-w-[720px] bg-gradient-to-r from-[#B9B6FF] via-[#8EA2FF] to-[#6ED8F6] bg-clip-text text-transparent">growth was possible, but operations were becoming the bottleneck.</span>
              </h3>
              <div className="mt-5 max-w-[800px] space-y-3 text-[clamp(14px,1.12vw,16.5px)] leading-[1.55] text-white/76">
                <p><span className="font-semibold text-white">Hiring took too long.</span> <span className="font-semibold text-white">Costs kept rising.</span> <span className="font-semibold text-white">Teams became harder to manage.</span> Founder time was being consumed by work that should have been systemized.</p>
                <p>So instead of accepting that as normal, <span className="font-semibold text-white">they built a better way.</span> What began as an internal solution became a company built to help other businesses scale with <span className="font-semibold text-white">more clarity, better people, and less friction.</span></p>
                <p>That is why OnSpot exists. Not to be another outsourcing provider, but to become a <span className="font-semibold text-white">trusted growth partner</span> for businesses that need more than manpower. They need <span className="font-semibold text-white">intelligence that removes drag</span>, <span className="font-semibold text-white">people who can lead and execute</span>, and a support system that makes <span className="font-semibold text-white">both work as one.</span></p>
              </div>
              <div className="mt-5 flex justify-start">
                <Link href="/why-onspot" className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-white px-5 text-[13px] font-bold text-[#151632] shadow-[0_12px_28px_rgba(0,0,0,0.20)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(0,0,0,0.28)]">
                  Explore How We Can Help →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── Why OnSpot / Four Pillars ── */}
        <section className="bg-[#F3F6FC] px-6 py-20 sm:py-24 lg:py-28">
          <div className="mx-auto max-w-[1320px]">
            <div className="max-w-[720px]">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.32em] text-[#4B4FC4]">Why OnSpot</p>
              <h2 className="max-w-[700px] text-[clamp(36px,4.4vw,64px)] font-bold leading-[0.96] tracking-[-0.06em] text-[#050A1F]">
                <span className="block">Not a service provider.</span>
                <span className="mt-1 block max-w-[480px] bg-gradient-to-r from-[#6B35F5] via-[#7C4DFF] to-[#3B82F6] bg-clip-text italic text-transparent">An architect.</span>
              </h2>
              <p className="mt-5 max-w-[600px] text-[clamp(15px,1.2vw,18px)] leading-[1.5] text-[#536077]">
                We design the operating layer behind modern outsourcing — combining AI-ready systems, vetted talent, and human accountability so your team can scale without losing control.
              </p>
            </div>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: <Bot className="h-6 w-6" />, label: "AI Foundation", title: "AI-first infrastructure", tagline: "Intelligent by design", body: "Every system and workflow enhanced by intelligence that amplifies human potential — not automation for its own sake.", variant: "light" as const },
                { icon: <Users className="h-6 w-6" />, label: "Human Culture", title: "Human-centered culture", tagline: "People, not resources", body: "Elite Filipino talent treated as partners. We invest in their growth because your success depends on it.", variant: "dark" as const },
                { icon: <Globe className="h-6 w-6" />, label: "Connected Workflow", title: "Connected ecosystem", tagline: "Seamless integration", body: "Your tools, your workflow, working in harmony. We don't disrupt what you've built — we elevate it.", variant: "light" as const },
                { icon: <TrendingUp className="h-6 w-6" />, label: "Scalable Model", title: "Scalable excellence", tagline: "Grow without compromise", body: "Scale from 1 to 100 without losing quality, culture, or control. Same excellence at every stage.", variant: "dark" as const },
              ].map((card) => (
                <article key={card.title} className={card.variant === "light" ? "rounded-[24px] border border-[#DCE2F2] bg-white p-6 text-[#050A1F] shadow-[0_18px_55px_rgba(45,55,105,0.08)] transition hover:-translate-y-1 hover:shadow-[0_26px_70px_rgba(45,55,105,0.12)]" : "rounded-[24px] border border-white/14 bg-[linear-gradient(135deg,#1B1D42_0%,#2D2E78_55%,#3F46A8_100%)] p-6 text-white shadow-[0_22px_65px_rgba(24,28,74,0.22)] transition hover:-translate-y-1 hover:shadow-[0_30px_80px_rgba(24,28,74,0.30)]"}>
                  <div className={card.variant === "light" ? "mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF0FF] text-[#4B4FC4] shadow-[0_10px_30px_rgba(75,79,196,0.12)]" : "mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/12 text-[#8EF3F0] shadow-[0_10px_30px_rgba(0,0,0,0.18)]"}>{card.icon}</div>
                  <p className={card.variant === "light" ? "mb-3 text-xs font-bold uppercase tracking-[0.22em] text-[#13839A]" : "mb-3 text-xs font-bold uppercase tracking-[0.22em] text-[#8EF3F0]"}>{card.label}</p>
                  <h3 className={card.variant === "light" ? "text-xl font-bold tracking-[-0.035em] text-[#050A1F]" : "text-xl font-bold tracking-[-0.035em] text-white"}>{card.title}</h3>
                  <p className={card.variant === "light" ? "mt-2 text-sm font-bold text-[#4B4FC4]" : "mt-2 text-sm font-bold text-[#B9B6FF]"}>{card.tagline}</p>
                  <p className={card.variant === "light" ? "mt-3 text-sm leading-relaxed text-[#536077]" : "mt-3 text-sm leading-relaxed text-white/72"}>{card.body}</p>
                </article>
              ))}
            </div>
            <div className="mt-10 flex justify-center">
              <Link href="#experience" className="inline-flex h-14 items-center justify-center gap-3 rounded-full bg-gradient-to-r from-[#6B35F5] to-[#2F7CF6] px-8 text-base font-bold text-white shadow-[0_18px_45px_rgba(83,68,230,0.24)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(83,68,230,0.30)]">
                See how it works →
              </Link>
            </div>
          </div>
        </section>

        {/* ── The Proof / Talent Profiles ── */}
        <div className="relative bg-white py-20 sm:py-24 lg:py-28">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="mb-12 text-center">
              <h2 className="mx-auto max-w-[960px] text-center text-[clamp(36px,4.4vw,64px)] font-bold tracking-[-0.06em] leading-[0.98] text-[#050A1F]">
                The <span className="bg-gradient-to-r from-[#6B35F5] via-[#7C4DFF] to-[#3B82F6] bg-clip-text text-transparent">People</span> Behind the Platform
              </h2>
              <p className="mx-auto mt-4 max-w-[680px] text-center text-[clamp(15px,1.3vw,18px)] leading-[1.4] text-[#536077]">
                <span className="block">Powered by professionals from the US, Philippines, and beyond.</span>
                <span className="block">The Superhuman BPO Network.</span>
              </p>
            </div>
            <div className="mx-auto mt-12 grid max-w-[1180px] grid-cols-2 gap-5 lg:grid-cols-4">
              {[
                { photo: JakeWainbergPhoto, name: "Jake Wainberg", flag: "🇺🇸", role: "Founder & President", objectPosition: "object-[center_20%]" },
                { photo: JaelAtendidoPhoto, name: "Jael Atendido", flag: "🇵🇭", role: "Executive Assistant", objectPosition: "object-[center_8%]" },
                { photo: NurLamineroPhoto, name: "Nur Laminero", flag: "🇵🇭", role: "CEO of OnSpot", objectPosition: "object-[center_25%]" },
                { photo: MarielTolentinoPhoto, name: "Mariel Tolentino", flag: "🇵🇭", role: "Content Creator", objectPosition: "object-[center_28%]" },
                { photo: MarkApostolPhoto, name: "Macky Apostol", flag: "🇵🇭", role: "Senior Recruitment Specialist", objectPosition: "object-[center_15%]" },
                { photo: RenierMacalinoPhoto, name: "Renier Macalino", flag: "🇵🇭", role: "Virtual Assistant", objectPosition: "object-[center_15%]" },
                { photo: ShaneRubioPhoto, name: "Shane Rubio", flag: "🇵🇭", role: "Client Success Manager", objectPosition: "object-[center_10%]" },
                { photo: MelissaRayosPhoto, name: "Melissa Rayos", flag: "🇵🇭", role: "Talent Acquisition Specialist", objectPosition: "object-[center_10%]" },
              ].map((person) => (
                <div key={person.name} className="group relative overflow-hidden rounded-[22px] bg-slate-100 shadow-[0_10px_32px_rgba(0,0,0,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(0,0,0,0.14)]" style={{ aspectRatio: "3/4" }}>
                  <img src={person.photo} alt={person.name} loading="lazy" decoding="async" className={`h-full w-full object-cover ${person.objectPosition} transition duration-500 group-hover:scale-[1.04]`} />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a1f]/70 via-[#0a0a1f]/18 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <p className="text-base font-bold leading-tight text-white">{person.name} {person.flag}</p>
                    <p className="mt-1 text-xs leading-snug text-white/75">{person.role}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-12 flex justify-center">
              <a href="/talent-pool" className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-[#DCE2F2] bg-white px-7 text-sm font-semibold text-[#2E3580] shadow-[0_6px_20px_rgba(45,53,128,0.10)] transition hover:-translate-y-0.5">
                Explore the Talent Pool →
              </a>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <footer className="onspot-footer relative overflow-hidden bg-[#3F4698]">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[85%] pointer-events-none">
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-b from-violet-500/10 via-blue-500/5 to-transparent blur-md"></div>
            <div className="h-px bg-gradient-to-r from-transparent via-violet-400/30 through-blue-400/30 to-transparent"></div>
          </div>

          <div className="mx-auto w-full max-w-[1500px] px-6 sm:px-8 lg:px-12 xl:px-14 2xl:px-16 py-10 sm:py-12 lg:py-14">
            <div className="grid grid-cols-1 gap-y-12 lg:grid-cols-[minmax(300px,360px)_1fr] xl:grid-cols-[minmax(320px,380px)_1fr] lg:gap-x-12 xl:gap-x-14 items-start">
              <div className="pb-8 lg:pb-0 border-b border-white/10 lg:border-b-0">
                <div className="space-y-6 sm:space-y-8 relative flex flex-col items-start transition-all duration-300">
                  <img src={onspotLogoCropped} alt="OnSpot" className="block h-auto w-[160px] sm:w-[175px] lg:w-[190px] object-contain" data-testid="footer-logo" />
                  <p className="text-xs sm:text-sm text-white/75 leading-relaxed max-w-md text-left transition-all duration-300">
                    OnSpot is the only outsourcing system built for the world that's coming—pairing AI-ready operations with world-class Philippine talent to power global businesses.
                  </p>
                </div>
                <div className="mt-8 flex flex-wrap items-center justify-start gap-3">
                  {[
                    { href: "https://www.linkedin.com/company/onspotglobal/", icon: <Linkedin className="w-5 h-5 text-white/75 group-hover:text-white group-hover:scale-110 transition-all duration-300" />, testid: "footer-linkedin" },
                    { href: "https://www.facebook.com/OnSpotGlobal", icon: <Facebook className="w-5 h-5 text-white/75 group-hover:text-white group-hover:scale-110 transition-all duration-300" />, testid: "footer-facebook" },
                    { href: "https://x.com/OnSpotTribe", icon: <SiX className="w-4 h-4 text-white/75 group-hover:text-white group-hover:scale-110 transition-all duration-300" />, testid: "footer-x" },
                    { href: "https://www.threads.com/@onspotglobal", icon: <SiThreads className="w-4 h-4 text-white/75 group-hover:text-white group-hover:scale-110 transition-all duration-300" />, testid: "footer-threads" },
                    { href: "https://www.instagram.com/onspotglobal", icon: <Instagram className="w-5 h-5 text-white/75 group-hover:text-white group-hover:scale-110 transition-all duration-300" />, testid: "footer-instagram" },
                    { href: "https://www.tiktok.com/@onspottribe", icon: <SiTiktok className="w-4 h-4 text-white/75 group-hover:text-white group-hover:scale-110 transition-all duration-300" />, testid: "footer-tiktok" },
                    { href: "https://www.youtube.com/@OnSpotGlobal", icon: <SiYoutube className="w-5 h-5 text-white/75 group-hover:text-white group-hover:scale-110 transition-all duration-300" />, testid: "footer-youtube" },
                  ].map((s) => (
                    <a key={s.testid} href={s.href} target="_blank" rel="noopener noreferrer" data-testid={s.testid} className="relative w-11 h-11 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 hover:border-white/40 hover:-translate-y-0.5 flex items-center justify-center transition-all duration-500 group">{s.icon}</a>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[0.9fr_0.95fr_1.05fr_1.35fr] gap-y-10 gap-x-8 xl:gap-x-10">
                {[
                  {
                    key: "navigation", label: "Navigation",
                    links: [
                      { href: "/hire-talent", label: "Hire Talent", testid: "footer-link-hire" },
                      { href: "/lead-intake", label: "Managed Services", testid: "footer-link-managed" },
                      { href: "/superhuman", label: "The Superhuman Project", testid: "footer-link-ai" },
                      { href: "/waitlist", label: "Join Waitlist", testid: "footer-link-waitlist" },
                      { href: "/careers", label: "Careers", testid: "footer-link-careers" },
                      { href: "/powerapp", label: "Powerapp", testid: "footer-link-powerapp" },
                      { href: "/legal-ops", label: "LegalOps NY", testid: "footer-link-legal-ops" },
                      { href: "/pricing", label: "Pricing", testid: "footer-link-pricing" },
                      { href: "/faq", label: "FAQ", testid: "footer-link-faq" },
                    ],
                  },
                  {
                    key: "company", label: "Company",
                    links: [
                      { href: "/why-onspot", label: "Why OnSpot", testid: "footer-link-why" },
                      { href: "/stories", label: "Amazing Stories", testid: "footer-link-stories" },
                      { href: "/insights", label: "Insights", testid: "footer-link-insights" },
                      { href: "/affiliate", label: "Affiliate Marketing", testid: "footer-link-affiliate" },
                      { href: "/bpo-partner", label: "BPO Partner", testid: "footer-link-bpo" },
                      { href: "/investors", label: "Investors Corner", testid: "footer-link-investors" },
                      { href: "/about", label: "About Us", testid: "footer-link-about" },
                      { href: "/operations-playbook", label: "Delivery Playbook", testid: "footer-link-playbook" },
                    ],
                  },
                ].map((col) => (
                  <div key={col.key} className="md:space-y-6 transition-all duration-300" style={{ paddingBottom: "clamp(4px, 0.6vh, 8px)" }}>
                    <button onClick={() => toggleFooterSection(col.key)} className="flex items-center justify-between w-full md:cursor-default md:!p-0 text-left" style={{ padding: "clamp(4px, 0.6vh, 8px) 0" }}>
                      <h3 className="text-sm sm:text-base font-semibold text-white tracking-wide text-left">{col.label}</h3>
                      <ChevronDown className={`w-5 h-5 text-white/60 transition-transform duration-300 md:hidden ${expandedFooterSection === col.key ? "rotate-180" : ""}`} />
                    </button>
                    <div className={`space-y-3 transition-all duration-300 md:!opacity-100 md:!max-h-none md:!block ${expandedFooterSection === col.key ? "opacity-100 max-h-96" : "opacity-0 max-h-0 overflow-hidden"}`} style={{ marginTop: expandedFooterSection === col.key || (typeof window !== "undefined" && window.innerWidth >= 768) ? "16px" : "0" }}>
                      {col.links.map((link) => (
                        <Link key={link.href} href={link.href} data-testid={link.testid} className="block text-xs sm:text-sm text-white/70 hover:text-white md:hover:translate-x-1 transition-all duration-300">{link.label}</Link>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="md:space-y-6 transition-all duration-300" style={{ paddingBottom: "clamp(4px, 0.6vh, 8px)" }}>
                  <button onClick={() => toggleFooterSection("verticals")} className="flex items-center justify-between w-full md:cursor-default md:!p-0 text-left" style={{ padding: "clamp(4px, 0.6vh, 8px) 0" }}>
                    <h3 className="text-sm sm:text-base font-semibold text-white tracking-wide text-left">New Verticals</h3>
                    <ChevronDown className={`w-5 h-5 text-white/60 transition-transform duration-300 md:hidden ${expandedFooterSection === "verticals" ? "rotate-180" : ""}`} />
                  </button>
                  <div className={`space-y-3 transition-all duration-300 md:!opacity-100 md:!max-h-none md:!block ${expandedFooterSection === "verticals" ? "opacity-100 max-h-96" : "opacity-0 max-h-0 overflow-hidden"}`} style={{ marginTop: expandedFooterSection === "verticals" || (typeof window !== "undefined" && window.innerWidth >= 768) ? "16px" : "0" }}>
                    {["AI Human-in-the-Loop", "Founder Ops", "Healthcare Micro-Admin", "E-commerce Ops"].map((v) => (
                      <a key={v} href="#" className="block text-xs sm:text-sm text-white/70 hover:text-white md:hover:translate-x-1 transition-all duration-300">{v}</a>
                    ))}
                    <a href="#" className="block text-xs sm:text-sm font-medium text-white/70 hover:text-white md:hover:translate-x-1 transition-all duration-300">View all 10 →</a>
                  </div>
                </div>

                <div className="md:space-y-6 transition-all duration-300 min-w-0">
                  <button onClick={() => toggleFooterSection("connect")} className="flex items-center justify-between w-full md:cursor-default md:!p-0 text-left" style={{ padding: "clamp(4px, 0.6vh, 8px) 0" }}>
                    <h3 className="text-sm sm:text-base font-semibold text-white tracking-wide text-left">Connect</h3>
                    <ChevronDown className={`w-5 h-5 text-white/60 transition-transform duration-300 md:hidden ${expandedFooterSection === "connect" ? "rotate-180" : ""}`} />
                  </button>
                  <div className={`w-full space-y-4 overflow-hidden text-left transition-all duration-300 md:!block md:!max-h-none md:!opacity-100 ${expandedFooterSection === "connect" ? "opacity-100 max-h-[500px]" : "opacity-0 max-h-0"}`} style={{ marginTop: expandedFooterSection === "connect" || (typeof window !== "undefined" && window.innerWidth >= 768) ? "16px" : "0" }}>
                    <div className="grid w-full grid-cols-[24px_1fr] items-start gap-3 text-left text-sm leading-relaxed text-white/75">
                      <div className="flex h-6 w-6 items-start justify-start pt-0.5 text-white/60"><Mail className="h-4 w-4 shrink-0" /></div>
                      <div className="min-w-0 text-left leading-relaxed text-white/75">
                        <a href="mailto:hello@onspotglobal.com" className="block w-full text-left leading-relaxed text-white/75 transition hover:text-white" data-testid="footer-email">hello@onspotglobal.com</a>
                      </div>
                    </div>
                    <div className="grid w-full grid-cols-[24px_1fr] items-start gap-3 text-left text-sm leading-relaxed text-white/75">
                      <div className="flex h-6 w-6 items-start justify-start pt-0.5 text-white/60"><Phone className="h-4 w-4 shrink-0" /></div>
                      <div className="min-w-0 text-left leading-relaxed text-white/75">
                        <a href="tel:+19178019294" className="block w-full text-left leading-relaxed text-white/75 transition hover:text-white" data-testid="footer-phone">1-917-801-9294</a>
                      </div>
                    </div>
                    <div className="grid w-full grid-cols-[24px_1fr] items-start gap-3 text-left text-sm leading-relaxed text-white/75">
                      <div className="flex h-6 w-6 items-start justify-start pt-0.5 text-white/60"><MapPinIcon className="h-4 w-4 shrink-0" /></div>
                      <div className="min-w-0 text-left">
                        <a href="https://www.google.com/search?q=onspot+global+new+york" target="_blank" rel="noopener noreferrer" className="block w-full text-left leading-relaxed text-white/75 transition hover:text-white">
                          <address className="block w-full not-italic text-left leading-relaxed text-white/75">US - 2248 Broadway, New York, 10024</address>
                        </a>
                      </div>
                    </div>
                    <div className="grid w-full grid-cols-[24px_1fr] items-start gap-3 text-left text-sm leading-relaxed text-white/75">
                      <div className="flex h-6 w-6 items-start justify-start pt-0.5 text-white/60"><MapPinIcon className="h-4 w-4 shrink-0" /></div>
                      <div className="min-w-0 text-left">
                        <a href="https://www.google.com/search?q=onspot+global+philippines" target="_blank" rel="noopener noreferrer" className="block w-full text-left leading-relaxed text-white/75 transition hover:text-white">
                          <address className="block w-full max-w-[310px] not-italic text-left leading-relaxed text-white/75">PH - 17th Floor High Street South Corporate Plaza Tower 2, 11th Ave Cor 26th St, Bonifacio Global City, Taguig</address>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-white/10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between text-xs sm:text-sm text-white/70">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <span className="hover:text-white transition-colors duration-300">© 2025 OnSpot. All rights reserved.</span>
                <span className="hidden sm:inline text-white/30">·</span>
                <span className="text-[10px] sm:text-xs text-white/50">Powered by OnSpot Intelligence</span>
              </div>
              <div className="flex gap-6">
                <Link href="/privacy-policy" className="hover:text-white transition-all duration-300 hover:translate-y-[-1px]" data-testid="footer-privacy">Privacy Policy</Link>
                <Link href="/terms-and-conditions" className="hover:text-white transition-all duration-300 hover:translate-y-[-1px]" data-testid="footer-terms">Terms of Service</Link>
                <Link href="/cookies" className="hover:text-white transition-all duration-300 hover:translate-y-[-1px]" data-testid="footer-cookies">Cookie Policy</Link>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
