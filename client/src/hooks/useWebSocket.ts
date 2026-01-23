import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface WebSocketMessage {
  type: string;
  data?: any;
  message?: string;
  partnerName?: string;
}

export function useWebSocket(userId?: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (!userId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      // Authenticate the connection
      ws.send(JSON.stringify({
        type: 'auth',
        userId: userId
      }));
      
      // Refresh all queries when reconnecting to catch any missed updates
      queryClient.invalidateQueries({ queryKey: ['/api/brotherhood-requests'] });
      queryClient.refetchQueries({ queryKey: ['/api/brotherhood-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        console.log('WebSocket message received:', message);

        switch (message.type) {
          case 'auth_success':
            console.log('WebSocket authentication successful');
            break;
          
          case 'brotherhood_request':
            // Show toast notification for new brotherhood request
            toast({
              title: "🤝 New Brotherhood Request",
              description: message.message,
              duration: 5000,
            });
            
            // Invalidate all related queries to refresh the UI immediately
            queryClient.invalidateQueries({ queryKey: ['/api/brotherhood-requests'] });
            queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
            queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
            queryClient.invalidateQueries({ queryKey: ['/api/brothers'] });
            
            // Force immediate refresh of brotherhood requests data to update profile views
            queryClient.refetchQueries({ queryKey: ['/api/brotherhood-requests'] });
            
            // Also force refresh of user profile data if we're viewing profiles
            queryClient.invalidateQueries({ queryKey: ['/api/users'] });
            break;
            
          case 'notification':
            if (message.data?.type === 'brotherhood_request') {
              // Show toast notification for new brotherhood request
              toast({
                title: "🤝 New Brotherhood Request",
                description: message.data.message,
                duration: 5000,
              });
              
              // Invalidate all related queries to refresh the UI immediately
              queryClient.invalidateQueries({ queryKey: ['/api/brotherhood-requests'] });
              queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
              queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
              queryClient.invalidateQueries({ queryKey: ['/api/brothers'] });
              
              // Force immediate refresh of brotherhood requests data to update profile views
              queryClient.refetchQueries({ queryKey: ['/api/brotherhood-requests'] });
              
              // Also force refresh of user profile data if we're viewing profiles
              queryClient.invalidateQueries({ queryKey: ['/api/users'] });
            }
            break;

          case 'brotherhood_established':
            // Invalidate both brotherhood requests and brothers list to update UI
            queryClient.invalidateQueries({ queryKey: ['/api/brotherhood-requests'] });
            queryClient.invalidateQueries({ queryKey: ['/api/brothers'] });
            
            // Force immediate refresh to ensure real-time updates on Brothers page
            queryClient.refetchQueries({ queryKey: ['/api/brothers'] });
            queryClient.refetchQueries({ queryKey: ['/api/brotherhood-requests'] });
            
            // Show toast notification
            toast({
              title: 'Brotherhood Established!',
              description: `You are now brothers with ${message.partnerName}`,
            });
            break;

          case 'brotherhood_removed':
            // Invalidate brothers list and user profile to update UI immediately
            queryClient.invalidateQueries({ queryKey: ['/api/brothers'] });
            
            // Also invalidate user profile queries in case we're viewing the removed brother's profile
            queryClient.invalidateQueries({ queryKey: ['/api/users'] });
            
            // Show toast notification
            toast({
              title: 'Brotherhood Removed',
              description: message.message,
              variant: 'destructive'
            });
            break;

          case 'brotherhood_request_denied':
            // Invalidate brotherhood requests to update UI immediately (e.g., Request Sent → Request Brotherhood)
            queryClient.invalidateQueries({ queryKey: ['/api/brotherhood-requests'] });
            
            // Show toast notification
            toast({
              title: 'Request Denied',
              description: `${message.partnerName} denied your brotherhood request`,
              variant: 'destructive'
            });
            break;

          case 'hurdle_wall_post_created':
            // Invalidate hurdle wall posts to show new post
            queryClient.invalidateQueries({ queryKey: ['/api/hurdle-wall'] });
            queryClient.invalidateQueries({ queryKey: ['/api/hurdle-wall/user'] });
            break;

          case 'hurdle_wall_reply_created':
            // Invalidate hurdle wall posts to show new reply
            queryClient.invalidateQueries({ queryKey: ['/api/hurdle-wall'] });
            queryClient.invalidateQueries({ queryKey: ['/api/hurdle-wall/user'] });
            break;

          case 'hurdle_wall_post_deleted':
            // Invalidate hurdle wall posts to remove deleted post
            queryClient.invalidateQueries({ queryKey: ['/api/hurdle-wall'] });
            queryClient.invalidateQueries({ queryKey: ['/api/hurdle-wall/user'] });
            break;

          case 'hurdle_wall_reply_deleted':
            // Invalidate hurdle wall posts to remove deleted reply
            queryClient.invalidateQueries({ queryKey: ['/api/hurdle-wall'] });
            queryClient.invalidateQueries({ queryKey: ['/api/hurdle-wall/user'] });
            break;

          case 'accountability_request_assist':
            // Invalidate accountability requests to show updated assist status
            queryClient.invalidateQueries({ queryKey: ['/api/accountability-requests'] });
            break;

          case 'accountability_request_unassist':
            // Invalidate accountability requests to show updated assist status
            queryClient.invalidateQueries({ queryKey: ['/api/accountability-requests'] });
            break;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected - attempting reconnection in 2 seconds...');
      // Automatically reconnect after a short delay
      setTimeout(() => {
        if (userId) {
          console.log('Reconnecting WebSocket...');
          // Trigger a re-render to establish new connection
          const reconnectEvent = new CustomEvent('websocket-reconnect');
          window.dispatchEvent(reconnectEvent);
        }
      }, 2000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    // Cleanup on unmount
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [userId, queryClient, toast]);

  return wsRef.current;
}