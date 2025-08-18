import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Bell, Check, CheckCheck, MessageSquare, BookOpen, Heart, Users, Trash2, X, MoreVertical, Settings } from "lucide-react";
import { cn, formatLocalDateTime } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { NotificationPreferences } from "./notification-preferences";

interface Notification {
  id: string;
  userId: string;
  type: 'message_request' | 'new_message' | 'new_study' | 'new_devotional' | 'devotional' | 'group_message' | 'message' | 'new_discussion' | 'discussion' | 'discussion_reply' | 'study' | 'video' | 'new_video' | 'admin';
  title: string;
  message: string;
  relatedId?: string;
  isRead: boolean;
  createdAt: string;
}

interface MessageRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  message: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  fromUser: {
    id: string;
    firstName?: string;
    lastName?: string;
    email: string;
  };
}

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'message_request':
    case 'new_message':
      return <MessageSquare className="h-4 w-4" />;
    case 'group_message':
      return <Users className="h-4 w-4" />;
    case 'new_study':
      return <BookOpen className="h-4 w-4" />;
    case 'new_devotional':
    case 'devotional':
      return <Heart className="h-4 w-4" />;
    case 'new_discussion':
    case 'discussion':
    case 'discussion_reply':
      return <MessageSquare className="h-4 w-4" />;
    default:
      return <Bell className="h-4 w-4" />;
  }
};

interface NotificationPanelProps {
  variant?: 'icon' | 'button';
}

