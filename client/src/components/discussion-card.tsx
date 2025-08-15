import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Heart, MessageCircle, Send } from "lucide-react";
import { z } from "zod";

interface DiscussionCardProps {
  discussion: any;
}

const replySchema = z.object({
  content: z.string().min(1, "Reply content is required"),
});

export default function DiscussionCard({ discussion }: DiscussionCardProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const onSubmitReply = async (data: z.infer<typeof replySchema>) => {
    if (!(user as any)?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to reply",
        variant: "destructive",
      });
      return;
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
            className="w-10 h-10 rounded-full object-cover"
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
            
            <h4 className="font-medium text-ministry-charcoal mb-2" data-testid="text-discussion-title">
              {discussion.title}
            </h4>
            
            <p className="text-sm text-ministry-slate mb-3 line-clamp-3" data-testid="text-discussion-content">
              {discussion.content}
            </p>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Button 
                  variant="ghost"
                  size="sm"
                  className="flex items-center space-x-1 text-ministry-slate hover:text-ministry-steel p-1"
                  data-testid="button-like"
                >
                  <Heart className="w-4 h-4" />
                  <span className="text-xs">{discussion.likes || 0}</span>
                </Button>
                
                <Button 
                  variant="ghost"
                  size="sm"
                  className="flex items-center space-x-1 text-ministry-slate hover:text-ministry-steel p-1"
                  data-testid="button-replies"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span className="text-xs">{discussion.replyCount || 0} replies</span>
                </Button>
              </div>
              
              <Button 
                variant="ghost"
                size="sm"
                onClick={() => setShowReplyForm(!showReplyForm)}
                className="text-ministry-steel hover:text-ministry-navy text-xs font-medium p-1"
                data-testid="button-reply"
              >
                Reply
              </Button>
            </div>
          </div>
        </div>
        
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
                  <Button
                    type="submit"
                    size="sm"
                    disabled={createReply.isPending}
                    className="bg-ministry-navy hover:bg-ministry-charcoal text-xs"
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
    </Card>
  );
}
