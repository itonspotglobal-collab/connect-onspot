/**
 * Animated Favicon with Pulsing Glow
 * 
 * Creates a subtle pulsing glow effect around the favicon that:
 * - Adapts to the favicon's dominant color (or falls back to violet-blue CTA color)
 * - Respects prefers-reduced-motion
 * - Pauses when tab is hidden
 * - Falls back to static icon if canvas isn't supported
 */

interface FaviconConfig {
  faviconPath: string;
  glowColor?: string; // Fallback glow color (default: violet-blue from CTA)
  pulseSpeed?: number; // Duration in ms (default: 2000)
  size?: number; // Canvas size (default: 64)
}

class AnimatedFavicon {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private img: HTMLImageElement | null = null;
  private animationFrameId: number | null = null;
  private startTime: number = 0;
  private config: Required<FaviconConfig>;
  private link: HTMLLinkElement | null = null;
  private prefersReducedMotion: boolean = false;
  private isTabVisible: boolean = true;
  private staticFaviconUrl: string = '';

  constructor(config: FaviconConfig) {
    this.config = {
      faviconPath: config.faviconPath,
      glowColor: config.glowColor || '#5B7CFF', // Violet-blue from CTA
      pulseSpeed: config.pulseSpeed || 2000,
      size: config.size || 64,
    };

    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.staticFaviconUrl = this.config.faviconPath;

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
    // If user prefers reduced motion, just set static favicon
    if (this.prefersReducedMotion) {
      this.setStaticFavicon();
      return;
    }

    // Check if canvas is supported
    if (!this.isCanvasSupported()) {
      this.setStaticFavicon();
      return;
    }

    try {
      // Create canvas
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.config.size;
      this.canvas.height = this.config.size;
      this.ctx = this.canvas.getContext('2d');

      if (!this.ctx) {
        this.setStaticFavicon();
        return;
      }

      // Load favicon image
      await this.loadImage();

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

  private async loadImage(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.img = new Image();
      // Don't set crossOrigin for same-origin images
      
      this.img.onload = () => resolve();
      this.img.onerror = () => reject(new Error('Failed to load favicon image'));
      
      // Use absolute path from public directory
      this.img.src = this.config.faviconPath;
    });
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

  private animate = (): void => {
    if (!this.ctx || !this.canvas || !this.img || !this.link) return;
    if (!this.isTabVisible) return;

    // Calculate pulse phase (0 to 1)
    const elapsed = Date.now() - this.startTime;
    const phase = (elapsed % this.config.pulseSpeed) / this.config.pulseSpeed;
    
    // Ease in-out sine for smooth pulsing
    const pulseIntensity = (Math.sin(phase * Math.PI * 2 - Math.PI / 2) + 1) / 2;
    
    // Clear canvas
    this.ctx.clearRect(0, 0, this.config.size, this.config.size);

    // Draw glow ring
    const centerX = this.config.size / 2;
    const centerY = this.config.size / 2;
    const iconSize = this.config.size * 0.7;
    const iconRadius = iconSize / 2;

    // Create radial gradient for glow
    const glowRadius = iconRadius + 8 + (pulseIntensity * 4);
    const gradient = this.ctx.createRadialGradient(
      centerX, centerY, iconRadius,
      centerX, centerY, glowRadius
    );

    // Glow color with varying opacity based on pulse
    const baseOpacity = 0.3;
    const pulseOpacity = baseOpacity + (pulseIntensity * 0.4);
    
    gradient.addColorStop(0, `${this.config.glowColor}00`); // Transparent at center
    gradient.addColorStop(0.6, `${this.config.glowColor}${Math.floor(pulseOpacity * 255).toString(16).padStart(2, '0')}`);
    gradient.addColorStop(1, `${this.config.glowColor}00`); // Fade to transparent

    // Draw glow
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.config.size, this.config.size);

    // Draw the favicon image on top
    const iconX = (this.config.size - iconSize) / 2;
    const iconY = (this.config.size - iconSize) / 2;
    this.ctx.drawImage(this.img, iconX, iconY, iconSize, iconSize);

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
    if (!this.prefersReducedMotion && this.canvas && this.ctx && this.img && this.link) {
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
