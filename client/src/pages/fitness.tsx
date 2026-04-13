import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useTour } from "@/contexts/TourContext";
import { apiRequest } from "@/lib/queryClient";
import { BackButton } from "@/components/BackButton";
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
  Settings,
  X,
  Info,
  User,
  Lock,
  CreditCard,
  ShieldCheck,
  Download,
  ShoppingCart,
  Users,
  MessageSquare,
  Send,
  ImagePlus,
  Apple,
  ChevronRight,
  ArrowLeft,
  AlertCircle
} from "lucide-react";
import { format, isToday, isPast, isFuture } from "date-fns";
import { Link } from "wouter";
import seanMcManusPhoto from "@assets/531400631_10229732604879918_951068179454150284_n_1766855745199.jpeg";

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
  level?: string;
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

interface AdminFitnessPlan {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  duration: number;
  equipment: string;
  thumbnailUrl?: string;
  downloadUrl?: string;
  downloadFileName?: string;
  price?: number;
  isPurchasable: boolean;
  isPublished: boolean;
}

export default function Fitness() {
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterDifficulty, setFilterDifficulty] = useState<string>('all');
  
  // Exercise search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBodyPart, setSelectedBodyPart] = useState('all');
  const [selectedEquipment, setSelectedEquipment] = useState('all');
  const [selectedExerciseLevel, setSelectedExerciseLevel] = useState('all');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 25; // As per API docs
  const offset = (currentPage - 1) * limit;
  
  // Fitness plan state
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [addToPlanResetKey, setAddToPlanResetKey] = useState(0);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanDescription, setNewPlanDescription] = useState('');
  
  // Modal state for viewing today's exercises
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [selectedPlanForView, setSelectedPlanForView] = useState<FitnessPlan | null>(null);
  
  // Fitness Pillar dialog state
  const [showFitnessPillarDialog, setShowFitnessPillarDialog] = useState(false);
  
  // Fitness Coach dialog state
  const [showFitnessCoachDialog, setShowFitnessCoachDialog] = useState(false);
  
  // Exercise completion tracking
  const [completedExercises, setCompletedExercises] = useState<Set<string>>(new Set());
  
  // Pre-built Plans state
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [selectedPlanEquipment, setSelectedPlanEquipment] = useState<string[]>([]);
  const [selectedStartDay, setSelectedStartDay] = useState<string>('');
  const [selectedWorkoutDuration, setSelectedWorkoutDuration] = useState<string>('');
  const [selectedFrequency, setSelectedFrequency] = useState<string>('');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedPlanForPreview, setSelectedPlanForPreview] = useState<PreBuiltPlan | null>(null);
  const [generatedPlans, setGeneratedPlans] = useState<PreBuiltPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState<boolean>(false);
  const [planGenerationError, setPlanGenerationError] = useState<string>('');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [purchasingPlanId, setPurchasingPlanId] = useState<string | null>(null);
  const { user: authUser } = useAuth();
  const { isTourActive } = useTour();

  // Community tab state
  const [communityPostText, setCommunityPostText] = useState('');
  const [communityCategory, setCommunityCategory] = useState('encouragement');
  const [communityMedia, setCommunityMedia] = useState<{ url: string; type: string }[]>([]);
  const [communityUploading, setCommunityUploading] = useState(false);

  // Nutrition tab state
  const [nutritionInputQuery, setNutritionInputQuery] = useState('');
  const [nutritionSubmittedQuery, setNutritionSubmittedQuery] = useState('');
  const [selectedFdcId, setSelectedFdcId] = useState<number | null>(null);

  // Check fitness membership status
  const { data: membershipData, isLoading: membershipLoading } = useQuery<{ hasMembership: boolean; membership?: any }>({
    queryKey: ['/api/fitness/membership'],
    retry: false,
  });

  // User has access if they have an active Stripe membership OR admin-granted access
  const hasMembership = (membershipData?.hasMembership ?? false) || ((authUser as any)?.hasFitnessAccess === true);

  // Fetch admin-created fitness plans
  const { data: adminPlans = [] } = useQuery<AdminFitnessPlan[]>({
    queryKey: ['/api/pre-built-fitness-plans'],
    enabled: hasMembership,
  });

  // Fetch user's purchased plan IDs
  const { data: purchasedPlanIds = [] } = useQuery<string[]>({
    queryKey: ['/api/fitness/purchases'],
    enabled: hasMembership,
  });

  // Fitness Community queries
  const { data: communityPosts = [], refetch: refetchCommunityPosts } = useQuery<any[]>({
    queryKey: ['/api/fitness/community/posts'],
    enabled: hasMembership,
    refetchInterval: 15000,
  });

  const createPostMutation = useMutation({
    mutationFn: async (data: { content: string; category: string; mediaUrls?: string[]; mediaTypes?: string[] }) => {
      return await apiRequest('POST', '/api/fitness/community/posts', data);
    },
    onSuccess: () => {
      setCommunityPostText('');
      setCommunityCategory('encouragement');
      setCommunityMedia([]);
      queryClient.invalidateQueries({ queryKey: ['/api/fitness/community/posts'] });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message || 'Failed to post', variant: 'destructive' });
    },
  });

  const likePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      return await apiRequest('POST', `/api/fitness/community/posts/${postId}/like`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fitness/community/posts'] });
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      return await apiRequest('DELETE', `/api/fitness/community/posts/${postId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fitness/community/posts'] });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message || 'Failed to delete', variant: 'destructive' });
    },
  });

  const handleCommunityMediaUpload = async (files: FileList) => {
    setCommunityUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach(f => formData.append('media', f));
      const res = await fetch('/api/fitness/community/upload-media', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setCommunityMedia(prev => [...prev, ...data.files]);
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setCommunityUploading(false);
    }
  };

  const handleSubmitCommunityPost = () => {
    if (!communityPostText.trim()) return;
    createPostMutation.mutate({
      content: communityPostText,
      category: communityCategory,
      mediaUrls: communityMedia.map(m => m.url),
      mediaTypes: communityMedia.map(m => m.type),
    });
  };

  // Subscribe to fitness membership
  const subscribeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/fitness/membership/subscribe');
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to start checkout', variant: 'destructive' });
    },
  });

  // Cancel fitness membership
  const cancelMembershipMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/fitness/membership/cancel');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fitness/membership'] });
      toast({ title: 'Membership Cancelled', description: 'Your membership will remain active until the end of your billing period.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to cancel membership', variant: 'destructive' });
    },
  });

  // Handle Stripe redirect params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('membership') === 'success') {
      toast({ title: 'Welcome to the Fitness Community!', description: 'Your membership is now active. Enjoy full access to all fitness content.' });
      queryClient.invalidateQueries({ queryKey: ['/api/fitness/membership'] });
      window.history.replaceState({}, '', '/fitness');
    } else if (params.get('membership') === 'cancelled') {
      toast({ title: 'Checkout Cancelled', description: 'No charge was made.' });
      window.history.replaceState({}, '', '/fitness');
    }
    if (params.get('plan_purchase') === 'success') {
      toast({ title: 'Plan Purchased!', description: 'Your fitness plan is now available to download.' });
      queryClient.invalidateQueries({ queryKey: ['/api/fitness/purchases'] });
      window.history.replaceState({}, '', '/fitness');
    } else if (params.get('plan_purchase') === 'cancelled') {
      toast({ title: 'Purchase Cancelled', description: 'No charge was made.' });
      window.history.replaceState({}, '', '/fitness');
    }
  }, []);

  // Effect to generate plans when filters change
  useEffect(() => {
    if (selectedLevel && selectedPlanEquipment.length > 0 && selectedStartDay && selectedWorkoutDuration && selectedFrequency && selectedDays.length > 0) {
      // Validate that selected days match frequency
      const frequencyNum = parseInt(selectedFrequency);
      if (selectedDays.length !== frequencyNum) {
        setPlanGenerationError(`Please select exactly ${frequencyNum} workout days to match your training frequency.`);
        setGeneratedPlans([]);
        setPlansLoading(false);
        return;
      }

      setPlansLoading(true);
      setPlanGenerationError('');
      generatePreBuiltPlans(
        selectedLevel, 
        selectedPlanEquipment, 
        selectedStartDay, 
        selectedWorkoutDuration, 
        selectedFrequency,
        selectedDays
      )
        .then(plans => {
          if (plans.length === 0) {
            setPlanGenerationError(`Unable to generate plans for ${selectedPlanEquipment.join(', ')}. Try selecting different equipment types like "body weight" or "dumbbell".`);
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
  }, [selectedLevel, selectedPlanEquipment, selectedStartDay, selectedWorkoutDuration, selectedFrequency, selectedDays]);

  // Clear selected days when frequency changes
  useEffect(() => {
    setSelectedDays([]);
  }, [selectedFrequency]);

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
  if (selectedExerciseLevel !== 'all') filterParams.set('level', selectedExerciseLevel);
  filterParams.set('sortBy', 'name');
  filterParams.set('sortOrder', 'asc');

  // Fetch exercises from local database
  const { data: exerciseResponse, isLoading: isLoadingExercises } = useQuery({
    queryKey: ['api', 'exercises', currentPage, searchQuery, selectedBodyPart, selectedEquipment, selectedExerciseLevel],
    queryFn: async () => {
      console.log(`Fetching exercises page ${currentPage} from local database...`);
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (selectedBodyPart !== 'all') {
        params.set('bodyPart', selectedBodyPart);
      }
      if (selectedEquipment !== 'all') {
        params.set('equipment', selectedEquipment);
      }
      if (selectedExerciseLevel !== 'all') {
        params.set('level', selectedExerciseLevel);
      }
      params.set('offset', offset.toString());
      params.set('limit', limit.toString());
      
      const url = `/api/exercises${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch exercises');
      const exercises = await response.json();
      console.log('Exercise data received from local database:', exercises.length, 'exercises');
      return exercises;
    },
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Fetch body parts for filtering from local database
  const { data: allMuscles = [] } = useQuery({
    queryKey: ['api', 'exercises', 'body-parts'],
    queryFn: async () => {
      console.log('Fetching body parts from local database...');
      const response = await fetch('/api/exercises/body-parts');
      if (!response.ok) throw new Error('Failed to fetch body parts');
      const bodyParts = await response.json();
      console.log('Body parts data received from local database:', bodyParts.length, 'body parts');
      return bodyParts;
    },
    staleTime: 0,
    refetchOnMount: true,
  });
  
  // Use all body parts from database (no filtering needed)
  const usedMuscles = allMuscles;

  // Fetch equipment for filtering from local database
  const { data: equipments = [] } = useQuery({
    queryKey: ['api', 'exercises', 'equipment-types'],
    queryFn: async () => {
      console.log('Fetching equipment types from local database...');
      const response = await fetch('/api/exercises/equipment-types');
      if (!response.ok) throw new Error('Failed to fetch equipment types');
      const equipment = await response.json();
      console.log('Equipment types data received from local database:', equipment.length, 'types');
      return equipment;
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  // Fetch body parts for filtering from local database (duplicate removed, using allMuscles above)
  const bodyParts = allMuscles; // Use same body parts data

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

  // Nutrition: search results
  const { data: nutritionSearchData, isLoading: nutritionSearchLoading, error: nutritionSearchError } = useQuery<{
    correctedQuery: string;
    wasChanged: boolean;
    originalQuery: string;
    foods: Array<{
      fdcId: number;
      description: string;
      brandOwner: string | null;
      brandName: string | null;
      dataType: string;
      servingSize: number | null;
      servingSizeUnit: string | null;
      calories: number | null;
    }>;
    totalHits: number;
  }>({
    queryKey: ['/api/nutrition/search', nutritionSubmittedQuery],
    queryFn: async () => {
      const res = await fetch(`/api/nutrition/search?q=${encodeURIComponent(nutritionSubmittedQuery)}`, { credentials: 'include' });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || 'Search failed'); }
      return res.json();
    },
    enabled: !!nutritionSubmittedQuery,
    staleTime: 60000,
  });

  // Nutrition: food detail
  const { data: nutritionFoodDetail, isLoading: nutritionDetailLoading, error: nutritionDetailError } = useQuery<{
    fdcId: number;
    description: string;
    brandOwner: string | null;
    brandName: string | null;
    dataType: string;
    servingSize: number | null;
    servingSizeUnit: string | null;
    householdServingFullText: string | null;
    nutrients: Array<{ id: number; name: string; amount: number | null; unitName: string }>;
  }>({
    queryKey: ['/api/nutrition/food', selectedFdcId],
    queryFn: async () => {
      const res = await fetch(`/api/nutrition/food/${selectedFdcId}`, { credentials: 'include' });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || 'Failed to load details'); }
      return res.json();
    },
    enabled: !!selectedFdcId,
    staleTime: 300000,
  });

  // Extract data from local database response (returns array directly)
  const exercises = exerciseResponse || [];
  const totalCount = exercises.length;
  const totalPages = exerciseResponse?.metadata?.totalPages || Math.ceil(totalCount / limit);

  // Get filter options from API data - filter out null/undefined values
  const uniqueBodyParts = bodyParts.filter((bp: any) => bp).sort();
  const uniqueEquipment = equipments.filter((eq: any) => eq).sort();
  const uniqueTargets = (usedMuscles || allMuscles).filter((muscle: any) => muscle).sort();
  
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
    if (filterType === 'level') setSelectedExerciseLevel(value);
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
        exerciseId: String(exercise.exerciseId || (exercise as any).id || ''),
        exerciseName: exercise.name,
        imageUrl: exercise.gifUrl || (exercise as any).mediaFile || '',
        targetMuscle: exercise.targetMuscles?.[0] || exercise.target || '',
        bodyPart: exercise.bodyParts?.[0] || exercise.bodyPart || '',
        equipment: exercise.equipments?.[0] || exercise.equipment || '',
        orderIndex: 0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api', 'fitness-plans'] });
      setAddToPlanResetKey(k => k + 1);
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
    <div className={`${isToday ? 'bg-[#FCD000] text-black' : 'liquid-black'} rounded-sm border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all`}>
      <div className="p-6">
        <div className="flex items-start space-x-4 relative z-10">
          <div className="flex-shrink-0">
            <div className={`w-16 h-16 rounded-sm flex items-center justify-center border-2 border-black ${
              isToday ? 'liquid-black' : 'bg-[#FCD000] text-black'
            }`}>
              {isToday ? (
                <Star className="w-8 h-8 fill-current text-[#FCD000] relative z-10" />
              ) : (
                <Dumbbell className="w-8 h-8 text-black relative z-10" />
              )}
            </div>
          </div>

          <div className="flex-1">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className={`font-black text-lg mb-1 uppercase ${isToday ? 'text-black' : 'text-white'}`}>
                  {challenge.title}
                  {isToday && (
                    <Badge className="ml-2 bg-black text-[#FCD000] font-bold rounded-sm border-none">
                      Today's Challenge
                    </Badge>
                  )}
                </h3>
                <div className={`flex items-center flex-wrap gap-2 text-sm mb-2 ${isToday ? 'text-black' : 'text-white'}`}>
                  <Badge className="text-xs capitalize bg-black text-[#FCD000] border-none rounded-sm font-bold">
                    {challenge.category}
                  </Badge>
                  <Badge className="text-xs capitalize bg-[#FCD000] text-black border-none rounded-sm font-bold">
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

            <p className={`text-sm line-clamp-2 mb-3 ${isToday ? 'text-black' : 'text-white/90'}`}>
              {challenge.description}
            </p>

            {challenge.equipment && (
              <div className={`flex items-center text-sm mb-3 ${isToday ? 'text-black' : 'text-white'}`}>
                <Activity className="w-4 h-4 mr-1" />
                <span className="font-bold">Equipment: </span>
                <span className="ml-1">{challenge.equipment}</span>
              </div>
            )}

            {(challenge.videoId || challenge.videoUrl) && (
              <button 
                className="liquid-black px-4 py-2 rounded-sm border-2 border-black shadow-[3px_3px_0px_0px_rgba(252,208,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(252,208,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all text-white font-bold uppercase text-sm flex items-center"
                data-testid={`button-watch-video-${challenge.id}`}
              >
                <Play className="w-4 h-4 mr-2" />
                Watch Video
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const ExerciseCard = ({ exercise, showRemove = false }: { exercise: Exercise; showRemove?: boolean }) => (
    <div className="bg-[#FCD000] text-black rounded-sm border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all p-4">
      <div className="relative z-10">
        <div className="flex items-start">
          <div className="flex-1">
            <h3 className="font-black text-lg mb-2 text-black capitalize uppercase">
              {exercise.name.replace(/_/g, ' ')}
            </h3>
            
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge className="text-xs capitalize bg-black text-[#FCD000] border-none rounded-sm font-bold">
                {exercise.bodyPart}
              </Badge>
              <Badge className="text-xs capitalize bg-black/80 text-white border-none rounded-sm font-bold">
                {exercise.level || 'Beginner'}
              </Badge>
              <Badge className="text-xs capitalize bg-black/60 text-white border-none rounded-sm font-bold">
                {exercise.equipment}
              </Badge>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleToggleFavorite(exercise)}
                className={showRemove 
                  ? 'bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-sm border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold uppercase text-sm flex items-center' 
                  : `${isFavorite(exercise.exerciseId || exercise.id || '') 
                    ? 'liquid-black text-[#FCD000] px-3 py-1.5 rounded-sm border-2 border-black shadow-[2px_2px_0px_0px_rgba(252,208,0,1)] font-bold uppercase text-sm flex items-center' 
                    : 'bg-transparent text-black px-3 py-1.5 rounded-sm border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-black hover:text-[#FCD000] font-bold uppercase text-sm flex items-center transition-all'
                  }`}
                data-testid={`button-favorite-${exercise.exerciseId || exercise.id || ''}`}
              >
                {showRemove ? (
                  <>
                    <X className="w-4 h-4 mr-1" />
                    Remove
                  </>
                ) : (
                  <>
                    <Heart className={`w-4 h-4 mr-1 ${isFavorite(exercise.exerciseId || exercise.id || '') ? 'fill-current' : ''}`} />
                    {isFavorite(exercise.exerciseId || exercise.id || '') ? 'Favorited' : 'Favorite'}
                  </>
                )}
              </button>
              
              {fitnessPlans.length > 0 && (
                <Select key={`${(exercise as any).id || exercise.exerciseId}-${addToPlanResetKey}`} onValueChange={(planId) => addToPlanMutation.mutate({ planId, exercise })}>
                  <SelectTrigger className="w-32 rounded-sm border-2 border-black bg-white text-black font-bold">
                    <SelectValue placeholder="Add to Plan" />
                  </SelectTrigger>
                  <SelectContent className="rounded-sm border-2 border-black">
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
      </div>
    </div>
  );

  // Dynamic plan generation using local exercise database
  const generatePreBuiltPlans = async (
    level: string, 
    equipmentList: string[], 
    startDay: string, 
    duration: string, 
    frequency: string,
    workoutDays: string[]
  ): Promise<PreBuiltPlan[]> => {
    try {
      console.log('Generating plans with params:', { level, equipmentList, startDay, duration, frequency, workoutDays });
      
      const exercises = await getExercisesForEquipment(equipmentList, level);
      console.log(`Found ${exercises.length} exercises for equipment: ${equipmentList.join(', ')} at ${level} level`);
      
      if (exercises.length < 5) {
        console.warn(`Not enough exercises for equipment: ${equipmentList.join(', ')}. Found: ${exercises.length}`);
        // Fallback to bodyweight exercises if selected equipment has too few
        if (!equipmentList.includes('bodyweight')) {
          console.log('Attempting fallback to bodyweight exercises...');
          const bodyweightExercises = await getExercisesForEquipment(['bodyweight'], level);
          if (bodyweightExercises.length >= 5) {
            console.log('Falling back to bodyweight exercises');
            const weeklyPlan = generateDynamicPlan(bodyweightExercises, level as "Beginner"|"Intermediate"|"Advanced", 'bodyweight', workoutDays.length);
            const preBuiltPlan = convertWeeklyPlanToPreBuiltPlan(weeklyPlan, startDay, workoutDays);
            return [preBuiltPlan];
          }
        }
        return [];
      }

      // Format equipment names with proper capitalization and grammar
      const formatEquipmentName = (s: string) =>
        s.split(' ').map(w => w.toLowerCase() === 'ez' ? 'EZ' : w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      const formatEquipmentList = (items: string[]) => {
        const formatted = items.map(formatEquipmentName);
        if (formatted.length === 1) return formatted[0];
        if (formatted.length === 2) return `${formatted[0]} and ${formatted[1]}`;
        return `${formatted.slice(0, -1).join(', ')}, and ${formatted[formatted.length - 1]}`;
      };
      const equipmentLabel = equipmentList.length > 1 ? equipmentList.join(' + ') : equipmentList[0];
      const equipmentDisplay = formatEquipmentList(equipmentList);
      const levelDisplay = level.charAt(0).toUpperCase() + level.slice(1);

      const weeklyPlan = generateDynamicPlan(
        exercises, 
        level as "Beginner"|"Intermediate"|"Advanced", 
        equipmentLabel,
        workoutDays.length // Use actual number of workout days selected
      );
      const preBuiltPlan = convertWeeklyPlanToPreBuiltPlan(weeklyPlan, startDay, workoutDays);
      
      // Customize plan based on additional parameters
      preBuiltPlan.name = `${levelDisplay} ${equipmentDisplay} Program (${duration} min)`;
      preBuiltPlan.description = `${levelDisplay}-level program using ${equipmentDisplay}, ${frequency} days per week, ${duration} minutes per session.`;
      preBuiltPlan.workoutsPerWeek = parseInt(frequency);
      
      // Use the user's selected workout days for the schedule
      preBuiltPlan.schedule = workoutDays.map(day => day.toLowerCase());
      
      console.log('Successfully generated plan:', preBuiltPlan.name);
      console.log('Plan schedule updated to user-selected days:', workoutDays);
      return [preBuiltPlan];
    } catch (error) {
      console.error('Error generating dynamic plans:', error);
      return [];
    }
  };

  // Dynamic types and helper functions for local exercise database
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

  // Helper to fetch data from local exercise database
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
    const resp = await fetch('/api/exercises/equipment-types');
    if (!resp.ok) throw new Error('Failed to fetch equipment types');
    return await resp.json();
  }

  async function getExercisesForEquipment(equipmentList: string[], selectedLevel: string): Promise<APIExercise[]> {
    let allExercises: APIExercise[] = [];
    
    // Determine which levels to include based on selected level
    let levelsToInclude: string[];
    if (selectedLevel.toLowerCase() === 'beginner') {
      levelsToInclude = ['Beginner'];
    } else if (selectedLevel.toLowerCase() === 'intermediate') {
      levelsToInclude = ['Beginner', 'Intermediate'];
    } else { // Advanced
      levelsToInclude = ['Beginner', 'Intermediate', 'Advanced'];
    }
    
    const levelParam = levelsToInclude.join(',');
    
    try {
      // Fetch exercises for each selected equipment type from local database
      for (const equipment of equipmentList) {
        const url = `/api/exercises?equipment=${encodeURIComponent(equipment)}&level=${encodeURIComponent(levelParam)}`;
        
        try {
          const resp = await fetch(url);
          if (!resp.ok) throw new Error('Failed to fetch exercises');
          const exercises: any[] = await resp.json();
          
          const mapped: APIExercise[] = exercises.map((ex: any) => ({
            id: ex.id.toString(),
            name: ex.name,
            bodyPart: ex.bodyPart || 'unknown',
            equipment: ex.equipment || equipment,
            targetMuscles: ex.bodyPart ? [ex.bodyPart] : [],
            gifUrl: ex.mediaFile || ''
          }));
          
          allExercises = allExercises.concat(mapped);
          console.log(`Fetched ${mapped.length} exercises for ${equipment} at levels: ${levelsToInclude.join(', ')}`);
          
        } catch (equipmentError) {
          console.warn(`Failed to fetch exercises for ${equipment}:`, equipmentError);
          // Continue with other equipment types
        }
      }
      
      console.log(`Successfully fetched ${allExercises.length} total exercises from ${equipmentList.length} equipment type(s) at levels: ${levelsToInclude.join(', ')}`);
      return allExercises;
    } catch (error) {
      console.error(`Error fetching exercises:`, error);
      throw error;
    }
  }

  // Shuffle array helper
  function shuffleArray<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Pick random exercises by body part, avoiding duplicates
  function pickRandomByBodyPart(
    allExercises: APIExercise[], 
    bodyPart: string, 
    count: number, 
    usedIds: Set<string>,
    preferredEquipment?: string[]
  ): APIExercise[] {
    // Filter by body part and exclude already used exercises
    let filtered = allExercises.filter(
      e => e.bodyPart.toLowerCase() === bodyPart.toLowerCase() && !usedIds.has(e.id)
    );
    
    // If preferred equipment specified, prioritize those
    if (preferredEquipment && preferredEquipment.length > 0) {
      const withPreferredEquipment = filtered.filter(e => 
        preferredEquipment.includes(e.equipment.toLowerCase())
      );
      if (withPreferredEquipment.length >= count) {
        filtered = withPreferredEquipment;
      }
    }
    
    // Shuffle and pick
    const shuffled = shuffleArray(filtered);
    const picked = shuffled.slice(0, Math.min(count, shuffled.length));
    
    // Mark as used
    picked.forEach(ex => usedIds.add(ex.id));
    
    return picked;
  }

  function generateDynamicPlan(
    exercises: APIExercise[], 
    level: "Beginner"|"Intermediate"|"Advanced", 
    equipment: string,
    workoutDaysPerWeek: number = 3
  ): WeeklyPlan {
    const weeks: DayPlan[][] = [];
    
    // Get all unique equipment types from the exercises
    const availableEquipment = [...new Set(exercises.map(e => e.equipment.toLowerCase()))];
    
    let config;
    if (level === "Beginner") config = { sets: 3, restSec: 60, repRange: [10,12], exercisesPerDay: 4 };
    else if (level === "Intermediate") config = { sets: 4, restSec: 45, repRange: [10,15], exercisesPerDay: 5 };
    else config = { sets: 5, restSec: 30, repRange: [12,20], exercisesPerDay: 6 };
    
    // Define body part groups - each day focuses on 1-2 body parts
    const allBodyPartSchedules = [
      { name: 'Chest & Triceps', parts: ['chest', 'triceps'] },
      { name: 'Back & Biceps', parts: ['back', 'biceps'] },
      { name: 'Legs & Glutes', parts: ['legs', 'glutes', 'calves'] },
      { name: 'Shoulders & Core', parts: ['shoulders', 'core'] },
      { name: 'Full Body', parts: ['chest', 'back', 'legs', 'shoulders'] }
    ];
    
    // Use only the number of days selected by user
    const bodyPartSchedule = allBodyPartSchedules.slice(0, workoutDaysPerWeek);
    
    for (let w = 0; w < 4; w++) {
      const week: DayPlan[] = [];
      const usedExercisesThisWeek = new Set<string>();
      
      // Rotate equipment focus each week to ensure all equipment is used
      const equipmentRotation = availableEquipment[(w % availableEquipment.length)];
      
      for (let d = 0; d < bodyPartSchedule.length; d++) {
        const dayPlan = bodyPartSchedule[d];
        const dayExercises: PlanExercise[] = [];
        
        // Distribute exercises across the body parts for this day
        const exercisesPerBodyPart = Math.ceil(config.exercisesPerDay / dayPlan.parts.length);
        
        for (const bodyPart of dayPlan.parts) {
          const picked = pickRandomByBodyPart(
            exercises, 
            bodyPart, 
            exercisesPerBodyPart,
            usedExercisesThisWeek,
            [equipmentRotation] // Prefer current week's equipment
          );
          
          picked.forEach(ex => {
            dayExercises.push({
              exercise: ex,
              sets: config.sets,
              reps: config.repRange[0] + Math.floor(Math.random() * (config.repRange[1] - config.repRange[0]))
            });
          });
        }
        
        // Limit to configured exercises per day
        week.push({
          name: `${dayPlan.name} ‒ Week ${w+1}`,
          exercises: dayExercises.slice(0, config.exercisesPerDay)
        });
      }
      
      weeks.push(week);
    }
    
    return { level, equipment, weeks };
  }

  // Convert WeeklyPlan to PreBuiltPlan format for UI compatibility
  function convertWeeklyPlanToPreBuiltPlan(
    weeklyPlan: WeeklyPlan, 
    startDay: string, 
    workoutDays: string[]
  ): PreBuiltPlan {
    const allExercises: PreBuiltExercise[] = [];
    let exerciseIndex = 0;
    
    weeklyPlan.weeks.forEach((week, weekIndex) => {
      week.forEach((day, dayIndex) => {
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

    const workoutsPerWeek = workoutDays.length;

    return {
      name: `${weeklyPlan.level} ${weeklyPlan.equipment} Program`,
      description: `Dynamic ${weeklyPlan.level.toLowerCase()} program using ${weeklyPlan.equipment}. 4-week structured training plan.`,
      level: weeklyPlan.level.toLowerCase() as 'beginner' | 'intermediate' | 'advanced',
      equipment: weeklyPlan.equipment,
      duration: "4 weeks",
      workoutsPerWeek: workoutsPerWeek,
      startDay: startDay,
      schedule: workoutDays.map(d => d.toLowerCase()),
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

      // Add exercises to the plan directly using local database
      for (let i = 0; i < preBuiltPlan.exercises.length; i++) {
        const exercise = preBuiltPlan.exercises[i];
        
        // Get the training day for this exercise
        const trainingDay = getExerciseTrainingDay(i, preBuiltPlan.startDay, preBuiltPlan.schedule);
        
        // Create exercise entry directly with comprehensive data
        const exerciseData = {
          exerciseId: `prebuilt-${Date.now()}-${i}`,
          exerciseName: exercise.name,
          imageUrl: exercise.gifUrl || null, // Use actual GIF URL from local database
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

  // Helper function to get exercise GIF URLs from local database
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
      <div className="min-h-screen bg-black">
        <div className="px-4 pt-6">
          <div className="flex items-center justify-center py-20">
            <div className="bg-[#FCD000] text-black p-8 rounded-sm border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
              <div className="animate-spin rounded-sm h-12 w-12 border-4 border-black border-t-transparent relative z-10"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-20">
      {/* Header with liquid effect */}
      <div className="liquid-header px-4 pt-6 pb-6 border-b-4 border-[#FCD000]">
        <BackButton />
        <div className="text-center">
          <h1 className="text-3xl font-black text-white mb-2 uppercase tracking-wide relative z-10">
            Fitness Center
          </h1>
          <p className="text-white font-medium relative z-10 mb-4">
            Build physical strength to complement your spiritual growth
          </p>
          <div className="flex flex-wrap justify-center gap-3 relative z-10">
            <button
              onClick={() => setShowFitnessPillarDialog(true)}
              className="liquid-black px-6 py-3 rounded-sm border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all text-[#FCD000] font-black uppercase text-sm flex items-center"
              data-testid="button-fitness-pillar"
            >
              <Info className="w-5 h-5 mr-2" />
              Fitness Pillar
            </button>
            <button
              onClick={() => setShowFitnessCoachDialog(true)}
              className="liquid-black px-6 py-3 rounded-sm border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all text-[#FCD000] font-black uppercase text-sm flex items-center"
              data-testid="button-fitness-coach"
            >
              <User className="w-5 h-5 mr-2" />
              Fitness Coach
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 pt-6 space-y-6 pb-20">

      {/* Fitness Membership Paywall — hidden during the app tour so users can preview */}
      {!membershipLoading && !hasMembership && !isTourActive && (
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-full max-w-md">
            <div className="bg-[#FCD000] border-4 border-black rounded-sm shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6 text-center mb-4">
              <Lock className="w-12 h-12 mx-auto mb-4 text-black" />
              <h2 className="text-2xl font-black uppercase tracking-tight text-black mb-2">Fitness Community</h2>
              <p className="text-black font-semibold text-sm mb-1">This section is a paid add-on</p>
              <p className="text-black/70 text-xs mb-6">Not included in your main subscription</p>

              <div className="bg-black rounded-sm p-4 mb-6 text-left space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#FCD000] flex-shrink-0" />
                  <span className="text-white text-sm">Full exercise library (330+ exercises)</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#FCD000] flex-shrink-0" />
                  <span className="text-white text-sm">Custom workout plan builder</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#FCD000] flex-shrink-0" />
                  <span className="text-white text-sm">Progress tracking & completion</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#FCD000] flex-shrink-0" />
                  <span className="text-white text-sm">Pre-built plans by our fitness coach</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#FCD000] flex-shrink-0" />
                  <span className="text-white text-sm">Workout reminders & scheduling</span>
                </div>
              </div>

              <div className="mb-6">
                <span className="text-4xl font-black text-black">$4.99</span>
                <span className="text-black/70 font-medium">/month</span>
              </div>

              <Button
                onClick={() => subscribeMutation.mutate()}
                disabled={subscribeMutation.isPending}
                className="w-full h-14 bg-black text-[#FCD000] font-black text-lg uppercase tracking-wide border-2 border-black shadow-[3px_3px_0px_0px_rgba(252,208,0,0.6)] hover:bg-zinc-900 hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all"
              >
                <CreditCard className="w-5 h-5 mr-2" />
                {subscribeMutation.isPending ? 'Loading...' : 'Join Fitness Community'}
              </Button>
            </div>
            <p className="text-white/50 text-xs text-center">Cancel anytime. Billed monthly via Stripe.</p>
          </div>
        </div>
      )}

      {/* Membership loading state */}
      {membershipLoading && (
        <div className="flex items-center justify-center h-40">
          <Dumbbell className="w-8 h-8 text-[#FCD000] animate-pulse" />
        </div>
      )}

      {/* Fitness Pillar Dialog — available to all users */}
      <Dialog open={showFitnessPillarDialog} onOpenChange={setShowFitnessPillarDialog}>
        <DialogContent className="w-[95vw] max-w-2xl h-auto max-h-[85svh] flex flex-col p-0 rounded-sm border-2 border-black bg-black">
          <DialogHeader className="bg-[#FCD000] text-black px-6 py-4 border-b border-[#FCD000] flex-shrink-0">
            <DialogTitle className="text-xl font-black uppercase tracking-wide text-black relative z-10">
              Man Up God's Way Fitness Pillar
            </DialogTitle>
          </DialogHeader>
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 bg-black">
              <h2 className="text-2xl font-black text-[#FCD000] uppercase tracking-wide text-center">
                Strength for the Glory of God
              </h2>
              
              <p className="text-white leading-relaxed">
                At Man Up God's Way, we believe physical strength is not optional for a godly man. The body is not separate from faith. It is a stewardship entrusted by God and a tool He uses to form discipline, endurance, and leadership.
              </p>
              
              <p className="text-white leading-relaxed">
                Scripture is clear that the Christian life requires training, self-control, and perseverance. While godliness is of greatest value, Scripture also affirms the discipline of the body when it serves obedience and purpose.
              </p>
              
              <blockquote className="bg-[#FCD000] text-black p-4 rounded-sm border-l-4 border-black overflow-hidden">
                <p className="text-black font-medium italic relative z-10">
                  "For bodily training is only of little profit, but godliness is profitable for all things."
                </p>
                <cite className="text-black font-black text-sm relative z-10 mt-2 block">
                  — 1 Timothy 4:8 (LSB)
                </cite>
              </blockquote>
              
              <p className="text-white leading-relaxed">
                We do not train for vanity, comparison, or self-glory. We train to honor God, keep our word, and lead our families with strength, energy, and consistency.
              </p>
              
              <blockquote className="bg-[#FCD000] text-black p-4 rounded-sm border-l-4 border-black overflow-hidden">
                <p className="text-black font-medium italic relative z-10">
                  "Do you not know that your body is a temple of the Holy Spirit who is in you, whom you have from God, and that you are not your own?"
                </p>
                <cite className="text-black font-black text-sm relative z-10 mt-2 block">
                  — 1 Corinthians 6:19 (LSB)
                </cite>
              </blockquote>
              
              <p className="text-white leading-relaxed">
                Physical discipline reinforces spiritual discipline. A man who cannot govern his body will struggle to govern his habits, his home, and his calling. Strength training, proper nutrition, and daily movement are expressions of self-control, not obsession.
              </p>
              
              <blockquote className="bg-[#FCD000] text-black p-4 rounded-sm border-l-4 border-black overflow-hidden">
                <p className="text-black font-medium italic relative z-10">
                  "Everyone who competes in the games exercises self-control in all things."
                </p>
                <cite className="text-black font-black text-sm relative z-10 mt-2 block">
                  — 1 Corinthians 9:25 (LSB)
                </cite>
              </blockquote>
              
              <p className="text-white leading-relaxed">
                This pillar is about becoming dependable men. Men who show up. Men who endure. Men who are not ruled by comfort, excuses, or excess. Men who understand that faithfulness is proven in daily obedience.
              </p>
              
              <blockquote className="bg-[#FCD000] text-black p-4 rounded-sm border-l-4 border-black overflow-hidden">
                <p className="text-black font-medium italic relative z-10">
                  "But I discipline my body and make it my slave."
                </p>
                <cite className="text-black font-black text-sm relative z-10 mt-2 block">
                  — 1 Corinthians 9:27 (LSB)
                </cite>
              </blockquote>
              
              <p className="text-white leading-relaxed font-bold">
                Man Up God's Way calls men to train their bodies as servants of righteousness, not masters of desire, so that every area of life reflects strength under control.
              </p>
            </div>
          </DialogContent>
        </Dialog>

        {/* Fitness Coach Dialog */}
        <Dialog open={showFitnessCoachDialog} onOpenChange={setShowFitnessCoachDialog}>
          <DialogContent className="w-[95vw] max-w-2xl h-auto max-h-[85svh] flex flex-col p-0 rounded-sm border-2 border-black bg-black">
            <DialogHeader className="bg-[#FCD000] text-black px-6 py-4 border-b border-[#FCD000] flex-shrink-0">
              <DialogTitle className="text-xl font-black uppercase tracking-wide text-black relative z-10">
                Meet Your Fitness Coach
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 bg-black">
              {/* Coach Photo and Name */}
              <div className="text-center">
                <div className="w-40 h-40 mx-auto mb-4 rounded-sm border-4 border-[#FCD000] overflow-hidden shadow-[4px_4px_0px_0px_rgba(252,208,0,1)]">
                  <img 
                    src={seanMcManusPhoto} 
                    alt="Sean McManus" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <h2 className="text-2xl font-black text-[#FCD000] uppercase tracking-wide">
                  Sean McManus
                </h2>
                <p className="text-white font-medium mt-1">
                  Strength and Nutrition Coach for Christian Men
                </p>
              </div>
              
              <p className="text-white leading-relaxed">
                Sean McManus is part of the Man Up God's Way team and serves as the Lead Fitness Director for the Man Up God's Way app, helping men pursue physical strength as a vital part of biblical discipleship.
              </p>
              
              <p className="text-white leading-relaxed">
                He helps men lose fat, build strength, and reclaim confidence without extremes, gimmicks, or confusion. His coaching is built on proven fundamentals and steady accountability through strength training, protein-focused nutrition, and disciplined daily habits that actually fit real life.
              </p>
              
              <div className="bg-[#FCD000] text-black p-4 rounded-sm border-l-4 border-black overflow-hidden">
                <p className="text-black font-bold relative z-10">
                  Sean believes the body is not separate from faith. It is one of the primary tools God uses to shape discipline, consistency, and leadership in a man's life.
                </p>
              </div>
              
              <div className="space-y-2">
                <p className="text-[#FCD000] font-black uppercase">This is not about vanity.</p>
                <p className="text-white leading-relaxed">
                  It is about honoring God, keeping your word, and leading your family with strength, energy, and conviction.
                </p>
              </div>
              
              <div className="bg-[#FCD000] text-black p-4 rounded-sm border-l-4 border-black overflow-hidden">
                <p className="text-black font-bold relative z-10">
                  If you are done starting over and ready to become a man others can rely on, Sean would be honored to coach you.
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      {/* Fitness content — shown to members or during the app tour */}
      {(hasMembership || isTourActive) && (<>

        {/* Membership Status Banner */}
        {membershipData?.membership && (
          <div className="bg-zinc-900 border border-[#FCD000]/30 rounded-sm px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#FCD000]" />
              <span className="text-white text-sm font-bold">Fitness Community Member</span>
              {membershipData.membership.cancelAtPeriodEnd && (
                <Badge className="bg-red-900 text-red-200 text-xs">Cancels {membershipData.membership.currentPeriodEnd ? new Date(membershipData.membership.currentPeriodEnd).toLocaleDateString() : ''}</Badge>
              )}
            </div>
            {!membershipData.membership.cancelAtPeriodEnd && (
              <button
                onClick={() => { if (confirm('Cancel your fitness membership? You will keep access until the end of your billing period.')) cancelMembershipMutation.mutate(); }}
                className="text-white/40 hover:text-white/70 text-xs transition-colors"
                disabled={cancelMembershipMutation.isPending}
              >
                Cancel
              </button>
            )}
          </div>
        )}

        {/* Tab Navigation */}
        <Tabs defaultValue="workout" className="w-full">
          <TabsList className="grid grid-cols-3 w-full liquid-black rounded-sm border-2 border-black h-auto p-1 gap-1">
            <TabsTrigger value="workout" className="flex flex-col items-center gap-0.5 text-[10px] text-white data-[state=active]:bg-[#FCD000] data-[state=active]:text-black rounded-sm font-black uppercase py-2 px-1">
              <Dumbbell className="w-4 h-4" />
              Workout
            </TabsTrigger>
            <TabsTrigger value="community" className="flex flex-col items-center gap-0.5 text-[10px] text-white data-[state=active]:bg-[#FCD000] data-[state=active]:text-black rounded-sm font-black uppercase py-2 px-1">
              <Users className="w-4 h-4" />
              Community
            </TabsTrigger>
            <TabsTrigger value="exercises" className="flex flex-col items-center gap-0.5 text-[10px] text-white data-[state=active]:bg-[#FCD000] data-[state=active]:text-black rounded-sm font-black uppercase py-2 px-1">
              <Search className="w-4 h-4" />
              Exercises
            </TabsTrigger>
            <TabsTrigger value="favorites" className="flex flex-col items-center gap-0.5 text-[10px] text-white data-[state=active]:bg-[#FCD000] data-[state=active]:text-black rounded-sm font-black uppercase py-2 px-1">
              <Heart className="w-4 h-4" />
              Favorites
            </TabsTrigger>
            <TabsTrigger value="pre-built-plans" className="flex flex-col items-center gap-0.5 text-[10px] text-white data-[state=active]:bg-[#FCD000] data-[state=active]:text-black rounded-sm font-black uppercase py-2 px-1">
              <BookOpen className="w-4 h-4" />
              Plans
            </TabsTrigger>
            <TabsTrigger value="my-plans" className="flex flex-col items-center gap-0.5 text-[10px] text-white data-[state=active]:bg-[#FCD000] data-[state=active]:text-black rounded-sm font-black uppercase py-2 px-1">
              <List className="w-4 h-4" />
              My Plans
            </TabsTrigger>
            <TabsTrigger value="nutrition" className="flex flex-col items-center gap-0.5 text-[10px] text-white data-[state=active]:bg-[#FCD000] data-[state=active]:text-black rounded-sm font-black uppercase py-2 px-1">
              <Apple className="w-4 h-4" />
              Nutrition
            </TabsTrigger>
          </TabsList>

          {/* Daily Workout Tab */}
          <TabsContent value="workout" className="space-y-6">
            {/* Today's Workout Header */}
            <div className="flex items-center mb-6 liquid-black p-4 rounded-sm border-2 border-black overflow-hidden">
              <Dumbbell className="w-6 h-6 text-[#FCD000] mr-2 relative z-10" />
              <h2 className="text-xl font-black text-white uppercase tracking-wide relative z-10">Today's Workout</h2>
              <div className="ml-auto text-sm text-[#FCD000] font-bold relative z-10">
                {getCurrentDayOfWeek().charAt(0).toUpperCase() + getCurrentDayOfWeek().slice(1)}
              </div>
            </div>

            {(() => {
              const todaysExercises = getAllTodaysExercises();
              
              if (todaysExercises.length === 0) {
                return (
                  <div className="text-center py-12 bg-[#FCD000] text-black rounded-sm border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                    <Calendar className="w-12 h-12 mx-auto text-black mb-4 relative z-10" />
                    <h3 className="text-lg font-black text-black mb-2 uppercase relative z-10">No Workout Today</h3>
                    <p className="text-black relative z-10">
                      You have no exercises scheduled for today. Create a fitness plan to get started!
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  {todaysExercises.map((exercise, index) => (
                    <div key={`${exercise.planId}-${exercise.exerciseId}`} className="liquid-black rounded-sm border-2 border-black shadow-[3px_3px_0px_0px_rgba(252,208,0,0.5)] overflow-hidden p-4">
                      <div className="flex gap-6 relative z-10">
                        {/* Exercise Details */}
                        <div className="flex-grow">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1 mr-3">
                              <h4 className="font-black text-white uppercase tracking-tight text-base leading-tight mb-1" data-testid={`text-workout-exercise-name-${exercise.exerciseId}`}>
                                {exercise.exerciseName}
                              </h4>
                              <p className="text-xs text-[#FCD000] font-bold uppercase tracking-wider">
                                {exercise.planName}
                              </p>
                            </div>
                            
                            {/* Completion Checkbox */}
                            <div className="flex flex-col items-center gap-1">
                              <Checkbox
                                id={`exercise-${exercise.exerciseId}`}
                                checked={completedExercises.has(exercise.exerciseId)}
                                onCheckedChange={() => toggleExerciseCompletion(exercise.exerciseId)}
                                className="data-[state=checked]:bg-[#FCD000] data-[state=checked]:border-[#FCD000] border-[#FCD000] w-5 h-5"
                                data-testid={`checkbox-complete-${exercise.exerciseId}`}
                              />
                              <label 
                                htmlFor={`exercise-${exercise.exerciseId}`} 
                                className="text-xs text-[#FCD000] cursor-pointer font-black uppercase tracking-wide"
                              >
                                {completedExercises.has(exercise.exerciseId) ? 'Done' : 'Mark'}
                              </label>
                            </div>
                          </div>
                          
                          {/* Exercise Parameters */}
                          <div className="flex gap-4 text-sm">
                            <div className="flex flex-col items-center bg-black/40 rounded-sm px-3 py-2 border border-zinc-700">
                              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Sets</span>
                              <span className="font-black text-[#FCD000] text-lg leading-none" data-testid={`text-workout-sets-${exercise.exerciseId}`}>
                                {exercise.sets}
                              </span>
                            </div>
                            <div className="flex flex-col items-center bg-black/40 rounded-sm px-3 py-2 border border-zinc-700">
                              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Reps</span>
                              <span className="font-black text-[#FCD000] text-lg leading-none" data-testid={`text-workout-reps-${exercise.exerciseId}`}>
                                {exercise.reps}
                              </span>
                            </div>
                            {exercise.duration && (
                              <div className="flex flex-col items-center bg-black/40 rounded-sm px-3 py-2 border border-zinc-700">
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Time</span>
                                <span className="font-black text-[#FCD000] text-lg leading-none" data-testid={`text-workout-duration-${exercise.exerciseId}`}>
                                  {exercise.duration}<span className="text-xs">m</span>
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Notes */}
                          {exercise.notes && (
                            <div className="mt-3 p-2 bg-[#FCD000] rounded-sm border-2 border-black">
                              <p className="text-sm text-black">
                                <strong>Notes:</strong> {exercise.notes}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Workout Summary */}
                  <div className="bg-[#FCD000] text-black rounded-sm border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden p-4 mt-6">
                    <div className="flex items-center justify-between relative z-10">
                      <div>
                        <h4 className="font-black text-black uppercase">Today's Progress</h4>
                        <p className="text-sm text-black">
                          {completedExercises.size} of {todaysExercises.length} exercises completed
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-black text-black">
                          {todaysExercises.length > 0 ? Math.round((completedExercises.size / todaysExercises.length) * 100) : 0}%
                        </div>
                        <div className="text-xs font-bold text-black uppercase">Complete</div>
                      </div>
                    </div>
                  </div>
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
                    className="bg-ministry-gold-exact border-ministry-steel text-white placeholder:text-gray-400"
                    data-testid="input-exercise-search"
                  />
                </div>
                <Button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedBodyPart('all');
                    setSelectedEquipment('all');
                    setSelectedExerciseLevel('all');
                    setCurrentPage(1);
                  }}
                  variant="outline"
                  className="border-ministry-gold text-ministry-gold hover:bg-ministry-gold hover:text-black"
                  data-testid="button-clear-filters"
                >
                  Clear
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Select value={selectedBodyPart} onValueChange={(value) => handleFilterChange('bodyPart', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Body Part" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    <SelectItem value="all">All Body Parts</SelectItem>
                    {uniqueBodyParts.map((part: string) => (
                      <SelectItem key={part} value={part}>
                        {part ? part.charAt(0).toUpperCase() + part.slice(1) : part}
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

                <Select value={selectedExerciseLevel} onValueChange={(value) => handleFilterChange('level', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="Beginner">Beginner</SelectItem>
                    <SelectItem value="Intermediate">Intermediate</SelectItem>
                    <SelectItem value="Advanced">Advanced</SelectItem>
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
              <Card className="text-center py-12 bg-ministry-gold-exact">
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
                    {(searchQuery || selectedBodyPart !== 'all' || selectedEquipment !== 'all' || selectedExerciseLevel !== 'all') && (
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
              <Card className="text-center py-12 bg-ministry-gold-exact">
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
                  return <ExerciseCard key={favorite.id} exercise={exercise} showRemove={true} />;
                })}
              </div>
            )}
          </TabsContent>

          {/* Pre-built Plans Tab */}
          <TabsContent value="pre-built-plans" className="space-y-6">
            {/* Admin-created plans for purchase */}
            {adminPlans.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-black text-[#FCD000] uppercase tracking-wide border-b border-[#FCD000]/30 pb-2">
                  Fitness Plans by Coach
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {adminPlans.map((plan) => {
                    const alreadyPurchased = purchasedPlanIds.includes(plan.id);
                    const isFree = !plan.isPurchasable;
                    return (
                      <div key={plan.id} className="bg-zinc-900 border-2 border-[#FCD000]/30 rounded-sm overflow-hidden">
                        {plan.thumbnailUrl && (
                          <img src={plan.thumbnailUrl} alt={plan.title} className="w-full h-32 object-cover" />
                        )}
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h4 className="font-black text-white uppercase text-sm">{plan.title}</h4>
                            {isFree ? (
                              <Badge className="bg-green-600 text-white text-xs flex-shrink-0">Included</Badge>
                            ) : alreadyPurchased ? (
                              <Badge className="bg-[#FCD000] text-black text-xs flex-shrink-0">Purchased</Badge>
                            ) : (
                              <Badge className="bg-black border border-[#FCD000] text-[#FCD000] text-xs flex-shrink-0">
                                ${((plan.price || 0) / 100).toFixed(2)}
                              </Badge>
                            )}
                          </div>
                          {plan.description && (
                            <p className="text-white/60 text-xs mb-3 line-clamp-2">{plan.description}</p>
                          )}
                          <div className="flex flex-wrap gap-1 mb-3">
                            <Badge variant="outline" className="text-[#FCD000] border-[#FCD000]/40 text-xs capitalize">{plan.difficulty}</Badge>
                            <Badge variant="outline" className="text-white/50 border-white/20 text-xs capitalize">{plan.category}</Badge>
                            {plan.duration && <Badge variant="outline" className="text-white/50 border-white/20 text-xs">{plan.duration} min</Badge>}
                          </div>
                          {(isFree || alreadyPurchased) && plan.downloadUrl ? (
                            <a href={plan.downloadUrl} download={plan.downloadFileName || plan.title} target="_blank" rel="noreferrer">
                              <Button size="sm" className="w-full bg-[#FCD000] text-black font-black border-2 border-black">
                                <Download className="w-4 h-4 mr-2" />
                                Download Plan
                              </Button>
                            </a>
                          ) : !isFree && !alreadyPurchased ? (
                            <Button
                              size="sm"
                              className="w-full bg-[#FCD000] text-black font-black border-2 border-black"
                              disabled={purchasingPlanId === plan.id}
                              onClick={async () => {
                                setPurchasingPlanId(plan.id);
                                try {
                                  const res = await apiRequest('POST', `/api/fitness/plans/${plan.id}/purchase-intent`);
                                  const data = await res.json();
                                  if (data.url) window.location.href = data.url;
                                } catch (err: any) {
                                  toast({ title: 'Error', description: err.message || 'Failed to start purchase', variant: 'destructive' });
                                } finally {
                                  setPurchasingPlanId(null);
                                }
                              }}
                            >
                              <ShoppingCart className="w-4 h-4 mr-2" />
                              {purchasingPlanId === plan.id ? 'Loading...' : `Buy $${((plan.price || 0) / 100).toFixed(2)}`}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-[#FCD000]/30 pt-4">
                  <h3 className="text-lg font-black text-[#FCD000] uppercase tracking-wide pb-2">Build Your Own Plan</h3>
                </div>
              </div>
            )}
            {/* Plan Builder — all options in one box */}
            <div className="rounded-sm border-2 border-zinc-700 overflow-hidden">
              {/* Box header */}
              <div className="bg-[#FCD000] px-4 py-3 border-b-2 border-black">
                <div className="flex items-center gap-2">
                  <Dumbbell className="w-4 h-4 text-black" />
                  <h2 className="font-black text-black uppercase tracking-tight text-base">Build Your Workout Plan</h2>
                </div>
              </div>

              <div className="bg-zinc-900 divide-y divide-zinc-700">

                {/* 1. Fitness Level */}
                <div className="px-4 py-4">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Fitness Level</p>
                  <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                    <SelectTrigger className="w-full bg-black border-zinc-600 text-white" data-testid="select-fitness-level">
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 2. Available Equipment */}
                <div className="px-4 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Available Equipment</p>
                    {selectedPlanEquipment.length > 0 && (
                      <span className="text-[10px] font-black text-[#FCD000] uppercase">
                        {selectedPlanEquipment.length} selected
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {equipments.map((equipment: string) => {
                      const formatLabel = (eq: string) =>
                        eq.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                      const checked = selectedPlanEquipment.includes(equipment);
                      return (
                        <div key={equipment} className="flex items-center space-x-2">
                          <Checkbox
                            id={`equipment-${equipment}`}
                            checked={checked}
                            onCheckedChange={(c) => {
                              if (c) {
                                setSelectedPlanEquipment([...selectedPlanEquipment, equipment]);
                              } else {
                                setSelectedPlanEquipment(selectedPlanEquipment.filter(e => e !== equipment));
                              }
                            }}
                            className="border-zinc-500 data-[state=checked]:bg-[#FCD000] data-[state=checked]:border-[#FCD000]"
                            data-testid={`checkbox-equipment-${equipment}`}
                          />
                          <label
                            htmlFor={`equipment-${equipment}`}
                            className="text-sm font-medium text-white cursor-pointer leading-none"
                          >
                            {formatLabel(equipment)}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Start Day */}
                <div className="px-4 py-4">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Start Day</p>
                  <Select value={selectedStartDay} onValueChange={setSelectedStartDay}>
                    <SelectTrigger className="w-full bg-black border-zinc-600 text-white" data-testid="select-start-day">
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
                </div>

                {/* 4. Workout Duration */}
                <div className="px-4 py-4">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Workout Duration</p>
                  <Select value={selectedWorkoutDuration} onValueChange={setSelectedWorkoutDuration}>
                    <SelectTrigger className="w-full bg-black border-zinc-600 text-white" data-testid="select-workout-duration">
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="45">45 minutes</SelectItem>
                      <SelectItem value="60">60 minutes</SelectItem>
                      <SelectItem value="90">90 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 5. Training Frequency */}
                <div className="px-4 py-4">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Training Frequency</p>
                  <Select value={selectedFrequency} onValueChange={setSelectedFrequency}>
                    <SelectTrigger className="w-full bg-black border-zinc-600 text-white" data-testid="select-frequency">
                      <SelectValue placeholder="Workouts per week" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 days per week</SelectItem>
                      <SelectItem value="4">4 days per week</SelectItem>
                      <SelectItem value="5">5 days per week</SelectItem>
                      <SelectItem value="6">6 days per week</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 6. Workout Days (conditional) */}
                {selectedFrequency && (
                  <div className="px-4 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                        Workout Days
                      </p>
                      <span className="text-[10px] font-black text-[#FCD000] uppercase">
                        {selectedDays.length} / {selectedFrequency} selected
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'monday', label: 'Monday' },
                        { value: 'tuesday', label: 'Tuesday' },
                        { value: 'wednesday', label: 'Wednesday' },
                        { value: 'thursday', label: 'Thursday' },
                        { value: 'friday', label: 'Friday' },
                        { value: 'saturday', label: 'Saturday' },
                        { value: 'sunday', label: 'Sunday' }
                      ].map(day => (
                        <div key={day.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`day-${day.value}`}
                            checked={selectedDays.includes(day.value)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                const frequencyNum = parseInt(selectedFrequency);
                                if (selectedDays.length < frequencyNum) {
                                  setSelectedDays(prev => [...prev, day.value]);
                                } else {
                                  toast({
                                    title: "Maximum Days Reached",
                                    description: `You can only select ${frequencyNum} workout days.`,
                                    variant: "default"
                                  });
                                }
                              } else {
                                setSelectedDays(prev => prev.filter(d => d !== day.value));
                              }
                            }}
                            className="border-zinc-500 data-[state=checked]:bg-[#FCD000] data-[state=checked]:border-[#FCD000]"
                            data-testid={`checkbox-workout-day-${day.value}`}
                          />
                          <label htmlFor={`day-${day.value}`} className="text-sm text-white cursor-pointer">
                            {day.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Available Plans */}
            {selectedLevel && selectedPlanEquipment && selectedStartDay && selectedWorkoutDuration && selectedFrequency && selectedDays.length > 0 && (
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
                  <Card key={index} className="bg-ministry-gold-exact border border-ministry-gold/30">
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

            {(!selectedLevel || !selectedPlanEquipment || !selectedStartDay || !selectedWorkoutDuration || !selectedFrequency || selectedDays.length === 0) && (
              <Card className="bg-ministry-gold-exact">
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
                      <div className={`w-2 h-2 rounded-full ${selectedPlanEquipment.length > 0 ? 'bg-green-500' : 'bg-gray-400'}`}></div>
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
                      <div className={`w-2 h-2 rounded-full ${selectedFrequency && selectedDays.length === parseInt(selectedFrequency) ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                      <span>Workout Days ({selectedFrequency ? `${selectedDays.length}/${selectedFrequency}` : '0'})</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* My Fitness Plans Tab */}
          <TabsContent value="my-plans" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-white uppercase tracking-tight">My Fitness Plans</h2>
              <Link href="/create-plan">
                <Button
                  className="bg-[#FCD000] hover:bg-yellow-300 text-black font-black uppercase text-xs tracking-wide rounded-sm border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                  data-testid="button-create-plan"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Create Plan
                </Button>
              </Link>
            </div>

            {/* Create Plan Modal */}
            {showCreatePlan && (
              <div className="bg-[#FCD000] rounded-sm border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 space-y-3">
                <h3 className="font-black text-black uppercase tracking-tight">New Fitness Plan</h3>
                <div>
                  <label className="block text-xs font-black text-black uppercase tracking-wider mb-1">Plan Name</label>
                  <Input
                    value={newPlanName}
                    onChange={(e) => setNewPlanName(e.target.value)}
                    placeholder="Enter plan name..."
                    className="bg-white border-2 border-black text-black rounded-sm"
                    data-testid="input-plan-name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-black uppercase tracking-wider mb-1">Description (optional)</label>
                  <Input
                    value={newPlanDescription}
                    onChange={(e) => setNewPlanDescription(e.target.value)}
                    placeholder="Enter plan description..."
                    className="bg-white border-2 border-black text-black rounded-sm"
                    data-testid="input-plan-description"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleCreatePlan}
                    disabled={createPlanMutation.isPending}
                    className="bg-black text-[#FCD000] font-black uppercase text-xs tracking-wide rounded-sm border-2 border-black"
                    data-testid="button-save-plan"
                  >
                    {createPlanMutation.isPending ? 'Creating...' : 'Create Plan'}
                  </Button>
                  <Button
                    onClick={() => { setShowCreatePlan(false); setNewPlanName(''); setNewPlanDescription(''); }}
                    className="bg-white text-black font-black uppercase text-xs tracking-wide rounded-sm border-2 border-black"
                    data-testid="button-cancel-plan"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Plans List */}
            {fitnessPlans.length === 0 ? (
              <div className="text-center py-12 bg-[#FCD000] rounded-sm border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <BookOpen className="w-12 h-12 mx-auto text-black mb-4" />
                <h3 className="text-lg font-black text-black uppercase tracking-tight mb-1">No Plans Yet</h3>
                <p className="text-black/70 text-sm font-medium">Create your first fitness plan to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {fitnessPlans.map((plan: FitnessPlan) => (
                  <div key={plan.id} className="bg-[#FCD000] rounded-sm border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-black text-black text-base leading-tight flex-1 mr-2">{plan.name}</h3>
                        {plan.isPublic && (
                          <Badge className="text-xs bg-black text-[#FCD000] font-bold rounded-sm border-none flex-shrink-0">Public</Badge>
                        )}
                      </div>
                      {plan.description && (
                        <p className="text-black/70 text-sm mb-2 font-medium">{plan.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs font-bold text-black/60">
                        <span className="flex items-center gap-1">
                          <List className="w-3 h-3" />
                          {plan.exercises?.length || 0} exercises
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(plan.createdAt), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>
                    {/* Action buttons - full-width row at bottom */}
                    <div className="flex border-t-2 border-black">
                      <button
                        onClick={() => handleViewPlan(plan)}
                        className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-black uppercase tracking-wide text-black hover:bg-black hover:text-[#FCD000] transition-colors border-r-2 border-black"
                        data-testid={`button-view-plan-${plan.id}`}
                      >
                        <BookOpen className="w-3 h-3" /> View
                      </button>
                      <Link href={`/edit-plan/${plan.id}`} className="flex-1">
                        <button
                          className="w-full flex items-center justify-center gap-1 py-2 text-xs font-black uppercase tracking-wide text-black hover:bg-black hover:text-[#FCD000] transition-colors border-r-2 border-black"
                          data-testid={`button-edit-plan-${plan.id}`}
                        >
                          <Edit className="w-3 h-3" /> Edit
                        </button>
                      </Link>
                      <button
                        onClick={() => deletePlanMutation.mutate(plan.id)}
                        disabled={deletePlanMutation.isPending}
                        className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-black uppercase tracking-wide text-red-700 hover:bg-red-600 hover:text-white transition-colors"
                        data-testid={`button-delete-plan-${plan.id}`}
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Fitness Community Tab ─────────────────────────────────────── */}
          <TabsContent value="community" className="space-y-4">

            {/* Post Composer */}
            <div className="rounded-sm border-2 border-zinc-700 overflow-hidden">
              <div className="bg-[#FCD000] px-4 py-3 border-b-2 border-black">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-black" />
                  <h2 className="font-black text-black uppercase tracking-tight text-base">Post to the Community</h2>
                </div>
              </div>
              <div className="bg-zinc-900 p-4 space-y-3">
                {/* Category picker */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'encouragement', label: 'Encouragement' },
                    { key: 'help', label: 'Help / Questions' },
                    { key: 'plan-ideas', label: 'Plan Ideas' },
                    { key: 'nutrition', label: 'Nutrition' },
                  ].map(cat => (
                    <button
                      key={cat.key}
                      onClick={() => setCommunityCategory(cat.key)}
                      className={`text-xs font-black uppercase px-3 py-1 rounded-sm border-2 transition-colors ${
                        communityCategory === cat.key
                          ? 'bg-[#FCD000] border-[#FCD000] text-black'
                          : 'bg-transparent border-zinc-600 text-zinc-400 hover:border-zinc-400'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Text input */}
                <Textarea
                  placeholder="Share encouragement, ask for help, post a plan idea, or talk nutrition..."
                  value={communityPostText}
                  onChange={e => setCommunityPostText(e.target.value)}
                  className="bg-black border-zinc-600 text-white placeholder:text-zinc-500 min-h-[80px] resize-none"
                />

                {/* Media preview */}
                {communityMedia.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {communityMedia.map((m, i) => (
                      <div key={i} className="relative">
                        {m.type === 'video' ? (
                          <video src={m.url} className="w-20 h-20 object-cover rounded-sm border border-zinc-600" muted />
                        ) : (
                          <img src={m.url} alt="" className="w-20 h-20 object-cover rounded-sm border border-zinc-600" />
                        )}
                        <button
                          onClick={() => setCommunityMedia(prev => prev.filter((_, idx) => idx !== i))}
                          className="absolute -top-1 -right-1 bg-black border border-zinc-500 rounded-full w-5 h-5 flex items-center justify-center text-white hover:bg-red-900"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Action row */}
                <div className="flex items-center justify-between">
                  <label className="cursor-pointer flex items-center gap-2 text-zinc-400 hover:text-[#FCD000] transition-colors">
                    <ImagePlus className="w-5 h-5" />
                    <span className="text-xs font-black uppercase">
                      {communityUploading ? 'Uploading...' : 'Add Photo / Video'}
                    </span>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      className="hidden"
                      disabled={communityUploading}
                      onChange={e => e.target.files && handleCommunityMediaUpload(e.target.files)}
                    />
                  </label>
                  <Button
                    onClick={handleSubmitCommunityPost}
                    disabled={!communityPostText.trim() || createPostMutation.isPending}
                    className="bg-[#FCD000] text-black font-black border-2 border-black hover:bg-yellow-400 uppercase text-xs gap-1"
                    size="sm"
                  >
                    <Send className="w-3 h-3" />
                    {createPostMutation.isPending ? 'Posting...' : 'Post'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Feed */}
            {communityPosts.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 mx-auto text-zinc-600 mb-3" />
                <p className="text-white font-black uppercase tracking-tight">No posts yet</p>
                <p className="text-zinc-500 text-sm mt-1">Be the first to post something!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {communityPosts.map((post: any) => {
                  const categoryLabels: Record<string, string> = {
                    encouragement: 'Encouragement',
                    help: 'Help / Questions',
                    'plan-ideas': 'Plan Ideas',
                    nutrition: 'Nutrition',
                  };
                  const categoryColors: Record<string, string> = {
                    encouragement: 'bg-green-800 text-green-200',
                    help: 'bg-blue-800 text-blue-200',
                    'plan-ideas': 'bg-purple-800 text-purple-200',
                    nutrition: 'bg-orange-800 text-orange-200',
                  };
                  const isOwner = (authUser as any)?.id === post.userId || (authUser as any)?.claims?.sub === post.userId;
                  return (
                    <div key={post.id} className="bg-zinc-900 border-2 border-zinc-700 rounded-sm overflow-hidden">
                      {/* Post header */}
                      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
                        <div className="flex items-center gap-2">
                          {post.authorProfilePicture ? (
                            <img src={post.authorProfilePicture} alt="" className="w-8 h-8 rounded-full object-cover border border-zinc-600" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center">
                              <User className="w-4 h-4 text-zinc-400" />
                            </div>
                          )}
                          <div>
                            <p className="text-white font-black text-sm leading-none">{post.authorName}</p>
                            <p className="text-zinc-500 text-[10px]">{new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-sm ${categoryColors[post.category] || 'bg-zinc-700 text-zinc-300'}`}>
                            {categoryLabels[post.category] || post.category}
                          </span>
                          {isOwner && (
                            <button
                              onClick={() => deletePostMutation.mutate(post.id)}
                              className="text-zinc-600 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Post content */}
                      <div className="px-4 py-3">
                        <p className="text-white text-sm whitespace-pre-wrap">{post.content}</p>
                      </div>

                      {/* Media grid */}
                      {post.mediaUrls && post.mediaUrls.length > 0 && (
                        <div className={`grid gap-1 px-4 pb-3 ${post.mediaUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                          {post.mediaUrls.map((url: string, i: number) => (
                            post.mediaTypes?.[i] === 'video' ? (
                              <video
                                key={i}
                                src={url}
                                controls
                                className="w-full rounded-sm max-h-64 object-cover border border-zinc-700"
                              />
                            ) : (
                              <img
                                key={i}
                                src={url}
                                alt=""
                                className="w-full rounded-sm max-h-64 object-cover border border-zinc-700"
                              />
                            )
                          ))}
                        </div>
                      )}

                      {/* Like bar */}
                      <div className="px-4 py-2 border-t border-zinc-700 flex items-center gap-3">
                        <button
                          onClick={() => likePostMutation.mutate(post.id)}
                          className={`flex items-center gap-1 text-xs font-black uppercase transition-colors ${
                            post.likedByMe ? 'text-[#FCD000]' : 'text-zinc-500 hover:text-[#FCD000]'
                          }`}
                        >
                          <Heart className={`w-4 h-4 ${post.likedByMe ? 'fill-[#FCD000]' : ''}`} />
                          {post.likes > 0 && <span>{post.likes}</span>}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Nutrition Tab */}
          <TabsContent value="nutrition" className="space-y-4">
            {/* Header */}
            <div className="flex items-center mb-4 liquid-black p-4 rounded-sm border-2 border-black overflow-hidden">
              <Apple className="w-6 h-6 text-[#FCD000] mr-2 relative z-10" />
              <h2 className="text-xl font-black text-white uppercase tracking-wide relative z-10">Nutrition Lookup</h2>
              <span className="ml-auto text-xs text-[#FCD000]/70 relative z-10">Powered by USDA FDC</span>
            </div>

            {/* Search form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const q = nutritionInputQuery.trim();
                if (!q) return;
                setSelectedFdcId(null);
                setNutritionSubmittedQuery(q);
              }}
              className="flex gap-2"
            >
              <Input
                value={nutritionInputQuery}
                onChange={(e) => setNutritionInputQuery(e.target.value)}
                placeholder="Search for a food (e.g. chicken breast, oats…)"
                className="flex-1 bg-zinc-900 border-2 border-white/20 text-white placeholder:text-white/40 focus:border-[#FCD000] rounded-sm"
              />
              <Button
                type="submit"
                disabled={nutritionSearchLoading}
                className="bg-[#FCD000] text-black font-black uppercase hover:bg-[#FCD000]/90 rounded-sm border-2 border-black shrink-0"
              >
                {nutritionSearchLoading ? (
                  <span className="flex items-center gap-1"><span className="animate-spin">⏳</span>Searching…</span>
                ) : (
                  <span className="flex items-center gap-1"><Search className="w-4 h-4" />Search</span>
                )}
              </Button>
            </form>

            {/* Spell-correction notice */}
            {nutritionSearchData?.wasChanged && !selectedFdcId && (
              <div className="flex items-center gap-2 bg-[#FCD000]/10 border border-[#FCD000]/40 rounded-sm px-3 py-2 text-sm text-[#FCD000]">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Showing results for <strong>"{nutritionSearchData.correctedQuery}"</strong> (corrected from "{nutritionSearchData.originalQuery}")</span>
              </div>
            )}

            {/* Error state */}
            {(nutritionSearchError || nutritionDetailError) && !nutritionSearchLoading && !nutritionDetailLoading && (
              <div className="flex items-center gap-2 bg-red-900/30 border border-red-500/40 rounded-sm px-3 py-2 text-sm text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{(nutritionSearchError as Error)?.message || (nutritionDetailError as Error)?.message || 'Something went wrong. Please try again.'}</span>
              </div>
            )}

            {/* Food detail panel */}
            {selectedFdcId && (
              <div className="space-y-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFdcId(null)}
                  className="text-[#FCD000] hover:text-[#FCD000]/80 hover:bg-white/10 flex items-center gap-1 px-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to results
                </Button>

                {nutritionDetailLoading && (
                  <div className="space-y-3">
                    {[1,2,3,4,5,6,7,8].map(i => (
                      <div key={i} className="h-8 bg-zinc-800 rounded-sm animate-pulse" />
                    ))}
                  </div>
                )}

                {nutritionFoodDetail && !nutritionDetailLoading && (
                  <div className="bg-zinc-900 border-2 border-white/10 rounded-sm overflow-hidden">
                    {/* Food header */}
                    <div className="bg-[#FCD000] px-4 py-3 border-b-2 border-black">
                      <h3 className="font-black text-black uppercase text-sm leading-tight">
                        {nutritionFoodDetail.description}
                      </h3>
                      {(nutritionFoodDetail.brandOwner || nutritionFoodDetail.brandName) && (
                        <p className="text-black/70 text-xs mt-0.5">
                          {nutritionFoodDetail.brandName || nutritionFoodDetail.brandOwner}
                        </p>
                      )}
                      {(nutritionFoodDetail.householdServingFullText || nutritionFoodDetail.servingSize) && (
                        <p className="text-black/60 text-xs mt-0.5">
                          Serving: {nutritionFoodDetail.householdServingFullText ||
                            `${nutritionFoodDetail.servingSize}${nutritionFoodDetail.servingSizeUnit || ''}`}
                        </p>
                      )}
                    </div>

                    {/* Nutrition Facts table */}
                    <div className="px-4 py-3">
                      <p className="text-xs font-black text-white uppercase tracking-widest mb-2 border-b border-white/20 pb-1">
                        Nutrition Facts
                      </p>
                      {nutritionFoodDetail.nutrients.length === 0 ? (
                        <p className="text-sm text-white/50 py-2">No nutritional data available for this item.</p>
                      ) : (
                        <table className="w-full text-sm">
                          <tbody>
                            {nutritionFoodDetail.nutrients.map((n, i) => {
                              const isBold = [1008, 1004, 1005, 1003].includes(n.id);
                              const isIndented = [1258, 1257, 1079, 2000].includes(n.id);
                              return (
                                <tr
                                  key={n.id}
                                  className={`border-b border-white/10 ${i % 2 === 0 ? 'bg-white/5' : ''}`}
                                >
                                  <td className={`py-1.5 text-white/80 ${isIndented ? 'pl-5' : ''} ${isBold ? 'font-bold text-white' : ''}`}>
                                    {n.name}
                                  </td>
                                  <td className={`py-1.5 text-right tabular-nums ${isBold ? 'font-bold text-[#FCD000]' : 'text-white/70'}`}>
                                    {n.amount !== null ? `${Math.round(n.amount * 10) / 10} ${n.unitName}` : '—'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>

                    {/* Data type badge */}
                    <div className="px-4 pb-3">
                      <Badge variant="outline" className="text-[10px] text-white/40 border-white/20">
                        {nutritionFoodDetail.dataType}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Search results list */}
            {!selectedFdcId && nutritionSubmittedQuery && (
              <div className="space-y-2">
                {nutritionSearchLoading && (
                  <div className="space-y-2">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className="h-16 bg-zinc-800 rounded-sm animate-pulse" />
                    ))}
                  </div>
                )}

                {!nutritionSearchLoading && nutritionSearchData && nutritionSearchData.foods.length === 0 && (
                  <div className="text-center py-10 text-white/50">
                    <Apple className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="font-medium">No foods found for "{nutritionSearchData.correctedQuery}"</p>
                    <p className="text-xs mt-1">Try a different search term</p>
                  </div>
                )}

                {!nutritionSearchLoading && nutritionSearchData && nutritionSearchData.foods.length > 0 && (
                  <>
                    <p className="text-xs text-white/40">
                      {nutritionSearchData.totalHits.toLocaleString()} results — showing top {nutritionSearchData.foods.length}
                    </p>
                    {nutritionSearchData.foods.map((food) => (
                      <button
                        key={food.fdcId}
                        onClick={() => setSelectedFdcId(food.fdcId)}
                        className="w-full text-left flex items-center gap-3 bg-zinc-900 border border-white/10 rounded-sm px-3 py-3 hover:border-[#FCD000]/50 hover:bg-zinc-800 transition-colors"
                      >
                        <div className="w-9 h-9 bg-[#FCD000] rounded-sm flex items-center justify-center shrink-0">
                          <Apple className="w-5 h-5 text-black" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-semibold leading-snug truncate">
                            {food.description}
                          </p>
                          {(food.brandOwner || food.brandName) && (
                            <p className="text-white/50 text-xs truncate">
                              {food.brandName || food.brandOwner}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className="text-[10px] text-white/40 border-white/20 py-0">
                              {food.dataType}
                            </Badge>
                            {food.calories !== null && (
                              <span className="text-[10px] text-[#FCD000]/80 font-bold">
                                {Math.round(food.calories)} kcal
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-white/30 shrink-0" />
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* Empty / initial state */}
            {!nutritionSubmittedQuery && (
              <div className="text-center py-16 text-white/40">
                <Apple className="w-14 h-14 mx-auto mb-3 opacity-20" />
                <p className="font-black uppercase tracking-wide">Search for any food</p>
                <p className="text-xs mt-1 text-white/30">Powered by the USDA FoodData Central database</p>
              </div>
            )}
          </TabsContent>

        </Tabs>
      </>)}
      </div>

      {/* Plan Exercises Modal */}
      <Dialog open={showPlanModal} onOpenChange={setShowPlanModal}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[85svh] flex flex-col p-0 rounded-sm border-2 border-black bg-black">
          {/* Header */}
          <div className="bg-[#FCD000] px-5 py-4 border-b-2 border-black flex-shrink-0">
            <div className="flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-black" />
              <h2 className="font-black text-black uppercase tracking-tight text-lg">Plan Exercises</h2>
            </div>
            {selectedPlanForView && (
              <p className="text-black/70 text-sm font-bold mt-0.5">{selectedPlanForView.name}</p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
          {selectedPlanForView && (() => {
            const allExercises = selectedPlanForView.exercises || [];
            const seenExerciseIds = new Set<string>();
            const uniqueExercises = allExercises.filter(exercise => {
              if (seenExerciseIds.has(exercise.exerciseId)) return false;
              seenExerciseIds.add(exercise.exerciseId);
              return true;
            });

            if (uniqueExercises.length === 0) {
              return (
                <div className="text-center py-12">
                  <Dumbbell className="w-12 h-12 mx-auto text-zinc-600 mb-3" />
                  <p className="text-white font-black uppercase tracking-tight">No exercises yet</p>
                  <p className="text-zinc-500 text-sm mt-1">Edit the plan to add exercises</p>
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {uniqueExercises.map((exercise, index) => (
                  <div key={exercise.id} className="liquid-black rounded-sm border-2 border-zinc-700 overflow-hidden">
                    {/* Exercise name bar */}
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-700">
                      <span className="text-[10px] font-black text-zinc-500 w-5 text-center">{index + 1}</span>
                      <h4 className="font-black text-white uppercase tracking-tight text-sm leading-tight flex-1" data-testid={`text-modal-exercise-name-${exercise.exerciseId}`}>
                        {exercise.exerciseName}
                      </h4>
                    </div>

                    <div className="px-3 py-3 space-y-3">
                      {/* Stat boxes */}
                      <div className="flex gap-2">
                        <div className="flex flex-col items-center bg-black/60 rounded-sm px-3 py-2 border border-zinc-700 flex-1">
                          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Sets</span>
                          <span className="font-black text-[#FCD000] text-xl leading-none" data-testid={`text-modal-sets-${exercise.exerciseId}`}>{exercise.sets}</span>
                        </div>
                        <div className="flex flex-col items-center bg-black/60 rounded-sm px-3 py-2 border border-zinc-700 flex-1">
                          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Reps</span>
                          <span className="font-black text-[#FCD000] text-xl leading-none" data-testid={`text-modal-reps-${exercise.exerciseId}`}>{exercise.reps}</span>
                        </div>
                        {exercise.duration && (
                          <div className="flex flex-col items-center bg-black/60 rounded-sm px-3 py-2 border border-zinc-700 flex-1">
                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Time</span>
                            <span className="font-black text-[#FCD000] text-xl leading-none" data-testid={`text-modal-minutes-${exercise.exerciseId}`}>{exercise.duration}<span className="text-xs">m</span></span>
                          </div>
                        )}
                      </div>

                      {/* Scheduled Days */}
                      {exercise.daysOfWeek && exercise.daysOfWeek.length > 0 && (
                        <div>
                          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Scheduled Days</p>
                          <div className="flex flex-wrap gap-1">
                            {exercise.daysOfWeek.map((day: string) => (
                              <span key={day} className="text-[10px] font-black uppercase bg-zinc-800 text-[#FCD000] border border-zinc-600 px-2 py-0.5 rounded-sm capitalize">
                                {day}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Notes */}
                      {exercise.notes && (
                        <div className="p-2 bg-[#FCD000] rounded-sm border-2 border-black text-sm text-black">
                          <strong>Notes:</strong> {exercise.notes}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
          </div>
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
                    <Card key={index} className="border border-ministry-charcoal">
                      <CardContent className="p-4">
                        <div className="flex gap-4">
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
                              <div className="mt-2 p-2 bg-[#FCD000] rounded-sm border-2 border-black text-sm text-black">
                                <strong>Notes:</strong> {exercise.notes}
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