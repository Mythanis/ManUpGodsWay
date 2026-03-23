import { useState } from "react";
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
import { Heart, MessageCircle, Send, ChevronDown, ChevronUp, UserPlus, Flag, Plus, Edit, Share2, Trash2, ThumbsDown } from "lucide-react";

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
import { SiFacebook, SiX, SiWhatsapp, SiLinkedin } from "react-icons/si";
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
  currentUserTier?: string;
}

const replySchema = z.object({
  content: z.string().min(1, "Reply content is required"),
});

export default function DiscussionCard({ 
  discussion, 
  onStartDirectMessage,
  onAddToGroup,
  currentUserTier = 'free'
}: DiscussionCardProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [userHasLiked, setUserHasLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(discussion.likes || 0);
  const [userHasDisliked, setUserHasDisliked] = useState(false);
  const [dislikeCount, setDislikeCount] = useState(0);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Check if content is long enough to need expansion
  const isLongContent = discussion.content && discussion.content.length > 280;
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

  const createReply = useMutation({
    mutationFn: async (data: z.infer<typeof replySchema>) => {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discussions"] });
      const newLikedState = !userHasLiked;
      setUserHasLiked(newLikedState);
      setLikeCount((prev: number) => newLikedState ? prev + 1 : prev - 1);
      toast({
        title: "Success",
        description: newLikedState ? "Discussion liked!" : "Removed like",
      });
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

  const handleToggleDislike = () => {
    if (userHasDisliked) {
      setUserHasDisliked(false);
      setDislikeCount((prev: number) => Math.max(0, prev - 1));
    } else {
      setUserHasDisliked(true);
      setDislikeCount((prev: number) => prev + 1);
      if (userHasLiked) {
        setUserHasLiked(false);
        setLikeCount((prev: number) => Math.max(0, prev - 1));
      }
    }
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

  const shareToLinkedIn = () => {
    const url = encodeURIComponent(getShareUrl());
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank', 'width=600,height=400');
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
    
    // Check tier access for study discussions
    if (discussion.studyId && discussion.study?.requiredTier && discussion.study.requiredTier !== 'free') {
      const hasAccess = (discussion.study.requiredTier === 'premium' && ['premium', 'vip'].includes(currentUserTier)) ||
                       (discussion.study.requiredTier === 'vip' && currentUserTier === 'vip');
      
      if (!hasAccess) {
        toast({
          title: "Access Restricted",
          description: `This study discussion requires ${discussion.study.requiredTier} subscription to participate.`,
          variant: "destructive",
        });
        return;
      }
    }
    
    await createReply.mutateAsync(data);
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
    !((discussion.study.requiredTier === 'premium' && ['premium', 'vip'].includes(currentUserTier)) ||
      (discussion.study.requiredTier === 'vip' && currentUserTier === 'vip')));

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
          {/* Overflow menu: edit / delete / flag */}
          <div className="flex items-center gap-1 flex-shrink-0">
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

        {/* ── Title ──────────────────────────────── */}
        <div className="px-4 pb-1">
          <h4 className="font-bold text-white text-base leading-snug" data-testid="text-discussion-title">
            {discussion.title}
          </h4>
        </div>

        {/* ── Body text ──────────────────────────── */}
        <div
          className="px-4 pb-3 cursor-pointer"
          onClick={() => isLongContent && setIsExpanded(!isExpanded)}
          data-testid="content-container"
        >
          <p className={`text-sm text-white/80 leading-relaxed ${!isExpanded && isLongContent ? 'line-clamp-5' : ''}`}
            data-testid="text-discussion-content">
            {discussion.content}
          </p>
          {isLongContent && (
            <span className="text-xs font-bold text-[#FCD000] mt-1 block">
              {isExpanded ? 'Show less' : 'See more'}
            </span>
          )}
        </div>

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
                      onClick={() => window.open(url, '_blank')}
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
              <span className="flex items-center gap-1">
                <span className="w-4 h-4 rounded-full bg-[#FCD000] flex items-center justify-center">
                  <ChristianCross className="w-2.5 h-2.5 text-black" />
                </span>
                {likeCount}
              </span>
            )}
            {(discussion.replyCount || 0) > 0 && (
              <button onClick={() => setShowReplies(!showReplies)} className="ml-auto text-white/40 hover:text-white/70 transition-colors">
                {discussion.replyCount} {discussion.replyCount === 1 ? 'comment' : 'comments'}
              </button>
            )}
          </div>
        )}

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
            <span>Disagree</span>
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
              <div className="absolute bottom-full right-0 mb-2 bg-[#1a1a1a] border border-white/15 rounded-xl shadow-2xl p-2 z-50 min-w-[180px]">
                <p className="text-[10px] text-white/40 font-black uppercase tracking-widest px-3 py-1">Share to</p>
                {[
                  { label: 'Facebook', icon: SiFacebook, action: shareToFacebook, test: 'button-share-facebook' },
                  { label: 'X (Twitter)', icon: SiX, action: shareToTwitter, test: 'button-share-twitter' },
                  { label: 'WhatsApp', icon: SiWhatsapp, action: shareToWhatsApp, test: 'button-share-whatsapp' },
                  { label: 'LinkedIn', icon: SiLinkedin, action: shareToLinkedIn, test: 'button-share-linkedin' },
                ].map(({ label, icon: Icon, action, test }) => (
                  <button key={label} onClick={action} data-testid={test}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-white hover:bg-white/10 rounded-lg transition-colors font-medium">
                    <Icon className="w-4 h-4 text-white/60" /> {label}
                  </button>
                ))}
                <div className="border-t border-white/10 my-1" />
                <button onClick={copyLink} data-testid="button-copy-link"
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-white hover:bg-white/10 rounded-lg transition-colors font-medium">
                  <Share2 className="w-4 h-4 text-white/60" /> Copy Link
                </button>
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
                    className="w-full bg-white/8 border border-white/15 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/35 resize-none focus:outline-none focus:border-[#FCD000]/50"
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
            <div className="space-y-0">
              {(replies as any[])?.map((reply: any) => (
                <div key={reply.id} className="px-4 py-3 border-b border-white/5">
                  <div className="flex items-start gap-3">
                    <img
                      src={reply.user?.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent((reply.user?.firstName || '') + '+' + (reply.user?.lastName || ''))}&background=FCD000&color=000&size=32`}
                      alt={`${reply.user?.firstName} ${reply.user?.lastName}`}
                      className="w-8 h-8 rounded-full object-cover cursor-pointer flex-shrink-0 border border-[#FCD000]/30"
                      onClick={(e) => { e.stopPropagation(); setLocation(`/users/${reply.userId}`); }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="bg-white/8 rounded-2xl px-3 py-2">
                        <span className="font-bold text-white text-xs block">
                          {reply.user?.firstName} {reply.user?.lastName?.charAt(0)}.
                        </span>
                        <p className="text-sm text-white/80 leading-relaxed mt-0.5">{reply.content}</p>
                      </div>
                      <div className="flex items-center gap-3 mt-1 px-1">
                        <span className="text-[10px] text-white/35">{getTimeAgo(reply.createdAt)}</span>
                        <button className="text-xs font-bold text-white/40 hover:text-[#FCD000] transition-colors flex items-center gap-1"
                          data-testid={`button-like-reply-${reply.id}`}>
                          <ChristianCross className="w-3 h-3" /> {reply.likes || 0}
                        </button>
                        <div className="flex items-center gap-1 ml-auto">
                          <FlagContentDialog contentType="reply" contentId={reply.id}
                            triggerElement={
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-full">
                                <Flag className="h-3 w-3" />
                              </Button>
                            }
                          />
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
                </div>
              ))}
            </div>
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
    </Card>
  );
}
