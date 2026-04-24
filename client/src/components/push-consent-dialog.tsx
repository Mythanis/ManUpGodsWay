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
  /** Called after the user allows (or was already subscribed) */
  onAllowed: () => void;
  /** Called when user clicks "Not Now" */
  onDeclined?: () => void;
  /** Context-specific reason text shown to the user */
  reason?: string;
}

export function PushConsentDialog({
  open,
  onOpenChange,
  onAllowed,
  onDeclined,
  reason = "You'll receive push notifications so you never miss your scheduled activities.",
}: PushConsentDialogProps) {
  const { subscribe, isSubscribed } = usePushNotifications();
  const [loading, setLoading] = useState(false);

  const handleAllow = async () => {
    if (isSubscribed) {
      onAllowed();
      onOpenChange(false);
      return;
    }
    setLoading(true);
    try {
      await subscribe();
    } catch {
      // subscription may fail if browser blocks — still let user continue
    } finally {
      setLoading(false);
    }
    onAllowed();
    onOpenChange(false);
  };

  const handleDecline = () => {
    onDeclined?.();
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
