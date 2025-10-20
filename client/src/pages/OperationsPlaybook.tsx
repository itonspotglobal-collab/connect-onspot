import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HeadSEO } from "@/components/HeadSEO";
import { 
  Brain, 
  Users, 
  Cog, 
  Lightbulb, 
  Target, 
  TrendingUp, 
  Zap, 
  Shield, 
  Award, 
  Rocket,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Clock,
  BarChart3,
  MessageSquare,
  AlertTriangle,
  FileCheck,
  UserCheck,
  Calendar,
  Settings
} from "lucide-react";
import { Card } from "@/components/ui/card";

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] }
};

export default function OperationsPlaybook() {
  return (
    <>
      <HeadSEO
        title="Operations Playbook | OnSpot Global"
        description="OnSpot Global's complete Delivery Playbook — our 4P Operating System, delivery models, client journey, and performance excellence framework."
      />

      <div className="min-h-screen bg-gradient-to-b from-white via-gray-50/50 to-white dark:from-gray-950 dark:via-gray-900/50 dark:to-gray-950">
        {/* Hero Section with Premium Gradient */}
        <motion.section 
          className="relative overflow-hidden"
          initial="initial"
          animate="animate"
          variants={staggerContainer}
        >
          {/* Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600/10 via-blue-600/5 to-purple-600/10 dark:from-violet-600/20 dark:via-blue-600/10 dark:to-purple-600/20"></div>
          
          {/* Animated Orbs */}
          <div className="absolute top-20 right-1/4 w-72 h-72 bg-violet-500/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-700"></div>
          
          <div className="relative container mx-auto px-6 sm:px-8 max-w-6xl py-24 sm:py-32 lg:py-40">
            <div className="text-center space-y-8">
              <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-100 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700">
                <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                <span className="text-sm font-medium text-violet-700 dark:text-violet-300">Excellence in Delivery</span>
              </motion.div>
              
              <motion.h1 
                className="text-5xl sm:text-6xl lg:text-7xl font-bold bg-gradient-to-r from-gray-900 via-violet-800 to-blue-900 dark:from-white dark:via-violet-200 dark:to-blue-200 bg-clip-text text-transparent leading-tight"
                variants={fadeUp}
              >
                Operations Playbook
              </motion.h1>
              
              <motion.p 
                className="text-xl sm:text-2xl lg:text-3xl text-gray-600 dark:text-gray-300 font-light max-w-3xl mx-auto"
                variants={fadeUp}
              >
                Our Engine for Execution
              </motion.p>

              <motion.p
                className="text-base sm:text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed"
                variants={fadeUp}
              >
                A comprehensive framework that transforms outsourcing complexity into operational excellence through proven systems and methodologies.
              </motion.p>
            </div>
          </div>
        </motion.section>

        {/* Main Content */}
        <div className="container mx-auto px-6 sm:px-8 max-w-6xl py-16 sm:py-20 space-y-20 sm:space-y-28">
          
          {/* 4P Operating System - Icon Cards */}
          <motion.section 
            className="space-y-12"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
          >
            <div className="text-center space-y-4">
              <motion.h2 
                className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white"
                variants={fadeUp}
              >
                4P Operating System
              </motion.h2>
              <motion.p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto" variants={fadeUp}>
                At OnSpot Global, our promise is simple: <span className="font-semibold text-violet-600 dark:text-violet-400">Outsourcing Made Easy</span>. 
                We achieve this through our unique 4P Operating System.
              </motion.p>
            </div>

            <motion.div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6" variants={fadeUp}>
              {/* Philosophy */}
              <Card className="p-8 hover-elevate group bg-gradient-to-br from-violet-50 to-white dark:from-violet-950/50 dark:to-gray-900 border-violet-200 dark:border-violet-800">
                <div className="space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Brain className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Philosophy</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    Our mindset drives exceptional value through core values and unwavering commitment to excellence.
                  </p>
                  <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-violet-600 mt-0.5 flex-shrink-0" />
                      <span>Trust & transparency</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-violet-600 mt-0.5 flex-shrink-0" />
                      <span>Extreme ownership</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-violet-600 mt-0.5 flex-shrink-0" />
                      <span>Continuous innovation</span>
                    </li>
                  </ul>
                </div>
              </Card>

              {/* People */}
              <Card className="p-8 hover-elevate group bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/50 dark:to-gray-900 border-blue-200 dark:border-blue-800">
                <div className="space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Users className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">People</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    Our greatest asset - both our client partners and high-performing talent ecosystem.
                  </p>
                  <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span>Collaborative partnerships</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span>Top-grading excellence</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span>Empowering culture</span>
                    </li>
                  </ul>
                </div>
              </Card>

              {/* Process */}
              <Card className="p-8 hover-elevate group bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/50 dark:to-gray-900 border-emerald-200 dark:border-emerald-800">
                <div className="space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Cog className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Process</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    Clear, scalable, and adaptable processes that turn complexity into simplicity.
                  </p>
                  <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span>7-step implementation</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span>PACE optimization</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span>Continuous refinement</span>
                    </li>
                  </ul>
                </div>
              </Card>

              {/* Problem Solving */}
              <Card className="p-8 hover-elevate group bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/50 dark:to-gray-900 border-amber-200 dark:border-amber-800">
                <div className="space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Lightbulb className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Problem Solving</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    We anticipate, innovate, and solve - transforming challenges into opportunities.
                  </p>
                  <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <span>Early feedback loops</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <span>Data-driven insights</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <span>Innovation culture</span>
                    </li>
                  </ul>
                </div>
              </Card>
            </motion.div>
          </motion.section>

          {/* Delivery Service Models - Enhanced Comparison */}
          <motion.section 
            className="space-y-12"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
          >
            <div className="text-center space-y-4">
              <motion.h2 
                className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white"
                variants={fadeUp}
              >
                Delivery Service Models
              </motion.h2>
              <motion.p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto" variants={fadeUp}>
                Flexible service models designed to match your operational needs and scale with your business.
              </motion.p>
            </div>

            <motion.div className="grid lg:grid-cols-2 gap-8" variants={fadeUp}>
              {/* Resourced Services */}
              <Card className="p-10 hover-elevate bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50">
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Resourced Services</h3>
                      <p className="text-sm text-violet-600 dark:text-violet-400 font-medium">Talent-Focused Model</p>
                    </div>
                  </div>
                  
                  <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed">
                    OnSpot provides exceptional talent while you maintain operational control. Perfect for teams with existing management infrastructure.
                  </p>

                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <CheckCircle2 className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Client-Led Management</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Your team manages daily operations and performance</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <CheckCircle2 className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">TPS Performance Tracking</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Day 30, 60, 90 talent performance assessments</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <CheckCircle2 className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Quarterly Health Reviews</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Regular account check-ins and optimization</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <CheckCircle2 className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Cost-Effective</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Lower cost with higher client involvement</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      <span className="font-semibold text-gray-900 dark:text-white">Best for:</span> Organizations with established processes and management capacity
                    </p>
                  </div>
                </div>
              </Card>

              {/* Managed Services */}
              <Card className="p-10 hover-elevate bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-gray-900 border-2 border-blue-200 dark:border-blue-800 relative">
                <div className="absolute top-4 right-4">
                  <span className="px-3 py-1 rounded-full bg-blue-600 text-white text-xs font-semibold">Most Popular</span>
                </div>
                
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                      <Rocket className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Managed Services</h3>
                      <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Full-Service Model</p>
                    </div>
                  </div>
                  
                  <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed">
                    Complete operational management by OnSpot. We provide both talent and comprehensive management for end-to-end delivery.
                  </p>

                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">OnSpot-Led Operations</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Full DM/TM management with daily oversight</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Complete Implementation</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">7-step onboarding and operational setup</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Performance Dashboards</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Weekly/monthly reports with KPI tracking</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Comprehensive Support</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">QA reviews, coaching, and continuous improvement</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      <span className="font-semibold text-gray-900 dark:text-white">Best for:</span> Scaling teams seeking turnkey operational excellence
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          </motion.section>

          {/* Guiding Principles - Icon Grid */}
          <motion.section 
            className="space-y-12"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
          >
            <div className="text-center space-y-4">
              <motion.h2 
                className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white"
                variants={fadeUp}
              >
                Guiding Principles
              </motion.h2>
              <motion.p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto" variants={fadeUp}>
                Six core values that define our culture and guide every decision, action, and delivery.
              </motion.p>
            </div>

            <motion.div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6" variants={fadeUp}>
              <Card className="p-8 hover-elevate group">
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">People Centric</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    We put people first — our clients, our talent, and our team. Every decision prioritizes human impact.
                  </p>
                </div>
              </Card>

              <Card className="p-8 hover-elevate group">
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Beat Yesterday</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    We never settle; progress is our standard. Continuous improvement drives everything we do.
                  </p>
                </div>
              </Card>

              <Card className="p-8 hover-elevate group">
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Efficient Fast-Fast-Fast</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    Speed and precision drive our execution. We deliver results quickly without compromising quality.
                  </p>
                </div>
              </Card>

              <Card className="p-8 hover-elevate group">
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Integrity Matters</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    We do the right thing — always. Trust, transparency, and ethical responsibility guide us.
                  </p>
                </div>
              </Card>

              <Card className="p-8 hover-elevate group">
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Target className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Extreme Ownership</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    We take full responsibility for results. No excuses, only solutions and accountability.
                  </p>
                </div>
              </Card>

              <Card className="p-8 hover-elevate group">
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Award className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">We Are Intrapreneurs</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    We act like owners, driving growth and innovation. Initiative and business mindset fuel progress.
                  </p>
                </div>
              </Card>
            </motion.div>
          </motion.section>

          {/* Client Journey & SOPs - Enhanced Accordion */}
          <motion.section 
            className="space-y-12"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
          >
            <div className="text-center space-y-4">
              <motion.h2 
                className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white"
                variants={fadeUp}
              >
                Client Journey & SOPs
              </motion.h2>
              <motion.p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto" variants={fadeUp}>
                Structured processes and standard operating procedures that ensure consistent excellence at every touchpoint.
              </motion.p>
            </div>

            <motion.div variants={fadeUp}>
              <Accordion type="single" collapsible className="space-y-4">
                <AccordionItem 
                  value="implementation" 
                  className="bg-white dark:bg-gray-900 rounded-2xl border-2 border-gray-200 dark:border-gray-800 overflow-hidden hover-elevate" 
                  data-testid="accordion-implementation"
                >
                  <AccordionTrigger className="px-8 py-6 text-lg font-semibold text-gray-900 dark:text-white hover:no-underline group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                        <Rocket className="w-5 h-5 text-white" />
                      </div>
                      <span>Implementation Timeline & Workflow</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-8 pb-6 text-base leading-relaxed text-gray-600 dark:text-gray-400 space-y-6">
                    <p className="text-gray-700 dark:text-gray-300">Our 7-step implementation journey ensures readiness and alignment before launch:</p>
                    <div className="grid sm:grid-cols-2 gap-4">
                      {[
                        { step: "1", title: "Internal Kickoff", desc: "Team alignment and planning" },
                        { step: "2", title: "Client Kickoff", desc: "Requirements and expectations" },
                        { step: "3", title: "HR & Talent Onboarding", desc: "Recruitment and setup" },
                        { step: "4", title: "Training & Tech Setup", desc: "Systems and knowledge transfer" },
                        { step: "5", title: "Go-Live", desc: "Operational launch" },
                        { step: "6", title: "Monitoring", desc: "Performance tracking" },
                        { step: "7", title: "Handoff", desc: "Transition to steady state" }
                      ].map((item) => (
                        <div key={item.step} className="flex items-start gap-3 p-4 rounded-xl bg-violet-50 dark:bg-violet-950/30">
                          <div className="w-8 h-8 rounded-lg bg-violet-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                            {item.step}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">{item.title}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{item.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem 
                  value="kpi" 
                  className="bg-white dark:bg-gray-900 rounded-2xl border-2 border-gray-200 dark:border-gray-800 overflow-hidden hover-elevate" 
                  data-testid="accordion-kpi"
                >
                  <AccordionTrigger className="px-8 py-6 text-lg font-semibold text-gray-900 dark:text-white hover:no-underline">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 text-white" />
                      </div>
                      <span>KPI Discovery</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-8 pb-6 text-base leading-relaxed text-gray-600 dark:text-gray-400 space-y-4">
                    <p className="text-gray-700 dark:text-gray-300">We work with clients to identify, define, and track key performance indicators that align with their business objectives.</p>
                    <ul className="space-y-3">
                      {[
                        "Initial discovery sessions to understand success metrics",
                        "Definition of measurable KPIs with clear targets",
                        "Setup of tracking systems and dashboards",
                        "Regular review and optimization cycles"
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <ArrowRight className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem 
                  value="handoff" 
                  className="bg-white dark:bg-gray-900 rounded-2xl border-2 border-gray-200 dark:border-gray-800 overflow-hidden hover-elevate" 
                  data-testid="accordion-handoff"
                >
                  <AccordionTrigger className="px-8 py-6 text-lg font-semibold text-gray-900 dark:text-white hover:no-underline">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-white" />
                      </div>
                      <span>3-Month Handoff Process</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-8 pb-6 text-base leading-relaxed text-gray-600 dark:text-gray-400 space-y-4">
                    <p className="text-gray-700 dark:text-gray-300">A structured 90-day transition from implementation to steady-state operations.</p>
                    <div className="space-y-3">
                      {[
                        { day: "30", title: "First Checkpoint", desc: "Initial performance review and TPS" },
                        { day: "60", title: "Mid-Point Review", desc: "Progress assessment and adjustments" },
                        { day: "90", title: "Full Handoff", desc: "Transition to Account Manager and steady operations" }
                      ].map((item) => (
                        <div key={item.day} className="flex items-start gap-4 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
                          <div className="flex items-center gap-2">
                            <Clock className="w-5 h-5 text-emerald-600" />
                            <span className="font-bold text-emerald-600">Day {item.day}</span>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">{item.title}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{item.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem 
                  value="performance" 
                  className="bg-white dark:bg-gray-900 rounded-2xl border-2 border-gray-200 dark:border-gray-800 overflow-hidden hover-elevate" 
                  data-testid="accordion-performance"
                >
                  <AccordionTrigger className="px-8 py-6 text-lg font-semibold text-gray-900 dark:text-white hover:no-underline">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                        <UserCheck className="w-5 h-5 text-white" />
                      </div>
                      <span>Talent Performance Survey (TPS)</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-8 pb-6 text-base leading-relaxed text-gray-600 dark:text-gray-400 space-y-4">
                    <p className="text-gray-700 dark:text-gray-300">Our structured feedback system for continuous talent development.</p>
                    <ul className="space-y-3">
                      {[
                        "Applied on Day 30, 60, and 90 when KPIs are unavailable",
                        "Measures quality, productivity, communication, and collaboration",
                        "Identifies coaching opportunities and development needs",
                        "Stored in MS Teams for transparent record-keeping"
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem 
                  value="escalation" 
                  className="bg-white dark:bg-gray-900 rounded-2xl border-2 border-gray-200 dark:border-gray-800 overflow-hidden hover-elevate" 
                  data-testid="accordion-escalation"
                >
                  <AccordionTrigger className="px-8 py-6 text-lg font-semibold text-gray-900 dark:text-white hover:no-underline">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
                        <Settings className="w-5 h-5 text-white" />
                      </div>
                      <span>Performance Escalation & Coaching</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-8 pb-6 text-base leading-relaxed text-gray-600 dark:text-gray-400 space-y-4">
                    <p className="text-gray-700 dark:text-gray-300">Structured approach to addressing performance issues with care and accountability.</p>
                    <ul className="space-y-3">
                      {[
                        "Early identification through TPS and KPI tracking",
                        "Coaching sessions with documented action plans",
                        "Clear escalation path: TM → DM → Head of Delivery",
                        "Performance Improvement Plans (PIP) when needed"
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <ArrowRight className="w-5 h-5 text-rose-600 mt-0.5 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem 
                  value="nps" 
                  className="bg-white dark:bg-gray-900 rounded-2xl border-2 border-gray-200 dark:border-gray-800 overflow-hidden hover-elevate" 
                  data-testid="accordion-nps"
                >
                  <AccordionTrigger className="px-8 py-6 text-lg font-semibold text-gray-900 dark:text-white hover:no-underline">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-white" />
                      </div>
                      <span>Client Net Promoter Score (cNPS)</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-8 pb-6 text-base leading-relaxed text-gray-600 dark:text-gray-400 space-y-4">
                    <p className="text-gray-700 dark:text-gray-300">Measuring client satisfaction and loyalty through regular feedback.</p>
                    <ul className="space-y-3">
                      {[
                        "Quarterly surveys to all active clients",
                        "0-10 rating scale measuring likelihood to recommend",
                        "Qualitative feedback on strengths and improvements",
                        "Action planning based on feedback themes"
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem 
                  value="ews" 
                  className="bg-white dark:bg-gray-900 rounded-2xl border-2 border-gray-200 dark:border-gray-800 overflow-hidden hover-elevate" 
                  data-testid="accordion-ews"
                >
                  <AccordionTrigger className="px-8 py-6 text-lg font-semibold text-gray-900 dark:text-white hover:no-underline">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 text-white" />
                      </div>
                      <span>Early Warning System (EWS)</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-8 pb-6 text-base leading-relaxed text-gray-600 dark:text-gray-400 space-y-4">
                    <p className="text-gray-700 dark:text-gray-300">Proactive risk detection and mitigation framework.</p>
                    <ul className="space-y-3">
                      {[
                        "Automated tracking of key risk indicators",
                        "Red/Yellow/Green status classification",
                        "Immediate escalation protocols for critical issues",
                        "Root cause analysis and corrective action planning"
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem 
                  value="offboarding" 
                  className="bg-white dark:bg-gray-900 rounded-2xl border-2 border-gray-200 dark:border-gray-800 overflow-hidden hover-elevate" 
                  data-testid="accordion-offboarding"
                >
                  <AccordionTrigger className="px-8 py-6 text-lg font-semibold text-gray-900 dark:text-white hover:no-underline">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-500 to-slate-600 flex items-center justify-center">
                        <FileCheck className="w-5 h-5 text-white" />
                      </div>
                      <span>Client Offboarding</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-8 pb-6 text-base leading-relaxed text-gray-600 dark:text-gray-400 space-y-4">
                    <p className="text-gray-700 dark:text-gray-300">Ensuring smooth transitions when client engagements conclude.</p>
                    <ul className="space-y-3">
                      {[
                        "30-day notice period for proper knowledge transfer",
                        "Documentation handover and asset return",
                        "Exit interviews to capture feedback and learnings",
                        "Talent redeployment or graceful offboarding"
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <ArrowRight className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </motion.div>
          </motion.section>

          {/* Risk Management - Final Section */}
          <motion.section 
            className="space-y-12 pb-20"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
          >
            <div className="text-center space-y-4">
              <motion.h2 
                className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white"
                variants={fadeUp}
              >
                Risk Management Framework
              </motion.h2>
              <motion.p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto" variants={fadeUp}>
                Comprehensive approach to identifying, assessing, and mitigating risks across all client engagements.
              </motion.p>
            </div>

            <motion.div className="space-y-8" variants={fadeUp}>
              <Card className="p-10 bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50">
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Issue Escalation Protocol</h3>
                  </div>
                  
                  <p className="text-base text-gray-600 dark:text-gray-400">
                    Structured escalation ensures issues are resolved quickly and strategically:
                  </p>

                  <div className="grid sm:grid-cols-2 gap-4">
                    {[
                      { level: "1", role: "Team Manager", desc: "Operational issues and daily challenges" },
                      { level: "2", role: "Delivery Manager", desc: "Client-facing escalations and account concerns" },
                      { level: "3", role: "Head of Delivery", desc: "Strategic matters and performance issues" },
                      { level: "4", role: "Executive", desc: "Contract or partnership critical decisions" }
                    ].map((item) => (
                      <div key={item.level} className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-950/30">
                        <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                          L{item.level}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{item.role}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { 
                    title: "Operational Risks", 
                    color: "violet",
                    items: ["Performance degradation", "Resource availability", "Process compliance"] 
                  },
                  { 
                    title: "Client Risks", 
                    color: "blue",
                    items: ["Satisfaction decline", "Communication gaps", "Scope creep"] 
                  },
                  { 
                    title: "Talent Risks", 
                    color: "emerald",
                    items: ["Attrition indicators", "Skill gaps", "Engagement concerns"] 
                  },
                  { 
                    title: "Compliance Risks", 
                    color: "amber",
                    items: ["Regulatory changes", "Data security", "Contract adherence"] 
                  }
                ].map((category) => (
                  <Card key={category.title} className="p-6 hover-elevate">
                    <div className="space-y-4">
                      <h4 className="font-bold text-gray-900 dark:text-white">{category.title}</h4>
                      <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                        {category.items.map((item, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full bg-${category.color}-600 mt-2 flex-shrink-0`}></div>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </Card>
                ))}
              </div>
            </motion.div>
          </motion.section>

        </div>
      </div>
    </>
  );
}
