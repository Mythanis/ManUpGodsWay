import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Calendar, Filter, Target, Star, ArrowUp, ArrowDown, Clock, X } from "lucide-react";
import { format, startOfWeek, isAfter, isSameWeek } from "date-fns";

interface Challenge {
  id: string;
  title: string;
  description?: string;
  topic: string;
  releaseDate: string;
  createdAt: string;
  updatedAt: string;
}

export default function Challenges() {
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterTopic, setFilterTopic] = useState<string>('all');

  // Fetch all challenges
  const { data: challenges = [], isLoading } = useQuery({
    queryKey: ['api', 'challenges'],
    queryFn: async () => {
      const response = await fetch('/api/challenges', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch challenges');
      return response.json();
    },
    staleTime: 0,
    refetchInterval: 5000,
  });

  // Fetch current week's challenge
  const { data: currentWeekChallenge } = useQuery({
    queryKey: ['api', 'challenges', 'current'],
    queryFn: async () => {
      const response = await fetch(`/api/challenges/current?t=${Date.now()}`, { 
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      if (!response.ok) return null;
      return response.json();
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 3000,
  });

  // Filter and sort challenges (current and previous only, excluding current week display)
  const processedChallenges = challenges
    .filter((challenge: Challenge) => {
      if (currentWeekChallenge && challenge.id === currentWeekChallenge.id) {
        return false;
      }
      
      const now = new Date();
      const challengeDate = new Date(challenge.releaseDate);
      const startOfThisWeek = startOfWeek(now, { weekStartsOn: 1 });
      
      if (challengeDate > startOfThisWeek) {
        return false;
      }
      
      if (filterTopic !== 'all' && challenge.topic !== filterTopic) {
        return false;
      }
      
      return true;
    })
    .sort((a: Challenge, b: Challenge) => {
      const dateA = new Date(a.releaseDate).getTime();
      const dateB = new Date(b.releaseDate).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

  const uniqueTopics: string[] = Array.from(new Set(challenges.map((c: Challenge) => c.topic as string))).sort();

  const formatChallengeDate = (releaseDate: string) => {
    const date = new Date(releaseDate);
    return format(date, 'MMM d, yyyy');
  };

  const ChallengeCard = ({ challenge, isCurrentWeek = false }: { challenge: Challenge; isCurrentWeek?: boolean }) => (
    <Card className={`bg-black border-2 border-black ${isCurrentWeek ? 'ring-2 ring-ministry-gold' : ''}`}>
      <CardContent className="p-6">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <div className={`w-16 h-16 rounded-lg flex items-center justify-center ${
              isCurrentWeek ? 'bg-ministry-gold text-black' : 'bg-gray-800 text-ministry-gold'
            }`}>
              {isCurrentWeek ? (
                <Star className="w-8 h-8 fill-current" />
              ) : (
                <Trophy className="w-8 h-8" />
              )}
            </div>
          </div>

          <div className="flex-1">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-semibold text-lg mb-1 text-white">
                  {challenge.title}
                  {isCurrentWeek && (
                    <Badge className="ml-2 bg-ministry-gold-exact text-black font-semibold">
                      Current Week
                    </Badge>
                  )}
                </h3>
                <div className="flex items-center space-x-3 text-sm text-gray-400 mb-2">
                  <Badge className="bg-ministry-gold-exact text-black font-semibold text-xs capitalize border-0">
                    {challenge.topic}
                  </Badge>
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    Week of {formatChallengeDate(challenge.releaseDate)}
                  </div>
                </div>
              </div>
            </div>

            {challenge.description && (
              <p className="text-gray-300 text-sm line-clamp-2">
                {challenge.description}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="px-6 pt-6">
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ministry-gold"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header - matching War Room style */}
      <div className="bg-gradient-to-r from-ministry-navy to-ministry-charcoal dark:from-header-dark dark:to-ministry-navy text-white px-6 pt-12 pb-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-black mb-2 tracking-tight">Weekly Challenges</h1>
          <p className="text-ministry-gold-exact text-sm font-semibold">Grow Stronger In Faith Through Weekly Challenges</p>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6 max-w-2xl mx-auto">
        {/* Current Week Challenge */}
        {currentWeekChallenge ? (
          <div className="mb-8">
            <div className="flex items-center mb-4">
              <Target className="w-6 h-6 text-ministry-gold mr-2" />
              <h2 className="text-xl font-bold text-white">This Week's Challenge</h2>
            </div>
            <ChallengeCard challenge={currentWeekChallenge} isCurrentWeek={true} />
          </div>
        ) : (
          <div className="mb-8">
            <div className="flex items-center mb-4">
              <Target className="w-6 h-6 text-ministry-gold mr-2" />
              <h2 className="text-xl font-bold text-white">This Week's Challenge</h2>
            </div>
            <Card className="text-center py-12 bg-black border-2 border-black">
              <CardContent>
                <Clock className="w-12 h-12 mx-auto text-ministry-gold mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No Current Challenge</h3>
                <p className="text-gray-400">Check back soon for this week's challenge!</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Previous Challenges Header & Controls */}
        <div className="flex flex-col space-y-4 mb-6">
          <h2 className="text-xl font-bold text-white">Previous Challenges</h2>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
            {/* Topic Filter */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-white">Filter by Topic:</span>
              <Select value={filterTopic} onValueChange={setFilterTopic}>
                <SelectTrigger className="w-40 border-white bg-transparent text-white">
                  <div className="flex items-center">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="All Topics" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Topics</SelectItem>
                  {uniqueTopics.map((topic) => (
                    <SelectItem key={topic as string} value={topic as string}>
                      {(topic as string).charAt(0).toUpperCase() + (topic as string).slice(1)}
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
                className="flex items-center space-x-1 bg-ministry-gold-exact hover:bg-ministry-gold-exact/90 text-black font-semibold"
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
          {filterTopic !== 'all' && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-400">Showing:</span>
              <Badge className="capitalize bg-ministry-gold-exact text-black font-semibold">
                {filterTopic} challenges
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilterTopic('all')}
                className="text-xs text-gray-400 hover:text-white"
              >
                Clear filter
              </Button>
            </div>
          )}
        </div>

        {/* Previous Challenges List */}
        {processedChallenges.length === 0 ? (
          <Card className="text-center py-12 bg-black border-2 border-black">
            <CardContent>
              <Trophy className="w-12 h-12 mx-auto text-ministry-gold mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">
                {filterTopic !== 'all' ? 'No challenges found for this topic' : 'No previous challenges yet'}
              </h3>
              <p className="text-gray-400">
                {filterTopic !== 'all' 
                  ? 'Try selecting a different topic or clear the filter' 
                  : 'Check back as more challenges are added!'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {processedChallenges.map((challenge: Challenge) => (
              <ChallengeCard key={challenge.id} challenge={challenge} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
