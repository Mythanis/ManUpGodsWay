import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Flag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface FlagContentDialogProps {
  contentType: "discussion" | "reply";
  contentId: string;
  triggerElement?: React.ReactNode;
}

const FLAG_REASONS = [
  { value: "inappropriate", label: "Inappropriate Content" },
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment" },
  { value: "offensive", label: "Offensive Language" },
  { value: "other", label: "Other" },
];

export function FlagContentDialog({ 
  contentType, 
  contentId, 
  triggerElement 
}: FlagContentDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const flagMutation = useMutation({
    mutationFn: async (flagData: {
      contentType: string;
      contentId: string;
      reason: string;
      description?: string;
    }) => {
      return apiRequest('/api/content/flag', 'POST', flagData);
    },
    onSuccess: () => {
      toast({
        title: "Content Flagged",
        description: "Thank you for your report. Administrators have been notified.",
      });
      setOpen(false);
      setReason("");
      setDescription("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to flag content. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!reason) {
      toast({
        title: "Error",
        description: "Please select a reason for flagging this content.",
        variant: "destructive",
      });
      return;
    }

    flagMutation.mutate({
      contentType,
      contentId,
      reason,
      description: description.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerElement || (
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-red-600">
            <Flag className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Flag Content</DialogTitle>
          <DialogDescription>
            Help us keep the community safe by reporting inappropriate content.
            Your report will be reviewed by administrators.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="reason">Reason for flagging</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {FLAG_REASONS.map((flagReason) => (
                  <SelectItem key={flagReason.value} value={flagReason.value}>
                    {flagReason.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Additional details (optional)</Label>
            <Textarea
              id="description"
              placeholder="Provide additional context about why you're flagging this content..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="resize-none"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={flagMutation.isPending || !reason}
            className="bg-red-600 hover:bg-red-700"
          >
            {flagMutation.isPending ? "Flagging..." : "Flag Content"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}