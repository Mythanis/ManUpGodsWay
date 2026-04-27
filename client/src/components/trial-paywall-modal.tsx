import { useLocation } from "wouter";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock, CreditCard, X } from "lucide-react";

interface TrialPaywallModalProps {
  open: boolean;
  reason: "trial_restricted" | "not_subscribed" | null;
  backTo?: string;
}

export default function TrialPaywallModal({ open, reason, backTo = "/" }: TrialPaywallModalProps) {
  const [, setLocation] = useLocation();

  const handleClose = () => {
    setLocation(backTo);
  };

  const handleSubscribe = () => {
    // Replace the blocked-page history entry with the safe previous page,
    // so the browser back button from /subscribe goes there — not the paywall.
    window.history.replaceState(null, "", backTo);
    setLocation("/subscribe");
  };

  const message =
    reason === "not_subscribed"
      ? "Your subscription has expired. Please subscribe to regain full access."
      : "This page is restricted to subscribers. Please subscribe to continue.";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-sm p-0 border-0 bg-transparent shadow-none [&>button]:hidden">
        <div className="bg-black border-4 border-[#FDD000] shadow-[6px_6px_0px_0px_rgba(253,208,0,0.5)] rounded-sm overflow-hidden">
          <div className="bg-[#FDD000] px-6 py-4 flex items-center gap-3">
            <Lock className="w-6 h-6 text-black flex-shrink-0" />
            <h2 className="font-black uppercase text-black tracking-wide text-lg leading-tight">
              Subscription Required
            </h2>
          </div>
          <div className="px-6 py-6 space-y-6">
            <p className="text-white text-sm leading-relaxed">
              {message}
            </p>
            <div className="flex flex-col gap-3">
              <Button
                onClick={handleSubscribe}
                className="w-full h-12 bg-[#FDD000] text-black font-black uppercase tracking-wide border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Subscribe Now
              </Button>
              <Button
                variant="ghost"
                onClick={handleClose}
                className="w-full h-10 text-white/60 hover:text-white hover:bg-white/10 font-bold uppercase text-sm"
              >
                <X className="w-4 h-4 mr-2" />
                Close
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
