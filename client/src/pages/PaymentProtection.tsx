import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Shield, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  AlertTriangle,
  Lock,
  CreditCard,
  FileText,
  Users,
  ArrowRight,
  Star,
  Award,
  Zap,
  Eye,
  Phone
} from "lucide-react";
import { PaymentProtectionBadge, EscrowStatus } from "@/components/PaymentProtectionBadge";
import { TrustBadge } from "@/components/TrustBadges";
import { SecurityBadge } from "@/components/SecurityBadges";
import { Link } from "wouter";

export default function PaymentProtection() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="bg-blue-50/50 dark:bg-blue-950/20 border-b border-blue-200 dark:border-blue-500/30 py-16">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex items-center justify-center gap-2 mb-6">
              <Shield className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <h1 className="text-4xl font-bold text-blue-700 dark:text-blue-300">
                Payment Protection Guarantee
              </h1>
            </div>
            <p className="text-xl text-blue-600/80 dark:text-blue-400/80 mb-8">
              Your payments are secured with military-grade escrow protection. 
              Work with confidence knowing every transaction is guaranteed.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <TrustBadge variant="payment-protected" size="lg" />
              <TrustBadge variant="verified" size="lg" />
              <SecurityBadge type="ssl" size="lg" />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-12">
        <div className="max-w-6xl mx-auto space-y-12">
          {/* How It Works */}
          <section>
            <h2 className="text-3xl font-bold mb-8 text-center">How Payment Protection Works</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <Card className="text-center hover-elevate">
                <CardHeader>
                  <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Lock className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <CardTitle className="text-blue-700 dark:text-blue-300">1. Funds Secured</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    When you hire talent, payment is immediately secured in our encrypted escrow system. 
                    Funds are protected until work is completed to your satisfaction.
                  </p>
                </CardContent>
              </Card>

              <Card className="text-center hover-elevate">
                <CardHeader>
                  <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                  <CardTitle className="text-green-700 dark:text-green-300">2. Work Delivered</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Talent completes your project according to agreed specifications. 
                    You review and approve the deliverables before any payment is released.
                  </p>
                </CardContent>
              </Card>

              <Card className="text-center hover-elevate">
                <CardHeader>
                  <div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Zap className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                  </div>
                  <CardTitle className="text-purple-700 dark:text-purple-300">3. Instant Release</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Upon approval, funds are instantly released to talent. 
                    If no action is taken, payments automatically release after 7 days.
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Payment Protection Features */}
          <section>
            <h2 className="text-3xl font-bold mb-8 text-center">Comprehensive Protection Features</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="hover-elevate">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    Escrow Protection
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Funds Held Securely</div>
                        <div className="text-sm text-muted-foreground">
                          Your payment is secured in encrypted escrow until project completion
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Milestone-Based Releases</div>
                        <div className="text-sm text-muted-foreground">
                          Release payments as work milestones are completed and approved
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Automatic Release</div>
                        <div className="text-sm text-muted-foreground">
                          Funds automatically release after 7 days if no disputes are raised
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover-elevate">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    Dispute Resolution
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Professional Mediation</div>
                        <div className="text-sm text-muted-foreground">
                          Expert mediators resolve disputes fairly within 48 hours
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Evidence-Based Decisions</div>
                        <div className="text-sm text-muted-foreground">
                          All decisions based on project requirements and deliverables
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Full Refund Protection</div>
                        <div className="text-sm text-muted-foreground">
                          100% refund guarantee if work doesn't meet agreed standards
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover-elevate">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    Secure Payments
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Multiple Payment Methods</div>
                        <div className="text-sm text-muted-foreground">
                          Credit cards, bank transfers, and digital payment options
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">PCI DSS Compliant</div>
                        <div className="text-sm text-muted-foreground">
                          Bank-grade security for all payment processing
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Fraud Protection</div>
                        <div className="text-sm text-muted-foreground">
                          Advanced fraud detection and prevention systems
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover-elevate">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                    Full Transparency
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Real-Time Status</div>
                        <div className="text-sm text-muted-foreground">
                          Track escrow status and payment progress in real-time
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Detailed Transaction History</div>
                        <div className="text-sm text-muted-foreground">
                          Complete audit trail of all payments and releases
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Instant Notifications</div>
                        <div className="text-sm text-muted-foreground">
                          Email and dashboard alerts for all payment activities
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Service Level Agreements */}
          <section>
            <h2 className="text-3xl font-bold mb-8 text-center">Our Service Level Guarantees</h2>
            
            <Card className="border-2 border-green-200 dark:border-green-500/30 bg-green-50/30 dark:bg-green-950/10">
              <CardContent className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                  <div>
                    <div className="text-4xl font-bold text-green-600 dark:text-green-400 mb-2">
                      48h
                    </div>
                    <div className="font-semibold text-green-700 dark:text-green-300 mb-2">
                      Dispute Resolution
                    </div>
                    <div className="text-sm text-green-600/80 dark:text-green-400/80">
                      All payment disputes resolved within 48 hours or we release funds to talent
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                      7d
                    </div>
                    <div className="font-semibold text-blue-700 dark:text-blue-300 mb-2">
                      Auto-Release
                    </div>
                    <div className="text-sm text-blue-600/80 dark:text-blue-400/80">
                      Funds automatically released to talent after 7 days if no disputes raised
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-4xl font-bold text-purple-600 dark:text-purple-400 mb-2">
                      100%
                    </div>
                    <div className="font-semibold text-purple-700 dark:text-purple-300 mb-2">
                      Refund Guarantee
                    </div>
                    <div className="text-sm text-purple-600/80 dark:text-purple-400/80">
                      Full refund if work doesn't meet agreed specifications after mediation
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Payment Process Timeline */}
          <section>
            <h2 className="text-3xl font-bold mb-8 text-center">Payment Process Timeline</h2>
            
            <Card className="hover-elevate">
              <CardContent className="p-8">
                <div className="space-y-8">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-semibold">
                      1
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold mb-2">Contract Signed & Payment Secured</div>
                      <div className="text-sm text-muted-foreground mb-2">
                        Client creates contract and funds are immediately secured in escrow. Talent can begin work with confidence.
                      </div>
                      <div className="text-xs text-blue-600 dark:text-blue-400">
                        ⏱️ Instant - Funds secured within minutes of contract signing
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-semibold">
                      2
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold mb-2">Work Completed & Delivered</div>
                      <div className="text-sm text-muted-foreground mb-2">
                        Talent completes work according to specifications and delivers through OnSpot platform.
                      </div>
                      <div className="text-xs text-green-600 dark:text-green-400">
                        ⏱️ Project Timeline - Based on agreed delivery schedule
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-semibold">
                      3
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold mb-2">Client Review Period</div>
                      <div className="text-sm text-muted-foreground mb-2">
                        Client has 7 days to review deliverables and either approve payment or raise concerns.
                      </div>
                      <div className="text-xs text-orange-600 dark:text-orange-400">
                        ⏱️ 7 Days - Client review and approval window
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center font-semibold">
                      4
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold mb-2">Payment Released</div>
                      <div className="text-sm text-muted-foreground mb-2">
                        Upon approval or after 7-day auto-release window, funds are instantly transferred to talent.
                      </div>
                      <div className="text-xs text-purple-600 dark:text-purple-400">
                        ⏱️ Instant - Immediate transfer upon approval
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Security Certifications */}
          <section>
            <h2 className="text-3xl font-bold mb-8 text-center">Security & Compliance</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="text-center hover-elevate">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Shield className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="font-semibold mb-2">256-bit SSL</div>
                  <div className="text-sm text-muted-foreground">
                    Military-grade encryption for all data transmission
                  </div>
                </CardContent>
              </Card>

              <Card className="text-center hover-elevate">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CreditCard className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="font-semibold mb-2">PCI DSS</div>
                  <div className="text-sm text-muted-foreground">
                    Payment card industry compliance for secure processing
                  </div>
                </CardContent>
              </Card>

              <Card className="text-center hover-elevate">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Award className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="font-semibold mb-2">SOC 2</div>
                  <div className="text-sm text-muted-foreground">
                    Audited security and availability controls
                  </div>
                </CardContent>
              </Card>

              <Card className="text-center hover-elevate">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-teal-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Eye className="h-6 w-6 text-teal-600 dark:text-teal-400" />
                  </div>
                  <div className="font-semibold mb-2">GDPR</div>
                  <div className="text-sm text-muted-foreground">
                    European data protection regulation compliance
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* FAQ */}
          <section>
            <h2 className="text-3xl font-bold mb-8 text-center">Frequently Asked Questions</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="hover-elevate">
                <CardHeader>
                  <CardTitle className="text-lg">What happens if I'm not satisfied with the work?</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    You have 7 days to review all deliverables. If work doesn't meet agreed specifications, 
                    you can request revisions or escalate to our dispute resolution team for mediation and potential full refund.
                  </p>
                </CardContent>
              </Card>

              <Card className="hover-elevate">
                <CardHeader>
                  <CardTitle className="text-lg">How quickly are payments released?</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Payments are released instantly upon your approval. If no action is taken within 7 days 
                    of work completion, funds are automatically released to ensure talent gets paid promptly.
                  </p>
                </CardContent>
              </Card>

              <Card className="hover-elevate">
                <CardHeader>
                  <CardTitle className="text-lg">Are there any fees for payment protection?</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Payment protection is included at no extra cost. Our standard platform fees cover 
                    escrow protection, dispute resolution, and all security measures.
                  </p>
                </CardContent>
              </Card>

              <Card className="hover-elevate">
                <CardHeader>
                  <CardTitle className="text-lg">Can I get a refund if the talent disappears?</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Yes, if talent abandons a project without delivering agreed work, we guarantee a full refund. 
                    Our verification process minimizes this risk, but protection is always in place.
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Call to Action */}
          <section className="text-center">
            <Card className="border-2 border-primary/20 bg-primary/5 dark:bg-primary/10">
              <CardContent className="p-8">
                <Shield className="h-12 w-12 text-primary mx-auto mb-6" />
                <h2 className="text-2xl font-bold mb-4">Ready to Hire with Complete Confidence?</h2>
                <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                  Join thousands of clients who trust OnSpot's payment protection system. 
                  Every project is backed by our comprehensive guarantee.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Button size="lg" asChild data-testid="button-find-talent">
                    <Link href="/hire-talent">
                      <Users className="w-5 h-5 mr-2" />
                      Find Talent Now
                    </Link>
                  </Button>
                  <Button variant="outline" size="lg" asChild data-testid="button-trust-safety">
                    <Link href="/trust-safety">
                      <FileText className="w-5 h-5 mr-2" />
                      Learn More
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