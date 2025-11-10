import { useState, useEffect, useRef } from "react";
import { useStripe, useElements, PaymentElement, Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
  DollarSign,
  Compass,
  Settings,
  Target,
  Rocket,
  AlertTriangle,
  Timer,
  MessageCircle,
  X,
  ArrowUpRight
} from "lucide-react";
import { HeadSEO } from "@/components/HeadSEO";
import nycSkylineImage from "@assets/40431e5288cb44250d8204c03e0ba76129ba76dfd36e01e7c40f546ab05de806_1762346626354.jpeg";
import lawyerImage from "@assets/stock_images/professional_confide_e4371db1.jpg";

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
  const [showPlaybookModal, setShowPlaybookModal] = useState(false);
  const [hasSeenPlaybookModal, setHasSeenPlaybookModal] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    firmName: "",
    email: "",
    phone: "",
  });
  
  const processTimelineRef = useRef<HTMLElement>(null);

  // Intersection Observer to trigger playbook modal when user scrolls past "How OnSpot Works"
  useEffect(() => {
    if (hasSeenPlaybookModal || !processTimelineRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // When the section is leaving the viewport (scrolling down past it)
          if (!entry.isIntersecting && entry.boundingClientRect.top < 0) {
            setShowPlaybookModal(true);
            setHasSeenPlaybookModal(true);
          }
        });
      },
      {
        threshold: 0,
        rootMargin: "-100px 0px 0px 0px", // Trigger when section is 100px from top
      }
    );

    observer.observe(processTimelineRef.current);

    return () => observer.disconnect();
  }, [hasSeenPlaybookModal]);

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

        {/* Hero Section - Legal Command Center at Night */}
        <section className="relative min-h-screen overflow-hidden bg-[#0a0a1a]">
          {/* True Nighttime NYC Skyline - Empire State Building Focal Point */}
          <div className="absolute inset-0">
            <img 
              src={nycSkylineImage} 
              alt="New York City Skyline at Night with Empire State Building" 
              className="w-full h-full object-cover object-center"
            />
            {/* Subtle gradient overlay for text contrast without losing skyline details */}
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.7) 100%)' }}></div>
          </div>

          <div className="container mx-auto px-4 sm:px-6 relative z-20 pt-20 pb-16 sm:pt-24 sm:pb-24">
            {/* OnSpot Logo - Enhanced Contrast */}
            <div className="mb-10 hero-fade-up">
              <div className="inline-flex items-center gap-2.5 backdrop-blur-2xl bg-white/15 px-5 py-2.5 rounded-full border border-white/40 shadow-2xl">
                <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-blue-500 rounded-full flex items-center justify-center shadow-lg">
                  <Building2 className="h-4 w-4 text-white" />
                </div>
                <span className="font-bold text-lg text-white drop-shadow-lg">
                  OnSpot
                </span>
                <span className="text-sm text-violet-100 px-2 border-l border-white/30">
                  LegalOps NY
                </span>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              {/* Left: Headline & Value Prop */}
              <div className="hero-fade-up">
                <div className="space-y-3.5 mb-5">
                  {/* Ultra-minimal Badge */}
                  <div className="inline-flex items-center gap-2.5 text-sm font-medium text-white backdrop-blur-2xl bg-white/10 px-5 py-2.5 rounded-full border border-white/30 shadow-xl">
                    <div className="w-2 h-2 bg-violet-400 rounded-full animate-pulse"></div>
                    Tri-State NY Landlord-Tenant Law Firms
                  </div>
                  
                  {/* Main Headline - Pure White */}
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold leading-[1.1] text-[#FFFFFF] tracking-tight drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)]" data-testid="text-hero-headline">
                    Cut Legal Admin Costs by 70%
                  </h1>
                  
                  {/* Subheadline - Soft Blue-Gray */}
                  <p className="text-xl sm:text-2xl lg:text-3xl text-[#C8D1F0] font-light tracking-wide drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)]" data-testid="text-hero-subhead">
                    Zero Escalations. Full Control.
                  </p>
                  
                  {/* Body - Muted Silver */}
                  <p className="text-base sm:text-lg text-[#D0D4E6] leading-relaxed max-w-2xl font-light drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)] pt-2">
                    New York landlord–tenant firms: Our specialized LegalOps team manages your Rent Demands, Petitions, and Section 8 compliance with precision — delivering 70% cost savings and zero escalations within 90 days.
                  </p>
                </div>

                {/* Metric Boxes - Equal Width, Horizontal Row */}
                <div className="grid grid-cols-3 gap-6 hero-fade-up-delay">
                  <div className="flex flex-col items-center gap-3 backdrop-blur-2xl bg-[#1D2E66] px-4 py-5 rounded-2xl border border-white/30 shadow-2xl group hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] transition-all duration-300">
                    <div className="w-11 h-11 bg-gradient-to-br from-emerald-400 to-green-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                      <TrendingDown className="h-6 w-6 text-white" />
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-[#B9C3E0] font-semibold uppercase tracking-wider">Cost Reduction</div>
                      <div className="text-lg font-extrabold bg-gradient-to-r from-emerald-300 to-green-300 bg-clip-text text-transparent drop-shadow-[0_2px_8px_rgba(16,185,129,0.6)]">70% Savings</div>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-3 backdrop-blur-2xl bg-[#1D2E66] px-4 py-5 rounded-2xl border border-white/30 shadow-2xl group hover:shadow-[0_0_30px_rgba(139,92,246,0.4)] transition-all duration-300">
                    <div className="w-11 h-11 bg-gradient-to-br from-violet-400 to-purple-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                      <CheckCircle2 className="h-6 w-6 text-white" />
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-[#B9C3E0] font-semibold uppercase tracking-wider">Escalations</div>
                      <div className="text-lg font-extrabold bg-gradient-to-r from-violet-300 to-purple-300 bg-clip-text text-transparent drop-shadow-[0_2px_8px_rgba(139,92,246,0.6)]">Zero</div>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-3 backdrop-blur-2xl bg-[#1D2E66] px-4 py-5 rounded-2xl border border-white/30 shadow-2xl group hover:shadow-[0_0_30px_rgba(34,211,238,0.4)] transition-all duration-300">
                    <div className="w-11 h-11 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                      <Clock className="h-6 w-6 text-white" />
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-[#B9C3E0] font-semibold uppercase tracking-wider">Stabilization</div>
                      <div className="text-lg font-extrabold bg-gradient-to-r from-cyan-300 to-blue-300 bg-clip-text text-transparent drop-shadow-[0_2px_8px_rgba(34,211,238,0.6)]">&lt;90 Days</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Checkout Form - Command Center Panel with Skyline Light Reflections */}
              <div id="checkout-section" className="lg:sticky lg:top-8 hero-fade-up-delay">
                <div className="relative overflow-hidden bg-white/15 backdrop-blur-3xl border border-white/40 rounded-3xl shadow-2xl">
                  {/* Skyline light reflections */}
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-violet-500/15 to-blue-500/10 blur-2xl rounded-3xl" style={{ animation: 'lightReflection 6s ease-in-out infinite' }}></div>
                  <div className="absolute top-0 left-0 w-full h-1/3 bg-gradient-to-b from-cyan-400/10 to-transparent blur-xl"></div>
                  <div className="absolute bottom-0 right-0 w-2/3 h-1/2 bg-gradient-to-tl from-amber-400/10 to-transparent blur-xl"></div>
                  
                  <div className="relative">
                    <div className="border-b border-white/30 p-6 sm:p-8">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <h2 className="text-2xl sm:text-3xl font-bold text-white drop-shadow-lg" data-testid="text-checkout-title">
                          Start Your 90-Day Trial
                        </h2>
                        <Badge className="bg-gradient-to-r from-red-500 to-orange-500 text-white border-0 shadow-[0_0_20px_rgba(239,68,68,0.6)] animate-pulse shrink-0" data-testid="badge-scarcity">
                          Only 5 Slots
                        </Badge>
                      </div>
                      <p className="text-sm text-violet-100 leading-relaxed drop-shadow-md" data-testid="text-checkout-description">
                        Secure card capture • Zero charge during trial • Cancel anytime
                      </p>
                    </div>
                    <div className="p-6 sm:p-8 space-y-5">
                    {!showCheckout ? (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="fullName" className="text-white font-semibold">Full Name *</Label>
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
                          <Label htmlFor="firmName" className="text-white font-semibold">Law Firm Name *</Label>
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
                          <Label htmlFor="email" className="text-white font-semibold">Email *</Label>
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
                          <Label htmlFor="phone" className="text-white font-semibold">Phone</Label>
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
                    Resourced Services
                  </CardTitle>
                  <CardDescription data-testid="text-tier-launch-description">
                    You manage directly — OnSpot provides pre-vetted talent
                  </CardDescription>
                  <div className="pt-4">
                    <div className="text-4xl font-bold" data-testid="text-tier-launch-price">
                      $1,950<span className="text-lg font-normal text-muted-foreground">/FTE/mo</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">Month-to-month, flexible terms</p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Highly engaged, pre-vetted professionals</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Ready-to-start within days</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Instant replacement — no downtime</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Included dashboards & KPI templates</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Benefits, taxes, & equipment covered</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Add or reduce FTEs instantly</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Star className="h-5 w-5 text-violet-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm font-semibold">One-click upgrade to Managed Services anytime</span>
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
                    Select Resourced Services
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
                    Managed Services (Full Oversight)
                  </CardTitle>
                  <CardDescription data-testid="text-tier-executive-description">
                    OnSpot manages everything — daily operations, QA, coaching, and reporting
                  </CardDescription>
                  <div className="pt-4">
                    <div className="text-4xl font-bold" data-testid="text-tier-executive-price">
                      $4,950<span className="text-lg font-normal text-muted-foreground">/FTE/mo</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">3-month minimum commitment</p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm font-semibold">Everything in Resourced Services, plus:</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Star className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Delivery Manager for daily oversight</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Star className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Pre-built Legal SOP Suite (Rent Demands, Petitions, Section 8)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Star className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Weekly/monthly performance reports & dashboards</span>
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
                    Select Managed Services
                  </Button>
                </CardFooter>
              </Card>
            </div>

            <div className="text-center mt-8 text-sm text-muted-foreground">
              <p>Resourced Services: 70% less than local NY paralegal ($6,650/mo). Managed Services: complete oversight included.</p>
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

        {/* The Dream Outcome - Two-Column Modern Design */}
        <section className="relative overflow-hidden hero-investor">
          {/* Elegant overlay for depth */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/30"></div>
          
          {/* Subtle animated accents */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-gradient-radial from-white/5 to-transparent rounded-full blur-3xl animate-gentle-float"></div>
          </div>
          
          <div className="container mx-auto px-4 sm:px-6 relative z-10">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 xl:gap-20 items-center min-h-[600px] py-16 sm:py-20 lg:py-24">
              {/* Left Column - Content */}
              <div className="space-y-8 lg:space-y-10">
                {/* Section Title */}
                <div className="space-y-4">
                  <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight" data-testid="text-dream-outcome-title">
                    The Dream Outcome
                  </h2>
                  <p className="text-lg sm:text-xl text-white/70 font-light">
                    What every law firm wants — and what OnSpot delivers.
                  </p>
                </div>

                {/* Key Points */}
                <div className="space-y-6">
                  <div className="flex items-start gap-4 group">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center mt-1">
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-xl sm:text-2xl text-white font-medium leading-relaxed">
                        Every rent demand filed on time
                      </p>
                      <p className="text-white/60 text-sm sm:text-base mt-1">
                        No delays. No follow-ups. Just precision execution.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 group">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center mt-1">
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-xl sm:text-2xl text-white font-medium leading-relaxed">
                        Every petition error-free
                      </p>
                      <p className="text-white/60 text-sm sm:text-base mt-1">
                        Flawless documentation that stands up in court.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 group">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center mt-1">
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-xl sm:text-2xl text-white font-medium leading-relaxed">
                        Every client update delivered before they ask
                      </p>
                      <p className="text-white/60 text-sm sm:text-base mt-1">
                        Proactive communication that builds trust.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bottom Promise */}
                <div className="pt-6 space-y-4">
                  <div className="h-px bg-gradient-to-r from-white/20 via-white/40 to-white/20"></div>
                  <p className="text-lg sm:text-xl text-white/80 leading-relaxed">
                    <span className="text-white font-medium">No late nights. No turnover. No escalations.</span>
                    <br />
                    Just a stable, high-performing system running behind your firm.
                  </p>
                  <div className="flex items-center gap-3 flex-wrap text-sm sm:text-base">
                    <Badge variant="outline" className="bg-white/5 border-white/20 text-white backdrop-blur-sm px-3 py-1.5">
                      70% cost savings
                    </Badge>
                    <span className="text-white/40">+</span>
                    <Badge variant="outline" className="bg-white/5 border-white/20 text-white backdrop-blur-sm px-3 py-1.5">
                      100% peace of mind
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Right Column - Lawyer Image */}
              <div className="relative lg:h-full flex items-center justify-center">
                <div className="relative w-full max-w-md lg:max-w-lg">
                  {/* Glow effect behind image */}
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-violet-500/20 rounded-3xl blur-3xl"></div>
                  
                  {/* Image container */}
                  <div className="relative rounded-3xl overflow-hidden border border-white/10 backdrop-blur-sm bg-white/5">
                    <img 
                      src={lawyerImage}
                      alt="Successful lawyer representing excellence with OnSpot LegalOps"
                      className="w-full h-auto object-cover"
                      data-testid="img-lawyer-success"
                    />
                    {/* Subtle overlay gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
                  </div>
                  
                  {/* Floating accent badge */}
                  <div className="absolute -bottom-6 -left-6 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl px-6 py-4 shadow-2xl">
                    <div className="flex items-center gap-3">
                      <Sparkles className="w-6 h-6 text-white" />
                      <div>
                        <p className="text-white font-bold text-lg">OnSpot LegalOps<sup className="text-xs">™</sup></p>
                        <p className="text-white/70 text-sm">Powered success</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Everything Your Firm Can Offload - Service Categories */}
        <section className="py-20 sm:py-32 bg-gradient-to-b from-white to-slate-50/50 relative overflow-hidden">
          {/* Subtle background accents */}
          <div className="absolute top-20 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-0 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl"></div>
          
          <div className="container mx-auto px-4 sm:px-6 relative z-10">
            {/* Section Header */}
            <div className="text-center mb-16 max-w-3xl mx-auto">
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6" style={{ color: '#1E293B' }} data-testid="text-offload-title">
                Everything Your Firm Can Offload to OnSpot LegalOps<sup className="text-2xl">™</sup>
              </h2>
              <p className="text-xl sm:text-2xl font-light" style={{ color: '#64748B' }}>
                One team. Every function. Fully managed.
              </p>
            </div>

            {/* Service Categories Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 max-w-7xl mx-auto">
              {/* Category 1: Client Communication */}
              <div className="group bg-white rounded-3xl border border-slate-200/60 p-8 hover-elevate active-elevate-2 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10" data-testid="card-client-communication">
                <div className="mb-6">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300" style={{ background: 'linear-gradient(135deg, #4353FF 0%, #5B7CFF 100%)' }}>
                    <MessageCircle className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3" style={{ color: '#1E293B' }}>
                    Client Communication & Relationship Management
                  </h3>
                  <p className="text-base font-medium mb-4" style={{ color: '#4353FF' }}>
                    Strengthen trust with every interaction.
                  </p>
                </div>
                <ul className="space-y-2.5 mb-6">
                  <li className="flex items-start gap-2 text-sm" style={{ color: '#475569' }}>
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                    <span>Case progress updates and milestone reporting</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm" style={{ color: '#475569' }}>
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                    <span>CRM setup, maintenance, and follow-ups</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm" style={{ color: '#475569' }}>
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                    <span>Internal coordination between attorneys and staff</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm" style={{ color: '#475569' }}>
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                    <span>Call moderation and meeting facilitation</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm" style={{ color: '#475569' }}>
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                    <span>Client consultation scheduling and reminders</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm" style={{ color: '#475569' }}>
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                    <span>Handling inquiries, feedback, and satisfaction tracking</span>
                  </li>
                </ul>
                <div className="pt-4 border-t border-slate-100">
                  <p className="text-sm font-semibold" style={{ color: '#64748B' }}>
                    <span style={{ color: '#4353FF' }}>Outcome:</span> Transparent communication and zero missed follow-ups.
                  </p>
                </div>
              </div>

              {/* Category 2: Digital & Technical Enablement */}
              <div className="group bg-white rounded-3xl border border-slate-200/60 p-8 hover-elevate active-elevate-2 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10" data-testid="card-digital-technical">
                <div className="mb-6">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300" style={{ background: 'linear-gradient(135deg, #4353FF 0%, #5B7CFF 100%)' }}>
                    <Settings className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3" style={{ color: '#1E293B' }}>
                    Digital & Technical Enablement
                  </h3>
                  <p className="text-base font-medium mb-4" style={{ color: '#4353FF' }}>
                    Keep your digital presence and systems running smoothly.
                  </p>
                </div>
                <ul className="space-y-2.5 mb-6">
                  <li className="flex items-start gap-2 text-sm" style={{ color: '#475569' }}>
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                    <span>Website and content updates for practice areas and cases</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm" style={{ color: '#475569' }}>
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                    <span>Professional social media and LinkedIn presence management</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm" style={{ color: '#475569' }}>
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                    <span>Legal tech integration support (Clio, MyCase, HighLevel)</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm" style={{ color: '#475569' }}>
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                    <span>Secure digital file management and naming conventions</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm" style={{ color: '#475569' }}>
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                    <span>Cybersecurity hygiene (access control, password management)</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm" style={{ color: '#475569' }}>
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                    <span>Daily email triage and correspondence handling</span>
                  </li>
                </ul>
                <div className="pt-4 border-t border-slate-100">
                  <p className="text-sm font-semibold" style={{ color: '#64748B' }}>
                    <span style={{ color: '#4353FF' }}>Outcome:</span> A connected, compliant, and secure digital law office.
                  </p>
                </div>
              </div>

              {/* Category 3: Administrative Excellence */}
              <div className="group bg-white rounded-3xl border border-slate-200/60 p-8 hover-elevate active-elevate-2 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10" data-testid="card-administrative">
                <div className="mb-6">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300" style={{ background: 'linear-gradient(135deg, #4353FF 0%, #5B7CFF 100%)' }}>
                    <Award className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3" style={{ color: '#1E293B' }}>
                    Administrative Excellence
                  </h3>
                  <p className="text-base font-medium mb-4" style={{ color: '#4353FF' }}>
                    Focus on law. We handle the details.
                  </p>
                </div>
                <ul className="space-y-2.5 mb-6">
                  <li className="flex items-start gap-2 text-sm" style={{ color: '#475569' }}>
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                    <span>Calendar, document, and inbox organization</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm" style={{ color: '#475569' }}>
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                    <span>Client intake and onboarding automation</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm" style={{ color: '#475569' }}>
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                    <span>Billing, invoicing, and payment tracking</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm" style={{ color: '#475569' }}>
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                    <span>Data entry, database maintenance, and reporting</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm" style={{ color: '#475569' }}>
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                    <span>Travel, meeting, and event coordination</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm" style={{ color: '#475569' }}>
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                    <span>Drafting letters, memos, and correspondence</span>
                  </li>
                </ul>
                <div className="pt-4 border-t border-slate-100">
                  <p className="text-sm font-semibold" style={{ color: '#64748B' }}>
                    <span style={{ color: '#4353FF' }}>Outcome:</span> Predictable operations and full administrative control.
                  </p>
                </div>
              </div>

              {/* Category 4: Research & Documentation Support */}
              <div className="group bg-white rounded-3xl border border-slate-200/60 p-8 hover-elevate active-elevate-2 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10" data-testid="card-research-documentation">
                <div className="mb-6">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300" style={{ background: 'linear-gradient(135deg, #4353FF 0%, #5B7CFF 100%)' }}>
                    <BarChart3 className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3" style={{ color: '#1E293B' }}>
                    Research & Documentation Support
                  </h3>
                  <p className="text-base font-medium mb-4" style={{ color: '#4353FF' }}>
                    Deliver accuracy and insight, faster.
                  </p>
                </div>
                <ul className="space-y-2.5 mb-6">
                  <li className="flex items-start gap-2 text-sm" style={{ color: '#475569' }}>
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                    <span>Legal research and case summarization</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm" style={{ color: '#475569' }}>
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                    <span>Drafting and reviewing legal documents</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm" style={{ color: '#475569' }}>
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                    <span>Proofreading, formatting, and citation verification</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm" style={{ color: '#475569' }}>
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                    <span>Contract and agreement template management</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm" style={{ color: '#475569' }}>
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                    <span>Presentation and motion preparation</span>
                  </li>
                </ul>
                <div className="pt-4 border-t border-slate-100">
                  <p className="text-sm font-semibold" style={{ color: '#64748B' }}>
                    <span style={{ color: '#4353FF' }}>Outcome:</span> Reliable legal documentation — ready when you are.
                  </p>
                </div>
              </div>

              {/* Category 5: Legal Process Support */}
              <div className="group bg-white rounded-3xl border border-slate-200/60 p-8 hover-elevate active-elevate-2 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10" data-testid="card-legal-process">
                <div className="mb-6">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300" style={{ background: 'linear-gradient(135deg, #4353FF 0%, #5B7CFF 100%)' }}>
                    <Shield className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3" style={{ color: '#1E293B' }}>
                    Legal Process Support
                  </h3>
                  <p className="text-base font-medium mb-4" style={{ color: '#4353FF' }}>
                    Keep your cases moving with flawless execution.
                  </p>
                </div>
                <ul className="space-y-2.5 mb-6">
                  <li className="flex items-start gap-2 text-sm" style={{ color: '#475569' }}>
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                    <span>E-filing and court submission coordination</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm" style={{ color: '#475569' }}>
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                    <span>Discovery and evidence management support</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm" style={{ color: '#475569' }}>
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                    <span>Trial and hearing preparation assistance</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm" style={{ color: '#475569' }}>
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                    <span>Meeting and deposition prep</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm" style={{ color: '#475569' }}>
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                    <span>Legal forms and correspondence handling</span>
                  </li>
                </ul>
                <div className="pt-4 border-t border-slate-100">
                  <p className="text-sm font-semibold" style={{ color: '#64748B' }}>
                    <span style={{ color: '#4353FF' }}>Outcome:</span> Fewer errors, faster filings, complete compliance.
                  </p>
                </div>
              </div>

              {/* Category 6: Marketing & Firm Growth */}
              <div className="group bg-white rounded-3xl border border-slate-200/60 p-8 hover-elevate active-elevate-2 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10" data-testid="card-marketing-growth">
                <div className="mb-6">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300" style={{ background: 'linear-gradient(135deg, #4353FF 0%, #5B7CFF 100%)' }}>
                    <Rocket className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3" style={{ color: '#1E293B' }}>
                    Marketing & Firm Growth
                  </h3>
                  <p className="text-base font-medium mb-4" style={{ color: '#4353FF' }}>
                    Grow your firm while we manage your presence.
                  </p>
                </div>
                <ul className="space-y-2.5 mb-6">
                  <li className="flex items-start gap-2 text-sm" style={{ color: '#475569' }}>
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                    <span>Email and newsletter campaigns to past clients</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm" style={{ color: '#475569' }}>
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                    <span>SEO and reputation management for local visibility</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm" style={{ color: '#475569' }}>
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                    <span>Social media content creation and posting</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm" style={{ color: '#475569' }}>
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                    <span>Testimonial and review collection</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm" style={{ color: '#475569' }}>
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                    <span>Pay-per-click and retargeting support</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm" style={{ color: '#475569' }}>
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                    <span>Consistent brand identity across all platforms</span>
                  </li>
                </ul>
                <div className="pt-4 border-t border-slate-100">
                  <p className="text-sm font-semibold" style={{ color: '#64748B' }}>
                    <span style={{ color: '#4353FF' }}>Outcome:</span> A law firm that attracts, converts, and retains clients automatically.
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom CTA */}
            <div className="text-center mt-16">
              <p className="text-lg sm:text-xl font-light mb-6" style={{ color: '#64748B' }}>
                The partner that quietly powers everything behind your success.
              </p>
              <Button 
                size="lg" 
                className="px-8 py-6 text-lg rounded-2xl"
                style={{ background: 'linear-gradient(135deg, #4353FF 0%, #5B7CFF 100%)' }}
                data-testid="button-schedule-consultation"
              >
                Schedule Your LegalOps Consultation
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        </section>

        {/* Everything You Save with OnSpot LegalOps */}
        <section className="py-20 sm:py-32 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #1E3A8A 0%, #3B82F6 50%, #93C5FD 100%)' }}>
          {/* Subtle overlay for depth */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-white/5"></div>
          
          <div className="container mx-auto px-4 sm:px-6 relative z-10">
            {/* Section Header */}
            <div className="text-center mb-16 max-w-3xl mx-auto">
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight" data-testid="text-savings-title">
                Everything You Save with OnSpot LegalOps<sup className="text-2xl">™</sup>
              </h2>
              <p className="text-xl sm:text-2xl text-white/90 font-light">
                Smarter operations. Lighter overhead. Greater freedom.
              </p>
            </div>

            {/* Savings Grid */}
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Saving 1: 70% in Operating Costs */}
              <div className="group bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 lg:p-10 hover-elevate active-elevate-2 transition-all duration-500" data-testid="card-savings-costs">
                <div className="flex flex-col lg:flex-row items-start gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <DollarSign className="w-9 h-9 text-white" strokeWidth={2.5} />
                    </div>
                  </div>
                  <div className="flex-1 space-y-3">
                    <h3 className="text-3xl sm:text-4xl font-bold text-white">
                      70% in Operating Costs
                    </h3>
                    <p className="text-lg text-white/80 leading-relaxed">
                      By replacing high-cost paralegals and admin roles with trained full-time LegalOps professionals, you instantly reduce fixed payroll, benefits, and hiring expenses.
                    </p>
                    <div className="pt-2 flex items-start gap-2">
                      <Sparkles className="w-5 h-5 text-white/90 flex-shrink-0 mt-0.5" />
                      <p className="text-base text-white font-medium">
                        <span className="opacity-90">Outcome:</span> More margin on every case — without cutting quality.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Saving 2: Countless Hours */}
              <div className="group bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 lg:p-10 hover-elevate active-elevate-2 transition-all duration-500" data-testid="card-savings-time">
                <div className="flex flex-col lg:flex-row items-start gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Clock className="w-9 h-9 text-white" strokeWidth={2.5} />
                    </div>
                  </div>
                  <div className="flex-1 space-y-3">
                    <h3 className="text-3xl sm:text-4xl font-bold text-white">
                      Countless Hours of Non-Billable Work
                    </h3>
                    <p className="text-lg text-white/80 leading-relaxed">
                      No more time wasted managing staff, chasing documents, or fixing admin errors.
                    </p>
                    <div className="pt-2 flex items-start gap-2">
                      <Sparkles className="w-5 h-5 text-white/90 flex-shrink-0 mt-0.5" />
                      <p className="text-base text-white font-medium">
                        <span className="opacity-90">Outcome:</span> Attorneys focus on clients and billable work that drives profit.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Saving 3: Stress & Turnover */}
              <div className="group bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 lg:p-10 hover-elevate active-elevate-2 transition-all duration-500" data-testid="card-savings-turnover">
                <div className="flex flex-col lg:flex-row items-start gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Users className="w-9 h-9 text-white" strokeWidth={2.5} />
                    </div>
                  </div>
                  <div className="flex-1 space-y-3">
                    <h3 className="text-3xl sm:text-4xl font-bold text-white">
                      Stress & Turnover Cycles
                    </h3>
                    <p className="text-lg text-white/80 leading-relaxed">
                      Our managed team structure eliminates re-hiring, retraining, and burnout.
                    </p>
                    <div className="pt-2 flex items-start gap-2">
                      <Sparkles className="w-5 h-5 text-white/90 flex-shrink-0 mt-0.5" />
                      <p className="text-base text-white font-medium">
                        <span className="opacity-90">Outcome:</span> Stability and continuity you can depend on.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Saving 4: Training & Technology */}
              <div className="group bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 lg:p-10 hover-elevate active-elevate-2 transition-all duration-500" data-testid="card-savings-training">
                <div className="flex flex-col lg:flex-row items-start gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Settings className="w-9 h-9 text-white" strokeWidth={2.5} />
                    </div>
                  </div>
                  <div className="flex-1 space-y-3">
                    <h3 className="text-3xl sm:text-4xl font-bold text-white">
                      Training & Technology Overhead
                    </h3>
                    <p className="text-lg text-white/80 leading-relaxed">
                      We handle onboarding, tools, SOPs, and continuous improvement — so you don't have to.
                    </p>
                    <div className="pt-2 flex items-start gap-2">
                      <Sparkles className="w-5 h-5 text-white/90 flex-shrink-0 mt-0.5" />
                      <p className="text-base text-white font-medium">
                        <span className="opacity-90">Outcome:</span> Always-ready staff, always-updated systems.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Saving 5: Risk of Escalations */}
              <div className="group bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 lg:p-10 hover-elevate active-elevate-2 transition-all duration-500" data-testid="card-savings-risk">
                <div className="flex flex-col lg:flex-row items-start gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Shield className="w-9 h-9 text-white" strokeWidth={2.5} />
                    </div>
                  </div>
                  <div className="flex-1 space-y-3">
                    <h3 className="text-3xl sm:text-4xl font-bold text-white">
                      Risk of Escalations & Errors
                    </h3>
                    <p className="text-lg text-white/80 leading-relaxed">
                      With the Zero-Escalation Guarantee, your cases stay compliant, accurate, and on time.
                    </p>
                    <div className="pt-2 flex items-start gap-2">
                      <Sparkles className="w-5 h-5 text-white/90 flex-shrink-0 mt-0.5" />
                      <p className="text-base text-white font-medium">
                        <span className="opacity-90">Outcome:</span> Predictable delivery and client confidence.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Saving 6: Lost Growth Opportunities */}
              <div className="group bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 lg:p-10 hover-elevate active-elevate-2 transition-all duration-500" data-testid="card-savings-growth">
                <div className="flex flex-col lg:flex-row items-start gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Rocket className="w-9 h-9 text-white" strokeWidth={2.5} />
                    </div>
                  </div>
                  <div className="flex-1 space-y-3">
                    <h3 className="text-3xl sm:text-4xl font-bold text-white">
                      Lost Growth Opportunities
                    </h3>
                    <p className="text-lg text-white/80 leading-relaxed">
                      Every hour freed from operations goes into strategy, client acquisition, and expansion.
                    </p>
                    <div className="pt-2 flex items-start gap-2">
                      <Sparkles className="w-5 h-5 text-white/90 flex-shrink-0 mt-0.5" />
                      <p className="text-base text-white font-medium">
                        <span className="opacity-90">Outcome:</span> A law firm that scales — not just survives.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom tagline */}
            <div className="text-center mt-16">
              <p className="text-xl sm:text-2xl text-white/95 font-light max-w-3xl mx-auto">
                Power through efficiency. Intelligence through systems.
              </p>
            </div>
          </div>
        </section>

        {/* Local Staff vs. OnSpot LegalOps Comparison */}
        <section className="py-20 sm:py-32 bg-white relative overflow-hidden">
          {/* Subtle background accents */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-50 rounded-full blur-3xl opacity-50"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-violet-50 rounded-full blur-3xl opacity-40"></div>
          
          <div className="container mx-auto px-4 sm:px-6 relative z-10">
            {/* Section Header */}
            <div className="text-center mb-12 max-w-4xl mx-auto">
              <div className="flex items-center justify-center gap-2 mb-6">
                <Building2 className="w-6 h-6" style={{ color: '#4353FF' }} />
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold" style={{ color: '#1E293B' }} data-testid="text-comparison-title">
                  Local Staff vs. OnSpot LegalOps<sup className="text-2xl">™</sup> (Resourced Services)
                </h2>
              </div>
              <p className="text-xl sm:text-2xl font-light" style={{ color: '#64748B' }}>
                Smarter, faster, and 70% more efficient — with an option to upgrade to Fully Managed.
              </p>
              
              {/* Upgrade badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#4353FF]/10 to-violet-500/10 border border-[#4353FF]/20 rounded-full mt-6">
                <ArrowUpRight className="w-4 h-4" style={{ color: '#4353FF' }} />
                <span className="text-sm font-semibold" style={{ color: '#4353FF' }}>
                  Upgrade to Managed Anytime
                </span>
              </div>
            </div>

            {/* Comparison Table */}
            <div className="max-w-6xl mx-auto">
              <div className="bg-white rounded-3xl border-2 border-slate-200 overflow-hidden shadow-xl">
                {/* Table Header */}
                <div className="grid grid-cols-3 gap-4 bg-gradient-to-r from-slate-50 to-slate-100 p-6 border-b-2 border-slate-200">
                  <div className="font-bold text-lg" style={{ color: '#1E293B' }}>Feature</div>
                  <div className="font-bold text-lg text-center" style={{ color: '#1E293B' }}>
                    Local Staff (NY Paralegal)
                  </div>
                  <div className="font-bold text-lg text-center" style={{ color: '#4353FF' }}>
                    OnSpot LegalOps<sup className="text-xs">™</sup> (Resourced Services)
                  </div>
                </div>

                {/* Comparison Rows */}
                <div className="divide-y divide-slate-200">
                  {/* Monthly Cost */}
                  <div className="grid grid-cols-3 gap-4 p-6 hover:bg-slate-50/50 transition-colors duration-200" data-testid="row-monthly-cost">
                    <div className="font-semibold" style={{ color: '#1E293B' }}>Monthly Cost</div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">≈ $6,650 / month</div>
                      <div className="text-sm text-slate-500 italic">(avg. entry paralegal in NYC)</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold" style={{ color: '#4353FF' }}>Starting at $1,950 / month</div>
                      <div className="text-sm font-medium" style={{ color: '#4353FF' }}>(all-in)</div>
                    </div>
                  </div>

                  {/* Eager to Work */}
                  <div className="grid grid-cols-3 gap-4 p-6 hover:bg-slate-50/50 transition-colors duration-200">
                    <div className="font-semibold" style={{ color: '#1E293B' }}>Eager to Work</div>
                    <div className="flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      <span style={{ color: '#64748B' }}>Sometimes motivated</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <div className="flex gap-1">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      </div>
                      <span className="font-medium" style={{ color: '#4353FF' }}>Highly engaged, pre-vetted professionals</span>
                    </div>
                  </div>

                  {/* Hiring Process */}
                  <div className="grid grid-cols-3 gap-4 p-6 hover:bg-slate-50/50 transition-colors duration-200">
                    <div className="font-semibold" style={{ color: '#1E293B' }}>Hiring Process</div>
                    <div className="flex items-center justify-center gap-2">
                      <X className="w-5 h-5 text-red-500 stroke-[3]" />
                      <span style={{ color: '#64748B' }}>Weeks of recruiting & interviews</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      <span className="font-medium" style={{ color: '#4353FF' }}>Ready-to-start within days</span>
                    </div>
                  </div>

                  {/* Replacement Time */}
                  <div className="grid grid-cols-3 gap-4 p-6 hover:bg-slate-50/50 transition-colors duration-200">
                    <div className="font-semibold" style={{ color: '#1E293B' }}>Replacement Time</div>
                    <div className="flex items-center justify-center gap-2">
                      <X className="w-5 h-5 text-red-500 stroke-[3]" />
                      <span style={{ color: '#64748B' }}>Slow, disruptive</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      <span className="font-medium" style={{ color: '#4353FF' }}>Instant swap — no downtime</span>
                    </div>
                  </div>

                  {/* Management Structure */}
                  <div className="grid grid-cols-3 gap-4 p-6 hover:bg-slate-50/50 transition-colors duration-200">
                    <div className="font-semibold" style={{ color: '#1E293B' }}>Management Structure</div>
                    <div className="flex items-center justify-center gap-2">
                      <X className="w-5 h-5 text-red-500 stroke-[3]" />
                      <span style={{ color: '#64748B' }}>Self-managed</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      <span className="font-medium" style={{ color: '#4353FF' }}>You manage directly <span className="text-sm italic text-slate-500">(upgrade to fully managed anytime)</span></span>
                    </div>
                  </div>

                  {/* Performance Tracking */}
                  <div className="grid grid-cols-3 gap-4 p-6 hover:bg-slate-50/50 transition-colors duration-200">
                    <div className="font-semibold" style={{ color: '#1E293B' }}>Performance Tracking</div>
                    <div className="flex items-center justify-center gap-2">
                      <X className="w-5 h-5 text-red-500 stroke-[3]" />
                      <span style={{ color: '#64748B' }}>Manual & inconsistent</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      <span className="font-medium" style={{ color: '#4353FF' }}>Included dashboards & KPI templates</span>
                    </div>
                  </div>

                  {/* Benefits & Taxes */}
                  <div className="grid grid-cols-3 gap-4 p-6 hover:bg-slate-50/50 transition-colors duration-200">
                    <div className="font-semibold" style={{ color: '#1E293B' }}>Benefits & Taxes</div>
                    <div className="flex items-center justify-center gap-2">
                      <X className="w-5 h-5 text-red-500 stroke-[3]" />
                      <span style={{ color: '#64748B' }}>Additional employer expense</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      <span className="font-medium" style={{ color: '#4353FF' }}>Covered by OnSpot</span>
                    </div>
                  </div>

                  {/* Office Equipment */}
                  <div className="grid grid-cols-3 gap-4 p-6 hover:bg-slate-50/50 transition-colors duration-200">
                    <div className="font-semibold" style={{ color: '#1E293B' }}>Office Equipment</div>
                    <div className="flex items-center justify-center gap-2">
                      <X className="w-5 h-5 text-red-500 stroke-[3]" />
                      <span style={{ color: '#64748B' }}>Firm provides hardware/software</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      <span className="font-medium" style={{ color: '#4353FF' }}>Provided & maintained by OnSpot</span>
                    </div>
                  </div>

                  {/* Long-Term Commitment */}
                  <div className="grid grid-cols-3 gap-4 p-6 hover:bg-slate-50/50 transition-colors duration-200">
                    <div className="font-semibold" style={{ color: '#1E293B' }}>Long-Term Commitment</div>
                    <div className="flex items-center justify-center gap-2">
                      <X className="w-5 h-5 text-red-500 stroke-[3]" />
                      <span style={{ color: '#64748B' }}>Fixed employment contracts</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      <span className="font-medium" style={{ color: '#4353FF' }}>Flexible month-to-month terms</span>
                    </div>
                  </div>

                  {/* Scalability */}
                  <div className="grid grid-cols-3 gap-4 p-6 hover:bg-slate-50/50 transition-colors duration-200">
                    <div className="font-semibold" style={{ color: '#1E293B' }}>Scalability</div>
                    <div className="flex items-center justify-center gap-2">
                      <X className="w-5 h-5 text-red-500 stroke-[3]" />
                      <span style={{ color: '#64748B' }}>Limited by budget & space</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      <span className="font-medium" style={{ color: '#4353FF' }}>Add or reduce FTEs instantly</span>
                    </div>
                  </div>

                  {/* Upgrade Option */}
                  <div className="grid grid-cols-3 gap-4 p-6 bg-gradient-to-r from-blue-50/50 to-violet-50/50 border-t-2 border-[#4353FF]/20">
                    <div className="font-semibold" style={{ color: '#1E293B' }}>Upgrade Option</div>
                    <div className="flex items-center justify-center gap-2">
                      <X className="w-5 h-5 text-red-500 stroke-[3]" />
                      <span style={{ color: '#64748B' }}>Not applicable</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      <span className="font-bold" style={{ color: '#4353FF' }}>One-click upgrade to <span className="underline">Managed Services</span> for full oversight</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom CTA */}
              <div className="text-center mt-12">
                <p className="text-lg text-slate-600 mb-6 max-w-2xl mx-auto">
                  Start with Resourced Services — pay only for talent. Upgrade to Managed when you're ready for complete operational support.
                </p>
                <Button 
                  size="lg" 
                  className="px-8 py-6 text-lg rounded-2xl"
                  style={{ background: 'linear-gradient(135deg, #4353FF 0%, #5B7CFF 100%)' }}
                  onClick={scrollToCheckout}
                  data-testid="button-comparison-cta"
                >
                  Start My 90-Day Trial
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* How OnSpot LegalOps Works - Technical Process Timeline */}
        <section ref={processTimelineRef} className="py-16 sm:py-24 bg-gradient-to-br from-[#0A143C] to-[#15245A] text-white relative overflow-hidden">
          {/* Grid pattern overlay for technical feel */}
          <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)', backgroundSize: '50px 50px' }}></div>
          
          {/* Accent lights */}
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-400/30 to-transparent"></div>
          <div className="absolute top-20 right-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"></div>
          
          <div className="container mx-auto px-4 sm:px-6 relative z-10">
            {/* Section Header */}
            <div className="text-center mb-16 max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#4353FF]/20 border border-[#4353FF]/30 rounded-full mb-6">
                <Settings className="w-4 h-4 text-[#4353FF]" />
                <span className="text-sm font-semibold text-[#4353FF] uppercase tracking-wider">The Process</span>
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 text-white" data-testid="text-process-title">
                How OnSpot LegalOps Works
              </h2>
              <p className="text-lg sm:text-xl text-[#C8D1F0] font-light">
                Your law firm's back office — rebuilt for precision, speed, and trust.
              </p>
            </div>

            {/* Timeline Steps with Vertical Connector */}
            <div className="max-w-5xl mx-auto relative">
              {/* Vertical timeline line */}
              <div className="absolute left-8 top-8 bottom-8 w-0.5 bg-gradient-to-b from-blue-500/50 via-cyan-500/50 to-emerald-500/50 hidden md:block"></div>
              
              <div className="space-y-8">
              {/* Step 1: Assess */}
              <div className="flex flex-col md:flex-row items-start gap-6 group">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                    <Compass className="w-8 h-8 text-white" />
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-bold text-[#C8D1F0] opacity-60">STEP 1</div>
                    <div className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent"></div>
                  </div>
                  <h3 className="text-2xl font-bold" style={{ color: '#4353FF' }}>Assess</h3>
                  <p className="text-base text-white/90 leading-relaxed">
                    We start with a LegalOps Diagnostic to map your workflows, uncover bottlenecks, and identify up to 70% in potential savings.
                  </p>
                  <div className="flex items-start gap-2 pt-2">
                    <div className="w-5 h-5 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    </div>
                    <p className="text-sm text-[#C8D1F0]">
                      <span className="font-semibold">Outcome:</span> Clear plan and measurable goals before deployment.
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 2: Build */}
              <div className="flex flex-col md:flex-row items-start gap-6 group">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                    <Settings className="w-8 h-8 text-white" />
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-bold text-[#C8D1F0] opacity-60">STEP 2</div>
                    <div className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent"></div>
                  </div>
                  <h3 className="text-2xl font-bold" style={{ color: '#4353FF' }}>Build</h3>
                  <p className="text-base text-white/90 leading-relaxed">
                    We assemble a dedicated full-time legal ops team trained in Rent Demands, Petitions, and Section 8 cases — powered by our proven SOP framework.
                  </p>
                  <div className="flex items-start gap-2 pt-2">
                    <div className="w-5 h-5 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    </div>
                    <p className="text-sm text-[#C8D1F0]">
                      <span className="font-semibold">Outcome:</span> A ready-to-run back office built for your firm.
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 3: Train */}
              <div className="flex flex-col md:flex-row items-start gap-6 group">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                    <Target className="w-8 h-8 text-white" />
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-bold text-[#C8D1F0] opacity-60">STEP 3</div>
                    <div className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent"></div>
                  </div>
                  <h3 className="text-2xl font-bold" style={{ color: '#4353FF' }}>Train</h3>
                  <p className="text-base text-white/90 leading-relaxed">
                    Your OnSpot team is trained on your tools and case templates, ensuring error-free execution from day one.
                  </p>
                  <div className="flex items-start gap-2 pt-2">
                    <div className="w-5 h-5 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    </div>
                    <p className="text-sm text-[#C8D1F0]">
                      <span className="font-semibold">Outcome:</span> Seamless handoff — zero disruption.
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 4: Manage */}
              <div className="flex flex-col md:flex-row items-start gap-6 group">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                    <BarChart3 className="w-8 h-8 text-white" />
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-bold text-[#C8D1F0] opacity-60">STEP 4</div>
                    <div className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent"></div>
                  </div>
                  <h3 className="text-2xl font-bold" style={{ color: '#4353FF' }}>Manage</h3>
                  <p className="text-base text-white/90 leading-relaxed">
                    A Delivery Manager oversees performance daily, supported by the LegalOps Dashboard for transparent reporting and QA.
                  </p>
                  <div className="flex items-start gap-2 pt-2">
                    <div className="w-5 h-5 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    </div>
                    <p className="text-sm text-[#C8D1F0]">
                      <span className="font-semibold">Outcome:</span> Real-time visibility and complete control.
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 5: Stabilize */}
              <div className="flex flex-col md:flex-row items-start gap-6 group">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                    <Shield className="w-8 h-8 text-white" />
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-bold text-[#C8D1F0] opacity-60">STEP 5</div>
                    <div className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent"></div>
                  </div>
                  <h3 className="text-2xl font-bold" style={{ color: '#4353FF' }}>Stabilize</h3>
                  <p className="text-base text-white/90 leading-relaxed">
                    Our Zero Escalation Guarantee ensures issues are resolved fast and accuracy stays consistent across every case.
                  </p>
                  <div className="flex items-start gap-2 pt-2">
                    <div className="w-5 h-5 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    </div>
                    <p className="text-sm text-[#C8D1F0]">
                      <span className="font-semibold">Outcome:</span> Reliable delivery, regained client confidence.
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 6: Grow */}
              <div className="flex flex-col md:flex-row items-start gap-6 group">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                    <Rocket className="w-8 h-8 text-white" />
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-bold text-[#C8D1F0] opacity-60">STEP 6</div>
                    <div className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent"></div>
                  </div>
                  <h3 className="text-2xl font-bold" style={{ color: '#4353FF' }}>Grow</h3>
                  <p className="text-base text-white/90 leading-relaxed">
                    As your firm scales, your LegalOps team scales with you — adding FTEs or integrating automation tools.
                  </p>
                  <div className="flex items-start gap-2 pt-2">
                    <div className="w-5 h-5 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    </div>
                    <p className="text-sm text-[#C8D1F0]">
                      <span className="font-semibold">Outcome:</span> A long-term partner that grows with your practice.
                    </p>
                  </div>
                </div>
              </div>
              </div>
            </div>

            {/* Tagline */}
            <div className="text-center mt-16">
              <div className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur-xl rounded-full border border-white/20">
                <Sparkles className="w-5 h-5 text-[#4353FF]" />
                <p className="text-base sm:text-lg font-light text-white">
                  From Assessment to Stability — One Seamless LegalOps System.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* What If You Don't Partner With OnSpot - Pain Points */}
        <section className="py-16 sm:py-24 bg-gradient-to-br from-slate-50 via-gray-50 to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
          <div className="container mx-auto px-4 sm:px-6">
            {/* Section Header */}
            <div className="text-center mb-16 max-w-3xl mx-auto">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4" data-testid="text-pain-points-title">
                What If You Don't Partner With OnSpot?
              </h2>
              <p className="text-lg sm:text-xl text-muted-foreground font-light">
                The hidden costs of keeping your LegalOps in-house.
              </p>
            </div>

            {/* Pain Points Grid */}
            <div className="max-w-5xl mx-auto space-y-8">
              {/* Pain Point 1: Rising Overhead */}
              <Card className="hover-elevate">
                <CardContent className="p-6 sm:p-8">
                  <div className="flex flex-col sm:flex-row items-start gap-6">
                    <div className="flex-shrink-0">
                      <div className="w-14 h-14 bg-red-100 dark:bg-red-950/30 rounded-2xl flex items-center justify-center">
                        <DollarSign className="w-7 h-7 text-red-600 dark:text-red-400" />
                      </div>
                    </div>
                    <div className="flex-1 space-y-2">
                      <h3 className="text-xl sm:text-2xl font-bold">Rising Overhead, Shrinking Margins</h3>
                      <p className="text-base text-muted-foreground leading-relaxed">
                        Every in-house paralegal or admin costs $80K–$100K a year — before benefits, turnover, and training.
                      </p>
                      <div className="flex items-start gap-2 pt-2">
                        <div className="w-5 h-5 bg-red-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                          <AlertTriangle className="h-3 w-3 text-red-600 dark:text-red-400" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          <span className="font-semibold">Result:</span> You lose up to 70% of potential profit margin to back-office work.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Pain Point 2: Turnover */}
              <Card className="hover-elevate">
                <CardContent className="p-6 sm:p-8">
                  <div className="flex flex-col sm:flex-row items-start gap-6">
                    <div className="flex-shrink-0">
                      <div className="w-14 h-14 bg-orange-100 dark:bg-orange-950/30 rounded-2xl flex items-center justify-center">
                        <Clock className="w-7 h-7 text-orange-600 dark:text-orange-400" />
                      </div>
                    </div>
                    <div className="flex-1 space-y-2">
                      <h3 className="text-xl sm:text-2xl font-bold">Turnover and Training Burnout</h3>
                      <p className="text-base text-muted-foreground leading-relaxed">
                        When staff leave, knowledge leaves with them. Your firm spends months retraining, re-hiring, and rebuilding trust.
                      </p>
                      <div className="flex items-start gap-2 pt-2">
                        <div className="w-5 h-5 bg-orange-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                          <AlertTriangle className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          <span className="font-semibold">Result:</span> Delayed filings, missed rent demands, and stressed partners.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Pain Point 3: Errors */}
              <Card className="hover-elevate">
                <CardContent className="p-6 sm:p-8">
                  <div className="flex flex-col sm:flex-row items-start gap-6">
                    <div className="flex-shrink-0">
                      <div className="w-14 h-14 bg-amber-100 dark:bg-amber-950/30 rounded-2xl flex items-center justify-center">
                        <AlertTriangle className="w-7 h-7 text-amber-600 dark:text-amber-400" />
                      </div>
                    </div>
                    <div className="flex-1 space-y-2">
                      <h3 className="text-xl sm:text-2xl font-bold">Errors That Cost Clients — and Reputation</h3>
                      <p className="text-base text-muted-foreground leading-relaxed">
                        A single misfiled petition or late Section 8 notice can trigger escalations or compliance penalties.
                      </p>
                      <div className="flex items-start gap-2 pt-2">
                        <div className="w-5 h-5 bg-amber-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                          <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          <span className="font-semibold">Result:</span> Your reputation suffers and client trust erodes.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Pain Point 4: Lost Billable Hours */}
              <Card className="hover-elevate">
                <CardContent className="p-6 sm:p-8">
                  <div className="flex flex-col sm:flex-row items-start gap-6">
                    <div className="flex-shrink-0">
                      <div className="w-14 h-14 bg-rose-100 dark:bg-rose-950/30 rounded-2xl flex items-center justify-center">
                        <Timer className="w-7 h-7 text-rose-600 dark:text-rose-400" />
                      </div>
                    </div>
                    <div className="flex-1 space-y-2">
                      <h3 className="text-xl sm:text-2xl font-bold">Lost Billable Hours</h3>
                      <p className="text-base text-muted-foreground leading-relaxed">
                        Lawyers spend time managing admin chaos instead of billing clients.
                      </p>
                      <div className="flex items-start gap-2 pt-2">
                        <div className="w-5 h-5 bg-rose-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                          <AlertTriangle className="h-3 w-3 text-rose-600 dark:text-rose-400" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          <span className="font-semibold">Result:</span> Thousands of dollars in lost productivity every month.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Pain Point 5: No Scalability */}
              <Card className="hover-elevate">
                <CardContent className="p-6 sm:p-8">
                  <div className="flex flex-col sm:flex-row items-start gap-6">
                    <div className="flex-shrink-0">
                      <div className="w-14 h-14 bg-purple-100 dark:bg-purple-950/30 rounded-2xl flex items-center justify-center">
                        <TrendingDown className="w-7 h-7 text-purple-600 dark:text-purple-400" />
                      </div>
                    </div>
                    <div className="flex-1 space-y-2">
                      <h3 className="text-xl sm:text-2xl font-bold">No Scalability, No Control</h3>
                      <p className="text-base text-muted-foreground leading-relaxed">
                        Without systems, every new client increases workload, not profit.
                      </p>
                      <div className="flex items-start gap-2 pt-2">
                        <div className="w-5 h-5 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                          <AlertTriangle className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          <span className="font-semibold">Result:</span> You grow in stress, not revenue.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Closing Statement */}
            <div className="text-center mt-12 max-w-3xl mx-auto">
              <Card className="bg-gradient-to-br from-violet-50 to-blue-50 dark:from-violet-950/20 dark:to-blue-950/20 border-violet-200 dark:border-violet-800">
                <CardContent className="p-8">
                  <p className="text-lg sm:text-xl font-semibold mb-6">
                    With OnSpot LegalOps<sup className="text-xs">™</sup> you eliminate these risks — transforming chaos into a compliant, cost-efficient, and scalable operation.
                  </p>
                  <Button
                    onClick={scrollToCheckout}
                    size="lg"
                    className="min-h-12 px-8 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700"
                    data-testid="button-pain-points-cta"
                  >
                    Protect Your Firm — Book Your Free LegalOps Diagnostic →
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-20 sm:py-32 bg-gradient-to-br from-slate-50 via-white to-blue-50/30 relative overflow-hidden">
          {/* Subtle decorative elements */}
          <div className="absolute top-20 right-10 w-64 h-64 bg-[#4353FF]/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-10 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl"></div>
          
          <div className="container mx-auto px-4 sm:px-6 relative z-10">
            {/* Section Header */}
            <div className="text-center mb-16 max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#4353FF]/10 border border-[#4353FF]/20 rounded-full mb-6">
                <MessageCircle className="w-4 h-4" style={{ color: '#4353FF' }} />
                <span className="text-sm font-semibold" style={{ color: '#4353FF' }}>FAQ</span>
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4" style={{ color: '#1E293B' }} data-testid="text-faq-title">
                Frequently Asked Questions
              </h2>
              <p className="text-xl text-slate-600 font-light">
                Everything you need to know before outsourcing your LegalOps.
              </p>
            </div>

            {/* FAQ Accordion */}
            <div className="max-w-4xl mx-auto">
              <Accordion type="single" collapsible className="space-y-4">
                {/* FAQ 1 */}
                <AccordionItem 
                  value="item-1" 
                  className="bg-white rounded-2xl border border-slate-200 px-6 shadow-sm hover:shadow-md transition-shadow duration-300"
                  data-testid="accordion-faq-1"
                >
                  <AccordionTrigger className="text-lg font-semibold hover:no-underline py-6" style={{ color: '#1E293B' }}>
                    What exactly is OnSpot LegalOps™?
                  </AccordionTrigger>
                  <AccordionContent className="text-base leading-relaxed pb-6 space-y-4" style={{ color: '#475569' }}>
                    <p>
                      OnSpot LegalOps™ is a full-service outsourcing system for law firms — combining trained legal professionals, structured processes, and delivery oversight.
                    </p>
                    <p>
                      We handle the operational side of your practice — including rent demands, petitions, Section 8 documentation, legal research, and client coordination — so your team can focus entirely on legal strategy and billable work.
                    </p>
                    <p>
                      Our system is built on the <span className="font-semibold" style={{ color: '#4353FF' }}>OnSpot 4P Operating System</span>: Philosophy, People, Process, and Problem Solving, which guarantees consistent, measurable, and transparent results.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                {/* FAQ 2 */}
                <AccordionItem 
                  value="item-2" 
                  className="bg-white rounded-2xl border border-slate-200 px-6 shadow-sm hover:shadow-md transition-shadow duration-300"
                  data-testid="accordion-faq-2"
                >
                  <AccordionTrigger className="text-lg font-semibold hover:no-underline py-6" style={{ color: '#1E293B' }}>
                    How does the "Resourced Services" model work?
                  </AccordionTrigger>
                  <AccordionContent className="text-base leading-relaxed pb-6 space-y-4" style={{ color: '#475569' }}>
                    <p>
                      In the Resourced Services model, OnSpot provides you with dedicated full-time legal staff (FTEs) who work directly under your firm's management and follow your workflow.
                    </p>
                    <p>
                      You control day-to-day operations, while we handle recruitment, onboarding, HR, payroll, and replacement.
                    </p>
                    <p>
                      We also include tools like Talent Performance Surveys (TPS), Early Warning Systems, and Quarterly Account Health Reviews to ensure ongoing quality and compliance.
                    </p>
                    <p>
                      If you ever want more support, you can easily upgrade to <span className="font-semibold" style={{ color: '#4353FF' }}>Managed Services</span>, where OnSpot provides full operational oversight, coaching, QA reviews, and reporting.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                {/* FAQ 3 */}
                <AccordionItem 
                  value="item-3" 
                  className="bg-white rounded-2xl border border-slate-200 px-6 shadow-sm hover:shadow-md transition-shadow duration-300"
                  data-testid="accordion-faq-3"
                >
                  <AccordionTrigger className="text-lg font-semibold hover:no-underline py-6" style={{ color: '#1E293B' }}>
                    What's the difference between "Resourced" and "Managed Services"?
                  </AccordionTrigger>
                  <AccordionContent className="text-base leading-relaxed pb-6" style={{ color: '#475569' }}>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b-2" style={{ borderColor: '#E2E8F0' }}>
                            <th className="text-left py-3 px-4 font-semibold" style={{ color: '#1E293B' }}>Category</th>
                            <th className="text-left py-3 px-4 font-semibold" style={{ color: '#1E293B' }}>Resourced Services</th>
                            <th className="text-left py-3 px-4 font-semibold" style={{ color: '#4353FF' }}>Managed Services</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y" style={{ borderColor: '#E2E8F0' }}>
                          <tr>
                            <td className="py-3 px-4 font-medium">Who Manages Daily Work</td>
                            <td className="py-3 px-4">Your firm</td>
                            <td className="py-3 px-4" style={{ color: '#4353FF' }}>OnSpot Delivery Manager & Team Manager</td>
                          </tr>
                          <tr>
                            <td className="py-3 px-4 font-medium">Performance Monitoring</td>
                            <td className="py-3 px-4">Light support (TPS every 30/60/90 days)</td>
                            <td className="py-3 px-4" style={{ color: '#4353FF' }}>Full KPI tracking, QA audits, dashboards</td>
                          </tr>
                          <tr>
                            <td className="py-3 px-4 font-medium">Reporting</td>
                            <td className="py-3 px-4">Quarterly reviews</td>
                            <td className="py-3 px-4" style={{ color: '#4353FF' }}>Weekly/monthly reports</td>
                          </tr>
                          <tr>
                            <td className="py-3 px-4 font-medium">Team Manager</td>
                            <td className="py-3 px-4">Optional/shared</td>
                            <td className="py-3 px-4" style={{ color: '#4353FF' }}>Dedicated, full-time</td>
                          </tr>
                          <tr>
                            <td className="py-3 px-4 font-medium">Cost</td>
                            <td className="py-3 px-4">Lower, flexible</td>
                            <td className="py-3 px-4" style={{ color: '#4353FF' }}>Higher, full-service</td>
                          </tr>
                          <tr>
                            <td className="py-3 px-4 font-medium">Best For</td>
                            <td className="py-3 px-4">Firms with internal oversight</td>
                            <td className="py-3 px-4" style={{ color: '#4353FF' }}>Firms seeking total hands-off operations</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* FAQ 4 */}
                <AccordionItem 
                  value="item-4" 
                  className="bg-white rounded-2xl border border-slate-200 px-6 shadow-sm hover:shadow-md transition-shadow duration-300"
                  data-testid="accordion-faq-4"
                >
                  <AccordionTrigger className="text-lg font-semibold hover:no-underline py-6" style={{ color: '#1E293B' }}>
                    What roles can OnSpot support?
                  </AccordionTrigger>
                  <AccordionContent className="text-base leading-relaxed pb-6 space-y-4" style={{ color: '#475569' }}>
                    <p>We can deploy specialized legal support staff trained in:</p>
                    <ul className="space-y-2 pl-6">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                        <span><span className="font-semibold">Landlord–Tenant workflows:</span> rent demands, petitions, Section 8/NYCHA processing</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                        <span><span className="font-semibold">Administrative roles:</span> billing, client intake, document management</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                        <span>Legal research and drafting</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                        <span>Calendar and compliance coordination</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                        <span><span className="font-semibold">Digital and marketing support:</span> email campaigns, social proof, SEO, etc.</span>
                      </li>
                    </ul>
                    <p className="pt-2">
                      Each FTE is handpicked, trained on your tools (Clio, Smokeball, MyCase, etc.), and supported by our internal delivery infrastructure.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                {/* FAQ 5 */}
                <AccordionItem 
                  value="item-5" 
                  className="bg-white rounded-2xl border border-slate-200 px-6 shadow-sm hover:shadow-md transition-shadow duration-300"
                  data-testid="accordion-faq-5"
                >
                  <AccordionTrigger className="text-lg font-semibold hover:no-underline py-6" style={{ color: '#1E293B' }}>
                    How much can my firm really save?
                  </AccordionTrigger>
                  <AccordionContent className="text-base leading-relaxed pb-6 space-y-4" style={{ color: '#475569' }}>
                    <p>
                      On average, firms save <span className="font-bold text-2xl" style={{ color: '#4353FF' }}>up to 70%</span> compared to hiring in-house.
                    </p>
                    <p>
                      A paralegal in New York costs roughly <span className="font-semibold text-red-600">$6,650 per month</span> including benefits and overhead, whereas OnSpot LegalOps staff start at <span className="font-semibold" style={{ color: '#4353FF' }}>$1,950 per month</span> — fully loaded, no hidden costs.
                    </p>
                    <p>
                      Plus, you eliminate expenses like taxes, insurance, hardware, office space, and turnover retraining.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                {/* FAQ 6 */}
                <AccordionItem 
                  value="item-6" 
                  className="bg-white rounded-2xl border border-slate-200 px-6 shadow-sm hover:shadow-md transition-shadow duration-300"
                  data-testid="accordion-faq-6"
                >
                  <AccordionTrigger className="text-lg font-semibold hover:no-underline py-6" style={{ color: '#1E293B' }}>
                    How do you ensure quality and compliance?
                  </AccordionTrigger>
                  <AccordionContent className="text-base leading-relaxed pb-6 space-y-4" style={{ color: '#475569' }}>
                    <p>Quality is maintained through our <span className="font-semibold" style={{ color: '#4353FF' }}>Delivery Playbook</span>, which includes:</p>
                    <ul className="space-y-2 pl-6">
                      <li className="flex items-start gap-2">
                        <Shield className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                        <span>Talent Performance Surveys (TPS) every 30/60/90 days</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Shield className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                        <span>Probation checkpoints and GROW coaching for skill improvement</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Shield className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                        <span>Early Warning System (EWS) for client-health tracking</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Shield className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                        <span>Risk Management Framework and Issue Escalation SOP</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Shield className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                        <span>Quarterly Account Reviews to identify improvements or growth areas</span>
                      </li>
                    </ul>
                    <p className="pt-2">
                      We also ensure data security, NDA compliance, and confidentiality aligned with U.S. legal standards.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                {/* FAQ 7 */}
                <AccordionItem 
                  value="item-7" 
                  className="bg-white rounded-2xl border border-slate-200 px-6 shadow-sm hover:shadow-md transition-shadow duration-300"
                  data-testid="accordion-faq-7"
                >
                  <AccordionTrigger className="text-lg font-semibold hover:no-underline py-6" style={{ color: '#1E293B' }}>
                    How long does it take to get started?
                  </AccordionTrigger>
                  <AccordionContent className="text-base leading-relaxed pb-6 space-y-4" style={{ color: '#475569' }}>
                    <p>
                      Most clients launch within <span className="font-semibold" style={{ color: '#4353FF' }}>2–3 weeks</span>.
                    </p>
                    <p>Our implementation includes:</p>
                    <ol className="space-y-2 pl-6 list-decimal list-outside">
                      <li><span className="font-semibold">Kickoff Call</span> (scope alignment & expectations)</li>
                      <li><span className="font-semibold">Talent Onboarding & Tech Setup</span></li>
                      <li><span className="font-semibold">Training Phase</span> (tools & SOPs)</li>
                      <li><span className="font-semibold">Go-Live</span> (your staff begins active case work)</li>
                      <li><span className="font-semibold">Monitoring & Performance Support</span> (first 90 days)</li>
                    </ol>
                    <p className="pt-2">
                      By Day 90, we deliver a full <span className="font-semibold" style={{ color: '#4353FF' }}>Handoff Summary</span>, confirming stability and next-step recommendations.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                {/* FAQ 8 */}
                <AccordionItem 
                  value="item-8" 
                  className="bg-white rounded-2xl border border-slate-200 px-6 shadow-sm hover:shadow-md transition-shadow duration-300"
                  data-testid="accordion-faq-8"
                >
                  <AccordionTrigger className="text-lg font-semibold hover:no-underline py-6" style={{ color: '#1E293B' }}>
                    What if I'm not happy with a staff member's performance?
                  </AccordionTrigger>
                  <AccordionContent className="text-base leading-relaxed pb-6 space-y-4" style={{ color: '#475569' }}>
                    <p>
                      We make replacements <span className="font-semibold" style={{ color: '#4353FF' }}>fast and frictionless</span>.
                    </p>
                    <p>
                      If a staff member underperforms, our Delivery Manager initiates coaching or replacement at no additional cost.
                    </p>
                    <p>
                      All replacements are pre-vetted and trained using your existing SOPs to ensure zero downtime.
                    </p>
                    <p>
                      Our <span className="font-semibold" style={{ color: '#4353FF' }}>Zero Escalation Guarantee</span> ensures you'll never be left managing issues alone.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                {/* FAQ 9 */}
                <AccordionItem 
                  value="item-9" 
                  className="bg-white rounded-2xl border border-slate-200 px-6 shadow-sm hover:shadow-md transition-shadow duration-300"
                  data-testid="accordion-faq-9"
                >
                  <AccordionTrigger className="text-lg font-semibold hover:no-underline py-6" style={{ color: '#1E293B' }}>
                    What does "Fully Managed Upgrade" mean?
                  </AccordionTrigger>
                  <AccordionContent className="text-base leading-relaxed pb-6 space-y-4" style={{ color: '#475569' }}>
                    <p>
                      The Managed Services upgrade adds a Delivery Manager, Team Manager, and QA Lead to handle:
                    </p>
                    <ul className="space-y-2 pl-6">
                      <li className="flex items-start gap-2">
                        <Target className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                        <span>Daily performance monitoring</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Target className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                        <span>Weekly check-ins with your team</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Target className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                        <span>Quality audits and dashboards</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Target className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#4353FF' }} />
                        <span>Coaching and continuous improvement</span>
                      </li>
                    </ul>
                    <p className="pt-2">
                      It's ideal for firms that want a hands-off, data-driven delivery model without managing staff directly.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                {/* FAQ 10 */}
                <AccordionItem 
                  value="item-10" 
                  className="bg-white rounded-2xl border border-slate-200 px-6 shadow-sm hover:shadow-md transition-shadow duration-300"
                  data-testid="accordion-faq-10"
                >
                  <AccordionTrigger className="text-lg font-semibold hover:no-underline py-6" style={{ color: '#1E293B' }}>
                    How does OnSpot maintain confidentiality and data security?
                  </AccordionTrigger>
                  <AccordionContent className="text-base leading-relaxed pb-6 space-y-4" style={{ color: '#475569' }}>
                    <p>
                      All staff operate under strict NDAs, data-protection policies, and secure IT infrastructure.
                    </p>
                    <p>
                      We follow best practices for client confidentiality, access control, and information handling.
                    </p>
                    <p>
                      Our teams work in monitored environments with encrypted communications and adhere to U.S. privacy standards — ensuring your firm's data is always protected.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                {/* FAQ 11 */}
                <AccordionItem 
                  value="item-11" 
                  className="bg-white rounded-2xl border border-slate-200 px-6 shadow-sm hover:shadow-md transition-shadow duration-300"
                  data-testid="accordion-faq-11"
                >
                  <AccordionTrigger className="text-lg font-semibold hover:no-underline py-6" style={{ color: '#1E293B' }}>
                    Can I scale up or down easily?
                  </AccordionTrigger>
                  <AccordionContent className="text-base leading-relaxed pb-6 space-y-4" style={{ color: '#475569' }}>
                    <p>
                      Yes — <span className="font-semibold" style={{ color: '#4353FF' }}>scalability is built in</span>.
                    </p>
                    <p>
                      You can start with one full-time LegalOps specialist and add more as your caseload grows.
                    </p>
                    <p>
                      Likewise, you can scale down or pause positions with notice — no long-term contracts, no HR headaches.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                {/* FAQ 12 */}
                <AccordionItem 
                  value="item-12" 
                  className="bg-white rounded-2xl border border-slate-200 px-6 shadow-sm hover:shadow-md transition-shadow duration-300"
                  data-testid="accordion-faq-12"
                >
                  <AccordionTrigger className="text-lg font-semibold hover:no-underline py-6" style={{ color: '#1E293B' }}>
                    What makes OnSpot different from generic outsourcing companies?
                  </AccordionTrigger>
                  <AccordionContent className="text-base leading-relaxed pb-6 space-y-4" style={{ color: '#475569' }}>
                    <ul className="space-y-3">
                      <li className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#4353FF]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Award className="w-4 h-4" style={{ color: '#4353FF' }} />
                        </div>
                        <div>
                          <span className="font-semibold block">Legal-specific expertise:</span>
                          <span>Built for landlord–tenant and property law practices.</span>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#4353FF]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Settings className="w-4 h-4" style={{ color: '#4353FF' }} />
                        </div>
                        <div>
                          <span className="font-semibold block">Structured SOPs:</span>
                          <span>Standardized across every process for consistency.</span>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#4353FF]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <BarChart3 className="w-4 h-4" style={{ color: '#4353FF' }} />
                        </div>
                        <div>
                          <span className="font-semibold block">Delivery oversight:</span>
                          <span>Even in Resourced mode, we track performance.</span>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#4353FF]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Shield className="w-4 h-4" style={{ color: '#4353FF' }} />
                        </div>
                        <div>
                          <span className="font-semibold block">Transparency:</span>
                          <span>cNPS and QBR systems ensure accountability.</span>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#4353FF]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Rocket className="w-4 h-4" style={{ color: '#4353FF' }} />
                        </div>
                        <div>
                          <span className="font-semibold block">Scalability:</span>
                          <span>Instant expansion or Managed upgrade when needed.</span>
                        </div>
                      </li>
                    </ul>
                    <p className="pt-4 font-medium" style={{ color: '#1E293B' }}>
                      In short, we don't just fill roles — we build a LegalOps system that runs reliably every day.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                {/* FAQ 13 */}
                <AccordionItem 
                  value="item-13" 
                  className="bg-white rounded-2xl border border-slate-200 px-6 shadow-sm hover:shadow-md transition-shadow duration-300"
                  data-testid="accordion-faq-13"
                >
                  <AccordionTrigger className="text-lg font-semibold hover:no-underline py-6" style={{ color: '#1E293B' }}>
                    How do I start my free consultation?
                  </AccordionTrigger>
                  <AccordionContent className="text-base leading-relaxed pb-6 space-y-4" style={{ color: '#475569' }}>
                    <p>
                      Simply click <span className="font-semibold" style={{ color: '#4353FF' }}>"Start My 90-Day Trial"</span> on this page.
                    </p>
                    <p>We'll schedule a 15-minute discovery call to:</p>
                    <ul className="space-y-2 pl-6 list-disc list-outside">
                      <li>Review your firm's workflow</li>
                      <li>Estimate savings and role recommendations</li>
                      <li>Outline your implementation timeline</li>
                    </ul>
                    <p className="pt-2">
                      You'll receive a custom proposal within 48 hours — no commitment required.
                    </p>
                    <div className="pt-4">
                      <Button 
                        size="lg" 
                        className="px-8 rounded-2xl"
                        style={{ background: 'linear-gradient(135deg, #4353FF 0%, #5B7CFF 100%)' }}
                        onClick={scrollToCheckout}
                        data-testid="button-faq-cta"
                      >
                        Start My 90-Day Trial
                        <ChevronRight className="w-5 h-5 ml-2" />
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
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

      {/* Operations Playbook Modal - Triggered on scroll */}
      <Dialog open={showPlaybookModal} onOpenChange={setShowPlaybookModal}>
        <DialogContent 
          className="max-w-3xl p-0 overflow-hidden border-0 bg-transparent"
          style={{ 
            background: 'radial-gradient(circle at 30% 50%, #4353FF 0%, #2B3FCC 35%, #1E2F9A 70%, #0A143C 100%)'
          }}
        >
          {/* Animated flowing lines SVG overlay */}
          <svg 
            className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" 
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
            viewBox="0 0 600 400"
            aria-hidden="true"
          >
            <path 
              d="M 0,200 Q 150,150 300,200 T 600,200" 
              stroke="rgba(255,255,255,0.4)" 
              strokeWidth="2" 
              fill="none"
              strokeDasharray="10 5"
              className="playbook-pulse-path"
            />
            <path 
              d="M 0,150 Q 200,100 400,150 T 600,150" 
              stroke="rgba(255,255,255,0.3)" 
              strokeWidth="1.5" 
              fill="none"
              strokeDasharray="8 4"
              className="playbook-pulse-path"
              style={{ animationDelay: '2s' }}
            />
            <circle cx="150" cy="150" r="4" fill="rgba(255,255,255,0.6)" className="playbook-node-drift-1" />
            <circle cx="300" cy="200" r="5" fill="rgba(255,255,255,0.7)" className="playbook-node-drift-2" />
            <circle cx="450" cy="150" r="4" fill="rgba(255,255,255,0.6)" className="playbook-node-drift-3" />
          </svg>

          {/* Content */}
          <div className="relative z-10 p-8 sm:p-12 text-center space-y-6">
            {/* Icon badge */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
            </div>

            <DialogHeader>
              <DialogTitle className="text-3xl sm:text-4xl font-bold text-white leading-tight">
                The OnSpot Operations Playbook
              </DialogTitle>
              <DialogDescription className="text-lg sm:text-xl text-white/90 font-light pt-2">
                Our proven system that makes outsourcing effortless
              </DialogDescription>
            </DialogHeader>

            {/* Guiding message */}
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 space-y-3">
              <p className="text-white/95 text-base sm:text-lg">
                You've seen how OnSpot LegalOps works. Now discover the complete framework that powers every successful implementation.
              </p>
              <div className="flex items-start gap-3 text-left">
                <CheckCircle2 className="w-5 h-5 text-white flex-shrink-0 mt-0.5" />
                <p className="text-white/85 text-sm sm:text-base">
                  <span className="font-semibold">4P Operating System:</span> Philosophy, People, Process, Problem Solving
                </p>
              </div>
              <div className="flex items-start gap-3 text-left">
                <CheckCircle2 className="w-5 h-5 text-white flex-shrink-0 mt-0.5" />
                <p className="text-white/85 text-sm sm:text-base">
                  <span className="font-semibold">Service Models:</span> Managed & Resourced solutions
                </p>
              </div>
              <div className="flex items-start gap-3 text-left">
                <CheckCircle2 className="w-5 h-5 text-white flex-shrink-0 mt-0.5" />
                <p className="text-white/85 text-sm sm:text-base">
                  <span className="font-semibold">Implementation Framework:</span> From kickoff to handoff
                </p>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button 
                asChild
                size="lg" 
                className="flex-1 px-6 py-6 text-base rounded-2xl bg-white text-[#4353FF] hover:bg-white/95 active:bg-white/90 transition-all duration-300 playbook-cta-glow"
                data-testid="button-view-playbook-modal"
              >
                <a 
                  href="https://www.onspotglobal.com/operations-playbook"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View the Full Playbook
                  <ChevronRight className="w-5 h-5 ml-2" />
                </a>
              </Button>
              <Button 
                onClick={() => {
                  setShowPlaybookModal(false);
                  scrollToCheckout();
                }}
                size="lg" 
                variant="outline"
                className="flex-1 px-6 py-6 text-base rounded-2xl bg-white/10 text-white border-white/30 hover:bg-white/20 transition-all duration-300"
                data-testid="button-start-trial-modal"
              >
                Start My Trial Now
              </Button>
            </div>

            {/* Helper text */}
            <p className="text-white/70 text-sm pt-2">
              Not ready yet? Close this to continue exploring.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
