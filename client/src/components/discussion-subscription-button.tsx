import { Bell, BellOff } from 'lucide-react';
import { useDiscussionSubscription } from '@/hooks/useDiscussionSubscription';
import { useTheme } from '@/hooks/useTheme';

interface DiscussionSubscriptionButtonProps {
  discussionId: string;
  className?: string;
}

export function DiscussionSubscriptionButton({ 
  discussionId, 
  className = '' 
}: DiscussionSubscriptionButtonProps) {
  const { theme } = useTheme();
  const { isSubscribed, isLoading, toggleSubscription, isToggling } = useDiscussionSubscription(discussionId);

  if (isLoading) {
    return (
      <button
        disabled
        className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${className}`}
        style={{
          backgroundColor: theme === 'dark' ? 'hsl(220 13% 18%)' : 'hsl(220 13% 91%)',
          color: theme === 'dark' ? 'hsl(220 9% 46%)' : 'hsl(220 9% 46%)',
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
        backgroundColor: isSubscribed 
          ? (theme === 'dark' ? 'hsl(49 100% 49%)' : 'hsl(49 100% 49%)')
          : (theme === 'dark' ? 'hsl(220 13% 18%)' : 'hsl(220 13% 91%)'),
        color: isSubscribed 
          ? 'black'
          : (theme === 'dark' ? 'white' : 'black'),
        border: `1px solid ${theme === 'dark' ? 'hsl(220 13% 28%)' : 'hsl(220 13% 81%)'}`,
        opacity: isToggling ? 0.6 : 1,
        cursor: isToggling ? 'default' : 'pointer',
        // Remove invalid CSS property
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