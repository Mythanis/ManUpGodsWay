import { useQuery } from "@tanstack/react-query";

interface SubscriptionSettings {
  trialContentAreas: Record<string, boolean>;
}

export function useTrialAccess(area: string) {
  const { data: user } = useQuery<any>({ queryKey: ["/api/auth/user"] });
  const { data: settings } = useQuery<SubscriptionSettings>({
    queryKey: ["/api/subscription-settings"],
    staleTime: 5 * 60 * 1000,
  });

  const isActiveSubscriber = user?.subscriptionStatus === "active" || user?.role === "admin" || user?.role === "owner";
  const isTrialUser = user?.subscriptionStatus === "trial";
  const isExpiredUser = user?.subscriptionStatus === "expired" || user?.subscriptionStatus === "cancelled";

  const trialAreaEnabled = settings?.trialContentAreas?.[area] === true;

  let blocked = false;
  let reason: "trial_restricted" | "not_subscribed" | null = null;

  if (!isActiveSubscriber) {
    if (isTrialUser && !trialAreaEnabled) {
      blocked = true;
      reason = "trial_restricted";
    } else if (isExpiredUser) {
      blocked = true;
      reason = "not_subscribed";
    }
  }

  return {
    blocked,
    reason,
    isLoading: !user || !settings,
    isActiveSubscriber,
    isTrialUser,
  };
}
