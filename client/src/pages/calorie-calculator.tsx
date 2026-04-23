import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Flame, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ACTIVITY_LABELS,
  ACTIVITY_DESCRIPTIONS,
  ACTIVITY_MULTIPLIERS,
  GOAL_LABELS,
  GOAL_DESCRIPTIONS,
  computeTarget,
  feetInToCm,
  lbToKg,
  kgToLb,
  cmToIn,
  type Sex,
  type ActivityLevel,
  type GoalType,
} from "@shared/calorie-math";

type Step = "disclaimer" | "basics" | "goal" | "activity" | "result";

interface FormState {
  sex: Sex;
  age: string;
  weightUnit: "lb" | "kg";
  weight: string;
  heightUnit: "in" | "cm";
  heightFeet: string;
  heightInches: string;
  heightCm: string;
  activity: ActivityLevel;
  goalType: GoalType;
}

const DEFAULTS: FormState = {
  sex: "male",
  age: "",
  weightUnit: "lb",
  weight: "",
  heightUnit: "in",
  heightFeet: "",
  heightInches: "",
  heightCm: "",
  activity: "moderate",
  goalType: "lose",
};

const GOAL_ORDER: GoalType[] = ["lose", "maintain", "gain"];
const ACTIVITY_ORDER: ActivityLevel[] = ["sedentary", "light", "moderate", "very", "extra"];

function formStateFromProfile(p: any): FormState {
  if (!p) return DEFAULTS;
  const weightUnit = (p.weightUnit as "lb" | "kg") ?? "lb";
  const heightUnit = (p.heightUnit as "in" | "cm") ?? "in";
  const weight = weightUnit === "kg" ? p.weightKg : kgToLb(p.weightKg);
  let heightFeet = "", heightInches = "", heightCm = "";
  if (heightUnit === "cm") {
    heightCm = String(Math.round(p.heightCm));
  } else {
    const totalIn = cmToIn(p.heightCm);
    heightFeet = String(Math.floor(totalIn / 12));
    heightInches = String(Math.round(totalIn - Math.floor(totalIn / 12) * 12));
  }
  return {
    sex: p.sex,
    age: String(p.ageYears),
    weightUnit,
    weight: String(Math.round(weight * 10) / 10),
    heightUnit,
    heightFeet,
    heightInches,
    heightCm,
    activity: p.activityLevel,
    goalType: p.goalType,
  };
}

function toMetric(form: FormState): { weightKg: number; heightCm: number } | null {
  const w = parseFloat(form.weight);
  if (!isFinite(w) || w <= 0) return null;
  const weightKg = form.weightUnit === "kg" ? w : lbToKg(w);

  let heightCm: number;
  if (form.heightUnit === "cm") {
    const cm = parseFloat(form.heightCm);
    if (!isFinite(cm) || cm <= 0) return null;
    heightCm = cm;
  } else {
    const ft = parseFloat(form.heightFeet);
    const inch = parseFloat(form.heightInches || "0");
    if (!isFinite(ft) || ft <= 0) return null;
    if (!isFinite(inch) || inch < 0) return null;
    heightCm = feetInToCm(ft, inch);
  }
  return { weightKg, heightCm };
}

