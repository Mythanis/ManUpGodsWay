import { useState, useEffect } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DollarSign, Save, Settings, Shield, Clock, Check } from "lucide-react";

interface SubscriptionSettings {
  id: string;
  monthlyPrice: string;
  yearlyPrice: string;
  trialDurationDays: number;
  features: string[];
  trialContentAreas: Record<string, boolean>;
  isActive: boolean;
}

const CONTENT_AREA_LABELS: Record<string, string> = {
  studies: "Bible Studies",
  devotionals: "Devotionals",
  videos: "Video Library",
  podcasts: "Podcasts",
  blog: "Blog Posts",
  warRoom: "War Room",
  underFire: "Under Fire",
  warGroups: "War Groups",
  fitness: "Fitness Plans",
  discussions: "Community Discussions",
};

export default function SubscriptionSettingsManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const [formData, setFormData] = useState({
    monthlyPrice: "9.99",
    yearlyPrice: "99.99",
    trialDurationDays: "7",
    features: "",
    trialContentAreas: {} as Record<string, boolean>,
  });

  const { data: settings, isLoading } = useQuery<SubscriptionSettings>({
    queryKey: ["/api/admin/subscription-settings"],
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        monthlyPrice: settings.monthlyPrice || "9.99",
        yearlyPrice: settings.yearlyPrice || "99.99",
        trialDurationDays: String(settings.trialDurationDays || 7),
        features: (settings.features || []).join("\n"),
        trialContentAreas: settings.trialContentAreas || {},
      });
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PUT", "/api/admin/subscription-settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscription-settings"] });
      setIsEditing(false);
      toast({ title: "Settings saved", description: "Subscription settings updated successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update settings", variant: "destructive" });
    },
  });

  const handleSave = () => {
    const featuresArray = formData.features
      .split("\n")
      .map((f) => f.trim())
      .filter((f) => f.length > 0);

    updateMutation.mutate({
      monthlyPrice: parseFloat(formData.monthlyPrice),
      yearlyPrice: parseFloat(formData.yearlyPrice),
      trialDurationDays: parseInt(formData.trialDurationDays),
      features: featuresArray,
      trialContentAreas: formData.trialContentAreas,
    });
  };

  const toggleContentArea = (area: string) => {
    setFormData((prev) => ({
      ...prev,
      trialContentAreas: {
        ...prev.trialContentAreas,
        [area]: !prev.trialContentAreas[area],
      },
    }));
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FCD000]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-black border border-[#FCD000]/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-[#FCD000] uppercase tracking-wider" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                <Settings className="w-5 h-5" />
                Subscription Settings
              </CardTitle>
              <CardDescription className="text-white/60">
                Configure pricing, free trial duration, and trial content access for your single subscription plan.
              </CardDescription>
            </div>
            {!isEditing ? (
              <Button onClick={() => setIsEditing(true)} className="bg-[#FCD000] text-black hover:bg-[#FCD000]/90 font-bold">
                Edit Settings
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={updateMutation.isPending} className="bg-[#FCD000] text-black hover:bg-[#FCD000]/90 font-bold">
                  <Save className="w-4 h-4 mr-1" />
                  Save
                </Button>
                <Button onClick={() => setIsEditing(false)} variant="outline" className="border-white/20 text-white hover:bg-white/10">
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-black border border-[#FCD000]/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-white text-lg">
              <DollarSign className="w-5 h-5 text-[#FCD000]" />
              Pricing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing ? (
              <>
                <div>
                  <Label className="text-white/70">Monthly Price ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.monthlyPrice}
                    onChange={(e) => setFormData({ ...formData, monthlyPrice: e.target.value })}
                    className="bg-white/5 border-white/20 text-white"
                  />
                </div>
                <div>
                  <Label className="text-white/70">Yearly Price ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.yearlyPrice}
                    onChange={(e) => setFormData({ ...formData, yearlyPrice: e.target.value })}
                    className="bg-white/5 border-white/20 text-white"
                  />
                  {formData.monthlyPrice && formData.yearlyPrice && (
                    <p className="text-xs text-green-400 mt-1">
                      Save ${(parseFloat(formData.monthlyPrice) * 12 - parseFloat(formData.yearlyPrice)).toFixed(2)}/year
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="bg-white/5 p-3 rounded-lg">
                  <Label className="text-xs text-white/50 block mb-1">Monthly</Label>
                  <div className="text-2xl font-black text-[#FCD000]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                    ${parseFloat(settings?.monthlyPrice || "9.99").toFixed(2)}
                  </div>
                </div>
                <div className="bg-white/5 p-3 rounded-lg">
                  <Label className="text-xs text-white/50 block mb-1">Yearly</Label>
                  <div className="text-2xl font-black text-[#FCD000]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                    ${parseFloat(settings?.yearlyPrice || "99.99").toFixed(2)}
                  </div>
                  <p className="text-xs text-green-400 mt-1">
                    Save ${(parseFloat(settings?.monthlyPrice || "9.99") * 12 - parseFloat(settings?.yearlyPrice || "99.99")).toFixed(2)}/year
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-black border border-[#FCD000]/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-white text-lg">
              <Clock className="w-5 h-5 text-[#FCD000]" />
              Free Trial
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <div>
                <Label className="text-white/70">Trial Duration (days)</Label>
                <Input
                  type="number"
                  min="1"
                  max="90"
                  value={formData.trialDurationDays}
                  onChange={(e) => setFormData({ ...formData, trialDurationDays: e.target.value })}
                  className="bg-white/5 border-white/20 text-white"
                />
                <p className="text-xs text-white/40 mt-1">New users get this many days of free trial access.</p>
              </div>
            ) : (
              <div className="bg-white/5 p-3 rounded-lg">
                <Label className="text-xs text-white/50 block mb-1">Duration</Label>
                <div className="text-2xl font-black text-[#FCD000]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                  {settings?.trialDurationDays || 7} DAYS
                </div>
                <p className="text-xs text-white/40 mt-1">After trial ends, users must subscribe to continue.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-black border border-[#FCD000]/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-white text-lg">
            <Shield className="w-5 h-5 text-[#FCD000]" />
            Trial Content Access
          </CardTitle>
          <CardDescription className="text-white/50">
            Toggle which content areas are available during the free trial. You can also mark individual items as trial-accessible from their edit pages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(CONTENT_AREA_LABELS).map(([key, label]) => (
              <div
                key={key}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  formData.trialContentAreas[key]
                    ? "bg-[#FCD000]/10 border-[#FCD000]/30"
                    : "bg-white/5 border-white/10"
                }`}
              >
                <span className="text-sm text-white font-medium">{label}</span>
                <Switch
                  checked={formData.trialContentAreas[key] || false}
                  onCheckedChange={() => {
                    if (isEditing) toggleContentArea(key);
                  }}
                  disabled={!isEditing}
                  className="data-[state=checked]:bg-[#FCD000]"
                />
              </div>
            ))}
          </div>
          {!isEditing && (
            <p className="text-xs text-white/30 mt-3">Click "Edit Settings" to change trial content access.</p>
          )}
        </CardContent>
      </Card>

      <Card className="bg-black border border-[#FCD000]/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-white text-lg">
            <Check className="w-5 h-5 text-[#FCD000]" />
            Subscription Features
          </CardTitle>
          <CardDescription className="text-white/50">
            List the features shown to users on the subscription page (one per line).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <Textarea
              value={formData.features}
              onChange={(e) => setFormData({ ...formData, features: e.target.value })}
              placeholder={"Full access to all Bible studies\nAll devotionals and blog content\nVideo and podcast library\nCommunity discussions\nWeekly challenges"}
              rows={8}
              className="bg-white/5 border-white/20 text-white placeholder:text-white/30"
            />
          ) : (
            <div className="space-y-2">
              {(settings?.features || []).map((feature, index) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-[#FCD000] flex-shrink-0 mt-0.5" />
                  <span className="text-white/80">{feature}</span>
                </div>
              ))}
              {(!settings?.features || settings.features.length === 0) && (
                <p className="text-white/40 text-sm">No features configured yet. Click "Edit Settings" to add them.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