export function NotificationPanel({ variant = 'icon' }: NotificationPanelProps) {
  const [showPanel, setShowPanel] = useState(false);
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Get notifications
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
    refetchInterval: 30000, // Poll every 30 seconds
  });

  // Get message requests
  const { data: messageRequests = [] } = useQuery<MessageRequest[]>({
    queryKey: ['/api/message-requests'],
    refetchInterval: 30000,
  });

  // Get unread count
  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ['/api/notifications/unread-count'],
    refetchInterval: 15000, // Poll every 15 seconds
  });

  const unreadCount = unreadData?.count || 0;
  const pendingRequests = messageRequests.filter(r => r.status === 'pending');

  // Mark notification as read
  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: string) => 
      apiRequest('POST', `/api/notifications/${notificationId}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
    },
  });

  // Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
    },
  });

  // Clear all notifications
  const clearAllNotificationsMutation = useMutation({
    mutationFn: () => apiRequest('DELETE', '/api/notifications/clear-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
    },
  });

  // Clear individual notification
  const clearNotificationMutation = useMutation({
    mutationFn: (notificationId: string) => 
      apiRequest('DELETE', `/api/notifications/${notificationId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
    },
  });

  // Respond to message request
  const respondToRequestMutation = useMutation({
    mutationFn: ({ requestId, action }: { requestId: string; action: 'accept' | 'decline' }) =>
      apiRequest('POST', `/api/message-requests/${requestId}/respond`, { action }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/message-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    console.log('Notification clicked:', {
      type: notification.type,
      relatedId: notification.relatedId,
      title: notification.title,
      message: notification.message
    });
    
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }
    
    // Close the notification panel
    setShowPanel(false);
    
    // Navigate based on notification type and relatedId
    switch (notification.type) {
      case 'message':
      case 'new_message':
      case 'group_message':
        if (notification.relatedId) {
          // Navigate to specific conversation
          setLocation(`/messages?conversation=${notification.relatedId}`);
        } else {
          // Navigate to messages page
          setLocation('/messages');
        }
        break;
        
      case 'study':
      case 'new_study':
        if (notification.relatedId) {
          // Navigate to specific study detail page
          setLocation(`/study/${notification.relatedId}`);
        } else {
          // Navigate to library
          setLocation('/library');
        }
        break;
        
      case 'video':
      case 'new_video':
        if (notification.relatedId) {
          // Navigate to specific video - for now redirect to videos page as we don't have individual video pages
          setLocation('/videos');
        } else {
          // Navigate to videos page
          setLocation('/videos');
        }
        break;
        
      case 'new_devotional':
      case 'devotional':
        // Navigate to home where today's devotional is shown (home is at root path)
        console.log('Navigating to home for devotional');
        setLocation('/');
        break;
        
      case 'discussion':
      case 'new_discussion':
      case 'discussion_reply':
        if (notification.relatedId) {
          // Navigate to community page with specific discussion highlighted
          const discussionUrl = `/community?discussion=${notification.relatedId}`;
          console.log('Navigating to discussion URL:', discussionUrl);
          setLocation(discussionUrl);
        } else {
          // Navigate to community page where discussions are shown
          console.log('Navigating to community page (no discussion ID)');
          setLocation('/community');
        }
        break;
        
      case 'admin':
        // For admin notifications with report conversation links
        if (notification.relatedId) {
          // Navigate to the conversation related to the admin notification (likely a report)
          setLocation(`/messages?conversation=${notification.relatedId}`);
        } else {
          // Navigate to admin page for general admin notifications
          setLocation('/admin');
        }
        break;
        
      default:
        // For unknown notification types, try to navigate to related content if available
        console.log('Unknown notification type:', notification.type, 'with relatedId:', notification.relatedId);
        console.log('Full notification object:', notification);
        
        // If it's likely a conversation/message type, go to messages
        if (notification.relatedId && (notification.type.includes('message') || notification.type === 'message_request')) {
          const messageUrl = `/messages?conversation=${notification.relatedId}`;
          console.log('Navigating to message URL:', messageUrl);
          setLocation(messageUrl);
        } else {
          // Default fallback for truly unknown types (home is at root path)
          console.log('Navigating to home as fallback');
          setLocation('/');
        }
        break;
    }
  };

  const handleRequestResponse = (requestId: string, action: 'accept' | 'decline') => {
    respondToRequestMutation.mutate({ requestId, action });
  };

  if (variant === 'button') {
    return (
      <div className="relative">
        <Button
          variant="ghost"
          onClick={() => setShowPanel(!showPanel)}
          className="w-full justify-between p-4 h-auto hover:bg-gray-50 border-b border-gray-100"
        >
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-ministry-navy/20 flex items-center justify-center">
              <Bell className="w-4 h-4 text-ministry-navy" />
            </div>
            <span className="font-medium text-ministry-charcoal">Notifications</span>
          </div>
          <div className="flex items-center space-x-2">
            {(unreadCount > 0 || pendingRequests.length > 0) && (
              <Badge 
                variant="destructive" 
                className="h-5 w-5 flex items-center justify-center p-0 text-xs"
              >
                {unreadCount + pendingRequests.length}
              </Badge>
            )}
            <svg className="w-5 h-5 text-ministry-slate" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
            </svg>
          </div>
        </Button>
        {showPanel && (
          <Card className="absolute right-0 top-16 w-80 h-96 z-50 shadow-lg flex flex-col">
            <CardHeader className="pb-2 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="text-sm">Notifications</CardTitle>
                <div className="flex items-center gap-1">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs p-1"
                        title="Notification preferences"
                      >
                        <Settings className="h-3 w-3" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Notification Settings</DialogTitle>
                      </DialogHeader>
                      <NotificationPreferences />
                    </DialogContent>
                  </Dialog>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPanel(false)}
                    className="text-xs p-1"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => markAllAsReadMutation.mutate()}
                    className="text-xs h-6 px-2"
                  >
                    <CheckCheck className="h-3 w-3 mr-1" />
                    Mark all read
                  </Button>
                )}
                {notifications.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => clearAllNotificationsMutation.mutate()}
                    className="text-xs text-red-600 hover:text-red-700 h-6 px-2"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Clear all
                  </Button>
                )}
              </div>
            </CardHeader>
            
            <ScrollArea className="flex-1">
              <CardContent className="space-y-3 p-3">
                {/* Message Requests */}
                {pendingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="p-3 border rounded-lg bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800"
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <MessageSquare className="h-4 w-4 text-amber-600 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">Message Request</p>
                        <p className="text-xs text-muted-foreground">
                          From {request.fromUser.firstName || request.fromUser.email}
                        </p>
                        <p className="text-xs mt-1 break-words">{request.message}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleRequestResponse(request.id, 'accept')}
                        disabled={respondToRequestMutation.isPending}
                        className="flex-1 text-xs h-7"
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRequestResponse(request.id, 'decline')}
                        disabled={respondToRequestMutation.isPending}
                        className="flex-1 text-xs h-7"
                      >
                        Decline
                      </Button>
                    </div>
                  </div>
                ))}

                {/* Regular Notifications */}
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      "p-3 border rounded-lg transition-colors",
                      notification.isRead ? "opacity-60" : "bg-muted/20"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {getNotificationIcon(notification.type)}
                      <div 
                        className="flex-1 min-w-0 cursor-pointer hover:bg-muted/30 p-1 -m-1 rounded"
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{notification.title}</p>
                          {!notification.isRead && (
                            <div className="h-2 w-2 bg-blue-500 rounded-full" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground break-words">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatLocalDateTime(notification.createdAt)}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-muted"
                          >
                            <MoreVertical className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-32">
                          <DropdownMenuItem
                            onClick={() => clearNotificationMutation.mutate(notification.id)}
                            className="text-red-600 hover:text-red-700 focus:text-red-700"
                          >
                            <Trash2 className="h-3 w-3 mr-2" />
                            Clear
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}

                {notifications.length === 0 && pendingRequests.length === 0 && (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    No notifications yet
                  </div>
                )}
              </CardContent>
            </ScrollArea>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowPanel(!showPanel)}
        className="relative"
      >
        <Bell className="h-5 w-5" />
        {(unreadCount > 0 || pendingRequests.length > 0) && (
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
          >
            {unreadCount + pendingRequests.length}
          </Badge>
        )}
      </Button>

      {showPanel && (
        <Card className="absolute right-0 top-10 w-80 h-96 z-50 shadow-lg flex flex-col">
          <CardHeader className="pb-2 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <CardTitle className="text-sm">Notifications</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPanel(false)}
                className="text-xs p-1"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => markAllAsReadMutation.mutate()}
                  className="text-xs h-6 px-2"
                >
                  <CheckCheck className="h-3 w-3 mr-1" />
                  Mark all read
                </Button>
              )}
              {notifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => clearAllNotificationsMutation.mutate()}
                  className="text-xs text-red-600 hover:text-red-700 h-6 px-2"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear all
                </Button>
              )}
            </div>
          </CardHeader>
          
          <ScrollArea className="flex-1">
            <CardContent className="space-y-3 p-3">
              {/* Message Requests */}
              {pendingRequests.map((request) => (
                <div
                  key={request.id}
                  className="p-3 border rounded-lg bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800"
                >
                  <div className="flex items-start gap-2 mb-2">
                    <MessageSquare className="h-4 w-4 text-amber-600 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Message Request</p>
                      <p className="text-xs text-muted-foreground">
                        From {request.fromUser.firstName || request.fromUser.email}
                      </p>
                      <p className="text-xs mt-1 break-words">{request.message}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleRequestResponse(request.id, 'accept')}
                      disabled={respondToRequestMutation.isPending}
                      className="flex-1 text-xs h-7"
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRequestResponse(request.id, 'decline')}
                      disabled={respondToRequestMutation.isPending}
                      className="flex-1 text-xs h-7"
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              ))}

              {/* Regular Notifications */}
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "p-3 border rounded-lg transition-colors",
                    notification.isRead ? "opacity-60" : "bg-muted/20"
                  )}
                >
                  <div className="flex items-start gap-2">
                    {getNotificationIcon(notification.type)}
                    <div 
                      className="flex-1 min-w-0 cursor-pointer hover:bg-muted/30 p-1 -m-1 rounded"
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{notification.title}</p>
                        {!notification.isRead && (
                          <div className="h-2 w-2 bg-blue-500 rounded-full" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground break-words">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatLocalDateTime(notification.createdAt)}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 hover:bg-muted"
                        >
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-32">
                        <DropdownMenuItem
                          onClick={() => clearNotificationMutation.mutate(notification.id)}
                          className="text-red-600 hover:text-red-700 focus:text-red-700"
                        >
                          <Trash2 className="h-3 w-3 mr-2" />
                          Clear
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}

              {notifications.length === 0 && pendingRequests.length === 0 && (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  No notifications yet
                </div>
              )}
            </CardContent>
          </ScrollArea>
        </Card>
      )}
    </div>
  );
}