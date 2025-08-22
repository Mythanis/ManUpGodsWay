import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { UserPlus, Users, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface BrotherhoodRequestButtonProps {
  recipientId: string;
  recipientName?: string;
}

export default function BrotherhoodRequestButton({ 
  recipientId, 
  recipientName 
}: BrotherhoodRequestButtonProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRequested, setIsRequested] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Check if already brothers
  const { data: brothers } = useQuery<any[]>({
    queryKey: ['/api/brothers'],
  });

  const isAlreadyBrother = brothers?.some(brother => brother.id === recipientId);

  const requestMutation = useMutation({
    mutationFn: async ({ confirmed = false }: { confirmed?: boolean } = {}) => {
      return apiRequest('POST', '/api/brotherhood-requests', { recipientId, confirmed });
    },
    onSuccess: () => {
      setIsRequested(true);
      setShowConfirmDialog(false);
      toast({
        title: "Request Sent",
        description: `Brotherhood request sent to ${recipientName || 'user'}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/brotherhood-requests'] });
    },
    onError: (error: any) => {
      const status = error.response?.status;
      const data = error.response?.data;
      
      if (status === 409 && data?.requiresConfirmation) {
        // Show confirmation dialog for previously denied request
        setShowConfirmDialog(true);
        return;
      }
      
      const message = data?.message || "Failed to send request";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });

  const handleSendRequest = () => {
    requestMutation.mutate();
  };

  const handleConfirmSend = () => {
    requestMutation.mutate({ confirmed: true });
  };

  if (isAlreadyBrother) {
    return (
      <Button variant="outline" disabled className="gap-2">
        <Check className="w-4 h-4 text-green-500" />
        Brother
      </Button>
    );
  }

  if (isRequested) {
    return (
      <Button variant="outline" disabled className="gap-2">
        <Users className="w-4 h-4" />
        Request Sent
      </Button>
    );
  }

  return (
    <>
      <Button
        onClick={handleSendRequest}
        disabled={requestMutation.isPending}
        className="gap-2 bg-ministry-charcoal hover:bg-ministry-charcoal/90"
        data-testid={`button-request-brotherhood-${recipientId}`}
      >
        <UserPlus className="w-4 h-4" />
        {requestMutation.isPending ? 'Sending...' : 'Request Brotherhood'}
      </Button>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Previous Request Denied</AlertDialogTitle>
            <AlertDialogDescription>
              {recipientName || 'This user'} previously denied your brotherhood request. 
              Are you sure you want to send another request? If they deny again, 
              you won't be able to send another request for 30 days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmSend}
              disabled={requestMutation.isPending}
              className="bg-ministry-charcoal hover:bg-ministry-charcoal/90"
            >
              Yes, Send Request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}