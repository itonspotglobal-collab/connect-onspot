import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  BookOpen, 
  Coffee, 
  Youtube, 
  ExternalLink,
  Calendar,
  User,
  Heart,
  ArrowRight,
  Rss,
  Bell,
  Globe,
  Target,
  TrendingUp
} from "lucide-react";

const articles = [
  {
    id: 1,
    title: "Leveraging Ghana's Tech Talent and the World-Class Customer Service of the Philippines",
    excerpt: "Discover how combining Ghana's emerging tech capabilities with the Philippines' proven customer service excellence creates unbeatable outsourcing solutions.",
    author: "OnSpot Team",
    date: "Oct 15, 2024",
    readTime: "5 min read",
    likes: 24,
    category: "Global Outsourcing",
    featured: false,
    image: "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=400&h=250&fit=crop&crop=faces"
  },
  {
    id: 2,
    title: "Ghana's Software Development Capabilities: An Untapped Goldmine for Outsourcing",
    excerpt: "Explore Ghana's rapidly growing tech ecosystem and how it's becoming a premier destination for software development outsourcing.",
    author: "Tech Research Team",
    date: "Oct 14, 2024",
    readTime: "4 min read",
    likes: 18,
    category: "Technology",
    featured: false,
    image: "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=400&h=250&fit=crop&crop=faces"
  },
  {
    id: 3,
    title: "It's in the Culture: Why the Philippines is the Gold Standard in Global Customer Service",
    excerpt: "The Philippines has this deep understanding of Western expectations because of its historical ties to America and strong cultural alignment with Western business practices.",
    author: "Nur Laminero",
    date: "Oct 12, 2024",
    readTime: "4 min read",
    likes: 45,
    category: "Customer Service",
    featured: true,
    image: "https://images.unsplash.com/photo-1600298881974-6be191ceeda1?w=400&h=250&fit=crop&crop=faces"
  },
  {
    id: 4,
    title: "Latest Updates in Outsourcing: A 2024 Perspective",
    excerpt: "As the global market continuously shifts, outsourcing trends have adapted to align with modern business demands. Here's what's shaping the industry.",
    author: "Renier Macalino",
    date: "Oct 11, 2024",
    readTime: "3 min read",
    likes: 32,
    category: "Industry Trends",
    featured: true,
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=250&fit=crop&crop=faces"
  },
  {
    id: 5,
    title: "Process Efficiency: The Foundation of Exceptional Customer Service",
    excerpt: "Learn how streamlined processes and efficient workflows create the backbone of outstanding customer service delivery.",
    author: "Operations Team",
    date: "Oct 10, 2024",
    readTime: "6 min read",
    likes: 28,
    category: "Process Optimization",
    featured: false,
    image: "https://images.unsplash.com/photo-1553484771-371a605b060b?w=400&h=250&fit=crop&crop=faces"
  }
];

const contentChannels = [
  {
    title: "OnSpot Blog",
    description: "Daily articles about outsourcing, entrepreneurship, careers and other intuitive insights about business. Periodic case studies are also published designed to inspire and guide you on your startup, entrepreneurship, and outsourcing ventures.",
    icon: BookOpen,
    link: "#",
    buttonText: "Visit the blog",
    color: "bg-primary"
  },
  {
    title: "OnSpot Cafe",
    description: "Our podcast is coming soon! We are brewing inspiring conversations that are guaranteed to bring unfiltered intuitive contents about outsourcing. We will not only be talking about best practices. We will have real hard conversations about the bad practices in the industry too!",
    icon: Coffee,
    link: "#",
    buttonText: "Coming Soon!",
    color: "bg-[hsl(var(--gold-yellow)/0.8)]"
  },
  {
    title: "Chief of Tribe",
    description: "Dive deep into the success stories of entrepreneurs, professionals, and individuals that are sure to inspire and ignite the fire in you to become the best version of yourself. Our goal is to deliver the blueprint to business and outsourcing through this channel.",
    icon: Youtube,
    link: "#",
    buttonText: "View YouTube",
    color: "bg-red-500"
  }
];

