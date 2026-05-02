import { useEffect, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Devotional } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/useWebSocket";
import { triggerRefTagger } from "@/hooks/useRefTagger";
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
import { stripMentionMarkdown } from "@/components/mention-textarea";
import { getDefaultThumbnail } from "@/lib/default-thumbnail";
import weeklyChallengeIcon from "@assets/ChatGPT_Image_May_1,_2026,_10_37_58_PM_1777693401898.png";
import watchVideosIcon from "@assets/ChatGPT_Image_May_1,_2026,_10_39_09_PM_1777693583880.png";
import { Bell, Play, Users, BarChart3, Clock, Heart, Share2, X, PauseCircle, TrendingUp, Calendar, Target, Star, Shield, MessageSquare, HandHeart, Mail, Link2, Newspaper, Book, Coins, BellRing, Plus, Trash2, Sun, RefreshCw, Dumbbell } from "lucide-react";
import { SiFacebook, SiX, SiWhatsapp } from "react-icons/si";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { apiRequest } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { VatmebopChart } from "@/components/vatmebop-chart";

// Experimental Notification Triggers API (Chrome 80+ / Android)
interface TimestampTrigger {
  readonly timestamp: number;
}
declare let TimestampTrigger: {
  new (timestamp: number): TimestampTrigger;
};
interface NotificationWithTrigger extends NotificationOptions {
  showTrigger?: TimestampTrigger;
}
interface GetNotificationsFilter {
  tag?: string;
  includeTriggered?: boolean;
}
interface ServiceWorkerRegistrationWithTriggers extends ServiceWorkerRegistration {
  showNotification(title: string, options?: NotificationWithTrigger): Promise<void>;
  getNotifications(filter?: GetNotificationsFilter): Promise<Notification[]>;
}

