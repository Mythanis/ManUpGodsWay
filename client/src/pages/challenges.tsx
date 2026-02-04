import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trophy, Calendar, Filter, Target, Star, ArrowUp, ArrowDown, Clock, Users, CheckCircle, Eye } from "lucide-react";
import { format, startOfWeek } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { BackButton } from "@/components/BackButton";

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
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [showChallengeDialog, setShowChallengeDialog] = useState(false);
  const { toast } = useToast();

  // Get current user
  const { data: user } = useQuery({
    queryKey: ['/api/auth/user'],
  });

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

  // Fetch participant count for current challenge
  const { data: participantCount } = useQuery({
    queryKey: ['api', 'challenges', currentWeekChallenge?.id, 'participant-count'],
    queryFn: async () => {
      const response = await fetch(`/api/challenges/${currentWeekChallenge?.id}/participant-count`, { credentials: 'include' });
      if (!response.ok) return { count: 0 };
      return response.json();
    },
    enabled: !!currentWeekChallenge?.id,
    refetchInterval: 3000,
  });

  // Fetch participant count for selected challenge in dialog
  const { data: selectedParticipantCount } = useQuery({
    queryKey: ['api', 'challenges', selectedChallenge?.id, 'participant-count'],
    queryFn: async () => {
      const response = await fetch(`/api/challenges/${selectedChallenge?.id}/participant-count`, { credentials: 'include' });
      if (!response.ok) return { count: 0 };
      return response.json();
    },
    enabled: !!selectedChallenge?.id,
  });

  // Check if current user has accepted the current week challenge
  const { data: userAccepted } = useQuery({
    queryKey: ['api', 'challenges', currentWeekChallenge?.id, 'user-accepted'],
    queryFn: async () => {
      const response = await fetch(`/api/challenges/${currentWeekChallenge?.id}/user-accepted`, { credentials: 'include' });
      if (!response.ok) return { hasAccepted: false };
      return response.json();
    },
    enabled: !!currentWeekChallenge?.id && !!user,
    refetchInterval: 3000,
  });

  // Check if user has accepted the selected challenge
  const { data: selectedUserAccepted } = useQuery({
    queryKey: ['api', 'challenges', selectedChallenge?.id, 'user-accepted'],
    queryFn: async () => {
      const response = await fetch(`/api/challenges/${selectedChallenge?.id}/user-accepted`, { credentials: 'include' });
      if (!response.ok) return { hasAccepted: false };
      return response.json();
    },
    enabled: !!selectedChallenge?.id && !!user,
  });

  // Accept challenge mutation
  const acceptChallengeMutation = useMutation({
    mutationFn: async (challengeId: string) => {
      return apiRequest('POST', `/api/challenges/${challengeId}/accept`);
    },
    onSuccess: () => {
      toast({
        title: "Challenge Accepted!",
        description: "You've joined this week's challenge. Let's grow together!",
      });
      queryClient.invalidateQueries({ queryKey: ['api', 'challenges', currentWeekChallenge?.id, 'participant-count'] });
      queryClient.invalidateQueries({ queryKey: ['api', 'challenges', currentWeekChallenge?.id, 'user-accepted'] });
      queryClient.invalidateQueries({ queryKey: ['api', 'challenges', selectedChallenge?.id, 'participant-count'] });
      queryClient.invalidateQueries({ queryKey: ['api', 'challenges', selectedChallenge?.id, 'user-accepted'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to accept challenge. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Complete challenge mutation
  const completeChallengeMutation = useMutation({
    mutationFn: async (challengeId: string) => {
      return apiRequest('POST', `/api/challenges/${challengeId}/complete`);
    },
    onSuccess: () => {
      toast({
        title: "Challenge Completed!",
        description: "Congratulations! You've earned rations for completing this challenge.",
      });
      queryClient.invalidateQueries({ queryKey: ['api', 'challenges', currentWeekChallenge?.id, 'user-accepted'] });
      queryClient.invalidateQueries({ queryKey: ['api', 'challenges', selectedChallenge?.id, 'user-accepted'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rations'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to complete challenge. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Regroup challenge mutation
  const regroupChallengeMutation = useMutation({
    mutationFn: async (challengeId: string) => {
      return apiRequest('POST', `/api/challenges/${challengeId}/regroup`);
    },
    onSuccess: () => {
      toast({
        title: "Regrouping!",
        description: "Keep your head up, soldier! The next challenge awaits.",
      });
      queryClient.invalidateQueries({ queryKey: ['api', 'challenges', currentWeekChallenge?.id, 'user-accepted'] });
      queryClient.invalidateQueries({ queryKey: ['api', 'challenges', selectedChallenge?.id, 'user-accepted'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to regroup. Please try again.",
        variant: "destructive",
      });
    },
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

  const uniqueTopics = Array.from(new Set(challenges.map((c: Challenge) => c.topic))).sort() as string[];

  const formatChallengeDate = (releaseDate: string) => {
    const date = new Date(releaseDate);
    return format(date, 'MMM d, yyyy');
  };

  const openChallengeDialog = (challenge: Challenge) => {
    setSelectedChallenge(challenge);
    setShowChallengeDialog(true);
  };

  const ChallengeCard = ({ challenge, isCurrentWeek = false }: { challenge: Challenge; isCurrentWeek?: boolean }) => (
    <Card 
      className={`liquid-black-white border-2 ${isCurrentWeek ? 'border-ministry-gold-exact shadow-[4px_4px_0px_0px_rgba(252,208,0,1)]' : 'border-ministry-gold-exact/50 shadow-[3px_3px_0px_0px_rgba(252,208,0,0.5)]'} cursor-pointer hover:shadow-[5px_5px_0px_0px_rgba(252,208,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all rounded-sm overflow-hidden`}
      onClick={() => openChallengeDialog(challenge)}
    >
      <CardContent className="p-4 sm:p-5 relative z-10">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-sm flex items-center justify-center border-2 ${
              isCurrentWeek ? 'bg-ministry-gold-exact border-ministry-gold-exact text-black' : 'bg-transparent border-ministry-gold-exact text-ministry-gold-exact'
            }`}>
              {isCurrentWeek ? (
                <Star className="w-6 h-6 sm:w-7 sm:h-7 fill-current" />
              ) : (
                <Trophy className="w-6 h-6 sm:w-7 sm:h-7" />
              )}
            </div>
          </div>

          <div className="flex-1">
            <div className="flex items-start justify-between mb-1">
              <div>
                <h3 className="font-black text-sm sm:text-base text-white mb-1 tracking-tight uppercase">
                  {challenge.title}
                  {isCurrentWeek && (
                    <Badge className="ml-2 bg-ministry-gold-exact text-black font-black rounded-sm uppercase tracking-wide text-xs py-0 px-1">
                      Current
                    </Badge>
                  )}
                </h3>
                <div className="flex items-center flex-wrap gap-2 text-xs text-white/60 mb-1">
                  <Badge className="font-bold text-xs uppercase tracking-wide border border-ministry-gold-exact rounded-sm bg-transparent text-ministry-gold-exact py-0 px-1">
                    {challenge.topic}
                  </Badge>
                  <div className="flex items-center">
                    <Calendar className="w-3 h-3 mr-1" />
                    {formatChallengeDate(challenge.releaseDate)}
                  </div>
                </div>
              </div>
            </div>

            {challenge.description && (
              <p className="text-white/70 text-xs line-clamp-2 mb-1">
                {challenge.description}
              </p>
            )}

            <div className="flex items-center text-xs text-ministry-gold-exact font-bold">
              <Eye className="w-3 h-3 mr-1" />
              <span>Tap for details</span>
            </div>

            {/* Accept Challenge Section - Only for current week */}
            {isCurrentWeek && (
              <div className="mt-3 pt-3 border-t border-ministry-gold-exact/30">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-ministry-gold-exact flex-shrink-0" />
                    <span className="text-xs text-white font-bold">
                      {participantCount?.count || 0} accepted
                    </span>
                  </div>
                  {user ? (
                    <div className="flex items-center gap-2">
                      {!userAccepted?.hasAccepted ? (
                        <Button
                          size="sm"
                          className="bg-ministry-gold-exact hover:bg-ministry-gold-exact/90 text-black font-black whitespace-nowrap rounded-sm uppercase tracking-wide border-2 border-ministry-gold-exact text-xs px-3 py-1 h-auto"
                          onClick={(e) => {
                            e.stopPropagation();
                            acceptChallengeMutation.mutate(challenge.id);
                          }}
                          disabled={acceptChallengeMutation.isPending}
                          data-testid="button-accept-challenge"
                        >
                          {acceptChallengeMutation.isPending ? "..." : "Accept"}
                        </Button>
                      ) : userAccepted?.hasCompleted ? (
                        <Button
                          size="sm"
                          className="bg-ministry-gold-exact text-black font-black whitespace-nowrap rounded-sm uppercase tracking-wide border-2 border-ministry-gold-exact cursor-not-allowed opacity-90 text-xs px-3 py-1 h-auto"
                          disabled
                          onClick={(e) => e.stopPropagation()}
                        >
                          <CheckCircle className="w-3 h-3 mr-1" />
                          DONE
                        </Button>
                      ) : userAccepted?.hasRegrouped ? (
                        <Button
                          size="sm"
                          className="bg-gray-600 text-white font-black whitespace-nowrap rounded-sm uppercase tracking-wide border-2 border-gray-500 cursor-not-allowed opacity-90 text-xs px-3 py-1 h-auto"
                          disabled
                          onClick={(e) => e.stopPropagation()}
                        >
                          REGROUPED
                        </Button>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-ministry-gold-exact hover:bg-ministry-gold-exact/90 text-black font-black whitespace-nowrap rounded-sm uppercase tracking-wide border-2 border-ministry-gold-exact text-xs px-3 py-1 h-auto"
                            onClick={(e) => {
                              e.stopPropagation();
                              completeChallengeMutation.mutate(challenge.id);
                            }}
                            disabled={completeChallengeMutation.isPending}
                            data-testid="button-complete-challenge"
                          >
                            {completeChallengeMutation.isPending ? "..." : "Complete"}
                          </Button>
                          <Button
                            size="sm"
                            className="bg-gray-700 hover:bg-gray-600 text-white font-black whitespace-nowrap rounded-sm uppercase tracking-wide border border-gray-500 text-xs px-3 py-1 h-auto"
                            onClick={(e) => {
                              e.stopPropagation();
                              regroupChallengeMutation.mutate(challenge.id);
                            }}
                            disabled={regroupChallengeMutation.isPending}
                            data-testid="button-regroup-challenge"
                          >
                            {regroupChallengeMutation.isPending ? "..." : "Regroup"}
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      className="bg-white/10 text-white/50 rounded-sm text-xs px-3 py-1 h-auto"
                      disabled
                      onClick={(e) => e.stopPropagation()}
                    >
                      Login
                    </Button>
                  )}
                </div>
              </div>
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

  const isSelectedCurrentWeek = selectedChallenge && currentWeekChallenge && selectedChallenge.id === currentWeekChallenge.id;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header - matching War Room style */}
      <div className="liquid-header text-white px-6 pt-12 pb-6">
        <div className="max-w-2xl mx-auto">
          <BackButton />
          <h1 className="text-4xl font-black mb-2 tracking-tighter uppercase"><span className="text-white">Weekly</span> <span className="text-ministry-gold-exact">Challenges</span></h1>
          <p className="text-ministry-gold-exact text-xs font-bold tracking-widest uppercase">Grow Stronger In Faith Through Weekly Challenges</p>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6 max-w-2xl mx-auto">
        {/* Current Week Challenge */}
        {currentWeekChallenge ? (
          <div className="mb-8">
            <div className="flex items-center mb-4">
              <Target className="w-6 h-6 text-ministry-gold mr-2" />
              <h2 className="text-xl font-black text-white tracking-tight uppercase">This Week's Challenge</h2>
            </div>
            <ChallengeCard challenge={currentWeekChallenge} isCurrentWeek={true} />
          </div>
        ) : (
          <div className="mb-8">
            <div className="flex items-center mb-4">
              <Target className="w-6 h-6 text-ministry-gold mr-2" />
              <h2 className="text-xl font-black text-white tracking-tight uppercase">This Week's Challenge</h2>
            </div>
            <Card className="text-center py-12 liquid-black border-2 border-black rounded-sm overflow-hidden">
              <CardContent className="relative">
                <Clock className="w-12 h-12 mx-auto text-ministry-gold-exact mb-4 relative z-10" />
                <h3 className="text-lg font-black text-white mb-2 relative z-10 uppercase tracking-tight">No Current Challenge</h3>
                <p className="text-gray-400 relative z-10">Check back soon for this week's challenge!</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Previous Challenges Header & Controls */}
        <div className="flex flex-col space-y-4 mb-6">
          <h2 className="text-xl font-black text-white tracking-tight uppercase">Previous Challenges</h2>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
            {/* Topic Filter */}
            <div className="flex items-center space-x-2">
              <span className="text-xs font-black text-white uppercase tracking-wide">Filter:</span>
              <Select value={filterTopic} onValueChange={setFilterTopic}>
                <SelectTrigger className="w-40 border-2 border-black bg-ministry-gold-exact text-black font-bold rounded-sm">
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
              <span className="text-xs font-black text-white uppercase tracking-wide">Sort:</span>
              <Button
                variant="default"
                size="sm"
                onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                className="flex items-center space-x-1 bg-ministry-gold-exact hover:bg-ministry-gold-exact/90 text-black font-black rounded-sm uppercase tracking-wide"
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
          <Card className="text-center py-12 liquid-black border-2 border-black rounded-sm overflow-hidden">
            <CardContent className="relative">
              <Trophy className="w-12 h-12 mx-auto text-ministry-gold-exact mb-4 relative z-10" />
              <h3 className="text-lg font-black text-white mb-2 relative z-10 uppercase tracking-tight">
                {filterTopic !== 'all' ? 'No challenges found for this topic' : 'No previous challenges yet'}
              </h3>
              <p className="text-gray-400 relative z-10">
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

      {/* Challenge Detail Dialog */}
      <Dialog open={showChallengeDialog} onOpenChange={setShowChallengeDialog}>
        <DialogContent className="max-w-2xl bg-zinc-900 border-2 border-black rounded-sm shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Target className="w-5 h-5 text-ministry-gold-exact" />
              <span className="text-white font-black uppercase tracking-tight">Challenge Details</span>
            </DialogTitle>
          </DialogHeader>
          
          {selectedChallenge && (
            <div className="space-y-4">
              {/* Challenge Header */}
              <div className="liquid-black text-white p-6 rounded-sm border-2 border-black overflow-hidden">
                <div className="flex items-center justify-between mb-4 relative z-10 flex-wrap gap-2">
                  <div className="inline-flex items-center bg-ministry-gold-exact text-black px-3 py-1 rounded-sm text-xs font-black uppercase tracking-wide border-2 border-black">
                    <Target className="w-3 h-3 mr-1" fill="currentColor" />
                    Week of {formatChallengeDate(selectedChallenge.releaseDate)}
                  </div>
                  <Badge className="bg-ministry-gold-exact text-black font-black capitalize rounded-sm border-2 border-black">
                    {selectedChallenge.topic}
                  </Badge>
                </div>
                
                <h3 className="text-xl font-black mb-3 relative z-10 uppercase tracking-tight">
                  {selectedChallenge.title}
                  {isSelectedCurrentWeek && (
                    <Badge className="ml-2 bg-ministry-gold-exact text-black rounded-sm border-2 border-black font-black">
                      Current Week
                    </Badge>
                  )}
                </h3>
                
                <p className="text-gray-200 leading-relaxed whitespace-pre-wrap relative z-10">
                  {selectedChallenge.description || "No description available for this challenge."}
                </p>
              </div>

              {/* Participant Count Banner */}
              <div className="liquid-gold-card border-2 border-black rounded-sm p-4 overflow-hidden">
                <div className="flex items-center justify-between flex-wrap gap-3 relative z-10">
                  <div className="flex items-center space-x-2">
                    <Users className="w-5 h-5 text-black" />
                    <span className="text-sm font-black text-black uppercase tracking-wide">
                      {selectedParticipantCount?.count || 0} {(selectedParticipantCount?.count || 0) === 1 ? 'brother has' : 'brothers have'} taken this challenge
                    </span>
                  </div>
                  {user ? (
                    <div className="flex items-center gap-2">
                      {!selectedUserAccepted?.hasAccepted ? (
                        <Button 
                          size="sm"
                          className="bg-black hover:bg-black/90 text-ministry-gold-exact font-black whitespace-nowrap rounded-sm uppercase tracking-wide border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                          onClick={() => acceptChallengeMutation.mutate(selectedChallenge.id)}
                          disabled={acceptChallengeMutation.isPending}
                          data-testid="button-accept-challenge-dialog"
                        >
                          {acceptChallengeMutation.isPending ? "..." : "Accept"}
                        </Button>
                      ) : selectedUserAccepted?.hasCompleted ? (
                        <Button
                          size="sm"
                          className="bg-ministry-gold-exact text-black font-black whitespace-nowrap rounded-sm uppercase tracking-wide border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] cursor-not-allowed opacity-90"
                          disabled
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          COMPLETED
                        </Button>
                      ) : selectedUserAccepted?.hasRegrouped ? (
                        <Button
                          size="sm"
                          className="bg-gray-600 text-white font-black whitespace-nowrap rounded-sm uppercase tracking-wide border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] cursor-not-allowed opacity-90"
                          disabled
                        >
                          REGROUPED
                        </Button>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-ministry-gold-exact hover:bg-ministry-gold-exact/90 text-black font-black whitespace-nowrap rounded-sm uppercase tracking-wide border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                            onClick={() => completeChallengeMutation.mutate(selectedChallenge.id)}
                            disabled={completeChallengeMutation.isPending}
                            data-testid="button-complete-challenge-dialog"
                          >
                            {completeChallengeMutation.isPending ? "..." : "Complete"}
                          </Button>
                          <Button
                            size="sm"
                            className="bg-gray-700 hover:bg-gray-600 text-white font-black whitespace-nowrap rounded-sm uppercase tracking-wide border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                            onClick={() => regroupChallengeMutation.mutate(selectedChallenge.id)}
                            disabled={regroupChallengeMutation.isPending}
                            data-testid="button-regroup-challenge-dialog"
                          >
                            {regroupChallengeMutation.isPending ? "..." : "Regroup"}
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      className="bg-black/50 text-white/50 rounded-sm"
                      disabled
                    >
                      Login to Accept
                    </Button>
                  )}
                </div>
              </div>

              {/* Close Button */}
              <div className="flex justify-end pt-2">
                <Button 
                  className="bg-ministry-gold-exact hover:bg-ministry-gold-exact/90 text-black font-black rounded-sm uppercase tracking-wide border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                  onClick={() => setShowChallengeDialog(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
