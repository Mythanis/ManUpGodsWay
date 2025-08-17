import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, Send } from "lucide-react";

interface FeedbackDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FeedbackDialog({ isOpen, onClose }: FeedbackDialogProps) {
  const [feedback, setFeedback] = useState("");
  const [category, setCategory] = useState("");
  const { toast } = useToast();
  const { effectiveTheme } = useTheme();

  const submitFeedback = useMutation({
    mutationFn: async (data: { feedback: string; category: string }) => {
      await apiRequest('POST', '/api/feedback', data);
    },
    onSuccess: () => {
      toast({
        title: "Feedback Sent!",
        description: "Thank you for your feedback. We'll review it and get back to you.",
      });
      setFeedback("");
      setCategory("");
      onClose();
    },
    onError: (error: any) => {
      let errorMessage = "Failed to send feedback. Please try again.";
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!feedback.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter your feedback before submitting.",
        variant: "destructive",
      });
      return;
    }

    if (!category) {
      toast({
        title: "Missing Information", 
        description: "Please select a feedback category.",
        variant: "destructive",
      });
      return;
    }

    submitFeedback.mutate({ feedback: feedback.trim(), category });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2" style={{ 
            color: effectiveTheme === 'dark' ? 'hsl(0 0% 95%)' : 'hsl(210 25% 7.8431%)'
          }}>
            <MessageCircle className="w-5 h-5" />
            <span>Send Feedback</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="feedback-category" className="text-sm font-medium" style={{
              color: effectiveTheme === 'dark' ? 'hsl(0 0% 95%)' : 'hsl(210 25% 7.8431%)'
            }}>
              What type of feedback is this?
            </Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select feedback type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="improvement">Improvement Suggestion</SelectItem>
                <SelectItem value="feature-request">Feature Request</SelectItem>
                <SelectItem value="bug-report">Bug Report</SelectItem>
                <SelectItem value="compliment">Compliment</SelectItem>
                <SelectItem value="complaint">Issue/Complaint</SelectItem>
                <SelectItem value="general">General Feedback</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="feedback-text" className="text-sm font-medium" style={{
              color: effectiveTheme === 'dark' ? 'hsl(0 0% 95%)' : 'hsl(210 25% 7.8431%)'
            }}>
              Your Feedback
            </Label>
            <Textarea
              id="feedback-text"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Tell us what you think! What would you like to see improved? What features would you like? What do you love or dislike about the app?"
              className="mt-1 min-h-[120px]"
              maxLength={1000}
            />
            <p className="text-xs text-ministry-slate mt-1">
              {feedback.length}/1000 characters
            </p>
          </div>

          <div className="flex space-x-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={submitFeedback.isPending}
            >
              Cancel
            </Button>
            <button
              onClick={handleSubmit}
              disabled={submitFeedback.isPending || !feedback.trim() || !category}
              style={{
                backgroundColor: effectiveTheme === 'dark' 
                  ? 'hsl(220 8% 26%)' 
                  : 'hsl(240 1.9608% 90%)',
                color: effectiveTheme === 'dark' 
                  ? 'hsl(0 0% 95%)' 
                  : 'hsl(210 25% 7.8431%)',
                borderColor: effectiveTheme === 'dark' 
                  ? 'hsl(210 5.2632% 14.9020%)' 
                  : 'hsl(201.4286 30.4348% 90.9804%)',
                opacity: (submitFeedback.isPending || !feedback.trim() || !category) ? 0.5 : 1
              }}
              className="flex-1 px-4 py-2 rounded-md border cursor-pointer transition-colors hover:opacity-90 flex items-center justify-center"
            >
              {submitFeedback.isPending ? (
                "Sending..."
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Feedback
                </>
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}