import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, BookOpen, CheckCircle, Layers, ChevronRight, Lock, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { BackButton } from "@/components/BackButton";
import { apiRequest } from "@/lib/queryClient";

interface LessonInSeries {
  id: string;
  title: string;
  dayNumber: number;
  isCompleted: boolean;
  isLocked: boolean;
  unlocksAt?: string | null;
}

interface StudyInSeries {
  id: string;
  title: string;
  description: string;
  thumbnailUrl?: string | null;
  requiredTier: string;
  totalDays: number;
  seriesOrder: number;
  progress: {
    currentDay: number;
    isCompleted: boolean;
    completedAt: string | null;
  } | null;
  completedLessons: number;
  totalLessons: number;
  lessons: LessonInSeries[];
  isLockedByPrevious?: boolean;
  isLockedByDrip?: boolean;
  isScheduledFuture?: boolean;
  unlocksAt?: string | null;
  studyNumber?: number;
  totalStudiesInSeries?: number;
}

interface Series {
  id: string;
  title: string;
  description: string;
  category: string;
  thumbnailUrl: string | null;
}

export default function SeriesDetail() {
  const [, params] = useRoute("/series/:id");
  const seriesId = params?.id;
  const { user, isAuthenticated } = useAuth();

  const { data: series, isLoading: seriesLoading } = useQuery<Series>({
    queryKey: ["/api/study-series", seriesId],
    queryFn: async () => {
      const res = await fetch(`/api/study-series/${seriesId}`);
      if (!res.ok) throw new Error('Failed to fetch series');
      return res.json();
    },
    enabled: !!seriesId,
  });

  const { data: studies = [], isLoading: studiesLoading } = useQuery<StudyInSeries[]>({
    queryKey: ["/api/study-series", seriesId, "studies"],
    queryFn: async () => {
      const res = await fetch(`/api/study-series/${seriesId}/studies`);
      if (!res.ok) throw new Error('Failed to fetch studies');
      return res.json();
    },
    enabled: !!seriesId,
  });

  const { data: activeStudyInfo } = useQuery<{
    activeSeriesId: string | null;
    activeTopicalStudyId: string | null;
  }>({
    queryKey: ["/api/user/active-studies"],
    enabled: isAuthenticated,
    retry: false,
  });

  const queryClient = useQueryClient();
  const isLoading = seriesLoading || studiesLoading;

  // This series is locked when the user is actively working on a DIFFERENT series
  const isSeriesTypeLocked =
    isAuthenticated &&
    !!activeStudyInfo?.activeSeriesId &&
    activeStudyInfo.activeSeriesId !== seriesId;

  const startSeriesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/study-series/${seriesId}/start`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/study-series", seriesId, "studies"] });
    },
  });

  const totalLessons = studies.reduce((sum, s) => sum + (s.totalLessons || 0), 0);
  const completedLessons = studies.reduce((sum, s) => sum + (s.completedLessons || 0), 0);
  const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const completedStudies = studies.filter(s => s.progress?.isCompleted).length;

  const getButtonLabel = (study: StudyInSeries) => {
    if (study.progress?.isCompleted) return 'Review';
    if (study.progress && study.completedLessons > 0) return 'Continue';
    return 'Start';
  };

  const canAccessStudy = (study: StudyInSeries) => {
    if (study.requiredTier === 'free') return true;
    if (!user) return false;
    const u = user as any;
    if (u.role === 'admin' || u.role === 'owner') return true;
    if (u.subscriptionStatus === 'active') return true;
    // Platform trial: user has a time-limited trial (not Stripe-based)
    if (u.subscriptionStatus === 'trial' && u.trialEndDate && new Date(u.trialEndDate) > new Date()) return true;
    // Cancelled subscribers retain access until their paid period ends
    if (u.subscriptionStatus === 'cancelled' && u.subscriptionExpiresAt && new Date(u.subscriptionExpiresAt) > new Date()) return true;
    // Stripe past_due: payment failed but the webhook only sets status='past_due',
    // it does NOT downgrade subscriptionTier — use tier as fallback (matches backend isSubscriber check)
    if (u.subscriptionTier === 'subscriber') return true;
    return false;
  };

  const isLockedByConsecutive = (study: StudyInSeries) => {
    return study.isLockedByPrevious === true;
  };

  const getPreviousStudyTitle = (index: number): string | null => {
    if (index <= 0) return null;
    return studies[index - 1]?.title || null;
  };

  const getPreviousStudyProgress = (index: number): { completed: number; total: number } | null => {
    if (index <= 0) return null;
    const prev = studies[index - 1];
    if (!prev) return null;
    return { completed: prev.completedLessons ?? 0, total: prev.totalLessons ?? 0 };
  };

  const formatUnlockDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';
    const unlockDate = new Date(dateStr);
    const now = new Date();
    const msRemaining = unlockDate.getTime() - now.getTime();
    
    if (msRemaining <= 0) {
      return 'now';
    }
    
    const hoursRemaining = Math.ceil(msRemaining / (1000 * 60 * 60));
    
    if (hoursRemaining <= 1) {
      const minutesRemaining = Math.ceil(msRemaining / (1000 * 60));
      return `in ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}`;
    }
    
    if (hoursRemaining < 24) {
      return `in ${hoursRemaining} hour${hoursRemaining !== 1 ? 's' : ''}`;
    }
    
    // Check if it's tomorrow
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);
    
    if (unlockDate <= tomorrow) {
      return 'tomorrow';
    }
    
    return unlockDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const handleStudyClick = async (study: StudyInSeries, index: number) => {
    if (index === 0 && !study.progress) {
      await startSeriesMutation.mutateAsync();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FCD000]"></div>
      </div>
    );
  }

  if (!series) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4 font-bold uppercase">Series not found</p>
          <Link href="/library">
            <Button className="bg-[#FCD000] text-black font-black uppercase tracking-wide rounded-sm border-2 border-black hover:bg-yellow-400">
              Back to Library
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (isSeriesTypeLocked) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center">
        <BackButton />
        <div className="bg-black border-2 border-[#FCD000] rounded-sm p-8 max-w-sm w-full shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="w-14 h-14 rounded-sm bg-[#FCD000] flex items-center justify-center mx-auto mb-4 border-2 border-black">
            <Lock className="w-8 h-8 text-black" />
          </div>
          <h2 className="text-xl font-black uppercase tracking-tight text-[#FCD000] mb-2">Series Locked</h2>
          <p className="text-white/80 text-sm mb-6">
            You can only work on one series at a time. Complete your current series before starting a new one.
          </p>
          <Link href="/library">
            <Button className="w-full bg-[#FCD000] text-black font-black uppercase tracking-wide rounded-sm border-2 border-black hover:bg-yellow-400 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              Back to Library
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-20">
      <BackButton />
      
      {/* Header */}
      <div className="liquid-black text-white px-6 pt-12 pb-6 border-b-4 border-[#FCD000]">
        <Link href="/library">
          <button className="flex items-center text-[#FCD000] hover:text-yellow-300 mb-4 text-sm font-bold uppercase tracking-wide" data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Library
          </button>
        </Link>
        
        <div className="flex items-start gap-4 relative z-10">
          <div className="flex-shrink-0 w-16 h-16 bg-[#FCD000] rounded-sm flex items-center justify-center border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
            {series.thumbnailUrl ? (
              <img 
                src={series.thumbnailUrl} 
                alt={series.title}
                className="w-full h-full object-cover rounded-sm"
              />
            ) : (
              <Layers className="w-8 h-8 text-black" />
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-black tracking-tight uppercase mb-1" data-testid="text-series-title">
              <span className="text-white">{series.title.split(' ')[0]}</span>{' '}
              <span className="text-[#FCD000]">{series.title.split(' ').slice(1).join(' ')}</span>
            </h1>
            <p className="text-[#FCD000] text-sm font-bold uppercase tracking-wide">
              {series.category}
            </p>
            <p className="text-gray-300 text-sm mt-2">
              {series.description}
            </p>
          </div>
        </div>
      </div>

      {/* Progress Overview */}
      {isAuthenticated && studies.length > 0 && (
        <div className="px-6 mt-6 mb-6">
          <Card className="bg-[#FCD000] text-black border-2 border-black rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <CardContent className="p-4 relative z-10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-black font-bold uppercase tracking-wide">Series Progress</span>
                <span className="text-sm font-black text-black" data-testid="text-progress-percent">
                  {progressPercent}%
                </span>
              </div>
              <div className="h-3 bg-white border-2 border-black rounded-sm overflow-hidden mb-3">
                <div 
                  className="h-full bg-black transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-black/70 font-bold uppercase">
                <span>{completedLessons} of {totalLessons} lessons completed</span>
                <span>{completedStudies} of {studies.length} studies completed</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Studies / Lessons List */}
      <div className="px-6">
        <h2 className="text-white font-black text-lg mb-4 uppercase tracking-tight">
          Studies in this Series ({studies.length})
        </h2>

        {studies.length === 0 && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-[#FCD000] rounded-sm flex items-center justify-center mx-auto mb-4 border-2 border-black">
              <BookOpen className="w-8 h-8 text-black" />
            </div>
            <p className="text-gray-400 font-bold uppercase">No studies in this series yet.</p>
          </div>
        )}

        <div className="space-y-6">
          {studies.map((study, studyIndex) => {
            const hasAccess = canAccessStudy(study);
            const isConsecutiveLocked = isLockedByConsecutive(study);
            const previousTitle = getPreviousStudyTitle(studyIndex);
            const prevProgress = getPreviousStudyProgress(studyIndex);
            const studyProgress = study.totalLessons > 0
              ? Math.round((study.completedLessons / study.totalLessons) * 100)
              : 0;
            const weekLabel = `Week ${study.seriesOrder ?? studyIndex + 1}`;

            return (
              <div key={study.id} data-testid={`study-section-${study.id}`}>
                {/* ── Week header ── */}
                <div className={`relative flex items-center gap-3 px-4 py-3 border-2 border-black rounded-sm mb-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] ${
                  study.progress?.isCompleted
                    ? 'bg-green-900/60 border-green-700'
                    : 'bg-[#FCD000]'
                }`}>
                  {/* Week thumbnail / badge */}
                  <div className={`relative flex-shrink-0 w-16 h-16 rounded-sm border-2 border-black overflow-hidden flex flex-col items-center justify-center ${
                    study.progress?.isCompleted ? 'bg-green-800' : 'bg-black'
                  }`}>
                    {study.thumbnailUrl ? (
                      <>
                        <img
                          src={study.thumbnailUrl}
                          alt={study.title}
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        {/* Only show icon overlays on thumbnail (completed / locked), no WK text */}
                        {(study.progress?.isCompleted || isConsecutiveLocked) && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            {study.progress?.isCompleted
                              ? <CheckCircle className="w-6 h-6 text-green-400" />
                              : <Lock className="w-5 h-5 text-[#FCD000]" />
                            }
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        {study.progress?.isCompleted ? (
                          <CheckCircle className="w-6 h-6 text-green-400" />
                        ) : isConsecutiveLocked ? (
                          <Lock className="w-5 h-5 text-[#FCD000]" />
                        ) : (
                          <>
                            <span className="text-[9px] font-black uppercase tracking-widest leading-none text-[#FCD000]">WK</span>
                            <span className="text-xl font-black leading-none text-[#FCD000]">{study.seriesOrder ?? studyIndex + 1}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Title + meta */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-[10px] font-black uppercase tracking-[0.15em] mb-0.5 ${study.progress?.isCompleted ? 'text-green-400' : 'text-black/60'}`}>
                      {weekLabel} · {study.totalLessons} days
                    </p>
                    <h3 className={`font-black uppercase tracking-wide text-sm leading-tight ${study.progress?.isCompleted ? 'text-green-300' : 'text-black'}`} data-testid={`text-study-title-${study.id}`}>
                      {study.title.replace(/^Week\s+\d+[-–—:]\s*/i, '')}
                    </h3>

                    {/* Progress bar (only when unlocked + in progress) */}
                    {isAuthenticated && study.totalLessons > 0 && !isConsecutiveLocked && !study.progress?.isCompleted && study.completedLessons > 0 && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-black/20 border border-black/30 rounded-full overflow-hidden">
                          <div className="h-full bg-black transition-all duration-300" style={{ width: `${studyProgress}%` }} />
                        </div>
                        <span className="text-[10px] font-black text-black/60">{studyProgress}%</span>
                      </div>
                    )}
                  </div>

                  {/* Action / lock indicator */}
                  <div className="flex-shrink-0">
                    {isConsecutiveLocked ? (
                      <Button size="sm" variant="outline" disabled className="border-2 border-black text-black bg-[#FCD000]/60 rounded-sm font-bold uppercase text-xs px-2 h-8 opacity-70">
                        <Lock className="w-3 h-3 mr-1" />Locked
                      </Button>
                    ) : hasAccess ? (
                      <Link href={`/studies/${study.id}`}>
                        <Button
                          size="sm"
                          className={`font-black uppercase tracking-wide rounded-sm border-2 border-black text-xs px-3 h-8 ${
                            study.progress?.isCompleted
                              ? 'bg-transparent border-green-600 text-green-400 hover:bg-green-900/30'
                              : 'bg-black text-white hover:bg-gray-800'
                          }`}
                          onClick={() => handleStudyClick(study, studyIndex)}
                          data-testid={`button-study-${study.id}`}
                        >
                          {getButtonLabel(study)}<ChevronRight className="w-3 h-3 ml-0.5" />
                        </Button>
                      </Link>
                    ) : (
                      <Button size="sm" variant="outline" disabled className="border-2 border-black text-black/50 rounded-sm font-bold uppercase text-xs px-2 h-8">
                        <Lock className="w-3 h-3 mr-1" />Sub Only
                      </Button>
                    )}
                  </div>
                </div>

                {/* Lock reason pill */}
                {isConsecutiveLocked && (
                  <div className="mb-2 ml-1 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-medium">
                      <Lock className="w-3 h-3" />
                      {study.isScheduledFuture && study.unlocksAt
                        ? `Coming ${formatUnlockDate(study.unlocksAt)}`
                        : study.isLockedByDrip && study.unlocksAt
                          ? `Unlocks ${formatUnlockDate(study.unlocksAt)}`
                          : previousTitle
                            ? prevProgress && prevProgress.total > 0 && prevProgress.completed > 0
                              ? `${prevProgress.total - prevProgress.completed} lesson${prevProgress.total - prevProgress.completed !== 1 ? 's' : ''} remaining in "${previousTitle.replace(/^Week\s+\d+[-–—:]\s*/i, '')}" to unlock`
                              : `Complete "${previousTitle.replace(/^Week\s+\d+[-–—:]\s*/i, '')}" to unlock`
                            : 'Start the series to begin'}
                    </div>
                    {prevProgress && prevProgress.total > 0 && prevProgress.completed > 0 && (
                      <div className="flex items-center gap-2 ml-4">
                        <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden max-w-[120px]">
                          <div
                            className="h-full bg-[#FCD000]/60 rounded-full transition-all"
                            style={{ width: `${Math.round((prevProgress.completed / prevProgress.total) * 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-zinc-600 font-bold">{prevProgress.completed}/{prevProgress.total}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Lesson rows (only shown when unlocked) ── */}
                {!isConsecutiveLocked && study.lessons && study.lessons.length > 0 && (
                  <div className="ml-3 border-l-2 border-[#FCD000]/30 pl-3 space-y-1.5">
                    {study.lessons.map((lesson, lessonIndex) => {
                      const isCompleted = lesson.isCompleted;
                      const isDripLocked = lesson.isLocked;
                      return (
                        <div
                          key={lesson.id}
                          className={`flex items-center gap-2 px-3 py-2 border border-black/40 rounded-sm ${
                            isDripLocked
                              ? 'bg-zinc-800/60 opacity-70'
                              : isCompleted
                                ? 'bg-green-900/30 border-green-700/40'
                                : 'bg-[#111111] hover:bg-[#1a1a1a] transition-colors'
                          }`}
                          data-testid={`lesson-row-${lesson.id}`}
                        >
                          {/* Day status dot */}
                          <div className={`flex-shrink-0 w-6 h-6 rounded-sm border border-black flex items-center justify-center text-[10px] font-black ${
                            isCompleted ? 'bg-green-700 text-white' : isDripLocked ? 'bg-zinc-700 text-zinc-500' : 'bg-[#FCD000]/20 text-[#FCD000]'
                          }`}>
                            {isCompleted ? <CheckCircle className="w-3.5 h-3.5" /> : isDripLocked ? <Lock className="w-3 h-3" /> : lesson.dayNumber}
                          </div>

                          {/* Title */}
                          <div className="flex-1 min-w-0">
                            <p className={`text-[10px] font-black uppercase tracking-widest leading-none mb-0.5 ${isDripLocked ? 'text-zinc-600' : isCompleted ? 'text-green-400' : 'text-[#FCD000]'}`}>
                              Day {lesson.dayNumber}
                            </p>
                            <p className={`text-xs font-semibold leading-tight line-clamp-1 ${isDripLocked ? 'text-zinc-500' : isCompleted ? 'text-green-300/80' : 'text-white'}`}>
                              {lesson.title}
                            </p>
                          </div>

                          {/* Go button or lock */}
                          {!isDripLocked && hasAccess && (
                            <Link href={`/studies/${study.id}`}>
                              <button
                                className="flex-shrink-0 text-[#FCD000] hover:text-yellow-300 transition-colors"
                                onClick={() => handleStudyClick(study, studyIndex)}
                                data-testid={`button-lesson-${lesson.id}`}
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </Link>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
