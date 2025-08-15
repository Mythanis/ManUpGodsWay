import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ProgressCard from "@/components/progress-card";
import { NotificationPanel } from "@/components/notification-panel";
import { Bell, Play, Users, BarChart3, Clock } from "lucide-react";

export default function Dashboard() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();

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

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ministry-navy"></div>
      </div>
    );
  }

  const currentStudy = progress.find((p: any) => !p.isCompleted);
  const completedCount = progress.filter((p: any) => p.isCompleted).length;

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
                Day {user?.streakDays || 1}
              </span>
            </div>
            
            {devotional ? (
              <>
                <div className="bg-ministry-steel/10 rounded-lg p-4 mb-4">
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
                    data-testid="button-read-devotional"
                  >
                    Read Full Devotional
                  </Button>
                  <div className="flex items-center space-x-2">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200"
                      data-testid="button-like-devotional"
                    >
                      <svg className="w-4 h-4 text-ministry-slate" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
                      </svg>
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200"
                      data-testid="button-share-devotional"
                    >
                      <svg className="w-4 h-4 text-ministry-slate" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"></path>
                      </svg>
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
          <Card className="border border-gray-100 p-6" data-testid="card-no-current-study">
            <div className="text-center">
              <p className="text-ministry-slate mb-4">You haven't started any studies yet</p>
              <Button 
                className="bg-ministry-navy text-white hover:bg-ministry-charcoal"
                data-testid="button-browse-studies"
              >
                Browse Studies
              </Button>
            </div>
          </Card>
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
          >
            <BarChart3 className="w-8 h-8 text-ministry-steel" />
            <span className="font-medium text-sm text-ministry-charcoal">Track Progress</span>
          </Button>
          
          <Button 
            variant="outline"
            className="h-20 flex flex-col items-center justify-center space-y-2 border-gray-100 hover:shadow-md"
            data-testid="button-prayer-time"
          >
            <Clock className="w-8 h-8 text-ministry-steel" />
            <span className="font-medium text-sm text-ministry-charcoal">Prayer Time</span>
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
    </div>
  );
}
