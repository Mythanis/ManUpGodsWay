import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Bell, Check, CheckCheck, MessageSquare, BookOpen, Heart, Users, Trash2, X, MoreVertical, Settings, UserCheck, UserX, Calendar, Shield, Flame, Dumbbell } from "lucide-react";
import { cn, formatLocalDateTime } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { NotificationPreferences } from "./notification-preferences";
import { useToast } from "@/hooks/use-toast";

interface Notification {
  id: string;
  userId: string;
  type: 'message_request' | 'new_message' | 'new_study' | 'new_devotional' | 'devotional' | 'group_message' | 'message' | 'new_discussion' | 'discussion' | 'discussion_reply' | 'study' | 'video' | 'new_video' | 'admin' | 'brotherhood' | 'event' | 'new_event' | 'challenge' | 'challenge_ended' | 'new_challenge' | 'war_group' | 'content_flag' | 'war_room_post' | 'under_fire_post' | 'fitness_community' | 'mention';
  title: string;
  message: string;
  relatedId?: string;
  linkUrl?: string;
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
    case 'war_room_post':
      return <Shield className="h-4 w-4 text-blue-300" />;
    case 'under_fire_post':
      return <Flame className="h-4 w-4 text-orange-400" />;
    case 'fitness_community':
      return <Dumbbell className="h-4 w-4 text-yellow-400" />;
    default:
      return <Bell className="h-4 w-4" />;
  }
};

interface NotificationPanelProps {
  variant?: 'icon' | 'button';
}

