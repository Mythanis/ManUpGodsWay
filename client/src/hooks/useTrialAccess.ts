import { useQuery } from "@tanstack/react-query";

interface SubscriptionSettings {
  trialContentAreas: Record<string, boolean>;
}

export function useTrialAccess(area: string) {
  const { data: user } = useQuery<any>({ queryKey: ["/api/auth/user"] });
  const { data: settings } = useQuery<SubscriptionSettings>({
    queryKey: ["/api/subscription-settings"],
    staleTime: 0,
  });

  // Cancelled users keep full access until their expiration date
  const cancelledButActive =
    user?.subscriptionStatus === "cancelled" &&
    user?.subscriptionExpiresAt &&
    new Date(user.subscriptionExpiresAt) > new Date();

  const isActiveSubscriber =
    user?.subscriptionStatus === "active" ||
    cancelledButActive ||
    user?.role === "admin" ||
    user?.role === "owner";

  const isTrialUser = user?.subscriptionStatus === "trial";

  // Truly expired: either explicitly expired, or cancelled past the expiration date
  const isExpiredUser =
    user?.subscriptionStatus === "expired" ||
    (user?.subscriptionStatus === "cancelled" && !cancelledButActive);

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
