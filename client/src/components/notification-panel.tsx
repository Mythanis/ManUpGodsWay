import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Bell, Check, CheckCheck, MessageSquare, BookOpen, Heart, Users, Trash2, X, MoreVertical, Settings, UserCheck, UserX, Calendar } from "lucide-react";
import { cn, formatLocalDateTime } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { NotificationPreferences } from "./notification-preferences";

interface Notification {
  id: string;
  userId: string;
  type: 'message_request' | 'new_message' | 'new_study' | 'new_devotional' | 'devotional' | 'group_message' | 'message' | 'new_discussion' | 'discussion' | 'discussion_reply' | 'study' | 'video' | 'new_video' | 'admin' | 'brotherhood' | 'event' | 'new_event' | 'challenge' | 'challenge_ended' | 'new_challenge' | 'war_group';
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
    case 'brotherhood':
      return <Users className="h-4 w-4" />;
    case 'event':
    case 'new_event':
      return <Calendar className="h-4 w-4" />;
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

  // Respond to brotherhood request
  const respondToBrotherhoodMutation = useMutation({
    mutationFn: ({ requestId, action }: { requestId: string; action: 'approved' | 'denied' }) =>
      apiRequest('POST', `/api/brotherhood-requests/${requestId}/respond`, { response: action }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/brotherhood-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
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
        // Navigate to home and dispatch event to open devotional
        console.log('Navigating to home for devotional with auto-open');
        setLocation('/');
        // Use custom event since wouter doesn't track query params
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('openDevotional'));
        }, 100);
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
        
      case 'event':
      case 'new_event':
        setLocation('/events');
        break;
        
      case 'challenge':
      case 'challenge_ended':
      case 'new_challenge':
        setLocation('/challenges');
        break;
        
