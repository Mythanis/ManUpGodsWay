import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { User } from "lucide-react";

interface Props {
  currentFirstName?: string | null;
  currentLastName?: string | null;
}

export function NameCompletionModal({ currentFirstName, currentLastName }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState(currentFirstName?.trim() || '');
  const [lastName, setLastName] = useState(currentLastName?.trim() || '');

  const updateMutation = useMutation({
    mutationFn: () =>
      apiRequest('PUT', '/api/profile/update', { firstName: firstName.trim(), lastName: lastName.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      toast({
        title: "Profile updated",
        description: "Your name has been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "There was a problem saving your name. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!firstName.trim()) {
      toast({ title: "First name required", description: "Please enter your first name.", variant: "destructive" });
      return;
    }
    if (!lastName.trim()) {
      toast({ title: "Last name required", description: "Please enter your last name.", variant: "destructive" });
      return;
    }
    updateMutation.mutate();
  };

  return (
    <Dialog open modal>
      <DialogContent
        className="max-w-sm"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        hideClose
      >
        <DialogHeader>
          <div className="flex justify-center mb-2">
            <div className="w-12 h-12 rounded-full bg-ministry-gold/10 flex items-center justify-center">
              <User className="w-6 h-6 text-ministry-gold" />
            </div>
          </div>
          <DialogTitle className="text-center text-lg">Complete Your Profile</DialogTitle>
          <p className="text-center text-sm text-muted-foreground mt-1">
            Please add your first and last name so others in the community can identify you.
          </p>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <Label htmlFor="nc-firstName">First Name *</Label>
            <Input
              id="nc-firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Enter your first name"
              className="mt-1"
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>
          <div>
            <Label htmlFor="nc-lastName">Last Name *</Label>
            <Input
              id="nc-lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Enter your last name"
              className="mt-1"
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="w-full bg-ministry-gold hover:bg-ministry-gold/90 text-ministry-charcoal font-semibold"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save & Continue'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
