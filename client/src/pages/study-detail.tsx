import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertStudyRatingSchema, type Study, type UserProgress, type Discussion } from "@shared/schema";
import { ArrowLeft, Play, Clock, Users, Star, MessageCircle } from "lucide-react";
import { Link } from "wouter";
import { z } from "zod";

const ratingSchema = insertStudyRatingSchema.pick({ rating: true, review: true });

export default function StudyDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentLesson, setCurrentLesson] = useState(1);

  // Redirect to login if not authenticated
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

  const { data: study, isLoading: studyLoading } = useQuery<Study>({
    queryKey: ["/api/studies", id],
    retry: false,
    enabled: !!id,
  });

  const { data: progress } = useQuery<UserProgress>({
    queryKey: ["/api/progress", id],
    retry: false,
    enabled: !!id && isAuthenticated,
  });

  const { data: studyDiscussion } = useQuery<Discussion & { user: { firstName: string; lastName: string } }>({
    queryKey: ["/api/studies", id, "discussion"],
    retry: false,
    enabled: !!id,
  });

  // Update current lesson when progress data loads
  useEffect(() => {
    if (progress) {
      const userProgress = Array.isArray(progress) ? progress[0] : progress;
      if (userProgress?.currentLesson) {
        setCurrentLesson(userProgress.currentLesson);
      }
    }
  }, [progress]);

  // Determine video URL - use direct stream URL for uploaded videos
  const isUploadedVideo = study?.videoUrl && !study.videoUrl.startsWith('http') && study.videoUrl.length > 10;
  const videoStreamUrl = isUploadedVideo 
    ? `/api/videos/${study.videoUrl}/stream` 
    : study?.videoUrl;

  const form = useForm({
    resolver: zodResolver(ratingSchema),
    defaultValues: {
      rating: 5,
      review: "",
    },
  });

  const updateProgress = useMutation({
    mutationFn: async (data: { currentLesson: number; completedLessons: number; isCompleted?: boolean }) => {
      await apiRequest('POST', `/api/progress/${id}`, data);
    },
    onSuccess: () => {
      // Invalidate all progress-related queries
      queryClient.invalidateQueries({ queryKey: ["/api/progress"] });
      queryClient.invalidateQueries({ queryKey: ["/api/progress", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      // Force refetch of current progress
      queryClient.refetchQueries({ queryKey: ["/api/progress", id] });
      const newCompletedLessons = Math.min(currentLesson, study?.lessonCount || 1);
      const isCompleted = newCompletedLessons === study?.lessonCount;
      
      toast({
        title: "Progress Updated",
        description: isCompleted 
          ? "Study completed! Your streak has been updated." 
          : "Your study progress and daily streak have been saved!",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Error",
        description: "Failed to update progress. Please try again.",
        variant: "destructive",
      });
    },
  });

  const rateStudy = useMutation({
    mutationFn: async (data: z.infer<typeof ratingSchema>) => {
      await apiRequest('POST', `/api/studies/${id}/rate`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/studies", id] });
      toast({
        title: "Rating Submitted",
        description: "Thank you for rating this study!",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Error",
        description: "Failed to submit rating. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleProgressUpdate = () => {
    if (!study) return;
    
    const newCompletedLessons = Math.min(currentLesson, study.lessonCount || 1);
    const isCompleted = newCompletedLessons === study.lessonCount;
    
    updateProgress.mutate({
      currentLesson,
      completedLessons: newCompletedLessons,
      isCompleted,
    });
  };

  const onSubmitRating = (data: z.infer<typeof ratingSchema>) => {
    rateStudy.mutate(data);
  };

  if (authLoading || studyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ministry-navy"></div>
      </div>
    );
  }

  if (!study) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">Study Not Found</h1>
              <p className="text-sm text-gray-600 mb-4">
                The study you're looking for doesn't exist or has been removed.
              </p>
              <Link href="/library">
                <Button data-testid="button-back-to-library">
                  Back to Library
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const userProgress = Array.isArray(progress) ? progress[0] : progress;
  // Use the current lesson state for immediate UI updates
  const effectiveCompletedLessons = Math.max(
    userProgress?.completedLessons || 0, 
    Math.min(currentLesson, study?.lessonCount || 1)
  );
  const progressPercent = Math.round((effectiveCompletedLessons / (study?.lessonCount || 1)) * 100);

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'premium':
        return 'bg-ministry-steel/20 text-ministry-steel';
      case 'vip':
        return 'bg-ministry-gold/20 text-ministry-gold';
      default:
        return 'bg-ministry-success/20 text-ministry-success';
    }
  };

  const canAccess = study.requiredTier === 'free' || 
                   (study.requiredTier === 'premium' && ['premium', 'vip'].includes(user?.subscriptionTier || '')) ||
                   (study.requiredTier === 'vip' && user?.subscriptionTier === 'vip');

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-ministry-navy to-ministry-charcoal text-white px-6 pt-12 pb-6">
        <div className="flex items-center mb-4">
          <Link href="/library">
            <Button 
              variant="ghost" 
              size="icon"
              className="mr-3 p-2 hover:bg-white/10 text-white"
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold" data-testid="text-study-title">
              {study.title}
            </h1>
            <p className="text-blue-200 text-sm" data-testid="text-study-category">
              {study.category} • {study.lessonCount} lessons
            </p>
          </div>
        </div>
      </div>

      {/* Study Info */}
      <div className="px-6 -mt-3 relative z-10 mb-6">
        <Card className="shadow-lg" data-testid="card-study-info">
          <CardContent className="p-6">
            {study.thumbnailUrl && (
              <img 
                src={study.thumbnailUrl} 
                alt={study.title}
                className="w-full h-48 object-cover rounded-lg mb-4"
                data-testid="img-study-thumbnail"
              />
            )}
            
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Badge className={getTierColor(study.requiredTier || 'free')} data-testid="badge-study-tier">
                  {study.requiredTier || 'free'}
                </Badge>
                {(study.rating && parseFloat(study.rating.toString()) > 0) && (
                  <div className="flex items-center space-x-1" data-testid="rating-display">
                    <Star className="w-4 h-4 text-ministry-gold fill-current" />
                    <span className="text-sm font-medium">{study.rating}</span>
                    <span className="text-xs text-ministry-slate">({study.ratingCount} reviews)</span>
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-4 text-sm text-ministry-slate">
                <div className="flex items-center space-x-1">
                  <Clock className="w-4 h-4" />
                  <span>{study.estimatedHours}h</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Users className="w-4 h-4" />
                  <span>{study.difficulty}</span>
                </div>
              </div>
            </div>

            <p className="text-ministry-slate mb-6" data-testid="text-study-description">
              {study.description}
            </p>

            {!canAccess && (
              <div className="bg-ministry-gold/10 border border-ministry-gold/20 rounded-lg p-4 mb-6" data-testid="access-restriction">
                <h3 className="font-semibold text-ministry-charcoal mb-2">Premium Content</h3>
                <p className="text-sm text-ministry-slate mb-3">
                  This study requires a {study.requiredTier} subscription to access.
                </p>
                <Button 
                  className="bg-ministry-gold text-ministry-navy hover:bg-ministry-gold/90"
                  data-testid="button-upgrade-access"
                >
                  Upgrade to {study.requiredTier}
                </Button>
              </div>
            )}

            {/* Join Discussion Section - Only for users with tier access */}
            {studyDiscussion && canAccess && (
              <div className="flex items-center justify-between p-4 bg-ministry-navy/5 rounded-lg border border-ministry-navy/20">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-ministry-navy/10 flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-ministry-navy" />
                  </div>
                  <div>
                    <h3 className="font-medium text-ministry-charcoal">Join Study Discussion</h3>
                    <p className="text-sm text-ministry-slate">
                      Connect with other members studying "{study.title}"
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => window.location.href = `/community?discussion=${studyDiscussion.id}`}
                  variant="outline"
                  className="border-ministry-navy text-ministry-navy hover:bg-ministry-navy hover:text-white"
                  data-testid="button-join-discussion"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Join Discussion
                </Button>
              </div>
            )}
            
            {/* Tier Access Required for Discussion */}
            {studyDiscussion && !canAccess && (
              <div className="flex items-center justify-between p-4 bg-ministry-gold/10 rounded-lg border border-ministry-gold/20">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-ministry-gold/10 flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-ministry-gold" />
                  </div>
                  <div>
                    <h3 className="font-medium text-ministry-charcoal">Study Discussion Available</h3>
                    <p className="text-sm text-ministry-slate">
                      Upgrade to {study.requiredTier} to join the study discussion
                    </p>
                  </div>
                </div>
                <Button
                  disabled
                  variant="outline"
                  className="border-ministry-gold text-ministry-gold opacity-50"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  {study.requiredTier} Required
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {canAccess && (
        <>
          {/* Progress Section */}
          <div className="px-6 mb-6">
            <Card data-testid="card-progress">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-ministry-charcoal">Your Progress</h2>
                  <span className="text-sm text-ministry-steel font-bold" data-testid="text-progress-fraction">
                    {effectiveCompletedLessons}/{study.lessonCount}
                  </span>
                </div>
                
                <Progress value={progressPercent} className="mb-4" data-testid="progress-bar" />
                
                <div className="flex items-center space-x-4 mb-4">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-ministry-charcoal mb-2 block">
                      Current Lesson
                    </label>
                    <Select
                      value={currentLesson.toString()}
                      onValueChange={(value) => {
                        setCurrentLesson(parseInt(value));
                        // Auto-update progress when lesson changes
                        setTimeout(() => {
                          const newLesson = parseInt(value);
                          const newCompletedLessons = Math.min(newLesson, study.lessonCount || 1);
                          const isCompleted = newCompletedLessons === study.lessonCount;
                          
                          updateProgress.mutate({
                            currentLesson: newLesson,
                            completedLessons: newCompletedLessons,
                            isCompleted,
                          });
                        }, 100);
                      }}
                    >
                      <SelectTrigger data-testid="select-current-lesson">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: study.lessonCount || 1 }, (_, i) => i + 1).map((lesson: number) => (
                          <SelectItem key={lesson} value={lesson.toString()}>
                            Lesson {lesson}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleProgressUpdate}
                    disabled={updateProgress.isPending}
                    className="bg-ministry-navy hover:bg-ministry-charcoal mt-6"
                    data-testid="button-update-progress"
                  >
                    {updateProgress.isPending ? "Saving..." : "Update Progress"}
                  </Button>
                </div>

                {progressPercent === 100 && (
                  <div className="bg-gradient-to-r from-ministry-success/10 to-ministry-gold/10 border border-ministry-success/20 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-ministry-success/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-ministry-success" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-ministry-success text-lg">🎉 Study Completed!</h3>
                        <p className="text-sm text-ministry-slate">Congratulations on finishing this study and growing in your faith journey.</p>
                        {userProgress?.completedAt && (
                          <p className="text-xs text-ministry-steel mt-1 font-medium">
                            Completed on {new Date(userProgress.completedAt).toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Video Section */}
          {study.videoUrl && (
            <div className="px-6 mb-6">
              <Card data-testid="card-video">
                <CardContent className="p-6">
                  <h2 className="text-lg font-bold text-ministry-charcoal mb-4">Study Video</h2>
                  <div className="relative bg-gray-900 rounded-lg overflow-hidden">
                    {(() => {
                      const videoUrl = study.videoUrl;
                      
                      // Check if it's a YouTube URL
                      if (videoUrl && (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be'))) {
                        let embedUrl = '';
                        if (videoUrl.includes('youtube.com/watch?v=')) {
                          const videoId = videoUrl.split('v=')[1]?.split('&')[0];
                          if (videoId) embedUrl = `https://www.youtube.com/embed/${videoId}`;
                        } else if (videoUrl.includes('youtu.be/')) {
                          const videoId = videoUrl.split('youtu.be/')[1]?.split('?')[0];
                          if (videoId) embedUrl = `https://www.youtube.com/embed/${videoId}`;
                        } else if (videoUrl.includes('youtube.com/embed/')) {
                          embedUrl = videoUrl;
                        }
                        
                        if (embedUrl) {
                          return (
                            <iframe
                              className="w-full h-48 sm:h-64"
                              src={embedUrl}
                              title={study.title}
                              frameBorder="0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              data-testid="youtube-player"
                            />
                          );
                        }
                      }
                      
                      // Check if it's a Vimeo URL
                      if (videoUrl && videoUrl.includes('vimeo.com')) {
                        const videoId = videoUrl.split('vimeo.com/')[1]?.split('?')[0];
                        if (videoId) {
                          return (
                            <iframe
                              className="w-full h-48 sm:h-64"
                              src={`https://player.vimeo.com/video/${videoId}`}
                              title={study.title}
                              frameBorder="0"
                              allow="autoplay; fullscreen; picture-in-picture"
                              allowFullScreen
                              data-testid="vimeo-player"
                            />
                          );
                        }
                      }
                      
                      // Check if it's an uploaded video ID (not a full URL)
                      if (videoUrl && !videoUrl.startsWith('http') && videoUrl.length > 10) {
                        // This is an uploaded video ID, use direct streaming endpoint
                        return (
                          <video 
                            controls
                            className="w-full h-48 object-cover"
                            src={videoStreamUrl || ''}
                            poster={study.thumbnailUrl || ''}
                            data-testid="uploaded-video-player"
                          >
                            Your browser does not support the video tag.
                          </video>
                        );
                      }
                      
                      // Default: try to play as direct video URL
                      return (
                        <video 
                          controls
                          className="w-full h-48 object-cover"
                          src={videoUrl || ''}
                          poster={study.thumbnailUrl || ''}
                          data-testid="video-player"
                        >
                          Your browser does not support the video tag.
                        </video>
                      );
                    })()}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Content Section */}
          <div className="px-6 mb-6">
            <Card data-testid="card-content">
              <CardContent className="p-6">
                <h2 className="text-lg font-bold text-ministry-charcoal mb-4">Study Content</h2>
                <div className="prose prose-sm max-w-none text-ministry-slate" data-testid="text-study-content">
                  {study.content ? (
                    <div dangerouslySetInnerHTML={{ __html: study.content.replace(/\n/g, '<br>') }} />
                  ) : (
                    <p>No content available for this study.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Rating Section */}
          <div className="px-6 mb-6">
            <Card data-testid="card-rating">
              <CardContent className="p-6">
                <h2 className="text-lg font-bold text-ministry-charcoal mb-4">Rate This Study</h2>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmitRating)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="rating"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rating</FormLabel>
                          <FormControl>
                            <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value?.toString()}>
                              <SelectTrigger data-testid="select-rating">
                                <SelectValue placeholder="Select rating" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="5">⭐⭐⭐⭐⭐ (5 stars)</SelectItem>
                                <SelectItem value="4">⭐⭐⭐⭐ (4 stars)</SelectItem>
                                <SelectItem value="3">⭐⭐⭐ (3 stars)</SelectItem>
                                <SelectItem value="2">⭐⭐ (2 stars)</SelectItem>
                                <SelectItem value="1">⭐ (1 star)</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="review"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Review (Optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Share your thoughts about this study..."
                              className="min-h-[100px]"
                              data-testid="textarea-review"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      disabled={rateStudy.isPending}
                      className="w-full bg-ministry-steel hover:bg-ministry-navy"
                      data-testid="button-submit-rating"
                    >
                      {rateStudy.isPending ? "Submitting..." : "Submit Rating"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
