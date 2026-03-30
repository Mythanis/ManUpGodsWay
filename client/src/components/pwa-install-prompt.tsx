import { useState } from 'react';
import { useLocation } from 'wouter';
import { X, Download, Share, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWAInstall } from '@/hooks/usePWAInstall';

export function PWAInstallPrompt() {
  const { deferredPrompt, isInstalled, isIOSSafari, install } = usePWAInstall();
  const [location] = useLocation();
  const [dismissed, setDismissed] = useState(() => {
    const dismissedAt = localStorage.getItem('pwa-install-dismissed');
    if (!dismissedAt) return false;
    const daysSince = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24);
    return daysSince < 7;
  });

  const handleInstall = async () => {
    await install();
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  // Profile page has its own inline install section — avoid duplicate CTA
  if (location === '/profile') return null;
  if (isInstalled || dismissed) return null;
  if (!deferredPrompt && !isIOSSafari) return null;

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
        ) : isIOSSafari ? (
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
