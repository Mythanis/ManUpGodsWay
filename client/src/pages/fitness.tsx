import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
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
  Zap,
  Search,
  Heart,
  Plus,
  List,
  BookOpen,
  Edit,
  Trash2
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

interface Exercise {
  exerciseId: string;
  name: string;
  gifUrl: string;
  targetMuscles: string[];
  bodyParts: string[];
  equipments: string[];
  secondaryMuscles: string[];
  instructions: string[];
  // Legacy fields for backward compatibility
  id?: string;
  target?: string;
  bodyPart?: string;
  equipment?: string;
}

interface FavoriteExercise {
  id: string;
  userId: string;
  exerciseId: string;
  exerciseName: string;
  exerciseGifUrl: string;
  exerciseTarget: string;
  exerciseBodyPart: string;
  exerciseEquipment: string;
  addedAt: string;
}

interface FitnessPlan {
  id: string;
  userId: string;
  name: string;
  description?: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  exercises?: FitnessPlanExercise[];
}

interface FitnessPlanExercise {
  id: string;
  planId: string;
  exerciseId: string;
  exerciseName: string;
  exerciseGifUrl: string;
  exerciseTarget: string;
  exerciseBodyPart: string;
  exerciseEquipment: string;
  sets?: number;
  reps?: number;
  duration?: number;
  notes?: string;
  orderIndex: number;
}

