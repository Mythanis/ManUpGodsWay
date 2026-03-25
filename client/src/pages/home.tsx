import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { getDefaultThumbnail } from "@/lib/default-thumbnail";
import { Bell, Play, Users, BarChart3, Clock, Heart, Share2, X, PauseCircle, TrendingUp, Calendar, Target, Star, Shield, MessageSquare, HandHeart, Mail, Link2, Newspaper, Book, Coins, BellRing, Plus, Trash2, Sun, RefreshCw } from "lucide-react";
import { SiFacebook, SiX, SiWhatsapp } from "react-icons/si";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { apiRequest } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import { usePushNotifications } from "@/hooks/use-push-notifications";

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
  const [isLiked, setIsLiked] = useState(false);
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
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [showChallengeDialog, setShowChallengeDialog] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [showHurdleWallDialog, setShowHurdleWallDialog] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showWelcomeIntro, setShowWelcomeIntro] = useState(false);
  const [appOpenStreak, setAppOpenStreak] = useState(0);

  // Push notifications hook (for reminder subscription prompting)
  const { isSupported: pushSupported, isSubscribed: pushSubscribed, subscribe: pushSubscribe } = usePushNotifications();

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
  const { data: prayerRemindersData } = useQuery<{
    hourlyEnabled: boolean;
    hourlyStartTime: string;
    hourlyEndTime: string;
    middayEnabled: boolean;
    customTimes: string[];
  }>({
    queryKey: ["/api/prayer/reminders"],
    retry: false,
    enabled: !!user,
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

  // Native share function with image
  const handleNativeShare = async (devotional: any) => {
    setIsSharing(true);
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
      });
      queryClient.invalidateQueries({ queryKey: ["/api/prayer/reminders"] });
      toast({ title: "Reminders Saved", description: "Your prayer reminders have been updated." });
    } catch {
      toast({ title: "Error", description: "Failed to save reminders.", variant: "destructive" });
    } finally {
      setRemindersSaving(false);
    }
  };

  const addCustomTime = () => {
    if (remindersCustomTimes.length >= 15) {
      toast({ title: "Limit Reached", description: "Maximum 15 custom reminder times allowed.", variant: "destructive" });
      return;
    }
    if (!remindersCustomTimes.includes(newCustomTime)) {
      setRemindersCustomTimes([...remindersCustomTimes, newCustomTime].sort());
    }
  };

  const removeCustomTime = (t: string) => {
    setRemindersCustomTimes(remindersCustomTimes.filter((x) => x !== t));
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
                <div className="bg-[#FCD000] text-black px-3 py-1 rounded-sm text-xs font-black uppercase tracking-wide border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:bg-[#e6bc00] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center gap-1">
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
        {(user as any)?.subscriptionStatus !== 'active' && (
          <div className="bg-[#FCD000] glow-gold text-black rounded-sm border-2 border-black p-4 mb-4 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]" data-testid="banner-subscription">
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
        
        {/* Featured Carousel */}
        <div className="mb-6">
          <HomeCarousel />
        </div>
        
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1 h-6 bg-[#FCD000] rounded-full flex-shrink-0" />
          <h2 className="text-base font-black text-white uppercase tracking-[0.18em]">Today's Devotional</h2>
          <div className="flex-1 h-px bg-white/10" />
        </div>
        <Card className="shadow-[4px_4px_0px_0px_rgba(252,208,0,1)] border-2 border-ministry-gold-exact liquid-black-white mb-6 rounded-sm overflow-hidden" data-testid="card-devotional">
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
        
        {/* Brotherhood Requests Section */}
        <BrotherhoodRequests />
      </div>

      {/* Current Progress Section */}
      <div className="px-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1 h-6 bg-[#FCD000] rounded-full flex-shrink-0" />
          <h2 className="text-base font-black text-white uppercase tracking-[0.18em]">Your Journey</h2>
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
            <Card className="border-2 border-ministry-gold-exact p-6 mb-4 liquid-black-white rounded-sm shadow-[4px_4px_0px_0px_rgba(252,208,0,1)] overflow-hidden" data-testid="card-no-current-study">
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
                  <div className="w-1 h-6 bg-[#FCD000] rounded-full flex-shrink-0" />
                  <h3 className="text-base font-black text-white uppercase tracking-[0.18em]">Recommended for You</h3>
                  <div className="flex-1 h-px bg-white/10" />
                </div>
                <p className="text-sm text-[#FCD000] mb-4 font-black uppercase tracking-wide">{completedCount > 0 ? "Continue Your Faith Journey" : "Start Your Growth Today"}</p>
                <div className="space-y-3">
                  {recommendedStudies.slice(0, 3).map((study: any) => (
                    <Card key={study.id} className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all rounded-sm overflow-hidden bg-[#FCD000]" onClick={() => navigate(`/studies/${study.id}`)} style={{ cursor: 'pointer' }}>
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
      </div>

      {/* Quick Access */}
      <div className="px-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1 h-6 bg-[#FCD000] rounded-full flex-shrink-0" />
          <h2 className="text-base font-black text-white uppercase tracking-[0.18em]">Popular</h2>
          <div className="flex-1 h-px bg-white/10" />
        </div>
        
        <div className="space-y-2">
          <Button 
            variant="outline"
            className="h-16 w-full flex items-center justify-between bg-[#FCD000] text-black hover:bg-yellow-400 border-2 border-black p-0 overflow-hidden rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all glow-gold"
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

          <Link href="/videos" className="block h-16 w-full flex items-center justify-between bg-[#FCD000] text-black hover:bg-yellow-400 border-2 border-black p-0 overflow-hidden rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all glow-gold" data-testid="button-watch-videos">
            <div className="h-full w-16 liquid-black flex items-center justify-center flex-shrink-0">
              <Play className="w-6 h-6 text-white relative z-10" />
            </div>
            <span className="flex-1 font-black text-sm text-black text-left px-4 uppercase tracking-wide relative z-10">Watch Videos</span>
            <div className="pr-4">
              <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </div>
          </Link>
          
          <Link href="/hurdle-wall" className="block h-16 w-full flex items-center justify-between bg-[#FCD000] text-black hover:bg-yellow-400 border-2 border-black p-0 overflow-hidden rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all glow-gold" data-testid="button-hurdle-wall">
            <div className="h-full w-16 liquid-black flex items-center justify-center flex-shrink-0">
              <Shield className="w-6 h-6 text-white relative z-10" />
            </div>
            <span className="flex-1 font-black text-sm text-black text-left px-4 uppercase tracking-wide relative z-10">War Room</span>
            <div className="pr-4">
              <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </div>
          </Link>

          <Link href="/community" className="block h-16 w-full flex items-center justify-between bg-[#FCD000] text-black hover:bg-yellow-400 border-2 border-black p-0 overflow-hidden rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all glow-gold" data-testid="button-join-discussion">
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

          <Link href="/blog" className="block h-16 w-full flex items-center justify-between bg-[#FCD000] text-black hover:bg-yellow-400 border-2 border-black p-0 overflow-hidden rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all glow-gold" data-testid="button-blog">
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
            className="h-16 w-full flex items-center justify-between bg-[#FCD000] text-black hover:bg-yellow-400 border-2 border-black p-0 overflow-hidden rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all glow-gold"
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
            className="h-16 w-full flex items-center justify-between bg-[#FCD000] text-black hover:bg-yellow-400 border-2 border-black p-0 overflow-hidden rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all glow-gold"
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
          <div className="w-1 h-6 bg-[#FCD000] rounded-full flex-shrink-0" />
          <h2 className="text-base font-black text-white uppercase tracking-[0.18em]">Recent Activity</h2>
          <div className="flex-1 h-px bg-white/10" />
        </div>
        
        <div className="space-y-3">
          {completedCount > 0 && (
            <Card className="bg-black border-2 border-[#FCD000] rounded-sm shadow-[3px_3px_0px_0px_rgba(252,208,0,0.3)]" data-testid="activity-completed-study">
              <CardContent className="p-4 relative z-10">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-sm bg-[#FCD000] flex items-center justify-center">
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
          
          <Card className="bg-black border-2 border-[#FCD000] rounded-sm shadow-[3px_3px_0px_0px_rgba(252,208,0,0.3)]" data-testid="activity-streak">
            <CardContent className="p-4 relative z-10">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-sm bg-[#FCD000] flex items-center justify-center">
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
            <div className="liquid-black-white p-4 rounded-sm border-2 border-ministry-gold-exact shadow-[3px_3px_0px_0px_rgba(252,208,0,1)] overflow-hidden">
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
        <DialogContent className="w-[calc(100%-2rem)] max-w-md max-h-[85svh] overflow-y-auto bg-black border-2 border-[#FCD000] rounded-sm shadow-[6px_6px_0px_0px_rgba(252,208,0,0.35)] p-0">

          {/* Header */}
          <div className="relative px-5 pt-5 pb-4 border-b border-[#FCD000]/20">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-3.5 h-3.5 text-[#FCD000]" />
              <p className="text-[#FCD000] text-[9px] font-black uppercase tracking-[0.25em]">Prayer Time</p>
            </div>
            <DialogTitle className="text-white text-xl font-black tracking-tight uppercase leading-tight" style={{ fontFamily: "'Inter', sans-serif" }}>
              Start Your Prayer
            </DialogTitle>
          </div>

          <div className="px-5 py-5 space-y-5">

            {/* Duration */}
            <div>
              <label className="text-[#FCD000] text-[9px] font-black uppercase tracking-[0.2em] mb-2 block">Duration</label>
              <Select value={prayerDuration} onValueChange={setPrayerDuration}>
                <SelectTrigger className="bg-[#111111] border border-[#FCD000]/30 text-white rounded-sm h-11 focus:ring-0 focus:ring-offset-0 focus:border-[#FCD000]">
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent className="bg-[#111111] border border-[#FCD000]/40 rounded-sm text-white">
                  <SelectItem value="1" className="focus:bg-[#FCD000]/10 focus:text-white">1 minute</SelectItem>
                  <SelectItem value="3" className="focus:bg-[#FCD000]/10 focus:text-white">3 minutes</SelectItem>
                  <SelectItem value="5" className="focus:bg-[#FCD000]/10 focus:text-white">5 minutes</SelectItem>
                  <SelectItem value="10" className="focus:bg-[#FCD000]/10 focus:text-white">10 minutes</SelectItem>
                  <SelectItem value="15" className="focus:bg-[#FCD000]/10 focus:text-white">15 minutes</SelectItem>
                  <SelectItem value="20" className="focus:bg-[#FCD000]/10 focus:text-white">20 minutes</SelectItem>
                  <SelectItem value="30" className="focus:bg-[#FCD000]/10 focus:text-white">30 minutes</SelectItem>
                  <SelectItem value="60" className="focus:bg-[#FCD000]/10 focus:text-white">1 hour</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tip box */}
            <div className="bg-[#FCD000]/10 border border-[#FCD000]/20 rounded-sm p-3">
              <p className="text-xs text-white/60 leading-relaxed">
                <span className="text-[#FCD000] font-black">TIP —</span> Turn on Do Not Disturb mode on your phone before you begin to minimize distractions.
              </p>
            </div>

            {/* Prayer Reminders section */}
            <div className="border-t border-[#FCD000]/20 pt-5">
              <div className="flex items-center gap-2 mb-1">
                <BellRing className="w-3.5 h-3.5 text-[#FCD000]" />
                <p className="text-[#FCD000] text-[9px] font-black uppercase tracking-[0.25em]">Prayer Reminders</p>
              </div>
              <p className="text-white/50 text-xs mb-4 leading-relaxed">
                Receive push notifications to remind you to pray throughout the day.
              </p>

              {/* Inline push notification prompt */}
              {showPushPrompt && (
                <div className="bg-[#FCD000]/10 border border-[#FCD000]/30 rounded-sm p-3 mb-4">
                  <div className="flex items-start gap-2.5">
                    <BellRing className="w-4 h-4 text-[#FCD000] mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-black text-white uppercase tracking-wide mb-1">Enable Notifications</p>
                      <p className="text-xs text-white/50 mb-3">
                        Prayer reminders require push notifications. Tap below to allow them.
                      </p>
                      <div className="flex gap-2">
                        <Button size="sm" className="bg-[#FCD000] text-black font-black text-xs uppercase tracking-wide rounded-sm hover:bg-[#FCD000]/90 h-8" onClick={handleEnableNotifications}>
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
              <div className="h-14 w-full flex items-center bg-[#FCD000] text-black border-2 border-black overflow-hidden rounded-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] mb-2">
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
                <div className="h-14 w-full flex items-center bg-[#FCD000] text-black border-2 border-black overflow-hidden rounded-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
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
                      <label className="text-[#FCD000] text-[9px] font-black uppercase tracking-[0.15em] mb-1 block">From</label>
                      <input
                        type="time"
                        value={remindersHourlyStart}
                        onChange={(e) => setRemindersHourlyStart(e.target.value)}
                        className="block w-full bg-[#111111] border border-[#FCD000]/30 rounded-sm px-2 py-1.5 text-sm text-white focus:outline-none focus:border-[#FCD000]"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[#FCD000] text-[9px] font-black uppercase tracking-[0.15em] mb-1 block">To</label>
                      <input
                        type="time"
                        value={remindersHourlyEnd}
                        onChange={(e) => setRemindersHourlyEnd(e.target.value)}
                        className="block w-full bg-[#111111] border border-[#FCD000]/30 rounded-sm px-2 py-1.5 text-sm text-white focus:outline-none focus:border-[#FCD000]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Custom times */}
              <div className="mb-4">
                <div className="h-10 w-full flex items-center mb-2">
                  <p className="text-[#FCD000] text-[9px] font-black uppercase tracking-[0.2em]">Custom Times</p>
                </div>
                {pushSupported && !pushSubscribed ? (
                  <div className="bg-[#FCD000]/10 border border-[#FCD000]/30 rounded-sm p-3">
                    <div className="flex items-start gap-2.5">
                      <BellRing className="w-4 h-4 text-[#FCD000] mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-white/60 mb-2">Enable notifications to add custom reminder times.</p>
                        <Button size="sm" className="bg-[#FCD000] text-black font-black text-xs uppercase tracking-wide rounded-sm hover:bg-[#FCD000]/90 h-8" onClick={handleEnableNotifications}>
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
                      className="flex-1 bg-[#111111] border border-[#FCD000]/30 rounded-sm px-2 py-1.5 text-sm text-white focus:outline-none focus:border-[#FCD000]"
                    />
                    <Button size="sm" className="bg-[#FCD000] text-black hover:bg-[#FCD000]/90 rounded-sm h-9 px-3 font-black" onClick={addCustomTime}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                {remindersCustomTimes.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {remindersCustomTimes.map((t) => (
                      <div key={t} className="flex items-center gap-1.5 bg-[#FCD000] text-black border border-black rounded-sm px-2 py-1 text-xs font-black uppercase">
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
                className="w-full h-11 liquid-black text-[#FCD000] border-2 border-[#FCD000] rounded-sm font-black uppercase tracking-wide text-xs shadow-[2px_2px_0px_0px_rgba(252,208,0,0.4)] hover:opacity-90"
                onClick={saveReminders}
                disabled={remindersSaving}
              >
                <span className="relative z-10">{remindersSaving ? "Saving..." : "Save Reminders"}</span>
              </Button>
            </div>

            {/* Start / Cancel buttons */}
            <div className="border-t border-[#FCD000]/20 pt-5 flex gap-3">
              <Button
                className="flex-1 h-12 bg-transparent border border-white/20 text-white/70 hover:text-white hover:bg-white/5 rounded-sm font-black uppercase tracking-wide text-xs"
                onClick={() => setShowPrayerDialog(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 h-12 bg-[#FCD000] text-black hover:bg-[#FCD000]/90 rounded-sm font-black uppercase tracking-wide text-xs shadow-[2px_2px_0px_0px_rgba(252,208,0,0.4)]"
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
      <Dialog open={showFullDevotional} onOpenChange={setShowFullDevotional}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md max-h-[85svh] overflow-y-auto liquid-header border-2 border-[#FCD000] rounded-sm shadow-[6px_6px_0px_0px_rgba(252,208,0,0.4)] p-0">
          {/* Header */}
          <div className="relative p-5 pb-4">
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#FCD000] to-transparent" />
            <DialogHeader>
              <p className="text-[#FCD000] text-[10px] font-black uppercase tracking-[0.2em] mb-1.5 relative z-10">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
              <DialogTitle className="text-white text-xl font-black tracking-tight leading-tight relative z-10">
                {devotional?.title}
              </DialogTitle>
            </DialogHeader>
          </div>
          
          {devotional && (
            <div className="p-4 pt-3 space-y-3">
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
              <div className="relative bg-[#FCD000] border-2 border-black rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                {/* Decorative quote mark */}
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
              
              {/* Content — white background for easy reading */}
              <div className="bg-white border-2 border-black rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] p-5 space-y-4">
                {devotional.content.split(/\n\n+/).map((para: string, i: number) => (
                  <p key={i} className="text-gray-800 text-[15px] leading-[1.8]">
                    {para.trim()}
                  </p>
                ))}
              </div>
              
              {/* Actions */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-white/20">
                <Button 
                  variant="outline" 
                  size="sm"
                  className={`flex items-center justify-center space-x-2 rounded-sm border-2 border-black font-bold uppercase text-xs ${
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
                      className="flex items-center justify-center space-x-2 bg-gray-800 text-white hover:bg-gray-700 rounded-sm border-2 border-black font-bold uppercase text-xs"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Share</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-3 bg-black border-2 border-ministry-gold-exact rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
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
                        <a
                          href={`/api/devotionals/${devotional.id}/share-image`}
                          download={`manupgodsway-devotional-${devotional.id}.png`}
                          className="block w-full p-2 bg-gray-700 text-white text-center rounded-sm hover:bg-gray-600 transition-colors font-bold text-xs uppercase"
                          data-testid="download-image"
                        >
                          📥 Download Image
                        </a>
                        <p className="text-xs text-gray-400 text-center">⬆️ For Facebook: Download image first, then attach it to your Facebook post</p>
                      </div>
                      <div className="border-t border-gray-700 pt-2">
                        <p className="text-xs text-gray-400 mb-2 text-center">Share text only:</p>
                        <div className="flex gap-2 justify-center">
                          <a
                            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://www.manupgodsway.org')}&quote=${encodeURIComponent(`${devotional.title}\n\n"${devotional.verse}" - ${devotional.verseReference}\n\nDownload the app: www.manupgodsway.org`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-[#1877F2] text-white rounded-sm hover:opacity-80 transition-opacity"
                            data-testid="share-facebook"
                          >
                            <SiFacebook className="w-5 h-5" />
                          </a>
                          <a
                            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${devotional.title}\n\n"${devotional.verse}" - ${devotional.verseReference}\n\n📲 Download the app: www.manupgodsway.org`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-black text-white border border-white rounded-sm hover:opacity-80 transition-opacity"
                            data-testid="share-twitter"
                          >
                            <SiX className="w-5 h-5" />
                          </a>
                          <a
                            href={`https://wa.me/?text=${encodeURIComponent(`${devotional.title}\n\n"${devotional.verse}" - ${devotional.verseReference}\n\n📲 Download the app: www.manupgodsway.org`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-[#25D366] text-white rounded-sm hover:opacity-80 transition-opacity"
                            data-testid="share-whatsapp"
                          >
                            <SiWhatsapp className="w-5 h-5" />
                          </a>
                          <a
                            href={`mailto:?subject=${encodeURIComponent(devotional.title)}&body=${encodeURIComponent(`${devotional.title}\n\n"${devotional.verse}" - ${devotional.verseReference}\n\n${devotional.content}\n\n📲 Download the app: www.manupgodsway.org`)}`}
                            className="p-2 bg-gray-600 text-white rounded-sm hover:opacity-80 transition-opacity"
                            data-testid="share-email"
                          >
                            <Mail className="w-5 h-5" />
                          </a>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(`${devotional.title}\n\n"${devotional.verse}" - ${devotional.verseReference}\n\nwww.manupgodsway.org`);
                              toast({ title: "Copied!", description: "Devotional text copied to clipboard" });
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
                  onClick={() => setShowFullDevotional(false)}
                  className="bg-ministry-gold-exact text-black hover:bg-yellow-400 rounded-sm border-2 border-black font-black uppercase text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
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
          
          {currentChallenge && (
            <div className="space-y-4">
              {/* Challenge Header */}
              <div className="bg-black text-white p-6 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="inline-flex items-center bg-ministry-gold-exact text-black px-3 py-1 rounded-full text-xs font-bold">
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
                
                <h3 className="text-xl font-bold mb-3 capitalize">
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
