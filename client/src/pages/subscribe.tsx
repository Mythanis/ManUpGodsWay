import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Shield, Check, Loader2, Clock, CreditCard, ArrowLeft,
  Crown, BookOpen, Video, Users, Flame, Star, Sword,
  ChevronRight
} from "lucide-react";

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

// ── Real testimonials only — replace placeholders as more come in ────────────
const TESTIMONIALS = [
  {
    name: "Ben N.",
    quote: "This app is a vital tool in my walk with Christ. My church community can't always be there, my small group can't always be there, but my phone is with me all the time. This app gives me the opportunity to reach out to other like-minded, Christ-seeking men who will answer the call.",
    verified: true,
  },

  {
    name: "Rodney H.",
    quote: "I just want an app geared to my lifestyle — and with Man Up God's Way, I get what I need. Not your ordinary devotionals and Bible studies. An app that keeps me in the Word to grow me spiritually and to be the man God wants me to be. I'm surrounded by brothers who are real Godly men I can turn to when I have a struggle, need prayer, or need accountability. This is my go-to app every day.",
    verified: true,
  },
  
  // TODO: Add real testimonials here as they come in from the community
  // {
  //   name: "First Last",
  //   quote: "Real quote from a real member.",
  //   verified: true,
  // },
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
      const response = await apiRequest("POST", "/api/create-subscription-checkout", data);
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
  const yearlyPrice  = parseFloat(subscriptionInfo?.yearlyPrice  || "99.99");
  const yearlySavings  = (monthlyPrice * 12 - yearlyPrice).toFixed(2);
  const savingsPercent = Math.round(((monthlyPrice * 12 - yearlyPrice) / (monthlyPrice * 12)) * 100);
  const monthlyEquiv   = (yearlyPrice / 12).toFixed(2);

  const isTrialEligible = trialEligibility?.eligible ?? false;
  const trialDays       = trialEligibility?.trialDays ?? 7;

  const isAlreadyActive =
    (user as any)?.subscriptionStatus === "active" ||
    ((user as any)?.subscriptionStatus === "cancelled" &&
      (user as any)?.subscriptionExpiresAt &&
      new Date((user as any).subscriptionExpiresAt) > new Date());

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#FDD000]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-24">
      <div className="max-w-lg mx-auto px-4 py-6">

        {/* Back */}
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-2 text-white/60 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back</span>
        </button>

        {/* ── ALREADY SUBSCRIBED ────────────────────────────────────────────── */}
        {isAlreadyActive ? (
          <Card className="bg-white/5 border border-green-500/30">
            <CardContent className="pt-6 text-center">
              <Shield className="w-10 h-10 text-green-400 mx-auto mb-3" />
              <h2 className="text-xl font-black text-white mb-2">You're Already Subscribed!</h2>
              <p className="text-white/60 text-sm mb-4">You have full access to all content and features.</p>
              <Button
                onClick={() => setLocation("/profile")}
                className="bg-[#FDD000] text-black hover:bg-[#FDD000]/90 font-bold"
              >
                Manage Subscription
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* ── HERO ────────────────────────────────────────────────────────── */}
            <div className="text-center mb-6">
              <div
                className="w-16 h-16 mx-auto mb-4 rounded-sm flex items-center justify-center"
                style={{ background: "rgba(253,208,0,0.12)", border: "1px solid rgba(253,208,0,0.3)" }}
              >
                <Crown className="w-8 h-8 text-[#FDD000]" />
              </div>
              <h1
                className="text-3xl font-black text-white uppercase tracking-tight mb-2"
                style={{ fontFamily: "'Oswald', sans-serif" }}
              >
                Unlock the Full Mission
              </h1>
              <p className="text-white/55 text-sm leading-relaxed max-w-xs mx-auto">
                Part of a community of <span className="text-[#FDD000] font-bold">851,000+ men</span> on Facebook
                who are serious about biblical manhood.
              </p>
            </div>

            {/* ── SOCIAL PROOF STRIP ──────────────────────────────────────────── */}
            <div
              className="grid grid-cols-3 gap-0 mb-6 overflow-hidden rounded-sm"
              style={{ border: "1px solid #222" }}
            >
              {[
                { num: "851K", label: "Facebook Followers" },
                { num: "53K",  label: "Community Members" },
                { num: "106",  label: "Podcasts" },
              ].map((stat, i) => (
                <div
                  key={stat.label}
                  className="flex flex-col items-center py-3 px-2"
                  style={{
                    background: "#0d0d0d",
                    borderRight: i < 2 ? "1px solid #222" : "none",
                  }}
                >
                  <span
                    className="font-black text-lg leading-tight"
                    style={{ color: "#FDD000", fontFamily: "'Oswald', sans-serif" }}
                  >
                    {stat.num}
                  </span>
                  <span className="text-[10px] text-white/40 text-center leading-tight mt-0.5">
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>

            {/* ── FEATURE ICONS ───────────────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              {[
                { icon: BookOpen, label: "Bible Studies" },
                { icon: Video,    label: "Videos & Podcasts" },
                { icon: Users,    label: "Brotherhood" },
                { icon: Shield,   label: "War Room" },
                { icon: Flame,    label: "Daily Devotionals" },
                { icon: Sword,    label: "Weekly Challenges" },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="rounded-sm px-2 py-3 flex flex-col items-center gap-1.5"
                  style={{ background: "#0d0d0d", border: "1px solid #1e1e1e" }}
                >
                  <Icon className="w-5 h-5 text-[#FDD000]" />
                  <span className="text-[10px] text-white/60 text-center leading-tight font-medium">
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {/* ── BILLING TOGGLE ──────────────────────────────────────────────── */}
            <div className="flex justify-center mb-5">
              <div
                className="flex p-1 rounded-sm"
                style={{ background: "#111", border: "1px solid #222" }}
              >
                <button
                  onClick={() => setBillingCycle("monthly")}
                  className="px-5 py-2 rounded-sm text-sm font-black uppercase tracking-wide transition-all"
                  style={{
                    background: billingCycle === "monthly" ? "#FDD000" : "transparent",
                    color: billingCycle === "monthly" ? "#000" : "rgba(255,255,255,0.5)",
                  }}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingCycle("yearly")}
                  className="px-5 py-2 rounded-sm text-sm font-black uppercase tracking-wide transition-all flex items-center gap-2"
                  style={{
                    background: billingCycle === "yearly" ? "#FDD000" : "transparent",
                    color: billingCycle === "yearly" ? "#000" : "rgba(255,255,255,0.5)",
                  }}
                >
                  Yearly
                  {savingsPercent > 0 && (
                    <span
                      className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
                      style={{
                        background: billingCycle === "yearly" ? "#000" : "rgba(34,197,94,0.2)",
                        color: billingCycle === "yearly" ? "#FDD000" : "#4ade80",
                      }}
                    >
                      -{savingsPercent}%
                    </span>
                  )}
                </button>
              </div>
            </div>

            {billingCycle === "yearly" && savingsPercent > 0 && (
              <p className="text-center text-green-400 text-xs mb-4 font-semibold">
                Best value — only ${monthlyEquiv}/month, billed as ${yearlyPrice.toFixed(2)}/year
              </p>
            )}

            {/* ── PRIMARY CTA — FREE TRIAL ────────────────────────────────────── */}
            {isTrialEligible && (
              <div
                className="rounded-sm overflow-hidden mb-3"
                style={{ border: "2px solid #FDD000", boxShadow: "4px 4px 0px 0px rgba(253,208,0,0.25)" }}
              >
                {/* Badge */}
                <div
                  className="flex items-center justify-between px-4 py-2"
                  style={{ background: "#FDD000" }}
                >
                  <span className="text-black font-black text-xs uppercase tracking-widest">
                    ⚔️ Recommended — Start Here
                  </span>
                  <Clock className="w-4 h-4 text-black" />
                </div>

                {/* Content */}
                <div className="px-4 py-4" style={{ background: "#0d0d0d" }}>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span
                      className="text-3xl font-black text-white"
                      style={{ fontFamily: "'Oswald', sans-serif" }}
                    >
                      {trialDays} Days Free
                    </span>
                  </div>
                  <p className="text-sm mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                    Full access to everything — then{" "}
                    <span className="text-[#FDD000] font-bold">
                      ${billingCycle === "yearly" ? yearlyPrice.toFixed(2) : monthlyPrice.toFixed(2)}/
                      {billingCycle === "yearly" ? "yr" : "mo"}
                    </span>{" "}
                    after. Cancel anytime.
                  </p>

                  {/* No card required callout */}
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-sm mb-4 mt-3"
                    style={{ background: "rgba(253,208,0,0.08)", border: "1px solid rgba(253,208,0,0.2)" }}
                  >
                    <Check className="w-4 h-4 text-[#FDD000] flex-shrink-0" />
                    <span className="text-xs font-bold" style={{ color: "#FDD000" }}>
                      No credit card required to start your trial
                    </span>
                  </div>

                  <Button
                    onClick={() => handleSubscribe(true)}
                    disabled={createCheckoutMutation.isPending}
                    className="w-full py-4 text-base font-black uppercase tracking-wider text-black rounded-sm"
                    style={{
                      background: "#FDD000",
                      border: "2px solid #000",
                      boxShadow: "3px 3px 0px 0px rgba(0,0,0,1)",
                      fontFamily: "'Oswald', sans-serif",
                    }}
                    size="lg"
                  >
                    {createCheckoutMutation.isPending ? (
                      <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Processing...</>
                    ) : (
                      <>Start {trialDays}-Day Free Trial <ChevronRight className="w-5 h-5 ml-1" /></>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* ── SECONDARY CTA — SUBSCRIBE DIRECT ────────────────────────────── */}
            <div
              className="rounded-sm overflow-hidden mb-6"
              style={{ border: "1px solid #222" }}
            >
              <div className="px-4 py-4" style={{ background: "#0d0d0d" }}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-white font-black text-sm uppercase tracking-wide">
                      Skip the Trial
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                      Subscribe now for instant full access
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className="text-xl font-black text-[#FDD000]"
                      style={{ fontFamily: "'Oswald', sans-serif" }}
                    >
                      ${billingCycle === "yearly" ? yearlyPrice.toFixed(2) : monthlyPrice.toFixed(2)}
                    </p>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                      /{billingCycle === "yearly" ? "year" : "month"}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => handleSubscribe(false)}
                  disabled={createCheckoutMutation.isPending}
                  variant="outline"
                  className="w-full font-black uppercase tracking-wide rounded-sm text-sm h-11"
                  style={{
                    borderColor: "rgba(255,255,255,0.15)",
                    color: "rgba(255,255,255,0.6)",
                    background: "transparent",
                  }}
                  size="lg"
                >
                  {createCheckoutMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
                  ) : (
                    <><CreditCard className="w-4 h-4 mr-2" />Subscribe Now — ${billingCycle === "yearly" ? yearlyPrice.toFixed(2) : monthlyPrice.toFixed(2)}/{billingCycle === "yearly" ? "yr" : "mo"}</>
                  )}
                </Button>
              </div>
            </div>

            {/* ── WHAT'S INCLUDED ─────────────────────────────────────────────── */}
            <div className="mb-6">
              <h3
                className="text-xs font-black text-white/50 uppercase tracking-widest mb-3"
              >
                Everything Included:
              </h3>
              <div className="space-y-2">
                {[
                  "Full Bible study library with day-by-day lessons and progress tracking",
                  "Daily devotionals delivered to your phone every morning",
                  "War Room — real prayer requests, real intercession by name",
                  "Under Fire — private one-on-one accountability partnerships",
                  "War Groups — find a local brotherhood near you",
                  "106 podcasts + growing video library organized by topic",
                  "Weekly challenges with Rations and Ranks progression",
                  "365-day Bible reading plans with streak tracking",
                  "Direct messaging and group conversations",
                  "Live streaming events and in-app event ticketing",
                ].map((feature, index) => (
                  <div key={index} className="flex items-start gap-2.5">
                    <div
                      className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: "rgba(253,208,0,0.15)" }}
                    >
                      <Check className="w-2.5 h-2.5 text-[#FDD000]" />
                    </div>
                    <span className="text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>
                      {feature}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── TESTIMONIALS ────────────────────────────────────────────────── */}
            {TESTIMONIALS.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs font-black text-white/50 uppercase tracking-widest mb-3">
                  What Brothers Say:
                </h3>
                <div className="space-y-3">
                  {TESTIMONIALS.map(({ name, quote, verified }) => (
                    <div
                      key={name}
                      className="rounded-sm px-4 py-3"
                      style={{ background: "#0d0d0d", border: "1px solid #1e1e1e" }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <Star key={i} className="w-3 h-3 text-[#FDD000] fill-[#FDD000]" />
                          ))}
                        </div>
                        {verified && (
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: "rgba(253,208,0,0.1)", color: "#FDD000" }}
                          >
                            ✓ Verified Member
                          </span>
                        )}
                      </div>
                      <p
                        className="text-sm italic mb-2 leading-relaxed"
                        style={{ color: "rgba(255,255,255,0.75)" }}
                      >
                        "{quote}"
                      </p>
                      <p className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>
                        — {name}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── RISK-FREE GUARANTEE ─────────────────────────────────────────── */}
            <div
              className="rounded-sm px-4 py-3 mb-6 flex items-start gap-3"
              style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.25)" }}
            >
              <Shield className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-green-400 text-sm font-bold">Risk-Free Guarantee</p>
                <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                  {isTrialEligible
                    ? `Try everything free for ${trialDays} days — no credit card required. Cancel before your trial ends and you'll never be charged.`
                    : "Cancel your subscription anytime from your profile settings. No questions asked."
                  }
                </p>
              </div>
            </div>

            {/* ── REPEAT PRIMARY CTA ──────────────────────────────────────────── */}
            {isTrialEligible && (
              <Button
                onClick={() => handleSubscribe(true)}
                disabled={createCheckoutMutation.isPending}
                className="w-full py-4 text-base font-black uppercase tracking-wider text-black rounded-sm mb-4"
                style={{
                  background: "#FDD000",
                  border: "2px solid #000",
                  boxShadow: "3px 3px 0px 0px rgba(0,0,0,1)",
                  fontFamily: "'Oswald', sans-serif",
                }}
                size="lg"
              >
                {createCheckoutMutation.isPending ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Processing...</>
                ) : (
                  <>Start {trialDays}-Day Free Trial — No Credit Card <ChevronRight className="w-5 h-5 ml-1" /></>
                )}
              </Button>
            )}

            {/* ── FINE PRINT ──────────────────────────────────────────────────── */}
            <div className="text-center space-y-1">
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
                Secure payment powered by Stripe
              </p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
                Have a promo code? You can enter it on the next screen.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