      case 'brotherhood':
        // For brotherhood requests, navigate to the requester's profile
        if (notification.relatedId) {
          // The relatedId is the requestId, we need to get the requester's userId
          // We'll extract it from the current brotherhood requests
          const brotherhoodRequests = queryClient.getQueryData(['/api/brotherhood-requests']) as any[];
          const request = brotherhoodRequests?.find(r => r.id === notification.relatedId);
          if (request && request.requester) {
            setLocation(`/users/${request.requester.id}`);
          } else if (request && request.requesterId) {
            setLocation(`/users/${request.requesterId}`);
          } else {
            // Fallback to home if we can't find the request
            setLocation('/');
          }
        } else {
          setLocation('/');
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

  const handleBrotherhoodResponse = (requestId: string, action: 'approved' | 'denied') => {
    respondToBrotherhoodMutation.mutate({ requestId, action });
  };

  const handleBrotherhoodNotificationClick = (notification: Notification, event: React.MouseEvent) => {
    // Only handle the click if it's not on a button
    const target = event.target as HTMLElement;
    if (target.closest('button')) {
      return; // Don't handle if clicking on a button
    }
    
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }
    
    setShowPanel(false);
    
    // Navigate to the requester's profile
    if (notification.relatedId) {
      const brotherhoodRequests = queryClient.getQueryData(['/api/brotherhood-requests']) as any[];
      const request = brotherhoodRequests?.find(r => r.id === notification.relatedId);
      if (request && request.requester) {
        setLocation(`/users/${request.requester.id}`);
      } else if (request && request.requesterId) {
        setLocation(`/users/${request.requesterId}`);
      } else {
        setLocation('/');
      }
    } else {
      setLocation('/');
    }
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
                      notification.isRead ? "opacity-60" : "bg-muted/20",
                      notification.type === 'brotherhood' && !notification.isRead && "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800"
                    )}
                  >
                    {notification.type === 'brotherhood' ? (
                      // Special handling for brotherhood notifications
                      <>
                        <div className="flex items-start gap-2 mb-2">
                          {getNotificationIcon(notification.type)}
                          <div 
                            className="flex-1 min-w-0 cursor-pointer hover:bg-muted/30 p-1 -m-1 rounded"
                            onClick={(e) => handleBrotherhoodNotificationClick(notification, e)}
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
                        {/* Approve/Deny buttons for brotherhood requests */}
                        {notification.relatedId && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleBrotherhoodResponse(notification.relatedId!, 'approved')}
                              disabled={respondToBrotherhoodMutation.isPending}
                              className="flex-1 text-xs h-7 bg-green-600 hover:bg-green-700"
                            >
                              <UserCheck className="h-3 w-3 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleBrotherhoodResponse(notification.relatedId!, 'denied')}
                              disabled={respondToBrotherhoodMutation.isPending}
                              className="flex-1 text-xs h-7 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                            >
                              <UserX className="h-3 w-3 mr-1" />
                              Deny
                            </Button>
                          </div>
                        )}
                      </>
                    ) : (
                      // Regular notification handling for all other types
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
                    )}
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
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-[#FCD000] text-black border-2 border-black rounded-sm font-bold"
          >
            {unreadCount + pendingRequests.length}
          </Badge>
        )}
      </Button>

      {showPanel && (
        <>
        <div 
          className="fixed inset-0 z-[9998] bg-transparent" 
          onClick={() => setShowPanel(false)}
          onTouchMove={(e) => e.preventDefault()}
        />
        <Card 
          className="fixed right-4 top-16 w-[340px] max-h-[80vh] z-[9999] shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex flex-col bg-black border border-[#FCD000]/30 rounded-lg overflow-hidden"
          onTouchMove={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          <CardHeader className="pb-2 flex-shrink-0 bg-gradient-to-r from-black to-zinc-900 border-b border-[#FCD000]/20">
            <div className="flex items-center justify-between mb-2">
              <CardTitle className="text-sm font-semibold tracking-wide text-[#FCD000]">Notifications</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPanel(false)}
                className="text-white/60 hover:text-white hover:bg-white/10 p-1 rounded-md"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => markAllAsReadMutation.mutate()}
                  className="text-[10px] h-6 px-2 text-white/70 hover:text-white hover:bg-white/10 rounded-md border border-white/20"
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
                  className="text-[10px] h-6 px-2 text-white/70 hover:text-white hover:bg-white/10 rounded-md border border-white/20"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear all
                </Button>
              )}
            </div>
          </CardHeader>
          
          <div className="flex-1 overflow-y-auto max-h-[50vh]" style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
            <CardContent className="space-y-2 p-2 bg-black">
              {/* Message Requests */}
              {pendingRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex bg-zinc-900 border border-[#FCD000]/30 rounded-lg overflow-hidden hover:border-[#FCD000]/50 transition-colors"
                >
                  <div className="w-10 bg-[#FCD000] flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="h-4 w-4 text-black" />
                  </div>
                  <div className="flex-1 p-2.5">
                    <p className="text-xs font-medium text-[#FCD000]">Message Request</p>
                    <p className="text-[10px] text-white/60">
                      From {request.fromUser.firstName || request.fromUser.email}
                    </p>
                    <p className="text-[10px] mt-0.5 break-words text-white/40 line-clamp-1">{request.message}</p>
                    <div className="flex gap-1.5 mt-2">
                      <Button
                        size="sm"
                        onClick={() => handleRequestResponse(request.id, 'accept')}
                        disabled={respondToRequestMutation.isPending}
                        className="flex-1 text-[10px] h-6 bg-[#FCD000] text-black hover:bg-[#FCD000]/80 rounded-md font-medium"
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRequestResponse(request.id, 'decline')}
                        disabled={respondToRequestMutation.isPending}
                        className="flex-1 text-[10px] h-6 bg-transparent text-white/70 hover:bg-white/10 rounded-md border border-white/20 font-medium"
                      >
                        Decline
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Regular Notifications */}
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="flex bg-zinc-900 border border-white/10 rounded-lg overflow-hidden transition-all hover:border-[#FCD000]/40 hover:bg-zinc-800"
                >
                  <div className={cn(
                    "w-10 flex items-center justify-center flex-shrink-0 self-stretch",
                    notification.isRead ? "bg-[#FCD000]" : "bg-zinc-800"
                  )}>
                    {notification.isRead ? (
                      <Check className="h-4 w-4 text-black" />
                    ) : (
                      <div className="text-[#FCD000]">{getNotificationIcon(notification.type)}</div>
                    )}
                  </div>
                  <div 
                    className="flex-1 p-2.5 cursor-pointer"
                    onClick={(e) => notification.type === 'brotherhood' ? handleBrotherhoodNotificationClick(notification, e) : handleNotificationClick(notification)}
                  >
                    <div className="flex items-center justify-between">
                      <p className={cn(
                        "text-xs font-medium line-clamp-1",
                        notification.isRead ? "text-white/60" : "text-white"
                      )}>{notification.title}</p>
                      {!notification.isRead && (
                        <div className="h-1.5 w-1.5 bg-[#FCD000] rounded-full flex-shrink-0 ml-1" />
                      )}
                    </div>
                    <p className="text-[10px] text-white/50 break-words line-clamp-1 mt-0.5">
                      {notification.message}
                    </p>
                    <p className="text-[10px] text-white/30">
                      {formatLocalDateTime(notification.createdAt)}
                    </p>
                    {/* Approve/Deny buttons for brotherhood requests */}
                    {notification.type === 'brotherhood' && notification.relatedId && (
                      <div className="flex gap-1.5 mt-2">
                        <Button
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleBrotherhoodResponse(notification.relatedId!, 'approved'); }}
                          disabled={respondToBrotherhoodMutation.isPending}
                          className="flex-1 text-[10px] h-6 bg-[#FCD000] text-black hover:bg-[#FCD000]/80 rounded-md font-medium"
                        >
                          <UserCheck className="h-3 w-3 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => { e.stopPropagation(); handleBrotherhoodResponse(notification.relatedId!, 'denied'); }}
                          disabled={respondToBrotherhoodMutation.isPending}
                          className="flex-1 text-[10px] h-6 bg-transparent text-white/70 hover:bg-white/10 rounded-md border border-white/20 font-medium"
                        >
                          <UserX className="h-3 w-3 mr-1" />
                          Deny
                        </Button>
                      </div>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-white/10 text-white/40 hover:text-white self-start mt-1 mr-1 rounded-md"
                      >
                        <MoreVertical className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-28 rounded-md border border-white/20 bg-zinc-900">
                      <DropdownMenuItem
                        onClick={() => clearNotificationMutation.mutate(notification.id)}
                        className="text-red-400 hover:text-red-300 focus:text-red-300 rounded-md text-[10px]"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Clear
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}

              {notifications.length === 0 && pendingRequests.length === 0 && (
                <div className="text-center py-8 text-xs text-white/40">
                  <Bell className="h-6 w-6 mx-auto mb-2 text-white/20" />
                  No notifications yet
                </div>
              )}
            </CardContent>
          </div>
        </Card>
        </>
      )}
    </div>
  );
}