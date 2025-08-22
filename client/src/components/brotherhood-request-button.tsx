import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
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

  // Check if already brothers
  const { data: brothers } = useQuery<any[]>({
    queryKey: ['/api/brothers'],
  });

  const isAlreadyBrother = brothers?.some(brother => brother.id === recipientId);

  const requestMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/brotherhood-requests', {
        method: 'POST',
        body: JSON.stringify({ recipientId }),
      });
    },
    onSuccess: () => {
      setIsRequested(true);
      toast({
        title: "Request Sent",
        description: `Brotherhood request sent to ${recipientName || 'user'}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/brotherhood-requests'] });
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || "Failed to send request";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });

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
    <Button
      onClick={() => requestMutation.mutate()}
      disabled={requestMutation.isPending}
      className="gap-2 bg-ministry-charcoal hover:bg-ministry-charcoal/90"
      data-testid={`button-request-brotherhood-${recipientId}`}
    >
      <UserPlus className="w-4 h-4" />
      {requestMutation.isPending ? 'Sending...' : 'Request Brotherhood'}
    </Button>
  );
}