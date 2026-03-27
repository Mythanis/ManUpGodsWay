import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Check, Loader2, Clock, CreditCard, ArrowLeft, Crown } from "lucide-react";

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

export default function Subscribe() {
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

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
      return response.json();
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
  const features = subscriptionInfo?.features || [
    "Full access to all Bible studies",
    "All devotionals and blog content",
    "Video and podcast library",
    "Community discussions and War Room",
    "Weekly challenges",
  ];

  const isTrialEligible = trialEligibility?.eligible ?? false;
  const trialDays = trialEligibility?.trialDays ?? 7;
  const isAlreadyActive = (user as any)?.subscriptionStatus === 'active';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#FCD000]"></div>
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

        <div className="text-center mb-8">
          <Crown className="w-12 h-12 text-[#FCD000] mx-auto mb-3" />
          <h1 className="text-3xl font-black text-[#FCD000] uppercase tracking-wider mb-2" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            Man Up God's Way
          </h1>
          <p className="text-white/60 text-sm">
            Unlock full access to Bible studies, devotionals, videos, and more.
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
                className="bg-[#FCD000] text-black hover:bg-[#FCD000]/90 font-bold"
              >
                Manage Subscription
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex justify-center mb-6">
              <div className="bg-white/10 p-1 rounded-lg">
                <Button
                  variant={billingCycle === "monthly" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setBillingCycle("monthly")}
                  className={billingCycle === "monthly" ? "bg-[#FCD000] text-black shadow-sm hover:bg-[#FCD000]/90 font-bold" : "text-white hover:bg-white/10"}
                >
                  Monthly
                </Button>
                <Button
                  variant={billingCycle === "yearly" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setBillingCycle("yearly")}
                  className={billingCycle === "yearly" ? "bg-[#FCD000] text-black shadow-sm hover:bg-[#FCD000]/90 font-bold" : "text-white hover:bg-white/10"}
                >
                  Yearly
                  {savingsPercent > 0 && (
                    <Badge className="ml-2 bg-green-500 text-white text-xs">Save {savingsPercent}%</Badge>
                  )}
                </Button>
              </div>
            </div>

            <div className="grid gap-4 mb-6">
              {isTrialEligible && (
                <Card className="bg-gradient-to-br from-[#FCD000]/10 to-[#FCD000]/5 border-2 border-[#FCD000]/40 relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-[#FCD000] text-black text-xs font-bold px-3 py-1 rounded-bl-lg">
                    RECOMMENDED
                  </div>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-[#FCD000]/20 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-[#FCD000]" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-white">{trialDays}-Day Free Trial</h3>
                        <p className="text-white/50 text-xs">Try everything free, cancel anytime</p>
                      </div>
                    </div>
                    <div className="bg-black/30 rounded-lg p-3 mb-4">
                      <p className="text-white/70 text-sm">
                        Get full access for {trialDays} days — your card won't be charged until the trial ends. 
                        Then it's <span className="text-[#FCD000] font-bold">
                          ${billingCycle === "yearly" ? yearlyPrice.toFixed(2) : monthlyPrice.toFixed(2)}/{billingCycle === "yearly" ? "year" : "month"}
                        </span>.
                      </p>
                    </div>
                    <Button
                      onClick={() => handleSubscribe(true)}
                      disabled={createCheckoutMutation.isPending}
                      className="w-full py-3 text-lg bg-[#FCD000] text-black hover:bg-[#FCD000]/90 font-black uppercase tracking-wider"
                      style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                      size="lg"
                    >
                      {createCheckoutMutation.isPending ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Clock className="w-5 h-5 mr-2" />
                          Start Free Trial
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}

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
                    <div className="text-3xl font-black text-[#FCD000]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                      ${billingCycle === "yearly" ? yearlyPrice.toFixed(2) : monthlyPrice.toFixed(2)}
                      <span className="text-lg text-white/40">/{billingCycle === "yearly" ? "year" : "month"}</span>
                    </div>
                    {billingCycle === "yearly" && parseFloat(yearlySavings) > 0 && (
                      <p className="text-green-400 text-sm">
                        Save ${yearlySavings}/year (${(yearlyPrice / 12).toFixed(2)}/month)
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={() => handleSubscribe(false)}
                    disabled={createCheckoutMutation.isPending}
                    className={isTrialEligible
                      ? "w-full py-3 text-lg bg-white/10 text-white hover:bg-white/20 font-black uppercase tracking-wider border border-[#FCD000]/30"
                      : "w-full py-3 text-lg bg-[#FCD000] text-black hover:bg-[#FCD000]/90 font-black uppercase tracking-wider"
                    }
                    style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                    size="lg"
                    variant={isTrialEligible ? "outline" : "default"}
                  >
                    {createCheckoutMutation.isPending ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-5 h-5 mr-2" />
                        Subscribe Now
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-2 mb-6">
              <h3 className="text-sm font-bold text-white/80 uppercase tracking-wider">What's included:</h3>
              {features.map((feature, index) => (
                <div key={index} className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-[#FCD000] flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-white/70">{feature}</span>
                </div>
              ))}
            </div>

            <div className="text-center text-xs text-white/30 space-y-1">
              <p>Secure payment powered by Stripe</p>
              <p>Cancel anytime — no hidden fees</p>
              {isTrialEligible && <p>Trial requires a card on file. No charge for {trialDays} days.</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
