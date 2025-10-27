import { motion, useScroll, useTransform, useMotionValue } from "framer-motion";
import { useRef, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

// Seeded random number generator for deterministic particles
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Enhanced animated particles component
function AnimatedParticles() {
  const particles = useMemo(() => 
    Array.from({ length: 60 }, (_, i) => ({
      id: i,
      x: seededRandom(i * 3.14159) * 100,
      y: seededRandom(i * 2.71828) * 100,
      size: seededRandom(i * 1.41421) * 4 + 1,
      duration: seededRandom(i * 1.73205) * 12 + 18,
      delay: seededRandom(i * 2.23607) * 6,
    }))
  , []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full bg-blue-400/30 blur-md"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size,
          }}
          animate={{
            y: [-30, -60, -30],
            x: [0, seededRandom(particle.id) * 20 - 10, 0],
            opacity: [0, 0.6, 0],
            scale: [1, 1.8, 1],
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

// Scroll cue
function ScrollCue() {
  return (
    <motion.div
      className="absolute bottom-16 left-1/2 -translate-x-1/2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 2.5, duration: 1 }}
    >
      <motion.div
        className="w-px h-14 bg-gradient-to-b from-transparent via-blue-400 to-transparent"
        animate={{
          opacity: [0.4, 1, 0.4],
          scaleY: [1, 1.3, 1],
        }}
        transition={{
          duration: 2.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          boxShadow: "0 0 24px rgba(96, 165, 250, 0.6)",
        }}
      />
    </motion.div>
  );
}

// 3D Holographic Sphere - minimalist blue version
function HolographicSphere() {
  return (
    <div className="relative w-72 h-72 flex items-center justify-center my-16">
      <motion.div
        className="absolute w-full h-full rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)",
          filter: "blur(50px)",
        }}
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.4, 0.7, 0.4],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <div className="relative w-44 h-44">
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle at 35% 35%, 
              rgba(147, 197, 253, 0.5), 
              rgba(96, 165, 250, 0.7) 50%, 
              rgba(59, 130, 246, 0.9))`,
            boxShadow: `
              inset -8px -8px 32px rgba(96, 165, 250, 0.5),
              inset 8px 8px 32px rgba(147, 197, 253, 0.3),
              0 0 50px rgba(96, 165, 250, 0.4),
              0 0 80px rgba(59, 130, 246, 0.2)
            `,
          }}
          animate={{
            rotateY: [0, 360],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "linear",
          }}
        />

        {[0, 60, 120].map((rotation, index) => (
          <motion.div
            key={index}
            className="absolute inset-0"
            style={{
              border: "1px solid rgba(96, 165, 250, 0.25)",
              borderRadius: "50%",
              transform: `rotateY(${rotation}deg) rotateX(75deg)`,
            }}
            animate={{
              rotateZ: [0, 360],
            }}
            transition={{
              duration: 18 + index * 4,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        ))}

        {Array.from({ length: 6 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1.5 h-1.5 rounded-full bg-blue-200"
            style={{
              left: "50%",
              top: "50%",
              boxShadow: "0 0 8px rgba(147, 197, 253, 0.9)",
            }}
            animate={{
              x: [
                Math.cos((i * Math.PI) / 3) * 90,
                Math.cos(((i + 1) * Math.PI) / 3) * 90,
              ],
              y: [
                Math.sin((i * Math.PI) / 3) * 90,
                Math.sin(((i + 1) * Math.PI) / 3) * 90,
              ],
              opacity: [0.4, 1, 0.4],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              delay: i * 0.4,
              ease: "linear",
            }}
          />
        ))}
      </div>

      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(96, 165, 250, 0.15) 0%, transparent 65%)",
          filter: "blur(25px)",
        }}
        animate={{
          scale: [1, 1.25, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 4,
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
        className="absolute w-[400px] h-[400px] rounded-full border border-blue-400/10"
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
                className="relative w-20 h-20 -ml-10 -mt-10 rounded-full bg-gradient-to-br from-blue-400/30 to-violet-500/20 border border-blue-300/40 flex items-center justify-center text-lg font-semibold cursor-pointer backdrop-blur-sm"
                whileHover={{ scale: 1.15 }}
                animate={{
                  boxShadow:
                    hoveredMember === member.id
                      ? "0 0 30px rgba(96, 165, 250, 0.7), 0 0 60px rgba(96, 165, 250, 0.3)"
                      : "0 0 12px rgba(96, 165, 250, 0.25)",
                }}
                transition={{ duration: 0.3 }}
              >
                <span className="text-white font-bold">{member.initials}</span>
                
                {hoveredMember === member.id && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute -bottom-20 left-1/2 -translate-x-1/2 whitespace-nowrap bg-white/95 backdrop-blur-md border border-blue-200/60 rounded-xl px-4 py-3 shadow-xl z-10"
                  >
                    <p className="text-sm font-semibold text-slate-800">{member.name}</p>
                    <p className="text-xs text-blue-600 mt-1">{member.role}</p>
                  </motion.div>
                )}
              </motion.div>
            </motion.div>
          );
        })}
      </motion.div>

      <motion.div
        className="absolute w-24 h-24 rounded-full bg-gradient-to-br from-blue-400/25 to-violet-500/15 blur-2xl"
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
      <div className="absolute w-16 h-16 rounded-full bg-white/90 border-2 border-blue-300/50 flex items-center justify-center backdrop-blur-sm">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400/40 to-violet-500/30" />
      </div>
    </div>
  );
}

function PulsingButton({ children, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <div className="relative inline-block">
      <motion.div
        className="absolute inset-0 rounded-xl bg-blue-500/30 blur-xl"
        animate={{
          scale: [1, 1.08, 1],
          opacity: [0.5, 0.85, 0.5],
        }}
        transition={{
          duration: 3.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <Button
        {...props}
        size="lg"
        className="relative bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white font-semibold px-10 py-7 text-lg rounded-xl shadow-lg"
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
  const questionY = useTransform(scrollYProgress, [0.15, 0.35], [120, 0]);
  const questionOpacity = useTransform(scrollYProgress, [0.15, 0.35], [0, 1]);
  const visionY = useTransform(scrollYProgress, [0.35, 0.55], [120, 0]);
  const visionOpacity = useTransform(scrollYProgress, [0.35, 0.55], [0, 1]);

  return (
    <div
      ref={containerRef}
      className="relative min-h-screen overflow-x-hidden"
    >
      {/* SECTION 1: Hero - Dark with brand colors */}
      <motion.section
        style={{ opacity: heroOpacity }}
        className="relative min-h-screen flex flex-col items-center justify-center px-6 text-center hero-investor"
      >
        {/* Brand-aligned gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/30 pointer-events-none" />

        {/* Breathing ambient gradient */}
        <motion.div
          className="absolute inset-0 overflow-hidden pointer-events-none"
          animate={{
            background: [
              "radial-gradient(circle at 25% 50%, rgba(59, 130, 246, 0.12) 0%, transparent 50%)",
              "radial-gradient(circle at 75% 50%, rgba(96, 165, 250, 0.12) 0%, transparent 50%)",
              "radial-gradient(circle at 25% 50%, rgba(59, 130, 246, 0.12) 0%, transparent 50%)",
            ],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Enhanced particle system */}
        <AnimatedParticles />

        {/* Larger breathing glow effect */}
        <motion.div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(96, 165, 250, 0.08) 0%, transparent 60%)",
            filter: "blur(80px)",
          }}
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        <div className="max-w-5xl mx-auto space-y-8 relative z-10">
          {/* Badge - smaller size */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="inline-flex items-center gap-2 text-[10px] font-medium text-blue-300/90 tracking-wide bg-blue-500/10 backdrop-blur-sm px-3 py-1.5 rounded-full border border-blue-400/20"
          >
            <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse"></div>
            Built by OnSpot. Powered by YOU
          </motion.div>

          {/* Main Headline - SMALLER sizes */}
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.3 }}
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.1]"
            style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.5 }}
            >
              What if you could design
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.7 }}
            >
              a version of yourself—
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.9 }}
              className="bg-gradient-to-r from-blue-300 via-violet-300 to-blue-300 bg-clip-text text-transparent"
            >
              100x better?
            </motion.div>
          </motion.h1>

          {/* CTA Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.3 }}
          >
            <PulsingButton>Join the Waitlist</PulsingButton>
          </motion.div>
        </div>

        <ScrollCue />
      </motion.section>

      {/* Seamless gradient transition */}
      <div className="h-40 bg-gradient-to-b from-black/0 via-indigo-50/50 to-indigo-50" />

      {/* SECTION 2: Light Lavender/Baby Blue Section */}
      <motion.section
        style={{ y: questionY, opacity: questionOpacity }}
        className="relative min-h-screen flex flex-col items-center justify-center px-6 py-32 bg-gradient-to-b from-indigo-50 via-blue-50/50 to-violet-50"
      >
        <div className="max-w-5xl mx-auto space-y-12 text-center">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 1 }}
            className="space-y-6"
          >
            <p className="text-lg md:text-xl text-slate-600 font-light leading-relaxed">
              Your intelligence. Your habits. Your emotions.
            </p>
            <p className="text-2xl md:text-4xl text-blue-600 font-medium">
              Enhanced. Accelerated. Multiplied.
            </p>
          </motion.div>
        </div>
      </motion.section>

      {/* SECTION 3: Vision with Holographic Sphere */}
      <motion.section
        style={{ y: visionY, opacity: visionOpacity }}
        className="relative min-h-screen flex flex-col items-center justify-center px-6 py-32 bg-gradient-to-b from-violet-50 via-blue-50/30 to-slate-50"
      >
        <div className="max-w-4xl mx-auto space-y-8">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 1 }}
            className="text-4xl md:text-6xl font-light tracking-tight text-center text-slate-800"
          >
            Meet Your Superhuman AI
          </motion.h2>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 1.2, ease: [0.25, 0.4, 0.25, 1] }}
            className="flex justify-center"
          >
            <HolographicSphere />
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 1, delay: 0.3 }}
            className="space-y-8 text-lg md:text-xl font-light leading-relaxed text-slate-600 max-w-3xl mx-auto"
          >
            <motion.p
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              It learns from you — your tone, your reflections, your decisions.
            </motion.p>
            <motion.p
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.7 }}
            >
              It evolves daily, sharpening your thinking and expanding your capacity.
            </motion.p>
            <motion.p
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.9 }}
              className="text-slate-800 font-normal text-xl md:text-2xl"
            >
              It becomes your ultimate companion —<br />
              the you that never stops improving.
            </motion.p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 1.1 }}
            className="flex justify-center pt-8"
          >
            <PulsingButton>Join the Waitlist</PulsingButton>
          </motion.div>
        </div>
      </motion.section>

      {/* SECTION 4: The Council */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 1 }}
        className="relative min-h-screen flex flex-col items-center justify-center px-6 py-32 bg-gradient-to-b from-slate-50 via-blue-50/20 to-white"
      >
        <div className="max-w-5xl mx-auto space-y-16 text-center">
          <div className="space-y-4">
            <h2 className="text-4xl md:text-6xl font-light tracking-tight text-slate-800">
              The Council of Greatness
            </h2>
            <p className="text-lg md:text-xl font-light text-slate-600 max-w-2xl mx-auto leading-relaxed">
              No one becomes Superhuman alone.<br />
              Your personal boardroom of legends guides your AI's mindset.
            </p>
          </div>
          
          <OrbitingCouncil />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <PulsingButton>Begin Your Transformation</PulsingButton>
          </motion.div>
        </div>
      </motion.section>

      {/* Footer */}
      <footer className="relative py-16 bg-white border-t border-slate-200 text-center">
        <p className="text-sm text-slate-500 font-light">
          Designed by OnSpot. Built by You.
        </p>
      </footer>
    </div>
  );
}
