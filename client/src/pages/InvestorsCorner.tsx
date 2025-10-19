import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";
import {
  TrendingUp,
  Users,
  Globe2,
  DollarSign,
  Star,
  CheckCircle2,
  ArrowRight,
  Target,
  Award,
  Briefcase,
  Building2,
  PieChart,
  BarChart3,
  Lightbulb,
  Shield,
  Zap,
  Heart,
  MapPin,
  Mail,
  Phone,
  Calendar,
  User,
  Handshake,
  Rocket,
} from "lucide-react";
import { Link } from "wouter";
import heroWorkspaceImage from "@assets/generated_images/Professional_workspace_background_ccee2885.png";
import dashboardImage from "@assets/image_1758287669145.png";

const tractionStats = [
  {
    label: "Resources Deployed",
    value: "500+",
    description: "Supporting client business operations",
    icon: Users,
    color: "text-blue-600",
  },
  {
    label: "Clients Served",
    value: "80+",
    description: "Across various industries and service models",
    icon: Building2,
    color: "text-purple-600",
  },
  {
    label: "Value Delivered",
    value: "$50M+",
    description: "Estimated value delivered since 2021",
    icon: DollarSign,
    color: "text-green-600",
  },
  {
    label: "Client NPS Score",
    value: "75%",
    description: "Client satisfaction and loyalty rating",
    icon: Star,
    color: "text-yellow-600",
  },
  {
    label: "Employee NPS Score",
    value: "85%",
    description: "Team satisfaction and engagement",
    icon: Heart,
    color: "text-red-600",
  },
  {
    label: "Leadership Experience",
    value: "120+",
    description: "Combined years in outsourcing expertise",
    icon: Award,
    color: "text-indigo-600",
  },
];

const serviceModels = [
  {
    title: "Resourced",
    subtitle: "You Manage",
    description:
      "Flat FTE rate with best-in-class hires and dedicated account manager",
    range: "1-20 FTE",
    target: "Founders who want cost savings and direct control",
    outcome: "Lower costs, more control—but you handle performance",
    features: [
      "Pre-screened professionals",
      "Dedicated account manager",
      "Standard support",
      "Direct management control",
    ],
    icon: Users,
    color: "bg-blue-50 dark:bg-blue-950/20 text-blue-600",
    priceNote: "Dependent on Role + $200 for onsite",
  },
  {
    title: "Managed",
    subtitle: "We Manage Everything",
    description:
      "Full-service management with dedicated team manager and process optimization",
    range: "5-50 FTE",
    target:
      "Growth-focused leaders who want KPIs delivered without micro-managing",
    outcome: "Hands-off growth: predictable KPIs, faster scale, less stress",
    features: [
      "Everything in Resourced",
      "Dedicated team manager",
      "24/7 support",
      "Process building",
      "KPI accountability",
    ],
    icon: Target,
    color: "bg-green-50 dark:bg-green-950/20 text-green-600",
    badge: "Best Value",
    priceNote: "Dependent on Role + $200 for onsite",
  },
  {
    title: "Enterprise",
    subtitle: "Custom at Scale",
    description:
      "Enterprise-grade scalability with full customization and dedicated teams",
    range: ">50 FTE",
    target: "Enterprises scaling 50+ FTEs with full customization needs",
    outcome: "Enterprise-grade scalability with full customization",
    features: [
      "Everything in Managed",
      "1,000+ FTE capacity",
      "Enterprise processes",
      "Custom integrations",
      "Dedicated campaign team",
    ],
    icon: Building2,
    color: "bg-purple-50 dark:bg-purple-950/20 text-purple-600",
    priceNote: "Custom Quote",
  },
];

const marketOpportunity = {
  globalMarket: "$250B+",
  usMarket2022: "$70.66B", // U.S. BPO market size in 2022
  cagr: "9.1%", // CAGR from 2023 to 2030
  projected2030: "$139.49B", // Expected by 2030
  tam: "$140B", // Entire U.S. BPO market by 2030
  tamDefinition:
    "Total Addressable Market: The entire U.S. BPO market by 2030, representing the full revenue opportunity if OnSpot captured 100% market share across all segments and customer types.",
  sam: "$30-40B", // SME + mid-market (30-40% of U.S. BPO spend)
  samDefinition:
    "Serviceable Addressable Market: The SME and mid-market segment (30-40% of total U.S. BPO spend), representing businesses with 10-500 employees that align with OnSpot's service model and pricing structure.",
  som: "$400M-1.2B", // 1-2% of SAM in 3-5 years
  somDefinition:
    "Serviceable Obtainable Market: Realistic market capture of 1-2% of SAM within 3-5 years, based on our current growth trajectory, competitive positioning, and operational capacity for scaling.",
  growth: "9.1%", // Annual growth rate
  segments: [
    { name: "IT & Software Development", share: "35%", value: "$87.5B" },
    { name: "Customer Service", share: "25%", value: "$62.5B" },
    { name: "Finance & Accounting", share: "20%", value: "$50B" },
    { name: "HR & Admin", share: "20%", value: "$50B" },
  ],
};

const philippinesAdvantages = [
  {
    metric: "Cost Savings",
    value: "70%",
    description: "vs US/Europe/Australia",
    icon: DollarSign,
  },
  {
    metric: "English Speakers",
    value: "90M",
    description: "Fluent English speakers nationwide",
    icon: Globe2,
  },
  {
    metric: "BPO Employees",
    value: "1.8M",
    description: "Experienced workforce nationwide",
    icon: Users,
  },
  {
    metric: "College Graduates",
    value: "1M",
    description: "Annual qualified talent pool",
    icon: Award,
  },
  {
    metric: "Cultural Alignment",
    value: "92%",
    description: "Western culture compatibility",
    icon: Heart,
  },
  {
    metric: "Business Operations",
    value: "24/7",
    description: "Round-the-clock availability",
    icon: Shield,
  },
];

