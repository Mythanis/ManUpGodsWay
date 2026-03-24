import { useQuery } from "@tanstack/react-query";

export type User = {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  subscriptionTier?: string;
  streakDays?: number;
  allowDirectMessages?: boolean;
  allowGroupInvites?: boolean;
  isProfileComplete?: boolean;
  hasCompletedTour?: boolean;
};

export function useAuth() {
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  return {
    user: user as User | undefined,
    isLoading,
    isAuthenticated: !!user,
  };
}
