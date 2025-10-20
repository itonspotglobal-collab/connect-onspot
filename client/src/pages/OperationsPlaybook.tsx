import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HeadSEO } from "@/components/HeadSEO";

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

export default function OperationsPlaybook() {
  return (
    <>
      <HeadSEO
        title="Operations Playbook | OnSpot Global"
        description="OnSpot Global's complete Delivery Playbook — our 4P Operating System, delivery models, client journey, and performance excellence framework."
      />

      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
        {/* Header Section */}
        <motion.section 
          className="relative overflow-hidden bg-gradient-to-br from-gray-100 via-white to-gray-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 py-24 sm:py-32"
          initial="initial"
          animate="animate"
          variants={staggerContainer}
        >
          <div className="container mx-auto px-6 sm:px-8 max-w-5xl">
            <motion.h1 
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6"
              variants={fadeUp}
            >
              Operations Playbook
            </motion.h1>
            <motion.p 
              className="text-xl sm:text-2xl text-gray-600 dark:text-gray-400 font-light"
              variants={fadeUp}
            >
              Our Engine for Execution
            </motion.p>
          </div>
        </motion.section>

        {/* Main Content */}
        <div className="container mx-auto px-6 sm:px-8 max-w-5xl py-16 sm:py-20 space-y-16 sm:space-y-24">
          
          {/* 4P Operating System */}
          <motion.section 
            className="space-y-6"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
          >
            <motion.h2 
              className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-white"
              variants={fadeUp}
            >
              4P Operating System
            </motion.h2>
            <motion.p className="text-base leading-relaxed text-gray-700 dark:text-gray-300" variants={fadeUp}>
              At OnSpot Global, our promise is simple: <strong>Outsourcing Made Easy</strong>.
            </motion.p>
            <motion.p className="text-base leading-relaxed text-gray-700 dark:text-gray-300" variants={fadeUp}>
              We achieve this through our unique 4P Operating System – Philosophy, People, Process, and Problem Solving. These four pillars guide how we work with our clients, empower our people, and deliver measurable results.
            </motion.p>

            <motion.div className="space-y-8 pt-4" variants={fadeUp}>
              {/* Philosophy */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Philosophy – Our Mindset</h3>
                <p className="text-base leading-relaxed text-gray-600 dark:text-gray-400">
                  Our philosophy defines why and how we do business. It is grounded in our core values: People Centric, Beat Yesterday, Efficient Fast-Fast-Fast, Integrity Matters, Extreme Ownership, and We Are Intrapreneurs.
                </p>
                <ul className="space-y-2 text-base text-gray-600 dark:text-gray-400 pl-6">
                  <li>• Creating lasting partnerships built on trust and transparency</li>
                  <li>• Operating with extreme ownership and accountability</li>
                  <li>• Continuously improving and innovating</li>
                  <li>• Acting with integrity in everything we do</li>
                </ul>
              </div>

              {/* People */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">People – Our Strength</h3>
                <p className="text-base leading-relaxed text-gray-600 dark:text-gray-400">
                  Our people are our greatest asset – both our clients and our high-performing talent.
                </p>
                <div className="grid sm:grid-cols-2 gap-6">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white mb-2">For Clients:</p>
                    <ul className="space-y-1 text-base text-gray-600 dark:text-gray-400">
                      <li>• Strong, collaborative partnerships</li>
                      <li>• Proactive check-ins through NPS tools</li>
                      <li>• Alignment with true business needs</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white mb-2">For Talent:</p>
                    <ul className="space-y-1 text-base text-gray-600 dark:text-gray-400">
                      <li>• Intentional hiring with top-grading</li>
                      <li>• Development through TPS and coaching</li>
                      <li>• Engaging, empowering culture</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Process */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Process – Our Engine for Execution</h3>
                <p className="text-base leading-relaxed text-gray-600 dark:text-gray-400">
                  We make outsourcing simple by building clear, scalable, and adaptable processes.
                </p>
                <ul className="space-y-2 text-base text-gray-600 dark:text-gray-400 pl-6">
                  <li>• 7-step Implementation Workflow ensuring readiness and alignment</li>
                  <li>• PACE Charting for maximum efficiency</li>
                  <li>• Journey-based design around client and talent experiences</li>
                  <li>• Clear accountability and continuous review</li>
                </ul>
              </div>

              {/* Problem Solving */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Problem Solving – Our Commitment to Solutions</h3>
                <p className="text-base leading-relaxed text-gray-600 dark:text-gray-400">
                  We don't just react – we anticipate, innovate, and solve.
                </p>
                <ul className="space-y-2 text-base text-gray-600 dark:text-gray-400 pl-6">
                  <li>• Regular feedback loops capturing issues early</li>
                  <li>• Data-driven insights using scorecards and KPIs</li>
                  <li>• Structured escalation for quick resolution</li>
                  <li>• Continuous learning and innovation</li>
                </ul>
              </div>
            </motion.div>
          </motion.section>

          {/* Delivery Service Models */}
          <motion.section 
            className="space-y-6"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
          >
            <motion.h2 
              className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-white"
              variants={fadeUp}
            >
              Delivery Service Models
            </motion.h2>

            <motion.div className="grid lg:grid-cols-2 gap-8" variants={fadeUp}>
              {/* Resourced Services */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Resourced Services Model</h3>
                <p className="text-base leading-relaxed text-gray-600 dark:text-gray-400">
                  OnSpot provides talent while the client manages daily operations. Our Delivery Manager oversees implementation and supports documentation.
                </p>
                <ul className="space-y-2 text-base text-gray-600 dark:text-gray-400 pl-6">
                  <li>• Client manages daily tasks and performance</li>
                  <li>• TPS applied on Day 30, 60, and 90</li>
                  <li>• Quarterly Account Health Reviews</li>
                  <li>• Optional shared Team Manager at scale</li>
                  <li>• Lower cost, higher client involvement</li>
                </ul>
              </div>

              {/* Managed Services */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Managed Services Model</h3>
                <p className="text-base leading-relaxed text-gray-600 dark:text-gray-400">
                  OnSpot provides both talent and operational management. Full ownership of implementation and daily operations.
                </p>
                <ul className="space-y-2 text-base text-gray-600 dark:text-gray-400 pl-6">
                  <li>• OnSpot manages operations via DM/TM</li>
                  <li>• Full 7-step implementation</li>
                  <li>• Weekly/monthly performance reports</li>
                  <li>• QA reviews, coaching, dashboards</li>
                  <li>• Higher cost, comprehensive support</li>
                </ul>
              </div>
            </motion.div>
          </motion.section>

          {/* Guiding Principles */}
          <motion.section 
            className="space-y-6"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
          >
            <motion.h2 
              className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-white"
              variants={fadeUp}
            >
              Guiding Principles
            </motion.h2>
            <motion.p className="text-base leading-relaxed text-gray-700 dark:text-gray-300" variants={fadeUp}>
              These core values guide the Delivery Team at OnSpot Global. They are the foundation of how we work, make decisions, and deliver value.
            </motion.p>

            <motion.div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6" variants={fadeUp}>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">People Centric</h3>
                <p className="text-base leading-relaxed text-gray-600 dark:text-gray-400">
                  We put people first — our clients, our talent, and our team.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Beat Yesterday</h3>
                <p className="text-base leading-relaxed text-gray-600 dark:text-gray-400">
                  We never settle; progress is our standard.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Efficient Fast-Fast-Fast</h3>
                <p className="text-base leading-relaxed text-gray-600 dark:text-gray-400">
                  Speed and precision drive our execution.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Integrity Matters</h3>
                <p className="text-base leading-relaxed text-gray-600 dark:text-gray-400">
                  We do the right thing — always.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Extreme Ownership</h3>
                <p className="text-base leading-relaxed text-gray-600 dark:text-gray-400">
                  We take full responsibility for the results.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">We Are Intrapreneurs</h3>
                <p className="text-base leading-relaxed text-gray-600 dark:text-gray-400">
                  We act like owners, driving growth and innovation.
                </p>
              </div>
            </motion.div>
          </motion.section>

          {/* Client Journey & SOPs - Accordion */}
          <motion.section 
            className="space-y-6"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
          >
            <motion.h2 
              className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-white"
              variants={fadeUp}
            >
              Client Journey & SOPs
            </motion.h2>

            <motion.div variants={fadeUp}>
              <Accordion type="single" collapsible className="space-y-4">
                <AccordionItem value="implementation" className="bg-white dark:bg-gray-900 rounded-lg px-6 hover-elevate" data-testid="accordion-implementation">
                  <AccordionTrigger className="text-lg font-medium text-gray-900 dark:text-white">
                    Implementation Timeline & Workflow
                  </AccordionTrigger>
                  <AccordionContent className="text-base leading-relaxed text-gray-600 dark:text-gray-400 space-y-4">
                    <p>Our 7-step implementation journey ensures readiness and alignment before launch:</p>
                    <ol className="space-y-2 pl-6">
                      <li>1. Internal Kickoff</li>
                      <li>2. Client Kickoff</li>
                      <li>3. HR & Talent Onboarding</li>
                      <li>4. Training & Tech Setup</li>
                      <li>5. Go-Live</li>
                      <li>6. Monitoring</li>
                      <li>7. Handoff</li>
                    </ol>
                    <p>Each step has clear deliverables, timelines, and accountability measures to ensure smooth transitions.</p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="kpi" className="bg-white dark:bg-gray-900 rounded-lg px-6 hover-elevate" data-testid="accordion-kpi">
                  <AccordionTrigger className="text-lg font-medium text-gray-900 dark:text-white">
                    KPI Discovery
                  </AccordionTrigger>
                  <AccordionContent className="text-base leading-relaxed text-gray-600 dark:text-gray-400 space-y-4">
                    <p>We work with clients to identify, define, and track key performance indicators that align with their business objectives.</p>
                    <ul className="space-y-2 pl-6">
                      <li>• Initial discovery sessions to understand success metrics</li>
                      <li>• Definition of measurable KPIs with clear targets</li>
                      <li>• Setup of tracking systems and dashboards</li>
                      <li>• Regular review and optimization cycles</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="handoff" className="bg-white dark:bg-gray-900 rounded-lg px-6 hover-elevate" data-testid="accordion-handoff">
                  <AccordionTrigger className="text-lg font-medium text-gray-900 dark:text-white">
                    3-Month Handoff Process
                  </AccordionTrigger>
                  <AccordionContent className="text-base leading-relaxed text-gray-600 dark:text-gray-400 space-y-4">
                    <p>A structured 90-day transition from implementation to steady-state operations.</p>
                    <ul className="space-y-2 pl-6">
                      <li>• Day 30: First performance checkpoint and TPS</li>
                      <li>• Day 60: Mid-point review and adjustments</li>
                      <li>• Day 90: Full handoff and transition to Account Manager</li>
                      <li>• Documentation of learnings and best practices</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="performance" className="bg-white dark:bg-gray-900 rounded-lg px-6 hover-elevate" data-testid="accordion-performance">
                  <AccordionTrigger className="text-lg font-medium text-gray-900 dark:text-white">
                    Talent Performance Survey (TPS)
                  </AccordionTrigger>
                  <AccordionContent className="text-base leading-relaxed text-gray-600 dark:text-gray-400 space-y-4">
                    <p>Our structured feedback system for continuous talent development.</p>
                    <ul className="space-y-2 pl-6">
                      <li>• Applied on Day 30, 60, and 90 when KPIs are unavailable</li>
                      <li>• Measures quality, productivity, communication, and collaboration</li>
                      <li>• Identifies coaching opportunities and development needs</li>
                      <li>• Stored in MS Teams for transparent record-keeping</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="escalation" className="bg-white dark:bg-gray-900 rounded-lg px-6 hover-elevate" data-testid="accordion-escalation">
                  <AccordionTrigger className="text-lg font-medium text-gray-900 dark:text-white">
                    Performance Escalation & Coaching
                  </AccordionTrigger>
                  <AccordionContent className="text-base leading-relaxed text-gray-600 dark:text-gray-400 space-y-4">
                    <p>Structured approach to addressing performance issues.</p>
                    <ul className="space-y-2 pl-6">
                      <li>• Early identification through TPS and KPI tracking</li>
                      <li>• Coaching sessions with documented action plans</li>
                      <li>• Escalation path: Team Manager → Delivery Manager → Head of Delivery</li>
                      <li>• Performance Improvement Plans (PIP) when needed</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="nps" className="bg-white dark:bg-gray-900 rounded-lg px-6 hover-elevate" data-testid="accordion-nps">
                  <AccordionTrigger className="text-lg font-medium text-gray-900 dark:text-white">
                    Client Net Promoter Score (cNPS)
                  </AccordionTrigger>
                  <AccordionContent className="text-base leading-relaxed text-gray-600 dark:text-gray-400 space-y-4">
                    <p>Measuring client satisfaction and loyalty through regular feedback.</p>
                    <ul className="space-y-2 pl-6">
                      <li>• Quarterly surveys to all active clients</li>
                      <li>• 0-10 rating scale measuring likelihood to recommend</li>
                      <li>• Qualitative feedback on strengths and areas for improvement</li>
                      <li>• Action planning based on feedback themes</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="ews" className="bg-white dark:bg-gray-900 rounded-lg px-6 hover-elevate" data-testid="accordion-ews">
                  <AccordionTrigger className="text-lg font-medium text-gray-900 dark:text-white">
                    Early Warning System (EWS)
                  </AccordionTrigger>
                  <AccordionContent className="text-base leading-relaxed text-gray-600 dark:text-gray-400 space-y-4">
                    <p>Proactive risk detection and mitigation framework.</p>
                    <ul className="space-y-2 pl-6">
                      <li>• Automated tracking of key risk indicators</li>
                      <li>• Red/Yellow/Green status classification</li>
                      <li>• Immediate escalation protocols for critical issues</li>
                      <li>• Root cause analysis and corrective action planning</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="offboarding" className="bg-white dark:bg-gray-900 rounded-lg px-6 hover-elevate" data-testid="accordion-offboarding">
                  <AccordionTrigger className="text-lg font-medium text-gray-900 dark:text-white">
                    Client Offboarding
                  </AccordionTrigger>
                  <AccordionContent className="text-base leading-relaxed text-gray-600 dark:text-gray-400 space-y-4">
                    <p>Ensuring smooth transitions when client engagements conclude.</p>
                    <ul className="space-y-2 pl-6">
                      <li>• 30-day notice period for proper knowledge transfer</li>
                      <li>• Documentation handover and asset return</li>
                      <li>• Exit interviews to capture feedback and learnings</li>
                      <li>• Talent redeployment or graceful offboarding</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </motion.div>
          </motion.section>

          {/* Risk Management Framework */}
          <motion.section 
            className="space-y-6"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
          >
            <motion.h2 
              className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-white"
              variants={fadeUp}
            >
              Risk Management Framework
            </motion.h2>
            <motion.p className="text-base leading-relaxed text-gray-700 dark:text-gray-300" variants={fadeUp}>
              Our comprehensive approach to identifying, assessing, and mitigating risks across all client engagements.
            </motion.p>

            <motion.div className="space-y-6" variants={fadeUp}>
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Issue Escalation Protocol</h3>
                <p className="text-base leading-relaxed text-gray-600 dark:text-gray-400">
                  Structured escalation ensures issues are resolved quickly and strategically:
                </p>
                <ul className="space-y-2 text-base text-gray-600 dark:text-gray-400 pl-6">
                  <li>• Level 1: Team Manager addresses operational issues</li>
                  <li>• Level 2: Delivery Manager handles client-facing escalations</li>
                  <li>• Level 3: Head of Delivery intervenes on strategic matters</li>
                  <li>• Executive escalation for contract or partnership issues</li>
                </ul>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Risk Categories</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white mb-2">Operational Risks</p>
                    <ul className="space-y-1 text-base text-gray-600 dark:text-gray-400">
                      <li>• Performance degradation</li>
                      <li>• Resource availability</li>
                      <li>• Process compliance</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white mb-2">Client Risks</p>
                    <ul className="space-y-1 text-base text-gray-600 dark:text-gray-400">
                      <li>• Satisfaction decline</li>
                      <li>• Communication gaps</li>
                      <li>• Scope creep</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white mb-2">Talent Risks</p>
                    <ul className="space-y-1 text-base text-gray-600 dark:text-gray-400">
                      <li>• Attrition indicators</li>
                      <li>• Skill gaps</li>
                      <li>• Engagement concerns</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white mb-2">Compliance Risks</p>
                    <ul className="space-y-1 text-base text-gray-600 dark:text-gray-400">
                      <li>• Regulatory changes</li>
                      <li>• Data security</li>
                      <li>• Contract adherence</li>
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.section>

        </div>
      </div>
    </>
  );
}
