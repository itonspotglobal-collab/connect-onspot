import { motion, useScroll, useTransform, useMotionValue } from "framer-motion";
import { useRef, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

// Seeded random number generator for deterministic particles
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Animated particles component for "intelligence awakening" effect
function AnimatedParticles() {
  // Memoize particles to prevent re-generation on every render
  const particles = useMemo(() => 
    Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: seededRandom(i * 3.14159) * 100,
      y: seededRandom(i * 2.71828) * 100,
      size: seededRandom(i * 1.41421) * 3 + 1,
      duration: seededRandom(i * 1.73205) * 10 + 15,
      delay: seededRandom(i * 2.23607) * 5,
    }))
  , []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full bg-blue-400/20 blur-sm"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size,
          }}
          animate={{
            y: [-20, -40, -20],
            opacity: [0, 0.5, 0],
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            delay: particle.delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// Scroll cue - thin glowing blue gradient line
function ScrollCue() {
  return (
    <motion.div
      className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 2, duration: 1 }}
    >
      <motion.div
        className="w-px h-12 bg-gradient-to-b from-transparent via-blue-500 to-transparent"
        animate={{
          opacity: [0.3, 1, 0.3],
          scaleY: [1, 1.2, 1],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          boxShadow: "0 0 20px rgba(59, 130, 246, 0.5)",
        }}
      />
    </motion.div>
  );
}

// Word-by-word animation component
function WordByWord({ text, className, delay = 0 }: { text: string; className?: string; delay?: number }) {
  const words = text.split(" ");
  
  return (
    <span className={className}>
      {words.map((word, index) => (
        <motion.span
          key={index}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.8,
            delay: delay + index * 0.15,
            ease: [0.25, 0.4, 0.25, 1],
          }}
          className="inline-block mr-[0.25em]"
        >
          {word}
        </motion.span>
      ))}
    </span>
  );
}

