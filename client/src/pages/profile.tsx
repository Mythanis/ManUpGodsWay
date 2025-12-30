import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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

  // Mutation for opening Stripe billing portal
  const openBillingPortalMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/create-billing-portal');
      return response.json();
    },
    onSuccess: (data) => {
      if (data.portalUrl) {
        window.location.href = data.portalUrl;
      } else {
        toast({
          title: "Error",
          description: "Failed to open subscription management",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to open subscription management",
        variant: "destructive",
      });
    },
  });

  const completedStudies = progress.filter((p: any) => p.isCompleted);
  const currentStudies = progress.filter((p: any) => !p.isCompleted);

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'premium':
        return <Badge className="bg-ministry-steel/20 text-ministry-steel rounded-none font-black uppercase tracking-wide">Premium Member</Badge>;
      case 'vip':
        return <Badge className="bg-ministry-gold-exact text-black rounded-none font-black uppercase tracking-wide">VIP Member</Badge>;
      default:
        return <Badge variant="outline" className="rounded-none font-black uppercase tracking-wide">Free Member</Badge>;
    }
  };

  const getStreakBadge = (days: number) => {
    if (days >= 30) {
      return <Badge className="bg-ministry-success/20 text-ministry-success rounded-none font-black uppercase tracking-wide">{days}-Day Streak</Badge>;
    }
    return <Badge variant="outline" className="rounded-none font-black uppercase tracking-wide">{days}-Day Streak</Badge>;
  };

  return (
    <div className="pb-20 bg-black min-h-screen">
      {/* Profile Header */}
      <div className="liquid-black text-white px-6 pt-12 pb-8 border-b-4 border-ministry-gold-exact overflow-hidden">
        <div className="text-center relative z-10">
          <img 
            src={(user as any)?.profileImageUrl || `https://ui-avatars.com/api/?name=${user?.firstName}+${user?.lastName}&background=4A90B8&color=fff`}
            alt="Profile"
            className="w-20 h-20 rounded-none mx-auto mb-4 border-4 border-ministry-gold-exact object-cover"
            data-testid="img-profile"
          />
          <h1 className="text-4xl font-black mb-1 tracking-tighter uppercase" style={{ fontFamily: "'Inter', sans-serif" }} data-testid="text-user-name">
            {user?.firstName} {user?.lastName}
          </h1>
          <p className="text-ministry-gold-exact text-xs font-bold tracking-widest uppercase mb-4" data-testid="text-member-since">
            Member since {new Date((user as any)?.createdAt || '').toLocaleDateString('en-US', { 
              month: 'long', 
              year: 'numeric' 
            })}
          </p>
          
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center bg-black/20 py-3 px-2 border-2 border-ministry-gold-exact">
              <p className="text-2xl font-black" data-testid="text-completed-count">
                {completedStudies.length}
              </p>
              <p className="text-xs text-ministry-gold-exact font-bold uppercase tracking-wide">Studies</p>
            </div>
            <div className="text-center bg-black/20 py-3 px-2 border-2 border-ministry-gold-exact">
              <p className="text-2xl font-black" data-testid="text-streak-days">
                {user?.streakDays || 0}
              </p>
              <p className="text-xs text-ministry-gold-exact font-bold uppercase tracking-wide">Days</p>
            </div>
            <div className="text-center bg-black/20 py-3 px-2 border-2 border-ministry-gold-exact">
              <p className="text-2xl font-black" data-testid="text-forum-posts">
                0
              </p>
              <p className="text-xs text-ministry-gold-exact font-bold uppercase tracking-wide">Posts</p>
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
        <Card className="shadow-[4px_4px_0px_0px_rgba(252,208,0,1)] liquid-black border-2 border-ministry-gold-exact rounded-none overflow-hidden" data-testid="card-account">
          <CardContent className="p-6 relative z-10">
            <h2 className="text-lg font-black text-white mb-4 tracking-tight uppercase" style={{ fontFamily: "'Inter', sans-serif" }}>Account & Subscription</h2>
            
            <div className="space-y-4">
              <div className={`flex items-center justify-between p-4 rounded-none border-2 border-black overflow-hidden relative ${
                user?.subscriptionTier === 'free' 
                  ? 'liquid-gold-card' 
                  : 'bg-ministry-steel/10'
              }`}>
                <div className="flex items-center space-x-3 relative z-10">
                  <Crown className="w-5 h-5 text-black" />
                  <div>
                    <h3 className="font-black text-foreground uppercase tracking-wide">
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
                  className="text-black font-black text-sm hover:bg-black/10 relative z-10 uppercase tracking-wide"
                  data-testid="button-manage-subscription"
                  disabled={openBillingPortalMutation.isPending}
                  onClick={() => {
                    if (user?.subscriptionTier === 'free') {
                      setShowUpgradeModal(true);
                    } else {
                      openBillingPortalMutation.mutate();
                    }
                  }}
                >
                  {openBillingPortalMutation.isPending ? 'Loading...' : 
                   user?.subscriptionTier === 'free' ? 'Upgrade' : 'Manage'}
                </Button>
              </div>
              
              <EditProfileDialog>
                <Button 
                  variant="outline"
                  className="w-full justify-between p-4 h-auto border-2 border-ministry-gold-exact hover:bg-gray-700 bg-gray-800 rounded-none shadow-[3px_3px_0px_0px_rgba(252,208,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(252,208,0,1)] transition-all"
                  data-testid="button-edit-profile"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-none bg-ministry-gold-exact flex items-center justify-center">
                      <User className="w-4 h-4 text-black" />
                    </div>
                    <span className="font-bold text-white uppercase tracking-wide">Edit Profile</span>
                  </div>
                  <svg className="w-5 h-5 text-ministry-gold-exact" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <h2 className="text-lg font-black text-white mb-4 tracking-tight uppercase" style={{ fontFamily: "'Inter', sans-serif" }}>Settings</h2>
        
        <Card className="liquid-black border-2 border-ministry-gold-exact overflow-hidden rounded-none shadow-[4px_4px_0px_0px_rgba(252,208,0,1)]" data-testid="card-settings">
          <CardContent className="p-0 relative z-10">
            <NotificationPanel variant="button" />
            
            {/* Notification Preferences */}
            <Button 
              variant="ghost"
              className="w-full justify-between p-4 h-auto hover:bg-gray-800 border-b-2 border-ministry-gold-exact/30 rounded-none"
              onClick={() => setLocation('/notification-preferences')}
              data-testid="button-notification-preferences"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-none bg-ministry-gold-exact flex items-center justify-center">
                  <Settings className="w-4 h-4 text-black" />
                </div>
                <span className="font-bold text-white uppercase tracking-wide">Notification Preferences</span>
              </div>
              <svg className="w-5 h-5 text-ministry-gold-exact" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </Button>

            {/* Silenced Users */}
            <SilencedUsersButton />
            
            
            <Button 
              variant="ghost"
              className="w-full justify-between p-4 h-auto hover:bg-gray-800 border-b-2 border-ministry-gold-exact/30 rounded-none"
              data-testid="button-privacy"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-none bg-ministry-gold-exact flex items-center justify-center">
                  <Shield className="w-4 h-4 text-black" />
                </div>
                <span className="font-bold text-white uppercase tracking-wide">Privacy & Security</span>
              </div>
              <svg className="w-5 h-5 text-ministry-gold-exact" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </Button>
            
            <Button 
              variant="ghost"
              className="w-full justify-between p-4 h-auto hover:bg-gray-800 border-b-2 border-ministry-gold-exact/30 rounded-none"
              data-testid="button-help"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-none bg-ministry-gold-exact flex items-center justify-center">
                  <HelpCircle className="w-4 h-4 text-black" />
                </div>
                <span className="font-bold text-white uppercase tracking-wide">Help & Support</span>
              </div>
              <svg className="w-5 h-5 text-ministry-gold-exact" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </Button>
            
            <button
              onClick={() => setShowFeedbackDialog(true)}
              className="w-full justify-between p-4 h-auto hover:bg-gray-800 border-b-2 border-ministry-gold-exact/30 cursor-pointer transition-colors flex bg-transparent"
              data-testid="button-feedback"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-none bg-ministry-gold-exact flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-black" />
                </div>
                <span className="font-bold text-white uppercase tracking-wide">Send Feedback</span>
              </div>
              <svg className="w-5 h-5 text-ministry-gold-exact" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </button>
            
            <Button 
              variant="ghost"
              onClick={() => window.location.href = '/api/logout'}
              className="w-full justify-between p-4 h-auto hover:bg-red-900/30 rounded-none"
              data-testid="button-logout"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-none bg-red-600 flex items-center justify-center">
                  <LogOut className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-red-400 uppercase tracking-wide">Sign Out</span>
              </div>
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Progress Summary */}
      <div className="px-6">
        <h2 className="text-lg font-black text-white mb-4 tracking-tight uppercase" style={{ fontFamily: "'Inter', sans-serif" }}>Your Journey</h2>
        
        <Card className="border-2 border-black liquid-gold-card rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden" data-testid="card-progress">
          <CardContent className="p-6 relative z-10">
            {currentStudies.length === 0 && completedStudies.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-black mb-4 font-medium">You haven't started any studies yet</p>
                <Button 
                  className="liquid-black text-ministry-gold-exact hover:opacity-90 rounded-none font-black uppercase tracking-wide border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] h-12 px-6"
                  data-testid="button-start-journey"
                >
                  <span className="relative z-10">Start Your Journey</span>
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
      <div className="px-6 mt-6 mb-6">
        <h2 className="text-lg font-black text-white mb-4 tracking-tight uppercase" style={{ fontFamily: "'Inter', sans-serif" }}>Your Testimony</h2>
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
