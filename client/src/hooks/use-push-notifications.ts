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

      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        await subscribeMutation.mutateAsync(existingSubscription);
        return true;
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
    if (!registration) {
      return false;
    }

    try {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await unsubscribeMutation.mutateAsync(subscription.endpoint);
        await subscription.unsubscribe();
      }
      return true;
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      return false;
    }
  }, [registration, unsubscribeMutation]);

  const isSubscribed = (pushStatus as { hasSubscription?: boolean })?.hasSubscription ?? false;
  const isPending = subscribeMutation.isPending || unsubscribeMutation.isPending;

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
