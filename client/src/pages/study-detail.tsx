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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertStudyRatingSchema, type Study, type UserProgress, type Discussion } from "@shared/schema";
import { ArrowLeft, Play, Clock, Users, Star, MessageCircle, Send, Lock } from "lucide-react";
import { Link } from "wouter";
import { z } from "zod";
import { DiscussionSubscriptionButton } from "@/components/discussion-subscription-button";
import { PurchasePopup } from "@/components/purchase-popup";
import { EmbeddedLessonViewer } from "@/components/embedded-lesson-viewer";

const ratingSchema = insertStudyRatingSchema.pick({ rating: true, review: true });

const replySchema = z.object({
  content: z.string().min(1, "Reply content is required"),
});

function PDFTextViewer({ studyId, studyTitle }: { studyId: string; studyTitle: string }) {
  const [, navigate] = useLocation();

  const handleOpenDocument = () => {
    navigate(`/studies/${studyId}/document`);
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`/api/studies/${studyId}/pdf-file`, '_blank');
  };

  return (
    <div
      onClick={handleOpenDocument}
      className="w-full flex items-center justify-between p-4 bg-black rounded-lg hover:bg-gray-900 transition-colors border border-gray-800 cursor-pointer"
      data-testid="button-view-pdf"
    >
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded bg-red-100 flex items-center justify-center">
          <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
          </svg>
        </div>
        <div className="text-left flex-1">
          <p className="font-medium text-white">{studyTitle}</p>
        </div>
      </div>
      <div
        onClick={handleDownload}
        className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
        data-testid="button-download-pdf-icon"
      >
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      </div>
    </div>
  );
}

function WordDocumentViewer({ studyId, studyTitle }: { studyId: string; studyTitle: string }) {
  const [, navigate] = useLocation();

  const handleOpenDocument = () => {
    navigate(`/studies/${studyId}/word`);
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`/api/studies/${studyId}/word-file`, '_blank');
  };

  return (
    <div
      onClick={handleOpenDocument}
      className="w-full flex items-center justify-between p-3 bg-white dark:bg-card rounded-lg hover:bg-gray-50 dark:hover:bg-secondary transition-colors border border-gray-200 dark:border-border cursor-pointer"
      data-testid="button-view-word"
    >
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
          </svg>
        </div>
        <div className="text-left flex-1">
          <p className="font-medium text-sm text-gray-900 dark:text-white">Word Document</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{studyTitle}</p>
        </div>
      </div>
      <div
        onClick={handleDownload}
        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors"
        data-testid="button-download-word-icon"
      >
        <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      </div>
    </div>
  );
}

