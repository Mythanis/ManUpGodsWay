import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { triggerRefTagger } from "@/hooks/useRefTagger";
import { isUnauthorizedError } from "@/lib/authUtils";
import { getTierDisplayName } from "@/lib/utils";
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
import { BackButton } from "@/components/BackButton";

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
      className="w-full flex items-center justify-between p-4 bg-black rounded-sm hover:bg-gray-900 transition-colors border-2 border-ministry-gold-exact cursor-pointer shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
      data-testid="button-view-pdf"
    >
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-sm bg-red-600 flex items-center justify-center border-2 border-black">
          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
          </svg>
        </div>
        <div className="text-left flex-1">
          <p className="font-bold uppercase tracking-wide text-white">{studyTitle}</p>
        </div>
      </div>
      <div
        onClick={handleDownload}
        className="p-2 hover:bg-ministry-gold-exact hover:text-black rounded-sm transition-colors border-2 border-ministry-gold-exact"
        data-testid="button-download-pdf-icon"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      className="w-full flex items-center justify-between p-4 bg-black rounded-sm hover:bg-gray-900 transition-colors border-2 border-ministry-gold-exact cursor-pointer shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
      data-testid="button-view-word"
    >
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-sm bg-blue-600 flex items-center justify-center border-2 border-black">
          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
          </svg>
        </div>
        <div className="text-left flex-1">
          <p className="font-bold uppercase tracking-wide text-white text-sm">Word Document</p>
          <p className="text-xs text-gray-400">{studyTitle}</p>
        </div>
      </div>
      <div
        onClick={handleDownload}
        className="p-2 hover:bg-ministry-gold-exact hover:text-black rounded-sm transition-colors border-2 border-ministry-gold-exact"
        data-testid="button-download-word-icon"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
  
  useEffect(() => {
    if (study) {
      triggerRefTagger();
    }
  }, [study]);

  // Check if user has purchased this study
  const { data: hasPurchased, isLoading: purchaseLoading } = useQuery<boolean>({
    queryKey: ["/api/purchases/check", id],
    retry: false,
    enabled: !!id && !!user?.id,
  });

  // Check time-gate status for series studies
  const { data: timeGateStatus } = useQuery<{
    isLocked: boolean;
    unlockTime: string | null;
    previousStudyTitle: string | null;
    message: string | null;
    isAdmin?: boolean;
  }>({
    queryKey: ["/api/studies", id, "time-gate", Intl.DateTimeFormat().resolvedOptions().timeZone],
    queryFn: async () => {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch(`/api/studies/${id}/time-gate?timezone=${encodeURIComponent(timezone)}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch time gate status');
      return res.json();
    },
    retry: false,
    enabled: !!id && !!user?.id,
  });

  // Check consecutive lock status (includes daily drip)
  const { data: consecutiveLockStatus } = useQuery<{
    isLocked: boolean;
    previousStudyTitle: string | null;
    previousStudyId: string | null;
    message: string | null;
    studyNumber: number;
    totalStudiesInSeries: number;
    isLockedByDrip?: boolean;
    unlocksAt?: string;
  }>({
    queryKey: ["/api/studies", id, "consecutive-lock"],
    queryFn: async () => {
      const res = await fetch(`/api/studies/${id}/consecutive-lock`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch consecutive lock status');
      return res.json();
    },
    retry: false,
    enabled: !!id && !!user?.id,
  });

  // Combined lock status - study is locked if either time gate or consecutive lock is active
  const isStudyLocked = timeGateStatus?.isLocked || consecutiveLockStatus?.isLocked;
  const lockMessage = consecutiveLockStatus?.isLocked 
    ? consecutiveLockStatus.message 
    : timeGateStatus?.message;
  const lockUnlockTime = consecutiveLockStatus?.unlocksAt || timeGateStatus?.unlockTime;

  // Countdown timer state
  const [countdown, setCountdown] = useState<string>('');

  // Update countdown every second when locked
  useEffect(() => {
    if (!isStudyLocked || !lockUnlockTime) {
      setCountdown('');
      return;
    }

    const updateCountdown = () => {
      const now = new Date();
      const unlockTime = new Date(lockUnlockTime);
      const diff = unlockTime.getTime() - now.getTime();

      if (diff <= 0) {
        setCountdown('');
        // Invalidate both time-gate and consecutive-lock queries
        queryClient.invalidateQueries({ 
          predicate: (query) => 
            Array.isArray(query.queryKey) && 
            query.queryKey[0] === "/api/studies" && 
            query.queryKey[1] === id && 
            (query.queryKey[2] === "time-gate" || query.queryKey[2] === "consecutive-lock")
        });
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setCountdown(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setCountdown(`${minutes}m ${seconds}s`);
      } else {
        setCountdown(`${seconds}s`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [isStudyLocked, lockUnlockTime, id, queryClient]);

  const { data: progress } = useQuery<UserProgress>({
    queryKey: ["/api/progress", id],
    retry: false,
    enabled: !!id && isAuthenticated,
  });

  // Fetch user's lesson completion data for accurate progress tracking
  const { data: lessonProgressData = [] } = useQuery<any[]>({
    queryKey: [`/api/users/${user?.id}/lesson-progress`],
    enabled: !!user?.id && isAuthenticated,
  });

  // Fetch all lessons for this study to calculate progress
  const { data: studyLessons = [] } = useQuery<any[]>({
    queryKey: [`/api/studies/${id}/lessons`],
    enabled: !!id,
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ministry-gold-exact"></div>
      </div>
    );
  }

  if (!study) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md mx-4 bg-black border-2 border-black">
          <CardContent className="pt-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-white mb-4">Study Not Found</h1>
              <p className="text-sm text-gray-400 mb-4">
                The study you're looking for doesn't exist or has been removed.
              </p>
              <Link href="/library">
                <Button className="bg-ministry-gold-exact text-black hover:bg-ministry-gold font-semibold" data-testid="button-back-to-library">
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
  
  // Calculate progress based on completed lessons
  const lessonsForThisStudy = studyLessons.filter((lesson: any) => lesson.studyId === id);
  const completedLessonsForThisStudy = lessonProgressData.filter(
    (lp: any) => lp.completedAt && lessonsForThisStudy.some((lesson: any) => lesson.id === lp.lessonId)
  );
  
  const progressPercent = lessonsForThisStudy.length > 0 
    ? Math.round((completedLessonsForThisStudy.length / lessonsForThisStudy.length) * 100)
    : 0;

  const getTierColor = (tier: string) => {
    if (tier !== 'free') {
      return 'bg-ministry-gold-exact text-ministry-gold';
    }
    return 'bg-ministry-success/20 text-ministry-success';
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
      
      // If their tier doesn't require purchase, check subscription access
      return study.requiredTier === 'free' || userTier !== 'free';
    }
    
    // Subscription-based access for non-purchasable studies
    return study.requiredTier === 'free' || (user?.subscriptionTier || 'free') !== 'free';
  };

  const hasAccess = canAccess();

  return (
    <div className="pb-20 min-h-screen bg-black">
      <BackButton fallbackPath="/library" />
      {/* Header */}
      <div className="liquid-black text-white px-6 pt-12 pb-6 border-b-4 border-[#FCD000]">
        <div className="flex items-center mb-4 relative z-10">
          <Link href="/library">
            <Button 
              variant="ghost" 
              size="icon"
              className="mr-3 p-2 hover:bg-[#FCD000] hover:text-black text-white rounded-sm border-2 border-[#FCD000]"
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-black tracking-tighter uppercase" data-testid="text-study-title">
              <span className="text-white">{study.title.split(' ')[0]}</span>{' '}
              <span className="text-[#FCD000]">{study.title.split(' ').slice(1).join(' ')}</span>
            </h1>
            <p className="text-[#FCD000] text-sm font-bold uppercase tracking-wide" data-testid="text-study-category">
              {study.category}
            </p>
          </div>
        </div>
      </div>

      {/* Study Info */}
      <div className="px-6 mt-4 mb-6">
        <div className="liquid-black border-2 border-[#FCD000] rounded-sm shadow-[4px_4px_0px_0px_rgba(252,208,0,0.3)]" data-testid="card-study-info">
          <div className="p-6 relative z-10">
            {study.thumbnailUrl && (
              <img 
                src={study.thumbnailUrl} 
                alt={study.title}
                className="w-full h-48 object-cover rounded-sm mb-4 border-2 border-[#FCD000]/30"
                data-testid="img-study-thumbnail"
              />
            )}
            
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                {!(study.requiresPurchase && study.purchaseRequiredTiers?.includes(user?.subscriptionTier || 'free') && !hasPurchased) && (
                  <Badge className="bg-[#FCD000] text-black font-bold uppercase tracking-wide rounded-sm border-2 border-[#FCD000]" data-testid="badge-study-tier">
                    {study.requiredTier !== 'free' ? 'Subscribers Only' : 'Free'}
                  </Badge>
                )}
                {(study.rating && parseFloat(study.rating.toString()) > 0) && (
                  <div className="flex items-center space-x-1 bg-black/50 px-2 py-1 rounded-sm border border-[#FCD000]/30" data-testid="rating-display">
                    <Star className="w-4 h-4 text-[#FCD000] fill-current" />
                    <span className="text-sm font-bold text-white">{study.rating}</span>
                    <span className="text-xs text-gray-400">({study.ratingCount})</span>
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center space-x-1 bg-black/50 px-2 py-1 rounded-sm border border-[#FCD000]/30">
                  <Clock className="w-4 h-4 text-[#FCD000]" />
                  <span className="text-white font-bold">{study.estimatedHours}h</span>
                </div>
                <div className="flex items-center space-x-1 bg-black/50 px-2 py-1 rounded-sm border border-[#FCD000]/30">
                  <Users className="w-4 h-4 text-[#FCD000]" />
                  <span className="text-white font-bold">{study.difficulty}</span>
                </div>
              </div>
            </div>

            <p className="text-white/90 font-medium mb-6" data-testid="text-study-description">
              {study.description}
            </p>

            {/* Time-Gate Locked State */}
            {isStudyLocked && (
              <div className="bg-black border-2 border-ministry-gold-exact rounded-sm p-6 mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" data-testid="time-gate-locked">
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-sm bg-ministry-gold-exact/20 flex items-center justify-center border-2 border-ministry-gold-exact mb-4">
                    <Lock className="w-8 h-8 text-ministry-gold-exact" />
                  </div>
                  <h3 className="font-black uppercase tracking-tight text-ministry-gold-exact text-xl mb-2">Study Locked</h3>
                  
                  {lockMessage && (
                    <p className="text-sm text-gray-400 mb-4">
                      {lockMessage}
                    </p>
                  )}
                  
                  {lockUnlockTime && countdown && (
                    <div className="bg-ministry-gold-exact/10 border-2 border-ministry-gold-exact rounded-sm px-6 py-3 mt-2">
                      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Unlocks in</p>
                      <p className="text-2xl font-black text-ministry-gold-exact tracking-tight">{countdown}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Embedded Study Viewer - Only show when user has access and study has lessons and not time-gated */}
            {hasAccess && !isStudyLocked && user?.id && studyLessons.length > 0 && (
              <div className="mb-6">
                <EmbeddedLessonViewer 
                  studyId={study.id!}
                  totalDays={study.totalDays || undefined}
                  userId={user.id}
                />
              </div>
            )}

            {/* Legacy Study Materials - Show as backup/alternative resources (not when time-gated) */}
            {hasAccess && !isStudyLocked && (study.pdfFilename || study.wordFilename) && (
              <div className="bg-black rounded-sm p-4 mb-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="font-bold uppercase tracking-wide text-ministry-gold-exact mb-2 text-sm flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  ADDITIONAL RESOURCES
                </h3>
                <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide">
                  Downloadable study materials for offline access
                </p>
                <div className="space-y-3">
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
              <div className="bg-black border-2 border-ministry-gold-exact rounded-sm p-4 mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" data-testid="purchase-restriction">
                <h3 className="font-black uppercase tracking-tight text-ministry-gold-exact mb-2">Purchase Required</h3>
                <p className="text-sm text-gray-400 mb-3">
                  This study requires a one-time purchase of {study.price ? `$${parseFloat(study.price).toFixed(2)}` : 'a fee'} to access.
                </p>
                <Button 
                  onClick={() => setPurchasePopupOpen(true)}
                  className="bg-ministry-gold-exact text-black hover:bg-yellow-400 font-bold uppercase tracking-wide rounded-sm border-2 border-black"
                  data-testid="button-purchase-study"
                >
                  Purchase Study
                </Button>
              </div>
            )}

            {!hasAccess && (!study.requiresPurchase || !study.purchaseRequiredTiers?.includes(user?.subscriptionTier || 'free')) && (
              <div className="bg-black border-2 border-ministry-gold-exact rounded-sm p-4 mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" data-testid="access-restriction">
                <h3 className="font-black uppercase tracking-tight text-ministry-gold-exact mb-2">Subscribers Only</h3>
                <p className="text-sm text-gray-400 mb-3">
                  This study requires an active subscription to access.
                </p>
                <Button 
                  className="bg-ministry-gold-exact text-black hover:bg-yellow-400 font-bold uppercase tracking-wide rounded-sm border-2 border-black"
                  data-testid="button-upgrade-access"
                >
                  Subscribe Now
                </Button>
              </div>
            )}

            {/* Join Discussion Section - Only for users with tier access and not time-gated */}
            {studyDiscussion && hasAccess && !isStudyLocked && (
              <div className="flex items-center justify-between p-4 bg-black rounded-sm border-2 border-ministry-gold-exact shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-sm bg-ministry-gold-exact flex items-center justify-center border-2 border-black">
                    <MessageCircle className="w-5 h-5 text-black" />
                  </div>
                  <div>
                    <h3 className="font-bold uppercase tracking-wide text-white">Join Study Discussion</h3>
                    <p className="text-sm text-gray-400">
                      Connect with other members studying "{study.title}"
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => setDiscussionDialogOpen(true)}
                  className="bg-ministry-gold-exact text-black hover:bg-yellow-400 font-bold uppercase tracking-wide rounded-sm border-2 border-black"
                  data-testid="button-join-discussion"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Join
                </Button>
              </div>
            )}
            
            {/* Tier Access Required for Discussion */}
            {studyDiscussion && !hasAccess && (
              <div className="flex items-center justify-between p-4 bg-black rounded-sm border-2 border-ministry-gold-exact shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-sm bg-ministry-gold-exact/20 flex items-center justify-center border-2 border-ministry-gold-exact">
                    <MessageCircle className="w-5 h-5 text-ministry-gold-exact" />
                  </div>
                  <div>
                    <h3 className="font-medium text-white">Study Discussion Available</h3>
                    <p className="text-sm text-gray-400">
                      Subscribe to join the study discussion
                    </p>
                  </div>
                </div>
                <Button
                  disabled
                  className="bg-gray-800 text-gray-500 font-bold uppercase tracking-wide rounded-sm border-2 border-gray-600 opacity-50"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Subscription Required
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {hasAccess && (
        <>
          {/* Progress Section - Only show for studies with lessons */}
          {lessonsForThisStudy.length > 0 && (
            <div className="px-6 mb-6">
              <div className="liquid-black border-2 border-[#FCD000] rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" data-testid="card-progress">
                <div className="p-6 relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-black uppercase tracking-tight text-white">Your Progress</h2>
                    <span className="text-sm text-black font-bold uppercase tracking-wide bg-ministry-gold-exact px-2 py-1 rounded-sm border-2 border-black" data-testid="text-progress-status">
                      {progressPercent === 100 ? 'Completed' : 'In Progress'}
                    </span>
                  </div>
                  
                  <div className="mb-2">
                    <div className="flex justify-between items-center text-sm text-gray-300 font-bold uppercase tracking-wide">
                      <span>{completedLessonsForThisStudy.length} of {lessonsForThisStudy.length} lessons</span>
                      <span className="text-ministry-gold-exact">{progressPercent}%</span>
                    </div>
                  </div>
                  
                  <Progress value={progressPercent} className="mb-4 bg-gray-700 [&>div]:bg-ministry-gold-exact rounded-sm h-3" data-testid="progress-bar" />

                  {progressPercent === 100 && (
                    <div className="bg-ministry-gold-exact border-2 border-black rounded-sm p-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-sm bg-black flex items-center justify-center border-2 border-black">
                          <svg className="w-5 h-5 text-ministry-gold-exact" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-black uppercase tracking-tight text-black text-lg">STUDY COMPLETED!</h3>
                          <p className="text-sm text-black/80">Congratulations on finishing this study and growing in your Faith journey.</p>
                          {userProgress?.completedAt && (
                            <p className="text-xs text-black/60 mt-1 font-bold uppercase">
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
                </div>
              </div>
            </div>
          )}

          {/* Video Section */}
          {study.videoUrl && (
            <div className="px-6 mb-6">
              <div className="liquid-black border-2 border-[#FCD000] rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" data-testid="card-video">
                <div className="p-6 relative z-10">
                  <h2 className="text-lg font-black uppercase tracking-tight text-white mb-4">Study Video</h2>
                  <div className="relative bg-gray-900 rounded-sm overflow-hidden border-2 border-black">
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
                </div>
              </div>
            </div>
          )}

          {/* Content Section */}
          <div className="px-6 mb-6">
            <div className="liquid-black border-2 border-[#FCD000] rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" data-testid="card-content">
              <div className="p-6 relative z-10">
                <h2 className="text-lg font-black uppercase tracking-tight text-white mb-4">Study Content</h2>
                <div className="prose prose-sm max-w-none text-gray-300 prose-invert" data-testid="text-study-content">
                  {study.content ? (
                    <div dangerouslySetInnerHTML={{ __html: study.content.replace(/\n/g, '<br>') }} />
                  ) : (
                    <p className="text-gray-400">Study materials are available as downloadable documents above.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Rating Section */}
          <div className="px-6 mb-6">
            <div className="liquid-black border-2 border-[#FCD000]/30 rounded-sm shadow-[4px_4px_0px_0px_rgba(252,208,0,0.3)]" data-testid="card-rating">
              <div className="p-6 relative z-10">
                <h2 className="text-lg font-black uppercase tracking-tight text-[#FCD000] mb-4">Rate This Study</h2>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmitRating)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="rating"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[#FCD000] font-bold uppercase tracking-wide">Rating</FormLabel>
                          <FormControl>
                            <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value?.toString()}>
                              <SelectTrigger className="bg-gray-800 border-2 border-[#FCD000]/30 text-white rounded-sm" data-testid="select-rating">
                                <SelectValue placeholder="Select rating" />
                              </SelectTrigger>
                              <SelectContent className="bg-black border-2 border-ministry-gold-exact rounded-sm">
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
                          <FormLabel className="text-[#FCD000] font-bold uppercase tracking-wide">Review (Optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Share your thoughts about this study..."
                              className="min-h-[100px] bg-gray-800 border-2 border-[#FCD000]/30 text-white placeholder:text-gray-400 rounded-sm"
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
                      className="w-full bg-[#FCD000] text-black hover:bg-[#FCD000]/90 font-bold uppercase tracking-wide rounded-sm border-2 border-[#FCD000]"
                      data-testid="button-submit-rating"
                    >
                      {rateStudy.isPending ? "Submitting..." : "Submit Rating"}
                    </Button>
                  </form>
                </Form>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Study Discussion Dialog Pop-out */}
      <Dialog open={discussionDialogOpen} onOpenChange={setDiscussionDialogOpen}>
        <DialogContent className="!max-w-2xl !w-[95vw] max-h-[85svh] flex flex-col p-0 overflow-hidden border border-[#FCD000]/30" style={{ backgroundColor: '#111111', color: 'white' }}>
          <DialogHeader className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-white/10">
            <DialogTitle className="flex items-center gap-2 text-base text-white">
              <MessageCircle className="w-4 h-4 text-ministry-gold-exact" />
              <span className="truncate">Study Discussion: {study?.title}</span>
            </DialogTitle>
          </DialogHeader>
          
          {studyDiscussion && (
            <>
              {/* Discussion Content Area - Scrollable */}
              <div className="discussion-content-area overflow-y-auto flex-1 px-4 py-3 space-y-4">
                {/* Discussion Header */}
                <div className="border-b border-white/10 pb-3">
                  <p className="text-sm text-white/70">{studyDiscussion.content}</p>
                  <div className="flex items-center justify-end mt-2">
                    <DiscussionSubscriptionButton discussionId={studyDiscussion.id} />
                  </div>
                </div>

                {/* Replies Section */}
                <StudyDiscussionReplies discussionId={studyDiscussion.id} />

                {/* Access Warning for users without permission */}
                {!canAccess && (
                  <div className="text-center py-8">
                    <p className="text-sm text-white/60">
                      {study?.requiredTier && study.requiredTier !== 'free' 
                        ? 'An active subscription is required to participate in this discussion.'
                        : 'You need access to this study to participate in the discussion.'
                      }
                    </p>
                  </div>
                )}
              </div>

              {/* Reply Form - Normal flow at bottom */}
              {hasAccess && (
                <div className="discussion-reply-form px-4 py-3 bg-ministry-navy/90">
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
          study={study as any}
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
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-ministry-gold-exact mx-auto mb-2"></div>
        <p className="text-sm text-white/60">Loading replies...</p>
      </div>
    );
  }

  if (replies.length === 0) {
    return (
      <div className="text-center py-8">
        <MessageCircle className="w-8 h-8 text-white/30 mx-auto mb-2" />
        <p className="text-white/60">No replies yet</p>
        <p className="text-sm text-white/40">Be the first to reply!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {replies.map((reply: any) => (
        <div key={reply.id} className="flex items-start space-x-3 p-3 bg-white/5 rounded-lg border border-white/10">
          <img 
            src={reply.user?.profileImageUrl || `https://ui-avatars.com/api/?name=${reply.user?.firstName}+${reply.user?.lastName}&background=1B3B6F&color=fff&size=32`}
            alt={`${reply.user?.firstName} ${reply.user?.lastName}`}
            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm text-white">
                {reply.user?.firstName} {reply.user?.lastName?.charAt(0)}.
              </span>
              <span className="text-xs text-white/50">
                {getTimeAgo(reply.createdAt)}
              </span>
            </div>
            <p className="text-sm text-white/80">{reply.content}</p>
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
      const hasAccess = currentUserTier !== 'free';
      
      if (!hasAccess) {
        toast({
          title: "Access Restricted",
          description: `This study discussion requires an active subscription to participate.`,
          variant: "destructive",
        });
        return;
      }
    }
    
    await createReply.mutateAsync(data);
  };

  // Check if user has access to reply
  const hasReplyAccess = study?.requiredTier && study.requiredTier !== 'free' ?
    currentUserTier !== 'free' : true;

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
                  placeholder={hasReplyAccess ? "Write your reply..." : "Subscription required to reply"}
                  className="min-h-[80px] resize-none bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-ministry-gold-exact"
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
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold bg-ministry-gold-exact text-black hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
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