// Human silhouette transition effect
function HumanSilhouette({ opacity }: { opacity: any }) {
  return (
    <motion.div
      style={{ opacity }}
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
    >
      <div className="relative w-64 h-96">
        {/* Human silhouette shape */}
        <motion.div
          className="absolute inset-0 opacity-30"
          style={{
            background: `radial-gradient(ellipse at center, 
              rgba(59, 130, 246, 0.3) 0%, 
              rgba(96, 165, 250, 0.2) 30%, 
              rgba(59, 130, 246, 0.15) 50%, 
              transparent 70%)`,
            filter: "blur(40px)",
          }}
          animate={{
            scale: [1, 1.05, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        {/* Light effect - half human, half light */}
        <motion.div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(90deg, 
              transparent 0%, 
              rgba(59, 130, 246, 0.5) 50%, 
              rgba(255, 255, 255, 0.7) 100%)`,
            filter: "blur(30px)",
          }}
          animate={{
            x: [-20, 20, -20],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>
    </motion.div>
  );
}

// 3D Holographic Sphere
function HolographicSphere() {
  return (
    <div className="relative w-80 h-80 flex items-center justify-center my-12">
      {/* Outer glow */}
      <motion.div
        className="absolute w-full h-full rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(59, 130, 246, 0.25) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Main sphere with rings */}
      <div className="relative w-48 h-48">
        {/* Core sphere */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle at 30% 30%, 
              rgba(96, 165, 250, 0.4), 
              rgba(59, 130, 246, 0.6) 50%, 
              rgba(37, 99, 235, 0.8))`,
            boxShadow: `
              inset -10px -10px 40px rgba(59, 130, 246, 0.4),
              inset 10px 10px 40px rgba(96, 165, 250, 0.2),
              0 0 60px rgba(59, 130, 246, 0.5),
              0 0 100px rgba(59, 130, 246, 0.3)
            `,
          }}
          animate={{
            rotateY: [0, 360],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear",
          }}
        />

        {/* Orbital rings */}
        {[0, 60, 120].map((rotation, index) => (
          <motion.div
            key={index}
            className="absolute inset-0"
            style={{
              border: "1px solid rgba(59, 130, 246, 0.3)",
              borderRadius: "50%",
              transform: `rotateY(${rotation}deg) rotateX(75deg)`,
            }}
            animate={{
              rotateZ: [0, 360],
            }}
            transition={{
              duration: 15 + index * 3,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        ))}

        {/* Light particles orbiting */}
        {Array.from({ length: 8 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full bg-blue-300"
            style={{
              left: "50%",
              top: "50%",
              boxShadow: "0 0 10px rgba(59, 130, 246, 0.8)",
            }}
            animate={{
              x: [
                Math.cos((i * Math.PI) / 4) * 100,
                Math.cos(((i + 1) * Math.PI) / 4) * 100,
              ],
              y: [
                Math.sin((i * Math.PI) / 4) * 100,
                Math.sin(((i + 1) * Math.PI) / 4) * 100,
              ],
              opacity: [0.3, 1, 0.3],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              delay: i * 0.3,
              ease: "linear",
            }}
          />
        ))}
      </div>

      {/* Pulsating ambient light */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, transparent 60%)",
          filter: "blur(20px)",
        }}
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </div>
  );
}

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
  const rotation = useMotionValue(0);
  const orbitRadius = 200;

  return (
    <div className="relative w-full h-[500px] flex items-center justify-center">
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full border border-blue-500/10"
        animate={{ rotate: 360 }}
        transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
        onUpdate={(latest) => {
          if (typeof latest.rotate === "number") {
            rotation.set(latest.rotate);
          }
        }}
      >
        {councilMembers.map((member) => {
          return (
            <motion.div
              key={member.id}
              className="absolute left-1/2 top-1/2"
              style={{
                x: useTransform(rotation, (r) => Math.cos(((member.angle + r) * Math.PI) / 180) * orbitRadius),
                y: useTransform(rotation, (r) => Math.sin(((member.angle + r) * Math.PI) / 180) * orbitRadius),
                rotate: useTransform(rotation, (r) => -r),
              }}
              onHoverStart={() => setHoveredMember(member.id)}
              onHoverEnd={() => setHoveredMember(null)}
            >
              <motion.div
                className="relative w-20 h-20 -ml-10 -mt-10 rounded-full bg-gradient-to-br from-blue-500/30 to-violet-600/20 border border-blue-400/50 flex items-center justify-center text-lg font-semibold cursor-pointer backdrop-blur-sm"
                whileHover={{ scale: 1.15 }}
                animate={{
                  boxShadow:
                    hoveredMember === member.id
                      ? "0 0 40px rgba(59, 130, 246, 0.8), 0 0 80px rgba(59, 130, 246, 0.4)"
                      : "0 0 15px rgba(59, 130, 246, 0.3)",
                }}
                transition={{ duration: 0.3 }}
              >
                <span className="text-white font-bold">{member.initials}</span>
                
                {hoveredMember === member.id && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute -bottom-20 left-1/2 -translate-x-1/2 whitespace-nowrap bg-blue-950/95 backdrop-blur-md border border-blue-500/40 rounded-lg px-4 py-3 shadow-2xl z-10"
                  >
                    <p className="text-sm font-semibold text-white">{member.name}</p>
                    <p className="text-xs text-blue-200 mt-1">{member.role}</p>
                  </motion.div>
                )}
              </motion.div>
            </motion.div>
          );
        })}
      </motion.div>

      <motion.div
        className="absolute w-24 h-24 rounded-full bg-gradient-to-br from-blue-500/30 to-violet-600/20 blur-2xl"
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
      <div className="absolute w-16 h-16 rounded-full bg-gradient-to-br from-background to-background/80 border-2 border-blue-500/40 flex items-center justify-center backdrop-blur-sm">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/30 to-violet-600/20" />
      </div>
    </div>
  );
}

