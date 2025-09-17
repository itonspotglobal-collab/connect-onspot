import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle2, 
  Shield, 
  FileText, 
  Building2,
  CreditCard,
  Phone,
  Mail,
  Globe,
  Users,
  Award,
  Verified,
  Crown,
  Star,
  Clock,
  AlertCircle,
  ArrowRight,
  Eye,
  Lock,
  Search
} from "lucide-react";
import { ClientVerificationBadge, TrustBadge } from "@/components/TrustBadges";
import { Link } from "wouter";

export default function ClientVerification() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="bg-green-50/50 dark:bg-green-950/20 border-b border-green-200 dark:border-green-500/30 py-16">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex items-center justify-center gap-2 mb-6">
              <Verified className="h-8 w-8 text-green-600 dark:text-green-400" />
              <h1 className="text-4xl font-bold text-green-700 dark:text-green-300">
                Client Verification Standards
              </h1>
            </div>
            <p className="text-xl text-green-600/80 dark:text-green-400/80 mb-8">
              We verify every client to ensure you work with legitimate businesses offering real opportunities. 
              Your safety and success are our top priorities.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <ClientVerificationBadge verificationLevel="enterprise" size="lg" />
              <TrustBadge variant="payment-protected" size="lg" />
              <TrustBadge variant="verified" size="lg" />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-12">
        <div className="max-w-6xl mx-auto space-y-12">
          {/* Verification Levels */}
          <section>
            <h2 className="text-3xl font-bold mb-8 text-center">Client Verification Levels</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <Card className="hover-elevate border-2 border-green-200 dark:border-green-500/30">
                <CardHeader className="text-center">
                  <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Verified className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                  <CardTitle className="text-green-700 dark:text-green-300">Identity Verified</CardTitle>
                  <ClientVerificationBadge verificationLevel="basic" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="text-sm">Identity document verification</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="text-sm">Phone number verification</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="text-sm">Email verification</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="text-sm">Payment method verified</span>
                    </div>
                  </div>
                  <div className="pt-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      <strong>Best for:</strong> Individual clients and small projects
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover-elevate border-2 border-blue-200 dark:border-blue-500/30">
                <CardHeader className="text-center">
                  <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Building2 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <CardTitle className="text-blue-700 dark:text-blue-300">Business Verified</CardTitle>
                  <ClientVerificationBadge verificationLevel="business" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="text-sm">All Identity Verified requirements</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="text-sm">Business registration documents</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="text-sm">Domain ownership verification</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="text-sm">Business address confirmation</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="text-sm">Financial verification</span>
                    </div>
                  </div>
                  <div className="pt-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      <strong>Best for:</strong> SMBs and established companies
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover-elevate border-2 border-purple-200 dark:border-purple-500/30">
                <CardHeader className="text-center">
                  <div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Crown className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                  </div>
                  <CardTitle className="text-purple-700 dark:text-purple-300">Enterprise Verified</CardTitle>
                  <ClientVerificationBadge verificationLevel="enterprise" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="text-sm">All Business Verified requirements</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="text-sm">Executive team verification</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="text-sm">Financial statements review</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="text-sm">Reference verification</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="text-sm">Compliance and legal review</span>
                    </div>
                  </div>
                  <div className="pt-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      <strong>Best for:</strong> Large enterprises and Fortune 500 companies
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Verification Process */}
          <section>
            <h2 className="text-3xl font-bold mb-8 text-center">How Client Verification Works</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="hover-elevate">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    Document Verification
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Identity Documents</div>
                        <div className="text-sm text-muted-foreground">
                          Government-issued ID verification using advanced document scanning
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Business Registration</div>
                        <div className="text-sm text-muted-foreground">
                          Verification of legal business entity registration and tax IDs
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Financial Verification</div>
                        <div className="text-sm text-muted-foreground">
                          Bank account or credit card verification to ensure payment capability
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover-elevate">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5 text-green-600 dark:text-green-400" />
                    Contact Verification
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Phone Verification</div>
                        <div className="text-sm text-muted-foreground">
                          SMS and voice verification to confirm phone number ownership
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Email Authentication</div>
                        <div className="text-sm text-muted-foreground">
                          Domain verification and email authentication protocols
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Business Address</div>
                        <div className="text-sm text-muted-foreground">
                          Physical address verification through multiple data sources
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover-elevate">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    Digital Presence
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Domain Ownership</div>
                        <div className="text-sm text-muted-foreground">
                          Verification of company domain ownership and website authenticity
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Social Media Profiles</div>
                        <div className="text-sm text-muted-foreground">
                          Cross-verification of official social media presence
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Public Records</div>
                        <div className="text-sm text-muted-foreground">
                          Validation against public business registries and databases
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover-elevate">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    Human Review
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Manual Review</div>
                        <div className="text-sm text-muted-foreground">
                          Expert verification team reviews all documentation manually
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Video Calls</div>
                        <div className="text-sm text-muted-foreground">
                          Enterprise clients undergo video verification calls with executives
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Reference Checks</div>
                        <div className="text-sm text-muted-foreground">
                          Professional and business references verified for enterprise clients
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Verification Timeline */}
          <section>
            <h2 className="text-3xl font-bold mb-8 text-center">Verification Timeline</h2>
            
            <Card className="hover-elevate">
              <CardContent className="p-8">
                <div className="space-y-8">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-semibold">
                      1
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold mb-2">Document Submission</div>
                      <div className="text-sm text-muted-foreground mb-2">
                        Client submits required documentation through secure upload portal.
                      </div>
                      <div className="text-xs text-blue-600 dark:text-blue-400">
                        ⏱️ 5-10 minutes - Document upload and submission
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-semibold">
                      2
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold mb-2">Automated Verification</div>
                      <div className="text-sm text-muted-foreground mb-2">
                        AI-powered systems verify documents, identities, and contact information.
                      </div>
                      <div className="text-xs text-orange-600 dark:text-orange-400">
                        ⏱️ 15-30 minutes - Automated verification checks
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center font-semibold">
                      3
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold mb-2">Human Review</div>
                      <div className="text-sm text-muted-foreground mb-2">
                        Expert verification team conducts manual review and validation.
                      </div>
                      <div className="text-xs text-purple-600 dark:text-purple-400">
                        ⏱️ 2-24 hours - Manual review by verification experts
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-semibold">
                      4
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold mb-2">Verification Complete</div>
                      <div className="text-sm text-muted-foreground mb-2">
                        Client receives verification badge and can begin posting projects immediately.
                      </div>
                      <div className="text-xs text-green-600 dark:text-green-400">
                        ⏱️ Instant - Badge issued and account activated
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 p-4 bg-muted/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <div className="font-medium">Typical Verification Times</div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="font-medium text-green-600 dark:text-green-400">Identity Verified</div>
                      <div className="text-muted-foreground">2-4 hours average</div>
                    </div>
                    <div>
                      <div className="font-medium text-blue-600 dark:text-blue-400">Business Verified</div>
                      <div className="text-muted-foreground">4-24 hours average</div>
                    </div>
                    <div>
                      <div className="font-medium text-purple-600 dark:text-purple-400">Enterprise Verified</div>
                      <div className="text-muted-foreground">1-3 business days</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Trust Indicators */}
          <section>
            <h2 className="text-3xl font-bold mb-8 text-center">What Talents Can Expect</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="text-center hover-elevate">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Shield className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="font-semibold mb-2">Legitimate Businesses</div>
                  <div className="text-sm text-muted-foreground">
                    Every client is verified to ensure you're working with real businesses
                  </div>
                </CardContent>
              </Card>

              <Card className="text-center hover-elevate">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CreditCard className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="font-semibold mb-2">Guaranteed Payments</div>
                  <div className="text-sm text-muted-foreground">
                    All verified clients have confirmed payment methods and budget
                  </div>
                </CardContent>
              </Card>

              <Card className="text-center hover-elevate">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Star className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="font-semibold mb-2">Quality Projects</div>
                  <div className="text-sm text-muted-foreground">
                    Verified clients post serious projects with clear requirements
                  </div>
                </CardContent>
              </Card>

              <Card className="text-center hover-elevate">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Eye className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div className="font-semibold mb-2">Full Transparency</div>
                  <div className="text-sm text-muted-foreground">
                    See verification status and company details before applying
                  </div>
                </CardContent>
              </Card>

              <Card className="text-center hover-elevate">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-teal-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Lock className="h-6 w-6 text-teal-600 dark:text-teal-400" />
                  </div>
                  <div className="font-semibold mb-2">Secure Communication</div>
                  <div className="text-sm text-muted-foreground">
                    All client communications verified and monitored for safety
                  </div>
                </CardContent>
              </Card>

              <Card className="text-center hover-elevate">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="font-semibold mb-2">Scam Protection</div>
                  <div className="text-sm text-muted-foreground">
                    Advanced fraud detection prevents scam projects and fake clients
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Statistics */}
          <section>
            <h2 className="text-3xl font-bold mb-8 text-center">Verification Success Statistics</h2>
            
            <Card className="border-2 border-primary/20 bg-primary/5 dark:bg-primary/10">
              <CardContent className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
                  <div>
                    <div className="text-4xl font-bold text-green-600 dark:text-green-400 mb-2">
                      99.8%
                    </div>
                    <div className="font-semibold text-green-700 dark:text-green-300 mb-2">
                      Verification Accuracy
                    </div>
                    <div className="text-sm text-green-600/80 dark:text-green-400/80">
                      AI + human review ensures maximum accuracy
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                      &lt;4h
                    </div>
                    <div className="font-semibold text-blue-700 dark:text-blue-300 mb-2">
                      Average Processing
                    </div>
                    <div className="text-sm text-blue-600/80 dark:text-blue-400/80">
                      Most verifications completed within hours
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-4xl font-bold text-purple-600 dark:text-purple-400 mb-2">
                      95%
                    </div>
                    <div className="font-semibold text-purple-700 dark:text-purple-300 mb-2">
                      First-Time Success
                    </div>
                    <div className="text-sm text-purple-600/80 dark:text-purple-400/80">
                      Most clients verified on first submission
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-4xl font-bold text-orange-600 dark:text-orange-400 mb-2">
                      0
                    </div>
                    <div className="font-semibold text-orange-700 dark:text-orange-300 mb-2">
                      Verified Client Scams
                    </div>
                    <div className="text-sm text-orange-600/80 dark:text-orange-400/80">
                      Zero reported scams from verified clients
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Call to Action */}
          <section className="text-center">
            <Card className="border-2 border-primary/20 bg-primary/5 dark:bg-primary/10">
              <CardContent className="p-8">
                <Verified className="h-12 w-12 text-primary mx-auto mb-6" />
                <h2 className="text-2xl font-bold mb-4">Ready to Work with Verified Clients?</h2>
                <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                  Join thousands of talents who trust OnSpot's verification system. 
                  Every project comes from a legitimate, verified business.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Button size="lg" asChild data-testid="button-find-work">
                    <Link href="/find-work">
                      <Search className="w-5 h-5 mr-2" />
                      Browse Verified Jobs
                    </Link>
                  </Button>
                  <Button variant="outline" size="lg" asChild data-testid="button-get-hired">
                    <Link href="/get-hired">
                      <Users className="w-5 h-5 mr-2" />
                      Join as Talent
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}