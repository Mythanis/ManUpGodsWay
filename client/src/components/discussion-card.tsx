import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, MessageCircle } from "lucide-react";

interface DiscussionCardProps {
  discussion: any;
}

export default function DiscussionCard({ discussion }: DiscussionCardProps) {
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
                className="text-ministry-steel hover:text-ministry-navy text-xs font-medium p-1"
                data-testid="button-reply"
              >
                Reply
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
