import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X, Sparkles, MessageCircle, Send, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { useVanessa } from "@/contexts/VanessaContext";
import type { Message } from "@/contexts/VanessaContext";
import vanessaPhoto from "@assets/Vanessa_1760674530978.png";

interface VanessaChatProps {
  isOpen: boolean;
  onClose: () => void;
  isSticky?: boolean;
}

export function VanessaChat({
  isOpen,
  onClose,
  isSticky = false,
}: VanessaChatProps) {
  // Use shared conversation state from context
  const {
    messages,
    setMessages,
    currentMessageIndex,
    setCurrentMessageIndex,
    showOptions,
    setShowOptions,
    selectedTopic,
    setSelectedTopic,
    isMinimized,
    setIsMinimized,
    resetConversation,
  } = useVanessa();

  // Local state for input and streaming
  const [userInput, setUserInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [userHasTyped, setUserHasTyped] = useState(false);
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);
  const [showNewMessageChip, setShowNewMessageChip] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null); // OpenAI thread ID
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const scrollAnimationFrameRef = useRef<number | null>(null);
  const lastScrollTopRef = useRef(0);
  const hasInitializedRef = useRef(false);
  const footerRef = useRef<HTMLDivElement>(null);
  const [footerHeight, setFooterHeight] = useState(0);

  const openingMessages = useRef([
    {
      id: 1,
      text: "Hi there! I'm Vanessa, your OnSpot Virtual Assistant.",
      sender: "vanessa" as const,
    },
    {
      id: 2,
      text: "I'm currently in training — learning from the decades of experience of our founders, managers, clients, and thousands of professionals in the OnSpot network.",
      sender: "vanessa" as const,
    },
    {
      id: 3,
      text: "For now, I can help you get started with Outsourcing through OnSpot.\nWould you like to explore how it works?",
      sender: "vanessa" as const,
    },
  ]).current;

  // ============================================================================
  // HARDCODED FAQ RESPONSES - For instant replies without OpenAI API calls
  // Based on OnSpot Global AI Knowledge Base
  // ============================================================================
  const faqResponses: Record<string, string> = {
    // === COMPANY & SERVICES ===
    "company-overview": `**OnSpot Global** is a leading BPO, Sales, and Virtual Assistance provider.

**Industry:** Business Process Outsourcing
**Website:** https://www.onspotglobal.com/

We specialize in outsourcing solutions for businesses, including customer support, sales, and administrative virtual assistance. Our mission is to deliver world-class talent and AI-powered solutions to help businesses scale efficiently.`,

    "services-offered": `OnSpot offers a comprehensive range of services:

**BPO Services:**
- Customer Support (Inbound & Outbound)
- Technical Support
- Data Entry & Processing
- Order Processing
- Back Office Support

**Sales Services:**
- Lead Generation
- Telemarketing
- Appointment Setting
- Cold Calling
- Account Management

**Virtual Assistance:**
- Email & Calendar Management
- Social Media Management
- Research & Data Collection
- Administrative Support
- Content Creation

How can I assist you further with any of these services?`,

    "industries-served": `We serve multiple industries including:

- **E-commerce** - Product support, order management
- **Real Estate** - Lead gen, appointment setting
- **Healthcare** - Patient support, admin tasks
- **Finance** - Data processing, client support
- **Technology** - Technical support, customer success

Tell us more about your business, and we'll tailor our solutions for you!`,

    "hire-virtual-assistant": `Our Virtual Assistants are trained professionals who handle:

- Administrative tasks and scheduling
- Social media management
- Email management and correspondence
- Research and data collection
- Content creation

Let me know your specific requirements, and I can connect you with our team for a consultation!`,

    // === PRICING & CONTRACTS ===
    "pricing": `We offer flexible pricing models to fit your needs:

**Fixed-Price Model**
- Set cost for defined scope of work
- Best for well-defined projects

**Time & Materials**
- Pay for actual hours worked
- Flexible for evolving requirements

**Dedicated Team Model**
- Full-time or part-time dedicated resources
- Scalable and cost-effective

Pricing varies based on service type and contract duration. I can connect you with our sales team at **sales@onspotglobal.com** to discuss a custom quote!`,

    "quality-assurance": `We follow a rigorous quality assurance process:

- Thorough testing and regular reviews
- Continuous feedback from clients
- Data-driven performance metrics
- Ongoing training and development

Our goal is to deliver high-quality solutions that exceed your expectations!`,

    "data-security": `We take data security and privacy very seriously:

- Industry best practices and compliance
- Secure data handling procedures
- Regular security audits
- Full compliance with relevant regulations

Your data is protected at all times with enterprise-grade security measures.`,

    "references-case-studies": `Yes! We can provide references and case studies upon request.

Please contact our sales team at **sales@onspotglobal.com**, and they'll be happy to share relevant examples of our work and client success stories.`,

    // === JOB OPENINGS & APPLICATION ===
    "job-openings": `We're always looking for talented individuals! Current openings include:

- **Customer Service Representative** - Remote, Full-time
- **Sales Representative** - Remote, Full-time
- **Virtual Assistant** - Remote, Part-time
- **Lead Generation Specialist** - Remote, Contract

Visit our careers page to explore all available positions. You can also sign up for job alerts so you'll never miss an opportunity!`,

    "how-to-apply": `Ready to take the next step in your career? Applying is simple!

1. Visit our **careers page** on our website
2. Browse through available roles
3. Submit your application through our user-friendly portal

You can also apply by sending your resume to **careers@onspotglobal.com**

We can't wait to hear from you!`,

    "application-documents": `To help us learn more about you, we ask for:

- **Updated resume or CV** (required)
- **Cover letter** (recommended for some roles)
- **Portfolio or work samples** (for specific roles)

Be sure to check the job description for any additional requirements!`,

    "submit-resume": `Submitting your resume is a breeze!

Just upload it directly through our **online application portal**. Your resume will be reviewed by our team, and we'll be in touch soon to discuss next steps.

If you encounter any issues, email us at **careers@onspotglobal.com**.`,

    "multiple-applications": `Absolutely! Feel free to explore as many opportunities as catch your eye.

Applying to multiple roles is a great way to increase your chances of finding the perfect fit for your skills and aspirations!`,

    "edit-application": `While we can't edit your application once it's been submitted, don't worry!

If something important changes, simply reach out to our Talent Acquisition Team at **careers@onspotglobal.com** and we'll assist you with any necessary updates.`,

    "email-applications": `For the smoothest process, we ask that all applications be submitted through our **online portal**.

However, if you encounter any issues, don't hesitate to email us at **careers@onspotglobal.com** and we'll be happy to assist you!`,

    // === QUALIFICATIONS & EXPERIENCE ===
    "job-qualifications": `Every job has its own unique requirements listed in the job description.

If you've got the experience and enthusiasm, don't let a few qualifications hold you back—**apply anyway**! We value passion, potential, and willingness to grow.`,

    "industry-experience": `While industry experience can be helpful for certain roles, we're always excited to bring in fresh perspectives!

If you're passionate and eager to learn, we're open to exploring how your skills can transfer.`,

    "no-experience": `Yes, we absolutely do! We offer opportunities for both:

- **Seasoned professionals** with years of experience
- **Entry-level candidates** just starting their careers

If you're looking for a chance to grow, we may have the perfect opportunity for you!`,

    "apply-without-qualifications": `Of course! We value passion, potential, and a willingness to grow.

If you don't meet every single requirement but think you'd be a great fit for the role, we encourage you to apply. We love seeing candidates who bring new energy to the table!`,

    // === INTERVIEW PROCESS ===
    "interview-expectations": `Expect a friendly and engaging conversation where we:

- Learn more about your experience, skills, and goals
- Discuss how you'd contribute to our team and company culture
- Answer your questions about the role and OnSpot

It's all about getting to know you better—and giving you the chance to get to know us!`,

    "interview-preparation": `Here's how to prepare:

1. Review the **job description** and align your experiences
2. Research our **company culture** and values
3. Prepare **thoughtful questions** about the role and team
4. Be yourself—we're excited to meet you!

Above all, relax and let your personality shine through!`,

    "interview-format": `Depending on the role and location, the interview might be:

- **Virtual** (via Zoom or Teams)
- **In-person** (at one of our offices)

We'll make sure to let you know ahead of time, so you'll be fully prepared!`,

    "interview-duration": `We keep our interviews focused and engaging, usually lasting **30 minutes to 1 hour**.

We'll respect your time while giving you the chance to share your experiences and ask questions!`,

    "interview-questions": `We'll ask a mix of:

- **Behavioral questions** - How you've handled past situations
- **Situational questions** - How you'd approach hypothetical scenarios
- **Role-specific questions** - Technical or skills-based

Don't worry—we'll keep it conversational and make sure you have the chance to showcase your skills!`,

    "skills-assessment": `For some roles, yes! If applicable, we'll give you the chance to demonstrate your skills in a real-world task.

But don't stress—we'll let you know in advance if this is part of the process, and we'll provide guidance to make it smooth and stress-free!`,

    "pre-interview-assessment": `Yes! As part of our commitment to finding the best fit, we have an assessment process that evaluates:

- Your skills and competencies
- Cultural alignment with OnSpot values
- How we can support your success

We'll provide guidance to make the process smooth and stress-free!`,

    // === APPLICATION STATUS & TIMELINE ===
    "application-timeline": `We aim to get back to you as quickly as possible:

- **Initial response:** Within 1-2 weeks
- **Common roles (CSR, VA):** ~2 weeks from application to offer
- **Specialized roles:** 30-45 days

If you're selected for an interview, you'll hear from us directly. We'll keep you updated every step of the way!`,

    "check-application-status": `You can easily check your application status by:

1. Logging into our **careers portal**
2. Viewing your application dashboard

If you need an update, just reach out—we're happy to provide more information!`,

    "follow-up-application": `Absolutely! We encourage you to follow up if it's been a while since you submitted your application.

A polite check-in shows your enthusiasm and keeps you on our radar. Feel free to email **careers@onspotglobal.com**!`,

    "post-interview-status": `We know waiting can be tough! Our team is working hard to evaluate all candidates carefully.

If it's been longer than expected, feel free to reach out for an update—we're happy to let you know where things stand!`,

    // === COMPANY CULTURE ===
    "company-culture": `At OnSpot, we value:

**🎯 Integrity** - We do what's right
**📈 Beat Yesterday** - Continuous growth and improvement
**💡 Intrapreneurial Mindset** - Think like an owner
**❤️ People Centric** - Fostering collaboration and care
**⚡ Efficiency** - Fast-fast-fast execution
**👊 Extreme Ownership** - Take responsibility, drive results

Here, we grow, innovate, and excel together!`,

    "employee-development": `At OnSpot, we're committed to your growth through:

- **Mentorship programs** with experienced professionals
- **Training and development** opportunities
- **Job Success System** - Data-driven strategies
- **Performance evaluations** and behavioral assessments
- **Career advancement pathways**

We help you grow both personally and professionally!`,

    "diversity-inclusion": `Absolutely! Diversity and inclusion are at the heart of our values.

We actively foster an inclusive environment where everyone, regardless of background, feels welcome and valued. Your unique perspective makes us stronger!`,

    "community-involvement": `Giving back is an integral part of our DNA. We actively support:

- Community initiatives and volunteer programs
- Environmental sustainability programs
- Social justice causes
- Charitable donations

We believe in making a positive impact beyond the workplace!`,

    // === BENEFITS & COMPENSATION ===
    "benefits": `At OnSpot, we offer a comprehensive benefits package:

**Health & Wellness:**
- HMO for Principal members (option to add dependents for some roles)
- Mental health resources and wellness programs

**Time Off:**
- 7.5 days PTO upon regularization
- 15 PTO days after completing 1 year
- Unlimited PTO for leadership roles
- US major holidays recognized

**Work Arrangements:**
- Remote work options
- Flexible schedules (where applicable)
- Night Differential

**Plus:** Government-mandated statutory benefits and continuously tailored new benefits!`,

    "salary-range": `The salary for each position varies depending on experience and qualifications.

We're transparent about compensation and will discuss the range during the interview process so we can align on expectations!`,

    "bonuses-incentives": `Yes! We offer:

- **Performance-based bonuses**
- **Incentive programs** to reward hard work
- **Recognition rewards** for achievements

We believe in recognizing the contributions of our employees!`,

    "salary-negotiation": `Definitely! We understand that compensation is important.

We're open to discussions to ensure a package that works for both you and the company. Let's have that conversation!`,

    // === WORK ARRANGEMENTS ===
    "job-location": `Our job locations are diverse:

- **Philippines offices** (various locations)
- **Hybrid roles** (office + remote)
- **Fully remote** positions

Check the job listing for specific details or reach out if you have questions!`,

    "relocation-assistance": `While we don't offer formal relocation assistance at the moment, we're dedicated to making your move seamless!

If you're relocating, we'll gladly assist you in finding comfortable, affordable accommodation. Your success and comfort are important to us!`,

    "remote-work": `Absolutely! Many of our roles offer flexible working arrangements, including the option to work from home.

Our goal is to empower you to perform your best while balancing your personal life!`,

    "work-schedule": `At OnSpot, we offer a blend of both structured and flexible schedules:

- **Client-mandated schedules** for operational roles
- **Flexible arrangements** for certain positions
- **Autonomy** to manage your time with extreme ownership

Whether you prefer structure or flexibility, we have opportunities to fit your lifestyle!`,

    "work-life-balance": `Work-life balance is at the core of our values!

We encourage our team members to:
- Take time for themselves
- Prioritize their well-being
- Use flexible hours and PTO
- Participate in wellness programs

We want you to feel energized and fulfilled both inside and outside of work!`,

    "mental-health": `We care deeply about the mental health of our employees:

- Access to **counseling services**
- **Wellness programs** and initiatives
- **Mindfulness resources**
- **Supportive work environment**

Your well-being is just as important as your productivity!`,

    "time-off": `At OnSpot, we believe in work-life balance:

- **7.5 days PTO** upon regularization
- **15 days PTO** after completing 1 year
- **Unlimited PTO** for some leadership roles
- **US major holidays** recognized

Your well-being is a priority here!`,

    // === TRAINING & CAREER GROWTH ===
    "training-programs": `We offer a robust learning and development program:

- **Leadership training** for managers
- **Technical workshops** and certifications
- **Personal development** resources
- **On-the-job training** and upskilling

Whether you want to master a new skill or grow in your career, we provide the tools!`,

    "mentorship": `Yes! We believe in the power of mentorship.

At OnSpot, you'll have access to experienced professionals who can:
- Guide you through your career path
- Share insights and best practices
- Help you navigate challenges

We want to see you succeed!`,

    "career-advancement": `Absolutely! We're committed to your professional growth:

- **Clear pathways for advancement**
- **Internal mobility** and promotions
- **Promote from within** culture
- **Leadership development** programs

Your success is our success!`,

    // === PERFORMANCE & RECOGNITION ===
    "performance-evaluation": `At OnSpot, performance is evaluated through:

**Probationary Employees:**
- Structured evaluations at 30, 60, 90, and 150 days

**Regular Employees:**
- Quarterly performance reviews
- Goal-setting and progress tracking
- Focus on results AND growth

We celebrate your successes and provide constructive support!`,

    "employee-feedback": `Absolutely! At OnSpot, we prioritize open and ongoing communication:

- Regular feedback sessions to celebrate successes
- Peer-to-peer feedback opportunities
- Anonymous feedback channels to leadership
- Constructive feedback for growth

Your growth and input are key to our continuous improvement!`,

    "employee-recognition": `We love celebrating our team's successes!

- **Recognition programs** and awards
- **Shout-outs** in team meetings
- **Company-wide gatherings** and celebrations
- **Performance rewards**

We make sure to highlight the hard work and accomplishments of our employees!`,

    "perks-rewards": `Yes, absolutely! At OnSpot, we offer exciting perks:

- Comprehensive benefits package
- Wellness programs
- Fun team-building events
- Engaging on-site and remote activities
- Performance bonuses and incentives

We're committed to fostering a positive and dynamic work culture!`,

    // === ONBOARDING ===
    "offer-letter": `Once you've successfully completed the hiring process, we'll extend a formal offer via **BambooHR**.

You can expect to receive it **the same day** we make our decision, ensuring a quick and seamless transition!`,

    "after-offer-acceptance": `Once you accept your offer, we'll ensure a smooth onboarding process:

1. **Quick setup** with all tools you need
2. **Introduction** to your fantastic new team
3. **BambooHR portal** for easy pre-employment requirements
4. **Online documentation** - complete everything in a few easy steps

We're absolutely thrilled to have you on board!`,

    "negotiate-offer": `Absolutely! We understand that compensation and benefits are important.

If you have any questions or would like to discuss the offer terms, we're open to having that conversation and making sure everything works for both sides!`,

    // === GENERAL HR ===
    "employment-gap": `Of course! Life happens, and we understand that career paths aren't always linear.

At OnSpot, we focus on your **skills, experiences, and potential**, so don't hesitate to apply even if you have gaps in your employment history!`,

    "reapply": `Absolutely! We encourage candidates to reapply for future opportunities.

Just because a role wasn't the right fit doesn't mean the next one won't be perfect for you. We'd love to see your application again!`,

    "part-time-contract": `Yes! We offer both part-time and contract positions for certain roles.

If you're looking for a specific work arrangement, simply check our job listings or reach out to us at **careers@onspotglobal.com**!`,

    // === CONTACT & SUPPORT ===
    "contact-support": `You can reach our team through:

**Sales Inquiries:** sales@onspotglobal.com
**Recruitment Team:** careers@onspotglobal.com
**General Support:** support@onspotglobal.com

Our support team is available 24/7 to assist you!`,

    "schedule-meeting": `I'd love to connect you with our team for a consultation!

We can discuss:
- Your specific requirements
- Custom pricing and solutions
- Trial or pilot programs
- Next steps to get started

Click the button below to schedule a free consultation call!`,

    // === ORIGINAL QUICK TOPICS (Preserved for backward compatibility) ===
    "how-it-works": `Here's how OnSpot outsourcing works:

1. **Tell Us What You Need** - Share your requirements, and we'll match you with pre-vetted talent from our network.

2. **Meet Your Team** - We introduce you to handpicked professionals who fit your needs.

3. **Start Working** - Your team gets to work, managed by our systems and supported by AI-powered tools.

4. **Track Performance** - Monitor productivity, quality, and ROI through our real-time dashboard.

We handle recruitment, management, and performance tracking—so you can focus on growing your business.`,

    "ai-human": `The AI + Human advantage is what makes OnSpot different:

**AI Powers Efficiency:**
- Automates routine tasks and workflows
- Provides real-time performance insights
- Handles scheduling, tracking, and reporting
- Learns from patterns to optimize processes

**Humans Provide Intelligence:**
- Critical thinking and problem-solving
- Creativity and strategic decision-making
- Relationship building and empathy
- Adaptability to unique situations

**Together, They're Unstoppable:**
- AI handles the repetitive work, freeing humans for high-value tasks
- Humans guide AI and handle complex edge cases
- Result: 3-5x productivity increase with lower costs

It's not AI vs. Human—it's AI empowering Humans to do their best work.`,

    "talk-human": `I'd love to connect you with one of our outsourcing experts!

Our team can help you:
- Understand which service model fits your needs
- Discuss custom pricing for your requirements
- Answer technical questions about our process
- Set up a trial or pilot program

Click the button below to schedule a free consultation call. We typically respond within 1 business hour.`,

    // ========================================================================
    // ADD NEW FAQ TOPICS BELOW THIS LINE
    // Follow the pattern: "topic-key": `FAQ response text with formatting`
    // ========================================================================
  };

  // ============================================================================
  // FAQ TOPIC DETECTION - Maps user queries to FAQ responses
  // ============================================================================
  const detectFAQTopic = (message: string): string | null => {
    const lowerMessage = message.toLowerCase();

    // === COMPANY & SERVICES ===
    if (
      (lowerMessage.includes("what") || lowerMessage.includes("tell")) &&
      (lowerMessage.includes("company") || lowerMessage.includes("onspot") || lowerMessage.includes("about you"))
    ) {
      return "company-overview";
    }

    if (
      (lowerMessage.includes("what") || lowerMessage.includes("which")) &&
      (lowerMessage.includes("service") || lowerMessage.includes("offer") || lowerMessage.includes("provide") || lowerMessage.includes("do you do"))
    ) {
      return "services-offered";
    }

    if (
      lowerMessage.includes("industry") ||
      lowerMessage.includes("industries") ||
      (lowerMessage.includes("what") && lowerMessage.includes("sector"))
    ) {
      return "industries-served";
    }

    if (
      (lowerMessage.includes("hire") || lowerMessage.includes("get") || lowerMessage.includes("need")) &&
      (lowerMessage.includes("virtual assistant") || lowerMessage.includes("va") || lowerMessage.includes("assistant"))
    ) {
      return "hire-virtual-assistant";
    }

    // === PRICING & CONTRACTS ===
    if (
      lowerMessage.includes("pric") ||
      lowerMessage.includes("cost") ||
      lowerMessage.includes("rate") ||
      lowerMessage.includes("fee") ||
      lowerMessage.includes("how much")
    ) {
      return "pricing";
    }

    if (
      lowerMessage.includes("quality") ||
      (lowerMessage.includes("ensure") && lowerMessage.includes("work"))
    ) {
      return "quality-assurance";
    }

    if (
      lowerMessage.includes("security") ||
      lowerMessage.includes("privacy") ||
      lowerMessage.includes("data protection")
    ) {
      return "data-security";
    }

    if (
      lowerMessage.includes("reference") ||
      lowerMessage.includes("case stud") ||
      lowerMessage.includes("previous work") ||
      lowerMessage.includes("portfolio")
    ) {
      return "references-case-studies";
    }

    // === JOB OPENINGS & APPLICATION ===
    if (
      (lowerMessage.includes("job") || lowerMessage.includes("position") || lowerMessage.includes("role") || lowerMessage.includes("vacanc")) &&
      (lowerMessage.includes("open") || lowerMessage.includes("available") || lowerMessage.includes("hiring"))
    ) {
      return "job-openings";
    }

    if (
      (lowerMessage.includes("how") || lowerMessage.includes("where")) &&
      (lowerMessage.includes("apply") || lowerMessage.includes("application"))
    ) {
      return "how-to-apply";
    }

    if (
      (lowerMessage.includes("document") || lowerMessage.includes("requirement") || lowerMessage.includes("need")) &&
      (lowerMessage.includes("apply") || lowerMessage.includes("application"))
    ) {
      return "application-documents";
    }

    if (
      lowerMessage.includes("submit") &&
      (lowerMessage.includes("resume") || lowerMessage.includes("cv") || lowerMessage.includes("application"))
    ) {
      return "submit-resume";
    }

    if (
      lowerMessage.includes("multiple") &&
      (lowerMessage.includes("position") || lowerMessage.includes("job") || lowerMessage.includes("role"))
    ) {
      return "multiple-applications";
    }

    if (
      (lowerMessage.includes("edit") || lowerMessage.includes("update") || lowerMessage.includes("change")) &&
      lowerMessage.includes("application")
    ) {
      return "edit-application";
    }

    if (
      lowerMessage.includes("email") &&
      lowerMessage.includes("application")
    ) {
      return "email-applications";
    }

    // === QUALIFICATIONS & EXPERIENCE ===
    if (
      lowerMessage.includes("qualification") ||
      (lowerMessage.includes("requirement") && lowerMessage.includes("job"))
    ) {
      return "job-qualifications";
    }

    if (
      lowerMessage.includes("industry") &&
      lowerMessage.includes("experience")
    ) {
      return "industry-experience";
    }

    if (
      (lowerMessage.includes("no") || lowerMessage.includes("without")) &&
      lowerMessage.includes("experience")
    ) {
      return "no-experience";
    }

    if (
      (lowerMessage.includes("don't meet") || lowerMessage.includes("dont meet") || lowerMessage.includes("not qualified")) &&
      (lowerMessage.includes("qualification") || lowerMessage.includes("requirement"))
    ) {
      return "apply-without-qualifications";
    }

    // === INTERVIEW PROCESS ===
    if (
      (lowerMessage.includes("what") || lowerMessage.includes("expect")) &&
      lowerMessage.includes("interview")
    ) {
      return "interview-expectations";
    }

    if (
      lowerMessage.includes("prepare") &&
      lowerMessage.includes("interview")
    ) {
      return "interview-preparation";
    }

    if (
      (lowerMessage.includes("virtual") || lowerMessage.includes("in-person") || lowerMessage.includes("online")) &&
      lowerMessage.includes("interview")
    ) {
      return "interview-format";
    }

    if (
      (lowerMessage.includes("how long") || lowerMessage.includes("duration")) &&
      lowerMessage.includes("interview")
    ) {
      return "interview-duration";
    }

    if (
      (lowerMessage.includes("question") || lowerMessage.includes("ask")) &&
      lowerMessage.includes("interview")
    ) {
      return "interview-questions";
    }

    if (
      lowerMessage.includes("assessment") &&
      (lowerMessage.includes("interview") || lowerMessage.includes("skill"))
    ) {
      if (lowerMessage.includes("before")) {
        return "pre-interview-assessment";
      }
      return "skills-assessment";
    }

    // === APPLICATION STATUS & TIMELINE ===
    if (
      (lowerMessage.includes("how long") || lowerMessage.includes("timeline") || lowerMessage.includes("when")) &&
      (lowerMessage.includes("hear") || lowerMessage.includes("response") || lowerMessage.includes("process"))
    ) {
      return "application-timeline";
    }

    if (
      (lowerMessage.includes("check") || lowerMessage.includes("track")) &&
      lowerMessage.includes("status")
    ) {
      return "check-application-status";
    }

    if (
      lowerMessage.includes("follow up") ||
      lowerMessage.includes("follow-up")
    ) {
      return "follow-up-application";
    }

    if (
      (lowerMessage.includes("haven't heard") || lowerMessage.includes("havent heard") || lowerMessage.includes("no response")) &&
      lowerMessage.includes("interview")
    ) {
      return "post-interview-status";
    }

    // === COMPANY CULTURE ===
    if (
      lowerMessage.includes("culture") ||
      (lowerMessage.includes("value") && !lowerMessage.includes("salary"))
    ) {
      return "company-culture";
    }

    if (
      lowerMessage.includes("development") ||
      (lowerMessage.includes("grow") && lowerMessage.includes("career"))
    ) {
      return "employee-development";
    }

    if (
      lowerMessage.includes("diversity") ||
      lowerMessage.includes("inclusion") ||
      lowerMessage.includes("dei")
    ) {
      return "diversity-inclusion";
    }

    if (
      lowerMessage.includes("community") ||
      lowerMessage.includes("social cause") ||
      (lowerMessage.includes("give") && lowerMessage.includes("back"))
    ) {
      return "community-involvement";
    }

    // === BENEFITS & COMPENSATION ===
    if (
      lowerMessage.includes("benefit") ||
      (lowerMessage.includes("what") && lowerMessage.includes("offer") && !lowerMessage.includes("service"))
    ) {
      return "benefits";
    }

    if (
      lowerMessage.includes("salary") ||
      lowerMessage.includes("compensation") ||
      lowerMessage.includes("pay range")
    ) {
      return "salary-range";
    }

    if (
      lowerMessage.includes("bonus") ||
      lowerMessage.includes("incentive")
    ) {
      return "bonuses-incentives";
    }

    if (
      lowerMessage.includes("negotiat") &&
      (lowerMessage.includes("salary") || lowerMessage.includes("offer") || lowerMessage.includes("pay"))
    ) {
      return "salary-negotiation";
    }

    // === WORK ARRANGEMENTS ===
    if (
      (lowerMessage.includes("where") || lowerMessage.includes("location")) &&
      (lowerMessage.includes("job") || lowerMessage.includes("work") || lowerMessage.includes("office"))
    ) {
      return "job-location";
    }

    if (
      lowerMessage.includes("relocation") ||
      (lowerMessage.includes("relocate") || lowerMessage.includes("move"))
    ) {
      return "relocation-assistance";
    }

    if (
      (lowerMessage.includes("remote") || lowerMessage.includes("work from home") || lowerMessage.includes("wfh")) &&
      !lowerMessage.includes("interview")
    ) {
      return "remote-work";
    }

    if (
      lowerMessage.includes("schedule") ||
      lowerMessage.includes("hours") ||
      (lowerMessage.includes("flexible") && lowerMessage.includes("time"))
    ) {
      return "work-schedule";
    }

    if (
      lowerMessage.includes("work-life") ||
      lowerMessage.includes("work life") ||
      (lowerMessage.includes("balance") && lowerMessage.includes("work"))
    ) {
      return "work-life-balance";
    }

    if (
      lowerMessage.includes("mental health") ||
      lowerMessage.includes("wellness")
    ) {
      return "mental-health";
    }

    if (
      (lowerMessage.includes("time off") || lowerMessage.includes("pto") || lowerMessage.includes("vacation") || lowerMessage.includes("leave")) &&
      !lowerMessage.includes("take off")
    ) {
      return "time-off";
    }

    // === TRAINING & CAREER GROWTH ===
    if (
      lowerMessage.includes("training") ||
      (lowerMessage.includes("learn") && lowerMessage.includes("program"))
    ) {
      return "training-programs";
    }

    if (
      lowerMessage.includes("mentor") ||
      lowerMessage.includes("mentorship")
    ) {
      return "mentorship";
    }

    if (
      lowerMessage.includes("advancement") ||
      lowerMessage.includes("promotion") ||
      (lowerMessage.includes("career") && (lowerMessage.includes("path") || lowerMessage.includes("growth")))
    ) {
      return "career-advancement";
    }

    // === PERFORMANCE & RECOGNITION ===
    if (
      lowerMessage.includes("performance") &&
      (lowerMessage.includes("evaluat") || lowerMessage.includes("review") || lowerMessage.includes("assess"))
    ) {
      return "performance-evaluation";
    }

    if (
      lowerMessage.includes("feedback")
    ) {
      return "employee-feedback";
    }

    if (
      lowerMessage.includes("recogni") ||
      (lowerMessage.includes("achiev") && lowerMessage.includes("reward"))
    ) {
      return "employee-recognition";
    }

    if (
      lowerMessage.includes("perk") ||
      (lowerMessage.includes("reward") && !lowerMessage.includes("achiev"))
    ) {
      return "perks-rewards";
    }

    // === ONBOARDING ===
    if (
      lowerMessage.includes("offer letter") ||
      (lowerMessage.includes("when") && lowerMessage.includes("offer"))
    ) {
      return "offer-letter";
    }

    if (
      (lowerMessage.includes("after") || lowerMessage.includes("once")) &&
      lowerMessage.includes("accept")
    ) {
      return "after-offer-acceptance";
    }

    if (
      lowerMessage.includes("negotiat") &&
      lowerMessage.includes("offer")
    ) {
      return "negotiate-offer";
    }

    // === GENERAL HR ===
    if (
      lowerMessage.includes("gap") &&
      lowerMessage.includes("employment")
    ) {
      return "employment-gap";
    }

    if (
      lowerMessage.includes("reapply") ||
      (lowerMessage.includes("apply again") && lowerMessage.includes("not selected"))
    ) {
      return "reapply";
    }

    if (
      (lowerMessage.includes("part-time") || lowerMessage.includes("part time") || lowerMessage.includes("contract"))
    ) {
      return "part-time-contract";
    }

    // === CONTACT & SUPPORT ===
    if (
      (lowerMessage.includes("contact") || lowerMessage.includes("reach") || lowerMessage.includes("email")) &&
      (lowerMessage.includes("support") || lowerMessage.includes("help") || lowerMessage.includes("team"))
    ) {
      return "contact-support";
    }

    if (
      (lowerMessage.includes("schedule") || lowerMessage.includes("book") || lowerMessage.includes("meeting") || lowerMessage.includes("call")) &&
      !lowerMessage.includes("interview")
    ) {
      return "schedule-meeting";
    }

    // === ORIGINAL QUICK TOPICS (Preserved for backward compatibility) ===
    if (
      lowerMessage.includes("how") &&
      (lowerMessage.includes("work") || lowerMessage.includes("process") || lowerMessage.includes("outsourc"))
    ) {
      return "how-it-works";
    }

    if (
      (lowerMessage.includes("ai") || lowerMessage.includes("artificial")) &&
      (lowerMessage.includes("human") || lowerMessage.includes("advantage") || lowerMessage.includes("benefit"))
    ) {
      return "ai-human";
    }

    if (
      (lowerMessage.includes("talk") || lowerMessage.includes("speak")) &&
      (lowerMessage.includes("human") || lowerMessage.includes("expert") || lowerMessage.includes("person") || lowerMessage.includes("someone"))
    ) {
      return "talk-human";
    }

    // No match found
    return null;
  };

  // ============================================================================
  // END FAQ SECTION
  // ============================================================================

  // Prevent body scroll when popup is open
  useEffect(() => {
    if (isOpen && !isSticky) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isOpen, isSticky]);

  // Handle iOS keyboard with visualViewport and recompute scroll on resize
  useEffect(() => {
    if (!isOpen || isSticky) return;

    const updateViewportHeight = () => {
      if (window.visualViewport) {
        const vh = window.visualViewport.height;
        document.documentElement.style.setProperty(
          "--viewport-height",
          `${vh}px`,
        );
      } else {
        document.documentElement.style.setProperty(
          "--viewport-height",
          `${window.innerHeight}px`,
        );
      }
      // Recompute pinned state on resize
      if (checkIfNearBottom() && isPinnedToBottom) {
        scrollToBottom(false);
      }
    };

    updateViewportHeight();
    window.visualViewport?.addEventListener("resize", updateViewportHeight);
    window.addEventListener("resize", updateViewportHeight);

    return () => {
      window.visualViewport?.removeEventListener(
        "resize",
        updateViewportHeight,
      );
      window.removeEventListener("resize", updateViewportHeight);
      document.documentElement.style.removeProperty("--viewport-height");
    };
  }, [isOpen, isSticky, isPinnedToBottom]);

  // Track footer height for body padding
  useEffect(() => {
    const footer = footerRef.current;
    if (!footer) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setFooterHeight(entry.contentRect.height);
      }
    });

    resizeObserver.observe(footer);
    return () => resizeObserver.disconnect();
  }, [isOpen]);

  // Attach scroll listener to messages container
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    container.addEventListener("scroll", handleScroll);
    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [isStreaming]);

  // ResizeObserver to detect choices/input height changes
  useEffect(() => {
    if (!isOpen) return;

    const resizeObserver = new ResizeObserver(() => {
      if (isPinnedToBottom) {
        scrollToBottom(false);
      }
    });

    // Observe the footer area (input + choices)
    const container = messagesContainerRef.current?.parentElement;
    if (container) {
      const footer = container.querySelector("[data-footer-area]");
      if (footer) {
        resizeObserver.observe(footer as Element);
      }
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [isOpen, isPinnedToBottom]);

  // Start message sequence when chat opens - only initialize if conversation is empty
  useEffect(() => {
    if (!isOpen) {
      hasInitializedRef.current = false;
      return;
    }

    // Prevent running multiple times when chat is already open
    if (hasInitializedRef.current) {
      return;
    }

    hasInitializedRef.current = true;

    // Only initialize if conversation is empty (first time opening)
    if (messages.length === 0) {
      setCurrentMessageIndex(0);
      setShowOptions(false);
      setSelectedTopic(null);

      const timer = setTimeout(() => {
        // Trigger first message
        const firstMessage = openingMessages[0];
        setMessages([{ ...firstMessage, isTyping: true }]);

        setTimeout(() => {
          setMessages([{ ...firstMessage, isTyping: false }]);
          setCurrentMessageIndex(1);
        }, 1200);
      }, 300);

      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Display subsequent messages sequentially with typing animation
  useEffect(() => {
    if (
      !isOpen ||
      currentMessageIndex === 0 ||
      currentMessageIndex >= openingMessages.length
    ) {
      // Show options after last opening message
      if (currentMessageIndex === openingMessages.length && !showOptions) {
        setTimeout(() => setShowOptions(true), 500);
      }
      return;
    }

    const timer = setTimeout(() => {
      const newMessage = openingMessages[currentMessageIndex];

      // Show typing indicator first
      setMessages((prev) => [...prev, { ...newMessage, isTyping: true }]);

      // Replace typing indicator with actual message after delay
      setTimeout(
        () => {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { ...newMessage, isTyping: false };
            return updated;
          });
          setCurrentMessageIndex((prev) => prev + 1);
        },
        1000 + Math.random() * 500,
      );
    }, 1500);

    return () => clearTimeout(timer);
  }, [currentMessageIndex, isOpen, showOptions]);

  // ============================================================================
  // TOPIC SELECTION HANDLER - Uses hardcoded FAQ responses for instant replies
  // ============================================================================
  const handleTopicSelect = async (topic: string) => {
    setSelectedTopic(topic);
    setShowOptions(false);

    // Map topic to user message
    const userMessages: Record<string, string> = {
      "how-it-works": "How does OnSpot outsourcing work?",
      pricing: "What are your pricing models?",
      "ai-human": "What's the AI + Human advantage?",
      "talk-human": "I'd like to talk to a human expert",
    };

    const userMessage = userMessages[topic];

    // Add user message
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        text: userMessage,
        sender: "user",
      },
    ]);

    // ========================================================================
    // LOCAL FAQ RESPONSE - Instant reply without API call
    // ========================================================================
    if (faqResponses[topic]) {
      const assistantMessageId = Date.now() + 1;
      
      // Show typing indicator
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          text: "",
          sender: "vanessa",
          isTyping: true,
        },
      ]);

      // Simulate typing delay for natural feel (500ms)
      setTimeout(() => {
        setMessages((prev) => {
          const updated = [...prev];
          const lastMessage = updated[updated.length - 1];
          if (lastMessage.id === assistantMessageId) {
            lastMessage.text = faqResponses[topic];
            lastMessage.isTyping = false;
          }
          return updated;
        });
      }, 500);

      return;
    }

    // ========================================================================
    // AI FALLBACK - If no FAQ response exists (shouldn't happen for quick topics)
    // ========================================================================
    try {
      setIsStreaming(true);

      const assistantMessageId = Date.now() + 1;
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          text: "",
          sender: "vanessa",
          isTyping: true,
        },
      ]);

      const body = JSON.stringify({
        message: userMessage,
        threadId: threadId || undefined,
      });

      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      let accumulatedText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            
            if (data === "[DONE]") break;

            try {
              const parsed = JSON.parse(data);

              if (parsed.type === "threadId") {
                setThreadId(parsed.data);
              } else if (parsed.type === "content") {
                accumulatedText += parsed.data;
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMessage = updated[updated.length - 1];
                  if (lastMessage.id === assistantMessageId) {
                    lastMessage.text = accumulatedText;
                    lastMessage.isTyping = true;
                  }
                  return updated;
                });
              } else if (parsed.type === "done") {
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMessage = updated[updated.length - 1];
                  if (lastMessage.id === assistantMessageId) {
                    lastMessage.isTyping = false;
                  }
                  return updated;
                });
              }
            } catch (e) {
              if (data !== "[DONE]") {
                console.warn("Failed to parse SSE data:", data);
              }
            }
          }
        }
      }

      setIsStreaming(false);
    } catch (error) {
      console.error("Chat API error:", error);
      setIsStreaming(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 2,
          text: "I'm sorry, I encountered an error. Please try again.",
          sender: "vanessa",
        },
      ]);
    }
  };

  const handleBookCall = () => {
    window.open(
      "https://api.leadconnectorhq.com/widget/booking/2oCPWrG6iXVnuUGRXKBK",
    );
  };

  // Auto-scroll to bottom with batching via requestAnimationFrame
  const scrollToBottom = (smooth = true) => {
    if (scrollAnimationFrameRef.current !== null) {
      cancelAnimationFrame(scrollAnimationFrameRef.current);
    }

    scrollAnimationFrameRef.current = requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
      });
      scrollAnimationFrameRef.current = null;
    });
  };

  // Check if user is near bottom (within 100px)
  const checkIfNearBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    const threshold = 100;
    return (
      container.scrollHeight - container.scrollTop - container.clientHeight <
      threshold
    );
  };

  // Handle scroll events to track pinned state
  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const isNearBottom = checkIfNearBottom();
    const scrollingDown = container.scrollTop > lastScrollTopRef.current;
    lastScrollTopRef.current = container.scrollTop;

    if (isNearBottom) {
      setIsPinnedToBottom(true);
      setShowNewMessageChip(false);
    } else if (scrollingDown === false) {
      // User scrolled up
      setIsPinnedToBottom(false);
      if (isStreaming) {
        setShowNewMessageChip(true);
      }
    }
  };

  // Auto-scroll when new messages arrive (only if pinned)
  useEffect(() => {
    if (isPinnedToBottom) {
      scrollToBottom();
    } else if (isStreaming) {
      // Show chip if user is scrolled up during streaming
      setShowNewMessageChip(true);
    }
  }, [messages, isPinnedToBottom, isStreaming]);

  // Ensure chat scrolls when new messages are added
  useEffect(() => {
    if (messagesEndRef.current) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      });
    }
  }, [messages]);

  // Scroll to bottom and dismiss chip
  const handleScrollToBottomClick = () => {
    setIsPinnedToBottom(true);
    setShowNewMessageChip(false);
    scrollToBottom(true);
  };

  // ============================================================================
  // MESSAGE HANDLER - Detects FAQ topics for instant replies, uses OpenAI for everything else
  // ============================================================================
  const handleSendMessage = async () => {
    if (!userInput.trim() || isStreaming) return;

    const userMessage = userInput.trim();
    setUserInput("");
    setUserHasTyped(false);
    setShowOptions(false);

    // Add user message
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        text: userMessage,
        sender: "user",
      },
    ]);

    // ========================================================================
    // LOCAL FAQ DETECTION - Check if message matches FAQ topic
    // ========================================================================
    const detectedTopic = detectFAQTopic(userMessage);
    
    if (detectedTopic && faqResponses[detectedTopic]) {
      const assistantMessageId = Date.now() + 1;
      
      // Show typing indicator
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          text: "",
          sender: "vanessa",
          isTyping: true,
        },
      ]);

      // Simulate typing delay for natural feel (500ms)
      setTimeout(() => {
        setMessages((prev) => {
          const updated = [...prev];
          const lastMessage = updated[updated.length - 1];
          if (lastMessage.id === assistantMessageId) {
            lastMessage.text = faqResponses[detectedTopic];
            lastMessage.isTyping = false;
          }
          return updated;
        });
      }, 500);

      return; // Exit early - FAQ handled, no OpenAI call needed
    }

    // ========================================================================
    // AI FALLBACK - Use OpenAI Assistant API for non-FAQ queries
    // ========================================================================
    try {
      setIsStreaming(true);

      const assistantMessageId = Date.now() + 1;
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          text: "",
          sender: "vanessa",
          isTyping: true,
        },
      ]);

      // Create request body
      const body = JSON.stringify({
        message: userMessage,
        threadId: threadId || undefined,
      });

      // Call streaming endpoint
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body,
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      let accumulatedText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            
            if (data === "[DONE]") {
              break;
            }

            try {
              const parsed = JSON.parse(data);

              if (parsed.type === "threadId") {
                // Save thread ID for conversation continuity
                setThreadId(parsed.data);
              } else if (parsed.type === "content") {
                // Accumulate content
                accumulatedText += parsed.data;

                // Update message with accumulated text
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMessage = updated[updated.length - 1];
                  if (lastMessage.id === assistantMessageId) {
                    lastMessage.text = accumulatedText;
                    lastMessage.isTyping = true;
                  }
                  return updated;
                });
              } else if (parsed.type === "done") {
                // Mark as complete
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMessage = updated[updated.length - 1];
                  if (lastMessage.id === assistantMessageId) {
                    lastMessage.isTyping = false;
                  }
                  return updated;
                });
              } else if (parsed.type === "error") {
                throw new Error(parsed.data);
              }
            } catch (e) {
              // Ignore JSON parse errors for incomplete chunks
              if (data !== "[DONE]") {
                console.warn("Failed to parse SSE data:", data);
              }
            }
          }
        }
      }

      setIsStreaming(false);
    } catch (error) {
      console.error("Chat API error:", error);
      setIsStreaming(false);

      // Show error message
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 2,
          text: "I'm sorry, I encountered an error. Please try again.",
          sender: "vanessa",
        },
      ]);
    }
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUserInput(e.target.value);
    if (e.target.value.trim() && !userHasTyped) {
      setUserHasTyped(true);
      setShowOptions(false);
    } else if (!e.target.value.trim() && userHasTyped) {
      setUserHasTyped(false);
    }
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) return null;

  // Sticky chat widget mode (lower right corner) - optimized for mobile
  if (isSticky) {
    return (
      <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50 animate-in slide-in-from-bottom-4 duration-500">
        {isMinimized ? (
          // Minimized floating button with luminous gradient
          <Button
            size="icon"
            onClick={() => setIsMinimized(false)}
            className="h-14 w-14 md:h-16 md:w-16 rounded-full bg-gradient-to-r from-[#3A3AF8] to-[#7F3DF4] text-white shadow-2xl hover:shadow-[0_0_40px_rgba(58,58,248,0.6)] hover:scale-105 transition-all duration-300"
            data-testid="button-open-chat-widget"
          >
            <MessageCircle className="h-6 w-6 md:h-7 md:w-7" />
          </Button>
        ) : (
          // Expanded luminous glass chat widget - responsive sizing
          <div
            className="w-[calc(100vw-32px)] max-w-[400px] h-[calc(100vh-120px)] max-h-[600px] flex flex-col relative animate-in slide-in-from-bottom-4 duration-500 rounded-3xl overflow-hidden"
            style={{
              background:
                "linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(243, 232, 255, 0.98) 100%)",
              backdropFilter: "blur(20px)",
              boxShadow:
                "0 0 60px rgba(127, 61, 244, 0.4), 0 8px 32px rgba(0, 0, 0, 0.12), inset 0 0 0 1px rgba(127, 61, 244, 0.3)",
            }}
            data-testid="vanessa-chat-widget"
          >
            {/* Animated glow accent border */}
            <div className="absolute inset-0 rounded-3xl pointer-events-none overflow-hidden">
              <div
                className="absolute inset-0 bg-gradient-to-r from-[#3A3AF8]/30 via-[#7F3DF4]/30 to-[#3A3AF8]/30 opacity-60 animate-pulse"
                style={{
                  mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                  WebkitMask:
                    "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                  maskComposite: "exclude",
                  WebkitMaskComposite: "xor",
                  padding: "2px",
                }}
              />
            </div>

            {/* Header with glass effect - pinned */}
            <div className="flex items-center gap-3 p-3 md:p-4 border-b border-violet-200/50 backdrop-blur-sm flex-shrink-0">
              <Avatar className="vanessa-avatar">
                <AvatarImage
                  src={vanessaPhoto}
                  alt="Vanessa"
                  className="vanessa-avatar"
                />
                <AvatarFallback className="bg-gradient-to-br from-violet-400 to-blue-400 text-white font-semibold">
                  VA
                </AvatarFallback>
              </Avatar>

              <div className="flex-1">
                <h3
                  className="font-bold text-gray-900"
                  data-testid="text-vanessa-name"
                >
                  Vanessa
                </h3>
                <p className="text-xs text-gray-600">
                  OnSpot Virtual Assistant
                </p>
                <p className="text-xs font-medium bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">
                  Superhuman Assistant — In Training
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Reset conversation? This will clear all messages.",
                      )
                    ) {
                      resetConversation();
                    }
                  }}
                  className="h-8 w-8 text-gray-600 hover:text-gray-900 hover:bg-violet-100/60"
                  data-testid="button-reset-chat"
                  title="Reset conversation"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setIsMinimized(true)}
                  className="h-8 w-8 text-gray-600 hover:text-gray-900 hover:bg-violet-100/60"
                  data-testid="button-minimize-chat"
                >
                  <span className="text-lg leading-none">−</span>
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onClose}
                  className="h-8 w-8 text-gray-600 hover:text-gray-900 hover:bg-violet-100/60"
                  data-testid="button-close-chat"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Messages with enhanced contrast - scrollable with momentum */}
            <div className="flex-1 relative min-h-0 transition-all duration-500 ease-in-out">
              <div
                ref={messagesContainerRef}
                className="absolute inset-0 overflow-y-auto"
                style={{
                  WebkitOverflowScrolling: "touch",
                  overscrollBehavior: "contain",
                  padding: "clamp(20px, 10vw, 30px)",
                  paddingBottom: "clamp(20px, 5vw, 30px)",
                }}
                data-testid="chat-messages"
              >
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
                        message.sender === "user"
                          ? "bg-gradient-to-r from-[#3A3AF8] to-[#7F3DF4] text-white"
                          : "bg-white/80 text-gray-900 backdrop-blur-sm border border-violet-200/40"
                      }`}
                      data-testid={`message-${message.sender}-${message.id}`}
                    >
                      {message.isTyping ? (
                        <div
                          className="flex gap-1 py-1"
                          data-testid="typing-indicator"
                        >
                          <div
                            className="w-2 h-2 bg-violet-400 rounded-full animate-bounce"
                            style={{ animationDelay: "0ms" }}
                          />
                          <div
                            className="w-2 h-2 bg-violet-400 rounded-full animate-bounce"
                            style={{ animationDelay: "150ms" }}
                          />
                          <div
                            className="w-2 h-2 bg-violet-400 rounded-full animate-bounce"
                            style={{ animationDelay: "300ms" }}
                          />
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-line leading-relaxed">
                          {message.text}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* New messages chip - appears when user scrolls up during streaming */}
              {showNewMessageChip && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 animate-in slide-in-from-bottom-2 duration-300">
                  <Button
                    onClick={handleScrollToBottomClick}
                    size="sm"
                    className="bg-gradient-to-r from-[#3A3AF8] to-[#7F3DF4] text-white shadow-lg hover:shadow-xl transition-all"
                    data-testid="button-new-messages"
                  >
                    New messages ↓
                  </Button>
                </div>
              )}
            </div>

            {/* Footer area (input + choices) - tracked by ResizeObserver */}
            <div data-footer-area>
              {/* Sticky Input Bar - always visible */}
              <div
                className="border-t border-violet-200/50 backdrop-blur-sm flex-shrink-0"
                style={{
                  padding: "clamp(10px, 2vw, 16px)",
                  paddingBottom:
                    "max(12px, calc(10px + env(safe-area-inset-bottom)))",
                }}
              >
                <div className="flex gap-2 items-end">
                  <Textarea
                    value={userInput}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    className="flex-1 min-h-[40px] max-h-[120px] resize-none text-sm border-violet-300 focus:border-violet-500"
                    data-testid="input-message"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!userInput.trim() || isStreaming}
                    size="icon"
                    className="h-10 w-10 bg-gradient-to-r from-[#3A3AF8] to-[#7F3DF4] text-white disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all"
                    data-testid="button-send-message"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Interactive Options with glass buttons - sticky footer with safe area */}
              {showOptions && !userHasTyped && (
                <div
                  className="border-t border-violet-200/50 space-y-2 animate-in slide-in-from-bottom-2 duration-300 backdrop-blur-sm flex-shrink-0"
                  style={{
                    position: "sticky",
                    bottom: 0,
                    paddingTop: "12px",
                    paddingLeft: "16px",
                    paddingRight: "16px",
                    paddingBottom:
                      "max(16px, calc(12px + env(safe-area-inset-bottom)))",
                  }}
                >
                  {selectedTopic === "talk-human" ? (
                    <div className="flex gap-2">
                      <Button
                        onClick={handleBookCall}
                        className="flex-1 bg-gradient-to-r from-[#3A3AF8] to-[#7F3DF4] text-white hover:shadow-lg hover:scale-[1.02] transition-all duration-300"
                        data-testid="button-book-call"
                      >
                        Book a Call
                      </Button>
                      <Button
                        onClick={() => {
                          setSelectedTopic(null);
                          setShowOptions(true);
                        }}
                        variant="outline"
                        className="flex-1 border-violet-300 text-gray-700 hover:bg-violet-50 hover:border-violet-400"
                        data-testid="button-keep-exploring"
                      >
                        Keep Exploring
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Button
                        onClick={() => handleTopicSelect("how-it-works")}
                        variant="outline"
                        className="w-full justify-start text-left border-violet-300 text-gray-700 hover:bg-violet-50 hover:border-violet-400"
                        data-testid="button-how-it-works"
                      >
                        How OnSpot Outsourcing Works
                      </Button>
                      <Button
                        onClick={() => handleTopicSelect("pricing")}
                        variant="outline"
                        className="w-full justify-start text-left border-violet-300 text-gray-700 hover:bg-violet-50 hover:border-violet-400"
                        data-testid="button-pricing"
                      >
                        See Pricing Models
                      </Button>
                      <Button
                        onClick={() => handleTopicSelect("ai-human")}
                        variant="outline"
                        className="w-full justify-start text-left border-violet-300 text-gray-700 hover:bg-violet-50 hover:border-violet-400"
                        data-testid="button-ai-human"
                      >
                        AI + Human Advantage
                      </Button>
                      <Button
                        onClick={() => handleTopicSelect("talk-human")}
                        variant="outline"
                        className="w-full justify-start text-left border-violet-300 text-gray-700 hover:bg-violet-50 hover:border-violet-400"
                        data-testid="button-talk-human"
                      >
                        Talk to a Human Expert
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Luminous sparkle effects */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
              <Sparkles className="absolute top-4 right-4 h-5 w-5 text-violet-500 opacity-70 animate-pulse" />
              <Sparkles
                className="absolute bottom-20 left-6 h-4 w-4 text-blue-500 opacity-50 animate-pulse"
                style={{ animationDelay: "1s" }}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full-screen luminous glass modal mode - vertically balanced with viewport-aware height
  return (
    <div
      className="fixed inset-0 z-50 flex animate-in fade-in duration-300"
      style={{
        background:
          "radial-gradient(ellipse at center, rgba(127, 61, 244, 0.15) 0%, rgba(58, 58, 248, 0.1) 50%, rgba(0, 0, 0, 0.3) 100%)",
        backdropFilter: "blur(12px)",
        paddingInline: "clamp(12px, 4vw, 48px)",
        paddingBlock: "clamp(20px, 5vh, 48px)",
        ["--gutter" as string]: "clamp(12px, 4vw, 48px)",
        ["--vgutter" as string]: "clamp(20px, 5vh, 48px)",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        className="flex flex-col relative animate-in slide-in-from-bottom-4 duration-500 max-[360px]:!rounded-t-3xl max-[360px]:!rounded-b-none max-[360px]:self-end"
        style={{
          background:
            "linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(243, 232, 255, 0.98) 100%)",
          backdropFilter: "blur(20px)",
          boxShadow:
            "0 0 60px rgba(127, 61, 244, 0.4), 0 8px 32px rgba(0, 0, 0, 0.12), inset 0 0 0 1px rgba(127, 61, 244, 0.3)",
          width: "min(720px, calc(100vw - 2 * var(--gutter)))",
          maxHeight:
            "min(calc(var(--viewport-height, 100dvh) - 2 * var(--vgutter)), calc(100svh - 2 * var(--vgutter)))",
          borderRadius: "clamp(16px, 2vw, 24px)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
        data-testid="vanessa-chat-window"
      >
        {/* Animated glow accent border */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            borderRadius: "clamp(16px, 2vw, 24px)",
            overflow: "hidden",
          }}
        >
          <div
            className="absolute inset-0 bg-gradient-to-r from-[#3A3AF8]/30 via-[#7F3DF4]/30 to-[#3A3AF8]/30 opacity-60 animate-pulse"
            style={{
              mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              WebkitMask:
                "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              maskComposite: "exclude",
              WebkitMaskComposite: "xor",
              padding: "2px",
            }}
          />
        </div>

        {/* Header with glass effect - pinned */}
        <div
          className="flex items-center gap-3 border-b border-violet-200/50 backdrop-blur-sm flex-shrink-0"
          style={{
            padding: "clamp(12px, 3vw, 20px)",
          }}
        >
          <Avatar className="vanessa-avatar" data-testid="avatar-vanessa">
            <AvatarImage
              src={vanessaPhoto}
              alt="Vanessa"
              className="vanessa-avatar"
            />
            <AvatarFallback className="bg-gradient-to-br from-violet-400 to-blue-400 text-white font-semibold">
              VA
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h3
              className="font-bold text-gray-900"
              data-testid="text-vanessa-name"
            >
              Vanessa
            </h3>
            <p className="text-xs text-gray-600">OnSpot Virtual Assistant</p>
            <p className="text-xs font-medium bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">
              Superhuman Assistant — In Training
            </p>
          </div>
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                if (
                  window.confirm(
                    "Reset conversation? This will clear all messages.",
                  )
                ) {
                  resetConversation();
                }
              }}
              className="text-gray-600 hover:text-gray-900 hover:bg-violet-100/60"
              data-testid="button-reset-chat-modal"
              title="Reset conversation"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              className="text-gray-600 hover:text-gray-900 hover:bg-violet-100/60"
              data-testid="button-close-chat-modal"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Messages with enhanced contrast - scrollable section with momentum */}
        <div className="v-body flex-1 relative min-h-0">
          <div
            id="scroller"
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4 transition-all duration-500 ease-in-out"
            style={{
              WebkitOverflowScrolling: "touch",
              overscrollBehavior: "contain",
              padding: "clamp(12px, 3vw, 20px)",
              paddingBottom: "clamp(12px, 3vw, 20px)",
            }}
            data-testid="chat-messages"
          >
            <div id="messages" className="space-y-3 md:space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
                      message.sender === "user"
                        ? "bg-gradient-to-r from-[#3A3AF8] to-[#7F3DF4] text-white"
                        : "bg-white/80 text-gray-900 backdrop-blur-sm border border-violet-200/40"
                    }`}
                    data-testid={`message-${message.sender}-${message.id}`}
                  >
                    {message.isTyping ? (
                      <div
                        className="flex gap-1 py-1"
                        data-testid="typing-indicator"
                      >
                        <div
                          className="w-2 h-2 bg-violet-400 rounded-full animate-bounce"
                          style={{ animationDelay: "0ms" }}
                        />
                        <div
                          className="w-2 h-2 bg-violet-400 rounded-full animate-bounce"
                          style={{ animationDelay: "150ms" }}
                        />
                        <div
                          className="w-2 h-2 bg-violet-400 rounded-full animate-bounce"
                          style={{ animationDelay: "300ms" }}
                        />
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-line leading-relaxed">
                        {message.text}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* New messages chip - appears when user scrolls up during streaming */}
          {showNewMessageChip && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 animate-in slide-in-from-bottom-2 duration-300">
              <Button
                onClick={handleScrollToBottomClick}
                size="sm"
                className="bg-gradient-to-r from-[#3A3AF8] to-[#7F3DF4] text-white shadow-lg hover:shadow-xl transition-all"
                data-testid="button-new-messages"
              >
                New messages ↓
              </Button>
            </div>
          )}
        </div>

        {/* Footer area (input + choices) - tracked by ResizeObserver */}
        <div ref={footerRef} data-footer-area>
          {/* Sticky Input Bar - always visible */}
          <div
            className="border-t border-violet-200/50 backdrop-blur-sm flex-shrink-0"
            style={{
              padding: "clamp(12px, 3vw, 20px)",
              paddingBottom:
                "calc(clamp(12px, 3vw, 20px) + env(safe-area-inset-bottom))",
            }}
          >
            <div className="flex gap-2 items-end">
              <Textarea
                id="chatInput"
                value={userInput}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                className="flex-1 min-h-[44px] max-h-[120px] resize-none text-sm border-violet-300 focus:border-violet-500"
                data-testid="input-message"
              />
              <Button
                id="sendBtn"
                onClick={handleSendMessage}
                disabled={!userInput.trim() || isStreaming}
                size="icon"
                className="h-11 w-11 bg-gradient-to-r from-[#3A3AF8] to-[#7F3DF4] text-white disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all"
                data-testid="button-send-message"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Interactive Options with glass buttons - sticky footer with safe area */}
          {showOptions && !userHasTyped && (
            <div
              id="choices"
              className="border-t border-violet-200/50 space-y-2 animate-in slide-in-from-bottom-2 duration-300 backdrop-blur-sm flex-shrink-0"
              style={{
                position: "sticky",
                bottom: 0,
                paddingTop: "clamp(12px, 3vw, 16px)",
                paddingLeft: "clamp(12px, 3vw, 20px)",
                paddingRight: "clamp(12px, 3vw, 20px)",
                paddingBottom:
                  "calc(clamp(12px, 3vw, 20px) + env(safe-area-inset-bottom))",
              }}
            >
              {selectedTopic === "talk-human" ? (
                <div className="flex gap-2">
                  <Button
                    onClick={handleBookCall}
                    className="flex-1 bg-gradient-to-r from-[#3A3AF8] to-[#7F3DF4] text-white hover:shadow-lg hover:scale-[1.02] transition-all duration-300"
                    data-testid="button-book-call"
                  >
                    Book a Call
                  </Button>
                  <Button
                    onClick={() => {
                      setSelectedTopic(null);
                      setShowOptions(true);
                    }}
                    variant="outline"
                    className="flex-1 border-violet-300 text-gray-700 hover:bg-violet-50 hover:border-violet-400"
                    data-testid="button-keep-exploring"
                  >
                    Keep Exploring
                  </Button>
                </div>
              ) : (
                <>
                  <Button
                    onClick={() => handleTopicSelect("how-it-works")}
                    variant="outline"
                    className="w-full justify-start text-left border-violet-300 text-gray-700 hover:bg-violet-50 hover:border-violet-400"
                    data-testid="button-how-it-works"
                  >
                    How OnSpot Outsourcing Works
                  </Button>
                  <Button
                    onClick={() => handleTopicSelect("pricing")}
                    variant="outline"
                    className="w-full justify-start text-left border-violet-300 text-gray-700 hover:bg-violet-50 hover:border-violet-400"
                    data-testid="button-pricing"
                  >
                    See Pricing Models
                  </Button>
                  <Button
                    onClick={() => handleTopicSelect("ai-human")}
                    variant="outline"
                    className="w-full justify-start text-left border-violet-300 text-gray-700 hover:bg-violet-50 hover:border-violet-400"
                    data-testid="button-ai-human"
                  >
                    AI + Human Advantage
                  </Button>
                  <Button
                    onClick={() => handleTopicSelect("talk-human")}
                    variant="outline"
                    className="w-full justify-start text-left border-violet-300 text-gray-700 hover:bg-violet-50 hover:border-violet-400"
                    data-testid="button-talk-human"
                  >
                    Talk to a Human Expert
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Luminous sparkle effects */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
          <Sparkles className="absolute top-4 right-4 h-5 w-5 text-violet-500 opacity-70 animate-pulse" />
          <Sparkles
            className="absolute bottom-20 left-6 h-4 w-4 text-blue-500 opacity-50 animate-pulse"
            style={{ animationDelay: "1s" }}
          />
        </div>
      </div>
    </div>
  );
}
