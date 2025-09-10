import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, Gem, Check, Loader2, Star } from "lucide-react";

interface TierPricing {
  id: string;
  tier: string;
  monthlyPrice: string;
  yearlyPrice?: string;
  features: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UpgradeModal({ isOpen, onClose }: UpgradeModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTier, setSelectedTier] = useState<string>("");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  // Fetch tier pricing data
  const { data: tierPricing = [], isLoading } = useQuery({
    queryKey: ["/api/tier-pricing"],
    enabled: isOpen,
  });

  // Create subscription checkout mutation
  const createCheckoutMutation = useMutation({
    mutationFn: async (data: { tier: string; billingCycle: string }) => {
      const response = await apiRequest('POST', '/api/create-subscription-checkout', data);
      return response.json();
    },
    onSuccess: (data) => {
      // Redirect to Stripe checkout
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast({
          title: "Error",
          description: "Failed to create checkout session",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create checkout session",
        variant: "destructive",
      });
    },
  });

  const handleUpgrade = () => {
    if (!selectedTier) {
      toast({
        title: "Please select a tier",
        description: "Choose Premium or VIP to continue",
        variant: "destructive",
      });
      return;
    }

    createCheckoutMutation.mutate({
      tier: selectedTier,
      billingCycle,
    });
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'premium':
        return <Crown className="w-5 h-5" />;
      case 'vip':
        return <Gem className="w-5 h-5" />;
      default:
        return null;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'premium':
        return 'border-blue-200 bg-blue-50/50 hover:bg-blue-50';
      case 'vip':
        return 'border-ministry-gold bg-ministry-gold/10 hover:bg-ministry-gold/20';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const getSelectedTierColor = (tier: string) => {
    switch (tier) {
      case 'premium':
        return 'border-blue-500 bg-blue-100 ring-2 ring-blue-500';
      case 'vip':
        return 'border-ministry-gold bg-ministry-gold/20 ring-2 ring-ministry-gold';
      default:
        return 'border-gray-500 bg-gray-100';
    }
  };

  const calculateSavings = (tier: TierPricing) => {
    if (!tier.yearlyPrice) return 0;
    const monthlyTotal = parseFloat(tier.monthlyPrice) * 12;
    const yearlyPrice = parseFloat(tier.yearlyPrice);
    return monthlyTotal - yearlyPrice;
  };

  const getSavingsPercentage = (tier: string) => {
    switch (tier) {
      case 'premium':
        return 5;
      case 'vip':
        return 10;
      default:
        return 0;
    }
  };

  const calculateYearlyPrice = (tier: TierPricing) => {
    const monthlyPrice = parseFloat(tier.monthlyPrice);
    const savingsPercent = getSavingsPercentage(tier.tier);
    return (monthlyPrice * 12 * (1 - savingsPercent / 100)).toFixed(2);
  };

  const currentTier = user?.subscriptionTier || 'free';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">Upgrade Your Subscription</DialogTitle>
          <DialogDescription className="text-center">
            Unlock premium content and features to enhance your spiritual journey
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ministry-navy"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Current Tier Display */}
            <div className="text-center">
              <Badge className="text-sm bg-gray-100 text-gray-700">
                Current: {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}
              </Badge>
            </div>

            {/* Billing Cycle Toggle */}
            <div className="flex justify-center">
              <div className="bg-gray-100 p-1 rounded-lg">
                <Button
                  variant={billingCycle === "monthly" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setBillingCycle("monthly")}
                  className={billingCycle === "monthly" ? "bg-white shadow-sm" : ""}
                >
                  Monthly
                </Button>
                <Button
                  variant={billingCycle === "yearly" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setBillingCycle("yearly")}
                  className={billingCycle === "yearly" ? "bg-white shadow-sm" : ""}
                >
                  Yearly
                  <Badge className="ml-2 bg-green-500 text-white text-xs">Save up to 10%</Badge>
                </Button>
              </div>
            </div>

            {/* Tier Cards */}
            <div className="grid md:grid-cols-2 gap-6">
              {tierPricing.map((tier: TierPricing) => {
                const isSelected = selectedTier === tier.tier;
                const yearlyPrice = calculateYearlyPrice(tier);
                const price = billingCycle === "yearly" ? yearlyPrice : tier.monthlyPrice;
                const displayPrice = billingCycle === "yearly" 
                  ? `$${yearlyPrice}/year` 
                  : `$${parseFloat(tier.monthlyPrice).toFixed(2)}/month`;
                const savingsPercent = getSavingsPercentage(tier.tier);
                const savingsAmount = parseFloat(tier.monthlyPrice) * 12 * (savingsPercent / 100);

                return (
                  <Card
                    key={tier.id}
                    className={`cursor-pointer transition-all ${
                      isSelected 
                        ? getSelectedTierColor(tier.tier)
                        : getTierColor(tier.tier)
                    }`}
                    onClick={() => setSelectedTier(tier.tier)}
                  >
                    <CardHeader className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        {getTierIcon(tier.tier)}
                        <CardTitle className="text-xl">
                          {tier.tier.charAt(0).toUpperCase() + tier.tier.slice(1)}
                        </CardTitle>
                        {tier.tier === 'vip' && (
                          <Star className="w-4 h-4 text-ministry-gold" />
                        )}
                      </div>
                      <div className="text-3xl font-bold">
                        {displayPrice}
                      </div>
                      {billingCycle === "yearly" && savingsPercent > 0 && (
                        <div className="text-green-600 text-sm">
                          Save {savingsPercent}% (${savingsAmount.toFixed(2)} per year)
                        </div>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {tier.features.map((feature, index) => (
                          <div key={index} className="flex items-start gap-2">
                            <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                            <span className="text-sm">{feature}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Upgrade Button */}
            <div className="flex justify-center pt-4">
              <Button
                onClick={handleUpgrade}
                disabled={!selectedTier || createCheckoutMutation.isPending}
                className="px-8 py-3 text-lg bg-ministry-gold text-black hover:bg-ministry-gold/90"
                size="lg"
              >
                {createCheckoutMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  `Upgrade to ${selectedTier ? selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1) : 'Selected Tier'}`
                )}
              </Button>
            </div>

            {/* Security Note */}
            <div className="text-center text-sm text-gray-500">
              <p>🔒 Secure payment powered by Stripe</p>
              <p>Cancel anytime • No hidden fees • Subscription continues until expiration</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}