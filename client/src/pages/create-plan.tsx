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
import { fetchExercises, fetchBodyParts, fetchEquipments, fetchTargets, type Exercise } from "@/utils/exercise-api";
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

export default function CreatePlan() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  // Exercise configuration modal
  const [showExerciseConfig, setShowExerciseConfig] = useState(false);
  const [currentExercise, setCurrentExercise] = useState<Exercise | null>(null);
  const [tempSets, setTempSets] = useState(3);
  const [tempReps, setTempReps] = useState('10');
  const [tempMinutes, setTempMinutes] = useState<number | undefined>();
  const [tempDaysOfWeek, setTempDaysOfWeek] = useState<string[]>([]);
  const [tempNotes, setTempNotes] = useState('');

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
    queryFn: fetchBodyParts,
    staleTime: 300000,
  });

  // Fetch equipment for filtering
  const { data: equipments = [] } = useQuery({
    queryKey: ['equipments'],
    queryFn: fetchEquipments,
    staleTime: 300000,
  });

  // Fetch target muscles for filtering
  const { data: allMuscles = [] } = useQuery({
    queryKey: ['muscles'],
    queryFn: fetchTargets,
    staleTime: 300000,
  });

  // Fetch exercises with server-side filtering using the new utility
  const { data: exerciseResponse, isLoading: isLoadingExercises } = useQuery({
    queryKey: ['exercises', currentPage, searchQuery, selectedBodyPart, selectedEquipment, selectedTarget],
    queryFn: async () => {
      return await fetchExercises({
        offset,
        limit,
        search: searchQuery || undefined,
        bodyParts: selectedBodyPart !== 'all' ? selectedBodyPart : undefined,
        equipment: selectedEquipment !== 'all' ? selectedEquipment : undefined,
        muscles: selectedTarget !== 'all' ? selectedTarget : undefined,
        sortBy: 'name',
        sortOrder: 'asc'
      });
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  // Get filter options from API data
  const uniqueBodyParts = bodyParts.map((bp: any) => bp.name).sort();
  const uniqueEquipment = equipments.map((eq: any) => eq.name).sort();
  const uniqueTargets = allMuscles.map((muscle: any) => muscle.name).sort();

  // Extract exercise data with proper pagination info
  const exercises = exerciseResponse?.data || [];
  const totalExercises = exerciseResponse?.metadata?.totalExercises || 0;
  const totalPages = exerciseResponse?.metadata?.totalPages || 0;

  // Filter exercises to show only favorites if selected
  const filteredExercises = showFavoritesOnly 
    ? exercises.filter((exercise: Exercise) => 
        favoriteExercises.some((fav: FavoriteExercise) => fav.exerciseId === exercise.exerciseId)
      )
    : exercises;

  // Helper functions
  const isFavorite = (exerciseId: string) => {
    return favoriteExercises.some((fav: FavoriteExercise) => fav.exerciseId === exerciseId);
  };

  const isExerciseSelected = (exerciseId: string) => {
    return selectedExercises.some(selected => selected.exercise.exerciseId === exerciseId);
  };

  // Exercise configuration handlers
  const handleExerciseSelect = (exercise: Exercise) => {
    if (isExerciseSelected(exercise.exerciseId)) {
      // Remove from selected exercises
      setSelectedExercises(prev => 
        prev.filter(selected => selected.exercise.exerciseId !== exercise.exerciseId)
      );
    } else {
      // Open configuration modal
      setCurrentExercise(exercise);
      setTempSets(3);
      setTempReps('10');
      setTempMinutes(undefined);
      setTempDaysOfWeek([]);
      setTempNotes('');
      setShowExerciseConfig(true);
    }
  };

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

  const handleRemoveExercise = (exerciseId: string) => {
    setSelectedExercises(prev => 
      prev.filter(selected => selected.exercise.exerciseId !== exerciseId)
    );
  };

  // Reminder handlers
  const addReminder = () => {
    setReminders(prev => [...prev, { dayOfWeek: 'monday', time: '09:00' }]);
  };

  const updateReminder = (index: number, field: 'dayOfWeek' | 'time', value: string) => {
    setReminders(prev => 
      prev.map((reminder, i) => 
        i === index ? { ...reminder, [field]: value } : reminder
      )
    );
  };

  const removeReminder = (index: number) => {
    setReminders(prev => prev.filter((_, i) => i !== index));
  };

  // Create plan mutation
  const createPlanMutation = useMutation({
    mutationFn: async () => {
      // First create the plan
      const planData = {
        name: planName,
        description: planDescription,
        category: planCategory,
        difficulty: planDifficulty,
        isPublic: false
      };

      const plan = await apiRequest('POST', '/api/fitness-plans', planData);
      
      // Add exercises to the plan
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
          notes: selectedExercise.notes,
          orderIndex: i
        };

        // Only include minutes if it's a valid number
        if (selectedExercise.minutes && typeof selectedExercise.minutes === 'number' && selectedExercise.minutes > 0) {
          exerciseData.minutes = selectedExercise.minutes;
        }

        await apiRequest('POST', `/api/fitness-plans/${plan.id}/exercises`, exerciseData);
      }

      // Add reminders
      for (const reminder of reminders) {
        await apiRequest('POST', `/api/fitness-plans/${plan.id}/reminders`, reminder);
      }

      return plan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api', 'fitness-plans'] });
      toast({ title: "Fitness plan created successfully!" });
      setLocation('/fitness');
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create plan",
        variant: "destructive" 
      });
    },
  });

  const handleCreatePlan = () => {
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

    createPlanMutation.mutate();
  };

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
        <h1 className="text-2xl font-bold">Create Fitness Plan</h1>
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

        {/* Selected Exercises */}
        <Card className="bg-ministry-gold text-black">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5" />
                Selected Exercises ({selectedExercises.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedExercises.length === 0 ? (
                <p className="text-white text-center py-4">
                  No exercises selected yet. Choose exercises from the right panel.
                </p>
              ) : (
                <div className="space-y-3">
                  {selectedExercises.map((selected, index) => (
                    <div key={selected.exercise.exerciseId} className="border rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium">{selected.exercise.name}</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveExercise(selected.exercise.exerciseId)}
                          data-testid={`button-remove-exercise-${index}`}
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
                              {day.charAt(0).toUpperCase() + day.slice(1)}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {selected.notes && (
                        <p className="text-sm text-muted-foreground italic">{selected.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        {/* Reminders */}
        <Card className="bg-ministry-gold text-black">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Workout Reminders
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {reminders.map((reminder, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <Select 
                    value={reminder.dayOfWeek} 
                    onValueChange={(value) => updateReminder(index, 'dayOfWeek', value)}
                  >
                    <SelectTrigger className="flex-1 text-white [&>span]:text-white" data-testid={`select-reminder-day-${index}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {daysOfWeek.map(day => (
                        <SelectItem key={day.value} value={day.value}>
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Input
                    type="time"
                    value={reminder.time}
                    onChange={(e) => updateReminder(index, 'time', e.target.value)}
                    className="w-32 text-white"
                    data-testid={`input-reminder-time-${index}`}
                  />
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeReminder(index)}
                    data-testid={`button-remove-reminder-${index}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              
              <Button 
                variant="outline" 
                onClick={addReminder}
                className="w-full text-white border-white hover:bg-white hover:text-black"
                data-testid="button-add-reminder"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Reminder
              </Button>
            </CardContent>
          </Card>

          {/* Create Plan Button */}
          <Button
            onClick={handleCreatePlan}
            disabled={createPlanMutation.isPending}
            className="w-full bg-ministry-gold hover:bg-ministry-gold/90 text-black"
            data-testid="button-create-plan"
          >
            {createPlanMutation.isPending ? 'Creating Plan...' : 'Create Plan'}
          </Button>

        {/* Exercise Search & Selection */}
        <Card className="bg-ministry-gold text-black">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Find Exercises
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search and filters UI - matching Find Exercises layout */}
              <div className="space-y-4">
                {/* Search on top */}
                <div className="flex items-center space-x-4">
                  <div className="flex-1">
                    <Input
                      placeholder="Search exercises..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="text-white placeholder:text-white/70"
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
                    className="border-ministry-charcoal text-ministry-charcoal hover:bg-ministry-charcoal hover:text-white"
                    data-testid="button-clear-filters"
                  >
                    Clear
                  </Button>
                </div>

                {/* Filters below */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Select value={selectedBodyPart} onValueChange={setSelectedBodyPart}>
                    <SelectTrigger className="text-white [&>span]:text-white" data-testid="select-body-part">
                      <SelectValue placeholder="Body Part" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Body Parts</SelectItem>
                      {uniqueBodyParts.map((bodyPart: string) => (
                        <SelectItem key={bodyPart} value={bodyPart}>
                          {bodyPart.charAt(0).toUpperCase() + bodyPart.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={selectedEquipment} onValueChange={setSelectedEquipment}>
                    <SelectTrigger className="text-white [&>span]:text-white" data-testid="select-equipment">
                      <SelectValue placeholder="Equipment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Equipment</SelectItem>
                      {uniqueEquipment.map((equipment: string) => (
                        <SelectItem key={equipment} value={equipment}>
                          {equipment.charAt(0).toUpperCase() + equipment.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={selectedTarget} onValueChange={setSelectedTarget}>
                    <SelectTrigger className="text-white [&>span]:text-white" data-testid="select-target-muscle">
                      <SelectValue placeholder="Target Muscle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Muscles</SelectItem>
                      {uniqueTargets.map((target: string) => (
                        <SelectItem key={target} value={target}>
                          {target.charAt(0).toUpperCase() + target.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Favorites Only checkbox */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="favorites"
                    checked={showFavoritesOnly}
                    onCheckedChange={(checked) => setShowFavoritesOnly(checked === true)}
                    data-testid="checkbox-favorites-only"
                  />
                  <label htmlFor="favorites" className="text-sm font-medium text-white">
                    Favorites Only
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Exercise Results */}
          <Card className="bg-ministry-gold text-black">
            <CardHeader>
              <CardTitle>
                Exercise Results ({filteredExercises.length} shown)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingExercises ? (
                <div className="text-center py-8 text-white">Loading exercises...</div>
              ) : filteredExercises.length === 0 ? (
                <div className="text-center py-8 text-white">
                  No exercises found. Try adjusting your filters.
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {filteredExercises.map((exercise: Exercise) => {
                    const isSelected = isExerciseSelected(exercise.exerciseId);
                    const isFav = isFavorite(exercise.exerciseId);
                    
                    return (
                      <div
                        key={exercise.exerciseId}
                        className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                          isSelected 
                            ? 'border-ministry-gold bg-ministry-gold/10' 
                            : 'hover:border-ministry-steel'
                        }`}
                        onClick={() => handleExerciseSelect(exercise)}
                        data-testid={`exercise-card-${exercise.exerciseId}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 flex-shrink-0 bg-ministry-steel/20 rounded flex items-center justify-center relative">
                            <img 
                              src={exercise.gifUrl} 
                              alt={exercise.name}
                              className="w-12 h-12 object-cover rounded"
                              onError={(e) => {
                                console.log('Image failed to load:', exercise.gifUrl);
                                e.currentTarget.style.display = 'none';
                                const fallbackIcon = e.currentTarget.nextElementSibling as HTMLElement;
                                if (fallbackIcon) fallbackIcon.style.display = 'block';
                              }}
                              onLoad={(e) => {
                                const fallbackIcon = e.currentTarget.nextElementSibling as HTMLElement;
                                if (fallbackIcon) fallbackIcon.style.display = 'none';
                              }}
                            />
                            <Dumbbell className="w-6 h-6 text-ministry-steel" style={{ display: 'none' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-medium truncate">{exercise.name}</h4>
                              <div className="flex gap-1 flex-shrink-0 ml-2">
                                {isFav && <Heart className="h-4 w-4 text-red-500 fill-red-500" />}
                                {isSelected && <CheckSquare className="h-4 w-4 text-ministry-gold" />}
                              </div>
                            </div>
                            
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
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    data-testid="button-prev-page"
                  >
                    Previous
                  </Button>
                  
                  <span className="text-sm text-white">
                    Page {currentPage} of {totalPages}
                  </span>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    data-testid="button-next-page"
                  >
                    Next
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
      </div>

      {/* Exercise Configuration Modal */}
      {showExerciseConfig && currentExercise && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Configure Exercise
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowExerciseConfig(false)}
                  data-testid="button-close-config"
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
              <p className="text-sm text-muted-foreground">{currentExercise.name}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Sets</label>
                  <Input
                    type="number"
                    value={tempSets}
                    onChange={(e) => setTempSets(parseInt(e.target.value) || 0)}
                    min="1"
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