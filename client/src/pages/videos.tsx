import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/hooks/use-toast";
import { getDefaultThumbnail } from "@/lib/default-thumbnail";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Search, Star, Filter, Play, Clock, Eye, Crown, Gem, Zap } from "lucide-react";
import { useLocation } from "wouter";

const categories = [
  { id: 'all', label: 'All Videos' },
  { id: 'general', label: 'General' },
  { id: 'leadership', label: 'Leadership' },
  { id: 'marriage', label: 'Marriage' },
  { id: 'fatherhood', label: 'Fatherhood' },
  { id: 'character', label: 'Character' },
];

interface Video {
  id: string;
  title: string;
  description?: string;
  category: string;
  requiredTier: string;
  isFeatured: boolean;
  rating: number;
  ratingCount: number;
  duration?: number;
  thumbnailUrl?: string;
  createdAt: string;
}

export default function Videos() {
  const { user } = useAuth();
  const { effectiveTheme } = useTheme();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [videoStreamUrl, setVideoStreamUrl] = useState<string | null>(null);
  const [fromCarousel, setFromCarousel] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Add mouse wheel horizontal scroll support
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      container.scrollLeft += e.deltaY;
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ["/api/videos", { category: selectedCategory, sortBy }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') {
        params.append('category', selectedCategory);
      }
      if (sortBy) {
        params.append('sortBy', sortBy);
      }
      
      const url = `/api/videos${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      
      if (!response.ok) {
        throw new Error('Failed to fetch videos');
      }
      
      return await response.json();
    },
    retry: false,
    refetchInterval: 8000, // Real-time updates every 8 seconds for new videos
    refetchIntervalInBackground: true,
  });

  const { data: videoReviews = [] } = useQuery({
    queryKey: ["/api/videos", selectedVideo?.id, "reviews"],
    queryFn: async () => {
      if (!selectedVideo?.id) return [];
      
      const response = await fetch(`/api/videos/${selectedVideo.id}/reviews`, { 
        credentials: 'include' 
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch video reviews');
      }
      
      return await response.json();
    },
    enabled: !!selectedVideo?.id && showVideoDialog,
    retry: false,
  });

  // Check URL parameters to auto-open video from carousel
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const videoId = params.get('id');
    const from = params.get('from');
    
    if (videoId && videos.length > 0) {
      const video = videos.find((v: Video) => v.id === videoId);
      if (video) {
        setSelectedVideo(video);
        setShowVideoDialog(true);
        setFromCarousel(from === 'carousel');
        // Clear the URL parameter after opening
        window.history.replaceState({}, '', '/videos');
      }
    }
  }, [videos]);

  // Set video stream URL when dialog opens
  useEffect(() => {
    if (selectedVideo && showVideoDialog) {
      // For demo purposes, use the sample video directly
      // In production, this would be the actual uploaded video file
      setVideoStreamUrl('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
    } else {
      setVideoStreamUrl(null);
    }
  }, [selectedVideo, showVideoDialog]);

  // Handle closing video dialog - navigate back to home
  const handleCloseVideoDialog = (open: boolean) => {
    setShowVideoDialog(open);
    if (!open) {
      // If opened from carousel, go to home, otherwise stay on videos page
      if (fromCarousel) {
        setLocation('/');
        setFromCarousel(false);
      } else {
        // Clear selected video to return to video list
        setSelectedVideo(null);
        setVideoStreamUrl(null);
      }
    }
  };

  // Filter videos based on search
  const filteredVideos = videos.filter((video: Video) =>
    searchQuery.length < 2 || 
    video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (video.description && video.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const rateVideoMutation = useMutation({
    mutationFn: async (data: { videoId: string; rating: number; review?: string }) => {
      return await apiRequest("POST", `/api/videos/${data.videoId}/rate`, {
        rating: data.rating,
        review: data.review
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/videos", selectedVideo?.id, "reviews"] });
      setShowRatingDialog(false);
      setRating(0);
      setReview('');
      toast({
        title: "Success",
        description: "Thank you for your rating!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit rating",
        variant: "destructive",
      });
    },
  });

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'vip':
        return (
          <Badge className="bg-ministry-gold-exact text-black flex items-center space-x-1 rounded-none font-black uppercase tracking-wide">
            <Crown className="w-3 h-3" />
            <span>VIP</span>
          </Badge>
        );
      case 'premium':
        return (
          <Badge className="bg-blue-100 text-blue-800 flex items-center space-x-1 rounded-none font-black uppercase tracking-wide">
            <Gem className="w-3 h-3" />
            <span>Premium</span>
          </Badge>
        );
      default:
        return (
          <Badge className="bg-white text-black border-2 border-black flex items-center space-x-1 rounded-none font-bold uppercase tracking-wide">
            <Zap className="w-3 h-3" />
            <span>Free</span>
          </Badge>
        );
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'Unknown';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleRateVideo = () => {
    if (!selectedVideo || rating === 0) return;
    
    rateVideoMutation.mutate({
      videoId: selectedVideo.id,
      rating,
      review: review.trim() || undefined
    });
  };

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="liquid-header text-white px-6 pt-12 pb-6">
        <h1 className="text-4xl font-black mb-2 tracking-tighter uppercase"><span className="text-white">Video</span> <span className="text-ministry-gold-exact">Library</span></h1>
        <p className="text-[#FCD000] text-xs font-bold tracking-widest uppercase">
          Watch Inspiring Content And Grow In Faith
        </p>
      </div>

      {/* Search Bar */}
      <div className="px-6 -mt-3 relative z-10 mb-6">
        <Card className="liquid-gold-card shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border-2 border-black rounded-none overflow-hidden">
          <CardContent className="p-4 relative z-10">
            <div className="relative">
              <Input
                type="text"
                placeholder="SEARCH VIDEOS..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border-2 border-black rounded-none pl-10 pr-4 py-3 text-sm text-black placeholder:text-black/50 placeholder:font-black placeholder:text-xs placeholder:tracking-widest placeholder:uppercase focus:ring-2 focus:ring-black font-bold"
                style={{ fontFamily: "'Inter', sans-serif" }}
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-black" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Categories Filter */}
      <div className="px-6 mb-4">
        <div 
          ref={scrollContainerRef}
          className="flex space-x-3 overflow-x-auto scrollbar-hide horizontal-scroll pb-2"
        >
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              style={{
                backgroundColor: selectedCategory === category.id 
                  ? 'hsl(0 0% 0%)' 
                  : effectiveTheme === 'dark' 
                    ? 'hsl(220 8% 26%)' 
                    : 'hsl(240 1.9608% 90%)',
                color: selectedCategory === category.id 
                  ? 'white' 
                  : effectiveTheme === 'dark' 
                    ? 'hsl(0 0% 95%)' 
                    : 'hsl(210 25% 7.8431%)',
                borderColor: selectedCategory === category.id 
                  ? 'hsl(0 0% 0%)' 
                  : effectiveTheme === 'dark' 
                    ? 'hsl(210 5.2632% 14.9020%)' 
                    : 'hsl(201.4286 30.4348% 90.9804%)'
              }}
              className="px-6 py-2 rounded-none text-sm font-black uppercase tracking-wide whitespace-nowrap flex-shrink-0 snap-start border-2 border-black cursor-pointer transition-all"
            >
              {category.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sort and Filter */}
      <div className="px-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-ministry-slate">Sort & Filter</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="text-ministry-navy"
          >
            <Filter className="w-4 h-4 mr-1" />
            {showFilters ? 'Hide' : 'Show'} Filters
          </Button>
        </div>
        
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-ministry-slate mb-1 block">
                Sort By
              </label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full h-8 text-sm">
                  <SelectValue placeholder="Sort by..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Most Recent</SelectItem>
                  <SelectItem value="rating">Highest Rated</SelectItem>
                  <SelectItem value="reviews">Most Reviews</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Video Grid */}
      <div className="px-6 space-y-4">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ministry-navy mx-auto mb-4"></div>
            <p className="text-ministry-slate">Loading videos...</p>
          </div>
        ) : filteredVideos.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-ministry-slate">
              {searchQuery.length >= 2 || selectedCategory !== 'all'
                ? 'No videos found for your filters.'
                : 'No videos available.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVideos.map((video: Video) => (
              <Card key={video.id} className={`liquid-gold-card overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all border-2 border-black rounded-none ${
                video.isFeatured ? 'ring-2 ring-yellow-400' : ''
              }`} style={{ fontFamily: "'Inter', sans-serif" }}>
                <div className="aspect-video bg-gray-900 relative cursor-pointer"
                     onClick={() => {
                       setSelectedVideo(video);
                       setShowVideoDialog(true);
                     }}>
                  <img 
                    src={getDefaultThumbnail(video.thumbnailUrl)} 
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 space-y-1">
                    {getTierBadge(video.requiredTier)}
                    {video.isFeatured && (
                      <Badge className="bg-black text-ministry-gold-exact flex items-center space-x-1 rounded-none border-2 border-ministry-gold-exact font-black uppercase tracking-wide">
                        <Star className="w-3 h-3" />
                        <span>Featured</span>
                      </Badge>
                    )}
                  </div>
                  {video.duration && (
                    <div className="absolute bottom-2 right-2 bg-black text-white text-xs px-2 py-1 rounded-none border border-ministry-gold-exact font-bold">
                      {formatDuration(video.duration)}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <div className="w-16 h-16 bg-ministry-gold-exact rounded-none border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      <Play className="w-8 h-8 text-black fill-black" />
                    </div>
                  </div>
                </div>
                
                <CardContent className="p-4 relative z-10">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-black text-black line-clamp-2 flex-1 tracking-tight text-lg uppercase">
                      {video.title}
                    </h3>
                    {video.isFeatured && (
                      <Star className="w-4 h-4 text-black fill-current ml-2 flex-shrink-0" />
                    )}
                  </div>
                  {video.description && (
                    <div 
                      className="p-3 mb-3 rounded-none"
                      style={{ 
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 70%, rgba(252,208,0,0.2) 100%)'
                      }}
                    >
                      <p className="text-sm text-gray-800 line-clamp-2" style={{ fontFamily: "'Inter', sans-serif" }}>
                        {video.description}
                      </p>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {video.rating > 0 && (
                        <div className="flex items-center bg-black px-2 py-1 rounded-none">
                          <Star className="w-4 h-4 text-ministry-gold-exact fill-current mr-1" />
                          <span className="text-sm text-white font-bold">{video.rating}</span>
                          <span className="text-xs text-white/70 ml-1">({video.ratingCount})</span>
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedVideo(video);
                        setShowVideoDialog(true);
                      }}
                      className="bg-black text-white hover:bg-ministry-gold-exact hover:text-black font-black uppercase tracking-wide rounded-none border-2 border-black shadow-[2px_2px_0px_0px_rgba(252,208,0,1)] transition-all"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Watch
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Video Detail Dialog */}
      <Dialog open={showVideoDialog} onOpenChange={handleCloseVideoDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-3">
              <Play className="w-5 h-5" />
              <span>{selectedVideo?.title}</span>
            </DialogTitle>
          </DialogHeader>

          {selectedVideo && (
            <div className="space-y-6">
              {/* Video Player */}
              <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
                {videoStreamUrl ? (
                  <video 
                    className="w-full h-full"
                    controls
                    preload="metadata"
                    src={videoStreamUrl}
                    poster={selectedVideo.thumbnailUrl}
                  >
                    <source src={videoStreamUrl} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-4"></div>
                    <span className="ml-4 text-white">Loading video...</span>
                  </div>
                )}
              </div>

              {/* Video Info */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getTierBadge(selectedVideo.requiredTier)}
                    <Badge variant="outline" className="bg-card border-ministry-charcoal text-foreground">{selectedVideo.category}</Badge>
                  </div>
                  <Button
                    onClick={() => setShowRatingDialog(true)}
                    variant="outline"
                    className="bg-card border-ministry-charcoal text-foreground hover:bg-muted"
                    size="sm"
                  >
                    <Star className="w-4 h-4 mr-1" />
                    Rate Video
                  </Button>
                </div>

                {selectedVideo.description && (
                  <div>
                    <h4 className="font-medium text-ministry-charcoal mb-2">Description</h4>
                    <p className="text-ministry-slate">{selectedVideo.description}</p>
                  </div>
                )}

                {/* Video Stats */}
                <div className="flex items-center space-x-4 text-sm text-ministry-slate">
                  {selectedVideo.duration && (
                    <div className="flex items-center space-x-1">
                      <Clock className="w-4 h-4" />
                      <span>{formatDuration(selectedVideo.duration)}</span>
                    </div>
                  )}
                  {selectedVideo.rating > 0 && (
                    <div className="flex items-center space-x-1">
                      <Star className="w-4 h-4 text-black fill-current" />
                      <span>{selectedVideo.rating} ({selectedVideo.ratingCount} reviews)</span>
                    </div>
                  )}
                </div>

                {/* Reviews */}
                {videoReviews.length > 0 && (
                  <div>
                    <h4 className="font-medium text-ministry-charcoal mb-3">Reviews</h4>
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {videoReviews.map((review: any) => (
                        <div key={review.id} className="border-b border-ministry-charcoal pb-3 last:border-b-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <div className="flex items-center">
                              {[...Array(5)].map((_, i) => (
                                <Star 
                                  key={i} 
                                  className={`w-3 h-3 ${i < review.rating ? 'text-black fill-current' : 'text-black'}`} 
                                />
                              ))}
                            </div>
                            <span className="text-sm font-medium text-ministry-charcoal">
                              {review.user.firstName} {review.user.lastName}
                            </span>
                          </div>
                          {review.review && (
                            <p className="text-sm text-ministry-slate">{review.review}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Rating Dialog */}
      <Dialog open={showRatingDialog} onOpenChange={setShowRatingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rate this Video</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-ministry-charcoal mb-2 block">
                Your Rating
              </label>
              <div className="flex items-center space-x-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className="focus:outline-none"
                  >
                    <Star 
                      className={`w-6 h-6 ${star <= rating ? 'text-black fill-current' : 'text-black'} hover:text-black transition-colors`} 
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-ministry-charcoal mb-2 block">
                Review (Optional)
              </label>
              <Textarea
                value={review}
                onChange={(e) => setReview(e.target.value)}
                placeholder="Share your thoughts about this video..."
                rows={3}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowRatingDialog(false)} className="bg-card border-ministry-charcoal text-foreground hover:bg-muted">
                Cancel
              </Button>
              <Button 
                onClick={handleRateVideo}
                disabled={rating === 0 || rateVideoMutation.isPending}
                className="bg-ministry-navy hover:bg-ministry-charcoal"
              >
                Submit Rating
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}