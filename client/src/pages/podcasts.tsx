import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { LiveStreamBanner } from "@/components/live-stream-banner";
import { LiveStreamSetupDialog } from "@/components/live-stream-setup-dialog";
import { 
  Headphones, 
  Video, 
  Play, 
  Pause, 
  Star, 
  Eye, 
  Clock, 
  Filter,
  Search,
  Upload,
  MessageSquare,
  Radio,
  ExternalLink
} from "lucide-react";
import { getDefaultThumbnail } from "@/lib/default-thumbnail";

interface Podcast {
  id: string;
  title: string;
  description: string;
  type: 'audio' | 'video';
  fileUrl: string;
  thumbnailUrl?: string;
  duration: number;
  uploadedBy: string;
  category: string;
  tags: string[];
  rating: string;
  ratingCount: number;
  viewCount: number;
  isPublished: boolean;
  isLive: boolean;
  liveUrl?: string;
  createdAt: string;
  updatedAt: string;
}

interface PodcastRating {
  id: string;
  userId: string;
  podcastId: string;
  rating: number;
  review?: string;
  createdAt: string;
  user: {
    firstName: string;
    lastName: string;
    profileImageUrl?: string;
  };
}

export default function Podcasts() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [playbackPosition, setPlaybackPosition] = useState<{ [key: string]: number }>({});
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement | HTMLVideoElement }>({});
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [selectedVideoPodcast, setSelectedVideoPodcast] = useState<Podcast | null>(null);

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

  // Fetch podcasts
  const { data: podcasts = [], isLoading } = useQuery({
    queryKey: ['api', 'podcasts', { search: searchQuery, category: selectedCategory, sort: sortBy }],
    queryFn: async () => {
      const params = new URLSearchParams({
        search: searchQuery,
        category: selectedCategory === 'all' ? '' : selectedCategory,
        sort: sortBy
      });
      const response = await fetch(`/api/podcasts?${params}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch podcasts');
      return response.json();
    },
    retry: false
  });

  // Check URL parameters to auto-open podcast from carousel
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const podcastId = params.get('id');
    
    if (podcastId && podcasts.length > 0) {
      const podcast = podcasts.find((p: Podcast) => p.id === podcastId);
      if (podcast) {
        if (podcast.type === 'video') {
          setSelectedVideoPodcast(podcast);
          setVideoDialogOpen(true);
        } else {
          // For audio podcasts, start playing
          setCurrentlyPlaying(podcast.id);
        }
        // Clear the URL parameter after opening
        window.history.replaceState({}, '', '/podcasts');
      }
    }
  }, [podcasts]);

  // Track podcast view
  const trackViewMutation = useMutation({
    mutationFn: (podcastId: string) =>
      fetch(`/api/podcasts/${podcastId}/view`, {
        method: 'POST',
        credentials: 'include'
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api', 'podcasts'] });
    }
  });

  // Rate podcast
  const ratePodcastMutation = useMutation({
    mutationFn: ({ podcastId, rating, review }: { podcastId: string; rating: number; review?: string }) =>
      fetch(`/api/podcasts/${podcastId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, review }),
        credentials: 'include'
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api', 'podcasts'] });
      toast({
        title: "Rating Submitted",
        description: "Thank you for your feedback!"
      });
    }
  });

  // Live streaming mutations
  const startLiveStreamMutation = useMutation({
    mutationFn: async (podcastId: string) => {
      const response = await fetch(`/api/admin/livestream/start/${podcastId}`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to start live stream');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api', 'podcasts'] });
      toast({
        title: "Live Stream Started",
        description: "The podcast is now live!"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start live stream",
        variant: "destructive"
      });
    }
  });

  const endLiveStreamMutation = useMutation({
    mutationFn: async (podcastId: string) => {
      const response = await fetch(`/api/admin/livestream/end/${podcastId}`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to end live stream');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api', 'podcasts'] });
      toast({
        title: "Live Stream Ended",
        description: "The live stream has been stopped."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to end live stream",
        variant: "destructive"
      });
    }
  });

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = (podcast: Podcast) => {
    // For video podcasts, open dialog instead
    if (podcast.type === 'video') {
      setSelectedVideoPodcast(podcast);
      setVideoDialogOpen(true);
      trackViewMutation.mutate(podcast.id);
      return;
    }

    // For audio podcasts, handle play/pause
    const mediaElement = audioRefs.current[podcast.id];
    
    if (currentlyPlaying === podcast.id && mediaElement) {
      // Pause current
      mediaElement.pause();
      setCurrentlyPlaying(null);
    } else {
      // Stop any currently playing
      if (currentlyPlaying && audioRefs.current[currentlyPlaying]) {
        audioRefs.current[currentlyPlaying].pause();
      }
      
      // Play new one
      if (mediaElement) {
        const startTime = playbackPosition[podcast.id] || 0;
        mediaElement.currentTime = startTime;
        mediaElement.play().catch(err => {
          console.error('Error playing audio:', err);
          toast({
            title: "Playback Error",
            description: "Unable to play audio. Please try again.",
            variant: "destructive"
          });
        });
        setCurrentlyPlaying(podcast.id);
        
        // Track view when starting playback
        if (startTime === 0) {
          trackViewMutation.mutate(podcast.id);
        }
      }
    }
  };

  const handleTimeUpdate = (podcastId: string, currentTime: number) => {
    setPlaybackPosition(prev => ({ ...prev, [podcastId]: currentTime }));
  };

  const handlePodcastView = (podcastId: string) => {
    // Track view and potentially navigate to detailed view
    trackViewMutation.mutate(podcastId);
  };

  const renderStars = (rating: number, interactive = false, onRatingSelect?: (rating: number) => void) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < rating 
            ? 'fill-current text-black' 
            : 'text-black'
        } ${interactive ? 'cursor-pointer hover:text-black' : ''}`}
        onClick={interactive && onRatingSelect ? () => onRatingSelect(i + 1) : undefined}
      />
    ));
  };

  const RatingDialog = ({ podcast }: { podcast: Podcast }) => {
    const [rating, setRating] = useState(0);
    const [review, setReview] = useState("");
    const [showDialog, setShowDialog] = useState(false);

    const handleSubmit = () => {
      if (rating === 0) {
        toast({
          title: "Please select a rating",
          variant: "destructive"
        });
        return;
      }

      ratePodcastMutation.mutate({
        podcastId: podcast.id,
        rating,
        review: review.trim() || undefined
      });
      
      setShowDialog(false);
      setRating(0);
      setReview("");
    };

    return (
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="w-full text-xs px-2 py-1 h-auto">
            <Star className="w-3 h-3 mr-1" />
            Rate
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rate "{podcast.title}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Rating</label>
              <div className="flex space-x-1 mt-2">
                {renderStars(rating, true, setRating)}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Review (Optional)</label>
              <Textarea
                value={review}
                onChange={(e) => setReview(e.target.value)}
                placeholder="Share your thoughts about this podcast..."
                className="mt-2"
                rows={3}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={ratePodcastMutation.isPending}
              >
                Submit Rating
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  if (authLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  const filteredPodcasts = podcasts.filter((podcast: Podcast) => 
    podcast.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    podcast.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-ministry-steel to-ministry-charcoal text-white p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center">
              <Headphones className="w-7 h-7 mr-2" />
              Podcasts
            </h1>
            <p className="text-blue-200 text-sm">Audio & Video Content</p>
          </div>

        </div>

        {/* Search and Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 w-4 h-4" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search podcasts..."
              className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/60"
            />
          </div>
          
          <div className="flex space-x-3">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="bg-white/10 border-white/20 text-white w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="leadership">Leadership</SelectItem>
                <SelectItem value="marriage">Marriage</SelectItem>
                <SelectItem value="fatherhood">Fatherhood</SelectItem>
                <SelectItem value="character">Character</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="bg-white/10 border-white/20 text-white w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Latest</SelectItem>
                <SelectItem value="rating">Highest Rated</SelectItem>
                <SelectItem value="views">Most Viewed</SelectItem>
                <SelectItem value="title">Title A-Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Live Stream Banner */}
        <LiveStreamBanner />
        
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ministry-gold"></div>
          </div>
        ) : filteredPodcasts.length === 0 ? (
          <Card className="text-center py-12 bg-ministry-gold-exact/20">
            <CardContent>
              <Headphones className="w-12 h-12 mx-auto text-ministry-steel mb-4" />
              <h3 className="text-lg font-medium text-ministry-charcoal mb-2">No Podcasts Found</h3>
              <p className="text-ministry-slate">
                {searchQuery ? 'No podcasts match your search.' : 'No podcasts available yet.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredPodcasts.map((podcast: Podcast) => (
              <Card key={podcast.id} className="hover:shadow-md transition-shadow bg-ministry-gold-exact/20">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-start space-x-4">
                    {/* Thumbnail/Icon */}
                    <div className="flex-shrink-0">
                      {podcast.type === 'video' ? (
                        <img
                          src={getDefaultThumbnail(podcast.thumbnailUrl)}
                          alt={podcast.title}
                          className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover"
                        />
                      ) : (
                        <img
                          src={getDefaultThumbnail(podcast.thumbnailUrl)}
                          alt={podcast.title}
                          className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover"
                        />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0 pr-2">
                          <h3 className="font-semibold text-base sm:text-lg text-ministry-charcoal mb-1 truncate">
                            {podcast.title}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-ministry-slate mb-2">
                            <Badge variant="outline" className="text-xs text-black">
                              {podcast.type === 'audio' ? 'Audio' : 'Video'}
                            </Badge>
                            {podcast.isLive && (
                              <Badge className="text-xs bg-red-500 hover:bg-red-600 text-white">
                                <Radio className="w-3 h-3 mr-1" />
                                LIVE
                              </Badge>
                            )}
                            <span className="capitalize hidden sm:inline">{podcast.category}</span>
                            <span className="flex items-center">
                              <Clock className="w-3 h-3 mr-1" />
                              {formatDuration(podcast.duration)}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex-shrink-0">
                          {podcast.isLive ? (
                            <Button
                              onClick={() => window.open(podcast.liveUrl, '_blank')}
                              className="bg-red-500 hover:bg-red-600 text-white text-xs sm:text-sm px-2 sm:px-4"
                              size="sm"
                            >
                              <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                              Join Live
                            </Button>
                          ) : (
                            <Button
                              onClick={() => handlePlayPause(podcast)}
                              className="bg-ministry-gold hover:bg-ministry-gold/90 text-black"
                              size="sm"
                            >
                              {currentlyPlaying === podcast.id ? (
                                <Pause className="w-4 h-4" />
                              ) : (
                                <Play className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>

                      {podcast.description && (
                        <p className="text-ministry-slate text-sm mb-3 overflow-hidden" 
                           style={{
                             display: '-webkit-box',
                             WebkitLineClamp: 2,
                             WebkitBoxOrient: 'vertical',
                             maxHeight: '2.5rem'
                           }}>
                          {podcast.description}
                        </p>
                      )}

                      {/* Stats and Actions */}
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center space-x-3 text-xs sm:text-sm text-ministry-slate">
                          <div className="flex items-center">
                            {renderStars(Math.round(parseFloat(podcast.rating)))}
                            <span className="ml-1">
                              {parseFloat(podcast.rating).toFixed(1)} ({podcast.ratingCount})
                            </span>
                          </div>
                          <div className="flex items-center">
                            <Eye className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                            {podcast.viewCount} views
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 w-full">
                          <div className="flex-1">
                            <RatingDialog podcast={podcast} />
                          </div>
                          <div className="flex-1">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handlePodcastView(podcast.id)}
                              className="text-xs px-2 py-1 h-auto w-full"
                            >
                              <MessageSquare className="w-3 h-3 mr-1" />
                              Reviews
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Hidden audio element for audio podcasts only */}
                      {podcast.type === 'audio' && (
                        <audio
                          ref={(el) => {
                            if (el) audioRefs.current[podcast.id] = el;
                          }}
                          src={podcast.fileUrl}
                          onTimeUpdate={(e) => handleTimeUpdate(podcast.id, e.currentTarget.currentTime)}
                          onEnded={() => setCurrentlyPlaying(null)}
                        />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Video Player Dialog */}
      <Dialog open={videoDialogOpen} onOpenChange={setVideoDialogOpen}>
        <DialogContent className="max-w-4xl w-full">
          <DialogHeader>
            <DialogTitle>{selectedVideoPodcast?.title}</DialogTitle>
          </DialogHeader>
          {selectedVideoPodcast && (
            <div className="space-y-4">
              <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                <video
                  src={selectedVideoPodcast.fileUrl}
                  controls
                  autoPlay
                  className="absolute top-0 left-0 w-full h-full rounded-lg"
                  data-testid="video-player"
                >
                  Your browser does not support the video tag.
                </video>
              </div>
              {selectedVideoPodcast.description && (
                <div className="text-sm text-ministry-slate">
                  <p>{selectedVideoPodcast.description}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}