import { useState, useEffect } from "react";

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Module-level singleton — listener registered as soon as this module is
// imported (before any React component mounts), so the event is never missed
// in an SPA even if the user navigates to Profile after initial page load.
let _deferredPrompt: BeforeInstallPromptEvent | null = null;
const _subscribers: Set<() => void> = new Set();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    _deferredPrompt = e as BeforeInstallPromptEvent;
    _subscribers.forEach((fn) => fn());
  });
}

function getIsIOSSafari(): boolean {
  const ua = navigator.userAgent;
  const isiOS = /iP(hone|od|ad)/.test(ua);
  // Must be Safari: has "Safari" token but NOT Chrome/CriOS/FxiOS/GSA
  const isSafari =
    /Safari/.test(ua) &&
    !/Chrome/.test(ua) &&
    !/CriOS/.test(ua) &&
    !/FxiOS/.test(ua) &&
    !/GSA/.test(ua);
  return isiOS && isSafari;
}

function getIsInstalled(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(_deferredPrompt);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    setIsInstalled(getIsInstalled());

    // Re-sync with module singleton in case prompt fired before this hook mounted
    if (_deferredPrompt) setDeferredPrompt(_deferredPrompt);

    const notify = () => setDeferredPrompt(_deferredPrompt);
    _subscribers.add(notify);
    return () => {
      _subscribers.delete(notify);
    };
  }, []);

  const isIOSSafari = typeof navigator !== "undefined" ? getIsIOSSafari() : false;

  const install = async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      _deferredPrompt = null;
      setDeferredPrompt(null);
      setIsInstalled(true);
      return true;
    }
    return false;
  };

  return { deferredPrompt, isInstalled, isIOSSafari, install };
}
