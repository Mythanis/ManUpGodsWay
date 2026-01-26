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
import { Heart, MessageCircle, Send, ChevronDown, ChevronUp, UserPlus, Flag, Plus, Edit, Share2 } from "lucide-react";

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
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Check if content is long enough to need expansion
  const isLongContent = discussion.content && discussion.content.length > 280;
  const { user } = useAuth();
  
  // Check if current user owns this discussion
  const isOwner = user && (user as any).id === discussion.userId;
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
    switch (subscriptionTier) {
      case 'vip':
        return <Badge className="bg-ministry-gold-exact text-black text-xs">VIP</Badge>;
      case 'premium':
        return <Badge className="bg-black text-white text-xs">Premium</Badge>;
      default:
        return null;
    }
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

  return (
    <Card className="liquid-gold-card border-2 border-black rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all overflow-hidden w-full" style={{ fontFamily: "'Inter', 'DM Sans', sans-serif" }} data-testid="discussion-card">
      <CardContent className="p-4 relative">
        <div className="flex items-start space-x-3 relative z-10">
          <img 
            src={discussion.user?.profileImageUrl || `https://ui-avatars.com/api/?name=${discussion.user?.firstName}+${discussion.user?.lastName}&background=4A90B8&color=fff`}
            alt={`${discussion.user?.firstName} ${discussion.user?.lastName}`}
            className="w-12 h-12 rounded-sm object-cover cursor-pointer border-2 border-ministry-gold-exact hover:border-white transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setLocation(`/users/${discussion.userId}`);
            }}
            data-testid="img-user-avatar"
          />
          <div className="flex-1">
            <div className="flex items-center flex-wrap gap-2 mb-2">
              <h3 className="font-black text-sm text-black uppercase tracking-wide" style={{ fontFamily: "'Inter', sans-serif" }} data-testid="text-user-name">
                {discussion.user?.firstName} {discussion.user?.lastName?.charAt(0)}.
              </h3>
              {getTierBadge(discussion.user?.subscriptionTier)}
              <span className="text-xs text-black/60 font-medium" data-testid="text-time-ago">
                • {getTimeAgo(discussion.createdAt)}
              </span>
            </div>
            
            <div className="mb-3 pb-2 border-b-2 border-black/10">
              <div className="flex items-center flex-wrap gap-2">
                <h4 className="font-black text-black text-xl tracking-tight" style={{ fontFamily: "'Inter', sans-serif", letterSpacing: '-0.02em' }} data-testid="text-discussion-title">
                  {discussion.title}
                </h4>
                {discussion.studyId && (
                  <Badge className="text-xs bg-ministry-gold-exact text-black font-bold uppercase tracking-wide rounded-sm border-2 border-black">
                    📚 Study
                  </Badge>
                )}
                {discussion.studyId && discussion.study?.requiredTier && discussion.study.requiredTier !== 'free' && (
                  <Badge className="text-xs bg-black text-ministry-gold-exact font-bold uppercase tracking-wide rounded-sm border-2 border-ministry-gold-exact">
                    {discussion.study.requiredTier.charAt(0).toUpperCase() + discussion.study.requiredTier.slice(1)} Only
                  </Badge>
                )}
              </div>
            </div>
            
            <div 
              className="relative mb-4 p-4 rounded-lg cursor-pointer"
              style={{ 
                background: 'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 70%, rgba(252,208,0,0.3) 100%)',
                backdropFilter: 'blur(4px)'
              }}
              onClick={() => isLongContent && setIsExpanded(!isExpanded)}
              data-testid="content-container"
            >
              <p 
                className={`text-base text-gray-800 leading-relaxed ${!isExpanded && isLongContent ? 'line-clamp-4' : ''}`} 
                style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400 }} 
                data-testid="text-discussion-content"
              >
                {discussion.content}
              </p>
              {isLongContent && !isExpanded && (
                <div 
                  className="absolute bottom-0 left-0 right-0 h-12 flex items-end justify-center pb-2"
                  style={{ background: 'linear-gradient(to top, rgba(255,255,255,0.95), transparent)' }}
                >
                  <span className="text-sm font-bold text-black/70 hover:text-black transition-colors">
                    Click to read more...
                  </span>
                </div>
              )}
              {isLongContent && isExpanded && (
                <div className="text-center mt-3 pt-2 border-t border-black/10">
                  <span className="text-sm font-bold text-black/70 hover:text-black transition-colors">
                    Click to collapse
                  </span>
                </div>
              )}
            </div>
            
            {/* Media Display */}
            {discussion.mediaUrls && discussion.mediaUrls.length > 0 && (
              <div className={`mb-3 ${discussion.mediaUrls.length === 1 ? '' : 'grid grid-cols-2 gap-2'}`}>
                {discussion.mediaUrls.map((url: string, index: number) => {
                  const mediaType = discussion.mediaTypes?.[index] || 'image';
                  return (
                    <div key={index} className="relative rounded-lg overflow-hidden">
                      {mediaType === 'video' ? (
                        <video 
                          src={url} 
                          controls
                          className="w-full max-h-80 object-cover rounded-lg bg-gray-800"
                          data-testid={`video-media-${index}`}
                        />
                      ) : (
                        <img 
                          src={url} 
                          alt={`Post media ${index + 1}`}
                          className={`w-full ${discussion.mediaUrls.length === 1 ? 'max-h-96' : 'h-40'} object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity`}
                          onClick={() => window.open(url, '_blank')}
                          data-testid={`img-media-${index}`}
                        />
                      )}
                      {mediaType === 'gif' && (
                        <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded">
                          GIF
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            
            <div className="flex flex-wrap items-center gap-2 pt-3 mt-3 border-t-2 border-black/20">
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleLike.mutate()}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm font-black uppercase text-xs tracking-wide ${
                    userHasLiked ? 'bg-ministry-gold-exact text-black' : 'bg-black text-white hover:bg-ministry-gold-exact hover:text-black'
                  } border-2 border-black shadow-[2px_2px_0px_0px_rgba(252,208,0,0.3)] transition-all`}
                  data-testid="button-like-discussion"
                >
                  <ChristianCross className="w-3.5 h-3.5" />
                  <span>{likeCount}</span>
                </Button>
                
                <Button 
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowReplies(!showReplies)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white hover:bg-ministry-gold-exact hover:text-black rounded-sm font-black uppercase text-xs tracking-wide border-2 border-black shadow-[2px_2px_0px_0px_rgba(252,208,0,0.3)] transition-all"
                  data-testid="button-replies"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>{discussion.replyCount || 0}</span>
                  {discussion.replyCount > 0 && (
                    showReplies ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </Button>
              </div>
              
              <div className="flex items-center gap-2 ml-auto">
                <Button 
                  size="sm"
                  onClick={() => {
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
                    setShowReplyForm(!showReplyForm);
                  }}
                  className={`px-3 py-1.5 rounded-sm font-black uppercase tracking-wide text-xs border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all ${
                    discussion.studyId && discussion.study?.requiredTier && discussion.study.requiredTier !== 'free' &&
                    !((discussion.study.requiredTier === 'premium' && ['premium', 'vip'].includes(currentUserTier)) ||
                      (discussion.study.requiredTier === 'vip' && currentUserTier === 'vip'))
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      : 'bg-ministry-gold-exact text-black hover:bg-yellow-400 hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                  }`}
                  data-testid="button-reply"
                >
                  {discussion.studyId && discussion.study?.requiredTier && discussion.study.requiredTier !== 'free' &&
                   !((discussion.study.requiredTier === 'premium' && ['premium', 'vip'].includes(currentUserTier)) ||
                     (discussion.study.requiredTier === 'vip' && currentUserTier === 'vip'))
                    ? `${discussion.study.requiredTier.charAt(0).toUpperCase() + discussion.study.requiredTier.slice(1)}` 
                    : 'Reply'
                  }
                </Button>
              
                {/* Edit Button - Only for post owner */}
                {isOwner && (
                  <Button 
                    size="sm" 
                    className="bg-black text-white hover:bg-ministry-gold-exact hover:text-black p-1.5 rounded-sm border-2 border-black shadow-[2px_2px_0px_0px_rgba(252,208,0,0.3)] transition-all"
                    onClick={() => {
                      editForm.reset({
                        title: discussion.title || '',
                        content: discussion.content || '',
                      });
                      setShowEditDialog(true);
                    }}
                    data-testid="button-edit-discussion"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                )}

                {/* Share Button */}
                <div className="relative">
                  <Button 
                    size="sm" 
                    className="bg-black text-white hover:bg-ministry-gold-exact hover:text-black p-1.5 rounded-sm border-2 border-black shadow-[2px_2px_0px_0px_rgba(252,208,0,0.3)] transition-all"
                    onClick={() => setShowShareMenu(!showShareMenu)}
                    data-testid="button-share-discussion"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                  </Button>
                  
                  {showShareMenu && (
                    <div className="absolute right-0 bottom-full mb-2 bg-black border-2 border-ministry-gold-exact rounded-sm shadow-[4px_4px_0px_0px_rgba(252,208,0,1)] p-2 z-50 min-w-[160px]">
                    <div className="text-xs text-ministry-gold-exact font-black uppercase tracking-wide mb-2 px-2">Share to:</div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-white hover:text-black hover:bg-ministry-gold-exact rounded-sm font-bold text-xs"
                      onClick={shareToFacebook}
                      data-testid="button-share-facebook"
                    >
                      <SiFacebook className="h-4 w-4 mr-2" />
                      Facebook
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-white hover:text-black hover:bg-ministry-gold-exact rounded-sm font-bold text-xs"
                      onClick={shareToTwitter}
                      data-testid="button-share-twitter"
                    >
                      <SiX className="h-4 w-4 mr-2" />
                      X (Twitter)
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-white hover:text-black hover:bg-ministry-gold-exact rounded-sm font-bold text-xs"
                      onClick={shareToWhatsApp}
                      data-testid="button-share-whatsapp"
                    >
                      <SiWhatsapp className="h-4 w-4 mr-2" />
                      WhatsApp
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-white hover:text-black hover:bg-ministry-gold-exact rounded-sm font-bold text-xs"
                      onClick={shareToLinkedIn}
                      data-testid="button-share-linkedin"
                    >
                      <SiLinkedin className="h-4 w-4 mr-2" />
                      LinkedIn
                    </Button>
                    <div className="border-t border-ministry-gold-exact/30 my-1"></div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-white hover:text-black hover:bg-ministry-gold-exact rounded-sm font-bold text-xs"
                      onClick={copyLink}
                      data-testid="button-copy-link"
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      Copy Link
                    </Button>
                  </div>
                )}
              </div>

                {/* Flag Discussion Button */}
                <FlagContentDialog 
                  contentType="discussion" 
                  contentId={discussion.id}
                  triggerElement={
                    <Button size="sm" className="bg-black text-white hover:bg-red-600 hover:text-white p-1.5 rounded-sm border-2 border-black shadow-[2px_2px_0px_0px_rgba(252,208,0,0.3)] transition-all">
                      <Flag className="h-3.5 w-3.5" />
                    </Button>
                  }
                />
              </div>
            </div>
          </div>
        </div>
        
        {/* Show replies if expanded */}
        {showReplies && discussion.replyCount > 0 && (
          <div className="mt-4 pt-4 border-t-2 border-black/20 relative z-10">
            <div className="space-y-3">
              {(replies as any[])?.map((reply: any) => (
                <div key={reply.id} className="flex items-start space-x-3 ml-4 p-3 bg-black rounded-sm border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <img 
                    src={reply.user?.profileImageUrl || `https://ui-avatars.com/api/?name=${reply.user?.firstName}+${reply.user?.lastName}&background=FCD000&color=000&size=32`}
                    alt={`${reply.user?.firstName} ${reply.user?.lastName}`}
                    className="w-8 h-8 rounded-sm object-cover cursor-pointer border-2 border-ministry-gold-exact hover:border-white transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLocation(`/users/${reply.userId}`);
                    }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-black text-xs text-ministry-gold-exact uppercase tracking-wide">
                        {reply.user?.firstName} {reply.user?.lastName?.charAt(0)}.
                      </span>
                      <span className="text-xs text-gray-400 font-medium">
                        • {getTimeAgo(reply.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed">{reply.content}</p>
                    
                    {/* Like and Flag Reply Buttons */}
                    <div className="flex justify-between items-center mt-2">
                      <Button 
                        variant="ghost"
                        size="sm"
                        className="flex items-center gap-1 text-white hover:text-black hover:bg-ministry-gold-exact px-2 py-1 rounded-sm border border-ministry-gold-exact/50 transition-all"
                        data-testid={`button-like-reply-${reply.id}`}
                      >
                        <ChristianCross className="w-3 h-3" />
                        <span className="text-xs font-bold">{reply.likes || 0}</span>
                      </Button>
                      <FlagContentDialog 
                        contentType="reply" 
                        contentId={reply.id}
                        triggerElement={
                          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-red-500 hover:bg-red-500/10 p-1 rounded-sm transition-all">
                            <Flag className="h-3 w-3" />
                          </Button>
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {showReplyForm && (
          <div className="mt-4 pt-4 border-t-2 border-black/20 bg-black rounded-sm p-4 relative z-10 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <h4 className="text-sm font-black text-ministry-gold-exact mb-3 uppercase tracking-wide">Write your reply</h4>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmitReply)} className="space-y-3">
                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          placeholder="Write your reply..."
                          className="min-h-[80px] resize-none bg-black text-white border-2 border-ministry-gold-exact/30 focus:border-ministry-gold-exact rounded-sm"
                          {...field}
                          data-testid="textarea-reply-content"
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
                    size="sm"
                    onClick={() => {
                      setShowReplyForm(false);
                      form.reset();
                    }}
                    className="text-xs font-bold text-gray-400 hover:text-white hover:bg-gray-800 rounded-sm border-2 border-gray-600 px-3"
                    data-testid="button-cancel-reply"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createReply.isPending}
                    className="text-xs font-black uppercase tracking-wide bg-ministry-gold-exact text-black hover:bg-yellow-400 rounded-sm border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] px-3"
                    data-testid="button-submit-reply"
                  >
                    <Send className="w-3 h-3 mr-1" />
                    {createReply.isPending ? "Posting..." : "Post Reply"}
                  </Button>
                </div>
              </form>
            </Form>
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
