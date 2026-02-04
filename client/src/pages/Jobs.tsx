import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  MapPin,
  Briefcase,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Clock,
  GraduationCap,
  CheckCircle,
} from "lucide-react";
import { HeadSEO } from "@/components/HeadSEO";

interface JobListing {
  id: string;
  title: string;
  location: string;
  type: string;
  salary: string;
  department: string;
  description: string;
  responsibilities: string[];
  skills: string[];
  experienceLevel: string;
  benefits: string[];
}

const jobData: JobListing = {
  id: "csr-001",
  title: "Customer Service Representative",
  location: "Remote",
  type: "Full-Time",
  salary: "$35,000 - $45,000/year",
  department: "Customer Support",
  description:
    "We are looking for a dedicated Customer Service Representative to join our growing team. In this role, you will be the first point of contact for our clients, providing exceptional support and ensuring customer satisfaction. You will handle inquiries, resolve issues, and build lasting relationships with our customers.",
  responsibilities: [
    "Respond to customer inquiries via phone, email, and chat in a timely and professional manner",
    "Resolve customer complaints and issues with empathy and efficiency",
    "Maintain accurate records of customer interactions and transactions",
    "Collaborate with internal teams to escalate and resolve complex issues",
    "Identify opportunities to improve customer experience and provide feedback",
    "Meet or exceed performance metrics including response time and customer satisfaction scores",
  ],
  skills: [
    "Excellent verbal and written communication skills",
    "Strong problem-solving abilities",
    "Proficiency in CRM software and Microsoft Office Suite",
    "Ability to multitask and manage time effectively",
    "Empathy and patience when dealing with customers",
    "Fluency in English (additional languages a plus)",
  ],
  experienceLevel: "Entry to Mid-Level (1-3 years experience preferred)",
  benefits: [
    "Competitive salary with performance bonuses",
    "Remote work flexibility",
    "Health insurance coverage",
    "Paid time off and holidays",
    "Professional development opportunities",
    "Supportive team environment",
  ],
};

export default function Jobs() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  return (
    <>
      <HeadSEO
        title="Careers | OnSpot Global"
        description="Find your next opportunity with OnSpot Global. Browse our open positions and join our growing team of professionals."
      />
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
        <div className="max-w-5xl mx-auto px-4 py-12">
          <header className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Find Your Next Opportunity
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Join our global team of talented professionals. We offer remote-first positions with competitive benefits and growth opportunities.
            </p>
          </header>

          <div className="bg-card rounded-xl shadow-sm border p-4 md:p-6 mb-10">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search jobs by title, keyword..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="w-full md:w-48">
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="customer-support">Customer Support</SelectItem>
                    <SelectItem value="sales">Sales</SelectItem>
                    <SelectItem value="technology">Technology</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="operations">Operations</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full md:w-auto">
                <Search className="h-4 w-4 mr-2" />
                Search Jobs
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Open Positions</h2>
              <span className="text-sm text-muted-foreground">1 job found</span>
            </div>

            <Card
              className={`cursor-pointer transition-all duration-300 ease-in-out hover:shadow-md ${
                isExpanded ? "ring-2 ring-primary/20" : ""
              }`}
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Briefcase className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold mb-2">{jobData.title}</h3>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {jobData.location}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {jobData.type}
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4" />
                            {jobData.salary}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">{jobData.department}</Badge>
                    <div className="p-2 rounded-full bg-muted">
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>

                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    isExpanded ? "max-h-[2000px] opacity-100 mt-6" : "max-h-0 opacity-0"
                  }`}
                >
                  <div className="border-t pt-6 space-y-6" onClick={(e) => e.stopPropagation()}>
                    <div>
                      <h4 className="text-lg font-semibold mb-3">Job Description</h4>
                      <p className="text-muted-foreground leading-relaxed">
                        {jobData.description}
                      </p>
                    </div>

                    <div>
                      <h4 className="text-lg font-semibold mb-3">Responsibilities</h4>
                      <ul className="space-y-2">
                        {jobData.responsibilities.map((item, index) => (
                          <li key={index} className="flex items-start gap-2 text-muted-foreground">
                            <CheckCircle className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="text-lg font-semibold mb-3">Skills Needed</h4>
                      <div className="flex flex-wrap gap-2">
                        {jobData.skills.map((skill, index) => (
                          <Badge key={index} variant="outline" className="py-1.5">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <GraduationCap className="h-5 w-5 text-primary" />
                      <span className="font-medium">Experience Level:</span>
                      <span className="text-muted-foreground">{jobData.experienceLevel}</span>
                    </div>

                    <div>
                      <h4 className="text-lg font-semibold mb-3">Benefits</h4>
                      <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {jobData.benefits.map((benefit, index) => (
                          <li key={index} className="flex items-center gap-2 text-muted-foreground">
                            <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                            <span>{benefit}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="pt-4 border-t">
                      <Button size="lg" className="w-full md:w-auto">
                        Apply Now
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-16 text-center">
            <p className="text-muted-foreground mb-4">
              Don't see a position that fits? We're always looking for talented individuals.
            </p>
            <Button variant="outline">
              Submit General Application
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
