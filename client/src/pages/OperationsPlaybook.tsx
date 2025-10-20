import { motion, useScroll, useTransform } from "framer-motion";
import { useState, useEffect, useRef } from "react";
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
  Settings,
  Menu
} from "lucide-react";
import { Card } from "@/components/ui/card";

// Buttery smooth animation variants - Apple-inspired easing
const fadeUp = {
  initial: { opacity: 0, y: 30 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { 
      duration: 0.7, 
      ease: [0.25, 0.1, 0.25, 1] // cubic-bezier for smooth Apple-like motion
    }
  }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1
    }
  }
};

const scaleIn = {
  initial: { opacity: 0, scale: 0.92 },
  animate: { 
    opacity: 1, 
    scale: 1,
    transition: { 
      duration: 0.6, 
      ease: [0.25, 0.1, 0.25, 1]
    }
  }
};

// Scroll-triggered reveal animation
const scrollReveal = {
  initial: { opacity: 0, y: 40 },
  whileInView: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.8,
      ease: [0.25, 0.1, 0.25, 1]
    }
  },
  viewport: { once: true, margin: "-50px" }
};

export default function OperationsPlaybook() {
  const [activeSection, setActiveSection] = useState("top");
  const [isNavFixed, setIsNavFixed] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  
  const { scrollY } = useScroll();
  const opacity = useTransform(scrollY, [0, 100], [1, 0.9]);
  const scale = useTransform(scrollY, [0, 100], [1, 0.98]);

  // Navigation sections
  const sections = [
    { id: "4p", label: "4P System" },
    { id: "delivery", label: "Delivery Models" },
    { id: "journey", label: "Client Journey" },
    { id: "talent", label: "Talent Acquisition" },
    { id: "capacity", label: "Capacity Planning" },
    { id: "risk", label: "Risk Management" }
  ];

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 100;
      const y = element.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  // IntersectionObserver to detect when hero disappears
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // When hero is NOT intersecting (out of view), fix the nav to top
        setIsNavFixed(!entry.isIntersecting);
      },
      {
        threshold: 0,
        rootMargin: '-64px 0px 0px 0px' // Account for header height
      }
    );

    observer.observe(hero);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Track active section
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      
      // Check which section is in view
      sections.forEach(section => {
        const element = document.getElementById(section.id);
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top <= 200 && rect.bottom >= 200) {
            setActiveSection(section.id);
          }
        }
      });

      if (scrollPosition < 100) {
        setActiveSection("top");
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [sections]);

  return (
    <>
      <HeadSEO
        title="Operations Playbook | OnSpot"
        description="OnSpot's complete Delivery Playbook — our 4P Operating System, delivery models, client journey, and performance excellence framework."
      />

      <div className="min-h-screen bg-gradient-to-b from-white via-gray-50/30 to-white dark:from-gray-950 dark:via-gray-900/30 dark:to-gray-950 overflow-x-hidden">
        
        {/* Hero Section with Premium Gradient */}
        <motion.section 
          ref={heroRef}
          className="relative overflow-hidden"
          initial="initial"
          animate="animate"
          variants={staggerContainer}
          style={{ opacity, scale }}
        >
          {/* Gradient Background - responsive */}
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600/10 via-blue-600/5 to-purple-600/10 dark:from-violet-600/20 dark:via-blue-600/10 dark:to-purple-600/20"></div>
          
          {/* Animated Orbs - hide on mobile for performance */}
          <div className="hidden md:block absolute top-10 lg:top-20 right-1/4 w-48 h-48 lg:w-72 lg:h-72 bg-violet-500/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="hidden md:block absolute bottom-10 lg:bottom-20 left-1/4 w-64 h-64 lg:w-96 lg:h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-700"></div>
          
          <div className="relative container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl py-16 sm:py-20 md:py-28 lg:py-36">
            <div className="text-center space-y-6 sm:space-y-8">
              <motion.div 
                variants={fadeUp} 
                className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-violet-100 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700"
              >
                <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-violet-600 dark:text-violet-400" />
                <span className="text-xs sm:text-sm font-medium text-violet-700 dark:text-violet-300">Excellence in Delivery</span>
              </motion.div>
              
              <motion.h1 
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold bg-gradient-to-r from-gray-900 via-violet-800 to-blue-900 dark:from-white dark:via-violet-200 dark:to-blue-200 bg-clip-text text-transparent leading-tight px-4"
                variants={fadeUp}
              >
                Operations Playbook
              </motion.h1>
              
              <motion.p 
                className="text-lg sm:text-xl md:text-2xl lg:text-3xl text-gray-600 dark:text-gray-300 font-light max-w-3xl mx-auto px-4"
                variants={fadeUp}
              >
                Our Engine for Execution
              </motion.p>

              <motion.p
                className="text-sm sm:text-base lg:text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed px-4"
                variants={fadeUp}
              >
                A comprehensive framework that transforms outsourcing complexity into operational excellence through proven systems and methodologies.
              </motion.p>
            </div>
          </div>
        </motion.section>

        {/* Intelligent Sub-Nav - Floats to top when hero disappears */}
        <motion.div
          className={`
            z-50
            transition-all duration-500 ease-out
            ${isNavFixed 
              ? 'fixed top-0 left-0 right-0 shadow-xl shadow-black/10 dark:shadow-black/30' 
              : 'sticky top-16 md:top-[calc(4rem+0.5rem)]'
            }
          `}
          initial={{ opacity: 0, y: -20 }}
          animate={{ 
            opacity: 1,
            y: 0
          }}
          transition={{ 
            duration: 0.5, 
            ease: [0.25, 0.1, 0.25, 1]
          }}
        >
          <div className={`
            transition-all duration-500 ease-out
            ${isNavFixed 
              ? 'bg-white/80 dark:bg-zinc-950/80 py-3 md:py-4' 
              : 'bg-transparent py-2 md:py-3'
            }
            supports-[backdrop-filter]:backdrop-blur-xl
            border-b border-gray-200/50 dark:border-gray-700/50
          `}>
            <div className="flex justify-center px-3 md:px-6">
              <nav className={`
                transition-all duration-500 ease-out
                ${isNavFixed
                  ? 'bg-white/90 dark:bg-zinc-900/90 shadow-2xl shadow-violet-600/10'
                  : 'bg-white/70 dark:bg-zinc-900/70 shadow-lg shadow-black/5 dark:shadow-black/20'
                }
                supports-[backdrop-filter]:backdrop-blur-md
                border border-gray-200/50 dark:border-gray-700/50
                rounded-2xl
                px-2 py-2 md:px-3 md:py-2.5
                max-w-full
              `}>
                {/* Mobile: 44px tap targets with momentum scroll */}
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory overscroll-x-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
                  {sections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => scrollToSection(section.id)}
                      className={`
                        flex-shrink-0 snap-start
                        min-h-[44px] px-4 py-2.5 md:px-5 md:py-2.5
                        rounded-xl text-xs md:text-sm font-medium
                        transition-all duration-300 ease-out whitespace-nowrap
                        touch-manipulation
                        ${activeSection === section.id 
                          ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30 scale-[1.02] md:scale-105' 
                          : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/10 active:scale-95'
                        }
                      `}
                      data-testid={`nav-${section.id}`}
                    >
                      {section.label}
                    </button>
                  ))}
                </div>
              </nav>
            </div>
          </div>
        </motion.div>

        {/* Main Content */}
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl py-12 sm:py-16 lg:py-20 space-y-16 sm:space-y-20 lg:space-y-28">
          
          {/* 4P Operating System - Icon Cards */}
          <motion.section 
            id="4p"
            className="space-y-10 sm:space-y-12 scroll-mt-32"
            {...scrollReveal}
          >
            <div className="text-center space-y-3 sm:space-y-4">
              <motion.h2 
                className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white px-4"
                variants={fadeUp}
              >
                4P Operating System
              </motion.h2>
              <motion.p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto px-4" variants={fadeUp}>
                At OnSpot, our promise is simple: <span className="font-semibold text-violet-600 dark:text-violet-400">Outsourcing Made Easy</span>. 
                We achieve this through our unique 4P Operating System.
              </motion.p>
            </div>

            <motion.div 
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6"
              variants={staggerContainer}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true, margin: "-50px" }}
            >
              {/* Philosophy */}
              <motion.div variants={scaleIn}>
                <Card className="p-6 sm:p-8 hover-elevate group bg-gradient-to-br from-violet-50 to-white dark:from-violet-950/50 dark:to-gray-900 border-violet-200 dark:border-violet-800 h-full transition-all duration-500">
                  <div className="space-y-3 sm:space-y-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 ease-out">
                      <Brain className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Philosophy</h3>
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
              </motion.div>

              {/* People */}
              <motion.div variants={scaleIn}>
                <Card className="p-6 sm:p-8 hover-elevate group bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/50 dark:to-gray-900 border-blue-200 dark:border-blue-800 h-full transition-all duration-500">
                  <div className="space-y-3 sm:space-y-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 ease-out">
                      <Users className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">People</h3>
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
              </motion.div>

              {/* Process */}
              <motion.div variants={scaleIn}>
                <Card className="p-6 sm:p-8 hover-elevate group bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/50 dark:to-gray-900 border-emerald-200 dark:border-emerald-800 h-full transition-all duration-500">
                  <div className="space-y-3 sm:space-y-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 ease-out">
                      <Cog className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Process</h3>
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
              </motion.div>

              {/* Problem Solving */}
              <motion.div variants={scaleIn}>
                <Card className="p-6 sm:p-8 hover-elevate group bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/50 dark:to-gray-900 border-amber-200 dark:border-amber-800 h-full transition-all duration-500">
                  <div className="space-y-3 sm:space-y-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 ease-out">
                      <Lightbulb className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Problem Solving</h3>
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
            </motion.div>
          </motion.section>

          {/* Delivery Service Models - Enhanced Comparison */}
          <motion.section 
            id="delivery"
            className="space-y-10 sm:space-y-12 scroll-mt-32"
            {...scrollReveal}
          >
            <div className="text-center space-y-3 sm:space-y-4">
              <motion.h2 
                className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white px-4"
                variants={fadeUp}
              >
                Delivery Service Models
              </motion.h2>
              <motion.p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto px-4" variants={fadeUp}>
                Flexible service models designed to match your operational needs and scale with your business.
              </motion.p>
            </div>

            <motion.div 
              className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8"
              variants={staggerContainer}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true, margin: "-50px" }}
            >
              {/* Resourced Services */}
              <motion.div variants={scaleIn}>
                <Card className="p-8 sm:p-10 hover-elevate bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50 h-full transition-all duration-500">
                  <div className="space-y-5 sm:space-y-6">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                        <Users className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Resourced Services</h3>
                        <p className="text-xs sm:text-sm text-violet-600 dark:text-violet-400 font-medium">Talent-Focused Model</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Users className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">You Lead, We Support</p>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">Direct oversight of talent while we manage HR, payroll, and compliance.</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Target className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">Best For</p>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">Teams needing talent augmentation with specific workflows already in place.</p>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">Key Benefits</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="flex items-center gap-2 text-xs sm:text-sm">
                            <CheckCircle2 className="w-3.5 h-3.5 text-violet-600 flex-shrink-0" />
                            <span className="text-gray-700 dark:text-gray-300">Direct control</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs sm:text-sm">
                            <CheckCircle2 className="w-3.5 h-3.5 text-violet-600 flex-shrink-0" />
                            <span className="text-gray-700 dark:text-gray-300">Fast scaling</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs sm:text-sm">
                            <CheckCircle2 className="w-3.5 h-3.5 text-violet-600 flex-shrink-0" />
                            <span className="text-gray-700 dark:text-gray-300">Lower overhead</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs sm:text-sm">
                            <CheckCircle2 className="w-3.5 h-3.5 text-violet-600 flex-shrink-0" />
                            <span className="text-gray-700 dark:text-gray-300">Flexible teams</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>

              {/* Managed Services */}
              <motion.div variants={scaleIn}>
                <Card className="p-8 sm:p-10 hover-elevate bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-gray-900 border-blue-200 dark:border-blue-800 h-full transition-all duration-500">
                  <div className="space-y-5 sm:space-y-6">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
                        <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Managed Services</h3>
                        <p className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 font-medium">Outcome-Focused Model</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Shield className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">We Own, You Grow</p>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">Full process ownership with dedicated teams and guaranteed outcomes.</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Target className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">Best For</p>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">Organizations seeking complete delegation with KPI-driven results.</p>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-blue-200 dark:border-blue-800">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">Key Benefits</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="flex items-center gap-2 text-xs sm:text-sm">
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                            <span className="text-gray-700 dark:text-gray-300">Zero management</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs sm:text-sm">
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                            <span className="text-gray-700 dark:text-gray-300">SLA guarantees</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs sm:text-sm">
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                            <span className="text-gray-700 dark:text-gray-300">Process optimization</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs sm:text-sm">
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                            <span className="text-gray-700 dark:text-gray-300">Strategic focus</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            </motion.div>
          </motion.section>

          {/* Client Journey & SOPs - Accordion Section */}
          <motion.section 
            id="journey"
            className="space-y-10 sm:space-y-12 scroll-mt-32"
            {...scrollReveal}
          >
            <div className="text-center space-y-3 sm:space-y-4">
              <motion.h2 
                className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white px-4"
                variants={fadeUp}
              >
                Client Journey & SOPs
              </motion.h2>
              <motion.p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto px-4" variants={fadeUp}>
                Structured processes ensuring consistent excellence from onboarding to continuous improvement.
              </motion.p>
            </div>

            <motion.div variants={fadeUp}>
              <Accordion type="single" collapsible className="space-y-4 sm:space-y-6">
                <AccordionItem 
                  value="scoping" 
                  className="bg-white dark:bg-gray-900 rounded-2xl border-2 border-gray-200 dark:border-gray-800 overflow-hidden hover-elevate transition-all duration-300" 
                  data-testid="accordion-scoping"
                >
                  <AccordionTrigger className="px-6 sm:px-8 py-5 sm:py-6 text-base sm:text-lg font-semibold text-gray-900 dark:text-white hover:no-underline">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                        <FileCheck className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      </div>
                      <span>Scoping & Solutioning</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 sm:px-8 pb-5 sm:pb-6 text-sm sm:text-base leading-relaxed text-gray-600 dark:text-gray-400 space-y-4">
                    <p className="text-gray-700 dark:text-gray-300">Discovery sessions to deeply understand your business needs, challenges, and goals.</p>
                    <ul className="space-y-2 sm:space-y-3">
                      {[
                        "Deep-dive into business objectives and pain points",
                        "Scope definition and requirements gathering",
                        "Solution design tailored to your unique context",
                        "Resource planning and timeline estimation"
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2 sm:gap-3">
                          <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-violet-600 mt-0.5 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem 
                  value="timeline" 
                  className="bg-white dark:bg-gray-900 rounded-2xl border-2 border-gray-200 dark:border-gray-800 overflow-hidden hover-elevate transition-all duration-300" 
                  data-testid="accordion-timeline"
                >
                  <AccordionTrigger className="px-6 sm:px-8 py-5 sm:py-6 text-base sm:text-lg font-semibold text-gray-900 dark:text-white hover:no-underline">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
                        <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      </div>
                      <span>Implementation Timeline & Workflow</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 sm:px-8 pb-5 sm:pb-6 text-sm sm:text-base leading-relaxed text-gray-600 dark:text-gray-400 space-y-4 sm:space-y-6">
                    <p className="text-gray-700 dark:text-gray-300">Our 7-step implementation journey ensures readiness and alignment before launch:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      {[
                        { step: "1", title: "Internal Kickoff", desc: "Team alignment and planning" },
                        { step: "2", title: "Client Kickoff", desc: "Requirements and expectations" },
                        { step: "3", title: "HR & Talent Onboarding", desc: "Recruitment and setup" },
                        { step: "4", title: "Training & Tech Setup", desc: "Systems and knowledge transfer" },
                        { step: "5", title: "Go-Live", desc: "Operational launch" },
                        { step: "6", title: "Monitoring", desc: "Performance tracking" },
                        { step: "7", title: "Handoff", desc: "Transition to steady state" }
                      ].map((item) => (
                        <div key={item.step} className="flex items-start gap-3 p-3 sm:p-4 rounded-xl bg-violet-50 dark:bg-violet-950/30 transition-colors">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-violet-600 text-white flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0">
                            {item.step}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">{item.title}</p>
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{item.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem 
                  value="kpi" 
                  className="bg-white dark:bg-gray-900 rounded-2xl border-2 border-gray-200 dark:border-gray-800 overflow-hidden hover-elevate transition-all duration-300" 
                  data-testid="accordion-kpi"
                >
                  <AccordionTrigger className="px-6 sm:px-8 py-5 sm:py-6 text-base sm:text-lg font-semibold text-gray-900 dark:text-white hover:no-underline">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
                        <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      </div>
                      <span>KPI Discovery</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 sm:px-8 pb-5 sm:pb-6 text-sm sm:text-base leading-relaxed text-gray-600 dark:text-gray-400 space-y-4">
                    <p className="text-gray-700 dark:text-gray-300">We work with clients to identify, define, and track key performance indicators that align with their business objectives.</p>
                    <ul className="space-y-2 sm:space-y-3">
                      {[
                        "Initial discovery sessions to understand success metrics",
                        "Definition of measurable KPIs with clear targets",
                        "Setup of tracking systems and dashboards",
                        "Regular review and optimization cycles"
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2 sm:gap-3">
                          <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem 
                  value="handoff" 
                  className="bg-white dark:bg-gray-900 rounded-2xl border-2 border-gray-200 dark:border-gray-800 overflow-hidden hover-elevate transition-all duration-300" 
                  data-testid="accordion-handoff"
                >
                  <AccordionTrigger className="px-6 sm:px-8 py-5 sm:py-6 text-base sm:text-lg font-semibold text-gray-900 dark:text-white hover:no-underline">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
                        <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      </div>
                      <span>3-Month Handoff Process</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 sm:px-8 pb-5 sm:pb-6 text-sm sm:text-base leading-relaxed text-gray-600 dark:text-gray-400 space-y-4">
                    <p className="text-gray-700 dark:text-gray-300">A structured 90-day transition from implementation to steady-state operations.</p>
                    <div className="space-y-2 sm:space-y-3">
                      {[
                        { day: "30", title: "First Checkpoint", desc: "Initial performance review and TPS" },
                        { day: "60", title: "Mid-Point Review", desc: "Progress assessment and adjustments" },
                        { day: "90", title: "Full Handoff", desc: "Transition to Account Manager and steady operations" }
                      ].map((item) => (
                        <div key={item.day} className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 flex-shrink-0" />
                            <span className="font-bold text-emerald-600 text-sm sm:text-base whitespace-nowrap">Day {item.day}</span>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">{item.title}</p>
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{item.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem 
                  value="performance" 
                  className="bg-white dark:bg-gray-900 rounded-2xl border-2 border-gray-200 dark:border-gray-800 overflow-hidden hover-elevate transition-all duration-300" 
                  data-testid="accordion-performance"
                >
                  <AccordionTrigger className="px-6 sm:px-8 py-5 sm:py-6 text-base sm:text-lg font-semibold text-gray-900 dark:text-white hover:no-underline">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                        <UserCheck className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      </div>
                      <span>Talent Performance Survey (TPS)</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 sm:px-8 pb-5 sm:pb-6 text-sm sm:text-base leading-relaxed text-gray-600 dark:text-gray-400 space-y-4">
                    <p className="text-gray-700 dark:text-gray-300">Our structured feedback system for continuous talent development.</p>
                    <ul className="space-y-2 sm:space-y-3">
                      {[
                        "Applied on Day 30, 60, and 90 when KPIs are unavailable",
                        "Measures quality, productivity, communication, and collaboration",
                        "Identifies coaching opportunities and development needs",
                        "Stored in MS Teams for transparent record-keeping"
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2 sm:gap-3">
                          <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem 
                  value="escalation" 
                  className="bg-white dark:bg-gray-900 rounded-2xl border-2 border-gray-200 dark:border-gray-800 overflow-hidden hover-elevate transition-all duration-300" 
                  data-testid="accordion-escalation"
                >
                  <AccordionTrigger className="px-6 sm:px-8 py-5 sm:py-6 text-base sm:text-lg font-semibold text-gray-900 dark:text-white hover:no-underline">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center flex-shrink-0">
                        <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      </div>
                      <span>Performance Escalation & Coaching</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 sm:px-8 pb-5 sm:pb-6 text-sm sm:text-base leading-relaxed text-gray-600 dark:text-gray-400 space-y-4">
                    <p className="text-gray-700 dark:text-gray-300">Structured approach to addressing performance issues with care and accountability.</p>
                    <ul className="space-y-2 sm:space-y-3">
                      {[
                        "Early identification through TPS and KPI tracking",
                        "Coaching sessions with documented action plans",
                        "Clear escalation path: TM → DM → Head of Delivery",
                        "Performance Improvement Plans (PIP) when needed"
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2 sm:gap-3">
                          <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600 mt-0.5 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem 
                  value="nps" 
                  className="bg-white dark:bg-gray-900 rounded-2xl border-2 border-gray-200 dark:border-gray-800 overflow-hidden hover-elevate transition-all duration-300" 
                  data-testid="accordion-nps"
                >
                  <AccordionTrigger className="px-6 sm:px-8 py-5 sm:py-6 text-base sm:text-lg font-semibold text-gray-900 dark:text-white hover:no-underline">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                        <Award className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      </div>
                      <span>Net Promoter Score (NPS)</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 sm:px-8 pb-5 sm:pb-6 text-sm sm:text-base leading-relaxed text-gray-600 dark:text-gray-400 space-y-4">
                    <p className="text-gray-700 dark:text-gray-300">Measuring client satisfaction and loyalty through regular feedback.</p>
                    <ul className="space-y-2 sm:space-y-3">
                      {[
                        "Quarterly surveys to all active clients",
                        "0-10 rating scale measuring likelihood to recommend",
                        "Qualitative feedback on strengths and improvements",
                        "Action planning based on feedback themes"
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2 sm:gap-3">
                          <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem 
                  value="ews" 
                  className="bg-white dark:bg-gray-900 rounded-2xl border-2 border-gray-200 dark:border-gray-800 overflow-hidden hover-elevate transition-all duration-300" 
                  data-testid="accordion-ews"
                >
                  <AccordionTrigger className="px-6 sm:px-8 py-5 sm:py-6 text-base sm:text-lg font-semibold text-gray-900 dark:text-white hover:no-underline">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      </div>
                      <span>Early Warning System (EWS)</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 sm:px-8 pb-5 sm:pb-6 text-sm sm:text-base leading-relaxed text-gray-600 dark:text-gray-400 space-y-4">
                    <p className="text-gray-700 dark:text-gray-300">Proactive risk detection and mitigation framework.</p>
                    <ul className="space-y-2 sm:space-y-3">
                      {[
                        "Automated tracking of key risk indicators",
                        "Red/Yellow/Green status classification",
                        "Immediate escalation protocols for critical issues",
                        "Root cause analysis and corrective action planning"
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2 sm:gap-3">
                          <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 mt-0.5 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem 
                  value="offboarding" 
                  className="bg-white dark:bg-gray-900 rounded-2xl border-2 border-gray-200 dark:border-gray-800 overflow-hidden hover-elevate transition-all duration-300" 
                  data-testid="accordion-offboarding"
                >
                  <AccordionTrigger className="px-6 sm:px-8 py-5 sm:py-6 text-base sm:text-lg font-semibold text-gray-900 dark:text-white hover:no-underline">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-gray-500 to-slate-600 flex items-center justify-center flex-shrink-0">
                        <FileCheck className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      </div>
                      <span>Client Offboarding</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 sm:px-8 pb-5 sm:pb-6 text-sm sm:text-base leading-relaxed text-gray-600 dark:text-gray-400 space-y-4">
                    <p className="text-gray-700 dark:text-gray-300">Ensuring smooth transitions when client engagements conclude.</p>
                    <ul className="space-y-2 sm:space-y-3">
                      {[
                        "30-day notice period for proper knowledge transfer",
                        "Documentation handover and asset return",
                        "Exit interviews to capture feedback and learnings",
                        "Talent redeployment or graceful offboarding"
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2 sm:gap-3">
                          <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 mt-0.5 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </motion.div>
          </motion.section>

          {/* Talent Acquisition & Hiring Excellence */}
          <motion.section 
            id="talent"
            className="space-y-10 sm:space-y-12 scroll-mt-32"
            {...scrollReveal}
          >
            <div className="text-center space-y-3 sm:space-y-4">
              <motion.h2 
                className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white px-4"
                variants={fadeUp}
              >
                Talent Acquisition & Hiring Excellence
              </motion.h2>
              <motion.p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto px-4" variants={fadeUp}>
                Our systematic approach to identifying, evaluating, and selecting A Players through the Job Success Framework and Top Grading methodology.
              </motion.p>
            </div>

            {/* Job Success Framework Overview */}
            <motion.div variants={fadeUp}>
              <Card className="p-8 sm:p-10 bg-gradient-to-br from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 border-2 border-violet-200 dark:border-violet-800 transition-all duration-500">
                <div className="space-y-5 sm:space-y-6">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center flex-shrink-0">
                      <Target className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Job Success Framework</h3>
                      <p className="text-xs sm:text-sm text-violet-600 dark:text-violet-400 font-medium">Data-Driven Hiring Excellence</p>
                    </div>
                  </div>
                  
                  <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 leading-relaxed">
                    We consistently deliver A Players who excel in performance and align with client values. Our non-negotiable principle: 
                    <span className="font-bold text-violet-700 dark:text-violet-300"> Values and behavior alignment is mandatory</span> — skills gaps can be trained, values misalignment cannot be overlooked.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div className="p-3 sm:p-4 rounded-xl bg-white dark:bg-gray-900 border border-violet-200 dark:border-violet-800">
                      <div className="flex items-center gap-2 mb-2">
                        <Award className="w-4 h-4 sm:w-5 sm:h-5 text-violet-600 flex-shrink-0" />
                        <p className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">Job Success Profile</p>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Defines success factors, KPIs, and behavioral traits</p>
                    </div>
                    <div className="p-3 sm:p-4 rounded-xl bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />
                        <p className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">Top Grading Method</p>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Chronological interviews revealing success patterns</p>
                    </div>
                    <div className="p-3 sm:p-4 rounded-xl bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-800">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 flex-shrink-0" />
                        <p className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">GWC Principle</p>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Get It, Want It, Capacity to Do It</p>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* The 4 Rules of Hiring */}
            <motion.div className="space-y-6 sm:space-y-8" variants={fadeUp}>
              <div className="text-center">
                <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-3 px-4">The 4 Rules of Hiring</h3>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 px-4">Our core principles for identifying exceptional talent</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {[
                  {
                    num: "1",
                    title: "Hire for Will",
                    desc: "Seek candidates with ownership mindset, initiative, and growth mentality. Non-negotiable requirement.",
                    icon: Zap,
                    color: "rose"
                  },
                  {
                    num: "2",
                    title: "Match Core Values",
                    desc: "Strong cultural alignment is mandatory. Values misalignment = automatic disqualification.",
                    icon: Users,
                    color: "violet"
                  },
                  {
                    num: "3",
                    title: "Hire for Results",
                    desc: "Validate track record of measurable performance and proven impact across roles.",
                    icon: TrendingUp,
                    color: "blue"
                  },
                  {
                    num: "4",
                    title: "Hire for Skill",
                    desc: "Confirm technical and functional competencies. Skills can be trained with right foundation.",
                    icon: CheckCircle2,
                    color: "emerald"
                  }
                ].map((rule) => {
                  const Icon = rule.icon;
                  return (
                    <Card key={rule.num} className={`p-5 sm:p-6 hover-elevate group bg-gradient-to-br from-${rule.color}-50 to-white dark:from-${rule.color}-950/30 dark:to-gray-900 border-${rule.color}-200 dark:border-${rule.color}-800 transition-all duration-500`}>
                      <div className="space-y-3 sm:space-y-4">
                        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-${rule.color}-500 to-${rule.color}-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 ease-out`}>
                          <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                        </div>
                        <div>
                          <span className={`text-xs font-bold text-${rule.color}-600 dark:text-${rule.color}-400`}>RULE #{rule.num}</span>
                          <h4 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mt-1">{rule.title}</h4>
                        </div>
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                          {rule.desc}
                        </p>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </motion.div>

            {/* A Player vs Potential A Player */}
            <motion.div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8" variants={fadeUp}>
              {/* A Player */}
              <Card className="p-6 sm:p-8 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/30 dark:to-gray-900 border-2 border-amber-200 dark:border-amber-800 transition-all duration-500">
                <div className="space-y-5 sm:space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                      <Award className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">A Player</h4>
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Ready to Excel Immediately</p>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                    Consistently performs at top level, meets or exceeds expectations across all dimensions.
                  </p>

                  <div className="space-y-2">
                    {[
                      { label: "Get It", desc: "Fully understands role and business impact" },
                      { label: "Want It", desc: "Highly motivated, long-term commitment" },
                      { label: "Capacity", desc: "Independent high-level performance" },
                      { label: "Will & Values", desc: "Proactive, accountable, culture-aligned" },
                      { label: "Results", desc: "Proven track record of exceeding KPIs" },
                      { label: "Skills", desc: "Ready to contribute immediately" }
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs sm:text-sm">
                        <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-semibold text-gray-900 dark:text-white">{item.label}:</span>
                          <span className="text-gray-600 dark:text-gray-400 ml-1">{item.desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-amber-200 dark:border-amber-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      <span className="font-bold text-amber-700 dark:text-amber-300">Scorecard:</span> Typically scores 4–5 across all dimensions
                    </p>
                  </div>
                </div>
              </Card>

              {/* Potential A Player */}
              <Card className="p-6 sm:p-8 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-gray-900 border-2 border-blue-200 dark:border-blue-800 transition-all duration-500">
                <div className="space-y-5 sm:space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Potential A Player</h4>
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">High Growth Trajectory</p>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                    Shows strong potential with development and coaching. Values alignment is mandatory.
                  </p>

                  <div className="space-y-2">
                    {[
                      { label: "Get It", desc: "Understands role, may need minor guidance" },
                      { label: "Want It", desc: "Motivated and willing to grow" },
                      { label: "Capacity", desc: "Foundational skills, learns quickly" },
                      { label: "Will & Values", desc: "MUST score 4-5 (non-negotiable)", important: true },
                      { label: "Results", desc: "Demonstrates growth trajectory" },
                      { label: "Skills", desc: "Some gaps acceptable, trainable" }
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs sm:text-sm">
                        <CheckCircle2 className={`w-3.5 h-3.5 sm:w-4 sm:h-4 mt-0.5 flex-shrink-0 ${item.important ? 'text-rose-600' : 'text-blue-600'}`} />
                        <div>
                          <span className={`font-semibold ${item.important ? 'text-rose-700 dark:text-rose-300' : 'text-gray-900 dark:text-white'}`}>{item.label}:</span>
                          <span className="text-gray-600 dark:text-gray-400 ml-1">{item.desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-blue-200 dark:border-blue-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      <span className="font-bold text-blue-700 dark:text-blue-300">Scorecard:</span> Scores 3–5 in most areas, but 4–5 in Will & Core Values
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* 8-Step Hiring Process */}
            <motion.div className="space-y-6 sm:space-y-8" variants={fadeUp}>
              <div className="text-center">
                <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-3 px-4">8-Step Hiring Process</h3>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 px-4">Systematic approach ensuring quality and consistency</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {[
                  { 
                    step: "1", 
                    title: "Define the Role",
                    subtitle: "Job Success Profile",
                    desc: "Purpose, KPIs, responsibilities, values, and competencies",
                    color: "violet",
                    icon: FileCheck
                  },
                  { 
                    step: "2", 
                    title: "Sourcing & Screening",
                    subtitle: "Initial Evaluation",
                    desc: "Job posts, DISC assessments, and GWC validation",
                    color: "blue",
                    icon: Users
                  },
                  { 
                    step: "3", 
                    title: "Top Grading Interview",
                    subtitle: "Career Deep Dive",
                    desc: "Chronological review revealing performance patterns",
                    color: "emerald",
                    icon: MessageSquare
                  },
                  { 
                    step: "4", 
                    title: "Skills Assessment",
                    subtitle: "Capacity Validation",
                    desc: "Job simulations, case studies, technical tests",
                    color: "amber",
                    icon: CheckCircle2
                  },
                  { 
                    step: "5", 
                    title: "Culture Fit",
                    subtitle: "Values Alignment",
                    desc: "Behavioral interviews against core values (non-negotiable)",
                    color: "rose",
                    icon: Shield
                  },
                  { 
                    step: "6", 
                    title: "GWC + 4 Rules Scoring",
                    subtitle: "Data-Driven Decision",
                    desc: "Comprehensive evaluation across all dimensions",
                    color: "indigo",
                    icon: BarChart3
                  },
                  { 
                    step: "7", 
                    title: "Reference Check",
                    subtitle: "Validation",
                    desc: "Verify track record and values consistency",
                    color: "teal",
                    icon: UserCheck
                  },
                  { 
                    step: "8", 
                    title: "Panel Debrief",
                    subtitle: "Final Decision",
                    desc: "Data-based consensus using standardized toolkit",
                    color: "purple",
                    icon: Award
                  }
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <Card key={item.step} className="p-5 sm:p-6 hover-elevate group transition-all duration-500">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-${item.color}-500 to-${item.color}-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 ease-out flex-shrink-0`}>
                            <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                          </div>
                          <span className={`text-xl sm:text-2xl font-bold text-${item.color}-200 dark:text-${item.color}-900/20`}>{item.step}</span>
                        </div>
                        <div>
                          <h5 className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm">{item.title}</h5>
                          <p className={`text-xs font-medium text-${item.color}-600 dark:text-${item.color}-400`}>{item.subtitle}</p>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{item.desc}</p>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </motion.div>

            {/* Scoring System & Decision Guidelines */}
            <motion.div className="space-y-6 sm:space-y-8" variants={fadeUp}>
              <div className="text-center">
                <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-3 px-4">Candidate Scoring System</h3>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 px-4">Evidence-based evaluation framework (1-5 scale)</p>
              </div>

              <Card className="p-6 sm:p-8 bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50 transition-all duration-500">
                <div className="space-y-5 sm:space-y-6">
                  {/* Rating Scale */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
                    {[
                      { score: "5", label: "Exceeds", color: "emerald", desc: "Advanced skills, ready to lead" },
                      { score: "4", label: "Meets", color: "blue", desc: "Strong performer, minimal support" },
                      { score: "3", label: "Potential", color: "amber", desc: "Shows promise, needs training" },
                      { score: "2", label: "Gaps", color: "orange", desc: "Partial knowledge, limited readiness" },
                      { score: "1", label: "Not Aligned", color: "red", desc: "Insufficient fit for role" }
                    ].map((item) => (
                      <div key={item.score} className={`p-3 sm:p-4 rounded-xl bg-${item.color}-50 dark:bg-${item.color}-950/30 border border-${item.color}-200 dark:border-${item.color}-800 text-center transition-colors`}>
                        <div className={`text-xl sm:text-2xl font-bold text-${item.color}-600 dark:text-${item.color}-400 mb-1`}>{item.score}</div>
                        <div className={`text-xs sm:text-sm font-semibold text-${item.color}-700 dark:text-${item.color}-300 mb-1`}>{item.label}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 leading-tight">{item.desc}</div>
                      </div>
                    ))}
                  </div>

                  {/* Decision Rules */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-4 sm:pt-6 border-t border-gray-200 dark:border-gray-700">
                    <div className="p-3 sm:p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs sm:text-sm">A</div>
                        <p className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">A Player</p>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Scores 4–5 across all dimensions</p>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-2 font-medium">32-40 points → Highly Recommended</p>
                    </div>
                    
                    <div className="p-3 sm:p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs sm:text-sm">PA</div>
                        <p className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">Potential A Player</p>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Scores 3–5 most areas, 4–5 in Will & Values</p>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-2 font-medium">22-31 points → Recommended with Training</p>
                    </div>

                    <div className="p-3 sm:p-4 rounded-xl bg-red-50 dark:bg-red-950/30">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-red-600 text-white flex items-center justify-center font-bold text-xs sm:text-sm">✕</div>
                        <p className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">Reject</p>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Below 4 on Will or Core Values</p>
                      <p className="text-xs text-red-700 dark:text-red-300 mt-2 font-medium">&lt;18 points → Not Recommended</p>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Hiring Timeline */}
            <motion.div className="space-y-6 sm:space-y-8" variants={fadeUp}>
              <div className="text-center">
                <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-3 px-4">Accelerated Hiring Timeline</h3>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 px-4">Industry-leading speed without compromising quality</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
                {/* Common Roles Timeline */}
                <Card className="p-6 sm:p-8 bg-gradient-to-br from-violet-50 to-white dark:from-violet-950/30 dark:to-gray-900 border-2 border-violet-200 dark:border-violet-800 transition-all duration-500">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-violet-600 flex items-center justify-center flex-shrink-0">
                        <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-white text-base sm:text-lg">Common Roles</h4>
                        <p className="text-xs sm:text-sm text-violet-600 dark:text-violet-400">CSRs, Virtual Assistants</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 mb-4">
                      <div className="text-center">
                        <div className="text-2xl sm:text-3xl font-bold text-violet-600 dark:text-violet-400">14</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Days</div>
                      </div>
                      <div className="flex-1 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        With pre-existing talent pool & DISC results
                      </div>
                    </div>

                    <div className="space-y-2 text-xs sm:text-sm">
                      {[
                        "Day 1: JD & JSP Creation",
                        "Day 2-3: Candidate Matching",
                        "Day 4-5: Initial Interviews",
                        "Day 6-7: Client Interviews",
                        "Day 8: Selection Decision",
                        "Day 9: Offer Extension",
                        "Day 10-11: Background Check",
                        "Day 12-14: Onboarding"
                      ].map((item, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-violet-600 mt-0.5 flex-shrink-0" />
                          <span className="text-gray-600 dark:text-gray-400">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>

                {/* Specialized Roles Timeline */}
                <Card className="p-6 sm:p-8 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-gray-900 border-2 border-blue-200 dark:border-blue-800 transition-all duration-500">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
                        <Target className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-white text-base sm:text-lg">Specialized Roles</h4>
                        <p className="text-xs sm:text-sm text-blue-600 dark:text-blue-400">New Talent Pool Required</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 mb-4">
                      <div className="text-center">
                        <div className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400">30</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Days</div>
                      </div>
                      <div className="flex-1 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        Fresh sourcing with comprehensive evaluation
                      </div>
                    </div>

                    <div className="space-y-2 text-xs sm:text-sm">
                      {[
                        "Day 1: JD & JSP Creation",
                        "Day 2-4: Candidate Sourcing",
                        "Day 5-7: Initial Interviews",
                        "Day 8-10: Client Interviews",
                        "Day 11: Selection Finalization",
                        "Day 12-13: Offer & Negotiation",
                        "Day 14-20: Background Check",
                        "Day 21-30: Onboarding Process"
                      ].map((item, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                          <span className="text-gray-600 dark:text-gray-400">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              </div>
            </motion.div>

            {/* Quality Assurance */}
            <motion.div variants={fadeUp}>
              <Card className="p-8 sm:p-10 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-gray-900 border-2 border-emerald-200 dark:border-emerald-800 transition-all duration-500">
                <div className="space-y-5 sm:space-y-6">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
                      <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Quality Assurance & Continuous Improvement</h4>
                      <p className="text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 font-medium">Post-Hire Performance Tracking</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div className="p-3 sm:p-4 rounded-xl bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-800">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 flex-shrink-0" />
                        <p className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">90-Day Review</p>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Performance assessment against JSP criteria</p>
                    </div>
                    <div className="p-3 sm:p-4 rounded-xl bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-800">
                      <div className="flex items-center gap-2 mb-2">
                        <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 flex-shrink-0" />
                        <p className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">6-Month Analysis</p>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Long-term success and retention tracking</p>
                    </div>
                    <div className="p-3 sm:p-4 rounded-xl bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-800">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 flex-shrink-0" />
                        <p className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">Process Refinement</p>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Continuous optimization of scorecards and assessments</p>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          </motion.section>

          {/* Capacity Planning Framework */}
          <motion.section 
            id="capacity"
            className="space-y-10 sm:space-y-12 scroll-mt-32"
            {...scrollReveal}
          >
            <div className="text-center space-y-3 sm:space-y-4">
              <motion.h2 
                className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white px-4"
                variants={fadeUp}
              >
                Capacity Planning Framework
              </motion.h2>
              <motion.p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto px-4" variants={fadeUp}>
                Keeping OnSpot always ready to deliver — forecasting client demand, aligning people, and ensuring operational readiness.
              </motion.p>
            </div>

            {/* Core Principle */}
            <motion.div variants={fadeUp}>
              <Card className="p-8 sm:p-10 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border-2 border-indigo-200 dark:border-indigo-800 relative overflow-hidden transition-all duration-500">
                {/* Decorative elements - hide on mobile for performance */}
                <div className="hidden md:block absolute top-0 right-0 w-48 h-48 lg:w-64 lg:h-64 bg-indigo-500/10 rounded-full blur-3xl"></div>
                <div className="hidden md:block absolute bottom-0 left-0 w-32 h-32 lg:w-48 lg:h-48 bg-purple-500/10 rounded-full blur-3xl"></div>
                
                <div className="relative space-y-5 sm:space-y-6">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center flex-shrink-0">
                      <Rocket className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Core Principle</h3>
                      <p className="text-xs sm:text-sm text-indigo-600 dark:text-indigo-400 font-medium">Always Ready to Scale</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2 sm:space-y-3">
                    <p className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                      We don't react to client needs — we anticipate them.
                    </p>
                    <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 leading-relaxed">
                      Every Delivery Manager owns readiness 30 days ahead, ensuring we're positioned to scale seamlessly with zero delivery delays.
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* 5-Step Capacity Cycle */}
            <motion.div className="space-y-6 sm:space-y-8" variants={fadeUp}>
              <div className="text-center">
                <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-3 px-4">5-Step Capacity Cycle</h3>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 px-4">A continuous loop ensuring we're always ready to deliver</p>
              </div>

              <div className="relative">
                {/* Connection Lines for Desktop - hide on mobile */}
                <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-violet-200 via-blue-200 via-emerald-200 via-amber-200 to-rose-200 dark:from-violet-800 dark:via-blue-800 dark:via-emerald-800 dark:via-amber-800 dark:to-rose-800 -translate-y-1/2 -z-10"></div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
                  {[
                    { 
                      num: "1", 
                      title: "Forecast Demand", 
                      desc: "Client growth, FTE targets, expansion timelines",
                      owner: "Account Manager",
                      color: "violet",
                      icon: TrendingUp
                    },
                    { 
                      num: "2", 
                      title: "Assess Capacity", 
                      desc: "Compare forecast vs. active & available talent",
                      owner: "Delivery + TA",
                      color: "blue",
                      icon: BarChart3
                    },
                    { 
                      num: "3", 
                      title: "Align & Plan", 
                      desc: "Schedule hiring, training, and onboarding readiness",
                      owner: "Delivery + HR + TA",
                      color: "emerald",
                      icon: Users
                    },
                    { 
                      num: "4", 
                      title: "Deploy & Monitor", 
                      desc: "Track ramp speed, attrition, and readiness status",
                      owner: "Delivery Manager",
                      color: "amber",
                      icon: Rocket
                    },
                    { 
                      num: "5", 
                      title: "Review & Adjust", 
                      desc: "Monthly review, variance check, and escalation if needed",
                      owner: "Head of Delivery",
                      color: "rose",
                      icon: Target
                    }
                  ].map((step) => {
                    const Icon = step.icon;
                    return (
                      <Card key={step.num} className={`p-5 sm:p-6 hover-elevate group relative bg-gradient-to-br from-${step.color}-50 to-white dark:from-${step.color}-950/30 dark:to-gray-900 border-2 border-${step.color}-200 dark:border-${step.color}-800 transition-all duration-500`}>
                        <div className="space-y-3 sm:space-y-4">
                          <div className="flex items-start justify-between">
                            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-${step.color}-500 to-${step.color}-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 ease-out flex-shrink-0`}>
                              <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                            </div>
                            <span className={`text-2xl sm:text-3xl font-bold text-${step.color}-200 dark:text-${step.color}-900/20`}>{step.num}</span>
                          </div>
                          <div>
                            <h4 className="font-bold text-gray-900 dark:text-white mb-1 text-sm sm:text-base">{step.title}</h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-3">
                              {step.desc}
                            </p>
                            <div className="flex items-center gap-2 text-xs">
                              <div className={`w-2 h-2 rounded-full bg-${step.color}-600 flex-shrink-0`}></div>
                              <span className={`text-${step.color}-700 dark:text-${step.color}-300 font-medium`}>Owner: {step.owner}</span>
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>

                {/* Cycle Arrow - Mobile only */}
                <div className="lg:hidden flex items-center justify-center mt-4">
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="font-medium">Continuous Cycle</span>
                    <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Outcome */}
            <motion.div variants={fadeUp}>
              <Card className="p-8 sm:p-10 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border-2 border-blue-200 dark:border-blue-800 transition-all duration-500">
                <div className="space-y-5 sm:space-y-6">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Outcome</h4>
                      <p className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 font-medium">Predictable Excellence</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div className="p-3 sm:p-4 rounded-xl bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />
                        <p className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm">Predictable Scaling</p>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Ready to grow with client demand</p>
                    </div>
                    <div className="p-3 sm:p-4 rounded-xl bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />
                        <p className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm">Zero Delivery Delays</p>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Always ready, always on time</p>
                    </div>
                    <div className="p-3 sm:p-4 rounded-xl bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />
                        <p className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm">Full Team Alignment</p>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Delivery, TA, and HR in sync</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-blue-200 dark:border-blue-800">
                    <p className="text-center text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                      "Outsourcing Made Easy — <span className="text-blue-600 dark:text-blue-400">Fast. Efficient. Reliable.</span>"
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          </motion.section>

          {/* Risk Management - Final Section */}
          <motion.section 
            id="risk"
            className="space-y-10 sm:space-y-12 pb-16 sm:pb-20 scroll-mt-32"
            {...scrollReveal}
          >
            <div className="text-center space-y-3 sm:space-y-4">
              <motion.h2 
                className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white px-4"
                variants={fadeUp}
              >
                Risk Management Framework
              </motion.h2>
              <motion.p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto px-4" variants={fadeUp}>
                Comprehensive approach to identifying, assessing, and mitigating risks across all client engagements.
              </motion.p>
            </div>

            <motion.div className="space-y-6 sm:space-y-8" variants={fadeUp}>
              <Card className="p-8 sm:p-10 bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50 transition-all duration-500">
                <div className="space-y-5 sm:space-y-6">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Issue Escalation Protocol</h3>
                  </div>
                  
                  <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                    Structured escalation ensures issues are resolved quickly and strategically:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {[
                      { level: "1", role: "Team Manager", desc: "Operational issues and daily challenges" },
                      { level: "2", role: "Delivery Manager", desc: "Client-facing escalations and account concerns" },
                      { level: "3", role: "Head of Delivery", desc: "Strategic matters and performance issues" },
                      { level: "4", role: "Executive", desc: "Contract or partnership critical decisions" }
                    ].map((item) => (
                      <div key={item.level} className="flex items-start gap-3 p-3 sm:p-4 rounded-xl bg-red-50 dark:bg-red-950/30 transition-colors">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-red-600 text-white flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0">
                          L{item.level}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">{item.role}</p>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {[
                  {
                    title: "Risk Identification",
                    desc: "Early detection and documentation",
                    icon: AlertTriangle,
                    color: "red"
                  },
                  {
                    title: "Impact Assessment",
                    desc: "Severity and priority classification",
                    icon: BarChart3,
                    color: "orange"
                  },
                  {
                    title: "Mitigation Planning",
                    desc: "Actionable response strategies",
                    icon: Shield,
                    color: "amber"
                  },
                  {
                    title: "Continuous Monitoring",
                    desc: "Ongoing tracking and updates",
                    icon: Clock,
                    color: "emerald"
                  }
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <Card key={item.title} className={`p-5 sm:p-6 hover-elevate bg-gradient-to-br from-${item.color}-50 to-white dark:from-${item.color}-950/30 dark:to-gray-900 border-${item.color}-200 dark:border-${item.color}-800 transition-all duration-500`}>
                      <div className="space-y-3 sm:space-y-4">
                        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-${item.color}-500 to-${item.color}-600 flex items-center justify-center`}>
                          <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900 dark:text-white mb-2 text-sm sm:text-base">{item.title}</h4>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{item.desc}</p>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </motion.div>
          </motion.section>
        </div>
      </div>
    </>
  );
}