const leadershipTeam = [
  {
    name: "Nur Laminero",
    role: "Chief Executive Officer",
    quote:
      "We turned our operational struggles into the creation of OnSpot, helping businesses like ours in New York grow and succeed with easy and efficient outsourcing solutions.",
    experience:
      "Founded 15 companies in multiple sectors across US and Philippines",
  },
  {
    name: "Jake Wainberg",
    role: "Founder & President",
    quote:
      "We understand your struggle with operational costs because we've been there. To grow our New York businesses, we created OnSpot, and its success led our friends to join us.",
    experience:
      "Handled 1,000+ brands and accounts with 10,000+ employees in BPO industry",
  },
];

const problemSolutions = [
  {
    problem: "Drowning in admin and back-office work",
    solution: "Unlock 8X growth potential with dedicated teams",
    impact: "Free entrepreneurs to focus on strategic growth",
    icon: Briefcase,
    color: "text-red-500",
  },
  {
    problem: "Burned out team, rising costs",
    solution: "Up to 70% cost savings with efficient operations",
    impact: "Boost productivity while reducing expenses",
    icon: TrendingUp,
    color: "text-orange-500",
  },
  {
    problem: "Growth stalled by hiring bottlenecks",
    solution: "Scale teams in 21 days from 50k+ vetted talent",
    impact: "Rapid scaling with pre-qualified professionals",
    icon: Users,
    color: "text-blue-500",
  },
];

// Required components for the enhanced HERO section
const Section = ({
  id,
  icon: Icon,
  title,
  kicker,
  children,
}: {
  id?: string;
  icon?: any;
  title?: string;
  kicker?: string;
  children: React.ReactNode;
}) => {
  return (
    <section id={id} className="py-24">
      <div className="container mx-auto px-6">
        {title && (
          <div className="text-center space-y-6 mb-16">
            <div className="flex items-center justify-center gap-2 mb-4">
              {Icon && <Icon className="w-6 h-6 text-primary" />}
              {kicker && (
                <span className="text-sm text-muted-foreground uppercase tracking-wider">
                  {kicker}
                </span>
              )}
            </div>
            <h2 className="text-4xl md:text-5xl font-bold">{title}</h2>
          </div>
        )}
        {children}
      </div>
    </section>
  );
};

const CountUpNumber = ({
  target,
  suffix = "",
  duration = 2000,
}: {
  target: number;
  suffix?: string;
  duration?: number;
}) => {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!isVisible) return;

    let startTime: number;
    const startValue = 0;
    const endValue = target;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out animation
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.floor(
        startValue + (endValue - startValue) * easeOut,
      );

      setCount(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [isVisible, target, duration]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      onViewportEnter={() => setIsVisible(true)}
      className="text-lg font-bold text-[hsl(var(--brand-foreground))]"
    >
      {count}
      {suffix}
    </motion.div>
  );
};

const HeroMetric = ({
  icon: Icon,
  label,
  value,
  suffix,
}: {
  icon: any;
  label: string;
  value: number;
  suffix?: string;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="text-center"
    >
      <div className="w-8 h-8 mx-auto mb-2 text-primary">
        <Icon className="w-full h-full" />
      </div>
      <div className="text-lg font-bold text-foreground">
        {value}
        {suffix}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </motion.div>
  );
};

