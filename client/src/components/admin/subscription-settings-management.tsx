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
import { Checkbox } from "@/components/ui/checkbox";
import { DollarSign, Save, Settings, Shield, Clock, Check, BookOpen, Loader2 } from "lucide-react";

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
  const [isEditingPricing, setIsEditingPricing] = useState(false);
  const [savingArea, setSavingArea] = useState<string | null>(null);
  const [savingStudy, setSavingStudy] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    monthlyPrice: "9.99",
    yearlyPrice: "99.99",
    trialDurationDays: "7",
    features: "",
    trialContentAreas: {} as Record<string, boolean>,
  });

  const [selectedTrialStudyIds, setSelectedTrialStudyIds] = useState<Set<string>>(new Set());

  const { data: settings, isLoading } = useQuery<SubscriptionSettings>({
    queryKey: ["/api/admin/subscription-settings"],
  });

  const { data: allStudies = [] } = useQuery<{ id: string; title: string; isTrialAccessible: boolean }[]>({
    queryKey: ["/api/admin/studies/trial-access"],
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

  useEffect(() => {
    if (allStudies.length > 0) {
      setSelectedTrialStudyIds(new Set(allStudies.filter(s => s.isTrialAccessible).map(s => s.id)));
    }
  }, [allStudies]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PUT", "/api/admin/subscription-settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscription-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subscription-settings"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update settings", variant: "destructive" });
    },
  });

  const updateTrialStudiesMutation = useMutation({
    mutationFn: async (studyIds: string[]) => {
      return apiRequest("PUT", "/api/admin/studies/trial-access", { studyIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studies/trial-access"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update trial studies", variant: "destructive" });
    },
  });

  const handleSavePricing = async () => {
    const featuresArray = formData.features
      .split("\n")
      .map((f) => f.trim())
      .filter((f) => f.length > 0);

    try {
      await updateMutation.mutateAsync({
        monthlyPrice: parseFloat(formData.monthlyPrice),
        yearlyPrice: parseFloat(formData.yearlyPrice),
        trialDurationDays: parseInt(formData.trialDurationDays),
        features: featuresArray,
        trialContentAreas: formData.trialContentAreas,
      });
      setIsEditingPricing(false);
      toast({ title: "Settings saved", description: "Pricing and trial duration updated." });
    } catch {
      // errors handled by mutation
    }
  };

  const handleToggleContentArea = async (area: string, checked: boolean) => {
    const newAreas = { ...formData.trialContentAreas, [area]: checked };
    setFormData((prev) => ({ ...prev, trialContentAreas: newAreas }));
    setSavingArea(area);
    try {
      await updateMutation.mutateAsync({
        monthlyPrice: parseFloat(formData.monthlyPrice),
        yearlyPrice: parseFloat(formData.yearlyPrice),
        trialDurationDays: parseInt(formData.trialDurationDays),
        features: formData.features.split("\n").map(f => f.trim()).filter(f => f.length > 0),
        trialContentAreas: newAreas,
      });
    } finally {
      setSavingArea(null);
    }
  };

  const handleToggleStudy = async (studyId: string, checked: boolean) => {
    const next = new Set(selectedTrialStudyIds);
    if (checked) {
      next.add(studyId);
    } else {
      next.delete(studyId);
    }
    setSelectedTrialStudyIds(next);
    setSavingStudy(studyId);
    try {
      await updateTrialStudiesMutation.mutateAsync(Array.from(next));
    } finally {
      setSavingStudy(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FDD000]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Pricing & Trial Duration */}
      <Card className="bg-black border border-[#FDD000]/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-[#FDD000] uppercase tracking-wider" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                <Settings className="w-5 h-5" />
                Subscription Settings
              </CardTitle>
              <CardDescription className="text-white/60">
                Configure pricing, trial duration, and subscription features.
              </CardDescription>
            </div>
            {!isEditingPricing ? (
              <Button onClick={() => setIsEditingPricing(true)} className="bg-[#FDD000] text-black hover:bg-[#FDD000]/90 font-bold">
                Edit Settings
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button onClick={handleSavePricing} disabled={updateMutation.isPending} className="bg-[#FDD000] text-black hover:bg-[#FDD000]/90 font-bold">
                  <Save className="w-4 h-4 mr-1" />
                  Save
                </Button>
                <Button onClick={() => setIsEditingPricing(false)} variant="outline" className="border-white/20 text-white hover:bg-white/10">
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-black border border-[#FDD000]/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-white text-lg">
              <DollarSign className="w-5 h-5 text-[#FDD000]" />
              Pricing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditingPricing ? (
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
                  <div className="text-2xl font-black text-[#FDD000]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                    ${parseFloat(settings?.monthlyPrice || "9.99").toFixed(2)}
                  </div>
                </div>
                <div className="bg-white/5 p-3 rounded-lg">
                  <Label className="text-xs text-white/50 block mb-1">Yearly</Label>
                  <div className="text-2xl font-black text-[#FDD000]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
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

        <Card className="bg-black border border-[#FDD000]/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-white text-lg">
              <Clock className="w-5 h-5 text-[#FDD000]" />
              Free Trial
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isEditingPricing ? (
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
                <div className="text-2xl font-black text-[#FDD000]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                  {settings?.trialDurationDays || 7} DAYS
                </div>
                <p className="text-xs text-white/40 mt-1">After trial ends, users must subscribe to continue.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trial Content Areas — toggles immediately */}
      <Card className="bg-black border border-[#FDD000]/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-white text-lg">
            <Shield className="w-5 h-5 text-[#FDD000]" />
            Trial Content Access
          </CardTitle>
          <CardDescription className="text-white/50">
            Toggle which content areas are available during the free trial. Changes save automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(CONTENT_AREA_LABELS).map(([key, label]) => (
              <div
                key={key}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  formData.trialContentAreas[key]
                    ? "bg-[#FDD000]/10 border-[#FDD000]/30"
                    : "bg-white/5 border-white/10"
                }`}
              >
                <span className="text-sm text-white font-medium">{label}</span>
                {savingArea === key ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#FDD000]" />
                ) : (
                  <Switch
                    checked={!!formData.trialContentAreas[key]}
                    onCheckedChange={(checked) => handleToggleContentArea(key, checked)}
                    className="data-[state=checked]:bg-[#FDD000] data-[state=unchecked]:bg-gray-600 border-gray-500"
                  />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Trial Study Access — checkboxes immediately */}
      <Card className="bg-black border border-[#FDD000]/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-white text-lg">
            <BookOpen className="w-5 h-5 text-[#FDD000]" />
            Trial Study Access
          </CardTitle>
          <CardDescription className="text-white/50">
            Choose which topical studies are available to trial users. Changes save automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {allStudies.length === 0 ? (
            <p className="text-white/40 text-sm">No studies found.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
              {allStudies.map((study) => (
                <label
                  key={study.id}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    selectedTrialStudyIds.has(study.id)
                      ? "bg-[#FDD000]/10 border-[#FDD000]/30"
                      : "bg-white/5 border-white/10"
                  } hover:bg-white/10`}
                >
                  {savingStudy === study.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#FDD000] flex-shrink-0" />
                  ) : (
                    <Checkbox
                      checked={selectedTrialStudyIds.has(study.id)}
                      onCheckedChange={(checked) => handleToggleStudy(study.id, !!checked)}
                      className="data-[state=checked]:bg-[#FDD000] data-[state=checked]:border-[#FDD000] border-gray-500"
                    />
                  )}
                  <span className="text-sm text-white font-medium">{study.title}</span>
                </label>
              ))}
            </div>
          )}
          {selectedTrialStudyIds.size > 0 && (
            <p className="text-xs text-[#FDD000]/70 mt-3">{selectedTrialStudyIds.size} {selectedTrialStudyIds.size === 1 ? 'study' : 'studies'} enabled for trial access.</p>
          )}
        </CardContent>
      </Card>

      {/* Subscription Features */}
      <Card className="bg-black border border-[#FDD000]/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-white text-lg">
            <Check className="w-5 h-5 text-[#FDD000]" />
            Subscription Features
          </CardTitle>
          <CardDescription className="text-white/50">
            List the features shown to users on the subscription page (one per line). Click "Edit Settings" above to modify.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isEditingPricing ? (
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
                  <Check className="w-4 h-4 text-[#FDD000] flex-shrink-0 mt-0.5" />
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
