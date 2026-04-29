import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth, type User as AuthUser } from "@/hooks/useAuth";
import { useTour } from "@/contexts/TourContext";
import { useFitnessTour } from "@/contexts/FitnessTourContext";
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
  AlertCircle,
  Utensils,
  Flame,
  PlusCircle,
  SlidersHorizontal,
  History,
  RotateCcw,
  Pause,
  ChevronLeft,
  FileText,
  Bell,
  Share2,
  MessageCircle,
  Copy,
  Check,
  Salad,
  Pencil,
  Moon,
  Scale,
  Footprints,
  AlertTriangle,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { format, isToday, isPast, isFuture } from "date-fns";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import { Link } from "wouter";
import seanMcManusPhoto from "@assets/531400631_10229732604879918_951068179454150284_n_1766855745199.jpeg";
import { PushConsentDialog } from "@/components/push-consent-dialog";
import InjuriesPanel from "@/components/InjuriesPanel";
import { evaluateExerciseAgainstInjuries, getInjuryRecommendations, getInjuryStretchPolicy } from "@shared/injuryFilter";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { HealthMetric, HealthMetricType, HealthGoal } from "@shared/schema";
import { ReactorList } from "@/components/reactor-list";

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

interface FitnessComment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  parentCommentId: string | null;
  createdAt: string;
  authorName?: string;
  authorProfilePicture?: string;
  user?: { firstName?: string; lastName?: string; profileImageUrl?: string };
}

