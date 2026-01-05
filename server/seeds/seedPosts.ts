// NOTE:
// This seed migrates legacy static Insight posts into the database.
// Safe to remove once production content is fully managed via admin UI.
//
// This script is idempotent - it uses slug uniqueness to prevent duplicates.
// It will only insert posts that don't already exist in the database.

import type { IStorage } from "../storage";

interface SeedPost {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImageUrl: string;
  category: string;
  author: string;
  isFeatured: boolean;
  status: "draft" | "published";
  readTime: string;
  likes: number;
  publishedAt: Date;
}

const samplePosts: SeedPost[] = [
  {
    title: "Leveraging Ghana's Tech Talent and the World-Class Customer Service of the Philippines",
    slug: "leveraging-ghanas-tech-talent-philippines-customer-service",
    excerpt: "Discover how combining Ghana's emerging tech capabilities with the Philippines' proven customer service excellence creates unbeatable outsourcing solutions.",
    content: `<p>In the evolving landscape of global outsourcing, businesses are increasingly recognizing the unique advantages of combining talent pools from different regions. Ghana and the Philippines represent two powerhouse destinations that, when leveraged together, create an unbeatable combination for businesses seeking comprehensive outsourcing solutions.</p>

<h2>Ghana's Emerging Tech Ecosystem</h2>
<p>Ghana has rapidly positioned itself as a leading tech hub in Africa. With a young, educated workforce and strong English proficiency, the country offers exceptional software development and IT services at competitive rates. The government's investment in digital infrastructure has created an environment where tech talent thrives.</p>

<h2>The Philippines: Customer Service Excellence</h2>
<p>The Philippines has long been recognized as the global capital of customer service outsourcing. The cultural alignment with Western business practices, combined with exceptional English communication skills and a service-oriented mindset, makes Filipino talent ideal for customer-facing roles.</p>

<h2>The Perfect Partnership</h2>
<p>By combining these strengths, businesses can build teams that excel in both technical development and customer engagement. This hybrid approach allows companies to maintain 24/7 operations while ensuring both technical and service quality remain at the highest levels.</p>`,
    coverImageUrl: "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800&h=500&fit=crop",
    category: "Global Outsourcing",
    author: "OnSpot Team",
    isFeatured: false,
    status: "published",
    readTime: "5 min read",
    likes: 24,
    publishedAt: new Date("2024-10-15"),
  },
  {
    title: "Ghana's Software Development Capabilities: An Untapped Goldmine for Outsourcing",
    slug: "ghana-software-development-outsourcing-goldmine",
    excerpt: "Explore Ghana's rapidly growing tech ecosystem and how it's becoming a premier destination for software development outsourcing.",
    content: `<p>As the global demand for software development talent continues to outpace supply, forward-thinking businesses are turning their attention to emerging tech hubs. Ghana stands out as one of the most promising destinations for software development outsourcing.</p>

<h2>A Growing Tech Ecosystem</h2>
<p>Ghana's tech scene has experienced explosive growth in recent years. Major tech companies have established presence in Accra, and local startups are flourishing. This has created a virtuous cycle where talent attracts investment, and investment creates more opportunities for talent development.</p>

<h2>Quality Education and English Proficiency</h2>
<p>Ghana boasts several world-class universities producing skilled graduates in computer science and engineering. As an English-speaking nation, communication barriers are minimal, making collaboration with international teams seamless.</p>

<h2>Cost-Effective Without Compromise</h2>
<p>Competitive labor costs combined with high-quality output make Ghana an attractive option for businesses looking to optimize their development budgets without sacrificing code quality or project timelines.</p>`,
    coverImageUrl: "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&h=500&fit=crop",
    category: "Technology",
    author: "Tech Research Team",
    isFeatured: false,
    status: "published",
    readTime: "4 min read",
    likes: 18,
    publishedAt: new Date("2024-10-14"),
  },
  {
    title: "It's in the Culture: Why the Philippines is the Gold Standard in Global Customer Service",
    slug: "philippines-gold-standard-customer-service-culture",
    excerpt: "The Philippines has this deep understanding of Western expectations because of its historical ties to America and strong cultural alignment with Western business practices.",
    content: `<p>When it comes to customer service outsourcing, the Philippines has earned its reputation as the gold standard. But what makes Filipino customer service professionals so exceptional? The answer lies deep within the culture.</p>

<h2>Historical and Cultural Context</h2>
<p>The Philippines' historical ties to America have created a unique cultural bridge. Filipinos have a deep understanding of Western expectations, communication styles, and cultural nuances. This isn't just learned—it's woven into the fabric of daily life.</p>

<h2>The Filipino Service Mindset</h2>
<p>"Malasakit" is a Filipino concept that roughly translates to genuine care and concern for others. This cultural value manifests naturally in customer interactions, where Filipino service professionals go above and beyond to ensure customer satisfaction.</p>

<h2>Language and Communication</h2>
<p>With English as one of the official languages, Filipinos are not just proficient—they're often eloquent. The neutral accent and clear communication style make conversations smooth and professional.</p>

<h2>The Result: World-Class Service</h2>
<p>These cultural factors combine to create customer service professionals who don't just follow scripts—they genuinely connect with customers and solve problems with empathy and efficiency.</p>`,
    coverImageUrl: "https://images.unsplash.com/photo-1600298881974-6be191ceeda1?w=800&h=500&fit=crop",
    category: "Customer Service",
    author: "Nur Laminero",
    isFeatured: true,
    status: "published",
    readTime: "4 min read",
    likes: 45,
    publishedAt: new Date("2024-10-12"),
  },
  {
    title: "Latest Updates in Outsourcing: A 2024 Perspective",
    slug: "outsourcing-updates-2024-perspective-trends",
    excerpt: "As the global market continuously shifts, outsourcing trends have adapted to align with modern business demands. Here's what's shaping the industry.",
    content: `<p>The outsourcing industry in 2024 looks vastly different from just a few years ago. Driven by technological advancement, changing workforce dynamics, and evolving business needs, several key trends are reshaping the landscape.</p>

<h2>AI-Augmented Outsourcing</h2>
<p>Artificial intelligence is no longer replacing outsourced workers—it's empowering them. Smart tools help customer service representatives resolve issues faster, developers write better code, and analysts generate deeper insights.</p>

<h2>The Rise of Nearshoring</h2>
<p>While traditional offshore destinations remain popular, businesses are increasingly looking at nearshore options. Time zone alignment and cultural proximity are becoming key decision factors.</p>

<h2>Focus on Specialized Skills</h2>
<p>Generic outsourcing is giving way to specialized partnerships. Companies now seek partners with deep expertise in specific domains rather than general-purpose service providers.</p>

<h2>Hybrid Work Models</h2>
<p>The post-pandemic world has normalized remote work, and outsourcing partners have adapted. Flexible arrangements that blend remote and on-site work are now the norm rather than the exception.</p>`,
    coverImageUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=500&fit=crop",
    category: "Industry Trends",
    author: "Renier Macalino",
    isFeatured: true,
    status: "published",
    readTime: "3 min read",
    likes: 32,
    publishedAt: new Date("2024-10-11"),
  },
  {
    title: "Process Efficiency: The Foundation of Exceptional Customer Service",
    slug: "process-efficiency-foundation-customer-service",
    excerpt: "Learn how streamlined processes and efficient workflows create the backbone of outstanding customer service delivery.",
    content: `<p>Behind every exceptional customer service experience is a well-oiled machine of processes and workflows. Process efficiency isn't just about cutting costs—it's about enabling your team to deliver outstanding service consistently.</p>

<h2>Mapping the Customer Journey</h2>
<p>Understanding every touchpoint in the customer journey is the first step to optimization. Where do customers struggle? Where do they experience friction? These insights drive meaningful improvements.</p>

<h2>Standardization Without Rigidity</h2>
<p>Effective processes provide clear guidelines while allowing flexibility for unique situations. The best customer service operations balance consistency with the ability to go off-script when needed.</p>

<h2>Technology as an Enabler</h2>
<p>Modern customer service platforms, CRM systems, and knowledge bases empower agents to resolve issues quickly. The right tools make processes smoother for both agents and customers.</p>

<h2>Continuous Improvement</h2>
<p>The best operations never stop improving. Regular analysis of metrics, customer feedback, and agent input drives ongoing optimization that compounds over time.</p>`,
    coverImageUrl: "https://images.unsplash.com/photo-1553484771-371a605b060b?w=800&h=500&fit=crop",
    category: "Process Optimization",
    author: "Operations Team",
    isFeatured: false,
    status: "published",
    readTime: "6 min read",
    likes: 28,
    publishedAt: new Date("2024-10-10"),
  },
];

export async function seedPosts(storage: IStorage): Promise<{ seeded: number; skipped: number }> {
  console.log("🌱 Starting posts seed migration...");
  
  let seeded = 0;
  let skipped = 0;

  for (const post of samplePosts) {
    try {
      const existingPost = await storage.getPostBySlug(post.slug);
      
      if (existingPost) {
        console.log(`⏭️  Skipping existing post: "${post.title}" (slug: ${post.slug})`);
        skipped++;
        continue;
      }

      await storage.createPost(post);
      console.log(`✅ Seeded post: "${post.title}"`);
      seeded++;
    } catch (error: any) {
      console.error(`❌ Failed to seed post "${post.title}":`, error.message);
    }
  }

  console.log(`🌱 Posts seed complete: ${seeded} seeded, ${skipped} skipped (already exist)`);
  return { seeded, skipped };
}

export { samplePosts };
