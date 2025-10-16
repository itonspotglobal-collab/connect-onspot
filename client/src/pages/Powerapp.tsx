import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Zap,
  Users,
  Calendar,
  Mail,
  MessageCircle,
  Globe,
  BarChart3,
  Star,
  CreditCard,
  Share2,
  Bot,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Workflow,
  Inbox,
  Layout,
  FileText,
  DollarSign,
  Shield,
  Link2,
} from "lucide-react";
import { Link } from "wouter";

const features = [
  {
    icon: Users,
    title: "Contacts & CRM",
    description: "Unified contact profiles with emails, calls, messages, notes, and tasks. Smart tags, lead scoring, and pipeline tracking.",
    benefit: "No more spreadsheets. Every customer touchpoint in one view.",
  },
  {
    icon: Inbox,
    title: "Conversations Inbox",
    description: "All-in-one messaging: Email, SMS, WhatsApp, FB/IG Messenger, Webchat with auto-routing and assignment rules.",
    benefit: "Never miss another lead or reply again — all your messages in one window.",
  },
  {
    icon: Calendar,
    title: "Calendars & Bookings",
    description: "Smart scheduling with buffers, reminders, team calendars, round-robin assignment, and Zoom/Meet auto-links.",
    benefit: "Clients book, get reminders, and show up — automatically.",
  },
  {
    icon: Layout,
    title: "Websites & Funnels",
    description: "Drag-and-drop builder with mobile-optimized templates, prebuilt sales funnels, and SEO tools.",
    benefit: "Launch high-converting pages in minutes — no coding needed.",
  },
  {
    icon: Mail,
    title: "Email & SMS Marketing",
    description: "Beautiful visual email builder, broadcasts, drip campaigns, and automations with link tracking and segmentation.",
    benefit: "Stay top-of-mind with automated, personalized communication.",
  },
  {
    icon: Workflow,
    title: "Automations & Workflows",
    description: "Visual automation builder with prebuilt templates for lead nurture, booking, and closing flows.",
    benefit: "Your business runs 24/7 — even when you don't.",
  },
  {
    icon: Star,
    title: "Reviews & Reputation",
    description: "Automated review requests via SMS/email, review monitoring, NPS/CSAT surveys, and embeddable widgets.",
    benefit: "Build social proof and rank higher with consistent 5-star reviews.",
  },
  {
    icon: CreditCard,
    title: "Payments & Invoicing",
    description: "Stripe integration with one-time or subscription payments, invoices, checkout pages, and revenue tracking.",
    benefit: "Get paid instantly. No separate systems or delays.",
  },
  {
    icon: Share2,
    title: "Social Media Planner",
    description: "Schedule posts for FB, IG, LinkedIn, Google Business with AI caption suggestions and calendar view.",
    benefit: "Manage all your social presence from one dashboard.",
  },
  {
    icon: BarChart3,
    title: "Reporting & Attribution",
    description: "Real-time dashboards for leads, sales, and sources with campaign ROI and conversion tracking.",
    benefit: "Know exactly which campaigns make you money.",
  },
  {
    icon: Bot,
    title: "AI Features",
    description: "AI-generated messages, emails, and responses with conversation summarization and intent analysis.",
    benefit: "Save hours weekly and elevate every client interaction.",
  },
  {
    icon: Link2,
    title: "Integrations",
    description: "Connect to 2,000+ apps via Zapier/Make with deep integrations for Google, Microsoft, Zoom, Stripe, QuickBooks, and more.",
    benefit: "Fits perfectly into your existing tech stack.",
  },
];

const pricingPlans = [
  {
    name: "Complimentary Access",
    description: "Core platform + setup + basic templates",
    whoFor: "Included with any Managed or Resourced OnSpot service",
    price: "FREE",
    features: [
      "Complete CRM & pipeline management",
      "Conversations inbox (all channels)",
      "Calendar & booking system",
      "Email & SMS marketing",
      "Basic automations",
      "OnSpot support",
    ],
  },
  {
    name: "Powerapp Pro",
    description: "Full automation suite + custom funnel + multi-channel campaigns",
    whoFor: "Clients who want to automate follow-up and scale faster",
    price: "$299",
    period: "/month",
    features: [
      "Everything in Complimentary",
      "Advanced automation workflows",
      "Custom funnel development",
      "Multi-channel campaign builder",
      "A/B testing & optimization",
      "Priority support",
    ],
    popular: true,
  },
  {
    name: "Powerapp Enterprise",
    description: "Multi-brand, multi-user, API integration, BI reporting",
    whoFor: "Established teams or agencies",
    price: "Custom",
    features: [
      "Everything in Pro",
      "Multi-brand management",
      "Unlimited users",
      "API & custom integrations",
      "Advanced BI reporting",
      "Dedicated account manager",
    ],
  },
];

