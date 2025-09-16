import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Star, 
  Quote, 
  ThumbsUp, 
  Heart,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  Award,
  Users,
  Building,
  Briefcase,
  Globe
} from "lucide-react";

export default function WhyOnSpotReviews() {
  const reviews = [
    {
      rating: 5,
      text: "OnSpot completely transformed our operations. What used to take our team weeks now happens in days. The level of expertise and professionalism from their team is unmatched. We've saved over $200K annually while improving our service quality.",
      author: "Michael Chen",
      title: "CEO",
      company: "TechVantage Solutions",
      industry: "Technology",
      avatar: "MC",
      verified: true,
      helpfulVotes: 47,
      date: "2 months ago",
      highlights: ["Cost Savings", "Efficiency", "Quality"]
    },
    {
      rating: 5,
      text: "I was skeptical about outsourcing at first, but OnSpot made the transition seamless. Their managed services model means I don't have to worry about day-to-day management - they just deliver results. My customer satisfaction scores have never been higher.",
      author: "Sarah Rodriguez",
      title: "Founder",
      company: "GreenLife Wellness",
      industry: "Healthcare",
      avatar: "SR",
      verified: true,
      helpfulVotes: 32,
      date: "1 month ago",
      highlights: ["Seamless Process", "Results Driven", "Customer Focus"]
    },
    {
      rating: 5,
      text: "The OnSpot team doesn't just work for us - they work WITH us. They took the time to understand our business, our culture, and our goals. The integration was so smooth that our customers couldn't tell we had expanded our team offshore.",
      author: "David Park",
      title: "Operations Director",
      company: "LogiFlow International",
      industry: "Logistics",
      avatar: "DP",
      verified: true,
      helpfulVotes: 28,
      date: "3 weeks ago",
      highlights: ["Cultural Fit", "Integration", "Partnership"]
    },
    {
      rating: 5,
      text: "We've tried other outsourcing companies before, but OnSpot is in a league of their own. Their 4-stage system actually works. They deliver on every promise and go above and beyond. Our ROI has been incredible - 8X in the first year alone.",
      author: "Jennifer Kim",
      title: "COO",
      company: "DataStream Analytics",
      industry: "Data & Analytics",
      avatar: "JK",
      verified: true,
      helpfulVotes: 51,
      date: "6 days ago",
      highlights: ["System Excellence", "ROI", "Reliability"]
    },
    {
      rating: 5,
      text: "OnSpot's team became an extension of our own team. The communication is excellent, the work quality is outstanding, and they genuinely care about our success. It's refreshing to work with a partner who is as invested in our growth as we are.",
      author: "Alex Thompson",
      title: "Managing Partner",
      company: "Thompson & Associates",
      industry: "Legal Services",
      avatar: "AT",
      verified: true,
      helpfulVotes: 19,
      date: "2 weeks ago",
      highlights: ["Team Integration", "Communication", "Partnership"]
    },
    {
      rating: 5,
      text: "The expertise OnSpot brought to our project was game-changing. Not only did they handle our immediate needs, but they also identified process improvements we hadn't considered. They're strategic partners, not just service providers.",
      author: "Maria Santos",
      title: "VP of Operations",
      company: "RetailMax Global",
      industry: "Retail",
      avatar: "MS",
      verified: true,
      helpfulVotes: 35,
      date: "1 week ago",
      highlights: ["Expertise", "Strategy", "Innovation"]
    }
  ];

  const satisfactionStats = [
    {
      icon: Star,
      value: "4.9/5",
      label: "Average Rating",
      description: "Based on 200+ client reviews"
    },
    {
      icon: ThumbsUp,
      value: "96%",
      label: "Satisfaction Rate",
      description: "Clients who would recommend OnSpot"
    },
    {
      icon: TrendingUp,
      value: "94%",
      label: "Retention Rate",
      description: "Clients who continue partnerships"
    },
    {
      icon: Award,
      value: "100%",
      label: "Success Rate",
      description: "Projects delivered on time & budget"
    }
  ];

  const testimonialHighlights = [
    "Exceptional service quality",
    "Seamless communication",
    "Cultural alignment",
    "Proactive problem solving",
    "Cost-effective solutions",
    "Reliable partnerships",
    "Strategic thinking",
    "Process optimization"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Hero Section */}
      <section className="relative py-32 px-4 text-center overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-primary/80">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:80px_80px]" />
        </div>
        
        <div className="relative z-10 max-w-6xl mx-auto">
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-white/20 backdrop-blur-sm rounded-full text-white/90 text-sm font-medium mb-8">
            <Star className="w-4 h-4" />
            Client Testimonials
          </div>
          
          <h1 className="text-6xl md:text-8xl font-bold tracking-tight mb-8 text-white">
            What Our
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[hsl(var(--gold-yellow))] to-[hsl(45_100%_55%)]">
              Clients Say
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-white/90 mb-16 max-w-4xl mx-auto leading-relaxed font-light">
            Don't just take our word for it. Hear directly from the businesses we've helped transform through effortless outsourcing
          </p>
        </div>
      </section>

      {/* Satisfaction Stats */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Client Satisfaction</h2>
            <p className="text-xl text-muted-foreground">Numbers that reflect our commitment to excellence</p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-8">
            {satisfactionStats.map((stat, index) => (
              <Card key={index} className="text-center hover-elevate" data-testid={`stat-${index}`}>
                <CardContent className="p-8">
                  <div className="w-16 h-16 mx-auto mb-6 bg-primary/10 rounded-full flex items-center justify-center">
                    <stat.icon className="w-8 h-8 text-primary" />
                  </div>
                  <div className="text-4xl font-bold text-primary mb-2">{stat.value}</div>
                  <div className="text-lg font-semibold mb-2">{stat.label}</div>
                  <div className="text-sm text-muted-foreground">{stat.description}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Client Reviews */}
      <section className="py-32 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-6xl font-bold mb-6">Real Reviews from Real Clients</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Authentic feedback from business leaders who have experienced the OnSpot difference
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {reviews.map((review, index) => (
              <Card key={index} className="relative overflow-hidden hover-elevate transition-all duration-500 group h-full" data-testid={`review-${index}`}>
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-muted/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <CardContent className="relative p-8 h-full flex flex-col">
                  {/* Rating & Verification */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: review.rating }).map((_, i) => (
                        <Star key={i} className="w-5 h-5 fill-[hsl(var(--gold-yellow))] text-[hsl(var(--gold-yellow))]" />
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      {review.verified && (
                        <Badge className="bg-green-100 text-green-800 text-xs">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {/* Review Text */}
                  <div className="relative mb-6 flex-1">
                    <Quote className="w-8 h-8 text-primary/20 absolute -top-2 -left-2" />
                    <p className="text-muted-foreground leading-relaxed italic pl-6">
                      {review.text}
                    </p>
                  </div>
                  
                  {/* Highlights */}
                  <div className="mb-6">
                    <div className="flex flex-wrap gap-2">
                      {review.highlights.map((highlight, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {highlight}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  {/* Author Info */}
                  <div className="flex items-center gap-4 mb-4">
                    <Avatar className="w-12 h-12 border-2 border-primary/20">
                      <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-white font-semibold">
                        {review.avatar}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="font-semibold text-foreground">{review.author}</div>
                      <div className="text-sm text-primary">{review.title}</div>
                      <div className="text-sm text-muted-foreground">{review.company}</div>
                    </div>
                  </div>
                  
                  {/* Review Meta */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-4">
                    <div className="flex items-center gap-4">
                      <span>{review.date}</span>
                      <Badge variant="secondary" className="text-xs">{review.industry}</Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <ThumbsUp className="w-3 h-3" />
                      <span>{review.helpfulVotes}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Common Praise Topics */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">What Clients Love Most</h2>
            <p className="text-xl text-muted-foreground">The most frequently mentioned benefits in our reviews</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {testimonialHighlights.map((highlight, index) => (
              <Card key={index} className="text-center hover-elevate cursor-pointer group" data-testid={`highlight-${index}`}>
                <CardContent className="p-6">
                  <div className="w-12 h-12 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center group-hover:bg-primary/20 transition-colors duration-300">
                    <Heart className="w-6 h-6 text-primary" />
                  </div>
                  <div className="font-medium text-sm">{highlight}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-primary/10 via-primary/5 to-background">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">Join Our Growing Family of Happy Clients</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Experience the same exceptional service and results that our clients rave about
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-lg px-10 py-6" data-testid="button-get-started">
              Start Your Success Story
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button variant="outline" size="lg" className="text-lg px-10 py-6" data-testid="button-read-more">
              Read All Reviews
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}