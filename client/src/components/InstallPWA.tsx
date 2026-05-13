/**
 * InstallPWA.tsx
 * 
 * Drop this component anywhere in your app (onboarding, home banner, settings, etc.)
 * 
 * - Android/Chrome: One button → browser's native install dialog → user taps Install ✅
 * - iOS (any browser): Button opens a polished step-by-step modal with visuals
 * - Already installed: Component returns null (hides itself)
 * - Dismissed: Saves to localStorage, won't show again for 7 days
 * 
 * Usage:
 *   import { InstallPWABanner } from "@/components/InstallPWABanner";
 *   <InstallPWABanner />
 * 
 *   Or for a standalone button (e.g. in settings):
 *   import { InstallPWAButton } from "@/components/InstallPWABanner";
 *   <InstallPWAButton />
 */

import { useState, useEffect, useCallback } from "react";
import { X, Share, Plus, Home, Smartphone, Download, ChevronRight } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// ─── Hook: useInstallPWA ─────────────────────────────────────────────────────

export function useInstallPWA() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if already installed / running in standalone mode
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Check iOS
    const ios = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    setIsIOS(ios);

    // Check if user already dismissed recently (7-day cooldown)
    const dismissedAt = localStorage.getItem("pwa_install_dismissed");
    if (dismissedAt) {
      const daysSince = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) {
        setIsDismissed(true);
        return;
      }
    }

    // Listen for Android/Chrome install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setIsInstalled(true));

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const triggerInstall = useCallback(async () => {
    if (!installPrompt) return false;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setInstallPrompt(null);
      setIsInstalled(true);
      return true;
    }
    return false;
  }, [installPrompt]);

  const dismiss = useCallback(() => {
    localStorage.setItem("pwa_install_dismissed", Date.now().toString());
    setIsDismissed(true);
  }, []);

  const canInstall = !isInstalled && !isDismissed && (!!installPrompt || isIOS);

  return { canInstall, isInstalled, isIOS, installPrompt, triggerInstall, dismiss };
}

// ─── iOS Install Modal ───────────────────────────────────────────────────────

function IOSInstallModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: "#111111", border: "1px solid #2a2a2a" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4"
          style={{ borderBottom: "1px solid #1e1e1e" }}>
          <div>
            <h2 className="font-bold text-white text-lg leading-tight">
              Add to Home Screen
            </h2>
            <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
              Install the app in 2 quick steps
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 transition-colors"
            style={{ background: "#1e1e1e", color: "rgba(255,255,255,0.6)" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Steps */}
        <div className="px-5 py-5 space-y-4">

          {/* Step 1 */}
          <div className="flex items-start gap-4">
            <div
              className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
              style={{ background: "#FCD000", color: "#000" }}
            >
              1
            </div>
            <div className="flex-1 pt-1">
              <p className="text-white font-medium text-sm">
                Tap the{" "}
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold"
                  style={{ background: "rgba(252,208,0,0.15)", color: "#FCD000" }}
                >
                  <Share size={12} />
                  Share
                </span>{" "}
                button at the bottom of your browser
              </p>
              {/* Visual representation of share button */}
              <div
                className="mt-2.5 rounded-xl p-3 flex items-center justify-center gap-3"
                style={{ background: "#1a1a1a", border: "1px solid #2a2a2a" }}
              >
                <div className="flex items-end gap-4">
                  {/* Simulated iOS toolbar */}
                  {["←", "→"].map((icon, i) => (
                    <span key={i} style={{ color: "rgba(255,255,255,0.3)", fontSize: "18px" }}>
                      {icon}
                    </span>
                  ))}
                  <div
                    className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg"
                    style={{ background: "rgba(252,208,0,0.2)", border: "1px solid rgba(252,208,0,0.4)" }}
                  >
                    <Share size={18} style={{ color: "#FCD000" }} />
                    <span style={{ color: "#FCD000", fontSize: "9px", fontWeight: 600 }}>Share</span>
                  </div>
                  {["⊡", "⋯"].map((icon, i) => (
                    <span key={i} style={{ color: "rgba(255,255,255,0.3)", fontSize: "18px" }}>
                      {icon}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Connector line */}
          <div className="flex items-center gap-4 pl-5">
            <div className="w-0.5 h-4" style={{ background: "#2a2a2a", marginLeft: "15px" }} />
          </div>

          {/* Step 2 */}
          <div className="flex items-start gap-4">
            <div
              className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
              style={{ background: "#FCD000", color: "#000" }}
            >
              2
            </div>
            <div className="flex-1 pt-1">
              <p className="text-white font-medium text-sm">
                Scroll down and tap{" "}
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold"
                  style={{ background: "rgba(252,208,0,0.15)", color: "#FCD000" }}
                >
                  <Plus size={12} />
                  Add to Home Screen
                </span>
              </p>
              {/* Visual of the menu option */}
              <div
                className="mt-2.5 rounded-xl overflow-hidden"
                style={{ border: "1px solid #2a2a2a" }}
              >
                {/* Fake menu items above */}
                {["Copy", "Share via Messages"].map((label, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5"
                    style={{ background: "#1a1a1a", borderBottom: "1px solid #222" }}>
                    <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "13px" }}>{label}</span>
                  </div>
                ))}
                {/* The highlighted option */}
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{ background: "rgba(252,208,0,0.12)", borderBottom: "1px solid rgba(252,208,0,0.2)" }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: "#FCD000" }}
                    >
                      <Plus size={16} style={{ color: "#000" }} strokeWidth={2.5} />
                    </div>
                    <span className="font-semibold text-sm" style={{ color: "#FCD000" }}>
                      Add to Home Screen
                    </span>
                  </div>
                  <ChevronRight size={14} style={{ color: "#FCD000" }} />
                </div>
                {/* Fake menu items below */}
                {["Find on Page", "Print"].map((label, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5"
                    style={{ background: "#1a1a1a", borderTop: "1px solid #222" }}>
                    <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "13px" }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-1">
          <div
            className="rounded-xl px-4 py-3 flex items-center gap-3"
            style={{ background: "#1a1a1a", border: "1px solid #2a2a2a" }}
          >
            <Home size={16} style={{ color: "#FCD000", flexShrink: 0 }} />
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px", lineHeight: "1.5" }}>
              The Man Up God's Way icon will appear on your home screen just like a native app — no App Store needed.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-full mt-3 py-3 rounded-xl text-sm font-semibold transition-colors"
            style={{ background: "#1e1e1e", color: "rgba(255,255,255,0.5)" }}
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Standalone Button (for Settings page, Profile, etc.) ───────────────────

export function InstallPWAButton({ className }: { className?: string }) {
  const { canInstall, isIOS, triggerInstall } = useInstallPWA();
  const [showIOSModal, setShowIOSModal] = useState(false);

  if (!canInstall) return null;

  return (
    <>
      <button
        onClick={isIOS ? () => setShowIOSModal(true) : triggerInstall}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${className}`}
        style={{ background: "#FCD000", color: "#000" }}
      >
        <Smartphone size={16} />
        Add to Home Screen
      </button>

      {showIOSModal && <IOSInstallModal onClose={() => setShowIOSModal(false)} />}
    </>
  );
}

// ─── Banner Component (for home screen / onboarding) ─────────────────────────

export function InstallPWABanner() {
  const { canInstall, isIOS, triggerInstall, dismiss } = useInstallPWA();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Slight delay so it doesn't flash on load
  useEffect(() => {
    if (canInstall) {
      const t = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(t);
    }
  }, [canInstall]);

  if (!canInstall || !isVisible) return null;

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSModal(true);
    } else {
      await triggerInstall();
    }
  };

  return (
    <>
      <div
        className="fixed bottom-20 left-4 right-4 z-40 rounded-2xl p-4 flex items-center gap-3"
        style={{
          background: "#111111",
          border: "1px solid #2a2a2a",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          animation: "slideUp 0.3s ease-out",
        }}
      >
        {/* App icon placeholder */}
        <div
          className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg"
          style={{ background: "#FCD000", color: "#000" }}
        >
          ⚔️
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm leading-tight">
            Add to Home Screen
          </p>
          <p className="text-xs mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.5)" }}>
            {isIOS ? "Tap for 2-step install guide" : "One tap to install — no App Store needed"}
          </p>
        </div>

        {/* CTA */}
        <button
          onClick={handleInstall}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs transition-all active:scale-95"
          style={{ background: "#FCD000", color: "#000" }}
        >
          <Download size={13} />
          Install
        </button>

        {/* Dismiss */}
        <button
          onClick={dismiss}
          className="flex-shrink-0 p-1 rounded-full"
          style={{ color: "rgba(255,255,255,0.35)" }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Slide-up animation */}
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {showIOSModal && <IOSInstallModal onClose={() => setShowIOSModal(false)} />}
    </>
  );
}
