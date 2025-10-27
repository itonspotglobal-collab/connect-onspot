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

// Human silhouette component for council members
function HumanSilhouette({ size = 60, glowIntensity = 0.5, isCenter = false }: { size?: number; glowIntensity?: number; isCenter?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className="relative"
    >
      <defs>
        <radialGradient id={`halo-${size}-${isCenter}`} cx="50%" cy="50%">
          {isCenter ? (
            <>
              <stop offset="0%" stopColor="rgba(59, 130, 246, 0.8)" />
              <stop offset="30%" stopColor="rgba(96, 165, 250, 0.6)" />
              <stop offset="60%" stopColor="rgba(147, 197, 253, 0.4)" />
              <stop offset="100%" stopColor="transparent" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="rgba(167, 139, 250, 0.7)" />
              <stop offset="50%" stopColor="rgba(139, 92, 246, 0.4)" />
              <stop offset="100%" stopColor="transparent" />
            </>
          )}
        </radialGradient>
        <filter id={`silhouette-glow-${size}-${isCenter}`}>
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Halo */}
      <circle
        cx="50"
        cy="50"
        r="45"
        fill={`url(#halo-${size}-${isCenter})`}
        opacity={glowIntensity}
      />

      {/* Head */}
      <ellipse
        cx="50"
        cy="30"
        rx="12"
        ry="14"
        fill={isCenter ? "rgba(59, 130, 246, 0.85)" : "rgba(167, 139, 250, 0.85)"}
        stroke={isCenter ? "rgba(96, 165, 250, 1)" : "rgba(139, 92, 246, 1)"}
        strokeWidth="2"
        filter={`url(#silhouette-glow-${size}-${isCenter})`}
      />

      {/* Neck */}
      <path
        d="M 50 44 L 50 52"
        stroke={isCenter ? "rgba(59, 130, 246, 0.75)" : "rgba(167, 139, 250, 0.75)"}
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Shoulders and torso */}
      <path
        d="M 35 55 Q 42 52, 50 52 Q 58 52, 65 55 L 62 75 Q 56 78, 50 78 Q 44 78, 38 75 Z"
        fill={isCenter ? "rgba(59, 130, 246, 0.75)" : "rgba(167, 139, 250, 0.75)"}
        stroke={isCenter ? "rgba(96, 165, 250, 1)" : "rgba(139, 92, 246, 1)"}
        strokeWidth="2"
        filter={`url(#silhouette-glow-${size}-${isCenter})`}
      />
    </svg>
  );
}

