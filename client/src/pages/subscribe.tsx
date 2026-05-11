import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Check, Loader2, Clock, CreditCard, ArrowLeft, Crown, BookOpen, Video, Users, Flame, Star } from "lucide-react";

interface SubscriptionInfo {
  monthlyPrice: string;
  yearlyPrice: string;
  trialDurationDays: number;
  features: string[];
}

interface TrialEligibility {
  eligible: boolean;
  trialDays: number;
  currentStatus: string;
}

const TESTIMONIALS = [
  { name: "Marcus T.", quote: "This platform changed my walk with God. The studies are deep, the brotherhood is real." },
  { name: "James R.", quote: "Best faith investment I've made. The 52-week plan gave my spiritual life structure." },
  { name: "David K.", quote: "The War Room community held me accountable in ways I never expected. Worth every penny." },
];

export default function Subscribe() {
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");

  const { data: subscriptionInfo, isLoading } = useQuery<SubscriptionInfo>({
    queryKey: ["/api/subscription-settings"],
  });

  const { data: trialEligibility } = useQuery<TrialEligibility>({
    queryKey: ["/api/subscription/trial-eligibility"],
    enabled: isAuthenticated,
  });

  const createCheckoutMutation = useMutation({
    mutationFn: async (data: { billingCycle: string; startTrial?: boolean }) => {
      const response = await apiRequest('POST', '/api/create-subscription-checkout', data);
      return response;
    },
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast({ title: "Error", description: "Failed to create checkout session", variant: "destructive" });
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to start checkout", variant: "destructive" });
    },
  });

  const handleSubscribe = (startTrial: boolean) => {
    if (!isAuthenticated) {
      toast({ title: "Sign in required", description: "Please sign in first to subscribe.", variant: "destructive" });
      return;
    }
    createCheckoutMutation.mutate({ billingCycle, startTrial });
  };

  const monthlyPrice = parseFloat(subscriptionInfo?.monthlyPrice || "9.99");
  const yearlyPrice = parseFloat(subscriptionInfo?.yearlyPrice || "99.99");
  const yearlySavings = (monthlyPrice * 12 - yearlyPrice).toFixed(2);
  const savingsPercent = Math.round(((monthlyPrice * 12 - yearlyPrice) / (monthlyPrice * 12)) * 100);
  const monthlyEquiv = (yearlyPrice / 12).toFixed(2);
  const features = subscriptionInfo?.features || [
    "Full access to all Bible studies",
    "All devotionals and blog content",
    "Video and podcast library",
    "Community discussions and War Room",
    "Weekly challenges",
  ];

  const isTrialEligible = trialEligibility?.eligible ?? false;
  const trialDays = trialEligibility?.trialDays ?? 7;
  const isAlreadyActive = (user as any)?.subscriptionStatus === 'active' ||
    ((user as any)?.subscriptionStatus === 'cancelled' && (user as any)?.subscriptionExpiresAt && new Date((user as any).subscriptionExpiresAt) > new Date());

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#FDD000]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-24">
      <div className="max-w-lg mx-auto px-4 py-6">
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-2 text-white/60 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back</span>
        </button>

        {/* Hero */}
        <div className="text-center mb-6">
          <Crown className="w-12 h-12 text-[#FDD000] mx-auto mb-3" />
          <h1 className="text-3xl font-black text-[#FDD000] uppercase tracking-wider mb-2" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            Man Up God's Way
          </h1>
          <p className="text-white/60 text-sm">
            Join thousands of brothers growing in biblical manhood, leadership, and faith.
          </p>
        </div>

        {isAlreadyActive ? (
          <Card className="bg-white/5 border border-green-500/30 mb-6">
            <CardContent className="pt-6 text-center">
              <Shield className="w-10 h-10 text-green-400 mx-auto mb-3" />
              <h2 className="text-xl font-black text-white mb-2">You're Already Subscribed!</h2>
              <p className="text-white/60 text-sm mb-4">You have full access to all content and features.</p>
              <Button
                onClick={() => setLocation('/profile')}
                className="bg-[#FDD000] text-black hover:bg-[#FDD000]/90 font-bold"
              >
                Manage Subscription
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Feature icons */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              {[
                { icon: BookOpen, label: "52-Week Studies" },
                { icon: Video, label: "Videos & Podcasts" },
                { icon: Users, label: "Brotherhood" },
                { icon: Shield, label: "War Room" },
                { icon: Flame, label: "Challenges" },
                { icon: Star, label: "Weekly Devotionals" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="bg-white/5 border border-white/10 rounded-sm px-2 py-3 flex flex-col items-center gap-1">
                  <Icon className="w-5 h-5 text-[#FDD000]" />
                  <span className="text-[10px] text-white/70 text-center leading-tight font-medium">{label}</span>
                </div>
              ))}
            </div>

            {/* Billing toggle */}
            <div className="flex justify-center mb-4">
              <div className="bg-white/10 p-1 rounded-lg relative">
                <Button
                  variant={billingCycle === "monthly" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setBillingCycle("monthly")}
                  className={billingCycle === "monthly" ? "bg-[#FDD000] text-black shadow-sm hover:bg-[#FDD000]/90 font-bold" : "text-white hover:bg-white/10"}
                >
                  Monthly
                </Button>
                <Button
                  variant={billingCycle === "yearly" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setBillingCycle("yearly")}
                  className={billingCycle === "yearly" ? "bg-[#FDD000] text-black shadow-sm hover:bg-[#FDD000]/90 font-bold" : "text-white hover:bg-white/10"}
                >
                  Yearly
                  {savingsPercent > 0 && (
                    <Badge className="ml-2 bg-green-500 text-white text-xs">Save {savingsPercent}%</Badge>
                  )}
                </Button>
              </div>
            </div>

            {/* Yearly best-value callout */}
            {billingCycle === "yearly" && savingsPercent > 0 && (
              <p className="text-center text-green-400 text-xs mb-3 font-semibold">
                Best value — only ${monthlyEquiv}/month, billed yearly
              </p>
            )}

            <div className="grid gap-4 mb-6">
              {/* Free Trial card */}
              {isTrialEligible && (
                <Card className="bg-gradient-to-br from-[#FDD000]/10 to-[#FDD000]/5 border-2 border-[#FDD000]/60 relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-[#FDD000] text-black text-xs font-bold px-3 py-1 rounded-bl-lg">
                    RECOMMENDED
                  </div>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-[#FDD000]/20 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-[#FDD000]" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-white">{trialDays}-Day Free Trial</h3>
                        <p className="text-white/50 text-xs">Try everything free — no charge until it ends</p>
                      </div>
                    </div>
                    <div className="bg-black/30 rounded-lg p-3 mb-4">
                      <p className="text-white/70 text-sm">
                        Full access for {trialDays} days — then{" "}
                        <span className="text-[#FDD000] font-bold">
                          ${billingCycle === "yearly" ? yearlyPrice.toFixed(2) : monthlyPrice.toFixed(2)}/{billingCycle === "yearly" ? "yr" : "mo"}
                        </span>.
                        {" "}Cancel anytime.
                      </p>
                    </div>
                    <Button
                      onClick={() => handleSubscribe(true)}
                      disabled={createCheckoutMutation.isPending}
                      className="w-full py-3 text-lg bg-[#FDD000] text-black hover:bg-[#FDD000]/90 font-black uppercase tracking-wider"
                      style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                      size="lg"
                    >
                      {createCheckoutMutation.isPending ? (
                        <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Processing...</>
                      ) : (
                        <><Clock className="w-5 h-5 mr-2" />Start Free Trial</>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Subscribe Now card */}
              <Card className="bg-white/5 border border-white/10">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white">Subscribe Now</h3>
                      <p className="text-white/50 text-xs">Instant full access, skip the trial</p>
                    </div>
                  </div>
                  <div className="text-center mb-4">
                    <div className="text-3xl font-black text-[#FDD000]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                      ${billingCycle === "yearly" ? yearlyPrice.toFixed(2) : monthlyPrice.toFixed(2)}
                      <span className="text-lg text-white/40">/{billingCycle === "yearly" ? "year" : "month"}</span>
                    </div>
                    {billingCycle === "yearly" && parseFloat(yearlySavings) > 0 && (
                      <p className="text-green-400 text-sm">
                        Save ${yearlySavings}/year vs monthly
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={() => handleSubscribe(false)}
                    disabled={createCheckoutMutation.isPending}
                    className={isTrialEligible
                      ? "w-full py-3 text-lg bg-white/10 text-white hover:bg-white/20 font-black uppercase tracking-wider border border-[#FDD000]/30"
                      : "w-full py-3 text-lg bg-[#FDD000] text-black hover:bg-[#FDD000]/90 font-black uppercase tracking-wider"
                    }
                    style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                    size="lg"
                    variant={isTrialEligible ? "outline" : "default"}
                  >
                    {createCheckoutMutation.isPending ? (
                      <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Processing...</>
                    ) : (
                      <><CreditCard className="w-5 h-5 mr-2" />Subscribe — ${billingCycle === "yearly" ? yearlyPrice.toFixed(2) : monthlyPrice.toFixed(2)}/{billingCycle === "yearly" ? "yr" : "mo"}</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* What's included */}
            <div className="space-y-2 mb-6">
              <h3 className="text-sm font-bold text-white/80 uppercase tracking-wider">Everything included:</h3>
              {features.map((feature, index) => (
                <div key={index} className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-[#FDD000] flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-white/70">{feature}</span>
                </div>
              ))}
            </div>

            {/* Testimonials */}
            <div className="space-y-3 mb-6">
              <h3 className="text-sm font-bold text-white/80 uppercase tracking-wider">What brothers say:</h3>
              {TESTIMONIALS.map(({ name, quote }) => (
                <div key={name} className="bg-white/5 border border-white/10 rounded-sm px-4 py-3">
                  <div className="flex gap-0.5 mb-1">
                    {[1,2,3,4,5].map(i => <Star key={i} className="w-3 h-3 text-[#FDD000] fill-[#FDD000]" />)}
                  </div>
                  <p className="text-white/70 text-sm italic mb-1">"{quote}"</p>
                  <p className="text-white/40 text-xs font-semibold">— {name}</p>
                </div>
              ))}
            </div>

            {/* Risk-free guarantee */}
            <div className="bg-green-900/20 border border-green-500/30 rounded-sm px-4 py-3 mb-6 flex items-start gap-3">
              <Shield className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-green-400 text-sm font-bold">Risk-Free Guarantee</p>
                <p className="text-white/60 text-xs">Cancel anytime before your trial ends — you won't be charged. No questions asked.</p>
              </div>
            </div>

            <div className="text-center text-xs text-white/30 space-y-1">
              <p>Secure payment powered by Stripe</p>
              {isTrialEligible && <p>Trial requires a card on file. No charge for {trialDays} days.</p>}
              <p className="mt-1">Have a promo code? You can enter it on the next screen.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
