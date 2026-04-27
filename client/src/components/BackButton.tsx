import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BackButton() {
  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/';
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleBack}
      className="rounded-full w-10 h-10 bg-black hover:bg-black/80 mb-4"
      data-testid="button-back"
    >
      <ArrowLeft className="h-5 w-5 text-[#FDD000]" />
    </Button>
  );
}
