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
import { motion } from "framer-motion";
import teamPhoto from "@assets/Vertex Team_1758456949998.png";

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
    <div className="space-y-0 overflow-hidden">
      {/* Hero Section */}
      <section className="hero-investor text-white pt-28 pb-20">
        <div className="container mx-auto px-6">
          <div className="relative">

            <div className="grid md:grid-cols-12 items-center min-h-[90vh] relative overflow-hidden">
              {/* LEFT: Text content */}
              <div className="col-span-12 md:col-span-6 p-8 md:p-16 z-10 space-y-6">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.5 }}
                  transition={{ duration: 0.5 }}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[hsl(var(--brand-foreground))]/20 backdrop-blur-sm rounded-full text-[hsl(var(--brand-foreground))]/95 text-sm font-medium mb-8"
                >
                  <Sparkles className="w-4 h-4" />
                  Amazing Stories
                </motion.div>
                
                <motion.h1
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.5 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  className="text-3xl md:text-4xl lg:text-5xl font-light tracking-tight mb-6 text-[hsl(var(--brand-foreground))] leading-none drop-shadow-xl"
                >
                  We love our
                  <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-[hsl(var(--gold-yellow))] via-[hsl(var(--gold-yellow))] to-[hsl(var(--gold-yellow)/0.8)] drop-shadow-lg">
                    {" "}people
                  </span>
                  <br />and they love us
                </motion.h1>
                
                <motion.p
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.5 }}
                  transition={{ duration: 0.7, delay: 0.2 }}
                  className="text-lg md:text-xl text-[hsl(var(--brand-foreground))]/95 mb-6 leading-relaxed font-light drop-shadow-lg"
                >
                  Amazing results. Amazing stories. It's not just about the numbers, it's about the feeling.
                </motion.p>
                
                <motion.p
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.5 }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                  className="text-base text-[hsl(var(--brand-foreground))]/90 mb-8 font-light drop-shadow-md"
                >
                  The sheer thrill of seeing our people achieve what they once thought impossible? That's the amazingness we strive for.
                </motion.p>
              </div>

              {/* RIGHT: Team Photo */}
              <div className="hidden md:flex md:col-span-6 relative h-full items-end overflow-visible">
                <motion.img
                  initial={{ opacity: 0, scale: 1.4 }}
                  whileInView={{ opacity: 1, scale: 1.6 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.8 }}
                  src={teamPhoto}
                  alt="OnSpot team working together"
                  className="w-full h-auto object-cover object-bottom transform origin-bottom"
                  style={{
                    WebkitMaskImage: 'linear-gradient(to left, black 75%, transparent 100%)',
                    maskImage: 'linear-gradient(to left, black 75%, transparent 100%)'
                  }}
                />
              </div>
            </div>
          </div>
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
      <section className="hero-investor py-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full blur-3xl opacity-8 pointer-events-none"
               style={{ background: "radial-gradient(circle, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 40%, transparent 70%)" }} />
          <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full blur-3xl opacity-6 pointer-events-none"
               style={{ background: "radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.03) 40%, transparent 70%)" }} />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center container">
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.6 }}
            className="text-4xl md:text-5xl font-light text-[hsl(var(--brand-foreground))] mb-6 drop-shadow-lg"
          >
            Ready to create your own 
            <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-[hsl(var(--gold-yellow))] to-[hsl(var(--gold-yellow)/0.8)]">
              {" "}amazing story
            </span>?
          </motion.h2>
          
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-xl text-[hsl(var(--brand-foreground))]/90 mb-8 max-w-2xl mx-auto drop-shadow-md"
          >
            Join hundreds of businesses who've transformed their operations with OnSpot's talented professionals.
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button size="lg" className="bg-[hsl(var(--brand-foreground))] text-primary hover:bg-[hsl(var(--brand-foreground))]/90 px-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1" data-testid="button-get-started">
              Get Started Today
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button size="lg" variant="outline" className="border-[hsl(var(--brand-foreground))]/30 text-[hsl(var(--brand-foreground))] hover:bg-[hsl(var(--brand-foreground))]/15 hover:border-[hsl(var(--brand-foreground))]/50 px-8 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1">
              View Our Services
            </Button>
          </motion.div>
        </div>
      </section>
    </div>
  );
}