export default function Fitness() {
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterDifficulty, setFilterDifficulty] = useState<string>('all');
  
  // Exercise search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBodyPart, setSelectedBodyPart] = useState('all');
  const [selectedEquipment, setSelectedEquipment] = useState('all');
  const [selectedTarget, setSelectedTarget] = useState('all');
  
  // Fitness plan state
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanDescription, setNewPlanDescription] = useState('');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  // Fetch all exercises from ExerciseDB API
  const { data: exercises = [], isLoading: isLoadingExercises } = useQuery({
    queryKey: ['exercises'],
    queryFn: async () => {
      const response = await fetch('https://exercisedb-api.vercel.app/api/v1/exercises');
      if (!response.ok) throw new Error('Failed to fetch exercises');
      const data = await response.json();
      return data.data || [];
    },
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes
  });

  // Fetch muscles for filtering
  const { data: muscles = [] } = useQuery({
    queryKey: ['muscles'],
    queryFn: async () => {
      const response = await fetch('https://exercisedb-api.vercel.app/api/v1/muscles');
      if (!response.ok) throw new Error('Failed to fetch muscles');
      const data = await response.json();
      return data.data || [];
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch equipment for filtering
  const { data: equipments = [] } = useQuery({
    queryKey: ['equipments'],
    queryFn: async () => {
      const response = await fetch('https://exercisedb-api.vercel.app/api/v1/equipments');
      if (!response.ok) throw new Error('Failed to fetch equipments');
      const data = await response.json();
      return data.data || [];
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch bodyparts for filtering
  const { data: bodyParts = [] } = useQuery({
    queryKey: ['bodyparts'],
    queryFn: async () => {
      const response = await fetch('https://exercisedb-api.vercel.app/api/v1/bodyparts');
      if (!response.ok) throw new Error('Failed to fetch bodyparts');
      const data = await response.json();
      return data.data || [];
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch user's favorite exercises
  const { data: favoriteExercises = [] } = useQuery({
    queryKey: ['api', 'favorite-exercises'],
    queryFn: async () => {
      const response = await fetch('/api/favorite-exercises', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch favorite exercises');
      return response.json();
    },
  });

  // Fetch user's fitness plans
  const { data: fitnessPlans = [] } = useQuery({
    queryKey: ['api', 'fitness-plans'],
    queryFn: async () => {
      const response = await fetch('/api/fitness-plans', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch fitness plans');
      return response.json();
    },
  });

  // Get filter options from API data
  const uniqueBodyParts = bodyParts.map((bp: any) => bp.name).sort();
  const uniqueEquipment = equipments.map((eq: any) => eq.name).sort();
  const uniqueTargets = muscles.map((muscle: any) => muscle.name).sort();

  // Filter exercises based on selected filters
  const filteredExercises = exercises.filter((exercise: Exercise) => {
    const matchesSearch = searchQuery === '' || 
      exercise.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (exercise.targetMuscles || [exercise.target]).some(target => target?.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesBodyPart = selectedBodyPart === 'all' || 
      (exercise.bodyParts || [exercise.bodyPart]).some(part => part === selectedBodyPart);
    
    const matchesEquipment = selectedEquipment === 'all' || 
      (exercise.equipments || [exercise.equipment]).some(eq => eq === selectedEquipment);
    const matchesTarget = selectedTarget === 'all' || 
      (exercise.targetMuscles || [exercise.target]).some(target => target === selectedTarget);
    
    return matchesSearch && matchesBodyPart && matchesEquipment && matchesTarget;
  });

  // Add/remove favorite exercise mutations
  const addFavoriteMutation = useMutation({
    mutationFn: async (exercise: Exercise) => {
      return apiRequest('POST', '/api/favorite-exercises', {
        exerciseId: exercise.exerciseId || exercise.id,
        exerciseName: exercise.name,
        exerciseGifUrl: exercise.gifUrl,
        exerciseTarget: exercise.targetMuscles?.[0] || exercise.target || '',
        exerciseBodyPart: exercise.bodyParts?.[0] || exercise.bodyPart || '',
        exerciseEquipment: exercise.equipments?.[0] || exercise.equipment || '',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api', 'favorite-exercises'] });
      toast({ title: "Exercise added to favorites!" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to add to favorites",
        variant: "destructive" 
      });
    },
  });

  const removeFavoriteMutation = useMutation({
    mutationFn: async (exerciseId: string) => {
      return apiRequest('DELETE', `/api/favorite-exercises/${exerciseId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api', 'favorite-exercises'] });
      toast({ title: "Exercise removed from favorites" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to remove from favorites",
        variant: "destructive" 
      });
    },
  });

  // Create fitness plan mutation
  const createPlanMutation = useMutation({
    mutationFn: async (planData: { name: string; description?: string; isPublic: boolean }) => {
      return apiRequest('POST', '/api/fitness-plans', planData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api', 'fitness-plans'] });
      setShowCreatePlan(false);
      setNewPlanName('');
      setNewPlanDescription('');
      toast({ title: "Fitness plan created!" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create plan",
        variant: "destructive" 
      });
    },
  });

  // Delete fitness plan mutation
  const deletePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      return apiRequest('DELETE', `/api/fitness-plans/${planId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api', 'fitness-plans'] });
      toast({ title: "Fitness plan deleted" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete plan",
        variant: "destructive" 
      });
    },
  });

  // Add exercise to plan mutation
  const addToPlanMutation = useMutation({
    mutationFn: async ({ planId, exercise }: { planId: string; exercise: Exercise }) => {
      return apiRequest('POST', `/api/fitness-plans/${planId}/exercises`, {
        exerciseId: exercise.exerciseId || exercise.id,
        exerciseName: exercise.name,
        exerciseGifUrl: exercise.gifUrl,
        exerciseTarget: exercise.targetMuscles?.[0] || exercise.target || '',
        exerciseBodyPart: exercise.bodyParts?.[0] || exercise.bodyPart || '',
        exerciseEquipment: exercise.equipments?.[0] || exercise.equipment || '',
        orderIndex: 0, // Will be set by backend
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api', 'fitness-plans'] });
      toast({ title: "Exercise added to plan!" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to add to plan",
        variant: "destructive" 
      });
    },
  });

  // Helper functions
  const isFavorite = (exerciseId: string) => {
    return favoriteExercises.some((fav: FavoriteExercise) => fav.exerciseId === exerciseId);
  };

  const handleToggleFavorite = (exercise: Exercise) => {
    const id = exercise.exerciseId || exercise.id || '';
    if (isFavorite(id)) {
      removeFavoriteMutation.mutate(id);
    } else {
      addFavoriteMutation.mutate(exercise);
    }
  };

  const handleCreatePlan = () => {
    if (!newPlanName.trim()) {
      toast({ 
        title: "Error", 
        description: "Plan name is required",
        variant: "destructive" 
      });
      return;
    }
    
    createPlanMutation.mutate({
      name: newPlanName.trim(),
      description: newPlanDescription.trim() || undefined,
      isPublic: false,
    });
  };

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
  const uniqueCategories: string[] = Array.from(new Set((challenges as FitnessChallenge[]).map(c => c.category))).sort();
  const uniqueDifficulties: string[] = Array.from(new Set((challenges as FitnessChallenge[]).map(c => c.difficulty))).sort();

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

  const ExerciseCard = ({ exercise }: { exercise: Exercise }) => (
    <Card className="hover:shadow-md transition-shadow bg-ministry-gold-exact/20">
      <CardContent className="p-4">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <img 
              src={exercise.gifUrl} 
              alt={exercise.name}
              className="w-20 h-20 object-cover rounded-lg"
              loading="lazy"
            />
          </div>
          
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-2 text-black capitalize">
              {exercise.name.replace(/_/g, ' ')}
            </h3>
            
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge className="text-xs capitalize bg-blue-100 text-blue-800 border-blue-200">
                {exercise.bodyPart}
              </Badge>
              <Badge className="text-xs capitalize bg-green-100 text-green-800 border-green-200">
                {exercise.target}
              </Badge>
              <Badge className="text-xs capitalize bg-purple-100 text-purple-800 border-purple-200">
                {exercise.equipment}
              </Badge>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={isFavorite(exercise.exerciseId || exercise.id || '') ? "default" : "outline"}
                onClick={() => handleToggleFavorite(exercise)}
                className={`${isFavorite(exercise.exerciseId || exercise.id || '') 
                  ? 'bg-ministry-gold hover:bg-ministry-gold/90 text-black' 
                  : 'border-ministry-gold text-ministry-gold hover:bg-ministry-gold hover:text-black'
                }`}
                data-testid={`button-favorite-${exercise.exerciseId || exercise.id || ''}`}
              >
                <Heart className={`w-4 h-4 mr-1 ${isFavorite(exercise.exerciseId || exercise.id || '') ? 'fill-current' : ''}`} />
                {isFavorite(exercise.exerciseId || exercise.id || '') ? 'Favorited' : 'Favorite'}
              </Button>
              
              {fitnessPlans.length > 0 && (
                <Select onValueChange={(planId) => addToPlanMutation.mutate({ planId, exercise })}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Add to Plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {fitnessPlans.map((plan: FitnessPlan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
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
            Fitness Center
          </h1>
          <p className="text-white">
            Build physical strength to complement your spiritual growth
          </p>
        </div>

        {/* Tab Navigation */}
        <Tabs defaultValue="challenges" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-ministry-gold-exact/20">
            <TabsTrigger value="challenges" className="flex items-center gap-2 data-[state=active]:bg-ministry-gold data-[state=active]:text-black">
              <Target className="w-4 h-4" />
              Challenges
            </TabsTrigger>
            <TabsTrigger value="exercises" className="flex items-center gap-2 data-[state=active]:bg-ministry-gold data-[state=active]:text-black">
              <Search className="w-4 h-4" />
              Exercises
            </TabsTrigger>
            <TabsTrigger value="favorites" className="flex items-center gap-2 data-[state=active]:bg-ministry-gold data-[state=active]:text-black">
              <Heart className="w-4 h-4" />
              Favorites
            </TabsTrigger>
            <TabsTrigger value="plans" className="flex items-center gap-2 data-[state=active]:bg-ministry-gold data-[state=active]:text-black">
              <List className="w-4 h-4" />
              My Plans
            </TabsTrigger>
          </TabsList>

          {/* Daily Challenges Tab */}
          <TabsContent value="challenges" className="space-y-6">
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
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Category Filter */}
                <div className="flex flex-col space-y-2">
                  <span className="text-sm font-medium text-white">Category:</span>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="w-full">
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
                <div className="flex flex-col space-y-2">
                  <span className="text-sm font-medium text-white">Difficulty:</span>
                  <Select value={filterDifficulty} onValueChange={setFilterDifficulty}>
                    <SelectTrigger className="w-full">
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
                <div className="flex flex-col space-y-2">
                  <span className="text-sm font-medium text-white">Sort by:</span>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                    className="flex items-center justify-center space-x-1 bg-ministry-gold hover:bg-ministry-gold/90 text-black w-full"
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
          </TabsContent>

          {/* Exercise Discovery Tab */}
          <TabsContent value="exercises" className="space-y-6">
            {/* Search and Filters */}
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search exercises..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-ministry-gold-exact/20 border-ministry-steel text-white placeholder:text-gray-400"
                    data-testid="input-exercise-search"
                  />
                </div>
                <Button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedBodyPart('all');
                    setSelectedEquipment('all');
                    setSelectedTarget('all');
                  }}
                  variant="outline"
                  className="border-ministry-gold text-ministry-gold hover:bg-ministry-gold hover:text-black"
                  data-testid="button-clear-filters"
                >
                  Clear
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select value={selectedBodyPart} onValueChange={setSelectedBodyPart}>
                  <SelectTrigger>
                    <SelectValue placeholder="Body Part" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    <SelectItem value="all">All Body Parts</SelectItem>
                    {uniqueBodyParts.map((part: string) => (
                      <SelectItem key={part} value={part}>
                        {part.charAt(0).toUpperCase() + part.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedEquipment} onValueChange={setSelectedEquipment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Equipment" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    <SelectItem value="all">All Equipment</SelectItem>
                    {uniqueEquipment.map((equipment: string) => (
                      <SelectItem key={equipment} value={equipment}>
                        {equipment ? equipment.charAt(0).toUpperCase() + equipment.slice(1) : equipment}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedTarget} onValueChange={setSelectedTarget}>
                  <SelectTrigger>
                    <SelectValue placeholder="Target Muscle" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    <SelectItem value="all">All Targets</SelectItem>
                    {uniqueTargets.map((target: string) => (
                      <SelectItem key={target} value={target}>
                        {target ? target.charAt(0).toUpperCase() + target.slice(1) : target}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Exercise Results */}
            {isLoadingExercises ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ministry-gold"></div>
              </div>
            ) : filteredExercises.length === 0 ? (
              <Card className="text-center py-12 bg-ministry-gold-exact/20">
                <CardContent>
                  <Search className="w-12 h-12 mx-auto text-ministry-steel mb-4" />
                  <h3 className="text-lg font-medium text-black mb-2">No exercises found</h3>
                  <p className="text-black">Try adjusting your search or filters</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {filteredExercises.map((exercise: Exercise) => (
                  <ExerciseCard key={exercise.exerciseId || exercise.id} exercise={exercise} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Favorites Tab */}
          <TabsContent value="favorites" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">My Favorite Exercises</h2>
              <Badge className="bg-ministry-gold text-black">
                {favoriteExercises.length} favorites
              </Badge>
            </div>

            {favoriteExercises.length === 0 ? (
              <Card className="text-center py-12 bg-ministry-gold-exact/20">
                <CardContent>
                  <Heart className="w-12 h-12 mx-auto text-ministry-steel mb-4" />
                  <h3 className="text-lg font-medium text-black mb-2">No favorites yet</h3>
                  <p className="text-black">Add exercises to your favorites from the Exercise Discovery tab</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {favoriteExercises.map((favorite: FavoriteExercise) => {
                  const exercise: Exercise = {
                    exerciseId: favorite.exerciseId,
                    name: favorite.exerciseName,
                    gifUrl: favorite.exerciseGifUrl,
                    targetMuscles: [favorite.exerciseTarget],
                    bodyParts: [favorite.exerciseBodyPart],
                    equipments: [favorite.exerciseEquipment],
                    secondaryMuscles: [],
                    instructions: [],
                    // Backward compatibility
                    id: favorite.exerciseId,
                    target: favorite.exerciseTarget,
                    bodyPart: favorite.exerciseBodyPart,
                    equipment: favorite.exerciseEquipment
                  };
                  return <ExerciseCard key={favorite.id} exercise={exercise} />;
                })}
              </div>
            )}
          </TabsContent>

          {/* Fitness Plans Tab */}
          <TabsContent value="plans" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">My Fitness Plans</h2>
              <Button
                onClick={() => setShowCreatePlan(true)}
                className="bg-ministry-gold hover:bg-ministry-gold/90 text-black"
                data-testid="button-create-plan"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Plan
              </Button>
            </div>

            {/* Create Plan Modal */}
            {showCreatePlan && (
              <Card className="bg-ministry-gold-exact/20">
                <CardHeader>
                  <CardTitle className="text-black">Create New Fitness Plan</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'black' }}>Plan Name</label>
                    <Input
                      value={newPlanName}
                      onChange={(e) => setNewPlanName(e.target.value)}
                      placeholder="Enter plan name..."
                      className="bg-white border-ministry-steel text-black"
                      data-testid="input-plan-name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'black' }}>Description (optional)</label>
                    <Input
                      value={newPlanDescription}
                      onChange={(e) => setNewPlanDescription(e.target.value)}
                      placeholder="Enter plan description..."
                      className="bg-white border-ministry-steel text-black"
                      data-testid="input-plan-description"
                    />
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      onClick={handleCreatePlan}
                      disabled={createPlanMutation.isPending}
                      className="bg-ministry-gold hover:bg-ministry-gold/90 text-black border-2 border-black"
                      data-testid="button-save-plan"
                    >
                      {createPlanMutation.isPending ? 'Creating...' : 'Create Plan'}
                    </Button>
                    <Button
                      onClick={() => {
                        setShowCreatePlan(false);
                        setNewPlanName('');
                        setNewPlanDescription('');
                      }}
                      variant="outline"
                      className="border-ministry-steel text-white"
                      data-testid="button-cancel-plan"
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Plans List */}
            {fitnessPlans.length === 0 ? (
              <Card className="text-center py-12 bg-ministry-gold-exact/20">
                <CardContent>
                  <BookOpen className="w-12 h-12 mx-auto text-ministry-steel mb-4" />
                  <h3 className="text-lg font-medium text-black mb-2">No fitness plans yet</h3>
                  <p className="text-black">Create your first fitness plan to get started</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {fitnessPlans.map((plan: FitnessPlan) => (
                  <Card key={plan.id} className="bg-ministry-gold-exact/20">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg text-black mb-2">{plan.name}</h3>
                          {plan.description && (
                            <p className="text-black text-sm mb-3">{plan.description}</p>
                          )}
                          <div className="flex items-center space-x-4 text-sm text-black">
                            <div className="flex items-center">
                              <List className="w-4 h-4 mr-1" />
                              {plan.exercises?.length || 0} exercises
                            </div>
                            <div className="flex items-center">
                              <Calendar className="w-4 h-4 mr-1" />
                              {format(new Date(plan.createdAt), 'MMM d, yyyy')}
                            </div>
                            {plan.isPublic && (
                              <Badge className="text-xs bg-green-100 text-green-800">Public</Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-ministry-steel text-black hover:bg-ministry-steel hover:text-white"
                            data-testid={`button-view-plan-${plan.id}`}
                          >
                            <BookOpen className="w-4 h-4 mr-1" />
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deletePlanMutation.mutate(plan.id)}
                            disabled={deletePlanMutation.isPending}
                            className="border-red-300 text-red-600 hover:bg-red-50"
                            data-testid={`button-delete-plan-${plan.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}