export function NotificationPanel({ variant = 'icon' }: NotificationPanelProps) {
  const [showPanel, setShowPanel] = useState(false);
  const [respondedRequestIds, setRespondedRequestIds] = useState<Set<string>>(new Set());
  const [isRinging, setIsRinging] = useState(false);
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = ['admin', 'owner'].includes((user as any)?.role);

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

  const filteredNotifications = notifications;
  const unreadCount = filteredNotifications.filter(n => !n.isRead).length;
  const pendingRequests = messageRequests.filter(r => r.status === 'pending');
  const totalUnreadAll = unreadCount + pendingRequests.length;

  // Ring the bell when new notifications arrive (panel is closed)
  const prevTotalRef = useRef(totalUnreadAll);
  useEffect(() => {
    if (totalUnreadAll > prevTotalRef.current && !showPanel) {
      setIsRinging(true);
      const t = setTimeout(() => setIsRinging(false), 2000);
      prevTotalRef.current = totalUnreadAll;
      return () => clearTimeout(t);
    }
    prevTotalRef.current = totalUnreadAll;
  }, [totalUnreadAll, showPanel]);

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
    onSuccess: (_data, variables) => {
      setRespondedRequestIds(prev => new Set(prev).add(variables.requestId));
      queryClient.invalidateQueries({ queryKey: ['/api/brotherhood-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
      if (variables.action === 'approved') {
        toast({ title: "Brotherhood Approved!", description: "You are now brothers in faith." });
      } else {
        toast({ title: "Request Declined", description: "The brotherhood request has been declined." });
      }
    },
    onError: () => {
      toast({ title: "Something went wrong", description: "Could not respond to the brotherhood request. Please try again.", variant: "destructive" });
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }

    // Helper: navigate and close panel
    const goTo = (path: string) => {
      setShowPanel(false);
      setLocation(path);
    };

    // If a direct link URL was stored on the notification (used for @-mentions),
    // honor it over per-type lookup so the user lands on the exact post/reply.
    if (notification.linkUrl) {
      goTo(notification.linkUrl);
      return;
    }

    // Navigate based on notification type and relatedId
    switch (notification.type) {
      case 'message':
      case 'new_message':
      case 'group_message':
        goTo(notification.relatedId ? `/messages?conversation=${notification.relatedId}` : '/messages');
        break;

      case 'study':
      case 'new_study':
        goTo(notification.relatedId ? `/study/${notification.relatedId}` : '/library');
        break;

      case 'video':
      case 'new_video':
        goTo('/videos');
        break;

      case 'new_devotional':
      case 'devotional':
        setShowPanel(false);
        setLocation('/');
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('openDevotional'));
        }, 100);
        break;

      case 'discussion':
      case 'new_discussion':
        goTo(notification.relatedId ? `/community?discussion=${notification.relatedId}` : '/community');
        break;

      case 'discussion_reply': {
        if (notification.relatedId && notification.relatedId.includes('__reply__')) {
          const [discussionId, replyId] = notification.relatedId.split('__reply__');
          goTo(`/community?discussion=${discussionId}&reply=${replyId}`);
        } else {
          goTo(notification.relatedId ? `/community?discussion=${notification.relatedId}` : '/community');
        }
        break;
      }

      case 'content_flag':
        goTo('/admin?tab=flags');
        break;

      case 'admin':
        if (notification.relatedId) {
          goTo(`/messages?conversation=${notification.relatedId}`);
        } else if (isAdmin) {
          goTo('/admin');
        }
        // Non-admins with no relatedId: panel stays open so they can read the message
        break;

      case 'event':
      case 'new_event':
        goTo('/events');
        break;

      case 'challenge':
      case 'challenge_ended':
      case 'new_challenge':
        goTo('/challenges');
        break;

      case 'brotherhood': {
        if (notification.relatedId) {
          // "Approved" notifications store the approver's userId directly in relatedId
          if (notification.title?.includes('Approved')) {
            goTo(`/users/${notification.relatedId}`);
          } else {
            const brotherhoodRequests = queryClient.getQueryData(['/api/brotherhood-requests']) as any[];
            const request = brotherhoodRequests?.find((r: any) => r.id === notification.relatedId);
            if (request?.requester) {
              goTo(`/users/${request.requester.id}`);
            } else if (request?.requesterId) {
              goTo(`/users/${request.requesterId}`);
            } else {
              goTo('/');
            }
          }
        } else {
          goTo('/');
        }
        break;
      }

      case 'war_room_post':
        goTo(notification.relatedId ? `/hurdle-wall?post=${notification.relatedId}` : '/hurdle-wall');
        break;

      case 'under_fire_post':
        goTo(notification.relatedId ? `/under-fire?request=${notification.relatedId}` : '/under-fire');
        break;

      case 'fitness_community':
        goTo('/fitness?tab=community');
        break;

      case 'mention':
        goTo(notification.relatedId ? `/community?discussion=${notification.relatedId}` : '/community');
        break;

      default:
        if (notification.relatedId && (notification.type.includes('message') || notification.type === 'message_request')) {
          goTo(`/messages?conversation=${notification.relatedId}`);
        } else {
          goTo('/');
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
    
    // Navigate to the relevant user's profile
    if (notification.relatedId) {
      // "Approved" notifications store the approver's userId directly in relatedId
      if (notification.title?.includes('Approved')) {
        setLocation(`/users/${notification.relatedId}`);
      } else {
        const brotherhoodRequests = queryClient.getQueryData(['/api/brotherhood-requests']) as any[];
        const request = brotherhoodRequests?.find(r => r.id === notification.relatedId);
        if (request && request.requester) {
          setLocation(`/users/${request.requester.id}`);
        } else if (request && request.requesterId) {
          setLocation(`/users/${request.requesterId}`);
        } else {
          setLocation('/');
        }
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
          className="w-full justify-between p-4 h-auto hover:bg-gray-800 border-b-2 border-ministry-gold-exact/30 rounded-sm"
        >
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-sm bg-ministry-gold-exact flex items-center justify-center">
              <Bell className="w-4 h-4 text-black" />
            </div>
            <span className="font-bold text-white uppercase tracking-wide">Notifications</span>
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
            <svg className="w-5 h-5 text-ministry-gold-exact" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                {filteredNotifications.length > 0 && (
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
                {filteredNotifications.map((notification) => (
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
                        {/* Approve/Deny buttons for pending brotherhood requests only */}
                        {notification.relatedId
                          && !notification.title?.includes('Approved')
                          && !respondedRequestIds.has(notification.relatedId) && (
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

                {filteredNotifications.length === 0 && pendingRequests.length === 0 && (
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

  const hasUnread = unreadCount > 0 || pendingRequests.length > 0;

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => { setShowPanel(!showPanel); setIsRinging(false); }}
        className={`relative flex items-center gap-1.5 px-2 ${hasUnread ? 'text-white' : ''}`}
      >
        <div className="relative">
          <Bell className={`h-5 w-5 transition-transform ${hasUnread ? 'text-[#FDD000]' : ''} ${isRinging ? 'animate-bounce' : ''}`} />
          {hasUnread && (
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600" />
            </span>
          )}
        </div>
        {hasUnread && (
          <span className="text-xs font-bold text-[#FDD000] leading-none">
            {totalUnreadAll}
          </span>
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
          className="fixed right-4 top-16 w-[340px] max-h-[80vh] z-[9999] shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex flex-col bg-black border border-[#FDD000]/30 rounded-lg overflow-hidden"
          onTouchMove={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          <CardHeader className="pb-2 flex-shrink-0 bg-gradient-to-r from-black to-zinc-900 border-b border-[#FDD000]/20">
            <div className="flex items-center justify-between mb-2">
              <CardTitle className="text-sm font-semibold tracking-wide text-[#FDD000]">Notifications</CardTitle>
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
              {filteredNotifications.length > 0 && (
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
                  className="flex bg-zinc-900 border border-[#FDD000]/30 rounded-lg overflow-hidden hover:border-[#FDD000]/50 transition-colors"
                >
                  <div className="w-10 bg-[#FDD000] flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="h-4 w-4 text-black" />
                  </div>
                  <div className="flex-1 p-2.5">
                    <p className="text-xs font-medium text-[#FDD000]">Message Request</p>
                    <p className="text-[10px] text-white/60">
                      From {request.fromUser.firstName || request.fromUser.email}
                    </p>
                    <p className="text-[10px] mt-0.5 break-words text-white/40 line-clamp-1">{request.message}</p>
                    <div className="flex gap-1.5 mt-2">
                      <Button
                        size="sm"
                        onClick={() => handleRequestResponse(request.id, 'accept')}
                        disabled={respondToRequestMutation.isPending}
                        className="flex-1 text-[10px] h-6 bg-[#FDD000] text-black hover:bg-[#FDD000]/80 rounded-md font-medium"
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
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className="flex bg-zinc-900 border border-white/10 rounded-lg overflow-hidden transition-all hover:border-[#FDD000]/40 hover:bg-zinc-800"
                >
                  <div className={cn(
                    "w-10 flex items-center justify-center flex-shrink-0 self-stretch",
                    notification.isRead ? "bg-[#FDD000]" : "bg-zinc-800"
                  )}>
                    {notification.isRead ? (
                      <Check className="h-4 w-4 text-black" />
                    ) : (
                      <div className="text-[#FDD000]">{getNotificationIcon(notification.type)}</div>
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
                        <div className="h-1.5 w-1.5 bg-[#FDD000] rounded-full flex-shrink-0 ml-1" />
                      )}
                    </div>
                    <p className="text-[10px] text-white/50 break-words line-clamp-1 mt-0.5">
                      {notification.message}
                    </p>
                    <p className="text-[10px] text-white/30">
                      {formatLocalDateTime(notification.createdAt)}
                    </p>
                    {/* Approve/Deny buttons for pending brotherhood requests only */}
                    {notification.type === 'brotherhood'
                      && notification.relatedId
                      && !notification.title?.includes('Approved')
                      && !respondedRequestIds.has(notification.relatedId) && (
                      <div className="flex gap-1.5 mt-2">
                        <Button
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleBrotherhoodResponse(notification.relatedId!, 'approved'); }}
                          disabled={respondToBrotherhoodMutation.isPending}
                          className="flex-1 text-[10px] h-6 bg-[#FDD000] text-black hover:bg-[#FDD000]/80 rounded-md font-medium"
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

              {filteredNotifications.length === 0 && pendingRequests.length === 0 && (
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