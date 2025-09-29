import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
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
  Trash2,
  Settings
} from "lucide-react";
import { format, isToday, isPast, isFuture } from "date-fns";
import { Link } from "wouter";

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
  imageUrl?: string; // Fallback property for exercise images
  exerciseTarget: string;
  exerciseBodyPart: string;
  exerciseEquipment: string;
  sets?: number;
  reps?: number;
  duration?: number;
  notes?: string;
  daysOfWeek?: string[];
  orderIndex: number;
}

interface PreBuiltPlan {
  name: string;
  description: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  equipment: string;
  duration: string;
  workoutsPerWeek: number;
  startDay: string;
  schedule: string[];
  exercises: PreBuiltExercise[];
}

interface PreBuiltExercise {
  name: string;
  sets: number;
  reps: number;
  duration?: number;
  rest: string;
  day: string;
  equipment: string[];
  bodyPart: string;
  gifUrl?: string;
  notes?: string;
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
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 25; // As per API docs
  const offset = (currentPage - 1) * limit;
  
  // Fitness plan state
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanDescription, setNewPlanDescription] = useState('');
  
  // Modal state for viewing today's exercises
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [selectedPlanForView, setSelectedPlanForView] = useState<FitnessPlan | null>(null);
  
  // Exercise completion tracking
  const [completedExercises, setCompletedExercises] = useState<Set<string>>(new Set());
  
  // Pre-built Plans state
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [selectedPlanEquipment, setSelectedPlanEquipment] = useState<string>('');
  const [selectedStartDay, setSelectedStartDay] = useState<string>('');
  const [selectedWorkoutDuration, setSelectedWorkoutDuration] = useState<string>('');
  const [selectedFrequency, setSelectedFrequency] = useState<string>('');
  const [selectedGoal, setSelectedGoal] = useState<string>('');
  const [selectedPlanForPreview, setSelectedPlanForPreview] = useState<PreBuiltPlan | null>(null);
  const [generatedPlans, setGeneratedPlans] = useState<PreBuiltPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState<boolean>(false);
  const [planGenerationError, setPlanGenerationError] = useState<string>('');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Effect to generate plans when filters change
  useEffect(() => {
    if (selectedLevel && selectedPlanEquipment && selectedStartDay && selectedWorkoutDuration && selectedFrequency && selectedGoal) {
      setPlansLoading(true);
      setPlanGenerationError('');
      generatePreBuiltPlans(
        selectedLevel, 
        selectedPlanEquipment, 
        selectedStartDay, 
        selectedWorkoutDuration, 
        selectedFrequency, 
        selectedGoal
      )
        .then(plans => {
          if (plans.length === 0) {
            setPlanGenerationError(`Unable to generate plans for ${selectedPlanEquipment}. Try selecting a different equipment type like "body weight" or "dumbbell".`);
          } else {
            setPlanGenerationError('');
          }
          setGeneratedPlans(plans);
          setPlansLoading(false);
        })
        .catch(error => {
          console.error('Error generating plans:', error);
          setPlanGenerationError('Failed to connect to exercise database. Please check your internet connection and try again.');
          setGeneratedPlans([]);
          setPlansLoading(false);
        });
    } else {
      setGeneratedPlans([]);
      setPlanGenerationError('');
    }
  }, [selectedLevel, selectedPlanEquipment, selectedStartDay, selectedWorkoutDuration, selectedFrequency, selectedGoal]);

  // Get current day of the week
  const getCurrentDayOfWeek = () => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[new Date().getDay()];
  };

  // Handle viewing plan modal
  const handleViewPlan = (plan: FitnessPlan) => {
    setSelectedPlanForView(plan);
    setShowPlanModal(true);
  };

  // Helper function to determine exercise week based on order (distribute evenly across 4 weeks)
  const getExerciseWeek = (exercises: FitnessPlanExercise[], exerciseIndex: number): number => {
    const totalExercises = exercises.length;
    const exercisesPerWeek = Math.ceil(totalExercises / 4);
    return Math.min(4, Math.floor(exerciseIndex / exercisesPerWeek) + 1);
  };

  // Helper function to get exercise day based on order (fallback if no daysOfWeek specified)
  const getExerciseDay = (currentWeekExercises: FitnessPlanExercise[], exerciseIndex: number): string => {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const dayIndex = exerciseIndex % 7;
    return days[dayIndex];
  };

  // Helper function to determine current week based on plan start date and completion
  const getCurrentWeek = (plan: FitnessPlan, exercises: FitnessPlanExercise[]): number => {
    if (!plan || !exercises || exercises.length === 0) return 1;
    
    const planStartDate = new Date(plan.createdAt);
    const now = new Date();
    const daysSinceStart = Math.floor((now.getTime() - planStartDate.getTime()) / (1000 * 60 * 60 * 24));
    const weeksSinceStart = Math.floor(daysSinceStart / 7);
    
    // Return current week (1-4)
    return Math.min(4, Math.max(1, weeksSinceStart + 1));
  };

  // Get today's exercises from a plan (filtered by current week and current day)
  const getTodaysExercises = (plan: FitnessPlan) => {
    const today = getCurrentDayOfWeek();
    if (!plan.exercises) return [];
    
    // Get current week and filter exercises
    const currentWeek = getCurrentWeek(plan, plan.exercises);
    const sortedAllExercises = (plan.exercises || []).sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
    const currentWeekExercises = sortedAllExercises.filter((exercise, index) => 
      getExerciseWeek(sortedAllExercises, index) === currentWeek
    );
    
    // Filter to today's exercises only
    const todaysExercises = currentWeekExercises.filter((exercise, index) => {
      // If exercise has specific days assigned, use those
      if (exercise.daysOfWeek && exercise.daysOfWeek.length > 0) {
        return exercise.daysOfWeek.includes(today);
      }
      // Fallback: distribute exercises across days based on order
      const exerciseDay = getExerciseDay(currentWeekExercises, index);
      return exerciseDay === today;
    });
    
    // Remove duplicates based on exerciseId
    const seenExerciseIds = new Set<string>();
    return todaysExercises.filter(exercise => {
      if (seenExerciseIds.has(exercise.exerciseId)) {
        return false;
      }
      seenExerciseIds.add(exercise.exerciseId);
      return true;
    });
  };

  // Get all today's exercises from all user plans (deduplicated)
  const getAllTodaysExercises = () => {
    if (!fitnessPlans) return [];
    
    const allExercises: Array<FitnessPlanExercise & { planName: string }> = [];
    const seenExerciseIds = new Set<string>();
    
    fitnessPlans.forEach((plan: FitnessPlan) => {
      const todaysExercises = getTodaysExercises(plan);
      todaysExercises.forEach(exercise => {
        // Only add if we haven't seen this exercise ID before
        if (!seenExerciseIds.has(exercise.exerciseId)) {
          seenExerciseIds.add(exercise.exerciseId);
          allExercises.push({
            ...exercise,
            planName: plan.name
          });
        }
      });
    });
    
    return allExercises;
  };

  // Handle exercise completion toggle
  const toggleExerciseCompletion = (exerciseId: string) => {
    setCompletedExercises(prev => {
      const newCompleted = new Set(prev);
      if (newCompleted.has(exerciseId)) {
        newCompleted.delete(exerciseId);
      } else {
        newCompleted.add(exerciseId);
      }
      return newCompleted;
    });
  };

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

  // Build filter params for API
  const filterParams = new URLSearchParams();
  filterParams.set('offset', offset.toString());
  filterParams.set('limit', limit.toString());
  
  if (searchQuery) filterParams.set('search', searchQuery);
  if (selectedBodyPart !== 'all') filterParams.set('bodyParts', selectedBodyPart);
  if (selectedEquipment !== 'all') filterParams.set('equipment', selectedEquipment);
  if (selectedTarget !== 'all') filterParams.set('muscles', selectedTarget);
  filterParams.set('sortBy', 'name');
  filterParams.set('sortOrder', 'asc');

  // Fetch exercises with server-side filtering
  const { data: exerciseResponse, isLoading: isLoadingExercises } = useQuery({
    queryKey: ['exercises', currentPage, searchQuery, selectedBodyPart, selectedEquipment, selectedTarget],
    queryFn: async () => {
      console.log(`Fetching exercises page ${currentPage} (offset=${offset}, limit=${limit})...`);
      const url = `https://www.exercisedb.dev/api/v1/exercises/filter?${filterParams.toString()}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch exercises');
      const data = await response.json();
      console.log('Exercise data received:', data.data?.length, 'exercises', 'total:', data.metadata?.totalExercises);
      return data;
    },
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Fetch muscles for filtering and filter out unused ones
  const { data: allMuscles = [] } = useQuery({
    queryKey: ['muscles'],
    queryFn: async () => {
      console.log('Fetching muscles from ExerciseDB API...');
      const response = await fetch('https://www.exercisedb.dev/api/v1/muscles');
      if (!response.ok) throw new Error('Failed to fetch muscles');
      const data = await response.json();
      console.log('Muscles data received:', data.data?.length, 'muscles');
      return data.data || [];
    },
    staleTime: 0,
    refetchOnMount: true,
  });
  
  // Filter muscles to only include those with exercises
  const { data: usedMuscles = [] } = useQuery({
    queryKey: ['used-muscles'],
    queryFn: async () => {
      console.log('Checking which muscles have exercises...');
      const usedMuscleNames = new Set<string>();
      
      // Get first 500 exercises to extract used muscles
      for (let offset = 0; offset < 500; offset += 100) {
        const response = await fetch(`https://www.exercisedb.dev/api/v1/exercises/filter?offset=${offset}&limit=100`);
        if (!response.ok) break;
        const data = await response.json();
        
        data.data?.forEach((exercise: any) => {
          exercise.targetMuscles?.forEach((muscle: string) => {
            usedMuscleNames.add(muscle);
          });
        });
        
        if (data.data?.length < 100) break; // No more data
      }
      
      const filteredMuscles = allMuscles.filter((muscle: any) => 
        usedMuscleNames.has(muscle.name)
      );
      
      console.log('Filtered muscles:', filteredMuscles.length, 'out of', allMuscles.length);
      return filteredMuscles;
    },
    enabled: allMuscles.length > 0,
    staleTime: 300000, // Cache for 5 minutes
  });

  // Fetch equipment for filtering
  const { data: equipments = [] } = useQuery({
    queryKey: ['equipments'],
    queryFn: async () => {
      console.log('Fetching equipments from ExerciseDB API...');
      const response = await fetch('https://www.exercisedb.dev/api/v1/equipments');
      if (!response.ok) throw new Error('Failed to fetch equipments');
      const data = await response.json();
      console.log('Equipments data received:', data.data?.length, 'equipments');
      return data.data || [];
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  // Fetch bodyparts for filtering
  const { data: bodyParts = [] } = useQuery({
    queryKey: ['bodyparts'],
    queryFn: async () => {
      console.log('Fetching bodyparts from ExerciseDB API...');
      const response = await fetch('https://www.exercisedb.dev/api/v1/bodyparts');
      if (!response.ok) throw new Error('Failed to fetch bodyparts');
      const data = await response.json();
      console.log('Bodyparts data received:', data.data?.length, 'bodyparts');
      return data.data || [];
    },
    staleTime: 0,
    refetchOnMount: true,
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

  // Extract data from response
  const exercises = exerciseResponse?.data || [];
  const totalCount = exerciseResponse?.metadata?.totalExercises || 0;
  const totalPages = exerciseResponse?.metadata?.totalPages || Math.ceil(totalCount / limit);

  // Get filter options from API data
  const uniqueBodyParts = bodyParts.map((bp: any) => bp.name).sort();
  const uniqueEquipment = equipments.map((eq: any) => eq.name).sort();
  const uniqueTargets = (usedMuscles || allMuscles).map((muscle: any) => muscle.name).sort();
  
  console.log('Filter options:', {
    bodyParts: uniqueBodyParts.slice(0, 5),
    equipment: uniqueEquipment.slice(0, 5),
    targets: uniqueTargets.slice(0, 5),
    totalExercises: exercises.length,
    totalCount,
    currentPage,
    totalPages
  });
  
  console.log(`Page ${currentPage}/${totalPages}: ${exercises.length} exercises shown (${totalCount} total)`);

  // No client-side filtering needed - server handles it
  const filteredExercises = exercises;
  
  // Reset to page 1 when filters change
  const handleFilterChange = (filterType: string, value: string) => {
    setCurrentPage(1);
    if (filterType === 'bodyPart') setSelectedBodyPart(value);
    if (filterType === 'equipment') setSelectedEquipment(value);
    if (filterType === 'target') setSelectedTarget(value);
  };
  
  const handleSearchChange = (value: string) => {
    setCurrentPage(1);
    setSearchQuery(value);
  };

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

  // Dynamic plan generation using ExerciseDB API
  const generatePreBuiltPlans = async (
    level: string, 
    equipment: string, 
    startDay: string, 
    duration: string, 
    frequency: string, 
    goal: string
  ): Promise<PreBuiltPlan[]> => {
    try {
      console.log('Generating plans with params:', { level, equipment, startDay, duration, frequency, goal });
      
      const exercises = await getExercisesForEquipment(equipment);
      console.log(`Found ${exercises.length} exercises for ${equipment}`);
      
      if (exercises.length < 5) {
        console.warn(`Not enough exercises for equipment: ${equipment}. Found: ${exercises.length}`);
        // Fallback to body weight exercises if selected equipment has too few
        if (equipment !== 'body weight') {
          console.log('Attempting fallback to body weight exercises...');
          const bodyweightExercises = await getExercisesForEquipment('body weight');
          if (bodyweightExercises.length >= 5) {
            console.log('Falling back to bodyweight exercises');
            const weeklyPlan = generateDynamicPlan(bodyweightExercises, level as "Beginner"|"Intermediate"|"Advanced", 'body weight');
            const preBuiltPlan = convertWeeklyPlanToPreBuiltPlan(weeklyPlan, startDay);
            return [preBuiltPlan];
          }
        }
        return [];
      }

      const weeklyPlan = generateDynamicPlan(exercises, level as "Beginner"|"Intermediate"|"Advanced", equipment);
      const preBuiltPlan = convertWeeklyPlanToPreBuiltPlan(weeklyPlan, startDay);
      
      // Customize plan based on additional parameters
      preBuiltPlan.name = `${level.charAt(0).toUpperCase() + level.slice(1)} ${equipment} Program (${duration}min)`;
      preBuiltPlan.description = `${goal.charAt(0).toUpperCase() + goal.slice(1).replace('-', ' ')} focused ${level} program using ${equipment}. ${frequency} days per week, ${duration} minutes per session.`;
      preBuiltPlan.workoutsPerWeek = parseInt(frequency);
      
      // Update schedule to match the user's selected frequency
      const frequencyNumber = parseInt(frequency);
      const allWeekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const startDayIndex = allWeekdays.indexOf(startDay.toLowerCase());
      
      // Create a schedule that matches the frequency, starting from the selected start day
      const updatedSchedule: string[] = [];
      for (let i = 0; i < frequencyNumber && i < 7; i++) {
        const dayIndex = (startDayIndex + i * Math.ceil(7 / frequencyNumber)) % 7;
        updatedSchedule.push(allWeekdays[dayIndex]);
      }
      preBuiltPlan.schedule = updatedSchedule;
      
      console.log('Successfully generated plan:', preBuiltPlan.name);
      console.log('Plan schedule updated to:', updatedSchedule);
      return [preBuiltPlan];
    } catch (error) {
      console.error('Error generating dynamic plans:', error);
      return [];
    }
  };

  // New dynamic types and helper functions for ExerciseDB API integration
  interface APIExercise {
    id: string;
    name: string;
    bodyPart: string;
    equipment: string;
    targetMuscles: string[];
    gifUrl?: string;
  }

  interface PlanExercise {
    exercise: APIExercise;
    sets: number;
    reps: number | null;
    durationSec?: number;
  }

  interface DayPlan {
    name: string;
    exercises: PlanExercise[];
  }

  interface WeeklyPlan {
    level: "Beginner" | "Intermediate" | "Advanced";
    equipment: string;
    weeks: DayPlan[][];
  }

  // Helper to fetch data from ExerciseDB API
  async function fetchJSON(url: string): Promise<any> {
    console.log('Fetching from:', url);
    const resp = await fetch(url);
    if (!resp.ok) {
      console.error(`Fetch failed for ${url}: ${resp.status} ${resp.statusText}`);
      throw new Error(`Fetch failed: ${resp.status} ${resp.statusText}`);
    }
    const data = await resp.json();
    console.log('API Response:', data);
    return data;
  }

  async function getEquipments(): Promise<string[]> {
    const resp = await fetchJSON('https://www.exercisedb.dev/api/v1/equipments');
    return resp.data.map((e: any) => e.name);
  }

  async function getExercisesForEquipment(equipment: string): Promise<APIExercise[]> {
    const limit = 100;
    const maxExercises = 200; // Only fetch first 200 exercises max for performance
    let offset = 0;
    let all: APIExercise[] = [];
    
    try {
      while (offset < maxExercises) {
        const params = new URLSearchParams();
        params.set('offset', offset.toString());
        params.set('limit', limit.toString());
        params.set('equipment', equipment);
        params.set('sortBy', 'name');
        params.set('sortOrder', 'asc');
        
        const url = `https://www.exercisedb.dev/api/v1/exercises/filter?${params.toString()}`;
        
        try {
          const resp = await fetchJSON(url);
          const batch: any[] = resp.data;
          if (!batch || batch.length === 0) break;
          
          const mapped: APIExercise[] = batch.map((ex: any) => ({
            id: ex.exerciseId || ex.id,
            name: ex.name,
            bodyPart: ex.bodyParts?.[0] || ex.bodyPart || 'unknown',
            equipment: ex.equipments?.[0] || ex.equipment || equipment,
            targetMuscles: ex.targetMuscles || [],
            gifUrl: ex.gifUrl
          }));
          all = all.concat(mapped);
          
          // If we got fewer results than requested, we've reached the end
          if (batch.length < limit) break;
          
          offset += limit;
          
          // If we have enough exercises for plan generation, we can stop
          if (all.length >= 50) break;
          
        } catch (batchError) {
          console.warn(`Failed to fetch batch at offset ${offset} for ${equipment}:`, batchError);
          // If we already have some exercises, we can continue with what we have
          if (all.length >= 10) {
            console.log(`Using ${all.length} exercises despite batch failure`);
            break;
          }
          // If this is the first batch and it failed, re-throw the error
          if (offset === 0) throw batchError;
          break;
        }
      }
      
      console.log(`Successfully fetched ${all.length} exercises for ${equipment}`);
      return all;
    } catch (error) {
      console.error(`Error fetching exercises for ${equipment}:`, error);
      throw error;
    }
  }

  // Helper to pick exercises by body part
  function pickByBodyPart(exs: APIExercise[], bodyPart: string, count: number): APIExercise[] {
    const filtered = exs.filter(e => e.bodyPart.toLowerCase() === bodyPart.toLowerCase());
    if (filtered.length >= count) {
      return filtered.slice(0, count);
    } else {
      return filtered.concat(
        exs.filter(e => e.bodyPart.toLowerCase() !== bodyPart.toLowerCase()).slice(0, count - filtered.length)
      );
    }
  }

  function generateDynamicPlan(exercises: APIExercise[], level: "Beginner"|"Intermediate"|"Advanced", equipment: string): WeeklyPlan {
    const weeks: DayPlan[][] = [];
    for (let w = 0; w < 4; w++) {
      const week: DayPlan[] = [];
      
      let config;
      if (level === "Beginner") config = { sets: 3, restSec: 60, repRange: [10,12] };
      else if (level === "Intermediate") config = { sets: 4, restSec: 45, repRange: [10,15] };
      else config = { sets: 5, restSec: 30, repRange: [12,20] };
      
      // Day1: Push (Chest, Shoulders, Triceps)
      week.push({
        name: `Push (Chest/Shoulder/Triceps) ‒ Week ${w+1}`,
        exercises: [
          ...pickByBodyPart(exercises, 'chest', 1).map(ex => ({
            exercise: ex,
            sets: config.sets,
            reps: config.repRange[0]
          })),
          ...pickByBodyPart(exercises, 'shoulders', 1).map(ex => ({
            exercise: ex,
            sets: config.sets,
            reps: config.repRange[0]
          })),
          ...pickByBodyPart(exercises, 'upper arms', 1).map(ex => ({
            exercise: ex,
            sets: config.sets,
            reps: config.repRange[0]
          }))
        ]
      });
      
      // Day2: Legs
      week.push({
        name: `Legs (Quads/Glutes/Hamstrings/Calves) ‒ Week ${w+1}`,
        exercises: [
          ...pickByBodyPart(exercises, 'upper legs', 1),
          ...pickByBodyPart(exercises, 'lower legs', 1),
          ...pickByBodyPart(exercises, 'upper legs', 1)
        ].map(ex => ({
          exercise: ex,
          sets: config.sets,
          reps: config.repRange[0]
        }))
      });
      
      // Day3: Pull (Back/Biceps)
      week.push({
        name: `Pull (Back/Biceps) ‒ Week ${w+1}`,
        exercises: [
          ...pickByBodyPart(exercises, 'back', 1),
          ...pickByBodyPart(exercises, 'upper arms', 1)
        ].map(ex => ({
          exercise: ex,
          sets: config.sets,
          reps: config.repRange[0]
        }))
      });
      
      // Day4: Core
      week.push({
        name: `Core & Abs ‒ Week ${w+1}`,
        exercises: [
          ...pickByBodyPart(exercises, 'waist', 1),
          ...pickByBodyPart(exercises, 'waist', 1)
        ].map(ex => ({
          exercise: ex,
          sets: config.sets,
          reps: config.repRange[0]
        }))
      });
      
      // Day5: Full Body
      week.push({
        name: `Full Body Circuit ‒ Week ${w+1}`,
        exercises: [
          ...pickByBodyPart(exercises, 'chest', 1),
          ...pickByBodyPart(exercises, 'back', 1),
          ...pickByBodyPart(exercises, 'upper legs', 1),
          ...pickByBodyPart(exercises, 'shoulders', 1),
          ...pickByBodyPart(exercises, 'waist', 1)
        ].map(ex => ({
          exercise: ex,
          sets: config.sets,
          reps: config.repRange[0]
        }))
      });
      
      weeks.push(week);
    }
    
    return { level, equipment, weeks };
  }

  // Convert WeeklyPlan to PreBuiltPlan format for UI compatibility
  function convertWeeklyPlanToPreBuiltPlan(weeklyPlan: WeeklyPlan, startDay: string): PreBuiltPlan {
    const allExercises: PreBuiltExercise[] = [];
    let exerciseIndex = 0;
    
    weeklyPlan.weeks.forEach((week, weekIndex) => {
      week.forEach((day) => {
        day.exercises.forEach((planExercise) => {
          const restTime = weeklyPlan.level === "Beginner" ? "60-90s" : 
                          weeklyPlan.level === "Intermediate" ? "45-60s" : "30-45s";
          
          allExercises.push({
            name: planExercise.exercise.name,
            sets: planExercise.sets,
            reps: planExercise.reps || 12,
            rest: restTime,
            day: `Week${weekIndex + 1}-${day.name}`,
            bodyPart: planExercise.exercise.bodyPart,
            equipment: [planExercise.exercise.equipment],
            gifUrl: planExercise.exercise.gifUrl
          });
        });
      });
    });

    const workoutsPerWeek = weeklyPlan.level === "Beginner" ? 3 : weeklyPlan.level === "Intermediate" ? 4 : 5;
    const scheduleMap = {
      "Beginner": ['Monday', 'Wednesday', 'Friday'],
      "Intermediate": ['Monday', 'Tuesday', 'Thursday', 'Friday'],
      "Advanced": ['Monday', 'Tuesday', 'Wednesday', 'Friday', 'Saturday']
    };

    return {
      name: `${weeklyPlan.level} ${weeklyPlan.equipment} Program`,
      description: `Dynamic ${weeklyPlan.level.toLowerCase()} program using ${weeklyPlan.equipment}. 4-week structured training plan.`,
      level: weeklyPlan.level.toLowerCase() as 'beginner' | 'intermediate' | 'advanced',
      equipment: weeklyPlan.equipment,
      duration: "4 weeks",
      workoutsPerWeek: workoutsPerWeek,
      startDay: startDay,
      schedule: scheduleMap[weeklyPlan.level],
      exercises: allExercises
    };
  }

  const getWorkoutSchedule = (startDay: string, workoutsPerWeek: number, defaultDays: string[]): string[] => {
    return defaultDays.slice(0, workoutsPerWeek);
  };

  // Create plan from pre-built template
  const createPrebuiltPlanMutation = useMutation({
    mutationFn: async (preBuiltPlan: PreBuiltPlan) => {
      // First create the plan
      const planResponse = await apiRequest('POST', '/api/fitness-plans', {
        name: preBuiltPlan.name,
        description: preBuiltPlan.description,
        isPublic: false
      });

      // Add exercises to the plan directly (using fallback approach since no ExerciseDB integration available)
      for (let i = 0; i < preBuiltPlan.exercises.length; i++) {
        const exercise = preBuiltPlan.exercises[i];
        
        // Get the training day for this exercise
        const trainingDay = getExerciseTrainingDay(i, preBuiltPlan.startDay, preBuiltPlan.schedule);
        
        // Create exercise entry directly with comprehensive data
        const exerciseData = {
          exerciseId: `prebuilt-${Date.now()}-${i}`,
          exerciseName: exercise.name,
          imageUrl: exercise.gifUrl || null, // Use actual GIF URL from ExerciseDB API
          targetMuscle: exercise.bodyPart,
          bodyPart: exercise.bodyPart,
          equipment: exercise.equipment.join(', '),
          sets: exercise.sets,
          reps: String(exercise.reps), // Convert to string regardless of type
          minutes: exercise.duration,
          restTime: parseInt(exercise.rest.replace(/[^0-9]/g, '')) || 60,
          notes: `${exercise.rest} rest - Training Day: ${exercise.day}`,
          daysOfWeek: [trainingDay], // Properly distribute across selected days
          orderIndex: i
        };
        
        await apiRequest('POST', `/api/fitness-plans/${planResponse.id}/exercises`, exerciseData);
      }

      return planResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api', 'fitness-plans'] });
      toast({
        title: "Plan Created!",
        description: "Your pre-built workout plan has been added to My Plans.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create plan. Please try again.",
        variant: "destructive",
      });
      console.error('Plan creation error:', error);
    },
  });

  // Helper function to distribute exercises across selected training days
  const getExerciseTrainingDay = (exerciseIndex: number, startDay: string, schedule: string[]) => {
    try {
      // Validate inputs
      if (!startDay || !schedule || !Array.isArray(schedule) || schedule.length === 0) {
        console.error('Invalid inputs to getExerciseTrainingDay:', { exerciseIndex, startDay, schedule });
        return 'monday'; // Safe fallback
      }

      // Convert user's selected start day to weekday index (0 = sunday, 1 = monday, etc.)
      const dayToIndex: { [key: string]: number } = {
        'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3, 
        'thursday': 4, 'friday': 5, 'saturday': 6
      };
      
      const indexToDay: { [key: number]: string } = {
        0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
        4: 'thursday', 5: 'friday', 6: 'saturday'
      };
      
      const startIndex = dayToIndex[startDay.toLowerCase()] || 1; // Default to monday
      
      // Calculate which day this exercise should be on based on the training schedule
      const dayOffset = exerciseIndex % schedule.length;
      
      // Map schedule days to actual weekdays starting from selected start day
      const scheduleDayToWeekday = (scheduleIndex: number) => {
        if (scheduleIndex >= schedule.length) return indexToDay[1]; // Monday fallback
        
        const scheduleDay = schedule[scheduleIndex]?.toLowerCase() || '';
        
        // If schedule uses actual weekday names, use them directly
        if (dayToIndex.hasOwnProperty(scheduleDay)) {
          return scheduleDay;
        }
        
        // Otherwise distribute across training frequency starting from start day
        const weekdayIndex = (startIndex + scheduleIndex * 2) % 7; // Space out by 2 days
        return indexToDay[weekdayIndex] || 'monday';
      };
      
      return scheduleDayToWeekday(dayOffset);
    } catch (error) {
      console.error('Error in getExerciseTrainingDay:', error);
      return 'monday'; // Safe fallback
    }
  };

  // Helper function to get exercise GIF URLs (since no ExerciseDB integration available)
  const getExerciseGifUrl = (exerciseName: string): string => {
    // Map common exercise names to placeholder or default GIF URLs
    const exerciseGifMap: Record<string, string> = {
      'push-up': '/api/placeholder-exercise.gif',
      'bodyweight squat': '/api/placeholder-exercise.gif',
      'plank': '/api/placeholder-exercise.gif',
      'pull-up': '/api/placeholder-exercise.gif',
      'dumbbell curl': '/api/placeholder-exercise.gif',
      'deadlift': '/api/placeholder-exercise.gif',
      'bench press': '/api/placeholder-exercise.gif'
    };
    
    // Return specific URL if available, otherwise return generic placeholder
    return exerciseGifMap[exerciseName.toLowerCase()] || '/api/placeholder-exercise.gif';
  };

  const handleCreatePlanFromPrebuilt = (plan: PreBuiltPlan) => {
    createPrebuiltPlanMutation.mutate(plan);
  };

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
        <Tabs defaultValue="workout" className="w-full">
          <TabsList className="grid w-full grid-cols-5 bg-ministry-gold-exact/20">
            <TabsTrigger value="workout" className="flex items-center gap-2 data-[state=active]:bg-ministry-gold data-[state=active]:text-black">
              <Dumbbell className="w-4 h-4" />
              Workout
            </TabsTrigger>
            <TabsTrigger value="exercises" className="flex items-center gap-2 data-[state=active]:bg-ministry-gold data-[state=active]:text-black">
              <Search className="w-4 h-4" />
              Exercises
            </TabsTrigger>
            <TabsTrigger value="favorites" className="flex items-center gap-2 data-[state=active]:bg-ministry-gold data-[state=active]:text-black">
              <Heart className="w-4 h-4" />
              Favorites
            </TabsTrigger>
            <TabsTrigger value="pre-built-plans" className="flex items-center gap-2 data-[state=active]:bg-ministry-gold data-[state=active]:text-black">
              <BookOpen className="w-4 h-4" />
              Plans
            </TabsTrigger>
            <TabsTrigger value="my-plans" className="flex items-center gap-2 data-[state=active]:bg-ministry-gold data-[state=active]:text-black">
              <List className="w-4 h-4" />
              My Plans
            </TabsTrigger>
          </TabsList>

          {/* Daily Workout Tab */}
          <TabsContent value="workout" className="space-y-6">
            {/* Today's Workout Header */}
            <div className="flex items-center mb-6">
              <Dumbbell className="w-6 h-6 text-ministry-gold mr-2" />
              <h2 className="text-xl font-bold text-white">Today's Workout</h2>
              <div className="ml-auto text-sm text-ministry-gold">
                {getCurrentDayOfWeek().charAt(0).toUpperCase() + getCurrentDayOfWeek().slice(1)}
              </div>
            </div>

            {(() => {
              const todaysExercises = getAllTodaysExercises();
              
              if (todaysExercises.length === 0) {
                return (
                  <Card className="text-center py-12 bg-ministry-gold-exact/20">
                    <CardContent>
                      <Calendar className="w-12 h-12 mx-auto text-ministry-steel mb-4" />
                      <h3 className="text-lg font-medium text-black mb-2">No Workout Today</h3>
                      <p className="text-black">
                        You have no exercises scheduled for today. Create a fitness plan to get started!
                      </p>
                    </CardContent>
                  </Card>
                );
              }

              return (
                <div className="space-y-4">
                  {todaysExercises.map((exercise, index) => (
                    <Card key={`${exercise.planId}-${exercise.exerciseId}`} className="border border-border bg-ministry-gold-exact/10">
                      <CardContent className="p-4">
                        <div className="flex gap-6">
                          {/* Exercise Image - Larger for better exercise demonstration */}
                          <div className="flex-shrink-0">
                            {(exercise.exerciseGifUrl || exercise.imageUrl) ? (
                              <img
                                src={exercise.exerciseGifUrl || exercise.imageUrl}
                                alt={`How to perform ${exercise.exerciseName}`}
                                className="w-32 h-32 rounded-lg object-cover border-2 border-ministry-gold/30"
                                data-testid={`img-workout-exercise-${exercise.exerciseId}`}
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-32 h-32 rounded-lg bg-muted flex items-center justify-center border-2 border-ministry-steel/30">
                                <Dumbbell className="w-12 h-12 text-muted-foreground" />
                              </div>
                            )}
                            {/* Exercise demonstration label */}
                            <p className="text-xs text-ministry-gold mt-1 text-center">Exercise Demo</p>
                          </div>

                          {/* Exercise Details */}
                          <div className="flex-grow">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h4 className="font-medium text-white mb-1" data-testid={`text-workout-exercise-name-${exercise.exerciseId}`}>
                                  {exercise.exerciseName}
                                </h4>
                                <p className="text-xs text-ministry-gold">
                                  From: {exercise.planName}
                                </p>
                              </div>
                              
                              {/* Completion Checkbox */}
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id={`exercise-${exercise.exerciseId}`}
                                  checked={completedExercises.has(exercise.exerciseId)}
                                  onCheckedChange={() => toggleExerciseCompletion(exercise.exerciseId)}
                                  className="data-[state=checked]:bg-ministry-gold data-[state=checked]:border-ministry-gold"
                                  data-testid={`checkbox-complete-${exercise.exerciseId}`}
                                />
                                <label 
                                  htmlFor={`exercise-${exercise.exerciseId}`} 
                                  className="text-sm text-white cursor-pointer"
                                >
                                  {completedExercises.has(exercise.exerciseId) ? 'Completed' : 'Complete'}
                                </label>
                              </div>
                            </div>
                            
                            {/* Exercise Parameters */}
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-white">Sets:</span>
                                <span className="text-ministry-gold" data-testid={`text-workout-sets-${exercise.exerciseId}`}>
                                  {exercise.sets}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-white">Reps:</span>
                                <span className="text-ministry-gold" data-testid={`text-workout-reps-${exercise.exerciseId}`}>
                                  {exercise.reps}
                                </span>
                              </div>
                              {exercise.duration && (
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-white" />
                                  <span className="font-medium text-white">Time:</span>
                                  <span className="text-ministry-gold" data-testid={`text-workout-duration-${exercise.exerciseId}`}>
                                    {exercise.duration} min
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Notes */}
                            {exercise.notes && (
                              <div className="mt-3 p-2 bg-ministry-gold-exact/20 rounded">
                                <p className="text-sm text-white">
                                  <strong>Notes:</strong> {exercise.notes}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  
                  {/* Workout Summary */}
                  <Card className="bg-ministry-gold text-black mt-6">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">Today's Progress</h4>
                          <p className="text-sm">
                            {completedExercises.size} of {todaysExercises.length} exercises completed
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold">
                            {todaysExercises.length > 0 ? Math.round((completedExercises.size / todaysExercises.length) * 100) : 0}%
                          </div>
                          <div className="text-xs">Complete</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })()}
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
                    onChange={(e) => handleSearchChange(e.target.value)}
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
                    setCurrentPage(1);
                  }}
                  variant="outline"
                  className="border-ministry-gold text-ministry-gold hover:bg-ministry-gold hover:text-black"
                  data-testid="button-clear-filters"
                >
                  Clear
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select value={selectedBodyPart} onValueChange={(value) => handleFilterChange('bodyPart', value)}>
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

                <Select value={selectedEquipment} onValueChange={(value) => handleFilterChange('equipment', value)}>
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

                <Select value={selectedTarget} onValueChange={(value) => handleFilterChange('target', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Target Muscle" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    <SelectItem value="all">All Muscles</SelectItem>
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
              <>
                {/* Results header with pagination info */}
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm text-white">
                    Showing {exercises.length} of {totalCount} exercises
                    {(searchQuery || selectedBodyPart !== 'all' || selectedEquipment !== 'all' || selectedTarget !== 'all') && (
                      <span className="ml-2 text-ministry-gold">
                        (filtered)
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-white">
                    Page {currentPage} of {totalPages}
                  </div>
                </div>

                {/* Exercise List */}
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                  {filteredExercises.map((exercise: Exercise) => (
                    <ExerciseCard key={exercise.exerciseId || exercise.id} exercise={exercise} />
                  ))}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center space-x-2 mt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="border-ministry-gold text-ministry-gold hover:bg-ministry-gold hover:text-black"
                      data-testid="button-prev-page"
                    >
                      Previous
                    </Button>
                    
                    <div className="flex items-center space-x-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const page = currentPage <= 3 ? i + 1 : currentPage - 2 + i;
                        if (page > totalPages) return null;
                        return (
                          <Button
                            key={page}
                            variant={page === currentPage ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className={page === currentPage 
                              ? 'bg-ministry-gold text-black hover:bg-ministry-gold/90' 
                              : 'border-ministry-gold text-ministry-gold hover:bg-ministry-gold hover:text-black'
                            }
                            data-testid={`button-page-${page}`}
                          >
                            {page}
                          </Button>
                        );
                      })}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="border-ministry-gold text-ministry-gold hover:bg-ministry-gold hover:text-black"
                      data-testid="button-next-page"
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
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

          {/* Pre-built Plans Tab */}
          <TabsContent value="pre-built-plans" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Pre-built Workout Plans</h2>
            </div>
            
            {/* Plan Selection Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {/* Level Selection */}
              <Card className="bg-ministry-gold-exact/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-black text-sm">Fitness Level</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                    <SelectTrigger className="w-full" data-testid="select-fitness-level">
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Equipment Selection */}
              <Card className="bg-ministry-gold-exact/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-black text-sm">Available Equipment</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={selectedPlanEquipment} onValueChange={setSelectedPlanEquipment}>
                    <SelectTrigger className="w-full" data-testid="select-plan-equipment">
                      <SelectValue placeholder="Select equipment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="body weight">Bodyweight Only</SelectItem>
                      <SelectItem value="dumbbell">Dumbbells</SelectItem>
                      <SelectItem value="barbell">Barbell & Weights</SelectItem>
                      <SelectItem value="cable">Cable Machine</SelectItem>
                      <SelectItem value="smith machine">Smith Machine</SelectItem>
                      <SelectItem value="kettlebell">Kettlebells</SelectItem>
                      <SelectItem value="resistance band">Resistance Bands</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Start Day Selection */}
              <Card className="bg-ministry-gold-exact/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-black text-sm">Start Day</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={selectedStartDay} onValueChange={setSelectedStartDay}>
                    <SelectTrigger className="w-full" data-testid="select-start-day">
                      <SelectValue placeholder="Select start day" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monday">Monday</SelectItem>
                      <SelectItem value="tuesday">Tuesday</SelectItem>
                      <SelectItem value="wednesday">Wednesday</SelectItem>
                      <SelectItem value="thursday">Thursday</SelectItem>
                      <SelectItem value="friday">Friday</SelectItem>
                      <SelectItem value="saturday">Saturday</SelectItem>
                      <SelectItem value="sunday">Sunday</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Workout Duration Selection */}
              <Card className="bg-ministry-gold-exact/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-black text-sm">Workout Duration</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={selectedWorkoutDuration} onValueChange={setSelectedWorkoutDuration}>
                    <SelectTrigger className="w-full" data-testid="select-workout-duration">
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="45">45 minutes</SelectItem>
                      <SelectItem value="60">60 minutes</SelectItem>
                      <SelectItem value="90">90 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Frequency Selection */}
              <Card className="bg-ministry-gold-exact/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-black text-sm">Training Frequency</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={selectedFrequency} onValueChange={setSelectedFrequency}>
                    <SelectTrigger className="w-full" data-testid="select-frequency">
                      <SelectValue placeholder="Workouts per week" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 days per week</SelectItem>
                      <SelectItem value="4">4 days per week</SelectItem>
                      <SelectItem value="5">5 days per week</SelectItem>
                      <SelectItem value="6">6 days per week</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Goal Selection */}
              <Card className="bg-ministry-gold-exact/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-black text-sm">Primary Goal</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={selectedGoal} onValueChange={setSelectedGoal}>
                    <SelectTrigger className="w-full" data-testid="select-goal">
                      <SelectValue placeholder="Select your goal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="strength">Build Strength</SelectItem>
                      <SelectItem value="muscle">Build Muscle</SelectItem>
                      <SelectItem value="endurance">Improve Endurance</SelectItem>
                      <SelectItem value="weight-loss">Weight Loss</SelectItem>
                      <SelectItem value="general">General Fitness</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            </div>

            {/* Available Plans */}
            {selectedLevel && selectedPlanEquipment && selectedStartDay && selectedWorkoutDuration && selectedFrequency && selectedGoal && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-black">
                  Recommended {selectedLevel.charAt(0).toUpperCase() + selectedLevel.slice(1)} Plans
                </h3>
                
                {plansLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ministry-gold"></div>
                  </div>
                ) : planGenerationError ? (
                  <Card className="bg-red-100 border-red-300">
                    <CardContent className="py-6 text-center">
                      <div className="text-red-600 mb-2">⚠️ Plan Generation Failed</div>
                      <p className="text-red-800">{planGenerationError}</p>
                    </CardContent>
                  </Card>
                ) : (
                  generatedPlans.map((plan, index) => (
                  <Card key={index} className="bg-ministry-gold-exact/20 border border-ministry-gold/30">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-black flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-ministry-gold" />
                            {plan.name}
                          </CardTitle>
                          <p className="text-sm text-black mt-1">{plan.description}</p>
                        </div>
                        <Badge variant="outline" className="border-ministry-gold text-ministry-gold">
                          {plan.duration}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                        <div>
                          <span className="font-medium text-ministry-gold">Level:</span>
                          <p className="text-black capitalize">{plan.level}</p>
                        </div>
                        <div>
                          <span className="font-medium text-ministry-gold">Workouts/Week:</span>
                          <p className="text-black">{plan.workoutsPerWeek}</p>
                        </div>
                        <div>
                          <span className="font-medium text-ministry-gold">Equipment:</span>
                          <p className="text-black capitalize">{plan.equipment}</p>
                        </div>
                        <div>
                          <span className="font-medium text-ministry-gold">Start Day:</span>
                          <p className="text-black capitalize">{plan.startDay}</p>
                        </div>
                      </div>
                      
                      <div className="mb-4">
                        <h4 className="font-medium text-ministry-gold mb-2">Weekly Schedule:</h4>
                        <div className="flex flex-wrap gap-2">
                          {(plan.schedule || []).map((day, dayIndex) => (
                            <Badge key={dayIndex} variant="secondary" className="bg-ministry-gold/20 text-black">
                              {day}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleCreatePlanFromPrebuilt(plan)}
                          disabled={createPrebuiltPlanMutation.isPending}
                          className="bg-ministry-gold hover:bg-ministry-gold/90 text-black"
                          data-testid={`button-create-prebuilt-plan-${index}`}
                        >
                          {createPrebuiltPlanMutation.isPending ? "Creating..." : "Create This Plan"}
                        </Button>
                        <Button
                          onClick={() => setSelectedPlanForPreview(plan)}
                          variant="outline"
                          className="border-ministry-gold text-ministry-gold hover:bg-ministry-gold/10"
                          data-testid={`button-preview-plan-${index}`}
                        >
                          Preview Exercises
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
                )}
              </div>
            )}

            {(!selectedLevel || !selectedPlanEquipment || !selectedStartDay || !selectedWorkoutDuration || !selectedFrequency || !selectedGoal) && (
              <Card className="bg-ministry-gold-exact/20">
                <CardContent className="py-8 text-center">
                  <BookOpen className="w-12 h-12 mx-auto text-ministry-gold mb-4" />
                  <h3 className="text-lg font-semibold text-black mb-2">Complete Your Plan Preferences</h3>
                  <p className="text-black mb-4">
                    Fill out all the fields above to generate personalized workout plans tailored to your needs:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-black max-w-md mx-auto">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${selectedLevel ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                      <span>Fitness Level</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${selectedPlanEquipment ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                      <span>Available Equipment</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${selectedStartDay ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                      <span>Start Day</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${selectedWorkoutDuration ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                      <span>Workout Duration</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${selectedFrequency ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                      <span>Training Frequency</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${selectedGoal ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                      <span>Primary Goal</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* My Fitness Plans Tab */}
          <TabsContent value="my-plans" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">My Fitness Plans</h2>
              <Link href="/create-plan">
                <Button
                  className="bg-ministry-gold hover:bg-ministry-gold/90 text-black"
                  data-testid="button-create-plan"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Create Enhanced Plan
                </Button>
              </Link>
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
                            onClick={() => handleViewPlan(plan)}
                            className="border-ministry-steel text-white hover:bg-ministry-steel hover:text-white"
                            data-testid={`button-view-plan-${plan.id}`}
                          >
                            <BookOpen className="w-4 h-4 mr-1" />
                            View
                          </Button>
                          <Link href={`/edit-plan/${plan.id}`}>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-ministry-gold text-ministry-gold hover:bg-ministry-gold hover:text-black"
                              data-testid={`button-edit-plan-${plan.id}`}
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                          </Link>
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

      {/* Plan Exercises Modal */}
      <Dialog open={showPlanModal} onOpenChange={setShowPlanModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Dumbbell className="w-5 h-5" />
              Today's Workout
            </DialogTitle>
          </DialogHeader>
          
          {selectedPlanForView && (
            <div className="space-y-4">
              <div className="text-center p-4 bg-ministry-gold/20 rounded-lg">
                <h3 className="font-semibold text-lg">{selectedPlanForView.name}</h3>
                <p className="text-sm text-muted-foreground">
                  Week {getCurrentWeek(selectedPlanForView, selectedPlanForView.exercises || [])} • {getCurrentDayOfWeek().charAt(0).toUpperCase() + getCurrentDayOfWeek().slice(1)}
                </p>
              </div>

              {(() => {
                const todaysFilteredExercises = getTodaysExercises(selectedPlanForView);
                const allExercises = todaysFilteredExercises;
                
                // Remove duplicates based on exerciseId
                const seenExerciseIds = new Set<string>();
                const uniqueExercises = allExercises.filter(exercise => {
                  if (seenExerciseIds.has(exercise.exerciseId)) {
                    return false;
                  }
                  seenExerciseIds.add(exercise.exerciseId);
                  return true;
                });
                
                if (uniqueExercises.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">
                        Rest Day - No exercises scheduled for {getCurrentDayOfWeek().charAt(0).toUpperCase() + getCurrentDayOfWeek().slice(1)}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Enjoy your recovery day!
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {uniqueExercises.map((exercise, index) => (
                      <Card key={exercise.id} className="border border-border">
                        <CardContent className="p-4">
                          <div className="flex gap-4">
                            {/* Exercise Image */}
                            <div className="flex-shrink-0">
                              {(exercise.exerciseGifUrl || exercise.imageUrl) ? (
                                <img
                                  src={exercise.exerciseGifUrl || exercise.imageUrl}
                                  alt={exercise.exerciseName}
                                  className="w-20 h-20 rounded-lg object-cover"
                                  data-testid={`img-modal-exercise-${exercise.exerciseId}`}
                                />
                              ) : (
                                <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center">
                                  <Dumbbell className="w-8 h-8 text-muted-foreground" />
                                </div>
                              )}
                            </div>

                            {/* Exercise Details */}
                            <div className="flex-grow">
                              <h4 className="font-medium text-base mb-2" data-testid={`text-modal-exercise-name-${exercise.exerciseId}`}>
                                {index + 1}. {exercise.exerciseName}
                              </h4>
                              
                              {/* Sets, Reps, and Time */}
                              <div className="grid grid-cols-3 gap-3 text-sm mb-2">
                                <div className="flex items-center gap-1">
                                  <span className="font-medium">Sets:</span>
                                  <span className="text-ministry-gold" data-testid={`text-modal-sets-${exercise.exerciseId}`}>{exercise.sets}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="font-medium">Reps:</span>
                                  <span className="text-ministry-gold" data-testid={`text-modal-reps-${exercise.exerciseId}`}>{exercise.reps}</span>
                                </div>
                                {exercise.duration && (
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-4 h-4" />
                                    <span className="font-medium">Time:</span>
                                    <span className="text-ministry-gold" data-testid={`text-modal-minutes-${exercise.exerciseId}`}>{exercise.duration} min</span>
                                  </div>
                                )}
                              </div>

                              {/* Scheduled Days */}
                              {exercise.daysOfWeek && exercise.daysOfWeek.length > 0 && (
                                <div className="mb-2">
                                  <span className="text-sm font-medium">Scheduled: </span>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {exercise.daysOfWeek.map((day: string) => (
                                      <Badge key={day} variant="outline" className="text-xs capitalize">
                                        {day}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Notes */}
                              {exercise.notes && (
                                <div className="p-2 bg-ministry-gold/10 rounded text-sm">
                                  <span className="font-medium">Notes: </span>
                                  {exercise.notes}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Pre-built Plan Preview Modal */}
      <Dialog open={!!selectedPlanForPreview} onOpenChange={() => setSelectedPlanForPreview(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              {selectedPlanForPreview?.name || 'Plan Preview'}
            </DialogTitle>
          </DialogHeader>
          
          {selectedPlanForPreview && (
            <div className="space-y-4">
              {/* Plan Overview */}
              <div className="p-4 bg-ministry-gold/20 rounded-lg">
                <h3 className="font-semibold text-lg mb-2">{selectedPlanForPreview.name}</h3>
                <p className="text-sm text-muted-foreground mb-3">{selectedPlanForPreview.description}</p>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-ministry-gold">Level:</span>
                    <p className="capitalize">{selectedPlanForPreview.level}</p>
                  </div>
                  <div>
                    <span className="font-medium text-ministry-gold">Duration:</span>
                    <p>{selectedPlanForPreview.duration}</p>
                  </div>
                  <div>
                    <span className="font-medium text-ministry-gold">Equipment:</span>
                    <p className="capitalize">{selectedPlanForPreview.equipment}</p>
                  </div>
                  <div>
                    <span className="font-medium text-ministry-gold">Workouts/Week:</span>
                    <p>{selectedPlanForPreview.workoutsPerWeek}</p>
                  </div>
                </div>
              </div>

              {/* Exercises List */}
              <div>
                <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <Dumbbell className="w-5 h-5 text-ministry-gold" />
                  All Exercises ({selectedPlanForPreview.exercises?.length || 0})
                </h4>
                
                <div className="space-y-3">
                  {(selectedPlanForPreview.exercises || []).map((exercise, index) => (
                    <Card key={index} className="border border-border">
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          {/* Exercise GIF */}
                          {exercise.gifUrl && (
                            <div className="flex-shrink-0">
                              <img
                                src={exercise.gifUrl}
                                alt={`${exercise.name} demonstration`}
                                className="w-32 h-24 object-cover rounded-lg border border-ministry-gold/30"
                                loading="lazy"
                              />
                            </div>
                          )}
                          
                          {/* Exercise Details */}
                          <div className="flex-grow">
                            <h5 className="font-medium text-base mb-2">
                              {index + 1}. {exercise.name}
                            </h5>
                            
                            {/* Sets, Reps, Duration */}
                            <div className="grid grid-cols-3 gap-3 text-sm mb-2">
                              <div className="flex items-center gap-1">
                                <span className="font-medium">Sets:</span>
                                <span className="text-ministry-gold">{exercise.sets}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="font-medium">Reps:</span>
                                <span className="text-ministry-gold">{exercise.reps}</span>
                              </div>
                              {exercise.duration && (
                                <div className="flex items-center gap-1">
                                  <Clock className="w-4 h-4" />
                                  <span className="font-medium">Time:</span>
                                  <span className="text-ministry-gold">{exercise.duration}s</span>
                                </div>
                              )}
                            </div>

                            {/* Training Day */}
                            <div className="mb-2">
                              <span className="text-sm font-medium">Training Day: </span>
                              <Badge variant="outline" className="text-xs">
                                {exercise.day}
                              </Badge>
                            </div>

                            {/* Rest Period */}
                            <div className="mb-2">
                              <span className="text-sm font-medium">Rest: </span>
                              <span className="text-sm text-ministry-gold">{exercise.rest}</span>
                            </div>

                            {/* Body Part and Equipment */}
                            <div className="flex flex-wrap gap-2 mb-2">
                              <Badge variant="secondary" className="text-xs capitalize">
                                {exercise.bodyPart}
                              </Badge>
                              {(exercise.equipment || []).map((eq, eqIndex) => (
                                <Badge key={eqIndex} variant="outline" className="text-xs capitalize">
                                  {eq}
                                </Badge>
                              ))}
                            </div>

                            {/* Notes */}
                            {exercise.notes && (
                              <div className="p-2 bg-ministry-gold/10 rounded text-sm">
                                <span className="font-medium">Notes: </span>
                                {exercise.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  onClick={() => handleCreatePlanFromPrebuilt(selectedPlanForPreview)}
                  disabled={createPrebuiltPlanMutation.isPending}
                  className="bg-ministry-gold hover:bg-ministry-gold/90 text-black"
                >
                  {createPrebuiltPlanMutation.isPending ? "Creating..." : "Create This Plan"}
                </Button>
                <Button
                  onClick={() => setSelectedPlanForPreview(null)}
                  variant="outline"
                  className="border-ministry-gold text-ministry-gold hover:bg-ministry-gold/10"
                >
                  Close Preview
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}