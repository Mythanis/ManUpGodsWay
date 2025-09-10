import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { DollarSign, Save, Check } from "lucide-react";

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

export default function TierPricingManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [editingTier, setEditingTier] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    monthlyPrice: string;
    yearlyPrice: string;
    features: string;
  }>({
    monthlyPrice: "",
    yearlyPrice: "",
    features: "",
  });

  // Fetch tier pricing data
  const { data: tierPricing = [], isLoading } = useQuery({
    queryKey: ["/api/admin/tier-pricing"],
  });

  // Update tier pricing mutation
  const updateTierMutation = useMutation({
    mutationFn: async ({ tier, data }: { tier: string; data: any }) => {
      return apiRequest('PUT', `/api/admin/tier-pricing/${tier}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tier-pricing"] });
      setEditingTier(null);
      setFormData({ monthlyPrice: "", yearlyPrice: "", features: "" });
      toast({
        title: "Success",
        description: "Tier pricing updated successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update tier pricing",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (tier: TierPricing) => {
    setEditingTier(tier.tier);
    setFormData({
      monthlyPrice: tier.monthlyPrice,
      yearlyPrice: tier.yearlyPrice || "",
      features: tier.features.join("\n"),
    });
  };

  const handleSave = () => {
    if (!editingTier) return;

    const featuresArray = formData.features
      .split("\n")
      .map(f => f.trim())
      .filter(f => f.length > 0);

    updateTierMutation.mutate({
      tier: editingTier,
      data: {
        monthlyPrice: parseFloat(formData.monthlyPrice),
        yearlyPrice: formData.yearlyPrice ? parseFloat(formData.yearlyPrice) : null,
        features: featuresArray,
      },
    });
  };

  const handleCancel = () => {
    setEditingTier(null);
    setFormData({ monthlyPrice: "", yearlyPrice: "", features: "" });
  };

  const getTierDisplayName = (tier: string) => {
    return tier.charAt(0).toUpperCase() + tier.slice(1);
  };

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'premium':
        return 'bg-blue-500 text-white';
      case 'vip':
        return 'bg-ministry-gold text-black';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ministry-navy"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Subscription Tier Pricing
          </CardTitle>
          <CardDescription>
            Configure pricing for Premium and VIP subscription tiers. These prices will be used in the upgrade modal and Stripe checkout.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {tierPricing.map((tier: TierPricing) => (
          <Card key={tier.id} className="border-border">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <CardTitle className="text-base font-semibold">{getTierDisplayName(tier.tier)}</CardTitle>
                  <Badge className={`text-xs shrink-0 ${getTierBadgeColor(tier.tier)}`}>
                    {tier.tier.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {editingTier === tier.tier ? (
                    <>
                      <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={updateTierMutation.isPending}
                        className="bg-ministry-gold text-black hover:bg-ministry-gold/90 text-xs px-2 py-1 h-7"
                      >
                        <Save className="w-3 h-3 mr-1" />
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancel}
                        disabled={updateTierMutation.isPending}
                        className="text-xs px-2 py-1 h-7"
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(tier)}
                      className="border-ministry-steel text-ministry-charcoal hover:bg-ministry-steel/10 text-xs px-2 py-1 h-7 shrink-0"
                    >
                      Edit
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {editingTier === tier.tier ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`monthly-${tier.tier}`}>Monthly Price ($)</Label>
                      <Input
                        id={`monthly-${tier.tier}`}
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.monthlyPrice}
                        onChange={(e) => setFormData({ ...formData, monthlyPrice: e.target.value })}
                        placeholder="19.99"
                        className="border-ministry-steel focus:border-ministry-gold"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`yearly-${tier.tier}`}>Yearly Price ($) <span className="text-gray-500">(optional)</span></Label>
                      <Input
                        id={`yearly-${tier.tier}`}
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.yearlyPrice}
                        onChange={(e) => setFormData({ ...formData, yearlyPrice: e.target.value })}
                        placeholder="199.99"
                        className="border-ministry-steel focus:border-ministry-gold"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor={`features-${tier.tier}`}>Features (one per line)</Label>
                    <Textarea
                      id={`features-${tier.tier}`}
                      value={formData.features}
                      onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                      placeholder="Access to premium content&#10;Advanced study guides&#10;Priority support"
                      rows={6}
                      className="border-ministry-steel focus:border-ministry-gold"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <div className="bg-gray-50 p-2 rounded">
                        <Label className="text-xs font-medium text-gray-600 block mb-1">Monthly Price</Label>
                        <div className="text-base font-bold text-ministry-charcoal">
                          ${parseFloat(tier.monthlyPrice).toFixed(2)}
                        </div>
                      </div>
                      {tier.yearlyPrice && (
                        <div className="bg-gray-50 p-2 rounded">
                          <Label className="text-xs font-medium text-gray-600 block mb-1">Yearly Price</Label>
                          <div className="text-base font-bold text-ministry-charcoal">
                            ${parseFloat(tier.yearlyPrice).toFixed(2)}
                          </div>
                          <div className="text-xs text-green-600 mt-1">
                            Save ${(parseFloat(tier.monthlyPrice) * 12 - parseFloat(tier.yearlyPrice)).toFixed(2)}/year
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-600 mb-2 block">Features</Label>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {tier.features.map((feature, index) => (
                        <div key={index} className="flex items-start gap-2 text-xs">
                          <Check className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
                          <span className="leading-relaxed">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {tierPricing.length === 0 && (
        <Card className="bg-gray-50">
          <CardContent className="p-8 text-center">
            <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No tier pricing configured yet</p>
            <p className="text-sm text-gray-500">Tier pricing will be automatically created when the system initializes</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}