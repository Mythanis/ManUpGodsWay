import { useState, useEffect, useMemo, useRef } from "react";
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
  Timer,
  ShieldAlert,
  EyeOff
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useLocation, Link } from "wouter";
import { BackButton } from "@/components/BackButton";
import { PushConsentDialog } from "@/components/push-consent-dialog";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { evaluateExerciseAgainstInjuries } from "@shared/injuryFilter";

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
  // Sidedness from the exercises table. Determines whether reps default
  // uses "per side" phrasing. Set on the DB row; may be absent on old data.
  sidedness?: 'bilateral' | 'unilateral' | 'alternating';
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

export default function CreatePlan() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isSubscribed: isPushSubscribed } = usePushNotifications();
  const [showReminderPushConsent, setShowReminderPushConsent] = useState(false);

  // Plan details
  const [planName, setPlanName] = useState('');
  const [planDescription, setPlanDescription] = useState('');
  const [planCategory, setPlanCategory] = useState('general');
  const [planDifficulty, setPlanDifficulty] = useState('beginner');

  // Exercise search and filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBodyPart, setSelectedBodyPart] = useState('all');
  const [selectedEquipment, setSelectedEquipment] = useState('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 25;
  const offset = (currentPage - 1) * limit;

  // Injury filtering state
  const [hideConflicting, setHideConflicting] = useState(false);
  // Injury risk confirmation dialog state (pre-add check)
  const [injuryDialogExercise, setInjuryDialogExercise] = useState<Exercise | null>(null);
  const [injuryDialogReasons, setInjuryDialogReasons] = useState<string[]>([]);
  // Server-side 409 retry state
  const forceInjuryOverride = useRef(false);
  const [saveBlockedList, setSaveBlockedList] = useState<{exerciseName: string; reasons: string[]}[]>([]);

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

  // Fetch user injuries for exercise filtering
  const { data: userInjuries = [] } = useQuery<any[]>({
    queryKey: ['/api/user/injuries'],
    queryFn: async () => {
      const res = await fetch('/api/user/injuries', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60000,
  });

  // Default hideConflicting ON when user has a current injury (run once on load)
  useEffect(() => {
    if (userInjuries.some((inj: any) => inj.injuryType === 'currently_injured')) {
      setHideConflicting(true);
    }
  }, [userInjuries.length]);

  // Fetch body parts for filtering
  const { data: bodyParts = [] } = useQuery({
    queryKey: ['bodyparts'],
    queryFn: async () => {
      const response = await fetch('/api/exercises/body-parts');
      if (!response.ok) throw new Error('Failed to fetch body parts');
      return await response.json();
    },
    staleTime: 300000,
  });

  // Fetch equipment for filtering
  const { data: equipments = [] } = useQuery({
    queryKey: ['equipments'],
    queryFn: async () => {
      const response = await fetch('/api/exercises/equipment-types');
      if (!response.ok) throw new Error('Failed to fetch equipment');
      return await response.json();
    },
    staleTime: 300000,
  });

  // Fetch muscles for filtering and filter out unused ones
  const { data: allMuscles = [] } = useQuery({
    queryKey: ['muscles'],
    queryFn: async () => {
      const response = await fetch('/api/exercises/body-parts');
      if (!response.ok) throw new Error('Failed to fetch muscles');
      return await response.json();
    },
    staleTime: 300000,
  });
  
  // Use all body parts as target muscles (local database has all available muscles)
  const usedMuscles = allMuscles;

  // Build filter params for API
  const filterParams = new URLSearchParams();
  filterParams.set('offset', offset.toString());
  filterParams.set('limit', limit.toString());
  
  if (searchQuery) filterParams.set('search', searchQuery);
  if (selectedBodyPart !== 'all') filterParams.set('bodyParts', selectedBodyPart);
  if (selectedEquipment !== 'all') filterParams.set('equipment', selectedEquipment);
  filterParams.set('sortBy', 'name');
  filterParams.set('sortOrder', 'asc');

  // Fetch exercises with server-side filtering
  const { data: exerciseResponse, isLoading: isLoadingExercises } = useQuery({
    queryKey: ['exercises', currentPage, searchQuery, selectedBodyPart, selectedEquipment],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (selectedBodyPart !== 'all') {
        params.set('bodyPart', selectedBodyPart);
      }
      if (selectedEquipment !== 'all') params.set('equipment', selectedEquipment);
      params.set('offset', offset.toString());
      params.set('limit', limit.toString());
      // Collapse left/right pair rows so users only see one unilateral entry per pair.
      params.set('dedupePairs', 'true');

      const url = `/api/exercises${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch exercises');
      return await response.json();
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  // Get filter options from local database (already arrays of strings)
  const uniqueBodyParts = (bodyParts || []).sort();
  const uniqueEquipment = (equipments || []).sort();
  const uniqueTargets = (usedMuscles || allMuscles || []).sort();

  // Extract exercise data from local database (returns array directly)
  const exercises = exerciseResponse || [];
  const totalExercises = exercises.length;
  const totalPages = Math.ceil(totalExercises / limit);

  // Compute injury evaluations for the current page of exercises (memoized)
  const injuryEvalMap = useMemo(() => {
    if (!userInjuries.length) return new Map<string, ReturnType<typeof evaluateExerciseAgainstInjuries>>();
    const map = new Map<string, ReturnType<typeof evaluateExerciseAgainstInjuries>>();
    for (const ex of exercises) {
      const key = String((ex as any).id ?? ex.exerciseId ?? ex.name ?? '');
      if (!key) continue;
      const evaluation = evaluateExerciseAgainstInjuries(
        {
          name: ex.name ?? '',
          bodyPart: (ex as any).bodyPart || ex.bodyParts?.[0] || '',
          hiit: (ex as any).hiit || 'No',
          stretching: (ex as any).stretching || 'No',
          equipment: (ex as any).equipment || ex.equipments?.[0] || '',
          level: (ex as any).level || '',
        },
        userInjuries,
      );
      map.set(key, evaluation);
    }
    return map;
  }, [exercises, userInjuries]);

  // Helper: get the stable exercise key (DB id preferred)
  const getExKey = (ex: any): string => String(ex.id ?? ex.exerciseId ?? ex.name ?? '');

  // Filter exercises to show only favorites if selected, plus optionally hide conflicting
  const filteredExercises = exercises.filter((exercise: any) => {
    if (showFavoritesOnly) {
      const exKey = getExKey(exercise);
      const matchesFav = favoriteExercises.some(
        (fav: FavoriteExercise) =>
          fav.exerciseId === exKey ||
          fav.exerciseId === exercise.exerciseId ||
          fav.exerciseName === exercise.name,
      );
      if (!matchesFav) return false;
    }
    if (hideConflicting && userInjuries.length > 0) {
      const ev = injuryEvalMap.get(getExKey(exercise));
      if (ev?.status === 'blocked') return false;
    }
    return true;
  });

  // Helper functions
  const isFavorite = (exerciseId: string) => {
    return favoriteExercises.some((fav: FavoriteExercise) => fav.exerciseId === exerciseId);
  };

  const isExerciseSelected = (exerciseId: string) => {
    return selectedExercises.some(selected => selected.exercise.exerciseId === exerciseId);
  };

  // Opens the config modal (called after any injury-check pass)
  const openExerciseConfig = (exercise: Exercise) => {
    setCurrentExercise(exercise);
    setTempSets(3);
    setTempReps((exercise as any).sidedness === 'unilateral' || (exercise as any).sidedness === 'alternating' ? '10 per side' : '10');
    setTempMinutes(undefined);
    setTempDaysOfWeek([]);
    setTempNotes('');
    setShowExerciseConfig(true);
  };

  // Exercise configuration handlers
  const handleExerciseSelect = (exercise: Exercise) => {
    const exKey = getExKey(exercise as any);
    if (isExerciseSelected(exKey) || isExerciseSelected(exercise.exerciseId)) {
      // Remove from selected exercises
      setSelectedExercises(prev => 
        prev.filter(selected =>
          getExKey(selected.exercise as any) !== exKey &&
          selected.exercise.exerciseId !== exercise.exerciseId
        )
      );
      return;
    }
    // Check injury status before opening config modal
    const ev = injuryEvalMap.get(exKey);
    if (ev?.status === 'blocked') {
      setInjuryDialogExercise(exercise);
      setInjuryDialogReasons(ev.reasons);
      return;
    }
    openExerciseConfig(exercise);
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
    if (!isPushSubscribed && reminders.length === 0) {
      // Show consent dialog on first reminder add; it calls the real add on allow/decline
      setShowReminderPushConsent(true);
    } else {
      setReminders(prev => [...prev, { dayOfWeek: 'monday', time: '09:00' }]);
    }
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

      // Build all exercise payloads up front
      const exercisePayloads = selectedExercises.map((selectedExercise, i) => {
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
          orderIndex: i,
        };

        if (selectedExercise.minutes && typeof selectedExercise.minutes === 'number' && selectedExercise.minutes > 0) {
          exerciseData.minutes = selectedExercise.minutes;
        }

        return exerciseData;
      });

      // Send all exercises in a single bulk request to avoid hitting the
      // per-IP rate limiter on large plans.
      if (exercisePayloads.length > 0) {
        // If the server returns 409 INJURY_RISK, the caller sets
        // forceInjuryOverride.current = true and retries the mutation.
        // Also pre-check client-side for blocked exercises.
        const hasBlockedExercises = selectedExercises.some(sel => {
          const key = getExKey(sel.exercise as any);
          const ev = injuryEvalMap.get(key);
          return ev?.status === 'blocked';
        });
        await apiRequest(
          'POST',
          `/api/fitness-plans/${plan.id}/exercises/bulk`,
          {
            exercises: exercisePayloads,
            ...(hasBlockedExercises || forceInjuryOverride.current ? { acknowledgeInjuryRisk: true } : {}),
          }
        );
        // Reset override flag after use
        forceInjuryOverride.current = false;
      }

      // Add reminders in parallel (typically very few, so well under limit)
      if (reminders.length > 0) {
        await Promise.all(
          reminders.map(reminder =>
            apiRequest('POST', `/api/fitness-plans/${plan.id}/reminders`, reminder)
          )
        );
      }

      return plan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api', 'fitness-plans'] });
      toast({ title: "Fitness plan created successfully!" });
      setLocation('/fitness');
    },
    onError: (error: any) => {
      // Server returned 409 INJURY_RISK — show retry dialog instead of generic error
      if (error?.response?.status === 409) {
        try {
          const body = error?.response?.data ?? {};
          if (body?.code === 'INJURY_RISK' && Array.isArray(body?.blockedExercises)) {
            setSaveBlockedList(body.blockedExercises.map((b: any) => ({
              exerciseName: b.exerciseName ?? b.exerciseId ?? 'Unknown',
              reasons: Array.isArray(b.reasons) ? b.reasons : [],
            })));
            return;
          }
        } catch (_) {}
      }
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
      <BackButton fallbackPath="/fitness" />
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
                </div>

                {/* Favorites Only checkbox */}
                <div className="flex items-center gap-6 flex-wrap">
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
                  {userInjuries.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Switch
                        id="hide-conflicting"
                        checked={hideConflicting}
                        onCheckedChange={setHideConflicting}
                        data-testid="toggle-hide-conflicting"
                      />
                      <label htmlFor="hide-conflicting" className="text-sm font-medium text-white flex items-center gap-1 cursor-pointer">
                        <EyeOff className="h-4 w-4" />
                        Hide exercises that conflict with my injuries
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Exercise Results */}
          <Card className="bg-ministry-gold text-black">
            <CardHeader>
              <CardTitle>
                Exercise Results ({filteredExercises.length} shown)
                {userInjuries.length > 0 && hideConflicting && (
                  <span className="ml-2 text-sm font-normal text-black/60">
                    (conflict-blocked exercises hidden)
                  </span>
                )}
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
                  {filteredExercises.map((exercise: any) => {
                    const exKey = getExKey(exercise);
                    const isSelected = isExerciseSelected(exKey) || isExerciseSelected(exercise.exerciseId);
                    const isFav = isFavorite(exercise.exerciseId) || isFavorite(exKey);
                    const injuryEval = injuryEvalMap.get(exKey);
                    const injStatus = injuryEval?.status;
                    
                    return (
                      <div
                        key={exKey || exercise.name}
                        className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                          isSelected 
                            ? 'border-ministry-gold bg-ministry-gold/10'
                            : injStatus === 'blocked'
                            ? 'border-red-400/60 opacity-75 hover:opacity-100 hover:border-red-500'
                            : injStatus === 'modify'
                            ? 'border-yellow-400/60 hover:border-yellow-500'
                            : injStatus === 'caution'
                            ? 'border-green-600/50 hover:border-green-500'
                            : 'hover:border-ministry-steel'
                        }`}
                        onClick={() => handleExerciseSelect(exercise)}
                        data-testid={`exercise-card-${exKey}`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium">{exercise.name}</h4>
                          <div className="flex gap-1 items-center shrink-0">
                            {injStatus === 'blocked' && (
                              <span className="text-xs font-semibold bg-red-600 text-white px-1.5 py-0.5 rounded" title={injuryEval?.reasons.join(' | ')}>
                                🔴 Blocked
                              </span>
                            )}
                            {injStatus === 'modify' && (
                              <span className="text-xs font-semibold bg-yellow-500 text-black px-1.5 py-0.5 rounded" title={injuryEval?.reasons.join(' | ')}>
                                🟡 Caution
                              </span>
                            )}
                            {injStatus === 'caution' && (
                              <span className="text-xs font-semibold bg-green-700 text-white px-1.5 py-0.5 rounded" title={injuryEval?.reasons.join(' | ')}>
                                🟢 Caution
                              </span>
                            )}
                            {isFav && <Heart className="h-4 w-4 text-red-500 fill-red-500" />}
                            {isSelected && <CheckSquare className="h-4 w-4 text-ministry-gold" />}
                          </div>
                        </div>
                        {injuryEval && injStatus !== 'allowed' && injuryEval.reasons.length > 0 && (
                          <p className="text-xs text-black/70 mb-1 italic">{injuryEval.reasons[0]}</p>
                        )}
                        
                        <div className="flex flex-wrap gap-1 text-xs">
                          {(exercise.bodyPart
                            ? [exercise.bodyPart]
                            : (exercise.bodyParts ?? [])
                          ).map((part: string) => (
                            <Badge key={part} variant="secondary">{part}</Badge>
                          ))}
                          {(exercise.equipment
                            ? [exercise.equipment]
                            : (exercise.equipments ?? [])
                          ).map((eq: string) => (
                            <Badge key={eq} variant="outline" className="bg-black text-white border-black">{eq}</Badge>
                          ))}
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

      {/* Push consent for workout reminders */}
      <PushConsentDialog
        open={showReminderPushConsent}
        onOpenChange={setShowReminderPushConsent}
        reason="Enable push notifications so you never miss a scheduled workout."
        onAllowed={() => {
          setReminders(prev => [...prev, { dayOfWeek: 'monday', time: '09:00' }]);
        }}
      />

      {/* Injury risk confirmation dialog */}
      <Dialog
        open={!!injuryDialogExercise}
        onOpenChange={(open) => { if (!open) setInjuryDialogExercise(null); }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <ShieldAlert className="h-5 w-5" />
              Exercise Conflicts With Your Injury
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm text-left">
                <p className="font-medium text-foreground">
                  "{injuryDialogExercise?.name}" may aggravate your recorded injury:
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  {injuryDialogReasons.map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
                <p className="text-muted-foreground pt-1">
                  Adding this exercise is not recommended. If you choose to proceed, consult your physician or physiotherapist first.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setInjuryDialogExercise(null)}
              className="flex-1"
            >
              Cancel — Skip this exercise
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (injuryDialogExercise) {
                  openExerciseConfig(injuryDialogExercise);
                }
                setInjuryDialogExercise(null);
              }}
              className="flex-1"
            >
              I understand — Add anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Server-side 409 INJURY_RISK retry dialog */}
      <Dialog open={saveBlockedList.length > 0} onOpenChange={() => setSaveBlockedList([])}>
        <DialogContent className="max-w-md bg-zinc-900 border-zinc-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <ShieldAlert className="w-5 h-5" />
              Injury Conflict — Save Anyway?
            </DialogTitle>
            <DialogDescription className="text-zinc-300 mt-2">
              The following exercises conflict with your recorded injuries:
              <ul className="mt-2 space-y-1">
                {saveBlockedList.map((item, i) => (
                  <li key={i} className="text-sm">
                    <span className="font-semibold text-red-400">{item.exerciseName}</span>
                    {item.reasons.length > 0 && (
                      <span className="text-zinc-400 ml-1">— {item.reasons[0]}</span>
                    )}
                  </li>
                ))}
              </ul>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setSaveBlockedList([])}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setSaveBlockedList([]);
                forceInjuryOverride.current = true;
                createPlanMutation.mutate();
              }}
              className="flex-1"
            >
              I understand — Save anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}