import { Request, Response, NextFunction } from 'express';
import { isbot } from 'isbot';

// List of public routes that should be crawlable
const PUBLIC_ROUTES = [
  '/',
  '/talent-portal',
  '/why-onspot',
  '/why-onspot/value-calculator',
  '/why-onspot/about',
  '/why-onspot/case-studies',
  '/why-onspot/reviews',
  '/why-onspot/experience',
  '/why-onspot/integrator-system',
  '/get-hired',
  '/find-work',
  '/insights',
  '/hire-talent',
  '/amazing',
  '/pricing',
  '/enterprise',
  '/affiliate-marketing',
  '/bpo-partner',
  '/payment-protection',
  '/client-verification',
  '/trust-safety',
  '/lead-intake',
  '/investors'
];

// Protected routes that should NOT be crawled
const PROTECTED_ROUTES = [
  '/dashboard',
  '/settings',
  '/profile-settings',
  '/projects',
  '/performance',
  '/clients',
  '/contracts',
  '/payments',
  '/roi',
  '/admin'
];

/**
 * Middleware to detect bots and serve SEO-friendly HTML
 * This enhances the base HTML with meta tags and content hints for crawlers
 */
export function botDetectionMiddleware(req: Request, res: Response, next: NextFunction) {
  const userAgent = req.headers['user-agent'] || '';
  const path = req.path;

  // Check if this is a bot
  const isBotRequest = isbot(userAgent);

  // Check if the path is protected
  const isProtectedPath = PROTECTED_ROUTES.some(route => path.startsWith(route));

  // If it's a bot trying to access protected content, block it
  if (isBotRequest && isProtectedPath) {
    return res.status(403).send('Forbidden: This content is not available to crawlers');
  }

  // Check if the path is a public route that should be crawlable
  const isPublicPath = PUBLIC_ROUTES.some(route => 
    path === route || path.startsWith(route + '/')
  );

  // If it's a bot accessing public content, serve enhanced HTML
  if (isBotRequest && isPublicPath) {
    // Set response header to indicate this is for a bot
    res.setHeader('X-Served-To', 'Bot');

    // Generate enhanced HTML based on the route
    const enhancedHTML = generateEnhancedHTML(path);
    return res.send(enhancedHTML);
  }

  // For non-bot requests or non-crawlable paths, continue normally
  next();
}

/**
 * Generate enhanced HTML with meta tags and content for specific routes
 */
