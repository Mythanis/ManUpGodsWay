import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface WebSocketMessage {
  type: string;
  data?: any;
  message?: string;
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
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        console.log('WebSocket message received:', message);

        switch (message.type) {
          case 'auth_success':
            console.log('WebSocket authentication successful');
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
              
              // Force refresh of brotherhood requests data
              queryClient.refetchQueries({ queryKey: ['/api/brotherhood-requests'] });
            }
            break;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
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