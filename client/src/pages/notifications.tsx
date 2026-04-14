import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn, formatLocalDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Bell, CheckCheck, Trash2, MessageSquare, BookOpen, Heart, Users, MoreVertical, UserCheck, UserX, Calendar, Settings, Flame, Shield, Megaphone } from "lucide-react";
import Navigation from "@/components/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { NotificationPreferences } from "@/components/notification-preferences";

interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  relatedId?: string;
  isRead: boolean;
  createdAt: string;
}

interface MessageRequest {
  id: string;
  fromUserId: string;
  message: string;
  status: string;
  createdAt: string;
  fromUser: { id: string; firstName?: string; lastName?: string; email: string };
}

const getIcon = (type: string) => {
  switch (type) {
    case 'message_request': case 'new_message': case 'message': return <MessageSquare className="h-4 w-4 text-blue-400" />;
    case 'group_message': return <Users className="h-4 w-4 text-purple-400" />;
    case 'new_study': case 'study': return <BookOpen className="h-4 w-4 text-green-400" />;
    case 'new_devotional': case 'devotional': return <Heart className="h-4 w-4 text-red-400" />;
    case 'brotherhood': return <Users className="h-4 w-4 text-yellow-400" />;
    case 'new_event': case 'event': return <Calendar className="h-4 w-4 text-orange-400" />;
    case 'war_room_post': return <Shield className="h-4 w-4 text-blue-300" />;
    case 'under_fire_post': return <Flame className="h-4 w-4 text-orange-400" />;
    case 'admin': return <Megaphone className="h-4 w-4 text-[#FCD000]" />;
    default: return <Bell className="h-4 w-4 text-gray-400" />;
  }
};

