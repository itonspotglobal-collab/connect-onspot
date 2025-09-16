import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Star, 
  Quote, 
  Users,
  Award,
  ChevronLeft,
  ChevronRight,
  Filter,
  Heart,
  Sparkles,
  Camera,
  Play,
  ArrowRight
} from "lucide-react";
import { useState } from "react";

export default function Amazing() {
  const [galleryFilter, setGalleryFilter] = useState("All");

  const testimonials = [
    {
      name: "Frederic Hill",
      title: "Founder & CEO",
      company: "TechVenture Inc.",
      quote: "I just had to take a moment to express my gratitude for the outstanding service they provided. Their complete assistance and efforts were truly remarkable",
      initials: "FH"
    },
    {
      name: "Julie Kyle", 
      title: "Account Executive",
      company: "Growth Solutions",
      quote: "Every step of the way they provided helpful advice, recommended strategies to ensure our website was optimally set up, and made sure every element was clear and concise.",
      initials: "JK"
    },
    {
      name: "Brendan Buck",
      title: "Data Engineer", 
      company: "Analytics Pro",
      quote: "Excellent service and throughly trained professionals, and their follow-up on tickets was handled with such care and attention to detail.",
      initials: "BB"
    },
    {
      name: "Paige Lowery",
      title: "Head of Brand",
      company: "Creative Studios",
      quote: "Every step of the way they provided helpful advice, recommended strategies to ensure our website was optimally set up, and made sure every element was clear and concise.",
      initials: "PL"
    },
    {
      name: "Stefan Ball",
      title: "Marketing Manager",
      company: "Digital First",
      quote: "I just had to take a moment to express my gratitude for the outstanding service they provided. Their complete assistance and efforts were truly remarkable.",
      initials: "SB"
    }
  ];

  const featuredEmployees = [
    {
      name: "Maria Santos",
      title: "Senior Talent Specialist",
      description: "Expert in matching top-tier talent with growing businesses. Specializes in technical and creative roles with 8+ years of recruitment experience.",
      skills: ["Recruitment", "Matching", "HR Tech"],
      initials: "MS"
    },
    {
      name: "James Chen",
      title: "Platform Architect", 
      description: "Designs and builds scalable systems that power our matching algorithms and performance tracking. Passionate about clean, efficient code.",
      skills: ["System Design", "Cloud Infrastructure", "Security"],
      initials: "JC"
    },
    {
      name: "Sofia Rodriguez",
      title: "Client Success Manager",
      description: "Ensures every client achieves their outsourcing goals through strategic guidance and ongoing support. Results-driven with a personal touch.",
      skills: ["Client Relations", "Strategy", "Growth"],
      initials: "SR"
    },
    {
      name: "Alex Thompson",
      title: "Quality Assurance Lead",
      description: "Maintains the highest standards across all delivered work. Implements quality frameworks that ensure consistent excellence.",
      skills: ["Quality Control", "Process Design", "Training"],
      initials: "AT"
    }
  ];

  const galleryImages = [
    { id: 1, category: "All", alt: "Team collaboration workspace" },
    { id: 2, category: "All", alt: "Client meeting room" },
    { id: 3, category: "Neighbours", alt: "Office building exterior" },
    { id: 4, category: "All", alt: "Team brainstorming session" },
    { id: 5, category: "Neighbours", alt: "Rooftop team event" },
    { id: 6, category: "All", alt: "Individual workstation" },
    { id: 7, category: "All", alt: "Conference presentation" },
    { id: 8, category: "Neighbours", alt: "Office kitchen area" },
    { id: 9, category: "All", alt: "Team celebration" },
    { id: 10, category: "All", alt: "Remote work setup" },
    { id: 11, category: "Neighbours", alt: "Building lobby" },
    { id: 12, category: "All", alt: "Training session" }
  ];

  const filteredImages = galleryFilter === "All" 
    ? galleryImages 
    : galleryImages.filter(img => img.category === galleryFilter);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Hero Section */}
      <section className="py-24 px-4 text-center relative overflow-hidden" style={{
        background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)/0.95) 50%, hsl(var(--primary)/0.9) 100%)'
      }}>
        {/* Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-20 right-20 w-64 h-64 bg-[hsl(var(--gold-yellow))]/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-20 w-80 h-80 bg-white/5 rounded-full blur-2xl"></div>
          <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:100px_100px]"></div>
        </div>

        <div className="relative z-10 max-w-6xl mx-auto">
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur-sm rounded-full text-white/90 text-sm font-medium mb-8">
            <Sparkles className="w-4 h-4" />
            Amazing Stories
          </div>
          
          <h1 className="text-6xl md:text-8xl font-light tracking-tight mb-8 text-white leading-none">
            We love our 
            <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-[hsl(var(--gold-yellow))] via-[hsl(var(--gold-yellow))] to-[hsl(var(--gold-yellow)/0.8)]">
              {" "}people{" "}
            </span>
            <br />and they love us
          </h1>
          
          <p className="text-xl text-white/80 mb-8 max-w-4xl mx-auto leading-relaxed font-light">
            Amazing results. Amazing stories. It's not just about the numbers, it's about the feeling.
          </p>
          
          <p className="text-lg text-white/70 mb-12 max-w-3xl mx-auto font-light">
            The sheer thrill of seeing our people achieve what they once thought impossible? That's the amazingness we strive for.
          </p>
        </div>
      </section>

      {/* Amazing Stories - Testimonials */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-primary/10 backdrop-blur-sm rounded-full text-primary text-sm font-medium mb-6">
              <Quote className="w-4 h-4" />
              Client Stories
            </div>
            <h2 className="text-4xl md:text-5xl font-light mb-4">What Our Clients Say</h2>
            <p className="text-xl text-muted-foreground">Real feedback from real clients who've experienced the OnSpot difference</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="relative overflow-hidden hover-elevate transition-all duration-500 group border-none shadow-lg" data-testid={`testimonial-${index}`}>
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-[hsl(var(--gold-yellow))]/5"></div>
                
                <CardContent className="relative p-8">
                  <div className="flex items-center mb-6">
                    <Avatar className="w-16 h-16 border-2 border-primary/20">
                      <AvatarImage src="" alt={testimonial.name} />
                      <AvatarFallback className="bg-primary text-white font-semibold">
                        {testimonial.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="ml-4">
                      <h3 className="font-semibold text-lg">{testimonial.name}</h3>
                      <p className="text-primary font-medium">{testimonial.title}</p>
                      <p className="text-muted-foreground text-sm">{testimonial.company}</p>
                    </div>
                  </div>

                  <div className="relative">
                    <Quote className="w-6 h-6 text-primary/30 absolute -top-2 -left-2" />
                    <blockquote className="text-muted-foreground leading-relaxed italic pl-4">
                      "{testimonial.quote}"
                    </blockquote>
                  </div>

                  <div className="flex items-center mt-6">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 text-[hsl(var(--gold-yellow))] fill-current" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Employees */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-[hsl(var(--gold-yellow))]/10 backdrop-blur-sm rounded-full text-[hsl(var(--gold-yellow)/0.8)] text-sm font-medium mb-6">
              <Users className="w-4 h-4" />
              Our Team
            </div>
            <h2 className="text-4xl md:text-5xl font-light mb-4">Featured Employees</h2>
            <p className="text-xl text-muted-foreground">Meet our expert professionals driving innovation in the freelance revolution</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {featuredEmployees.map((employee, index) => (
              <Card key={index} className="relative overflow-hidden hover-elevate transition-all duration-500 group text-center" data-testid={`employee-${index}`}>
                <CardContent className="p-8">
                  <div className="relative mb-6">
                    <Avatar className="w-24 h-24 mx-auto border-4 border-white shadow-xl">
                      <AvatarImage src="" alt={employee.name} />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-[hsl(var(--gold-yellow))] text-white text-xl font-bold">
                        {employee.initials}
                      </AvatarFallback>
                    </Avatar>
                  </div>

                  <h3 className="text-xl font-semibold mb-2">{employee.name}</h3>
                  <p className="text-primary font-medium mb-4">{employee.title}</p>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                    {employee.description}
                  </p>

                  <div className="flex flex-wrap gap-2 justify-center">
                    {employee.skills.map((skill, skillIndex) => (
                      <Badge 
                        key={skillIndex} 
                        variant="outline" 
                        className="border-primary/30 text-primary bg-primary/5"
                      >
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Highlights Gallery */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-primary/10 backdrop-blur-sm rounded-full text-primary text-sm font-medium mb-6">
              <Camera className="w-4 h-4" />
              Behind the Scenes
            </div>
            <h2 className="text-4xl md:text-5xl font-light mb-4">Highlights</h2>
            <p className="text-xl text-muted-foreground mb-8">Discover what makes our work enjoyable</p>

            {/* Filter Tabs */}
            <div className="inline-flex items-center gap-1 p-1 bg-white/60 backdrop-blur-sm rounded-full">
              {["All", "Neighbours"].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setGalleryFilter(filter)}
                  className={`px-6 py-3 rounded-full text-sm font-medium transition-all duration-200 ${
                    galleryFilter === filter
                      ? "bg-primary text-white shadow-md"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid={`filter-${filter.toLowerCase()}`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {/* Gallery Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {filteredImages.map((image) => (
              <Card 
                key={image.id} 
                className="relative overflow-hidden group cursor-pointer hover-elevate transition-all duration-300 aspect-square"
                data-testid={`gallery-image-${image.id}`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/10 to-[hsl(var(--gold-yellow))]/20 group-hover:opacity-80 transition-opacity duration-300"></div>
                <div className="absolute inset-0 flex items-center justify-center bg-muted/80">
                  <div className="text-center">
                    <Camera className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground px-2 leading-tight">{image.alt}</p>
                  </div>
                </div>
                <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-all duration-300 flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-white">
                    <Play className="w-6 h-6" />
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Load More Button */}
          <div className="text-center mt-12">
            <Button size="lg" className="px-8">
              View All Photos
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-20 px-4 relative overflow-hidden" style={{
        background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)/0.95) 50%, hsl(var(--primary)/0.9) 100%)'
      }}>
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-64 h-64 bg-[hsl(var(--gold-yellow))]/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-20 w-80 h-80 bg-white/5 rounded-full blur-2xl"></div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-light text-white mb-6">
            Ready to create your own 
            <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-[hsl(var(--gold-yellow))] to-[hsl(var(--gold-yellow)/0.8)]">
              {" "}amazing story
            </span>?
          </h2>
          <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
            Join hundreds of businesses who've transformed their operations with OnSpot's talented professionals.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-white text-primary hover:bg-white/90 px-8" data-testid="button-get-started">
              Get Started Today
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button size="lg" variant="outline" className="border-white/50 text-white hover:bg-white/10 px-8">
              View Our Services
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}