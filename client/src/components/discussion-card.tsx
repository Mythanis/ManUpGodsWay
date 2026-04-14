import { useState, useEffect } from "react";
import { sanitizeHtml } from "@/lib/sanitize";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Heart, MessageCircle, Send, ChevronDown, ChevronUp, UserPlus, Flag, Plus, Edit, Share2, Trash2, ThumbsDown, Mail, Link2, X, ChevronLeft, ChevronRight } from "lucide-react";

// Custom Christian Cross icon component
const ChristianCross = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2.5" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    className={className}
  >
    <line x1="12" y1="2" x2="12" y2="22" />
    <line x1="5" y1="7" x2="19" y2="7" />
  </svg>
);
import { SiFacebook, SiX, SiWhatsapp } from "react-icons/si";
import { FlagContentDialog } from "@/components/flag-content-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { z } from "zod";

const editSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
});

interface DiscussionCardProps {
  discussion: any;
  onStartDirectMessage?: (userId: string) => void;
  onAddToGroup?: (userId: string) => void;
  currentUserTier?: string; // legacy — kept for callsite compat
  currentUserSubscriptionStatus?: string;
  autoOpenReplies?: boolean;
  highlightReplyId?: string;
}

const replySchema = z.object({
  content: z.string().min(1, "Reply content is required"),
});

const FONT_SIZE_CLASSES = ['text-sm', 'text-base', 'text-lg'];

