import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Dumbbell, 
  Search, 
  Heart, 
  Plus, 
  ArrowLeft,
  X,
  Clock,
  Target,
  CheckSquare,
  Calendar,
  Bell,
  Timer
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useLocation, Link } from "wouter";

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
  createdAt: string;
}

interface SelectedExercise {
  exercise: Exercise;
  sets?: number;
  reps?: string;
  minutes?: number;
  daysOfWeek: string[];
  notes?: string;
}

interface PlanReminder {
  dayOfWeek: string;
  time: string;
}

const daysOfWeek = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" }
];

export default function EditPlan() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get plan ID from URL
  const [location] = useLocation();
  const planId = location.split('/')[2]; // /edit-plan/{planId}

  // Plan details
  const [planName, setPlanName] = useState('');
  const [planDescription, setPlanDescription] = useState('');
  const [planCategory, setPlanCategory] = useState('general');
  const [planDifficulty, setPlanDifficulty] = useState('beginner');

  // Exercise search and filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBodyPart, setSelectedBodyPart] = useState('all');
  const [selectedEquipment, setSelectedEquipment] = useState('all');
  const [selectedTarget, setSelectedTarget] = useState('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 25;
  const offset = (currentPage - 1) * limit;

  // Selected exercises for the plan
  const [selectedExercises, setSelectedExercises] = useState<SelectedExercise[]>([]);
  
  // Reminders
  const [reminders, setReminders] = useState<PlanReminder[]>([]);

  // Helper function to determine exercise week based on order (distribute evenly across 4 weeks)
  const getExerciseWeek = (exercises: SelectedExercise[], exerciseIndex: number): number => {
    const totalExercises = exercises.length;
    const exercisesPerWeek = Math.ceil(totalExercises / 4);
    return Math.min(4, Math.floor(exerciseIndex / exercisesPerWeek) + 1);
  };

  // Helper function to determine current week based on plan start date and completion
  const getCurrentWeek = (exercises: SelectedExercise[]): number => {
    if (!exercises || exercises.length === 0) return 1;
    
    // For editing, we'll start with Week 1 and let users see the distribution
    // In a real app, this would consider completion status and time progression
    return 1; // Always show Week 1 when editing for simplicity
  };

  // Exercise configuration modal
  const [showExerciseConfig, setShowExerciseConfig] = useState(false);
  const [currentExercise, setCurrentExercise] = useState<Exercise | null>(null);
  const [tempSets, setTempSets] = useState(3);
  const [tempReps, setTempReps] = useState('10');
  const [tempMinutes, setTempMinutes] = useState<number | undefined>();
  const [tempDaysOfWeek, setTempDaysOfWeek] = useState<string[]>([]);
  const [tempNotes, setTempNotes] = useState('');

  // Fetch existing plan data
  const { data: existingPlan, isLoading: planLoading } = useQuery({
    queryKey: ['api', 'fitness-plans', planId],
    queryFn: async () => {
      const response = await fetch(`/api/fitness-plans/${planId}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch plan');
      return response.json();
    },
    enabled: !!planId,
  });

  // Load existing plan data into state
  useEffect(() => {
    if (existingPlan) {
      setPlanName(existingPlan.name || '');
      setPlanDescription(existingPlan.description || '');
      setPlanCategory(existingPlan.category || 'general');
      setPlanDifficulty(existingPlan.difficulty || 'beginner');
      
      // Convert exercises to SelectedExercise format
      if (existingPlan.exercises) {
        const convertedExercises = existingPlan.exercises.map((ex: any) => ({
          exercise: {
            exerciseId: ex.exerciseId,
            name: ex.exerciseName,
            gifUrl: ex.imageUrl || ex.exerciseGifUrl || '',
            targetMuscles: [ex.targetMuscle || ex.exerciseTarget || ''],
            bodyParts: [ex.bodyPart || ex.exerciseBodyPart || ''],
            equipments: [ex.equipment || ex.exerciseEquipment || ''],
            secondaryMuscles: [],
            instructions: [],
            target: ex.targetMuscle || ex.exerciseTarget,
            bodyPart: ex.bodyPart || ex.exerciseBodyPart,
            equipment: ex.equipment || ex.exerciseEquipment
          },
          sets: ex.sets || 3,
          reps: ex.reps || '10',
          minutes: ex.minutes,
          daysOfWeek: ex.daysOfWeek || [],
          notes: ex.notes || ''
        }));
        setSelectedExercises(convertedExercises);
      }
    }
  }, [existingPlan]);

  // Fetch favorite exercises
  const { data: favoriteExercises = [] } = useQuery({
    queryKey: ['api', 'favorite-exercises'],
    queryFn: async () => {
      const response = await fetch('/api/favorite-exercises', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch favorite exercises');
      return response.json();
    },
  });

  // Fetch body parts for filtering
  const { data: bodyParts = [] } = useQuery({
    queryKey: ['bodyparts'],
    queryFn: async () => {
      const response = await fetch('https://www.exercisedb.dev/api/v1/bodyparts');
      if (!response.ok) throw new Error('Failed to fetch body parts');
      const data = await response.json();
      return data.data || [];
    },
    staleTime: 300000,
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
      const url = `https://www.exercisedb.dev/api/v1/exercises/filter?${filterParams.toString()}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch exercises');
      const data = await response.json();
      return data;
    },
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Fetch equipment for filtering
  const { data: equipments = [] } = useQuery({
    queryKey: ['equipments'],
    queryFn: async () => {
      const response = await fetch('https://www.exercisedb.dev/api/v1/equipments');
      if (!response.ok) throw new Error('Failed to fetch equipments');
      const data = await response.json();
      return data.data || [];
    },
    staleTime: 300000,
  });

  // Fetch muscles for filtering
  const { data: allMuscles = [] } = useQuery({
    queryKey: ['muscles'],
    queryFn: async () => {
      const response = await fetch('https://www.exercisedb.dev/api/v1/muscles');
      if (!response.ok) throw new Error('Failed to fetch muscles');
      const data = await response.json();
      return data.data || [];
    },
    staleTime: 300000,
  });

  // Update plan mutation
  const updatePlanMutation = useMutation({
    mutationFn: async () => {
      // Update the plan details
      const planData = {
        name: planName,
        description: planDescription,
        category: planCategory,
        difficulty: planDifficulty
      };

      await apiRequest('PUT', `/api/fitness-plans/${planId}`, planData);
      
      // Remove all existing exercises
      if (existingPlan?.exercises) {
        for (const exercise of existingPlan.exercises) {
          await apiRequest('DELETE', `/api/fitness-plans/${planId}/exercises/${exercise.id}`);
        }
      }
      
      // Add updated exercises to the plan
      for (let i = 0; i < selectedExercises.length; i++) {
        const selectedExercise = selectedExercises[i];
        const exerciseData: any = {
          exerciseId: selectedExercise.exercise.exerciseId,
          exerciseName: selectedExercise.exercise.name,
          bodyPart: selectedExercise.exercise.bodyParts?.[0] || '',
          targetMuscle: selectedExercise.exercise.targetMuscles?.[0] || '',
          equipment: selectedExercise.exercise.equipments?.[0] || '',
          imageUrl: selectedExercise.exercise.gifUrl,
          sets: selectedExercise.sets || 3,
          reps: selectedExercise.reps || '10',
          daysOfWeek: selectedExercise.daysOfWeek,
          notes: selectedExercise.notes || '',
          orderIndex: i
        };

        // Only include minutes if it's a valid number
        if (selectedExercise.minutes && typeof selectedExercise.minutes === 'number' && selectedExercise.minutes > 0) {
          exerciseData.minutes = selectedExercise.minutes;
        }

        await apiRequest('POST', `/api/fitness-plans/${planId}/exercises`, exerciseData);
      }

      return { id: planId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api', 'fitness-plans'] });
      queryClient.invalidateQueries({ queryKey: ['api', 'fitness-plans', planId] });
      toast({ title: "Fitness plan updated successfully!" });
      setLocation('/fitness');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update plan",
        variant: "destructive"
      });
    },
  });

  // Handle adding exercise to plan
  const handleAddExercise = (exercise: Exercise) => {
    setCurrentExercise(exercise);
    setTempSets(3);
    setTempReps('10');
    setTempMinutes(undefined);
    setTempDaysOfWeek([]);
    setTempNotes('');
    setShowExerciseConfig(true);
  };

  // Save exercise configuration
  const handleSaveExerciseConfig = () => {
    if (!currentExercise) return;

    const newSelectedExercise: SelectedExercise = {
      exercise: currentExercise,
      sets: tempSets,
      reps: tempReps,
      minutes: tempMinutes,
      daysOfWeek: tempDaysOfWeek,
      notes: tempNotes
    };

    setSelectedExercises(prev => [...prev, newSelectedExercise]);
    setShowExerciseConfig(false);
    setCurrentExercise(null);
  };

  // Remove exercise from plan
  const handleRemoveExercise = (index: number) => {
    setSelectedExercises(prev => prev.filter((_, i) => i !== index));
  };

  // Handle form submission
  const handleUpdatePlan = () => {
    if (!planName.trim()) {
      toast({
        title: "Error",
        description: "Plan name is required",
        variant: "destructive"
      });
      return;
    }

    if (selectedExercises.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one exercise",
        variant: "destructive"
      });
      return;
    }

    updatePlanMutation.mutate();
  };

  // Extract data from exercise response
  const exercises = exerciseResponse?.data || [];
  const totalCount = exerciseResponse?.metadata?.totalExercises || 0;
  const totalPages = exerciseResponse?.metadata?.totalPages || Math.ceil(totalCount / limit);

  // Get filter options
  const uniqueBodyParts = bodyParts.map((bp: any) => bp.name).sort();
  const uniqueEquipment = equipments.map((eq: any) => eq.name).sort();
  const uniqueTargets = allMuscles.map((muscle: any) => muscle.name).sort();

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

  // Check if exercise is favorite
  const isFavorite = (exerciseId: string) => {
    return favoriteExercises.some((fav: FavoriteExercise) => fav.exerciseId === exerciseId);
  };

  if (planLoading) {
    return (
      <div className="p-4 max-w-6xl mx-auto">
        <div className="text-center py-12">
          <div className="text-xl">Loading plan...</div>
        </div>
      </div>
    );
  }

  if (!existingPlan) {
    return (
      <div className="p-4 max-w-6xl mx-auto">
        <div className="text-center py-12">
          <div className="text-xl">Plan not found</div>
          <Link href="/fitness">
            <Button className="mt-4">Back to Fitness</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/fitness">
          <Button variant="outline" size="sm" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Fitness
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Edit Fitness Plan</h1>
      </div>

      <div className="space-y-6">
        {/* Plan Details */}
        <Card className="bg-ministry-gold text-black">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Dumbbell className="h-5 w-5" />
                Plan Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Plan Name</label>
                <Input
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  placeholder="Enter plan name"
                  className="text-white placeholder:text-white/70"
                  data-testid="input-plan-name"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Description</label>
                <Textarea
                  value={planDescription}
                  onChange={(e) => setPlanDescription(e.target.value)}
                  placeholder="Describe your fitness plan"
                  className="text-white placeholder:text-white/70"
                  data-testid="input-plan-description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Category</label>
                  <Select value={planCategory} onValueChange={setPlanCategory}>
                    <SelectTrigger className="text-white [&>span]:text-white" data-testid="select-plan-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="strength">Strength</SelectItem>
                      <SelectItem value="cardio">Cardio</SelectItem>
                      <SelectItem value="flexibility">Flexibility</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Difficulty</label>
                  <Select value={planDifficulty} onValueChange={setPlanDifficulty}>
                    <SelectTrigger className="text-white [&>span]:text-white" data-testid="select-plan-difficulty">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

        {/* Weekly Exercise Distribution */}
        {selectedExercises.length > 0 && (
          <Card className="bg-ministry-charcoal border-ministry-steel">
            <CardHeader>
              <CardTitle className="text-ministry-gold flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Week {getCurrentWeek(selectedExercises)} of 4
              </CardTitle>
            </CardHeader>
            <CardContent className="text-white">
              <p className="text-ministry-steel text-sm">
                Exercises are distributed evenly across 4 weeks. Currently showing Week {getCurrentWeek(selectedExercises)} exercises.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Selected Exercises */}
        <Card className="bg-ministry-gold text-black">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5" />
                Week {getCurrentWeek(selectedExercises)} Exercises ({selectedExercises.filter((selected, index) => getExerciseWeek(selectedExercises, index) === getCurrentWeek(selectedExercises)).length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedExercises.length === 0 ? (
                <p className="text-center py-8 text-black">No exercises selected. Add exercises below.</p>
              ) : (
                selectedExercises
                  .map((selected, index) => ({ ...selected, originalIndex: index }))
                  .filter((selected) => getExerciseWeek(selectedExercises, selected.originalIndex) === getCurrentWeek(selectedExercises))
                  .map((selected) => (
                  <div key={selected.originalIndex} className="p-4 border border-black/20 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-lg capitalize">
                        {selected.exercise.name.replace(/_/g, ' ')}
                      </h4>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRemoveExercise(selected.originalIndex)}
                        className="border-red-300 text-red-600 hover:bg-red-50"
                        data-testid={`button-remove-exercise-${selected.originalIndex}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 text-sm text-black mb-2">
                      {selected.sets && selected.sets > 0 && <span>Sets: {selected.sets}</span>}
                      {selected.reps && <span>Reps: {selected.reps}</span>}
                      {selected.minutes && <span>Minutes: {selected.minutes}</span>}
                    </div>

                    {selected.daysOfWeek.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {selected.daysOfWeek.map(day => (
                          <Badge key={day} variant="secondary" className="text-xs">
                            {day}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {selected.notes && (
                      <p className="text-sm text-black italic">{selected.notes}</p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

        {/* Update Plan Button */}
        <Button
          onClick={handleUpdatePlan}
          disabled={updatePlanMutation.isPending}
          className="w-full bg-ministry-gold hover:bg-ministry-gold/90 text-black"
          data-testid="button-update-plan"
        >
          {updatePlanMutation.isPending ? 'Updating Plan...' : 'Update Plan'}
        </Button>

        {/* Exercise Search & Selection */}
        <Card className="bg-ministry-gold text-black">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Add More Exercises
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search and filters UI - matching Find Exercises layout */}
              <div className="space-y-4">
                {/* Search on top */}
                <div className="flex items-center space-x-4">
                  <div className="flex-1">
                    <Input
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      placeholder="Search exercises..."
                      className="text-white placeholder:text-white/70"
                      data-testid="input-search"
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
                    className="border-ministry-charcoal text-ministry-charcoal hover:bg-ministry-charcoal hover:text-white"
                    data-testid="button-clear-filters"
                  >
                    Clear
                  </Button>
                </div>

                {/* Filters below */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Select value={selectedBodyPart} onValueChange={(value) => handleFilterChange('bodyPart', value)}>
                    <SelectTrigger className="text-white [&>span]:text-white" data-testid="select-body-part">
                      <SelectValue placeholder="Body Part" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Body Parts</SelectItem>
                      {uniqueBodyParts.map((part: string) => (
                        <SelectItem key={part} value={part}>{part}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={selectedEquipment} onValueChange={(value) => handleFilterChange('equipment', value)}>
                    <SelectTrigger className="text-white [&>span]:text-white" data-testid="select-equipment">
                      <SelectValue placeholder="Equipment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Equipment</SelectItem>
                      {uniqueEquipment.map((eq: string) => (
                        <SelectItem key={eq} value={eq}>{eq}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={selectedTarget} onValueChange={(value) => handleFilterChange('target', value)}>
                    <SelectTrigger className="text-white [&>span]:text-white" data-testid="select-target">
                      <SelectValue placeholder="Target Muscle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Muscles</SelectItem>
                      {uniqueTargets.map((target: string) => (
                        <SelectItem key={target} value={target}>{target}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Exercise Results */}
              {isLoadingExercises ? (
                <div className="text-center py-8">Loading exercises...</div>
              ) : (
                <div className="space-y-4">
                  {exercises.map((exercise: Exercise) => (
                    <div key={exercise.exerciseId || exercise.id} className="p-4 border border-black/20 rounded-lg flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        <img 
                          src={exercise.gifUrl} 
                          alt={exercise.name}
                          className="w-16 h-16 object-cover rounded"
                        />
                        <div className="flex-1">
                          <h4 className="font-medium capitalize mb-1">
                            {exercise.name.replace(/_/g, ' ')}
                          </h4>
                          <div className="flex flex-wrap gap-1 text-xs">
                            {exercise.bodyParts?.map((part: string) => (
                              <Badge key={part} variant="secondary">{part}</Badge>
                            ))}
                            {exercise.equipments?.map((eq: string) => (
                              <Badge key={eq} variant="outline" className="bg-black text-white border-black">{eq}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {isFavorite(exercise.exerciseId || exercise.id || '') && (
                          <Badge className="bg-ministry-gold text-black">
                            <Heart className="w-3 h-3 mr-1 fill-current" />
                            Favorite
                          </Badge>
                        )}
                        <Button
                          size="sm"
                          onClick={() => handleAddExercise(exercise)}
                          className="bg-ministry-gold hover:bg-ministry-gold/90 text-black"
                          data-testid={`button-add-exercise-${exercise.exerciseId || exercise.id}`}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add
                        </Button>
                      </div>
                    </div>
                  ))}

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center space-x-2">
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
                </div>
              )}
            </CardContent>
          </Card>
      </div>

      {/* Exercise Configuration Modal */}
      {showExerciseConfig && currentExercise && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="bg-ministry-gold text-black w-full max-w-md">
            <CardHeader>
              <CardTitle>Configure Exercise</CardTitle>
              <p className="text-sm capitalize">{currentExercise.name.replace(/_/g, ' ')}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Sets</label>
                  <Input
                    type="number"
                    value={tempSets || ''}
                    onChange={(e) => setTempSets(e.target.value ? parseInt(e.target.value) : 0)}
                    min="0"
                    placeholder="3"
                    data-testid="input-sets"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Reps</label>
                  <Input
                    value={tempReps}
                    onChange={(e) => setTempReps(e.target.value)}
                    placeholder="10 or 8-12"
                    data-testid="input-reps"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Minutes</label>
                  <Input
                    type="number"
                    value={tempMinutes || ''}
                    onChange={(e) => setTempMinutes(e.target.value ? parseInt(e.target.value) : undefined)}
                    min="1"
                    placeholder="Optional"
                    data-testid="input-minutes"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Days of Week</label>
                <div className="grid grid-cols-2 gap-2">
                  {daysOfWeek.map(day => (
                    <div key={day.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={day.value}
                        checked={tempDaysOfWeek.includes(day.value)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setTempDaysOfWeek(prev => [...prev, day.value]);
                          } else {
                            setTempDaysOfWeek(prev => prev.filter(d => d !== day.value));
                          }
                        }}
                        data-testid={`checkbox-day-${day.value}`}
                      />
                      <label htmlFor={day.value} className="text-sm">
                        {day.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Notes</label>
                <Textarea
                  value={tempNotes}
                  onChange={(e) => setTempNotes(e.target.value)}
                  placeholder="Optional notes..."
                  data-testid="input-notes"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowExerciseConfig(false)}
                  className="flex-1"
                  data-testid="button-cancel-config"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveExerciseConfig}
                  className="flex-1 bg-ministry-gold hover:bg-ministry-gold/90 text-black"
                  data-testid="button-save-config"
                >
                  Add to Plan
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}