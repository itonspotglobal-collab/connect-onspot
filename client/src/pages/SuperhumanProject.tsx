import { motion, useScroll, useTransform, useMotionValue } from "framer-motion";
import { useRef, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, ChevronDown } from "lucide-react";

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
          className="absolute rounded-full bg-violet-400/30 blur-sm"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size,
          }}
          animate={{
            y: [-20, -40, -20],
            opacity: [0, 0.6, 0],
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

// Scroll indicator with breathing animation
function ScrollIndicator() {
  return (
    <motion.div
      className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 3, duration: 1 }}
    >
      <motion.div
        animate={{
          y: [0, 8, 0],
          opacity: [0.4, 1, 0.4],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <ChevronDown className="w-6 h-6 text-violet-300" />
      </motion.div>
    </motion.div>
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
              rgba(139, 92, 246, 0.4) 0%, 
              rgba(168, 85, 247, 0.3) 30%, 
              rgba(139, 92, 246, 0.2) 50%, 
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
              rgba(139, 92, 246, 0.6) 50%, 
              rgba(255, 255, 255, 0.8) 100%)`,
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
          background: "radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, transparent 70%)",
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
              rgba(168, 85, 247, 0.4), 
              rgba(139, 92, 246, 0.6) 50%, 
              rgba(88, 28, 135, 0.8))`,
            boxShadow: `
              inset -10px -10px 40px rgba(139, 92, 246, 0.4),
              inset 10px 10px 40px rgba(168, 85, 247, 0.2),
              0 0 60px rgba(139, 92, 246, 0.6),
              0 0 100px rgba(139, 92, 246, 0.3)
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
              border: "1px solid rgba(139, 92, 246, 0.3)",
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
            className="absolute w-2 h-2 rounded-full bg-violet-300"
            style={{
              left: "50%",
              top: "50%",
              boxShadow: "0 0 10px rgba(139, 92, 246, 0.8)",
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
          background: "radial-gradient(circle, rgba(139, 92, 246, 0.2) 0%, transparent 60%)",
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
        className="absolute w-[400px] h-[400px] rounded-full border border-primary/10"
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
                className="relative w-20 h-20 -ml-10 -mt-10 rounded-full bg-gradient-to-br from-violet-500/40 to-purple-600/30 border border-violet-400/60 flex items-center justify-center text-lg font-semibold cursor-pointer backdrop-blur-sm"
                whileHover={{ scale: 1.15 }}
                animate={{
                  boxShadow:
                    hoveredMember === member.id
                      ? "0 0 40px rgba(139, 92, 246, 0.8), 0 0 80px rgba(139, 92, 246, 0.4)"
                      : "0 0 15px rgba(139, 92, 246, 0.3)",
                }}
                transition={{ duration: 0.3 }}
              >
                <span className="text-white font-bold">{member.initials}</span>
                
                {hoveredMember === member.id && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute -bottom-20 left-1/2 -translate-x-1/2 whitespace-nowrap bg-violet-950/95 backdrop-blur-md border border-violet-500/40 rounded-lg px-4 py-3 shadow-2xl z-10"
                  >
                    <p className="text-sm font-semibold text-white">{member.name}</p>
                    <p className="text-xs text-violet-200 mt-1">{member.role}</p>
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

  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);
  const silhouetteOpacity = useTransform(scrollYProgress, [0.05, 0.15, 0.25], [0, 1, 0]);
  const questionY = useTransform(scrollYProgress, [0.15, 0.35], [100, 0]);
  const questionOpacity = useTransform(scrollYProgress, [0.15, 0.35], [0, 1]);
  const visionY = useTransform(scrollYProgress, [0.35, 0.55], [100, 0]);
  const visionOpacity = useTransform(scrollYProgress, [0.35, 0.55], [0, 1]);

  return (
    <div
      ref={containerRef}
      className="relative min-h-screen overflow-x-hidden"
      style={{
        background: "linear-gradient(to bottom, #0a0612 0%, #1a0d2e 30%, #240b3a 60%, #1a0d2e 100%)",
      }}
    >
      {/* Animated particle system */}
      <AnimatedParticles />

      {/* Breathing ambient gradient */}
      <motion.div
        className="fixed inset-0 pointer-events-none"
        animate={{
          background: [
            "radial-gradient(circle at 20% 50%, rgba(139, 92, 246, 0.15) 0%, transparent 50%)",
            "radial-gradient(circle at 80% 50%, rgba(168, 85, 247, 0.15) 0%, transparent 50%)",
            "radial-gradient(circle at 20% 50%, rgba(139, 92, 246, 0.15) 0%, transparent 50%)",
          ],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
      />

      {/* SECTION 1: The Entrance (Full Screen Hero) */}
      <motion.section
        style={{ opacity: heroOpacity }}
        className="relative min-h-screen flex flex-col items-center justify-center px-6 text-center"
      >
        {/* Logo appears slowly */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.5, ease: [0.25, 0.4, 0.25, 1] }}
          className="mb-12"
        >
          <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-purple-400 to-violet-400">
            OnSpot
          </div>
        </motion.div>

        {/* Headline fades in word by word */}
        <h1
          className="text-6xl md:text-8xl font-light tracking-tight mb-6 text-white"
          style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" }}
        >
          <WordByWord text="The Superhuman Project" delay={0.8} />
        </h1>

        {/* Subtitle with delay */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 2.5, ease: [0.25, 0.4, 0.25, 1] }}
          className="text-xl md:text-2xl text-slate-400 font-light mb-12"
        >
          Built by OnSpot. Powered by You.
        </motion.p>

        {/* Scroll indicator */}
        <ScrollIndicator />
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
          <p className="text-slate-300">Your intelligence. Your habits. Your emotions.</p>
          <p className="text-violet-300 font-normal">Enhanced. Accelerated. Multiplied.</p>
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
            className="text-slate-300"
          >
            It learns from you — your tone, your reflections, your decisions.
          </motion.p>
          <motion.p
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.9, ease: [0.25, 0.4, 0.25, 1] }}
            className="text-slate-300"
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
        <p className="text-lg md:text-xl font-light mb-16 text-center max-w-2xl text-slate-300">
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
        <p className="text-sm text-slate-400 font-light">
          Designed by OnSpot. Built by You.
        </p>
      </footer>
    </div>
  );
}
