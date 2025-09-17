import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Shield, 
  CheckCircle2, 
  Users, 
  Lock,
  Eye,
  AlertTriangle,
  Phone,
  Mail,
  FileText,
  Award,
  Star,
  Clock,
  CreditCard,
  Globe,
  Search,
  ArrowRight,
  Verified,
  Building2,
  Heart,
  Zap
} from "lucide-react";
import { TrustBadge, ClientVerificationBadge } from "@/components/TrustBadges";
import { PaymentProtectionBadge } from "@/components/PaymentProtectionBadge";
import { SecurityBadge, TrustCertification } from "@/components/SecurityBadges";
import { Link } from "wouter";

export default function TrustSafety() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-blue-50 via-green-50 to-purple-50 dark:from-blue-950/20 dark:via-green-950/20 dark:to-purple-950/20 border-b py-16">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex items-center justify-center gap-2 mb-6">
              <Shield className="h-10 w-10 text-primary" />
              <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 via-green-600 to-purple-600 bg-clip-text text-transparent">
                Trust & Safety at OnSpot
              </h1>
            </div>
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              Your safety, security, and success are our top priorities. 
              Discover how OnSpot protects every interaction, secures every payment, 
              and ensures quality in every project.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
              <TrustBadge variant="verified" size="lg" />
              <TrustBadge variant="payment-protected" size="lg" />
              <TrustBadge variant="security" size="lg" />
              <SecurityBadge type="ssl" size="lg" />
            </div>
            <div className="text-center">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto">
                <div>
                  <div className="text-3xl font-bold text-primary mb-2">99.9%</div>
                  <div className="text-sm text-muted-foreground">Platform Security Uptime</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">100%</div>
                  <div className="text-sm text-muted-foreground">Payment Protection Rate</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">24/7</div>
                  <div className="text-sm text-muted-foreground">Security Monitoring</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-12">
        <div className="max-w-6xl mx-auto">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
              <TabsTrigger value="verification">Verification</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="support">Support</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="space-y-12 mt-8">
              {/* Trust Pillars */}
              <section>
                <h2 className="text-3xl font-bold mb-8 text-center">Our Trust Pillars</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card className="text-center hover-elevate group">
                    <CardHeader>
                      <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                        <Shield className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                      </div>
                      <CardTitle className="text-blue-700 dark:text-blue-300">Payment Protection</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Every transaction is secured with military-grade escrow protection
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="text-center hover-elevate group">
                    <CardHeader>
                      <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                        <Verified className="h-8 w-8 text-green-600 dark:text-green-400" />
                      </div>
                      <CardTitle className="text-green-700 dark:text-green-300">Client Verification</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Every client is thoroughly verified before they can post projects
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="text-center hover-elevate group">
                    <CardHeader>
                      <div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                        <Lock className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                      </div>
                      <CardTitle className="text-purple-700 dark:text-purple-300">Data Security</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Bank-grade encryption and compliance with global security standards
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="text-center hover-elevate group">
                    <CardHeader>
                      <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                        <Users className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                      </div>
                      <CardTitle className="text-orange-700 dark:text-orange-300">24/7 Support</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Round-the-clock human support for any issues or concerns
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </section>

              {/* Key Features */}
              <section>
                <h2 className="text-3xl font-bold mb-8 text-center">How We Keep You Safe</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <Card className="hover-elevate">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        For Talents
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <div className="font-medium">Guaranteed Payments</div>
                            <div className="text-sm text-muted-foreground">
                              Every job comes with payment protection through secure escrow
                            </div>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <div className="font-medium">Verified Clients Only</div>
                            <div className="text-sm text-muted-foreground">
                              Work only with identity-verified, legitimate businesses
                            </div>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <div className="font-medium">Dispute Resolution</div>
                            <div className="text-sm text-muted-foreground">
                              Professional mediation for any project disagreements
                            </div>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <div className="font-medium">Privacy Protection</div>
                            <div className="text-sm text-muted-foreground">
                              Your personal information is never shared without consent
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="hover-elevate">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                        For Clients
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <div className="font-medium">Quality Assurance</div>
                            <div className="text-sm text-muted-foreground">
                              All talents are pre-screened for skills and professionalism
                            </div>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <div className="font-medium">Milestone Protection</div>
                            <div className="text-sm text-muted-foreground">
                              Pay only for completed work that meets your standards
                            </div>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <div className="font-medium">IP Protection</div>
                            <div className="text-sm text-muted-foreground">
                              Confidential work is protected by NDAs and secure systems
                            </div>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <div className="font-medium">Refund Guarantee</div>
                            <div className="text-sm text-muted-foreground">
                              100% refund if work doesn't meet agreed specifications
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </section>

              {/* Trust Statistics */}
              <section>
                <h2 className="text-3xl font-bold mb-8 text-center">Trust Statistics</h2>
                
                <Card className="border-2 border-primary/20 bg-primary/5 dark:bg-primary/10">
                  <CardContent className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 text-center">
                      <div>
                        <div className="text-4xl font-bold text-green-600 dark:text-green-400 mb-2">
                          $2.5M+
                        </div>
                        <div className="font-semibold text-green-700 dark:text-green-300 mb-2">
                          Protected Payments
                        </div>
                        <div className="text-sm text-green-600/80 dark:text-green-400/80">
                          Successfully processed through secure escrow
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                          98.7%
                        </div>
                        <div className="font-semibold text-blue-700 dark:text-blue-300 mb-2">
                          Client Satisfaction
                        </div>
                        <div className="text-sm text-blue-600/80 dark:text-blue-400/80">
                          Based on project completion surveys
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-4xl font-bold text-purple-600 dark:text-purple-400 mb-2">
                          0.1%
                        </div>
                        <div className="font-semibold text-purple-700 dark:text-purple-300 mb-2">
                          Dispute Rate
                        </div>
                        <div className="text-sm text-purple-600/80 dark:text-purple-400/80">
                          Most projects complete without issues
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-4xl font-bold text-orange-600 dark:text-orange-400 mb-2">
                          &lt;24h
                        </div>
                        <div className="font-semibold text-orange-700 dark:text-orange-300 mb-2">
                          Support Response
                        </div>
                        <div className="text-sm text-orange-600/80 dark:text-orange-400/80">
                          Average response time to urgent issues
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </section>
            </TabsContent>

            <TabsContent value="payments" className="space-y-8 mt-8">
              <PaymentProtectionBadge variant="detailed" amount={15000} showDetails={true} />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="hover-elevate">
                  <CardHeader>
                    <CardTitle>Payment Process</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                          <span className="text-xs font-semibold text-primary">1</span>
                        </div>
                        <div>
                          <div className="font-medium">Secure Escrow</div>
                          <div className="text-sm text-muted-foreground">
                            Client funds are immediately secured in encrypted escrow when contract is signed
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                          <span className="text-xs font-semibold text-primary">2</span>
                        </div>
                        <div>
                          <div className="font-medium">Work Protection</div>
                          <div className="text-sm text-muted-foreground">
                            Talent can work confidently knowing payment is guaranteed upon completion
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                          <span className="text-xs font-semibold text-primary">3</span>
                        </div>
                        <div>
                          <div className="font-medium">Instant Release</div>
                          <div className="text-sm text-muted-foreground">
                            Funds are released instantly upon client approval or auto-released after 7 days
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="hover-elevate">
                  <CardHeader>
                    <CardTitle>Payment Methods</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        <div>
                          <div className="font-medium">Credit/Debit Cards</div>
                          <div className="text-sm text-muted-foreground">Visa, Mastercard, American Express</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Building2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                        <div>
                          <div className="font-medium">Bank Transfers</div>
                          <div className="text-sm text-muted-foreground">Direct bank transfers and ACH</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Globe className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        <div>
                          <div className="font-medium">Digital Wallets</div>
                          <div className="text-sm text-muted-foreground">PayPal, Stripe, and other secure options</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Award className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                        <div>
                          <div className="font-medium">Cryptocurrency</div>
                          <div className="text-sm text-muted-foreground">Bitcoin, Ethereum, and major stablecoins</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="verification" className="space-y-8 mt-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="hover-elevate border-2 border-green-200 dark:border-green-500/30">
                  <CardHeader className="text-center">
                    <ClientVerificationBadge verificationLevel="basic" />
                    <CardTitle className="text-green-700 dark:text-green-300">Identity Verified</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <span>Government ID verification</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <span>Phone & email verification</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <span>Payment method confirmed</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="hover-elevate border-2 border-blue-200 dark:border-blue-500/30">
                  <CardHeader className="text-center">
                    <ClientVerificationBadge verificationLevel="business" />
                    <CardTitle className="text-blue-700 dark:text-blue-300">Business Verified</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <span>Business registration verified</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <span>Domain ownership confirmed</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <span>Financial verification completed</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="hover-elevate border-2 border-purple-200 dark:border-purple-500/30">
                  <CardHeader className="text-center">
                    <ClientVerificationBadge verificationLevel="enterprise" />
                    <CardTitle className="text-purple-700 dark:text-purple-300">Enterprise Verified</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <span>Executive team verification</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <span>Financial statement review</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <span>Reference and compliance check</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="text-center">
                <Button asChild>
                  <Link href="/client-verification">
                    Learn More About Verification
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="security" className="space-y-8 mt-8">
              <TrustCertification />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="hover-elevate">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lock className="h-5 w-5 text-green-600 dark:text-green-400" />
                      Data Protection
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="font-medium">End-to-End Encryption</div>
                          <div className="text-sm text-muted-foreground">
                            All data is encrypted in transit and at rest using AES-256 encryption
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="font-medium">GDPR Compliance</div>
                          <div className="text-sm text-muted-foreground">
                            Full compliance with European data protection regulations
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="font-medium">Regular Security Audits</div>
                          <div className="text-sm text-muted-foreground">
                            Third-party security audits conducted quarterly
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="hover-elevate">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      Platform Monitoring
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="font-medium">24/7 System Monitoring</div>
                          <div className="text-sm text-muted-foreground">
                            Continuous monitoring for security threats and system issues
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="font-medium">Fraud Detection</div>
                          <div className="text-sm text-muted-foreground">
                            AI-powered fraud detection systems prevent malicious activity
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="font-medium">Incident Response</div>
                          <div className="text-sm text-muted-foreground">
                            Rapid response team available for any security incidents
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="support" className="space-y-8 mt-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card className="text-center hover-elevate">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Phone className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="font-semibold mb-2">24/7 Live Support</div>
                    <div className="text-sm text-muted-foreground mb-4">
                      Human support agents available around the clock for urgent issues
                    </div>
                    <Button variant="outline" size="sm">
                      Contact Support
                    </Button>
                  </CardContent>
                </Card>

                <Card className="text-center hover-elevate">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertTriangle className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="font-semibold mb-2">Dispute Resolution</div>
                    <div className="text-sm text-muted-foreground mb-4">
                      Professional mediation services for project disagreements
                    </div>
                    <Button variant="outline" size="sm">
                      File Dispute
                    </Button>
                  </CardContent>
                </Card>

                <Card className="text-center hover-elevate">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="font-semibold mb-2">Help Center</div>
                    <div className="text-sm text-muted-foreground mb-4">
                      Comprehensive guides and FAQs for common questions
                    </div>
                    <Button variant="outline" size="sm">
                      Browse Help
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <Card className="hover-elevate">
                <CardHeader>
                  <CardTitle>Emergency Contact Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium mb-3">For Urgent Payment Issues</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          <span>+1 (555) 123-SPOT</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <span>urgent@onspot.com</span>
                        </div>
                        <div className="text-muted-foreground">
                          Available 24/7 for payment and security emergencies
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-3">For General Support</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          <span>support@onspot.com</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <span>Response within 4 hours</span>
                        </div>
                        <div className="text-muted-foreground">
                          For project questions, technical issues, and general inquiries
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Call to Action */}
          <section className="text-center mt-12">
            <Card className="border-2 border-primary/20 bg-primary/5 dark:bg-primary/10">
              <CardContent className="p-8">
                <div className="flex items-center justify-center gap-2 mb-6">
                  <Shield className="h-8 w-8 text-primary" />
                  <Heart className="h-6 w-6 text-red-500" />
                  <Zap className="h-6 w-6 text-yellow-500" />
                </div>
                <h2 className="text-2xl font-bold mb-4">Ready to Join the Safest Marketplace?</h2>
                <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                  Experience the peace of mind that comes with world-class security, 
                  verified clients, and guaranteed payments. Your success is our priority.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Button size="lg" asChild data-testid="button-get-started">
                    <Link href="/get-hired">
                      <Users className="w-5 h-5 mr-2" />
                      Start as Talent
                    </Link>
                  </Button>
                  <Button variant="outline" size="lg" asChild data-testid="button-hire-talent">
                    <Link href="/hire-talent">
                      <Search className="w-5 h-5 mr-2" />
                      Hire Talent
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