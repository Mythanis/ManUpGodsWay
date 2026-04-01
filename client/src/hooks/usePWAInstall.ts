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

function getIsIOSBrowser(): boolean {
  const ua = navigator.userAgent;
  // Any iOS device — ALL iOS browsers (Safari, Chrome/CriOS, Firefox/FxiOS, Edge)
  // use the same Share → Add to Home Screen mechanism since iOS enforces WebKit
  return /iP(hone|od|ad)/.test(ua);
}

function getIsChromeAndroid(): boolean {
  const ua = navigator.userAgent;
  // Chrome on Android (but not Edge which also has "Chrome" in its UA)
  return (
    /Android/.test(ua) &&
    /Chrome/.test(ua) &&
    !/EdgA/.test(ua) &&
    !/OPR/.test(ua)
  );
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
  // Initialize synchronously so standalone-mode components never render a flash
  const [isInstalled, setIsInstalled] = useState(() =>
    typeof window !== "undefined" ? getIsInstalled() : false
  );

  useEffect(() => {
    // Re-check in case matchMedia wasn't ready on SSR-like fast-render
    setIsInstalled(getIsInstalled());

    // Re-sync with module singleton in case prompt fired before this hook mounted
    if (_deferredPrompt) setDeferredPrompt(_deferredPrompt);

    const notify = () => setDeferredPrompt(_deferredPrompt);
    _subscribers.add(notify);
    return () => {
      _subscribers.delete(notify);
    };
  }, []);

  const isIOSBrowser =
    typeof navigator !== "undefined" ? getIsIOSBrowser() : false;

  // Keep legacy export name for any callers that already use isIOSSafari
  const isIOSSafari = isIOSBrowser;

  const isChromeAndroid =
    typeof navigator !== "undefined" ? getIsChromeAndroid() : false;

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

  return { deferredPrompt, isInstalled, isIOSSafari, isIOSBrowser, isChromeAndroid, install };
}
