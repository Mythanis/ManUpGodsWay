import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Check, Loader2, Clock, CreditCard } from "lucide-react";

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

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UpgradeModal({ isOpen, onClose }: UpgradeModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  const { data: subscriptionInfo, isLoading } = useQuery<SubscriptionInfo>({
    queryKey: ["/api/subscription-settings"],
    enabled: isOpen,
  });

  const { data: trialEligibility } = useQuery<TrialEligibility>({
    queryKey: ["/api/subscription/trial-eligibility"],
    enabled: isOpen,
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
      toast({ title: "Error", description: error.message || "Failed to create checkout session", variant: "destructive" });
    },
  });

  const handleSubscribe = (startTrial: boolean) => {
    createCheckoutMutation.mutate({ billingCycle, startTrial });
  };

  const monthlyPrice = parseFloat(subscriptionInfo?.monthlyPrice || "9.99");
  const yearlyPrice = parseFloat(subscriptionInfo?.yearlyPrice || "99.99");
  const yearlySavings = (monthlyPrice * 12 - yearlyPrice).toFixed(2);
  const savingsPercent = Math.round(((monthlyPrice * 12 - yearlyPrice) / (monthlyPrice * 12)) * 100);
  const displayPrice = billingCycle === "yearly" ? yearlyPrice.toFixed(2) : monthlyPrice.toFixed(2);
  const priceLabel = billingCycle === "yearly" ? "/year" : "/month";
  const features = subscriptionInfo?.features || [
    "Full access to all Bible studies",
    "All devotionals and blog content",
    "Video and podcast library",
    "Community discussions and War Room",
    "Weekly challenges",
  ];

  const isTrialEligible = trialEligibility?.eligible ?? false;
  const trialDays = trialEligibility?.trialDays ?? 7;
  const isExpired = (user as any)?.subscriptionStatus === 'expired' || (user as any)?.subscriptionStatus === 'cancelled';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-black border border-[#FCD000]/30">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black text-center text-[#FCD000] uppercase tracking-wider" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            {isExpired ? "Subscribe to Continue" : "Unlock Full Access"}
          </DialogTitle>
          <DialogDescription className="text-center text-white/60">
            {isExpired
              ? "Your trial has ended. Subscribe now to keep access to all content."
              : "Get unlimited access to everything Man Up God's Way has to offer."}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FCD000]"></div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex justify-center">
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

            <Card className="bg-white/5 border border-[#FCD000]/20">
              <CardContent className="pt-6 text-center">
                <Shield className="w-10 h-10 text-[#FCD000] mx-auto mb-3" />
                <div className="text-4xl font-black text-[#FCD000] mb-1" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                  ${displayPrice}{priceLabel}
                </div>
                {billingCycle === "yearly" && parseFloat(yearlySavings) > 0 && (
                  <p className="text-green-400 text-sm">
                    Save ${yearlySavings}/year (${(yearlyPrice / 12).toFixed(2)}/month)
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="space-y-2">
              {features.map((feature, index) => (
                <div key={index} className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-[#FCD000] flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-white/80">{feature}</span>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              {isTrialEligible && (
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
                      Start {trialDays}-Day Free Trial
                    </>
                  )}
                </Button>
              )}

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
                    Subscribe Now — ${displayPrice}{priceLabel}
                  </>
                )}
              </Button>
            </div>

            {isTrialEligible && (
              <div className="text-center text-xs text-white/40 space-y-1">
                <p>Free trial requires a card on file. You won't be charged until after {trialDays} days.</p>
                <p>Cancel anytime during your trial — no charge.</p>
              </div>
            )}

            <div className="text-center text-xs text-white/40">
              <p>Secure payment powered by Stripe</p>
              {!isTrialEligible && <p>Cancel anytime - No hidden fees</p>}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
