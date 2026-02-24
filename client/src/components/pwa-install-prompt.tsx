import { useState, useEffect } from 'react';
import { X, Download, Share, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as any).standalone === true;
    setIsStandalone(standalone);

    const dismissedAt = localStorage.getItem('pwa-install-dismissed');
    if (dismissedAt) {
      const daysSince = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) {
        setDismissed(true);
      }
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    const isIOS = /iP(hone|od|ad)/.test(navigator.userAgent) && !(navigator as any).standalone;
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    if (isIOS && isSafari && !standalone) {
      setTimeout(() => setShowIOSPrompt(true), 3000);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    setDeferredPrompt(null);
    setShowIOSPrompt(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  if (isStandalone || dismissed) return null;
  if (!deferredPrompt && !showIOSPrompt) return null;

  return (
    <div className="fixed bottom-20 left-2 right-2 z-50 max-w-md mx-auto animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-black border-2 border-[#FCD000] rounded-xl p-4 shadow-2xl">
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 text-gray-400 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3">
          <img src="/icon-192.png" alt="Man Up" className="w-12 h-12 rounded-xl" />
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-[#FCD000] text-sm">Install Man Up God's Way</h3>
            <p className="text-gray-300 text-xs mt-0.5">
              Add to your home screen for the best experience
            </p>
          </div>
        </div>

        {deferredPrompt ? (
          <Button
            onClick={handleInstall}
            className="w-full mt-3 bg-[#FCD000] text-black hover:bg-[#e5bc00] font-bold"
          >
            <Download className="h-4 w-4 mr-2" />
            Install App
          </Button>
        ) : showIOSPrompt ? (
          <div className="mt-3 text-center">
            <p className="text-gray-200 text-xs">
              Tap <Share className="h-3.5 w-3.5 inline-block mx-1 text-[#FCD000]" /> then
              <span className="inline-flex items-center mx-1 text-[#FCD000]">
                <Plus className="h-3.5 w-3.5 mr-0.5" />Add to Home Screen
              </span>
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
