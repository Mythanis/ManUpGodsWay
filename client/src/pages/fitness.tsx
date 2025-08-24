import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Dumbbell, 
  Calendar, 
  Filter, 
  Target, 
  Star, 
  ArrowUp, 
  ArrowDown, 
  Clock, 
  Play,
  Timer,
  Activity,
  Zap
} from "lucide-react";
import { format, isToday, isPast, isFuture } from "date-fns";

interface FitnessChallenge {
  id: string;
  title: string;
  description: string;
  targetDate: string;
  videoId?: string;
  videoUrl?: string;
  difficulty: string;
  duration: number;
  equipment?: string;
  category: string;
  isPublished: boolean;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export default function Fitness() {
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterDifficulty, setFilterDifficulty] = useState<string>('all');

  // Fetch all published fitness challenges
  const { data: challenges = [], isLoading } = useQuery({
    queryKey: ['api', 'fitness-challenges'],
    queryFn: async () => {
      const response = await fetch('/api/fitness-challenges', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch fitness challenges');
      return response.json();
    },
    staleTime: 0,
    refetchInterval: 8000, // Poll every 8 seconds for real-time updates
  });

  // Get today's challenge
  const todaysChallenge = challenges.find((challenge: FitnessChallenge) => 
    isToday(new Date(challenge.targetDate))
  );

  // Filter and sort previous challenges (exclude today's challenge)
  const processedChallenges = challenges
    .filter((challenge: FitnessChallenge) => {
      // Exclude today's challenge from the list (it's shown separately)
      if (todaysChallenge && challenge.id === todaysChallenge.id) {
        return false;
      }
      
      // Only show past challenges (not today or future)
      if (!isPast(new Date(challenge.targetDate)) || isToday(new Date(challenge.targetDate))) {
        return false;
      }
      
      // Filter by category
      if (filterCategory !== 'all' && challenge.category !== filterCategory) {
        return false;
      }
      
      // Filter by difficulty
      if (filterDifficulty !== 'all' && challenge.difficulty !== filterDifficulty) {
        return false;
      }
      
      return true;
    })
    .sort((a: FitnessChallenge, b: FitnessChallenge) => {
      const dateA = new Date(a.targetDate).getTime();
      const dateB = new Date(b.targetDate).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

  // Get unique categories and difficulties for filters
  const uniqueCategories: string[] = Array.from(new Set(challenges.map((c: FitnessChallenge) => c.category as string))).sort();
  const uniqueDifficulties: string[] = Array.from(new Set(challenges.map((c: FitnessChallenge) => c.difficulty as string))).sort();

  const formatChallengeDate = (targetDate: string) => {
    const date = new Date(targetDate);
    return format(date, 'MMM d, yyyy');
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      strength: 'bg-red-100 text-red-800 border-red-200',
      cardio: 'bg-blue-100 text-blue-800 border-blue-200',
      flexibility: 'bg-green-100 text-green-800 border-green-200',
      general: 'bg-purple-100 text-purple-800 border-purple-200',
    };
    return colors[category] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getDifficultyColor = (difficulty: string) => {
    const colors: Record<string, string> = {
      beginner: 'bg-green-100 text-green-800 border-green-200',
      intermediate: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      advanced: 'bg-red-100 text-red-800 border-red-200',
    };
    return colors[difficulty] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const FitnessChallengeCard = ({ challenge, isToday = false }: { challenge: FitnessChallenge; isToday?: boolean }) => (
    <Card className={`hover:shadow-md transition-shadow bg-ministry-gold-exact/20 ${isToday ? 'ring-2 ring-ministry-gold bg-ministry-gold-exact/30' : ''}`}>
      <CardContent className="p-6">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <div className={`w-16 h-16 rounded-lg flex items-center justify-center ${
              isToday ? 'bg-ministry-gold text-black' : 'bg-ministry-gold-exact/20 text-ministry-gold'
            }`}>
              {isToday ? (
                <Star className="w-8 h-8 fill-current" />
              ) : (
                <Dumbbell className="w-8 h-8" />
              )}
            </div>
          </div>

          <div className="flex-1">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-semibold text-lg mb-1 text-black">
                  {challenge.title}
                  {isToday && (
                    <Badge className="ml-2 bg-ministry-gold text-black">
                      Today's Challenge
                    </Badge>
                  )}
                </h3>
                <div className="flex items-center space-x-3 text-sm text-black mb-2">
                  <Badge className={`text-xs capitalize border ${getCategoryColor(challenge.category)}`}>
                    {challenge.category}
                  </Badge>
                  <Badge className={`text-xs capitalize border ${getDifficultyColor(challenge.difficulty)}`}>
                    {challenge.difficulty}
                  </Badge>
                  <div className="flex items-center">
                    <Timer className="w-4 h-4 mr-1" />
                    {challenge.duration} min
                  </div>
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    {formatChallengeDate(challenge.targetDate)}
                  </div>
                </div>
              </div>
            </div>

            <p className="text-black text-sm line-clamp-2 mb-3">
              {challenge.description}
            </p>

            {challenge.equipment && (
              <div className="flex items-center text-sm text-black mb-3">
                <Activity className="w-4 h-4 mr-1" />
                <span className="font-medium">Equipment: </span>
                <span className="ml-1">{challenge.equipment}</span>
              </div>
            )}

            {(challenge.videoId || challenge.videoUrl) && (
              <Button 
                size="sm" 
                className="bg-ministry-navy text-white hover:bg-ministry-charcoal"
                data-testid={`button-watch-video-${challenge.id}`}
              >
                <Play className="w-4 h-4 mr-2" />
                Watch Video
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900" style={{ backgroundColor: 'black' }}>
        <div className="px-6 pt-6">
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ministry-gold"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20" style={{ backgroundColor: 'black' }}>
      <div className="px-6 pt-6 space-y-6">
        {/* Header */}
        <div className="text-center mb-8 bg-black p-6 rounded-lg">
          <h1 className="text-3xl font-bold text-white mb-2">
            Daily Fitness
          </h1>
          <p className="text-white">
            Build physical strength to complement your spiritual growth
          </p>
        </div>

        {/* Today's Challenge */}
        {todaysChallenge ? (
          <div className="mb-8">
            <div className="flex items-center mb-4">
              <Target className="w-6 h-6 text-ministry-gold mr-2" />
              <h2 className="text-xl font-bold text-white">Today's Challenge</h2>
            </div>
            <FitnessChallengeCard challenge={todaysChallenge} isToday={true} />
          </div>
        ) : (
          <div className="mb-8">
            <div className="flex items-center mb-4">
              <Target className="w-6 h-6 text-ministry-gold mr-2" />
              <h2 className="text-xl font-bold text-white">Today's Challenge</h2>
            </div>
            <Card className="text-center py-12 bg-ministry-gold-exact/20">
              <CardContent>
                <Clock className="w-12 h-12 mx-auto text-ministry-steel mb-4" />
                <h3 className="text-lg font-medium text-black mb-2">No Challenge Today</h3>
                <p className="text-black">Check back for today's fitness challenge!</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Previous Challenges Header & Controls */}
        <div className="flex flex-col space-y-4 mb-6">
          <h2 className="text-xl font-bold text-white">Previous Challenges</h2>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
            {/* Category Filter */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-white">Category:</span>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-40">
                  <div className="flex items-center">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="All Categories" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {uniqueCategories.map((category) => (
                    <SelectItem key={category as string} value={category as string}>
                      {(category as string).charAt(0).toUpperCase() + (category as string).slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Difficulty Filter */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-white">Difficulty:</span>
              <Select value={filterDifficulty} onValueChange={setFilterDifficulty}>
                <SelectTrigger className="w-40">
                  <div className="flex items-center">
                    <Zap className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="All Levels" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  {uniqueDifficulties.map((difficulty) => (
                    <SelectItem key={difficulty as string} value={difficulty as string}>
                      {(difficulty as string).charAt(0).toUpperCase() + (difficulty as string).slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sort Controls */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-white">Sort by:</span>
              <Button
                variant="default"
                size="sm"
                onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                className="flex items-center space-x-1 bg-ministry-gold hover:bg-ministry-gold/90 text-black"
              >
                {sortOrder === 'desc' ? (
                  <>
                    <ArrowDown className="w-4 h-4" />
                    <span className="text-xs">Newest First</span>
                  </>
                ) : (
                  <>
                    <ArrowUp className="w-4 h-4" />
                    <span className="text-xs">Oldest First</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Active Filters Display */}
          {(filterCategory !== 'all' || filterDifficulty !== 'all') && (
            <div className="flex items-center space-x-2 flex-wrap">
              <span className="text-sm text-black">Showing:</span>
              {filterCategory !== 'all' && (
                <Badge variant="outline" className="capitalize">
                  {filterCategory} category
                </Badge>
              )}
              {filterDifficulty !== 'all' && (
                <Badge variant="outline" className="capitalize">
                  {filterDifficulty} difficulty
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterCategory('all');
                  setFilterDifficulty('all');
                }}
                className="text-xs text-ministry-slate hover:text-ministry-charcoal"
              >
                Clear filters
              </Button>
            </div>
          )}
        </div>

        {/* Previous Challenges List */}
        {processedChallenges.length === 0 ? (
          <Card className="text-center py-12 bg-ministry-gold-exact/20">
            <CardContent>
              <Dumbbell className="w-12 h-12 mx-auto text-ministry-steel mb-4" />
              <h3 className="text-lg font-medium text-black mb-2">
                {filterCategory !== 'all' || filterDifficulty !== 'all' 
                  ? 'No challenges found with current filters' 
                  : 'No previous challenges yet'}
              </h3>
              <p className="text-black">
                {filterCategory !== 'all' || filterDifficulty !== 'all' 
                  ? 'Try adjusting your filters or clear them to see all challenges' 
                  : 'Check back as more fitness challenges are added!'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {processedChallenges.map((challenge: FitnessChallenge) => (
              <FitnessChallengeCard key={challenge.id} challenge={challenge} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}