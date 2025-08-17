import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

interface LogoSettings {
  id: string;
  logoUrl: string;
  splashDurationMs: number;
  backgroundColor: string;
  isEnabled: boolean;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [isVisible, setIsVisible] = useState(true);
  
  // Fetch logo settings
  const { data: logoSettings, isLoading } = useQuery<LogoSettings>({
    queryKey: ["/api/logo"],
    retry: false,
  });

  // Ministry theme color options for background
  const getBackgroundStyle = (backgroundColor: string) => {
    const colorMap: Record<string, string> = {
      'white': '#ffffff',
      'light-gray': '#f3f4f6',
      'charcoal': 'hsl(215, 25%, 27%)',
      'gold': 'hsl(49, 100%, 49%)',
      'steel': 'hsl(213, 12%, 47%)',
      'slate': 'hsl(215, 16%, 47%)',
    };
    return colorMap[backgroundColor] || '#ffffff';
  };

  useEffect(() => {
    // Wait for data to load
    if (isLoading) {
      return;
    }

    // If no logo settings or logo is not enabled, skip splash screen
    if (!logoSettings?.logoUrl || !logoSettings.isEnabled) {
      onComplete();
      return;
    }

    // Show splash screen for the configured duration
    const timer = setTimeout(() => {
      setIsVisible(false);
      // Small delay for fade out animation
      setTimeout(onComplete, 300);
    }, logoSettings.splashDurationMs);

    return () => clearTimeout(timer);
  }, [logoSettings, isLoading, onComplete]);

  // Show loading state while fetching logo settings
  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-ministry-charcoal">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ministry-gold"></div>
      </div>
    );
  }

  // Don't render if no logo or not enabled
  if (!logoSettings?.logoUrl || !logoSettings.isEnabled) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{
        backgroundColor: getBackgroundStyle(logoSettings.backgroundColor || 'white')
      }}
    >
      <div className="flex flex-col items-center space-y-4">
        <img
          src={logoSettings.logoUrl}
          alt="Logo"
          className="max-w-xs max-h-64 object-contain animate-fade-in"
          style={{
            animation: 'fadeIn 0.6s ease-in-out'
          }}
        />
        <div className="w-12 h-12 border-4 border-ministry-gold border-t-transparent rounded-full animate-spin"></div>
      </div>
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}