export default function Home() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, navigate] = useLocation();
  
  // Initialize WebSocket for real-time notifications
  useWebSocket(user?.id);
  const [showFullDevotional, setShowFullDevotional] = useState(false);
  const [pendingDevotionalOpen, setPendingDevotionalOpen] = useState(false);
  const devotionalOpenedAt = useRef<number | null>(null);
  const devotionalCompleted = useRef(false);
  const [reflectionText, setReflectionText] = useState("");
  const [reflectionSubmitted, setReflectionSubmitted] = useState(false);
  const [isLiked, setIsLiked] = useState(false); // optimistic local state
  const [showPrayerDialog, setShowPrayerDialog] = useState(false);
  const [prayerDuration, setPrayerDuration] = useState("5");
  const [isPraying, setIsPraying] = useState(false);
  const [prayerTimeLeft, setPrayerTimeLeft] = useState(0);
  // Prayer reminders state
  const [remindersHourlyEnabled, setRemindersHourlyEnabled] = useState(false);
  const [remindersHourlyStart, setRemindersHourlyStart] = useState("08:00");
  const [remindersHourlyEnd, setRemindersHourlyEnd] = useState("21:00");
  const [remindersMiddayEnabled, setRemindersMiddayEnabled] = useState(false);
  const [remindersCustomTimes, setRemindersCustomTimes] = useState<string[]>([]);
  const [newCustomTime, setNewCustomTime] = useState("09:00");
  const [remindersSaving, setRemindersSaving] = useState(false);
  const [remindersTestSending, setRemindersTestSending] = useState(false);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [showDndHelpDialog, setShowDndHelpDialog] = useState(false);
  const [showChallengeDialog, setShowChallengeDialog] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [showHurdleWallDialog, setShowHurdleWallDialog] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showWelcomeIntro, setShowWelcomeIntro] = useState(false);
  const [appOpenStreak, setAppOpenStreak] = useState(0);

  // Push notifications hook (for reminder subscription prompting)
  const { isSupported: pushSupported, isSubscribed: pushSubscribed, subscribe: pushSubscribe } = usePushNotifications();
  const isIOSNotInstalled = typeof navigator !== 'undefined' &&
    /iP(hone|od|ad)/.test(navigator.userAgent) &&
    !window.matchMedia('(display-mode: standalone)').matches &&
    !(navigator as any).standalone;

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

  const { data: devotional } = useQuery<Devotional>({
    queryKey: ["/api/devotionals/today"],
    retry: false,
  });

  // Fetch whether today's devotional is saved
  const { data: savedStatus } = useQuery<{ isSaved: boolean }>({
    queryKey: ["/api/devotionals", devotional?.id, "saved"],
    enabled: !!devotional?.id && !!user,
    queryFn: () => fetch(`/api/devotionals/${devotional!.id}/saved`).then(r => r.json()),
  });

  // Sync local optimistic state with server
  useEffect(() => {
    if (savedStatus !== undefined) setIsLiked(savedStatus.isSaved);
  }, [savedStatus]);

  const toggleSaveMutation = useMutation<{ isSaved: boolean }>({
    mutationFn: () => apiRequest("POST", `/api/devotionals/${devotional!.id}/save`),
    onMutate: () => setIsLiked(prev => !prev),
    onSuccess: (data) => {
      setIsLiked(data.isSaved);
      queryClient.invalidateQueries({ queryKey: ["/api/devotionals/saved"] });
      queryClient.invalidateQueries({ queryKey: ["/api/devotionals", devotional?.id, "saved"] });
    },
    onError: () => setIsLiked(prev => !prev),
  });

  const completeDevotionalMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/devotionals/${id}/complete`),
    onSuccess: (data: any) => {
      if (data?.rations?.success && data.rations.amount > 0) {
        toast({
          title: "Devotional Complete!",
          description: `+${data.rations.amount} rations earned. Keep showing up, soldier.`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/rations"] });
      }
    },
  });

  const submitReflectionMutation = useMutation({
    mutationFn: (text: string) =>
      apiRequest("POST", `/api/devotionals/${devotional!.id}/reflection`, { reflection: text }),
    onSuccess: (data: any) => {
      setReflectionSubmitted(true);
      if (data?.rations?.success && data.rations.amount > 0) {
        toast({
          title: "Reflection Submitted!",
          description: `+${data.rations.amount} rations earned for your reflection.`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/rations"] });
      } else {
        toast({ title: "Reflection Submitted!", description: "Your reflection has been recorded." });
      }
    },
    onError: (err: any) => {
      toast({
        title: "Reflection too short",
        description: "Write at least 50 characters to submit your reflection.",
        variant: "destructive",
      });
    },
  });

  // Track when the devotional modal opens so we can award completion rations on close
  useEffect(() => {
    if (showFullDevotional) {
      devotionalOpenedAt.current = Date.now();
      devotionalCompleted.current = false;
      setReflectionText("");
      setReflectionSubmitted(false);
    }
  }, [showFullDevotional]);

  const handleDevotionalClose = () => {
    if (devotional && devotionalOpenedAt.current && !devotionalCompleted.current) {
      const elapsed = Date.now() - devotionalOpenedAt.current;
      if (elapsed >= 10000) {
        devotionalCompleted.current = true;
        completeDevotionalMutation.mutate(devotional.id);
      }
    }
    setShowFullDevotional(false);
  };

  useEffect(() => {
    if (devotional) {
      triggerRefTagger();
    }
  }, [devotional]);

  const { data: rations } = useQuery<{ balance: number }>({
    queryKey: ["/api/rations"],
    retry: false,
  });

  // Prayer reminders data
  const { data: prayerRemindersData, refetch: refetchPrayerReminders } = useQuery<{
    hourlyEnabled: boolean;
    hourlyStartTime: string;
    hourlyEndTime: string;
    middayEnabled: boolean;
    customTimes: string[];
  }>({
    queryKey: ["/api/prayer/reminders"],
    retry: false,
    enabled: !!user,
    staleTime: Infinity,
  });

  // Populate reminders state from server data
  useEffect(() => {
    if (prayerRemindersData) {
      setRemindersHourlyEnabled(prayerRemindersData.hourlyEnabled ?? false);
      setRemindersHourlyStart(prayerRemindersData.hourlyStartTime ?? "06:00");
      setRemindersHourlyEnd(prayerRemindersData.hourlyEndTime ?? "22:00");
      setRemindersMiddayEnabled(prayerRemindersData.middayEnabled ?? false);
      setRemindersCustomTimes(prayerRemindersData.customTimes ?? []);
    }
  }, [prayerRemindersData]);

  // Refresh prayer reminders from server each time dialog opens
  useEffect(() => {
    if (showPrayerDialog) {
      refetchPrayerReminders();
    }
  }, [showPrayerDialog]);

  // Auto-open prayer dialog when URL has ?openPrayerDialog=true
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("openPrayerDialog") === "true") {
      setShowPrayerDialog(true);
      // Clean up URL param without navigating
      const url = new URL(window.location.href);
      url.searchParams.delete("openPrayerDialog");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

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

  // Fetch daily check-ins for current challenge
  const { data: dailyCheckins = [], refetch: refetchCheckins } = useQuery<{ dayNumber: number; checkedInAt: string }[]>({
    queryKey: ["/api/challenges", (currentChallenge as any)?.id, "checkins"],
    enabled: !!(currentChallenge as any)?.id,
    retry: false,
    queryFn: async () => {
      const res = await fetch(`/api/challenges/${(currentChallenge as any)?.id}/checkins`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const checkinMutation = useMutation({
    mutationFn: async ({ challengeId, dayNumber }: { challengeId: string; dayNumber: number }) => {
      return await apiRequest("POST", `/api/challenges/${challengeId}/checkin`, { dayNumber });
    },
    onSuccess: (data: any) => {
      refetchCheckins();
      refetchChallengeStatus();
      queryClient.invalidateQueries({ queryKey: ["/api/rations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/challenges", (currentChallenge as any)?.id, "participant-count"] });
      if (data?.completed) {
        toast({
          title: "Challenge Complete! 🏆",
          description: `All 7 days finished! You've earned your rations, soldier!`,
        });
      } else {
        toast({
          title: `Day ${data?.checkin?.dayNumber} Checked In!`,
          description: "+30 Rations earned. Keep pushing!",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Already checked in",
        description: error.message || "You've already checked in for this day.",
        variant: "destructive",
      });
    },
  });

  // Mutation to complete the challenge (honor system) - kept for backward compatibility
  const completeChallengeMutation = useMutation({
    mutationFn: async (challengeId: string) => {
      return await apiRequest("POST", `/api/challenges/${challengeId}/complete`);
    },
    onSuccess: () => {
      refetchChallengeStatus();
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

  const shareAppMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/share/app'),
    onSuccess: (data: any) => {
      if (data?.alreadyAwarded) {
        toast({ title: "Already shared today", description: data.message || "Come back tomorrow for more rations!" });
      } else {
        toast({ title: "+10 Rations Earned!", description: "Thanks for spreading the word, brother!" });
      }
    },
    onError: () => {
      toast({ title: "Share failed", description: "Could not award rations. Try again.", variant: "destructive" });
    },
  });

  const handleShareApp = async () => {
    const shareUrl = 'https://app.manupgodsway.org';
    const shareText = "Join me on Man Up God's Way — faith-based tools for biblical masculinity, Bible studies, discipleship, and brotherhood.";
    if (navigator.share) {
      try {
        await navigator.share({ title: "Man Up God's Way", text: shareText, url: shareUrl });
        shareAppMutation.mutate();
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          toast({ title: "Share failed", description: "Could not open share dialog.", variant: "destructive" });
        }
      }
    } else {
      await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      toast({ title: "Link copied!", description: "Share link copied to clipboard." });
      shareAppMutation.mutate();
    }
  };

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

  // Fetch recent community discussions for live feed
  const { data: recentDiscussions = [], isLoading: feedLoading } = useQuery<any[]>({
    queryKey: ["/api/discussions", "home-feed"],
    queryFn: async () => {
      const response = await fetch('/api/discussions?sortBy=recent&limit=1', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch discussions');
      return response.json();
    },
    retry: false,
    refetchInterval: 60000,
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

  // Save image to camera roll — uses iOS native share sheet "Save Image" option
  const handleSaveImage = async (devotional: any) => {
    try {
      const response = await fetch(`/api/devotionals/${devotional.id}/share-image`);
      if (!response.ok) throw new Error('Failed to fetch image');
      const blob = await response.blob();
      const file = new File([blob], 'manupgodsway-devotional.png', { type: 'image/png' });

      // iOS/Android: native share sheet has built-in "Save Image" / "Save to Photos"
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }

      // Desktop fallback: trigger a download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'manupgodsway-devotional.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Image Downloaded!", description: "Check your downloads folder" });
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        // Last resort: open raw image URL in new tab so user can long-press in Safari
        window.open(`/api/devotionals/${devotional.id}/share-image`, '_blank');
      }
    }
  };

  // Native share function with image
  const handleNativeShare = async (devotional: any) => {
    setIsSharing(true);

    // Safety timeout — navigator.share can hang on iOS after user saves a file
    const sharingTimeout = setTimeout(() => setIsSharing(false), 15000);

    try {
      // Fetch the share image
      const response = await fetch(`/api/devotionals/${devotional.id}/share-image`);
      if (!response.ok) throw new Error('Failed to fetch share image');
      
      const blob = await response.blob();
      const file = new File([blob], `manupgodsway-devotional.png`, { type: 'image/png' });
      
      const shareText = `${devotional.title}\n\n"${devotional.verse}"\n- ${devotional.verseReference}\n\n📖 Man Up God's Way\nwww.manupgodsway.org`;
      
      // Check if native sharing with files is supported
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: devotional.title,
          text: shareText,
          files: [file],
        });
        toast({ title: "Shared!", description: "Devotional shared successfully" });
      } else if (navigator.share) {
        // Fallback: share the devotional's dedicated share page so Facebook/X shows the meme image
        await navigator.share({
          title: devotional.title,
          text: shareText,
          url: `https://www.manupgodsway.org/share/devotional/${devotional.id}`,
        });
        toast({ title: "Shared!", description: "Devotional shared successfully" });
      } else {
        // Download the image if sharing not supported
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `manupgodsway-${devotional.id}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({ title: "Image Downloaded!", description: "Share the image from your gallery" });
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        toast({
          title: "Share failed",
          description: "Could not share. Try downloading the image instead.",
          variant: "destructive",
        });
      }
    } finally {
      clearTimeout(sharingTimeout);
      setIsSharing(false);
    }
  };

  // Check URL parameters to auto-open devotional from carousel links
  useEffect(() => {
    const url = new URL(window.location.href);
    const devotionalParam = url.searchParams.get('devotional');
    
    if (devotionalParam === 'open' && devotional) {
      console.log('Auto-opening devotional from URL parameter');
      setShowFullDevotional(true);
      window.history.replaceState({}, '', '/');
    }
  }, [devotional, location]);

  // Listen for custom event from notification clicks to open devotional
  useEffect(() => {
    const handleOpenDevotional = () => {
      console.log('Opening devotional from notification event');
      if (devotional) {
        setShowFullDevotional(true);
      } else {
        console.log('Devotional not loaded yet, setting pending flag');
        setPendingDevotionalOpen(true);
      }
    };

    window.addEventListener('openDevotional', handleOpenDevotional);
    return () => {
      window.removeEventListener('openDevotional', handleOpenDevotional);
    };
  }, [devotional]);

  // Open devotional dialog when data becomes available and pending flag is set
  useEffect(() => {
    if (pendingDevotionalOpen && devotional) {
      console.log('Devotional loaded, opening dialog');
      setShowFullDevotional(true);
      setPendingDevotionalOpen(false);
    }
  }, [pendingDevotionalOpen, devotional]);

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
  
  // Use persistent lifetime counter from user profile (never resets)
  const completedCount = (user as any)?.totalStudiesCompleted || 0;
  
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

  // Restore prayer session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('prayerEndTime');
    if (stored) {
      const endTime = parseInt(stored, 10);
      const remaining = Math.floor((endTime - Date.now()) / 1000);
      if (remaining > 0) {
        setPrayerTimeLeft(remaining);
        setIsPraying(true);
      } else {
        localStorage.removeItem('prayerEndTime');
        toast({
          title: "Prayer Time Complete",
          description: "Your prayer time ended while you were away. May you feel refreshed and blessed.",
        });
      }
    }
  }, []);

  // Timestamp-based prayer countdown
  useEffect(() => {
    if (!isPraying) return;

    const tick = () => {
      const stored = localStorage.getItem('prayerEndTime');
      if (!stored) return;
      const remaining = Math.floor((parseInt(stored, 10) - Date.now()) / 1000);
      if (remaining <= 0) {
        endPrayerTime(true);
      } else {
        setPrayerTimeLeft(remaining);
      }
    };

    const interval = setInterval(tick, 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        tick();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isPraying]);

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
    const hasPermissions = await requestPrayerPermissions();
    if (!hasPermissions) {
      return;
    }

    const durationSeconds = parseInt(prayerDuration) * 60;
    const endTime = Date.now() + durationSeconds * 1000;

    // Persist end timestamp so countdown survives page hide / screen lock
    localStorage.setItem('prayerEndTime', String(endTime));

    setPrayerTimeLeft(durationSeconds);
    setIsPraying(true);
    setShowPrayerDialog(false);

    // Schedule server-side push notification for when prayer ends
    try {
      await apiRequest('POST', '/api/prayer/schedule', { endTime });
    } catch (err) {
      console.log('Could not schedule prayer push notification:', err);
    }

    // Android local notification fallback via showTrigger API
    if ('Notification' in window && Notification.permission === 'granted' && 'TimestampTrigger' in window) {
      try {
        const reg = (await navigator.serviceWorker.ready) as ServiceWorkerRegistrationWithTriggers;
        await reg.showNotification('Prayer Time Complete', {
          body: 'Your prayer time has ended. May you feel refreshed and blessed.',
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: 'prayer-complete',
          showTrigger: new TimestampTrigger(endTime),
        });
      } catch (err) {
        console.log('showTrigger not available:', err);
      }
    }

    // Keep screen awake during prayer (best-effort)
    try {
      if ('wakeLock' in navigator) {
        await (navigator as any).wakeLock.request('screen');
      }
    } catch (error) {
      console.log('Wake lock not supported');
    }

    // Fullscreen prayer mode
    if (document.documentElement.requestFullscreen) {
      try {
        await document.documentElement.requestFullscreen();
      } catch (error) {
        console.log('Fullscreen not available');
      }
    }

    toast({
      title: "Prayer Time Started",
      description: `${prayerDuration} ${parseInt(prayerDuration) === 1 ? 'minute' : 'minutes'} of focused prayer time`,
    });
  };

  const endPrayerTime = (timerExpired = false) => {
    setIsPraying(false);
    setPrayerTimeLeft(0);

    // Clear persisted end timestamp
    localStorage.removeItem('prayerEndTime');

    if (timerExpired) {
      // Timer expired naturally — show a direct browser notification so the
      // user sees it even if push subscriptions aren't configured.
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Prayer Time Complete', {
          body: 'Your prayer time has ended. May you feel refreshed and blessed.',
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: 'prayer-complete',
        });
      }
    } else {
      // Manual end — cancel the server-side scheduled push so it doesn't fire late.
      apiRequest('DELETE', '/api/prayer/cancel').catch(() => {});

      // Also cancel any pending local trigger notification (Android fallback)
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then((reg) => {
          const regWithTriggers = reg as ServiceWorkerRegistrationWithTriggers;
          return regWithTriggers.getNotifications({ tag: 'prayer-complete', includeTriggered: true });
        }).then((notifications) => notifications.forEach((n) => n.close())).catch(() => {});
      }
    }

    // Exit fullscreen
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }

    toast({
      title: timerExpired ? "Prayer Time Complete" : "Prayer Time Ended",
      description: "Your prayer time has ended. May you feel refreshed and blessed.",
    });

    navigate('/');
  };

  const [showPushPrompt, setShowPushPrompt] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<{ field: 'hourly' | 'midday'; value: boolean } | null>(null);

  const handleReminderToggle = async (field: 'hourly' | 'midday', value: boolean) => {
    // If enabling and push not subscribed, show inline prompt
    if (value && pushSupported && !pushSubscribed) {
      setPendingToggle({ field, value });
      setShowPushPrompt(true);
      return;
    }
    // Otherwise apply immediately
    if (field === 'hourly') setRemindersHourlyEnabled(value);
    else setRemindersMiddayEnabled(value);
  };

  const handleEnableNotifications = async () => {
    const ok = await pushSubscribe();
    if (ok && pendingToggle) {
      if (pendingToggle.field === 'hourly') setRemindersHourlyEnabled(pendingToggle.value);
      else setRemindersMiddayEnabled(pendingToggle.value);
    } else if (!ok) {
      toast({
        title: "Notifications Blocked",
        description: "Please allow notifications in your browser settings to enable prayer reminders.",
        variant: "destructive",
      });
    }
    setShowPushPrompt(false);
    setPendingToggle(null);
  };

  const handleDismissPushPrompt = () => {
    setShowPushPrompt(false);
    setPendingToggle(null);
  };

  const saveReminders = async () => {
    setRemindersSaving(true);
    // If any reminder enabled and not subscribed to push, prompt first
    const anyEnabled = remindersHourlyEnabled || remindersMiddayEnabled || remindersCustomTimes.length > 0;
    if (anyEnabled && pushSupported && !pushSubscribed) {
      const ok = await pushSubscribe();
      if (!ok) {
        toast({
          title: "Notifications Required",
          description: "Please allow notifications to enable prayer reminders.",
          variant: "destructive",
        });
        setRemindersSaving(false);
        return;
      }
    }
    try {
      await apiRequest('PUT', '/api/prayer/reminders', {
        hourlyEnabled: remindersHourlyEnabled,
        hourlyStartTime: remindersHourlyStart,
        hourlyEndTime: remindersHourlyEnd,
        middayEnabled: remindersMiddayEnabled,
        customTimes: remindersCustomTimes,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/prayer/reminders"] });
      toast({ title: "Reminders Saved", description: "Your prayer reminders have been updated." });
    } catch {
      toast({ title: "Error", description: "Failed to save reminders.", variant: "destructive" });
    } finally {
      setRemindersSaving(false);
    }
  };

  const sendTestPrayerNotification = async (delaySeconds = 0) => {
    setRemindersTestSending(true);
    try {
      const data = await apiRequest('POST', '/api/prayer/test-notification', { delaySeconds });
      if (delaySeconds > 0) {
        toast({ title: "Close the app now!", description: data?.message || `Notification arriving in ${delaySeconds}s — close and lock your phone.` });
      } else {
        toast({ title: "Test Sent", description: "Check your device for a prayer reminder notification." });
      }
    } catch {
      toast({ title: "Test Failed", description: "Make sure notifications are enabled for this app in your browser and device settings.", variant: "destructive" });
    } finally {
      setRemindersTestSending(false);
    }
  };

  const persistCustomTimes = async (times: string[]) => {
    try {
      await apiRequest('PUT', '/api/prayer/reminders', {
        hourlyEnabled: remindersHourlyEnabled,
        hourlyStartTime: remindersHourlyStart,
        hourlyEndTime: remindersHourlyEnd,
        middayEnabled: remindersMiddayEnabled,
        customTimes: times,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/prayer/reminders"] });
    } catch {
      toast({ title: "Error", description: "Failed to save reminder time.", variant: "destructive" });
    }
  };

  const addCustomTime = async () => {
    if (remindersCustomTimes.length >= 15) {
      toast({ title: "Limit Reached", description: "Maximum 15 custom reminder times allowed.", variant: "destructive" });
      return;
    }
    if (!remindersCustomTimes.includes(newCustomTime)) {
      const newTimes = [...remindersCustomTimes, newCustomTime].sort();
      setRemindersCustomTimes(newTimes);
      await persistCustomTimes(newTimes);
    }
  };

  const removeCustomTime = async (t: string) => {
    const newTimes = remindersCustomTimes.filter((x) => x !== t);
    setRemindersCustomTimes(newTimes);
    await persistCustomTimes(newTimes);
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
                className="w-12 h-12 rounded-sm object-cover border-2 border-ministry-gold-exact"
              />
              <Link href="/rations">
                <div className="bg-[#FDD000] text-black px-3 py-1 rounded-sm text-xs font-black uppercase tracking-wide border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:bg-[#e6bc00] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center gap-1">
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
          <p className="text-[#FDD000] text-xs font-bold tracking-widest uppercase" data-testid="text-motivation">
            {systemSettings?.homepageTagline || "Ready to grow in God's strength?"}
          </p>
        </div>
        
        {/* Subscription Banner */}
        {!((user as any)?.subscriptionStatus === 'active' ||
          ((user as any)?.subscriptionStatus === 'cancelled' && (user as any)?.subscriptionExpiresAt && new Date((user as any).subscriptionExpiresAt) > new Date())) && (
          <div className="bg-[#FDD000] glow-gold text-black rounded-sm border-2 border-black p-4 mb-4 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]" data-testid="banner-subscription">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-sm text-black uppercase tracking-tight">Subscribe Now</h3>
                <p className="text-xs text-black/80 font-medium">Unlock all community features</p>
              </div>
              <Button 
                className="bg-black text-white px-4 py-2 rounded-sm text-xs font-black uppercase tracking-wide hover:bg-gray-900 border-2 border-black"
                data-testid="button-upgrade"
                onClick={() => setShowUpgradeModal(true)}
              >
                Subscribe
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Daily Devotional Section */}
      <div className="px-6 -mt-6 relative z-10">
        {/* Live Stream Banner */}
        <LiveStreamBanner />
        
        {/* Brotherhood Feed */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-1 h-6 bg-[#FDD000] rounded-full flex-shrink-0" />
            <h2 className="text-xl font-coalition text-white uppercase tracking-widest">Brotherhood Feed</h2>
            <div className="flex-1 h-px bg-white/10" />
            <Link href="/community" className="text-xs font-black text-[#FDD000] uppercase tracking-wide hover:opacity-80">
              View All
            </Link>
          </div>

          <div className="border-2 border-[#FDD000] rounded-sm p-3">
          {feedLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-black border-2 border-white/10 rounded-sm p-4 animate-pulse">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex-shrink-0" />
                    <div className="h-3 bg-white/10 rounded w-24" />
                  </div>
                  <div className="h-4 bg-white/10 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-white/10 rounded w-full mb-1" />
                  <div className="h-3 bg-white/10 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : recentDiscussions.length === 0 ? (
            <Link href="/community" className="block">
              <div className="bg-black border-2 border-dashed border-white/20 rounded-sm p-6 text-center">
                <MessageSquare className="w-8 h-8 text-[#FDD000] mx-auto mb-2" />
                <p className="text-sm font-black text-white uppercase tracking-wide mb-1">Start the Conversation</p>
                <p className="text-xs text-white/50">Be the first brother to post today</p>
              </div>
            </Link>
          ) : (() => {
              const discussion = recentDiscussions[0];
              if (!discussion) return null;
              const name = [discussion.user?.firstName, discussion.user?.lastName].filter(Boolean).join(' ') || 'A Brother';
              const initials = name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
              const postedAt = discussion.createdAt ? new Date(discussion.createdAt) : null;
              const diffMins = postedAt ? Math.floor((Date.now() - postedAt.getTime()) / 60000) : 0;
              const timeAgo = diffMins < 1 ? 'just now'
                : diffMins < 60 ? `${diffMins}m ago`
                : diffMins < 1440 ? `${Math.floor(diffMins / 60)}h ago`
                : `${Math.floor(diffMins / 1440)}d ago`;
              const preview = stripMentionMarkdown((discussion.content || '').replace(/<[^>]+>/g, '')).slice(0, 120);
              return (
                <div className="space-y-3">
                  <Link href={`/community?discussion=${discussion.id}`} className="block">
                    <div className="bg-black border-2 border-[#FDD000]/30 rounded-sm p-4 hover:border-[#FDD000] transition-colors shadow-[2px_2px_0px_0px_rgba(253,208,0,0.15)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]">
                      <div className="flex items-center gap-2 mb-2">
                        {discussion.user?.profileImageUrl ? (
                          <img src={discussion.user.profileImageUrl} alt={name} className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-[#FDD000]/40" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-[#FDD000] flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-black text-black">{initials}</span>
                          </div>
                        )}
                        <span className="text-xs font-bold text-white/80 truncate flex-1">{name}</span>
                        <span className="text-xs text-white/40 flex-shrink-0">{timeAgo}</span>
                      </div>
                      <p className="text-sm font-black text-white leading-snug mb-1 line-clamp-2">{discussion.title}</p>
                      {preview && (
                        <p className="text-xs text-white/55 leading-relaxed line-clamp-2 mb-2">{preview}{(discussion.content || '').length > 120 ? '…' : ''}</p>
                      )}
                      <div className="flex items-center gap-4 mt-1">
                        <span className="flex items-center gap-1 text-xs text-white/40">
                          <MessageSquare className="w-3 h-3" />
                          {discussion.replyCount ?? 0} {discussion.replyCount === 1 ? 'reply' : 'replies'}
                        </span>
                        {(discussion.likes ?? 0) > 0 && (
                          <span className="flex items-center gap-1 text-xs text-white/40">
                            <Heart className="w-3 h-3" />
                            {discussion.likes}
                          </span>
                        )}
                        {discussion.category && (
                          <span className="text-xs text-[#FDD000]/60 font-bold uppercase tracking-wide ml-auto">{discussion.category}</span>
                        )}
                      </div>
                    </div>
                  </Link>
                  <Link href="/community" className="block h-16 w-full flex items-center justify-between bg-[#FDD000] text-black hover:bg-yellow-400 border-2 border-black p-0 overflow-hidden rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all glow-gold">
                    <div className="h-full w-16 liquid-black flex items-center justify-center flex-shrink-0">
                      <Plus className="w-6 h-6 text-white relative z-10" />
                    </div>
                    <span className="flex-1 font-black text-sm text-black text-left px-4 uppercase tracking-wide relative z-10">Join the Discussion</span>
                    <div className="pr-4">
                      <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                      </svg>
                    </div>
                  </Link>
                </div>
              );
            })()}
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-1 h-6 bg-[#FDD000] rounded-full flex-shrink-0" />
          <h2 className="text-xl font-coalition text-white uppercase tracking-widest">Today's Devotional</h2>
          <div className="flex-1 h-px bg-white/10" />
        </div>
        <Card className="shadow-[4px_4px_0px_0px_rgba(253,208,0,1)] border-2 border-ministry-gold-exact liquid-black-white mb-6 rounded-sm overflow-hidden" data-testid="card-devotional">
          <CardContent className="p-6 relative z-10">
            {devotional ? (
              <>
                <div className="flex items-start gap-4 mb-4">
                  {/* Small Thumbnail */}
                  <div className="flex-shrink-0">
                    <img 
                      src={getDefaultThumbnail((devotional as any)?.imageUrl)} 
                      alt={(devotional as any)?.title || 'Daily Devotional'}
                      className="w-20 h-20 rounded-sm object-cover border-2 border-ministry-gold-exact"
                    />
                  </div>
                  
                  {/* Title and Verse */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-white text-base mb-1 uppercase tracking-tight" data-testid="text-devotional-title">
                      {(devotional as any)?.title}
                    </h3>
                    <p className="text-sm text-ministry-gold-exact font-bold mb-1" data-testid="text-verse">
                      {(devotional as any)?.verseReference}
                    </p>
                    <p className="text-xs text-white/70 font-medium">
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
                  className="w-full bg-ministry-gold-exact text-black py-3 rounded-sm font-black hover:bg-yellow-400 uppercase tracking-wide text-sm border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  data-testid="button-read-devotional"
                >
                  Read Today's Devotional
                </Button>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-white">No devotional available for today</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Featured Carousel */}
        <div className="mb-6">
          <HomeCarousel />
        </div>

        {/* Brotherhood Requests Section */}
        <BrotherhoodRequests />
      </div>

      {/* Current Progress Section */}
      <div className="px-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1 h-6 bg-[#FDD000] rounded-full flex-shrink-0" />
          <h2 className="text-xl font-coalition text-white uppercase tracking-widest">Your Journey</h2>
          <div className="flex-1 h-px bg-white/10" />
        </div>
        
        {currentStudy && currentStudy.study ? (
          <ProgressCard 
            study={currentStudy.study} 
            progress={currentStudy}
            data-testid="progress-current-study"
          />
        ) : (
          <>
            {/* No Current Study - Show Recommendations */}
            <Card className="border-2 border-ministry-gold-exact p-6 mb-4 liquid-black-white rounded-sm shadow-[4px_4px_0px_0px_rgba(253,208,0,1)] overflow-hidden" data-testid="card-no-current-study">
              <div className="text-center relative z-10">
                <p className="text-white/80 mb-4">
                  {completedCount > 0 
                    ? "Great job completing your study! Start a new one to continue growing." 
                    : "You haven't started any studies yet"}
                </p>
                <Button 
                  className="bg-ministry-gold-exact text-black hover:bg-yellow-400 border-2 border-black rounded-sm font-black uppercase tracking-wide text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  data-testid="button-browse-studies"
                  onClick={() => navigate('/library')}
                >
                  {completedCount > 0 ? "Start New Study" : "Browse Studies"}
                </Button>
              </div>
            </Card>
            
            {/* Recommended Studies */}
            {recommendedStudies.length > 0 && (
              <>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-1 h-6 bg-[#FDD000] rounded-full flex-shrink-0" />
                  <h3 className="text-xl font-coalition text-white uppercase tracking-widest">Recommended for You</h3>
                  <div className="flex-1 h-px bg-white/10" />
                </div>
                <p className="text-sm text-[#FDD000] mb-4 font-black uppercase tracking-wide">{completedCount > 0 ? "Continue Your Faith Journey" : "Start Your Growth Today"}</p>
                <div className="space-y-3">
                  {recommendedStudies.slice(0, 3).map((study: any) => (
                    <Card key={study.id} className="border-2 border-black hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all rounded-sm overflow-hidden bg-[#FDD000]" onClick={() => navigate(`/studies/${study.id}`)} style={{ cursor: 'pointer', boxShadow: '0 4px 15px rgba(252, 208, 0, 0.3), 0 0 30px rgba(252, 208, 0, 0.15)' }}>
                      <CardContent className="p-0">
                        <div className="flex">
                          <img
                            src={getDefaultThumbnail(study.thumbnailUrl)}
                            alt={study.title}
                            className="w-24 h-20 object-cover flex-shrink-0"
                          />
                          <div className="flex-1 p-3 min-w-0 flex flex-col justify-between">
                            <div>
                              <h4 className="font-semibold text-black text-sm leading-snug mb-1 line-clamp-2">{study.title}</h4>
                              <p className="text-xs text-black/70 line-clamp-1">{study.description}</p>
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-xs text-black font-medium">{study.totalDays ? `${study.totalDays} Days` : study.estimatedHours ? `${study.estimatedHours}h` : ''} · {study.difficulty || 'All Levels'}</span>
                              <span className="text-xs font-bold text-black underline">Start →</span>
                            </div>
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
        {/* VATMEBOP Accountability Chart */}
        <VatmebopChart />
      </div>

      {/* Quick Access */}
      <div className="px-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1 h-6 bg-[#FDD000] rounded-full flex-shrink-0" />
          <h2 className="text-xl font-coalition text-white uppercase tracking-widest">Popular</h2>
          <div className="flex-1 h-px bg-white/10" />
        </div>
        
        <div className="space-y-2">
          <Button 
            variant="outline"
            className="h-16 w-full flex items-center justify-between bg-[#FDD000] text-black hover:bg-yellow-400 border-2 border-black p-0 overflow-hidden rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all glow-gold"
            data-testid="button-current-challenge"
            onClick={() => setShowChallengeDialog(true)}
          >
            <div className="h-full w-16 flex-shrink-0 overflow-hidden">
              <img src={weeklyChallengeIcon} alt="Weekly Challenge" className="h-full w-full object-cover" />
            </div>
            <span className="flex-1 font-black text-sm text-black text-left px-4 uppercase tracking-wide relative z-10">Weekly Challenge</span>
            <div className="pr-4">
              <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </div>
          </Button>

          <Link href="/videos" className="block h-16 w-full flex items-center justify-between bg-[#FDD000] text-black hover:bg-yellow-400 border-2 border-black p-0 overflow-hidden rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all glow-gold" data-testid="button-watch-videos">
            <div className="h-full w-16 flex-shrink-0 overflow-hidden">
              <img src={watchVideosIcon} alt="Watch Videos" className="h-full w-full object-cover" />
            </div>
            <span className="flex-1 font-black text-sm text-black text-left px-4 uppercase tracking-wide relative z-10">Watch Videos</span>
            <div className="pr-4">
              <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </div>
          </Link>
          
          <Link href="/fitness" className="block h-16 w-full flex items-center justify-between bg-[#FDD000] text-black hover:bg-yellow-400 border-2 border-black p-0 overflow-hidden rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all glow-gold" data-testid="button-fitness">
            <div className="h-full w-16 liquid-black flex items-center justify-center flex-shrink-0">
              <Dumbbell className="w-6 h-6 text-white relative z-10" />
            </div>
            <span className="flex-1 font-black text-sm text-black text-left px-4 uppercase tracking-wide relative z-10">Fitness</span>
            <div className="pr-4">
              <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </div>
          </Link>

          <Link href="/community" className="block h-16 w-full flex items-center justify-between bg-[#FDD000] text-black hover:bg-yellow-400 border-2 border-black p-0 overflow-hidden rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all glow-gold" data-testid="button-join-discussion">
            <div className="h-full w-16 liquid-black flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-6 h-6 text-white relative z-10" />
            </div>
            <span className="flex-1 font-black text-sm text-black text-left px-4 uppercase tracking-wide relative z-10">Join Discussion</span>
            <div className="pr-4">
              <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </div>
          </Link>

          <Link href="/blog" className="block h-16 w-full flex items-center justify-between bg-[#FDD000] text-black hover:bg-yellow-400 border-2 border-black p-0 overflow-hidden rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all glow-gold" data-testid="button-blog">
            <div className="h-full w-16 liquid-black flex items-center justify-center flex-shrink-0">
              <Newspaper className="w-6 h-6 text-white relative z-10" />
            </div>
            <span className="flex-1 font-black text-sm text-black text-left px-4 uppercase tracking-wide relative z-10">Blog</span>
            <div className="pr-4">
              <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </div>
          </Link>

          <Button 
            variant="outline"
            className="h-16 w-full flex items-center justify-between bg-[#FDD000] text-black hover:bg-yellow-400 border-2 border-black p-0 overflow-hidden rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all glow-gold"
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
            className="h-16 w-full flex items-center justify-between bg-[#FDD000] text-black hover:bg-yellow-400 border-2 border-black p-0 overflow-hidden rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all glow-gold"
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
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1 h-6 bg-[#FDD000] rounded-full flex-shrink-0" />
          <h2 className="text-xl font-coalition text-white uppercase tracking-widest">Recent Activity</h2>
          <div className="flex-1 h-px bg-white/10" />
        </div>
        
        <div className="space-y-3">
          {completedCount > 0 && (
            <Card className="bg-black border-2 border-[#FDD000] rounded-sm shadow-[3px_3px_0px_0px_rgba(253,208,0,0.3)]" data-testid="activity-completed-study">
              <CardContent className="p-4 relative z-10">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-sm bg-[#FDD000] flex items-center justify-center">
                    <svg className="w-5 h-5 text-black relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-black text-white uppercase tracking-wide">
                      Completed {completedCount} {completedCount === 1 ? 'study' : 'studies'}
                    </p>
                    <p className="text-xs text-white/70 font-medium">Keep up the great work!</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          <Card className="bg-black border-2 border-[#FDD000] rounded-sm shadow-[3px_3px_0px_0px_rgba(253,208,0,0.3)]" data-testid="activity-streak">
            <CardContent className="p-4 relative z-10">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-sm bg-[#FDD000] flex items-center justify-center">
                  <svg className="w-5 h-5 text-black relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-black text-white uppercase tracking-wide">
                    {appOpenStreak}-day streak
                  </p>
                  <p className="text-xs text-white/70">Consecutive days on the app</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Share the App */}
      <div className="px-6 mb-8">
        <button
          onClick={handleShareApp}
          disabled={shareAppMutation.isPending}
          className="w-full flex items-center justify-between p-4 bg-black border-2 border-[#FDD000] rounded-sm shadow-[4px_4px_0px_0px_rgba(253,208,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(253,208,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all active:shadow-none active:translate-x-[4px] active:translate-y-[4px]"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-sm bg-[#FDD000] flex items-center justify-center flex-shrink-0">
              <Share2 className="w-5 h-5 text-black" />
            </div>
            <div className="text-left">
              <p className="text-sm font-black text-white uppercase tracking-wide leading-tight">Share the App</p>
              <p className="text-xs text-white/60 font-medium mt-0.5">Invite a brother — earn +10 rations daily</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-[#FDD000] bg-[#FDD000]/10 border border-[#FDD000]/30 px-2 py-0.5 rounded-sm">+10</span>
            <svg className="w-4 h-4 text-[#FDD000]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>
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
            <div className="flex items-center justify-between p-4 bg-ministry-gold-exact rounded-sm border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-sm bg-black flex items-center justify-center">
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
            <div className="flex items-center justify-between p-4 bg-ministry-gold-exact rounded-sm border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-sm bg-black flex items-center justify-center">
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
            <div className="flex items-center justify-between p-4 bg-ministry-gold-exact rounded-sm border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-sm bg-black flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-black text-black uppercase tracking-tight">Total Active Days</p>
                  <p className="text-sm text-black/70">Days with study activity</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-black">
                  {(user as any)?.totalActiveDays || 0}
                </p>
                <p className="text-xs text-black/70 font-bold uppercase">days</p>
              </div>
            </div>

            {/* Progress Insights */}
            <div className="liquid-black-white p-4 rounded-sm border-2 border-ministry-gold-exact shadow-[3px_3px_0px_0px_rgba(253,208,0,1)] overflow-hidden">
              <h4 className="font-black text-white mb-2 uppercase tracking-tight relative z-10">Your Journey</h4>
              <div className="space-y-2 text-sm text-white/80 relative z-10">
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
              className="w-full bg-black text-white hover:bg-gray-900 rounded-sm font-black uppercase tracking-wide border-2 border-black"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Prayer Time Dialog */}
      <Dialog open={showPrayerDialog} onOpenChange={(open) => { setShowPrayerDialog(open); if (!open) { setShowPushPrompt(false); setPendingToggle(null); } }}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md max-h-[85svh] overflow-y-auto bg-black border-2 border-[#FDD000] rounded-sm shadow-[6px_6px_0px_0px_rgba(253,208,0,0.35)] p-0">

          {/* Header */}
          <div className="relative px-5 pt-5 pb-4 border-b border-[#FDD000]/20">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-3.5 h-3.5 text-[#FDD000]" />
              <p className="text-[#FDD000] text-[9px] font-black uppercase tracking-[0.25em]">Prayer Time</p>
            </div>
            <DialogTitle className="text-white text-xl font-black tracking-tight uppercase leading-tight" style={{ fontFamily: "'Inter', sans-serif" }}>
              Start Your Prayer
            </DialogTitle>
          </div>

          <div className="px-5 py-5 space-y-5">

            {/* Duration */}
            <div>
              <label className="text-[#FDD000] text-[9px] font-black uppercase tracking-[0.2em] mb-2 block">Duration</label>
              <Select value={prayerDuration} onValueChange={setPrayerDuration}>
                <SelectTrigger className="bg-[#111111] border border-[#FDD000]/30 text-white rounded-sm h-11 focus:ring-0 focus:ring-offset-0 focus:border-[#FDD000]">
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent className="bg-[#111111] border border-[#FDD000]/40 rounded-sm text-white">
                  <SelectItem value="1" className="focus:bg-[#FDD000]/10 focus:text-white">1 minute</SelectItem>
                  <SelectItem value="3" className="focus:bg-[#FDD000]/10 focus:text-white">3 minutes</SelectItem>
                  <SelectItem value="5" className="focus:bg-[#FDD000]/10 focus:text-white">5 minutes</SelectItem>
                  <SelectItem value="10" className="focus:bg-[#FDD000]/10 focus:text-white">10 minutes</SelectItem>
                  <SelectItem value="15" className="focus:bg-[#FDD000]/10 focus:text-white">15 minutes</SelectItem>
                  <SelectItem value="20" className="focus:bg-[#FDD000]/10 focus:text-white">20 minutes</SelectItem>
                  <SelectItem value="30" className="focus:bg-[#FDD000]/10 focus:text-white">30 minutes</SelectItem>
                  <SelectItem value="60" className="focus:bg-[#FDD000]/10 focus:text-white">1 hour</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tip box */}
            <div className="bg-[#FDD000]/10 border border-[#FDD000]/20 rounded-sm p-3 flex items-start gap-2">
              <p className="text-xs text-white/60 leading-relaxed flex-1">
                <span className="text-[#FDD000] font-black">TIP —</span> Turn on Do Not Disturb mode on your phone before you begin to minimize distractions. Add <span className="text-white/80 font-semibold">Man Up God's Way</span> to your allowed apps list so you'll still receive prayer timer notifications while DND is active.
              </p>
              <button
                onClick={() => setShowDndHelpDialog(true)}
                className="flex-shrink-0 w-5 h-5 rounded-full border border-[#FDD000]/50 text-[#FDD000] text-[10px] font-black flex items-center justify-center hover:bg-[#FDD000]/20 transition-colors mt-0.5"
                aria-label="How to allow notifications in Do Not Disturb"
              >
                ?
              </button>
            </div>

            {/* Prayer Reminders section */}
            <div className="border-t border-[#FDD000]/20 pt-5">
              <div className="flex items-center gap-2 mb-1">
                <BellRing className="w-3.5 h-3.5 text-[#FDD000]" />
                <p className="text-[#FDD000] text-[9px] font-black uppercase tracking-[0.25em]">Prayer Reminders</p>
              </div>
              <p className="text-white/50 text-xs mb-4 leading-relaxed">
                Receive push notifications to remind you to pray throughout the day.
              </p>

              {/* iOS PWA warning — background notifications require the app to be installed */}
              {pushSubscribed && isIOSNotInstalled && (
                <div className="bg-amber-900/30 border border-amber-500/50 rounded-sm p-3 mb-4">
                  <div className="flex items-start gap-2.5">
                    <span className="text-amber-400 text-base leading-none mt-0.5 shrink-0">⚠</span>
                    <div className="flex-1">
                      <p className="text-amber-300 text-[11px] font-black uppercase tracking-wide mb-1">Install Required for Background Alerts</p>
                      <p className="text-amber-200/80 text-[11px] leading-relaxed">
                        On iPhone, notifications only arrive when the app is closed or your phone is locked if you've added it to your <strong className="text-amber-200">Home Screen</strong>.
                      </p>
                      <p className="text-amber-200/60 text-[11px] mt-1.5">
                        Tap the <strong className="text-amber-200">Share</strong> button in Safari, then tap <strong className="text-amber-200">Add to Home Screen</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Inline push notification prompt */}
              {showPushPrompt && (
                <div className="bg-[#FDD000]/10 border border-[#FDD000]/30 rounded-sm p-3 mb-4">
                  <div className="flex items-start gap-2.5">
                    <BellRing className="w-4 h-4 text-[#FDD000] mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-black text-white uppercase tracking-wide mb-1">Enable Notifications</p>
                      <p className="text-xs text-white/50 mb-3">
                        Prayer reminders require push notifications. Tap below to allow them.
                      </p>
                      <div className="flex gap-2">
                        <Button size="sm" className="bg-[#FDD000] text-black font-black text-xs uppercase tracking-wide rounded-sm hover:bg-[#FDD000]/90 h-8" onClick={handleEnableNotifications}>
                          Enable Now
                        </Button>
                        <Button size="sm" variant="ghost" className="text-xs text-white/50 hover:text-white hover:bg-white/10 h-8" onClick={handleDismissPushPrompt}>
                          Not Now
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Midday reminder row */}
              <div className="h-14 w-full flex items-center bg-[#FDD000] text-black border-2 border-black overflow-hidden rounded-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] mb-2">
                <div className="h-full w-12 liquid-black flex items-center justify-center shrink-0">
                  <Sun className="w-5 h-5 text-white relative z-10" />
                </div>
                <div className="flex-1 px-3">
                  <span className="font-black text-xs uppercase tracking-wide">Midday Reminder</span>
                  <p className="text-[10px] text-black/60 mt-0.5">12:00 PM every day</p>
                </div>
                <div className="pr-3">
                  <Switch checked={remindersMiddayEnabled} onCheckedChange={(v) => handleReminderToggle('midday', v)} />
                </div>
              </div>

              {/* Hourly reminders row */}
              <div className="mb-2">
                <div className="h-14 w-full flex items-center bg-[#FDD000] text-black border-2 border-black overflow-hidden rounded-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <div className="h-full w-12 liquid-black flex items-center justify-center shrink-0">
                    <RefreshCw className="w-5 h-5 text-white relative z-10" />
                  </div>
                  <div className="flex-1 px-3">
                    <span className="font-black text-xs uppercase tracking-wide">Hourly Reminders</span>
                    <p className="text-[10px] text-black/60 mt-0.5">Every hour in a set window</p>
                  </div>
                  <div className="pr-3">
                    <Switch checked={remindersHourlyEnabled} onCheckedChange={(v) => handleReminderToggle('hourly', v)} />
                  </div>
                </div>
                {remindersHourlyEnabled && (
                  <div className="mt-2 flex items-center gap-2 px-1">
                    <div className="flex-1">
                      <label className="text-[#FDD000] text-[9px] font-black uppercase tracking-[0.15em] mb-1 block">From</label>
                      <input
                        type="time"
                        value={remindersHourlyStart}
                        onChange={(e) => setRemindersHourlyStart(e.target.value)}
                        className="block w-full bg-[#111111] border border-[#FDD000]/30 rounded-sm px-2 py-1.5 text-sm text-white focus:outline-none focus:border-[#FDD000]"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[#FDD000] text-[9px] font-black uppercase tracking-[0.15em] mb-1 block">To</label>
                      <input
                        type="time"
                        value={remindersHourlyEnd}
                        onChange={(e) => setRemindersHourlyEnd(e.target.value)}
                        className="block w-full bg-[#111111] border border-[#FDD000]/30 rounded-sm px-2 py-1.5 text-sm text-white focus:outline-none focus:border-[#FDD000]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Custom times */}
              <div className="mb-4">
                <div className="h-10 w-full flex items-center mb-2">
                  <p className="text-[#FDD000] text-[9px] font-black uppercase tracking-[0.2em]">Custom Times</p>
                </div>
                {pushSupported && !pushSubscribed ? (
                  <div className="bg-[#FDD000]/10 border border-[#FDD000]/30 rounded-sm p-3">
                    <div className="flex items-start gap-2.5">
                      <BellRing className="w-4 h-4 text-[#FDD000] mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-white/60 mb-2">Enable notifications to add custom reminder times.</p>
                        <Button size="sm" className="bg-[#FDD000] text-black font-black text-xs uppercase tracking-wide rounded-sm hover:bg-[#FDD000]/90 h-8" onClick={handleEnableNotifications}>
                          Enable Now
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={newCustomTime}
                      onChange={(e) => setNewCustomTime(e.target.value)}
                      className="flex-1 bg-[#111111] border border-[#FDD000]/30 rounded-sm px-2 py-1.5 text-sm text-white focus:outline-none focus:border-[#FDD000]"
                    />
                    <Button size="sm" className="bg-[#FDD000] text-black hover:bg-[#FDD000]/90 rounded-sm h-9 px-3 font-black" onClick={addCustomTime}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                {remindersCustomTimes.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {remindersCustomTimes.map((t) => (
                      <div key={t} className="flex items-center gap-1.5 bg-[#FDD000] text-black border border-black rounded-sm px-2 py-1 text-xs font-black uppercase">
                        <span>{t}</span>
                        <button onClick={() => removeCustomTime(t)} className="text-black/50 hover:text-black">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button
                className="w-full h-11 liquid-black text-[#FDD000] border-2 border-[#FDD000] rounded-sm font-black uppercase tracking-wide text-xs shadow-[2px_2px_0px_0px_rgba(253,208,0,0.4)] hover:opacity-90"
                onClick={saveReminders}
                disabled={remindersSaving}
              >
                <span className="relative z-10">{remindersSaving ? "Saving..." : "Save Reminders"}</span>
              </Button>

              {pushSubscribed && (
                <div className="flex gap-2">
                  <Button
                    className="flex-1 h-9 bg-transparent border border-white/20 text-white/60 hover:text-white hover:border-white/40 rounded-sm font-black uppercase tracking-wide text-[10px]"
                    onClick={() => sendTestPrayerNotification(0)}
                    disabled={remindersTestSending}
                  >
                    {remindersTestSending ? "..." : "Test Now"}
                  </Button>
                  <Button
                    className="flex-1 h-9 bg-transparent border border-amber-500/40 text-amber-400/80 hover:text-amber-300 hover:border-amber-400 rounded-sm font-black uppercase tracking-wide text-[10px]"
                    onClick={() => sendTestPrayerNotification(30)}
                    disabled={remindersTestSending}
                  >
                    {remindersTestSending ? "..." : "Test in 30s"}
                  </Button>
                </div>
              )}
            </div>

            {/* Start / Cancel buttons */}
            <div className="border-t border-[#FDD000]/20 pt-5 flex gap-3">
              <Button
                className="flex-1 h-12 bg-transparent border border-white/20 text-white/70 hover:text-white hover:bg-white/5 rounded-sm font-black uppercase tracking-wide text-xs"
                onClick={() => setShowPrayerDialog(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 h-12 bg-[#FDD000] text-black hover:bg-[#FDD000]/90 rounded-sm font-black uppercase tracking-wide text-xs shadow-[2px_2px_0px_0px_rgba(253,208,0,0.4)]"
                onClick={startPrayerTime}
              >
                Start Prayer
              </Button>
            </div>

          </div>
        </DialogContent>
      </Dialog>

      {/* Prayer Time Overlay — full black, blocks all interaction */}
      {isPraying && (
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center select-none">
          <div className="text-center text-white space-y-10 px-8">
            <p className="text-white/40 text-xs font-black uppercase tracking-[0.25em]">Prayer Time</p>

            <div className="text-8xl font-mono font-thin tracking-tight">
              {formatTime(prayerTimeLeft)}
            </div>

            <button
              onClick={() => endPrayerTime(false)}
              className="mt-4 px-8 py-3 border border-white/20 rounded-sm text-white/60 hover:text-white hover:border-white/50 text-xs font-black uppercase tracking-[0.18em] transition-colors"
            >
              End Prayer Time
            </button>
          </div>
        </div>
      )}

      {/* Full Devotional Modal */}
      <Dialog open={showFullDevotional} onOpenChange={(open) => { if (!open) handleDevotionalClose(); }}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md max-h-[88svh] flex flex-col liquid-header border-2 border-[#FDD000] rounded-sm shadow-[6px_6px_0px_0px_rgba(253,208,0,0.4)] p-0 overflow-hidden">
          {/* Sticky Header */}
          <div className="relative flex-shrink-0 p-5 pb-4">
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#FDD000] to-transparent" />
            <DialogHeader>
              <p className="text-[#FDD000] text-[10px] font-black uppercase tracking-[0.2em] mb-1.5 relative z-10">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
              <DialogTitle className="text-white text-xl font-black tracking-tight leading-tight relative z-10">
                {devotional?.title}
              </DialogTitle>
            </DialogHeader>
          </div>
          
          {/* Scrollable content */}
          {devotional && (
            <div className="flex-1 overflow-y-auto overscroll-contain p-4 pt-3 space-y-3" style={{ WebkitOverflowScrolling: 'touch' }}>
              {/* Full Image */}
              {devotional.imageUrl && (
                <div className="overflow-hidden border-2 border-black rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                  <img 
                    src={devotional.imageUrl} 
                    alt={devotional.title}
                    className="w-full h-44 object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
              
              {/* Verse block */}
              <div className="relative bg-[#FDD000] border-2 border-black rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <span className="absolute -top-4 left-2 text-black/10 font-serif select-none pointer-events-none" style={{ fontSize: '7rem', lineHeight: 1 }}>"</span>
                <div className="relative z-10 p-4 pb-3">
                  <p className="text-black text-base font-semibold leading-relaxed italic">
                    "{devotional.verse}"
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <div className="h-px flex-1 bg-black/25" />
                    <p className="text-black font-black text-[11px] uppercase tracking-[0.15em]">
                      {devotional.verseReference}
                    </p>
                    <div className="h-px flex-1 bg-black/25" />
                  </div>
                </div>
              </div>
              
              {/* Content */}
              <div className="bg-white border-2 border-black rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] p-5 space-y-4">
                {devotional.content.split(/\n\n+/).map((para: string, i: number) => (
                  <p key={i} className="text-gray-800 text-[15px] leading-[1.8]">
                    {para.trim()}
                  </p>
                ))}
              </div>

              {/* Reflection Section */}
              <div className="bg-zinc-900 border-2 border-zinc-700 rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-ministry-gold-exact flex-shrink-0" />
                  <p className="text-white font-black text-xs uppercase tracking-wide">Your Reflection</p>
                  {!reflectionSubmitted && (
                    <span className="text-xs text-zinc-500 ml-auto">+5 rations</span>
                  )}
                </div>
                {reflectionSubmitted ? (
                  <div className="flex items-center gap-2 py-2">
                    <div className="w-6 h-6 bg-green-700 rounded-full flex items-center justify-center flex-shrink-0">
                      <Star className="w-3 h-3 text-white" />
                    </div>
                    <p className="text-green-400 text-sm font-semibold">Reflection submitted. Well done, soldier.</p>
                  </div>
                ) : (
                  <>
                    <textarea
                      value={reflectionText}
                      onChange={(e) => setReflectionText(e.target.value)}
                      placeholder="What stood out to you today? How will you apply this to your life? (min. 50 characters)"
                      className="w-full bg-zinc-800 border border-zinc-600 rounded-sm text-white text-sm p-3 resize-none placeholder:text-zinc-500 focus:outline-none focus:border-ministry-gold-exact"
                      rows={4}
                    />
                    <div className="flex items-center justify-between">
                      <span className={`text-xs ${reflectionText.length >= 50 ? 'text-green-400' : 'text-zinc-500'}`}>
                        {reflectionText.length}/50 min
                      </span>
                      <Button
                        size="sm"
                        disabled={reflectionText.trim().length < 50 || submitReflectionMutation.isPending}
                        onClick={() => submitReflectionMutation.mutate(reflectionText.trim())}
                        className="bg-ministry-gold-exact text-black hover:bg-yellow-400 rounded-sm border border-black font-black uppercase text-xs disabled:opacity-40"
                      >
                        {submitReflectionMutation.isPending ? "Submitting..." : "Submit Reflection"}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Sticky Footer — always visible */}
          {devotional && (
            <div className="flex-shrink-0 border-t border-[#FDD000]/30 p-3 bg-black">
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-sm border-2 border-black font-bold uppercase text-xs ${
                    isLiked 
                      ? 'bg-red-500 text-white hover:bg-red-600' 
                      : 'bg-gray-800 text-white hover:bg-gray-700'
                  }`}
                  onClick={() => {
                    if (!user) return;
                    toggleSaveMutation.mutate(undefined, {
                      onSuccess: (data) => {
                        toast({
                          title: data.isSaved ? "Devotional Saved" : "Removed from Saved",
                          description: data.isSaved ? "You can find it in your Profile under Saved Devotionals." : "Removed from your saved devotionals.",
                        });
                      },
                    });
                  }}
                >
                  <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                  <span>{isLiked ? 'Saved' : 'Save'}</span>
                </Button>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="flex-1 flex items-center justify-center gap-1.5 bg-gray-800 text-white hover:bg-gray-700 rounded-sm border-2 border-black font-bold uppercase text-xs"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Share</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent side="top" className="w-72 p-3 bg-black border-2 border-ministry-gold-exact rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <button
                          onClick={() => handleNativeShare(devotional)}
                          disabled={isSharing}
                          className="block w-full p-3 bg-ministry-gold-exact text-black rounded-sm hover:bg-yellow-400 transition-colors font-bold text-sm uppercase disabled:opacity-50"
                          data-testid="share-with-image"
                        >
                          {isSharing ? '⏳ Sharing...' : '📤 Share with Image'}
                        </button>
                        <button
                          onClick={() => handleSaveImage(devotional)}
                          className="block w-full p-2 bg-gray-700 text-white text-center rounded-sm hover:bg-gray-600 transition-colors font-bold text-xs uppercase"
                          data-testid="download-image"
                        >
                          📥 Save Image
                        </button>
                      </div>
                      <div className="border-t border-gray-700 pt-2">
                        <p className="text-xs text-gray-400 mb-2 text-center">Share on social:</p>
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={async () => {
                              // Step 1 (done first — must run while the original tap gesture is active):
                              // Copy devotional text to clipboard
                              const postText = `${devotional.title}\n\n${devotional.content}\n\n📖 Man Up God's Way | https://app.manupgodsway.org`;
                              try {
                                await navigator.clipboard.writeText(postText);
                              } catch {
                                // Fallback for browsers that block Clipboard API
                                try {
                                  const ta = document.createElement('textarea');
                                  ta.value = postText;
                                  ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
                                  document.body.appendChild(ta);
                                  ta.focus();
                                  ta.select();
                                  document.execCommand('copy');
                                  document.body.removeChild(ta);
                                } catch {}
                              }

                              // Step 2: Save image to photos via native share sheet
                              // (done after clipboard — iOS loses gesture context once share sheet opens)
                              try {
                                const response = await fetch(`/api/devotionals/${devotional.id}/share-image`);
                                if (!response.ok) throw new Error('Failed to fetch image');
                                const blob = await response.blob();
                                const file = new File([blob], 'manupgodsway-devotional.png', { type: 'image/png' });

                                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                                  // iOS/Android: opens native share sheet → tap "Save Image"
                                  await navigator.share({ files: [file] });
                                } else {
                                  // Desktop: trigger download
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = 'manupgodsway-devotional.png';
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                  URL.revokeObjectURL(url);
                                }
                              } catch (e: any) {
                                // If user cancelled the share sheet, stop the flow
                                if (e.name === 'AbortError') return;
                              }

                              // Step 3: Open Facebook app if installed, else fall back to browser
                              toast({
                                title: "Ready to post on Facebook!",
                                description: "Image saved & text copied. Paste the text and upload the image you just saved.",
                                duration: 7000,
                              });
                              // Try the Facebook app deep link first
                              const fbAppLink = document.createElement('a');
                              fbAppLink.href = 'fb://composer';
                              fbAppLink.style.display = 'none';
                              document.body.appendChild(fbAppLink);
                              fbAppLink.click();
                              document.body.removeChild(fbAppLink);
                              // If the app opened, the page goes hidden — cancel the fallback
                              // If still visible after 1.5s, app isn't installed — open the browser
                              const onVisibilityChange = () => {
                                if (document.hidden) {
                                  clearTimeout(fallbackTimer);
                                  document.removeEventListener('visibilitychange', onVisibilityChange);
                                }
                              };
                              const fallbackTimer = setTimeout(() => {
                                document.removeEventListener('visibilitychange', onVisibilityChange);
                                window.open('https://www.facebook.com', '_blank', 'noopener,noreferrer');
                              }, 1500);
                              document.addEventListener('visibilitychange', onVisibilityChange);
                            }}
                            className="p-2 bg-[#1877F2] text-white rounded-sm hover:opacity-80 transition-opacity"
                            data-testid="share-facebook"
                          >
                            <SiFacebook className="w-5 h-5" />
                          </button>
                          <button
                            onClick={async () => {
                              const maxLen = 233;
                              const raw = devotional.content;
                              const tweetText = raw.length > maxLen ? raw.substring(0, maxLen - 1) + '…' : raw;
                              const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent('https://app.manupgodsway.org')}`;

                              // Open a blank window NOW while still inside the tap gesture —
                              // browsers block window.open() after any await
                              const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                              const twitterWin = !isMobile ? window.open('', '_blank') : null;

                              // Step 1: Save image (native share sheet on mobile, download on desktop)
                              try {
                                const response = await fetch(`/api/devotionals/${devotional.id}/share-image`);
                                if (!response.ok) throw new Error('Failed to fetch image');
                                const blob = await response.blob();
                                const file = new File([blob], 'manupgodsway-devotional.png', { type: 'image/png' });
                                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                                  await navigator.share({ files: [file] });
                                } else {
                                  const dlUrl = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = dlUrl;
                                  a.download = 'manupgodsway-devotional.png';
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                  URL.revokeObjectURL(dlUrl);
                                }
                              } catch (e: any) {
                                if (e.name === 'AbortError') {
                                  twitterWin?.close();
                                  return;
                                }
                              }

                              // Step 2: Open Twitter — app on mobile, browser tab on desktop
                              toast({
                                title: "Image saved!",
                                description: "Attach the saved image in your tweet before posting.",
                                duration: 8000,
                              });

                              if (isMobile) {
                                // Try Twitter app deep link; fall back to browser after 1.5s
                                const appLink = document.createElement('a');
                                appLink.href = `twitter://post?message=${encodeURIComponent(tweetText + ' https://app.manupgodsway.org')}`;
                                appLink.style.display = 'none';
                                document.body.appendChild(appLink);
                                appLink.click();
                                document.body.removeChild(appLink);
                                const onVis = () => {
                                  if (document.hidden) {
                                    clearTimeout(fallback);
                                    document.removeEventListener('visibilitychange', onVis);
                                  }
                                };
                                const fallback = setTimeout(() => {
                                  document.removeEventListener('visibilitychange', onVis);
                                  window.open(twitterIntentUrl, '_blank', 'noopener,noreferrer');
                                }, 1500);
                                document.addEventListener('visibilitychange', onVis);
                              } else {
                                // Desktop: redirect the pre-opened blank tab
                                if (twitterWin) {
                                  twitterWin.location.href = twitterIntentUrl;
                                } else {
                                  window.open(twitterIntentUrl, '_blank', 'noopener,noreferrer');
                                }
                              }
                            }}
                            className="p-2 bg-black text-white border border-white rounded-sm hover:opacity-80 transition-opacity"
                            data-testid="share-twitter"
                          >
                            <SiX className="w-5 h-5" />
                          </button>
                          <button
                            onClick={async () => {
                              const waText = `${devotional.title}\n\n${devotional.content}\n\n📖 Man Up God's Way | https://app.manupgodsway.org`;
                              try {
                                const response = await fetch(`/api/devotionals/${devotional.id}/share-image`);
                                if (!response.ok) throw new Error('Failed to fetch image');
                                const blob = await response.blob();
                                const file = new File([blob], 'manupgodsway-devotional.png', { type: 'image/png' });
                                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                                  // Native share sheet: user picks WhatsApp → receives image + text together
                                  await navigator.share({ files: [file], text: waText });
                                  return;
                                }
                              } catch (e: any) {
                                if (e.name === 'AbortError') return;
                              }
                              // Desktop fallback: text-only via WhatsApp Web
                              window.open(
                                `https://wa.me/?text=${encodeURIComponent(waText)}`,
                                '_blank',
                                'noopener,noreferrer'
                              );
                            }}
                            className="p-2 bg-[#25D366] text-white rounded-sm hover:opacity-80 transition-opacity"
                            data-testid="share-whatsapp"
                          >
                            <SiWhatsapp className="w-5 h-5" />
                          </button>
                          <button
                            onClick={async () => {
                              const subject = devotional.title;
                              const body = `${devotional.title}\n\n${devotional.content}\n\n📖 Man Up God's Way | https://app.manupgodsway.org`;
                              try {
                                const response = await fetch(`/api/devotionals/${devotional.id}/share-image`);
                                if (!response.ok) throw new Error('Failed to fetch image');
                                const blob = await response.blob();
                                const file = new File([blob], 'manupgodsway-devotional.png', { type: 'image/png' });
                                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                                  // Native share sheet: user picks Mail → image attaches automatically
                                  await navigator.share({ files: [file], text: body, title: subject });
                                  return;
                                }
                              } catch (e: any) {
                                if (e.name === 'AbortError') return;
                              }
                              // Desktop fallback: mailto (text only — browsers cannot attach files via mailto)
                              window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                            }}
                            className="p-2 bg-gray-600 text-white rounded-sm hover:opacity-80 transition-opacity"
                            data-testid="share-email"
                          >
                            <Mail className="w-5 h-5" />
                          </button>
                          <button
                            onClick={async () => {
                              const copyText = `${devotional.title}\n\n${devotional.content}\n\n📖 Man Up God's Way | https://app.manupgodsway.org`;

                              // Copy text to clipboard first (must be synchronous / before any await on iOS)
                              try {
                                await navigator.clipboard.writeText(copyText);
                              } catch {
                                try {
                                  const ta = document.createElement('textarea');
                                  ta.value = copyText;
                                  ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
                                  document.body.appendChild(ta);
                                  ta.focus();
                                  ta.select();
                                  document.execCommand('copy');
                                  document.body.removeChild(ta);
                                } catch {}
                              }

                              // Save image via native share sheet (mobile) or download (desktop)
                              try {
                                const response = await fetch(`/api/devotionals/${devotional.id}/share-image`);
                                if (!response.ok) throw new Error('Failed to fetch image');
                                const blob = await response.blob();
                                const file = new File([blob], 'manupgodsway-devotional.png', { type: 'image/png' });
                                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                                  await navigator.share({ files: [file] });
                                } else {
                                  const dlUrl = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = dlUrl;
                                  a.download = 'manupgodsway-devotional.png';
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                  URL.revokeObjectURL(dlUrl);
                                }
                                toast({ title: "Copied & image saved!", description: "Paste the text and attach the image wherever you need." });
                              } catch (e: any) {
                                if (e.name === 'AbortError') {
                                  toast({ title: "Text copied!", description: "Devotional text copied to clipboard." });
                                  return;
                                }
                                toast({ title: "Text copied!", description: "Devotional text copied to clipboard." });
                              }
                            }}
                            className="p-2 bg-gray-700 text-white rounded-sm hover:opacity-80 transition-opacity"
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
                  onClick={handleDevotionalClose}
                  className="flex-1 bg-ministry-gold-exact text-black hover:bg-yellow-400 rounded-sm border-2 border-black font-black uppercase text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
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
        <DialogContent className="max-w-2xl liquid-header border-2 border-ministry-gold-exact rounded-sm">
          <DialogHeader className="p-4 -m-6 mb-4 border-b-2 border-ministry-gold-exact">
            <DialogTitle className="flex items-center space-x-2 relative z-10">
              <Target className="w-5 h-5 text-ministry-gold-exact" />
              <span className="text-white font-bold uppercase tracking-tight">This Week's Challenge</span>
            </DialogTitle>
          </DialogHeader>
          
          {currentChallenge && (() => {
            const challenge = currentChallenge as any;
            const releaseDate = new Date(challenge.releaseDate);
            const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            const checkedDays = new Set((dailyCheckins || []).map((c: any) => c.dayNumber));
            const totalChecked = checkedDays.size;
            const isAllDone = challengeStatus?.hasCompleted || totalChecked >= 7;

            // Which day of the week is "today" relative to this challenge (1-7)
            const now = new Date();
            const msPerDay = 24 * 60 * 60 * 1000;
            const todayDayNum = Math.min(7, Math.max(1, Math.floor((now.getTime() - releaseDate.getTime()) / msPerDay) + 1));

            return (
              <div className="space-y-4">
                {/* Challenge info */}
                <div className="bg-black border border-[#FDD000]/30 rounded-sm p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-[#FDD000] font-bold uppercase tracking-wide">
                      Week of {formatLocalDate(releaseDate, { month: 'short', day: 'numeric' })}
                    </span>
                    {challenge.topic && (
                      <span className="text-xs text-white/50 capitalize">{challenge.topic}</span>
                    )}
                  </div>
                  <h3 className="text-base font-black text-white uppercase tracking-tight mb-2">{challenge.title}</h3>
                  <p className="text-sm text-white/70 leading-relaxed">{challenge.description}</p>
                </div>

                {/* 7-Day Check-in Grid */}
                <div className="bg-black border-2 border-[#FDD000] rounded-sm p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-black text-white uppercase tracking-widest">Daily Check-in</span>
                    <span className="text-xs font-bold text-[#FDD000]">{totalChecked}/7 Days</span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2 bg-white/10 rounded-full mb-4 overflow-hidden">
                    <div
                      className="h-full bg-[#FDD000] rounded-full transition-all duration-500"
                      style={{ width: `${(totalChecked / 7) * 100}%` }}
                    />
                  </div>

                  {/* Day tiles */}
                  <div className="grid grid-cols-7 gap-1.5">
                    {dayLabels.map((label, i) => {
                      const dayNum = i + 1;
                      const isChecked = checkedDays.has(dayNum);
                      const isFuture = dayNum > todayDayNum;
                      return (
                        <button
                          key={dayNum}
                          disabled={isChecked || isFuture || isAllDone || checkinMutation.isPending}
                          onClick={() => checkinMutation.mutate({ challengeId: challenge.id, dayNumber: dayNum })}
                          className={`flex flex-col items-center justify-center rounded-sm py-2 transition-all border-2 ${
                            isChecked
                              ? 'bg-[#FDD000] border-[#FDD000] text-black'
                              : isFuture
                              ? 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed'
                              : 'bg-black border-white/20 text-white hover:border-[#FDD000] active:scale-95 cursor-pointer'
                          }`}
                        >
                          <span className="text-[10px] font-bold uppercase">{label}</span>
                          <span className="text-sm font-black mt-0.5">
                            {isChecked ? '✓' : dayNum}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Completion banner */}
                  {isAllDone && (
                    <div className="mt-4 bg-[#FDD000] rounded-sm p-3 text-center">
                      <p className="text-black font-black text-sm uppercase tracking-wide">🏆 Challenge Complete! Rations Earned!</p>
                    </div>
                  )}

                  {/* Rations info */}
                  {!isAllDone && (
                    <p className="text-xs text-white/40 text-center mt-3">
                      +30 rations per day · +{challenge.completionReward || 200} rations when complete
                    </p>
                  )}
                </div>

                {/* Participant count */}
                <div className="flex items-center gap-2 px-1">
                  <Users className="w-4 h-4 text-[#FDD000]" />
                  <span className="text-xs text-white/60">
                    {(challengeParticipants as any)?.count || 0} {((challengeParticipants as any)?.count || 0) === 1 ? 'brother' : 'brothers'} in this challenge
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-2">
                  <Button variant="outline" onClick={() => setShowChallengeDialog(false)}>
                    Close
                  </Button>
                  <Link href="/challenges">
                    <Button className="bg-ministry-navy hover:bg-ministry-steel text-white" onClick={() => setShowChallengeDialog(false)}>
                      View All Challenges
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })()}
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

      {/* DND Allow-List Help Dialog */}
      <Dialog open={showDndHelpDialog} onOpenChange={setShowDndHelpDialog}>
        <DialogContent className="max-w-sm bg-[#0d0d0d] border-2 border-[#FDD000] rounded-sm p-0 overflow-hidden">
          <div className="bg-[#FDD000] px-4 py-3 flex items-center gap-2">
            <span className="text-black font-black text-sm uppercase tracking-wide">Allow Notifications in DND Mode</span>
          </div>
          <div className="px-4 py-4 space-y-5 text-white/80 text-sm">
            {/* iPhone */}
            <div>
              <p className="text-[#FDD000] font-black text-xs uppercase tracking-widest mb-2">iPhone (iOS)</p>
              <ol className="space-y-1.5 text-xs text-white/70 leading-relaxed list-none">
                <li><span className="text-white font-semibold">1.</span> Open <span className="text-white font-semibold">Settings</span> → <span className="text-white font-semibold">Focus</span> → <span className="text-white font-semibold">Do Not Disturb</span></li>
                <li><span className="text-white font-semibold">2.</span> Tap <span className="text-white font-semibold">Apps</span> under "Allowed Notifications"</li>
                <li><span className="text-white font-semibold">3.</span> Tap <span className="text-white font-semibold">Add App</span> and search for <span className="text-white font-semibold">Man Up God's Way</span></li>
                <li><span className="text-white font-semibold">4.</span> Tap the app to add it to your allowed list</li>
              </ol>
            </div>

            <div className="border-t border-white/10" />

            {/* Android */}
            <div>
              <p className="text-[#FDD000] font-black text-xs uppercase tracking-widest mb-2">Android</p>
              <ol className="space-y-1.5 text-xs text-white/70 leading-relaxed list-none">
                <li><span className="text-white font-semibold">1.</span> Open <span className="text-white font-semibold">Settings</span> → <span className="text-white font-semibold">Notifications</span> → <span className="text-white font-semibold">Do Not Disturb</span></li>
                <li><span className="text-white font-semibold">2.</span> Tap <span className="text-white font-semibold">Exceptions</span> or <span className="text-white font-semibold">Apps</span> (wording varies by device)</li>
                <li><span className="text-white font-semibold">3.</span> Tap <span className="text-white font-semibold">Add Apps</span> and find <span className="text-white font-semibold">Man Up God's Way</span></li>
                <li><span className="text-white font-semibold">4.</span> Enable notifications for the app and tap <span className="text-white font-semibold">Done</span></li>
              </ol>
            </div>

            <p className="text-xs text-white/40 italic leading-relaxed">
              Note: exact menu names may differ slightly depending on your device model and OS version.
            </p>
          </div>
          <div className="px-4 pb-4">
            <button
              onClick={() => setShowDndHelpDialog(false)}
              className="w-full h-10 bg-[#FDD000] text-black font-black text-xs uppercase tracking-wide rounded-sm hover:opacity-90 transition-opacity"
            >
              Got It
            </button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