function PulsingButton({ children, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <div className="relative inline-block">
      <motion.div
        className="absolute inset-0 rounded-md bg-blue-600/30 blur-lg"
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
        className="relative bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white font-semibold px-8 py-6 text-lg"
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

  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);
  const silhouetteOpacity = useTransform(scrollYProgress, [0.05, 0.15, 0.25], [0, 1, 0]);
  const questionY = useTransform(scrollYProgress, [0.15, 0.35], [100, 0]);
  const questionOpacity = useTransform(scrollYProgress, [0.15, 0.35], [0, 1]);
  const visionY = useTransform(scrollYProgress, [0.35, 0.55], [100, 0]);
  const visionOpacity = useTransform(scrollYProgress, [0.35, 0.55], [0, 1]);

  return (
    <div
      ref={containerRef}
      className="relative min-h-screen overflow-x-hidden hero-investor"
    >
      {/* Brand-aligned gradient overlay matching homepage */}
      <div className="fixed inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/30 pointer-events-none" />

      {/* Subtle animated accents - matching homepage style */}
      <motion.div
        className="fixed inset-0 overflow-hidden pointer-events-none"
        animate={{
          background: [
            "radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.08) 0%, transparent 50%)",
            "radial-gradient(circle at 80% 50%, rgba(96, 165, 250, 0.08) 0%, transparent 50%)",
            "radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.08) 0%, transparent 50%)",
          ],
        }}
        transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
      />

      {/* Clean particle system */}
      <AnimatedParticles />

      {/* SECTION 1: Brand-Aligned Hero */}
      <motion.section
        style={{ opacity: heroOpacity }}
        className="relative min-h-screen flex flex-col items-center justify-center px-6 text-center"
      >
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Question first - sequential fade-in */}
          <motion.h2
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-3xl md:text-5xl lg:text-6xl font-light tracking-tight text-white/90 leading-tight"
            style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" }}
          >
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="inline-block"
            >
              What if you could design
            </motion.span>
            <br />
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.45 }}
              className="inline-block"
            >
              a version of yourself—
            </motion.span>
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="inline-block bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent font-normal"
            >
              100x better?
            </motion.span>
          </motion.h2>

          {/* The Superhuman Project headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.9 }}
            className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight text-white leading-tight"
            style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" }}
          >
            The Superhuman Project
          </motion.h1>

          {/* CTA Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.2 }}
          >
            <PulsingButton>Join the Waitlist</PulsingButton>
          </motion.div>
        </div>

        {/* Scroll cue - thin glowing blue line */}
        <ScrollCue />
      </motion.section>

      {/* Human silhouette transition */}
      <HumanSilhouette opacity={silhouetteOpacity} />

      {/* SECTION 2: The Question That Changes Everything */}
      <motion.section
        style={{ y: questionY, opacity: questionOpacity }}
        className="relative min-h-screen flex flex-col items-center justify-center px-6 text-center"
      >
        <motion.h2
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 1.2, ease: [0.25, 0.4, 0.25, 1] }}
          className="text-4xl md:text-6xl font-light tracking-tight mb-12 max-w-4xl leading-tight text-white"
        >
          What if you could design a version of yourself—100x better?
        </motion.h2>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 1, delay: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
          className="space-y-4 text-xl md:text-2xl font-light max-w-2xl"
        >
          <p className="text-white/70">Your intelligence. Your habits. Your emotions.</p>
          <p className="text-blue-300 font-normal">Enhanced. Accelerated. Multiplied.</p>
        </motion.div>
      </motion.section>

      {/* SECTION 3: Vision */}
      <motion.section
        style={{ y: visionY, opacity: visionOpacity }}
        className="relative min-h-screen flex flex-col items-center justify-center px-6"
      >
        <motion.h2
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 1.2, ease: [0.25, 0.4, 0.25, 1] }}
          className="text-4xl md:text-5xl font-light tracking-tight mb-6 text-center text-white"
        >
          Meet Your Superhuman AI.
        </motion.h2>

        {/* 3D Holographic Sphere */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 1.5, ease: [0.25, 0.4, 0.25, 1] }}
        >
          <HolographicSphere />
        </motion.div>

        {/* Left-aligned text with fade-in */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="space-y-6 text-lg md:text-xl font-light max-w-3xl leading-relaxed text-left"
        >
          <motion.p
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
            className="text-white/70"
          >
            It learns from you — your tone, your reflections, your decisions.
          </motion.p>
          <motion.p
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.9, ease: [0.25, 0.4, 0.25, 1] }}
            className="text-white/70"
          >
            It evolves daily, sharpening your thinking and expanding your capacity.
          </motion.p>
          <motion.p
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 1.2, ease: [0.25, 0.4, 0.25, 1] }}
            className="text-white font-normal"
          >
            It becomes your ultimate companion —<br />
            the you that never stops improving.
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 1.5 }}
          className="mt-12"
        >
          <PulsingButton>Join the Waitlist</PulsingButton>
        </motion.div>
      </motion.section>

      {/* SECTION 4: The Council of Greatness */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 1 }}
        className="relative min-h-screen flex flex-col items-center justify-center px-6 py-20"
      >
        <h2 className="text-4xl md:text-5xl font-light tracking-tight mb-4 text-center text-white">
          The Council of Greatness
        </h2>
        <p className="text-lg md:text-xl font-light mb-16 text-center max-w-2xl text-white/70">
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

      <footer className="relative py-12 border-t border-white/10 text-center">
        <p className="text-sm text-white/50 font-light">
          Designed by OnSpot. Built by You.
        </p>
      </footer>
    </div>
  );
}