export default function Notifications() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [respondedIds, setRespondedIds] = useState<Set<string>>(new Set());

  const { data: notifications = [] } = useQuery<Notification[]>({ queryKey: ['/api/notifications'] });
  const { data: messageRequests = [] } = useQuery<MessageRequest[]>({ queryKey: ['/api/message-requests'] });

  const DISPLAY_EXCLUDED = ['new_discussion', 'discussion', 'discussion_reply'];
  const BADGE_EXCLUDED = [...DISPLAY_EXCLUDED, 'war_room_post', 'under_fire_post'];
  const filtered = notifications.filter(n => !DISPLAY_EXCLUDED.includes(n.type));
  const pending = messageRequests.filter(r => r.status === 'pending');
  const unread = notifications.filter(n => !BADGE_EXCLUDED.includes(n.type) && !n.isRead).length;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
  };

  const markRead = useMutation({
    mutationFn: (id: string) => apiRequest('POST', `/api/notifications/${id}/read`),
    onSuccess: invalidate,
  });

  const markAllRead = useMutation({
    mutationFn: () => apiRequest('POST', '/api/notifications/read-all'),
    onSuccess: invalidate,
  });

  const clearAll = useMutation({
    mutationFn: () => apiRequest('DELETE', '/api/notifications/clear-all'),
    onSuccess: invalidate,
  });

  const clearOne = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/notifications/${id}`),
    onSuccess: invalidate,
  });

  const respondRequest = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'accept' | 'decline' }) =>
      apiRequest('POST', `/api/message-requests/${id}/respond`, { action }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/message-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      invalidate();
    },
  });

  const respondBrotherhood = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approved' | 'denied' }) =>
      apiRequest('POST', `/api/brotherhood-requests/${id}/respond`, { response: action }),
    onSuccess: (_data, vars) => {
      setRespondedIds(prev => new Set(prev).add(vars.id));
      queryClient.invalidateQueries({ queryKey: ['/api/brotherhood-requests'] });
      invalidate();
      toast({ title: vars.action === 'approved' ? "Brotherhood Approved!" : "Request Declined" });
    },
  });

  const handleNotificationClick = (n: Notification) => {
    if (!n.isRead) markRead.mutate(n.id);
    switch (n.type) {
      case 'message': case 'new_message': case 'group_message':
        setLocation(n.relatedId ? `/messages?conversation=${n.relatedId}` : '/messages'); break;
      case 'study': case 'new_study':
        setLocation(n.relatedId ? `/studies/${n.relatedId}` : '/library'); break;
      case 'video': case 'new_video':
        setLocation('/videos'); break;
      case 'new_devotional': case 'devotional':
        setLocation('/'); setTimeout(() => window.dispatchEvent(new CustomEvent('openDevotional')), 100); break;
      case 'discussion': case 'new_discussion':
        setLocation(n.relatedId ? `/community?discussion=${n.relatedId}` : '/community'); break;
      case 'discussion_reply': {
        if (n.relatedId && n.relatedId.includes('__reply__')) {
          const [discussionId, replyId] = n.relatedId.split('__reply__');
          setLocation(`/community?discussion=${discussionId}&reply=${replyId}`);
        } else {
          setLocation(n.relatedId ? `/community?discussion=${n.relatedId}` : '/community');
        }
        break;
      }
      case 'event': case 'new_event':
        setLocation('/events'); break;
      case 'challenge': case 'challenge_ended': case 'new_challenge':
        setLocation('/challenges'); break;
      case 'war_group':
        setLocation('/war-groups'); break;
      case 'war_room_post':
        setLocation(n.relatedId ? `/hurdle-wall?post=${n.relatedId}` : '/hurdle-wall'); break;
      case 'under_fire_post':
        setLocation(n.relatedId ? `/under-fire?request=${n.relatedId}` : '/under-fire'); break;
      case 'admin':
        break;
      default:
        if (n.relatedId) setLocation(`/messages?conversation=${n.relatedId}`);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-[#FCD000]" />
          <h1 className="text-lg font-bold text-foreground">Notifications</h1>
          {unread > 0 && (
            <span className="bg-red-600 text-white text-xs font-bold rounded-full px-1.5 py-0.5 leading-none">
              {unread}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={() => markAllRead.mutate()} className="text-xs h-7 px-2">
              <CheckCheck className="h-3.5 w-3.5 mr-1" /> Mark all read
            </Button>
          )}
          {filtered.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => clearAll.mutate()} className="text-xs h-7 px-2 text-red-500 hover:text-red-600">
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear all
            </Button>
          )}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Notification settings">
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Notification Settings</DialogTitle></DialogHeader>
              <NotificationPreferences />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <ScrollArea className="h-full">
        <div className="px-4 py-3 space-y-2">

          {/* Message Requests */}
          {pending.map(req => (
            <div key={req.id} className="p-4 border rounded-xl bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-3 mb-3">
                <MessageSquare className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">Message Request</p>
                  <p className="text-xs text-muted-foreground">From {req.fromUser.firstName || req.fromUser.email}</p>
                  <p className="text-sm mt-1 break-words">{req.message}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => respondRequest.mutate({ id: req.id, action: 'accept' })}
                  disabled={respondRequest.isPending} className="flex-1 h-8 text-xs">Accept</Button>
                <Button size="sm" variant="outline" onClick={() => respondRequest.mutate({ id: req.id, action: 'decline' })}
                  disabled={respondRequest.isPending} className="flex-1 h-8 text-xs">Decline</Button>
              </div>
            </div>
          ))}

          {/* Notifications */}
          {filtered.map(n => (
            <div
              key={n.id}
              className={cn(
                "p-4 border rounded-xl transition-colors",
                n.isRead ? "opacity-60" : "bg-muted/20",
                n.type === 'brotherhood' && !n.isRead && "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800",
                n.type === 'admin' && !n.isRead && "bg-yellow-50 dark:bg-yellow-950/30 border-[#FCD000]"
              )}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0">{getIcon(n.type)}</div>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleNotificationClick(n)}>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{n.title}</p>
                    {!n.isRead && <span className="h-2 w-2 bg-blue-500 rounded-full flex-shrink-0" />}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5 break-words">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{formatLocalDateTime(n.createdAt)}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 flex-shrink-0">
                      <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-32">
                    {!n.isRead && (
                      <DropdownMenuItem onClick={() => markRead.mutate(n.id)}>
                        <CheckCheck className="h-3 w-3 mr-2" /> Mark read
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => clearOne.mutate(n.id)} className="text-red-600">
                      <Trash2 className="h-3 w-3 mr-2" /> Clear
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Brotherhood approve/deny */}
              {n.type === 'brotherhood' && n.relatedId && !n.title?.includes('Approved') && !respondedIds.has(n.relatedId) && (
                <div className="flex gap-2 mt-3">
                  <Button size="sm" onClick={() => respondBrotherhood.mutate({ id: n.relatedId!, action: 'approved' })}
                    disabled={respondBrotherhood.isPending}
                    className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700 text-white">
                    <UserCheck className="h-3 w-3 mr-1" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => respondBrotherhood.mutate({ id: n.relatedId!, action: 'denied' })}
                    disabled={respondBrotherhood.isPending}
                    className="flex-1 h-8 text-xs border-red-300 text-red-600 hover:bg-red-50">
                    <UserX className="h-3 w-3 mr-1" /> Deny
                  </Button>
                </div>
              )}
            </div>
          ))}

          {/* Empty state */}
          {filtered.length === 0 && pending.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Bell className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">You're all caught up</p>
              <p className="text-xs text-muted-foreground mt-1">No new notifications</p>
            </div>
          )}
        </div>
      </ScrollArea>

      <Navigation />
    </div>
  );
}
