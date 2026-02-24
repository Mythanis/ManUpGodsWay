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
import { BackButton } from "@/components/BackButton";
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
  Sun,
  Coins,
  Medal,
  TrendingUp,
  ShoppingBag
} from "lucide-react";
import { Link } from "wouter";

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
    const isTrial = urlParams.get('trial') === 'true';

    if (upgradeStatus === 'success') {
      window.history.replaceState({}, document.title, window.location.pathname);
      
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      
      toast({
        title: isTrial ? "Free Trial Started!" : "Subscription Activated!",
        description: isTrial 
          ? "Welcome! Your free trial is active. You have full access to all content."
          : "Welcome! You now have access to all subscriber content.",
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

  const { data: rations } = useQuery<{
    balance: number;
    rank: string;
    rankLabel: string;
    nextRank: string | null;
    progressToNextRank: number;
    rationsToNextRank: number;
  }>({
    queryKey: ["/api/rations"],
    retry: false,
  });

  const RANK_CONFIG: Record<string, { color: string; bgColor: string }> = {
    recruit: { color: "text-zinc-400", bgColor: "bg-zinc-800" },
    warrior: { color: "text-amber-600", bgColor: "bg-amber-950" },
    shepherd: { color: "text-ministry-gold", bgColor: "bg-yellow-950" },
    watchman: { color: "text-cyan-400", bgColor: "bg-cyan-950" },
    elder: { color: "text-purple-400", bgColor: "bg-purple-950" },
  };
  const rankConfig = RANK_CONFIG[rations?.rank || "recruit"] || RANK_CONFIG.recruit;

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
    const status = (user as any)?.subscriptionStatus;
    if (status === 'active') {
      return <Badge className="bg-ministry-gold-exact text-black rounded-sm font-black uppercase tracking-wide">Subscriber</Badge>;
    }
    if (status === 'trial') {
      return <Badge className="bg-blue-500 text-white rounded-sm font-black uppercase tracking-wide">Trial</Badge>;
    }
    if (status === 'expired' || status === 'cancelled') {
      return <Badge className="bg-gray-500 text-white rounded-sm font-black uppercase tracking-wide">Expired</Badge>;
    }
    switch (tier) {
      default:
        return <Badge variant="outline" className="rounded-sm font-black uppercase tracking-wide">Free Member</Badge>;
    }
  };

  const getStreakBadge = (days: number) => {
    if (days >= 30) {
      return <Badge className="bg-ministry-success/20 text-ministry-success rounded-sm font-black uppercase tracking-wide">{days}-Day Streak</Badge>;
    }
    return <Badge variant="outline" className="rounded-sm font-black uppercase tracking-wide">{days}-Day Streak</Badge>;
  };

  return (
    <div className="pb-20 bg-black min-h-screen">
      {/* Profile Header */}
      <div className="liquid-black text-white px-6 pt-12 pb-8 border-b-4 border-ministry-gold-exact overflow-hidden">
        <BackButton />
        <div className="text-center relative z-10">
          <img 
            src={(user as any)?.profileImageUrl || `https://ui-avatars.com/api/?name=${user?.firstName}+${user?.lastName}&background=4A90B8&color=fff`}
            alt="Profile"
            className="w-20 h-20 rounded-sm mx-auto mb-4 border-4 border-ministry-gold-exact object-cover"
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

      {/* Rations Card */}
      {rations && (
        <div className="px-6 -mt-4 relative z-10 mb-6">
          <Link href="/rations">
            <Card className="bg-[#FCD000] text-black border-2 border-black rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden cursor-pointer hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all" data-testid="card-rations">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-black border-2 border-black rounded-sm flex items-center justify-center">
                      <Coins className="w-6 h-6 text-ministry-gold" />
                    </div>
                    <div>
                      <p className="text-2xl font-black text-black tracking-tight">
                        {rations.balance.toLocaleString()}
                      </p>
                      <p className="text-xs font-bold text-black/70 uppercase tracking-wide">
                        Rations Earned
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`flex items-center gap-1 px-2 py-1 ${rankConfig.bgColor} border border-black rounded-sm`}>
                      <Medal className={`w-4 h-4 ${rankConfig.color}`} />
                      <span className={`text-xs font-black uppercase ${rankConfig.color}`}>
                        {rations.rankLabel}
                      </span>
                    </div>
                    <TrendingUp className="w-5 h-5 text-black" />
                  </div>
                </div>
                {rations.nextRank && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-black/70 font-bold uppercase">
                        Progress to next rank
                      </span>
                      <span className="text-xs font-bold text-black">
                        {rations.progressToNextRank}%
                      </span>
                    </div>
                    <Progress value={rations.progressToNextRank} className="h-2 bg-black/20 rounded-sm" />
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        </div>
      )}

      {/* Account Management */}
      <div className="px-6 -mt-6 relative z-10 mb-6">
        <Card className="shadow-[4px_4px_0px_0px_rgba(252,208,0,1)] liquid-black border-2 border-ministry-gold-exact rounded-sm overflow-hidden" data-testid="card-account">
          <CardContent className="p-6 relative z-10">
            <h2 className="text-lg font-black text-white mb-4 tracking-tight uppercase" style={{ fontFamily: "'Inter', sans-serif" }}>Account & Subscription</h2>
            
            <div className="space-y-4">
              <div className="h-16 w-full flex items-center bg-[#FCD000] text-black border-2 border-black overflow-hidden rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                <div className="h-full w-16 liquid-black flex items-center justify-center flex-shrink-0">
                  <Crown className="w-6 h-6 text-white relative z-10" />
                </div>
                <div className="flex-1 px-4 relative z-10">
                  <span className="font-black text-sm text-black uppercase tracking-wide">
                    {(user as any)?.subscriptionStatus === 'active' ? 'Active Subscription' :
                     (user as any)?.subscriptionStatus === 'trial' ? 'Trial' :
                     (user as any)?.subscriptionStatus === 'expired' || (user as any)?.subscriptionStatus === 'cancelled' ? 'Expired' : 'No Subscription'}
                  </span>
                </div>
                <Button 
                  variant="ghost"
                  className="text-black font-black text-sm hover:bg-black/10 relative z-10 uppercase tracking-wide pr-4"
                  data-testid="button-manage-subscription"
                  disabled={openBillingPortalMutation.isPending}
                  onClick={() => {
                    if ((user as any)?.subscriptionStatus === 'active') {
                      openBillingPortalMutation.mutate();
                    } else {
                      setShowUpgradeModal(true);
                    }
                  }}
                >
                  {openBillingPortalMutation.isPending ? 'Loading...' : 
                   (user as any)?.subscriptionStatus === 'active' ? 'Manage' : 'Subscribe'}
                </Button>
              </div>
              
              <EditProfileDialog>
                <Button 
                  variant="outline"
                  className="h-16 w-full flex items-center justify-between bg-[#FCD000] text-black hover:bg-yellow-400 border-2 border-black p-0 overflow-hidden rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all"
                  data-testid="button-edit-profile"
                >
                  <div className="h-full w-16 liquid-black flex items-center justify-center flex-shrink-0">
                    <User className="w-6 h-6 text-white relative z-10" />
                  </div>
                  <span className="flex-1 font-black text-sm text-black text-left px-4 uppercase tracking-wide relative z-10">Edit Profile</span>
                  <div className="pr-4">
                    <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                  </div>
                </Button>
              </EditProfileDialog>

              <Link href="/rations-store">
                <Button 
                  variant="outline"
                  className="h-16 w-full flex items-center justify-between bg-[#FCD000] text-black hover:bg-yellow-400 border-2 border-black p-0 overflow-hidden rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all"
                  data-testid="button-rations-store"
                >
                  <div className="h-full w-16 liquid-black flex items-center justify-center flex-shrink-0">
                    <ShoppingBag className="w-6 h-6 text-white relative z-10" />
                  </div>
                  <span className="flex-1 font-black text-sm text-black text-left px-4 uppercase tracking-wide relative z-10">Rations Store</span>
                  <div className="pr-4">
                    <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                  </div>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Settings Menu */}
      <div className="px-6 mb-6">
        <h2 className="text-lg font-black text-white mb-4 tracking-tight uppercase" style={{ fontFamily: "'Inter', sans-serif" }}>Settings</h2>
        
        <Card className="liquid-black border-2 border-ministry-gold-exact overflow-hidden rounded-sm shadow-[4px_4px_0px_0px_rgba(252,208,0,1)]" data-testid="card-settings">
          <CardContent className="p-0 relative z-10">
            <NotificationPanel variant="button" />
            
            {/* Notification Preferences */}
            <Button 
              variant="ghost"
              className="w-full justify-between p-4 h-auto hover:bg-gray-800 border-b-2 border-ministry-gold-exact/30 rounded-sm"
              onClick={() => setLocation('/notification-preferences')}
              data-testid="button-notification-preferences"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-sm bg-ministry-gold-exact flex items-center justify-center">
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
              className="w-full justify-between p-4 h-auto hover:bg-gray-800 border-b-2 border-ministry-gold-exact/30 rounded-sm"
              onClick={() => setLocation('/privacy-security')}
              data-testid="button-privacy"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-sm bg-ministry-gold-exact flex items-center justify-center">
                  <Shield className="w-4 h-4 text-black" />
                </div>
                <span className="font-bold text-white uppercase tracking-wide">Privacy Policy & Terms</span>
              </div>
              <svg className="w-5 h-5 text-ministry-gold-exact" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </Button>
            
            <Button 
              variant="ghost"
              className="w-full justify-between p-4 h-auto hover:bg-gray-800 border-b-2 border-ministry-gold-exact/30 rounded-sm"
              data-testid="button-help"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-sm bg-ministry-gold-exact flex items-center justify-center">
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
                <div className="w-8 h-8 rounded-sm bg-ministry-gold-exact flex items-center justify-center">
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
              className="w-full justify-between p-4 h-auto hover:bg-red-900/30 rounded-sm"
              data-testid="button-logout"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-sm bg-red-600 flex items-center justify-center">
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
        
        <Card className="bg-[#FCD000] text-black border-2 border-black rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden" data-testid="card-progress">
          <CardContent className="p-6 relative z-10">
            {currentStudies.length === 0 && completedStudies.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-black mb-4 font-medium">You haven't started any studies yet</p>
                <Button 
                  className="liquid-black text-ministry-gold-exact hover:opacity-90 rounded-sm font-black uppercase tracking-wide border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] h-12 px-6"
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