function OrbitingCouncil() {
  const [hoveredMember, setHoveredMember] = useState<number | null>(null);
  const [centerHovered, setCenterHovered] = useState(false);
  const rotation = useMotionValue(0);
  const orbitRadius = 220;

  return (
    <div className="relative w-full h-[600px] flex items-center justify-center">
      {/* Subtle radial lighting background */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 80% 80% at 50% 50%, rgba(59, 130, 246, 0.12) 0%, transparent 70%)",
        }}
        animate={{
          opacity: [0.5, 0.8, 0.5],
          scale: [1, 1.05, 1],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Energy connection lines from council to center */}
      {councilMembers.map((member) => (
        <motion.div
          key={`energy-line-${member.id}`}
          className="absolute left-1/2 top-1/2 pointer-events-none"
          style={{
            width: `${orbitRadius}px`,
            height: '1px',
            transformOrigin: "0% 50%",
            rotate: useTransform(rotation, (r) => (member.angle + r)),
          }}
        >
          <motion.div
            className="w-full h-px"
            style={{
              background: `linear-gradient(to right, 
                rgba(59, 130, 246, 0.5) 0%, 
                rgba(96, 165, 250, 0.3) 50%, 
                rgba(139, 92, 246, 0.4) 100%)`,
            }}
            animate={{
              opacity: hoveredMember === member.id || centerHovered ? [0.3, 0.7, 0.3] : [0.1, 0.2, 0.1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </motion.div>
      ))}

      {/* Orbiting path visualization - very subtle */}
      <motion.div
        className="absolute w-[440px] h-[440px] rounded-full border border-violet-300/15"
        animate={{ rotate: 360 }}
        transition={{ duration: 180, repeat: Infinity, ease: "linear" }}
        onUpdate={(latest) => {
          if (typeof latest.rotate === "number") {
            rotation.set(latest.rotate);
          }
        }}
      >
        {councilMembers.map((member) => {
          const isHovered = hoveredMember === member.id;
          
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
                className="relative -ml-8 -mt-8 cursor-pointer"
                initial={{ scale: 1 }}
                whileHover={{ scale: 1.15 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                {/* Silhouette with enhanced glow on hover */}
                <motion.div
                  animate={{
                    filter: isHovered
                      ? "drop-shadow(0 0 25px rgba(139, 92, 246, 1)) drop-shadow(0 0 45px rgba(167, 139, 250, 0.7))"
                      : "drop-shadow(0 0 12px rgba(139, 92, 246, 0.6)) drop-shadow(0 0 25px rgba(167, 139, 250, 0.4))",
                  }}
                  transition={{ duration: 0.3 }}
                >
                  <HumanSilhouette size={64} glowIntensity={isHovered ? 0.9 : 0.6} />
                </motion.div>

                {/* Name and specialty on hover */}
                {isHovered && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="absolute -bottom-24 left-1/2 -translate-x-1/2 whitespace-nowrap bg-white/95 backdrop-blur-md border border-violet-300/60 rounded-2xl px-5 py-3 shadow-xl z-10"
                  >
                    <p className="text-sm font-semibold text-slate-800">{member.name}</p>
                    <p className="text-xs bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent mt-1 font-semibold">{member.role}</p>
                  </motion.div>
                )}
              </motion.div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Central glowing figure (the user) - larger and more prominent */}
      <motion.div
        className="absolute flex items-center justify-center cursor-pointer"
        animate={{
          scale: [1, 1.05, 1],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        onHoverStart={() => setCenterHovered(true)}
        onHoverEnd={() => setCenterHovered(false)}
      >
        {/* Pulsing glow background */}
        <motion.div
          className="absolute w-44 h-44 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, rgba(96, 165, 250, 0.25) 40%, transparent 70%)",
            filter: "blur(25px)",
          }}
          animate={{
            scale: centerHovered ? [1.3, 1.5, 1.3] : [1, 1.3, 1],
            opacity: centerHovered ? [0.6, 0.9, 0.6] : [0.4, 0.7, 0.4],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* User's central silhouette - larger */}
        <motion.div
          className="relative z-10"
          animate={{
            filter: centerHovered
              ? [
                  "drop-shadow(0 0 35px rgba(59, 130, 246, 1)) drop-shadow(0 0 70px rgba(96, 165, 250, 0.8))",
                  "drop-shadow(0 0 45px rgba(59, 130, 246, 1)) drop-shadow(0 0 90px rgba(96, 165, 250, 1))",
                  "drop-shadow(0 0 35px rgba(59, 130, 246, 1)) drop-shadow(0 0 70px rgba(96, 165, 250, 0.8))",
                ]
              : [
                  "drop-shadow(0 0 30px rgba(59, 130, 246, 0.9)) drop-shadow(0 0 60px rgba(96, 165, 250, 0.6))",
                  "drop-shadow(0 0 40px rgba(59, 130, 246, 1)) drop-shadow(0 0 80px rgba(96, 165, 250, 0.8))",
                  "drop-shadow(0 0 30px rgba(59, 130, 246, 0.9)) drop-shadow(0 0 60px rgba(96, 165, 250, 0.6))",
                ],
            scale: centerHovered ? 1.1 : 1,
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <HumanSilhouette size={95} glowIntensity={1} isCenter={true} />
        </motion.div>

        {/* "You" label on hover */}
        {centerHovered && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="absolute -top-24 left-1/2 -translate-x-1/2 whitespace-nowrap bg-white/95 backdrop-blur-md border-2 border-blue-400/80 rounded-2xl px-6 py-3 shadow-2xl z-10"
          >
            <p className="text-lg font-bold bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">You</p>
            <p className="text-xs text-slate-600 mt-0.5 font-medium">Surrounded by Greatness</p>
          </motion.div>
        )}

        {/* Multiple energy rings around user */}
        <motion.div
          className="absolute w-32 h-32 rounded-full border-2 border-blue-400/30"
          animate={{
            scale: [1, 1.25, 1],
            opacity: centerHovered ? [0.5, 0.8, 0.5] : [0.3, 0.6, 0.3],
            rotate: [0, 180, 360],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "linear",
          }}
        />
        <motion.div
          className="absolute w-40 h-40 rounded-full border border-violet-400/20"
          animate={{
            scale: [1, 1.2, 1],
            opacity: centerHovered ? [0.4, 0.7, 0.4] : [0.2, 0.5, 0.2],
            rotate: [360, 180, 0],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      </motion.div>
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
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* SECTION 1: Hero - Dark with brand colors */}
      <motion.section
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
            className="inline-flex items-center gap-2 text-[10px] font-medium text-white/70 tracking-wide bg-blue-500/10 backdrop-blur-sm px-3 py-1.5 rounded-full border border-blue-400/20"
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

      {/* TWO-COLUMN TRANSFORMATION SECTION */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 1.2 }}
        className="relative min-h-screen overflow-hidden hero-investor -mt-1"
      >
        {/* Radial light gradient blooming upward - neutral to blue */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 120% 100% at 50% 100%, rgba(59, 130, 246, 0.12) 0%, rgba(30, 58, 138, 0.08) 35%, transparent 70%)",
          }}
          animate={{
            opacity: [0.6, 0.8, 0.6],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Subtle breathing ambient light */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(circle at center, rgba(96, 165, 250, 0.05) 0%, transparent 60%)",
          }}
          animate={{
            scale: [1, 1.08, 1],
            opacity: [0.4, 0.6, 0.4],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Two-column grid */}
        <div className="max-w-7xl mx-auto px-8 md:px-12 lg:px-16 py-24 md:py-32 lg:py-40">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center min-h-[70vh]">
            
            {/* LEFT COLUMN - Headline */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 1, ease: [0.25, 0.4, 0.25, 1] }}
              className="flex flex-col items-center lg:items-end justify-center order-1 space-y-6"
            >
              <h2
                className="text-center lg:text-right text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] bg-gradient-to-r from-blue-300 via-violet-300 to-blue-300 bg-clip-text text-transparent"
                style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" }}
              >
                The Superhuman Project
              </h2>
              
              {/* Animated subtitle */}
              <motion.p
                className="text-center lg:text-right text-lg md:text-xl font-light text-white/70"
                style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" }}
                animate={{
                  opacity: [0, 1, 1, 0],
                }}
                transition={{
                  duration: 8,
                  repeat: Infinity,
                  ease: "easeInOut",
                  times: [0, 0.2, 0.8, 1],
                }}
              >
                Yourself, your team that never sleeps
              </motion.p>
            </motion.div>

            {/* RIGHT COLUMN - Shadow-Style Human Silhouette */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 1.2, delay: 0.2, ease: [0.25, 0.4, 0.25, 1] }}
              className="relative flex items-center justify-center lg:justify-start order-2"
            >
              <div className="relative w-full max-w-md aspect-[3/4]">
                
                {/* Shadow-style human figure - organic silhouette */}
                <svg
                  viewBox="0 0 300 400"
                  className="w-full h-full"
                  style={{ filter: "drop-shadow(0 0 40px rgba(147, 197, 253, 0.3))" }}
                >
                  <defs>
                    {/* Gradient fills for organic look */}
                    <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="rgba(147, 197, 253, 0.3)" />
                      <stop offset="50%" stopColor="rgba(96, 165, 250, 0.25)" />
                      <stop offset="100%" stopColor="rgba(59, 130, 246, 0.2)" />
                    </linearGradient>
                    
                    <radialGradient id="headGlow" cx="50%" cy="40%">
                      <stop offset="0%" stopColor="rgba(147, 197, 253, 0.6)" />
                      <stop offset="50%" stopColor="rgba(96, 165, 250, 0.3)" />
                      <stop offset="100%" stopColor="transparent" />
                    </radialGradient>

                    <linearGradient id="armGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="rgba(147, 197, 253, 0.25)" />
                      <stop offset="100%" stopColor="rgba(96, 165, 250, 0.35)" />
                    </linearGradient>

                    {/* Animated light ripple filter */}
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                  </defs>

                  {/* Head - slightly leaned forward */}
                  <motion.ellipse
                    cx="150"
                    cy="70"
                    rx="28"
                    ry="32"
                    fill="url(#headGlow)"
                    stroke="rgba(147, 197, 253, 0.7)"
                    strokeWidth="2"
                    filter="url(#glow)"
                    animate={{
                      strokeWidth: [2, 3, 2],
                      opacity: [0.8, 1, 0.8],
                    }}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />

                  {/* Neck */}
                  <motion.path
                    d="M 150 102 Q 148 110, 150 120"
                    fill="none"
                    stroke="rgba(147, 197, 253, 0.5)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    animate={{
                      opacity: [0.5, 0.7, 0.5],
                    }}
                    transition={{
                      duration: 6,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />

                  {/* Upper torso - leaning forward slightly */}
                  <motion.path
                    d="M 120 130 Q 115 150, 118 180 Q 120 220, 125 260 L 175 260 Q 180 220, 182 180 Q 185 150, 180 130 Z"
                    fill="url(#bodyGradient)"
                    stroke="rgba(147, 197, 253, 0.6)"
                    strokeWidth="2"
                    filter="url(#glow)"
                    animate={{
                      opacity: [0.7, 0.9, 0.7],
                    }}
                    transition={{
                      duration: 6,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />

                  {/* Left shoulder/arm - extended forward (working pose) */}
                  <motion.path
                    d="M 120 145 Q 90 150, 70 165 Q 55 175, 50 190"
                    fill="none"
                    stroke="url(#armGradient)"
                    strokeWidth="10"
                    strokeLinecap="round"
                    filter="url(#glow)"
                    animate={{
                      opacity: [0.6, 0.85, 0.6],
                      d: [
                        "M 120 145 Q 90 150, 70 165 Q 55 175, 50 190",
                        "M 120 145 Q 88 152, 68 167 Q 53 177, 48 192",
                        "M 120 145 Q 90 150, 70 165 Q 55 175, 50 190",
                      ],
                    }}
                    transition={{
                      duration: 5,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />

                  {/* Left forearm/hand */}
                  <motion.path
                    d="M 50 190 Q 40 210, 45 230"
                    fill="none"
                    stroke="url(#armGradient)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    filter="url(#glow)"
                    animate={{
                      opacity: [0.7, 1, 0.7],
                    }}
                    transition={{
                      duration: 5,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />

                  {/* Right shoulder/arm - extended forward (typing pose) */}
                  <motion.path
                    d="M 180 145 Q 210 150, 230 165 Q 245 175, 250 190"
                    fill="none"
                    stroke="url(#armGradient)"
                    strokeWidth="10"
                    strokeLinecap="round"
                    filter="url(#glow)"
                    animate={{
                      opacity: [0.6, 0.85, 0.6],
                      d: [
                        "M 180 145 Q 210 150, 230 165 Q 245 175, 250 190",
                        "M 180 145 Q 212 152, 232 167 Q 247 177, 252 192",
                        "M 180 145 Q 210 150, 230 165 Q 245 175, 250 190",
                      ],
                    }}
                    transition={{
                      duration: 5,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 0.3,
                    }}
                  />

                  {/* Right forearm/hand */}
                  <motion.path
                    d="M 250 190 Q 260 210, 255 230"
                    fill="none"
                    stroke="url(#armGradient)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    filter="url(#glow)"
                    animate={{
                      opacity: [0.7, 1, 0.7],
                    }}
                    transition={{
                      duration: 5,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 0.3,
                    }}
                  />

                  {/* Lower body suggestion */}
                  <motion.path
                    d="M 125 260 Q 130 300, 135 340 M 175 260 Q 170 300, 165 340"
                    fill="none"
                    stroke="rgba(147, 197, 253, 0.4)"
                    strokeWidth="12"
                    strokeLinecap="round"
                    animate={{
                      opacity: [0.4, 0.6, 0.4],
                    }}
                    transition={{
                      duration: 7,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />

                  {/* Energy points - head (thinking) */}
                  <motion.circle
                    cx="150"
                    cy="60"
                    r="3"
                    fill="rgba(96, 213, 244, 0.9)"
                    filter="url(#glow)"
                    animate={{
                      r: [3, 6, 3],
                      opacity: [0.6, 1, 0.6],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />

                  {/* Energy points - hands (creating) */}
                  <motion.circle
                    cx="45"
                    cy="230"
                    r="4"
                    fill="rgba(96, 213, 244, 0.8)"
                    filter="url(#glow)"
                    animate={{
                      r: [4, 7, 4],
                      opacity: [0.5, 1, 0.5],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 0.5,
                    }}
                  />
                  <motion.circle
                    cx="255"
                    cy="230"
                    r="4"
                    fill="rgba(96, 213, 244, 0.8)"
                    filter="url(#glow)"
                    animate={{
                      r: [4, 7, 4],
                      opacity: [0.5, 1, 0.5],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 1,
                    }}
                  />

                  {/* Heart/chest energy center */}
                  <motion.circle
                    cx="150"
                    cy="180"
                    r="5"
                    fill="rgba(167, 139, 250, 0.6)"
                    filter="url(#glow)"
                    animate={{
                      r: [5, 8, 5],
                      opacity: [0.4, 0.8, 0.4],
                    }}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 0.2,
                    }}
                  />
                </svg>

                {/* Animated light ripples emanating from head */}
                {Array.from({ length: 3 }).map((_, i) => (
                  <motion.div
                    key={`head-ripple-${i}`}
                    className="absolute top-[15%] left-1/2 -translate-x-1/2 w-20 h-20 rounded-full border border-cyan-300/30"
                    animate={{
                      scale: [1, 2.5, 2.5],
                      opacity: [0.6, 0.2, 0],
                    }}
                    transition={{
                      duration: 6,
                      repeat: Infinity,
                      ease: "easeOut",
                      delay: i * 2,
                    }}
                  />
                ))}

                {/* Animated light ripples from hands */}
                {Array.from({ length: 2 }).map((_, i) => (
                  <motion.div
                    key={`hand-ripple-left-${i}`}
                    className="absolute top-[50%] left-[8%] w-12 h-12 rounded-full border border-cyan-300/30"
                    animate={{
                      scale: [1, 2, 2],
                      opacity: [0.5, 0.1, 0],
                    }}
                    transition={{
                      duration: 5,
                      repeat: Infinity,
                      ease: "easeOut",
                      delay: i * 2.5,
                    }}
                  />
                ))}

                {Array.from({ length: 2 }).map((_, i) => (
                  <motion.div
                    key={`hand-ripple-right-${i}`}
                    className="absolute top-[50%] right-[8%] w-12 h-12 rounded-full border border-cyan-300/30"
                    animate={{
                      scale: [1, 2, 2],
                      opacity: [0.5, 0.1, 0],
                    }}
                    transition={{
                      duration: 5,
                      repeat: Infinity,
                      ease: "easeOut",
                      delay: i * 2.5 + 0.8,
                    }}
                  />
                ))}

                {/* Holographic interface elements - floating shapes */}
                {/* Data streams - left side */}
                {Array.from({ length: 3 }).map((_, i) => (
                  <motion.div
                    key={`data-stream-left-${i}`}
                    className="absolute left-[5%] w-16 h-px"
                    style={{
                      top: `${35 + i * 12}%`,
                      background: "linear-gradient(to right, transparent, rgba(147, 197, 253, 0.5), transparent)",
                    }}
                    animate={{
                      opacity: [0.3, 0.7, 0.3],
                      scaleX: [0.8, 1.2, 0.8],
                    }}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: i * 1.2,
                    }}
                  />
                ))}

                {/* Data streams - right side */}
                {Array.from({ length: 3 }).map((_, i) => (
                  <motion.div
                    key={`data-stream-right-${i}`}
                    className="absolute right-[5%] w-16 h-px"
                    style={{
                      top: `${35 + i * 12}%`,
                      background: "linear-gradient(to left, transparent, rgba(147, 197, 253, 0.5), transparent)",
                    }}
                    animate={{
                      opacity: [0.3, 0.7, 0.3],
                      scaleX: [0.8, 1.2, 0.8],
                    }}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: i * 1.2 + 0.5,
                    }}
                  />
                ))}

                {/* Floating holographic rectangles */}
                {[
                  { x: 10, y: 25, w: 12, h: 8 },
                  { x: 78, y: 30, w: 10, h: 6 },
                  { x: 8, y: 55, w: 14, h: 10 },
                  { x: 80, y: 62, w: 12, h: 8 },
                ].map((rect, i) => (
                  <motion.div
                    key={`holo-rect-${i}`}
                    className="absolute border border-cyan-400/30 rounded-sm"
                    style={{
                      left: `${rect.x}%`,
                      top: `${rect.y}%`,
                      width: `${rect.w}%`,
                      height: `${rect.h}%`,
                      background: "linear-gradient(135deg, rgba(147, 197, 253, 0.05), rgba(96, 165, 250, 0.1))",
                      backdropFilter: "blur(2px)",
                    }}
                    animate={{
                      opacity: [0.2, 0.5, 0.2],
                      y: [0, -5, 0],
                      rotateY: [0, 5, 0],
                    }}
                    transition={{
                      duration: 6,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: i * 1.5,
                    }}
                  />
                ))}

                {/* Ambient glow breathing with silhouette */}
                <motion.div
                  className="absolute inset-0"
                  style={{
                    background: `radial-gradient(ellipse at center, 
                      rgba(147, 197, 253, 0.08) 0%, 
                      rgba(196, 181, 253, 0.05) 40%, 
                      transparent 70%)`,
                    filter: "blur(30px)",
                  }}
                  animate={{
                    scale: [1, 1.12, 1],
                    opacity: [0.3, 0.6, 0.3],
                  }}
                  transition={{
                    duration: 6,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              </div>
            </motion.div>

          </div>
        </div>
      </motion.section>

      {/* SECTION 2: Light Lavender/Baby Blue Section */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.8 }}
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
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.8 }}
        className="relative min-h-screen flex flex-col items-center justify-center px-6 py-32 overflow-hidden"
        style={{
          background: "linear-gradient(to bottom, rgb(237, 233, 254), rgb(219, 234, 254), rgb(226, 232, 240))",
        }}
      >
        {/* Subtle animated gradient overlay for visual interest */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at 50% 20%, rgba(139, 92, 246, 0.08) 0%, transparent 60%)",
          }}
          animate={{
            opacity: [0.4, 0.6, 0.4],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        <div className="max-w-4xl mx-auto space-y-8 relative z-10">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 1 }}
            className="text-4xl md:text-6xl font-light tracking-tight text-center text-slate-800"
          >
            Meet Your Superhuman
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
            className="space-y-8 text-lg md:text-xl font-light leading-relaxed text-slate-600 max-w-3xl mx-auto text-center"
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
        className="relative min-h-screen flex flex-col items-center justify-center px-6 py-32 overflow-hidden"
        style={{
          background: "linear-gradient(to bottom, rgb(248, 250, 252), rgb(241, 245, 249), rgb(255, 255, 255))",
        }}
      >
        {/* Subtle radial lighting overlay - ties to previous section */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 70% 60% at 50% 40%, rgba(147, 197, 253, 0.12) 0%, transparent 70%)",
          }}
          animate={{
            opacity: [0.4, 0.7, 0.4],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Additional luminous accent */}
        <motion.div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(96, 165, 250, 0.06) 0%, transparent 60%)",
            filter: "blur(60px)",
          }}
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        <div className="max-w-5xl mx-auto space-y-16 text-center relative z-10">
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
