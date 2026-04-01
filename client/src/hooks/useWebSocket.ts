import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface WebSocketMessage {
  type: string;
  data?: any;
  message?: string;
  partnerName?: string;
}

const PING_INTERVAL = 25000;
const RECONNECT_BASE_DELAY = 2000;
const RECONNECT_MAX_DELAY = 30000;

export function useWebSocket(userId?: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (!userId) return;

    let unmounted = false;

    function connect() {
      if (unmounted) return;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      function startPing() {
        stopPing();
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, PING_INTERVAL);
      }

      function stopPing() {
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
      }

      ws.onopen = () => {
        console.log('WebSocket connected');
        reconnectAttempts.current = 0;
        ws.send(JSON.stringify({
          type: 'auth',
          userId: userId
        }));
        startPing();
        queryClient.invalidateQueries({ queryKey: ['/api/brotherhood-requests'] });
        queryClient.refetchQueries({ queryKey: ['/api/brotherhood-requests'] });
        queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          if (message.type === 'pong') return;
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

          case 'war_group_post_created': {
            const groupId = message.data?.groupId;
            if (groupId) {
              queryClient.invalidateQueries({ queryKey: [`/api/war-groups/${groupId}/posts`] });
            }
            break;
          }

          case 'war_group_reply_created': {
            const { groupId: rGroupId, postId } = message.data ?? {};
            if (rGroupId && postId) {
              queryClient.invalidateQueries({ queryKey: [`/api/war-groups/${rGroupId}/posts/${postId}/replies`] });
            }
            break;
          }

          case 'accountability_request_created':
            // Invalidate accountability requests so new posts appear immediately across all clients
            queryClient.invalidateQueries({ queryKey: ['/api/accountability-requests'] });
            queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
            queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
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
        stopPing();
        if (unmounted) return;
        const delay = Math.min(RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts.current), RECONNECT_MAX_DELAY);
        reconnectAttempts.current++;
        console.log(`WebSocket disconnected - reconnecting in ${delay / 1000}s...`);
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    }

    connect();

    return () => {
      unmounted = true;
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, [userId, queryClient, toast]);

  return wsRef.current;
}