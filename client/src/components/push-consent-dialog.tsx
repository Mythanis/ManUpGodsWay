import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { usePushNotifications } from "@/hooks/use-push-notifications";

interface PushConsentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called only after push is successfully enabled (or was already enabled) */
  onAllowed: () => void;
  /** Context-specific reason text shown to the user */
  reason?: string;
}

export function PushConsentDialog({
  open,
  onOpenChange,
  onAllowed,
  reason = "You'll receive push notifications so you never miss your scheduled activities.",
}: PushConsentDialogProps) {
  const { subscribe, isSubscribed } = usePushNotifications();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAllow = async () => {
    if (isSubscribed) {
      onAllowed();
      onOpenChange(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await subscribe();
      onAllowed();
      onOpenChange(false);
    } catch {
      setError("Could not enable notifications. Please check your browser settings and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = () => {
    // Do NOT save reminders — just close
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-blue-500" />
            <DialogTitle>Enable Push Notifications?</DialogTitle>
          </div>
          <DialogDescription className="pt-1">{reason}</DialogDescription>
        </DialogHeader>
        {error && (
          <p className="text-sm text-red-500 px-1">{error}</p>
        )}
        <DialogFooter className="flex gap-2 sm:flex-row-reverse">
          <Button onClick={handleAllow} disabled={loading}>
            {loading ? "Enabling…" : "Allow"}
          </Button>
          <Button variant="outline" onClick={handleDecline} disabled={loading}>
            Not Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
