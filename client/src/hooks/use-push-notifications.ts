import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export function usePushNotifications() {
  const queryClient = useQueryClient();
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission);
      
      navigator.serviceWorker.ready.then((reg) => {
        setRegistration(reg);
      });

      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
    }
  }, []);

  // Auto-heal: when the service worker is ready and the user has already granted
  // notification permission, check whether the current device's push subscription
  // endpoint is still recognised and active on the server.  If the push service
  // invalidated it (410/404) and the server deactivated it, silently create a
  // fresh subscription so the user doesn't have to toggle settings manually.
  useEffect(() => {
    if (!registration || !vapidKeyData?.vapidPublicKey) return;
    if (Notification.permission !== 'granted') return;

    (async () => {
      try {
        const existing = await registration.pushManager.getSubscription();
        if (!existing) return; // No browser subscription — nothing to heal

        const res = await fetch('/api/push/check-endpoint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: existing.endpoint }),
          credentials: 'include',
        });
        if (!res.ok) return;
        const { active, found } = await res.json();

        if (!active) {
          // Subscription is missing or deactivated — discard the stale browser
          // subscription and register a fresh one.
          await existing.unsubscribe();
          const fresh = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: (() => {
              const key = vapidKeyData.vapidPublicKey;
              const padding = '='.repeat((4 - (key.length % 4)) % 4);
              const base64 = (key + padding).replace(/-/g, '+').replace(/_/g, '/');
              const raw = window.atob(base64);
              const out = new Uint8Array(raw.length);
              for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
              return out;
            })(),
          });
          await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription: fresh.toJSON() }),
            credentials: 'include',
          });
          console.log('[Push] Auto-healed stale subscription');
        }
      } catch (err) {
        console.warn('[Push] Auto-heal check failed (non-critical):', err);
      }
    })();
  }, [registration, vapidKeyData]);

  const { data: pushStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['/api/push/status'],
    enabled: isSupported,
    staleTime: 30000,
  });

  const { data: vapidKeyData } = useQuery<{ vapidPublicKey: string }>({
    queryKey: ['/api/push/vapid-public-key'],
    enabled: isSupported,
    staleTime: Infinity,
  });

  const subscribeMutation = useMutation({
    mutationFn: async (subscription: PushSubscription) => {
      return apiRequest('POST', '/api/push/subscribe', { subscription: subscription.toJSON() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/push/status'] });
    },
  });

  const unsubscribeMutation = useMutation({
    mutationFn: async (endpoint: string) => {
      return apiRequest('POST', '/api/push/unsubscribe', { endpoint });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/push/status'] });
    },
  });

  const unsubscribeAllMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/push/unsubscribe-all', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/push/status'] });
    },
  });

  const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !registration || !vapidKeyData?.vapidPublicKey) {
      console.error('Push notifications not supported or not ready');
      return false;
    }

    try {
      const currentPermission = await Notification.requestPermission();
      setPermission(currentPermission);

      if (currentPermission !== 'granted') {
        console.log('Push notification permission denied');
        return false;
      }

      // Always discard the old browser subscription and create a fresh one.
      // This prevents the case where the existing subscription endpoint has been
      // invalidated by the push service (410/404) but is still cached in the browser.
      // Re-sending a stale endpoint would appear to succeed (server marks it active)
      // but the first notification would deactivate it again immediately.
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        await existingSubscription.unsubscribe();
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKeyData.vapidPublicKey),
      });

      await subscribeMutation.mutateAsync(subscription);
      return true;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      return false;
    }
  }, [isSupported, registration, vapidKeyData, subscribeMutation]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    try {
      // Always clear server-side subscriptions for this user
      await unsubscribeAllMutation.mutateAsync();

      // Also remove the browser-level subscription if one exists
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
        }
      }
      return true;
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      return false;
    }
  }, [registration, unsubscribeAllMutation]);

  const isSubscribed = (pushStatus as { hasSubscription?: boolean })?.hasSubscription ?? false;
  const isPending = subscribeMutation.isPending || unsubscribeMutation.isPending || unsubscribeAllMutation.isPending;

  return {
    isSupported,
    permission,
    isSubscribed,
    isPending,
    subscribe,
    unsubscribe,
    refetchStatus,
  };
}
