import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { NotificationPanel } from "@/components/notification-panel";
import { EditProfileDialog } from "@/components/edit-profile-dialog";
import { FeedbackDialog } from "@/components/feedback-dialog";
import { SilencedUsersButton } from "@/components/silenced-users-button";
import { TestimonyForm } from "@/components/testimony-form";
import UpgradeModal from "@/components/upgrade-modal";
import { 
  User, 
  Bell, 
  Shield, 
  HelpCircle, 
  LogOut,
  Settings,
  Crown,
  Flame,
  MessageCircle,
  Moon,
  Sun
} from "lucide-react";

export default function Profile() {
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const { user } = useAuth();
  const { theme, setTheme, effectiveTheme } = useTheme();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Handle successful subscription upgrade
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const upgradeStatus = urlParams.get('upgrade');
    const tier = urlParams.get('tier');

    if (upgradeStatus === 'success' && tier) {
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Invalidate auth cache to refresh user data
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      
      // Show success message
      toast({
        title: "Subscription Upgraded!",
        description: `Welcome to ${tier.charAt(0).toUpperCase() + tier.slice(1)}! You now have access to exclusive content.`,
        variant: "default",
      });
    } else if (upgradeStatus === 'cancelled') {
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      
      toast({
        title: "Upgrade Cancelled",
        description: "Your subscription upgrade was cancelled. You can try again anytime.",
        variant: "destructive",
      });
    }
  }, [queryClient, toast]);

  const { data: progress = [] } = useQuery<any[]>({
    queryKey: ["/api/progress"],
    retry: false,
  });

  const completedStudies = progress.filter((p: any) => p.isCompleted);
  const currentStudies = progress.filter((p: any) => !p.isCompleted);

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'premium':
        return <Badge className="bg-ministry-steel/20 text-ministry-steel">Premium Member</Badge>;
      case 'vip':
        return <Badge className="bg-ministry-gold-exact text-black">VIP Member</Badge>;
      default:
        return <Badge variant="outline">Free Member</Badge>;
    }
  };

  const getStreakBadge = (days: number) => {
    if (days >= 30) {
      return <Badge className="bg-ministry-success/20 text-ministry-success">{days}-Day Streak</Badge>;
    }
    return <Badge variant="outline">{days}-Day Streak</Badge>;
  };

  return (
    <div className="pb-20">
      {/* Profile Header */}
      <div className="bg-gradient-to-br from-ministry-navy to-ministry-charcoal dark:from-header-dark dark:to-ministry-navy text-white px-6 pt-12 pb-8">
        <div className="text-center">
          <img 
            src={(user as any)?.profileImageUrl || `https://ui-avatars.com/api/?name=${user?.firstName}+${user?.lastName}&background=4A90B8&color=fff`}
            alt="Profile"
            className="w-20 h-20 rounded-full mx-auto mb-4 border-4 border-white/20 object-cover"
            data-testid="img-profile"
          />
          <h1 className="text-xl font-bold mb-1" data-testid="text-user-name">
            {user?.firstName} {user?.lastName}
          </h1>
          <p className="text-blue-200 text-sm mb-4" data-testid="text-member-since">
            Member since {new Date((user as any)?.createdAt || '').toLocaleDateString('en-US', { 
              month: 'long', 
              year: 'numeric' 
            })}
          </p>
          
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <p className="text-2xl font-bold" data-testid="text-completed-count">
                {completedStudies.length}
              </p>
              <p className="text-xs text-blue-200">Studies Completed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold" data-testid="text-streak-days">
                {user?.streakDays || 0}
              </p>
              <p className="text-xs text-blue-200">Days Active</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold" data-testid="text-forum-posts">
                0
              </p>
              <p className="text-xs text-blue-200">Forum Posts</p>
            </div>
          </div>
          
          <div className="flex items-center justify-center space-x-2">
            {getTierBadge(user?.subscriptionTier || 'free')}
            {getStreakBadge(user?.streakDays || 0)}
          </div>
        </div>
      </div>

      {/* Account Management */}
      <div className="px-6 -mt-6 relative z-10 mb-6">
        <Card className="shadow-lg" data-testid="card-account">
          <CardContent className="p-6">
            <h2 className="text-lg font-bold text-foreground mb-4">Account & Subscription</h2>
            
            <div className="space-y-4">
              <div className={`flex items-center justify-between p-4 rounded-xl border ${
                user?.subscriptionTier === 'free' 
                  ? 'bg-ministry-gold-exact/10 border-ministry-gold-exact/20' 
                  : 'bg-ministry-steel/10 border-ministry-steel/20'
              }`}>
                <div className="flex items-center space-x-3">
                  <Crown className="w-5 h-5 text-ministry-gold" />
                  <div>
                    <h3 className="font-semibold text-foreground">
                      {user?.subscriptionTier === 'free' ? 'Free Plan' : 
                       user?.subscriptionTier === 'premium' ? 'Premium Plan' : 'VIP Plan'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {user?.subscriptionTier === 'free' 
                        ? 'Limited access to studies and features'
                        : 'Full access to all studies and community features'
                      }
                    </p>
                  </div>
                </div>
                <Button 
                  variant="ghost"
                  className="text-ministry-steel font-medium text-sm hover:text-ministry-navy"
                  data-testid="button-manage-subscription"
                  onClick={() => {
                    if (user?.subscriptionTier === 'free') {
                      setShowUpgradeModal(true);
                    }
                    // TODO: Add manage subscription logic for premium/VIP users
                  }}
                >
                  {user?.subscriptionTier === 'free' ? 'Upgrade' : 'Manage'}
                </Button>
              </div>
              
              <EditProfileDialog>
                <Button 
                  variant="outline"
                  className="w-full justify-between p-4 h-auto border-border hover:bg-muted"
                  data-testid="button-edit-profile"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-ministry-steel/20 flex items-center justify-center">
                      <User className="w-4 h-4 text-ministry-steel" />
                    </div>
                    <span className="font-medium text-foreground">Edit Profile</span>
                  </div>
                  <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                  </svg>
                </Button>
              </EditProfileDialog>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Settings Menu */}
      <div className="px-6 mb-6">
        <h2 className="text-lg font-bold text-foreground mb-4">Settings</h2>
        
        <Card className="border-border overflow-hidden" data-testid="card-settings">
          <CardContent className="p-0">
            <NotificationPanel variant="button" />
            
            {/* Notification Preferences */}
            <Button 
              variant="ghost"
              className="w-full justify-between p-4 h-auto hover:bg-muted border-b border-border"
              onClick={() => setLocation('/notification-preferences')}
              data-testid="button-notification-preferences"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-ministry-gold-exact/20 flex items-center justify-center">
                  <Settings className="w-4 h-4 text-ministry-gold" />
                </div>
                <span className="font-medium text-foreground">Notification Preferences</span>
              </div>
              <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </Button>

            {/* Silenced Users */}
            <SilencedUsersButton />
            
            
            <Button 
              variant="ghost"
              className="w-full justify-between p-4 h-auto hover:bg-muted border-b border-border"
              data-testid="button-privacy"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-ministry-steel/20 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-ministry-steel" />
                </div>
                <span className="font-medium text-foreground">Privacy & Security</span>
              </div>
              <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </Button>
            
            <Button 
              variant="ghost"
              className="w-full justify-between p-4 h-auto hover:bg-muted border-b border-border"
              data-testid="button-help"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-ministry-gold-exact/20 flex items-center justify-center">
                  <HelpCircle className="w-4 h-4 text-ministry-gold" />
                </div>
                <span className="font-medium text-foreground">Help & Support</span>
              </div>
              <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </Button>
            
            <button
              onClick={() => setShowFeedbackDialog(true)}
              style={{
                backgroundColor: effectiveTheme === 'dark' 
                  ? 'hsl(220 8% 26%)' 
                  : 'hsl(240 1.9608% 90%)',
                color: effectiveTheme === 'dark' 
                  ? 'hsl(0 0% 95%)' 
                  : 'hsl(210 25% 7.8431%)',
                borderColor: effectiveTheme === 'dark' 
                  ? 'hsl(210 5.2632% 14.9020%)' 
                  : 'hsl(201.4286 30.4348% 90.9804%)'
              }}
              className="w-full justify-between p-4 h-auto hover:opacity-90 border-b border cursor-pointer transition-colors flex"
              data-testid="button-feedback"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-ministry-navy/20 flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-ministry-navy" />
                </div>
                <span className="font-medium">Send Feedback</span>
              </div>
              <svg className="w-5 h-5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </button>
            
            <Button 
              variant="ghost"
              onClick={() => window.location.href = '/api/logout'}
              className="w-full justify-between p-4 h-auto hover:bg-muted"
              data-testid="button-logout"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                  <LogOut className="w-4 h-4 text-red-600" />
                </div>
                <span className="font-medium text-red-600">Sign Out</span>
              </div>
              <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Progress Summary */}
      <div className="px-6">
        <h2 className="text-lg font-bold text-white mb-4">Your Journey</h2>
        
        <Card className="border-border bg-ministry-gold-exact/20" data-testid="card-progress">
          <CardContent className="p-6">
            {currentStudies.length === 0 && completedStudies.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-black mb-4">You haven't started any studies yet</p>
                <Button 
                  className="bg-ministry-navy text-white hover:bg-ministry-charcoal"
                  data-testid="button-start-journey"
                >
                  Start Your Journey
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {currentStudies.map((item: any) => {
                  const progressPercent = (item.completedLessons / (item.study?.lessonCount || 1)) * 100;
                  return (
                    <div key={item.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-black">
                          {item.study?.title || 'Study'}
                        </span>
                        <span className="text-sm text-black font-bold">
                          {item.completedLessons}/{item.study?.lessonCount || 0}
                        </span>
                      </div>
                      <Progress value={progressPercent} className="h-2" />
                    </div>
                  );
                })}
                
                {completedStudies.map((item: any) => (
                  <div key={item.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <span className="text-sm font-medium text-black">
                          {item.study?.title || 'Study'}
                        </span>
                        {item.completedAt && (
                          <p className="text-xs text-black">
                            Completed {new Date(item.completedAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </p>
                        )}
                      </div>
                      <span className="text-sm text-ministry-success font-bold flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                        </svg>
                        Complete
                      </span>
                    </div>
                    <Progress value={100} className="h-2" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Testimony Section */}
      <div className="px-6 mt-6">
        <h2 className="text-lg font-bold text-white mb-4">Your Testimony</h2>
        <TestimonyForm isOwnProfile={true} />
      </div>
      
      <FeedbackDialog 
        isOpen={showFeedbackDialog} 
        onClose={() => setShowFeedbackDialog(false)} 
      />
      
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />
    </div>
  );
}
