import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/useWebSocket";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ProgressCard from "@/components/progress-card";
import { NotificationPanel } from "@/components/notification-panel";
import { LiveStreamBanner } from "@/components/live-stream-banner";
import BrotherhoodRequests from "@/components/brotherhood-requests";
import UpgradeModal from "@/components/upgrade-modal";
import HomeCarousel from "@/components/home-carousel";
import { WelcomeIntro } from "@/components/WelcomeIntro";
import { formatLocalDate, formatLocalDateTime } from "@/lib/utils";
import { getDefaultThumbnail } from "@/lib/default-thumbnail";
import { Bell, Play, Users, BarChart3, Clock, Heart, Share2, X, PauseCircle, TrendingUp, Calendar, Target, Star, Shield, MessageSquare, HandHeart, Mail, Link2, Newspaper, Book, Coins } from "lucide-react";
import { SiFacebook, SiX, SiWhatsapp } from "react-icons/si";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";

export default function Home() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Initialize WebSocket for real-time notifications
  useWebSocket(user?.id);
  const [showFullDevotional, setShowFullDevotional] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [showPrayerDialog, setShowPrayerDialog] = useState(false);
  const [prayerDuration, setPrayerDuration] = useState("5");
  const [isPraying, setIsPraying] = useState(false);
  const [prayerTimeLeft, setPrayerTimeLeft] = useState(0);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [showChallengeDialog, setShowChallengeDialog] = useState(false);
  const [showHurdleWallDialog, setShowHurdleWallDialog] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showWelcomeIntro, setShowWelcomeIntro] = useState(false);
  const [appOpenStreak, setAppOpenStreak] = useState(0);

  // Track app opens and calculate streak
  useEffect(() => {
    const calculateAppOpenStreak = () => {
      const today = new Date().toDateString();
      const appOpensStr = localStorage.getItem('appOpens');
      const appOpens: string[] = appOpensStr ? JSON.parse(appOpensStr) : [];
      
      // Add today if not already recorded
      if (!appOpens.includes(today)) {
        appOpens.push(today);
        localStorage.setItem('appOpens', JSON.stringify(appOpens));
      }
      
      // Calculate consecutive day streak
      const sortedDates = appOpens
        .map(dateStr => new Date(dateStr))
        .sort((a, b) => b.getTime() - a.getTime()); // Sort descending (newest first)
      
      let streak = 0;
      let currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);
      
      for (const openDate of sortedDates) {
        openDate.setHours(0, 0, 0, 0);
        const diffDays = Math.floor((currentDate.getTime() - openDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays === streak) {
          streak++;
        } else {
          break; // Streak is broken
        }
      }
      
      setAppOpenStreak(streak);
    };
    
    calculateAppOpenStreak();
  }, []);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
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
  }, [isAuthenticated, authLoading, toast]);

  // Show welcome intro for new users who haven't seen it
  useEffect(() => {
    if (user && !user.hasSeenWelcome) {
      setShowWelcomeIntro(true);
    }
  }, [user]);

  const { data: devotional } = useQuery({
    queryKey: ["/api/devotionals/today"],
    retry: false,
  });

  const { data: rations } = useQuery<{ balance: number }>({
    queryKey: ["/api/rations"],
    retry: false,
  });

  const { data: progress = [], isLoading: progressLoading } = useQuery({
    queryKey: ["/api/progress"],
    retry: false,
    refetchInterval: 10000, // Real-time updates for user progress
    refetchIntervalInBackground: true,
    staleTime: 5000, // Keep data fresh for 5 seconds to prevent flicker
  });

  const { data: currentChallenge } = useQuery({
    queryKey: ["/api/challenges/current"],
    retry: false,
    refetchInterval: 8000, // Real-time updates for current challenge
    refetchIntervalInBackground: true,
  });

  // Get challenge participant count
  const { data: challengeParticipants } = useQuery({
    queryKey: ["/api/challenges", (currentChallenge as any)?.id, "participant-count"],
    enabled: !!(currentChallenge as any)?.id,
    retry: false,
    refetchInterval: 5000, // Update count every 5 seconds
  });

  // Check if user accepted the challenge
  const { data: userAccepted, refetch: refetchUserAccepted } = useQuery({
    queryKey: ["/api/challenges", (currentChallenge as any)?.id, "user-accepted"],
    enabled: !!(currentChallenge as any)?.id,
    retry: false,
  });

  // Get full challenge status including completion
  const { data: challengeStatus, refetch: refetchChallengeStatus } = useQuery<{
    hasAccepted: boolean;
    hasCompleted: boolean;
    acceptedAt?: string;
    completedAt?: string;
    deadline?: string;
    isExpired?: boolean;
  }>({
    queryKey: ["/api/challenges", (currentChallenge as any)?.id, "user-status"],
    enabled: !!(currentChallenge as any)?.id,
    retry: false,
  });

  // Mutation to accept the challenge
  const acceptChallengeMutation = useMutation({
    mutationFn: async (challengeId: string) => {
      return await apiRequest("POST", `/api/challenges/${challengeId}/accept`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/challenges", (currentChallenge as any)?.id, "participant-count"] });
      refetchUserAccepted();
      refetchChallengeStatus();
      toast({
        title: "Challenge Accepted!",
        description: "You've joined this week's challenge. Let's grow together!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to accept challenge",
        variant: "destructive",
      });
    },
  });

  // Mutation to complete the challenge (honor system)
  const completeChallengeMutation = useMutation({
    mutationFn: async (challengeId: string) => {
      return await apiRequest("POST", `/api/challenges/${challengeId}/complete`);
    },
    onSuccess: () => {
      refetchChallengeStatus();
      // Invalidate rations balance to show updated total
      queryClient.invalidateQueries({ queryKey: ["/api/rations"] });
      toast({
        title: "Challenge Completed!",
        description: "Congratulations! You've earned rations for completing this challenge.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to complete challenge",
        variant: "destructive",
      });
    },
  });

  const { data: recommendedStudies = [] } = useQuery({
    queryKey: ["/api/studies/recommendations", { limit: 3 }],
    queryFn: async () => {
      const response = await fetch('/api/studies/recommendations?limit=3', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch recommended studies');
      return response.json();
    },
    retry: false,
    refetchInterval: 10000, // Real-time updates for study recommendations
    refetchIntervalInBackground: true,
  });

  // Fetch system settings for homepage tagline
  const { data: systemSettings } = useQuery({
    queryKey: ['/api/system-settings'],
    queryFn: async () => {
      const response = await fetch('/api/system-settings', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch system settings');
      return response.json();
    },
    retry: false,
  });

  const { data: weeklyCompletions } = useQuery({
    queryKey: ["/api/progress/weekly-completions"],
    retry: false,
    refetchInterval: 30000, // Update every 30 seconds
    refetchIntervalInBackground: true,
  });

  // Fetch user's War Room posts
  const { data: userHurdleWallPosts = [] } = useQuery({
    queryKey: [`/api/hurdle-wall/user/${user?.id}`],
    enabled: !!user?.id,
    retry: false,
  });

  // Check URL parameters to auto-open devotional from carousel
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const devotionalParam = params.get('devotional');
    
    if (devotionalParam && devotional) {
      setShowFullDevotional(true);
      // Clear the URL parameter after opening
      window.history.replaceState({}, '', '/home');
    }
  }, [devotional]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ministry-navy"></div>
      </div>
    );
  }

  // Find the most recently accessed study that's not completed
  // Add safety check to ensure progress is an array
  const safeProgress = Array.isArray(progress) ? progress : [];
  const currentStudy = safeProgress
    .filter((p: any) => p && !p.isCompleted)
    .sort((a: any, b: any) => new Date(b.lastAccessedAt || 0).getTime() - new Date(a.lastAccessedAt || 0).getTime())[0];
  
  const completedCount = safeProgress.filter((p: any) => p && p.isCompleted).length;
  
  // Helper function to get display name for posts
  const getUserDisplayName = (user: any, isAnonymous: boolean) => {
    if (isAnonymous) {
      return 'Anonymous';
    }
    return `${user.firstName} ${user.lastName}`;
  };

  // Helper function to render clickable user names
  const renderUserName = (user: any, isAnonymous: boolean) => {
    if (isAnonymous) {
      return <span className="text-sm font-medium text-gray-900">Anonymous</span>;
    }
    
    return (
      <Link href={`/users/${user.id}`}>
        <span className="text-sm font-medium text-gray-900 hover:text-ministry-navy cursor-pointer transition-colors">
          {user.firstName} {user.lastName}
        </span>
      </Link>
    );
  };
  
  // Helper function to format time ago
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  // Prayer timer functionality
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPraying && prayerTimeLeft > 0) {
      interval = setInterval(() => {
        setPrayerTimeLeft((prev) => {
          if (prev <= 1) {
            endPrayerTime();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPraying, prayerTimeLeft]);

  const requestPrayerPermissions = async () => {
    let permissionsGranted = true;
    
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        permissionsGranted = false;
      }
    }

    // Check for Do Not Disturb / Focus API (experimental)
    if ('permissions' in navigator) {
      try {
        // Check for experimental Focus API permission
        const focusPermission = await (navigator.permissions as any).query({ name: 'focus' });
        console.log('Focus permission status:', focusPermission.state);
      } catch (error) {
        console.log('Focus API not available');
      }
    }

    if (!permissionsGranted) {
      toast({
        title: "Permissions Needed",
        description: "Please allow notifications for prayer time alerts in your browser settings.",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const startPrayerTime = async () => {
    // Request permissions first in dev mode
    const hasPermissions = await requestPrayerPermissions();
    if (!hasPermissions) {
      return;
    }

    const duration = parseInt(prayerDuration) * 60; // Convert minutes to seconds
    setPrayerTimeLeft(duration);
    setIsPraying(true);
    setShowPrayerDialog(false);

    // Try to enable focus mode (requires user gesture)
    try {
      if ('wakeLock' in navigator) {
        await (navigator as any).wakeLock.request('screen');
      }
    } catch (error) {
      console.log('Wake lock not supported');
    }

    // Show fullscreen prayer mode
    if (document.documentElement.requestFullscreen) {
      try {
        await document.documentElement.requestFullscreen();
      } catch (error) {
        console.log('Fullscreen not available');
      }
    }

    toast({
      title: "Prayer Time Started",
      description: `${prayerDuration} minutes of focused prayer time`,
    });
  };

  const endPrayerTime = () => {
    setIsPraying(false);
    setPrayerTimeLeft(0);

    // Exit fullscreen
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }

    // Show completion notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Prayer Time Complete', {
        body: 'Your prayer time has ended. May you feel refreshed and blessed.',
        icon: '/favicon.ico'
      });
    }

    toast({
      title: "Prayer Time Complete",
      description: "Your prayer time has ended. May you feel refreshed and blessed.",
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-3 h-3 ${
          i < Math.floor(rating)
            ? "text-black fill-current"
            : "text-black"
        }`}
      />
    ));
  };

  return (
    <div className="pb-20">
      {/* Header Section - Liquid Effect */}
      <div className="liquid-header text-white px-6 pt-12 pb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            {/* User Profile Picture */}
            <div className="flex items-center space-x-3">
              <img
                src={(user as any)?.profileImageUrl || `https://ui-avatars.com/api/?name=${user?.firstName}+${user?.lastName}&background=4A90B8&color=fff&size=60`}
                alt={`${user?.firstName} ${user?.lastName}`}
                className="w-12 h-12 rounded-none object-cover border-2 border-ministry-gold-exact"
              />
              <Link href="/rations">
                <div className="liquid-gold-card text-black px-3 py-1 rounded-none text-xs font-black uppercase tracking-wide border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center gap-1">
                  <Coins className="w-3 h-3 relative z-10" />
                  <span className="relative z-10">{rations?.balance?.toLocaleString() || 0} rations</span>
                </div>
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationPanel />
          </div>
        </div>
        
        <div className="mb-6">
          <h1 className="text-4xl font-black tracking-tighter uppercase" data-testid="text-greeting">
            <span className="text-white">Welcome,</span> <span className="text-ministry-gold-exact">{user?.firstName || 'Brother'}</span>
          </h1>
          <p className="text-[#FCD000] text-xs font-bold tracking-widest uppercase" data-testid="text-motivation">
            {systemSettings?.homepageTagline || "Ready to grow in God's strength?"}
          </p>
        </div>
        
        {/* Subscription Banner */}
        {user?.subscriptionTier === 'free' && (
          <div className="liquid-gold-card glow-gold text-black rounded-none border-2 border-black p-4 mb-4 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]" data-testid="banner-subscription">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-sm text-black uppercase tracking-tight">Upgrade to Premium</h3>
                <p className="text-xs text-black/80 font-medium">Unlock all community features</p>
              </div>
              <Button 
                className="bg-black text-white px-4 py-2 rounded-none text-xs font-black uppercase tracking-wide hover:bg-gray-900 border-2 border-black"
                data-testid="button-upgrade"
                onClick={() => setShowUpgradeModal(true)}
              >
                Upgrade
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Daily Devotional Section */}
      <div className="px-6 -mt-6 relative z-10">
        {/* Live Stream Banner */}
        <LiveStreamBanner />
        
        {/* Featured Carousel */}
        <div className="mb-6">
          <HomeCarousel />
        </div>
        
        <h2 className="text-lg font-black text-white mb-4 tracking-tight uppercase">Today's Devotional</h2>
        <Card className="shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border-2 border-black liquid-gold-card glow-gold mb-6 rounded-none" data-testid="card-devotional">
          <CardContent className="p-6">
            {devotional ? (
              <>
                <div className="flex items-start gap-4 mb-4">
                  {/* Small Thumbnail */}
                  <div className="flex-shrink-0">
                    <img 
                      src={getDefaultThumbnail((devotional as any)?.imageUrl)} 
                      alt={(devotional as any)?.title || 'Daily Devotional'}
                      className="w-20 h-20 rounded-none object-cover border-2 border-black"
                    />
                  </div>
                  
                  {/* Title and Verse */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-black text-base mb-1 uppercase tracking-tight" data-testid="text-devotional-title">
                      {(devotional as any)?.title}
                    </h3>
                    <p className="text-sm text-black font-bold mb-1" data-testid="text-verse">
                      {(devotional as any)?.verseReference}
                    </p>
                    <p className="text-xs text-black/70 font-medium">
                      {formatLocalDate(new Date(), { 
                        weekday: 'long', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </p>
                  </div>
                </div>
                
                <Button 
                  onClick={() => setShowFullDevotional(true)}
                  className="w-full liquid-black text-white py-3 rounded-none font-black hover:bg-gray-900 uppercase tracking-wide text-sm liquid-button relative z-10"
                  data-testid="button-read-devotional"
                >
                  Read Today's Devotional
                </Button>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-black">No devotional available for today</p>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Brotherhood Requests Section */}
        <BrotherhoodRequests />
      </div>

      {/* Current Progress Section */}
      <div className="px-6 mb-6">
        <h2 className="text-lg font-black text-white mb-4 tracking-tight uppercase">Your Journey</h2>
        
        {currentStudy && currentStudy.study ? (
          <ProgressCard 
            study={currentStudy.study} 
            progress={currentStudy}
            data-testid="progress-current-study"
          />
        ) : (
          <>
            {/* No Current Study - Show Recommendations */}
            <Card className="border-2 border-black p-6 mb-4 liquid-gold-card glow-gold rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" data-testid="card-no-current-study">
              <div className="text-center">
                <p className="text-ministry-slate mb-4">
                  {completedCount > 0 
                    ? "Great job completing your study! Start a new one to continue growing." 
                    : "You haven't started any studies yet"}
                </p>
                <Button 
                  className="bg-black text-white hover:bg-gray-900 border-2 border-black rounded-none font-black uppercase tracking-wide text-sm"
                  data-testid="button-browse-studies"
                  onClick={() => window.location.href = '/library'}
                >
                  {completedCount > 0 ? "Start New Study" : "Browse Studies"}
                </Button>
              </div>
            </Card>
            
            {/* Recommended Studies */}
            {recommendedStudies.length > 0 && (
              <>
                <h3 className="text-lg font-black text-white mb-2 uppercase tracking-tight">Recommended for You</h3>
                <p className="text-sm text-[#FCD000] mb-4 font-black uppercase tracking-wide">{completedCount > 0 ? "Continue Your Faith Journey" : "Start Your Growth Today"}</p>
                <div className="space-y-3">
                  {recommendedStudies.slice(0, 3).map((study: any) => (
                    <Card key={study.id} className="border-2 border-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all liquid-gold-card rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                      <CardContent className="p-0">
                        <div className="flex items-stretch">
                          <div className="w-14 liquid-black flex items-center justify-center flex-shrink-0">
                            <Book className="w-6 h-6 text-white relative z-10" />
                          </div>
                          <div className="flex-1 p-3 flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-black text-black text-sm uppercase tracking-wide truncate">{study.title}</h4>
                              <p className="text-xs text-black/70 line-clamp-1 font-medium">{study.description}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-black font-bold uppercase">{study.totalDays || study.estimatedHours || 0} {study.totalDays ? 'Days' : 'Hours'}</span>
                                <span className="text-xs text-black/60 capitalize font-medium">{study.difficulty || 'All Levels'}</span>
                              </div>
                            </div>
                            <Button 
                              size="sm"
                              className="bg-black text-white hover:bg-gray-900 rounded-none font-black uppercase tracking-wide text-xs border-2 border-black ml-3 flex-shrink-0"
                              onClick={() => window.location.href = `/studies/${study.id}`}
                            >
                              Start
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Quick Access */}
      <div className="px-6 mb-6">
        <h2 className="text-lg font-black text-white mb-4 tracking-tight uppercase">Popular</h2>
        
        <div className="space-y-2">
          <Button 
            variant="outline"
            className="h-16 w-full flex items-center justify-between liquid-gold-card hover:bg-yellow-400 border-2 border-black p-0 overflow-hidden rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all glow-gold"
            data-testid="button-current-challenge"
            onClick={() => setShowChallengeDialog(true)}
          >
            <div className="h-full w-16 liquid-black flex items-center justify-center flex-shrink-0">
              <Target className="w-6 h-6 text-white relative z-10" />
            </div>
            <span className="flex-1 font-black text-sm text-black text-left px-4 uppercase tracking-wide relative z-10">Weekly Challenge</span>
            <div className="pr-4">
              <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </div>
          </Button>

          <Link href="/videos" className="block">
            <Button 
              variant="outline"
              className="h-16 w-full flex items-center justify-between liquid-gold-card hover:bg-yellow-400 border-2 border-black p-0 overflow-hidden rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all glow-gold"
              data-testid="button-watch-videos"
            >
              <div className="h-full w-16 liquid-black flex items-center justify-center flex-shrink-0">
                <Play className="w-6 h-6 text-white relative z-10" />
              </div>
              <span className="flex-1 font-black text-sm text-black text-left px-4 uppercase tracking-wide relative z-10">Watch Videos</span>
              <div className="pr-4">
                <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                </svg>
              </div>
            </Button>
          </Link>
          
          <Link href="/hurdle-wall" className="block">
            <Button 
              variant="outline"
              className="h-16 w-full flex items-center justify-between liquid-gold-card hover:bg-yellow-400 border-2 border-black p-0 overflow-hidden rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all glow-gold"
              data-testid="button-hurdle-wall"
            >
              <div className="h-full w-16 liquid-black flex items-center justify-center flex-shrink-0">
                <Shield className="w-6 h-6 text-white relative z-10" />
              </div>
              <span className="flex-1 font-black text-sm text-black text-left px-4 uppercase tracking-wide relative z-10">War Room</span>
              <div className="pr-4">
                <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                </svg>
              </div>
            </Button>
          </Link>

          <Link href="/community" className="block">
            <Button 
              variant="outline"
              className="h-16 w-full flex items-center justify-between liquid-gold-card hover:bg-yellow-400 border-2 border-black p-0 overflow-hidden rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all glow-gold"
              data-testid="button-join-discussion"
            >
              <div className="h-full w-16 liquid-black flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-6 h-6 text-white relative z-10" />
              </div>
              <span className="flex-1 font-black text-sm text-black text-left px-4 uppercase tracking-wide relative z-10">Join Discussion</span>
              <div className="pr-4">
                <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                </svg>
              </div>
            </Button>
          </Link>

          <Link href="/blog" className="block">
            <Button 
              variant="outline"
              className="h-16 w-full flex items-center justify-between liquid-gold-card hover:bg-yellow-400 border-2 border-black p-0 overflow-hidden rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all glow-gold"
              data-testid="button-blog"
            >
              <div className="h-full w-16 liquid-black flex items-center justify-center flex-shrink-0">
                <Newspaper className="w-6 h-6 text-white relative z-10" />
              </div>
              <span className="flex-1 font-black text-sm text-black text-left px-4 uppercase tracking-wide relative z-10">Blog</span>
              <div className="pr-4">
                <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                </svg>
              </div>
            </Button>
          </Link>

          <Button 
            variant="outline"
            className="h-16 w-full flex items-center justify-between liquid-gold-card hover:bg-yellow-400 border-2 border-black p-0 overflow-hidden rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all glow-gold"
            data-testid="button-prayer-time"
            onClick={() => isPraying ? endPrayerTime() : setShowPrayerDialog(true)}
          >
            <div className="h-full w-16 liquid-black flex items-center justify-center flex-shrink-0">
              {isPraying ? (
                <PauseCircle className="w-6 h-6 text-white relative z-10" />
              ) : (
                <Clock className="w-6 h-6 text-white relative z-10" />
              )}
            </div>
            <span className="flex-1 font-black text-sm text-black text-left px-4 uppercase tracking-wide relative z-10">
              {isPraying ? formatTime(prayerTimeLeft) : 'Prayer Time'}
            </span>
            <div className="pr-4">
              <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </div>
          </Button>

          <Button 
            variant="outline"
            className="h-16 w-full flex items-center justify-between liquid-gold-card hover:bg-yellow-400 border-2 border-black p-0 overflow-hidden rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all glow-gold"
            data-testid="button-track-progress"
            onClick={() => setShowProgressDialog(true)}
          >
            <div className="h-full w-16 liquid-black flex items-center justify-center flex-shrink-0">
              <BarChart3 className="w-6 h-6 text-white relative z-10" />
            </div>
            <span className="flex-1 font-black text-sm text-black text-left px-4 uppercase tracking-wide relative z-10">Track Progress</span>
            <div className="pr-4">
              <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </div>
          </Button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="px-6 mb-8">
        <h2 className="text-lg font-black text-white mb-4 tracking-tight uppercase">Recent Activity</h2>
        
        <div className="space-y-3">
          {completedCount > 0 && (
            <Card className="border-2 border-black liquid-gold-card rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]" data-testid="activity-completed-study">
              <CardContent className="p-4 relative z-10">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-none liquid-black flex items-center justify-center">
                    <svg className="w-5 h-5 text-white relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-black text-black uppercase tracking-wide">
                      Completed {completedCount} {completedCount === 1 ? 'study' : 'studies'}
                    </p>
                    <p className="text-xs text-black/70 font-medium">Keep up the great work!</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          <Card className="border-2 border-black liquid-gold-card rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]" data-testid="activity-streak">
            <CardContent className="p-4 relative z-10">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-none liquid-black flex items-center justify-center">
                  <svg className="w-5 h-5 text-white relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-black text-black uppercase tracking-wide">
                    {appOpenStreak}-day streak
                  </p>
                  <p className="text-xs text-ministry-slate">Consecutive days on the app</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Progress Tracking Dialog */}
      <Dialog open={showProgressDialog} onOpenChange={setShowProgressDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-ministry-steel" />
              <span>Your Progress</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Completed Studies */}
            <div className="flex items-center justify-between p-4 bg-ministry-gold-exact rounded-none border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-none bg-black flex items-center justify-center">
                  <Target className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-black text-black uppercase tracking-tight">Studies Completed</p>
                  <p className="text-sm text-black/70">Total finished studies</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-black">{completedCount}</p>
                <p className="text-xs text-black/70 font-bold uppercase">studies</p>
              </div>
            </div>

            {/* Current Streak */}
            <div className="flex items-center justify-between p-4 bg-ministry-gold-exact rounded-none border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-none bg-black flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-black text-black uppercase tracking-tight">Current Streak</p>
                  <p className="text-sm text-black/70">Consecutive days on app</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-black">{appOpenStreak}</p>
                <p className="text-xs text-black/70 font-bold uppercase">days</p>
              </div>
            </div>

            {/* Total Active Days */}
            <div className="flex items-center justify-between p-4 bg-ministry-gold-exact rounded-none border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-none bg-black flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-black text-black uppercase tracking-tight">Total Active Days</p>
                  <p className="text-sm text-black/70">Days with study activity</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-black">
                  {progress.length > 0 
                    ? new Set(progress.map((p: any) => new Date(p.lastAccessedAt || p.createdAt).toDateString())).size 
                    : 0}
                </p>
                <p className="text-xs text-black/70 font-bold uppercase">days</p>
              </div>
            </div>

            {/* Progress Insights */}
            <div className="bg-ministry-gold-exact p-4 rounded-none border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <h4 className="font-black text-black mb-2 uppercase tracking-tight">Your Journey</h4>
              <div className="space-y-2 text-sm text-black/80">
                {completedCount === 0 && (
                  <p>🌱 Ready to start your first study? Check out the featured study above!</p>
                )}
                {completedCount > 0 && completedCount < 3 && (
                  <p>🚀 Great start! You've completed {completedCount} {completedCount === 1 ? 'study' : 'studies'}. Keep building momentum!</p>
                )}
                {completedCount >= 3 && completedCount < 10 && (
                  <p>💪 You're building a strong foundation with {completedCount} completed studies!</p>
                )}
                {completedCount >= 10 && (
                  <p>🏆 Incredible dedication! {completedCount} studies completed - you're truly growing in Faith!</p>
                )}
                
                {(user?.streakDays || 0) >= 7 && (
                  <p>🔥 Amazing streak! {user?.streakDays} consecutive days of spiritual growth!</p>
                )}
              </div>
            </div>

            <Button 
              onClick={() => setShowProgressDialog(false)}
              className="w-full bg-black text-white hover:bg-gray-900 rounded-none font-black uppercase tracking-wide border-2 border-black"
            >
              Continue Growing
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Prayer Time Dialog */}
      <Dialog open={showPrayerDialog} onOpenChange={setShowPrayerDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-ministry-steel" />
              <span>Set Prayer Time</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="text-center">
              <p className="text-ministry-slate text-sm mb-4">
                Choose how long you'd like to spend in prayer. Your device will enter focus mode to minimize distractions.
              </p>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-ministry-charcoal">Duration</label>
              <Select value={prayerDuration} onValueChange={setPrayerDuration}>
                <SelectTrigger>
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 minute</SelectItem>
                  <SelectItem value="3">3 minutes</SelectItem>
                  <SelectItem value="5">5 minutes</SelectItem>
                  <SelectItem value="10">10 minutes</SelectItem>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="20">20 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-xs text-ministry-slate">
                During prayer time, your screen will enter focus mode and you'll receive a notification when time is complete. The app will request permissions for notifications and focus mode.
              </p>
            </div>

            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setShowPrayerDialog(false)}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1 bg-ministry-navy text-white hover:bg-ministry-charcoal"
                onClick={startPrayerTime}
              >
                Start Prayer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Prayer Time Overlay */}
      {isPraying && (
        <div className="fixed inset-0 bg-ministry-navy bg-opacity-95 z-50 flex items-center justify-center">
          <div className="text-center text-white space-y-6">
            <div className="space-y-2">
              <Clock className="w-16 h-16 mx-auto text-ministry-gold" />
              <h2 className="text-2xl font-bold">Prayer Time</h2>
              <p className="text-blue-200">Take this time to connect with God</p>
            </div>
            
            <div className="space-y-4">
              <div className="text-6xl font-mono font-light">
                {formatTime(prayerTimeLeft)}
              </div>
              <p className="text-blue-200 text-sm">minutes remaining</p>
            </div>

            <Button 
              variant="outline"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              onClick={endPrayerTime}
            >
              End Prayer Time
            </Button>
          </div>
        </div>
      )}

      {/* Full Devotional Modal */}
      <Dialog open={showFullDevotional} onOpenChange={setShowFullDevotional}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md max-h-[85vh] overflow-y-auto bg-black border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-0">
          <div className="bg-ministry-gold-exact p-4 border-b-2 border-black">
            <DialogHeader>
              <DialogTitle className="text-black text-lg font-black uppercase tracking-tight">
                {devotional?.title}
              </DialogTitle>
            </DialogHeader>
          </div>
          
          {devotional && (
            <div className="p-4 space-y-4">
              {/* Full Image */}
              {devotional.imageUrl && (
                <div className="overflow-hidden border-2 border-black rounded-none">
                  <img 
                    src={devotional.imageUrl} 
                    alt={devotional.title}
                    className="w-full h-48 object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
              
              {/* Verse */}
              <div className="bg-ministry-gold-exact p-4 border-2 border-black rounded-none">
                <p className="text-black font-bold text-sm">
                  "{devotional.verse}"
                </p>
                <p className="text-black font-black text-xs mt-1 uppercase tracking-wide">
                  — {devotional.verseReference}
                </p>
              </div>
              
              {/* Full Content */}
              <div className="bg-gray-900 p-4 border-2 border-black rounded-none">
                <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
                  {devotional.content}
                </p>
              </div>
              
              {/* Actions */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t-2 border-black">
                <Button 
                  variant="outline" 
                  size="sm"
                  className={`flex items-center justify-center space-x-2 rounded-none border-2 border-black font-bold uppercase text-xs ${
                    isLiked 
                      ? 'bg-red-500 text-white hover:bg-red-600' 
                      : 'bg-gray-800 text-white hover:bg-gray-700'
                  }`}
                  onClick={() => {
                    setIsLiked(!isLiked);
                    toast({
                      title: isLiked ? "Removed from favorites" : "Added to favorites",
                      description: isLiked ? "Devotional removed from your favorites" : "Devotional saved to your favorites",
                    });
                  }}
                >
                  <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                  <span>{isLiked ? 'Favorited' : 'Favorite'}</span>
                </Button>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="flex items-center justify-center space-x-2 bg-gray-800 text-white hover:bg-gray-700 rounded-none border-2 border-black font-bold uppercase text-xs"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Share</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-3 bg-black border-2 border-ministry-gold-exact rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <div className="space-y-3">
                      <div className="text-center">
                        <a
                          href={`/api/devotionals/${devotional.id}/share-image`}
                          download={`manupgodsway-${devotional.id}.png`}
                          className="block w-full p-3 bg-ministry-gold-exact text-black rounded-none hover:bg-yellow-400 transition-colors font-bold text-sm uppercase"
                          data-testid="download-share-image"
                        >
                          📥 Download Share Image
                        </a>
                        <p className="text-xs text-gray-400 mt-1">Save & share on any platform</p>
                      </div>
                      <div className="border-t border-gray-700 pt-2">
                        <p className="text-xs text-gray-400 mb-2 text-center">Or share directly:</p>
                        <div className="flex gap-2 justify-center">
                          <a
                            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://www.manupgodsway.org')}&quote=${encodeURIComponent(`${devotional.title}\n\n"${devotional.verse}" - ${devotional.verseReference}\n\nDownload the app: www.manupgodsway.org`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-[#1877F2] text-white rounded-none hover:opacity-80 transition-opacity"
                            data-testid="share-facebook"
                          >
                            <SiFacebook className="w-5 h-5" />
                          </a>
                          <a
                            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${devotional.title}\n\n"${devotional.verse}" - ${devotional.verseReference}\n\n📲 Download the app: www.manupgodsway.org`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-black text-white border border-white rounded-none hover:opacity-80 transition-opacity"
                            data-testid="share-twitter"
                          >
                            <SiX className="w-5 h-5" />
                          </a>
                          <a
                            href={`https://wa.me/?text=${encodeURIComponent(`${devotional.title}\n\n"${devotional.verse}" - ${devotional.verseReference}\n\n📲 Download the app: www.manupgodsway.org`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-[#25D366] text-white rounded-none hover:opacity-80 transition-opacity"
                            data-testid="share-whatsapp"
                          >
                            <SiWhatsapp className="w-5 h-5" />
                          </a>
                          <a
                            href={`mailto:?subject=${encodeURIComponent(devotional.title)}&body=${encodeURIComponent(`${devotional.title}\n\n"${devotional.verse}" - ${devotional.verseReference}\n\n${devotional.content}\n\n📲 Download the app: www.manupgodsway.org`)}`}
                            className="p-2 bg-gray-600 text-white rounded-none hover:opacity-80 transition-opacity"
                            data-testid="share-email"
                          >
                            <Mail className="w-5 h-5" />
                          </a>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText('www.manupgodsway.org');
                              toast({ title: "Link copied!", description: "www.manupgodsway.org copied to clipboard" });
                            }}
                            className="p-2 bg-gray-700 text-white rounded-none hover:opacity-80 transition-opacity"
                            data-testid="copy-link"
                          >
                            <Link2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                
                <Button 
                  size="sm"
                  onClick={() => setShowFullDevotional(false)}
                  className="bg-ministry-gold-exact text-black hover:bg-yellow-400 rounded-none border-2 border-black font-black uppercase text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Challenge Dialog */}
      <Dialog open={showChallengeDialog} onOpenChange={setShowChallengeDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2 text-ministry-navy">
              <Target className="w-5 h-5 text-ministry-gold" />
              <span className="text-black">This Week Challenge</span>
            </DialogTitle>
          </DialogHeader>
          
          {currentChallenge && (
            <div className="space-y-4">
              {/* Challenge Header */}
              <div className="bg-black text-white p-6 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="inline-flex items-center bg-ministry-gold-exact text-ministry-gold px-3 py-1 rounded-full text-xs font-medium">
                    <Target className="w-3 h-3 mr-1" fill="currentColor" />
                    Week of {formatLocalDate(new Date((currentChallenge as any)?.releaseDate), { 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </div>
                  <span className="text-xs text-[#FCD000] capitalize">
                    {(currentChallenge as any)?.topic}
                  </span>
                </div>
                
                <h3 className="text-xl font-bold mb-3">
                  {(currentChallenge as any)?.title}
                </h3>
                
                <p className="text-gray-200 leading-relaxed">
                  {(currentChallenge as any)?.description}
                </p>
              </div>

              {/* Participant Count Banner */}
              <div className="bg-ministry-gold-exact border border-ministry-gold rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Users className="w-5 h-5 text-ministry-gold" />
                    <span className="text-sm font-medium text-black">
                      {(challengeParticipants as any)?.count || 0} {((challengeParticipants as any)?.count || 0) === 1 ? 'brother has' : 'brothers have'} taken this challenge
                    </span>
                  </div>
                  {!challengeStatus?.hasAccepted ? (
                    <Button 
                      className="bg-black hover:bg-gray-900 text-white font-bold"
                      onClick={() => acceptChallengeMutation.mutate((currentChallenge as any)?.id)}
                      disabled={acceptChallengeMutation.isPending}
                      data-testid="button-accept-challenge"
                    >
                      {acceptChallengeMutation.isPending ? "Accepting..." : "I Take the Challenge"}
                    </Button>
                  ) : challengeStatus?.hasCompleted ? (
                    <div className="flex items-center space-x-2 text-green-700 font-bold">
                      <span>✓ Completed</span>
                    </div>
                  ) : challengeStatus?.isExpired ? (
                    <div className="flex items-center space-x-2 text-red-600 font-bold">
                      <span>Deadline Passed</span>
                    </div>
                  ) : (
                    <Button 
                      className="bg-green-600 hover:bg-green-700 text-white font-bold"
                      onClick={() => completeChallengeMutation.mutate((currentChallenge as any)?.id)}
                      disabled={completeChallengeMutation.isPending}
                      data-testid="button-complete-challenge"
                    >
                      {completeChallengeMutation.isPending ? "Completing..." : "Mark Complete ✓"}
                    </Button>
                  )}
                </div>
                
                {/* Deadline info for accepted challenges */}
                {challengeStatus?.hasAccepted && !challengeStatus?.hasCompleted && challengeStatus?.deadline && (
                  <div className="mt-3 pt-3 border-t border-black/20">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-black/70">
                        {challengeStatus.isExpired ? (
                          <span className="text-red-600 font-bold">Challenge expired</span>
                        ) : (
                          <>
                            Complete by: <span className="font-bold text-black">
                              {new Date(challengeStatus.deadline).toLocaleDateString('en-US', { 
                                weekday: 'short', 
                                month: 'short', 
                                day: 'numeric' 
                              })}
                            </span>
                          </>
                        )}
                      </span>
                      <span className="text-black font-medium">
                        {(currentChallenge as any)?.durationDays || 7} day challenge
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4">
                <Button 
                  variant="outline"
                  onClick={() => setShowChallengeDialog(false)}
                >
                  Close
                </Button>
                
                <Link href="/challenges">
                  <Button 
                    className="bg-ministry-navy hover:bg-ministry-steel text-white"
                    onClick={() => setShowChallengeDialog(false)}
                  >
                    View All Challenges
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* War Room Posts Dialog */}
      <Dialog open={showHurdleWallDialog} onOpenChange={setShowHurdleWallDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-ministry-steel" />
              <span>My War Room Posts</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            {userHurdleWallPosts.length === 0 ? (
              <div className="text-center py-8">
                <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">No posts yet</p>
                <p className="text-sm text-gray-500">Share your first prayer request or discussion on the War Room!</p>
                <Link href="/hurdle-wall">
                  <Button className="mt-4 bg-ministry-navy hover:bg-ministry-steel text-white">
                    Go to War Room
                  </Button>
                </Link>
              </div>
            ) : (
              userHurdleWallPosts.map((post: any) => (
                <div key={post.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {renderUserName(post.user, post.isAnonymous)}
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        post.postType === 'prayer_request' 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {post.postType === 'prayer_request' ? 'Prayer Request' : 'Discussion'}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">{formatTimeAgo(post.createdAt)}</span>
                  </div>
                  
                  <p className="text-gray-700 text-sm leading-relaxed mb-3">{post.content}</p>
                  
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    {post.postType === 'prayer_request' ? (
                      <div className="flex items-center gap-1">
                        <HandHeart className="w-3 h-3" />
                        <span>{post.prayerCount} {post.prayerCount === 1 ? 'Prayer' : 'Prayers'}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        <span>{post.replyCount} {post.replyCount === 1 ? 'Reply' : 'Replies'}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <Button 
              variant="outline"
              onClick={() => setShowHurdleWallDialog(false)}
            >
              Close
            </Button>
            
            <Link href="/hurdle-wall">
              <Button 
                className="bg-ministry-navy hover:bg-ministry-steel text-white"
                onClick={() => setShowHurdleWallDialog(false)}
              >
                Go to War Room
              </Button>
            </Link>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />

      {/* Welcome Intro for New Users */}
      <WelcomeIntro
        open={showWelcomeIntro}
        onClose={() => setShowWelcomeIntro(false)}
      />
    </div>
  );
}
