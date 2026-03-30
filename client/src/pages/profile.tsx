import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useTour } from "@/contexts/TourContext";
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
import { HelpRequestDialog } from "@/components/help-request-dialog";
import { SilencedUsersButton } from "@/components/silenced-users-button";
import { TestimonyForm } from "@/components/testimony-form";
import UpgradeModal from "@/components/upgrade-modal";
import { BackButton } from "@/components/BackButton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  Coins,
  Medal,
  TrendingUp,
  ShoppingBag,
  Dumbbell,
  Calendar,
  RefreshCw,
  AlertTriangle,
  X,
  Map,
  Heart,
  BookOpen,
  Trash2,
  PenLine,
  ChevronRight,
  Loader2,
  Smartphone,
  Share,
  Plus,
  ChevronDown,
  Download
} from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { Link } from "wouter";

export default function Profile() {
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showFitnessManageModal, setShowFitnessManageModal] = useState(false);
  const [showFitnessCancelConfirm, setShowFitnessCancelConfirm] = useState(false);

  // PWA install — shared hook captures beforeinstallprompt at module-load time
  // so the event is never missed regardless of when the user navigates here
  const { deferredPrompt, isInstalled, isIOSSafari, install } = usePWAInstall();
  const [showIOSSteps, setShowIOSSteps] = useState(false);

  // True while we're verifying the Stripe session after returning from checkout
  const [verifyingSubscription, setVerifyingSubscription] = useState(
    () => new URLSearchParams(window.location.search).get('upgrade') === 'success'
  );
  const { user } = useAuth();
  const { startTour } = useTour();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Handle successful subscription upgrade — verify session with backend to guarantee activation
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const upgradeStatus = urlParams.get('upgrade');
    const isTrial = urlParams.get('trial') === 'true';
    const sessionId = urlParams.get('session_id');

    if (upgradeStatus === 'success') {
      window.history.replaceState({}, document.title, window.location.pathname);

      const finalize = async () => {
        try {
          if (sessionId) {
            // Verify the Stripe session directly — activates the user even if the webhook missed
            await fetch(`/api/subscription/verify-session?session_id=${sessionId}`, { credentials: 'include' });
          }
        } catch {
          // Ignore verify errors — still refresh below
        }
        // Wait for the fresh user data to actually load before hiding the confirming state
        await queryClient.refetchQueries({ queryKey: ['/api/auth/user'] });
        await queryClient.refetchQueries({ queryKey: ['/api/auth/me'] });
        setVerifyingSubscription(false);
        toast({
          title: isTrial ? "Free Trial Started!" : "Subscription Activated!",
          description: isTrial
            ? "Welcome! Your free trial is active. You have full access to all content."
            : "Welcome! You now have access to all subscriber content.",
          variant: "default",
        });
      };

      finalize();
    } else if (upgradeStatus === 'cancelled') {
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

  // Subscription details from Stripe (only fetch when user has active subscription)
  const subStatus = (user as any)?.subscriptionStatus;
  const { data: subDetails } = useQuery<{
    hasSubscription: boolean;
    billingCycle?: 'monthly' | 'yearly';
    currentPeriodEnd?: string;
    cancelAtPeriodEnd?: boolean;
    amount?: number;
    status?: string;
  }>({
    queryKey: ['/api/subscription/details'],
    enabled: subStatus === 'active' || subStatus === 'cancelled',
    retry: false,
  });

  // Fitness membership status
  const { data: fitnessMembership } = useQuery<{
    hasMembership: boolean;
    membership?: {
      status: string;
      currentPeriodEnd?: string;
      cancelAtPeriodEnd?: boolean;
    };
  }>({
    queryKey: ['/api/fitness/membership'],
    retry: false,
  });

  // Saved devotionals
  const { data: savedDevotionals = [] } = useQuery<any[]>({
    queryKey: ['/api/devotionals/saved'],
    enabled: !!user,
  });

  const unsaveDevotionalMutation = useMutation({
    mutationFn: (devotionalId: string) => apiRequest('POST', `/api/devotionals/${devotionalId}/save`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/devotionals/saved'] }),
  });

  // Devotional reflections
  const { data: devotionalReflections = [] } = useQuery<any[]>({
    queryKey: ['/api/devotionals/reflections'],
    enabled: !!user,
  });
  const reflectionMap = Object.fromEntries(devotionalReflections.map((r: any) => [r.devotionalId, r.text]));

  // Cancel main subscription
  const cancelSubscriptionMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/subscription/cancel');
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/subscription/details'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      setShowCancelConfirm(false);
      setShowManageModal(false);
      toast({
        title: 'Subscription Cancelled',
        description: `Your subscription will remain active until ${new Date(data.currentPeriodEnd).toLocaleDateString()}.`,
      });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to cancel subscription', variant: 'destructive' });
    },
  });

  // Switch billing cycle
  const switchBillingMutation = useMutation({
    mutationFn: async (newBillingCycle: 'monthly' | 'yearly') => {
      return await apiRequest('POST', '/api/subscription/switch-billing', { newBillingCycle });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/subscription/details'] });
      setShowManageModal(false);
      toast({
        title: 'Billing Updated',
        description: `You are now billed ${data.billingCycle}. Next renewal: ${new Date(data.currentPeriodEnd).toLocaleDateString()}.`,
      });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to switch billing cycle', variant: 'destructive' });
    },
  });

  // Subscribe to fitness add-on
  const subscribeFitnessMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/fitness/membership/subscribe');
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to start fitness checkout', variant: 'destructive' });
    },
  });

  // Cancel fitness membership
  const cancelFitnessMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/fitness/membership/cancel');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fitness/membership'] });
      setShowFitnessCancelConfirm(false);
      setShowFitnessManageModal(false);
      toast({
        title: 'Fitness Membership Cancelled',
        description: 'Your fitness access will remain active until the end of your current billing period.',
      });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to cancel fitness membership', variant: 'destructive' });
    },
  });

  const completedStudies = progress.filter((p: any) => p.isCompleted);
  const currentStudies = progress.filter((p: any) => !p.isCompleted);

  const getTierBadge = (_tier: string) => {
    const status = (user as any)?.subscriptionStatus;
    if (status === 'active') {
      return <Badge className="bg-ministry-gold-exact text-black rounded-sm font-black uppercase tracking-wide">Subscriber</Badge>;
    }
    return null;
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
              {/* Main Subscription Row */}
              <div className="h-16 w-full flex items-center bg-[#FCD000] text-black border-2 border-black overflow-hidden rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                <div className="h-full w-16 liquid-black flex items-center justify-center flex-shrink-0">
                  {verifyingSubscription
                    ? <Loader2 className="w-6 h-6 text-white relative z-10 animate-spin" />
                    : <Crown className="w-6 h-6 text-white relative z-10" />
                  }
                </div>
                <div className="flex-1 px-4 relative z-10">
                  {verifyingSubscription ? (
                    <>
                      <span className="font-black text-sm text-black uppercase tracking-wide">Confirming Subscription…</span>
                      <p className="text-[10px] text-black/60 font-semibold">Please wait, activating your account</p>
                    </>
                  ) : (
                    <>
                      <span className="font-black text-sm text-black uppercase tracking-wide">
                        {(user as any)?.subscriptionStatus === 'active' ? 'Active Subscription' :
                         (user as any)?.subscriptionStatus === 'trial' ? 'Trial' :
                         (user as any)?.subscriptionStatus === 'cancelled' ? 'Cancels Soon' :
                         (user as any)?.subscriptionStatus === 'past_due' ? 'Payment Failed' :
                         (user as any)?.subscriptionStatus === 'expired' ? 'Expired' : 'No Subscription'}
                      </span>
                      {subDetails?.cancelAtPeriodEnd && subDetails.currentPeriodEnd && (
                        <p className="text-[10px] text-black/60 font-semibold">
                          Active until {new Date(subDetails.currentPeriodEnd).toLocaleDateString()}
                        </p>
                      )}
                    </>
                  )}
                </div>
                <Button 
                  variant="ghost"
                  className="text-black font-black text-sm hover:bg-black/10 relative z-10 uppercase tracking-wide pr-4"
                  data-testid="button-manage-subscription"
                  disabled={verifyingSubscription}
                  onClick={() => {
                    if ((user as any)?.subscriptionStatus === 'active' || (user as any)?.subscriptionStatus === 'cancelled') {
                      setShowManageModal(true);
                    } else {
                      setShowUpgradeModal(true);
                    }
                  }}
                >
                  {verifyingSubscription ? '…' : (user as any)?.subscriptionStatus === 'active' || (user as any)?.subscriptionStatus === 'cancelled' ? 'Manage' : 'Subscribe'}
                </Button>
              </div>

              {/* Fitness Add-on Row */}
              <div className="h-16 w-full flex items-center bg-[#FCD000] text-black border-2 border-black overflow-hidden rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                <div className="h-full w-16 liquid-black flex items-center justify-center flex-shrink-0">
                  <Dumbbell className="w-6 h-6 text-white relative z-10" />
                </div>
                <div className="flex-1 px-4 relative z-10">
                  <span className="font-black text-sm text-black uppercase tracking-wide">
                    {fitnessMembership?.hasMembership || (user as any)?.hasFitnessAccess ? 'Fitness Add-on' : 'Fitness Add-on'}
                  </span>
                  <p className="text-[10px] text-black/60 font-semibold">
                    {fitnessMembership?.membership
                      ? fitnessMembership.membership?.cancelAtPeriodEnd
                        ? `Cancels ${fitnessMembership.membership.currentPeriodEnd ? new Date(fitnessMembership.membership.currentPeriodEnd).toLocaleDateString() : ''}`
                        : fitnessMembership.membership?.status === 'active'
                          ? 'Active — $4.99/mo'
                          : fitnessMembership.membership?.status === 'past_due'
                            ? 'Payment failed — update payment method'
                            : 'Active — $4.99/mo'
                      : (user as any)?.hasFitnessAccess
                        ? 'Access granted'
                        : '$4.99/mo'}
                  </p>
                </div>
                {fitnessMembership?.membership ? (
                  <Button 
                    variant="ghost"
                    className="text-black font-black text-sm hover:bg-black/10 relative z-10 uppercase tracking-wide pr-4"
                    onClick={() => setShowFitnessManageModal(true)}
                  >
                    Manage
                  </Button>
                ) : (user as any)?.hasFitnessAccess ? (
                  <span className="text-black/50 font-black text-xs uppercase tracking-wide pr-4">Granted</span>
                ) : (
                  <Button 
                    variant="ghost"
                    className="text-black font-black text-sm hover:bg-black/10 relative z-10 uppercase tracking-wide pr-4"
                    disabled={subscribeFitnessMutation.isPending}
                    onClick={() => subscribeFitnessMutation.mutate()}
                  >
                    {subscribeFitnessMutation.isPending ? 'Loading...' : 'Add'}
                  </Button>
                )}
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

      {/* My Journal */}
      <div className="px-6 mb-6">
        <Link href="/journal">
          <Card className="liquid-black border-2 border-[#FCD000] rounded-sm shadow-[4px_4px_0px_0px_rgba(252,208,0,1)] cursor-pointer hover:shadow-[5px_5px_0px_0px_rgba(252,208,0,1)] transition-shadow">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="bg-[#FCD000] rounded-sm border-2 border-black p-3 shrink-0">
                <PenLine className="w-5 h-5 text-black" />
              </div>
              <div className="flex-1">
                <p className="font-black text-white uppercase tracking-tight">My Journal</p>
                <p className="text-xs text-gray-400 font-bold mt-0.5">Review all your study notes in one place</p>
              </div>
              <ChevronRight className="w-5 h-5 text-[#FCD000] shrink-0" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Saved Devotionals */}
      <div className="px-6 mb-6">
        <h2 className="text-lg font-black text-white mb-4 tracking-tight uppercase" style={{ fontFamily: "'Inter', sans-serif" }}>
          Saved Devotionals
        </h2>
        <Card className="liquid-black border-2 border-ministry-gold-exact overflow-hidden rounded-sm shadow-[4px_4px_0px_0px_rgba(252,208,0,1)]">
          <CardContent className="p-0">
            {savedDevotionals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <Heart className="w-8 h-8 text-white/20 mb-3" />
                <p className="text-sm text-white/40 font-bold uppercase tracking-wide">No saved devotionals yet</p>
                <p className="text-xs text-white/30 mt-1">Tap the Save button on today's devotional to bookmark it here.</p>
              </div>
            ) : (
              <div className="divide-y divide-ministry-gold-exact/20">
                {savedDevotionals.map((item: any) => {
                  const dev = item.devotional;
                  const savedDate = new Date(item.savedAt);
                  const devDate = new Date(dev.date);
                  return (
                    <div key={item.id} className="flex items-start gap-3 p-4">
                      {dev.imageUrl ? (
                        <img
                          src={dev.imageUrl}
                          alt={dev.title}
                          className="w-14 h-14 object-cover rounded-sm flex-shrink-0 border border-ministry-gold-exact/30"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-sm flex-shrink-0 bg-ministry-gold-exact/10 border border-ministry-gold-exact/30 flex items-center justify-center">
                          <BookOpen className="w-6 h-6 text-ministry-gold-exact/60" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-white text-sm uppercase tracking-wide leading-tight line-clamp-2">{dev.title}</p>
                        <p className="text-xs text-ministry-gold-exact/70 mt-0.5 font-bold">{dev.verseReference}</p>
                        <p className="text-xs text-white/40 mt-1">
                          {devDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
                          {' · '}Saved {savedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
                        </p>
                        {reflectionMap[dev.id] && (
                          <div className="mt-2 bg-white/5 rounded-sm p-2 border-l-2 border-ministry-gold-exact/50">
                            <p className="text-xs text-white/60 italic leading-relaxed line-clamp-3">"{reflectionMap[dev.id]}"</p>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => unsaveDevotionalMutation.mutate(dev.id)}
                        className="p-1.5 rounded-sm text-white/30 hover:text-red-400 hover:bg-white/5 transition-colors flex-shrink-0"
                        title="Remove from saved"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* My Devotional Reflections */}
      {devotionalReflections.length > 0 && (
        <div className="px-6 mb-6">
          <h2 className="text-lg font-black text-white mb-4 tracking-tight uppercase" style={{ fontFamily: "'Inter', sans-serif" }}>
            My Reflections
          </h2>
          <Card className="liquid-black border-2 border-ministry-gold-exact overflow-hidden rounded-sm shadow-[4px_4px_0px_0px_rgba(252,208,0,1)]">
            <CardContent className="p-0">
              <div className="divide-y divide-ministry-gold-exact/20">
                {devotionalReflections.map((item: any) => {
                  const dev = item.devotional;
                  const reflectionDate = new Date(item.createdAt);
                  return (
                    <div key={item.id} className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <PenLine className="w-3.5 h-3.5 text-ministry-gold-exact flex-shrink-0" />
                        <p className="font-black text-white text-xs uppercase tracking-wide leading-tight line-clamp-1">{dev.title}</p>
                        <span className="text-xs text-white/30 ml-auto shrink-0">
                          {reflectionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
                        </span>
                      </div>
                      <div className="bg-white/5 rounded-sm p-3 border-l-2 border-ministry-gold-exact/50">
                        <p className="text-sm text-white/70 italic leading-relaxed">"{item.text}"</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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

            {/* App Tour */}
            <Button
              variant="ghost"
              className="w-full justify-between p-4 h-auto hover:bg-gray-800 border-b-2 border-ministry-gold-exact/30 rounded-sm"
              onClick={startTour}
              data-testid="button-take-tour"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-sm bg-ministry-gold-exact flex items-center justify-center">
                  <Map className="w-4 h-4 text-black" />
                </div>
                <span className="font-bold text-white uppercase tracking-wide">Take the App Tour</span>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </Button>
            
            {/* Add to Home Screen — hidden if already installed or no install path */}
            {!isInstalled && (deferredPrompt || isIOSSafari) && (
              <div className="border-b-2 border-ministry-gold-exact/30">
                {deferredPrompt ? (
                  /* Android/Chrome — one-tap yellow Install App button */
                  <div className="p-4">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-8 h-8 rounded-sm bg-ministry-gold-exact flex items-center justify-center shrink-0">
                        <Smartphone className="w-4 h-4 text-black" />
                      </div>
                      <div>
                        <span className="font-bold text-white uppercase tracking-wide block">Add to Home Screen</span>
                        <span className="text-xs text-gray-400">Install the app for quick access</span>
                      </div>
                    </div>
                    <Button
                      onClick={() => install()}
                      className="w-full bg-[#FCD000] hover:bg-yellow-400 text-black font-black uppercase tracking-wide border-2 border-black rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all"
                      data-testid="button-install-app"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Install App
                    </Button>
                  </div>
                ) : (
                  /* iOS Safari — expandable step-by-step instructions */
                  <div>
                    <button
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-800 transition-colors text-left"
                      onClick={() => setShowIOSSteps((s) => !s)}
                      data-testid="button-ios-install"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-sm bg-ministry-gold-exact flex items-center justify-center">
                          <Smartphone className="w-4 h-4 text-black" />
                        </div>
                        <div>
                          <span className="font-bold text-white uppercase tracking-wide block">Add to Home Screen</span>
                          <span className="text-xs text-gray-400">Install the app for quick access</span>
                        </div>
                      </div>
                      <ChevronDown
                        className={`w-5 h-5 text-ministry-gold-exact transition-transform ${showIOSSteps ? "rotate-180" : ""}`}
                      />
                    </button>
                    {showIOSSteps && (
                      <div className="px-4 pb-4 space-y-3">
                        <div className="flex items-start gap-3 p-3 bg-white/5 rounded-sm border border-ministry-gold-exact/20">
                          <div className="w-6 h-6 rounded-full bg-ministry-gold-exact text-black font-black text-xs flex items-center justify-center shrink-0 mt-0.5">1</div>
                          <div className="flex items-center gap-2">
                            <Share className="w-4 h-4 text-[#007AFF] shrink-0" />
                            <p className="text-sm text-white font-medium">
                              Tap the <span className="font-black text-[#FCD000]">Share</span> button at the bottom of Safari
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-white/5 rounded-sm border border-ministry-gold-exact/20">
                          <div className="w-6 h-6 rounded-full bg-ministry-gold-exact text-black font-black text-xs flex items-center justify-center shrink-0 mt-0.5">2</div>
                          <div className="flex items-center gap-2">
                            <Plus className="w-4 h-4 text-[#FCD000] shrink-0" />
                            <p className="text-sm text-white font-medium">
                              Scroll down and tap <span className="font-black text-[#FCD000]">Add to Home Screen</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-white/5 rounded-sm border border-ministry-gold-exact/20">
                          <div className="w-6 h-6 rounded-full bg-ministry-gold-exact text-black font-black text-xs flex items-center justify-center shrink-0 mt-0.5">3</div>
                          <p className="text-sm text-white font-medium">
                            Tap <span className="font-black text-[#FCD000]">Add</span> in the top-right corner
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

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
              onClick={() => setShowHelpDialog(true)}
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
        {/* Section heading */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1 h-6 bg-[#FCD000] rounded-full flex-shrink-0" />
          <h2 className="text-base font-black text-white uppercase tracking-[0.18em]">Your Journey</h2>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <Card className="overflow-hidden rounded-sm border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" style={{ background: '#0a0a0a' }} data-testid="card-progress">
          {currentStudies.length === 0 && completedStudies.length === 0 ? (
            <CardContent className="p-6 text-center">
              <p className="text-white/60 mb-5 font-medium text-sm">You haven't started any studies yet</p>
              <Button
                className="bg-[#FCD000] text-black hover:bg-yellow-300 rounded-sm font-black uppercase tracking-widest border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] h-11 px-6 text-sm"
                data-testid="button-start-journey"
              >
                Start Your Journey
              </Button>
            </CardContent>
          ) : (
            <CardContent className="p-0">
              {/* In-progress studies */}
              {currentStudies.map((item: any, i: number) => {
                const total = item.study?.lessonCount || item.totalLessons || 1;
                const done = item.completedLessons || 0;
                const pct = Math.round((done / total) * 100);
                return (
                  <div key={item.id} className={`p-4 space-y-2.5 ${i > 0 ? 'border-t border-white/10' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#FCD000]">In Progress</span>
                        <p className="font-black text-white text-sm leading-tight mt-0.5 uppercase tracking-tight">
                          {item.study?.title || 'Study'}
                        </p>
                      </div>
                      <span className="text-xs font-black text-white/60 tabular-nums flex-shrink-0 mt-1">{done}/{total}</span>
                    </div>
                    <div className="space-y-1">
                      <div className="h-2.5 bg-white/10 rounded-sm overflow-hidden border border-white/10">
                        <div className="h-full bg-[#FCD000] rounded-sm transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider text-right">{pct}% complete</p>
                    </div>
                  </div>
                );
              })}

              {/* Completed studies */}
              {completedStudies.map((item: any, i: number) => (
                <div key={item.id} className={`p-4 flex items-center gap-3 ${(i > 0 || currentStudies.length > 0) ? 'border-t border-white/10' : ''}`}>
                  <div className="w-7 h-7 rounded-sm bg-[#FCD000] flex items-center justify-center flex-shrink-0 border border-black">
                    <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-white text-sm leading-tight uppercase tracking-tight truncate">
                      {item.study?.title || 'Study'}
                    </p>
                    {item.completedAt && (
                      <p className="text-[10px] text-white/40 font-bold uppercase tracking-wide mt-0.5">
                        Completed {new Date(item.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                  <span className="text-xs font-black text-[#FCD000] uppercase tracking-wide flex-shrink-0">Done</span>
                </div>
              ))}
            </CardContent>
          )}
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

      <HelpRequestDialog
        isOpen={showHelpDialog}
        onClose={() => setShowHelpDialog(false)}
      />
      
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />

      {/* Subscription Manage Modal */}
      <Dialog open={showManageModal} onOpenChange={setShowManageModal}>
        <DialogContent className="bg-black border-2 border-ministry-gold-exact text-white max-w-sm mx-auto rounded-sm">
          <DialogHeader>
            <DialogTitle className="text-white font-black uppercase tracking-wide text-lg">Manage Subscription</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Current plan info */}
            <div className="bg-white/5 border border-white/10 rounded-sm p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60 uppercase tracking-wide font-bold">Plan</span>
                <span className="text-sm font-black text-ministry-gold-exact uppercase">
                  {subDetails?.billingCycle === 'yearly' ? 'Annual' : 'Monthly'}
                </span>
              </div>
              {subDetails?.amount && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/60 uppercase tracking-wide font-bold">Amount</span>
                  <span className="text-sm font-black text-white">${subDetails.amount}/{subDetails.billingCycle === 'yearly' ? 'yr' : 'mo'}</span>
                </div>
              )}
              {subDetails?.currentPeriodEnd && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/60 uppercase tracking-wide font-bold flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {subDetails.cancelAtPeriodEnd ? 'Active Until' : 'Next Renewal'}
                  </span>
                  <span className="text-sm font-black text-white">{new Date(subDetails.currentPeriodEnd).toLocaleDateString()}</span>
                </div>
              )}
              {subDetails?.cancelAtPeriodEnd && (
                <p className="text-xs text-red-400 font-semibold mt-1">Subscription scheduled to cancel — no further charges.</p>
              )}
            </div>

            {/* Switch billing cycle */}
            {!subDetails?.cancelAtPeriodEnd && (
              <div className="space-y-2">
                <p className="text-xs text-white/50 uppercase tracking-wide font-bold">Change Billing Cycle</p>
                {subDetails?.billingCycle === 'monthly' ? (
                  <Button
                    className="w-full bg-ministry-gold-exact hover:bg-yellow-400 text-black font-black uppercase tracking-wide rounded-sm"
                    disabled={switchBillingMutation.isPending}
                    onClick={() => switchBillingMutation.mutate('yearly')}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {switchBillingMutation.isPending ? 'Switching...' : 'Switch to Annual Billing'}
                  </Button>
                ) : (
                  <Button
                    className="w-full bg-ministry-gold-exact hover:bg-yellow-400 text-black font-black uppercase tracking-wide rounded-sm"
                    disabled={switchBillingMutation.isPending}
                    onClick={() => switchBillingMutation.mutate('monthly')}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {switchBillingMutation.isPending ? 'Switching...' : 'Switch to Monthly Billing'}
                  </Button>
                )}
              </div>
            )}

            {/* Cancel subscription */}
            {!subDetails?.cancelAtPeriodEnd && (
              <div className="space-y-2">
                <p className="text-xs text-white/50 uppercase tracking-wide font-bold">Cancel</p>
                {!showCancelConfirm ? (
                  <Button
                    variant="outline"
                    className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10 font-black uppercase tracking-wide rounded-sm"
                    onClick={() => setShowCancelConfirm(true)}
                  >
                    Cancel Subscription
                  </Button>
                ) : (
                  <div className="bg-red-950/50 border border-red-500/50 rounded-sm p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-red-300">
                        Your access will continue until {subDetails?.currentPeriodEnd ? new Date(subDetails.currentPeriodEnd).toLocaleDateString() : 'end of billing period'}. No further charges will occur.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 border-white/20 text-white hover:bg-white/10 font-black uppercase rounded-sm"
                        onClick={() => setShowCancelConfirm(false)}
                      >
                        Keep Plan
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black uppercase rounded-sm"
                        disabled={cancelSubscriptionMutation.isPending}
                        onClick={() => cancelSubscriptionMutation.mutate()}
                      >
                        {cancelSubscriptionMutation.isPending ? 'Cancelling...' : 'Confirm Cancel'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Fitness Manage Modal */}
      <Dialog open={showFitnessManageModal} onOpenChange={(open) => { setShowFitnessManageModal(open); if (!open) setShowFitnessCancelConfirm(false); }}>
        <DialogContent className="bg-black border-2 border-ministry-gold-exact text-white max-w-sm mx-auto rounded-sm">
          <DialogHeader>
            <DialogTitle className="text-white font-black uppercase tracking-wide text-lg flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-ministry-gold-exact" />
              Fitness Add-on
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="bg-white/5 border border-white/10 rounded-sm p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60 uppercase tracking-wide font-bold">Status</span>
                <span className="text-sm font-black text-ministry-gold-exact uppercase">
                  {fitnessMembership?.membership?.cancelAtPeriodEnd ? 'Cancels Soon' : 'Active'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60 uppercase tracking-wide font-bold">Amount</span>
                <span className="text-sm font-black text-white">$4.99/mo</span>
              </div>
              {fitnessMembership?.membership?.currentPeriodEnd && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/60 uppercase tracking-wide font-bold flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {fitnessMembership.membership.cancelAtPeriodEnd ? 'Access Until' : 'Next Renewal'}
                  </span>
                  <span className="text-sm font-black text-white">{new Date(fitnessMembership.membership.currentPeriodEnd).toLocaleDateString()}</span>
                </div>
              )}
              {fitnessMembership?.membership?.cancelAtPeriodEnd && (
                <p className="text-xs text-red-400 font-semibold mt-1">Cancellation scheduled — no further charges.</p>
              )}
            </div>

            {!fitnessMembership?.membership?.cancelAtPeriodEnd && (
              <div className="space-y-2">
                <p className="text-xs text-white/50 uppercase tracking-wide font-bold">Cancel</p>
                {!showFitnessCancelConfirm ? (
                  <Button
                    variant="outline"
                    className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10 font-black uppercase tracking-wide rounded-sm"
                    onClick={() => setShowFitnessCancelConfirm(true)}
                  >
                    Cancel Fitness Membership
                  </Button>
                ) : (
                  <div className="bg-red-950/50 border border-red-500/50 rounded-sm p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-red-300">
                        Your fitness access will continue until {fitnessMembership?.membership?.currentPeriodEnd ? new Date(fitnessMembership.membership.currentPeriodEnd).toLocaleDateString() : 'end of billing period'}. No further charges will occur.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 border-white/20 text-white hover:bg-white/10 font-black uppercase rounded-sm"
                        onClick={() => setShowFitnessCancelConfirm(false)}
                      >
                        Keep It
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black uppercase rounded-sm"
                        disabled={cancelFitnessMutation.isPending}
                        onClick={() => cancelFitnessMutation.mutate()}
                      >
                        {cancelFitnessMutation.isPending ? 'Cancelling...' : 'Confirm Cancel'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
