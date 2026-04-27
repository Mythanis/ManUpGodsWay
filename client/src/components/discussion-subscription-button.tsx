import { Bell, BellOff } from 'lucide-react';
import { useDiscussionSubscription } from '@/hooks/useDiscussionSubscription';

interface DiscussionSubscriptionButtonProps {
  discussionId: string;
  className?: string;
}

export function DiscussionSubscriptionButton({ 
  discussionId, 
  className = '' 
}: DiscussionSubscriptionButtonProps) {
  const { isSubscribed, isLoading, toggleSubscription, isToggling } = useDiscussionSubscription(discussionId);

  if (isLoading) {
    return (
      <button
        disabled
        className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${className}`}
        style={{
          backgroundColor: 'hsl(220 13% 18%)',
          color: 'hsl(220 9% 46%)',
          cursor: 'default'
        }}
      >
        <Bell size={16} />
        Loading...
      </button>
    );
  }

  return (
    <button
      onClick={toggleSubscription}
      disabled={isToggling}
      className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 ${className}`}
      style={{
        backgroundColor: isSubscribed ? 'hsl(49 100% 50%)' : 'hsl(220 13% 18%)',
        color: isSubscribed ? 'black' : 'white',
        border: '1px solid hsl(220 13% 28%)',
        opacity: isToggling ? 0.6 : 1,
        cursor: isToggling ? 'default' : 'pointer',
      }}
      title={isSubscribed ? 'Unsubscribe from notifications' : 'Subscribe to get notified of new replies'}
    >
      {isSubscribed ? (
        <>
          <Bell size={16} />
          Subscribed
        </>
      ) : (
        <>
          <BellOff size={16} />
          Subscribe
        </>
      )}
    </button>
  );
}
