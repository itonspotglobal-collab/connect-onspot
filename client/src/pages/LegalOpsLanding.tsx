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

        {/* Hero Section - NYC Themed */}
        <section className="relative overflow-hidden bg-gradient-to-br from-violet-50 via-blue-50 to-slate-50 dark:from-slate-950 dark:via-violet-950 dark:to-blue-950 pt-20 pb-16 sm:pt-32 sm:pb-24">
          {/* NYC Skyline - Prominent Background */}
          <div className="absolute inset-0 overflow-hidden">
            {/* Gradient Sky */}
            <div className="absolute inset-0 bg-gradient-to-b from-violet-100/40 via-blue-100/30 to-slate-100/20 dark:from-violet-950/40 dark:via-blue-950/30 dark:to-slate-950/20"></div>
            
            {/* NYC Skyline Silhouette */}
            <div className="absolute bottom-0 left-0 right-0 h-64 sm:h-80 opacity-20 dark:opacity-30">
              <svg viewBox="0 0 1200 300" className="w-full h-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="skylineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style={{ stopColor: '#7c3aed', stopOpacity: 0.8 }} />
                    <stop offset="50%" style={{ stopColor: '#3b82f6', stopOpacity: 0.6 }} />
                    <stop offset="100%" style={{ stopColor: '#1e293b', stopOpacity: 0.9 }} />
                  </linearGradient>
                </defs>
                
                {/* Skyline buildings */}
                <rect x="0" y="180" width="80" height="120" fill="url(#skylineGradient)" />
                <rect x="90" y="140" width="60" height="160" fill="url(#skylineGradient)" />
                <rect x="160" y="120" width="70" height="180" fill="url(#skylineGradient)" />
                <rect x="240" y="160" width="50" height="140" fill="url(#skylineGradient)" />
                
                {/* Empire State Building - Taller */}
                <rect x="300" y="60" width="80" height="240" fill="url(#skylineGradient)" />
                <rect x="310" y="50" width="60" height="10" fill="url(#skylineGradient)" opacity="0.8" />
                <rect x="330" y="30" width="20" height="20" fill="url(#skylineGradient)" opacity="0.6" />
                
                <rect x="390" y="150" width="65" height="150" fill="url(#skylineGradient)" />
                <rect x="465" y="130" width="55" height="170" fill="url(#skylineGradient)" />
                
                {/* One World Trade - Distinctive */}
                <polygon points="530,80 530,300 620,300 620,80 575,60" fill="url(#skylineGradient)" opacity="0.9" />
                
                <rect x="630" y="140" width="60" height="160" fill="url(#skylineGradient)" />
                <rect x="700" y="170" width="50" height="130" fill="url(#skylineGradient)" />
                <rect x="760" y="110" width="70" height="190" fill="url(#skylineGradient)" />
                <rect x="840" y="150" width="55" height="150" fill="url(#skylineGradient)" />
                <rect x="905" y="130" width="65" height="170" fill="url(#skylineGradient)" />
                <rect x="980" y="160" width="50" height="140" fill="url(#skylineGradient)" />
                <rect x="1040" y="140" width="60" height="160" fill="url(#skylineGradient)" />
                <rect x="1110" y="170" width="90" height="130" fill="url(#skylineGradient)" />
              </svg>
            </div>
            
            {/* Gradient overlay for depth */}
            <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent"></div>
          </div>

          <div className="container mx-auto px-4 sm:px-6 relative z-10">
            {/* OnSpot Logo */}
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border border-violet-200 dark:border-violet-800">
                <div className="w-8 h-8 bg-gradient-to-br from-violet-600 to-blue-600 rounded-full flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-white" />
                </div>
                <span className="font-bold text-lg bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">
                  OnSpot
                </span>
                <span className="text-sm text-muted-foreground px-2 border-l border-violet-200 dark:border-violet-800">
                  LegalOps NY
                </span>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-start">
              {/* Left: Headline & Value Prop */}
              <div className="space-y-8">
                <div className="space-y-4">
                  <Badge className="bg-gradient-to-r from-violet-600 to-blue-600 text-white border-0 shadow-lg mb-2" data-testid="badge-location">
                    <Building2 className="h-3.5 w-3.5 mr-1.5" />
                    Tri-State NY Landlord-Tenant Law Firms
                  </Badge>
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold leading-[1.1] bg-gradient-to-br from-slate-900 via-violet-900 to-blue-900 dark:from-white dark:via-violet-100 dark:to-blue-100 bg-clip-text text-transparent" data-testid="text-hero-headline">
                    Cut Legal Admin Costs by 70%
                  </h1>
                  <p className="text-xl sm:text-2xl font-semibold text-slate-700 dark:text-slate-300" data-testid="text-hero-subhead">
                    Zero Escalations. Full Control. Guaranteed Stability.
                  </p>
                  <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl">
                    New York landlord–tenant firms: Our specialized LegalOps team manages your Rent Demands, Petitions, and Section 8 compliance with precision — delivering 70% cost savings and zero escalations within 90 days.
                  </p>
                </div>

                {/* Trust Badges */}
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center gap-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm px-4 py-2.5 rounded-lg border border-green-200 dark:border-green-800 shadow-sm">
                    <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                      <TrendingDown className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Cost Reduction</div>
                      <div className="text-sm font-bold text-green-700 dark:text-green-400">70% Savings</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm px-4 py-2.5 rounded-lg border border-violet-200 dark:border-violet-800 shadow-sm">
                    <div className="w-8 h-8 bg-violet-100 dark:bg-violet-900/30 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Escalations</div>
                      <div className="text-sm font-bold text-violet-700 dark:text-violet-400">Zero</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm px-4 py-2.5 rounded-lg border border-blue-200 dark:border-blue-800 shadow-sm">
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                      <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Stabilization</div>
                      <div className="text-sm font-bold text-blue-700 dark:text-blue-400">&lt;90 Days</div>
                    </div>
                  </div>
                </div>

                {/* Guarantee Ribbon */}
                <div className="relative overflow-hidden bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-100 dark:from-amber-950/50 dark:via-yellow-950/50 dark:to-amber-900/50 border-2 border-amber-400/50 dark:border-amber-600/50 rounded-xl p-5 shadow-lg">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 rounded-full blur-3xl"></div>
                  <div className="relative flex items-start gap-4">
                    <div className="w-12 h-12 bg-amber-400 dark:bg-amber-600 rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
                      <Shield className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-lg text-amber-900 dark:text-amber-100 mb-1">
                        Zero Escalation Guarantee
                      </p>
                      <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
                        Achieve operational stability within 90 days or we continue working at no charge until you reach zero escalations.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Social Proof Strip */}
                <Card className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-violet-200 dark:border-violet-800 shadow-xl">
                  <CardHeader className="pb-4">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-violet-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                        <Building2 className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-lg mb-1" data-testid="text-proof-title">
                          New York Law Firm Success Story
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">Manhattan-based landlord-tenant practice</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-start gap-3 text-sm">
                      <div className="w-5 h-5 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                      </div>
                      <span className="text-slate-700 dark:text-slate-300">Rebuilt entire legal ops infrastructure under crisis conditions</span>
                    </div>
                    <div className="flex items-start gap-3 text-sm">
                      <div className="w-5 h-5 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                      </div>
                      <span className="text-slate-700 dark:text-slate-300">Achieved full stability in 118 days (under 4 months)</span>
                    </div>
                    <div className="flex items-start gap-3 text-sm">
                      <div className="w-5 h-5 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                      </div>
                      <span className="text-slate-700 dark:text-slate-300">Maintained zero escalations for 12+ consecutive months</span>
                    </div>
                    <div className="flex items-start gap-3 text-sm">
                      <div className="w-5 h-5 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                      </div>
                      <span className="text-slate-700 dark:text-slate-300">Sustained 72% reduction in operational costs</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right: Checkout Form */}
              <div id="checkout-section" className="lg:sticky lg:top-8">
                <Card className="shadow-2xl border-2 border-violet-200 dark:border-violet-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm">
                  <CardHeader className="border-b border-violet-100 dark:border-violet-900/50 pb-4">
                    <div className="flex items-center justify-between mb-2">
                      <CardTitle className="text-2xl" data-testid="text-checkout-title">Start Your 90-Day Trial</CardTitle>
                      <Badge className="bg-gradient-to-r from-red-600 to-red-500 text-white border-0 shadow-lg animate-pulse" data-testid="badge-scarcity">
                        Only 5 NY Slots Left
                      </Badge>
                    </div>
                    <CardDescription className="text-base" data-testid="text-checkout-description">
                      Secure card capture • Zero charge during trial • Cancel anytime
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