export default function StudyDetail() {
  const { id } = useParams<{ id: string }>();
  const [discussionDialogOpen, setDiscussionDialogOpen] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [purchasePopupOpen, setPurchasePopupOpen] = useState(false);
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Detect virtual keyboard visibility on mobile
  useEffect(() => {
    if (typeof window === 'undefined' || !discussionDialogOpen) return;
    
    let initialViewportHeight = window.visualViewport?.height || window.innerHeight;
    
    const handleViewportChange = () => {
      const currentHeight = window.visualViewport?.height || window.innerHeight;
      const heightDifference = initialViewportHeight - currentHeight;
      
      console.log('Viewport change:', { initialViewportHeight, currentHeight, heightDifference });
      
      // If viewport height decreased by more than 100px, keyboard is likely visible
      const keyboardVisible = heightDifference > 100;
      setIsKeyboardVisible(keyboardVisible);
      
      // Also add CSS class directly to body for global styling
      if (keyboardVisible) {
        document.body.classList.add('keyboard-visible');
      } else {
        document.body.classList.remove('keyboard-visible');
      }
    };
    
    // Reset initial height when dialog opens
    initialViewportHeight = window.visualViewport?.height || window.innerHeight;
    
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      return () => {
        window.visualViewport?.removeEventListener('resize', handleViewportChange);
        document.body.classList.remove('keyboard-visible');
      };
    } else {
      window.addEventListener('resize', handleViewportChange);
      return () => {
        window.removeEventListener('resize', handleViewportChange);
        document.body.classList.remove('keyboard-visible');
      };
    }
  }, [discussionDialogOpen]);

  // Additional keyboard detection using input focus (fallback method)
  useEffect(() => {
    if (!discussionDialogOpen) return;

    const handleInputFocus = () => {
      // Small delay to allow keyboard to appear
      setTimeout(() => {
        const currentHeight = window.visualViewport?.height || window.innerHeight;
        const windowHeight = window.innerHeight;
        
        console.log('Input focus - heights:', { currentHeight, windowHeight });
        
        if (currentHeight < windowHeight * 0.8) {
          setIsKeyboardVisible(true);
          document.body.classList.add('keyboard-visible');
        }
      }, 300);
    };

    const handleInputBlur = () => {
      setTimeout(() => {
        setIsKeyboardVisible(false);
        document.body.classList.remove('keyboard-visible');
      }, 300);
    };

    // Add listeners to all text inputs and textareas in the dialog
    const textInputs = document.querySelectorAll('textarea, input[type="text"]');
    
    textInputs.forEach(input => {
      input.addEventListener('focus', handleInputFocus);
      input.addEventListener('blur', handleInputBlur);
    });

    return () => {
      textInputs.forEach(input => {
        input.removeEventListener('focus', handleInputFocus);
        input.removeEventListener('blur', handleInputBlur);
      });
    };
  }, [discussionDialogOpen]);

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

  // Check if user has purchased this study
  const { data: hasPurchased, isLoading: purchaseLoading } = useQuery<boolean>({
    queryKey: ["/api/purchases/check", id],
    retry: false,
    enabled: !!id && !!user?.id,
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

  // Progress data is handled directly from the query

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
              <h1 className="text-2xl font-bold text-foreground mb-4">Study Not Found</h1>
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
  // Progress is now based on completion status, not lessons
  const progressPercent = userProgress?.status === 'completed' ? 100 : 0;

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'premium':
        return 'bg-ministry-steel/20 text-ministry-steel';
      case 'vip':
        return 'bg-ministry-gold-exact/20 text-ministry-gold';
      default:
        return 'bg-ministry-success/20 text-ministry-success';
    }
  };

  // Check access based on purchase status or tier
  const canAccess = () => {
    if (!study) return false;
    
    // If study requires purchase, check if user has purchased it
    if (study.requiresPurchase) {
      // If user has purchased, they have access regardless of tier
      if (hasPurchased) return true;
      
      // If study requires purchase for their tier, they need to purchase
      const userTier = user?.subscriptionTier || 'free';
      if (study.purchaseRequiredTiers?.includes(userTier)) {
        return false; // Need to purchase
      }
      
      // If their tier doesn't require purchase, check normal tier access
      return study.requiredTier === 'free' || 
             (study.requiredTier === 'premium' && ['premium', 'vip'].includes(userTier)) ||
             (study.requiredTier === 'vip' && userTier === 'vip');
    }
    
    // Normal tier-based access for non-purchasable studies
    return study.requiredTier === 'free' || 
           (study.requiredTier === 'premium' && ['premium', 'vip'].includes(user?.subscriptionTier || '')) ||
           (study.requiredTier === 'vip' && user?.subscriptionTier === 'vip');
  };

  const hasAccess = canAccess();

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-ministry-charcoal to-ministry-steel text-white px-6 pt-12 pb-6">
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
              {study.category}
            </p>
          </div>
        </div>
      </div>

      {/* Study Info */}
      <div className="px-6 -mt-3 relative z-10 mb-6">
        <Card className="shadow-lg bg-ministry-gold-exact/20" data-testid="card-study-info">
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
                {/* Only show tier badge if study doesn't require purchase for this user */}
                {!(study.requiresPurchase && study.purchaseRequiredTiers?.includes(user?.subscriptionTier || 'free') && !hasPurchased) && (
                  <Badge className={getTierColor(study.requiredTier || 'free')} data-testid="badge-study-tier">
                    {study.requiredTier || 'free'}
                  </Badge>
                )}
                {(study.rating && parseFloat(study.rating.toString()) > 0) && (
                  <div className="flex items-center space-x-1" data-testid="rating-display">
                    <Star className="w-4 h-4 text-black fill-current" />
                    <span className="text-sm font-medium">{study.rating}</span>
                    <span className="text-xs text-black">({study.ratingCount} reviews)</span>
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-4 text-sm text-black">
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

            <p className="text-black mb-6" data-testid="text-study-description">
              {study.description}
            </p>

            {/* Embedded Study Viewer - Always show when user has access */}
            {hasAccess && user?.id && (
              <div className="mb-6">
                <EmbeddedLessonViewer 
                  studyId={study.id!}
                  totalDays={study.totalDays || undefined}
                  userId={user.id}
                />
              </div>
            )}

            {/* Legacy Study Materials - Show as backup/alternative resources */}
            {hasAccess && (study.pdfFilename || study.wordFilename) && (
              <div className="bg-ministry-slate/5 rounded-lg p-4 mb-6 border border-ministry-slate/20">
                <h3 className="font-semibold text-ministry-slate mb-2 text-sm flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Additional Resources
                </h3>
                <p className="text-xs text-ministry-slate/70 mb-3">
                  Downloadable study materials for offline access
                </p>
                <div className="space-y-2">
                  {study.pdfFilename && (
                    <PDFTextViewer studyId={study.id!} studyTitle={study.title} />
                  )}
                  {study.wordFilename && (
                    <WordDocumentViewer studyId={study.id!} studyTitle={study.wordOriginalName || study.title} />
                  )}
                </div>
              </div>
            )}

            {!hasAccess && study.requiresPurchase && study.purchaseRequiredTiers?.includes(user?.subscriptionTier || 'free') && (
              <div className="bg-ministry-gold/10 border border-ministry-gold/20 rounded-lg p-4 mb-6" data-testid="purchase-restriction">
                <h3 className="font-semibold text-ministry-charcoal mb-2">Purchase Required</h3>
                <p className="text-sm text-ministry-slate mb-3">
                  This study requires a one-time purchase of {study.price ? `$${parseFloat(study.price).toFixed(2)}` : 'a fee'} to access.
                </p>
                <Button 
                  onClick={() => setPurchasePopupOpen(true)}
                  className="bg-ministry-gold text-ministry-navy hover:bg-ministry-gold/90"
                  data-testid="button-purchase-study"
                >
                  Purchase Study
                </Button>
              </div>
            )}

            {!hasAccess && (!study.requiresPurchase || !study.purchaseRequiredTiers?.includes(user?.subscriptionTier || 'free')) && (
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
            {studyDiscussion && hasAccess && (
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
                  onClick={() => setDiscussionDialogOpen(true)}
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
            {studyDiscussion && !hasAccess && (
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
            <Card className="bg-ministry-gold-exact/20" data-testid="card-progress">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-black">Your Progress</h2>
                  <span className="text-sm text-black font-bold" data-testid="text-progress-status">
                    {progressPercent === 100 ? 'Completed' : 'In Progress'}
                  </span>
                </div>
                
                <Progress value={progressPercent} className="mb-4" data-testid="progress-bar" />

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
                        <p className="text-sm text-black">Congratulations on finishing this study and growing in your faith journey.</p>
                        {userProgress?.completedAt && (
                          <p className="text-xs text-black mt-1 font-medium">
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
                    <p>Study materials are available as downloadable documents above.</p>
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

      {/* Study Discussion Dialog Pop-out */}
      <Dialog open={discussionDialogOpen} onOpenChange={setDiscussionDialogOpen}>
        <DialogContent className={`max-w-4xl max-h-[80vh] flex flex-col p-4 sm:p-6 w-full sm:mx-auto overflow-hidden ${isKeyboardVisible ? 'keyboard-visible' : ''}`}>
          <DialogHeader className="flex-shrink-0 pb-2 sm:pb-4">
            <DialogTitle className="flex items-center space-x-2 text-lg sm:text-xl">
              <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-ministry-navy" />
              <span className="truncate">Study Discussion: {study?.title}</span>
            </DialogTitle>
          </DialogHeader>
          
          {studyDiscussion && (
            <>
              {/* Discussion Content Area - Scrollable */}
              <div className="discussion-content-area">
                {/* Discussion Header */}
                <div className="border-b pb-4 mb-4">
                  <div className="flex items-start space-x-3 mb-2">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-ministry-navy/10 flex items-center justify-center">
                      <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 text-ministry-navy" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="font-bold text-base sm:text-lg text-ministry-charcoal truncate">
                          {studyDiscussion.title}
                        </h3>
                        <Badge variant="default" className="text-xs bg-ministry-navy text-white flex-shrink-0">
                          📚 Study
                        </Badge>
                      </div>
                      <p className="text-sm text-ministry-slate mb-1 truncate">Discussion for "{study?.title}" study</p>
                      <p className="text-sm text-ministry-slate mb-2">{studyDiscussion.content}</p>
                      <div className="flex items-center justify-end">
                        <DiscussionSubscriptionButton discussionId={studyDiscussion.id} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Replies Section */}
                <div className="space-y-4">
                  <StudyDiscussionReplies discussionId={studyDiscussion.id} />
                </div>

                {/* Access Warning for users without permission */}
                {!canAccess && (
                  <div className="text-center py-8">
                    <p className="text-sm text-ministry-slate">
                      {study?.requiredTier && study.requiredTier !== 'free' 
                        ? `${study.requiredTier.charAt(0).toUpperCase() + study.requiredTier.slice(1)} subscription required to participate in this discussion.`
                        : 'You need access to this study to participate in the discussion.'
                      }
                    </p>
                  </div>
                )}
              </div>

              {/* Reply Form - Fixed at Bottom */}
              {canAccess && (
                <div className="discussion-reply-form">
                  <StudyDiscussionReplyForm 
                    discussionId={studyDiscussion.id}
                    currentUserTier={(user as any)?.subscriptionTier || 'free'}
                    study={study}
                  />
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Purchase Popup */}
      {purchasePopupOpen && study && (
        <PurchasePopup
          study={study}
          isOpen={purchasePopupOpen}
          onClose={() => setPurchasePopupOpen(false)}
          onPurchaseComplete={() => {
            // Invalidate purchase check query to update access
            queryClient.invalidateQueries({ queryKey: ["/api/purchases/check", id] });
            setPurchasePopupOpen(false);
            toast({
              title: "Purchase Complete",
              description: "You now have access to this study!",
            });
          }}
        />
      )}
    </div>
  );
}

// Component for displaying study discussion replies
function StudyDiscussionReplies({ discussionId }: { discussionId: string }) {
  const { data: replies = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/discussions", discussionId, "replies"],
    retry: false,
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
  });

  if (isLoading) {
    return (
      <div className="text-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-ministry-navy mx-auto mb-2"></div>
        <p className="text-sm text-ministry-slate">Loading replies...</p>
      </div>
    );
  }

  if (replies.length === 0) {
    return (
      <div className="text-center py-8">
        <MessageCircle className="w-8 h-8 text-ministry-slate mx-auto mb-2" />
        <p className="text-ministry-slate">No replies yet</p>
        <p className="text-sm text-ministry-slate">Be the first to reply!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {replies.map((reply: any) => (
        <div key={reply.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
          <img 
            src={reply.user?.profileImageUrl || `https://ui-avatars.com/api/?name=${reply.user?.firstName}+${reply.user?.lastName}&background=4A90B8&color=fff&size=32`}
            alt={`${reply.user?.firstName} ${reply.user?.lastName}`}
            className="w-8 h-8 rounded-full object-cover"
          />
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <span className="font-medium text-sm text-ministry-charcoal">
                {reply.user?.firstName} {reply.user?.lastName?.charAt(0)}.
              </span>
              <span className="text-xs text-ministry-slate">
                • {getTimeAgo(reply.createdAt)}
              </span>
            </div>
            <p className="text-sm text-ministry-slate">{reply.content}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// Component for adding new replies
function StudyDiscussionReplyForm({ discussionId, currentUserTier, study }: { 
  discussionId: string; 
  currentUserTier: string; 
  study: any;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm({
    resolver: zodResolver(replySchema),
    defaultValues: {
      content: '',
    },
  });

  const createReply = useMutation({
    mutationFn: async (data: z.infer<typeof replySchema>) => {
      const response = await apiRequest('POST', `/api/discussions/${discussionId}/replies`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discussions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/discussions", discussionId, "replies"] });
      toast({
        title: "Success",
        description: "Reply posted successfully!",
      });
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to post reply: ${error.message || 'Please try again.'}`,
        variant: "destructive",
      });
    },
  });

  const onSubmitReply = async (data: z.infer<typeof replySchema>) => {
    if (!(user as any)?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to reply",
        variant: "destructive",
      });
      return;
    }
    
    // Check tier access for study discussions
    if (study?.requiredTier && study.requiredTier !== 'free') {
      const hasAccess = (study.requiredTier === 'premium' && ['premium', 'vip'].includes(currentUserTier)) ||
                       (study.requiredTier === 'vip' && currentUserTier === 'vip');
      
      if (!hasAccess) {
        toast({
          title: "Access Restricted",
          description: `This study discussion requires ${study.requiredTier} subscription to participate.`,
          variant: "destructive",
        });
        return;
      }
    }
    
    await createReply.mutateAsync(data);
  };

  // Check if user has access to reply
  const hasReplyAccess = study?.requiredTier && study.requiredTier !== 'free' ?
    ((study.requiredTier === 'premium' && ['premium', 'vip'].includes(currentUserTier)) ||
     (study.requiredTier === 'vip' && currentUserTier === 'vip')) : true;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmitReply)} className="space-y-3">
        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Textarea
                  placeholder={hasReplyAccess ? "Write your reply..." : `${study?.requiredTier || 'Premium'} subscription required to reply`}
                  className="min-h-[80px] resize-none"
                  disabled={!hasReplyAccess || createReply.isPending}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={createReply.isPending || !hasReplyAccess}
            style={{
              backgroundColor: 'hsl(0 0% 0%)',
              color: 'white',
              border: '1px solid hsl(0 0% 0%)',
              borderRadius: '0.375rem',
              padding: '0.375rem 0.75rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              cursor: (createReply.isPending || !hasReplyAccess) ? 'default' : 'pointer',
              opacity: (createReply.isPending || !hasReplyAccess) ? 0.6 : 1,
              transition: 'opacity 0.2s'
            }}
          >
            <Send className="w-3 h-3" />
            {createReply.isPending ? "Posting..." : "Post Reply"}
          </button>
        </div>
      </form>
    </Form>
  );
}

// Helper function for time formatting
function getTimeAgo(date: string) {
  const now = new Date();
  const posted = new Date(date);
  const diffInHours = Math.floor((now.getTime() - posted.getTime()) / (1000 * 60 * 60));
  
  if (diffInHours < 1) return 'Just now';
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
}