const Bullet = ({ children }: { children: React.ReactNode }) => {
  return (
    <motion.li
      initial={{ opacity: 0, x: -8 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      className="flex items-start gap-2"
    >
      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
      <span className="text-sm text-muted-foreground">{children}</span>
    </motion.li>
  );
};

export default function InvestorsCorner() {
  // SEO Meta Tags for Investors Page
  useEffect(() => {
    // Set page title
    document.title =
      "Investors Corner - OnSpot | Investment Opportunity";

    // Update or create meta tags
    const updateMetaTag = (property: string, content: string) => {
      let meta = document.querySelector(
        `meta[property="${property}"]`,
      ) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("property", property);
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", content);
    };

    const updateMetaName = (name: string, content: string) => {
      let meta = document.querySelector(
        `meta[name="${name}"]`,
      ) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", name);
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", content);
    };

    // Update meta description
    updateMetaName(
      "description",
      "Investment opportunity in OnSpot - The evolution of outsourcing. Built by entrepreneurs for entrepreneurs. 80+ clients served, $50M+ value delivered, battle-tested growth with 500+ resources deployed.",
    );

    // Update Open Graph tags
    updateMetaTag(
      "og:title",
      "Investors Corner - OnSpot | Investment Opportunity",
    );
    updateMetaTag(
      "og:description",
      "Join the outsourcing revolution. OnSpot bridges BPO and freelancing with proven traction: 80+ clients, $50M+ delivered, 70% cost savings. From battle scars to global scale.",
    );
    updateMetaTag("og:type", "website");
    updateMetaTag("og:url", window.location.href);

    // Twitter Card tags
    updateMetaName("twitter:card", "summary_large_image");
    updateMetaName("twitter:title", "Investors Corner - OnSpot");
    updateMetaName(
      "twitter:description",
      "Investment opportunity in the evolution of outsourcing. 80+ clients, $50M+ value delivered, battle-tested platform ready to scale globally.",
    );

    // Cleanup function to restore original meta tags when component unmounts
    return () => {
      document.title = "OnSpot — The Superhuman Outsourcing System";
    };
  }, []);

  return (
    <div className="space-y-0 overflow-hidden">
      {/* HERO */}
      <section id="hero" className="hero-investor text-white pt-28 pb-20">
        <div className="container mx-auto px-6">
          <div className="relative">
            <div
              className="absolute -top-32 -left-32 h-96 w-96 rounded-full blur-3xl opacity-8 pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 40%, transparent 70%)",
              }}
            />
            <div
              className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full blur-3xl opacity-6 pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.03) 40%, transparent 70%)",
              }}
            />

            <div className="grid md:grid-cols-12 gap-12 items-center p-8 md:p-12">
              {/* LEFT: copy + CTAs */}
              <div className="md:col-span-6 lg:col-span-7">
                <motion.h1
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.5 }}
                  transition={{ duration: 0.5 }}
                  className="text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight text-[hsl(var(--brand-foreground))] drop-shadow-lg"
                >
                  OnSpot — The Evolution of Outsourcing
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.5 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  className="mt-6 text-xl md:text-2xl lg:text-3xl font-medium text-[hsl(var(--brand-foreground))]/95 max-w-4xl leading-relaxed drop-shadow-md"
                >
                  From decades of BPO experience to the world's first unified
                  outsourcing platform.
                </motion.p>

                <ul className="mt-8 space-y-3">
                  <motion.li
                    initial={{ opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                    className="flex items-start gap-3"
                  >
                    <div className="w-2 h-2 rounded-full bg-[hsl(var(--brand-foreground))]/90 mt-2.5 flex-shrink-0" />
                    <span className="text-base text-[hsl(var(--brand-foreground))]/90">
                      <strong className="text-[hsl(var(--brand-foreground))]">
                        Unified platform:
                      </strong>{" "}
                      Bringing the best of freelancing flexibility and BPO
                      reliability into one system.
                    </span>
                  </motion.li>
                  <motion.li
                    initial={{ opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                    className="flex items-start gap-3"
                  >
                    <div className="w-2 h-2 rounded-full bg-[hsl(var(--brand-foreground))]/90 mt-2.5 flex-shrink-0" />
                    <span className="text-base text-[hsl(var(--brand-foreground))]/90">
                      <strong className="text-[hsl(var(--brand-foreground))]">
                        Built for scale:
                      </strong>{" "}
                      decades of BPO ops, now productized.
                    </span>
                  </motion.li>
                </ul>

                {/* CTAs */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                  className="mt-8 flex flex-wrap gap-4"
                >
                  <a
                    href="#ask"
                    className="inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-[hsl(var(--brand-foreground))] text-primary font-semibold shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 hover:bg-[hsl(var(--brand-foreground))]/95 hover:scale-105 group"
                    data-testid="cta-partner"
                  >
                    <Handshake className="w-5 h-5 group-hover:rotate-12 transition-transform duration-300" />{" "}
                    Partner with OnSpot
                  </a>
                  <a
                    href="https://www.onspotglobal.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-3 px-8 py-4 rounded-xl border-2 border-[hsl(var(--brand-foreground))]/30 text-[hsl(var(--brand-foreground))] font-semibold backdrop-blur-sm hover:bg-[hsl(var(--brand-foreground))]/15 hover:border-[hsl(var(--brand-foreground))]/50 transition-all duration-300 hover:-translate-y-1 hover:scale-105 group"
                    data-testid="cta-onspotconnect"
                  >
                    <Rocket className="w-5 h-5 group-hover:rotate-12 transition-transform duration-300" />{" "}
                    See OnSpotConnect in Action
                  </a>
                </motion.div>
                <motion.p
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.5 }}
                  className="mt-3 text-sm text-[hsl(var(--brand-foreground))]/80 font-medium"
                >
                  Prototype live
                </motion.p>

                {/* Trust strip */}
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.6 }}
                  className="mt-6 text-base text-[hsl(var(--brand-foreground))]/90 font-medium"
                >
                  80+ clients • 500+ resources deployed • $50M+ in value
                  delivered
                </motion.p>
              </div>

              {/* RIGHT: product mock or highlight metrics */}
              <div className="md:col-span-6 lg:col-span-5">
                {/* Product mockup placeholder – swap src with your real screenshot */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.5 }}
                  className="bg-[hsl(var(--brand-foreground))]/10 backdrop-blur-md border border-[hsl(var(--brand-foreground))]/20 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-500 hover:scale-[1.02] p-6 md:p-8"
                >
                  {/* If you have a dashboard image, uncomment and replace src:
                <img src="/onspot-dashboard.png" alt="OnSpotConnect dashboard" className="rounded-lg w-full object-cover" />
                */}
                  <img
                    src={dashboardImage}
                    alt="OnSpot dashboard showing client metrics, ROI analysis, and platform overview"
                    className="rounded-lg w-full h-auto object-contain hover:scale-105 transition-transform duration-500"
                  />

                  {/* Highlight metrics with count-up animations */}
                  <div className="mt-6 grid grid-cols-3 gap-4">
                    <motion.div
                      className="text-center hover:scale-110 transition-transform duration-300"
                      whileHover={{ y: -4 }}
                    >
                      <div className="w-10 h-10 mx-auto mb-3 text-[hsl(var(--brand-foreground))]">
                        <Users className="w-full h-full" />
                      </div>
                      <CountUpNumber target={80} suffix="+" duration={2000} />
                      <div className="text-xs text-[hsl(var(--brand-foreground))]/80 font-medium">
                        Clients
                      </div>
                    </motion.div>
                    <motion.div
                      className="text-center hover:scale-110 transition-transform duration-300"
                      whileHover={{ y: -4 }}
                    >
                      <div className="w-10 h-10 mx-auto mb-3 text-[hsl(var(--brand-foreground))]">
                        <Briefcase className="w-full h-full" />
                      </div>
                      <CountUpNumber target={500} suffix="+" duration={2500} />
                      <div className="text-xs text-[hsl(var(--brand-foreground))]/80 font-medium">
                        Seats
                      </div>
                    </motion.div>
                    <motion.div
                      className="text-center hover:scale-110 transition-transform duration-300"
                      whileHover={{ y: -4 }}
                    >
                      <div className="w-10 h-10 mx-auto mb-3 text-[hsl(var(--brand-foreground))]">
                        <PieChart className="w-full h-full" />
                      </div>
                      <CountUpNumber target={55} suffix="%" duration={1800} />
                      <div className="text-xs text-[hsl(var(--brand-foreground))]/80 font-medium">
                        Gross Margin
                      </div>
                    </motion.div>
                  </div>

                  {/* Dashboard Label */}
                  <div className="mt-3 text-center">
                    <p className="text-sm text-[hsl(var(--brand-foreground))]/70 font-medium">
                      OnSpotConnect Platform Dashboard
                    </p>
                    <p className="text-xs text-[hsl(var(--brand-foreground))]/60">
                      Live metrics and performance overview
                    </p>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The 60-Second Story */}
      <div className="bg-muted/30 py-24">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center space-y-6 mb-16">
              <h2 className="text-4xl md:text-5xl font-bold">
                The 60-Second Story
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                From BPO battleground to global outsourcing empire - built from
                battle scars
              </p>
            </div>

            {/* The Exact 60-Second Narrative */}
            <div
              className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-xl p-8 mb-16"
              data-testid="text-60s-story"
            >
              <div className="max-w-4xl mx-auto">
                <blockquote className="text-lg md:text-xl leading-relaxed text-center italic text-muted-foreground">
                  <span className="text-2xl text-primary">"</span>
                  Jake Wainberg and I didn't create OnSpot from a whiteboard —
                  we built it from battle scars. In New York, we were drowning
                  in operational costs. Teams were burning out, margins were
                  shrinking, and growth stalled. Instead of folding, we created
                  OnSpot — outsourcing made easy, built by entrepreneurs, for
                  entrepreneurs.
                  <br />
                  <br />
                  Jake brought the street-smart hustle of scaling U.S.
                  businesses. I brought the systems and leadership of building
                  and running full-scale BPO operations in the Philippines.
                  Together, we turned our struggles into a solution: OnSpot.
                  <br />
                  <br />
                  To date, we've served over 80 clients, deployed hundreds of
                  resources, and delivered tens of millions in value. We've
                  proven outsourcing can cut costs by up to 70%, unlock time,
                  and fuel 8X growth.
                  <br />
                  <br />
                  OnSpot isn't theory — it's survival turned into scale. And
                  now, with OnSpotConnect, we're unifying BPO and freelancing
                  into the future of outsourcing.
                  <span className="text-2xl text-primary">"</span>
                </blockquote>
                <div className="text-center mt-6">
                  <div className="font-semibold text-primary">
                    Nur Laminero & Jake Wainberg
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Co-Founders, OnSpot
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
              {leadershipTeam.map((leader, index) => (
                <Card
                  key={index}
                  className="hover-elevate transition-all duration-300"
                  data-testid={`leader-${leader.name.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <CardHeader>
                    <div className="flex items-start space-x-4">
                      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                        <User className="w-8 h-8 text-primary" />
                      </div>
                      <div className="space-y-1">
                        <CardTitle className="text-xl">{leader.name}</CardTitle>
                        <CardDescription className="text-primary font-medium">
                          {leader.role}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <blockquote className="text-sm italic leading-relaxed border-l-4 border-primary/20 pl-4">
                      "{leader.quote}"
                    </blockquote>
                    <p className="text-xs text-muted-foreground">
                      {leader.experience}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="text-center">
              <div className="inline-flex items-center gap-2 text-lg font-semibold text-primary">
                <Award className="w-5 h-5" />
                Joint force: 15 companies founded, 1,000+ brands handled,
                10,000+ employees managed
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* The Problem & Solution */}
      <div className="py-24" data-testid="section-problem">
        <div className="container mx-auto px-6">
          <div className="text-center space-y-6 mb-16">
            <h2 className="text-4xl md:text-5xl font-bold">
              The Problem: Outsourcing is Broken
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Current outsourcing landscape creates a broken bridge between
              businesses and solutions.
            </p>

            {/* Broken Bridge Visual Concept */}
            <div
              className="flex items-center justify-center space-x-4 my-8"
              data-testid="broken-bridge-visual"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-2">
                  <Users className="w-8 h-8 text-red-500" />
                </div>
                <div className="text-sm font-medium">Freelancing</div>
                <div className="text-xs text-muted-foreground">
                  Chaotic, Unreliable
                </div>
              </div>

              <div className="flex-1 max-w-xs relative">
                <div className="h-1 bg-gradient-to-r from-red-500 via-gray-300 to-red-500 rounded-full opacity-50"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-background px-3 py-1 rounded-full border text-xs font-medium text-destructive">
                    BROKEN BRIDGE
                  </div>
                </div>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-2">
                  <Building2 className="w-8 h-8 text-red-500" />
                </div>
                <div className="text-sm font-medium">BPO Giants</div>
                <div className="text-xs text-muted-foreground">
                  Expensive, Rigid
                </div>
              </div>
            </div>

            {/* Bridging the Gap Solution */}
            <div
              className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-xl p-6 mt-8"
              data-testid="section-solution"
            >
              <div
                className="flex items-center justify-center space-x-4"
                data-testid="bridging-gap-visual"
              >
                <div className="text-center">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                    <Target className="w-6 h-6 text-primary" />
                  </div>
                  <div className="text-sm font-medium">Freelancing</div>
                  <div className="text-xs text-muted-foreground">
                    Flexibility
                  </div>
                </div>

                <div className="flex-1 max-w-xs relative">
                  <div className="h-2 bg-gradient-to-r from-primary to-green-500 rounded-full"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-primary text-white px-4 py-1 rounded-full text-xs font-bold">
                      OnSpot BRIDGE
                    </div>
                  </div>
                </div>

                <div className="text-center">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                    <Shield className="w-6 h-6 text-primary" />
                  </div>
                  <div className="text-sm font-medium">BPO</div>
                  <div className="text-xs text-muted-foreground">
                    Reliability
                  </div>
                </div>
              </div>
              <div className="text-center mt-4">
                <div className="text-primary font-bold">
                  OnSpot: The Unified Outsourcing Platform
                </div>
                <div className="text-sm text-muted-foreground">
                  Flexibility of freelancing + Reliability of BPO
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-12">
            {problemSolutions.map((item, index) => (
              <Card
                key={index}
                className="hover-elevate transition-all duration-300"
                data-testid={`problem-solution-${index}`}
              >
                <CardContent className="p-8">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
                    <div className="text-center lg:text-left space-y-3">
                      <div
                        className={`w-12 h-12 ${item.color} bg-current/10 rounded-full flex items-center justify-center mx-auto lg:mx-0`}
                      >
                        <item.icon className={`w-6 h-6 ${item.color}`} />
                      </div>
                      <h3 className="text-xl font-semibold text-destructive">
                        The Problem
                      </h3>
                      <p className="text-muted-foreground">{item.problem}</p>
                    </div>

                    <div className="flex justify-center">
                      <ArrowRight className="w-8 h-8 text-primary rotate-90 lg:rotate-0" />
                    </div>

                    <div className="text-center lg:text-right space-y-3">
                      <div className="w-12 h-12 text-green-600 bg-green-600/10 rounded-full flex items-center justify-center mx-auto lg:ml-auto lg:mr-0">
                        <CheckCircle2 className="w-6 h-6 text-green-600" />
                      </div>
                      <h3 className="text-xl font-semibold text-green-600">
                        Our Solution
                      </h3>
                      <p className="text-muted-foreground">{item.solution}</p>
                      <p className="text-sm font-medium text-primary">
                        {item.impact}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Proof of Grit - Traction */}
      <div className="bg-primary/5 dark:bg-primary/10 py-24">
        <div className="container mx-auto px-6">
          <div className="text-center space-y-6 mb-16">
            <h2 className="text-4xl md:text-5xl font-bold">Proof of Grit</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Battle-tested growth with proven results. These numbers don't
              lie—they represent real businesses we've transformed.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {tractionStats.map((stat, index) => (
              <Card
                key={index}
                className="hover-elevate transition-all duration-300 bg-white dark:bg-card"
                data-testid={
                  stat.label === "Resources Deployed"
                    ? "card-stat-resources"
                    : `traction-${index}`
                }
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 rounded-lg bg-muted/20 ${stat.color}`}>
                      <stat.icon className="w-6 h-6" />
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold">{stat.value}</div>
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-base mb-1">
                      {stat.label}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {stat.description}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Timeline Visual - 3 Years Journey */}
          <div
            className="bg-gradient-to-r from-primary/5 to-green-500/5 rounded-xl p-8 mb-8"
            data-testid="timeline-visual"
          >
            <h3 className="text-2xl font-bold text-center mb-8">
              The Journey: Experience → Prototype → Platform
            </h3>
            <div className="flex items-center justify-between max-w-4xl mx-auto">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-full flex items-center justify-center mx-auto">
                  <Shield className="w-8 h-8" />
                </div>
                <div className="font-bold text-sm">Decades BPO</div>
                <div className="text-xs text-muted-foreground">
                  Battle-tested survival
                </div>
              </div>

              <ArrowRight className="w-6 h-6 text-primary" />

              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                  <Lightbulb className="w-8 h-8" />
                </div>
                <div className="font-bold text-sm">OnSpotConnect</div>
                <div className="text-xs text-muted-foreground">
                  Live prototype
                </div>
                <div className="text-xs text-primary font-medium">
                  <a
                    href="https://www.onspotglobal.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                    data-testid="prototype-link"
                  >
                    onspotglobal.com
                  </a>
                </div>
              </div>

              <ArrowRight className="w-6 h-6 text-primary" />

              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 text-green-600 rounded-full flex items-center justify-center mx-auto">
                  <Globe2 className="w-8 h-8" />
                </div>
                <div className="font-bold text-sm">Global Platform</div>
                <div className="text-xs text-muted-foreground">
                  Scale to empire
                </div>
              </div>
            </div>
          </div>

          <div className="text-center">
            <Badge variant="outline" className="text-base px-6 py-2">
              15 Startups Founded by Leadership Team • $39B Annual Outsourcing
              Revenue in Philippines
            </Badge>
          </div>
        </div>
      </div>

      {/* Market Opportunity */}
      <div className="py-24">
        <div className="container mx-auto px-6">
          <div className="text-center space-y-6 mb-16">
            <h2 className="text-4xl md:text-5xl font-bold">
              Market Opportunity
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              The global outsourcing market is experiencing unprecedented
              growth, with OnSpot perfectly positioned to capture significant
              market share.
            </p>
          </div>

          {/* U.S. BPO Market Key Facts */}
          <div
            className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-xl p-8 mb-16"
            data-testid="us-bpo-market-data"
          >
            <h3 className="text-2xl font-bold text-center mb-6">
              U.S. BPO Market - Key Data Points
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              <div className="space-y-2">
                <div className="text-3xl font-bold text-blue-600">
                  {marketOpportunity.usMarket2022}
                </div>
                <div className="text-sm text-muted-foreground">
                  U.S. BPO Market Size (2022)
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-green-600">
                  {marketOpportunity.cagr}
                </div>
                <div className="text-sm text-muted-foreground">
                  CAGR (2023-2030)
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-purple-600">
                  {marketOpportunity.projected2030}
                </div>
                <div className="text-sm text-muted-foreground">
                  Projected by 2030
                </div>
              </div>
            </div>
          </div>

          {/* TAM/SAM/SOM Table with Definitions */}
          <div className="mb-16">
            <h3 className="text-2xl font-bold text-center mb-8">
              Market Layers - Detailed Breakdown
            </h3>
            <div
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
              data-testid="tam-sam-som-table"
            >
              <Card className="hover-elevate">
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <Target className="w-8 h-8 text-green-600" />
                    <div>
                      <CardTitle className="text-xl" data-testid="text-tam">
                        TAM - {marketOpportunity.tam}
                      </CardTitle>
                      <CardDescription>
                        Total Addressable Market
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Definition:</p>
                    <p className="text-sm text-muted-foreground">
                      Entire U.S. BPO market + all businesses that could use
                      hybrid outsourcing (freelancers + structured BPO).
                      Includes large enterprises + SMEs spending on BPO, managed
                      services, process outsourcing.
                    </p>
                    <p className="text-sm font-medium text-green-600">
                      USD ~140B by 2030 - the ceiling if OnSpot could cover
                      almost all standard BPO spend.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover-elevate">
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <PieChart className="w-8 h-8 text-purple-600" />
                    <div>
                      <CardTitle className="text-xl" data-testid="text-sam">
                        SAM - {marketOpportunity.sam}
                      </CardTitle>
                      <CardDescription>
                        Serviceable Addressable Market
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Definition:</p>
                    <p className="text-sm text-muted-foreground">
                      SME + Mid-market businesses in the U.S. that want
                      flexible, accountable outsourcing using hybrid models.
                      Limited to service types OnSpot is building (customer
                      service, finance & accounting, HR, technical support).
                    </p>
                    <p className="text-sm font-medium text-purple-600">
                      30-40% of U.S. BPO spend in our target segments and
                      business sizes.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover-elevate">
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <TrendingUp className="w-8 h-8 text-orange-600" />
                    <div>
                      <CardTitle className="text-xl" data-testid="text-som">
                        SOM - {marketOpportunity.som}
                      </CardTitle>
                      <CardDescription>
                        Serviceable Obtainable Market
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Definition:</p>
                    <p className="text-sm text-muted-foreground">
                      What OnSpot can realistically capture in U.S. in near term
                      (3-5 years) given resources, competition, adoption curves,
                      CAC/LTV constraints.
                    </p>
                    <p className="text-sm font-medium text-orange-600">
                      1-2% of SAM in 3-5 years. Aggressive execution could reach
                      3-4% → $1.2-2.4B.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Market Size Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            <Card className="hover-elevate text-center">
              <CardHeader>
                <Globe2 className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <CardTitle className="text-2xl">
                  {marketOpportunity.globalMarket}
                </CardTitle>
                <CardDescription>Global Outsourcing Market</CardDescription>
              </CardHeader>
            </Card>
            <Card className="hover-elevate text-center">
              <CardHeader>
                <Target className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <CardTitle className="text-2xl">
                  {marketOpportunity.tam}
                </CardTitle>
                <CardDescription>Total Addressable Market</CardDescription>
              </CardHeader>
            </Card>
            <Card className="hover-elevate text-center">
              <CardHeader>
                <PieChart className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <CardTitle className="text-2xl">
                  {marketOpportunity.sam}
                </CardTitle>
                <CardDescription>
                  Serviceable Addressable Market
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="hover-elevate text-center">
              <CardHeader>
                <TrendingUp className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                <CardTitle className="text-2xl">
                  {marketOpportunity.growth}
                </CardTitle>
                <CardDescription>Annual Growth Rate</CardDescription>
              </CardHeader>
            </Card>
          </div>

          {/* Market Segments */}
          <Card className="hover-elevate">
            <CardHeader>
              <CardTitle className="text-center text-2xl">
                Market Segments
              </CardTitle>
              <CardDescription className="text-center">
                Key outsourcing segments showing strong demand growth
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {marketOpportunity.segments.map((segment, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-muted/30 rounded-lg"
                  >
                    <div>
                      <div className="font-medium">{segment.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {segment.value}
                      </div>
                    </div>
                    <Badge variant="outline">{segment.share}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Competitive Advantage - Philippines */}
      <div className="bg-muted/30 py-24">
        <div className="container mx-auto px-6">
          <div className="text-center space-y-6 mb-16">
            <h2 className="text-4xl md:text-5xl font-bold">
              Why the Philippines
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Strategic advantages that give OnSpot unmatched competitive
              positioning in the global talent market.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {philippinesAdvantages.map((advantage, index) => (
              <Card
                key={index}
                className="hover-elevate transition-all duration-300"
                data-testid={`advantage-${index}`}
              >
                <CardContent className="p-6 text-center space-y-4">
                  <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto">
                    <advantage.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold">{advantage.value}</div>
                    <div className="font-medium">{advantage.metric}</div>
                    <div className="text-sm text-muted-foreground">
                      {advantage.description}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Business Model */}
      <div className="py-24">
        <div className="container mx-auto px-6">
          <div className="text-center space-y-6 mb-16">
            <h2 className="text-4xl md:text-5xl font-bold">
              Proven Business Model
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Three scalable service models designed for different growth
              stages, from startup to enterprise scale.
            </p>
          </div>

          <div className="space-y-8">
            {serviceModels.map((model, index) => (
              <Card
                key={index}
                className="hover-elevate transition-all duration-300 overflow-hidden"
                data-testid={`service-model-${model.title.toLowerCase()}`}
              >
                <div className="relative">
                  {model.badge && (
                    <div className="absolute top-6 right-6 z-10">
                      <Badge className="bg-green-500 text-white">
                        {model.badge}
                      </Badge>
                    </div>
                  )}
                  <div className="grid grid-cols-1 lg:grid-cols-3 min-h-[300px]">
                    {/* Model Info */}
                    <div className="lg:col-span-2 p-8 space-y-6">
                      <div className="flex items-start space-x-4">
                        <div className={`p-4 rounded-xl ${model.color}`}>
                          <model.icon className="w-8 h-8" />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <h3 className="text-2xl font-bold">
                              {model.title}
                            </h3>
                            <Badge variant="outline">{model.range}</Badge>
                          </div>
                          <p className="text-primary font-medium">
                            {model.subtitle}
                          </p>
                          <p className="text-muted-foreground">
                            {model.description}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <h4 className="font-semibold mb-2">Who It's For:</h4>
                          <p className="text-sm text-muted-foreground">
                            {model.target}
                          </p>
                        </div>

                        <div>
                          <h4 className="font-semibold mb-2">Outcome:</h4>
                          <p className="text-sm text-primary font-medium">
                            {model.outcome}
                          </p>
                        </div>

                        <div>
                          <h4 className="font-semibold mb-2">Pricing:</h4>
                          <p className="text-sm text-muted-foreground">
                            {model.priceNote}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Features */}
                    <div className="bg-muted/20 p-8 space-y-4">
                      <h4 className="font-semibold">What You Get:</h4>
                      <div className="space-y-3">
                        {model.features.map((feature, featureIndex) => (
                          <div
                            key={featureIndex}
                            className="flex items-start space-x-2 text-sm"
                          >
                            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                            <span>{feature}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Scale Strategy */}
      <div className="bg-primary/5 dark:bg-primary/10 py-24">
        <div className="container mx-auto px-6">
          <div className="text-center space-y-6 mb-16">
            <h2 className="text-4xl md:text-5xl font-bold">Scale Strategy</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              From 50k vetted talent to global expansion—our roadmap for
              becoming the world's leading outsourcing platform.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="hover-elevate text-center">
              <CardHeader>
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-6 h-6" />
                </div>
                <CardTitle className="text-lg">Current Scale</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">
                    50k+ Vetted Talent
                  </div>
                  <div className="text-sm text-muted-foreground">
                    85 Active Clients
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Multiple Industries
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover-elevate text-center">
              <CardHeader>
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Target className="w-6 h-6" />
                </div>
                <CardTitle className="text-lg">Technology Platform</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">
                    AI Matching System
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Performance Analytics
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Automated Workflows
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover-elevate text-center">
              <CardHeader>
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Globe2 className="w-6 h-6" />
                </div>
                <CardTitle className="text-lg">Global Expansion</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">
                    Multi-Country Presence
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Regional Partnerships
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Local Compliance
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover-elevate text-center">
              <CardHeader>
                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-6 h-6" />
                </div>
                <CardTitle className="text-lg">Market Leadership</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">
                    Industry Recognition
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Thought Leadership
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Strategic Partnerships
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Slide 5: Traction Timeline Visual */}
      <div
        className="py-24 bg-muted/30"
        data-testid="section-traction-timeline"
      >
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center space-y-6 mb-16">
              <h2 className="text-4xl md:text-5xl font-bold">
                Our Journey: From Battle Scars to Scale
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Years of proven growth and market validation
              </p>
            </div>

            {/* Timeline Visual */}
            <div className="relative" data-testid="timeline-visual">
              <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-1 bg-primary/20"></div>

              <div className="space-y-12">
                <div className="flex items-center space-x-8">
                  <div className="flex-1 text-right">
                    <Card className="inline-block p-6 max-w-md">
                      <h3 className="text-lg font-bold mb-2">
                        2021: Foundation
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Born from operational struggles in New York. First
                        clients onboarded.
                      </p>
                    </Card>
                  </div>
                  <div className="w-4 h-4 bg-primary rounded-full relative z-10"></div>
                  <div className="flex-1"></div>
                </div>

                <div className="flex items-center space-x-8">
                  <div className="flex-1"></div>
                  <div className="w-4 h-4 bg-primary rounded-full relative z-10"></div>
                  <div className="flex-1">
                    <Card className="inline-block p-6 max-w-md">
                      <h3 className="text-lg font-bold mb-2">
                        2022: Rapid Growth
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Scaled to 50+ clients, 200+ resources deployed. Proven
                        cost savings model.
                      </p>
                    </Card>
                  </div>
                </div>

                <div className="flex items-center space-x-8">
                  <div className="flex-1 text-right">
                    <Card className="inline-block p-6 max-w-md">
                      <h3 className="text-lg font-bold mb-2">
                        2023: Market Validation
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        80+ clients served, $50M+ value delivered. Enterprise
                        clients acquired.
                      </p>
                    </Card>
                  </div>
                  <div className="w-4 h-4 bg-primary rounded-full relative z-10"></div>
                  <div className="flex-1"></div>
                </div>

                <div className="flex items-center space-x-8">
                  <div className="flex-1"></div>
                  <div className="w-4 h-4 bg-green-500 rounded-full relative z-10"></div>
                  <div className="flex-1">
                    <Card className="inline-block p-6 max-w-md">
                      <h3 className="text-lg font-bold mb-2">
                        2024: Platform Innovation
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        OnSpotConnect launched. Unifying BPO and freelancing for
                        future growth.
                      </p>
                    </Card>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Slide 7: Competitive Advantage Table */}
      <div className="py-24" data-testid="section-competitive-advantage">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center space-y-6 mb-16">
              <h2 className="text-4xl md:text-5xl font-bold">
                Competitive Advantage
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                How OnSpot dominates traditional outsourcing models
              </p>
            </div>

            <div className="overflow-x-auto" data-testid="competitive-table">
              <table className="w-full border border-border rounded-lg overflow-hidden">
                <thead className="bg-primary/5">
                  <tr>
                    <th className="p-4 text-left font-semibold">Factor</th>
                    <th className="p-4 text-center font-semibold">
                      Traditional BPO
                    </th>
                    <th className="p-4 text-center font-semibold">
                      Freelancing
                    </th>
                    <th className="p-4 text-center font-semibold text-primary">
                      OnSpot
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-border">
                    <td className="p-4 font-medium">Cost Savings</td>
                    <td className="p-4 text-center text-muted-foreground">
                      30-50%
                    </td>
                    <td className="p-4 text-center text-muted-foreground">
                      Variable
                    </td>
                    <td className="p-4 text-center font-semibold text-green-600">
                      Up to 70%
                    </td>
                  </tr>
                  <tr className="border-t border-border bg-muted/20">
                    <td className="p-4 font-medium">Setup Time</td>
                    <td className="p-4 text-center text-muted-foreground">
                      3-6 months
                    </td>
                    <td className="p-4 text-center text-muted-foreground">
                      Days to weeks
                    </td>
                    <td className="p-4 text-center font-semibold text-green-600">
                      21 days
                    </td>
                  </tr>
                  <tr className="border-t border-border">
                    <td className="p-4 font-medium">Quality Control</td>
                    <td className="p-4 text-center text-muted-foreground">
                      Rigid processes
                    </td>
                    <td className="p-4 text-center text-destructive">
                      Inconsistent
                    </td>
                    <td className="p-4 text-center font-semibold text-green-600">
                      Managed excellence
                    </td>
                  </tr>
                  <tr className="border-t border-border bg-muted/20">
                    <td className="p-4 font-medium">Scalability</td>
                    <td className="p-4 text-center text-muted-foreground">
                      Limited
                    </td>
                    <td className="p-4 text-center text-muted-foreground">
                      Manual
                    </td>
                    <td className="p-4 text-center font-semibold text-green-600">
                      1-1000+ FTE
                    </td>
                  </tr>
                  <tr className="border-t border-border">
                    <td className="p-4 font-medium">Management</td>
                    <td className="p-4 text-center text-muted-foreground">
                      Client dependent
                    </td>
                    <td className="p-4 text-center text-destructive">
                      Fully client managed
                    </td>
                    <td className="p-4 text-center font-semibold text-green-600">
                      Fully managed option
                    </td>
                  </tr>
                  <tr className="border-t border-border bg-muted/20">
                    <td className="p-4 font-medium">Technology</td>
                    <td className="p-4 text-center text-muted-foreground">
                      Legacy systems
                    </td>
                    <td className="p-4 text-center text-muted-foreground">
                      No integration
                    </td>
                    <td className="p-4 text-center font-semibold text-green-600">
                      OnSpotConnect platform
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Slide 9: Scale Strategy */}
      <div className="py-24 bg-muted/30" data-testid="section-scale-strategy">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center space-y-6 mb-16">
              <h2 className="text-4xl md:text-5xl font-bold">
                Scale Strategy: From Scars to Empire
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Our proven roadmap for dominating the global outsourcing market
              </p>
            </div>

            <div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
              data-testid="scale-strategy-grid"
            >
              <Card className="hover-elevate transition-all duration-300">
                <CardHeader>
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 text-blue-600 rounded-lg flex items-center justify-center mb-4">
                    <Target className="w-6 h-6" />
                  </div>
                  <CardTitle>Phase 1: Market Penetration</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Capture 2% of SAM ($600M-800M)</li>
                    <li>• 500+ enterprise clients</li>
                    <li>• 5,000+ deployed resources</li>
                    <li>• Geographic expansion: 3 countries</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="hover-elevate transition-all duration-300">
                <CardHeader>
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 text-green-600 rounded-lg flex items-center justify-center mb-4">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <CardTitle>Phase 2: Platform Dominance</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• OnSpotConnect becomes industry standard</li>
                    <li>• AI-powered matching algorithms</li>
                    <li>• Marketplace network effects</li>
                    <li>• Strategic acquisition opportunities</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="hover-elevate transition-all duration-300">
                <CardHeader>
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 text-purple-600 rounded-lg flex items-center justify-center mb-4">
                    <Globe2 className="w-6 h-6" />
                  </div>
                  <CardTitle>Phase 3: Global Empire</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• 10+ global delivery centers</li>
                    <li>• 50,000+ network professionals</li>
                    <li>• $2B+ annual revenue</li>
                    <li>• IPO readiness</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Slide 10: Financials Placeholder */}
      <div className="py-24" data-testid="section-financials">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center space-y-6 mb-16">
              <h2 className="text-4xl md:text-5xl font-bold">
                Financial Projections
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Path to profitability and sustainable growth
              </p>
            </div>

            <Card
              className="bg-gradient-to-r from-primary/5 to-green-500/5 border-primary/20"
              data-testid="financials-preview"
            >
              <CardContent className="p-12 text-center space-y-6">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <BarChart3 className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-2xl font-bold">
                  Detailed Financial Models Available
                </h3>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  Comprehensive 5-year financial projections, unit economics,
                  and ROI analysis available for qualified investors. Contact us
                  to access detailed financial models and investment terms.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Button
                    size="lg"
                    asChild
                    data-testid="button-request-financials"
                  >
                    <Link href="/lead-intake">
                      <BarChart3 className="w-5 h-5 mr-2" />
                      Request Financial Package
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    asChild
                    data-testid="link-investor-deck"
                  >
                    <a href="#download-deck">
                      <Mail className="w-5 h-5 mr-2" />
                      Download Investor Deck
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Vision Statement */}
      <div className="py-24">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="space-y-6">
              <h2 className="text-4xl md:text-5xl font-bold">Closing Vision</h2>
              <div className="text-2xl md:text-3xl font-light text-primary leading-relaxed">
                "Scars into scale, scale into empire"
              </div>
            </div>

            <Separator className="my-8" />

            {/* Exact Closing Vision Statement from Pitch Deck */}
            <div className="space-y-6">
              <blockquote className="text-xl md:text-2xl font-medium text-center leading-relaxed italic border-l-4 border-primary pl-6">
                <span className="text-3xl text-primary">"</span>
                OnSpot isn't just another outsourcing company. We've proven we
                can fight, bleed, and win. Now we're building the platform to
                dominate the global stage. With your backing, we'll turn scars
                into scale — and scale into empire.
                <span className="text-3xl text-primary">"</span>
              </blockquote>

              <p className="text-lg text-muted-foreground leading-relaxed text-center max-w-3xl mx-auto">
                Every battle scar from our BPO journey has been transformed into
                competitive advantages. Every lesson learned in the trenches now
                powers systems that scale. We're not theorizing — we're building
                from proven resilience.
              </p>
            </div>

            {/* Global Expansion Map Concept */}
            <div
              className="bg-gradient-to-r from-primary/5 to-green-500/5 rounded-xl p-8 mt-12"
              data-testid="global-expansion-map"
            >
              <h3 className="text-xl font-bold text-center mb-6">
                Global Expansion Vision
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="space-y-2">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-medium">Philippines</div>
                  <div className="text-xs text-primary">✓ Established</div>
                </div>
                <div className="space-y-2">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 text-green-600 rounded-full flex items-center justify-center mx-auto">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-medium">United States</div>
                  <div className="text-xs text-green-600">✓ Active</div>
                </div>
                <div className="space-y-2">
                  <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 text-orange-600 rounded-full flex items-center justify-center mx-auto">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-medium">Southeast Asia</div>
                  <div className="text-xs text-orange-600">→ Next</div>
                </div>
                <div className="space-y-2">
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 text-purple-600 rounded-full flex items-center justify-center mx-auto">
                    <Globe2 className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-medium">Global</div>
                  <div className="text-xs text-purple-600">→ Empire</div>
                </div>
              </div>
            </div>

            {/* Investment CTA */}
            <div className="pt-8">
              <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
                <CardContent className="p-8 space-y-6">
                  <h3 className="text-2xl font-bold">
                    Ready to Fuel the Vision?
                  </h3>
                  <p className="text-muted-foreground max-w-2xl mx-auto">
                    Join us in revolutionizing how the world thinks about
                    outsourcing. Partner with battle-tested entrepreneurs who
                    turn challenges into competitive advantages.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Button
                      size="lg"
                      asChild
                      data-testid="button-investor-meeting"
                    >
                      <Link href="/lead-intake">
                        <Calendar className="w-5 h-5 mr-2" />
                        Schedule Investment Meeting
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      asChild
                      data-testid="link-investor-email"
                    >
                      <a href="mailto:nur@onspotglobal.com">
                        <Mail className="w-5 h-5 mr-2" />
                        nur@onspotglobal.com
                      </a>
                    </Button>
                  </div>
                  <div className="flex items-center justify-center space-x-6 text-sm text-muted-foreground">
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      data-testid="link-investor-phone"
                    >
                      <a
                        href="tel:+17185405053"
                        className="flex items-center space-x-2 hover-elevate"
                      >
                        <Phone className="w-4 h-4" />
                        <span>+1 718 540 5053</span>
                      </a>
                    </Button>
                    <div
                      className="flex items-center space-x-2"
                      data-testid="location-info"
                    >
                      <MapPin className="w-4 h-4" />
                      <span>New York, NY</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
