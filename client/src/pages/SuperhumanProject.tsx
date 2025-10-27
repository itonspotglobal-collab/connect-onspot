import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface CouncilMember {
  id: number;
  name: string;
  role: string;
  initials: string;
  angle: number;
}

const councilMembers: CouncilMember[] = [
  { id: 1, name: "Steve Jobs", role: "Design & Innovation", initials: "SJ", angle: 0 },
  { id: 2, name: "Marcus Aurelius", role: "Stoic Philosophy", initials: "MA", angle: 60 },
  { id: 3, name: "Maya Angelou", role: "Wisdom & Expression", initials: "MA", angle: 120 },
  { id: 4, name: "Elon Musk", role: "Vision & Execution", initials: "EM", angle: 180 },
  { id: 5, name: "Oprah Winfrey", role: "Empathy & Growth", initials: "OW", angle: 240 },
  { id: 6, name: "Leonardo da Vinci", role: "Creativity & Science", initials: "LV", angle: 300 },
];

function OrbitingCouncil() {
  const [hoveredMember, setHoveredMember] = useState<number | null>(null);
  const [rotation, setRotation] = useState(0);
  const orbitRadius = 200;

  return (
    <div className="relative w-full h-[500px] flex items-center justify-center">
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full border border-primary/10"
        animate={{ rotate: 360 }}
        transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
        onUpdate={(latest) => {
          if (typeof latest.rotate === "number") {
            setRotation(latest.rotate);
          }
        }}
      >
        {councilMembers.map((member) => {
          const totalAngle = member.angle + rotation;
          const x = Math.cos((totalAngle * Math.PI) / 180) * orbitRadius;
          const y = Math.sin((totalAngle * Math.PI) / 180) * orbitRadius;

          return (
            <motion.div
              key={member.id}
              className="absolute left-1/2 top-1/2"
              style={{
                x,
                y,
                rotate: -rotation,
              }}
              onHoverStart={() => setHoveredMember(member.id)}
              onHoverEnd={() => setHoveredMember(null)}
            >
              <motion.div
                className="relative w-20 h-20 -ml-10 -mt-10 rounded-full bg-gradient-to-br from-primary/30 to-purple-500/20 border border-primary/40 flex items-center justify-center text-lg font-semibold cursor-pointer backdrop-blur-sm"
                whileHover={{ scale: 1.15 }}
                animate={{
                  boxShadow:
                    hoveredMember === member.id
                      ? "0 0 40px rgba(139, 92, 246, 0.8), 0 0 80px rgba(139, 92, 246, 0.4)"
                      : "0 0 15px rgba(139, 92, 246, 0.3)",
                }}
                transition={{ duration: 0.3 }}
              >
                <span className="text-primary">{member.initials}</span>
                
                {hoveredMember === member.id && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute -bottom-20 left-1/2 -translate-x-1/2 whitespace-nowrap bg-background/95 backdrop-blur-md border border-primary/30 rounded-lg px-4 py-3 shadow-2xl z-10"
                  >
                    <p className="text-sm font-semibold text-foreground">{member.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{member.role}</p>
                  </motion.div>
                )}
              </motion.div>
            </motion.div>
          );
        })}
      </motion.div>

      <motion.div
        className="absolute w-24 h-24 rounded-full bg-gradient-to-br from-primary/40 to-purple-500/40 blur-2xl"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <div className="absolute w-16 h-16 rounded-full bg-gradient-to-br from-background to-background/80 border-2 border-primary/50 flex items-center justify-center backdrop-blur-sm">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/40 to-purple-500/40" />
      </div>
    </div>
  );
}

