import { useState, useEffect, useMemo } from "react";
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
  Repeat,
  ShieldAlert,
  AlertTriangle,
  EyeOff
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useLocation, Link } from "wouter";
import { BackButton } from "@/components/BackButton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { PushConsentDialog } from "@/components/push-consent-dialog";
import { usePushNotifications } from "@/hooks/use-push-notifications";
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
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 25;
  const offset = (currentPage - 1) * limit;

  // Injury filtering state
  const [hideConflicting, setHideConflicting] = useState(false);
  // Injury risk confirmation dialog state
  const [injuryDialogExercise, setInjuryDialogExercise] = useState<Exercise | null>(null);
  const [injuryDialogReasons, setInjuryDialogReasons] = useState<string[]>([]);

  // Selected exercises for the plan
  const [selectedExercises, setSelectedExercises] = useState<SelectedExercise[]>([]);
  
  // Reminders
  const [reminders, setReminders] = useState<PlanReminder[]>([]);
  const [showReminderPushConsent, setShowReminderPushConsent] = useState(false);
  const { isSubscribed: isPushSubscribed } = usePushNotifications();

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

  // Swap exercise modal
  const [swapTargetIndex, setSwapTargetIndex] = useState<number | null>(null);
  const [swapBodyPart, setSwapBodyPart] = useState<string>('');
  const [swapEquipment, setSwapEquipment] = useState<string>('');

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

  // Load existing plan reminders
  const { data: existingReminders = [] } = useQuery<any[]>({
    queryKey: ['api', 'fitness-plans', planId, 'reminders'],
    queryFn: async () => {
      const res = await fetch(`/api/fitness-plans/${planId}/reminders`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!planId,
  });

  useEffect(() => {
    if (existingReminders && existingReminders.length > 0) {
      setReminders(existingReminders.map((r: any) => ({ dayOfWeek: r.dayOfWeek, time: r.time })));
    }
  }, [existingReminders]);

  // Reminder handlers
  const addReminder = () => {
    if (!isPushSubscribed && reminders.length === 0) {
      setShowReminderPushConsent(true);
    } else {
      setReminders(prev => [...prev, { dayOfWeek: 'monday', time: '09:00' }]);
    }
  };

  const updateReminder = (index: number, field: 'dayOfWeek' | 'time', value: string) => {
    setReminders(prev =>
      prev.map((r, i) => i === index ? { ...r, [field]: value } : r)
    );
  };

  const removeReminder = (index: number) => {
    setReminders(prev => prev.filter((_, i) => i !== index));
  };

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
    queryKey: ['api', 'user', 'injuries'],
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
    refetchOnWindowFocus: false,
  });

  // Fetch equipment for filtering
  const { data: equipments = [] } = useQuery({
    queryKey: ['equipments'],
    queryFn: async () => {
      const response = await fetch('/api/exercises/equipment-types');
      if (!response.ok) throw new Error('Failed to fetch equipments');
      return await response.json();
    },
    staleTime: 300000,
  });

  // Fetch muscles for filtering
  const { data: allMuscles = [] } = useQuery({
    queryKey: ['muscles'],
    queryFn: async () => {
      const response = await fetch('/api/exercises/body-parts');
      if (!response.ok) throw new Error('Failed to fetch muscles');
      return await response.json();
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
        const ex = selectedExercise.exercise as any;
        const exerciseData: any = {
          exerciseId: String(ex.exerciseId || ex.id || ''),
          exerciseName: ex.name,
          bodyPart: ex.bodyParts?.[0] || ex.bodyPart || '',
          targetMuscle: ex.targetMuscles?.[0] || ex.target || '',
          equipment: ex.equipments?.[0] || ex.equipment || '',
          imageUrl: ex.gifUrl || ex.mediaFile || '',
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

        // If the exercise is injury-blocked the user acknowledged via the
        // confirmation dialog before adding — pass the flag so the server
        // guard allows the save.
        const exKeyForGuard = getExKey(ex);
        const evalForGuard = injuryEvalMap.get(exKeyForGuard);
        if (evalForGuard?.status === 'blocked') {
          (exerciseData as any).acknowledgeInjuryRisk = true;
        }

        await apiRequest('POST', `/api/fitness-plans/${planId}/exercises`, exerciseData);
      }

      // Replace reminders: delete existing then add new
      for (const existing of (existingReminders || [])) {
        try {
          await apiRequest('DELETE', `/api/fitness-plan-reminders/${existing.id}`);
        } catch (e) {
          console.error('[EditPlan] Failed to delete existing reminder', existing.id, e);
        }
      }
      for (const reminder of reminders) {
        await apiRequest('POST', `/api/fitness-plans/${planId}/reminders`, reminder);
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

  // Opens the exercise config modal — called after any injury-check pass
  const openExerciseConfig = (exercise: Exercise) => {
    setCurrentExercise(exercise);
    setTempSets(3);
    setTempReps((exercise as any).sidedness === 'unilateral' || (exercise as any).sidedness === 'alternating' ? '10 per side' : '10');
    setTempMinutes(undefined);
    setTempDaysOfWeek([]);
    setTempNotes('');
    setShowExerciseConfig(true);
  };

  // Handle adding exercise to plan (with injury gate)
  const handleAddExercise = (exercise: Exercise) => {
    const exKey = getExKey(exercise as any);
    const ev = injuryEvalMap.get(exKey);
    if (ev?.status === 'blocked') {
      setInjuryDialogExercise(exercise);
      setInjuryDialogReasons(ev.reasons);
      return;
    }
    openExerciseConfig(exercise);
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

  // Open the swap dialog for a given exercise row, preloading filters
  // from that exercise's own body part + equipment so the candidate list
  // matches what the user already chose.
  const handleOpenSwap = (index: number) => {
    const target = selectedExercises[index];
    if (!target) return;
    const ex: any = target.exercise;
    // Keep original casing — the /api/exercises endpoint matches body_part /
    // equipment with exact equality and the DB stores them capitalized
    // (e.g., "Shoulders", "Bodyweight").
    const bp = (ex.bodyParts?.[0] || ex.bodyPart || '').toString();
    const eq = (ex.equipments?.[0] || ex.equipment || '').toString();
    setSwapBodyPart(bp);
    setSwapEquipment(eq);
    setSwapTargetIndex(index);
  };

  // Replace the exercise at swapTargetIndex while preserving sets / reps /
  // minutes / days / notes, then close the dialog.
  const handleSwapExercise = (newExercise: any) => {
    if (swapTargetIndex === null) return;
    setSelectedExercises(prev => prev.map((sel, i) => {
      if (i !== swapTargetIndex) return sel;
      return {
        ...sel,
        exercise: {
          exerciseId: String(newExercise.id ?? newExercise.exerciseId ?? ''),
          name: newExercise.name,
          gifUrl: newExercise.mediaFile || newExercise.gifUrl || '',
          targetMuscles: newExercise.targetMuscles || [newExercise.target || ''],
          bodyParts: newExercise.bodyParts || [newExercise.bodyPart || ''],
          equipments: newExercise.equipments || [newExercise.equipment || ''],
          secondaryMuscles: newExercise.secondaryMuscles || [],
          instructions: newExercise.instructions
            ? (Array.isArray(newExercise.instructions) ? newExercise.instructions : [newExercise.instructions])
            : [],
          id: String(newExercise.id ?? newExercise.exerciseId ?? ''),
          target: newExercise.target || newExercise.targetMuscles?.[0] || '',
          bodyPart: newExercise.bodyPart || newExercise.bodyParts?.[0] || '',
          equipment: newExercise.equipment || newExercise.equipments?.[0] || '',
        },
      };
    }));
    setSwapTargetIndex(null);
    toast({ title: 'Exercise swapped', description: newExercise.name });
  };

  // Fetch candidate replacements for the swap dialog. Filters by body
  // part + equipment of the exercise being swapped.
  const { data: swapCandidates = [], isLoading: swapCandidatesLoading } = useQuery<any[]>({
    queryKey: ['swap-candidates', swapBodyPart, swapEquipment],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (swapBodyPart) params.set('bodyPart', swapBodyPart);
      if (swapEquipment) params.set('equipment', swapEquipment);
      params.set('limit', '500');
      // Hide one half of any L/R pair so each pair surfaces as a single entry.
      params.set('dedupePairs', 'true');
      const res = await fetch(`/api/exercises?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch swap candidates');
      return res.json();
    },
    enabled: swapTargetIndex !== null,
    staleTime: 60_000,
  });

  // Partition candidates: favorites first (matched by exerciseId), then
  // the rest. Exclude the exercise currently in this slot.
  const currentSwapExercise = swapTargetIndex !== null ? selectedExercises[swapTargetIndex]?.exercise : null;
  const currentSwapId = currentSwapExercise
    ? String((currentSwapExercise as any).exerciseId ?? (currentSwapExercise as any).id ?? '')
    : '';
  const favoriteIdSet = new Set(
    (favoriteExercises as FavoriteExercise[]).map(f => String(f.exerciseId))
  );
  const filteredSwapCandidates = swapCandidates.filter(c => String(c.id) !== currentSwapId);
  const favoriteCandidates = filteredSwapCandidates.filter(c => favoriteIdSet.has(String(c.id)));
  const otherCandidates = filteredSwapCandidates.filter(c => !favoriteIdSet.has(String(c.id)));

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

  // Extract data from exercise response (API returns flat array)
  const exercises = Array.isArray(exerciseResponse) ? exerciseResponse : [];
  // If we got a full page, there may be more; hasMore enables the Next button
  const hasMoreExercises = exercises.length >= limit;
  const totalPages = currentPage + (hasMoreExercises ? 1 : 0);

  // Helper: get the stable exercise key (DB id preferred)
  const getExKey = (ex: any): string => String(ex.id ?? ex.exerciseId ?? ex.name ?? '');

  // Compute injury evaluations for current browser exercises
  const injuryEvalMap = useMemo(() => {
    if (!userInjuries.length) return new Map<string, ReturnType<typeof evaluateExerciseAgainstInjuries>>();
    const map = new Map<string, ReturnType<typeof evaluateExerciseAgainstInjuries>>();
    for (const ex of exercises) {
      const key = getExKey(ex);
      if (!key) continue;
      map.set(key, evaluateExerciseAgainstInjuries(
        {
          name: ex.name ?? '',
          bodyPart: ex.bodyPart || ex.bodyParts?.[0] || '',
          hiit: ex.hiit || 'No',
          stretching: ex.stretching || 'No',
          equipment: ex.equipment || ex.equipments?.[0] || '',
          level: ex.level || '',
        },
        userInjuries,
      ));
    }
    return map;
  }, [exercises, userInjuries]);

  // Compute injury evaluations for the currently-selected plan exercises
  // (plan exercise rows lack hiit/stretching; use name heuristics only)
  const selectedEvalMap = useMemo(() => {
    if (!userInjuries.length) return new Map<number, ReturnType<typeof evaluateExerciseAgainstInjuries>>();
    const map = new Map<number, ReturnType<typeof evaluateExerciseAgainstInjuries>>();
    selectedExercises.forEach((sel, idx) => {
      const ex = sel.exercise as any;
      map.set(idx, evaluateExerciseAgainstInjuries(
        {
          name: ex.name ?? '',
          bodyPart: ex.bodyPart || ex.bodyParts?.[0] || '',
          hiit: 'No',
          stretching: 'No',
          equipment: ex.equipment || ex.equipments?.[0] || '',
          level: '',
        },
        userInjuries,
      ));
    });
    return map;
  }, [selectedExercises, userInjuries]);

  // Get filter options (body-parts and equipment-types return string arrays)
  const uniqueBodyParts = (Array.isArray(bodyParts) ? bodyParts : []).map((bp: any) => typeof bp === 'string' ? bp : bp.name).filter(Boolean).sort();
  const uniqueEquipment = (Array.isArray(equipments) ? equipments : []).map((eq: any) => typeof eq === 'string' ? eq : eq.name).filter(Boolean).sort();
  const uniqueTargets = (Array.isArray(allMuscles) ? allMuscles : []).map((m: any) => typeof m === 'string' ? m : m.name).filter(Boolean).sort();

  // Reset to page 1 when filters change
  const handleFilterChange = (filterType: string, value: string) => {
    setCurrentPage(1);
    if (filterType === 'bodyPart') setSelectedBodyPart(value);
    if (filterType === 'equipment') setSelectedEquipment(value);
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
    <div className="min-h-screen bg-black pb-20">
      <div className="p-4 max-w-6xl mx-auto space-y-6">
        <BackButton fallbackPath="/fitness" />
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/fitness">
            <Button
              size="sm"
              data-testid="button-back"
              className="bg-ministry-gold hover:bg-ministry-gold/90 text-black"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Fitness
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-ministry-gold">Edit Fitness Plan</h1>
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
                  .map((selected) => {
                    const selEval = selectedEvalMap.get(selected.originalIndex);
                    return (
                  <div
                    key={selected.originalIndex}
                    className={`p-4 border rounded-lg ${
                      selEval?.status === 'blocked'
                        ? 'border-red-400 bg-red-50'
                        : selEval?.status === 'modify'
                        ? 'border-yellow-400 bg-yellow-50/50'
                        : 'border-black/20'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2 gap-2">
                      <div>
                        <h4 className="font-medium text-lg capitalize">
                          {selected.exercise.name.replace(/_/g, ' ')}
                        </h4>
                        {selEval && selEval.status !== 'allowed' && selEval.reasons.length > 0 && (
                          <div className="flex items-start gap-1 mt-1">
                            {selEval.status === 'blocked'
                              ? <span className="text-xs font-semibold bg-red-600 text-white px-1.5 py-0.5 rounded shrink-0">🔴 Blocked</span>
                              : <span className="text-xs font-semibold bg-yellow-500 text-black px-1.5 py-0.5 rounded shrink-0">🟡 Caution</span>
                            }
                            <span className="text-xs text-black/70 italic">{selEval.reasons[0]}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          onClick={() => handleOpenSwap(selected.originalIndex)}
                          className="bg-black hover:bg-zinc-800 text-ministry-gold border border-black"
                          data-testid={`button-swap-exercise-${selected.originalIndex}`}
                        >
                          <Repeat className="h-4 w-4 mr-1" />
                          Swap
                        </Button>
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
                    );
                  })
              )}
            </CardContent>
          </Card>

        {/* Workout Reminders */}
        <Card className="bg-ministry-gold text-black">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Workout Reminders
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {reminders.map((reminder, index) => (
              <div key={index} className="flex items-center gap-2 flex-wrap">
                <Select value={reminder.dayOfWeek} onValueChange={(v) => updateReminder(index, 'dayOfWeek', v)}>
                  <SelectTrigger className="flex-1 min-w-[130px] bg-black/20 text-black border-black/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(d => (
                      <SelectItem key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="time"
                  value={reminder.time}
                  onChange={(e) => updateReminder(index, 'time', e.target.value)}
                  className="w-32 bg-black/20 text-black border-black/30"
                />
                <button onClick={() => removeReminder(index)} className="text-black/60 hover:text-red-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={addReminder}
              className="w-full border-black/30 text-black hover:bg-black/10"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Reminder
            </Button>
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
                </div>
              </div>

              {/* Injury filter toggle (show only when user has injuries) */}
              {userInjuries.length > 0 && (
                <div className="flex items-center gap-2 pb-1">
                  <Switch
                    id="hide-conflicting-edit"
                    checked={hideConflicting}
                    onCheckedChange={setHideConflicting}
                    data-testid="toggle-hide-conflicting"
                  />
                  <label htmlFor="hide-conflicting-edit" className="text-sm font-medium text-black flex items-center gap-1 cursor-pointer">
                    <EyeOff className="h-4 w-4" />
                    Hide exercises that conflict with my injuries
                  </label>
                </div>
              )}

              {/* Exercise Results */}
              {isLoadingExercises ? (
                <div className="text-center py-8">Loading exercises...</div>
              ) : (
                <div className="space-y-4">
                  {exercises
                    .filter((exercise: any) => {
                      if (!hideConflicting || !userInjuries.length) return true;
                      const ev = injuryEvalMap.get(getExKey(exercise));
                      return ev?.status !== 'blocked';
                    })
                    .map((exercise: any) => {
                    const exId = getExKey(exercise);
                    const bodyPartsList: string[] = exercise.bodyParts || (exercise.bodyPart ? [exercise.bodyPart] : []);
                    const equipmentsList: string[] = exercise.equipments || (exercise.equipment ? [exercise.equipment] : []);
                    const mediaUrl = exercise.gifUrl || exercise.mediaFile || '';
                    const injuryEval = injuryEvalMap.get(exId);
                    const injStatus = injuryEval?.status;
                    return (
                    <div
                      key={exId}
                      className={`p-4 border rounded-lg flex items-start justify-between ${
                        injStatus === 'blocked'
                          ? 'border-red-400/60 opacity-80'
                          : injStatus === 'modify'
                          ? 'border-yellow-400/60'
                          : 'border-black/20'
                      }`}
                    >
                      <div className="flex items-start gap-4 flex-1">
                        {mediaUrl && (
                          /\.(mp4|webm|mov)(\?|$)/i.test(mediaUrl) ? (
                            <video
                              src={mediaUrl}
                              className="w-16 h-16 object-cover rounded"
                              muted
                              loop
                              autoPlay
                              playsInline
                            />
                          ) : (
                            <img
                              src={mediaUrl}
                              alt={exercise.name}
                              className="w-16 h-16 object-cover rounded"
                            />
                          )
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h4 className="font-medium capitalize">
                              {exercise.name.replace(/_/g, ' ')}
                            </h4>
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
                          </div>
                          {injuryEval && injStatus !== 'allowed' && injuryEval.reasons.length > 0 && (
                            <p className="text-xs text-black/70 italic mb-1">{injuryEval.reasons[0]}</p>
                          )}
                          <div className="flex flex-wrap gap-1 text-xs">
                            {bodyPartsList.map((part: string) => (
                              <Badge key={part} variant="secondary">{part}</Badge>
                            ))}
                            {equipmentsList.map((eq: string) => (
                              <Badge key={eq} variant="outline" className="bg-black text-white border-black">{eq}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-col items-end">
                        {isFavorite(exId) && (
                          <Badge className="bg-ministry-gold text-black">
                            <Heart className="w-3 h-3 mr-1 fill-current" />
                            Favorite
                          </Badge>
                        )}
                        <Button
                          size="sm"
                          onClick={() => handleAddExercise(exercise)}
                          className={injStatus === 'blocked' ? 'bg-red-700 hover:bg-red-800 text-white' : 'bg-ministry-gold hover:bg-ministry-gold/90 text-black'}
                          data-testid={`button-add-exercise-${exId}`}
                        >
                          {injStatus === 'blocked' ? <ShieldAlert className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                          {injStatus === 'blocked' ? 'Add (risk)' : 'Add'}
                        </Button>
                      </div>
                    </div>
                    );
                  })}

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

      {/* Swap Exercise Dialog */}
      <Dialog
        open={swapTargetIndex !== null}
        onOpenChange={(open) => { if (!open) setSwapTargetIndex(null); }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-ministry-charcoal border border-ministry-gold/30 text-white">
          <DialogHeader>
            <DialogTitle className="text-ministry-gold flex items-center gap-2">
              <Repeat className="w-5 h-5" />
              Swap Exercise
            </DialogTitle>
            <DialogDescription className="text-white/70">
              {currentSwapExercise && (
                <>
                  Replacing <span className="capitalize font-medium text-white">
                    {currentSwapExercise.name?.replace(/_/g, ' ')}
                  </span>
                  {(swapBodyPart || swapEquipment) && (
                    <span className="block mt-1 text-xs">
                      Showing exercises that target{' '}
                      <span className="capitalize font-medium">{swapBodyPart || 'any body part'}</span>
                      {' using '}
                      <span className="capitalize font-medium">{swapEquipment || 'any equipment'}</span>.
                    </span>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {swapCandidatesLoading ? (
            <div className="py-8 text-center text-white/70">Loading exercises...</div>
          ) : filteredSwapCandidates.length === 0 ? (
            <div className="py-8 text-center text-white/70">
              No other exercises match this body part and equipment.
            </div>
          ) : (
            <div className="space-y-4">
              {favoriteCandidates.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-ministry-gold uppercase tracking-wide mb-2 flex items-center gap-2">
                    <Heart className="w-4 h-4 fill-ministry-gold" />
                    Favorites ({favoriteCandidates.length})
                  </h3>
                  <div className="space-y-2">
                    {favoriteCandidates.map((ex) => (
                      <button
                        key={`fav-${ex.id}`}
                        onClick={() => handleSwapExercise(ex)}
                        className="w-full text-left p-3 rounded-lg border border-ministry-gold/40 bg-ministry-gold/10 hover:bg-ministry-gold/20 transition-colors flex items-center justify-between gap-3"
                        data-testid={`button-swap-candidate-${ex.id}`}
                      >
                        <div className="min-w-0">
                          <div className="font-medium capitalize truncate flex items-center gap-2">
                            <Heart className="w-3.5 h-3.5 fill-ministry-gold text-ministry-gold shrink-0" />
                            {ex.name}
                          </div>
                          <div className="text-xs text-white/60 capitalize mt-0.5">
                            {ex.bodyPart} · {ex.equipment} · {ex.level}
                          </div>
                        </div>
                        <Repeat className="w-4 h-4 text-ministry-gold shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {otherCandidates.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wide mb-2">
                    {favoriteCandidates.length > 0 ? 'Other Exercises' : 'Matching Exercises'} ({otherCandidates.length})
                  </h3>
                  <div className="space-y-2">
                    {otherCandidates.map((ex) => (
                      <button
                        key={ex.id}
                        onClick={() => handleSwapExercise(ex)}
                        className="w-full text-left p-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-between gap-3"
                        data-testid={`button-swap-candidate-${ex.id}`}
                      >
                        <div className="min-w-0">
                          <div className="font-medium capitalize truncate">{ex.name}</div>
                          <div className="text-xs text-white/60 capitalize mt-0.5">
                            {ex.bodyPart} · {ex.equipment} · {ex.level}
                          </div>
                        </div>
                        <Repeat className="w-4 h-4 text-white/60 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

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
                if (injuryDialogExercise) openExerciseConfig(injuryDialogExercise);
                setInjuryDialogExercise(null);
              }}
              className="flex-1"
            >
              I understand — Add anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}