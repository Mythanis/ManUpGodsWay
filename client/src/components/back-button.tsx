import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface BackButtonProps {
  fallbackPath?: string;
  className?: string;
}

export function BackButton({ fallbackPath = "/", className = "" }: BackButtonProps) {
  const [, setLocation] = useLocation();

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      setLocation(fallbackPath);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleBack}
      className={`fixed top-20 left-4 z-[9999] h-12 w-12 rounded-full bg-white dark:bg-gray-800 shadow-lg border-2 border-ministry-gold hover:bg-gray-100 dark:hover:bg-gray-700 transition-all hover:scale-110 ${className}`}
      data-testid="button-back"
      aria-label="Go back"
    >
      <ArrowLeft className="h-6 w-6 text-gray-800 dark:text-white" />
      <span className="sr-only">Go back</span>
    </Button>
  );
}
