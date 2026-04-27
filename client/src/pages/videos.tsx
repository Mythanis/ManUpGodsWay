import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
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
import { Search, Star, Filter, Play, Clock, Eye, Crown, Gem, Zap, Trash2 } from "lucide-react";
import { useLocation } from "wouter";
import { BackButton } from "@/components/BackButton";

interface Video {
  id: string;
  title: string;
  description?: string;
  category: string;
  tags?: string[];
  requiredTier: string;
  isFeatured: boolean;
  rating: number;
  ratingCount: number;
  duration?: number;
  thumbnailUrl?: string;
  videoUrl?: string;
  createdAt: string;
}

function getVideoEmbed(url: string): { type: 'youtube' | 'vimeo' | 'direct'; embedUrl: string } {
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (ytMatch) {
    return { type: 'youtube', embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}?rel=0` };
  }
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return { type: 'vimeo', embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}` };
  }
  return { type: 'direct', embedUrl: url };
}

export default function Videos() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [videoStreamUrl, setVideoStreamUrl] = useState<string | null>(null);
  const [fromCarousel, setFromCarousel] = useState(false);

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ["/api/videos"],
    queryFn: async () => {
      const response = await fetch('/api/videos', { credentials: 'include' });
      
      if (!response.ok) {
        throw new Error('Failed to fetch videos');
      }
      
      return await response.json();
    },
    retry: false,
    refetchInterval: 8000,
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
      // Use the actual uploaded video stream endpoint
      setVideoStreamUrl(`/api/videos/${selectedVideo.id}/stream`);
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

  // Filter videos based on search (title, description, and tags)
  const filteredVideos = videos.filter((video: Video) => {
    if (searchQuery.length < 2) return true;
    const query = searchQuery.toLowerCase();
    const matchesTitle = video.title.toLowerCase().includes(query);
    const matchesDescription = video.description && video.description.toLowerCase().includes(query);
    const matchesTags = video.tags && video.tags.some(tag => tag.toLowerCase().includes(query));
    return matchesTitle || matchesDescription || matchesTags;
  });

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

  const deleteVideoRatingMutation = useMutation({
    mutationFn: async (ratingId: string) => {
      return await apiRequest("DELETE", `/api/videos/${selectedVideo?.id}/ratings/${ratingId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/videos", selectedVideo?.id, "reviews"] });
      toast({ title: "Review deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete review", variant: "destructive" });
    },
  });

  const canModerate = (user as any)?.role === 'admin' || (user as any)?.role === 'moderator' || (user as any)?.role === 'owner';

  const getTierBadge = (tier: string) => {
    if (tier !== 'free') {
      return (
        <Badge className="bg-ministry-gold-exact text-black flex items-center space-x-1 rounded-sm font-black uppercase tracking-wide">
          <Crown className="w-3 h-3" />
          <span>Subscribers Only</span>
        </Badge>
      );
    }
    return (
      <Badge className="bg-white text-black border-2 border-black flex items-center space-x-1 rounded-sm font-bold uppercase tracking-wide">
        <Zap className="w-3 h-3" />
        <span>Free</span>
      </Badge>
    );
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
        <BackButton />
        <h1 className="text-4xl font-black mb-2 tracking-tighter uppercase"><span className="text-white">Video</span> <span className="text-ministry-gold-exact">Library</span></h1>
        <p className="text-[#FDD000] text-xs font-bold tracking-widest uppercase">
          Watch Inspiring Content And Grow In Faith
        </p>
      </div>

      {/* Search Bar */}
      <div className="px-6 -mt-3 relative z-10 mb-6">
        <Card className="liquid-black-white shadow-[4px_4px_0px_0px_rgba(253,208,0,1)] border-2 border-ministry-gold-exact rounded-sm overflow-hidden">
          <CardContent className="p-4 relative z-10">
            <div className="relative">
              <Input
                type="text"
                placeholder="SEARCH VIDEOS..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border-2 border-black rounded-sm pl-10 pr-4 py-3 text-sm text-black placeholder:text-black/50 placeholder:font-black placeholder:text-xs placeholder:tracking-widest placeholder:uppercase focus:ring-2 focus:ring-black font-bold"
                style={{ fontFamily: "'Inter', sans-serif" }}
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-black" />
            </div>
          </CardContent>
        </Card>
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
              {searchQuery.length >= 2
                ? 'No videos found for your search.'
                : 'No videos available.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filteredVideos.map((video: Video) => (
              <Card key={video.id} className={`overflow-hidden shadow-[4px_4px_0px_0px_rgba(253,208,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(253,208,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all border-2 border-ministry-gold-exact rounded-sm ${
                video.isFeatured ? 'ring-2 ring-yellow-400' : ''
              }`} style={{ fontFamily: "'Inter', sans-serif" }}>
                <div className="aspect-video bg-gradient-to-br from-gray-900 via-gray-800 to-black relative cursor-pointer group"
                     onClick={() => {
                       setSelectedVideo(video);
                       setShowVideoDialog(true);
                     }}>
                  <img 
                    src={getDefaultThumbnail(video.thumbnailUrl)} 
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                  {/* Dark overlay for better play button visibility */}
                  <div className="absolute inset-0 bg-black/40"></div>
                  
                  <div className="absolute top-2 left-2 space-y-1 z-10">
                    {getTierBadge(video.requiredTier)}
                    {video.isFeatured && (
                      <Badge className="bg-black text-ministry-gold-exact flex items-center space-x-1 rounded-sm border-2 border-ministry-gold-exact font-black uppercase tracking-wide">
                        <Star className="w-3 h-3" />
                        <span>Featured</span>
                      </Badge>
                    )}
                  </div>
                  {video.duration && (
                    <div className="absolute bottom-2 right-2 bg-black text-white text-xs px-2 py-1 rounded-sm border border-ministry-gold-exact font-bold z-10">
                      {formatDuration(video.duration)}
                    </div>
                  )}
                  {/* Always visible play button */}
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="w-10 h-10 bg-ministry-gold-exact rounded-sm border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] group-hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] group-hover:scale-110 transition-all">
                      <Play className="w-5 h-5 text-black fill-black" />
                    </div>
                  </div>
                </div>
                
                <CardContent className="p-4 liquid-black-white relative">
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-xl font-coalition text-white uppercase tracking-widest line-clamp-2 flex-1">
                        {video.title}
                      </h3>
                      {video.isFeatured && (
                        <Star className="w-4 h-4 text-ministry-gold-exact fill-current ml-2 flex-shrink-0" />
                      )}
                    </div>
                    {video.description && (
                      <div className="p-3 mb-3 rounded-sm bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        <p className="text-sm text-black line-clamp-2" style={{ fontFamily: "'Inter', sans-serif" }}>
                          {video.description}
                        </p>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {video.rating > 0 && (
                          <div className="flex items-center bg-ministry-gold-exact px-2 py-1 rounded-sm border-2 border-black">
                            <Star className="w-4 h-4 text-black fill-current mr-1" />
                            <span className="text-sm text-black font-bold">{video.rating}</span>
                            <span className="text-xs text-black/70 ml-1">({video.ratingCount})</span>
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
                        className="bg-ministry-gold-exact text-black hover:bg-yellow-400 font-black uppercase tracking-wide rounded-sm border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Watch
                      </Button>
                    </div>
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
                {selectedVideo.videoUrl && !selectedVideo.videoUrl.startsWith('gcs:') ? (
                  (() => {
                    const embed = getVideoEmbed(selectedVideo.videoUrl);
                    if (embed.type === 'youtube' || embed.type === 'vimeo') {
                      return (
                        <iframe
                          src={embed.embedUrl}
                          className="w-full h-full"
                          allowFullScreen
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          title={selectedVideo.title}
                        />
                      );
                    }
                    return (
                      <video
                        className="w-full h-full"
                        controls
                        preload="metadata"
                        src={embed.embedUrl}
                        poster={selectedVideo.thumbnailUrl}
                      >
                        Your browser does not support the video tag.
                      </video>
                    );
                  })()
                ) : videoStreamUrl ? (
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
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center space-x-2">
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
                            {canModerate && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteVideoRatingMutation.mutate(review.id)}
                                disabled={deleteVideoRatingMutation.isPending}
                                className="text-red-500 hover:text-red-600 hover:bg-red-50 p-1 h-auto"
                                title="Delete review"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
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