const industrySnapshots = [
  "BPO / Outsourcing",
  "Real Estate",
  "Coaching / Consulting",
  "E-commerce",
  "Healthcare / Clinics",
  "Automotive",
  "Education",
  "Local Service Businesses",
];

const benefits = [
  "Replace 15+ apps with 1 system",
  "Unified data, dashboards, and automations",
  "Automate 80% of repetitive tasks",
  "Lower cost per lead & higher close rate",
  "Keep your brand consistent across all touchpoints",
];

export default function Powerapp() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/5 py-24 md:py-32">
        <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.5))]" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
              <Sparkles className="w-3 h-3 mr-1" />
              Complimentary with OnSpot Services
            </Badge>
            
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
              Powerapp by OnSpot
            </h1>
            
            <p className="text-2xl md:text-3xl text-muted-foreground font-light">
              Your All-In-One Growth & Automation Platform
            </p>
            
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Run your business like a $10M company — even if you're just starting.
              <br />
              <span className="font-medium text-foreground">One system. All your tools. Automated, organized, and ready to scale.</span>
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button size="lg" className="text-lg px-8" asChild data-testid="button-get-started">
                <Link href="/lead-intake">
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8" asChild data-testid="button-contact">
                <Link href="/lead-intake">
                  Talk to Us
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* What is Powerapp */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto space-y-12">
            <div className="text-center space-y-6">
              <h2 className="text-4xl md:text-5xl font-bold">
                What Powerapp Is
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                Powerapp (powered by GHL and customized by OnSpot) is your complete business growth system — 
                built to centralize your marketing, sales, operations, and communication in one intelligent platform.
              </p>
            </div>
            
            <Card className="border-2">
              <CardContent className="p-8 md:p-12">
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="bg-primary/10 p-3 rounded-lg">
                      <Zap className="h-8 w-8 text-primary" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <h3 className="text-2xl font-semibold">Replaces 15+ Tools</h3>
                      <p className="text-muted-foreground text-lg">
                        Say goodbye to HubSpot, Calendly, Mailchimp, ClickFunnels, Typeform, Slack, and more — 
                        saving you time, money, and mental load while giving your team the structure to operate like pros.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="bg-primary/10 p-3 rounded-lg">
                      <Workflow className="h-8 w-8 text-primary" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <h3 className="text-2xl font-semibold">We Build the System. You Focus on Growth.</h3>
                      <p className="text-muted-foreground text-lg">
                        Get a fully integrated CRM, automation engine, communication suite, and funnel system that runs 
                        your lead generation, follow-ups, appointments, payments, and reporting — automatically.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto space-y-16">
            <div className="text-center space-y-4">
              <h2 className="text-4xl md:text-5xl font-bold">
                Key Features & Capabilities
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Everything you need to run, automate, and scale your business — all in one place.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature, index) => (
                <Card key={index} className="hover-elevate transition-all duration-300" data-testid={`feature-card-${index}`}>
                  <CardContent className="p-6 space-y-4">
                    <div className="bg-primary/10 w-12 h-12 rounded-lg flex items-center justify-center">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                    <div className="pt-2 border-t">
                      <p className="text-sm font-medium text-primary flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>{feature.benefit}</span>
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Industry Snapshots */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto space-y-12">
            <div className="text-center space-y-4">
              <h2 className="text-4xl md:text-5xl font-bold">
                Ready-to-Use Industry Snapshots
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Prebuilt templates tailored for your industry. Go live in 48 hours.
              </p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {industrySnapshots.map((industry, index) => (
                <Card key={index} className="hover-elevate transition-all duration-300" data-testid={`industry-card-${index}`}>
                  <CardContent className="p-6 text-center">
                    <p className="font-medium">{industry}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            <Card className="border-2 bg-primary/5 border-primary/20">
              <CardContent className="p-8">
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold">Each snapshot includes:</h3>
                  <div className="grid md:grid-cols-2 gap-3">
                    {[
                      "Website/Funnel templates",
                      "Prewritten email & SMS flows",
                      "CRM pipelines",
                      "Booking systems",
                      "Review automation",
                      "Dashboards",
                    ].map((item, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Why Clients Love It */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto space-y-12">
            <div className="text-center space-y-4">
              <h2 className="text-4xl md:text-5xl font-bold">
                Why Clients Love Powerapp
              </h2>
            </div>
            
            <div className="grid gap-6">
              {benefits.map((benefit, index) => (
                <Card key={index} className="hover-elevate transition-all duration-300" data-testid={`benefit-card-${index}`}>
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="bg-primary/10 p-3 rounded-full">
                      <CheckCircle2 className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-lg font-medium">{benefit}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto space-y-12">
            <div className="text-center space-y-4">
              <h2 className="text-4xl md:text-5xl font-bold">
                Pricing & Inclusions
              </h2>
              <p className="text-xl text-muted-foreground">
                All plans include OnSpot support and quarterly optimization sessions.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              {pricingPlans.map((plan, index) => (
                <Card 
                  key={index} 
                  className={`hover-elevate transition-all duration-300 ${
                    plan.popular ? 'border-primary border-2 shadow-lg' : ''
                  }`}
                  data-testid={`pricing-card-${index}`}
                >
                  {plan.popular && (
                    <div className="bg-primary text-primary-foreground text-center py-2 text-sm font-semibold">
                      Most Popular
                    </div>
                  )}
                  <CardContent className="p-8 space-y-6">
                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold">{plan.name}</h3>
                      <p className="text-muted-foreground">{plan.description}</p>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold">{plan.price}</span>
                        {plan.period && <span className="text-muted-foreground">{plan.period}</span>}
                      </div>
                      <p className="text-sm text-muted-foreground">{plan.whoFor}</p>
                    </div>
                    
                    <div className="space-y-3 pt-4 border-t">
                      {plan.features.map((feature, featureIndex) => (
                        <div key={featureIndex} className="flex items-start gap-2">
                          <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>
                    
                    <Button 
                      className="w-full" 
                      variant={plan.popular ? "default" : "outline"}
                      asChild
                      data-testid={`button-pricing-${index}`}
                    >
                      <Link href="/lead-intake">
                        {plan.price === "Custom" ? "Contact Us" : "Get Started"}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* OnSpot Advantage */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto space-y-12">
            <div className="text-center space-y-4">
              <h2 className="text-4xl md:text-5xl font-bold">
                The OnSpot Advantage
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Unlike standard GoHighLevel resellers, OnSpot customizes Powerapp with proprietary automation 
                frameworks, sales funnels, and SOP playbooks built from decades of BPO and tech experience.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              {[
                {
                  icon: Users,
                  title: "Personalized Onboarding",
                  description: "Custom automation map tailored to your business"
                },
                {
                  icon: Workflow,
                  title: "Prebuilt Flows",
                  description: "Lead → call → close workflows ready to deploy"
                },
                {
                  icon: Bot,
                  title: "AI Assistant Vanessa",
                  description: "Setup help and ongoing optimization support"
                },
                {
                  icon: BarChart3,
                  title: "Regular System Audits",
                  description: "Ensure your system scales with you"
                },
              ].map((item, index) => (
                <Card key={index} className="hover-elevate transition-all duration-300" data-testid={`advantage-card-${index}`}>
                  <CardContent className="p-6 flex items-start gap-4">
                    <div className="bg-primary/10 p-3 rounded-lg">
                      <item.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <h3 className="text-lg font-semibold">{item.title}</h3>
                      <p className="text-muted-foreground">{item.description}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Security & Compliance */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="bg-primary/10 p-4 rounded-full">
                  <Shield className="h-12 w-12 text-primary" />
                </div>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold">
                Security & Compliance
              </h2>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6 text-left">
              {[
                "2FA, user roles, audit trails",
                "GDPR / CAN-SPAM / TCPA compliant",
                "Opt-in & consent tracking",
                "Data retention policies",
                "A2P 10DLC registration for SMS deliverability",
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <h2 className="text-4xl md:text-5xl font-bold">
              Your Business, Powered by OnSpot
            </h2>
            
            <p className="text-xl opacity-95">
              We don't just give you software — We give you a System that Sells, Serves, and Scales.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button 
                size="lg" 
                variant="secondary" 
                className="text-lg px-8"
                asChild
                data-testid="button-cta-primary"
              >
                <Link href="/lead-intake">
                  Activate Your Free Powerapp
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
            
            <p className="text-sm opacity-90">
              Visit onspotglobal.com/powerapp or message your Account Manager to activate your complimentary Powerapp seat today.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
