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
  const [showCooldownDialog, setShowCooldownDialog] = useState(false);
  const [cooldownMessage, setCooldownMessage] = useState('');

  // Check if already brothers - this should now work with real-time updates via WebSocket
  const { data: brothers } = useQuery<any[]>({
    queryKey: ['/api/brothers'],
  });

  const isAlreadyBrother = brothers?.some(brother => brother.id === recipientId);
  const brotherhoodData = brothers?.find(brother => brother.id === recipientId);
  
  // Get the tag that the current user has assigned to this brother
  const brotherTag = brotherhoodData?.tag;

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
      
      if (status === 400 && data?.message?.includes('wait')) {
        // Show cooldown dialog for 40-day restriction
        setCooldownMessage(data.message);
        setShowCooldownDialog(true);
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

  const removeBrotherhoodMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('DELETE', `/api/brothers/${brotherhoodData?.brotherhoodId}`);
    },
    onSuccess: () => {
      toast({
        title: "Brotherhood Removed",
        description: `You are no longer brothers with ${recipientName || 'this user'}`,
      });
      // Invalidate both brothers list and user profiles for instant updates
      queryClient.invalidateQueries({ queryKey: ['/api/brothers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to remove brotherhood",
        variant: "destructive",
      });
    },
  });

  const [showRemoveDialog, setShowRemoveDialog] = useState(false);

  if (isAlreadyBrother) {
    const displayText = brotherTag ? `Brother-${brotherTag}` : 'Brother';
    
    return (
      <>
        <Button 
          variant="outline" 
          className="gap-2 hover:bg-red-50 hover:border-red-200"
          onClick={() => setShowRemoveDialog(true)}
          data-testid={`button-remove-brother-${recipientId}`}
        >
          <Check className="w-4 h-4 text-green-500" />
          {displayText}
        </Button>

        <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Brotherhood</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove your brotherhood with {recipientName || 'this user'}? 
                This action cannot be undone and they will need to send a new request to reconnect.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowRemoveDialog(false)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => {
                  removeBrotherhoodMutation.mutate();
                  setShowRemoveDialog(false);
                }}
                disabled={removeBrotherhoodMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                Yes, Remove Brotherhood
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
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
              you won't be able to send another request for 40 days.
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

      {/* Cooldown dialog for 40-day restriction */}
      <AlertDialog open={showCooldownDialog} onOpenChange={setShowCooldownDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Request Blocked</AlertDialogTitle>
            <AlertDialogDescription>
              The recipient has denied this request twice. You must wait 40 days before sending another.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowCooldownDialog(false)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}