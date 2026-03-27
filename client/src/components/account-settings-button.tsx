import { Settings } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function AccountSettingsButton() {
  const [, setLocation] = useLocation();

  const handleClick = () => {
    setLocation("/profile");
  };

  return (
    <div className="fixed top-20 right-4 z-50">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={handleClick}
            className="h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm border-ministry-charcoal/40 hover:bg-accent/80 shadow-sm"
          >
            <Settings className="h-4 w-4 text-ministry-gold-exact" />
            <span className="sr-only">Account Settings</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>Account Settings</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}