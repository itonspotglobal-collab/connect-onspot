/**
 * Animated Favicon with Pulsing Bluish-Purple Halo
 * 
 * Renders a white target mark with a pulsing bluish-purple halo behind it:
 * - Draws crisp vector graphics on canvas at all sizes
 * - Respects prefers-reduced-motion
 * - Pauses when tab is hidden
 * - Falls back to static icon if canvas isn't supported
 */

interface FaviconConfig {
  faviconPath?: string; // Optional fallback for static favicon
  glowColor?: string; // Halo color (default: bluish-purple)
  pulseSpeed?: number; // Duration in ms (default: 2000)
  size?: number; // Canvas size (default: 64)
}

class AnimatedFavicon {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animationFrameId: number | null = null;
  private startTime: number = 0;
  private config: Required<Omit<FaviconConfig, 'faviconPath'>> & { faviconPath?: string };
  private link: HTMLLinkElement | null = null;
  private prefersReducedMotion: boolean = false;
  private isTabVisible: boolean = true;
  private staticFaviconUrl: string = '';

  constructor(config: FaviconConfig) {
    this.config = {
      faviconPath: config.faviconPath,
      glowColor: config.glowColor || '#6366f1', // Bluish-purple
      pulseSpeed: config.pulseSpeed || 2000,
      size: config.size || 64,
    };

    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.staticFaviconUrl = this.config.faviconPath || '/favicon.png';

    // Listen for changes to prefers-reduced-motion
    const motionMediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    motionMediaQuery.addEventListener('change', (e) => {
      this.prefersReducedMotion = e.matches;
      if (e.matches) {
        this.stop();
        this.setStaticFavicon();
      } else {
        this.init();
      }
    });

    // Listen for tab visibility changes
    document.addEventListener('visibilitychange', () => {
      this.isTabVisible = !document.hidden;
      if (document.hidden) {
        this.pause();
      } else {
        this.resume();
      }
    });
  }

  async init(): Promise<void> {
    // If user prefers reduced motion, draw one static frame
    if (this.prefersReducedMotion) {
      this.drawStaticFrame();
      return;
    }

    // Check if canvas is supported
    if (!this.isCanvasSupported()) {
      this.setStaticFavicon();
      return;
    }

    try {
      // Create canvas with high-DPI scaling
      const dpr = window.devicePixelRatio || 1;
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.config.size * dpr;
      this.canvas.height = this.config.size * dpr;
      this.canvas.style.width = `${this.config.size}px`;
      this.canvas.style.height = `${this.config.size}px`;
      
      this.ctx = this.canvas.getContext('2d');

      if (!this.ctx) {
        this.setStaticFavicon();
        return;
      }

      // Scale context for high-DPI rendering
      this.ctx.scale(dpr, dpr);

      // Find or create favicon link element
      this.link = document.querySelector('link[rel="icon"]') || this.createFaviconLink();

      // Start animation
      this.startTime = Date.now();
      this.animate();
    } catch (error) {
      console.warn('Failed to initialize animated favicon, falling back to static:', error);
      this.setStaticFavicon();
    }
  }

