import { useEffect, useRef } from 'react';

interface Node {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  connections: number[];
}

interface NeuralBrainProps {
  className?: string;
  nodeCount?: number;
  opacity?: number;
}

export function NeuralBrain({ className = '', nodeCount = 180, opacity = 0.85 }: NeuralBrainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const nodesRef = useRef<Node[]>([]);
  const scaleRef = useRef(1);
  const brightnessRef = useRef(1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const updateSize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    updateSize();

    // Initialize nodes in two-lobe brain structure
    const initNodes = () => {
      const nodes: Node[] = [];
      const centerX = canvas.getBoundingClientRect().width / 2;
      const centerY = canvas.getBoundingClientRect().height / 2;
      
      for (let i = 0; i < nodeCount; i++) {
        const angle = (i / nodeCount) * Math.PI * 2;
        const lobe = i < nodeCount / 2 ? -1 : 1;
        const lobeOffset = lobe * 60;
        const radius = 100 + Math.random() * 120;
        const wobble = Math.random() * 40;
        
        const x = centerX + lobeOffset + Math.cos(angle) * (radius + wobble);
        const y = centerY + Math.sin(angle) * (radius + wobble * 0.7);

        nodes.push({
          x: centerX,
          y: centerY,
          targetX: x,
          targetY: y,
          connections: []
        });
      }

      // Create connections (2-3 connections per node)
      nodes.forEach((node, i) => {
        const connectionCount = 2 + Math.floor(Math.random() * 2);
        for (let j = 0; j < connectionCount; j++) {
          const targetIndex = Math.floor(Math.random() * nodes.length);
          if (targetIndex !== i && !node.connections.includes(targetIndex)) {
            node.connections.push(targetIndex);
          }
        }
      });

      return nodes;
    };

    nodesRef.current = initNodes();
    
    // Animation states
    const startTime = Date.now();
    const growDuration = 1600;
    const breathCycle = 6000;
    const bloomDuration = 300;
    const dissolveDuration = 900;
    
    let lastPulseTime = 0;
    const pulseInterval = 1800 + Math.random() * 600;

    // Animate
    const animate = () => {
      const rect = canvas.getBoundingClientRect();
      const elapsed = Date.now() - startTime;
      
      ctx.clearRect(0, 0, rect.width, rect.height);

      // Calculate animation progress
      const growProgress = Math.min(elapsed / growDuration, 1);
      const easeProgress = growProgress < 0.5 
        ? 2 * growProgress * growProgress 
        : 1 - Math.pow(-2 * growProgress + 2, 2) / 2; // Ease in-out

      // Breathing scale animation
      const breathProgress = (elapsed % breathCycle) / breathCycle;
      const breathScale = 0.985 + Math.sin(breathProgress * Math.PI * 2) * 0.015;
      scaleRef.current = breathScale;

      // Bloom effect
      const cyclePosition = elapsed % (growDuration + 2500 + bloomDuration + dissolveDuration);
      if (cyclePosition > growDuration + 2500 && cyclePosition < growDuration + 2500 + bloomDuration) {
        const bloomProgress = (cyclePosition - growDuration - 2500) / bloomDuration;
        brightnessRef.current = 1 + bloomProgress * 0.08;
      } else {
        brightnessRef.current = 1;
      }

      // Draw connections
      ctx.strokeStyle = `rgba(91, 124, 255, ${0.15 * brightnessRef.current})`;
      ctx.lineWidth = 0.8;

      nodesRef.current.forEach((node, i) => {
        const currentX = node.x + (node.targetX - node.x) * easeProgress;
        const currentY = node.y + (node.targetY - node.y) * easeProgress;

        node.connections.forEach(targetIndex => {
          const target = nodesRef.current[targetIndex];
          const targetCurrentX = target.x + (target.targetX - target.x) * easeProgress;
          const targetCurrentY = target.y + (target.targetY - target.y) * easeProgress;

          ctx.beginPath();
          ctx.moveTo(currentX, currentY);
          ctx.lineTo(targetCurrentX, targetCurrentY);
          
          // Create gradient stroke
          const gradient = ctx.createLinearGradient(currentX, currentY, targetCurrentX, targetCurrentY);
          gradient.addColorStop(0, `rgba(91, 124, 255, ${0.2 * brightnessRef.current})`);
          gradient.addColorStop(0.5, `rgba(155, 92, 255, ${0.25 * brightnessRef.current})`);
          gradient.addColorStop(1, `rgba(91, 124, 255, ${0.2 * brightnessRef.current})`);
          ctx.strokeStyle = gradient;
          ctx.stroke();

          // Outer glow
          ctx.shadowBlur = 3;
          ctx.shadowColor = `rgba(91, 124, 255, ${0.3 * brightnessRef.current})`;
          ctx.stroke();
          ctx.shadowBlur = 0;
        });
      });

      // Draw nodes
      nodesRef.current.forEach((node, i) => {
        const currentX = node.x + (node.targetX - node.x) * easeProgress;
        const currentY = node.y + (node.targetY - node.y) * easeProgress;

        // Node with glow
        ctx.fillStyle = `rgba(139, 152, 255, ${0.4 * brightnessRef.current})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = `rgba(91, 124, 255, ${0.6 * brightnessRef.current})`;
        
        ctx.beginPath();
        ctx.arc(currentX, currentY, 2.5 * scaleRef.current, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Occasional twinkle
        if (Math.random() > 0.997) {
          ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * brightnessRef.current})`;
          ctx.beginPath();
          ctx.arc(currentX, currentY, 3.5 * scaleRef.current, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Signal pulses along connections
      if (elapsed - lastPulseTime > pulseInterval) {
        lastPulseTime = elapsed;
        // Trigger pulse animation on random connection
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    // Cleanup
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [nodeCount, opacity]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        opacity: opacity,
      }}
    />
  );
}
