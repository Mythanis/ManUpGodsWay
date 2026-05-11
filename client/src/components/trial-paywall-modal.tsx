import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock, BookOpen, Video, Users, Shield, Flame, Clock, X } from "lucide-react";

interface TrialPaywallModalProps {
  open: boolean;
  reason: "trial_restricted" | "not_subscribed" | null;
  backTo?: string;
}

const FEATURE_BULLETS = [
  { icon: BookOpen, text: "Full 52-week Bible study library" },
  { icon: Video,    text: "Complete video & podcast library" },
  { icon: Users,    text: "Brotherhood community & War Groups" },
  { icon: Shield,   text: "War Room prayer & Under Fire network" },
  { icon: Flame,    text: "Weekly challenges & streak tracking" },
];

export default function TrialPaywallModal({ open, reason, backTo = "/" }: TrialPaywallModalProps) {
  const [, setLocation] = useLocation();

  const { data: trialEligibility } = useQuery<{ eligible: boolean; trialDays: number }>({
    queryKey: ["/api/subscription/trial-eligibility"],
    enabled: open,
  });

  const isTrialEligible = trialEligibility?.eligible ?? false;
  const trialDays = trialEligibility?.trialDays ?? 7;

  const handleClose = () => {
    setLocation(backTo);
  };

  const handleSubscribe = () => {
    window.history.replaceState(null, "", backTo);
    setLocation("/subscribe");
  };

  const isExpired = reason === "not_subscribed";
  const headline = isExpired ? "Trial Ended — Subscribe to Continue" : "Subscribers Only";
  const subtext = isExpired
    ? "Your free trial has ended. Join the brotherhood and keep growing."
    : "This area is exclusive to subscribers. Start your free trial — no charge for 7 days.";
  const ctaLabel = isTrialEligible ? `Start ${trialDays}-Day Free Trial` : "Subscribe Now";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-sm p-0 border-0 bg-transparent shadow-none [&>button]:hidden">
        <div className="bg-black border-4 border-[#FDD000] shadow-[6px_6px_0px_0px_rgba(253,208,0,0.5)] rounded-sm overflow-hidden">
          {/* Header */}
          <div className="bg-[#FDD000] px-6 py-4 flex items-center gap-3">
            <Lock className="w-6 h-6 text-black flex-shrink-0" />
            <h2 className="font-black uppercase text-black tracking-wide text-lg leading-tight">
              {headline}
            </h2>
          </div>

          <div className="px-6 py-5 space-y-5">
            <p className="text-white/80 text-sm leading-relaxed">{subtext}</p>

            {/* Feature bullets */}
            <div className="space-y-2">
              {FEATURE_BULLETS.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-[#FDD000] flex-shrink-0" />
                  <span className="text-sm text-white/80">{text}</span>
                </div>
              ))}
            </div>

            {/* Trial callout */}
            {isTrialEligible && (
              <div className="bg-[#FDD000]/10 border border-[#FDD000]/30 rounded-sm px-4 py-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#FDD000] flex-shrink-0" />
                <p className="text-xs text-[#FDD000] font-bold">
                  {trialDays}-day free trial — card required, no charge until it ends
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <Button
                onClick={handleSubscribe}
                className="w-full h-12 bg-[#FDD000] text-black font-black uppercase tracking-wide border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all"
              >
                {ctaLabel}
              </Button>
              <Button
                variant="ghost"
                onClick={handleClose}
                className="w-full h-10 text-white/50 hover:text-white hover:bg-white/10 font-bold uppercase text-sm"
              >
                <X className="w-4 h-4 mr-2" />
                Not now
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