function PulsingButton({ children, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <div className="relative inline-block">
      <motion.div
        className="absolute inset-0 rounded-md bg-primary/30 blur-lg"
        animate={{
          scale: [1, 1.05, 1],
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <Button
        {...props}
        size="lg"
        className="relative bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 py-6 text-lg"
        data-testid="button-join-waitlist"
      >
        {children}
        <ArrowRight className="ml-2 h-5 w-5" />
      </Button>
    </div>
  );
}

export default function SuperhumanProject() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const questionY = useTransform(scrollYProgress, [0.1, 0.3], [100, 0]);
  const questionOpacity = useTransform(scrollYProgress, [0.1, 0.3], [0, 1]);
  const visionY = useTransform(scrollYProgress, [0.3, 0.5], [100, 0]);
  const visionOpacity = useTransform(scrollYProgress, [0.3, 0.5], [0, 1]);

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-background text-foreground overflow-x-hidden"
      style={{
        background: "radial-gradient(ellipse at top, rgba(139, 92, 246, 0.15) 0%, rgba(0, 0, 0, 0.95) 50%)",
      }}
    >
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{
          background: [
            "radial-gradient(circle at 20% 50%, rgba(139, 92, 246, 0.1) 0%, transparent 50%)",
            "radial-gradient(circle at 80% 50%, rgba(168, 85, 247, 0.1) 0%, transparent 50%)",
            "radial-gradient(circle at 20% 50%, rgba(139, 92, 246, 0.1) 0%, transparent 50%)",
          ],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
      />

      <motion.section
        style={{ opacity: heroOpacity }}
        className="relative min-h-screen flex flex-col items-center justify-center px-6 text-center"
      >
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="text-6xl md:text-8xl font-light tracking-tight mb-6"
          style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" }}
        >
          The Superhuman Project
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4 }}
          className="text-xl md:text-3xl text-muted-foreground font-light mb-12 max-w-3xl"
        >
          Build an AI version of yourself—100x better.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.6 }}
        >
          <PulsingButton>Join the Waitlist</PulsingButton>
        </motion.div>
      </motion.section>

      <motion.section
        style={{ y: questionY, opacity: questionOpacity }}
        className="relative min-h-screen flex flex-col items-center justify-center px-6 text-center"
      >
        <h2 className="text-4xl md:text-6xl font-light tracking-tight mb-8 max-w-4xl leading-tight">
          What if you could design a version of yourself—100x better?
        </h2>
        <div className="space-y-4 text-xl md:text-2xl text-muted-foreground font-light max-w-2xl">
          <p>Your intelligence. Your habits. Your emotions.</p>
          <p className="text-primary">Enhanced. Accelerated. Multiplied.</p>
        </div>
      </motion.section>

      <motion.section
        style={{ y: visionY, opacity: visionOpacity }}
        className="relative min-h-screen flex flex-col items-center justify-center px-6 text-center"
      >
        <h2 className="text-4xl md:text-5xl font-light tracking-tight mb-6">
          Meet Your Superhuman AI.
        </h2>
        <div className="space-y-6 text-lg md:text-xl text-muted-foreground font-light max-w-3xl leading-relaxed">
          <p>It learns from you—your tone, your reflections, your decisions.</p>
          <p>It evolves daily, sharpening your thinking and expanding your capacity.</p>
          <p className="text-foreground font-normal">
            It becomes your ultimate companion—<br />
            the you that never stops improving.
          </p>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 1 }}
        className="relative min-h-screen flex flex-col items-center justify-center px-6 py-20"
      >
        <h2 className="text-4xl md:text-5xl font-light tracking-tight mb-4 text-center">
          The Council of Greatness
        </h2>
        <p className="text-lg md:text-xl text-muted-foreground font-light mb-16 text-center max-w-2xl">
          No one becomes Superhuman alone.<br />
          Your personal boardroom of legends guides your AI's mindset.
        </p>
        
        <OrbitingCouncil />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-20"
        >
          <PulsingButton>Begin Your Transformation</PulsingButton>
        </motion.div>
      </motion.section>

      <footer className="relative py-12 border-t border-primary/10 text-center">
        <p className="text-sm text-muted-foreground font-light">
          Designed by OnSpot. Built by You.
        </p>
      </footer>
    </div>
  );
}