function generateEnhancedHTML(path: string): string {
  const metaData = getRouteMetadata(path);

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />
    <title>${metaData.title}</title>
    <meta name="description" content="${metaData.description}" />
    <meta property="og:title" content="${metaData.title}" />
    <meta property="og:description" content="${metaData.description}" />
    <meta property="og:type" content="website" />
    <meta name="robots" content="index, follow" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  </head>
  <body>
    <div id="root">
      ${metaData.content}
    </div>
    <noscript>
      <p>This application requires JavaScript to function properly. Please enable JavaScript in your browser.</p>
    </noscript>
  </body>
</html>`;
}

/**
 * Get metadata and content for different routes
 */
function getRouteMetadata(path: string): { title: string; description: string; content: string } {
  const metadata: Record<string, { title: string; description: string; content: string }> = {
    '/': {
      title: 'OnSpot - Making Outsourcing Easy',
      description: 'OnSpot bridges BPO and freelancing with AI-powered talent matching, performance management, and seamless outsourcing integration for B2B and B2C clients.',
      content: `
        <header>
          <h1>OnSpot - Making Outsourcing Easy</h1>
          <nav>
            <a href="/talent-portal">Talent Portal</a>
            <a href="/why-onspot">Why OnSpot</a>
            <a href="/get-hired">Get Hired</a>
            <a href="/find-work">Find Work</a>
          </nav>
        </header>
        <main>
          <section>
            <h2>The First Integrator System for Outsourcing</h2>
            <p>OnSpot bridges BPO services and freelancing with Apple-inspired design principles, offering AI-powered talent matching and performance management.</p>
          </section>
        </main>
      `
    },
    '/talent-portal': {
      title: 'Talent Portal - OnSpot',
      description: 'Join OnSpot\'s talent network. Showcase your skills, get matched with clients, and earn competitive rates with our AI-powered platform.',
      content: `
        <header>
          <h1>OnSpot Talent Portal</h1>
        </header>
        <main>
          <section>
            <h2>Start Earning in 3 Simple Steps</h2>
            <ol>
              <li>Create Your Profile - Showcase your expertise and experience</li>
              <li>Get Matched - Our AI matches you with relevant opportunities</li>
              <li>Start Earning - Work on projects and get paid securely</li>
            </ol>
          </section>
          <section>
            <h2>Why Join OnSpot?</h2>
            <ul>
              <li>Competitive Rates - Earn what you deserve</li>
              <li>Flexible Work - Choose when and where you work</li>
              <li>Performance Tracking - Showcase your achievements</li>
              <li>Secure Payments - Get paid on time, every time</li>
            </ul>
          </section>
          <section>
            <h2>Talent Performance Showcase</h2>
            <p>Join successful professionals already working on OnSpot with high performance ratings and client satisfaction scores.</p>
          </section>
        </main>
      `
    },
    '/why-onspot': {
      title: 'Why OnSpot - The Integrator System for Modern Outsourcing',
      description: 'Discover how OnSpot revolutionizes outsourcing with AI-powered talent matching, performance management, and seamless project coordination.',
      content: `
        <header>
          <h1>Why Choose OnSpot?</h1>
        </header>
        <main>
          <section>
            <h2>The First Integrator System</h2>
            <p>OnSpot is designed to simplify outsourcing for B2B and B2C clients through AI-powered talent matching, performance management, and seamless project coordination.</p>
          </section>
          <section>
            <h3>Key Features</h3>
            <ul>
              <li>AI-Powered Talent Matching</li>
              <li>Real-Time Performance Tracking</li>
              <li>Automated Workflows</li>
              <li>Comprehensive Analytics</li>
              <li>Secure Payment Processing</li>
            </ul>
          </section>
          <section>
            <a href="/why-onspot/value-calculator">Calculate Your ROI</a>
            <a href="/why-onspot/case-studies">Read Case Studies</a>
            <a href="/why-onspot/reviews">Client Reviews</a>
          </section>
        </main>
      `
    },
    '/why-onspot/value-calculator': {
      title: 'ROI Value Calculator - OnSpot',
      description: 'Calculate your potential savings and ROI with OnSpot. Comprehensive analysis of global locations, multi-role support, and advanced cost modeling.',
      content: `
        <header>
          <h1>OnSpot Value Calculator</h1>
        </header>
        <main>
          <section>
            <h2>Calculate Your ROI</h2>
            <p>Estimate your cost savings and return on investment with OnSpot's comprehensive value calculator featuring:</p>
            <ul>
              <li>Global location data with cascading dropdowns</li>
              <li>Multi-role support and team configurations</li>
              <li>Advanced inputs: work hours, benefits, overhead calculations</li>
              <li>Productivity gain analysis</li>
              <li>Management fees and attrition rate modeling</li>
            </ul>
          </section>
          <section>
            <h3>Why Use OnSpot?</h3>
            <p>Save up to 70% on operational costs while maintaining or improving quality with our vetted talent network.</p>
          </section>
        </main>
      `
    },
    '/get-hired': {
      title: 'Get Hired - Join OnSpot Talent Network',
      description: 'Get hired by top companies. Create your profile, showcase your skills, and connect with clients looking for your expertise.',
      content: `
        <header>
          <h1>Get Hired on OnSpot</h1>
        </header>
        <main>
          <section>
            <h2>Your Path to Success</h2>
            <p>Join thousands of talented professionals earning competitive rates on OnSpot.</p>
          </section>
          <section>
            <h3>How It Works</h3>
            <ol>
              <li>Sign Up - Create your account in minutes</li>
              <li>Build Profile - Showcase your skills and experience</li>
              <li>Get Matched - AI finds the perfect opportunities for you</li>
              <li>Start Working - Accept projects and start earning</li>
            </ol>
          </section>
        </main>
      `
    },
    '/find-work': {
      title: 'Find Work - Browse Opportunities on OnSpot',
      description: 'Browse and apply for freelance and contract opportunities. Find projects that match your skills and expertise.',
      content: `
        <header>
          <h1>Find Work on OnSpot</h1>
        </header>
        <main>
          <section>
            <h2>Browse Available Opportunities</h2>
            <p>Discover projects across various categories including:</p>
            <ul>
              <li>Customer Support</li>
              <li>Technical Support</li>
              <li>Data Entry</li>
              <li>Virtual Assistant</li>
              <li>Content Writing</li>
              <li>Software Development</li>
            </ul>
          </section>
        </main>
      `
    },
    '/insights': {
      title: 'Insights & Analytics - OnSpot',
      description: 'Explore outsourcing trends, market insights, and performance analytics to make data-driven decisions for your business.',
      content: `
        <header>
          <h1>OnSpot Insights</h1>
        </header>
        <main>
          <section>
            <h2>Market Insights & Trends</h2>
            <p>Stay informed with the latest outsourcing trends, performance benchmarks, and industry analytics.</p>
          </section>
        </main>
      `
    },
    '/hire-talent': {
      title: 'Hire Talent - Find Skilled Professionals on OnSpot',
      description: 'Hire vetted talent for your projects. Access a global pool of skilled professionals ready to deliver quality work.',
      content: `
        <header>
          <h1>Hire Talented Professionals</h1>
        </header>
        <main>
          <section>
            <h2>Find the Perfect Match</h2>
            <p>Browse and hire from our vetted talent pool. Filter by skills, experience, rates, and availability.</p>
          </section>
        </main>
      `
    },
    '/amazing': {
      title: 'Amazing Features - OnSpot',
      description: 'Discover the amazing features that make OnSpot the best outsourcing platform for businesses and talent.',
      content: `
        <header>
          <h1>Amazing OnSpot Features</h1>
        </header>
        <main>
          <section>
            <h2>What Makes OnSpot Amazing</h2>
            <p>Experience cutting-edge features designed to streamline outsourcing and maximize productivity.</p>
          </section>
        </main>
      `
    }
  };

  return metadata[path] || {
    title: 'OnSpot - Making Outsourcing Easy',
    description: 'OnSpot bridges BPO and freelancing with AI-powered talent matching and performance management.',
    content: '<h1>OnSpot</h1><p>Making Outsourcing Easy</p>'
  };
}
