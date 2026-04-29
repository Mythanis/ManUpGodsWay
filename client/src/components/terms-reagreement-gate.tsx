import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Scale, Check, LogOut, AlertTriangle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  CURRENT_TERMS_VERSION,
  TERMS_SECTIONS,
  TERMS_INTRO,
  TERMS_CLOSING,
  TERMS_EFFECTIVE_DATE,
} from "@shared/termsContent";
import type { User } from "@/hooks/useAuth";

interface TermsReagreementGateProps {
  user: User;
}

export function TermsReagreementGate({ user }: TermsReagreementGateProps) {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [showDisagreeConfirm, setShowDisagreeConfirm] = useState(false);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollHint, setShowScrollHint] = useState(true);

  const acceptMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/terms/accept", {
        version: CURRENT_TERMS_VERSION,
        source: "forced_reagreement",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
  });

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 40;
    if (nearBottom) {
      setHasScrolledToBottom(true);
      setShowScrollHint(false);
    }
  };

  const handleAgree = () => {
    acceptMutation.mutate();
  };

  const handleDisagree = () => {
    setShowDisagreeConfirm(true);
  };

  const handleConfirmDisagree = () => {
    setShowDisagreeConfirm(false);
    setIsLockedOut(true);
  };

  if (isLockedOut) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center px-6">
        <div className="max-w-sm w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-red-900/40 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tight">Access Restricted</h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            You must accept the updated Terms & Conditions to continue using Man Up God's Way. 
            You can review and accept them at any time by logging out and back in.
          </p>
          <p className="text-gray-500 text-xs">
            For account-related questions, contact{" "}
            <a href="mailto:info@manupgodsway.org" className="text-ministry-gold underline">
              info@manupgodsway.org
            </a>
          </p>
          <Button
            variant="outline"
            className="w-full border-ministry-gold text-ministry-gold hover:bg-ministry-gold/10"
            onClick={() => {
              window.location.href = "/api/logout";
            }}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Log Out
          </Button>
          <Button
            variant="ghost"
            className="w-full text-gray-400 hover:text-white"
            onClick={() => {
              setIsLockedOut(false);
              setHasScrolledToBottom(false);
              setShowScrollHint(true);
            }}
          >
            Review Terms Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
        {/* Header */}
        <div className="flex-none bg-black border-b border-ministry-gold/40 px-6 py-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-sm bg-ministry-gold flex items-center justify-center flex-shrink-0">
              <Scale className="w-5 h-5 text-black" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white uppercase tracking-tight leading-tight">
                Updated Terms & Conditions
              </h1>
              <p className="text-gray-400 text-xs">Effective {TERMS_EFFECTIVE_DATE} — please review before continuing</p>
            </div>
          </div>
          <p className="text-yellow-400 text-xs mt-2 leading-relaxed">
            Our Terms of Use have been updated. You must review and accept them to continue using the app.
          </p>
        </div>

        {/* Scrollable Terms Body */}
        <div className="flex-1 relative overflow-hidden">
          <div
            ref={scrollRef}
            className="h-full overflow-y-auto px-6 py-5 space-y-5"
            onScroll={handleScroll}
          >
            <p className="text-gray-400 text-xs">Version: {CURRENT_TERMS_VERSION}</p>
            <p className="text-gray-300 text-sm leading-relaxed italic">{TERMS_INTRO}</p>

            {TERMS_SECTIONS.map((section) => (
              <section key={section.id}>
                <h2 className="text-sm font-bold text-ministry-gold uppercase mb-2">{section.heading}</h2>
                {section.intro && (
                  <p className="text-gray-300 text-sm leading-relaxed mb-1">{section.intro}</p>
                )}
                {section.body && (
                  <p className={`text-sm leading-relaxed mb-1 ${section.allCaps ? "text-gray-200 font-semibold" : "text-gray-300"}`}>
                    {section.body}
                  </p>
                )}
                {section.bullets && (
                  <ul className="list-disc list-inside text-gray-300 text-sm space-y-1 ml-2 mb-1">
                    {section.bullets.map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                )}
                {section.closing && (
                  <p className="text-gray-300 text-sm leading-relaxed mt-1 whitespace-pre-line">{section.closing}</p>
                )}
                {section.subsections && (
                  <div className="space-y-3 mt-2">
                    {section.subsections.map((sub) => (
                      <div key={sub.id}>
                        <h3 className="text-sm font-semibold text-ministry-gold/80 mb-1">{sub.heading}</h3>
                        {sub.body && (
                          <p className={`text-sm leading-relaxed mb-1 ${sub.allCaps ? "text-gray-200 font-semibold" : "text-gray-300"}`}>
                            {sub.body}
                          </p>
                        )}
                        {sub.bullets && (
                          <ul className="list-disc list-inside text-gray-300 text-sm space-y-1 ml-2 mb-1">
                            {sub.bullets.map((b, i) => <li key={i}>{b}</li>)}
                          </ul>
                        )}
                        {sub.closing && (
                          <p className="text-gray-300 text-sm leading-relaxed mt-1 whitespace-pre-line">{sub.closing}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ))}

            <p className="text-ministry-gold text-sm font-semibold italic leading-relaxed pb-4">
              {TERMS_CLOSING}
            </p>
          </div>

          {/* Scroll-to-bottom hint */}
          {showScrollHint && !hasScrolledToBottom && (
            <div className="absolute bottom-0 left-0 right-0 pointer-events-none flex flex-col items-center pb-3 bg-gradient-to-t from-black via-black/80 to-transparent pt-8">
              <p className="text-gray-400 text-xs mb-1">Scroll to read all Terms</p>
              <ChevronDown className="w-5 h-5 text-ministry-gold animate-bounce" />
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="flex-none bg-black border-t border-ministry-gold/40 px-6 py-4 space-y-3">
          <Button
            onClick={handleAgree}
            disabled={!hasScrolledToBottom || acceptMutation.isPending}
            className="w-full bg-ministry-gold hover:bg-ministry-gold/90 text-black font-bold uppercase py-3 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {acceptMutation.isPending ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-black/40 border-t-black rounded-full animate-spin" />
                Saving...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Check className="w-5 h-5" />
                I Have Read and Accept the Terms
              </span>
            )}
          </Button>
          {!hasScrolledToBottom && (
            <p className="text-center text-gray-500 text-xs">Scroll to the bottom to enable acceptance</p>
          )}
          <Button
            variant="ghost"
            onClick={handleDisagree}
            className="w-full text-gray-500 hover:text-red-400 text-sm"
          >
            I Do Not Accept
          </Button>
        </div>
      </div>

      {/* Disagree Confirmation Dialog */}
      <Dialog open={showDisagreeConfirm} onOpenChange={setShowDisagreeConfirm}>
        <DialogContent className="max-w-sm bg-gray-900 border-red-800 z-[10000]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Are you sure?
            </DialogTitle>
            <DialogDescription className="text-gray-400 text-sm leading-relaxed">
              If you do not accept the updated Terms & Conditions, you will not be able to access Man Up God's Way until you do. Your account will remain intact.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Button
              onClick={() => setShowDisagreeConfirm(false)}
              className="w-full bg-ministry-gold hover:bg-ministry-gold/90 text-black font-bold"
            >
              Go Back and Review
            </Button>
            <Button
              variant="outline"
              onClick={handleConfirmDisagree}
              className="w-full border-red-800 text-red-400 hover:bg-red-900/20"
            >
              Confirm — I Do Not Accept
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
