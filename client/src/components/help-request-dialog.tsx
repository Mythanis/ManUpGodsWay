import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { HelpCircle, Send } from "lucide-react";

interface HelpRequestDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpRequestDialog({ isOpen, onClose }: HelpRequestDialogProps) {
  const [message, setMessage] = useState("");
  const { toast } = useToast();

  const submitHelp = useMutation({
    mutationFn: async (data: { message: string }) => {
      await apiRequest('POST', '/api/help-request', data);
    },
    onSuccess: () => {
      toast({
        title: "Help Request Sent!",
        description: "We received your message and will get back to you as soon as possible.",
      });
      setMessage("");
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send your help request. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!message.trim()) {
      toast({
        title: "Missing Information",
        description: "Please describe what you need help with before submitting.",
        variant: "destructive",
      });
      return;
    }
    submitHelp.mutate({ message: message.trim() });
  };

  const handleClose = () => {
    setMessage("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2" style={{ color: 'hsl(0 0% 95%)' }}>
            <HelpCircle className="w-5 h-5" />
            <span>Help & Support</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="help-message" className="text-sm font-medium" style={{ color: 'hsl(0 0% 95%)' }}>
              What do you need help or support with?
            </Label>
            <Textarea
              id="help-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your issue or question and we'll get back to you as soon as possible."
              className="mt-1 min-h-[120px]"
              maxLength={1000}
            />
            <p className="text-xs text-ministry-slate mt-1">
              {message.length}/1000 characters
            </p>
          </div>

          <div className="flex space-x-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="flex-1"
              disabled={submitHelp.isPending}
            >
              Cancel
            </Button>
            <button
              onClick={handleSubmit}
              disabled={submitHelp.isPending || !message.trim()}
              style={{
                backgroundColor: 'hsl(220 8% 26%)',
                color: 'hsl(0 0% 95%)',
                borderColor: 'hsl(210 5.2632% 14.9020%)',
                opacity: (submitHelp.isPending || !message.trim()) ? 0.5 : 1,
              }}
              className="flex-1 px-4 py-2 rounded-md border cursor-pointer transition-colors hover:opacity-90 flex items-center justify-center"
            >
              {submitHelp.isPending ? (
                "Sending..."
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Help Request
                </>
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