export default function DiscussionCard({ 
  discussion, 
  onStartDirectMessage,
  onAddToGroup,
  currentUserTier = 'free',
  currentUserSubscriptionStatus = 'trial',
  autoOpenReplies = false,
  highlightReplyId,
}: DiscussionCardProps) {
  const [fontSizeLevel, setFontSizeLevel] = useState<number>(() => {
    const saved = localStorage.getItem('communityFontSize');
    return saved ? Math.min(2, Math.max(0, parseInt(saved))) : 0;
  });

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'communityFontSize' && e.newValue !== null) {
        setFontSizeLevel(Math.min(2, Math.max(0, parseInt(e.newValue))));
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const adjustFontSize = (delta: number) => {
    setFontSizeLevel(prev => {
      const next = Math.min(2, Math.max(0, prev + delta));
      localStorage.setItem('communityFontSize', String(next));
      // Broadcast to all other mounted DiscussionCard instances on this page
      window.dispatchEvent(new StorageEvent('storage', { key: 'communityFontSize', newValue: String(next) }));
      return next;
    });
  };

  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showReplies, setShowReplies] = useState(autoOpenReplies);
  const [replyingToReplyId, setReplyingToReplyId] = useState<string | null>(null);
  const [replyingToName, setReplyingToName] = useState('');
  const [userHasLiked, setUserHasLiked] = useState((discussion as any).likedByMe ?? false);
  const [likeCount, setLikeCount] = useState(discussion.likes || 0);
  const [userHasDisliked, setUserHasDisliked] = useState(discussion.dislikedByMe ?? false);
  const [dislikeCount, setDislikeCount] = useState(discussion.dislikes || 0);
  const [replyLikedByMe, setReplyLikedByMe] = useState<Record<string, boolean>>({});
  const [replyLikeCounts, setReplyLikeCounts] = useState<Record<string, number>>({});
  const [replyDislikedByMe, setReplyDislikedByMe] = useState<Record<string, boolean>>({});
  const [replyDislikeCounts, setReplyDislikeCounts] = useState<Record<string, number>>({});
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showLikersDialog, setShowLikersDialog] = useState(false);
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editReplyContent, setEditReplyContent] = useState('');
  
  // Check if content is long enough to need expansion
  const plainContentLength = (discussion.content || '').replace(/<[^>]+>/g, '').length;
  const isLongContent = plainContentLength > 280;
  const { user } = useAuth();
  
  // Check if current user owns this discussion or is moderator/admin
  const isOwner = user && (user as any).id === discussion.userId;
  const isAdmin = user && ((user as any).role === 'admin' || (user as any).role === 'owner' || (user as any).role === 'moderator');
  const canDelete = isOwner || isAdmin;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch replies when expanded with real-time updates
  const { data: replies = [] } = useQuery({
    queryKey: ["/api/discussions", discussion.id, "replies"],
    enabled: showReplies,
    retry: false,
    refetchInterval: showReplies ? 3000 : false, // Real-time updates every 3 seconds when expanded
    refetchIntervalInBackground: true,
  });

  type Liker = { id: string; firstName: string | null; lastName: string | null; profileImageUrl: string | null };
  const { data: likers = [], isLoading: likersLoading } = useQuery<Liker[]>({
    queryKey: ["/api/discussions", discussion.id, "likers"],
    enabled: showLikersDialog && likeCount > 0,
    retry: false,
  });

  // Scroll to and flash-highlight the target reply from a notification link
  useEffect(() => {
    if (!highlightReplyId || !showReplies || (replies as any[]).length === 0) return;
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-reply-id="${highlightReplyId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('reply-highlight-flash');
        setTimeout(() => el.classList.remove('reply-highlight-flash'), 2500);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [highlightReplyId, showReplies, replies]);

  const form = useForm({
    resolver: zodResolver(replySchema),
    defaultValues: {
      content: '',
    },
  });

  const editForm = useForm({
    resolver: zodResolver(editSchema),
    defaultValues: {
      title: discussion.title || '',
      content: discussion.content || '',
    },
  });

  const nestedReplyForm = useForm({
    resolver: zodResolver(replySchema),
    defaultValues: { content: '' },
  });

  const createReply = useMutation({
    mutationFn: async (data: z.infer<typeof replySchema> & { parentReplyId?: string }) => {
      const response = await apiRequest('POST', `/api/discussions/${discussion.id}/replies`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discussions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/discussions", discussion.id, "replies"] });
      toast({
        title: "Success",
        description: "Reply posted successfully!",
      });
      setShowReplyForm(false);
      form.reset();
    },
    onError: (error) => {
      console.error("Reply creation error:", error);
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: `Failed to post reply: ${error.message || 'Please try again.'}`,
        variant: "destructive",
      });
    },
  });

  const deleteDiscussion = useMutation({
    mutationFn: async () => {
      return apiRequest('DELETE', `/api/discussions/${discussion.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discussions"] });
      toast({ title: "Deleted", description: "Discussion removed successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete discussion", variant: "destructive" });
    },
  });

  const deleteReply = useMutation({
    mutationFn: async (replyId: string) => {
      return apiRequest('DELETE', `/api/discussions/${discussion.id}/replies/${replyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discussions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/discussions", discussion.id, "replies"] });
      toast({ title: "Deleted", description: "Reply removed successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete reply", variant: "destructive" });
    },
  });

  const editReply = useMutation({
    mutationFn: async ({ replyId, content }: { replyId: string; content: string }) => {
      return apiRequest('PATCH', `/api/discussions/${discussion.id}/replies/${replyId}`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discussions", discussion.id, "replies"] });
      setEditingReplyId(null);
      setEditReplyContent('');
      toast({ title: "Updated", description: "Reply updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update reply", variant: "destructive" });
    },
  });

  const handleDeleteDiscussion = () => {
    if (window.confirm('Are you sure you want to delete this discussion? This cannot be undone.')) {
      deleteDiscussion.mutate();
    }
  };

  const handleDeleteReply = (replyId: string) => {
    if (window.confirm('Are you sure you want to delete this reply?')) {
      deleteReply.mutate(replyId);
    }
  };

  const toggleLike = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/discussions/${discussion.id}/like`, {});
      return response;
    },
    onSuccess: (response: { liked: boolean; totalLikes: number }) => {
      setUserHasLiked(response.liked);
      setLikeCount(response.totalLikes);
      queryClient.invalidateQueries({ queryKey: ["/api/discussions"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: `Failed to update like: ${error.message || 'Please try again.'}`,
        variant: "destructive",
      });
    },
  });

  const toggleReplyLike = useMutation({
    mutationFn: async (replyId: string) => {
      const response = await apiRequest('POST', `/api/discussions/${discussion.id}/replies/${replyId}/like`, {});
      return response as { honored: boolean };
    },
    onMutate: (replyId: string) => {
      const wasLiked = replyLikedByMe[replyId] ?? false;
      setReplyLikedByMe(prev => ({ ...prev, [replyId]: !wasLiked }));
      setReplyLikeCounts(prev => ({ ...prev, [replyId]: Math.max(0, (prev[replyId] ?? 0) + (wasLiked ? -1 : 1)) }));
    },
    onError: (_err, replyId) => {
      const wasLiked = !(replyLikedByMe[replyId] ?? false);
      setReplyLikedByMe(prev => ({ ...prev, [replyId]: wasLiked }));
      setReplyLikeCounts(prev => ({ ...prev, [replyId]: Math.max(0, (prev[replyId] ?? 0) + (wasLiked ? 1 : -1)) }));
    },
  });

  const toggleReplyDislike = useMutation({
    mutationFn: async (replyId: string) => {
      const response = await apiRequest('POST', `/api/discussions/${discussion.id}/replies/${replyId}/dislike`, {});
      return response as { disliked: boolean; totalDislikes: number };
    },
    onMutate: (replyId: string) => {
      const wasDisliked = replyDislikedByMe[replyId] ?? false;
      setReplyDislikedByMe(prev => ({ ...prev, [replyId]: !wasDisliked }));
      setReplyDislikeCounts(prev => ({ ...prev, [replyId]: Math.max(0, (prev[replyId] ?? 0) + (wasDisliked ? -1 : 1)) }));
    },
    onSuccess: (data, replyId) => {
      setReplyDislikedByMe(prev => ({ ...prev, [replyId]: data.disliked }));
      setReplyDislikeCounts(prev => ({ ...prev, [replyId]: data.totalDislikes }));
    },
    onError: (_err, replyId) => {
      const wasDisliked = !(replyDislikedByMe[replyId] ?? false);
      setReplyDislikedByMe(prev => ({ ...prev, [replyId]: wasDisliked }));
      setReplyDislikeCounts(prev => ({ ...prev, [replyId]: Math.max(0, (prev[replyId] ?? 0) + (wasDisliked ? 1 : -1)) }));
    },
  });

  const dislikeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/discussions/${discussion.id}/dislike`);
    },
    onSuccess: (data: any) => {
      if (data && typeof data.disliked === 'boolean') {
        setUserHasDisliked(data.disliked);
        setDislikeCount(data.totalDislikes ?? dislikeCount);
        if (data.disliked && userHasLiked) {
          setUserHasLiked(false);
          setLikeCount((prev: number) => Math.max(0, prev - 1));
        }
      }
      queryClient.invalidateQueries({ queryKey: ['/api/discussions'] });
    },
    onError: () => {
      setUserHasDisliked((prev: boolean) => !prev);
      setDislikeCount((prev: number) => userHasDisliked ? prev + 1 : Math.max(0, prev - 1));
    },
  });

  const handleToggleDislike = () => {
    setUserHasDisliked((prev: boolean) => !prev);
    setDislikeCount((prev: number) => userHasDisliked ? Math.max(0, prev - 1) : prev + 1);
    dislikeMutation.mutate();
  };

  const updateDiscussion = useMutation({
    mutationFn: async (data: z.infer<typeof editSchema>) => {
      const response = await apiRequest('PATCH', `/api/discussions/${discussion.id}`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discussions"] });
      toast({
        title: "Success",
        description: "Discussion updated successfully!",
      });
      setShowEditDialog(false);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: `Failed to update discussion: ${error.message || 'Please try again.'}`,
        variant: "destructive",
      });
    },
  });

  const onSubmitEdit = async (data: z.infer<typeof editSchema>) => {
    await updateDiscussion.mutateAsync(data);
  };

  // Social share functions
  const getShareUrl = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/community?post=${discussion.id}`;
  };

  const shareToFacebook = () => {
    const url = encodeURIComponent(getShareUrl());
    const text = encodeURIComponent(`Check out this post on Man Up God's Way: "${discussion.title}"`);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${text}`, '_blank', 'width=600,height=400');
    setShowShareMenu(false);
  };

  const shareToTwitter = () => {
    const url = encodeURIComponent(getShareUrl());
    const text = encodeURIComponent(`Check out this post on Man Up God's Way: "${discussion.title}" - Join our community of men growing in faith!`);
    window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank', 'width=600,height=400');
    setShowShareMenu(false);
  };

  const shareToWhatsApp = () => {
    const url = encodeURIComponent(getShareUrl());
    const text = encodeURIComponent(`Check out this post on Man Up God's Way: "${discussion.title}" - ${url}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
    setShowShareMenu(false);
  };

  const shareByEmail = () => {
    const url = getShareUrl();
    const subject = encodeURIComponent(`Check out this post on Man Up God's Way`);
    const body = encodeURIComponent(`${discussion.title}\n\n${url}`);
    window.open(`mailto:?subject=${subject}&body=${body}`);
    setShowShareMenu(false);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(getShareUrl());
    toast({
      title: "Link Copied!",
      description: "Share link copied to clipboard",
    });
    setShowShareMenu(false);
  };

  const onSubmitReply = async (data: z.infer<typeof replySchema>) => {
    if (!(user as any)?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to reply",
        variant: "destructive",
      });
      return;
    }
    
    // Check subscription access for study discussions
    if (discussion.studyId && discussion.study?.requiredTier && discussion.study.requiredTier !== 'free') {
      if (currentUserSubscriptionStatus !== 'active') {
        toast({
          title: "Access Restricted",
          description: "This study discussion requires an active subscription to participate.",
          variant: "destructive",
        });
        return;
      }
    }
    
    await createReply.mutateAsync(data);
  };

  const onSubmitNestedReply = async (data: z.infer<typeof replySchema>) => {
    if (!(user as any)?.id) {
      toast({ title: "Error", description: "You must be logged in to reply", variant: "destructive" });
      return;
    }
    await createReply.mutateAsync({ ...data, parentReplyId: replyingToReplyId! });
    nestedReplyForm.reset();
    setReplyingToReplyId(null);
    setReplyingToName('');
  };

  const getTierBadge = (subscriptionTier: string) => {
    const status = discussion.user?.subscriptionStatus;
    if (status === 'active') {
      return <Badge className="bg-ministry-gold-exact text-black text-xs">Subscriber</Badge>;
    }
    if (status === 'trial') {
      return <Badge className="bg-blue-500 text-white text-xs">Trial</Badge>;
    }
    return null;
  };

  const getTimeAgo = (date: string) => {
    const now = new Date();
    const posted = new Date(date);
    const diffInHours = Math.floor((now.getTime() - posted.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const canReply = !(discussion.studyId && discussion.study?.requiredTier && discussion.study.requiredTier !== 'free' &&
    currentUserSubscriptionStatus !== 'active');

  return (
    <Card className="overflow-hidden w-full border-0 border-b border-white/8 rounded-none shadow-none bg-[#111]" data-testid="discussion-card">
      <CardContent className="p-0">

        {/* ── Header ─────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          <img
            src={discussion.user?.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent((discussion.user?.firstName || '') + '+' + (discussion.user?.lastName || ''))}&background=FCD000&color=000`}
            alt={`${discussion.user?.firstName} ${discussion.user?.lastName}`}
            className="w-10 h-10 rounded-full object-cover cursor-pointer border-2 border-[#FCD000] flex-shrink-0"
            onClick={(e) => { e.stopPropagation(); setLocation(`/users/${discussion.userId}`); }}
            data-testid="img-user-avatar"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-white text-sm leading-tight" data-testid="text-user-name">
                {discussion.user?.firstName} {discussion.user?.lastName?.charAt(0)}.
              </span>
              {getTierBadge(discussion.user?.subscriptionTier)}
              {discussion.studyId && (
                <Badge className="text-[10px] bg-[#FCD000] text-black font-black uppercase tracking-wide px-1.5 py-0 rounded-full border-0">Study</Badge>
              )}
            </div>
            <span className="text-xs text-white/40" data-testid="text-time-ago">{getTimeAgo(discussion.createdAt)}</span>
          </div>
          {/* Overflow menu: font size + edit / delete / flag */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Font size controls */}
            <button
              onClick={(e) => { e.stopPropagation(); adjustFontSize(-1); }}
              disabled={fontSizeLevel === 0}
              className="w-7 h-7 flex items-center justify-center rounded bg-[#FCD000] text-black hover:bg-yellow-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs font-black"
              title="Decrease font size"
              aria-label="Decrease font size"
            >
              A-
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); adjustFontSize(1); }}
              disabled={fontSizeLevel === 2}
              className="w-7 h-7 flex items-center justify-center rounded bg-[#FCD000] text-black hover:bg-yellow-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm font-black"
              title="Increase font size"
              aria-label="Increase font size"
            >
              A+
            </button>
            {isOwner && (
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-white/40 hover:text-white hover:bg-white/10 rounded-full"
                onClick={() => { editForm.reset({ title: discussion.title || '', content: discussion.content || '' }); setShowEditDialog(true); }}
                data-testid="button-edit-discussion">
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {canDelete && (
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-full"
                onClick={handleDeleteDiscussion} disabled={deleteDiscussion.isPending}
                data-testid="button-delete-discussion">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <FlagContentDialog contentType="discussion" contentId={discussion.id}
              triggerElement={
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-full">
                  <Flag className="h-4 w-4" />
                </Button>
              }
            />
          </div>
        </div>

        {/* ── Body text ──────────────────────────── */}
        {(() => {
          const hasHtml = /<[a-z][\s\S]*?>/i.test(discussion.content || '');
          return (
            <div
              className="px-4 pb-3 cursor-pointer"
              onClick={() => isLongContent && setIsExpanded(!isExpanded)}
              data-testid="content-container"
            >
              {hasHtml ? (
                <div
                  className={`${FONT_SIZE_CLASSES[fontSizeLevel]} text-white/80 leading-relaxed prose-invert [&_strong]:font-bold [&_em]:italic [&_u]:underline [&_s]:line-through ${!isExpanded && isLongContent ? 'line-clamp-5' : ''}`}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(discussion.content) }}
                  data-testid="text-discussion-content"
                />
              ) : (
                <p className={`${FONT_SIZE_CLASSES[fontSizeLevel]} text-white/80 leading-relaxed ${!isExpanded && isLongContent ? 'line-clamp-5' : ''}`}
                  data-testid="text-discussion-content">
                  {discussion.content}
                </p>
              )}
              {isLongContent && (
                <span className="text-xs font-bold text-[#FCD000] mt-1 block">
                  {isExpanded ? 'Show less' : 'See more'}
                </span>
              )}
            </div>
          );
        })()}

        {/* ── Media ──────────────────────────────── */}
        {discussion.mediaUrls && discussion.mediaUrls.length > 0 && (
          <div className={`mb-0 ${discussion.mediaUrls.length === 1 ? '' : 'grid grid-cols-2 gap-0.5'}`}>
            {discussion.mediaUrls.map((url: string, index: number) => {
              const mediaType = discussion.mediaTypes?.[index] || 'image';
              return (
                <div key={index} className="relative overflow-hidden bg-black">
                  {mediaType === 'video' ? (
                    <video src={url} controls className="w-full max-h-80 object-cover" data-testid={`video-media-${index}`} />
                  ) : (
                    <img src={url} alt={`Post media ${index + 1}`}
                      className={`w-full ${discussion.mediaUrls.length === 1 ? 'max-h-96' : 'h-44'} object-cover cursor-pointer hover:opacity-95 transition-opacity`}
                      onClick={() => setLightboxIndex(index)}
                      data-testid={`img-media-${index}`}
                    />
                  )}
                  {mediaType === 'gif' && (
                    <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">GIF</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Counts row ─────────────────────────── */}
        {(likeCount > 0 || (discussion.replyCount || 0) > 0) && (
          <div className="flex items-center justify-between px-4 py-2 text-xs text-white/40">
            {likeCount > 0 && (
              <button
                onClick={() => setShowLikersDialog(true)}
                className="flex items-center gap-1 hover:text-white/70 transition-colors"
              >
                <span className="w-4 h-4 rounded-full bg-[#FCD000] flex items-center justify-center">
                  <ChristianCross className="w-2.5 h-2.5 text-black" />
                </span>
                {likeCount}
              </button>
            )}
            {(discussion.replyCount || 0) > 0 && (
              <button onClick={() => setShowReplies(!showReplies)} className="ml-auto text-white/40 hover:text-white/70 transition-colors">
                {discussion.replyCount} {discussion.replyCount === 1 ? 'comment' : 'comments'}
              </button>
            )}
          </div>
        )}

        {/* ── Who Amened dialog ──────────────────── */}
        <Dialog open={showLikersDialog} onOpenChange={setShowLikersDialog}>
          <DialogContent className="bg-[#1a1a1a] border-white/10 text-white max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-[#FCD000]">
                <ChristianCross className="w-4 h-4" />
                Who said Amen
              </DialogTitle>
            </DialogHeader>
            <div className="mt-2 max-h-72 overflow-y-auto space-y-3">
              {likersLoading ? (
                <p className="text-sm text-white/50 text-center py-4">Loading...</p>
              ) : likers.length === 0 ? (
                <p className="text-sm text-white/50 text-center py-4">No one has said Amen yet.</p>
              ) : (
                likers.map((liker) => (
                  <div key={liker.id} className="flex items-center gap-3">
                    <img
                      src={liker.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent((liker.firstName || '') + '+' + (liker.lastName || ''))}&background=FCD000&color=000`}
                      alt={`${liker.firstName} ${liker.lastName}`}
                      className="w-8 h-8 rounded-full object-cover border border-[#FCD000]/30 flex-shrink-0"
                    />
                    <span className="text-sm font-medium text-white">
                      {liker.firstName} {liker.lastName?.charAt(0)}.
                    </span>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Facebook-style action bar ───────────── */}
        <div className="flex items-center border-t border-white/8 mx-0">
          {/* Amen + Disagree pair */}
          <button
            onClick={() => toggleLike.mutate()}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold transition-colors border-r border-white/8 ${
              userHasLiked ? 'text-[#FCD000]' : 'text-white/50 hover:text-white'
            }`}
            data-testid="button-like-discussion"
          >
            <ChristianCross className="w-4 h-4" />
            <span>Amen</span>
            {likeCount > 0 && <span className="text-xs opacity-70">{likeCount}</span>}
          </button>
          <button
            onClick={handleToggleDislike}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold transition-colors ${
              userHasDisliked ? 'text-red-400' : 'text-white/50 hover:text-white'
            }`}
            data-testid="button-dislike-discussion"
          >
            <ThumbsDown className="w-4 h-4" />
            <span>Oh Me!</span>
            {dislikeCount > 0 && <span className="text-xs opacity-70">{dislikeCount}</span>}
          </button>

          {/* Comment */}
          <button
            onClick={() => { setShowReplyForm(!showReplyForm); if (!showReplies && discussion.replyCount > 0) setShowReplies(true); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors border-x border-white/8 ${showReplyForm ? 'text-[#FCD000]' : 'text-white/50 hover:text-white'}`}
            data-testid="button-reply"
          >
            <MessageCircle className="w-4 h-4" />
            <span>{canReply ? 'Comment' : 'Members'}</span>
            {(discussion.replyCount || 0) > 0 && (
              <span className="text-xs opacity-70">{discussion.replyCount}</span>
            )}
          </button>

          {/* Share */}
          <div className="relative flex-1">
            <button
              onClick={() => setShowShareMenu(!showShareMenu)}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white/50 hover:text-white transition-colors"
              data-testid="button-share-discussion"
            >
              <Share2 className="w-4 h-4" />
              <span>Share</span>
            </button>
            {showShareMenu && (
              <div className="absolute bottom-full right-0 mb-2 bg-[#1a1a1a] border border-white/15 rounded-xl shadow-2xl p-3 z-50">
                <p className="text-[10px] text-white/40 font-black uppercase tracking-widest mb-2">Share to</p>
                <div className="flex items-center gap-2">
                  <button onClick={shareToFacebook} data-testid="button-share-facebook"
                    className="p-2 bg-[#1877F2] text-white rounded-sm hover:opacity-80 transition-opacity">
                    <SiFacebook className="w-5 h-5" />
                  </button>
                  <button onClick={shareToTwitter} data-testid="button-share-twitter"
                    className="p-2 bg-black text-white border border-white rounded-sm hover:opacity-80 transition-opacity">
                    <SiX className="w-5 h-5" />
                  </button>
                  <button onClick={shareToWhatsApp} data-testid="button-share-whatsapp"
                    className="p-2 bg-[#25D366] text-white rounded-sm hover:opacity-80 transition-opacity">
                    <SiWhatsapp className="w-5 h-5" />
                  </button>
                  <button onClick={shareByEmail} data-testid="button-share-email"
                    className="p-2 bg-gray-600 text-white rounded-sm hover:opacity-80 transition-opacity">
                    <Mail className="w-5 h-5" />
                  </button>
                  <button onClick={copyLink} data-testid="button-copy-link"
                    className="p-2 bg-gray-700 text-white rounded-sm hover:opacity-80 transition-opacity">
                    <Link2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Reply input ────────────────────────── */}
        {showReplyForm && canReply && (
          <div className="px-4 pt-2 pb-3 border-t border-white/8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmitReply)} className="flex items-end gap-2">
                <div className="flex-1">
                  <textarea
                    placeholder="Write a comment..."
                    rows={2}
                    disabled={createReply.isPending}
                    {...form.register('content')}
                    className="w-full bg-white border border-white/15 rounded-xl px-3 py-2 text-sm text-black placeholder:text-black/40 resize-none focus:outline-none focus:border-[#FCD000]"
                  />
                </div>
                <Button type="submit" disabled={createReply.isPending}
                  className="h-9 w-9 p-0 rounded-full bg-[#FCD000] text-black hover:bg-yellow-300 flex-shrink-0">
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </Form>
          </div>
        )}

        {/* ── Comments ───────────────────────────── */}
        {showReplies && discussion.replyCount > 0 && (
          <div className="border-t border-white/8">
            {(() => {
              const allReplies = (replies as any[]) || [];
              const topLevel = allReplies.filter((r: any) => !r.parentReplyId);
              const nested: Record<string, any[]> = {};
              allReplies.filter((r: any) => r.parentReplyId).forEach((r: any) => {
                if (!nested[r.parentReplyId]) nested[r.parentReplyId] = [];
                nested[r.parentReplyId].push(r);
              });

              const renderReply = (reply: any, isNested = false) => (
                <div key={reply.id} data-reply-id={reply.id} className={isNested ? "ml-9 mt-1" : ""}>
                  <div className={`flex items-start gap-3 transition-colors duration-300 ${isNested ? "py-2" : "px-4 py-3 border-b border-white/5"}`}>
                    <img
                      src={reply.user?.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent((reply.user?.firstName || '') + '+' + (reply.user?.lastName || ''))}&background=FCD000&color=000&size=32`}
                      alt={`${reply.user?.firstName} ${reply.user?.lastName}`}
                      className="w-7 h-7 rounded-full object-cover cursor-pointer flex-shrink-0 border border-[#FCD000]/30"
                      onClick={(e) => { e.stopPropagation(); setLocation(`/users/${reply.userId}`); }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="bg-white/8 rounded-2xl px-3 py-2">
                        <span className="font-bold text-white text-xs block">
                          {reply.user?.firstName} {reply.user?.lastName?.charAt(0)}.
                        </span>
                        {isNested && reply.parentReplyId && (
                          <span className="text-[10px] text-[#FCD000]/60 block -mt-0.5 mb-0.5">
                            ↩ reply
                          </span>
                        )}
                        {editingReplyId === reply.id ? (
                          <div className="mt-1">
                            <Textarea
                              value={editReplyContent}
                              onChange={(e) => setEditReplyContent(e.target.value)}
                              className="bg-white/10 text-white border-white/20 text-sm min-h-[60px] resize-none"
                              autoFocus
                            />
                            <div className="flex gap-2 mt-1.5">
                              <Button size="sm" className="h-6 px-2 text-xs bg-[#FCD000] text-black hover:bg-[#FCD000]/90"
                                onClick={() => editReply.mutate({ replyId: reply.id, content: editReplyContent })}
                                disabled={editReply.isPending || !editReplyContent.trim()}>
                                Save
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-white/60 hover:text-white"
                                onClick={() => { setEditingReplyId(null); setEditReplyContent(''); }}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-white/80 leading-relaxed mt-0.5">{reply.content}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 px-1">
                        <span className="text-[10px] text-white/35">{getTimeAgo(reply.createdAt)}</span>
                        <button
                          className={`text-xs font-bold transition-colors flex items-center gap-1 ${
                            (replyLikedByMe[reply.id] ?? (reply as any).likedByMe ?? false)
                              ? 'text-[#FCD000]'
                              : 'text-white/40 hover:text-[#FCD000]'
                          }`}
                          onClick={() => toggleReplyLike.mutate(reply.id)}
                          data-testid={`button-like-reply-${reply.id}`}>
                          <ChristianCross className="w-3 h-3" />
                          <span>Amen</span>
                          {(replyLikeCounts[reply.id] ?? reply.likes ?? 0) > 0 && (
                            <span className="opacity-70">{replyLikeCounts[reply.id] ?? reply.likes}</span>
                          )}
                        </button>
                        <button
                          className={`text-xs font-bold transition-colors flex items-center gap-1 ${
                            (replyDislikedByMe[reply.id] ?? (reply as any).dislikedByMe ?? false)
                              ? 'text-red-400'
                              : 'text-white/40 hover:text-red-400'
                          }`}
                          onClick={() => toggleReplyDislike.mutate(reply.id)}
                          data-testid={`button-dislike-reply-${reply.id}`}>
                          <ThumbsDown className="w-3 h-3" />
                          <span>Oh Me!</span>
                          {(replyDislikeCounts[reply.id] ?? (reply as any).dislikes ?? 0) > 0 && (
                            <span className="opacity-70">{replyDislikeCounts[reply.id] ?? (reply as any).dislikes}</span>
                          )}
                        </button>
                        {!isNested && canReply && (
                          <button
                            className="text-xs font-bold text-white/40 hover:text-[#FCD000] transition-colors"
                            onClick={() => {
                              if (replyingToReplyId === reply.id) {
                                setReplyingToReplyId(null);
                                setReplyingToName('');
                              } else {
                                setReplyingToReplyId(reply.id);
                                setReplyingToName(`${reply.user?.firstName || ''} ${reply.user?.lastName?.charAt(0) || ''}.`);
                                nestedReplyForm.reset({ content: '' });
                              }
                            }}
                          >
                            Reply
                          </button>
                        )}
                        <div className="flex items-center gap-1 ml-auto">
                          <FlagContentDialog contentType="reply" contentId={reply.id}
                            triggerElement={
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-full">
                                <Flag className="h-3 w-3" />
                              </Button>
                            }
                          />
                          {(user && (user as any).id === reply.userId) && (
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-white/30 hover:text-[#FCD000] hover:bg-[#FCD000]/10 rounded-full"
                              onClick={() => {
                                setEditingReplyId(reply.id);
                                setEditReplyContent(reply.content);
                              }}
                              data-testid={`button-edit-reply-${reply.id}`}>
                              <Edit className="h-3 w-3" />
                            </Button>
                          )}
                          {(isAdmin || (user && (user as any).id === reply.userId)) && (
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-full"
                              onClick={() => handleDeleteReply(reply.id)} disabled={deleteReply.isPending}
                              data-testid={`button-delete-reply-${reply.id}`}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Inline nested reply form */}
                  {!isNested && replyingToReplyId === reply.id && (
                    <div className="ml-9 mb-2 px-4">
                      <Form {...nestedReplyForm}>
                        <form onSubmit={nestedReplyForm.handleSubmit(onSubmitNestedReply)} className="flex items-end gap-2">
                          <FormField
                            control={nestedReplyForm.control}
                            name="content"
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormControl>
                                  <textarea
                                    placeholder={`Reply to ${replyingToName}…`}
                                    className="w-full border border-white/15 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-[#FCD000]/50 resize-none"
                                    style={{ backgroundColor: 'rgba(255,255,255,0.08)', colorScheme: 'dark' }}
                                    rows={2}
                                    autoFocus
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="flex flex-col gap-1">
                            <Button
                              type="submit"
                              size="sm"
                              disabled={createReply.isPending}
                              className="bg-[#FCD000] text-black font-bold text-xs h-8 px-3 rounded-lg hover:bg-[#FCD000]/90"
                            >
                              {createReply.isPending ? '...' : 'Post'}
                            </Button>
                            <button
                              type="button"
                              onClick={() => { setReplyingToReplyId(null); setReplyingToName(''); nestedReplyForm.reset(); }}
                              className="text-[10px] text-white/40 hover:text-white/70 text-center"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      </Form>
                    </div>
                  )}

                  {/* Nested replies */}
                  {!isNested && nested[reply.id]?.length > 0 && (
                    <div className="border-l-2 border-white/10 ml-10 mr-4 mb-1">
                      {nested[reply.id].map((nr: any) => renderReply(nr, true))}
                    </div>
                  )}
                </div>
              );

              return <div className="space-y-0">{topLevel.map((r: any) => renderReply(r, false))}</div>;
            })()}
          </div>
        )}
      </CardContent>

      {/* Profile Menu */}

      {/* Edit Discussion Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-black border-2 border-ministry-gold-exact text-white max-w-md rounded-sm shadow-[6px_6px_0px_0px_rgba(252,208,0,1)]">
          <DialogHeader>
            <DialogTitle className="text-ministry-gold-exact font-black uppercase tracking-wide">Edit Discussion</DialogTitle>
            <DialogDescription className="text-gray-400">
              Make changes to your discussion post below.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onSubmitEdit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        placeholder="Discussion title..."
                        className="bg-black text-white border-2 border-ministry-gold-exact/30 focus:border-ministry-gold-exact rounded-sm"
                        {...field}
                        data-testid="input-edit-title"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder="What's on your mind?"
                        className="min-h-[120px] resize-none bg-black text-white border-2 border-ministry-gold-exact/30 focus:border-ministry-gold-exact rounded-sm"
                        {...field}
                        data-testid="textarea-edit-content"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowEditDialog(false)}
                  className="text-gray-400 hover:text-white hover:bg-gray-800 rounded-sm border-2 border-gray-600 px-4 font-bold"
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateDiscussion.isPending}
                  className="bg-ministry-gold-exact text-black hover:bg-yellow-400 rounded-sm border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] px-4 font-black uppercase tracking-wide"
                  data-testid="button-save-edit"
                >
                  {updateDiscussion.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Image Lightbox ──────────────────────── */}
      {lightboxIndex !== null && discussion.mediaUrls && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setLightboxIndex(null)}
        >
          {/* Close button */}
          <button
            className="absolute top-4 right-4 z-10 bg-black/60 hover:bg-black/90 text-white rounded-full p-2.5 transition-colors"
            onClick={() => setLightboxIndex(null)}
            aria-label="Close image"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Prev arrow */}
          {discussion.mediaUrls.filter((_: string, i: number) => (discussion.mediaTypes?.[i] || 'image') !== 'video').length > 1 && (
            <button
              className="absolute left-4 z-10 bg-black/60 hover:bg-black/90 text-white rounded-full p-2.5 transition-colors"
              onClick={(e) => { e.stopPropagation(); const imageUrls = discussion.mediaUrls.filter((_: string, i: number) => (discussion.mediaTypes?.[i] || 'image') !== 'video'); const cur = imageUrls.indexOf(discussion.mediaUrls[lightboxIndex]); setLightboxIndex(discussion.mediaUrls.indexOf(imageUrls[(cur - 1 + imageUrls.length) % imageUrls.length])); }}
              aria-label="Previous image"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* Image */}
          <img
            src={discussion.mediaUrls[lightboxIndex]}
            alt="Post image"
            className="max-w-[92vw] max-h-[88vh] object-contain rounded-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Next arrow */}
          {discussion.mediaUrls.filter((_: string, i: number) => (discussion.mediaTypes?.[i] || 'image') !== 'video').length > 1 && (
            <button
              className="absolute right-16 z-10 bg-black/60 hover:bg-black/90 text-white rounded-full p-2.5 transition-colors"
              onClick={(e) => { e.stopPropagation(); const imageUrls = discussion.mediaUrls.filter((_: string, i: number) => (discussion.mediaTypes?.[i] || 'image') !== 'video'); const cur = imageUrls.indexOf(discussion.mediaUrls[lightboxIndex]); setLightboxIndex(discussion.mediaUrls.indexOf(imageUrls[(cur + 1) % imageUrls.length])); }}
              aria-label="Next image"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* Image counter */}
          {discussion.mediaUrls.filter((_: string, i: number) => (discussion.mediaTypes?.[i] || 'image') !== 'video').length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm px-3 py-1 rounded-full">
              {discussion.mediaUrls.filter((_: string, i: number) => (discussion.mediaTypes?.[i] || 'image') !== 'video').indexOf(discussion.mediaUrls[lightboxIndex]) + 1}
              {' / '}
              {discussion.mediaUrls.filter((_: string, i: number) => (discussion.mediaTypes?.[i] || 'image') !== 'video').length}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