  private isCanvasSupported(): boolean {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext && canvas.getContext('2d'));
    } catch {
      return false;
    }
  }

  private createFaviconLink(): HTMLLinkElement {
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/png';
    document.head.appendChild(link);
    return link;
  }

  private setStaticFavicon(): void {
    const link = document.querySelector('link[rel="icon"]') || this.createFaviconLink();
    link.setAttribute('href', this.staticFaviconUrl);
  }

  /**
   * Draw the target icon with bullseye and arrow on pulsing background
   */
  private drawTargetIcon(opacity: number = 0.6): void {
    if (!this.ctx) return;

    const size = this.config.size;
    const center = size / 2;

    // Fill entire square with pulsing bluish-purple background
    const opacityHex = Math.round(opacity * 255).toString(16).padStart(2, '0');
    this.ctx.fillStyle = `${this.config.glowColor}${opacityHex}`;
    this.ctx.fillRect(0, 0, size, size);

    // Draw target bullseye circles in white
    const circleRadii = [center * 0.85, center * 0.65, center * 0.45, center * 0.25];
    
    circleRadii.forEach((radius, index) => {
      this.ctx!.beginPath();
      this.ctx!.arc(center, center, radius, 0, Math.PI * 2);
      if (index % 2 === 0) {
        // White fill for even indices (outer and inner rings)
        this.ctx!.fillStyle = '#FFFFFF';
        this.ctx!.fill();
      } else {
        // Transparent (shows background) for odd indices
        this.ctx!.globalCompositeOperation = 'destination-out';
        this.ctx!.fill();
        this.ctx!.globalCompositeOperation = 'source-over';
      }
    });

    // Draw center dot in white
    this.ctx.beginPath();
    this.ctx.arc(center, center, center * 0.12, 0, Math.PI * 2);
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fill();

    // Draw arrow in white
    const arrowStartX = center - size * 0.32;
    const arrowStartY = center + size * 0.32;
    const arrowEndX = center + size * 0.32;
    const arrowEndY = center - size * 0.32;
    
    // Arrow shaft
    this.ctx.beginPath();
    this.ctx.moveTo(arrowStartX, arrowStartY);
    this.ctx.lineTo(arrowEndX, arrowEndY);
    this.ctx.lineWidth = 3.5;
    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.stroke();

    // Arrow head
    const headLength = size * 0.18;
    const headAngle = Math.PI / 6;
    const angle = Math.atan2(arrowEndY - arrowStartY, arrowEndX - arrowStartX);
    
    this.ctx.beginPath();
    this.ctx.moveTo(arrowEndX, arrowEndY);
    this.ctx.lineTo(
      arrowEndX - headLength * Math.cos(angle - headAngle),
      arrowEndY - headLength * Math.sin(angle - headAngle)
    );
    this.ctx.lineTo(
      arrowEndX - headLength * Math.cos(angle + headAngle),
      arrowEndY - headLength * Math.sin(angle + headAngle)
    );
    this.ctx.closePath();
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fill();
  }

  /**
   * Draw a static frame for reduced motion preference
   */
  private drawStaticFrame(): void {
    if (!this.isCanvasSupported()) {
      this.setStaticFavicon();
      return;
    }

    // Create canvas with high-DPI scaling
    const dpr = window.devicePixelRatio || 1;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.config.size * dpr;
    this.canvas.height = this.config.size * dpr;
    this.canvas.style.width = `${this.config.size}px`;
    this.canvas.style.height = `${this.config.size}px`;
    
    this.ctx = this.canvas.getContext('2d');

    if (!this.ctx) {
      this.setStaticFavicon();
      return;
    }

    // Scale context for high-DPI rendering
    this.ctx.scale(dpr, dpr);

    this.link = document.querySelector('link[rel="icon"]') || this.createFaviconLink();
    
    // Clear and draw static frame
    this.ctx.clearRect(0, 0, this.config.size, this.config.size);
    this.drawTargetIcon(0.85); // Mid-range opacity for static version
    
    // Update favicon
    if (this.link) {
      this.link.setAttribute('href', this.canvas.toDataURL('image/png'));
    }
  }

  private animate = (): void => {
    if (!this.ctx || !this.canvas || !this.link) return;
    if (!this.isTabVisible) return;

    // Calculate pulse phase (0 to 1)
    const elapsed = Date.now() - this.startTime;
    const phase = (elapsed % this.config.pulseSpeed) / this.config.pulseSpeed;
    
    // Ease in-out sine for smooth pulsing (min: 0.7, max: 1.0 for more visible pulsing)
    const pulseIntensity = (Math.sin(phase * Math.PI * 2 - Math.PI / 2) + 1) / 2;
    const opacity = 0.7 + (pulseIntensity * 0.3);
    
    // Clear canvas
    this.ctx.clearRect(0, 0, this.config.size, this.config.size);

    // Draw target icon with current pulse opacity
    this.drawTargetIcon(opacity);

    // Update favicon
    this.link.setAttribute('href', this.canvas.toDataURL('image/png'));

    // Continue animation
    this.animationFrameId = requestAnimationFrame(this.animate);
  };

  private pause(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private resume(): void {
    if (!this.prefersReducedMotion && this.canvas && this.ctx && this.link) {
      this.startTime = Date.now();
      this.animate();
    }
  }

  stop(): void {
    this.pause();
    this.setStaticFavicon();
  }
}

// Initialize animated favicon
let faviconInstance: AnimatedFavicon | null = null;

export function initAnimatedFavicon(config: FaviconConfig): void {
  if (faviconInstance) {
    faviconInstance.stop();
  }
  
  faviconInstance = new AnimatedFavicon(config);
  faviconInstance.init();
}

export function stopAnimatedFavicon(): void {
  if (faviconInstance) {
    faviconInstance.stop();
    faviconInstance = null;
  }
}
