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
import { Heart, MessageCircle, Send, ChevronDown, ChevronUp, UserPlus, Flag } from "lucide-react";
import { FlagContentDialog } from "@/components/flag-content-dialog";
import { z } from "zod";

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
  const { user } = useAuth();
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
      setUserHasLiked(!userHasLiked);
      toast({
        title: "Success",
        description: userHasLiked ? "Removed like" : "Discussion liked!",
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
        return <Badge className="bg-ministry-gold/20 text-ministry-gold text-xs">VIP</Badge>;
      case 'premium':
        return <Badge className="bg-ministry-steel/20 text-ministry-steel text-xs">Premium</Badge>;
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
    <Card className="shadow-sm border border-gray-100" data-testid="discussion-card">
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          <img 
            src={discussion.user?.profileImageUrl || `https://ui-avatars.com/api/?name=${discussion.user?.firstName}+${discussion.user?.lastName}&background=4A90B8&color=fff`}
            alt={`${discussion.user?.firstName} ${discussion.user?.lastName}`}
            className="w-10 h-10 rounded-full object-cover cursor-pointer hover:ring-2 hover:ring-ministry-navy"
            onClick={(e) => {
              e.stopPropagation();
              setLocation(`/users/${discussion.userId}`);
            }}
            data-testid="img-user-avatar"
          />
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <h3 className="font-semibold text-sm text-ministry-charcoal" data-testid="text-user-name">
                {discussion.user?.firstName} {discussion.user?.lastName?.charAt(0)}.
              </h3>
              {getTierBadge(discussion.user?.subscriptionTier)}
              <span className="text-xs text-ministry-slate" data-testid="text-time-ago">
                • {getTimeAgo(discussion.createdAt)}
              </span>
            </div>
            
            <div className="flex items-center space-x-2 mb-2">
              <h4 className="font-medium text-ministry-charcoal" data-testid="text-discussion-title">
                {discussion.title}
              </h4>
              {discussion.studyId && (
                <Badge variant="default" className="text-xs bg-ministry-navy text-white">
                  📚 Study
                </Badge>
              )}
              {discussion.studyId && discussion.study?.requiredTier && discussion.study.requiredTier !== 'free' && (
                <Badge variant="outline" className="text-xs border-ministry-gold text-ministry-gold">
                  {discussion.study.requiredTier.charAt(0).toUpperCase() + discussion.study.requiredTier.slice(1)} Only
                </Badge>
              )}
            </div>
            
            <p className="text-sm text-ministry-slate mb-3 line-clamp-3" data-testid="text-discussion-content">
              {discussion.content}
            </p>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Button 
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleLike.mutate()}
                  disabled={toggleLike.isPending}
                  className={`flex items-center space-x-1 p-1 ${
                    userHasLiked 
                      ? 'text-red-500 hover:text-red-600' 
                      : 'text-ministry-slate hover:text-ministry-steel'
                  }`}
                  data-testid="button-like"
                >
                  <Heart className={`w-4 h-4 ${userHasLiked ? 'fill-current' : ''}`} />
                  <span className="text-xs">{discussion.likes || 0}</span>
                </Button>
                
                <Button 
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowReplies(!showReplies)}
                  className="flex items-center space-x-1 text-ministry-slate hover:text-ministry-steel p-1"
                  data-testid="button-replies"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span className="text-xs">{discussion.replyCount || 0} replies</span>
                  {discussion.replyCount > 0 && (
                    showReplies ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />
                  )}
                </Button>
              </div>
              
              <Button 
                variant="ghost"
                size="sm"
                onClick={() => {
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
                  setShowReplyForm(!showReplyForm);
                }}
                className={`text-xs font-medium p-1 ${
                  discussion.studyId && discussion.study?.requiredTier && discussion.study.requiredTier !== 'free' &&
                  !((discussion.study.requiredTier === 'premium' && ['premium', 'vip'].includes(currentUserTier)) ||
                    (discussion.study.requiredTier === 'vip' && currentUserTier === 'vip'))
                    ? 'text-ministry-slate/50 cursor-not-allowed'
                    : 'text-ministry-steel hover:text-ministry-navy'
                }`}
                data-testid="button-reply"
              >
                {discussion.studyId && discussion.study?.requiredTier && discussion.study.requiredTier !== 'free' &&
                 !((discussion.study.requiredTier === 'premium' && ['premium', 'vip'].includes(currentUserTier)) ||
                   (discussion.study.requiredTier === 'vip' && currentUserTier === 'vip'))
                  ? `${discussion.study.requiredTier.charAt(0).toUpperCase() + discussion.study.requiredTier.slice(1)} Required` 
                  : 'Reply'
                }
              </Button>
              
              {/* Flag Discussion Button */}
              <FlagContentDialog 
                contentType="discussion" 
                contentId={discussion.id}
                triggerElement={
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-red-600 p-1">
                    <Flag className="h-4 w-4" />
                  </Button>
                }
              />
            </div>
          </div>
        </div>
        
        {/* Show replies if expanded */}
        {showReplies && discussion.replyCount > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="space-y-3">
              {(replies as any[])?.map((reply: any) => (
                <div key={reply.id} className="flex items-start space-x-3 ml-4 p-3 bg-gray-50 rounded-lg">
                  <img 
                    src={reply.user?.profileImageUrl || `https://ui-avatars.com/api/?name=${reply.user?.firstName}+${reply.user?.lastName}&background=4A90B8&color=fff&size=32`}
                    alt={`${reply.user?.firstName} ${reply.user?.lastName}`}
                    className="w-8 h-8 rounded-full object-cover cursor-pointer hover:ring-2 hover:ring-ministry-navy"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLocation(`/users/${reply.userId}`);
                    }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-medium text-xs text-ministry-charcoal">
                        {reply.user?.firstName} {reply.user?.lastName?.charAt(0)}.
                      </span>
                      <span className="text-xs text-ministry-slate">
                        • {getTimeAgo(reply.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-ministry-slate">{reply.content}</p>
                    
                    {/* Flag Reply Button */}
                    <div className="flex justify-end mt-2">
                      <FlagContentDialog 
                        contentType="reply" 
                        contentId={reply.id}
                        triggerElement={
                          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-red-600 p-1">
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
          <div className="mt-4 pt-4 border-t border-gray-100">
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
                          className="min-h-[80px] resize-none"
                          {...field}
                          data-testid="textarea-reply-content"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowReplyForm(false);
                      form.reset();
                    }}
                    className="text-xs"
                    data-testid="button-cancel-reply"
                  >
                    Cancel
                  </Button>
                  <button
                    type="submit"
                    disabled={createReply.isPending}
                    data-testid="button-submit-reply"
                    style={{
                      backgroundColor: 'hsl(0 0% 0%)',
                      color: 'white',
                      border: '1px solid hsl(0 0% 0%)',
                      borderRadius: '0.375rem',
                      padding: '0.375rem 0.75rem',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      cursor: createReply.isPending ? 'default' : 'pointer',
                      opacity: createReply.isPending ? 0.6 : 1,
                      transition: 'opacity 0.2s'
                    }}
                  >
                    <Send className="w-3 h-3" />
                    {createReply.isPending ? "Posting..." : "Post Reply"}
                  </button>
                </div>
              </form>
            </Form>
          </div>
        )}
      </CardContent>

      {/* Profile Menu */}

    </Card>
  );
}
