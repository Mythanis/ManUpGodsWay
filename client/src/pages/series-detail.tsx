import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, BookOpen, CheckCircle, Layers, ChevronRight, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { BackButton } from "@/components/BackButton";

interface StudyInSeries {
  id: string;
  title: string;
  description: string;
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
  isLockedByPrevious?: boolean;
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

  const isLoading = seriesLoading || studiesLoading;

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
    const tierOrder = ['free', 'premium', 'vip'];
    const userTierIndex = tierOrder.indexOf(user.subscriptionTier || 'free');
    const requiredTierIndex = tierOrder.indexOf(study.requiredTier);
    return userTierIndex >= requiredTierIndex;
  };

  const isLockedByConsecutive = (study: StudyInSeries) => {
    return study.isLockedByPrevious === true;
  };

  const getPreviousStudyTitle = (index: number): string | null => {
    if (index <= 0) return null;
    return studies[index - 1]?.title || null;
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
          <Card className="liquid-gold-card border-2 border-black rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
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

      {/* Studies List */}
      <div className="px-6">
        <h2 className="text-white font-black text-lg mb-4 uppercase tracking-tight">
          Studies in this Series ({studies.length})
        </h2>

        <div className="space-y-4">
          {studies.map((study, index) => {
            const hasAccess = canAccessStudy(study);
            const isConsecutiveLocked = isLockedByConsecutive(study);
            const previousTitle = getPreviousStudyTitle(index);
            const studyProgress = study.totalLessons > 0 
              ? Math.round((study.completedLessons / study.totalLessons) * 100)
              : 0;

            return (
              <Card 
                key={study.id}
                className={`border-2 border-black rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] ${
                  isConsecutiveLocked 
                    ? 'bg-zinc-800 opacity-80' 
                    : hasAccess 
                      ? 'liquid-gold-card hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all' 
                      : 'liquid-gold-card opacity-75'
                }`}
                data-testid={`study-card-${study.id}`}
              >
                <CardContent className="p-4 relative z-10">
                  <div className="flex items-start gap-4">
                    {/* Order Number */}
                    <div className={`flex-shrink-0 w-12 h-12 rounded-sm flex items-center justify-center font-black text-lg border-2 border-black ${
                      isConsecutiveLocked 
                        ? 'bg-zinc-700 text-zinc-400' 
                        : study.progress?.isCompleted 
                          ? 'bg-black text-[#FCD000]' 
                          : 'bg-white text-black'
                    }`}>
                      {isConsecutiveLocked ? (
                        <Lock className="w-5 h-5" />
                      ) : study.progress?.isCompleted ? (
                        <CheckCircle className="w-6 h-6" />
                      ) : (
                        index + 1
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={`font-black uppercase tracking-wide line-clamp-1 ${isConsecutiveLocked ? 'text-zinc-400' : 'text-black'}`} data-testid={`text-study-title-${study.id}`}>
                          {study.title}
                        </h3>
                        {study.requiredTier !== 'free' && (
                          <span className="text-xs px-2 py-0.5 rounded-sm text-white bg-black font-bold uppercase border border-black">
                            {study.requiredTier.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <p className={`text-sm mb-3 line-clamp-2 font-medium ${isConsecutiveLocked ? 'text-zinc-500' : 'text-black/70'}`}>
                        {study.description}
                      </p>

                      {/* Locked message */}
                      {isConsecutiveLocked && previousTitle && (
                        <div className="mb-3 p-2 bg-zinc-900 border border-zinc-700 rounded-sm">
                          <p className="text-xs text-zinc-400 font-medium">
                            <Lock className="w-3 h-3 inline mr-1" />
                            Complete "{previousTitle}" first to unlock
                          </p>
                        </div>
                      )}

                      {/* Progress bar for authenticated users (not shown for locked studies) */}
                      {isAuthenticated && study.totalLessons > 0 && !isConsecutiveLocked && (
                        <div className="mb-3">
                          <div className="flex items-center justify-between text-xs text-black/70 mb-1 font-bold uppercase">
                            <span>{study.completedLessons} of {study.totalLessons} lessons</span>
                            <span>{studyProgress}%</span>
                          </div>
                          <div className="h-2 bg-white border-2 border-black rounded-sm overflow-hidden">
                            <div 
                              className="h-full bg-black transition-all duration-300"
                              style={{ width: `${studyProgress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span className={`text-xs flex items-center gap-1 font-bold uppercase ${isConsecutiveLocked ? 'text-zinc-500' : 'text-black/70'}`}>
                          <BookOpen className="w-3.5 h-3.5" />
                          {study.totalLessons} {study.totalLessons === 1 ? 'Lesson' : 'Lessons'}
                        </span>

                        {isConsecutiveLocked ? (
                          <Button 
                            size="sm"
                            variant="outline"
                            disabled
                            className="border-2 border-zinc-600 text-zinc-500 bg-zinc-700 rounded-sm font-bold uppercase"
                          >
                            <Lock className="w-3 h-3 mr-1" />
                            Locked
                          </Button>
                        ) : hasAccess ? (
                          <Link href={`/studies/${study.id}`}>
                            <Button 
                              size="sm"
                              className="bg-black text-white hover:bg-gray-800 font-black uppercase tracking-wide rounded-sm border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)]"
                              data-testid={`button-study-${study.id}`}
                            >
                              {getButtonLabel(study)}
                              <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                          </Link>
                        ) : (
                          <Button 
                            size="sm"
                            variant="outline"
                            disabled
                            className="border-2 border-black text-black/50 rounded-sm font-bold uppercase"
                          >
                            <Lock className="w-3 h-3 mr-1" />
                            {study.requiredTier.toUpperCase()} Only
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {studies.length === 0 && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-[#FCD000] rounded-sm flex items-center justify-center mx-auto mb-4 border-2 border-black">
              <BookOpen className="w-8 h-8 text-black" />
            </div>
            <p className="text-gray-400 font-bold uppercase">No studies in this series yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