interface FitnessPlanExercise {
  id: string;
  planId: string;
  exerciseId: string;
  exerciseName: string;
  // Image / media URL as stored in fitness_plan_exercises.image_url
  imageUrl?: string;
  // Legacy/aliased media field used by some pre-existing card renderers
  exerciseGifUrl?: string;
  // Aliases used in pre-existing UI markup
  exerciseTarget?: string;
  exerciseBodyPart?: string;
  exerciseEquipment?: string;
  // Real DB columns
  bodyPart?: string;
  targetMuscle?: string;
  equipment?: string;
  sets?: number;
  // Reps may be a number ("10"), range ("10-12"), or time-based ("30s")
  reps?: string | number;
  duration?: number;
  minutes?: number;
  weight?: string;
  restTime?: number;
  notes?: string;
  daysOfWeek?: string[];
  weekNumber?: number;
  orderIndex: number;
  // Copied from exercises.sidedness at plan-exercise insert time.
  // Drives the unilateral two-countdown-per-set logic in WorkoutPlayer.
  // Null/undefined on legacy rows → treated as 'bilateral'.
  sidedness?: 'bilateral' | 'unilateral' | 'alternating' | null;
  // Joined from exercises.tempo_sec — seconds per rep for the rep counter.
  tempoSec?: number | null;
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
  stretchPolicy?: string;
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
  weekNumber?: number;
  assignedDay?: string;
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

interface CommentAddArgs { postId: string; content: string }
interface CommentAddMutation { mutate: (args: CommentAddArgs) => void; isPending: boolean }
interface CommentDeleteMutation { mutate: (commentId: string) => void; isPending: boolean }

function CommentsSection({
  postId,
  authUser,
  addCommentMutation,
  deleteCommentMutation,
  commentText,
  setCommentText,
}: {
  postId: string;
  authUser: { id: string } | undefined;
  addCommentMutation: CommentAddMutation;
  deleteCommentMutation: CommentDeleteMutation;
  commentText: string;
  setCommentText: (t: string) => void;
}) {
  const { data: comments = [], isLoading, refetch } = useQuery<FitnessComment[]>({
    queryKey: ['/api/fitness/community/posts', postId, 'comments'],
    queryFn: async () => {
      const res = await fetch(`/api/fitness/community/posts/${postId}/comments`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load comments');
      return res.json();
    },
  });

  const myId = authUser?.id;

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // Reply state
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const editCommentMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const res = await apiRequest('PATCH', `/api/fitness/community/comments/${id}`, { content });
      return res.json();
    },
    onSuccess: () => {
      setEditingId(null);
      setEditText('');
      refetch();
    },
  });

  const replyMutation = useMutation({
    mutationFn: async ({ content, parentCommentId }: { content: string; parentCommentId: string }) => {
      const res = await apiRequest('POST', `/api/fitness/community/posts/${postId}/comments`, { content, parentCommentId });
      return res.json();
    },
    onSuccess: () => {
      setReplyToId(null);
      setReplyText('');
      refetch();
    },
  });

  // Build tree: top-level comments + their replies
  const topLevel = comments.filter((c: FitnessComment) => !c.parentCommentId);
  const repliesMap: Record<string, FitnessComment[]> = {};
  comments.filter((c: FitnessComment) => c.parentCommentId).forEach((c: FitnessComment) => {
    if (!repliesMap[c.parentCommentId!]) repliesMap[c.parentCommentId!] = [];
    repliesMap[c.parentCommentId!].push(c);
  });

  const renderComment = (c: FitnessComment, isReply = false) => (
    <div key={c.id} className={`flex items-start gap-2 ${isReply ? 'ml-8 mt-1' : ''}`}>
      {c.authorProfilePicture ? (
        <img src={c.authorProfilePicture} alt="" className="w-6 h-6 rounded-full object-cover border border-zinc-700 flex-shrink-0" />
      ) : (
        <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
          <User className="w-3 h-3 text-zinc-500" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1 flex-wrap">
          <span className="text-white text-xs font-black">{c.authorName}</span>
          <span className="text-zinc-600 text-[10px]">{new Date(c.createdAt).toLocaleDateString()}</span>
        </div>
        {editingId === c.id ? (
          <div className="flex gap-1 mt-1">
            <input
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              autoFocus
              className="flex-1 bg-zinc-800 border border-zinc-600 rounded-sm text-white text-xs px-2 py-1 focus:outline-none"
            />
            <button
              onClick={() => editCommentMutation.mutate({ id: c.id, content: editText })}
              disabled={!editText.trim() || editCommentMutation.isPending}
              className="text-[#FDD000] text-xs font-black disabled:opacity-50"
            >Save</button>
            <button onClick={() => setEditingId(null)} className="text-zinc-500 text-xs">Cancel</button>
          </div>
        ) : (
          <p className="text-zinc-300 text-xs break-words">{c.content}</p>
        )}
        {!isReply && editingId !== c.id && (
          <button
            onClick={() => { setReplyToId(replyToId === c.id ? null : c.id); setReplyText(''); }}
            className="text-zinc-500 hover:text-zinc-300 text-[10px] mt-0.5"
          >
            Reply
          </button>
        )}
      </div>
      {c.userId === myId && editingId !== c.id && (
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={() => { setEditingId(c.id); setEditText(c.content); }}
            className="text-zinc-600 hover:text-zinc-300"
            title="Edit"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onClick={() => deleteCommentMutation.mutate(c.id)}
            className="text-zinc-600 hover:text-red-400"
            title="Delete"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="border-t border-zinc-700 bg-zinc-950 px-4 py-3 space-y-3">
      {isLoading ? (
        <p className="text-zinc-500 text-xs">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="text-zinc-500 text-xs">No comments yet. Be the first!</p>
      ) : (
        <div className="space-y-2">
          {topLevel.map((c: FitnessComment) => (
            <div key={c.id}>
              {renderComment(c)}
              {/* Replies */}
              {(repliesMap[c.id] || []).map((r: FitnessComment) => renderComment(r, true))}
              {/* Reply input */}
              {replyToId === c.id && (
                <div className="flex gap-1 ml-8 mt-1">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && replyText.trim()) {
                        replyMutation.mutate({ content: replyText.trim(), parentCommentId: c.id });
                      }
                    }}
                    placeholder={`Reply to ${c.authorName}…`}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-sm text-white text-xs px-2 py-1 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
                  />
                  <button
                    onClick={() => replyMutation.mutate({ content: replyText.trim(), parentCommentId: c.id })}
                    disabled={!replyText.trim() || replyMutation.isPending}
                    className="bg-[#FDD000] text-black font-black text-xs px-2 py-1 rounded-sm disabled:opacity-50"
                  >
                    <Send className="w-3 h-3" />
                  </button>
                  <button onClick={() => setReplyToId(null)} className="text-zinc-500 text-xs px-1">✕</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {/* Add top-level comment input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && commentText.trim()) {
              addCommentMutation.mutate({ postId, content: commentText.trim() });
            }
          }}
          placeholder="Write a comment…"
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-sm text-white text-xs px-3 py-1.5 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
        />
        <button
          onClick={() => {
            if (commentText.trim()) {
              addCommentMutation.mutate({ postId, content: commentText.trim() });
            }
          }}
          disabled={!commentText.trim() || addCommentMutation.isPending}
          className="bg-[#FDD000] text-black font-black text-xs px-3 py-1.5 rounded-sm disabled:opacity-50"
        >
          <Send className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
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
  
  // System settings — admin can hide the Fitness Coach button or put the
  // whole page into maintenance mode (admins still see the page normally).
  const { data: systemSettings } = useQuery<{
    fitnessCoachHidden?: boolean;
    fitnessMaintenanceMode?: boolean;
  }>({ queryKey: ['/api/system-settings'] });
  const fitnessCoachHidden = !!systemSettings?.fitnessCoachHidden;
  const fitnessMaintenanceMode = !!systemSettings?.fitnessMaintenanceMode;

  // Fitness Pillar dialog state
  const [showFitnessPillarDialog, setShowFitnessPillarDialog] = useState(false);
  
  // Fitness Coach dialog state
  const [showFitnessCoachDialog, setShowFitnessCoachDialog] = useState(false);
  
  // Exercise completion tracking
  const [completedExercises, setCompletedExercises] = useState<Set<string>>(new Set());
  // Guided workout player state
  const [playerOpen, setPlayerOpen] = useState(false);
  const [playerPlan, setPlayerPlan] = useState<FitnessPlan | null>(null);
  const [playerExercises, setPlayerExercises] = useState<FitnessPlanExercise[]>([]);
  // Plan-detail dialog (today's exercises preview)
  const [detailPlan, setDetailPlan] = useState<FitnessPlan | null>(null);
  const [detailExercises, setDetailExercises] = useState<FitnessPlanExercise[]>([]);
  // Server-evaluated injury map for the plan-detail dialog; keyed by exerciseId
  const [detailInjEvalMap, setDetailInjEvalMap] = useState<Record<string, any>>({});

  // Exercise media preview dialog (Preview button on each ExerciseCard)
  const [previewExercise, setPreviewExercise] = useState<Exercise | null>(null);

  // Manual override / fine-tune dialog state. The sliders work in
  // deltas (rest ±5s, intensity ±2 reps, volume ±1 set) and are sent
  // to /manual-override which applies them immediately. The history
  // dialog reads /adjustment-history.
  const [tunePlan, setTunePlan] = useState<FitnessPlan | null>(null);
  const [restDelta, setRestDelta] = useState(0);
  const [repsDelta, setRepsDelta] = useState(0);
  const [setsDelta, setSetsDelta] = useState(0);
  const [tuneSubmitting, setTuneSubmitting] = useState(false);
  const [historyPlan, setHistoryPlan] = useState<FitnessPlan | null>(null);
  const [historyRows, setHistoryRows] = useState<Array<{
    id: string;
    appliedAt: string;
    source: 'manual' | 'automatic';
    leverId: number;
    direction: string;
    field: string;
    exerciseName: string | null;
    before: string | null;
    after: string | null;
    rolledBackAt: string | null;
    rollbackReason: string | null;
  }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  // Pre-built Plans state
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [selectedWorkoutStyle, setSelectedWorkoutStyle] = useState<string>('');
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
  const [location, setLocation] = useLocation();
  const initialTab = (() => {
    if (typeof window === 'undefined') return 'workout';
    const params = new URLSearchParams(window.location.search);
    const t = params.get('tab');
    return t && ['workout', 'community', 'planner', 'intake', 'nutrition', 'exercises', 'favorites', 'pre-built-plans', 'my-plans', 'health'].includes(t) ? t : 'workout';
  })();
  const [activeFitnessTab, setActiveFitnessTab] = useState<string>(initialTab);
  const [purchasingPlanId, setPurchasingPlanId] = useState<string | null>(null);
  const { user: authUser } = useAuth();
  const { isTourActive } = useTour();
  const {
    isFitnessTourActive,
    targetTab: fitnessTourTargetTab,
    startFitnessTour,
  } = useFitnessTour();
  const { isSubscribed: isPushSubscribed } = usePushNotifications();

  // Sync the active tab to whatever step the fitness tour is currently on
  useEffect(() => {
    if (isFitnessTourActive && fitnessTourTargetTab && fitnessTourTargetTab !== activeFitnessTab) {
      setActiveFitnessTab(fitnessTourTargetTab);
    }
  }, [isFitnessTourActive, fitnessTourTargetTab]);

  // Auto-start the fitness tour the first time a paid fitness member lands on this page.
  // Skips non-fitness members entirely (they see the upsell, not the tour) and skips
  // anyone who's already taken it. Also defers when the app-wide onboarding tour is
  // running so the two overlays never collide.
  const hasLaunchedFitnessTourRef = useRef(false);
  useEffect(() => {
    if (
      authUser &&
      authUser.hasFitnessAccess === true &&
      authUser.hasCompletedFitnessTour === false &&
      !isFitnessTourActive &&
      !isTourActive &&
      !hasLaunchedFitnessTourRef.current
    ) {
      hasLaunchedFitnessTourRef.current = true;
      const t = setTimeout(() => startFitnessTour(), 600);
      return () => clearTimeout(t);
    }
  }, [authUser, isFitnessTourActive, isTourActive, startFitnessTour]);

  // Community tab state
  const [communityPostText, setCommunityPostText] = useState('');
  const [communityCategory, setCommunityCategory] = useState('encouragement');
  const [communityMedia, setCommunityMedia] = useState<{ url: string; type: string }[]>([]);
  const [communityUploading, setCommunityUploading] = useState(false);

  // Nutrition tab state
  const [nutritionInputQuery, setNutritionInputQuery] = useState('');
  const [nutritionSubmittedQuery, setNutritionSubmittedQuery] = useState('');
  const [selectedFdcId, setSelectedFdcId] = useState<number | null>(null);

  // Intake tab state
  const [intakePeriod, setIntakePeriod] = useState<'day' | 'week' | 'month'>('day');
  const [showAddIntakeDialog, setShowAddIntakeDialog] = useState(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('openAddFood') === 'true';
  });
  const [addIntakePrefill, setAddIntakePrefill] = useState<{ foodName: string; caloriesPerServing: number } | null>(null);
  const [intakeForm, setIntakeForm] = useState({ foodName: '', caloriesPerServing: '', servings: '1', meal: 'breakfast' as const });
  const [intakeFormMeal, setIntakeFormMeal] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('breakfast');

  // Meal reminders state
  const [showMealReminderForm, setShowMealReminderForm] = useState(false);
  const [newMealTime, setNewMealTime] = useState('08:00');
  const [newMealLabel, setNewMealLabel] = useState('');
  const [newMealType, setNewMealType] = useState('breakfast');
  const [showMealPushConsent, setShowMealPushConsent] = useState(false);
  const [pendingMealReminder, setPendingMealReminder] = useState<{ time: string; label: string; mealType: string } | null>(null);

  // Health metrics state
  const [healthOpenForm, setHealthOpenForm] = useState<'steps' | 'heart_rate' | 'sleep' | 'weight' | null>(null);
  const [healthStepsForm, setHealthStepsForm] = useState({ date: new Date().toISOString().split('T')[0], steps: '', calories: '' });
  const [healthHrForm, setHealthHrForm] = useState({ date: new Date().toISOString().split('T')[0], resting: '', active: '' });
  const [healthSleepForm, setHealthSleepForm] = useState({ date: new Date().toISOString().split('T')[0], hours: '', quality: '' });
  const [healthWeightForm, setHealthWeightForm] = useState({ date: new Date().toISOString().split('T')[0], weight: '', bodyFat: '', chest: '', waist: '', hips: '', neck: '' });
  const [healthGoalFormOpen, setHealthGoalFormOpen] = useState<'steps' | 'heart_rate' | 'sleep' | 'weight' | null>(null);
  const [healthGoalInputs, setHealthGoalInputs] = useState({ steps: '', heart_rate: '', sleep: '', weight: '' });
  const [stepsRange, setStepsRange] = useState<7 | 30 | 90>(7);
  const [hrRange, setHrRange] = useState<7 | 30 | 90>(7);
  const [sleepRange, setSleepRange] = useState<7 | 30 | 90>(7);
  const [weightRange, setWeightRange] = useState<7 | 30 | 90>(7);
  const [workoutHistoryDays, setWorkoutHistoryDays] = useState<7 | 30 | 90>(30);

  // Community comments state
  const [expandedCommentPost, setExpandedCommentPost] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null);

  // Check fitness membership status
  const { data: membershipData, isLoading: membershipLoading } = useQuery<{ hasMembership: boolean; membership?: any }>({
    queryKey: ['/api/fitness/membership'],
    retry: false,
  });

  // Fitness is now free for all authenticated users.
  // The membership data is still queried so existing subscribers
  // can manage / cancel their old Stripe subscription, but access
  // is no longer gated on it.
  const hasMembership = true;

  // Fetch user injuries for exercise conflict badges
  const { data: fitnessPageInjuries = [] } = useQuery<any[]>({
    queryKey: ['/api/user/injuries'],
    staleTime: 60000,
  });

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

  const ohMeMutation = useMutation({
    mutationFn: async (postId: string) => {
      return await apiRequest('POST', `/api/fitness/community/posts/${postId}/ohme`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fitness/community/posts'] });
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      return await apiRequest('POST', `/api/fitness/community/posts/${postId}/comments`, { content });
    },
    onSuccess: (_data, { postId }) => {
      setCommentText('');
      queryClient.invalidateQueries({ queryKey: ['/api/fitness/community/posts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fitness/community/posts', postId, 'comments'] });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message || 'Failed to comment', variant: 'destructive' });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      return await apiRequest('DELETE', `/api/fitness/community/comments/${commentId}`);
    },
    onSuccess: (_data, commentId, context) => {
      queryClient.invalidateQueries({ queryKey: ['/api/fitness/community/posts'] });
      if (expandedCommentPost) {
        queryClient.invalidateQueries({ queryKey: ['/api/fitness/community/posts', expandedCommentPost, 'comments'] });
      }
    },
  });

  // Meal reminder mutations
  const { data: mealReminders = [] } = useQuery<any[]>({
    queryKey: ['/api/meal-reminders'],
    enabled: hasMembership,
  });

  const addMealReminderMutation = useMutation({
    mutationFn: async (data: { time: string; label: string; mealType: string }) => {
      return await apiRequest('POST', '/api/meal-reminders', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meal-reminders'] });
      setShowMealReminderForm(false);
      setNewMealTime('08:00');
      setNewMealLabel('');
      setNewMealType('breakfast');
      toast({ title: 'Meal Reminder Added', description: 'You will be notified at the scheduled time.' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message || 'Failed to add reminder', variant: 'destructive' });
    },
  });

  const deleteMealReminderMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/meal-reminders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meal-reminders'] });
    },
  });

  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [editMealTime, setEditMealTime] = useState('');
  const [editMealLabel, setEditMealLabel] = useState('');
  const [editMealType, setEditMealType] = useState('breakfast');

  const updateMealReminderMutation = useMutation({
    mutationFn: async ({ id, time, label, mealType }: { id: string; time: string; label: string; mealType: string }) => {
      return await apiRequest('PATCH', `/api/meal-reminders/${id}`, { time, label, mealType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meal-reminders'] });
      setEditingMealId(null);
      toast({ title: 'Reminder updated' });
    },
  });

  // Health metrics queries
  const { data: stepsMetrics = [] } = useQuery<HealthMetric[]>({
    queryKey: [`/api/health-metrics?type=steps&limit=${stepsRange}`],
    enabled: hasMembership,
  });
  const { data: hrMetrics = [] } = useQuery<HealthMetric[]>({
    queryKey: [`/api/health-metrics?type=heart_rate&limit=${hrRange}`],
    enabled: hasMembership,
  });
  const { data: sleepMetrics = [] } = useQuery<HealthMetric[]>({
    queryKey: [`/api/health-metrics?type=sleep&limit=${sleepRange}`],
    enabled: hasMembership,
  });
  const { data: weightMetrics = [] } = useQuery<HealthMetric[]>({
    queryKey: [`/api/health-metrics?type=weight&limit=${weightRange}`],
    enabled: hasMembership,
  });

  // Health goals query
  const { data: healthGoalsData = [] } = useQuery<HealthGoal[]>({
    queryKey: ['/api/health-goals'],
    enabled: hasMembership,
  });

  // Workout session history
  type WorkoutSession = { id: string; planId: string; planName: string; workoutType: string; feeling: 'too_hard' | 'just_right' | 'too_easy'; completionPct: number; createdAt: string };
  const { data: workoutHistoryData } = useQuery<{ sessions: WorkoutSession[] }>({
    queryKey: ['/api/workout-history'],
    enabled: hasMembership,
  });
  const allWorkoutSessions = workoutHistoryData?.sessions ?? [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - workoutHistoryDays);
  const workoutSessions = allWorkoutSessions.filter(s => new Date(s.createdAt) >= cutoff);

  const getHealthGoal = (metricType: string) =>
    healthGoalsData.find(g => g.metricType === metricType);

  const getWeeklyHits = (metrics: HealthMetric[], condition: (m: HealthMetric) => boolean) => {
    const today = new Date();
    const window7 = new Set<string>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      window7.add(d.toISOString().split('T')[0]);
    }
    const byDate = new Map<string, HealthMetric>();
    metrics.forEach(m => { if (!byDate.has(m.date)) byDate.set(m.date, m); });
    let hits = 0;
    byDate.forEach((m, date) => { if (window7.has(date) && condition(m)) hits++; });
    return { hits, total: 7 };
  };

  const upsertHealthGoalMutation = useMutation({
    mutationFn: async ({ type, targetValue }: { type: string; targetValue: number }) =>
      apiRequest('PUT', `/api/health-goals/${type}`, { targetValue }),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['/api/health-goals'] });
      setHealthGoalFormOpen(null);
      setHealthGoalInputs(prev => ({ ...prev, [vars.type]: '' }));
      toast({ title: 'Goal saved', description: 'Your health goal has been updated.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message || 'Failed to save goal', variant: 'destructive' });
    },
  });

  type CreateHealthPayload = {
    metricType: HealthMetricType;
    date: string;
    primaryValue: number;
    secondaryValue?: number | null;
    notes?: string | null;
  };

  const createHealthMetricMutation = useMutation({
    mutationFn: async (data: CreateHealthPayload) => apiRequest('POST', '/api/health-metrics', data),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).startsWith(`/api/health-metrics?type=${vars.metricType}`) });
      setHealthOpenForm(null);
      toast({ title: 'Entry logged', description: 'Your health metric has been saved.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message || 'Failed to save', variant: 'destructive' });
    },
  });

  const deleteHealthMetricMutation = useMutation({
    mutationFn: async ({ id }: { id: string; metricType: string }) =>
      apiRequest('DELETE', `/api/health-metrics/${id}`),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).startsWith(`/api/health-metrics?type=${vars.metricType}`) });
    },
    onError: (err: Error) => {
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
    if (selectedLevel && selectedWorkoutStyle && selectedPlanEquipment.length > 0 && selectedStartDay && selectedWorkoutDuration && selectedFrequency && selectedDays.length > 0) {
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
        selectedDays,
        selectedWorkoutStyle
      )
        .then(plans => {
          if (plans.length === 0) {
            console.error('[Plan generation failed] Inputs:', {
              level: selectedLevel,
              equipment: selectedPlanEquipment,
              startDay: selectedStartDay,
              duration: selectedWorkoutDuration,
              frequency: selectedFrequency,
              days: selectedDays,
              workoutStyle: selectedWorkoutStyle,
            });
            setPlanGenerationError(`Unable to generate plans for ${selectedPlanEquipment.join(', ')} at ${selectedLevel || '(no level selected)'} level. Try a different equipment + level combination, or include "Bodyweight".`);
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
  }, [selectedLevel, selectedWorkoutStyle, selectedPlanEquipment, selectedStartDay, selectedWorkoutDuration, selectedFrequency, selectedDays]);

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

  // Helper function to determine current week based on plan start date.
  // Cycles 1→4 every 4 weeks so the program repeats indefinitely.
  const getCurrentWeek = (plan: FitnessPlan, exercises: FitnessPlanExercise[]): number => {
    if (!plan || !exercises || exercises.length === 0) return 1;
    
    const planStartDate = new Date(plan.createdAt);
    const now = new Date();
    const daysSinceStart = Math.floor((now.getTime() - planStartDate.getTime()) / (1000 * 60 * 60 * 24));
    const weeksSinceStart = Math.max(0, Math.floor(daysSinceStart / 7));
    return (weeksSinceStart % 4) + 1;
  };

  // Get today's exercises from a plan (filtered by current week and current day).
  // Uses the explicit weekNumber column when present; falls back to the legacy
  // index-based estimation for older plans.
  //
  // Additionally drops any exercise that the injury engine evaluates as
  // `blocked` for the user's recorded injuries — this covers both
  // body-area conflicts (e.g., knee strain blocking deep squats) and
  // week-gated rules (e.g., area stretches blocked until recovery
  // week 6). Caution / modify exercises stay in the list and surface
  // their warning badges + the pre-workout acknowledgement gate.
  const getTodaysExercises = (plan: FitnessPlan) => {
    const today = getCurrentDayOfWeek();
    if (!plan.exercises) return [];
    
    const currentWeek = getCurrentWeek(plan, plan.exercises);
    const sortedAllExercises = (plan.exercises || []).slice().sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
    
    // Detect whether this plan has explicit weekNumber metadata.
    // weekNumber defaults to 1 in DB, so treat presence of any value > 1
    // (or any non-null assignment) as evidence of week metadata.
    const hasWeekMeta = sortedAllExercises.some(e => e.weekNumber != null && e.weekNumber > 1);
    
    let candidate: FitnessPlanExercise[];
    if (hasWeekMeta) {
      candidate = sortedAllExercises.filter(e => (e.weekNumber ?? 1) === currentWeek);
    } else {
      candidate = sortedAllExercises.filter((exercise, index) =>
        getExerciseWeek(sortedAllExercises, index) === currentWeek
      );
    }
    
    const todaysExercises = candidate.filter((exercise, index) => {
      if (exercise.daysOfWeek && exercise.daysOfWeek.length > 0) {
        return exercise.daysOfWeek.includes(today);
      }
      const exerciseDay = getExerciseDay(candidate, index);
      return exerciseDay === today;
    });

    // Drop blocked exercises (including week-gated ones) when the user
    // has recorded injuries. We never want a plan to silently load a
    // move the rule pack flags as harmful for today's state.
    if (fitnessPageInjuries.length > 0) {
      return todaysExercises.filter((ex) => {
        const ev = evaluateExerciseAgainstInjuries(
          {
            name: ex.exerciseName ?? '',
            bodyPart: ex.bodyPart ?? '',
            hiit: 'No',
            stretching: 'No',
            equipment: ex.equipment ?? '',
            level: '',
          },
          fitnessPageInjuries,
        );
        return ev.status !== 'blocked';
      });
    }

    return todaysExercises;
  };

  // Group today's workouts by plan (one card per plan that has exercises today)
  const getTodaysWorkoutsByPlan = (): Array<{ plan: FitnessPlan; exercises: FitnessPlanExercise[] }> => {
    if (!fitnessPlans) return [];
    const result: Array<{ plan: FitnessPlan; exercises: FitnessPlanExercise[] }> = [];
    fitnessPlans.forEach((plan: FitnessPlan) => {
      const todays = getTodaysExercises(plan);
      if (todays.length > 0) {
        result.push({ plan, exercises: todays });
      }
    });
    return result;
  };

  // Get all today's exercises from all user plans (deduplicated) — kept for
  // any callers still using the flat list view (progress summary, etc.)
  const getAllTodaysExercises = () => {
    if (!fitnessPlans) return [];
    
    const allExercises: Array<FitnessPlanExercise & { planName: string }> = [];
    const seenExerciseIds = new Set<string>();
    
    fitnessPlans.forEach((plan: FitnessPlan) => {
      const todaysExercises = getTodaysExercises(plan);
      todaysExercises.forEach(exercise => {
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
      // Collapse left/right pair rows so users only see one unilateral entry per pair.
      params.set('dedupePairs', 'true');

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

  // Auto-default equipment to Bodyweight when Stretching style is selected
  useEffect(() => {
    if (selectedWorkoutStyle === 'stretching' && (equipments as string[]).length > 0) {
      const bw = (equipments as string[]).find((e: string) => e.toLowerCase() === 'bodyweight');
      if (bw && !(selectedPlanEquipment.length === 1 && selectedPlanEquipment[0] === bw)) {
        setSelectedPlanEquipment([bw]);
      }
    }
  }, [selectedWorkoutStyle]);

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

  // Deep-link: open specific plan when ?planId=<id> is present in the URL
  useEffect(() => {
    if (fitnessPlans.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const deepPlanId = params.get('planId');
    if (!deepPlanId) return;
    const plan = (fitnessPlans as FitnessPlan[]).find((p) => p.id === deepPlanId);
    if (plan) {
      setActiveFitnessTab('my-plans');
      setSelectedPlanForView(plan);
      setShowPlanModal(true);
      // Remove planId from URL so navigating back doesn't re-open
      const newParams = new URLSearchParams(window.location.search);
      newParams.delete('planId');
      const newSearch = newParams.toString();
      window.history.replaceState({}, '', newSearch ? `${window.location.pathname}?${newSearch}` : window.location.pathname);
    }
  }, [fitnessPlans]);

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

  // ─── Intake: compute date range for selected period ───────────────────────
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmtDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const getCurrentMonday = () => {
    const today = new Date();
    const dow = today.getDay(); // 0=Sun
    const mon = new Date(today);
    mon.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
    mon.setHours(0, 0, 0, 0);
    return mon;
  };

  const getIntakeDateRange = () => {
    const today = new Date();
    const todayStr = fmtDate(today);
    if (intakePeriod === 'day') return { start: todayStr, end: todayStr };
    const mon = getCurrentMonday();
    if (intakePeriod === 'week') {
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      return { start: fmtDate(mon), end: fmtDate(sun) };
    }
    // month = 4 full weeks: Mon-28days ago through current Sunday
    const start = new Date(mon); start.setDate(mon.getDate() - 21);
    const end   = new Date(mon); end.setDate(mon.getDate() + 6);
    return { start: fmtDate(start), end: fmtDate(end) };
  };

  // Precompute Mon–Sun dates for the current week
  const currentWeekDays = (() => {
    const mon = getCurrentMonday();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      return d;
    });
  })();

  // 4 week boundaries for the month view (newest first)
  const fourWeeks = (() => {
    const mon = getCurrentMonday();
    return Array.from({ length: 4 }, (_, i) => {
      const weekMon = new Date(mon); weekMon.setDate(mon.getDate() - i * 7);
      const weekSun = new Date(weekMon); weekSun.setDate(weekMon.getDate() + 6);
      return { mon: weekMon, sun: weekSun };
    });
  })();

  const { data: intakeEntries = [], isLoading: intakeLoading } = useQuery<any[]>({
    queryKey: ['/api/intake', intakePeriod],
    queryFn: async () => {
      const { start, end } = getIntakeDateRange();
      const res = await fetch(`/api/intake?start=${start}&end=${end}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load intake');
      return res.json();
    },
    enabled: hasMembership,
  });

  const addIntakeMutation = useMutation({
    mutationFn: async (data: { date: string; meal: string; foodName: string; caloriesPerServing: number; servings: number }) => {
      return await apiRequest('POST', '/api/intake', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/intake'] });
      setShowAddIntakeDialog(false);
      setAddIntakePrefill(null);
      setIntakeForm({ foodName: '', caloriesPerServing: '', servings: '1', meal: 'breakfast' });
      setIntakeFormMeal('breakfast');
      toast({ title: 'Added to intake!', description: 'Food entry saved.' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message || 'Failed to add entry', variant: 'destructive' });
    },
  });

  const deleteIntakeMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/intake/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/intake'] });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message || 'Failed to delete', variant: 'destructive' });
    },
  });

  const { data: nutritionProfile } = useQuery<any>({
    queryKey: ['/api/nutrition-profile'],
    enabled: hasMembership,
  });

  const totalIntakeCalories = intakeEntries.reduce((sum: number, e: any) => sum + (e.totalCalories || 0), 0);

  const intakeByMeal: Record<string, any[]> = {};
  for (const entry of intakeEntries) {
    if (!intakeByMeal[entry.meal]) intakeByMeal[entry.meal] = [];
    intakeByMeal[entry.meal].push(entry);
  }
  const mealOrder = ['breakfast', 'lunch', 'dinner', 'snack'];

  // Per-date totals (for week view)
  const intakeByDate: Record<string, number> = {};
  for (const entry of intakeEntries) {
    intakeByDate[entry.date] = (intakeByDate[entry.date] || 0) + (entry.totalCalories || 0);
  }

  // Per-week totals (for month/4-week view)
  const weekTotals = fourWeeks.map(({ mon, sun }) => {
    const monStr = fmtDate(mon);
    const sunStr = fmtDate(sun);
    const total = intakeEntries
      .filter((e: any) => e.date >= monStr && e.date <= sunStr)
      .reduce((s: number, e: any) => s + (e.totalCalories || 0), 0);
    return { mon, sun, total };
  });

  const handleOpenAddIntake = (prefill?: { foodName: string; caloriesPerServing: number }) => {
    setAddIntakePrefill(prefill || null);
    setIntakeForm({
      foodName: prefill?.foodName || '',
      caloriesPerServing: prefill ? String(Math.round(prefill.caloriesPerServing)) : '',
      servings: '1',
      meal: 'breakfast',
    });
    setIntakeFormMeal('breakfast');
    setShowAddIntakeDialog(true);
  };

  const handleSubmitIntake = () => {
    const todayStr = (() => {
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    })();
    const cal = parseInt(addIntakePrefill ? String(Math.round(addIntakePrefill.caloriesPerServing)) : intakeForm.caloriesPerServing);
    const srv = parseFloat(intakeForm.servings);
    if (!intakeForm.foodName.trim()) return toast({ title: 'Missing info', description: 'Please enter a food name', variant: 'destructive' });
    if (isNaN(cal) || cal < 0) return toast({ title: 'Invalid calories', description: 'Enter a valid calorie count', variant: 'destructive' });
    if (isNaN(srv) || srv <= 0) return toast({ title: 'Invalid servings', description: 'Enter a valid serving count', variant: 'destructive' });
    addIntakeMutation.mutate({
      date: todayStr,
      meal: intakeFormMeal,
      foodName: intakeForm.foodName.trim(),
      caloriesPerServing: cal,
      servings: srv,
    });
  };

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
        // Coerce to string — DB exercises return `id` as a number, but the
        // favorite-exercises schema requires exerciseId as a string.
        exerciseId: String(exercise.exerciseId ?? exercise.id ?? ''),
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
    <div className={`${isToday ? 'bg-[#FDD000] text-black' : 'liquid-black'} rounded-sm border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all`}>
      <div className="p-6">
        <div className="flex items-start space-x-4 relative z-10">
          <div className="flex-shrink-0">
            <div className={`w-16 h-16 rounded-sm flex items-center justify-center border-2 border-black ${
              isToday ? 'liquid-black' : 'bg-[#FDD000] text-black'
            }`}>
              {isToday ? (
                <Star className="w-8 h-8 fill-current text-[#FDD000] relative z-10" />
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
                    <Badge className="ml-2 bg-black text-[#FDD000] font-bold rounded-sm border-none">
                      Today's Challenge
                    </Badge>
                  )}
                </h3>
                <div className={`flex items-center flex-wrap gap-2 text-sm mb-2 ${isToday ? 'text-black' : 'text-white'}`}>
                  <Badge className="text-xs capitalize bg-black text-[#FDD000] border-none rounded-sm font-bold">
                    {challenge.category}
                  </Badge>
                  <Badge className="text-xs capitalize bg-[#FDD000] text-black border-none rounded-sm font-bold">
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
                className="liquid-black px-4 py-2 rounded-sm border-2 border-black shadow-[3px_3px_0px_0px_rgba(253,208,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(253,208,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all text-white font-bold uppercase text-sm flex items-center"
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
    <div className="bg-[#FDD000] text-black rounded-sm border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all p-4">
      <div className="relative z-10">
        <div className="flex items-start">
          <div className="flex-1">
            <h3 className="font-black text-lg mb-2 text-black capitalize uppercase">
              {exercise.name.replace(/_/g, ' ')}
            </h3>
            
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge className="text-xs capitalize bg-black text-[#FDD000] border-none rounded-sm font-bold">
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
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPreviewExercise(exercise); }}
                className="bg-transparent text-black px-3 py-1.5 rounded-sm border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-black hover:text-[#FDD000] font-bold uppercase text-sm flex items-center transition-all"
                data-testid={`button-preview-${exercise.exerciseId || exercise.id || ''}`}
              >
                <Play className="w-4 h-4 mr-1" />
                Preview
              </button>

              <button
                onClick={() => handleToggleFavorite(exercise)}
                className={showRemove 
                  ? 'bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-sm border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold uppercase text-sm flex items-center' 
                  : `${isFavorite(exercise.exerciseId || exercise.id || '') 
                    ? 'liquid-black text-[#FDD000] px-3 py-1.5 rounded-sm border-2 border-black shadow-[2px_2px_0px_0px_rgba(253,208,0,1)] font-bold uppercase text-sm flex items-center' 
                    : 'bg-transparent text-black px-3 py-1.5 rounded-sm border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-black hover:text-[#FDD000] font-bold uppercase text-sm flex items-center transition-all'
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
    workoutDays: string[],
    workoutStyle: string = 'standard-no-cardio'
  ): Promise<PreBuiltPlan[]> => {
    try {
      console.log('Generating plans with params:', { level, equipmentList, startDay, duration, frequency, workoutDays, workoutStyle });
      
      // === Spec equipment-filtering rules ===
      // 1) Query exercises WHERE equipment IN (user_selected) at the
      //    user's exact level.
      // 2) ALWAYS include Bodyweight exercises regardless of selection.
      // 3) If the resulting pool < 10, expand to the adjacent level up
      //    (e.g. Beginner → also pull Intermediate). Then re-include
      //    Bodyweight at the expanded level.
      // 4) If still < 6, surface a toast warning to the user.
      // (Per-style filtering — HIIT=Yes / Stretching=Yes — is applied
      // downstream where the workPool is built, so the broader fetched
      // set still seeds warm-ups, cooldowns, and main movements.)
      const NEXT_LEVEL_UP: Record<string, string | undefined> = {
        Beginner: 'Intermediate',
        Intermediate: 'Advanced',
        Advanced: undefined,
        Tabata: undefined,
      };
      const bodyweightEquipment = ['Bodyweight', 'bodyweight'];
      const userSelectedBodyweight = equipmentList.some(eq => eq.toLowerCase() === 'bodyweight');

      const fetchPool = async (levels: string[]): Promise<APIExercise[]> => {
        const main = await getExercisesForEquipment(equipmentList, level, levels);
        if (userSelectedBodyweight) return main;
        // Spec rule 2: always include Bodyweight even when not selected.
        const seen = new Set(main.map(e => e.id));
        try {
          const bw = await getExercisesForEquipment(bodyweightEquipment, level, levels);
          bw.forEach(e => { if (!seen.has(e.id)) main.push(e); });
        } catch {}
        return main;
      };

      let levelsUsed: string[] = [level];
      let exercises = await fetchPool(levelsUsed);
      if (exercises.length < 10) {
        const up = NEXT_LEVEL_UP[level];
        if (up) {
          levelsUsed = [level, up];
          exercises = await fetchPool(levelsUsed);
          console.log(`Pool < 10; expanded to include ${up} → ${exercises.length} exercises`);
        }
      }
      if (exercises.length < 6) {
        toast({
          title: 'Limited exercises available',
          description: 'Limited exercises available for this equipment selection.',
        });
      }
      console.log(`Found ${exercises.length} exercises for equipment: ${equipmentList.join(', ')} at levels: ${levelsUsed.join(', ')}`);

      // Bodyweight subset of the (possibly expanded) main pool. Used
      // downstream for stretches and warm-up/cooldown picks. We still
      // top up to 20 from the dedicated bodyweight catalog if the
      // selected equipment alone didn't surface enough.
      let bodyweightPool: APIExercise[] = exercises.filter(e => e.equipment.toLowerCase() === 'bodyweight');
      if (bodyweightPool.length < 20) {
        try {
          const extra = await getExercisesForEquipment(bodyweightEquipment, level, levelsUsed);
          const seen = new Set(bodyweightPool.map(e => e.id));
          extra.forEach(e => { if (!seen.has(e.id)) bodyweightPool.push(e); });
        } catch {}
      }
      const stretchPool = bodyweightPool.filter(e => e.name.toLowerCase().includes('stretch'));

      // ── Injury rehab resolver ──────────────────────────────────────────────
      // Build a combined search pool (exercises + bodyweight), resolve each
      // compensation name against it. Unresolved names are silently skipped.
      const normName = (s: string) =>
        s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
      const resolveByName = (name: string, pool: APIExercise[]): APIExercise | undefined => {
        const n = normName(name);
        let found = pool.find(e => normName(e.name) === n);
        if (found) return found;
        found = pool.find(e => {
          const en = normName(e.name);
          return en.length > 3 && n.includes(en);
        });
        if (found) return found;
        found = pool.find(e => {
          const en = normName(e.name);
          return n.length > 3 && en.includes(n);
        });
        if (found) return found;
        const nWords = n.split(' ').filter((w: string) => w.length > 3);
        found = pool.find(e => {
          const eWords = normName(e.name).split(' ').filter((w: string) => w.length > 3);
          return nWords.filter((w: string) => eWords.includes(w)).length >= 2;
        });
        return found;
      };

      // Deduplicated combined pool (exercises + bodyweight) for name resolution
      const combinedIdSet = new Set<string>();
      const rehabPool: APIExercise[] = [];
      for (const ex of [...exercises, ...bodyweightPool]) {
        if (!combinedIdSet.has(ex.id)) { combinedIdSet.add(ex.id); rehabPool.push(ex); }
      }

      const activeInjuries: any[] = Array.isArray(fitnessPageInjuries) ? fitnessPageInjuries : [];
      const rehabRecs = activeInjuries.length > 0 ? getInjuryRecommendations(activeInjuries) : [];
      const stretchPolicyMap = activeInjuries.length > 0 ? getInjuryStretchPolicy(activeInjuries) : {};

      const resolvedCompStretches: APIExercise[] = [];
      const resolvedCompStrengthen: APIExercise[] = [];
      const resolvedAlwaysInclude: APIExercise[] = [];
      const seenRehabIds = new Set<string>();

      for (const rec of rehabRecs) {
        for (const item of rec.compensationStretch) {
          const ex = resolveByName(item.name, rehabPool);
          if (ex && !seenRehabIds.has(ex.id)) { seenRehabIds.add(ex.id); resolvedCompStretches.push(ex); }
        }
        for (const item of rec.compensationStrengthen) {
          const ex = resolveByName(item.name, rehabPool);
          if (ex && !seenRehabIds.has(ex.id)) { seenRehabIds.add(ex.id); resolvedCompStrengthen.push(ex); }
        }
        // rec.recommendations is the alwaysInclude list from the rule pack
        for (const item of rec.recommendations) {
          const ex = resolveByName(item.name, rehabPool);
          if (ex && !seenRehabIds.has(ex.id)) { seenRehabIds.add(ex.id); resolvedAlwaysInclude.push(ex); }
        }
      }

      const injuryRehab = {
        compStretches: resolvedCompStretches,
        compStrengthen: resolvedCompStrengthen,
        alwaysInclude: resolvedAlwaysInclude,
      };
      const stretchPolicy = Object.values(stretchPolicyMap).filter(Boolean).join(' | ');

      if (activeInjuries.length > 0) {
        console.log(`[InjuryRehab] ${resolvedCompStretches.length} comp-stretches, ${resolvedCompStrengthen.length} comp-strengthen, ${resolvedAlwaysInclude.length} alwaysInclude resolved from ${activeInjuries.length} injuries`);
      }
      // ── End injury rehab resolver ──────────────────────────────────────────

      let cardioPool: APIExercise[] = [];
      if (workoutStyle === 'standard-cardio') {
        const cardioEquipment = ['Treadmill','Stationary Bike','Rowing Machine','Elliptical Machine','Assault Bike','Jump Rope','Stepmill','Battle Ropes','Ski Ergometer','Rebounder'];
        try {
          cardioPool = await getExercisesForEquipment(cardioEquipment, level);
        } catch (e) {
          console.warn('Failed to fetch cardio pool', e);
        }
        // Bodyweight cardio fallback by name match
        const cardioNamePatterns = ['burpee','mountain climber','jumping jack','high knee','jump rope','jump squat','sprint','running','jog'];
        bodyweightPool.forEach(e => {
          const n = e.name.toLowerCase();
          if (cardioNamePatterns.some(p => n.includes(p)) && !cardioPool.some(c => c.id === e.id)) {
            cardioPool.push(e);
          }
        });
      }
      
      if (workoutStyle === 'stretching') {
        if (stretchPool.length < 5) {
          console.warn('Not enough stretches available');
          return [];
        }
      } else if (exercises.length < 5) {
        console.warn(`Not enough exercises for equipment: ${equipmentList.join(', ')}. Found: ${exercises.length}`);
        // Fallback to bodyweight exercises if selected equipment has too few
        if (!equipmentList.some(eq => eq.toLowerCase() === 'bodyweight')) {
          console.log('Attempting fallback to bodyweight exercises...');
          const bodyweightExercises = await getExercisesForEquipment(bodyweightEquipment, level);
          if (bodyweightExercises.length >= 5) {
            console.log('Falling back to bodyweight exercises');
            const weeklyPlan = generateDynamicPlan(bodyweightExercises, level as "Beginner"|"Intermediate"|"Advanced"|"Tabata", 'bodyweight', workoutDays.length, workoutStyle, parseInt(duration), stretchPool, cardioPool, injuryRehab);
            const preBuiltPlan = convertWeeklyPlanToPreBuiltPlan(weeklyPlan, startDay, workoutDays);
            if (stretchPolicy) preBuiltPlan.stretchPolicy = stretchPolicy;
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
        level as "Beginner"|"Intermediate"|"Advanced"|"Tabata", 
        equipmentLabel,
        workoutDays.length, // Use actual number of workout days selected
        workoutStyle,
        parseInt(duration),
        stretchPool,
        cardioPool,
        injuryRehab
      );
      const preBuiltPlan = convertWeeklyPlanToPreBuiltPlan(weeklyPlan, startDay, workoutDays);
      if (stretchPolicy) preBuiltPlan.stretchPolicy = stretchPolicy;
      
      // Customize plan based on additional parameters
      const styleLabel =
        workoutStyle === 'standard-cardio' ? 'Standard + Cardio' :
        workoutStyle === 'standard-no-cardio' ? 'Standard' :
        workoutStyle === 'hiit' ? 'HIIT' :
        workoutStyle === 'stretching' ? 'Stretching' : '';
      preBuiltPlan.name = `${levelDisplay} ${styleLabel} ${equipmentDisplay} Program (${duration} min)`;
      preBuiltPlan.description = `${levelDisplay}-level ${styleLabel.toLowerCase()} program using ${equipmentDisplay}, ${frequency} days per week, ${duration} minutes per session.`;
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
    // "Yes" / "No" tags from the exercises table. Used to filter the
    // HIIT circuit pool (HIIT = Yes only per spec) and the stretching
    // pool (Stretching = Yes only).
    hiit?: string;
    stretching?: string;
  }

  interface PlanExercise {
    exercise: APIExercise;
    sets: number;
    reps: number | null;
    durationSec?: number;
    // Rest in seconds between sets of THIS exercise. Resolved from the
    // (level, exercise-type) rest table for standard work, the HIIT
    // rest interval for HIIT/Tabata, or 10s transition for stretches.
    restSec?: number;
    // True for exercises injected as injury compensation / alwaysInclude rehab.
    // Used to annotate exercise notes when persisting to the database.
    isRehab?: boolean;
  }

  // Classify a standard exercise as compound / isolation / bodyweight /
  // core so both the rest-period and sets/reps tables can be applied per
  // spec. Core is detected first (planks, crunches, leg raises, etc.) so
  // an "ab wheel rollout" doesn't get tagged as bodyweight or isolation.
  // Equipment "body weight" wins next unless the name clearly indicates a
  // compound lift; otherwise the name is matched against compound /
  // isolation keywords with compound winning ties (more generous rest).
  type ExerciseType = 'compound' | 'isolation' | 'bodyweight' | 'core';
  type Level = 'Beginner' | 'Intermediate' | 'Advanced' | 'Tabata';
  function classifyStandardExercise(ex: APIExercise): ExerciseType {
    const name = (ex.name || '').toLowerCase();
    const equip = (ex.equipment || '').toLowerCase();
    const bodyPart = (ex.bodyPart || '').toLowerCase();
    const coreKeywords = [
      'plank', 'crunch', 'sit-up', 'situp', 'sit up', 'leg raise',
      'dead bug', 'hollow body', 'mountain climber', 'russian twist',
      'wood chop', 'side bend', 'ab wheel', 'ab roll', 'flutter kick',
      'bicycle', 'v-up', 'v up',
    ];
    const isCore = coreKeywords.some(k => name.includes(k))
      || bodyPart === 'core' || bodyPart === 'abs' || bodyPart === 'waist'
      || bodyPart === 'obliques';
    if (isCore) return 'core';
    const compoundKeywords = [
      'squat', 'deadlift', 'bench press', 'overhead press',
      'shoulder press', 'military press', 'push press', 'row',
      'clean', 'snatch', 'lunge', 'pull-up', 'pull up', 'pullup',
      'chin-up', 'chin up', 'chinup', 'dip', 'thrust', 'thruster',
    ];
    const isolationKeywords = [
      'curl', 'extension', 'raise', 'fly', 'flye', 'kickback',
      'shrug', 'pulldown', 'pushdown', 'lateral', 'rear delt',
      'concentration', 'preacher', 'reverse fly',
    ];
    const isCompound = compoundKeywords.some(k => name.includes(k));
    if (isCompound) return 'compound';
    if (equip.includes('body weight') || equip === 'bodyweight') return 'bodyweight';
    const isIsolation = isolationKeywords.some(k => name.includes(k));
    if (isIsolation) return 'isolation';
    return 'compound';
  }

  // Spec rest-period table (seconds) keyed by (level, exercise type) for
  // Standard / Standard with Cardio sessions. Midpoints of each spec
  // range. Core reuses the isolation rest band per spec (45-60s).
  const STANDARD_REST_TABLE: Record<Level, Record<ExerciseType, number>> = {
    Beginner:     { compound: 82,  isolation: 52, bodyweight: 52, core: 52 },
    Intermediate: { compound: 67,  isolation: 52, bodyweight: 60, core: 52 },
    Advanced:     { compound: 105, isolation: 52, bodyweight: 67, core: 52 },
    Tabata:       { compound: 105, isolation: 52, bodyweight: 67, core: 52 },
  };
  // Per-level average rest used as a budget proxy (actual emitted rest
  // varies per exercise via the table above).
  const STANDARD_AVG_REST: Record<Level, number> = {
    Beginner:     Math.round((82 + 52 + 52 + 52) / 4),     // 60
    Intermediate: Math.round((67 + 52 + 60 + 52) / 4),     // 58
    Advanced:     Math.round((105 + 52 + 67 + 52) / 4),    // 69
    Tabata:       Math.round((105 + 52 + 67 + 52) / 4),    // 69
  };

  // Spec sets / reps table keyed by (level, exercise type). Sets use the
  // upper-mid of each spec range so users get meaningful volume; reps
  // use the spec range and are randomised at emission time. For Advanced,
  // the FIRST compound emitted in a day is treated as the "primary" lift
  // (heavier strength block: 5 sets x 4-6 reps); subsequent compounds
  // fall back to the secondary band. Core uses the rep range (the
  // hold-time variant is captured in plank-style names via durationSec
  // emission, which is out of scope for this lookup).
  type SetsRepsSpec = { sets: number; repRange: [number, number] };
  const STANDARD_SETS_TABLE: Record<Level, Record<ExerciseType, SetsRepsSpec>> = {
    Beginner: {
      compound:   { sets: 3, repRange: [8, 10] },
      isolation:  { sets: 3, repRange: [10, 12] },
      bodyweight: { sets: 3, repRange: [10, 12] },
      core:       { sets: 3, repRange: [10, 15] },
    },
    Intermediate: {
      compound:   { sets: 4, repRange: [8, 12] },
      isolation:  { sets: 3, repRange: [10, 15] },
      bodyweight: { sets: 3, repRange: [10, 15] },
      core:       { sets: 3, repRange: [12, 15] },
    },
    Advanced: {
      compound:   { sets: 4, repRange: [6, 10] },   // secondary
      isolation:  { sets: 4, repRange: [10, 15] },
      bodyweight: { sets: 4, repRange: [10, 15] },
      core:       { sets: 4, repRange: [10, 15] },
    },
    Tabata: {
      compound:   { sets: 4, repRange: [6, 10] },
      isolation:  { sets: 4, repRange: [10, 15] },
      bodyweight: { sets: 4, repRange: [10, 15] },
      core:       { sets: 4, repRange: [10, 15] },
    },
  };
  // Advanced "primary compound" override — applied to the first compound
  // emitted per Advanced day for a strength-focused block.
  const ADVANCED_PRIMARY_COMPOUND: SetsRepsSpec = { sets: 5, repRange: [4, 6] };

  // Per-level avg sets used to size exercise count from totalWorkingSets.
  const STANDARD_AVG_SETS: Record<Level, number> = {
    Beginner:     3,
    Intermediate: 3,    // 4/3/3/3 → 3.25, round down for tighter fit
    Advanced:     4,    // 4/4/4/4 (primary compound is rare per day)
    Tabata:       4,
  };

  // HIIT rounds (sets per exercise) per spec.
  const HIIT_ROUNDS_BY_LEVEL: Record<Level, number> = {
    Beginner:     4,    // 3-4 rounds → upper bound
    Intermediate: 5,
    Advanced:     6,    // 5-6 rounds
    Tabata:       8,    // classic protocol
  };

  // Stretching: holds (sets) and hold duration (seconds) per level per
  // spec. Beg 1-2 holds @ 25-30s, Int 2 @ 40-45s, Adv 2-3 @ 50-60s.
  const STRETCH_SETS_BY_LEVEL: Record<Level, number> = {
    Beginner:     2,
    Intermediate: 2,
    Advanced:     3,
    Tabata:       3,
  };
  const STRETCH_HOLD_BY_LEVEL: Record<Level, number> = {
    Beginner:     28,   // 25-30 midpoint
    Intermediate: 42,   // 40-45 midpoint
    Advanced:     55,   // 50-60 midpoint
    Tabata:       55,
  };

  interface DayPlan {
    name: string;
    exercises: PlanExercise[];
    // Spec intensity progression across the week. 'light' applies a
    // -1 set reduction and a -20% weight/intensity hint; 'moderate'
    // keeps full reps with up to a -1 set reduction (we keep full
    // sets); 'heavy' uses the full sets/reps from the level rules.
    intensity?: 'heavy' | 'moderate' | 'light';
  }

  interface WeeklyPlan {
    level: "Beginner" | "Intermediate" | "Advanced" | "Tabata";
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

  async function getExercisesForEquipment(
    equipmentList: string[],
    selectedLevel: string,
    levelsOverride?: string[],
  ): Promise<APIExercise[]> {
    let allExercises: APIExercise[] = [];

    // Per spec: filter strictly to the user's selected level. Adjacent
    // levels are only added by the caller as a fallback when the
    // resulting pool is too small (see expandPoolIfNeeded). Callers can
    // also pass `levelsOverride` to fetch a specific set of levels
    // directly.
    // Normalize every level value to the DB's canonical capitalization
    // ("Intermediate", not "intermediate"). The exercises table uses a
    // case-sensitive equality match, so any lowercase value silently
    // returns zero rows. This applies to both the default selectedLevel
    // path AND the levelsOverride path (callers pass raw lowercase
    // values from the level <Select>).
    const canonicalizeLevel = (raw: string) =>
      raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    const levelsToInclude: string[] = levelsOverride && levelsOverride.length > 0
      ? levelsOverride.map(canonicalizeLevel)
      : [canonicalizeLevel(selectedLevel)];

    const levelParam = levelsToInclude.join(',');
    
    try {
      // Fetch exercises for each selected equipment type from local database
      for (const equipment of equipmentList) {
        const url = `/api/exercises?equipment=${encodeURIComponent(equipment)}&level=${encodeURIComponent(levelParam)}&dedupePairs=true`;
        
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
            gifUrl: ex.mediaFile || '',
            hiit: ex.hiit ?? 'No',
            stretching: ex.stretching ?? 'No',
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
    preferredEquipment?: string[],
    avoidIds?: Set<string>
  ): APIExercise[] {
    // Body-part filter, excluding within-week used
    const baseByPart = allExercises.filter(
      e => e.bodyPart.toLowerCase() === bodyPart.toLowerCase() && !usedIds.has(e.id)
    );

    // Try to exclude program-level used (cross-week diversity) first.
    // If that pool is too small, fall back to allowing repeats.
    let filtered = avoidIds && avoidIds.size > 0
      ? baseByPart.filter(e => !avoidIds.has(e.id))
      : baseByPart;
    if (filtered.length < count) filtered = baseByPart;
    
    // Prefer requested equipment when available
    if (preferredEquipment && preferredEquipment.length > 0) {
      const withPreferredEquipment = filtered.filter(e => 
        preferredEquipment.includes(e.equipment.toLowerCase())
      );
      if (withPreferredEquipment.length >= count) {
        filtered = withPreferredEquipment;
      }
    }
    
    const shuffled = shuffleArray(filtered);
    const picked = shuffled.slice(0, Math.min(count, shuffled.length));
    picked.forEach(ex => usedIds.add(ex.id));
    return picked;
  }

  function generateDynamicPlan(
    exercises: APIExercise[], 
    level: "Beginner"|"Intermediate"|"Advanced"|"Tabata", 
    equipment: string,
    workoutDaysPerWeek: number = 3,
    workoutStyle: string = 'standard-no-cardio',
    durationMin: number = 45,
    stretchPool: APIExercise[] = [],
    cardioPool: APIExercise[] = [],
    injuryRehab: { compStretches: APIExercise[]; compStrengthen: APIExercise[]; alwaysInclude: APIExercise[] } = { compStretches: [], compStrengthen: [], alwaysInclude: [] }
  ): WeeklyPlan {
    // Defensive normalization: the level select can emit lowercase
    // values ("intermediate") that the TS cast at the callsite swallows
    // silently. Without normalizing here, every Level-keyed lookup
    // (STANDARD_SETS_TABLE, STANDARD_REST_TABLE, etc.) returns undefined
    // and the function throws — caught upstream as "Unable to generate
    // plans for <equipment>". Map any casing back to the canonical Level.
    const normalizeLevel = (raw: string): "Beginner"|"Intermediate"|"Advanced"|"Tabata" => {
      const lower = String(raw || '').toLowerCase();
      if (lower === 'tabata') return 'Tabata';
      if (lower === 'advanced') return 'Advanced';
      if (lower === 'intermediate') return 'Intermediate';
      return 'Beginner';
    };
    level = normalizeLevel(level);
    const weeks: DayPlan[][] = [];
    
    // Get all unique equipment types from the exercises
    const availableEquipment = Array.from(new Set(exercises.map(e => e.equipment.toLowerCase())));
    
    // Standard rep-based config — sets/reps are now per (level, exercise
    // type) via STANDARD_SETS_TABLE; rest is per (level, type) via
    // STANDARD_REST_TABLE. avgReps below is a per-level mean used only
    // as a budget proxy; actual reps vary per emitted exercise.
    const levelKey: Level = level;
    const setsTable = STANDARD_SETS_TABLE[levelKey];
    const avgReps = (() => {
      // Mean of midpoints across the four exercise types for this level.
      const types: ExerciseType[] = ['compound', 'isolation', 'bodyweight', 'core'];
      const mids = types.map(t => (setsTable[t].repRange[0] + setsTable[t].repRange[1]) / 2);
      return mids.reduce((a, b) => a + b, 0) / mids.length;
    })();

    // HIIT time-based config (per spec):
    //   Beginner     30s work / 30s rest, 4 rounds
    //   Intermediate 40s work / 20s rest, 5 rounds
    //   Advanced     45s work / 15s rest, 6 rounds
    //   Tabata       20s work / 10s rest x 8 rounds (Advanced-only protocol)
    const isTabata = level === "Tabata";
    const hiitWork = isTabata ? 20
                   : level === "Beginner" ? 30
                   : level === "Intermediate" ? 40
                   : 45;
    const hiitRest = isTabata ? 10
                   : level === "Beginner" ? 30
                   : level === "Intermediate" ? 20
                   : 15;
    const hiitRounds = HIIT_ROUNDS_BY_LEVEL[levelKey];

    // Stretching config — sets and hold duration per level per spec.
    // Transition between every hold is fixed at 10s.
    const STRETCH_TRANSITION = 10;
    const STRETCH_HOLD = STRETCH_HOLD_BY_LEVEL[levelKey];
    const stretchSets = STRETCH_SETS_BY_LEVEL[levelKey];

    // Weekly muscle-group rotation per spec. Splits are chosen so the
    // same primary muscle group is never trained on consecutive days.
    //   1 day:  Full Body
    //   2 days: Full Body A / Full Body B
    //   3 days: Full Body A / B / C
    //   4 days: Upper / Lower / Upper / Lower
    //   5 days: Push / Pull / Legs / Upper / Lower
    //   6 days: Push / Pull / Legs / Push / Pull / Legs
    //   7+:     clamps at the 6-day rotation
    const SPLITS: Record<string, { name: string; parts: string[] }> = {
      FullA:  { name: 'Full Body A', parts: ['chest', 'back', 'quads', 'shoulders'] },
      FullB:  { name: 'Full Body B', parts: ['hamstrings', 'lats', 'biceps', 'triceps'] },
      FullC:  { name: 'Full Body C', parts: ['glutes', 'calves', 'shoulders', 'core'] },
      Upper:  { name: 'Upper Body',  parts: ['chest', 'back', 'lats', 'shoulders', 'biceps', 'triceps', 'forearms'] },
      Lower:  { name: 'Lower Body',  parts: ['quads', 'hamstrings', 'glutes', 'calves', 'lower back'] },
      Push:   { name: 'Push',        parts: ['chest', 'shoulders', 'triceps'] },
      Pull:   { name: 'Pull',        parts: ['back', 'lats', 'biceps', 'forearms', 'traps'] },
      Legs:   { name: 'Legs',        parts: ['quads', 'hamstrings', 'glutes', 'calves'] },
    };
    const ROTATIONS: Record<number, string[]> = {
      1: ['FullA'],
      2: ['FullA', 'FullB'],
      3: ['FullA', 'FullB', 'FullC'],
      4: ['Upper', 'Lower', 'Upper', 'Lower'],
      5: ['Push', 'Pull', 'Legs', 'Upper', 'Lower'],
      6: ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs'],
    };
    const days = Math.max(1, Math.min(6, workoutDaysPerWeek));
    const bodyPartSchedule = ROTATIONS[days].map(key => SPLITS[key]);

    // Intensity progression across the week per spec.
    //   1 day:  full effort
    //   2 days: full / full
    //   3 days: heavy / light / heavy
    //   4 days: heavy / moderate / heavy / light
    //   5 days: heavy / moderate / heavy / light / moderate
    //   6 days: heavy / moderate / heavy / moderate / heavy / light
    type Intensity = 'heavy' | 'moderate' | 'light';
    const INTENSITY_BY_DAYS: Record<number, Intensity[]> = {
      1: ['heavy'],
      2: ['heavy', 'heavy'],
      3: ['heavy', 'light', 'heavy'],
      4: ['heavy', 'moderate', 'heavy', 'light'],
      5: ['heavy', 'moderate', 'heavy', 'light', 'moderate'],
      6: ['heavy', 'moderate', 'heavy', 'moderate', 'heavy', 'light'],
    };
    const intensityByDay = INTENSITY_BY_DAYS[days];

    // Per-session same-muscle-group cap per spec:
    //   Beginner: 2, Intermediate: 3, Advanced: 4
    // Tabata reuses the Advanced cap. Counts the number of exercises
    // tagged to the same primary bodyPart within a single session.
    const SAME_MUSCLE_CAP_BY_LEVEL: Record<Level, number> = {
      Beginner: 2, Intermediate: 3, Advanced: 4, Tabata: 4,
    };
    const sameMuscleCap = SAME_MUSCLE_CAP_BY_LEVEL[levelKey];

    // === Time budget formula (per spec) ===
    // Every session reserves fixed mandatory blocks, then allocates the
    // remaining "working" time to working sets at level/style-appropriate
    // per-set durations.
    //   Opening stretch: 5 min (non-stretching only)
    //   Main warm-up:    5 min (non-stretching only)
    //   Cooldown:        5 min (all session types)
    // Working budget = total - 15 min (or total - 5 min for Stretching only).
    const isStretchingOnly = workoutStyle === 'stretching';
    const totalSec = durationMin * 60;

    // Session structure (spec) — three header blocks before the main
    // workout, plus a cooldown block at the end. All transitions inside
    // these blocks are 0s ("no rest between") per spec; only the main
    // stretching session keeps the 10s transition.
    //   1) OPENING STRETCH — 4-6 dynamic stretches, 20-30s each
    //   2) WARM-UP         — 2-3 light cardio movements, 30-60s each
    //   3) MAIN WORKOUT    — sets/reps/rest from the spec tables
    //   4) COOLDOWN STRETCH — 4-6 static stretches, hold per level
    //                         (Beg 30, Int 40, Adv 50-60)
    const OPENING_STRETCH_HOLD   = 25;   // 20-30s midpoint, dynamic
    const OPENING_TRANSITION     = 10;   // 10s buffer between dynamic stretches
    const WARMUP_CARDIO_HOLD     = 45;   // 30-60s midpoint, light cardio
    const WARMUP_TRANSITION      = 10;   // 10s buffer between cardio movements
    const COOLDOWN_HOLD_BY_LEVEL: Record<Level, number> = {
      Beginner: 30, Intermediate: 40, Advanced: 55, Tabata: 55,
    };
    const COOLDOWN_HOLD          = COOLDOWN_HOLD_BY_LEVEL[levelKey];
    const COOLDOWN_TRANSITION    = 10;   // 10s buffer between cooldown stretches
    // 10s preview shown by the workout player before EACH main-workout
    // exercise's first set (mp4 + name + 3-2-1 countdown beeps). We budget
    // it once per main-workout exercise so the requested duration matches
    // the actual on-screen session time.
    const MAIN_EXERCISE_PREVIEW  = 10;

    // Block sizes per spec (count, not duration).
    // Standard / HIIT: opening stretch (5) + warm-up cardio (3) + cooldown (5).
    // Stretching-only: light movement (3 min) + final rest (2 min) wrap
    // the holds; the holds themselves consume the remaining time.
    const STRETCHING_LIGHT_MOVEMENT_SEC = 3 * 60;     // 3 min total block
    const STRETCHING_LIGHT_MOVEMENT_HOLD = 60;        // 3 movements * 60s
    const STRETCHING_LIGHT_MOVEMENT_COUNT = isStretchingOnly
      ? Math.round(STRETCHING_LIGHT_MOVEMENT_SEC / STRETCHING_LIGHT_MOVEMENT_HOLD)
      : 0;
    const openingStretchCount = isStretchingOnly ? 0 : 5;     // spec 4-6
    const mainWarmupCount     = isStretchingOnly ? 0 : 3;     // spec 2-3
    const cooldownCount       = isStretchingOnly ? 0 : 5;     // spec 4-6
    // Reserve 10s per main-workout exercise for the inter-exercise
    // preview the player shows (mp4 + name + 3-2-1 countdown beeps).
    // Sized to the upper bound of the spec-table exercise counts at each
    // duration so the budget always covers the actual emitted plan;
    // anything not used by previews falls back into the working budget
    // implicitly via the trim pass.
    const PREVIEW_BUDGET_BY_DUR: Record<number, number> = {
      30: 6, 45: 7, 60: 9, 90: 12,
    };
    const _previewDurKey = ([30, 45, 60, 90] as const).reduce(
      (best, d) => Math.abs(d - durationMin) < Math.abs(best - durationMin) ? d : best,
      30 as 30 | 45 | 60 | 90,
    );
    const mainPreviewSec = isStretchingOnly
      ? 0
      : PREVIEW_BUDGET_BY_DUR[_previewDurKey] * MAIN_EXERCISE_PREVIEW;
    const mandatorySec =
      openingStretchCount * (OPENING_STRETCH_HOLD + OPENING_TRANSITION) +
      mainWarmupCount     * (WARMUP_CARDIO_HOLD   + WARMUP_TRANSITION) +
      cooldownCount       * (COOLDOWN_HOLD        + COOLDOWN_TRANSITION) +
      STRETCHING_LIGHT_MOVEMENT_COUNT * STRETCHING_LIGHT_MOVEMENT_HOLD +
      mainPreviewSec;
    const workingSec = Math.max(60, totalSec - mandatorySec);

    // Combined pre-workout count (opening stretch + warm-up cardio).
    // Used by the safety-net trim to know which leading slots are
    // mandatory header blocks vs main-workout exercises.
    const warmupCount = openingStretchCount + mainWarmupCount;
    // Time-per-slot proxy used by the safety-net trim for header/footer
    // slots (they always emit the same per-block hold + transition).
    const SEC_PER_STRETCH = COOLDOWN_HOLD + COOLDOWN_TRANSITION;

    // Per-set seconds — single source of truth used both to size the budget
    // and to compute the final session time so the player actually hits the
    // requested duration. For HIIT/Tabata this is the real emitted
    // work + rest per set (Tabata's 20s+10s protocol is 30s/set, which
    // diverges from the spec's "~1 min/set" hint but preserves the classic
    // protocol the user explicitly opted into via the Tabata level option).
    let perSetSec: number;
    if (workoutStyle === 'hiit') {
      // Per-spec HIIT totals: Beg 60, Int 60, Adv 60, Tabata 30.
      perSetSec = hiitWork + hiitRest;
    } else if (isStretchingOnly) {
      // 30s hold + 10s transition per spec.
      perSetSec = STRETCH_HOLD + STRETCH_TRANSITION;
    } else {
      // Standard: ~3 sec per rep avg work + per-level avg rest from
      // STANDARD_AVG_REST. Actual rest still varies per emitted exercise
      // (compound/isolation/bodyweight) — this is the budget proxy only.
      const workSec = avgReps * 3;
      perSetSec = Math.round(workSec + STANDARD_AVG_REST[level]);
    }

    // Total working sets that fit the working budget. We then ceil-divide
    // by the per-style sets-per-exercise constant to get the number of
    // distinct exercises, and a post-emission pass distributes any
    // remainder sets across them (e.g. 13 sets across ceil(13/3)=5
    // exercises => 3+3+3+2+2 = 13) so totalWorkingSets is hit exactly.
    const totalWorkingSets = Math.max(1, Math.floor(workingSec / perSetSec));
    const setsPerExerciseRaw = workoutStyle === 'hiit' ? hiitRounds
                             : isStretchingOnly        ? stretchSets
                             :                           STANDARD_AVG_SETS[levelKey];
    const exercisesPerDayRaw = Math.max(1, Math.ceil(totalWorkingSets / setsPerExerciseRaw));

    // === Hard exercise-count cap per spec ===
    // The spec ships an exact (duration × type × level) lookup table
    // that the budget calc must never exceed. Standard/stretching use a
    // {min, max} range — we cap at max and only raise to min if the
    // budget came in under it. HIIT is fully prescriptive: both the
    // circuit size and the number of rounds are spec-defined and
    // override the budget-derived values entirely.
    type SpecRange = { min: number; max: number };
    type SpecHiit  = { circuit: number; rounds: number };
    const STD_TABLE: Record<number, Record<'Beginner'|'Intermediate'|'Advanced', SpecRange>> = {
      30: { Beginner: { min: 4, max: 5 }, Intermediate: { min: 4, max: 5 }, Advanced: { min: 5, max: 6 } },
      45: { Beginner: { min: 5, max: 6 }, Intermediate: { min: 6, max: 7 }, Advanced: { min: 6, max: 7 } },
      60: { Beginner: { min: 6, max: 7 }, Intermediate: { min: 7, max: 8 }, Advanced: { min: 8, max: 9 } },
      90: { Beginner: { min: 8, max: 9 }, Intermediate: { min: 9, max: 11 }, Advanced: { min: 10, max: 12 } },
    };
    const HIIT_TABLE: Record<number, Record<'Beginner'|'Intermediate'|'Advanced', SpecHiit>> = {
      30: { Beginner: { circuit: 5, rounds: 3 }, Intermediate: { circuit: 5, rounds: 3 }, Advanced: { circuit: 5, rounds: 4 } },
      45: { Beginner: { circuit: 5, rounds: 4 }, Intermediate: { circuit: 6, rounds: 4 }, Advanced: { circuit: 6, rounds: 4 } },
      60: { Beginner: { circuit: 6, rounds: 4 }, Intermediate: { circuit: 6, rounds: 5 }, Advanced: { circuit: 6, rounds: 5 } },
      90: { Beginner: { circuit: 6, rounds: 5 }, Intermediate: { circuit: 6, rounds: 6 }, Advanced: { circuit: 6, rounds: 7 } },
    };
    const STRETCH_TABLE: Record<number, SpecRange> = {
      30: { min: 10, max: 12 },
      45: { min: 14, max: 16 },
      60: { min: 18, max: 20 },
      90: { min: 25, max: 28 },
    };
    // Pick nearest spec-table duration so non-table inputs (e.g. 75 min)
    // still get sensible caps.
    const SPEC_DURS = [30, 45, 60, 90] as const;
    const nearestDur = SPEC_DURS.reduce((best, d) =>
      Math.abs(d - durationMin) < Math.abs(best - durationMin) ? d : best
    , SPEC_DURS[0]);
    // Tabata's level key isn't in the spec table — treat it as Advanced
    // for cap-lookup purposes.
    const tableLevel: 'Beginner'|'Intermediate'|'Advanced' =
      level === 'Tabata' ? 'Advanced' : level;

    let exercisesPerDay = exercisesPerDayRaw;
    let setsPerExercise = setsPerExerciseRaw;
    if (workoutStyle === 'hiit') {
      // HIIT is fully prescriptive: override both circuit size and rounds.
      const spec = HIIT_TABLE[nearestDur][tableLevel];
      exercisesPerDay = spec.circuit;
      setsPerExercise = spec.rounds;
    } else if (isStretchingOnly) {
      const range = STRETCH_TABLE[nearestDur];
      exercisesPerDay = Math.min(range.max, Math.max(range.min, exercisesPerDayRaw));
    } else {
      const range = STD_TABLE[nearestDur][tableLevel];
      exercisesPerDay = Math.min(range.max, Math.max(range.min, exercisesPerDayRaw));
    }

    // Per-level light-cardio name patterns for the WARM-UP block (spec:
    // "light cardio or low-intensity version of first exercise").
    // Falls back to whatever cardioPool was provided, then to a generic
    // bodyweight-cardio name match within the main exercises pool.
    const WARMUP_CARDIO_NAMES_BY_LEVEL: Record<Level, string[]> = {
      Beginner:     ['walking', 'march', 'jumping jack', 'bodyweight squat', 'air squat'],
      Intermediate: ['jog', 'dynamic lunge', 'arm swing', 'arm circle', 'leg swing', 'high knee'],
      Advanced:     ['jump rope', 'high knee', 'mobility', 'burpee', 'a-skip'],
      Tabata:       ['jump rope', 'high knee', 'mobility', 'burpee'],
    };
    const buildWarmupCardioPool = (): APIExercise[] => {
      const matches: APIExercise[] = [];
      const seen = new Set<string>();
      const wantNames = WARMUP_CARDIO_NAMES_BY_LEVEL[levelKey];
      // 1) Prefer light-cardio name matches from the main exercise pool
      //    so movements come from real DB rows with media.
      for (const ex of exercises) {
        const n = (ex.name || '').toLowerCase();
        if (wantNames.some(p => n.includes(p)) && !seen.has(ex.id)) {
          seen.add(ex.id);
          matches.push(ex);
        }
      }
      // 2) Then fall back to whatever cardioPool was provided.
      for (const ex of cardioPool) {
        if (!seen.has(ex.id)) { seen.add(ex.id); matches.push(ex); }
      }
      return matches;
    };
    const warmupCardioPool = buildWarmupCardioPool();

    // Helper: prepend the OPENING STRETCH block (4-6 dynamic stretches,
    // 20-30s each, no rest between). Biased toward today's body parts.
    const emitOpeningStretch = (parts: string[], dayExercises: PlanExercise[], priorityStretches: APIExercise[] = []) => {
      if (openingStretchCount === 0 || stretchPool.length === 0) return;
      const usedWarm = new Set<string>();
      let added = 0;
      // Inject up to 1 priority (compensation rehab) stretch first
      for (const ps of priorityStretches) {
        if (added >= Math.min(1, openingStretchCount)) break;
        if (!usedWarm.has(ps.id)) {
          usedWarm.add(ps.id);
          dayExercises.push({
            exercise: ps, sets: 1, reps: null,
            durationSec: OPENING_STRETCH_HOLD, restSec: OPENING_TRANSITION,
            isRehab: true,
          });
          added++;
        }
      }
      for (const bp of parts) {
        if (added >= openingStretchCount) break;
        const bpMatch = stretchPool.filter(s => s.bodyPart.toLowerCase() === bp.toLowerCase() && !usedWarm.has(s.id));
        const fresh = bpMatch.filter(s => !usedAcrossProgram.has(s.id));
        const source = fresh.length > 0 ? fresh : bpMatch;
        const pick = shuffleArray(source).slice(0, 1);
        pick.forEach(s => {
          usedWarm.add(s.id);
          dayExercises.push({
            exercise: s, sets: 1, reps: null,
            durationSec: OPENING_STRETCH_HOLD, restSec: OPENING_TRANSITION,
          });
          added++;
        });
      }
      while (added < openingStretchCount) {
        const remaining = stretchPool.filter(s => !usedWarm.has(s.id));
        if (remaining.length === 0) break;
        const s = shuffleArray(remaining)[0];
        usedWarm.add(s.id);
        dayExercises.push({
          exercise: s, sets: 1, reps: null,
          durationSec: OPENING_STRETCH_HOLD, restSec: OPENING_TRANSITION,
        });
        added++;
      }
    };

    // Helper: prepend the WARM-UP block (2-3 light cardio movements,
    // 30-60s each, no rest between). Falls back to extra opening
    // stretches if no cardio movement is available.
    const emitWarmupCardio = (dayExercises: PlanExercise[]) => {
      if (mainWarmupCount === 0) return;
      const usedWarm = new Set<string>();
      let added = 0;
      const pool = warmupCardioPool.length > 0 ? warmupCardioPool : stretchPool;
      const fresh = pool.filter(e => !usedAcrossProgram.has(e.id));
      const source = fresh.length > 0 ? fresh : pool;
      for (const ex of shuffleArray(source)) {
        if (added >= mainWarmupCount) break;
        if (usedWarm.has(ex.id)) continue;
        usedWarm.add(ex.id);
        dayExercises.push({
          exercise: ex, sets: 1, reps: null,
          durationSec: WARMUP_CARDIO_HOLD, restSec: WARMUP_TRANSITION,
        });
        added++;
      }
    };

    // Helper: append the COOLDOWN STRETCH block (4-6 static stretches
    // held per level: Beg 30s, Int 40s, Adv 50-60s; no rest between).
    // Biased toward today's body parts and avoiding duplicates already
    // used earlier in the day.
    const emitCooldown = (parts: string[], dayExercises: PlanExercise[], priorityStretches: APIExercise[] = []) => {
      if (cooldownCount === 0 || stretchPool.length === 0) return;
      const usedCool = new Set<string>();
      dayExercises.forEach(e => usedCool.add(e.exercise.id));
      let added = 0;
      // Inject up to 1 priority (compensation rehab) stretch that wasn't used in opening
      for (const ps of priorityStretches) {
        if (added >= Math.min(1, cooldownCount)) break;
        if (!usedCool.has(ps.id)) {
          usedCool.add(ps.id);
          dayExercises.push({
            exercise: ps, sets: 1, reps: null,
            durationSec: COOLDOWN_HOLD, restSec: COOLDOWN_TRANSITION,
            isRehab: true,
          });
          added++;
        }
      }
      for (const bp of parts) {
        if (added >= cooldownCount) break;
        const bpMatch = stretchPool.filter(s => s.bodyPart.toLowerCase() === bp.toLowerCase() && !usedCool.has(s.id));
        const fresh = bpMatch.filter(s => !usedAcrossProgram.has(s.id));
        const source = fresh.length > 0 ? fresh : bpMatch;
        const pick = shuffleArray(source).slice(0, 1);
        pick.forEach(s => {
          usedCool.add(s.id);
          dayExercises.push({
            exercise: s, sets: 1, reps: null,
            durationSec: COOLDOWN_HOLD, restSec: COOLDOWN_TRANSITION,
          });
          added++;
        });
      }
      while (added < cooldownCount) {
        const remaining = stretchPool.filter(s => !usedCool.has(s.id));
        if (remaining.length === 0) break;
        const s = shuffleArray(remaining)[0];
        usedCool.add(s.id);
        dayExercises.push({
          exercise: s, sets: 1, reps: null,
          durationSec: COOLDOWN_HOLD, restSec: COOLDOWN_TRANSITION,
        });
        added++;
      }
    };

    // Helper: classify an exercise for main-block ordering. Stretching
    // sessions skip this; HIIT keeps the pick order. Standard sessions
    // sort compound → isolation/bodyweight → core per spec.
    const ORDER_RANK: Record<ExerciseType, number> = {
      compound: 0, isolation: 1, bodyweight: 1, core: 2,
    };

    // Build 4 distinct weeks. Each week varies its exercises (week-over-week
    // variation) while keeping the same body-part schedule per weekday so the
    // user trains the same muscle groups on the same day each week.
    const usedAcrossProgram = new Set<string>();
    for (let weekIdx = 0; weekIdx < 4; weekIdx++) {
      const week: DayPlan[] = [];
      const usedExercisesThisWeek = new Set<string>();
      
      // Use the first available equipment as the preferred rotation
      const equipmentRotation = availableEquipment[0] || '';
      
      for (let d = 0; d < bodyPartSchedule.length; d++) {
        const dayPlan = bodyPartSchedule[d];
        const dayExercises: PlanExercise[] = [];
        const dayIntensity: Intensity = intensityByDay[d] ?? 'heavy';

        // Header blocks per spec — opening stretch (5 min) then warm-up
        // (5 min). Both skipped for stretching-only sessions, where the
        // budget IS the holds.
        emitOpeningStretch(dayPlan.parts, dayExercises, injuryRehab.compStretches);
        emitWarmupCardio(dayExercises);

        // Injury compensation main-block injection — injected after warm-up,
        // before main block (max 2 per day combined: alwaysInclude + compStrengthen).
        // Adds injected IDs to usedExercisesThisWeek and usedAcrossProgram so
        // the main-block picker cannot select the same exercises again.
        if ((injuryRehab.alwaysInclude.length > 0 || injuryRehab.compStrengthen.length > 0) && workoutStyle !== 'stretching') {
          const dayUsedIds = new Set(dayExercises.map(pe => pe.exercise.id));
          let injectedCount = 0;
          for (const ex of [...injuryRehab.alwaysInclude, ...injuryRehab.compStrengthen]) {
            if (injectedCount >= 2) break;
            if (!dayUsedIds.has(ex.id)) {
              dayUsedIds.add(ex.id);
              dayExercises.push({
                exercise: ex,
                sets: 2,
                reps: 15,
                restSec: 30,
                isRehab: true,
              });
              // Prevent main-block picker from re-selecting these exercises
              usedExercisesThisWeek.add(ex.id);
              usedAcrossProgram.add(ex.id);
              injectedCount++;
            }
          }
        }

        // Main work block
        if (workoutStyle === 'stretching') {
          // STRETCHING-ONLY session, three blocks per spec:
          //   1) LIGHT MOVEMENT (3 min) — gentle walking / arm circles
          //   2) STRETCHING SESSION    — sorted by spec body-part order
          //   3) FINAL REST (2 min)    — savasana / seated breathing

          // 1) Light movement block. Prefer "walking", "arm circle",
          //    "leg swing" matches from the main exercise pool; fall
          //    back to warmupCardioPool, then to a stretch held at 60s.
          const gentleNames = ['walking', 'arm circle', 'leg swing', 'march'];
          const gentlePool = exercises.filter(e => {
            const n = (e.name || '').toLowerCase();
            return gentleNames.some(p => n.includes(p));
          });
          const lightPool = gentlePool.length > 0 ? gentlePool
                          : warmupCardioPool.length > 0 ? warmupCardioPool
                          : stretchPool;
          {
            const usedLight = new Set<string>();
            const fresh = lightPool.filter(e => !usedAcrossProgram.has(e.id));
            const source = fresh.length > 0 ? fresh : lightPool;
            for (const ex of shuffleArray(source)) {
              if (dayExercises.length >= STRETCHING_LIGHT_MOVEMENT_COUNT) break;
              if (usedLight.has(ex.id)) continue;
              usedLight.add(ex.id);
              dayExercises.push({
                exercise: ex, sets: 1, reps: null,
                durationSec: STRETCHING_LIGHT_MOVEMENT_HOLD, restSec: 0,
              });
            }
          }

          // 2) Stretching session. Pick per body part, then sort the
          //    main block by the spec's top-to-bottom body-part order:
          //    neck → shoulders → chest/back → arms → core → hips →
          //    legs → calves.
          const STRETCH_BODY_ORDER = [
            'neck', 'shoulders', 'chest', 'back', 'upper arms', 'lower arms',
            'waist', 'core', 'abs', 'hips', 'upper legs', 'lower legs', 'calves',
          ];
          const orderRank = (bp: string): number => {
            const lower = (bp || '').toLowerCase();
            const idx = STRETCH_BODY_ORDER.indexOf(lower);
            return idx === -1 ? STRETCH_BODY_ORDER.length : idx;
          };
          const target = exercisesPerDay;
          const perPart = Math.max(1, Math.ceil(target / dayPlan.parts.length));
          const mainStretches: PlanExercise[] = [];
          for (const bp of dayPlan.parts) {
            const picked = pickRandomByBodyPart(stretchPool, bp, perPart, usedExercisesThisWeek, undefined, usedAcrossProgram);
            picked.forEach(s => {
              mainStretches.push({
                exercise: s, sets: stretchSets, reps: null,
                durationSec: STRETCH_HOLD, restSec: STRETCH_TRANSITION,
              });
            });
          }
          // Cap, then back-fill if we came up short.
          while (mainStretches.length > target) mainStretches.pop();
          while (mainStretches.length < target) {
            const remaining = stretchPool.filter(s => !usedExercisesThisWeek.has(s.id));
            if (remaining.length === 0) break;
            const s = shuffleArray(remaining)[0];
            usedExercisesThisWeek.add(s.id);
            mainStretches.push({
              exercise: s, sets: stretchSets, reps: null,
              durationSec: STRETCH_HOLD, restSec: STRETCH_TRANSITION,
            });
          }
          mainStretches.sort((a, b) => orderRank(a.exercise.bodyPart) - orderRank(b.exercise.bodyPart));
          mainStretches.forEach(pe => dayExercises.push(pe));
        } else {
          // Standard or HIIT - pick from exercises pool by body parts (skip stretches).
          // HIIT sessions per spec: only exercises tagged HIIT=Yes in the
          // DB are eligible for the circuit. Falls back to the full pool
          // if no HIIT-tagged exercises were fetched (e.g. equipment
          // selection produced none) so the session still generates.
          let workPool = exercises.filter(e => !e.name.toLowerCase().includes('stretch'));
          if (workoutStyle === 'hiit') {
            const hiitOnly = workPool.filter(e => (e.hiit || 'No') === 'Yes');
            if (hiitOnly.length >= 4) workPool = hiitOnly;
          }
          // Cap per body part = min(spec same-muscle cap, even share).
          // Spec: Beginner ≤2, Intermediate ≤3, Advanced ≤4 exercises
          // for the same primary muscle group within a single session.
          const exercisesPerBodyPart = Math.min(
            sameMuscleCap,
            Math.max(1, Math.ceil(exercisesPerDay / dayPlan.parts.length)),
          );
          // Build the MAIN block in a temporary array so we can sort it
          // (compound → isolation/bodyweight → core per spec) and then
          // splice in cardio movements every 3rd slot for Standard with
          // Cardio sessions, before pushing to the day.
          type MainEntry = PlanExercise & { __exType?: ExerciseType };
          const mainBlock: MainEntry[] = [];
          for (const bodyPart of dayPlan.parts) {
            const picked = pickRandomByBodyPart(
              workPool,
              bodyPart,
              exercisesPerBodyPart,
              usedExercisesThisWeek,
              [equipmentRotation],
              usedAcrossProgram
            );
            picked.forEach(ex => {
              if (workoutStyle === 'hiit') {
                // Circuit definition: emit each exercise with sets=1.
                // The circuit is then cycled hiitRounds times below so
                // the player runs ex1→ex2→...→exN→ex1→... per spec
                // ("cycle through circuit exercises, complete all
                // rounds; do not repeat same exercise within same
                // round").
                mainBlock.push({
                  exercise: ex,
                  sets: 1,
                  reps: null,
                  durationSec: hiitWork,
                  restSec: hiitRest,
                });
              } else {
                // Standard: sets/reps + rest are per (level, exercise
                // type) per spec. Tag with __exType so we can sort the
                // main block compound→isolation→core after picking.
                const exType = classifyStandardExercise(ex);
                mainBlock.push({
                  exercise: ex,
                  sets: 0, // placeholder, filled in after sorting
                  reps: 0,
                  restSec: STANDARD_REST_TABLE[level][exType],
                  __exType: exType,
                });
              }
            });
          }

          // Cap the main block at the budgeted exercise count.
          while (mainBlock.length > exercisesPerDay) mainBlock.pop();

          // HIIT: expand the circuit definition (each exercise once,
          // sets=1) into round-robin order — ex1, ex2, ..., exN, ex1,
          // ex2, ..., exN — repeated `setsPerExercise` times (= the
          // spec-table number of rounds). The player then simply walks
          // the list and naturally cycles through rounds without
          // repeating an exercise within the same round.
          if (workoutStyle === 'hiit' && mainBlock.length > 0) {
            const circuit = [...mainBlock];
            mainBlock.length = 0;
            for (let r = 0; r < setsPerExercise; r++) {
              for (const slot of circuit) {
                mainBlock.push({ ...slot });
              }
            }
          }

          // For Standard styles, sort main block compound → isolation /
          // bodyweight → core per spec, then resolve sets/reps with the
          // primary-compound override applied to the first compound.
          if (workoutStyle !== 'hiit') {
            mainBlock.sort((a, b) =>
              ORDER_RANK[a.__exType ?? 'compound'] - ORDER_RANK[b.__exType ?? 'compound']
            );
            let primaryCompoundUsed = false;
            for (const entry of mainBlock) {
              const exType = entry.__exType ?? 'compound';
              let spec = setsTable[exType];
              if (level === 'Advanced' && exType === 'compound' && !primaryCompoundUsed) {
                spec = ADVANCED_PRIMARY_COMPOUND;
                primaryCompoundUsed = true;
              }
              const [repMin, repMax] = spec.repRange;
              let sets = spec.sets;
              // Spec intensity progression — only reduce sets on Light
              // days (-1, floor 1). Moderate keeps full sets (the spec
              // allows -0 or -1; we choose -0 so the user still hits
              // the level-rule volume). Heavy is full sets unchanged.
              if (dayIntensity === 'light') sets = Math.max(1, sets - 1);
              entry.sets = sets;
              entry.reps = repMin + Math.floor(Math.random() * Math.max(1, (repMax - repMin + 1)));
            }
          }

          // Standard with Cardio: insert one cardio movement (30-60s,
          // sets=1, no rest) between every 3rd strength exercise. Uses
          // HIIT-flag exercises from the cardio pool per spec; falls
          // back gracefully if no cardio is available.
          if (workoutStyle === 'standard-cardio' && cardioPool.length > 0) {
            const cardioShuffled = shuffleArray(cardioPool);
            const interleaved: MainEntry[] = [];
            let cardioIdx = 0;
            mainBlock.forEach((entry, i) => {
              interleaved.push(entry);
              // After every 3rd strength exercise (1-indexed), drop in a
              // cardio movement, but skip if it would land at the very
              // end of the main block.
              if ((i + 1) % 3 === 0 && i < mainBlock.length - 1 && cardioIdx < cardioShuffled.length) {
                const cEx = cardioShuffled[cardioIdx++];
                interleaved.push({
                  exercise: cEx,
                  sets: 1,
                  reps: null,
                  durationSec: 45,   // 30-60s midpoint per spec
                  restSec: 0,
                });
              }
            });
            mainBlock.length = 0;
            mainBlock.push(...interleaved);
          }

          // Strip the temporary __exType tag and push to the day.
          mainBlock.forEach(({ __exType, ...pe }) => dayExercises.push(pe));
        }

        // NOTE: post-emission set redistribution has been removed. With
        // the new spec, sets-per-exercise is fixed by (level, exercise
        // type) via STANDARD_SETS_TABLE (plus the Advanced primary-
        // compound override). Mutating sets here would override the
        // spec. The exercise count is still sized from totalWorkingSets,
        // and the safety-net trim below handles any time over-fill.

        // Append the cooldown stretch block (~5 min) to every day. For pure
        // stretching sessions the budget already excluded the cooldown, so
        // these extra holds bring total time back up to the selected duration.
        emitCooldown(dayPlan.parts, dayExercises, injuryRehab.compStretches);

        const dayLabel = workoutStyle === 'stretching' ? `${dayPlan.name} Stretch` : dayPlan.name;

        // Final time-cap safety net: trim main-block exercises only (never
        // the cooldown block) so total session time does not exceed the
        // user's selected duration. Uses the same unified per-set timing
        // model as the budget so the safety net rarely triggers.
        const exerciseTimeSec = (pe: PlanExercise): number => {
          // Time-based exercises (HIIT/Tabata work, stretches, cardio).
          if (pe.reps == null && (pe.durationSec ?? 0) > 0) {
            if (pe.sets <= 1) return pe.durationSec ?? 0;
            // Use this exercise's own restSec (10s transitions for
            // stretches, hiitRest for HIIT/Tabata) — falls back to
            // hiitRest for legacy items missing the field.
            const restPer = pe.restSec ?? hiitRest;
            return pe.sets * ((pe.durationSec ?? 0) + restPer);
          }
          // Rep-based standard exercise: working time + this exercise's
          // own restSec from the spec table. Falls back to the budget
          // proxy when restSec is missing.
          if (pe.restSec != null) {
            const workSec = avgReps * 3;
            return pe.sets * (workSec + pe.restSec);
          }
          return pe.sets * perSetSec;
        };
        const slotTimeSec = (pe: PlanExercise, _idx: number, _len: number): number => {
          // Every slot now stores its own durationSec + restSec, including
          // the three header blocks (opening stretch 25s, warm-up cardio
          // 45s, cooldown per level), so a single proxy works everywhere.
          return exerciseTimeSec(pe);
        };
        let total = dayExercises.reduce((sum, pe, idx) => sum + slotTimeSec(pe, idx, dayExercises.length), 0);
        while (total > totalSec && dayExercises.length > warmupCount + cooldownCount + 1) {
          // Remove the last main-block exercise (the one immediately before
          // the cooldown block) to preserve the cooldown.
          const removeIdx = dayExercises.length - cooldownCount - 1;
          const [removed] = dayExercises.splice(removeIdx, 1);
          if (removed) total -= exerciseTimeSec(removed);
        }

        // === Spec validation checklist ===
        // Verifies the constructed session against every required
        // invariant before it gets pushed onto the week. Failures are
        // logged with a clear prefix so they're easy to spot during QA;
        // we don't hard-throw because the safety-net trim above can
        // legitimately reduce a session below ideal counts when the
        // user picked an unusually short duration. The checks still
        // catch real generator bugs (e.g. wrong block ordering, HIIT
        // pool leak, count-table over-cap).
        const issues: string[] = [];
        // Header counts.
        const headOpening = dayExercises.slice(0, openingStretchCount);
        const headWarmup  = dayExercises.slice(openingStretchCount, openingStretchCount + mainWarmupCount);
        const tailCooldown = dayExercises.slice(dayExercises.length - cooldownCount);
        if (!isStretchingOnly) {
          if (headOpening.length < 4) issues.push(`opening stretch < 4 (got ${headOpening.length})`);
          if (headWarmup.length < 1)  issues.push(`warm-up missing (got ${headWarmup.length})`);
          if (tailCooldown.length < 4) issues.push(`cooldown stretch < 4 (got ${tailCooldown.length})`);
        }
        // Total estimated time within budget.
        if (total > totalSec) issues.push(`estimated time ${total}s > budget ${totalSec}s`);
        // Main-block exercise count vs spec cap.
        const mainCount = dayExercises.length - (isStretchingOnly ? 0 : openingStretchCount + mainWarmupCount + cooldownCount);
        if (workoutStyle !== 'hiit' && !isStretchingOnly) {
          // Standard: mainCount should not exceed the spec cap
          // (exercisesPerDay is already clamped to the table max).
          if (mainCount > exercisesPerDay) issues.push(`main count ${mainCount} > cap ${exercisesPerDay}`);
        }
        // HIIT: only HIIT=Yes exercises in the main circuit; expanded
        // length should be circuit × rounds.
        if (workoutStyle === 'hiit') {
          const main = dayExercises.slice(openingStretchCount + mainWarmupCount, dayExercises.length - cooldownCount);
          const nonHiit = main.filter(pe => (pe.exercise.hiit || 'No') !== 'Yes');
          // Tolerate the "fallback when <4 HIIT-tagged available" case.
          if (nonHiit.length > 0 && main.some(pe => (pe.exercise.hiit || 'No') === 'Yes')) {
            issues.push(`HIIT main contains ${nonHiit.length} non-HIIT-tagged exercise(s)`);
          }
        }
        // Stretching: only stretch-tagged exercises in the main session.
        if (isStretchingOnly) {
          const mainStretchEntries = dayExercises.slice(STRETCHING_LIGHT_MOVEMENT_COUNT);
          const nonStretch = mainStretchEntries.filter(pe => {
            const flagged = (pe.exercise.stretching || 'No') === 'Yes';
            const named   = pe.exercise.name.toLowerCase().includes('stretch');
            return !(flagged || named);
          });
          if (nonStretch.length > 0) issues.push(`stretching main contains ${nonStretch.length} non-stretch exercise(s)`);
        }
        // Compound-before-isolation, core-last in the standard main block.
        if (workoutStyle !== 'hiit' && !isStretchingOnly) {
          const main = dayExercises.slice(openingStretchCount + mainWarmupCount, dayExercises.length - cooldownCount);
          const types = main.map(pe => classifyStandardExercise(pe.exercise));
          const lastCompoundIdx = types.lastIndexOf('compound');
          const firstIsolationIdx = types.findIndex(t => t === 'isolation' || t === 'bodyweight');
          if (lastCompoundIdx !== -1 && firstIsolationIdx !== -1 && lastCompoundIdx > firstIsolationIdx) {
            issues.push('compound appears after isolation in main block');
          }
          const coreIdxs = types.map((t, i) => t === 'core' ? i : -1).filter(i => i !== -1);
          const nonCoreAfterCore = coreIdxs.length > 0
            ? types.slice(coreIdxs[0]).some(t => t !== 'core')
            : false;
          if (nonCoreAfterCore) issues.push('non-core exercise appears after a core exercise in main block');
        }
        // No consecutive day with same primary muscle group.
        if (week.length > 0) {
          const prevDay = week[week.length - 1];
          const prevParts = new Set((bodyPartSchedule[d - 1]?.parts ?? []).map(p => p.toLowerCase()));
          const curParts = (dayPlan.parts ?? []).map(p => p.toLowerCase());
          const overlap = curParts.filter(p => prevParts.has(p));
          if (overlap.length > 0) {
            issues.push(`shares primary muscle group(s) with previous day: ${overlap.join(', ')}`);
          }
          void prevDay;
        }

        if (issues.length > 0) {
          console.warn(`[validateSession] ${dayLabel}:`, issues);
        }

        week.push({
          name: dayLabel,
          exercises: dayExercises,
          intensity: dayIntensity,
        });
      }
      
      weeks.push(week);
      // Promote this week's used exercises into the program-level set so
      // subsequent weeks pick fresh exercises when possible.
      usedExercisesThisWeek.forEach(id => usedAcrossProgram.add(id));
    }
    
    // Stash style metadata via the equipment label (no schema change needed)
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
        // Map this body-part day to the user's selected weekday for that slot
        const assignedDay = (workoutDays[dayIndex] || workoutDays[0] || 'monday').toLowerCase();
        day.exercises.forEach((planExercise) => {
          // Per-exercise rest is now resolved at emission time (HIIT rest,
          // standard rest table by exercise type, or 10s stretch
          // transition) and stored on planExercise.restSec. Persist it as
          // a "<sec>s" string so the existing PreBuiltExercise.rest
          // contract still parses cleanly downstream.
          const restTime = `${planExercise.restSec ?? 60}s`;

          allExercises.push({
            name: planExercise.exercise.name,
            sets: planExercise.sets,
            reps: planExercise.reps ?? 0,
            duration: planExercise.durationSec,
            rest: restTime,
            day: `Week${weekIndex + 1}-${day.name}`,
            bodyPart: planExercise.exercise.bodyPart,
            equipment: [planExercise.exercise.equipment],
            gifUrl: planExercise.exercise.gifUrl,
            weekNumber: weekIndex + 1,
            assignedDay,
            // Tag injury-compensation exercises so the saved plan
            // exercise rows carry an identifiable note in the day view.
            notes: planExercise.isRehab ? 'Injury compensation rehab' : undefined,
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
      // First create the plan. Append injury guidance to the description so
      // it is persisted in the DB and visible in the saved-plan list/detail view.
      const planDescription = preBuiltPlan.stretchPolicy
        ? `${preBuiltPlan.description}\n\nInjury Guidance: ${preBuiltPlan.stretchPolicy}`
        : preBuiltPlan.description;
      const planResponse = await apiRequest('POST', '/api/fitness-plans', {
        name: preBuiltPlan.name,
        description: planDescription,
        isPublic: false
      });

      // Build all exercise payloads up front
      const exercisePayloads = preBuiltPlan.exercises.map((exercise, i) => {
        const trainingDay = exercise.assignedDay
          || getExerciseTrainingDay(i, preBuiltPlan.startDay, preBuiltPlan.schedule);

        const isTimeBased = (!exercise.reps || exercise.reps === 0) && !!exercise.duration;
        const repsValue = isTimeBased
          ? `${exercise.duration}s`
          : String(exercise.reps);
        const minutesValue = isTimeBased && exercise.duration
          ? Math.max(1, Math.round((exercise.duration * exercise.sets) / 60))
          : exercise.duration;

        return {
          exerciseId: `prebuilt-${Date.now()}-${i}`,
          exerciseName: exercise.name,
          imageUrl: exercise.gifUrl || null,
          targetMuscle: exercise.bodyPart,
          bodyPart: exercise.bodyPart,
          equipment: (exercise.equipment ?? []).join(', '),
          sets: exercise.sets,
          reps: repsValue,
          minutes: minutesValue,
          restTime: (() => {
            // Preserve a legitimate 0 (e.g. cardio block has no inter-set
            // rest). parseInt(...) || 60 would coerce 0 to the 60-second
            // fallback and break consistency with the generator.
            const parsed = Number.parseInt(String(exercise.rest ?? '60').replace(/[^0-9]/g, ''), 10);
            return Number.isNaN(parsed) ? 60 : parsed;
          })(),
          notes: exercise.notes
            ? `${exercise.notes} | ${exercise.rest} rest - Training Day: ${exercise.day}`
            : `${exercise.rest} rest - Training Day: ${exercise.day}`,
          daysOfWeek: [trainingDay],
          weekNumber: exercise.weekNumber || 1,
          orderIndex: i,
        };
      });

      // Send all exercises in a single bulk request. This avoids hitting
      // the per-IP rate limiter (200 req/min) when a plan has 100+
      // exercises and is also one DB write instead of N.
      // When the plan contains injury-compensation exercises the server may
      // return 409 INJURY_RISK because those exercises were specifically
      // curated for the user's condition. In that case we retry with the
      // acknowledgeInjuryRisk flag — the generator already filtered the
      // main-block picks for safety, so the override is appropriate.
      if (exercisePayloads.length > 0) {
        const bulkUrl = `/api/fitness-plans/${planResponse.id}/exercises/bulk`;
        try {
          await apiRequest('POST', bulkUrl, { exercises: exercisePayloads });
        } catch (err: any) {
          // apiRequest throws on non-2xx. If the status was 409 and the plan
          // has injury-rehab exercises, retry with the override flag.
          const status = err?.status ?? err?.response?.status;
          if (status === 409 && preBuiltPlan.stretchPolicy) {
            await apiRequest('POST', bulkUrl, {
              exercises: exercisePayloads,
              acknowledgeInjuryRisk: true,
            });
          } else {
            throw err;
          }
        }
      }

      return planResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api', 'fitness-plans'] });
      toast({
        title: "Plan Created!",
        description: "Your pre-built workout plan has been added to My Plans.",
      });
      // Close any open preview dialog and send the user back to the
      // Workout tab at the top of the page so they don't accidentally
      // create the same plan again.
      setSelectedPlanForPreview(null);
      setActiveFitnessTab('workout');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    onError: (error: any) => {
      const detail = error?.message || error?.toString?.() || 'Unknown error';
      toast({
        title: "Error",
        description: `Failed to create plan: ${detail}`,
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
            <div className="bg-[#FDD000] text-black p-8 rounded-sm border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
              <div className="animate-spin rounded-sm h-12 w-12 border-4 border-black border-t-transparent relative z-10"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Maintenance mode — admins still see the full page so they can keep working,
  // but everyone else sees a simple "currently under Maintenance" message.
  if (fitnessMaintenanceMode && (authUser as any)?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-black pb-20">
        <div className="liquid-header px-4 pt-6 pb-6 border-b-4 border-[#FDD000]">
          <BackButton />
          <div className="text-center">
            <h1 className="text-3xl font-black text-white mb-2 uppercase tracking-wide relative z-10">
              Fitness Center
            </h1>
          </div>
        </div>
        <div className="px-4 pt-12 flex items-center justify-center" data-testid="fitness-maintenance-screen">
          <div className="w-full max-w-md bg-[#FDD000] border-4 border-black rounded-sm shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-8 text-center">
            <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-black flex items-center justify-center">
              <Settings className="w-7 h-7 text-[#FDD000]" />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-black mb-2">
              Fitness Page Currently Under Maintenance
            </h2>
            <p className="text-black/80 font-semibold text-sm">
              We're making improvements. Please check back soon.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-20">
      {/* Header with liquid effect */}
      <div className="liquid-header px-4 pt-6 pb-6 border-b-4 border-[#FDD000]">
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
              className="liquid-black px-6 py-3 rounded-sm border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all text-[#FDD000] font-black uppercase text-sm flex items-center"
              data-testid="button-fitness-pillar"
            >
              <Info className="w-5 h-5 mr-2" />
              Fitness Pillar
            </button>
            {!fitnessCoachHidden && (
              <button
                onClick={() => setShowFitnessCoachDialog(true)}
                className="liquid-black px-6 py-3 rounded-sm border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all text-[#FDD000] font-black uppercase text-sm flex items-center"
                data-testid="button-fitness-coach"
              >
                <User className="w-5 h-5 mr-2" />
                Fitness Coach
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 pt-6 space-y-6 pb-20">

      {/* Fitness Membership Paywall — hidden during the app tour so users can preview */}
      {!membershipLoading && !hasMembership && !isTourActive && (
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-full max-w-md">
            <div className="bg-[#FDD000] border-4 border-black rounded-sm shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6 text-center mb-4">
              <Lock className="w-12 h-12 mx-auto mb-4 text-black" />
              <h2 className="text-2xl font-black uppercase tracking-tight text-black mb-2">Fitness Community</h2>
              <p className="text-black font-semibold text-sm mb-1">This section is a paid add-on</p>
              <p className="text-black/70 text-xs mb-6">Not included in your main subscription</p>

              <div className="bg-black rounded-sm p-4 mb-6 text-left space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#FDD000] flex-shrink-0" />
                  <span className="text-white text-sm">Full exercise library (330+ exercises)</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#FDD000] flex-shrink-0" />
                  <span className="text-white text-sm">Custom workout plan builder</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#FDD000] flex-shrink-0" />
                  <span className="text-white text-sm">Progress tracking & completion</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#FDD000] flex-shrink-0" />
                  <span className="text-white text-sm">Pre-built plans by our fitness coach</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#FDD000] flex-shrink-0" />
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
                className="w-full h-14 bg-black text-[#FDD000] font-black text-lg uppercase tracking-wide border-2 border-black shadow-[3px_3px_0px_0px_rgba(253,208,0,0.6)] hover:bg-zinc-900 hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all"
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
          <Dumbbell className="w-8 h-8 text-[#FDD000] animate-pulse" />
        </div>
      )}

      {/* Fitness Pillar Dialog — available to all users */}
      <Dialog open={showFitnessPillarDialog} onOpenChange={setShowFitnessPillarDialog}>
        <DialogContent className="w-[95vw] max-w-2xl h-auto max-h-[85svh] flex flex-col p-0 rounded-sm border-2 border-black bg-black">
          <DialogHeader className="bg-[#FDD000] text-black px-6 py-4 border-b border-[#FDD000] flex-shrink-0">
            <DialogTitle className="text-xl font-black uppercase tracking-wide text-black relative z-10">
              Man Up God's Way Fitness Pillar
            </DialogTitle>
          </DialogHeader>
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 bg-black">
              <h2 className="text-2xl font-black text-[#FDD000] uppercase tracking-wide text-center">
                Strength for the Glory of God
              </h2>
              
              <p className="text-white leading-relaxed">
                At Man Up God's Way, we believe physical strength is not optional for a godly man. The body is not separate from faith. It is a stewardship entrusted by God and a tool He uses to form discipline, endurance, and leadership.
              </p>
              
              <p className="text-white leading-relaxed">
                Scripture is clear that the Christian life requires training, self-control, and perseverance. While godliness is of greatest value, Scripture also affirms the discipline of the body when it serves obedience and purpose.
              </p>
              
              <blockquote className="bg-[#FDD000] text-black p-4 rounded-sm border-l-4 border-black overflow-hidden">
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
              
              <blockquote className="bg-[#FDD000] text-black p-4 rounded-sm border-l-4 border-black overflow-hidden">
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
              
              <blockquote className="bg-[#FDD000] text-black p-4 rounded-sm border-l-4 border-black overflow-hidden">
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
              
              <blockquote className="bg-[#FDD000] text-black p-4 rounded-sm border-l-4 border-black overflow-hidden">
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
            <DialogHeader className="bg-[#FDD000] text-black px-6 py-4 border-b border-[#FDD000] flex-shrink-0">
              <DialogTitle className="text-xl font-black uppercase tracking-wide text-black relative z-10">
                Meet Your Fitness Coach
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 bg-black">
              {/* Coach Photo and Name */}
              <div className="text-center">
                <div className="w-40 h-40 mx-auto mb-4 rounded-sm border-4 border-[#FDD000] overflow-hidden shadow-[4px_4px_0px_0px_rgba(253,208,0,1)]">
                  <img 
                    src={seanMcManusPhoto} 
                    alt="Sean McManus" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <h2 className="text-2xl font-black text-[#FDD000] uppercase tracking-wide">
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
              
              <div className="bg-[#FDD000] text-black p-4 rounded-sm border-l-4 border-black overflow-hidden">
                <p className="text-black font-bold relative z-10">
                  Sean believes the body is not separate from faith. It is one of the primary tools God uses to shape discipline, consistency, and leadership in a man's life.
                </p>
              </div>
              
              <div className="space-y-2">
                <p className="text-[#FDD000] font-black uppercase">This is not about vanity.</p>
                <p className="text-white leading-relaxed">
                  It is about honoring God, keeping your word, and leading your family with strength, energy, and conviction.
                </p>
              </div>
              
              <div className="bg-[#FDD000] text-black p-4 rounded-sm border-l-4 border-black overflow-hidden">
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
          <div className="bg-zinc-900 border border-[#FDD000]/30 rounded-sm px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#FDD000]" />
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
        <Tabs
          value={activeFitnessTab}
          onValueChange={setActiveFitnessTab}
          className="w-full"
        >
          <TabsList className="grid grid-cols-3 w-full h-auto p-2 bg-transparent gap-2 border-2 border-[#FDD000] rounded-sm">
            <TabsTrigger value="workout" className="flex flex-col items-center gap-1.5 py-3 px-1 rounded-sm border-2 border-black bg-zinc-900 data-[state=active]:bg-[#FDD000] data-[state=active]:border-[#FDD000] data-[state=active]:text-black text-white font-black uppercase text-[10px] tracking-wide h-auto">
              <Dumbbell className="w-5 h-5" />
              Workout
            </TabsTrigger>
            <TabsTrigger value="community" className="flex flex-col items-center gap-1.5 py-3 px-1 rounded-sm border-2 border-black bg-zinc-900 data-[state=active]:bg-[#FDD000] data-[state=active]:border-[#FDD000] data-[state=active]:text-black text-white font-black uppercase text-[10px] tracking-wide h-auto">
              <Users className="w-5 h-5" />
              Community
            </TabsTrigger>
            <TabsTrigger value="exercises" className="flex flex-col items-center gap-1.5 py-3 px-1 rounded-sm border-2 border-black bg-zinc-900 data-[state=active]:bg-[#FDD000] data-[state=active]:border-[#FDD000] data-[state=active]:text-black text-white font-black uppercase text-[10px] tracking-wide h-auto">
              <Search className="w-5 h-5" />
              Exercises
            </TabsTrigger>
            <TabsTrigger value="favorites" className="flex flex-col items-center gap-1.5 py-3 px-1 rounded-sm border-2 border-black bg-zinc-900 data-[state=active]:bg-[#FDD000] data-[state=active]:border-[#FDD000] data-[state=active]:text-black text-white font-black uppercase text-[10px] tracking-wide h-auto">
              <Heart className="w-5 h-5" />
              Favorites
            </TabsTrigger>
            <TabsTrigger value="pre-built-plans" className="flex flex-col items-center gap-1.5 py-3 px-1 rounded-sm border-2 border-black bg-zinc-900 data-[state=active]:bg-[#FDD000] data-[state=active]:border-[#FDD000] data-[state=active]:text-black text-white font-black uppercase text-[10px] tracking-wide h-auto">
              <BookOpen className="w-5 h-5" />
              Plans
            </TabsTrigger>
            <TabsTrigger value="my-plans" className="flex flex-col items-center gap-1.5 py-3 px-1 rounded-sm border-2 border-black bg-zinc-900 data-[state=active]:bg-[#FDD000] data-[state=active]:border-[#FDD000] data-[state=active]:text-black text-white font-black uppercase text-[10px] tracking-wide h-auto">
              <List className="w-5 h-5" />
              My Plans
            </TabsTrigger>
            <TabsTrigger value="nutrition" className="flex flex-col items-center gap-1.5 py-3 px-1 rounded-sm border-2 border-black bg-zinc-900 data-[state=active]:bg-[#FDD000] data-[state=active]:border-[#FDD000] data-[state=active]:text-black text-white font-black uppercase text-[10px] tracking-wide h-auto">
              <Apple className="w-5 h-5" />
              Nutrition
            </TabsTrigger>
            <TabsTrigger value="intake" className="flex flex-col items-center gap-1.5 py-3 px-1 rounded-sm border-2 border-black bg-zinc-900 data-[state=active]:bg-[#FDD000] data-[state=active]:border-[#FDD000] data-[state=active]:text-black text-white font-black uppercase text-[10px] tracking-wide h-auto">
              <Utensils className="w-5 h-5" />
              Intake
            </TabsTrigger>
            <TabsTrigger value="health" className="flex flex-col items-center gap-1.5 py-3 px-1 rounded-sm border-2 border-black bg-zinc-900 data-[state=active]:bg-[#FDD000] data-[state=active]:border-[#FDD000] data-[state=active]:text-black text-white font-black uppercase text-[10px] tracking-wide h-auto">
              <Activity className="w-5 h-5" />
              Health
            </TabsTrigger>
          </TabsList>

          {/* Daily Workout Tab */}
          <TabsContent value="workout" className="space-y-6">
            {/* Today's Workout Header */}
            <div className="flex items-center mb-6 liquid-black p-4 rounded-sm border-2 border-black overflow-hidden">
              <Dumbbell className="w-6 h-6 text-[#FDD000] mr-2 relative z-10" />
              <h2 className="text-xl font-black text-white uppercase tracking-wide relative z-10">Today's Workout</h2>
              <div className="ml-auto text-sm text-[#FDD000] font-bold relative z-10">
                {getCurrentDayOfWeek().charAt(0).toUpperCase() + getCurrentDayOfWeek().slice(1)}
              </div>
            </div>

            {(() => {
              const todaysWorkouts = getTodaysWorkoutsByPlan();
              
              if (todaysWorkouts.length === 0) {
                return (
                  <div className="text-center py-12 bg-[#FDD000] text-black rounded-sm border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
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
                  {todaysWorkouts.map(({ plan, exercises }) => {
                    const currentWeek = getCurrentWeek(plan, plan.exercises || []);
                    const estSec = exercises.reduce((sum, ex) => {
                      const sets = ex.sets ?? 3;
                      const rest = ex.restTime ?? 60;
                      // Time-based reps look like "30s"; otherwise assume ~30s of working time per set
                      const repsStr = String(ex.reps ?? '');
                      const timeMatch = repsStr.match(/^(\d+)s$/);
                      const work = timeMatch ? parseInt(timeMatch[1], 10) : 30;
                      return sum + sets * (work + rest);
                    }, 0);
                    const estimatedMinutes = Math.max(1, Math.round(estSec / 60));
                    return (
                      <div
                        key={plan.id}
                        className="liquid-black rounded-sm border-2 border-black shadow-[4px_4px_0px_0px_rgba(253,208,0,0.6)] p-5"
                        data-testid={`card-todays-plan-${plan.id}`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p
                              className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em] mb-1"
                              data-testid={`text-today-date-${plan.id}`}
                            >
                              {format(new Date(), 'EEEE • MMM d')}
                            </p>
                            <h3 className="text-lg font-black text-white uppercase tracking-tight" data-testid={`text-plan-name-${plan.id}`}>
                              {plan.name}
                            </h3>
                            <p className="text-xs font-bold text-[#FDD000] uppercase tracking-wider mt-1">
                              Week {currentWeek} of 4 • {exercises.length} exercise{exercises.length === 1 ? '' : 's'}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 bg-black/40 rounded-sm px-2 py-1 border border-zinc-700">
                            <Clock className="w-3 h-3 text-[#FDD000]" />
                            <span className="text-xs font-black text-[#FDD000]">~{estimatedMinutes}m</span>
                          </div>
                        </div>

                        <div className="space-y-1 mb-4 max-h-40 overflow-y-auto">
                          {exercises.map((ex, i) => {
                            const weekday = (ex.daysOfWeek && ex.daysOfWeek[0]) || getCurrentDayOfWeek();
                            // Evaluate this plan exercise against user's recorded injuries
                            const exInjuryEval = fitnessPageInjuries.length > 0
                              ? evaluateExerciseAgainstInjuries(
                                  { name: ex.exerciseName ?? '', bodyPart: ex.bodyPart ?? '', hiit: 'No', stretching: 'No', equipment: ex.equipment ?? '', level: '' },
                                  fitnessPageInjuries
                                )
                              : null;
                            return (
                              <div key={ex.id} className="flex items-center gap-2 text-sm text-white/90">
                                <span className="text-[#FDD000] font-black w-5">{i + 1}.</span>
                                <span className="flex-1 truncate">{ex.exerciseName}</span>
                                {exInjuryEval && exInjuryEval.status !== 'allowed' && (
                                  <span
                                    className={`text-[9px] font-black uppercase tracking-wider px-1 py-0.5 rounded-sm border ${
                                      exInjuryEval.status === 'blocked'
                                        ? 'bg-red-900/40 text-red-400 border-red-700/50'
                                        : exInjuryEval.status === 'modify'
                                        ? 'bg-yellow-900/30 text-yellow-400 border-yellow-700/40'
                                        : 'bg-green-900/30 text-green-400 border-green-700/40'
                                    }`}
                                    title={exInjuryEval.reasons[0] ?? 'Injury note'}
                                  >
                                    {exInjuryEval.status === 'blocked' ? '🔴' : exInjuryEval.status === 'modify' ? '🟡' : '🟢'}
                                  </span>
                                )}
                                <span
                                  className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-[#FDD000]/15 text-[#FDD000] border border-[#FDD000]/40"
                                  data-testid={`badge-weekday-${ex.id}`}
                                >
                                  {weekday.slice(0, 3)}
                                </span>
                                <span className="text-xs text-zinc-400 font-bold tabular-nums">
                                  {ex.sets}×{ex.reps}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex gap-2">
                          <Button
                            onClick={() => {
                              setDetailPlan(plan);
                              setDetailExercises(exercises);
                              setDetailInjEvalMap({});
                              if (fitnessPageInjuries.length > 0 && exercises.length > 0) {
                                apiRequest('POST', '/api/exercises/evaluate-injuries', {
                                  exercises: exercises.map(ex => ({
                                    exerciseId: ex.exerciseId,
                                    exerciseName: ex.exerciseName,
                                    bodyPart: ex.bodyPart,
                                    equipment: ex.equipment,
                                  })),
                                })
                                  .then((data: any) => setDetailInjEvalMap(data ?? {}))
                                  .catch(() => {});
                              }
                            }}
                            variant="outline"
                            className="flex-1 border-2 border-[#FDD000]/60 text-[#FDD000] hover:bg-[#FDD000]/10 font-black uppercase tracking-wide"
                            data-testid={`button-view-plan-${plan.id}`}
                          >
                            View Details
                          </Button>
                          <Button
                            onClick={() => {
                              setPlayerPlan(plan);
                              setPlayerExercises(exercises);
                              setPlayerOpen(true);
                            }}
                            className="flex-1 bg-[#FDD000] hover:bg-[#FDD000]/90 text-black font-black uppercase tracking-wide border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                            data-testid={`button-start-workout-${plan.id}`}
                          >
                            <Play className="w-5 h-5 mr-2 fill-black" />
                            Start
                          </Button>
                        </div>
                      </div>
                    );
                  })}
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
                <h3 className="text-lg font-black text-[#FDD000] uppercase tracking-wide border-b border-[#FDD000]/30 pb-2">
                  Fitness Plans by Coach
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {adminPlans.map((plan) => {
                    const alreadyPurchased = purchasedPlanIds.includes(plan.id);
                    const isFree = !plan.isPurchasable;
                    return (
                      <div key={plan.id} className="bg-zinc-900 border-2 border-[#FDD000]/30 rounded-sm overflow-hidden">
                        {plan.thumbnailUrl && (
                          <img src={plan.thumbnailUrl} alt={plan.title} className="w-full h-32 object-cover" />
                        )}
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h4 className="font-black text-white uppercase text-sm">{plan.title}</h4>
                            {isFree ? (
                              <Badge className="bg-green-600 text-white text-xs flex-shrink-0">Included</Badge>
                            ) : alreadyPurchased ? (
                              <Badge className="bg-[#FDD000] text-black text-xs flex-shrink-0">Purchased</Badge>
                            ) : (
                              <Badge className="bg-black border border-[#FDD000] text-[#FDD000] text-xs flex-shrink-0">
                                ${((plan.price || 0) / 100).toFixed(2)}
                              </Badge>
                            )}
                          </div>
                          {plan.description && (
                            <p className="text-white/60 text-xs mb-3 line-clamp-2">{plan.description}</p>
                          )}
                          <div className="flex flex-wrap gap-1 mb-3">
                            <Badge variant="outline" className="text-[#FDD000] border-[#FDD000]/40 text-xs capitalize">{plan.difficulty}</Badge>
                            <Badge variant="outline" className="text-white/50 border-white/20 text-xs capitalize">{plan.category}</Badge>
                            {plan.duration && <Badge variant="outline" className="text-white/50 border-white/20 text-xs">{plan.duration} min</Badge>}
                          </div>
                          {(isFree || alreadyPurchased) && plan.downloadUrl ? (
                            <a href={plan.downloadUrl} download={plan.downloadFileName || plan.title} target="_blank" rel="noreferrer">
                              <Button size="sm" className="w-full bg-[#FDD000] text-black font-black border-2 border-black">
                                <Download className="w-4 h-4 mr-2" />
                                Download Plan
                              </Button>
                            </a>
                          ) : !isFree && !alreadyPurchased ? (
                            <Button
                              size="sm"
                              className="w-full bg-[#FDD000] text-black font-black border-2 border-black"
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
                <div className="border-t border-[#FDD000]/30 pt-4">
                  <h3 className="text-lg font-black text-[#FDD000] uppercase tracking-wide pb-2">Build Your Own Plan</h3>
                </div>
              </div>
            )}
            {/* Plan Builder — all options in one box */}
            <div className="rounded-sm border-2 border-zinc-700 overflow-hidden">
              {/* Box header */}
              <div className="bg-[#FDD000] px-4 py-3 border-b-2 border-black">
                <div className="flex items-center gap-2">
                  <Dumbbell className="w-4 h-4 text-black" />
                  <h2 className="font-black text-black uppercase tracking-tight text-base">Build Your Workout Plan</h2>
                </div>
              </div>

              <div className="bg-zinc-900 divide-y divide-zinc-700">

                {/* 0. Injuries */}
                <InjuriesPanel />

                {/* 1. Workout Style */}
                <div className="px-4 py-4">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Workout Style</p>
                  <Select
                    value={selectedWorkoutStyle}
                    onValueChange={(value) => {
                      setSelectedWorkoutStyle(value);
                      // If switching away from HIIT while Tabata is selected,
                      // reset level to avoid an invalid selection.
                      if (value !== 'hiit' && selectedLevel === 'tabata') {
                        setSelectedLevel('');
                      }
                      // Stretching has no fitness-level distinction in our
                      // exercise library (Advanced bodyweight stretches don't
                      // exist), so auto-pick Beginner pacing internally and
                      // hide the question. If switching away from stretching,
                      // clear the auto-pick so the user makes an explicit
                      // choice for the new style.
                      if (value === 'stretching') {
                        setSelectedLevel('beginner');
                      } else if (selectedWorkoutStyle === 'stretching' && selectedLevel === 'beginner') {
                        setSelectedLevel('');
                      }
                    }}
                  >
                    <SelectTrigger className="w-full bg-black border-zinc-600 text-white" data-testid="select-workout-style">
                      <SelectValue placeholder="Select style" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard-cardio">Standard Workout (with Cardio)</SelectItem>
                      <SelectItem value="standard-no-cardio">Standard Workout (no Cardio)</SelectItem>
                      <SelectItem value="hiit">HIIT (Time-Based)</SelectItem>
                      <SelectItem value="stretching">Stretching</SelectItem>
                    </SelectContent>
                  </Select>
                  {selectedWorkoutStyle === 'stretching' && (
                    <p className="text-[10px] text-zinc-400 mt-2 italic">Stretching defaults to Bodyweight equipment.</p>
                  )}
                  {selectedWorkoutStyle === 'hiit' && (
                    <p className="text-[10px] text-zinc-400 mt-2 italic">HIIT uses 30-second work intervals with rest by level (Beginner 30s / Intermediate 20s / Advanced 10s / Tabata 10s with 20s work).</p>
                  )}
                  {selectedWorkoutStyle === 'standard-cardio' && (
                    <p className="text-[10px] text-zinc-400 mt-2 italic">Cardio sessions are scheduled every other workout day.</p>
                  )}
                </div>

                {/* 2. Fitness Level — hidden for Stretching since stretches
                    don't differ by level in our exercise library. */}
                {selectedWorkoutStyle !== 'stretching' && (
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
                        {selectedWorkoutStyle === 'hiit' && (
                          <SelectItem value="tabata" data-testid="option-level-tabata">Tabata (Advanced)</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* 2. Available Equipment */}
                <div className="px-4 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Available Equipment</p>
                    {selectedPlanEquipment.length > 0 && (
                      <span className="text-[10px] font-black text-[#FDD000] uppercase">
                        {selectedPlanEquipment.length} selected
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[...equipments].sort((a: string, b: string) => a.localeCompare(b)).map((equipment: string) => {
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
                            className="border-zinc-500 data-[state=checked]:bg-[#FDD000] data-[state=checked]:border-[#FDD000]"
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
                      <span className="text-[10px] font-black text-[#FDD000] uppercase">
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
                            className="border-zinc-500 data-[state=checked]:bg-[#FDD000] data-[state=checked]:border-[#FDD000]"
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
                    <CardContent className="pt-5 pb-4 space-y-4">
                      {/* Title row */}
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-black font-black text-lg leading-snug flex-1">{plan.name}</h3>
                        <span className="shrink-0 text-[11px] font-bold uppercase tracking-widest bg-black/15 text-black rounded-full px-3 py-1">
                          {plan.duration}
                        </span>
                      </div>

                      {/* Compact stat pills */}
                      <div className="flex flex-wrap gap-2 text-[13px]">
                        {[
                          { label: 'Level', value: plan.level },
                          { label: 'Days/wk', value: String(plan.workoutsPerWeek) },
                          { label: 'Equipment', value: plan.equipment },
                          { label: 'Starts', value: plan.startDay },
                        ].map(({ label, value }) => (
                          <div key={label} className="flex items-center gap-1.5 bg-black/10 rounded-full px-3 py-1">
                            <span className="text-black/50 text-[10px] uppercase tracking-wide font-bold">{label}</span>
                            <span className="text-black font-bold capitalize">{value}</span>
                          </div>
                        ))}
                      </div>

                      {/* Day chips — abbreviated */}
                      <div className="flex flex-wrap gap-1.5">
                        {(plan.schedule || []).map((day, dayIndex) => (
                          <span key={dayIndex} className="px-2.5 py-1 bg-black/15 rounded-md text-black text-xs font-bold capitalize">
                            {day.slice(0, 3)}
                          </span>
                        ))}
                      </div>

                      {/* Injury rehab coaching note */}
                      {plan.stretchPolicy && (
                        <div className="flex items-start gap-2 bg-black/10 border border-black/20 rounded-md px-3 py-2">
                          <span className="text-base shrink-0">🩺</span>
                          <p className="text-[11px] font-semibold text-black/80 leading-snug">{plan.stretchPolicy}</p>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 pt-1">
                        <Button
                          onClick={() => handleCreatePlanFromPrebuilt(plan)}
                          disabled={createPrebuiltPlanMutation.isPending}
                          className="bg-black hover:bg-black/80 text-[#FDD000] font-bold"
                          data-testid={`button-create-prebuilt-plan-${index}`}
                        >
                          {createPrebuiltPlanMutation.isPending ? "Creating..." : "Create This Plan"}
                        </Button>
                        <Button
                          onClick={() => setSelectedPlanForPreview(plan)}
                          variant="outline"
                          className="border-black/30 text-black hover:bg-black/10 font-semibold"
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
                    {selectedWorkoutStyle !== 'stretching' && (
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${selectedLevel ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                        <span>Fitness Level</span>
                      </div>
                    )}
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
              <div>
                <h2 className="text-xl font-black text-white uppercase tracking-tight">My Fitness Plans</h2>
                <p className="text-white/40 text-xs mt-0.5">Build and manage your personal workout plans</p>
              </div>
              <Link href="/create-plan">
                <Button
                  className="bg-[#FDD000] hover:bg-yellow-300 text-black font-black uppercase text-xs tracking-wide rounded-sm border-2 border-black"
                  data-testid="button-create-plan"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Create Plan
                </Button>
              </Link>
            </div>

            {/* Create Plan Modal */}
            {showCreatePlan && (
              <div className="bg-zinc-900 rounded-sm border-2 border-[#FDD000]/60 p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1 h-5 bg-[#FDD000] rounded-full" />
                  <h3 className="font-black text-white uppercase tracking-tight">New Fitness Plan</h3>
                </div>
                <div>
                  <label className="block text-xs font-black text-white/60 uppercase tracking-wider mb-1">Plan Name</label>
                  <Input
                    value={newPlanName}
                    onChange={(e) => setNewPlanName(e.target.value)}
                    placeholder="Enter plan name..."
                    className="bg-zinc-800 border-2 border-zinc-700 text-white placeholder:text-white/30 rounded-sm focus:border-[#FDD000]"
                    data-testid="input-plan-name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-white/60 uppercase tracking-wider mb-1">Description (optional)</label>
                  <Input
                    value={newPlanDescription}
                    onChange={(e) => setNewPlanDescription(e.target.value)}
                    placeholder="Enter plan description..."
                    className="bg-zinc-800 border-2 border-zinc-700 text-white placeholder:text-white/30 rounded-sm focus:border-[#FDD000]"
                    data-testid="input-plan-description"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    onClick={handleCreatePlan}
                    disabled={createPlanMutation.isPending}
                    className="bg-[#FDD000] text-black font-black uppercase text-xs tracking-wide rounded-sm border-2 border-black hover:bg-yellow-300"
                    data-testid="button-save-plan"
                  >
                    {createPlanMutation.isPending ? 'Creating...' : 'Create Plan'}
                  </Button>
                  <Button
                    onClick={() => { setShowCreatePlan(false); setNewPlanName(''); setNewPlanDescription(''); }}
                    variant="outline"
                    className="border-2 border-zinc-600 text-white/70 font-black uppercase text-xs tracking-wide rounded-sm bg-transparent hover:bg-zinc-800"
                    data-testid="button-cancel-plan"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Plans List */}
            {fitnessPlans.length === 0 ? (
              <div className="text-center py-14 bg-zinc-900 rounded-sm border-2 border-zinc-700">
                <div className="w-14 h-14 rounded-sm bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="w-7 h-7 text-white/30" />
                </div>
                <h3 className="text-base font-black text-white uppercase tracking-tight mb-1">No Plans Yet</h3>
                <p className="text-white/40 text-sm">Create your first fitness plan to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {fitnessPlans.map((plan: FitnessPlan) => (
                  <div key={plan.id} className="bg-zinc-900 rounded-sm border-2 border-zinc-700 overflow-hidden">
                    {/* Gold accent bar */}
                    <div className="h-1 bg-[#FDD000]" />
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-1.5">
                        <h3 className="font-black text-white text-base leading-tight flex-1 mr-2">{plan.name}</h3>
                        {plan.isPublic && (
                          <Badge className="text-[10px] bg-[#FDD000]/20 text-[#FDD000] font-bold rounded-sm border border-[#FDD000]/40 flex-shrink-0">Public</Badge>
                        )}
                      </div>
                      {plan.description && (() => {
                        const injuryMarker = '\n\nInjury Guidance: ';
                        const injuryIdx = plan.description.indexOf(injuryMarker);
                        const baseDesc = injuryIdx >= 0 ? plan.description.slice(0, injuryIdx) : plan.description;
                        const injuryNote = injuryIdx >= 0 ? plan.description.slice(injuryIdx + injuryMarker.length) : null;
                        return (
                          <>
                            <p className="text-white/55 text-sm mb-2 leading-snug">{baseDesc}</p>
                            {injuryNote && (
                              <div className="flex items-start gap-1.5 bg-yellow-900/30 border border-yellow-600/30 rounded-sm px-2 py-1 mb-3">
                                <span className="text-yellow-400 text-[10px] font-black uppercase tracking-wide flex-shrink-0 mt-px">Injury Guidance</span>
                                <p className="text-yellow-300/80 text-[11px] leading-snug">{injuryNote}</p>
                              </div>
                            )}
                          </>
                        );
                      })()}
                      <div className="flex items-center gap-4 text-xs font-semibold text-white/40">
                        <span className="flex items-center gap-1.5">
                          <List className="w-3.5 h-3.5 text-[#FDD000]/60" />
                          {plan.exercises?.length || 0} exercises
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-[#FDD000]/60" />
                          {format(new Date(plan.createdAt), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>
                    {/* Action buttons */}
                    <div className="flex border-t-2 border-zinc-700">
                      <button
                        onClick={() => handleViewPlan(plan)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-black uppercase tracking-wide text-white/70 hover:text-[#FDD000] hover:bg-zinc-800 transition-colors border-r border-zinc-700"
                        data-testid={`button-view-plan-${plan.id}`}
                      >
                        <BookOpen className="w-3.5 h-3.5" /> View
                      </button>
                      <Link href={`/edit-plan/${plan.id}`} className="flex-1">
                        <button
                          className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-black uppercase tracking-wide text-white/70 hover:text-[#FDD000] hover:bg-zinc-800 transition-colors border-r border-zinc-700"
                          data-testid={`button-edit-plan-${plan.id}`}
                        >
                          <Edit className="w-3.5 h-3.5" /> Edit
                        </button>
                      </Link>
                      <button
                        onClick={() => deletePlanMutation.mutate(plan.id)}
                        disabled={deletePlanMutation.isPending}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-black uppercase tracking-wide text-white/40 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                        data-testid={`button-delete-plan-${plan.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
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
              <div className="bg-[#FDD000] px-4 py-3 border-b-2 border-black">
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
                          ? 'bg-[#FDD000] border-[#FDD000] text-black'
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
                  <label className="cursor-pointer flex items-center gap-2 text-zinc-400 hover:text-[#FDD000] transition-colors">
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
                    className="bg-[#FDD000] text-black font-black border-2 border-black hover:bg-yellow-400 uppercase text-xs gap-1"
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

                      {/* Action bar */}
                      <div className="px-4 py-2 border-t border-zinc-700 flex items-center gap-4">
                        {/* Amen */}
                        <button
                          onClick={() => likePostMutation.mutate(post.id)}
                          className={`flex items-center gap-1 text-xs font-black uppercase transition-colors ${
                            post.likedByMe ? 'text-[#FDD000]' : 'text-zinc-500 hover:text-[#FDD000]'
                          }`}
                        >
                          <Heart className={`w-4 h-4 ${post.likedByMe ? 'fill-[#FDD000]' : ''}`} />
                          <span>Amen</span>
                          {post.likes > 0 && (
                            <ReactorList
                              endpointUrl={`/api/fitness/community/posts/${post.id}/likers`}
                              queryKey={['/api/fitness/community/posts', post.id, 'likers']}
                              label="Said Amen"
                              count={post.likes}
                            >
                              <span>{post.likes}</span>
                            </ReactorList>
                          )}
                        </button>

                        {/* Oh Me */}
                        <button
                          onClick={() => ohMeMutation.mutate(post.id)}
                          className={`flex items-center gap-1 text-xs font-black uppercase transition-colors ${
                            post.ohMeByMe ? 'text-red-400' : 'text-zinc-500 hover:text-red-400'
                          }`}
                        >
                          <Flame className={`w-4 h-4 ${post.ohMeByMe ? 'fill-red-400' : ''}`} />
                          <span>Oh Me</span>
                          {post.ohMeCount > 0 && (
                            <ReactorList
                              endpointUrl={`/api/fitness/community/posts/${post.id}/oh-mes`}
                              queryKey={['/api/fitness/community/posts', post.id, 'oh-mes']}
                              label="Said Oh Me!"
                              count={post.ohMeCount}
                            >
                              <span>{post.ohMeCount}</span>
                            </ReactorList>
                          )}
                        </button>

                        {/* Comments */}
                        <button
                          onClick={() => setExpandedCommentPost(expandedCommentPost === post.id ? null : post.id)}
                          className={`flex items-center gap-1 text-xs font-black uppercase transition-colors ${
                            expandedCommentPost === post.id ? 'text-blue-400' : 'text-zinc-500 hover:text-blue-400'
                          }`}
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>Comment{post.commentCount > 0 ? ` ${post.commentCount}` : ''}</span>
                        </button>

                        {/* Share */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="flex items-center gap-1 text-xs font-black uppercase transition-colors text-zinc-500 hover:text-zinc-300 ml-auto">
                              <Share2 className="w-4 h-4" />
                              Share
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-700">
                            <DropdownMenuItem
                              className="text-white hover:bg-zinc-800 cursor-pointer"
                              onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, '_blank')}
                            >
                              Share on Facebook
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-white hover:bg-zinc-800 cursor-pointer"
                              onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.content.slice(0, 200))}&url=${encodeURIComponent(window.location.href)}`, '_blank')}
                            >
                              Share on X
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-white hover:bg-zinc-800 cursor-pointer"
                              onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(post.content.slice(0, 200) + ' ' + window.location.href)}`, '_blank')}
                            >
                              Share via WhatsApp
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-white hover:bg-zinc-800 cursor-pointer"
                              onClick={() => window.open(`mailto:?subject=Check this out&body=${encodeURIComponent(post.content.slice(0, 200))}`, '_blank')}
                            >
                              Share via Email
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-white hover:bg-zinc-800 cursor-pointer"
                              onClick={() => {
                                navigator.clipboard.writeText(window.location.href).then(() => {
                                  setCopiedPostId(post.id);
                                  setTimeout(() => setCopiedPostId(null), 2000);
                                });
                              }}
                            >
                              {copiedPostId === post.id ? (
                                <><Check className="w-3 h-3 mr-1 inline" />Copied!</>
                              ) : (
                                <><Copy className="w-3 h-3 mr-1 inline" />Copy Link</>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Expanded comments section */}
                      {expandedCommentPost === post.id && (
                        <CommentsSection
                          postId={post.id}
                          authUser={authUser}
                          addCommentMutation={addCommentMutation}
                          deleteCommentMutation={deleteCommentMutation}
                          commentText={commentText}
                          setCommentText={setCommentText}
                        />
                      )}
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
              <Apple className="w-6 h-6 text-[#FDD000] mr-2 relative z-10" />
              <h2 className="text-xl font-black text-white uppercase tracking-wide relative z-10">Nutrition Lookup</h2>
              <span className="ml-auto text-xs text-[#FDD000]/70 relative z-10">Powered by USDA FDC</span>
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
                className="flex-1 bg-zinc-900 border-2 border-white/20 text-white placeholder:text-white/40 focus:border-[#FDD000] rounded-sm"
              />
              <Button
                type="submit"
                disabled={nutritionSearchLoading}
                className="bg-[#FDD000] text-black font-black uppercase hover:bg-[#FDD000]/90 rounded-sm border-2 border-black shrink-0"
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
              <div className="flex items-center gap-2 bg-[#FDD000]/10 border border-[#FDD000]/40 rounded-sm px-3 py-2 text-sm text-[#FDD000]">
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
                  className="text-[#FDD000] hover:text-[#FDD000]/80 hover:bg-white/10 flex items-center gap-1 px-2"
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
                    <div className="bg-[#FDD000] px-4 py-3 border-b-2 border-black">
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
                                  <td className={`py-1.5 text-right tabular-nums ${isBold ? 'font-bold text-[#FDD000]' : 'text-white/70'}`}>
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

                    {/* Add to Intake button */}
                    <div className="px-4 pb-4 border-t border-white/10 pt-3">
                      <Button
                        onClick={() => {
                          const calories = nutritionFoodDetail.nutrients.find((n: any) => n.id === 1008)?.amount ?? 0;
                          handleOpenAddIntake({ foodName: nutritionFoodDetail.description, caloriesPerServing: Math.round(calories) });
                        }}
                        className="w-full bg-[#FDD000] text-black font-black uppercase hover:bg-[#FDD000]/90 rounded-sm border-2 border-black flex items-center justify-center gap-2"
                      >
                        <PlusCircle className="w-4 h-4" />
                        Add to Intake
                      </Button>
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
                        className="w-full text-left flex items-center gap-3 bg-zinc-900 border border-white/10 rounded-sm px-3 py-3 hover:border-[#FDD000]/50 hover:bg-zinc-800 transition-colors"
                      >
                        <div className="w-9 h-9 bg-[#FDD000] rounded-sm flex items-center justify-center shrink-0">
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
                              <span className="text-[10px] text-[#FDD000]/80 font-bold">
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

            {/* Required USDA citation */}
            <p className="text-[10px] text-white/30 text-center pt-2 pb-1 border-t border-white/10">
              U.S. Department of Agriculture, Agricultural Research Service. FoodData Central, 2019. fdc.nal.usda.gov.
            </p>
          </TabsContent>

          {/* Intake Tab */}
          <TabsContent value="intake" className="space-y-4">
            {/* Header */}
            <div className="flex items-center liquid-black p-4 rounded-sm border-2 border-black overflow-hidden">
              <Utensils className="w-6 h-6 text-[#FDD000] mr-2 relative z-10" />
              <h2 className="text-xl font-black text-white uppercase tracking-wide relative z-10">Food Intake Log</h2>
              <Button
                onClick={() => handleOpenAddIntake()}
                size="sm"
                className="ml-auto bg-[#FDD000] text-black font-black uppercase hover:bg-[#FDD000]/90 rounded-sm border-2 border-black flex items-center gap-1 relative z-10"
              >
                <PlusCircle className="w-4 h-4" />
                Add Food
              </Button>
            </div>

            {/* Period selector */}
            <div className="flex gap-2">
              {(['day', 'week', 'month'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setIntakePeriod(p)}
                  className={`flex-1 py-2 text-xs font-black uppercase tracking-wide rounded-sm border-2 border-black transition-colors ${
                    intakePeriod === p
                      ? 'bg-[#FDD000] text-black'
                      : 'liquid-black text-white/70 hover:text-white'
                  }`}
                >
                  {p === 'day' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
                </button>
              ))}
            </div>

            {/* Meal Reminders card */}
            <div className="liquid-black border-2 border-zinc-700 rounded-sm overflow-hidden">
              <div className="flex items-center px-4 py-3 border-b border-zinc-700">
                <Bell className="w-5 h-5 text-[#FDD000] mr-2" />
                <h3 className="text-white font-black uppercase tracking-wide text-sm flex-1">Meal Reminders</h3>
                <button
                  onClick={() => {
                    if (showMealReminderForm) setNewMealLabel('');
                    setShowMealReminderForm(!showMealReminderForm);
                  }}
                  className="text-[#FDD000] hover:text-[#FDD000]/80 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              {/* Add reminder form */}
              {showMealReminderForm && (
                <div className="px-4 py-3 border-b border-zinc-700 bg-zinc-900/50 space-y-2">
                  <div>
                    <label className="text-zinc-400 text-[10px] font-black uppercase tracking-wide">Meal Type</label>
                    <div className="mt-1 flex gap-1.5 flex-wrap">
                      {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => setNewMealType(type)}
                          className={`px-3 py-1 rounded-sm text-[11px] font-black uppercase tracking-wide transition-colors ${
                            newMealType === type
                              ? 'bg-[#FDD000] text-black'
                              : 'bg-zinc-800 text-zinc-400 border border-zinc-600 hover:border-zinc-400'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-zinc-400 text-[10px] font-black uppercase tracking-wide">Time</label>
                      <input
                        type="time"
                        value={newMealTime}
                        onChange={(e) => setNewMealTime(e.target.value)}
                        className="mt-1 w-full bg-zinc-800 border border-zinc-600 rounded-sm text-white text-sm px-3 py-1.5 focus:outline-none focus:border-zinc-400"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-zinc-400 text-[10px] font-black uppercase tracking-wide">Label <span className="normal-case font-normal">(optional)</span></label>
                    <input
                      type="text"
                      value={newMealLabel}
                      onChange={(e) => setNewMealLabel(e.target.value)}
                      placeholder="e.g. Pre-workout snack"
                      className="mt-1 w-full bg-zinc-800 border border-zinc-600 rounded-sm text-white text-sm px-3 py-1.5 focus:outline-none focus:border-zinc-400 placeholder:text-zinc-600"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (!newMealTime) return;
                        if (!isPushSubscribed) {
                          setPendingMealReminder({ time: newMealTime, label: newMealLabel, mealType: newMealType });
                          setShowMealPushConsent(true);
                        } else {
                          addMealReminderMutation.mutate({ time: newMealTime, label: newMealLabel, mealType: newMealType });
                        }
                      }}
                      disabled={!newMealTime || addMealReminderMutation.isPending}
                      className="flex-1 bg-[#FDD000] text-black font-black text-xs uppercase py-1.5 rounded-sm disabled:opacity-50"
                    >
                      {addMealReminderMutation.isPending ? 'Saving…' : 'Save Reminder'}
                    </button>
                    <button
                      onClick={() => {
                        setShowMealReminderForm(false);
                        setNewMealLabel('');
                      }}
                      className="bg-zinc-700 text-white font-black text-xs uppercase px-4 py-1.5 rounded-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Existing reminders */}
              {mealReminders.length === 0 && !showMealReminderForm ? (
                <div className="px-4 py-4 text-center">
                  <Salad className="w-8 h-8 mx-auto text-zinc-600 mb-2" />
                  <p className="text-zinc-500 text-xs">No meal reminders yet.</p>
                  <p className="text-zinc-600 text-[10px] mt-0.5">Tap + to add a reminder.</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-700/50">
                  {mealReminders.map((r: any) => (
                    <div key={r.id}>
                      {editingMealId === r.id ? (
                        <div className="px-4 py-3 space-y-2 bg-zinc-900/50">
                          <div>
                            <p className="text-zinc-400 text-[10px] font-black uppercase tracking-wide mb-1">Meal Type</p>
                            <div className="flex gap-1.5 flex-wrap">
                              {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((type) => (
                                <button
                                  key={type}
                                  onClick={() => setEditMealType(type)}
                                  className={`px-2.5 py-0.5 rounded-sm text-[11px] font-black uppercase tracking-wide transition-colors ${
                                    editMealType === type
                                      ? 'bg-[#FDD000] text-black'
                                      : 'bg-zinc-800 text-zinc-400 border border-zinc-600 hover:border-zinc-400'
                                  }`}
                                >
                                  {type}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-2 items-end">
                            <div>
                              <p className="text-zinc-400 text-[10px] font-black uppercase tracking-wide mb-1">Time</p>
                              <input
                                type="time"
                                value={editMealTime}
                                onChange={(e) => setEditMealTime(e.target.value)}
                                className="w-32 bg-zinc-800 border border-zinc-600 rounded-sm text-white text-sm px-2 py-1 focus:outline-none"
                              />
                            </div>
                            <div className="flex-1">
                              <p className="text-zinc-400 text-[10px] font-black uppercase tracking-wide mb-1">Label (optional)</p>
                              <input
                                type="text"
                                value={editMealLabel}
                                onChange={(e) => setEditMealLabel(e.target.value)}
                                placeholder="e.g. Pre-workout"
                                className="w-full bg-zinc-800 border border-zinc-600 rounded-sm text-white text-sm px-2 py-1 focus:outline-none placeholder:text-zinc-600"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => updateMealReminderMutation.mutate({ id: r.id, time: editMealTime, label: editMealLabel, mealType: editMealType })}
                              disabled={!editMealTime || updateMealReminderMutation.isPending}
                              className="bg-[#FDD000] text-black font-black text-xs px-3 py-1 rounded-sm disabled:opacity-50"
                            >{updateMealReminderMutation.isPending ? 'Saving…' : 'Save'}</button>
                            <button onClick={() => setEditingMealId(null)} className="bg-zinc-700 text-white text-xs px-3 py-1 rounded-sm">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center px-4 py-2.5 gap-3">
                          <Bell className="w-4 h-4 text-[#FDD000]/70 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-black">
                              {(() => {
                                const [hh, mm] = r.time.split(':');
                                const h = parseInt(hh, 10);
                                const suffix = h >= 12 ? 'PM' : 'AM';
                                const h12 = h % 12 === 0 ? 12 : h % 12;
                                return `${h12}:${mm} ${suffix}`;
                              })()}
                            </p>
                            <p className="text-zinc-500 text-[10px] capitalize">
                              {r.mealType || r.label || 'Meal'}
                            </p>
                          </div>
                          <button
                            onClick={() => { setEditingMealId(r.id); setEditMealTime(r.time); setEditMealLabel(r.label || ''); setEditMealType(r.mealType || 'breakfast'); }}
                            className="text-zinc-600 hover:text-zinc-300 transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteMealReminderMutation.mutate(r.id)}
                            className="text-zinc-600 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recommended Daily Calorie Intake card */}
            {(() => {
              if (!nutritionProfile) {
                return (
                  <div
                    className="liquid-black border-2 border-[#FDD000]/40 rounded-sm px-4 py-4"
                    data-testid="card-calorie-recommendation-empty"
                  >
                    <div className="flex items-start gap-3">
                      <Flame className="w-6 h-6 text-[#FDD000] shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h3 className="text-white font-black uppercase tracking-wide text-sm">Recommended Daily Calorie Intake</h3>
                        <p className="text-white/60 text-xs mt-1">
                          Find out how many calories you should eat each day based on your goal.
                        </p>
                        <Button
                          onClick={() => setLocation('/calorie-calculator')}
                          size="sm"
                          className="mt-3 bg-[#FDD000] text-black font-black uppercase hover:bg-[#FDD000]/90 rounded-sm border-2 border-black"
                          data-testid="button-open-calorie-calculator"
                        >
                          Calculate My Target
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              }
              const target = nutritionProfile.targetKcal as number;
              const consumedToday = intakePeriod === 'day' ? totalIntakeCalories : 0;
              const pct = intakePeriod === 'day' ? Math.min(100, Math.round((consumedToday / target) * 100)) : null;
              const remaining = intakePeriod === 'day' ? target - consumedToday : null;
              const goalLabel =
                nutritionProfile.goalType === 'lose' ? 'Fat Loss' :
                nutritionProfile.goalType === 'gain' ? 'Muscle Gain' : 'Maintenance';
              return (
                <div
                  className="liquid-black border-2 border-[#FDD000]/40 rounded-sm px-4 py-3"
                  data-testid="card-calorie-recommendation"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Flame className="w-5 h-5 text-[#FDD000]" />
                      <div>
                        <div className="text-white font-black uppercase tracking-wide text-sm">Daily Target</div>
                        <div className="text-white/40 text-[10px] font-bold uppercase tracking-wider">{goalLabel}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[#FDD000] font-black text-2xl tabular-nums" data-testid="text-calorie-target">
                        {target.toLocaleString()}
                      </span>
                      <span className="text-white/40 text-xs font-bold ml-1">kcal</span>
                    </div>
                  </div>
                  {intakePeriod === 'day' && pct !== null && remaining !== null && (
                    <>
                      <div className="mt-3 h-2 w-full rounded-sm bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-[#FDD000] transition-all"
                          style={{ width: `${pct}%` }}
                          data-testid="bar-calorie-progress"
                        />
                      </div>
                      <div className="flex justify-between mt-1.5 text-[10px] font-bold uppercase tracking-wide">
                        <span className="text-white/60">{consumedToday.toLocaleString()} eaten</span>
                        <span className={remaining < 0 ? 'text-red-400' : 'text-white/60'}>
                          {remaining < 0 ? `${Math.abs(remaining).toLocaleString()} over` : `${remaining.toLocaleString()} left`}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={() => setLocation('/calorie-calculator')}
                      className="text-[10px] font-black uppercase tracking-wide text-[#FDD000] hover:underline"
                      data-testid="button-update-calorie-target"
                    >
                      Update
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Calorie total banner */}
            <div className="flex items-center justify-between liquid-black border-2 border-[#FDD000]/40 rounded-sm px-4 py-3">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-[#FDD000]" />
                <span className="text-white font-black uppercase tracking-wide text-sm">
                  {intakePeriod === 'day' ? "Today's" : intakePeriod === 'week' ? "This Week's" : "This Month's"} Calories
                </span>
              </div>
              <span className="text-[#FDD000] font-black text-2xl tabular-nums">
                {intakeLoading ? '—' : totalIntakeCalories.toLocaleString()}
              </span>
              <span className="text-white/40 text-xs font-bold ml-1">kcal</span>
            </div>

            {/* Loading state */}
            {intakeLoading && (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-14 bg-zinc-800 rounded-sm animate-pulse" />)}
              </div>
            )}

            {/* TODAY: meal-grouped entries */}
            {!intakeLoading && intakePeriod === 'day' && (
              <>
                {intakeEntries.length === 0 ? (
                  <div className="text-center py-16 text-white/40">
                    <Utensils className="w-14 h-14 mx-auto mb-3 opacity-20" />
                    <p className="font-black uppercase tracking-wide">No food logged today</p>
                    <p className="text-xs mt-1 text-white/30">Tap "Add Food" to log your meals</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {mealOrder.filter(meal => intakeByMeal[meal]?.length > 0).map(meal => (
                      <div key={meal}>
                        <p className="text-[10px] font-black text-[#FDD000]/80 uppercase tracking-widest mb-2">
                          {meal.charAt(0).toUpperCase() + meal.slice(1)}
                        </p>
                        <div className="space-y-2">
                          {intakeByMeal[meal].map((entry: any) => (
                            <div key={entry.id} className="flex items-center gap-3 liquid-black border border-white/10 rounded-sm px-3 py-3">
                              <div className="w-8 h-8 bg-[#FDD000]/20 rounded-sm flex items-center justify-center shrink-0">
                                <Utensils className="w-4 h-4 text-[#FDD000]" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-white text-sm font-semibold leading-tight truncate">{entry.foodName}</p>
                                <p className="text-white/50 text-xs mt-0.5">
                                  {entry.servings} serving{entry.servings !== 1 ? 's' : ''} · {entry.caloriesPerServing} kcal/serving
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-[#FDD000] font-black text-sm tabular-nums">{entry.totalCalories}</p>
                                <p className="text-white/40 text-[10px]">kcal</p>
                              </div>
                              <button
                                onClick={() => deleteIntakeMutation.mutate(entry.id)}
                                disabled={deleteIntakeMutation.isPending}
                                className="p-1.5 text-white/30 hover:text-red-400 transition-colors shrink-0"
                                aria-label="Delete entry"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* THIS WEEK: Mon–Sun daily totals */}
            {!intakeLoading && intakePeriod === 'week' && (
              <div className="space-y-2">
                {currentWeekDays.map((day) => {
                  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                  const dayStr = fmtDate(day);
                  const kcal = intakeByDate[dayStr] || 0;
                  const isToday = dayStr === fmtDate(new Date());
                  return (
                    <div key={dayStr} className={`flex items-center justify-between px-4 py-3 rounded-sm border ${isToday ? 'border-[#FDD000]/60 bg-[#FDD000]/5' : 'border-white/10 liquid-black'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-sm flex flex-col items-center justify-center shrink-0 ${isToday ? 'bg-[#FDD000] text-black' : 'bg-zinc-800 text-white/60'}`}>
                          <span className="text-[10px] font-black uppercase leading-none">{dayNames[day.getDay()]}</span>
                          <span className="text-sm font-black leading-none mt-0.5">{day.getDate()}</span>
                        </div>
                        <span className={`text-sm font-bold ${isToday ? 'text-white' : 'text-white/60'}`}>
                          {day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {isToday && <span className="ml-1.5 text-[10px] font-black text-[#FDD000] uppercase tracking-widest">Today</span>}
                        </span>
                      </div>
                      <div className="text-right">
                        {kcal > 0 ? (
                          <>
                            <span className="text-[#FDD000] font-black text-base tabular-nums">{kcal.toLocaleString()}</span>
                            <span className="text-white/40 text-[10px] ml-1">kcal</span>
                          </>
                        ) : (
                          <span className="text-white/25 text-sm font-bold">—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* THIS MONTH: 4-week totals */}
            {!intakeLoading && intakePeriod === 'month' && (
              <div className="space-y-2">
                {weekTotals.map(({ mon, total }, i) => {
                  const isCurrentWeek = i === 0;
                  const d = mon.getDate();
                  const m = mon.getMonth() + 1;
                  const y = mon.getFullYear();
                  const label = `The week of ${d}/${m}/${y}`;
                  return (
                    <div key={fmtDate(mon)} className={`flex items-center justify-between px-4 py-4 rounded-sm border ${isCurrentWeek ? 'border-[#FDD000]/60 bg-[#FDD000]/5' : 'border-white/10 liquid-black'}`}>
                      <div>
                        <p className={`text-sm font-bold ${isCurrentWeek ? 'text-white' : 'text-white/70'}`}>{label}</p>
                        {isCurrentWeek && (
                          <p className="text-[10px] font-black text-[#FDD000] uppercase tracking-widest mt-0.5">Current week</p>
                        )}
                      </div>
                      <div className="text-right">
                        {total > 0 ? (
                          <>
                            <span className="text-[#FDD000] font-black text-base tabular-nums">{total.toLocaleString()}</span>
                            <span className="text-white/40 text-[10px] ml-1">kcal</span>
                          </>
                        ) : (
                          <span className="text-white/25 text-sm font-bold">—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Health Tab */}
          <TabsContent value="health" className="space-y-4">
            {/* Header */}
            <div className="flex items-center mb-2 liquid-black p-4 rounded-sm border-2 border-black overflow-hidden">
              <Activity className="w-6 h-6 text-[#FDD000] mr-2 relative z-10" />
              <h2 className="text-xl font-black text-white uppercase tracking-wide relative z-10">Health Tracker</h2>
              <span className="ml-auto text-xs text-white/40 font-bold relative z-10">7-Day History</span>
            </div>

            {/* Steps & Calories Card */}
            <Card className="bg-zinc-900 border-2 border-black rounded-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-white font-black uppercase tracking-wide text-sm">
                  <Footprints className="w-5 h-5 text-[#FDD000]" />
                  Steps &amp; Calories
                  {stepsMetrics[0] && (
                    <span className="ml-1 text-white/40 font-normal normal-case tracking-normal text-[10px]">
                      {stepsMetrics[0].primaryValue?.toLocaleString()} steps{stepsMetrics[0].secondaryValue ? ` · ${stepsMetrics[0].secondaryValue} kcal` : ''}
                    </span>
                  )}
                  <div className="ml-auto flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-zinc-600 text-white/50 hover:bg-zinc-700 hover:text-white font-black uppercase text-[10px] h-7 px-2 rounded-sm"
                      onClick={() => { setHealthGoalFormOpen(healthGoalFormOpen === 'steps' ? null : 'steps'); setHealthOpenForm(null); }}
                    >
                      <Target className="w-3 h-3 mr-1" />
                      Goal
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-[#FDD000] text-[#FDD000] hover:bg-[#FDD000] hover:text-black font-black uppercase text-[10px] h-7 px-2 rounded-sm"
                      onClick={() => { setHealthOpenForm(healthOpenForm === 'steps' ? null : 'steps'); setHealthGoalFormOpen(null); }}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Log
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-1">
                  {([7, 30, 90] as const).map(r => (
                    <button key={r} onClick={() => setStepsRange(r)} className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-sm border transition-colors ${stepsRange === r ? 'bg-[#FDD000] text-black border-[#FDD000]' : 'border-zinc-700 text-white/40 hover:text-white hover:border-zinc-500'}`}>{r}d</button>
                  ))}
                </div>
                {healthGoalFormOpen === 'steps' && (
                  <div className="bg-black border border-zinc-700 rounded-sm p-3 space-y-2">
                    <p className="text-white/60 text-[10px] uppercase font-bold">Daily Step Goal</p>
                    <div className="flex gap-2 items-center">
                      <Input
                        type="number"
                        placeholder={getHealthGoal('steps') ? String(getHealthGoal('steps')!.targetValue) : '10000'}
                        value={healthGoalInputs.steps}
                        onChange={e => setHealthGoalInputs(prev => ({ ...prev, steps: e.target.value }))}
                        className="bg-zinc-900 border-zinc-700 text-white text-xs h-8 rounded-sm flex-1"
                      />
                      <span className="text-white/40 text-xs">steps/day</span>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" className="text-white/40 h-7 text-xs" onClick={() => setHealthGoalFormOpen(null)}>Cancel</Button>
                      <Button
                        size="sm"
                        className="bg-[#FDD000] text-black hover:bg-[#FDD000]/80 font-black uppercase text-[10px] h-7 px-3 rounded-sm"
                        disabled={!healthGoalInputs.steps || upsertHealthGoalMutation.isPending}
                        onClick={() => upsertHealthGoalMutation.mutate({ type: 'steps', targetValue: parseFloat(healthGoalInputs.steps) })}
                      >Save Goal</Button>
                    </div>
                  </div>
                )}
                {(() => {
                  const goal = getHealthGoal('steps');
                  if (!goal) return null;
                  const { hits } = getWeeklyHits(stepsMetrics, m => m.primaryValue >= goal.targetValue);
                  const pct = (hits / 7) * 100;
                  return (
                    <div className="bg-black/40 border border-zinc-800 rounded-sm px-3 py-2 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-white/50 text-[10px] uppercase font-bold">Goal: {goal.targetValue.toLocaleString()} steps/day</span>
                        <span className="text-[10px] font-black text-[#FDD000]">{hits}/7 days this week</span>
                      </div>
                      <div className="w-full bg-zinc-800 rounded-full h-1.5">
                        <div className="bg-[#FDD000] h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })()}
                {healthOpenForm === 'steps' && (
                  <div className="bg-black border border-[#FDD000]/30 rounded-sm p-3 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-white/60 text-[10px] uppercase font-bold block mb-1">Date</label>
                        <Input
                          type="date"
                          value={healthStepsForm.date}
                          onChange={e => setHealthStepsForm(f => ({ ...f, date: e.target.value }))}
                          className="bg-zinc-900 border-zinc-700 text-white text-xs h-8 rounded-sm"
                        />
                      </div>
                      <div>
                        <label className="text-white/60 text-[10px] uppercase font-bold block mb-1">Steps</label>
                        <Input
                          type="number"
                          placeholder="8000"
                          value={healthStepsForm.steps}
                          onChange={e => setHealthStepsForm(f => ({ ...f, steps: e.target.value }))}
                          className="bg-zinc-900 border-zinc-700 text-white text-xs h-8 rounded-sm"
                        />
                      </div>
                      <div>
                        <label className="text-white/60 text-[10px] uppercase font-bold block mb-1">Calories</label>
                        <Input
                          type="number"
                          placeholder="400"
                          value={healthStepsForm.calories}
                          onChange={e => setHealthStepsForm(f => ({ ...f, calories: e.target.value }))}
                          className="bg-zinc-900 border-zinc-700 text-white text-xs h-8 rounded-sm"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" className="text-white/40 h-7 text-xs" onClick={() => setHealthOpenForm(null)}>Cancel</Button>
                      <Button
                        size="sm"
                        className="bg-[#FDD000] text-black hover:bg-[#FDD000]/80 font-black uppercase text-[10px] h-7 px-3 rounded-sm"
                        disabled={!healthStepsForm.steps || createHealthMetricMutation.isPending}
                        onClick={() => {
                          createHealthMetricMutation.mutate({
                            metricType: 'steps',
                            date: healthStepsForm.date,
                            primaryValue: parseFloat(healthStepsForm.steps),
                            secondaryValue: healthStepsForm.calories ? parseFloat(healthStepsForm.calories) : null,
                          });
                          setHealthStepsForm(f => ({ ...f, steps: '', calories: '' }));
                        }}
                      >Save</Button>
                    </div>
                  </div>
                )}
                {stepsMetrics.length === 0 ? (
                  <p className="text-white/30 text-xs text-center py-4">No entries yet. Log your first steps!</p>
                ) : (
                  <div className="space-y-3">
                    <div className="h-20 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[...stepsMetrics].reverse().slice(-stepsRange).map(m => ({ date: m.date.slice(5), value: m.primaryValue }))} margin={{ top: 4, right: 4, left: -30, bottom: 0 }}>
                          <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} axisLine={false} tickLine={false} />
                          <YAxis tick={false} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{ background: '#111', border: '1px solid rgba(253,208,0,0.3)', borderRadius: 2, fontSize: 11, color: '#fff' }} labelStyle={{ color: 'rgba(255,255,255,0.5)' }} formatter={(v: number) => [v?.toLocaleString(), 'Steps']} />
                          <ReferenceLine y={10000} stroke="rgba(253,208,0,0.45)" strokeDasharray="4 3" strokeWidth={1.5} ifOverflow="extendDomain" />
                          <Bar dataKey="value" fill="#FDD000" radius={[2, 2, 0, 0]} maxBarSize={24} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-[10px] text-white/25 text-right pr-1">— Healthy: ≥10,000 steps/day</p>
                  <div className="space-y-1">
                    <div className="grid grid-cols-4 text-[10px] font-bold uppercase text-white/40 px-2 pb-1 border-b border-zinc-800">
                      <span>Date</span><span className="text-right">Steps</span><span className="text-right">Calories</span><span></span>
                    </div>
                    {stepsMetrics.slice(0, stepsRange).map((m) => (
                      <div key={m.id} className="grid grid-cols-4 items-center px-2 py-1.5 hover:bg-zinc-800/40 rounded-sm">
                        <span className="text-white/60 text-xs">{m.date}</span>
                        <span className="text-right text-white font-bold text-xs">{m.primaryValue?.toLocaleString()}</span>
                        <span className="text-right text-white/60 text-xs">{m.secondaryValue ? `${m.secondaryValue} kcal` : '—'}</span>
                        <div className="flex justify-end">
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-white/20 hover:text-red-400"
                            onClick={() => deleteHealthMetricMutation.mutate({ id: m.id, metricType: 'steps' })}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Heart Rate Card */}
            <Card className="bg-zinc-900 border-2 border-black rounded-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-white font-black uppercase tracking-wide text-sm">
                  <Heart className="w-5 h-5 text-[#FDD000]" />
                  Heart Rate
                  {hrMetrics[0] && (
                    <span className="ml-1 text-white/40 font-normal normal-case tracking-normal text-[10px]">
                      {hrMetrics[0].primaryValue} bpm resting{hrMetrics[0].secondaryValue ? ` · ${hrMetrics[0].secondaryValue} bpm active` : ''}
                    </span>
                  )}
                  <div className="ml-auto flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-zinc-600 text-white/50 hover:bg-zinc-700 hover:text-white font-black uppercase text-[10px] h-7 px-2 rounded-sm"
                      onClick={() => { setHealthGoalFormOpen(healthGoalFormOpen === 'heart_rate' ? null : 'heart_rate'); setHealthOpenForm(null); }}
                    >
                      <Target className="w-3 h-3 mr-1" />
                      Goal
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-[#FDD000] text-[#FDD000] hover:bg-[#FDD000] hover:text-black font-black uppercase text-[10px] h-7 px-2 rounded-sm"
                      onClick={() => { setHealthOpenForm(healthOpenForm === 'heart_rate' ? null : 'heart_rate'); setHealthGoalFormOpen(null); }}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Log
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-1">
                  {([7, 30, 90] as const).map(r => (
                    <button key={r} onClick={() => setHrRange(r)} className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-sm border transition-colors ${hrRange === r ? 'bg-[#FDD000] text-black border-[#FDD000]' : 'border-zinc-700 text-white/40 hover:text-white hover:border-zinc-500'}`}>{r}d</button>
                  ))}
                </div>
                {healthGoalFormOpen === 'heart_rate' && (
                  <div className="bg-black border border-zinc-700 rounded-sm p-3 space-y-2">
                    <p className="text-white/60 text-[10px] uppercase font-bold">Resting BPM Goal (target or below)</p>
                    <div className="flex gap-2 items-center">
                      <Input
                        type="number"
                        placeholder={getHealthGoal('heart_rate') ? String(getHealthGoal('heart_rate')!.targetValue) : '65'}
                        value={healthGoalInputs.heart_rate}
                        onChange={e => setHealthGoalInputs(prev => ({ ...prev, heart_rate: e.target.value }))}
                        className="bg-zinc-900 border-zinc-700 text-white text-xs h-8 rounded-sm flex-1"
                      />
                      <span className="text-white/40 text-xs">bpm</span>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" className="text-white/40 h-7 text-xs" onClick={() => setHealthGoalFormOpen(null)}>Cancel</Button>
                      <Button
                        size="sm"
                        className="bg-[#FDD000] text-black hover:bg-[#FDD000]/80 font-black uppercase text-[10px] h-7 px-3 rounded-sm"
                        disabled={!healthGoalInputs.heart_rate || upsertHealthGoalMutation.isPending}
                        onClick={() => upsertHealthGoalMutation.mutate({ type: 'heart_rate', targetValue: parseFloat(healthGoalInputs.heart_rate) })}
                      >Save Goal</Button>
                    </div>
                  </div>
                )}
                {(() => {
                  const goal = getHealthGoal('heart_rate');
                  if (!goal) return null;
                  const { hits } = getWeeklyHits(hrMetrics, m => m.primaryValue <= goal.targetValue);
                  const pct = (hits / 7) * 100;
                  return (
                    <div className="bg-black/40 border border-zinc-800 rounded-sm px-3 py-2 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-white/50 text-[10px] uppercase font-bold">Goal: ≤{goal.targetValue} bpm resting</span>
                        <span className="text-[10px] font-black text-[#FDD000]">{hits}/7 days this week</span>
                      </div>
                      <div className="w-full bg-zinc-800 rounded-full h-1.5">
                        <div className="bg-[#FDD000] h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })()}
                {healthOpenForm === 'heart_rate' && (
                  <div className="bg-black border border-[#FDD000]/30 rounded-sm p-3 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-white/60 text-[10px] uppercase font-bold block mb-1">Date</label>
                        <Input
                          type="date"
                          value={healthHrForm.date}
                          onChange={e => setHealthHrForm(f => ({ ...f, date: e.target.value }))}
                          className="bg-zinc-900 border-zinc-700 text-white text-xs h-8 rounded-sm"
                        />
                      </div>
                      <div>
                        <label className="text-white/60 text-[10px] uppercase font-bold block mb-1">Resting BPM</label>
                        <Input
                          type="number"
                          placeholder="65"
                          value={healthHrForm.resting}
                          onChange={e => setHealthHrForm(f => ({ ...f, resting: e.target.value }))}
                          className="bg-zinc-900 border-zinc-700 text-white text-xs h-8 rounded-sm"
                        />
                      </div>
                      <div>
                        <label className="text-white/60 text-[10px] uppercase font-bold block mb-1">Active BPM</label>
                        <Input
                          type="number"
                          placeholder="140"
                          value={healthHrForm.active}
                          onChange={e => setHealthHrForm(f => ({ ...f, active: e.target.value }))}
                          className="bg-zinc-900 border-zinc-700 text-white text-xs h-8 rounded-sm"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" className="text-white/40 h-7 text-xs" onClick={() => setHealthOpenForm(null)}>Cancel</Button>
                      <Button
                        size="sm"
                        className="bg-[#FDD000] text-black hover:bg-[#FDD000]/80 font-black uppercase text-[10px] h-7 px-3 rounded-sm"
                        disabled={!healthHrForm.resting || createHealthMetricMutation.isPending}
                        onClick={() => {
                          createHealthMetricMutation.mutate({
                            metricType: 'heart_rate',
                            date: healthHrForm.date,
                            primaryValue: parseFloat(healthHrForm.resting),
                            secondaryValue: healthHrForm.active ? parseFloat(healthHrForm.active) : null,
                          });
                          setHealthHrForm(f => ({ ...f, resting: '', active: '' }));
                        }}
                      >Save</Button>
                    </div>
                  </div>
                )}
                {hrMetrics.length === 0 ? (
                  <p className="text-white/30 text-xs text-center py-4">No entries yet. Log your first heart rate reading!</p>
                ) : (
                  <div className="space-y-3">
                    <div className="h-20 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={[...hrMetrics].reverse().slice(-hrRange).map(m => ({ date: m.date.slice(5), value: m.primaryValue }))} margin={{ top: 4, right: 4, left: -30, bottom: 0 }}>
                          <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} axisLine={false} tickLine={false} />
                          <YAxis tick={false} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                          <Tooltip contentStyle={{ background: '#111', border: '1px solid rgba(253,208,0,0.3)', borderRadius: 2, fontSize: 11, color: '#fff' }} labelStyle={{ color: 'rgba(255,255,255,0.5)' }} formatter={(v: number) => [`${v} bpm`, 'Resting HR']} />
                          <ReferenceArea y1={60} y2={100} fill="rgba(253,208,0,0.07)" strokeOpacity={0} ifOverflow="extendDomain" />
                          <ReferenceLine y={60} stroke="rgba(253,208,0,0.25)" strokeDasharray="3 3" strokeWidth={1} ifOverflow="extendDomain" />
                          <ReferenceLine y={100} stroke="rgba(253,208,0,0.25)" strokeDasharray="3 3" strokeWidth={1} ifOverflow="extendDomain" />
                          <Line dataKey="value" stroke="#FDD000" strokeWidth={2} dot={{ fill: '#FDD000', r: 3 }} activeDot={{ r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-[10px] text-white/25 text-right pr-1">Healthy resting HR: 60–100 bpm</p>
                  <div className="space-y-1">
                    <div className="grid grid-cols-4 text-[10px] font-bold uppercase text-white/40 px-2 pb-1 border-b border-zinc-800">
                      <span>Date</span><span className="text-right">Resting</span><span className="text-right">Active</span><span></span>
                    </div>
                    {hrMetrics.slice(0, hrRange).map((m) => (
                      <div key={m.id} className="grid grid-cols-4 items-center px-2 py-1.5 hover:bg-zinc-800/40 rounded-sm">
                        <span className="text-white/60 text-xs">{m.date}</span>
                        <span className="text-right text-white font-bold text-xs">{m.primaryValue} <span className="text-white/40 text-[10px]">bpm</span></span>
                        <span className="text-right text-white/60 text-xs">{m.secondaryValue ? `${m.secondaryValue} bpm` : '—'}</span>
                        <div className="flex justify-end">
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-white/20 hover:text-red-400"
                            onClick={() => deleteHealthMetricMutation.mutate({ id: m.id, metricType: 'heart_rate' })}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sleep Card */}
            <Card className="bg-zinc-900 border-2 border-black rounded-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-white font-black uppercase tracking-wide text-sm">
                  <Moon className="w-5 h-5 text-[#FDD000]" />
                  Sleep
                  {sleepMetrics[0] && (
                    <span className="ml-1 text-white/40 font-normal normal-case tracking-normal text-[10px]">
                      {sleepMetrics[0].primaryValue} hr{sleepMetrics[0].secondaryValue ? ` · quality ${sleepMetrics[0].secondaryValue}/5` : ''}
                    </span>
                  )}
                  <div className="ml-auto flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-zinc-600 text-white/50 hover:bg-zinc-700 hover:text-white font-black uppercase text-[10px] h-7 px-2 rounded-sm"
                      onClick={() => { setHealthGoalFormOpen(healthGoalFormOpen === 'sleep' ? null : 'sleep'); setHealthOpenForm(null); }}
                    >
                      <Target className="w-3 h-3 mr-1" />
                      Goal
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-[#FDD000] text-[#FDD000] hover:bg-[#FDD000] hover:text-black font-black uppercase text-[10px] h-7 px-2 rounded-sm"
                      onClick={() => { setHealthOpenForm(healthOpenForm === 'sleep' ? null : 'sleep'); setHealthGoalFormOpen(null); }}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Log
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-1">
                  {([7, 30, 90] as const).map(r => (
                    <button key={r} onClick={() => setSleepRange(r)} className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-sm border transition-colors ${sleepRange === r ? 'bg-[#FDD000] text-black border-[#FDD000]' : 'border-zinc-700 text-white/40 hover:text-white hover:border-zinc-500'}`}>{r}d</button>
                  ))}
                </div>
                {healthGoalFormOpen === 'sleep' && (
                  <div className="bg-black border border-zinc-700 rounded-sm p-3 space-y-2">
                    <p className="text-white/60 text-[10px] uppercase font-bold">Daily Sleep Goal</p>
                    <div className="flex gap-2 items-center">
                      <Input
                        type="number"
                        step="0.5"
                        placeholder={getHealthGoal('sleep') ? String(getHealthGoal('sleep')!.targetValue) : '7.5'}
                        value={healthGoalInputs.sleep}
                        onChange={e => setHealthGoalInputs(prev => ({ ...prev, sleep: e.target.value }))}
                        className="bg-zinc-900 border-zinc-700 text-white text-xs h-8 rounded-sm flex-1"
                      />
                      <span className="text-white/40 text-xs">hours/night</span>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" className="text-white/40 h-7 text-xs" onClick={() => setHealthGoalFormOpen(null)}>Cancel</Button>
                      <Button
                        size="sm"
                        className="bg-[#FDD000] text-black hover:bg-[#FDD000]/80 font-black uppercase text-[10px] h-7 px-3 rounded-sm"
                        disabled={!healthGoalInputs.sleep || upsertHealthGoalMutation.isPending}
                        onClick={() => upsertHealthGoalMutation.mutate({ type: 'sleep', targetValue: parseFloat(healthGoalInputs.sleep) })}
                      >Save Goal</Button>
                    </div>
                  </div>
                )}
                {(() => {
                  const goal = getHealthGoal('sleep');
                  if (!goal) return null;
                  const { hits } = getWeeklyHits(sleepMetrics, m => m.primaryValue >= goal.targetValue);
                  const pct = (hits / 7) * 100;
                  return (
                    <div className="bg-black/40 border border-zinc-800 rounded-sm px-3 py-2 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-white/50 text-[10px] uppercase font-bold">Goal: {goal.targetValue} hrs/night</span>
                        <span className="text-[10px] font-black text-[#FDD000]">{hits}/7 days this week</span>
                      </div>
                      <div className="w-full bg-zinc-800 rounded-full h-1.5">
                        <div className="bg-[#FDD000] h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })()}
                {healthOpenForm === 'sleep' && (
                  <div className="bg-black border border-[#FDD000]/30 rounded-sm p-3 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-white/60 text-[10px] uppercase font-bold block mb-1">Date</label>
                        <Input
                          type="date"
                          value={healthSleepForm.date}
                          onChange={e => setHealthSleepForm(f => ({ ...f, date: e.target.value }))}
                          className="bg-zinc-900 border-zinc-700 text-white text-xs h-8 rounded-sm"
                        />
                      </div>
                      <div>
                        <label className="text-white/60 text-[10px] uppercase font-bold block mb-1">Hours Slept</label>
                        <Input
                          type="number"
                          step="0.5"
                          placeholder="7.5"
                          value={healthSleepForm.hours}
                          onChange={e => setHealthSleepForm(f => ({ ...f, hours: e.target.value }))}
                          className="bg-zinc-900 border-zinc-700 text-white text-xs h-8 rounded-sm"
                        />
                      </div>
                      <div>
                        <label className="text-white/60 text-[10px] uppercase font-bold block mb-1">Quality (1–5)</label>
                        <Input
                          type="number"
                          min="1"
                          max="5"
                          placeholder="4"
                          value={healthSleepForm.quality}
                          onChange={e => setHealthSleepForm(f => ({ ...f, quality: e.target.value }))}
                          className="bg-zinc-900 border-zinc-700 text-white text-xs h-8 rounded-sm"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" className="text-white/40 h-7 text-xs" onClick={() => setHealthOpenForm(null)}>Cancel</Button>
                      <Button
                        size="sm"
                        className="bg-[#FDD000] text-black hover:bg-[#FDD000]/80 font-black uppercase text-[10px] h-7 px-3 rounded-sm"
                        disabled={!healthSleepForm.hours || createHealthMetricMutation.isPending}
                        onClick={() => {
                          createHealthMetricMutation.mutate({
                            metricType: 'sleep',
                            date: healthSleepForm.date,
                            primaryValue: parseFloat(healthSleepForm.hours),
                            secondaryValue: healthSleepForm.quality ? parseFloat(healthSleepForm.quality) : null,
                          });
                          setHealthSleepForm(f => ({ ...f, hours: '', quality: '' }));
                        }}
                      >Save</Button>
                    </div>
                  </div>
                )}
                {sleepMetrics.length === 0 ? (
                  <p className="text-white/30 text-xs text-center py-4">No entries yet. Log your first sleep session!</p>
                ) : (
                  <div className="space-y-3">
                    <div className="h-20 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[...sleepMetrics].reverse().slice(-sleepRange).map(m => ({ date: m.date.slice(5), value: m.primaryValue }))} margin={{ top: 4, right: 4, left: -30, bottom: 0 }}>
                          <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} axisLine={false} tickLine={false} />
                          <YAxis tick={false} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{ background: '#111', border: '1px solid rgba(253,208,0,0.3)', borderRadius: 2, fontSize: 11, color: '#fff' }} labelStyle={{ color: 'rgba(255,255,255,0.5)' }} formatter={(v: number) => [`${v} hr`, 'Sleep']} />
                          <ReferenceArea y1={7} y2={9} fill="rgba(253,208,0,0.07)" strokeOpacity={0} ifOverflow="extendDomain" />
                          <ReferenceLine y={7} stroke="rgba(253,208,0,0.25)" strokeDasharray="3 3" strokeWidth={1} ifOverflow="extendDomain" />
                          <ReferenceLine y={9} stroke="rgba(253,208,0,0.25)" strokeDasharray="3 3" strokeWidth={1} ifOverflow="extendDomain" />
                          <Bar dataKey="value" fill="#FDD000" radius={[2, 2, 0, 0]} maxBarSize={24} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-[10px] text-white/25 text-right pr-1">Recommended: 7–9 hrs/night</p>
                  <div className="space-y-1">
                    <div className="grid grid-cols-4 text-[10px] font-bold uppercase text-white/40 px-2 pb-1 border-b border-zinc-800">
                      <span>Date</span><span className="text-right">Hours</span><span className="text-right">Quality</span><span></span>
                    </div>
                    {sleepMetrics.slice(0, sleepRange).map((m) => (
                      <div key={m.id} className="grid grid-cols-4 items-center px-2 py-1.5 hover:bg-zinc-800/40 rounded-sm">
                        <span className="text-white/60 text-xs">{m.date}</span>
                        <span className="text-right text-white font-bold text-xs">{m.primaryValue} <span className="text-white/40 text-[10px]">hr</span></span>
                        <span className="text-right text-white/60 text-xs">{m.secondaryValue ? `${m.secondaryValue}/5` : '—'}</span>
                        <div className="flex justify-end">
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-white/20 hover:text-red-400"
                            onClick={() => deleteHealthMetricMutation.mutate({ id: m.id, metricType: 'sleep' })}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Weight & Body Measurements Card */}
            <Card className="bg-zinc-900 border-2 border-black rounded-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-white font-black uppercase tracking-wide text-sm">
                  <Scale className="w-5 h-5 text-[#FDD000]" />
                  Weight &amp; Measurements
                  {weightMetrics[0] && (
                    <span className="ml-1 text-white/40 font-normal normal-case tracking-normal text-[10px]">
                      {weightMetrics[0].primaryValue} lbs{weightMetrics[0].secondaryValue ? ` · ${weightMetrics[0].secondaryValue}% BF` : ''}
                    </span>
                  )}
                  <div className="ml-auto flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-zinc-600 text-white/50 hover:bg-zinc-700 hover:text-white font-black uppercase text-[10px] h-7 px-2 rounded-sm"
                      onClick={() => { setHealthGoalFormOpen(healthGoalFormOpen === 'weight' ? null : 'weight'); setHealthOpenForm(null); }}
                    >
                      <Target className="w-3 h-3 mr-1" />
                      Goal
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-[#FDD000] text-[#FDD000] hover:bg-[#FDD000] hover:text-black font-black uppercase text-[10px] h-7 px-2 rounded-sm"
                      onClick={() => { setHealthOpenForm(healthOpenForm === 'weight' ? null : 'weight'); setHealthGoalFormOpen(null); }}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Log
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-1">
                  {([7, 30, 90] as const).map(r => (
                    <button key={r} onClick={() => setWeightRange(r)} className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-sm border transition-colors ${weightRange === r ? 'bg-[#FDD000] text-black border-[#FDD000]' : 'border-zinc-700 text-white/40 hover:text-white hover:border-zinc-500'}`}>{r}d</button>
                  ))}
                </div>
                {healthGoalFormOpen === 'weight' && (
                  <div className="bg-black border border-zinc-700 rounded-sm p-3 space-y-2">
                    <p className="text-white/60 text-[10px] uppercase font-bold">Target Weight</p>
                    <div className="flex gap-2 items-center">
                      <Input
                        type="number"
                        step="0.1"
                        placeholder={getHealthGoal('weight') ? String(getHealthGoal('weight')!.targetValue) : '175'}
                        value={healthGoalInputs.weight}
                        onChange={e => setHealthGoalInputs(prev => ({ ...prev, weight: e.target.value }))}
                        className="bg-zinc-900 border-zinc-700 text-white text-xs h-8 rounded-sm flex-1"
                      />
                      <span className="text-white/40 text-xs">lbs</span>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" className="text-white/40 h-7 text-xs" onClick={() => setHealthGoalFormOpen(null)}>Cancel</Button>
                      <Button
                        size="sm"
                        className="bg-[#FDD000] text-black hover:bg-[#FDD000]/80 font-black uppercase text-[10px] h-7 px-3 rounded-sm"
                        disabled={!healthGoalInputs.weight || upsertHealthGoalMutation.isPending}
                        onClick={() => upsertHealthGoalMutation.mutate({ type: 'weight', targetValue: parseFloat(healthGoalInputs.weight) })}
                      >Save Goal</Button>
                    </div>
                  </div>
                )}
                {(() => {
                  const goal = getHealthGoal('weight');
                  if (!goal) return null;
                  const { hits } = getWeeklyHits(weightMetrics, m => m.primaryValue <= goal.targetValue);
                  const pct = (hits / 7) * 100;
                  const current = weightMetrics[0]?.primaryValue;
                  const diff = current != null ? Math.abs(current - goal.targetValue) : null;
                  return (
                    <div className="bg-black/40 border border-zinc-800 rounded-sm px-3 py-2 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-white/50 text-[10px] uppercase font-bold">
                          Target: {goal.targetValue} lbs{diff != null ? ` · ${current! <= goal.targetValue ? 'At goal' : `${diff.toFixed(1)} lbs to go`}` : ''}
                        </span>
                        <span className="text-[10px] font-black text-[#FDD000]">{hits}/7 days this week</span>
                      </div>
                      <div className="w-full bg-zinc-800 rounded-full h-1.5">
                        <div className="bg-[#FDD000] h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })()}
                {healthOpenForm === 'weight' && (
                  <div className="bg-black border border-[#FDD000]/30 rounded-sm p-3 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-white/60 text-[10px] uppercase font-bold block mb-1">Date</label>
                        <Input
                          type="date"
                          value={healthWeightForm.date}
                          onChange={e => setHealthWeightForm(f => ({ ...f, date: e.target.value }))}
                          className="bg-zinc-900 border-zinc-700 text-white text-xs h-8 rounded-sm"
                        />
                      </div>
                      <div>
                        <label className="text-white/60 text-[10px] uppercase font-bold block mb-1">Weight (lbs)</label>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="185.0"
                          value={healthWeightForm.weight}
                          onChange={e => setHealthWeightForm(f => ({ ...f, weight: e.target.value }))}
                          className="bg-zinc-900 border-zinc-700 text-white text-xs h-8 rounded-sm"
                        />
                      </div>
                      <div>
                        <label className="text-white/60 text-[10px] uppercase font-bold block mb-1">Body Fat %</label>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="18.0"
                          value={healthWeightForm.bodyFat}
                          onChange={e => setHealthWeightForm(f => ({ ...f, bodyFat: e.target.value }))}
                          className="bg-zinc-900 border-zinc-700 text-white text-xs h-8 rounded-sm"
                        />
                      </div>
                    </div>
                    <p className="text-white/40 text-[10px] uppercase font-bold">Body Measurements (inches, optional)</p>
                    <div className="grid grid-cols-4 gap-2">
                      {(['chest', 'waist', 'hips', 'neck'] as const).map(key => (
                        <div key={key}>
                          <label className="text-white/60 text-[10px] uppercase font-bold block mb-1">{key}</label>
                          <Input
                            type="number"
                            step="0.25"
                            placeholder="—"
                            value={healthWeightForm[key]}
                            onChange={e => setHealthWeightForm(f => ({ ...f, [key]: e.target.value }))}
                            className="bg-zinc-900 border-zinc-700 text-white text-xs h-8 rounded-sm"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" className="text-white/40 h-7 text-xs" onClick={() => setHealthOpenForm(null)}>Cancel</Button>
                      <Button
                        size="sm"
                        className="bg-[#FDD000] text-black hover:bg-[#FDD000]/80 font-black uppercase text-[10px] h-7 px-3 rounded-sm"
                        disabled={!healthWeightForm.weight || createHealthMetricMutation.isPending}
                        onClick={() => {
                          const measurements: Partial<Record<'chest' | 'waist' | 'hips' | 'neck', number>> = {};
                          if (healthWeightForm.chest) measurements.chest = parseFloat(healthWeightForm.chest);
                          if (healthWeightForm.waist) measurements.waist = parseFloat(healthWeightForm.waist);
                          if (healthWeightForm.hips) measurements.hips = parseFloat(healthWeightForm.hips);
                          if (healthWeightForm.neck) measurements.neck = parseFloat(healthWeightForm.neck);
                          createHealthMetricMutation.mutate({
                            metricType: 'weight',
                            date: healthWeightForm.date,
                            primaryValue: parseFloat(healthWeightForm.weight),
                            secondaryValue: healthWeightForm.bodyFat ? parseFloat(healthWeightForm.bodyFat) : null,
                            notes: Object.keys(measurements).length > 0 ? JSON.stringify(measurements) : null,
                          });
                          setHealthWeightForm(f => ({ ...f, weight: '', bodyFat: '', chest: '', waist: '', hips: '', neck: '' }));
                        }}
                      >Save</Button>
                    </div>
                  </div>
                )}
                {weightMetrics.length === 0 ? (
                  <p className="text-white/30 text-xs text-center py-4">No entries yet. Log your first weigh-in!</p>
                ) : (
                  <div className="space-y-3">
                    <div className="h-20 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={[...weightMetrics].reverse().slice(-weightRange).map(m => ({ date: m.date.slice(5), value: m.primaryValue }))} margin={{ top: 4, right: 4, left: -30, bottom: 0 }}>
                          <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} axisLine={false} tickLine={false} />
                          <YAxis tick={false} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{ background: '#111', border: '1px solid rgba(253,208,0,0.3)', borderRadius: 2, fontSize: 11, color: '#fff' }} labelStyle={{ color: 'rgba(255,255,255,0.5)' }} formatter={(v: number) => [`${v} lbs`, 'Weight']} />
                          <ReferenceArea y1={125} y2={169} fill="rgba(253,208,0,0.07)" strokeOpacity={0} ifOverflow="extendDomain" />
                          <ReferenceLine y={125} stroke="rgba(253,208,0,0.25)" strokeDasharray="3 3" strokeWidth={1} ifOverflow="extendDomain" />
                          <ReferenceLine y={169} stroke="rgba(253,208,0,0.25)" strokeDasharray="3 3" strokeWidth={1} ifOverflow="extendDomain" />
                          <Line dataKey="value" stroke="#FDD000" strokeWidth={2} dot={{ fill: '#FDD000', r: 3 }} activeDot={{ r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-[10px] text-white/25 text-right pr-1">BMI 18.5–25 range (125–169 lbs at 5&apos;9&quot;) · varies by height</p>
                  <div className="space-y-1">
                    <div className="grid grid-cols-4 text-[10px] font-bold uppercase text-white/40 px-2 pb-1 border-b border-zinc-800">
                      <span>Date</span><span className="text-right">Weight</span><span className="text-right">Body Fat</span><span></span>
                    </div>
                    {weightMetrics.slice(0, weightRange).map((m) => {
                      let measurements: Record<string, number> = {};
                      try { if (m.notes) measurements = JSON.parse(m.notes); } catch {}
                      const hasMeasurements = Object.keys(measurements).length > 0;
                      return (
                        <div key={m.id}>
                          <div className="grid grid-cols-4 items-center px-2 py-1.5 hover:bg-zinc-800/40 rounded-sm">
                            <span className="text-white/60 text-xs">{m.date}</span>
                            <span className="text-right text-white font-bold text-xs">{m.primaryValue} <span className="text-white/40 text-[10px]">lbs</span></span>
                            <span className="text-right text-white/60 text-xs">{m.secondaryValue ? `${m.secondaryValue}%` : '—'}</span>
                            <div className="flex justify-end">
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-white/20 hover:text-red-400"
                                onClick={() => deleteHealthMetricMutation.mutate({ id: m.id, metricType: 'weight' })}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          {hasMeasurements && (
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 px-2 pb-1.5">
                              {(['chest', 'waist', 'hips', 'neck'] as const).filter(k => measurements[k]).map(k => (
                                <span key={k} className="text-white/30 text-[10px]">
                                  {k}: <span className="text-white/50">{measurements[k]}"</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Workout Sessions Log */}
            <Card className="bg-zinc-900 border-2 border-black rounded-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-white font-black uppercase tracking-wide text-sm">
                  <Dumbbell className="w-5 h-5 text-[#FDD000]" />
                  Workout Sessions
                  <span className="ml-1 text-white/40 font-normal normal-case tracking-normal text-[10px]">
                    {workoutSessions.length} session{workoutSessions.length !== 1 ? 's' : ''}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-1">
                  {([7, 30, 90] as const).map(r => (
                    <button key={r} onClick={() => setWorkoutHistoryDays(r)} className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-sm border transition-colors ${workoutHistoryDays === r ? 'bg-[#FDD000] text-black border-[#FDD000]' : 'border-zinc-700 text-white/40 hover:text-white hover:border-zinc-500'}`}>{r}d</button>
                  ))}
                </div>
                {workoutSessions.length === 0 ? (
                  <div className="text-center py-6">
                    <Dumbbell className="w-10 h-10 mx-auto text-zinc-600 mb-2" />
                    <p className="text-white/40 text-sm">No workouts logged in this period.</p>
                    <p className="text-white/25 text-xs mt-1">Complete a workout and rate it to see your history here.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {workoutSessions.map(session => {
                      const feelingConfig = {
                        too_hard:   { emoji: '😤', label: 'Too Hard',   color: 'text-red-400' },
                        just_right: { emoji: '💪', label: 'Just Right', color: 'text-emerald-400' },
                        too_easy:   { emoji: '😴', label: 'Too Easy',   color: 'text-sky-400' },
                      }[session.feeling] ?? { emoji: '💪', label: session.feeling, color: 'text-white/60' };
                      const pct = Math.round((session.completionPct ?? 1) * 100);
                      const sessionDate = new Date(session.createdAt);
                      const dateLabel = isToday(sessionDate) ? 'Today' : format(sessionDate, 'MMM d');
                      const timeLabel = format(sessionDate, 'h:mm a');
                      return (
                        <div key={session.id} className="flex items-center gap-3 p-3 bg-black/40 border border-zinc-800 rounded-sm">
                          <div className="shrink-0 w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-base">
                            {feelingConfig.emoji}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-bold text-xs truncate">{session.planName}</p>
                            <p className="text-white/40 text-[10px]">{dateLabel} · {timeLabel}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className={`text-[10px] font-black uppercase ${feelingConfig.color}`}>{feelingConfig.label}</p>
                            {pct < 100 && (
                              <p className="text-white/30 text-[10px]">{pct}% done</p>
                            )}
                            {pct >= 100 && (
                              <p className="text-emerald-500 text-[10px] font-bold flex items-center gap-0.5 justify-end">
                                <Check className="w-3 h-3" /> Full
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </>)}
      </div>

      {/* Plan Exercises Modal */}
      <Dialog open={showPlanModal} onOpenChange={setShowPlanModal}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[85svh] flex flex-col p-0 rounded-sm border-2 border-black bg-black">
          {/* Header */}
          <div className="bg-[#FDD000] px-5 py-4 border-b-2 border-black flex-shrink-0">
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

            // Surface injury guidance coaching note at the top of the day modal
            const planDesc = selectedPlanForView.description ?? '';
            const injuryMarkerModal = '\n\nInjury Guidance: ';
            const injuryIdxModal = planDesc.indexOf(injuryMarkerModal);
            const modalInjuryNote = injuryIdxModal >= 0
              ? planDesc.slice(injuryIdxModal + injuryMarkerModal.length)
              : null;

            return (
              <div className="space-y-3">
                {modalInjuryNote && (
                  <div className="flex items-start gap-2 bg-yellow-900/30 border border-yellow-600/30 rounded-sm px-3 py-2">
                    <span className="text-yellow-400 text-[10px] font-black uppercase tracking-wide flex-shrink-0 mt-px">Injury Guidance</span>
                    <p className="text-yellow-300/80 text-[11px] leading-snug">{modalInjuryNote}</p>
                  </div>
                )}
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
                          <span className="font-black text-[#FDD000] text-xl leading-none" data-testid={`text-modal-sets-${exercise.exerciseId}`}>{exercise.sets}</span>
                        </div>
                        <div className="flex flex-col items-center bg-black/60 rounded-sm px-3 py-2 border border-zinc-700 flex-1">
                          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Reps</span>
                          <span className="font-black text-[#FDD000] text-xl leading-none" data-testid={`text-modal-reps-${exercise.exerciseId}`}>{exercise.reps}</span>
                        </div>
                        {exercise.duration && (
                          <div className="flex flex-col items-center bg-black/60 rounded-sm px-3 py-2 border border-zinc-700 flex-1">
                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Time</span>
                            <span className="font-black text-[#FDD000] text-xl leading-none" data-testid={`text-modal-minutes-${exercise.exerciseId}`}>{exercise.duration}<span className="text-xs">m</span></span>
                          </div>
                        )}
                      </div>

                      {/* Scheduled Days */}
                      {exercise.daysOfWeek && exercise.daysOfWeek.length > 0 && (
                        <div>
                          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Scheduled Days</p>
                          <div className="flex flex-wrap gap-1">
                            {exercise.daysOfWeek.map((day: string) => (
                              <span key={day} className="text-[10px] font-black uppercase bg-zinc-800 text-[#FDD000] border border-zinc-600 px-2 py-0.5 rounded-sm capitalize">
                                {day}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Notes */}
                      {exercise.notes && (
                        <div className="p-2 bg-[#FDD000] rounded-sm border-2 border-black text-sm text-black">
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

                {/* Injury rehab coaching note in preview */}
                {selectedPlanForPreview.stretchPolicy && (
                  <div className="mt-3 flex items-start gap-2 bg-yellow-50 border border-yellow-300 rounded-md px-3 py-2">
                    <span className="text-base shrink-0">🩺</span>
                    <div>
                      <p className="text-xs font-bold text-yellow-800 mb-0.5">Injury Rehab Guidance</p>
                      <p className="text-xs text-yellow-700 leading-snug">{selectedPlanForPreview.stretchPolicy}</p>
                    </div>
                  </div>
                )}
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
                              <div className="mt-2 p-2 bg-[#FDD000] rounded-sm border-2 border-black text-sm text-black">
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

      {/* Add to Intake Dialog */}
      <Dialog open={showAddIntakeDialog} onOpenChange={(open) => { if (!open) { setShowAddIntakeDialog(false); setAddIntakePrefill(null); } }}>
        <DialogContent className="w-[95vw] max-w-sm p-0 rounded-sm border-2 border-black bg-black">
          <div className="bg-[#FDD000] px-5 py-4 border-b-2 border-black">
            <div className="flex items-center gap-2">
              <Utensils className="w-5 h-5 text-black" />
              <h2 className="font-black text-black uppercase tracking-tight text-lg">
                {addIntakePrefill ? 'Add to Intake' : 'Log Food'}
              </h2>
            </div>
          </div>

          <div className="px-5 py-4 space-y-4">
            {/* Food name */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-white/60 uppercase tracking-widest">Food Name</label>
              <Input
                value={addIntakePrefill ? addIntakePrefill.foodName : intakeForm.foodName}
                onChange={(e) => !addIntakePrefill && setIntakeForm(f => ({ ...f, foodName: e.target.value }))}
                readOnly={!!addIntakePrefill}
                placeholder="e.g. Chicken Breast"
                className={`bg-zinc-900 border-2 border-white/20 text-white placeholder:text-white/30 rounded-sm ${addIntakePrefill ? 'opacity-70' : 'focus:border-[#FDD000]'}`}
              />
            </div>

            {/* Calories per serving */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-white/60 uppercase tracking-widest">Calories per Serving</label>
              <Input
                type="number"
                value={addIntakePrefill ? Math.round(addIntakePrefill.caloriesPerServing) : intakeForm.caloriesPerServing}
                onChange={(e) => !addIntakePrefill && setIntakeForm(f => ({ ...f, caloriesPerServing: e.target.value }))}
                readOnly={!!addIntakePrefill}
                min={0}
                placeholder="e.g. 165"
                className={`bg-zinc-900 border-2 border-white/20 text-white placeholder:text-white/30 rounded-sm ${addIntakePrefill ? 'opacity-70' : 'focus:border-[#FDD000]'}`}
              />
            </div>

            {/* Number of servings */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-white/60 uppercase tracking-widest">Number of Servings</label>
              <Input
                type="number"
                value={intakeForm.servings}
                onChange={(e) => setIntakeForm(f => ({ ...f, servings: e.target.value }))}
                min={0.1}
                step={0.5}
                placeholder="e.g. 1.5"
                className="bg-zinc-900 border-2 border-white/20 text-white placeholder:text-white/30 focus:border-[#FDD000] rounded-sm"
              />
            </div>

            {/* Meal type */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-white/60 uppercase tracking-widest">Meal</label>
              <Select value={intakeFormMeal} onValueChange={(v) => setIntakeFormMeal(v as 'breakfast' | 'lunch' | 'dinner' | 'snack')}>
                <SelectTrigger className="bg-zinc-900 border-2 border-white/20 text-white rounded-sm focus:border-[#FDD000]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-2 border-white/20 text-white rounded-sm">
                  <SelectItem value="breakfast">Breakfast</SelectItem>
                  <SelectItem value="lunch">Lunch</SelectItem>
                  <SelectItem value="dinner">Dinner</SelectItem>
                  <SelectItem value="snack">Snack</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Calorie preview */}
            {(() => {
              const cal = addIntakePrefill ? addIntakePrefill.caloriesPerServing : parseFloat(intakeForm.caloriesPerServing);
              const srv = parseFloat(intakeForm.servings);
              const total = !isNaN(cal) && !isNaN(srv) && srv > 0 ? Math.round(cal * srv) : null;
              return total !== null ? (
                <div className="flex items-center justify-between bg-[#FDD000]/10 border border-[#FDD000]/30 rounded-sm px-3 py-2">
                  <span className="text-[#FDD000] text-xs font-black uppercase tracking-wide">Total Calories</span>
                  <span className="text-[#FDD000] font-black text-lg tabular-nums">{total} kcal</span>
                </div>
              ) : null;
            })()}

            {/* Submit */}
            <Button
              onClick={handleSubmitIntake}
              disabled={addIntakeMutation.isPending}
              className="w-full bg-[#FDD000] text-black font-black uppercase hover:bg-[#FDD000]/90 rounded-sm border-2 border-black"
            >
              {addIntakeMutation.isPending ? 'Saving…' : 'Save Entry'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Plan Detail Dialog — today's exercises preview with Start Workout */}
      <Dialog open={!!detailPlan} onOpenChange={(open) => { if (!open) { setDetailPlan(null); setDetailExercises([]); setDetailInjEvalMap({}); } }}>
        <DialogContent className="max-w-md bg-zinc-950 border-2 border-[#FDD000] text-white">
          <DialogHeader>
            <DialogTitle className="text-[#FDD000] font-black uppercase tracking-tight">
              {detailPlan?.name}
            </DialogTitle>
            {detailPlan && (
              <p className="text-xs font-bold text-white/60 uppercase tracking-wider">
                Week {getCurrentWeek(detailPlan, detailPlan.exercises || [])} of 4 • Today's session • {detailExercises.length} exercise{detailExercises.length === 1 ? '' : 's'}
              </p>
            )}
          </DialogHeader>
          <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
            {detailExercises.map((ex, i) => {
              const weekday = (ex.daysOfWeek && ex.daysOfWeek[0]) || getCurrentDayOfWeek();
              // Use server-evaluated result keyed by exerciseId for full accuracy
              const exDetailInjEval = detailInjEvalMap[ex.exerciseId] ?? null;
              const hasConflict = exDetailInjEval && exDetailInjEval.status !== 'allowed';
              return (
                <div
                  key={ex.id}
                  className={`bg-black/40 border rounded-sm p-3 ${
                    exDetailInjEval?.status === 'blocked'
                      ? 'border-red-700/70'
                      : exDetailInjEval?.status === 'modify'
                      ? 'border-yellow-600/60'
                      : exDetailInjEval?.status === 'caution'
                      ? 'border-green-600/50'
                      : 'border-zinc-800'
                  }`}
                  data-testid={`detail-exercise-${ex.id}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[#FDD000] font-black text-sm w-5 shrink-0">{i + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-white text-sm truncate">{ex.exerciseName}</p>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider truncate">
                        {ex.bodyPart || ex.targetMuscle || 'Workout'} • {ex.equipment || 'bodyweight'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-[#FDD000]/15 text-[#FDD000] border border-[#FDD000]/40">
                        {weekday.slice(0, 3)}
                      </span>
                      <span className="text-xs text-[#FDD000] font-black tabular-nums">
                        {ex.sets}×{ex.reps}
                      </span>
                    </div>
                  </div>
                  {hasConflict && exDetailInjEval && (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-start gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 ${
                            exDetailInjEval.status === 'blocked'
                              ? 'bg-red-900/50 text-red-400 border border-red-700/50'
                              : exDetailInjEval.status === 'modify'
                              ? 'bg-yellow-900/40 text-yellow-400 border border-yellow-700/40'
                              : 'bg-green-900/40 text-green-400 border border-green-700/40'
                          }`}
                          title={exDetailInjEval.reasons.join(' | ')}
                        >
                          {exDetailInjEval.status === 'blocked' ? '🔴 Blocked' : exDetailInjEval.status === 'modify' ? '🟡 Caution' : '🟢 Caution'}
                        </span>
                        <span className="text-[10px] text-zinc-400 italic leading-tight flex-1">{exDetailInjEval.reasons[0]}</span>
                      </div>
                      {(exDetailInjEval.status === 'blocked' || exDetailInjEval.status === 'modify') && (
                        <div className="flex gap-2 pt-0.5">
                          <button
                            onClick={async () => {
                              try {
                                await apiRequest('DELETE', `/api/fitness-plan-exercises/${ex.id}`);
                                setDetailExercises(prev => prev.filter(e => e.id !== ex.id));
                                if (detailPlan) {
                                  queryClient.invalidateQueries({ queryKey: ['/api/fitness-plans'] });
                                }
                                toast({ title: `${ex.exerciseName} removed from plan` });
                              } catch {
                                toast({ title: 'Failed to remove exercise', variant: 'destructive' });
                              }
                            }}
                            className="text-[9px] font-black uppercase tracking-wider text-red-400 border border-red-700/50 bg-red-900/30 px-2 py-0.5 rounded hover:bg-red-900/60"
                          >
                            Remove
                          </button>
                          {detailPlan && (
                            <button
                              onClick={() => {
                                setDetailPlan(null);
                                setDetailExercises([]);
                                setDetailInjEvalMap({});
                                window.location.href = `/edit-plan/${detailPlan.id}`;
                              }}
                              className="text-[9px] font-black uppercase tracking-wider text-[#FDD000] border border-[#FDD000]/40 bg-[#FDD000]/10 px-2 py-0.5 rounded hover:bg-[#FDD000]/20"
                            >
                              Swap in Plan
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <Button
            onClick={() => {
              if (!detailPlan) return;
              setPlayerPlan(detailPlan);
              setPlayerExercises(detailExercises);
              setDetailPlan(null);
              setDetailExercises([]);
              setPlayerOpen(true);
            }}
            className="w-full bg-[#FDD000] hover:bg-[#FDD000]/90 text-black font-black uppercase tracking-wide border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            data-testid="button-start-from-detail"
          >
            <Play className="w-5 h-5 mr-2 fill-black" />
            Start Workout
          </Button>
          {/* Manual override entry point — opens the Fine-tune dialog
              and seeds it with this plan. Hidden until a plan is loaded. */}
          {detailPlan && (
            <div className="mt-3 flex items-center justify-between gap-2">
              <Button
                onClick={() => {
                  setRestDelta(0);
                  setRepsDelta(0);
                  setSetsDelta(0);
                  setTunePlan(detailPlan);
                }}
                variant="outline"
                size="sm"
                className="flex-1 font-black uppercase tracking-wide text-xs"
                data-testid="button-open-finetune"
              >
                <SlidersHorizontal className="w-4 h-4 mr-2" />
                Fine-tune difficulty
              </Button>
              <Button
                onClick={async () => {
                  if (!detailPlan) return;
                  setHistoryPlan(detailPlan);
                  setHistoryLoading(true);
                  try {
                    const data = await apiRequest('GET', `/api/fitness-plans/${detailPlan.id}/adjustment-history`);
                    setHistoryRows(data?.history ?? []);
                  } catch {
                    setHistoryRows([]);
                  } finally {
                    setHistoryLoading(false);
                  }
                }}
                variant="ghost"
                size="sm"
                className="text-xs underline"
                data-testid="button-open-history"
              >
                <History className="w-4 h-4 mr-1" />
                History
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Fine-tune your workout difficulty (Manual Override) */}
      <Dialog open={!!tunePlan} onOpenChange={(open) => { if (!open) setTunePlan(null); }}>
        <DialogContent className="bg-zinc-950 border-2 border-[#FDD000] text-white sm:max-w-md" data-testid="dialog-finetune">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase">Fine-tune your workout difficulty</DialogTitle>
            <DialogDescription className="text-white/60">
              Manual tweaks apply to your next session. They won't disturb the streak counter and are logged separately from automatic adjustments.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Rest time slider — 5-second increments, ±60s range */}
            <div data-testid="slider-rest-row">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-black uppercase tracking-widest text-[#FDD000]">Rest time</label>
                <span className="text-xs font-bold tabular-nums text-white/80" data-testid="text-rest-delta">
                  {restDelta > 0 ? `+${restDelta}` : restDelta}s
                </span>
              </div>
              <Slider
                value={[restDelta]}
                onValueChange={(v) => setRestDelta(v[0] ?? 0)}
                min={-60}
                max={60}
                step={5}
                data-testid="slider-rest"
              />
              <div className="flex justify-between text-[10px] text-white/40 mt-1 uppercase">
                <span>shorter</span>
                <span>longer</span>
              </div>
            </div>

            {/* Intensity slider — ±2 reps per click */}
            <div data-testid="slider-reps-row">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-black uppercase tracking-widest text-[#FDD000]">Intensity (reps)</label>
                <span className="text-xs font-bold tabular-nums text-white/80" data-testid="text-reps-delta">
                  {repsDelta > 0 ? `+${repsDelta}` : repsDelta}
                </span>
              </div>
              <Slider
                value={[repsDelta]}
                onValueChange={(v) => setRepsDelta(v[0] ?? 0)}
                min={-6}
                max={6}
                step={2}
                data-testid="slider-reps"
              />
              <div className="flex justify-between text-[10px] text-white/40 mt-1 uppercase">
                <span>lighter</span>
                <span>heavier</span>
              </div>
            </div>

            {/* Volume slider — ±1 set per click */}
            <div data-testid="slider-sets-row">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-black uppercase tracking-widest text-[#FDD000]">Volume (sets)</label>
                <span className="text-xs font-bold tabular-nums text-white/80" data-testid="text-sets-delta">
                  {setsDelta > 0 ? `+${setsDelta}` : setsDelta}
                </span>
              </div>
              <Slider
                value={[setsDelta]}
                onValueChange={(v) => setSetsDelta(v[0] ?? 0)}
                min={-3}
                max={3}
                step={1}
                data-testid="slider-sets"
              />
              <div className="flex justify-between text-[10px] text-white/40 mt-1 uppercase">
                <span>less</span>
                <span>more</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              disabled={tuneSubmitting || (restDelta === 0 && repsDelta === 0 && setsDelta === 0)}
              onClick={async () => {
                if (!tunePlan) return;
                setTuneSubmitting(true);
                try {
                  const data: any = await apiRequest('POST', `/api/fitness-plans/${tunePlan.id}/manual-override`, {
                    restDelta, repsDelta, setsDelta,
                  });
                  toast({
                    title: 'Tuned',
                    description: `${data?.changes?.length ?? 0} exercise${(data?.changes?.length ?? 0) === 1 ? '' : 's'} updated. Applies next session.`,
                  });
                  queryClient.invalidateQueries({ queryKey: ['api', 'fitness-plans'] });
                  setTunePlan(null);
                } catch (err) {
                  const message = err instanceof Error ? err.message : 'Failed to apply';
                  toast({ title: 'Could not apply', description: message, variant: 'destructive' });
                } finally {
                  setTuneSubmitting(false);
                }
              }}
              className="bg-[#FDD000] text-black font-black uppercase border-2 border-black"
              data-testid="button-apply-finetune"
            >
              Apply to next session
            </Button>
            <Button
              disabled={tuneSubmitting}
              variant="outline"
              onClick={async () => {
                if (!tunePlan) return;
                setTuneSubmitting(true);
                try {
                  const data: any = await apiRequest('POST', `/api/fitness-plans/${tunePlan.id}/reset-defaults`);
                  toast({
                    title: 'Reset',
                    description: `Restored ${data?.entries ?? 0} change${(data?.entries ?? 0) === 1 ? '' : 's'} back to defaults for your level.`,
                  });
                  queryClient.invalidateQueries({ queryKey: ['api', 'fitness-plans'] });
                  setTunePlan(null);
                } catch (err) {
                  const message = err instanceof Error ? err.message : 'Failed to reset';
                  toast({ title: 'Could not reset', description: message, variant: 'destructive' });
                } finally {
                  setTuneSubmitting(false);
                }
              }}
              className="font-black uppercase tracking-wide text-xs"
              data-testid="button-reset-defaults"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset to default for my level
            </Button>
            <button
              onClick={async () => {
                if (!tunePlan) return;
                setHistoryPlan(tunePlan);
                setHistoryLoading(true);
                setTunePlan(null);
                try {
                  const data = await apiRequest('GET', `/api/fitness-plans/${tunePlan.id}/adjustment-history`);
                  setHistoryRows(data?.history ?? []);
                } catch {
                  setHistoryRows([]);
                } finally {
                  setHistoryLoading(false);
                }
              }}
              className="text-xs text-white/60 underline mt-1"
              data-testid="link-see-history"
            >
              See my adjustment history
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Adjustment history — read-only audit feed. Manual entries
          are tagged in yellow, automatic ones in white. */}
      <Dialog open={!!historyPlan} onOpenChange={(open) => { if (!open) { setHistoryPlan(null); setHistoryRows([]); } }}>
        <DialogContent className="bg-zinc-950 border-2 border-[#FDD000] text-white sm:max-w-lg max-h-[80vh] overflow-y-auto" data-testid="dialog-history">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase">Adjustment history</DialogTitle>
            <DialogDescription className="text-white/60">
              Most recent first. Manual entries are highlighted; everything else is from the automatic system.
            </DialogDescription>
          </DialogHeader>
          {historyLoading ? (
            <p className="text-white/60 text-sm py-6 text-center">Loading…</p>
          ) : historyRows.length === 0 ? (
            <p className="text-white/60 text-sm py-6 text-center" data-testid="text-history-empty">
              No adjustments yet. Once you give workout feedback or fine-tune your settings, the history will appear here.
            </p>
          ) : (
            <ul className="space-y-2" data-testid="list-history">
              {historyRows.map((row) => {
                const ts = row.appliedAt ? new Date(row.appliedAt) : null;
                const dateLabel = ts ? format(ts, 'MMM d, h:mm a') : '';
                const rolledBack = !!row.rolledBackAt;
                return (
                  <li
                    key={row.id}
                    className={`p-3 border-2 rounded-sm ${row.source === 'manual' ? 'border-[#FDD000]/60 bg-[#FDD000]/5' : 'border-white/15 bg-white/5'} ${rolledBack ? 'opacity-50' : ''}`}
                    data-testid={`row-history-${row.id}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] uppercase font-black tracking-widest ${row.source === 'manual' ? 'text-[#FDD000]' : 'text-white/70'}`}>
                        {row.source === 'manual' ? 'Manual' : `Lever ${row.leverId} · ${row.direction}`}
                      </span>
                      <span className="text-[10px] text-white/50 tabular-nums">{dateLabel}</span>
                    </div>
                    <p className="text-sm text-white/90">
                      <span className="font-bold">{row.exerciseName ?? '—'}</span>{' '}
                      <span className="text-white/60">{row.field}:</span>{' '}
                      <span className="tabular-nums">{row.before ?? '∅'}</span>
                      {' → '}
                      <span className="tabular-nums">{row.after ?? '∅'}</span>
                    </p>
                    {rolledBack && (
                      <p className="text-[10px] text-white/40 mt-1 uppercase">
                        Rolled back ({row.rollbackReason ?? 'unknown'})
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      {/* Guided Workout Player */}
      {playerOpen && playerPlan && (
        <WorkoutPlayer
          plan={playerPlan}
          exercises={playerExercises}
          injuries={fitnessPageInjuries}
          onClose={() => {
            setPlayerOpen(false);
            setPlayerPlan(null);
            setPlayerExercises([]);
            queryClient.invalidateQueries({ queryKey: ['/api/workout-history'] });
          }}
          onExerciseComplete={(rowId) => {
            // The completion endpoint expects the fitness_plan_exercises row id
            // (FK to exercise_completions.exercise_id), NOT the external ExerciseDB
            // exerciseId. Surface errors via toast so failures aren't silent.
            apiRequest('POST', `/api/fitness-plans/${playerPlan.id}/exercises/${rowId}/complete`)
              .then(() => {
                // Match the canonical key used elsewhere in this file
                queryClient.invalidateQueries({ queryKey: ['api', 'fitness-plans'] });
              })
              .catch((err: unknown) => {
                const message = err instanceof Error ? err.message : 'Failed to record completion';
                console.error('[WorkoutPlayer] complete failed:', err);
                toast({
                  title: 'Completion not saved',
                  description: message,
                  variant: 'destructive',
                });
              });
            setCompletedExercises(prev => {
              const next = new Set(prev);
              next.add(rowId);
              return next;
            });
            toast({
              title: '✓ Exercise logged',
              description: 'Recorded in your workout history.',
              duration: 2000,
            });
          }}
        />
      )}

      {/* Meal Reminder Push Consent */}
      <PushConsentDialog
        open={showMealPushConsent}
        onOpenChange={setShowMealPushConsent}
        reason="Enable push notifications to get meal reminder alerts even when the app is closed."
        onAllowed={() => {
          if (pendingMealReminder) {
            addMealReminderMutation.mutate(pendingMealReminder);
            setPendingMealReminder(null);
          }
        }}
      />

      {/* Exercise media preview popout — opens when the user clicks
          "Preview" on any ExerciseCard. Plays MP4/WebM in <video>,
          shows GIF/PNG/JPG in <img>, and falls back to a friendly
          message when the exercise has no valid media path. Uses a
          plain fixed overlay (not shadcn Dialog) so it's immune to
          z-index or portal issues from other page overlays. */}
      {previewExercise && (() => {
        const rawUrl = previewExercise.gifUrl
          || (previewExercise as any).mediaFile
          || (previewExercise as any).media_file
          || (previewExercise as any).exerciseGifUrl
          || (previewExercise as any).imageUrl
          || '';
        const url = String(rawUrl).trim();
        const isPlayable = !!url && (url.startsWith('/api/media/') || url.startsWith('http') || url.startsWith('/'));
        const isVideo = /\.(mp4|webm|mov)(\?.*)?$/i.test(url);
        const closePreview = () => setPreviewExercise(null);
        if (!isPlayable) {
          console.warn('[ExercisePreview] no playable URL for exercise', previewExercise);
        }
        return (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 p-4"
            onClick={closePreview}
            data-testid="dialog-exercise-preview"
            role="dialog"
            aria-modal="true"
          >
            <div
              className="relative bg-zinc-900 border-2 border-[#FDD000] rounded-sm w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col shadow-[6px_6px_0px_0px_rgba(253,208,0,1)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b-2 border-[#FDD000] bg-zinc-900">
                <h3 className="text-[#FDD000] font-black uppercase tracking-wide text-base sm:text-lg pr-4 truncate">
                  {previewExercise.name?.replace(/_/g, ' ')}
                </h3>
                <button
                  type="button"
                  onClick={closePreview}
                  className="flex items-center gap-1 bg-[#FDD000] text-black px-3 py-1.5 rounded-sm border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-white font-black uppercase text-xs sm:text-sm shrink-0"
                  data-testid="button-close-preview"
                  aria-label="Close preview"
                >
                  <X className="w-4 h-4" />
                  Close
                </button>
              </div>
              <div className="flex-1 flex items-center justify-center bg-black overflow-hidden">
                {!isPlayable ? (
                  <p className="italic text-white/70 text-center px-6 py-10">
                    No demo video is available for this exercise yet.
                  </p>
                ) : isVideo ? (
                  <video
                    key={url}
                    src={url}
                    controls
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="auto"
                    className="w-full max-h-[75vh]"
                    data-testid="video-exercise-preview"
                    onError={(e) => console.error('[ExercisePreview] Video failed to load:', url, e)}
                  >
                    <source src={url} type="video/mp4" />
                    Your browser does not support video playback.
                  </video>
                ) : (
                  <img
                    src={url}
                    alt={previewExercise.name || 'Exercise demo'}
                    className="w-full max-h-[75vh] object-contain"
                    data-testid="img-exercise-preview"
                  />
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ============================================================================
// WorkoutPlayer — guided full-screen workout runner
// ============================================================================
interface WorkoutPlayerProps {
  plan: FitnessPlan;
  exercises: FitnessPlanExercise[];
  injuries?: any[];
  onClose: () => void;
  onExerciseComplete: (exerciseId: string) => void;
}

type PlayerPhase = 'countdown' | 'work' | 'rest' | 'set-rest' | 'side-switch' | 'done';

function WorkoutPlayer({ plan, exercises: initialExercises, injuries = [], onClose, onExerciseComplete }: WorkoutPlayerProps) {
  const { toast } = useToast();
  // Local mutable copy of the plan exercises so mid-workout adjustments
  // (sets / reps / rest) are reflected immediately without waiting for
  // a parent refetch. Synced if the parent ever passes a new prop.
  const [exercises, setExercises] = useState<FitnessPlanExercise[]>(initialExercises);
  useEffect(() => { setExercises(initialExercises); }, [initialExercises]);
  const [exerciseIdx, setExerciseIdx] = useState(0);
  const [setIdx, setSetIdx] = useState(0); // 0-based current set
  const [phase, setPhase] = useState<PlayerPhase>('countdown');
  const [secondsLeft, setSecondsLeft] = useState(10);
  // For unilateral exercises: tracks which side is currently working.
  // Resets to 'right' at the start of every new set / exercise.
  const [currentSide, setCurrentSide] = useState<'right' | 'left'>('right');

  // ── Rep counter (for non-time-based sets) ────────────────────────────────
  // repCount: how many reps have been completed this set (0-indexed → display as repCount+1)
  // videoDuration: natural loop length of the current exercise video (populated on loadedmetadata)
  // effectiveTempo: seconds-per-rep (video duration adjusted by +/- override)
  const [repCount, setRepCount] = useState(0);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [effectiveTempo, setEffectiveTempo] = useState<number>(3.0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const tempoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const TEMPO_OVERRIDE_PREFIX = 'tempoOverride_';

  // Exercises the user has explicitly tapped "Mark as Done" on.
  // Prevents auto-logging — the timer advances automatically but
  // completion is only recorded when the user manually confirms.
  const [markedDone, setMarkedDone] = useState<Set<string>>(new Set());

  // Pause flag — when true the tick interval is a no-op so timers
  // freeze in place. Toggled by the pause button, by tapping the
  // exercise media or timer, and forced on whenever the written-
  // instructions or adjust modals open.
  const [paused, setPaused] = useState(false);
  // Pre-start gate: when true, the timer is frozen and a Begin overlay
  // is shown on top of the exercise media. The user explicitly taps it
  // to start the very first countdown so they have time to get set up.
  const [awaitingStart, setAwaitingStart] = useState(true);

  // ── Pre-workout injury acknowledgement gate ───────────────────────────────
  // If the user has recorded injuries AND any of today's planned exercises
  // evaluate to caution / modify / blocked against those injuries, we show
  // a full-screen warning before the workout can begin. The user must hit
  // "I Accept" to proceed; the click is logged server-side with timestamp
  // and the list of flagged exercises as an audit trail of informed consent.
  const flaggedExercises = useMemo(() => {
    if (!injuries || injuries.length === 0) return [];
    return initialExercises
      .map((ex) => {
        const ev = evaluateExerciseAgainstInjuries(
          {
            name: ex.exerciseName ?? '',
            bodyPart: ex.bodyPart ?? '',
            hiit: 'No',
            stretching: 'No',
            equipment: ex.equipment ?? '',
            level: '',
          },
          injuries,
        );
        return { ex, ev };
      })
      .filter(({ ev }) => ev.status !== 'allowed')
      .map(({ ex, ev }) => ({
        exerciseId: ex.id,
        exerciseName: ex.exerciseName ?? '',
        status: ev.status as 'caution' | 'modify' | 'blocked',
        reasons: ev.reasons,
      }));
  }, [initialExercises, injuries]);

  const [injuryAcknowledged, setInjuryAcknowledged] = useState<boolean>(
    flaggedExercises.length === 0,
  );
  const [injuryAckSubmitting, setInjuryAckSubmitting] = useState(false);

  const acknowledgeInjuryRisk = async () => {
    if (injuryAckSubmitting || injuryAcknowledged) return;
    setInjuryAckSubmitting(true);
    try {
      await apiRequest('POST', '/api/workout-injury-acknowledgements', {
        planId: plan.id,
        flaggedExercises,
      });
      setInjuryAcknowledged(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to record acknowledgement';
      console.error('[WorkoutPlayer] injury ack failed:', err);
      toast({
        title: 'Could not record acknowledgement',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setInjuryAckSubmitting(false);
    }
  };
  // Pacing mode: 'timed' = current behavior (timer auto-advances through
  // sets/rest); 'manual' = countdowns still tick but the workout never
  // auto-advances when they hit 0 — the user steps through every phase
  // with the on-screen arrows. Persisted in localStorage so it sticks.
  const PACING_STORAGE_KEY = 'workoutPacingMode';
  const [pacingMode, setPacingMode] = useState<'timed' | 'manual'>(() => {
    if (typeof window === 'undefined') return 'timed';
    try {
      const stored = window.localStorage.getItem(PACING_STORAGE_KEY);
      return stored === 'manual' ? 'manual' : 'timed';
    } catch {
      return 'timed';
    }
  });
  useEffect(() => {
    try { window.localStorage.setItem(PACING_STORAGE_KEY, pacingMode); } catch { /* ignore */ }
  }, [pacingMode]);
  const begin = () => setAwaitingStart(false);
  const togglePause = () => {
    // Tapping the media / timer before the workout starts also begins it.
    if (awaitingStart) { begin(); return; }
    setPaused(p => !p);
  };

  const [instructionsOpen, setInstructionsOpen] = useState(false);
  // Adjust-exercise dialog state. Lets the user tweak sets / reps /
  // rest period mid-workout without leaving the player. Pauses the
  // timer while open and restores the previous pause state on close.
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustSets, setAdjustSets] = useState(3);
  const [adjustReps, setAdjustReps] = useState(10);
  const [adjustRest, setAdjustRest] = useState(60);
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);
  const [pausedBeforeAdjust, setPausedBeforeAdjust] = useState(false);

  // Fetch the canonical instructions text from the `exercises` table when
  // the user opens the instructions modal. The plan-exercise row only has
  // free-form `notes`; the rich step-by-step "instructions" column lives
  // on the underlying exercise. Enabled lazily so we don't make this
  // request until the modal is actually opened.
  const exerciseLookupName = exercises[exerciseIdx]?.exerciseName;
  const { data: exerciseDetails, isLoading: instructionsLoading } = useQuery<{
    id: number;
    name: string;
    instructions: string;
    shortInstructions?: string | null;
    bodyPart?: string;
    equipment?: string;
    level?: string;
    sidedness?: string;
  }>({
    queryKey: ['/api/exercises/by-name', exerciseLookupName],
    // Only fetch when the instructions modal is opened; sidedness is read
    // directly from the plan exercise row (currentExercise.sidedness) so
    // the phase state machine is always deterministic without async waits.
    enabled: instructionsOpen && !!exerciseLookupName,
  });
  // Adaptive-difficulty feedback state. Once the user picks a feeling
  // we POST it to the feedback endpoint and then close the player.
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState(false);
  const [feedbackResult, setFeedbackResult] = useState<{
    feeling: 'too_hard' | 'just_right' | 'too_easy';
    streak: number;
    level: 'none' | 'minor' | 'full' | 'escalate';
    direction: 'easier' | 'harder' | null;
    lever: { id: number; name: string; description: string; requiresConfirmation: boolean } | null;
    adjustment: {
      leverId: number;
      applied: boolean;
      reason?: string;
      changes: Array<{ exerciseName: string; field: string; before?: any; after?: any }>;
      prompt?: {
        title: string;
        body: string;
        confirmText: string;
        declineText: string;
        postponeText: string;
        targetLevel: 'beginner' | 'intermediate' | null;
      };
    } | null;
    rollback?: { batchId: string; leverId: number; entries: number } | null;
    mixedFeedback?: { question: string; confirmText: string; declineText: string } | null;
    partial?: boolean;
    completionPct?: number;
  } | null>(null);
  const [rollbackConfirmOpen, setRollbackConfirmOpen] = useState(false);
  const [fullRollbackSubmitting, setFullRollbackSubmitting] = useState(false);
  const [lever6Submitting, setLever6Submitting] = useState(false);
  const [lever6Decided, setLever6Decided] = useState(false);
  const [mixedSubmitting, setMixedSubmitting] = useState(false);
  const [mixedResolved, setMixedResolved] = useState(false);
  // Tracks the exercise index when the user bailed out of the workout
  // early (so we can compute completionPct as a partial). null means
  // the session reached its natural end.
  const [earlyEndIdx, setEarlyEndIdx] = useState<number | null>(null);

  // Derive a coarse workoutType label from the plan name. The streak counter
  // is scoped per (user, workoutType) so the Confirmation Rule only fires
  // when the SAME kind of workout produces the same feedback in a row.
  const workoutType: 'standard' | 'standard-cardio' | 'hiit' | 'stretching' = (() => {
    const n = (plan.name || '').toLowerCase();
    if (n.includes('hiit')) return 'hiit';
    if (n.includes('stretch')) return 'stretching';
    if (n.includes('cardio')) return 'standard-cardio';
    return 'standard';
  })();

  const submitLever6Decision = async (decision: 'yes' | 'no' | 'later') => {
    if (lever6Submitting || lever6Decided) return;
    setLever6Submitting(true);
    try {
      // Direction tells the server whether this is the "too hard" Lever 6
      // (lower the level) or the "too easy" Lever 6 (raise the level).
      const direction = feedbackResult?.feeling === 'too_easy' ? 'harder' : 'easier';
      await apiRequest('POST', `/api/fitness-plans/${plan.id}/level-decision`, {
        decision,
        workoutType,
        direction,
      });
      setLever6Decided(true);
      const isTooEasy = feedbackResult?.feeling === 'too_easy';
      toast({
        title:
          decision === 'yes'
            ? 'Level updated'
            : decision === 'no'
              ? isTooEasy ? "We'll keep this level for the next 2 weeks" : 'Level kept'
              : isTooEasy ? "We'll apply lighter tweaks and check back in 3 sessions" : "We'll ask again next session",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to record decision';
      toast({ title: 'Could not save', description: message, variant: 'destructive' });
    } finally {
      setLever6Submitting(false);
    }
  };

  const submitFeedback = async (feeling: 'too_hard' | 'just_right' | 'too_easy') => {
    if (feedbackSubmitting || feedbackDone) return;
    setFeedbackSubmitting(true);
    try {
      // Compute completion fraction. A natural finish (no early-end
      // marker) is 1.0; bailing out partway through computes from the
      // exercise index where the user stopped.
      const totalExercises = Math.max(1, exercises.length);
      const completionPct = earlyEndIdx === null
        ? 1
        : Math.max(0, Math.min(1, earlyEndIdx / totalExercises));

      const res = await apiRequest('POST', `/api/fitness-plans/${plan.id}/feedback`, {
        feeling,
        workoutType,
        completionPct,
      });
      const data: any = await res.json().catch(() => ({}));
      setFeedbackResult({
        feeling,
        streak: typeof data?.streak === 'number' ? data.streak : 1,
        level: data?.level ?? 'none',
        direction: data?.direction ?? null,
        lever: data?.lever ?? null,
        adjustment: data?.adjustment ?? null,
        rollback: data?.rollback ?? null,
        mixedFeedback: data?.mixedFeedback ?? null,
        partial: data?.partial ?? false,
        completionPct: data?.completionPct ?? completionPct,
      });
      setFeedbackDone(true);
    } catch (err) {
      // Server returns 400 incomplete_too_easy when the user picks
      // "too easy" but didn't finish the session. Surface the spec's
      // exact message and leave the prompt open so they can pick again.
      const raw = err instanceof Error ? err.message : 'Failed to record feedback';
      const incomplete = /incomplete_too_easy|Finish the full session/i.test(raw);
      if (incomplete) {
        toast({
          title: 'Almost there',
          description: 'Finish the full session before we adjust — you might surprise yourself!',
        });
      } else {
        console.error('[WorkoutPlayer] feedback failed:', err);
        toast({ title: 'Feedback not saved', description: raw, variant: 'destructive' });
      }
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  // User accepted/declined the alternating-feedback prompt. Yes inserts
  // a streak-reset marker so the alternation is forgotten and current
  // settings are preserved. No closes the player so the user can change
  // difficulty manually via the plan settings UI.
  const submitMixedDecision = async (happy: boolean) => {
    if (mixedSubmitting || mixedResolved) return;
    setMixedSubmitting(true);
    try {
      await apiRequest('POST', `/api/fitness-plans/${plan.id}/feedback/mixed-resolved`, {
        happy,
        workoutType,
      });
      setMixedResolved(true);
      if (happy) {
        toast({
          title: 'Got it',
          description: 'Sticking with your current difficulty — fresh start on the streak counter.',
        });
      } else {
        toast({
          title: 'Open your plan',
          description: 'Adjust difficulty from your plan settings and we\'ll re-tune from there.',
        });
        onClose();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save';
      toast({ title: 'Could not save', description: message, variant: 'destructive' });
    } finally {
      setMixedSubmitting(false);
    }
  };

  // Human-friendly explanation of what the Confirmation Rule did with the
  // user's feedback this session — shown after they submit.
  const feedbackMessage = ((): string => {
    if (!feedbackResult) return '';
    const { feeling, streak, lever } = feedbackResult;
    if (feeling === 'just_right') {
      return streak >= 2
        ? `Logged. You've felt this way ${streak} sessions in a row — your plan is dialed in.`
        : `Logged. We'll keep this workout where it is.`;
    }
    const direction = feeling === 'too_hard' ? 'easier' : 'harder';
    if (!lever) {
      return `Logged. One session isn't enough to change anything yet — if you feel the same way next time, we'll start nudging this workout ${direction}.`;
    }
    if (lever.requiresConfirmation) {
      return `${streak} sessions in a row felt this way. We'd like to change your training level to make this workout ${direction} — this is bigger than a normal tweak so we'll ask you to confirm before applying it.`;
    }
    return `${streak} sessions in a row felt this way — next time we'll adjust ${lever.name.toLowerCase()} to make this workout ${direction}.`;
  })();
  const audioCtxRef = useRef<AudioContext | null>(null);

  const currentExercise = exercises[exerciseIdx];
  // Read sidedness from the plan-exercise row (populated by the server at
  // insert time). Synchronous — no async lookup needed. Old rows without the
  // column default to 'bilateral' (null ?? 'bilateral').
  const isUnilateral = (currentExercise?.sidedness ?? 'bilateral') === 'unilateral';
  const repsString = String(currentExercise?.reps ?? '');
  const timeBasedMatch = repsString.match(/^(\d+)s$/);
  const isTimeBased = !!timeBasedMatch;
  // numReps: integer rep count for this exercise (0 when time-based or
  // unparseable). Hoisted above totalSets/workSeconds because the rep-based
  // set-duration formula (numReps × tempoSec) depends on it.
  const numReps = !isTimeBased
    ? (parseInt(String(currentExercise?.reps ?? '0'), 10) || 0)
    : 0;
  // A "transition" exercise is a 1-set time-based block (stretch / warm-up
  // cardio / cooldown). Per spec, the buffer between these is a flat 5s
  // regardless of any stale restTime persisted on older plans (where a
  // legacy default 60s or post-rollback 65s may have stuck around).
  const isTransitionExercise = (() => {
    if (!currentExercise) return false;
    if (!isTimeBased || (currentExercise.sets ?? 3) !== 1) return false;
    const haystack = `${currentExercise.exerciseName ?? ''} ${currentExercise.notes ?? ''}`.toLowerCase();
    return /stretch|warm[\s-]?up|cool[\s-]?down|mobility/.test(haystack);
  })();
  // HIIT exercises are time-based ("30s" reps) but not 1-set transitions.
  // Per spec their rest stays as-prescribed (30/20/10s by level, etc.).
  // Every other (standard) exercise gets a flat 30s break between sets
  // and exercises; transitions keep the short 10s buffer.
  const isHiitExercise = isTimeBased && !isTransitionExercise;
  // Per spec, HIIT has no set structure — each emitted HIIT entry is one
  // time-based block in the round-robin circuit (the plan generator
  // already emits sets=1 for HIIT and pre-expands the circuit by rounds).
  // Defensively clamp to 1 here so any legacy plan or data drift can't
  // reintroduce a multi-set HIIT loop in the player.
  const totalSets = isHiitExercise ? 1 : (currentExercise?.sets ?? 3);
  // Set duration:
  //   • Time-based (stretches, warm-ups, cooldowns, HIIT): use the parsed
  //     "30s" reps value — same behavior as before.
  //   • Rep-based (normal strength exercises): duration = numReps × tempoSec
  //     so one set lasts exactly long enough to perform every rep at the
  //     stored per-rep cadence. Falls back to 30s if numReps is 0.
  const workSeconds = isTimeBased
    ? parseInt(timeBasedMatch![1], 10) || 30
    : (numReps > 0 ? Math.max(1, Math.round(numReps * effectiveTempo)) : 30);
  const restSeconds = isHiitExercise
    ? (currentExercise?.restTime ?? 60)
    : 30;
  // Buffer shown between exercises (the "preview" rest with the next
  // movement's video + 3-2-1 countdown beeps). Bumped from 5s to 10s
  // per spec so users have time to read the upcoming exercise's name.
  const PREVIEW_SECONDS = 10;

  // Adjust dialog handlers — open prefills inputs from current values and
  // pauses the timer; save persists via PUT and updates local state so the
  // change takes effect on the next set / rest without a refetch.
  const queryClient = useQueryClient();
  const openAdjust = () => {
    if (!currentExercise) return;
    // Sets / rest are stored as numbers; reps may be a string ("10",
    // "8-12", "30s") so parse the first integer for the slider seed.
    const repsRaw = String(currentExercise.reps ?? '10');
    const repsMatch = repsRaw.match(/\d+/);
    const repsSeed = repsMatch ? parseInt(repsMatch[0], 10) : 10;
    setAdjustSets(Math.max(1, Math.min(10, currentExercise.sets ?? 3)));
    setAdjustReps(Math.max(1, Math.min(30, repsSeed)));
    setAdjustRest(Math.max(0, Math.min(300, currentExercise.restTime ?? 60)));
    setPausedBeforeAdjust(paused);
    setPaused(true);
    setAdjustOpen(true);
  };
  const closeAdjust = () => {
    setAdjustOpen(false);
    setPaused(pausedBeforeAdjust);
  };
  // Apply the chosen sets/reps/rest values. `scope` controls whether the
  // change is ephemeral (just this session) or persisted to the plan so
  // it sticks for every future workout.
  const saveAdjust = async (scope: 'session' | 'plan') => {
    if (!currentExercise) return;
    const setsNum = Math.max(1, Math.min(20, adjustSets));
    const restNum = Math.max(0, Math.min(600, adjustRest));
    const repsStr = String(Math.max(1, Math.min(50, adjustReps)));
    setAdjustSubmitting(true);
    try {
      if (scope === 'plan') {
        const updatedRow = await apiRequest('PUT', `/api/fitness-plan-exercises/${currentExercise.id}`, {
          sets: setsNum,
          reps: repsStr,
          restTime: restNum,
        });
        setExercises(prev => prev.map((ex, i) => i === exerciseIdx ? { ...ex, ...updatedRow } : ex));
        // Refresh any cached plan-detail views in the parent so changes
        // are visible after the workout ends too.
        queryClient.invalidateQueries({ queryKey: ['/api/fitness-plans'] });
        toast({ title: 'Saved to plan', description: 'Future workouts will use these values.' });
      } else {
        // Session-only: mutate the local working copy without touching
        // the persisted plan row. Resets next time this workout starts.
        setExercises(prev => prev.map((ex, i) => i === exerciseIdx ? {
          ...ex,
          sets: setsNum,
          reps: repsStr,
          restTime: restNum,
        } : ex));
        toast({ title: 'Updated for this workout', description: 'Plan unchanged for next time.' });
      }
      setAdjustOpen(false);
      setPaused(pausedBeforeAdjust);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save';
      toast({ title: 'Could not save', description: message, variant: 'destructive' });
    } finally {
      setAdjustSubmitting(false);
    }
  };

  // Detect URL extension for media rendering. Fall back to the legacy
  // `exerciseGifUrl` alias for older plan rows that predate the imageUrl column.
  const mediaUrl = currentExercise?.imageUrl || currentExercise?.exerciseGifUrl || '';
  const isVideo = /\.(mp4|webm|mov)$/i.test(mediaUrl);

  // Initialize Web Audio context lazily (typed, no `any`)
  const beep = (frequency: number, duration: number = 150) => {
    try {
      if (!audioCtxRef.current) {
        type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };
        const w = window as WebkitWindow;
        const Ctx: typeof AudioContext | undefined = w.AudioContext ?? w.webkitAudioContext;
        if (!Ctx) return;
        audioCtxRef.current = new Ctx();
      }
      const ctx = audioCtxRef.current!;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = frequency;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration / 1000);
    } catch (err) {
      // Audio is non-critical; log for diagnostics rather than swallowing.
      console.warn('[WorkoutPlayer] beep failed:', err);
    }
  };

  // Category-aware default tempo: compound/heavy lifts get more time per rep,
  // isolation/light exercises get less. Falls back to 3s if unknown.
  // Uses exerciseName and bodyPart (both available on FitnessPlanExercise).
  const getCategoryDefaultTempo = (): number => {
    const name = (currentExercise?.exerciseName ?? '').toLowerCase();
    const part = (currentExercise?.bodyPart ?? '').toLowerCase();
    if (/squat|deadlift|bench|press|row|pull.up|clean|snatch/i.test(name) ||
        /back|chest|compound/i.test(part)) return 4.0;
    if (/curl|lateral|fly|extension|raise/i.test(name) ||
        /biceps|triceps|shoulders/i.test(part)) return 2.5;
    return 3.0;
  };

  // Load effectiveTempo whenever the exercise changes.
  // Priority: localStorage override → video natural duration → DB tempo_sec → category default.
  useEffect(() => {
    if (!exerciseLookupName) return;
    try {
      const stored = localStorage.getItem(`${TEMPO_OVERRIDE_PREFIX}${exerciseLookupName}`);
      if (stored) {
        const parsed = parseFloat(stored);
        if (parsed >= 1 && parsed <= 8) { setEffectiveTempo(parsed); return; }
      }
    } catch { /* ignore */ }
    // Video duration is set asynchronously via onLoadedMetadata; skip here
    // and let that handler update tempo once metadata is known.
    // Use DB tempo if it differs from the bare default, else use category default.
    const dbTempo = currentExercise?.tempoSec;
    if (dbTempo && dbTempo > 0 && dbTempo !== 3.0) {
      setEffectiveTempo(dbTempo);
    } else {
      setEffectiveTempo(getCategoryDefaultTempo());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseLookupName]);

  // Update playbackRate ONLY for rep-based work so time-based / stretch /
  // HIIT exercises always play at 1× speed.
  useEffect(() => {
    if (!videoRef.current || !videoDuration || videoDuration <= 0 || !isVideo) return;
    if (!isTimeBased && phase === 'work') {
      videoRef.current.playbackRate = videoDuration / effectiveTempo;
    } else {
      videoRef.current.playbackRate = 1;
    }
  }, [effectiveTempo, videoDuration, isVideo, isTimeBased, phase]);

  // Reset repCount to 1 when exercise, set, or phase changes (new set starts fresh).
  // Starting at 1 means the display immediately shows "Rep 1 of N" — the current rep
  // being performed — and increments after each tempo interval.
  useEffect(() => {
    setRepCount(1);
  }, [exerciseIdx, setIdx, phase]);

  // Reset videoDuration when moving to a new exercise so the next video's
  // loadedmetadata event sets the correct tempo baseline.
  useEffect(() => {
    setVideoDuration(null);
  }, [exerciseIdx]);

  // Clear any pending tempo-save timer on unmount to prevent stale requests.
  useEffect(() => {
    return () => {
      if (tempoSaveTimerRef.current) clearTimeout(tempoSaveTimerRef.current);
    };
  }, []);

  // Rep-counting timer: fires once per effectiveTempo seconds during rep-based work.
  // repCount starts at 1 (the first rep being done) and increments each interval.
  // Auto-advance fires AFTER the Nth interval (next > numReps) so "Rep N of N"
  // is shown for exactly one full interval before the phase changes.
  // In manual pacing, the counter freezes at numReps — user advances manually.
  useEffect(() => {
    if (phase !== 'work' || isTimeBased || awaitingStart || paused || numReps <= 0) return;
    const id = setInterval(() => {
      setRepCount(c => {
        // In manual mode: freeze once we've completed all reps
        if (c >= numReps && pacingMode === 'manual') return c;
        const next = c + 1;
        // Auto-advance AFTER the last rep's interval completes (next exceeds target)
        if (next > numReps && pacingMode === 'timed') {
          setTimeout(() => advancePhase(), 200);
        }
        return next;
      });
    }, effectiveTempo * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, isTimeBased, exerciseIdx, setIdx, paused, awaitingStart, pacingMode, effectiveTempo, numReps]);

  // Tick timer
  useEffect(() => {
    if (phase === 'done') return;
    if (awaitingStart) return; // Pre-start gate — waiting for user to tap Begin
    if (paused) return; // Frozen — pause button or instructions modal open
    // Rep-based work phase is driven by the rep counter above — skip countdown.
    if (!isTimeBased && phase === 'work') return;
    // In manual mode, once the timer parks at 0 there's nothing left to
    // tick — bail to avoid pointless 1Hz wake-ups.
    if (pacingMode === 'manual' && secondsLeft === 0 && phase !== 'countdown') return;
    const id = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          // Phase complete. In manual mode every phase except the
          // pre-workout prep countdown parks at 0 and waits for the
          // user to tap the next arrow.
          const shouldAutoAdvance = pacingMode === 'timed' || phase === 'countdown';
          if (shouldAutoAdvance) {
            setTimeout(() => advancePhase(), 0);
          }
          return 0;
        }
        // Beep on 3,2,1 countdown warning during any phase
        if (s - 1 <= 3 && s - 1 >= 1) {
          beep(880, 120);
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, exerciseIdx, setIdx, paused, awaitingStart, pacingMode]);

  const advancePhase = () => {
    if (phase === 'countdown') {
      beep(660, 250);
      setCurrentSide('right');
      setPhase('work');
      setSecondsLeft(workSeconds);
    } else if (phase === 'work') {
      beep(440, 300);
      // Unilateral: after right side → enter side-switch (reposition rest)
      if (isUnilateral && currentSide === 'right') {
        setCurrentSide('left');
        setPhase('side-switch');
        setSecondsLeft(10);
        return;
      }
      // For unilateral exercises that just finished the left side,
      // reset side state before the set-rest / next-exercise transition.
      if (isUnilateral && currentSide === 'left') {
        setCurrentSide('right');
      }
      // Mark set done
      const isLastSet = setIdx + 1 >= totalSets;
      if (isLastSet) {
        // Finished all sets of this exercise — DO NOT auto-log.
        // The user must tap "Mark as Done" themselves.
        const isLastExercise = exerciseIdx + 1 >= exercises.length;
        if (isLastExercise) {
          beep(880, 600);
          setPhase('done');
        } else {
          // Inter-exercise transition: advance to the next exercise
          // immediately so the 'rest' phase doubles as a preview of the
          // upcoming movement (mp4 + name + countdown beeps on 3-2-1).
          const nextIdx = exerciseIdx + 1;
          setExerciseIdx(nextIdx);
          setSetIdx(0);
          setCurrentSide('right');
          setPhase('rest');
          setSecondsLeft(PREVIEW_SECONDS);
        }
      } else {
        // Rest between sets of THIS exercise — uses the per-exercise
        // restTime from the plan (or the 5s flat buffer for stretch
        // / warm-up / cooldown blocks via isTransitionExercise above).
        setPhase('set-rest');
        setSecondsLeft(restSeconds);
      }
    } else if (phase === 'side-switch') {
      beep(660, 250);
      // Back to work for the left side
      setPhase('work');
      setSecondsLeft(workSeconds);
    } else if (phase === 'set-rest') {
      beep(660, 250);
      setSetIdx(s => s + 1);
      setCurrentSide('right');
      setPhase('work');
      setSecondsLeft(workSeconds);
    } else if (phase === 'rest') {
      beep(660, 250);
      // exerciseIdx + setIdx were already advanced when we entered the
      // preview, so just kick off the new exercise's first work set.
      setCurrentSide('right');
      setPhase('work');
      setSecondsLeft(workSeconds);
    }
  };

  const skip = () => {
    setSecondsLeft(0);
    setTimeout(() => advancePhase(), 0);
  };

  // Manual-mode "next" — advances one phase at a time so the user
  // still passes through every set, rest, and upcoming-exercise
  // preview. Identical to skip() but kept as a named helper for the
  // arrow button so the intent stays readable at the call site.
  const nextManual = () => {
    setSecondsLeft(0);
    setTimeout(() => advancePhase(), 0);
  };

  // Restart the previous exercise from its 10-second preview. If we're
  // already on the first exercise, just restart it from countdown.
  const previous = () => {
    setCurrentSide('right');
    if (exerciseIdx === 0) {
      setSetIdx(0);
      setPhase('countdown');
      setSecondsLeft(10);
      return;
    }
    setExerciseIdx(i => i - 1);
    setSetIdx(0);
    setPhase('rest'); // 'rest' phase = preview of the (now previous) exercise
    setSecondsLeft(PREVIEW_SECONDS);
  };

  // Open written instructions for the current exercise. Forces pause
  // so the timer doesn't tick away while the user is reading.
  const openInstructions = () => {
    setPaused(true);
    setInstructionsOpen(true);
  };
  const closeInstructions = () => {
    setInstructionsOpen(false);
    // Leave `paused` true on close — the user can hit Resume when ready.
  };

  const workLabel = (() => {
    if (isUnilateral) {
      const sideText = currentSide === 'right' ? 'Right Side' : 'Left Side';
      return isTimeBased ? `Exercise — ${sideText}` : `Perform Set — ${sideText}`;
    }
    return isTimeBased ? 'Exercise' : 'Perform Set';
  })();

  const phaseLabel: Record<PlayerPhase, string> = {
    countdown: 'Get Ready',
    work: workLabel,
    'set-rest': 'Rest',
    'side-switch': 'Switch Sides',
    rest: 'Rest and Preview',
    done: 'Workout Complete'
  };

  const phaseColor: Record<PlayerPhase, string> = {
    countdown: 'bg-amber-500',
    work: 'bg-emerald-500',
    'set-rest': 'bg-sky-500',
    'side-switch': 'bg-violet-500',
    rest: 'bg-sky-500',
    done: 'bg-[#FDD000]'
  };

  // ── Pre-workout warning screen ────────────────────────────────────────────
  // Hard gate. Until the user clicks "I Accept" (or backs out), they cannot
  // advance to the player UI. Each Accept click is logged via
  // POST /api/workout-injury-acknowledgements with the planId and the full
  // list of flagged exercises, plus a server-stamped acknowledgedAt.
  if (!injuryAcknowledged && flaggedExercises.length > 0) {
    return (
      <div
        className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-start overflow-y-auto p-4 sm:p-6"
        data-testid="injury-warning-overlay"
      >
        <div className="w-full max-w-xl bg-zinc-900 border-2 border-red-500 rounded-sm shadow-[6px_6px_0px_0px_rgba(239,68,68,1)] p-5 mt-6">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="w-7 h-7 text-red-400 shrink-0" />
            <h2
              className="text-xl sm:text-2xl font-black text-red-400 uppercase tracking-wide"
              data-testid="injury-warning-title"
            >
              Heads up before you start
            </h2>
          </div>
          <p className="text-sm text-white/80 mb-4 leading-relaxed">
            Some exercises in today&apos;s workout may aggravate your recorded
            injuries. Review them below and only proceed if you&apos;re comfortable
            modifying or skipping them as needed.
          </p>

          <ul
            className="space-y-2 mb-5 max-h-[40vh] overflow-y-auto pr-1"
            data-testid="injury-warning-list"
          >
            {flaggedExercises.map((f, i) => (
              <li
                key={`${f.exerciseId}-${i}`}
                className="bg-black/40 border border-zinc-700 rounded-sm p-2.5"
                data-testid={`injury-warning-item-${i}`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-sm font-black text-white">
                    {f.exerciseName}
                  </span>
                  <span
                    className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-sm border shrink-0 ${
                      f.status === 'blocked'
                        ? 'bg-red-900/40 text-red-400 border-red-700/50'
                        : f.status === 'modify'
                        ? 'bg-yellow-900/30 text-yellow-400 border-yellow-700/40'
                        : 'bg-orange-900/30 text-orange-400 border-orange-700/40'
                    }`}
                  >
                    {f.status}
                  </span>
                </div>
                {f.reasons.length > 0 && (
                  <p className="text-xs text-white/70 italic leading-snug">
                    {f.reasons[0]}
                  </p>
                )}
              </li>
            ))}
          </ul>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={acknowledgeInjuryRisk}
              disabled={injuryAckSubmitting}
              className="flex-1 bg-[#FDD000] hover:bg-[#FDD000]/90 text-black font-black uppercase tracking-widest border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] py-5"
              data-testid="injury-warning-accept-button"
            >
              {injuryAckSubmitting ? 'Saving…' : 'I Accept — Start Workout'}
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              disabled={injuryAckSubmitting}
              className="flex-1 sm:flex-initial border-2 border-white/40 text-white hover:bg-white/10 font-black uppercase tracking-widest py-5"
              data-testid="injury-warning-cancel-button"
            >
              Cancel
            </Button>
          </div>
          <p className="text-[10px] text-white/40 mt-3 text-center uppercase tracking-widest">
            Acknowledgement is logged with date &amp; time
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col" data-testid="workout-player">
      {/* Header */}
      <div className="border-b-2 border-[#FDD000] bg-black">
        {/* Row 1: close | plan name | end & rate */}
        <div className="flex items-center gap-2 px-3 pt-3 pb-1">
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/10 shrink-0 -ml-1 p-1"
            data-testid="button-close-player"
          >
            <X className="w-5 h-5" />
          </Button>
          <p className="text-xs font-black text-[#FDD000] uppercase tracking-widest flex-1 truncate text-center">
            {plan.name}
          </p>
          {phase !== 'done' && exerciseIdx > 0 ? (
            <Button
              onClick={() => {
                setEarlyEndIdx(exerciseIdx);
                setPhase('done');
              }}
              variant="ghost"
              size="sm"
              className="text-white/60 hover:bg-white/10 text-[10px] uppercase font-black tracking-widest shrink-0 px-2 py-1"
              data-testid="button-end-early"
            >
              End & rate
            </Button>
          ) : (
            <div className="w-16 shrink-0" />
          )}
        </div>
        {/* Row 2: exercise progress | pacing mode toggle */}
        <div className="flex items-center justify-between px-4 pb-3">
          <p className="text-sm text-white/70 font-bold">
            Exercise {exerciseIdx + 1} of {exercises.length}
          </p>
          {phase !== 'done' && (
            <div
              role="radiogroup"
              aria-label="Workout pacing mode"
              className="inline-flex bg-zinc-900 border border-white/20 rounded-sm overflow-hidden"
              data-testid="toggle-pacing-mode"
            >
              <button
                type="button"
                role="radio"
                aria-checked={pacingMode === 'timed'}
                onClick={() => setPacingMode('timed')}
                className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest transition-colors ${pacingMode === 'timed' ? 'bg-[#FDD000] text-black' : 'text-white/60 hover:bg-white/10'}`}
                data-testid="button-mode-timed"
              >
                Timed
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={pacingMode === 'manual'}
                onClick={() => setPacingMode('manual')}
                className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest transition-colors ${pacingMode === 'manual' ? 'bg-[#FDD000] text-black' : 'text-white/60 hover:bg-white/10'}`}
                data-testid="button-mode-manual"
              >
                Manual
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="min-h-full flex flex-col items-center justify-center p-6 pb-10 text-center">
        {phase === 'done' ? (
          <>
            <div className="text-6xl mb-4">🏆</div>
            <h2 className="text-4xl font-black text-[#FDD000] uppercase mb-2">Workout Complete</h2>
            <p className="text-white/70 mb-6">Great work. All {exercises.length} exercises done.</p>

            {!feedbackDone ? (
              <>
                <h3 className="text-2xl font-black text-white uppercase mb-6">How did that feel?</h3>
                <div className="flex flex-col gap-3 w-full max-w-md mb-6">
                  <Button
                    onClick={() => submitFeedback('too_hard')}
                    disabled={feedbackSubmitting}
                    className="bg-white text-black font-bold py-6 text-base border-2 border-black hover:bg-white/90 justify-start"
                    data-testid="button-feedback-too-hard"
                  >
                    <span className="text-2xl mr-3">😤</span>
                    <span className="text-left"><span className="font-black uppercase">Too hard</span> — I couldn't finish or was exhausted</span>
                  </Button>
                  <Button
                    onClick={() => submitFeedback('just_right')}
                    disabled={feedbackSubmitting}
                    className="bg-white text-black font-bold py-6 text-base border-2 border-black hover:bg-white/90 justify-start"
                    data-testid="button-feedback-just-right"
                  >
                    <span className="text-2xl mr-3">💪</span>
                    <span className="text-left"><span className="font-black uppercase">Just right</span> — challenging but manageable</span>
                  </Button>
                  <Button
                    onClick={() => submitFeedback('too_easy')}
                    disabled={feedbackSubmitting}
                    className="bg-white text-black font-bold py-6 text-base border-2 border-black hover:bg-white/90 justify-start"
                    data-testid="button-feedback-too-easy"
                  >
                    <span className="text-2xl mr-3">😴</span>
                    <span className="text-left"><span className="font-black uppercase">Too easy</span> — I could have done more</span>
                  </Button>
                </div>
                <button
                  onClick={onClose}
                  className="text-white/60 underline text-sm"
                  data-testid="button-skip-feedback"
                >
                  Skip
                </button>
              </>
            ) : (
              <>
                {feedbackResult?.lever && (
                  <div
                    className={`mb-4 px-3 py-1 rounded-sm border-2 border-black font-black uppercase tracking-widest text-xs ${
                      feedbackResult.lever.requiresConfirmation ? 'bg-red-400 text-black' : 'bg-[#FDD000] text-black'
                    }`}
                    data-testid="text-feedback-lever"
                  >
                    Lever {feedbackResult.lever.id}: {feedbackResult.lever.name}
                    {feedbackResult.lever.requiresConfirmation && ' · Needs confirmation'}
                  </div>
                )}

                {/* Partial-completion acknowledgement. Shown for too_hard
                    feedback where the user ended early — counted but at
                    half weight toward the streak. */}
                {feedbackResult?.partial && feedbackResult.feeling === 'too_hard' && (
                  <div className="w-full max-w-md mb-4 bg-amber-900/30 border-2 border-amber-500 rounded-sm p-3 text-left" data-testid="notice-partial">
                    <div className="text-xs uppercase font-black text-amber-300 tracking-widest mb-1">
                      Partial session
                    </div>
                    <p className="text-sm text-white/90">
                      Counted as a partial — it weighs half toward the streak so the system isn't too quick to ease off based on one short session.
                    </p>
                  </div>
                )}

                {/* Alternating-feedback prompt. Suppresses every lever
                    until the user resolves it. */}
                {feedbackResult?.mixedFeedback && !mixedResolved && (
                  <div className="w-full max-w-md mb-4 bg-zinc-900 border-2 border-white/40 rounded-sm p-4 text-left" data-testid="prompt-mixed-feedback">
                    <div className="text-xs uppercase font-black text-white tracking-widest mb-2">
                      Mixed signals
                    </div>
                    <p className="text-sm text-white/90 mb-4">
                      {feedbackResult.mixedFeedback.question}
                    </p>
                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={() => submitMixedDecision(true)}
                        disabled={mixedSubmitting}
                        className="bg-[#FDD000] text-black font-black uppercase border-2 border-black"
                        data-testid="button-mixed-happy"
                      >
                        {feedbackResult.mixedFeedback.confirmText}
                      </Button>
                      <Button
                        onClick={() => submitMixedDecision(false)}
                        disabled={mixedSubmitting}
                        variant="ghost"
                        className="text-white/80"
                        data-testid="button-mixed-adjust"
                      >
                        {feedbackResult.mixedFeedback.declineText}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Rollback notice — when 2 or 3 just-right in a row
                    triggered an automatic partial unwind. */}
                {feedbackResult?.rollback && (
                  <div className="w-full max-w-md mb-4 bg-emerald-900/40 border-2 border-emerald-500 rounded-sm p-3 text-left" data-testid="notice-rollback">
                    <div className="text-xs uppercase font-black text-emerald-300 tracking-widest mb-1">
                      We eased off
                    </div>
                    <p className="text-sm text-white/90">
                      {feedbackResult.streak === 2
                        ? 'You felt good two sessions in a row — undid the most recent tweak so this workout matches that feeling.'
                        : 'Three good sessions in a row — restored your earlier baselines while keeping any swapped exercises you\'ve been doing.'}
                    </p>
                  </div>
                )}

                {/* List of concrete changes the system applied this round */}
                {feedbackResult?.adjustment?.applied && feedbackResult.adjustment.changes.length > 0 && (
                  <div className="w-full max-w-md mb-4 bg-white/5 border-2 border-white/20 rounded-sm p-3 text-left" data-testid="list-adjustment-changes">
                    <div className="text-xs uppercase font-black text-[#FDD000] tracking-widest mb-2">
                      What changed for next time
                    </div>
                    <ul className="space-y-1 text-xs text-white/80">
                      {feedbackResult.adjustment.changes.slice(0, 6).map((c, i) => (
                        <li key={i}>
                          <span className="font-bold">{c.exerciseName}</span>{' '}
                          {c.field === 'remove'
                            ? '— removed from session'
                            : c.field === 'swap'
                              ? `→ ${c.after}`
                              : `${c.field}: ${c.before} → ${c.after}`}
                        </li>
                      ))}
                      {feedbackResult.adjustment.changes.length > 6 && (
                        <li className="text-white/50">…plus {feedbackResult.adjustment.changes.length - 6} more</li>
                      )}
                    </ul>
                  </div>
                )}

                <p className="text-white/80 mb-6 max-w-md" data-testid="text-feedback-message">
                  {feedbackMessage}
                </p>

                {/* Lever 6 confirmation prompt — only shown when the server
                    flagged a level change. Three explicit choices per spec. */}
                {feedbackResult?.adjustment?.prompt && !lever6Decided ? (
                  <div className="w-full max-w-md mb-6 bg-zinc-900 border-2 border-[#FDD000] rounded-sm p-4 text-left" data-testid="prompt-lever6">
                    <h4 className="text-lg font-black text-white mb-2">
                      {feedbackResult.adjustment.prompt.title}
                    </h4>
                    <p className="text-white/80 text-sm mb-4">
                      {feedbackResult.adjustment.prompt.body}
                    </p>
                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={() => submitLever6Decision('yes')}
                        disabled={lever6Submitting}
                        className="bg-[#FDD000] text-black font-black uppercase border-2 border-black"
                        data-testid="button-lever6-yes"
                      >
                        {feedbackResult.adjustment.prompt.confirmText}
                      </Button>
                      <Button
                        onClick={() => submitLever6Decision('no')}
                        disabled={lever6Submitting}
                        className="bg-white text-black font-bold border-2 border-black"
                        data-testid="button-lever6-no"
                      >
                        {feedbackResult.adjustment.prompt.declineText}
                      </Button>
                      <Button
                        onClick={() => submitLever6Decision('later')}
                        disabled={lever6Submitting}
                        variant="ghost"
                        className="text-white/70"
                        data-testid="button-lever6-later"
                      >
                        {feedbackResult.adjustment.prompt.postponeText}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <Button
                      onClick={onClose}
                      className="bg-[#FDD000] text-black font-black uppercase px-8 py-6 text-lg border-2 border-black"
                      data-testid="button-finish-workout"
                    >
                      Finish
                    </Button>
                    {/* User-initiated full rollback. Only surfaced when
                        adjustments exist for this plan, gated behind a
                        confirmation prompt per spec. */}
                    {!rollbackConfirmOpen ? (
                      <button
                        onClick={() => setRollbackConfirmOpen(true)}
                        className="text-white/50 underline text-xs"
                        data-testid="button-open-rollback"
                      >
                        Restore my original plan
                      </button>
                    ) : (
                      <div className="w-full max-w-md bg-zinc-900 border-2 border-white/30 rounded-sm p-3 text-left mt-2" data-testid="prompt-full-rollback">
                        <p className="text-sm text-white/90 mb-3">
                          Would you like to go back to your original plan settings?
                        </p>
                        <div className="flex gap-2">
                          <Button
                            disabled={fullRollbackSubmitting}
                            onClick={async () => {
                              setFullRollbackSubmitting(true);
                              try {
                                await apiRequest('POST', `/api/fitness-plans/${plan.id}/rollback`, { reason: 'user_requested' });
                                toast({ title: 'Plan restored', description: 'Your workout is back to its original settings.' });
                                setRollbackConfirmOpen(false);
                                onClose();
                              } catch (err) {
                                const message = err instanceof Error ? err.message : 'Failed to restore plan';
                                toast({ title: 'Could not restore', description: message, variant: 'destructive' });
                              } finally {
                                setFullRollbackSubmitting(false);
                              }
                            }}
                            className="bg-[#FDD000] text-black font-black uppercase border-2 border-black flex-1"
                            data-testid="button-confirm-rollback"
                          >
                            Yes, restore
                          </Button>
                          <Button
                            disabled={fullRollbackSubmitting}
                            onClick={() => setRollbackConfirmOpen(false)}
                            variant="ghost"
                            className="text-white/70 flex-1"
                            data-testid="button-cancel-rollback"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <div className={`px-4 py-1 rounded-sm border-2 border-black font-black uppercase tracking-widest text-sm text-black mb-4 ${phaseColor[phase]}`}>
              {phaseLabel[phase]}
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-white uppercase mb-2 max-w-2xl" data-testid="text-current-exercise">
              {currentExercise?.exerciseName}
            </h2>
            <p className="text-[#FDD000] font-bold uppercase tracking-wide mb-6">
              {/* HIIT has no set structure — show the time-based length
                  instead of "Set 1 of 1". Everything else keeps the
                  standard "Set X of Y" header. */}
              {isHiitExercise
                ? `${workSeconds}s Interval`
                : <>Set {setIdx + 1} of {totalSets}</>
              }
              {!isTimeBased && numReps > 0 && phase === 'work'
                ? <span className="ml-1">• Rep {Math.min(repCount, numReps)} of {numReps}</span>
                : (!isTimeBased && currentExercise?.reps && phase === 'work'
                    ? ` • ${currentExercise.reps} reps`
                    : null)
              }
            </p>

            {mediaUrl && (<>
              <div className="relative w-full mb-6">
              <div
                role="button"
                tabIndex={0}
                onClick={togglePause}
                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); togglePause(); } }}
                aria-label={awaitingStart ? 'Begin workout' : (paused ? 'Resume workout' : 'Pause workout')}
                className="relative w-full aspect-square bg-white rounded-sm border-2 border-[#FDD000] overflow-hidden cursor-pointer select-none"
                data-testid="media-tap-to-pause"
              >
                {isVideo ? (
                  <video
                    key={mediaUrl}
                    ref={videoRef}
                    src={mediaUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="auto"
                    className="w-full h-full object-contain pointer-events-none"
                    data-testid="video-current-exercise"
                    onLoadedMetadata={() => {
                      const dur = videoRef.current?.duration;
                      if (dur && isFinite(dur) && dur > 0) {
                        setVideoDuration(dur);
                        // If no localStorage override, use the actual video duration as tempo
                        const key = `${TEMPO_OVERRIDE_PREFIX}${exerciseLookupName}`;
                        try {
                          const stored = localStorage.getItem(key);
                          if (!stored) setEffectiveTempo(dur);
                        } catch { setEffectiveTempo(dur); }
                        // Debounce-save the discovered duration back to the DB so other
                        // parts of the app can reference it without loading the video.
                        if (exerciseLookupName) {
                          if (tempoSaveTimerRef.current) clearTimeout(tempoSaveTimerRef.current);
                          tempoSaveTimerRef.current = setTimeout(() => {
                            apiRequest('PATCH', `/api/exercises/${encodeURIComponent(exerciseLookupName)}/tempo`, { tempoSec: dur })
                              .catch(() => { /* best-effort, ignore errors */ });
                          }, 2000);
                        }
                      }
                    }}
                  />
                ) : (
                  <img
                    key={mediaUrl}
                    src={mediaUrl}
                    alt={currentExercise?.exerciseName ?? ''}
                    className="w-full h-full object-contain pointer-events-none"
                  />
                )}
                {/* Timer overlay — bottom-right corner of the video */}
                {!awaitingStart && phase !== 'done' && (
                  <div className="absolute bottom-3 right-3 bg-black/75 backdrop-blur-sm rounded px-2.5 py-1.5 flex flex-col items-center leading-none pointer-events-none" data-testid="timer-overlay">
                    <span className="text-4xl font-black text-[#FDD000] tabular-nums" data-testid="text-timer">
                      {(!isTimeBased && phase === 'work' && numReps > 0) ? Math.min(repCount, numReps) : secondsLeft}
                    </span>
                    <span className="text-[9px] text-white/60 uppercase font-bold mt-0.5">
                      {(!isTimeBased && phase === 'work' && numReps > 0) ? `/${numReps} reps` : 'sec'}
                    </span>
                  </div>
                )}
                {/* Paused indicator overlay */}
                {paused && !awaitingStart && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
                    <Pause className="w-16 h-16 text-white/80" />
                  </div>
                )}
                {awaitingStart && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm pointer-events-none">
                    <div className="px-6 py-3 bg-[#FDD000] text-black font-black uppercase tracking-widest text-lg border-2 border-black rounded-sm shadow-lg" data-testid="overlay-begin-label">
                      Begin
                    </div>
                  </div>
                )}
              </div>
              {/* Manual-mode prev arrow — overlaid on video left edge */}
              {pacingMode === 'manual' && !awaitingStart && exerciseIdx > 0 && (
                <button
                  type="button"
                  onClick={previous}
                  aria-label="Previous exercise"
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm text-white border border-white/30 flex items-center justify-center shadow-lg hover:bg-black/80 active:scale-95 transition z-10"
                  data-testid="button-manual-prev"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}
              {/* Manual-mode next arrow — overlaid on video right edge */}
              {pacingMode === 'manual' && !awaitingStart && (
                <button
                  type="button"
                  onClick={nextManual}
                  aria-label="Next phase"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm text-white border border-white/30 flex items-center justify-center shadow-lg hover:bg-black/80 active:scale-95 transition z-10"
                  data-testid="button-manual-next"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              )}
              </div>

              {/* ── Tempo nudge control ───────────────────────────────────────
                  Visible during rep-based work only. Lets users speed up or
                  slow down the rep cadence by 0.25s per tap. The choice
                  persists in localStorage across sessions. */}
              {!isTimeBased && phase === 'work' && numReps > 0 && !awaitingStart && (
                <div className="flex items-center gap-2 mt-2 mb-1" data-testid="tempo-control">
                  {/* "–" reduces seconds-per-rep → cadence gets FASTER */}
                  <button
                    type="button"
                    onClick={() => {
                      const next = Math.max(1.0, Math.round((effectiveTempo - 0.25) * 4) / 4);
                      setEffectiveTempo(next);
                      try { localStorage.setItem(`${TEMPO_OVERRIDE_PREFIX}${exerciseLookupName}`, String(next)); } catch { /* ignore */ }
                    }}
                    aria-label="Faster cadence (less time per rep)"
                    className="w-7 h-7 rounded-sm bg-white/10 border border-white/30 text-white font-black text-base flex items-center justify-center hover:bg-white/20 active:scale-95 transition"
                    data-testid="button-tempo-faster"
                  >–</button>
                  <span className="text-white/70 text-[10px] font-bold uppercase tracking-widest min-w-[52px] text-center">
                    {effectiveTempo.toFixed(2)}s/rep
                  </span>
                  {/* "+" increases seconds-per-rep → cadence gets SLOWER */}
                  <button
                    type="button"
                    onClick={() => {
                      const next = Math.min(8.0, Math.round((effectiveTempo + 0.25) * 4) / 4);
                      setEffectiveTempo(next);
                      try { localStorage.setItem(`${TEMPO_OVERRIDE_PREFIX}${exerciseLookupName}`, String(next)); } catch { /* ignore */ }
                    }}
                    aria-label="Slower cadence (more time per rep)"
                    className="w-7 h-7 rounded-sm bg-white/10 border border-white/30 text-white font-black text-base flex items-center justify-center hover:bg-white/20 active:scale-95 transition"
                    data-testid="button-tempo-slower"
                  >+</button>
                </div>
              )}
            </>)}
            {!mediaUrl && awaitingStart && (
              <div
                role="button"
                tabIndex={0}
                onClick={begin}
                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); begin(); } }}
                aria-label="Begin workout"
                className="w-full aspect-square mb-6 flex items-center justify-center bg-[#FDD000] text-black font-black uppercase tracking-widest text-2xl border-2 border-black rounded-sm cursor-pointer select-none"
                data-testid="button-begin-no-media"
              >
                Begin
              </div>
            )}

            <button
              type="button"
              onClick={togglePause}
              aria-label={paused ? 'Resume workout' : 'Pause workout'}
              className="cursor-pointer select-none mt-3 mb-4 px-4 py-2 rounded bg-white/5 border border-white/10 text-white/40 text-[10px] uppercase tracking-widest font-bold hover:bg-white/10 transition"
              data-testid="timer-tap-to-pause"
            >
              {paused ? '▶ Resume' : '⏸ Pause'}
            </button>

            {/* Manual completion button — user must tap this to log the exercise */}
            {currentExercise && (
              <button
                type="button"
                onClick={() => {
                  if (!currentExercise?.id || markedDone.has(currentExercise.id)) return;
                  setMarkedDone(prev => new Set([...prev, currentExercise.id]));
                  onExerciseComplete(currentExercise.id);
                }}
                disabled={markedDone.has(currentExercise?.id ?? '')}
                className={`w-full max-w-xs mb-4 py-4 rounded-sm border-2 font-black uppercase tracking-widest text-base transition-all ${
                  markedDone.has(currentExercise?.id ?? '')
                    ? 'bg-emerald-900/40 border-emerald-600 text-emerald-400 cursor-default'
                    : 'bg-emerald-600 border-emerald-500 text-white hover:bg-emerald-500 active:scale-95'
                }`}
                data-testid="button-mark-done"
              >
                {markedDone.has(currentExercise?.id ?? '') ? '✓ Logged' : '✓ Mark as Done'}
              </button>
            )}

            <div className="flex flex-wrap justify-center gap-3 max-w-2xl">
              <Button
                onClick={previous}
                variant="outline"
                className="border-2 border-white/40 text-white hover:bg-white/10 font-black uppercase"
                data-testid="button-previous-exercise"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              <Button
                onClick={() => setPaused(p => !p)}
                variant="outline"
                className="border-2 border-white/40 text-white hover:bg-white/10 font-black uppercase"
                data-testid="button-pause-workout"
              >
                {paused ? (
                  <>
                    <Play className="w-4 h-4 mr-1" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="w-4 h-4 mr-1" />
                    Pause
                  </>
                )}
              </Button>
              <Button
                onClick={openInstructions}
                variant="outline"
                className="border-2 border-white/40 text-white hover:bg-white/10 font-black uppercase"
                data-testid="button-instructions"
              >
                <FileText className="w-4 h-4 mr-1" />
                Instructions
              </Button>
              <Button
                onClick={openAdjust}
                variant="outline"
                className="border-2 border-white/40 text-white hover:bg-white/10 font-black uppercase"
                data-testid="button-adjust-exercise"
              >
                <SlidersHorizontal className="w-4 h-4 mr-1" />
                Adjust
              </Button>
              <Button
                onClick={skip}
                variant="outline"
                className="border-2 border-[#FDD000] text-[#FDD000] hover:bg-[#FDD000] hover:text-black font-black uppercase"
                data-testid="button-skip-phase"
              >
                Skip
              </Button>
              <Button
                onClick={onClose}
                variant="outline"
                className="border-2 border-zinc-700 text-zinc-400 hover:bg-zinc-800 font-black uppercase"
                data-testid="button-end-workout"
              >
                End Workout
              </Button>
            </div>
            {paused && (
              <p className="mt-4 text-amber-300 text-xs uppercase font-black tracking-widest" data-testid="text-paused-indicator">
                Paused
              </p>
            )}
          </>
        )}
        </div>
      </div>

      {/* Written instructions modal — opens paused so the timer freezes
          while the user reads. Falls back to a friendly message when the
          plan exercise has no notes saved. */}
      <Dialog open={instructionsOpen} onOpenChange={(open) => (open ? openInstructions() : closeInstructions())}>
        <DialogContent className="bg-zinc-900 border-2 border-[#FDD000] text-white max-w-3xl w-[92vw] z-[200]" data-testid="dialog-instructions">
          <DialogHeader>
            <DialogTitle className="text-[#FDD000] font-black uppercase tracking-wide">
              {currentExercise?.exerciseName}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Written instructions for this exercise
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm max-h-[55vh] overflow-y-auto" data-testid="text-instructions-body">
            {instructionsLoading ? (
              <p className="text-white/60 italic">Loading instructions…</p>
            ) : exerciseDetails?.instructions && exerciseDetails.instructions.trim().length > 0 ? (
              <p className="whitespace-pre-line text-white/90">{exerciseDetails.instructions}</p>
            ) : (
              <p className="text-white/60 italic">
                No written instructions are saved for this exercise.
              </p>
            )}
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => {
                closeInstructions();
                setPaused(false);
              }}
              className="bg-[#FDD000] text-black font-black uppercase border-2 border-black flex-1"
              data-testid="button-instructions-resume"
            >
              <Play className="w-4 h-4 mr-1" />
              Resume Workout
            </Button>
            <Button
              onClick={closeInstructions}
              variant="ghost"
              className="text-white/70 flex-1"
              data-testid="button-instructions-keep-paused"
            >
              Close (stay paused)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Adjust exercise modal — opens paused so timers freeze while
          the user tweaks sets / reps / rest period using sliders styled
          to match the global Fine-tune dialog. On save, the user picks
          whether the change applies just to this workout (local state)
          or sticks for every future workout (PUT to the plan row). */}
      <Dialog open={adjustOpen} onOpenChange={(open) => { if (!open) closeAdjust(); }}>
        <DialogContent className="bg-zinc-950 border-2 border-[#FDD000] text-white sm:max-w-md z-[200]" data-testid="dialog-adjust-exercise">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase">Adjust this exercise</DialogTitle>
            <DialogDescription className="text-white/60">
              {currentExercise?.exerciseName} — drag the sliders, then choose whether to save just for today or for every workout going forward.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Sets slider */}
            <div data-testid="slider-adjust-sets-row">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-black uppercase tracking-widest text-[#FDD000]">Sets</label>
                <span className="text-xs font-bold tabular-nums text-white/80" data-testid="text-adjust-sets-value">
                  {adjustSets}
                </span>
              </div>
              <Slider
                value={[adjustSets]}
                onValueChange={(v) => setAdjustSets(v[0] ?? 1)}
                min={1}
                max={10}
                step={1}
                data-testid="slider-adjust-sets"
              />
              <div className="flex justify-between text-[10px] text-white/40 mt-1 uppercase">
                <span>less</span>
                <span>more</span>
              </div>
            </div>

            {/* Reps slider */}
            <div data-testid="slider-adjust-reps-row">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-black uppercase tracking-widest text-[#FDD000]">Reps</label>
                <span className="text-xs font-bold tabular-nums text-white/80" data-testid="text-adjust-reps-value">
                  {adjustReps}
                </span>
              </div>
              <Slider
                value={[adjustReps]}
                onValueChange={(v) => setAdjustReps(v[0] ?? 1)}
                min={1}
                max={30}
                step={1}
                data-testid="slider-adjust-reps"
              />
              <div className="flex justify-between text-[10px] text-white/40 mt-1 uppercase">
                <span>lighter</span>
                <span>heavier</span>
              </div>
            </div>

            {/* Rest slider */}
            <div data-testid="slider-adjust-rest-row">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-black uppercase tracking-widest text-[#FDD000]">Rest time</label>
                <span className="text-xs font-bold tabular-nums text-white/80" data-testid="text-adjust-rest-value">
                  {adjustRest}s
                </span>
              </div>
              <Slider
                value={[adjustRest]}
                onValueChange={(v) => setAdjustRest(v[0] ?? 0)}
                min={0}
                max={300}
                step={5}
                data-testid="slider-adjust-rest"
              />
              <div className="flex justify-between text-[10px] text-white/40 mt-1 uppercase">
                <span>shorter</span>
                <span>longer</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              disabled={adjustSubmitting}
              onClick={() => saveAdjust('session')}
              className="bg-[#FDD000] text-black font-black uppercase border-2 border-black"
              data-testid="button-adjust-save-session"
            >
              {adjustSubmitting ? 'Saving…' : 'Just this workout'}
            </Button>
            <Button
              disabled={adjustSubmitting}
              onClick={() => saveAdjust('plan')}
              variant="outline"
              className="border-2 border-white/40 text-white hover:bg-white/10 font-black uppercase"
              data-testid="button-adjust-save-plan"
            >
              {adjustSubmitting ? 'Saving…' : 'All future workouts'}
            </Button>
            <Button
              disabled={adjustSubmitting}
              onClick={closeAdjust}
              variant="ghost"
              className="text-white/70"
              data-testid="button-adjust-cancel"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Progress bar */}
      <div className="h-2 bg-zinc-900">
        <div
          className="h-full bg-[#FDD000] transition-all duration-500"
          style={{ width: `${((exerciseIdx + (phase === 'done' ? 1 : 0)) / exercises.length) * 100}%` }}
        />
      </div>
    </div>
  );
}