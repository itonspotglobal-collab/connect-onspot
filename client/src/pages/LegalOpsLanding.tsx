import { useState, useEffect } from "react";
import { useStripe, useElements, PaymentElement, Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Building2, 
  CheckCircle2, 
  Shield, 
  TrendingDown, 
  Clock, 
  Users, 
  Award,
  ChevronRight,
  Star,
  BarChart3,
  Zap,
  Phone,
  Mail
} from "lucide-react";
import { HeadSEO } from "@/components/HeadSEO";

if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  console.warn("Missing VITE_STRIPE_PUBLIC_KEY - Stripe checkout will not work");
}
const stripePromise = import.meta.env.VITE_STRIPE_PUBLIC_KEY 
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY)
  : null;

type CheckoutFormProps = {
  selectedTier: "launch" | "executive";
  onSuccess: () => void;
};

function CheckoutForm({ selectedTier, onSuccess }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutProgress, setCheckoutProgress] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setCheckoutProgress(33);

    try {
      setCheckoutProgress(66);
      
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/legal-ops/success`,
        },
      });

      setCheckoutProgress(100);

      if (error) {
        toast({
          title: "Payment Setup Failed",
          description: error.message,
          variant: "destructive",
        });
        setCheckoutProgress(0);
      } else {
        toast({
          title: "Card Captured Successfully",
          description: "Your 90-day LegalOps trial is confirmed!",
        });
        onSuccess();
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
      setCheckoutProgress(0);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="form-checkout">
      {isProcessing && checkoutProgress > 0 && (
        <div className="space-y-2">
          <Progress value={checkoutProgress} className="h-2" />
          <p className="text-sm text-muted-foreground text-center">
            {checkoutProgress < 50 && "Preparing secure checkout..."}
            {checkoutProgress >= 50 && checkoutProgress < 100 && "Processing card..."}
            {checkoutProgress === 100 && "Almost done!"}
          </p>
        </div>
      )}
      
      <PaymentElement />
      
      <div className="pt-2 space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Shield className="h-4 w-4 text-green-600" />
          <span>Card capture only. No charge until trial ends.</span>
        </div>
        
        <Button
          type="submit"
          disabled={!stripe || isProcessing}
          className="w-full min-h-10"
          size="lg"
          data-testid="button-submit-payment"
        >
          {isProcessing ? "Processing..." : "Start My 90-Day Trial →"}
        </Button>
        
        <p className="text-xs text-center text-muted-foreground">
          No hidden fees. Cancel anytime before deployment.
        </p>
      </div>
    </form>
  );
}

type CheckoutWrapperProps = {
  selectedTier: "launch" | "executive";
  fullName: string;
  firmName: string;
  email: string;
  phone: string;
};

function CheckoutWrapper({ selectedTier, fullName, firmName, email, phone }: CheckoutWrapperProps) {
  const [clientSecret, setClientSecret] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const tierPrices = {
    launch: 495000, // $4,950 in cents
    executive: 750000, // $7,500 in cents
  };

  useEffect(() => {
    async function createPaymentIntent() {
      try {
        const res = await apiRequest("POST", "/api/legal-ops/create-trial", {
          fullName,
          firmName,
          email,
          phone,
          tier: selectedTier,
          amount: tierPrices[selectedTier],
        });
        const data = await res.json();
        setClientSecret(data.clientSecret);
      } catch (error) {
        toast({
          title: "Setup Error",
          description: "Unable to initialize checkout. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    }

    createPaymentIntent();
  }, [selectedTier, fullName, firmName, email, phone, toast]);

  if (isLoading || !clientSecret) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading" />
      </div>
    );
  }

  if (!stripePromise) {
    return (
      <div className="text-center py-8 text-destructive">
        <p>Stripe is not configured. Please contact support.</p>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <CheckoutForm selectedTier={selectedTier} onSuccess={() => {}} />
    </Elements>
  );
}

export default function LegalOpsLanding() {
  const [selectedTier, setSelectedTier] = useState<"launch" | "executive">("launch");
  const [showCheckout, setShowCheckout] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    firmName: "",
    email: "",
    phone: "",
  });

  const handleStartTrial = () => {
    if (!formData.fullName || !formData.firmName || !formData.email) {
      return;
    }
    setShowCheckout(true);
  };

  const scrollToCheckout = () => {
    document.getElementById("checkout-section")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      <HeadSEO
        title="LegalOps for NY Landlord-Tenant Firms - Cut Costs 70%"
        description="Cut legal admin costs by 70% for NY landlord-tenant firms. Zero escalations. Full control. 90-day trial with guaranteed stability."
      />
      
      <div className="min-h-screen bg-background">
        {/* Sticky CTA Footer */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-r from-violet-600 to-blue-600 text-white py-3 px-4 shadow-2xl">
          <div className="container mx-auto flex items-center justify-between gap-4">
            <p className="text-sm sm:text-base font-semibold">
              Ready to replace your legal admin chaos with guaranteed stability?
            </p>
            <Button
              onClick={scrollToCheckout}
              variant="outline"
              className="bg-white text-violet-600 border-white hover:bg-white/90 min-h-9"
              data-testid="button-sticky-cta"
            >
              Start My LegalOps Trial →
            </Button>
          </div>
        </div>

        {/* Hero Section - Split Layout */}
        <section className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-blue-950 pt-16 pb-12 sm:pt-24 sm:pb-16">
          {/* NYC Skyline Animation Background */}
          <div className="absolute inset-0 opacity-5 dark:opacity-10">
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-900 to-transparent">
              <div className="flex items-end justify-around h-full animate-pulse">
                <div className="w-8 bg-slate-700 h-20"></div>
                <div className="w-12 bg-slate-700 h-28"></div>
                <div className="w-6 bg-slate-700 h-16"></div>
                <div className="w-10 bg-slate-700 h-24"></div>
                <div className="w-8 bg-slate-700 h-20"></div>
                <div className="w-14 bg-slate-700 h-32"></div>
                <div className="w-8 bg-slate-700 h-18"></div>
              </div>
            </div>
          </div>

          <div className="container mx-auto px-4 sm:px-6 relative z-10">
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
              {/* Left: Headline & Value Prop */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <Badge className="bg-violet-600 text-white hover:bg-violet-700 mb-2" data-testid="badge-location">
                    🗽 Tri-State NY Legal Firms
                  </Badge>
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight" data-testid="text-hero-headline">
                    Cut Legal Admin Costs by 70% — Zero Escalations, Full Control
                  </h1>
                  <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed" data-testid="text-hero-subhead">
                    New York landlord–tenant firms: Our trained LegalOps team manages your Rent Demands, Petitions, and Section 8 compliance — at 70% less cost, with guaranteed accuracy.
                  </p>
                </div>

                {/* Trust Badges */}
                <div className="flex flex-wrap gap-3">
                  <Badge variant="outline" className="gap-1.5 py-1.5 px-3" data-testid="badge-savings">
                    <TrendingDown className="h-4 w-4 text-green-600" />
                    70% Savings
                  </Badge>
                  <Badge variant="outline" className="gap-1.5 py-1.5 px-3" data-testid="badge-escalations">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    0 Escalations
                  </Badge>
                  <Badge variant="outline" className="gap-1.5 py-1.5 px-3" data-testid="badge-timeline">
                    <Clock className="h-4 w-4 text-green-600" />
                    &lt;90 Days
                  </Badge>
                </div>

                {/* Guarantee Ribbon */}
                <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950 dark:to-yellow-950 border-2 border-amber-400 rounded-md p-4">
                  <div className="flex items-start gap-3">
                    <Shield className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-900 dark:text-amber-100">
                        Zero Escalation Guarantee
                      </p>
                      <p className="text-sm text-amber-800 dark:text-amber-200">
                        Stability in 90 days or we work free until stable
                      </p>
                    </div>
                  </div>
                </div>

                {/* Social Proof Strip */}
                <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2" data-testid="text-proof-title">
                      <Building2 className="h-5 w-5 text-violet-600" />
                      New York Law Firm Turnaround
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>Rebuilt entire legal ops under pressure</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>Stabilized within 4 months</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>Achieved 0 escalations</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>Maintained 70% cost savings</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right: Checkout Form */}
              <div id="checkout-section">
                <Card className="shadow-2xl border-2">
                  <CardHeader>
                    <div className="flex items-center justify-between mb-2">
                      <CardTitle data-testid="text-checkout-title">Start Your 90-Day Trial</CardTitle>
                      <Badge className="bg-red-600 text-white animate-pulse" data-testid="badge-scarcity">
                        Only 5 NY Slots Left
                      </Badge>
                    </div>
                    <CardDescription data-testid="text-checkout-description">
                      Card capture first. No charge until trial ends. No hidden fees.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!showCheckout ? (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="fullName">Full Name *</Label>
                          <Input
                            id="fullName"
                            value={formData.fullName}
                            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                            placeholder="John Smith"
                            required
                            data-testid="input-full-name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="firmName">Law Firm Name *</Label>
                          <Input
                            id="firmName"
                            value={formData.firmName}
                            onChange={(e) => setFormData({ ...formData, firmName: e.target.value })}
                            placeholder="Smith & Associates"
                            required
                            data-testid="input-firm-name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">Email *</Label>
                          <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="john@lawfirm.com"
                            required
                            data-testid="input-email"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone">Phone</Label>
                          <Input
                            id="phone"
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="(718) 555-0123"
                            data-testid="input-phone"
                          />
                        </div>
                        <Button
                          onClick={handleStartTrial}
                          className="w-full min-h-10"
                          size="lg"
                          disabled={!formData.fullName || !formData.firmName || !formData.email}
                          data-testid="button-continue-to-payment"
                        >
                          Continue to Secure Payment <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <CheckoutWrapper
                        selectedTier={selectedTier}
                        fullName={formData.fullName}
                        firmName={formData.firmName}
                        email={formData.email}
                        phone={formData.phone}
                      />
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section - Two-Tier Hormozi Stack */}
        <section className="py-16 sm:py-24 bg-white dark:bg-slate-900">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4" data-testid="text-pricing-title">
                Choose Your LegalOps System
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-pricing-subtitle">
                Both options include our Zero Escalation Guarantee and 90-day trial period
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {/* Option A - Launch System (Most Popular) */}
              <Card
                className={`relative ${
                  selectedTier === "launch"
                    ? "border-2 border-violet-600 shadow-2xl scale-105"
                    : "hover-elevate"
                }`}
                onClick={() => setSelectedTier("launch")}
                data-testid="card-tier-launch"
              >
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-violet-600 text-white text-sm px-4 py-1" data-testid="badge-most-popular">
                    ⭐ Most Popular
                  </Badge>
                </div>
                <CardHeader className="pt-8">
                  <CardTitle className="text-2xl" data-testid="text-tier-launch-title">
                    LegalOps Launch System™
                  </CardTitle>
                  <CardDescription data-testid="text-tier-launch-description">
                    Perfect for firms getting started with outsourced legal ops
                  </CardDescription>
                  <div className="pt-4">
                    <div className="text-4xl font-bold" data-testid="text-tier-launch-price">
                      $4,950<span className="text-lg font-normal text-muted-foreground">/FTE/mo</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">3-month minimum</p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Full-time LegalOps Team (1–10+ FTEs)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Pre-built Legal SOP Suite (Rent Demands, Petitions, Section 8)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Delivery Manager for daily oversight</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">LegalOps Dashboard for visibility</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Monthly performance review reports</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Free re-training & replacement coverage</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">24/7 Support coverage</span>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    onClick={scrollToCheckout}
                    className="w-full min-h-10"
                    size="lg"
                    variant={selectedTier === "launch" ? "default" : "outline"}
                    data-testid="button-select-launch"
                  >
                    Select Launch System
                  </Button>
                </CardFooter>
              </Card>

              {/* Option B - Executive Suite (Anchor) */}
              <Card
                className={`relative opacity-90 ${
                  selectedTier === "executive"
                    ? "border-2 border-blue-600 shadow-2xl"
                    : "hover-elevate"
                }`}
                onClick={() => setSelectedTier("executive")}
                data-testid="card-tier-executive"
              >
                <CardHeader>
                  <CardTitle className="text-2xl" data-testid="text-tier-executive-title">
                    Executive LegalOps Suite™
                  </CardTitle>
                  <CardDescription data-testid="text-tier-executive-description">
                    Premium service with dedicated US-based support
                  </CardDescription>
                  <div className="pt-4">
                    <div className="text-4xl font-bold" data-testid="text-tier-executive-price">
                      $7,500<span className="text-lg font-normal text-muted-foreground">/FTE/mo</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">1-year minimum</p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm font-semibold">Everything in Launch System, plus:</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Star className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Dedicated U.S.-based Client Success Partner</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Star className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Priority onboarding (&lt;14 days)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Star className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Weekly operations meeting with firm partners</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Star className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Custom dashboard branding</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Star className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Unlimited team expansion flexibility</span>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    onClick={scrollToCheckout}
                    className="w-full min-h-10"
                    size="lg"
                    variant={selectedTier === "executive" ? "default" : "outline"}
                    data-testid="button-select-executive"
                  >
                    Select Executive Suite
                  </Button>
                </CardFooter>
              </Card>
            </div>

            <div className="text-center mt-8 text-sm text-muted-foreground">
              <p>Both plans equivalent to $12K–$15K/month of in-house legal admin team cost</p>
            </div>
          </div>
        </section>

        {/* Dashboard Preview */}
        <section className="py-16 sm:py-24 bg-slate-50 dark:bg-slate-950">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4" data-testid="text-dashboard-title">
                Full Visibility Into Your Legal Operations
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Track every case, monitor performance, and ensure compliance in real-time
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <Card className="text-center hover-elevate">
                <CardHeader>
                  <BarChart3 className="h-12 w-12 text-violet-600 mx-auto mb-2" />
                  <CardTitle className="text-lg">Live Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Real-time dashboard with case volumes, turnaround times, and accuracy rates
                  </p>
                </CardContent>
              </Card>

              <Card className="text-center hover-elevate">
                <CardHeader>
                  <Users className="h-12 w-12 text-violet-600 mx-auto mb-2" />
                  <CardTitle className="text-lg">Team Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Track individual FTE productivity and quality metrics
                  </p>
                </CardContent>
              </Card>

              <Card className="text-center hover-elevate">
                <CardHeader>
                  <Award className="h-12 w-12 text-violet-600 mx-auto mb-2" />
                  <CardTitle className="text-lg">Compliance Reports</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Automated compliance tracking for Section 8 and NYC regulations
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="py-16 sm:py-24 bg-gradient-to-br from-violet-600 via-blue-600 to-indigo-600 text-white">
          <div className="container mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold mb-6" data-testid="text-final-cta-title">
              Book Your LegalOps Diagnostic
            </h2>
            <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
              Only 5 New York slots available this month. Secure yours now.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                onClick={scrollToCheckout}
                size="lg"
                variant="outline"
                className="bg-white text-violet-600 border-white hover:bg-white/90 min-h-12 px-8"
                data-testid="button-final-cta"
              >
                Start My 90-Day LegalOps Trial →
              </Button>
              <div className="flex items-center gap-4 text-sm">
                <a href="tel:1-718-540-5053" className="flex items-center gap-2 hover:underline">
                  <Phone className="h-4 w-4" />
                  1-718-540-5053
                </a>
                <a href="mailto:hello@onspot.com" className="flex items-center gap-2 hover:underline">
                  <Mail className="h-4 w-4" />
                  hello@onspot.com
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom Spacer for Sticky Footer */}
        <div className="h-16" />
      </div>
    </>
  );
}