export default function Insights() {
  const [email, setEmail] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Articles");

  const categories = [
    "All Articles",
    "Global Outsourcing", 
    "Technology",
    "Customer Service",
    "Industry Trends",
    "Process Optimization"
  ];

  const featuredArticles = articles.filter(article => article.featured);
  const filteredArticles = selectedCategory === "All Articles" 
    ? articles 
    : articles.filter(article => article.category === selectedCategory);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle subscription logic here
    console.log("Subscribing:", email);
    setEmail("");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-white py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              OnSpot Insights
            </h1>
            <div className="space-y-4 mb-8">
              <h2 className="text-2xl md:text-3xl font-semibold">
                Cutting Edge Ideas, Radical thoughts
              </h2>
              <p className="text-lg md:text-xl text-white/90">
                Get all the best insights around outsourcing straight to your mailbox daily
              </p>
            </div>
            
            {/* Newsletter Subscription */}
            <form onSubmit={handleSubscribe} className="max-w-md mx-auto flex gap-3">
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/70 focus:border-white/40"
                data-testid="input-email-subscribe"
              />
              <Button type="submit" className="bg-white text-primary hover:bg-white/90">
                <Bell className="w-4 h-4 mr-2" />
                Subscribe
              </Button>
            </form>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-16">
        {/* Blog Categories */}
        <section className="mb-12">
          <h3 className="text-2xl font-bold mb-6">Blog Categories</h3>
          <div className="flex flex-wrap gap-2 mb-8">
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className={selectedCategory === category ? "" : "hover-elevate"}
                data-testid={`filter-${category.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {category}
              </Button>
            ))}
          </div>
        </section>

        {/* Featured Articles */}
        {selectedCategory === "All Articles" && (
          <section className="mb-16">
            <div className="flex items-center gap-2 mb-8">
              <Target className="w-6 h-6 text-primary" />
              <h3 className="text-2xl font-bold">Featured Posts</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {featuredArticles.map((article) => (
                <Card key={article.id} className="overflow-hidden hover-elevate transition-all duration-300 group">
                  <div className="aspect-video bg-muted relative">
                    <img 
                      src={article.image} 
                      alt={article.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <Badge className="absolute top-4 left-4 bg-primary text-white">
                      Featured
                    </Badge>
                  </div>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                      <User className="w-4 h-4" />
                      <span>{article.author}</span>
                      <Separator orientation="vertical" className="h-4" />
                      <Calendar className="w-4 h-4" />
                      <span>{article.date}</span>
                      <Separator orientation="vertical" className="h-4" />
                      <span>{article.readTime}</span>
                    </div>
                    <h4 className="text-xl font-bold mb-3 line-clamp-2 group-hover:text-primary transition-colors">
                      {article.title}
                    </h4>
                    <p className="text-muted-foreground mb-4 line-clamp-3">
                      {article.excerpt}
                    </p>
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">{article.category}</Badge>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Heart className="w-4 h-4" />
                        <span>{article.likes}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* All Articles / Filtered Articles */}
        <section className="mb-16">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <Globe className="w-6 h-6 text-primary" />
              <h3 className="text-2xl font-bold">
                {selectedCategory === "All Articles" ? "Key Insights" : selectedCategory}
              </h3>
            </div>
            {selectedCategory === "All Articles" && (
              <p className="text-muted-foreground">
                Updated daily with curated fresh insights across the world of outsourcing, business, entrepreneurship and others.
              </p>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredArticles.map((article) => (
              <Card key={article.id} className="overflow-hidden hover-elevate transition-all duration-300 group">
                <div className="aspect-video bg-muted relative">
                  <img 
                    src={article.image} 
                    alt={article.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {article.featured && (
                    <Badge className="absolute top-4 left-4 bg-[hsl(var(--gold-yellow)/0.9)] text-black">
                      Featured
                    </Badge>
                  )}
                </div>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                    <User className="w-3 h-3" />
                    <span>{article.author}</span>
                    <Separator orientation="vertical" className="h-3" />
                    <Calendar className="w-3 h-3" />
                    <span>{article.date}</span>
                  </div>
                  <h4 className="text-lg font-bold mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                    {article.title}
                  </h4>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {article.excerpt}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {article.category}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {article.readTime}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Heart className="w-3 h-3" />
                      <span>{article.likes}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Content Channels */}
        <section className="mb-16">
          <div className="flex items-center gap-2 mb-8">
            <TrendingUp className="w-6 h-6 text-primary" />
            <h3 className="text-2xl font-bold">Our Content Channels</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {contentChannels.map((channel, index) => (
              <Card key={index} className="text-center hover-elevate transition-all duration-300 group">
                <CardContent className="p-8">
                  <div className={`w-16 h-16 mx-auto mb-6 rounded-full ${channel.color} flex items-center justify-center`}>
                    <channel.icon className="w-8 h-8 text-white" />
                  </div>
                  <h4 className="text-xl font-bold mb-4">{channel.title}</h4>
                  <p className="text-muted-foreground mb-6 leading-relaxed">
                    {channel.description}
                  </p>
                  <Button asChild className="group-hover:shadow-lg transition-all">
                    <a href={channel.link} target="_blank" rel="noopener noreferrer">
                      {channel.buttonText}
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Daily Notes from CEO */}
        <section className="mb-16">
          <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="p-8 text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Rss className="w-6 h-6 text-primary" />
                <h3 className="text-2xl font-bold">Daily Notes from our CEO</h3>
              </div>
              <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                Get exclusive insights and thoughts from our leadership team. Raw, unfiltered perspectives on the future of outsourcing and business growth.
              </p>
              <Button size="lg" className="bg-primary hover:bg-primary/90">
                Subscribe to CEO Notes
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* Bottom CTA */}
        <section className="text-center">
          <Card className="bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-white border-0">
            <CardContent className="p-12">
              <h3 className="text-3xl font-bold mb-4">Stay Updated</h3>
              <p className="text-white/90 mb-8 max-w-2xl mx-auto">
                Don't miss out on the latest insights, trends, and strategies in outsourcing. 
                Join thousands of business leaders who trust OnSpot for cutting-edge industry intelligence.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
                <Button size="lg" className="bg-white text-primary hover:bg-white/90 flex-1">
                  <Rss className="w-4 h-4 mr-2" />
                  RSS Feed
                </Button>
                <Button size="lg" variant="outline" className="border-white/50 text-white hover:bg-white/10 flex-1">
                  <Bell className="w-4 h-4 mr-2" />
                  Newsletter
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}