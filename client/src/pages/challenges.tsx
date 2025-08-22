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
    refetchInterval: 5000, // Poll every 5 seconds for challenges list
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
    staleTime: 0, // Always consider data stale to enable faster updates
    gcTime: 0, // Don't cache at all (gcTime is the new name for cacheTime)
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchInterval: 3000, // Poll every 3 seconds for real-time updates
  });

  // Filter and sort challenges (current and previous only, excluding current week display)
  const processedChallenges = challenges
    .filter((challenge: Challenge) => {
      // Exclude current week's challenge from the list (it's shown separately)
      if (currentWeekChallenge && challenge.id === currentWeekChallenge.id) {
        return false;
      }
      
      // Only show current and previous challenges (not future ones)
      const now = new Date();
      const challengeDate = new Date(challenge.releaseDate);
      const startOfThisWeek = startOfWeek(now, { weekStartsOn: 1 }); // Monday
      
      // If challenge is in the future (after this week), don't show it
      if (challengeDate > startOfThisWeek) {
        return false;
      }
      
      // Filter by topic
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

  // Get unique topics for filter
  const uniqueTopics: string[] = Array.from(new Set(challenges.map((c: Challenge) => c.topic as string))).sort();

  const formatChallengeDate = (releaseDate: string) => {
    // Parse the UTC date and format it correctly
    const date = new Date(releaseDate);
    return format(date, 'MMM d, yyyy');
  };

  const getTopicColor = (topic: string) => {
    const colors: Record<string, string> = {
      leadership: 'bg-blue-100 text-blue-800 border-blue-200',
      marriage: 'bg-pink-100 text-pink-800 border-pink-200',
      fatherhood: 'bg-green-100 text-green-800 border-green-200',
      character: 'bg-purple-100 text-purple-800 border-purple-200',
      faith: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      discipline: 'bg-orange-100 text-orange-800 border-orange-200',
      service: 'bg-teal-100 text-teal-800 border-teal-200',
      growth: 'bg-amber-100 text-amber-800 border-amber-200',
    };
    return colors[topic] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const ChallengeCard = ({ challenge, isCurrentWeek = false }: { challenge: Challenge; isCurrentWeek?: boolean }) => (
    <Card className={`hover:shadow-md transition-shadow bg-ministry-gold/20 ${isCurrentWeek ? 'ring-2 ring-ministry-gold bg-ministry-gold/30' : ''}`}>
      <CardContent className="p-6">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <div className={`w-16 h-16 rounded-lg flex items-center justify-center ${
              isCurrentWeek ? 'bg-ministry-gold text-white' : 'bg-ministry-gold/20 text-ministry-gold'
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
                <h3 className={`font-semibold text-lg mb-1 ${
                  isCurrentWeek ? 'text-ministry-charcoal' : 'text-ministry-charcoal'
                }`}>
                  {challenge.title}
                  {isCurrentWeek && (
                    <Badge className="ml-2 bg-ministry-gold text-white">
                      Current Week
                    </Badge>
                  )}
                </h3>
                <div className="flex items-center space-x-3 text-sm text-ministry-slate mb-2">
                  <Badge className={`text-xs capitalize border ${getTopicColor(challenge.topic)}`}>
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
              <p className="text-ministry-slate text-sm line-clamp-2">
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="px-6 pt-6">
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ministry-gold"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <div className="px-6 pt-6 space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-ministry-charcoal mb-2">
            Weekly Challenges
          </h1>
          <p className="text-ministry-slate">
            Grow stronger in faith through weekly challenges designed to build godly character
          </p>
        </div>

        {/* Current Week Challenge */}
        {currentWeekChallenge ? (
          <div className="mb-8">
            <div className="flex items-center mb-4">
              <Target className="w-6 h-6 text-ministry-gold mr-2" />
              <h2 className="text-xl font-bold text-ministry-charcoal">This Week's Challenge</h2>
            </div>
            <ChallengeCard challenge={currentWeekChallenge} isCurrentWeek={true} />
          </div>
        ) : (
          <div className="mb-8">
            <div className="flex items-center mb-4">
              <Target className="w-6 h-6 text-ministry-gold mr-2" />
              <h2 className="text-xl font-bold text-ministry-charcoal">This Week's Challenge</h2>
            </div>
            <Card className="text-center py-12 bg-ministry-gold/20">
              <CardContent>
                <Clock className="w-12 h-12 mx-auto text-ministry-steel mb-4" />
                <h3 className="text-lg font-medium text-ministry-charcoal mb-2">No Current Challenge</h3>
                <p className="text-ministry-slate">Check back soon for this week's challenge!</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Previous Challenges Header & Controls */}
        <div className="flex flex-col space-y-4 mb-6">
          <h2 className="text-xl font-bold text-ministry-charcoal">Previous Challenges</h2>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
            {/* Topic Filter */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-ministry-slate">Filter by Topic:</span>
              <Select value={filterTopic} onValueChange={setFilterTopic}>
                <SelectTrigger className="w-40">
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
              <span className="text-sm font-medium text-ministry-slate">Sort by:</span>
              <Button
                variant="default"
                size="sm"
                onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                className="flex items-center space-x-1 bg-ministry-gold hover:bg-ministry-gold/90 text-white"
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
              <span className="text-sm text-ministry-slate">Showing:</span>
              <Badge variant="outline" className="capitalize">
                {filterTopic} challenges
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilterTopic('all')}
                className="text-xs text-ministry-slate hover:text-ministry-charcoal"
              >
                Clear filter
              </Button>
            </div>
          )}
        </div>

        {/* Previous Challenges List */}
        {processedChallenges.length === 0 ? (
          <Card className="text-center py-12 bg-ministry-gold/20">
            <CardContent>
              <Trophy className="w-12 h-12 mx-auto text-ministry-steel mb-4" />
              <h3 className="text-lg font-medium text-ministry-charcoal mb-2">
                {filterTopic !== 'all' ? 'No challenges found for this topic' : 'No previous challenges yet'}
              </h3>
              <p className="text-ministry-slate">
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