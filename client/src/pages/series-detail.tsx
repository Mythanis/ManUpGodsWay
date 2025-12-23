import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, BookOpen, CheckCircle, Layers, ChevronRight, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

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

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'premium': return 'bg-blue-600';
      case 'vip': return 'bg-purple-600';
      default: return 'bg-green-600';
    }
  };

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ministry-gold-exact"></div>
      </div>
    );
  }

  if (!series) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Series not found</p>
          <Link href="/library">
            <Button variant="outline">Back to Library</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-ministry-navy to-ministry-charcoal text-white px-6 pt-12 pb-6">
        <Link href="/library">
          <button className="flex items-center text-gray-300 hover:text-white mb-4 text-sm" data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Library
          </button>
        </Link>
        
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-16 h-16 bg-gray-800 rounded-lg flex items-center justify-center">
            {series.thumbnailUrl ? (
              <img 
                src={series.thumbnailUrl} 
                alt={series.title}
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <Layers className="w-8 h-8 text-ministry-gold-exact" />
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-black tracking-tight mb-1" data-testid="text-series-title">
              {series.title}
            </h1>
            <p className="text-gray-300 text-sm">
              {series.description}
            </p>
          </div>
        </div>
      </div>

      {/* Progress Overview */}
      {isAuthenticated && studies.length > 0 && (
        <div className="px-6 -mt-3 relative z-10 mb-6">
          <Card className="bg-gray-900 border border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-400">Series Progress</span>
                <span className="text-sm font-bold text-ministry-gold-exact" data-testid="text-progress-percent">
                  {progressPercent}%
                </span>
              </div>
              <Progress value={progressPercent} className="h-2 mb-3" />
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{completedLessons} of {totalLessons} lessons completed</span>
                <span>{completedStudies} of {studies.length} studies completed</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Studies List */}
      <div className="px-6">
        <h2 className="text-white font-bold text-lg mb-4">
          Studies in this Series ({studies.length})
        </h2>

        <div className="space-y-4">
          {studies.map((study, index) => {
            const hasAccess = canAccessStudy(study);
            const studyProgress = study.totalLessons > 0 
              ? Math.round((study.completedLessons / study.totalLessons) * 100)
              : 0;

            return (
              <Card 
                key={study.id}
                className={`bg-gray-900 border ${study.progress?.isCompleted ? 'border-green-600' : 'border-gray-800'} ${hasAccess ? 'hover:border-ministry-gold-exact transition-colors' : ''}`}
                data-testid={`study-card-${study.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Order Number */}
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${study.progress?.isCompleted ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
                      {study.progress?.isCompleted ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        index + 1
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-white font-bold line-clamp-1" data-testid={`text-study-title-${study.id}`}>
                          {study.title}
                        </h3>
                        {study.requiredTier !== 'free' && (
                          <span className={`text-xs px-2 py-0.5 rounded-full text-white ${getTierColor(study.requiredTier)}`}>
                            {study.requiredTier.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-400 text-sm mb-3 line-clamp-2">
                        {study.description}
                      </p>

                      {/* Progress bar for authenticated users */}
                      {isAuthenticated && study.totalLessons > 0 && (
                        <div className="mb-3">
                          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                            <span>{study.completedLessons} of {study.totalLessons} lessons</span>
                            <span>{studyProgress}%</span>
                          </div>
                          <Progress value={studyProgress} className="h-1.5" />
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <BookOpen className="w-3.5 h-3.5" />
                          {study.totalLessons} {study.totalLessons === 1 ? 'Lesson' : 'Lessons'}
                        </span>

                        {hasAccess ? (
                          <Link href={`/studies/${study.id}`}>
                            <Button 
                              size="sm"
                              className="bg-ministry-gold-exact text-black hover:bg-yellow-400 font-semibold"
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
                            className="border-gray-600 text-gray-400"
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
            <BookOpen className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No studies in this series yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
