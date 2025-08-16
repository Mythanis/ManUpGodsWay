import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ProgressCard from "@/components/progress-card";
import { NotificationPanel } from "@/components/notification-panel";
import { formatLocalDate, formatLocalDateTime } from "@/lib/utils";
import { Bell, Play, Users, BarChart3, Clock, Heart, Share2, X, PauseCircle, TrendingUp, Calendar, Target, Star } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function Dashboard() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showFullDevotional, setShowFullDevotional] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [showPrayerDialog, setShowPrayerDialog] = useState(false);
  const [prayerDuration, setPrayerDuration] = useState("5");
  const [isPraying, setIsPraying] = useState(false);
  const [prayerTimeLeft, setPrayerTimeLeft] = useState(0);
  const [showProgressDialog, setShowProgressDialog] = useState(false);

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

  const { data: devotional } = useQuery({
    queryKey: ["/api/devotionals/today"],
    retry: false,
  });

  const { data: progress = [] } = useQuery({
    queryKey: ["/api/progress"],
    retry: false,
  });

  const { data: featuredStudy } = useQuery({
    queryKey: ["/api/studies/featured"],
    retry: false,
  });

  const { data: recommendedStudies = [] } = useQuery({
    queryKey: ["/api/studies/recommendations", { limit: 3 }],
    queryFn: async () => {
      const response = await fetch('/api/studies/recommendations?limit=3', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch recommended studies');
      return response.json();
    },
    retry: false,
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ministry-navy"></div>
      </div>
    );
  }

  const currentStudy = progress.find((p: any) => !p.isCompleted);
  const completedCount = progress.filter((p: any) => p.isCompleted).length;

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
            ? "text-ministry-gold fill-current"
            : "text-gray-300"
        }`}
      />
    ));
  };

  return (
    <div className="pb-20">
      {/* Header Section */}
      <div className="bg-gradient-to-br from-ministry-navy to-ministry-charcoal text-white px-6 pt-12 pb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-greeting">
              Good Morning, {user?.firstName || 'Brother'}
            </h1>
            <p className="text-blue-200 text-sm" data-testid="text-motivation">
              Ready to grow in God's strength?
            </p>
          </div>
          <div className="relative">
            <NotificationPanel />
          </div>
        </div>
        
        {/* Subscription Banner */}
        {user?.subscriptionTier === 'free' && (
          <div className="bg-ministry-gold/90 text-ministry-navy rounded-xl p-4 mb-4" data-testid="banner-subscription">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Upgrade to Premium</h3>
                <p className="text-xs opacity-80">Unlock all studies & community features</p>
              </div>
              <Button 
                className="bg-ministry-navy text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-ministry-charcoal"
                data-testid="button-upgrade"
              >
                Upgrade
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Daily Devotional Section */}
      <div className="px-6 -mt-6 relative z-10">
        <Card className="shadow-lg mb-6" data-testid="card-devotional">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-ministry-charcoal">Today's Devotional</h2>
              <span className="text-xs text-ministry-slate">
                {formatLocalDate(new Date(), { 
                  weekday: 'short', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </span>
            </div>
            
            {devotional ? (
              <>
                {/* Devotional Image */}
                {devotional.imageUrl && (
                  <div className="mb-4 rounded-lg overflow-hidden">
                    <img 
                      src={devotional.imageUrl} 
                      alt={devotional.title}
                      className="w-full h-48 object-cover"
                      onError={(e) => {
                        // Hide image if it fails to load
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
                
                <div className="bg-ministry-steel/10 rounded-lg p-4 mb-4">
                  <h3 className="text-ministry-navy font-bold text-base mb-2">{devotional.title}</h3>
                  <p className="text-ministry-navy font-semibold text-sm mb-2" data-testid="text-verse">
                    "{devotional.verse}" - {devotional.verseReference}
                  </p>
                  <p className="text-ministry-slate text-sm leading-relaxed" data-testid="text-devotional-content">
                    {devotional.content.substring(0, 120)}...
                  </p>
                </div>
                
                <div className="flex items-center justify-between">
                  <Button 
                    variant="ghost" 
                    className="text-ministry-steel font-medium text-sm hover:text-ministry-navy"
                    onClick={() => setShowFullDevotional(true)}
                    data-testid="button-read-devotional"
                  >
                    Read Full Devotional
                  </Button>
                  <div className="flex items-center space-x-2">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className={`p-2 rounded-lg transition-colors ${
                        isLiked 
                          ? 'bg-red-100 text-red-500 hover:bg-red-200' 
                          : 'bg-gray-100 hover:bg-gray-200 text-ministry-slate'
                      }`}
                      onClick={() => {
                        setIsLiked(!isLiked);
                        toast({
                          title: isLiked ? "Removed from favorites" : "Added to favorites",
                          description: isLiked ? "Devotional removed from your favorites" : "Devotional saved to your favorites",
                        });
                      }}
                      data-testid="button-like-devotional"
                    >
                      <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200"
                      onClick={() => {
                        const shareText = `${devotional.title}\n\n"${devotional.verse}" - ${devotional.verseReference}\n\n${devotional.content}`;
                        
                        if (navigator.share) {
                          navigator.share({
                            title: devotional.title,
                            text: shareText,
                            url: window.location.origin,
                          }).catch(console.error);
                        } else {
                          // Fallback: copy to clipboard
                          navigator.clipboard.writeText(shareText).then(() => {
                            toast({
                              title: "Copied to clipboard",
                              description: "Devotional text copied to clipboard for sharing",
                            });
                          });
                        }
                      }}
                      data-testid="button-share-devotional"
                    >
                      <Share2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-ministry-slate">No devotional available for today</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Featured Study Section */}
      {featuredStudy && (
        <div className="px-6 mb-6">
          <Card className="bg-gradient-to-br from-ministry-steel to-ministry-navy text-white relative overflow-hidden" data-testid="card-featured-study">
            <CardContent className="p-6">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
              <div className="relative z-10">
                <div className="inline-flex items-center bg-ministry-gold/20 text-ministry-gold px-3 py-1 rounded-full text-xs font-medium mb-3">
                  <Play className="w-3 h-3 mr-1" fill="currentColor" />
                  Featured Study
                </div>
                <h3 className="text-lg font-bold mb-2" data-testid="text-featured-study-title">
                  {featuredStudy.title}
                </h3>
                <p className="text-blue-100 text-sm mb-4" data-testid="text-featured-study-description">
                  {featuredStudy.description}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 text-xs text-blue-200">
                    <span>{featuredStudy.lessonCount} lessons</span>
                    <span>{featuredStudy.estimatedHours}h</span>
                    <span className="capitalize">{featuredStudy.difficulty}</span>
                  </div>
                  <Button 
                    className="bg-white text-ministry-navy hover:bg-gray-100"
                    data-testid="button-start-featured-study"
                    onClick={() => window.location.href = `/studies/${featuredStudy.id}`}
                  >
                    Start Study
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Current Progress Section */}
      <div className="px-6 mb-6">
        <h2 className="text-lg font-bold text-ministry-charcoal mb-4">Your Journey</h2>
        
        {currentStudy ? (
          <ProgressCard 
            study={currentStudy} 
            progress={currentStudy}
            data-testid="progress-current-study"
          />
        ) : (
          <>
            {/* No Current Study - Show Recommendations */}
            <Card className="border border-gray-100 p-6 mb-4" data-testid="card-no-current-study">
              <div className="text-center">
                <p className="text-ministry-slate mb-4">You haven't started any studies yet</p>
                <Button 
                  className="bg-ministry-navy text-white hover:bg-ministry-charcoal"
                  data-testid="button-browse-studies"
                  onClick={() => window.location.href = '/library'}
                >
                  Browse Studies
                </Button>
              </div>
            </Card>
            
            {/* Recommended Studies */}
            {recommendedStudies.length > 0 && (
              <>
                <h3 className="text-md font-semibold text-ministry-charcoal mb-3">Recommended for You</h3>
                <p className="text-xs text-ministry-slate mb-4">Based on your interests and subscription tier</p>
                <div className="space-y-3">
                  {recommendedStudies.slice(0, 3).map((study: any) => (
                    <Card key={study.id} className="border border-gray-100 hover:shadow-sm transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-ministry-charcoal text-sm mb-1">{study.title}</h4>
                            <p className="text-xs text-ministry-slate mb-2 line-clamp-2">{study.description}</p>
                            <div className="flex items-center space-x-3 text-xs text-ministry-slate mb-2">
                              <span>{study.lessonCount} lessons</span>
                              <span>{study.estimatedHours}h</span>
                              <span className="capitalize">{study.difficulty}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              {renderStars(study.rating || 0)}
                              <span className="text-xs text-ministry-slate ml-1">({study.rating || 0})</span>
                            </div>
                          </div>
                          <Button 
                            size="sm"
                            className="bg-ministry-steel text-white hover:bg-ministry-navy ml-3"
                            onClick={() => window.location.href = `/studies/${study.id}`}
                          >
                            Start
                          </Button>
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

      {/* Quick Actions */}
      <div className="px-6 mb-6">
        <h2 className="text-lg font-bold text-ministry-charcoal mb-4">Quick Access</h2>
        
        <div className="grid grid-cols-2 gap-4">
          <Button 
            variant="outline"
            className="h-20 flex flex-col items-center justify-center space-y-2 border-gray-100 hover:shadow-md"
            data-testid="button-watch-videos"
          >
            <Play className="w-8 h-8 text-ministry-steel" />
            <span className="font-medium text-sm text-ministry-charcoal">Watch Videos</span>
          </Button>
          
          <Button 
            variant="outline"
            className="h-20 flex flex-col items-center justify-center space-y-2 border-gray-100 hover:shadow-md"
            data-testid="button-join-discussion"
          >
            <Users className="w-8 h-8 text-ministry-steel" />
            <span className="font-medium text-sm text-ministry-charcoal">Join Discussion</span>
          </Button>
          
          <Button 
            variant="outline"
            className="h-20 flex flex-col items-center justify-center space-y-2 border-gray-100 hover:shadow-md"
            data-testid="button-track-progress"
            onClick={() => setShowProgressDialog(true)}
          >
            <BarChart3 className="w-8 h-8 text-ministry-steel" />
            <span className="font-medium text-sm text-ministry-charcoal">Track Progress</span>
          </Button>
          
          <Button 
            variant="outline"
            className="h-20 flex flex-col items-center justify-center space-y-2 border-gray-100 hover:shadow-md"
            data-testid="button-prayer-time"
            onClick={() => isPraying ? endPrayerTime() : setShowPrayerDialog(true)}
          >
            {isPraying ? (
              <>
                <PauseCircle className="w-8 h-8 text-ministry-steel" />
                <span className="font-medium text-sm text-ministry-charcoal">{formatTime(prayerTimeLeft)}</span>
              </>
            ) : (
              <>
                <Clock className="w-8 h-8 text-ministry-steel" />
                <span className="font-medium text-sm text-ministry-charcoal">Prayer Time</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="px-6 mb-8">
        <h2 className="text-lg font-bold text-ministry-charcoal mb-4">Recent Activity</h2>
        
        <div className="space-y-3">
          {completedCount > 0 && (
            <Card className="border-gray-100" data-testid="activity-completed-study">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-ministry-steel/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-ministry-steel" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-ministry-charcoal">
                      Completed {completedCount} {completedCount === 1 ? 'study' : 'studies'}
                    </p>
                    <p className="text-xs text-ministry-slate">Keep up the great work!</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          <Card className="border-gray-100" data-testid="activity-streak">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-ministry-gold/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-ministry-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-ministry-charcoal">
                    {user?.streakDays || 1}-day streak
                  </p>
                  <p className="text-xs text-ministry-slate">Stay consistent in your journey</p>
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
          
          <div className="space-y-6 py-4">
            {/* Completed Studies */}
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <Target className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-green-800">Studies Completed</p>
                  <p className="text-sm text-green-600">Total finished studies</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-green-800">{completedCount}</p>
                <p className="text-xs text-green-600">studies</p>
              </div>
            </div>

            {/* Current Streak */}
            <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-200">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="font-medium text-orange-800">Current Streak</p>
                  <p className="text-sm text-orange-600">Consecutive study days</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-orange-800">{user?.streakDays || 0}</p>
                <p className="text-xs text-orange-600">days</p>
              </div>
            </div>

            {/* Total Active Days */}
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-blue-800">Total Active Days</p>
                  <p className="text-sm text-blue-600">Days with study activity</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-blue-800">
                  {progress.length > 0 
                    ? new Set(progress.map((p: any) => new Date(p.lastAccessedAt || p.createdAt).toDateString())).size 
                    : 0}
                </p>
                <p className="text-xs text-blue-600">days</p>
              </div>
            </div>

            {/* Progress Insights */}
            <div className="bg-ministry-navy/5 p-4 rounded-lg border border-ministry-navy/20">
              <h4 className="font-medium text-ministry-charcoal mb-2">Your Journey</h4>
              <div className="space-y-2 text-sm text-ministry-slate">
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
                  <p>🏆 Incredible dedication! {completedCount} studies completed - you're truly growing in faith!</p>
                )}
                
                {(user?.streakDays || 0) >= 7 && (
                  <p>🔥 Amazing streak! {user?.streakDays} consecutive days of spiritual growth!</p>
                )}
              </div>
            </div>

            <Button 
              onClick={() => setShowProgressDialog(false)}
              className="w-full bg-ministry-navy text-white hover:bg-ministry-charcoal"
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
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-ministry-navy">{devotional?.title}</DialogTitle>
          </DialogHeader>
          
          {devotional && (
            <div className="space-y-4">
              {/* Full Image */}
              {devotional.imageUrl && (
                <div className="rounded-lg overflow-hidden">
                  <img 
                    src={devotional.imageUrl} 
                    alt={devotional.title}
                    className="w-full h-64 object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
              
              {/* Verse */}
              <div className="bg-ministry-steel/10 rounded-lg p-4">
                <p className="text-ministry-navy font-semibold text-base mb-2">
                  "{devotional.verse}" - {devotional.verseReference}
                </p>
              </div>
              
              {/* Full Content */}
              <div className="prose prose-sm max-w-none">
                <p className="text-ministry-slate leading-relaxed whitespace-pre-wrap">
                  {devotional.content}
                </p>
              </div>
              
              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center space-x-3">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className={`flex items-center space-x-2 ${
                      isLiked 
                        ? 'text-red-500 hover:text-red-600' 
                        : 'text-ministry-slate hover:text-ministry-navy'
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
                    <span>{isLiked ? 'Favorited' : 'Add to Favorites'}</span>
                  </Button>
                  
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="flex items-center space-x-2 text-ministry-slate hover:text-ministry-navy"
                    onClick={() => {
                      const shareText = `${devotional.title}\n\n"${devotional.verse}" - ${devotional.verseReference}\n\n${devotional.content}`;
                      
                      if (navigator.share) {
                        navigator.share({
                          title: devotional.title,
                          text: shareText,
                          url: window.location.origin,
                        }).catch(console.error);
                      } else {
                        navigator.clipboard.writeText(shareText).then(() => {
                          toast({
                            title: "Copied to clipboard",
                            description: "Devotional text copied to clipboard for sharing",
                          });
                        });
                      }
                    }}
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Share</span>
                  </Button>
                </div>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowFullDevotional(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
