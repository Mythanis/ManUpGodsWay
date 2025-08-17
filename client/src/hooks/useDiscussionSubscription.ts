// No need for React imports in this hook
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export function useDiscussionSubscription(discussionId: string) {
  const queryClient = useQueryClient();

  // Check subscription status
  const { data: subscriptionStatus, isLoading } = useQuery({
    queryKey: ['/api/discussions', discussionId, 'subscription-status'],
    enabled: !!discussionId,
  });

  const isSubscribed = (subscriptionStatus as { isSubscribed?: boolean })?.isSubscribed || false;

  // Subscribe to discussion
  const subscribeMutation = useMutation({
    mutationFn: () => fetch(`/api/discussions/${discussionId}/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/discussions', discussionId, 'subscription-status'],
      });
    },
  });

  // Unsubscribe from discussion
  const unsubscribeMutation = useMutation({
    mutationFn: () => fetch(`/api/discussions/${discussionId}/subscribe`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/discussions', discussionId, 'subscription-status'],
      });
    },
  });

  const toggleSubscription = () => {
    if (isSubscribed) {
      unsubscribeMutation.mutate();
    } else {
      subscribeMutation.mutate();
    }
  };

  return {
    isSubscribed,
    isLoading,
    toggleSubscription,
    isToggling: subscribeMutation.isPending || unsubscribeMutation.isPending,
  };
}