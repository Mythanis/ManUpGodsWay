import { useQuery } from "@tanstack/react-query";

export type User = {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  subscriptionTier?: string;
  subscriptionStatus?: string;
  subscriptionExpiresAt?: string | null;
  stripeSubscriptionId?: string | null;
  streakDays?: number;
  allowDirectMessages?: boolean;
  allowGroupInvites?: boolean;
  isProfileComplete?: boolean;
  hasCompletedTour?: boolean;
  musicProvider?: string | null;
  musicEmbedUrl?: string | null;
  musicAutoPlay?: boolean | null;
};

export function useAuth() {
  const { data: user, isPending } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: 3,
    retryDelay: (attempt) => Math.min(1500 * 2 ** attempt, 10000),
    staleTime: 30 * 1000,
  });

  return {
    user: user as User | undefined,
    isLoading: isPending,
    isAuthenticated: !!user,
  };
}
