import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ProgressCard from "@/components/progress-card";
import { NotificationPanel } from "@/components/notification-panel";
import { Bell, Play, Users, BarChart3, Clock, Heart, Share2, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function Dashboard() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showFullDevotional, setShowFullDevotional] = useState(false);
  const [isLiked, setIsLiked] = useState(false);

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
                {new Date().toLocaleDateString('en-US', { 
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