export default function CalorieCalculator() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: existingProfile, isLoading } = useQuery<any>({ queryKey: ["/api/nutrition-profile"] });

  const [step, setStep] = useState<Step>("disclaimer");
  const [acknowledged, setAcknowledged] = useState(false);
  const [contra, setContra] = useState({
    under13: false,
    eatingDisorder: false,
    medical: false,
  });
  const isContraindicated = Object.values(contra).some(Boolean);
  const [form, setForm] = useState<FormState>(DEFAULTS);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (isLoading || initialized) return;
    setForm(formStateFromProfile(existingProfile));
    if (existingProfile) setAcknowledged(true);
    setInitialized(true);
  }, [isLoading, existingProfile, initialized]);

  const metric = useMemo(() => toMetric(form), [form]);

  const computed = useMemo(() => {
    if (!metric) return null;
    const ageNum = parseInt(form.age, 10);
    if (!isFinite(ageNum) || ageNum < 13 || ageNum > 99) return null;
    return computeTarget({
      sex: form.sex,
      ageYears: ageNum,
      heightCm: metric.heightCm,
      weightKg: metric.weightKg,
      goalType: form.goalType,
      activity: form.activity,
    });
  }, [metric, form]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!metric || !computed) throw new Error("Missing inputs");
      const ageNum = parseInt(form.age, 10);
      return await apiRequest("PUT", "/api/nutrition-profile", {
        sex: form.sex,
        ageYears: ageNum,
        heightCm: metric.heightCm,
        weightKg: metric.weightKg,
        goalType: form.goalType,
        activityLevel: form.activity,
        weightUnit: form.weightUnit,
        heightUnit: form.heightUnit,
        acknowledgement: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutrition-profile"] });
      toast({ title: "Saved", description: "Your daily calorie target has been saved." });
      setLocation("/fitness?tab=intake");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message || "Failed to save", variant: "destructive" });
    },
  });

  function next() {
    if (step === "disclaimer") setStep("basics");
    else if (step === "basics") setStep("goal");
    else if (step === "goal") setStep("activity");
    else if (step === "activity") setStep("result");
  }
  function back() {
    if (step === "result") setStep("activity");
    else if (step === "activity") setStep("goal");
    else if (step === "goal") setStep("basics");
    else if (step === "basics") setStep("disclaimer");
    else setLocation("/fitness");
  }

  const ageNum = parseInt(form.age, 10);
  const ageValid = isFinite(ageNum) && ageNum >= 13 && ageNum <= 99;
  const basicsValid =
    form.sex && ageValid && metric &&
    (form.heightUnit === "cm" ? !!form.heightCm : !!form.heightFeet);

  return (
    <div className="min-h-screen bg-black text-white p-4 pb-24" data-testid="page-calorie-calculator">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={back}
            className="text-white/70 hover:text-white p-2"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Flame className="w-6 h-6 text-[#FCD000]" />
            <h1 className="text-xl font-black uppercase tracking-wide">Calorie Calculator</h1>
          </div>
        </div>

        {step === "disclaimer" && (
          <div className="liquid-black border-2 border-[#FCD000]/40 rounded-sm p-5 space-y-4" data-testid="step-disclaimer">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-[#FCD000] shrink-0 mt-0.5" />
              <div>
                <h2 className="font-black uppercase tracking-wide text-base">Before You Begin</h2>
                <p className="text-white/70 text-sm mt-2">
                  This calculator gives an estimate using the Mifflin–St Jeor equation and standard activity multipliers.
                  It is <strong>not medical advice</strong>. Check any of the following that apply to you:
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              {([
                ["under13", "I am under 13 years old"],
                ["eatingDisorder", "I have a history of an eating disorder"],
                ["medical", "I have a medical condition (diabetes, kidney, liver, heart, thyroid) or take medication affecting appetite/metabolism"],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-start gap-3 cursor-pointer">
                  <Checkbox
                    checked={contra[key]}
                    onCheckedChange={(v) => setContra({ ...contra, [key]: !!v })}
                    data-testid={`checkbox-contra-${key}`}
                    className="mt-1"
                  />
                  <span className="text-sm text-white/80">{label}</span>
                </label>
              ))}
            </div>

            {isContraindicated && (
              <div className="bg-red-900/30 border-2 border-red-500/40 rounded-sm p-3 flex items-start gap-2" data-testid="warning-contraindicated">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-red-100 text-xs">
                  Please talk to a doctor or registered dietitian before using a calorie target.
                  This calculator is not appropriate for your situation.
                </p>
              </div>
            )}

            <label className="flex items-start gap-3 cursor-pointer pt-2 border-t border-white/10">
              <Checkbox
                checked={acknowledged}
                onCheckedChange={(v) => setAcknowledged(!!v)}
                disabled={isContraindicated}
                data-testid="checkbox-acknowledge"
                className="mt-1"
              />
              <span className={`text-sm ${isContraindicated ? "text-white/30" : "text-white/80"}`}>
                I understand this is an estimate, not medical advice.
              </span>
            </label>

            <Button
              onClick={next}
              disabled={!acknowledged || isContraindicated}
              className="w-full bg-[#FCD000] text-black font-black uppercase hover:bg-[#FCD000]/90 rounded-sm border-2 border-black"
              data-testid="button-next-disclaimer"
            >
              Continue <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {step === "basics" && (
          <div className="liquid-black border-2 border-[#FCD000]/40 rounded-sm p-5 space-y-5" data-testid="step-basics">
            <h2 className="font-black uppercase tracking-wide text-base">Your Basics</h2>

            <div>
              <Label className="text-white/80 text-xs font-bold uppercase">Biological Sex</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {(["male", "female"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setForm({ ...form, sex: s })}
                    className={`flex items-center justify-center py-3 rounded-sm border-2 ${form.sex === s ? "bg-[#FCD000] text-black border-black" : "border-white/20 text-white/70 hover:border-white/40"}`}
                    data-testid={`button-sex-${s}`}
                  >
                    <span className="font-black uppercase text-sm">{s}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="age" className="text-white/80 text-xs font-bold uppercase">Age</Label>
              <Input
                id="age"
                type="number"
                inputMode="numeric"
                min={13}
                max={99}
                step={1}
                value={form.age}
                onChange={(e) => {
                  const v = e.target.value;
                  // Strip decimal portion to keep age as a whole number
                  const cleaned = v.replace(/[^\d]/g, "");
                  setForm({ ...form, age: cleaned });
                }}
                placeholder="13–99"
                className="mt-1 bg-black border-white/20 text-white"
                data-testid="input-age"
              />
              {form.age && !ageValid && (
                <p className="text-red-400 text-[11px] mt-1">Age must be a whole number between 13 and 99.</p>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center">
                <Label className="text-white/80 text-xs font-bold uppercase">Height</Label>
                <Select value={form.heightUnit} onValueChange={(v) => setForm({ ...form, heightUnit: v as "in" | "cm" })}>
                  <SelectTrigger className="w-20 h-8 bg-black border-white/20 text-white text-xs" data-testid="select-height-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">ft/in</SelectItem>
                    <SelectItem value="cm">cm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.heightUnit === "cm" ? (
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="cm"
                  value={form.heightCm}
                  onChange={(e) => setForm({ ...form, heightCm: e.target.value })}
                  className="mt-1 bg-black border-white/20 text-white"
                  data-testid="input-height-cm"
                />
              ) : (
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="ft"
                    value={form.heightFeet}
                    onChange={(e) => setForm({ ...form, heightFeet: e.target.value })}
                    className="bg-black border-white/20 text-white"
                    data-testid="input-height-feet"
                  />
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="in"
                    value={form.heightInches}
                    onChange={(e) => setForm({ ...form, heightInches: e.target.value })}
                    className="bg-black border-white/20 text-white"
                    data-testid="input-height-inches"
                  />
                </div>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center">
                <Label className="text-white/80 text-xs font-bold uppercase">Current Weight</Label>
                <Select value={form.weightUnit} onValueChange={(v) => setForm({ ...form, weightUnit: v as "lb" | "kg" })}>
                  <SelectTrigger className="w-20 h-8 bg-black border-white/20 text-white text-xs" data-testid="select-weight-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lb">lbs</SelectItem>
                    <SelectItem value="kg">kg</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Input
                type="number"
                inputMode="decimal"
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
                className="mt-1 bg-black border-white/20 text-white"
                data-testid="input-weight"
              />
            </div>

            <Button
              onClick={next}
              disabled={!basicsValid}
              className="w-full bg-[#FCD000] text-black font-black uppercase hover:bg-[#FCD000]/90 rounded-sm border-2 border-black"
              data-testid="button-next-basics"
            >
              Continue <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {step === "goal" && (
          <div className="liquid-black border-2 border-[#FCD000]/40 rounded-sm p-5 space-y-4" data-testid="step-goal">
            <h2 className="font-black uppercase tracking-wide text-base">Your Goal</h2>
            <RadioGroup
              value={form.goalType}
              onValueChange={(v) => setForm({ ...form, goalType: v as GoalType })}
              className="space-y-2"
            >
              {GOAL_ORDER.map((g) => {
                const selected = form.goalType === g;
                return (
                  <label
                    key={g}
                    className={`flex items-start gap-3 p-4 rounded-sm border-2 cursor-pointer transition-colors ${selected ? "bg-[#FCD000]/20 border-[#FCD000]" : "border-white/20 hover:border-white/40"}`}
                    data-testid={`card-goal-${g}`}
                  >
                    <RadioGroupItem value={g} className="mt-1" data-testid={`radio-goal-${g}`} />
                    <div className="flex-1">
                      <div className="font-black uppercase text-sm tracking-wide">{GOAL_LABELS[g]}</div>
                      <div className="text-white/60 text-xs mt-0.5">{GOAL_DESCRIPTIONS[g]}</div>
                    </div>
                  </label>
                );
              })}
            </RadioGroup>
            <Button
              onClick={next}
              className="w-full bg-[#FCD000] text-black font-black uppercase hover:bg-[#FCD000]/90 rounded-sm border-2 border-black"
              data-testid="button-next-goal"
            >
              Continue <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {step === "activity" && (
          <div className="liquid-black border-2 border-[#FCD000]/40 rounded-sm p-5 space-y-4" data-testid="step-activity">
            <h2 className="font-black uppercase tracking-wide text-base">Activity Level</h2>
            <p className="text-white/50 text-[11px] leading-relaxed -mt-2" data-testid="text-activity-hint">
              Choose based on what you will be doing, for example if you plan to start working out with this app 3 days a week choose Lightly Active or Moderately. This is to ensure calorie intake is not to low based on your planned activity level.
            </p>
            <RadioGroup
              value={form.activity}
              onValueChange={(v) => setForm({ ...form, activity: v as ActivityLevel })}
              className="space-y-2"
            >
              {ACTIVITY_ORDER.map((a) => {
                const selected = form.activity === a;
                return (
                  <label
                    key={a}
                    className={`flex items-start gap-3 p-4 rounded-sm border-2 cursor-pointer transition-colors ${selected ? "bg-[#FCD000]/20 border-[#FCD000]" : "border-white/20 hover:border-white/40"}`}
                    data-testid={`card-activity-${a}`}
                  >
                    <RadioGroupItem value={a} className="mt-1" data-testid={`radio-activity-${a}`} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-black uppercase text-sm tracking-wide">{ACTIVITY_LABELS[a]}</span>
                        <span className="text-[#FCD000] font-black text-xs tabular-nums">×{ACTIVITY_MULTIPLIERS[a]}</span>
                      </div>
                      <div className="text-white/60 text-xs mt-0.5">{ACTIVITY_DESCRIPTIONS[a]}</div>
                    </div>
                  </label>
                );
              })}
            </RadioGroup>
            <Button
              onClick={next}
              disabled={!computed}
              className="w-full bg-[#FCD000] text-black font-black uppercase hover:bg-[#FCD000]/90 rounded-sm border-2 border-black"
              data-testid="button-next-activity"
            >
              See My Target <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {step === "result" && computed && (
          <div className="space-y-4" data-testid="step-result">
            <div className="liquid-black border-2 border-[#FCD000] rounded-sm p-6 text-center space-y-5">
              <div>
                <div className="text-white/60 text-xs font-black uppercase tracking-wider">Your Daily Calorie Target</div>
                <div className="text-[#FCD000] font-black text-5xl tabular-nums mt-2 leading-none" data-testid="text-result-target">
                  {computed.targetKcal.toLocaleString()}
                </div>
                <div className="text-white/60 text-sm font-bold uppercase mt-1">calories</div>
                <div className="text-white/40 text-[11px] font-bold uppercase mt-2 tracking-wider">
                  {GOAL_LABELS[form.goalType]}
                </div>
              </div>

              <div className="border-t border-white/10 pt-4">
                <div className="text-white/70 font-black text-2xl tabular-nums leading-none" data-testid="text-result-tdee">
                  {Math.round(computed.maintenanceKcal).toLocaleString()}
                </div>
                <div className="text-white/50 text-[11px] mt-1">calories your body burns daily (TDEE)</div>
              </div>

              <div>
                <div className="text-white/60 font-bold text-lg tabular-nums leading-none" data-testid="text-result-bmr">
                  {Math.round(computed.bmr).toLocaleString()}
                </div>
                <div className="text-white/40 text-[10px] mt-1">calories burned at complete rest (BMR)</div>
              </div>
            </div>

            {computed.floorApplied && (
              <div className="bg-yellow-900/30 border-2 border-yellow-500/40 rounded-sm p-3 flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                <p className="text-yellow-100 text-xs">
                  Your calculated target fell below the minimum safe floor
                  ({form.sex === "male" ? "1,500" : "1,200"} kcal). It has been raised to that floor.
                </p>
              </div>
            )}

            <div className="bg-zinc-900 border-2 border-white/10 rounded-sm p-3 space-y-2">
              <p className="text-white/60 text-[11px] leading-relaxed">
                This is an estimate based on the Mifflin-St Jeor formula, accurate within ~10% for most people.
                Track your weight over 2 weeks and adjust by 100–200 calories if needed.
              </p>
              {form.goalType === "lose" && (
                <p className="text-white/60 text-[11px] leading-relaxed" data-testid="text-result-lose-note">
                  A 500 calorie daily deficit equals approximately 1 lb of fat loss per week.
                </p>
              )}
              {form.goalType === "gain" && (
                <p className="text-white/60 text-[11px] leading-relaxed" data-testid="text-result-gain-note">
                  A 250 calorie daily surplus minimizes fat gain while supporting muscle growth.
                </p>
              )}
            </div>

            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="w-full bg-[#FCD000] text-black font-black uppercase hover:bg-[#FCD000]/90 rounded-sm border-2 border-black"
              data-testid="button-save-target"
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save My Target
            </Button>

            <Button
              onClick={() => setStep("basics")}
              variant="outline"
              className="w-full border-white/20 text-white hover:bg-white/10 rounded-sm"
              data-testid="button-edit-inputs"
            >
              Edit Inputs
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
