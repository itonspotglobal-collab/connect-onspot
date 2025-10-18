/**
 * ComingSoonParent.js
 * Master design file for all Coming Soon pages
 * Uses Shadow DOM for style isolation and ES Modules for modularity
 */

export function renderComingSoon(content) {
  const container = document.getElementById('coming-soon-root');
  if (!container) {
    console.error('Container #coming-soon-root not found');
    return;
  }

  // Create Shadow DOM for style isolation
  const shadow = container.attachShadow({ mode: 'open' });

  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Create the main structure
  const wrapper = document.createElement('div');
  wrapper.className = 'coming-soon-wrapper';

  // Inject styles (isolated within Shadow DOM)
  const style = document.createElement('style');
  style.textContent = `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    .coming-soon-wrapper {
      width: 100%;
      min-height: 100svh;
      position: relative;
      overflow: hidden;
      background: linear-gradient(to bottom, #ffffff 0%, #f8f7ff 50%, #ffffff 100%);
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }

    .dark-mode .coming-soon-wrapper {
      background: linear-gradient(to bottom, #0a0a0a 0%, #1a1425 50%, #0a0a0a 100%);
    }

    .content-section {
      position: relative;
      min-height: 100svh;
      padding: clamp(6rem, 10vh, 10rem) 0;
      display: flex;
      align-items: center;
      overflow: visible;
    }

    .gradient-bg {
      position: absolute;
      inset: 0;
      background: linear-gradient(to bottom, transparent, rgba(139, 92, 246, 0.05), transparent);
      pointer-events: none;
    }

    .radial-glow {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 800px;
      height: 800px;
      background: radial-gradient(circle, rgba(139, 92, 246, 0.2), rgba(59, 130, 246, 0.1), transparent);
      border-radius: 50%;
      filter: blur(80px);
      opacity: 0.6;
      pointer-events: none;
    }

    .container {
      position: relative;
      z-index: 10;
      width: 100%;
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 clamp(1.5rem, 4vw, 3rem);
      overflow: visible;
    }

    .grid-layout {
      display: grid;
      gap: clamp(3rem, 5vw, 4rem);
      align-items: center;
      overflow: visible;
    }

    @media (min-width: 1024px) {
      .grid-layout {
        grid-template-columns: 1fr 1fr;
        gap: 4rem;
      }
    }

    .content-column {
      position: relative;
      z-index: 10;
      overflow: visible;
      width: 100%;
    }

    .content-inner {
      display: flex;
      flex-direction: column;
      gap: clamp(1.5rem, 3vw, 2rem);
    }

    .coming-soon-label {
      font-size: clamp(0.75rem, 1vw, 0.875rem);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #64748b;
      text-align: center;
      transition: all 1s ease-out;
      opacity: 0;
      transform: translateY(1rem);
    }

    .coming-soon-label.visible {
      opacity: 1;
      transform: translateY(0);
    }

    @media (min-width: 1024px) {
      .coming-soon-label {
        text-align: left;
      }
    }

    .logo-wrapper {
      display: flex;
      justify-content: center;
      transition: all 1s ease-out 0.1s;
      opacity: 0;
      transform: translateY(1rem);
    }

    .logo-wrapper.visible {
      opacity: 1;
      transform: translateY(0);
    }

    @media (min-width: 1024px) {
      .logo-wrapper {
        justify-content: flex-start;
      }
    }

    .logo {
      width: clamp(120px, 12vw, 200px);
      height: auto;
      opacity: 0.85;
      filter: drop-shadow(0 0 8px rgba(139, 92, 246, 0.12));
      transition: opacity 0.3s;
      cursor: pointer;
    }

    .logo:hover {
      opacity: 1;
    }

    .headline-wrapper {
      transition: all 1s ease-out 0.2s;
      opacity: 0;
      transform: translateY(1rem);
      overflow: visible;
    }

    .headline-wrapper.visible {
      opacity: 1;
      transform: translateY(0);
    }

    .headline {
      font-size: clamp(2.25rem, 6vw, 3.75rem);
      font-weight: 700;
      line-height: 1.08;
      padding-bottom: 0.08em;
      text-align: center;
      overflow: visible;
    }

    @media (min-width: 1024px) {
      .headline {
        text-align: left;
      }
    }

    .headline-line {
      display: block;
    }

    .gradient-text {
      background: linear-gradient(to right, #0a0a0a, #0a0a0a, rgba(10, 10, 10, 0.7));
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .gradient-highlight {
      background: linear-gradient(to right, #7c3aed, #2563eb);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .subtitle-wrapper {
      transition: all 1s ease-out 0.3s;
      opacity: 0;
      transform: translateY(1rem);
    }

    .subtitle-wrapper.visible {
      opacity: 1;
      transform: translateY(0);
    }

    .subtitle {
      font-size: clamp(1.125rem, 2.5vw, 1.5rem);
      font-weight: 300;
      line-height: 1.6;
      color: rgba(10, 10, 10, 0.9);
      text-align: center;
    }

    @media (min-width: 1024px) {
      .subtitle {
        text-align: left;
      }
    }

    .cta-wrapper {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: clamp(12px, 1.5vw, 16px);
      padding-bottom: max(16px, env(safe-area-inset-bottom));
      transition: all 1s ease-out 0.4s;
      opacity: 0;
      transform: translateY(1rem);
    }

    .cta-wrapper.visible {
      opacity: 1;
      transform: translateY(0);
    }

    @media (min-width: 768px) {
      .cta-wrapper {
        flex-direction: row;
      }
    }

    @media (min-width: 1024px) {
      .cta-wrapper {
        justify-content: flex-start;
      }
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: clamp(52px, 5.5vw, 56px);
      padding: 0 clamp(1.5rem, 3vw, 2rem);
      border-radius: 14px;
      font-size: 1rem;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.3s;
      width: 100%;
      max-width: 280px;
      position: relative;
      overflow: hidden;
      cursor: pointer;
      border: none;
    }

    .btn-primary {
      background: linear-gradient(to right, #7c3aed, #2563eb);
      color: white;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    }

    .btn-primary:hover {
      background: linear-gradient(to right, #6d28d9, #1d4ed8);
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 0 30px rgba(139, 92, 246, 0.4);
    }

    .btn-primary .shimmer {
      position: absolute;
      inset: 0;
      background: linear-gradient(to right, transparent, rgba(255, 255, 255, 0.2), transparent);
      transform: translateX(-100%);
      transition: transform 1s;
    }

    .btn-primary:hover .shimmer {
      transform: translateX(100%);
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.6);
      backdrop-filter: blur(8px);
      color: #334155;
      border: 2px solid #cbd5e1;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    .btn-secondary:hover {
      background: #f8fafc;
      border-color: #94a3b8;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }

    .btn-icon {
      width: 1.25rem;
      height: 1.25rem;
      flex-shrink: 0;
    }

    .btn-icon-left {
      margin-right: 0.5rem;
    }

    .btn-icon-right {
      margin-left: 0.5rem;
      transition: transform 0.3s;
    }

    .btn-secondary:hover .btn-icon-right {
      transform: translateX(0.25rem);
    }

    .orb-column {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      z-index: -10;
    }

    @media (min-width: 1024px) {
      .orb-column {
        position: relative;
        z-index: auto;
      }
    }

    .orb-container {
      position: relative;
      width: clamp(min(680px, 120vw), 60vw, 820px);
      aspect-ratio: 1/1;
      overflow: visible;
    }

    .orb-inner {
      position: absolute;
      inset: 0;
      overflow: visible;
    }

    .orb-layer {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      background-position: center;
      transform-origin: 50% 50%;
    }

    .orb-layer-1 {
      background: linear-gradient(135deg, rgba(124, 58, 237, 0.3), rgba(59, 130, 246, 0.3), rgba(6, 182, 212, 0.3));
      animation: ${prefersReducedMotion ? 'none' : 'organicFloat 7s ease-in-out infinite, flowingGradient1 7s ease-in-out infinite'};
    }

    .orb-layer-2 {
      background: linear-gradient(225deg, rgba(59, 130, 246, 0.4), rgba(124, 58, 237, 0.4), rgba(168, 85, 247, 0.4));
      animation: ${prefersReducedMotion ? 'none' : 'organicSpin 20s linear infinite, flowingGradient2 7s ease-in-out infinite'};
    }

    @keyframes flowingGradient1 {
      0%, 100% {
        opacity: 0.82;
        filter: blur(95px) brightness(1) saturate(1.25);
        background-size: 110%;
      }
      50% {
        opacity: 0.45;
        filter: blur(135px) brightness(1.18) saturate(0.85);
        background-size: 138%;
      }
    }

    @keyframes flowingGradient2 {
      0%, 100% {
        opacity: 0.82;
        filter: blur(95px) brightness(1) saturate(1.2);
        background-size: 110%;
      }
      50% {
        opacity: 0.45;
        filter: blur(135px) brightness(1.18) saturate(0.9);
        background-size: 138%;
      }
    }

    @keyframes organicFloat {
      0%, 100% {
        transform: translateY(0px) scale(1);
      }
      50% {
        transform: translateY(-15px) scale(1.02);
      }
    }

    @keyframes organicSpin {
      0% {
        transform: rotate(0deg) scale(1);
      }
      50% {
        transform: rotate(180deg) scale(1.03);
      }
      100% {
        transform: rotate(360deg) scale(1);
      }
    }

    @media (prefers-color-scheme: dark) {
      .coming-soon-label {
        color: #94a3b8;
      }

      .gradient-text {
        background: linear-gradient(to right, #ffffff, #ffffff, rgba(255, 255, 255, 0.7));
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
      }

      .subtitle {
        color: rgba(255, 255, 255, 0.9);
      }

      .btn-secondary {
        background: rgba(30, 30, 30, 0.6);
        color: #e2e8f0;
        border-color: #475569;
      }

      .btn-secondary:hover {
        background: #1e293b;
        border-color: #64748b;
      }
    }
  `;

  // Build HTML structure
  wrapper.innerHTML = `
    <div class="content-section">
      <div class="gradient-bg"></div>
      <div class="radial-glow"></div>
      
      <div class="container">
        <div class="grid-layout">
          
          <div class="content-column">
            <div class="content-inner">
              
              <div class="coming-soon-label">
                <span id="typed-text">COMING SOON</span><span id="dots"></span>
              </div>

              <div class="logo-wrapper">
                <a href="${content.logoLink || '/'}">
                  <img 
                    src="${content.logo || '/OnSpot Log Full Purple Blue_1757942805752.png'}" 
                    alt="${content.logoAlt || 'OnSpot'}" 
                    class="logo"
                  />
                </a>
              </div>

              <div class="headline-wrapper">
                <h1 class="headline">
                  <span class="headline-line gradient-text">${content.titleLine1 || 'The next evolution of'}</span>
                  <span class="headline-line gradient-highlight">${content.titleLine2 || 'outsourcing.'}</span>
                </h1>
              </div>

              <div class="subtitle-wrapper">
                <p class="subtitle">${content.subtitle || 'Powered by intelligence and human brilliance.'}</p>
              </div>

              <div class="cta-wrapper">
                ${content.primaryCTA ? `
                  <button class="btn btn-primary" id="primary-cta">
                    <div class="shimmer"></div>
                    <svg class="btn-icon btn-icon-left" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                    </svg>
                    <span>${content.primaryCTA}</span>
                  </button>
                ` : ''}
                ${content.secondaryCTA ? `
                  <a href="${content.secondaryLink || '/'}" class="btn btn-secondary">
                    <span>${content.secondaryCTA}</span>
                    <svg class="btn-icon btn-icon-right" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                    </svg>
                  </a>
                ` : ''}
              </div>

            </div>
          </div>

          <div class="orb-column">
            <div class="orb-container">
              <div class="orb-inner">
                <div class="orb-layer orb-layer-1"></div>
                <div class="orb-layer orb-layer-2"></div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  `;

  // Append to Shadow DOM
  shadow.appendChild(style);
  shadow.appendChild(wrapper);

  // Initialize typing animation
  if (!prefersReducedMotion) {
    const typedTextElement = shadow.getElementById('typed-text');
    const dotsElement = shadow.getElementById('dots');
    const text = 'COMING SOON';
    let charIndex = 0;
    let dotCount = 0;

    const typeInterval = setInterval(() => {
      if (charIndex < text.length) {
        typedTextElement.textContent = text.substring(0, charIndex + 1);
        charIndex++;
      } else {
        clearInterval(typeInterval);
      }
    }, 120);

    const dotsInterval = setInterval(() => {
      dotCount = (dotCount + 1) % 4;
      dotsElement.textContent = '.'.repeat(dotCount);
    }, 500);
  }

  // Trigger fade-in animations
  setTimeout(() => {
    shadow.querySelector('.coming-soon-label')?.classList.add('visible');
    shadow.querySelector('.logo-wrapper')?.classList.add('visible');
    shadow.querySelector('.headline-wrapper')?.classList.add('visible');
    shadow.querySelector('.subtitle-wrapper')?.classList.add('visible');
    shadow.querySelector('.cta-wrapper')?.classList.add('visible');
  }, 800);

  // Handle primary CTA click (if provided)
  if (content.primaryCTA && content.primaryAction) {
    shadow.getElementById('primary-cta')?.addEventListener('click', content.primaryAction);
  }
}
