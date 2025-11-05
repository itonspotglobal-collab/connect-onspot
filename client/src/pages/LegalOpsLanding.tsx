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
  Mail,
  Sparkles,
  DollarSign
} from "lucide-react";
import { HeadSEO } from "@/components/HeadSEO";
import nycSkylineImage from "@assets/stock_images/new_york_city_skylin_7e596624.jpg";

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

        {/* Hero Section - Stunning NYC Design */}
        <section className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-900 via-violet-950 to-blue-950">
          {/* Animated gradient orbs - Homepage style */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-gradient-radial from-violet-500/30 to-transparent rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-1/3 right-1/4 w-[500px] h-[500px] bg-gradient-radial from-blue-500/20 to-transparent rounded-full blur-3xl" style={{ animation: 'float 20s ease-in-out infinite' }}></div>
          </div>

          {/* NYC Skyline Image - Beautifully Blended */}
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-violet-950/70 to-blue-950/80 z-10"></div>
            <img 
              src={nycSkylineImage} 
              alt="New York City Skyline" 
              className="w-full h-full object-cover opacity-40"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent z-10"></div>
          </div>

          <div className="container mx-auto px-4 sm:px-6 relative z-20 pt-20 pb-16 sm:pt-32 sm:pb-24">
            {/* OnSpot Logo - Glassmorphic */}
            <div className="mb-12 hero-fade-up">
              <div className="inline-flex items-center gap-2.5 bg-white/5 backdrop-blur-xl px-5 py-2.5 rounded-full border border-white/20 shadow-2xl">
                <div className="w-8 h-8 bg-gradient-to-br from-violet-600 to-blue-600 rounded-full flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-white" />
                </div>
                <span className="font-bold text-lg text-white">
                  OnSpot
                </span>
                <span className="text-sm text-white/70 px-2 border-l border-white/20">
                  LegalOps NY
                </span>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              {/* Left: Headline & Value Prop */}
              <div className="space-y-10 hero-fade-up">
                <div className="space-y-6">
                  {/* Ultra-minimal Badge */}
                  <div className="inline-flex items-center gap-2.5 text-sm font-medium text-white/90 tracking-wide bg-white/5 backdrop-blur-xl px-5 py-2.5 rounded-full border border-white/20">
                    <div className="w-2 h-2 bg-white/60 rounded-full"></div>
                    Tri-State NY Landlord-Tenant Law Firms
                  </div>
                  
                  {/* Main Headline - Homepage Style */}
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold leading-[1.1] text-white tracking-tight" data-testid="text-hero-headline">
                    Cut Legal Admin Costs by 70%
                  </h1>
                  
                  {/* Subheadline */}
                  <p className="text-xl sm:text-2xl lg:text-3xl text-white/70 font-light tracking-wide" data-testid="text-hero-subhead">
                    Zero Escalations. Full Control.
                  </p>
                  
                  <p className="text-base sm:text-lg text-white/60 leading-relaxed max-w-2xl font-light">
                    New York landlord–tenant firms: Our specialized LegalOps team manages your Rent Demands, Petitions, and Section 8 compliance with precision — delivering 70% cost savings and zero escalations within 90 days.
                  </p>
                </div>

                {/* Trust Badges - Glassmorphic Style */}
                <div className="flex flex-wrap gap-4 hero-fade-up-delay">
                  <div className="flex items-center gap-3 bg-white/5 backdrop-blur-xl px-5 py-3.5 rounded-2xl border border-white/20 shadow-2xl group hover:bg-white/10 transition-all duration-300">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-500/30 to-emerald-500/30 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <TrendingDown className="h-5 w-5 text-green-300" />
                    </div>
                    <div>
                      <div className="text-xs text-white/50 font-medium">Cost Reduction</div>
                      <div className="text-base font-bold text-white">70% Savings</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-white/5 backdrop-blur-xl px-5 py-3.5 rounded-2xl border border-white/20 shadow-2xl group hover:bg-white/10 transition-all duration-300">
                    <div className="w-10 h-10 bg-gradient-to-br from-violet-500/30 to-purple-500/30 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <CheckCircle2 className="h-5 w-5 text-violet-300" />
                    </div>
                    <div>
                      <div className="text-xs text-white/50 font-medium">Escalations</div>
                      <div className="text-base font-bold text-white">Zero</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-white/5 backdrop-blur-xl px-5 py-3.5 rounded-2xl border border-white/20 shadow-2xl group hover:bg-white/10 transition-all duration-300">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500/30 to-cyan-500/30 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <Clock className="h-5 w-5 text-blue-300" />
                    </div>
                    <div>
                      <div className="text-xs text-white/50 font-medium">Stabilization</div>
                      <div className="text-base font-bold text-white">&lt;90 Days</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Checkout Form - Glassmorphic */}
              <div id="checkout-section" className="lg:sticky lg:top-8 hero-fade-up-delay">
                <div className="relative overflow-hidden bg-white/10 backdrop-blur-2xl border border-white/30 rounded-3xl shadow-2xl">
                  {/* Glow effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-blue-500/10 blur-2xl rounded-3xl"></div>
                  
                  <div className="relative">
                    <div className="border-b border-white/20 p-6 sm:p-8">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <h2 className="text-2xl sm:text-3xl font-bold text-white" data-testid="text-checkout-title">
                          Start Your 90-Day Trial
                        </h2>
                        <Badge className="bg-gradient-to-r from-red-500 to-orange-500 text-white border-0 shadow-lg animate-pulse shrink-0" data-testid="badge-scarcity">
                          Only 5 Slots
                        </Badge>
                      </div>
                      <p className="text-sm text-white/70 leading-relaxed" data-testid="text-checkout-description">
                        Secure card capture • Zero charge during trial • Cancel anytime
                      </p>
                    </div>
                    <div className="p-6 sm:p-8 space-y-5">
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
                          className="relative group w-full bg-gradient-to-r from-violet-600 to-blue-600 text-white font-semibold hover:shadow-[0_0_30px_rgba(139,92,246,0.6)] transition-all duration-300 rounded-2xl min-h-12 text-base"
                          size="lg"
                          disabled={!formData.fullName || !formData.firmName || !formData.email}
                          data-testid="button-continue-to-payment"
                        >
                          <span className="flex items-center gap-2 justify-center">
                            Continue to Secure Payment
                            <Sparkles className="w-4 h-4" />
                          </span>
                          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-violet-600 to-blue-600 opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-300 -z-10"></div>
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
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Zero Escalation Guarantee Section */}
        <section className="py-16 sm:py-20 bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute top-0 left-0 w-full h-full">
            <div className="absolute top-20 left-10 w-72 h-72 bg-amber-200/20 dark:bg-amber-500/5 rounded-full blur-3xl"></div>
            <div className="absolute bottom-20 right-10 w-96 h-96 bg-yellow-200/20 dark:bg-yellow-500/5 rounded-full blur-3xl"></div>
          </div>

          <div className="container mx-auto px-4 sm:px-6 relative z-10">
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-12">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-3xl mb-6 shadow-2xl">
                  <Shield className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-3xl sm:text-5xl font-bold mb-4" data-testid="text-guarantee-title">
                  Zero Escalation Guarantee
                </h2>
                <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                  We're so confident in our system that if you don't achieve operational stability within 90 days, we'll continue working at no additional charge until you reach zero escalations.
                </p>
              </div>

              <Card className="shadow-2xl border-2 border-amber-200 dark:border-amber-800">
                <CardContent className="p-8 sm:p-12">
                  <div className="grid sm:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-amber-500/20 rounded-xl flex items-center justify-center flex-shrink-0 mt-1">
                          <CheckCircle2 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg mb-1">90-Day Stability Target</h3>
                          <p className="text-sm text-muted-foreground">We aim to achieve zero escalations within your first 90 days</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-amber-500/20 rounded-xl flex items-center justify-center flex-shrink-0 mt-1">
                          <CheckCircle2 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg mb-1">No Extra Charges</h3>
                          <p className="text-sm text-muted-foreground">If it takes longer, we work for free until you're stable</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-amber-500/20 rounded-xl flex items-center justify-center flex-shrink-0 mt-1">
                          <CheckCircle2 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg mb-1">Performance Tracking</h3>
                          <p className="text-sm text-muted-foreground">Daily metrics and weekly reviews ensure we stay on target</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-amber-500/20 rounded-xl flex items-center justify-center flex-shrink-0 mt-1">
                          <CheckCircle2 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg mb-1">Full Transparency</h3>
                          <p className="text-sm text-muted-foreground">Complete visibility into our progress every step of the way</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* New York Law Firm Success Section */}
        <section className="py-16 sm:py-20 bg-white dark:bg-slate-900">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-12">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-violet-600 to-blue-600 rounded-3xl mb-6 shadow-2xl">
                  <Building2 className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-3xl sm:text-5xl font-bold mb-4" data-testid="text-success-title">
                  New York Law Firm Success Story
                </h2>
                <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                  Manhattan landlord-tenant practice rebuilds entire legal ops infrastructure under crisis conditions
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                <Card className="shadow-lg hover-elevate">
                  <CardContent className="p-8">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-12 h-12 bg-green-500/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg mb-1">Infrastructure Rebuild</h3>
                        <p className="text-sm text-muted-foreground">Complete rebuild of legal ops infrastructure under crisis conditions</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-lg hover-elevate">
                  <CardContent className="p-8">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg mb-1">118-Day Stabilization</h3>
                        <p className="text-sm text-muted-foreground">Achieved full operational stability in under 4 months</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-lg hover-elevate">
                  <CardContent className="p-8">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-12 h-12 bg-violet-500/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <TrendingDown className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg mb-1">Zero Escalations</h3>
                        <p className="text-sm text-muted-foreground">Maintained for 12+ consecutive months after stabilization</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-lg hover-elevate">
                  <CardContent className="p-8">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <DollarSign className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg mb-1">72% Cost Reduction</h3>
                        <p className="text-sm text-muted-foreground">Sustained reduction in operational costs year over year</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section - Two-Tier Hormozi Stack */}
        <section className="py-16 sm:py-24 bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
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
