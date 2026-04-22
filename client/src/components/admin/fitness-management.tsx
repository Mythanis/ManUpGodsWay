import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Plus,
  Edit,
  Trash2,
  Calendar,
  Dumbbell,
  Clock,
  Activity,
  Eye,
  EyeOff,
  Timer,
  Target,
  Upload,
  Download,
  FileText,
  Crown,
  Star,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  AlertTriangle,
  ImageIcon,
} from "lucide-react";
import { format } from "date-fns";

// ── Types ──────────────────────────────────────────────────────────────────

interface Exercise {
  id: number;
  name: string;
  bodyPart: string;
  equipment: string;
  level: string;
  instructions: string;
  shortInstructions: string | null;
  mediaFile: string;
  hiit: string;
  stretching: string;
}

interface ExerciseEditForm {
  name: string;
  bodyPart: string;
  equipment: string;
  level: string;
  instructions: string;
  shortInstructions: string;
  mediaFile: string;
  hiit: string;
  stretching: string;
}

interface FitnessChallenge {
  id: string;
  title: string;
  description: string;
  targetDate: string;
  videoId?: string;
  videoUrl?: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  duration: number;
  equipment?: string;
  category: "strength" | "cardio" | "flexibility" | "general";
  isPublished: boolean;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface FitnessChallengeFormData {
  title: string;
  description: string;
  targetDate: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  duration: number;
  equipment: string;
  category: "strength" | "cardio" | "flexibility" | "general";
  videoUrl: string;
}

interface PreBuiltFitnessPlan {
  id: string;
  title: string;
  description?: string;
  category: "strength" | "cardio" | "flexibility" | "general";
  difficulty: "beginner" | "intermediate" | "advanced";
  duration: number;
  equipment?: string;
  tier: "free" | "premium" | "vip";
  thumbnailUrl?: string;
  downloadUrl?: string;
  downloadFileName?: string;
  isPublished: boolean;
  isPurchasable?: boolean;
  price?: number;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface PreBuiltPlanFormData {
  title: string;
  description: string;
  category: "strength" | "cardio" | "flexibility" | "general";
  difficulty: "beginner" | "intermediate" | "advanced";
  duration: number;
  equipment: string;
  tier: "free" | "premium" | "vip";
  isPurchasable: boolean;
  priceInCents: string;
}

const EX_PAGE_SIZE = 25;

// ── Component ──────────────────────────────────────────────────────────────

export default function FitnessManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── Challenge state ────────────────────────────────────────────────────
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState<FitnessChallenge | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // ── Pre-built plans state ──────────────────────────────────────────────
  const [showPlanCreateDialog, setShowPlanCreateDialog] = useState(false);
  const [showPlanEditDialog, setShowPlanEditDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PreBuiltFitnessPlan | null>(null);
  const [planFormData, setPlanFormData] = useState<PreBuiltPlanFormData>({
    title: "",
    description: "",
    category: "general",
    difficulty: "beginner",
    duration: 60,
    equipment: "",
    tier: "free",
    isPurchasable: false,
    priceInCents: "",
  });
  const [uploadingPlanId, setUploadingPlanId] = useState<string | null>(null);

  // ── Exercise management state ──────────────────────────────────────────
  const [exSearch, setExSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [exPage, setExPage] = useState(0);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearInput, setClearInput] = useState("");
  const [showClearMediaConfirm, setShowClearMediaConfirm] = useState(false);
  const [clearMediaInput, setClearMediaInput] = useState("");
  const [showExEdit, setShowExEdit] = useState(false);
  const [selectedEx, setSelectedEx] = useState<Exercise | null>(null);
  const [exForm, setExForm] = useState<ExerciseEditForm>({
    name: "",
    bodyPart: "",
    equipment: "",
    level: "Beginner",
    instructions: "",
    shortInstructions: "",
    mediaFile: "",
    hiit: "No",
    stretching: "No",
  });
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const [deleteExConfirm, setDeleteExConfirm] = useState<Exercise | null>(null);

  // Bulk media import state
  const bulkInputRef = useRef<HTMLInputElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [bulkResult, setBulkResult] = useState<{
    totals: { uploaded: number; unmatched: number; failed: number; received: number };
    matched: Array<{ filename: string; exerciseName: string }>;
    unmatched: string[];
    failed: Array<{ filename: string; error: string }>;
  } | null>(null);

  // Debounce exercise search (300 ms) and reset page on new search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(exSearch);
      setExPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [exSearch]);

  // ── Exercise query ─────────────────────────────────────────────────────
  const { data: exercises = [], isLoading: exLoading } = useQuery<Exercise[]>({
    queryKey: ["/api/exercises", debouncedSearch, exPage],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(EX_PAGE_SIZE),
        offset: String(exPage * EX_PAGE_SIZE),
      });
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      const res = await fetch(`/api/exercises?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch exercises");
      return res.json();
    },
  });

  // ── Media coverage stats ───────────────────────────────────────────────
  const { data: mediaStats, isLoading: mediaStatsLoading } = useQuery<{
    totalExercises: number;
    withMedia: number;
    missingMedia: number;
    filesInStorage: number;
  }>({
    queryKey: ["/api/admin/exercises/media-stats"],
  });

  const invalidateMediaStats = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/admin/exercises/media-stats"] });

  // ── Exercise mutations ─────────────────────────────────────────────────
  const clearAllMutation = useMutation({
    mutationFn: async () => apiRequest("DELETE", "/api/admin/exercises/clear-all"),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/exercises"] });
      invalidateMediaStats();
      setShowClearConfirm(false);
      setClearInput("");
      toast({
        title: "Database Cleared",
        description: `Removed ${data.deleted?.exercises ?? 0} exercises, ${data.deleted?.plans ?? 0} plans, ${data.deleted?.favorites ?? 0} favorites.`,
      });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to clear database", variant: "destructive" });
    },
  });

  const clearAllMediaMutation = useMutation({
    mutationFn: async () => apiRequest("DELETE", "/api/admin/exercise-media/clear-all"),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/exercises"] });
      invalidateMediaStats();
      setShowClearMediaConfirm(false);
      setClearMediaInput("");
      toast({
        title: "Media Files Deleted",
        description:
          data?.message ||
          `Deleted ${data?.deleted ?? 0} file(s) from storage and cleared ${data?.cleared ?? 0} exercise media reference(s).`,
      });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to delete media files", variant: "destructive" });
    },
  });

  const patchExerciseMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ExerciseEditForm> }) =>
      apiRequest("PATCH", `/api/admin/exercises/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exercises"] });
      invalidateMediaStats();
      setShowExEdit(false);
      setSelectedEx(null);
      toast({ title: "Exercise Updated", description: "Changes saved successfully." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to update exercise", variant: "destructive" });
    },
  });

  const deleteExerciseMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/admin/exercises/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exercises"] });
      invalidateMediaStats();
      setDeleteExConfirm(null);
      toast({ title: "Exercise Deleted", description: "Exercise removed from the database." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to delete exercise", variant: "destructive" });
    },
  });

  const removeMediaMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/admin/exercises/${id}/media`),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/exercises"] });
      invalidateMediaStats();
      setExForm((f) => ({ ...f, mediaFile: "" }));
      setSelectedEx((prev) => (prev ? { ...prev, mediaFile: "" } : prev));
      toast({ title: "Media Removed" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to remove media", variant: "destructive" });
    },
  });

  // ── Exercise helpers ───────────────────────────────────────────────────
  const openExEdit = (ex: Exercise) => {
    setSelectedEx(ex);
    setExForm({
      name: ex.name,
      bodyPart: ex.bodyPart,
      equipment: ex.equipment,
      level: ex.level,
      instructions: ex.instructions,
      shortInstructions: ex.shortInstructions ?? "",
      mediaFile: ex.mediaFile,
      hiit: ex.hiit ?? "No",
      stretching: ex.stretching ?? "No",
    });
    setShowExEdit(true);
  };

  const handleExSave = () => {
    if (!selectedEx) return;
    patchExerciseMutation.mutate({ id: selectedEx.id, data: exForm });
  };

  const handleMediaUpload = useCallback(
    async (file: File) => {
      if (!selectedEx) return;
      try {
        setUploadingMedia(true);
        const form = new FormData();
        form.append("media", file);
        const res = await fetch(`/api/admin/exercises/${selectedEx.id}/media`, {
          method: "POST",
          credentials: "include",
          body: form,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || "Upload failed");
        }
        const updated: Exercise = await res.json();
        queryClient.invalidateQueries({ queryKey: ["/api/exercises"] });
      invalidateMediaStats();
        setExForm((f) => ({ ...f, mediaFile: updated.mediaFile }));
        setSelectedEx((prev) => (prev ? { ...prev, mediaFile: updated.mediaFile } : prev));
        toast({ title: "Media Uploaded", description: "New file saved to storage." });
      } catch (err: any) {
        toast({ title: "Upload Failed", description: err.message || "Could not upload file", variant: "destructive" });
      } finally {
        setUploadingMedia(false);
      }
    },
    [selectedEx, queryClient, toast]
  );

  const handleBulkMediaUpload = useCallback(
    async (files: FileList) => {
      if (files.length === 0) return;
      setBulkUploading(true);
      setBulkProgress({ done: 0, total: files.length });
      setBulkResult(null);
      try {
        const form = new FormData();
        for (let i = 0; i < files.length; i++) form.append("files", files[i]);
        const res = await fetch("/api/admin/exercises/bulk-media", {
          method: "POST",
          credentials: "include",
          body: form,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || "Bulk upload failed");
        }
        const data = await res.json();
        setBulkResult(data);
        queryClient.invalidateQueries({ queryKey: ["/api/exercises"] });
      invalidateMediaStats();
        toast({
          title: "Bulk Import Complete",
          description: `Uploaded ${data.totals.uploaded}/${data.totals.received} files. ${data.totals.unmatched} unmatched, ${data.totals.failed} failed.`,
        });
      } catch (err: any) {
        toast({ title: "Bulk Upload Failed", description: err.message || "Could not upload files", variant: "destructive" });
      } finally {
        setBulkUploading(false);
        setBulkProgress(null);
      }
    },
    [queryClient, toast]
  );

  const isMediaPreviewable = (url: string) =>
    !!url && (url.startsWith("/api/media/") || url.startsWith("http") || url.startsWith("/"));

  // ── Challenge state + mutations (existing) ────────────────────────────
  const [formData, setFormData] = useState<FitnessChallengeFormData>({
    title: "",
    description: "",
    targetDate: "",
    difficulty: "beginner",
    duration: 30,
    equipment: "",
    category: "general",
    videoUrl: "",
  });

  const { data: challenges = [], isLoading } = useQuery({
    queryKey: ["api", "admin", "fitness-challenges"],
    queryFn: async () => {
      const response = await fetch("/api/admin/fitness-challenges", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch fitness challenges");
      return response.json();
    },
  });

  const createChallengeMutation = useMutation({
    mutationFn: async (data: FitnessChallengeFormData) => {
      const response = await fetch("/api/fitness-challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create fitness challenge");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api", "admin", "fitness-challenges"] });
      queryClient.invalidateQueries({ queryKey: ["api", "fitness-challenges"] });
      setShowCreateDialog(false);
      resetForm();
      toast({ title: "Success", description: "Fitness challenge created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create fitness challenge", variant: "destructive" });
    },
  });

  const updateChallengeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FitnessChallengeFormData }) => {
      const response = await fetch(`/api/fitness-challenges/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update fitness challenge");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api", "admin", "fitness-challenges"] });
      queryClient.invalidateQueries({ queryKey: ["api", "fitness-challenges"] });
      setShowEditDialog(false);
      setSelectedChallenge(null);
      resetForm();
      toast({ title: "Success", description: "Fitness challenge updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update fitness challenge", variant: "destructive" });
    },
  });

  const deleteChallengeMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/fitness-challenges/${id}`, { method: "DELETE", credentials: "include" });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete fitness challenge");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api", "admin", "fitness-challenges"] });
      queryClient.invalidateQueries({ queryKey: ["api", "fitness-challenges"] });
      toast({ title: "Success", description: "Fitness challenge deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete fitness challenge", variant: "destructive" });
    },
  });

  const togglePublishMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/fitness-challenges/${id}/publish`, { method: "POST", credentials: "include" });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update publication status");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api", "admin", "fitness-challenges"] });
      queryClient.invalidateQueries({ queryKey: ["api", "fitness-challenges"] });
      toast({ title: "Success", description: "Fitness challenge publication status updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update publication status", variant: "destructive" });
    },
  });

  // ── Pre-built plans mutations (existing) ───────────────────────────────
  const { data: preBuiltPlans = [], isLoading: isLoadingPlans } = useQuery({
    queryKey: ["api", "admin", "pre-built-fitness-plans"],
    queryFn: async () => {
      const response = await fetch("/api/admin/pre-built-fitness-plans", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch pre-built fitness plans");
      return response.json();
    },
  });

  const createPlanMutation = useMutation({
    mutationFn: async (data: PreBuiltPlanFormData) => {
      const response = await fetch("/api/pre-built-fitness-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create plan");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api", "admin", "pre-built-fitness-plans"] });
      setShowPlanCreateDialog(false);
      resetPlanForm();
      toast({ title: "Success", description: "Fitness plan created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: PreBuiltPlanFormData }) => {
      const response = await fetch(`/api/pre-built-fitness-plans/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update plan");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api", "admin", "pre-built-fitness-plans"] });
      setShowPlanEditDialog(false);
      setSelectedPlan(null);
      resetPlanForm();
      toast({ title: "Success", description: "Fitness plan updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/pre-built-fitness-plans/${id}`, { method: "DELETE", credentials: "include" });
      if (!response.ok) throw new Error("Failed to delete plan");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api", "admin", "pre-built-fitness-plans"] });
      toast({ title: "Success", description: "Fitness plan deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const togglePlanPublishMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/pre-built-fitness-plans/${id}/publish`, { method: "POST", credentials: "include" });
      if (!response.ok) throw new Error("Failed to update publication status");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api", "admin", "pre-built-fitness-plans"] });
      toast({ title: "Success", description: "Publication status updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const uploadPlanDocument = async (planId: string, file: File) => {
    try {
      setUploadingPlanId(planId);
      const formData = new FormData();
      formData.append("document", file);
      const response = await fetch(`/api/pre-built-fitness-plans/${planId}/upload`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!response.ok) throw new Error("Failed to upload document");
      queryClient.invalidateQueries({ queryKey: ["api", "admin", "pre-built-fitness-plans"] });
      toast({ title: "Success", description: "Document uploaded successfully" });
    } catch {
      toast({ title: "Error", description: "Failed to upload document", variant: "destructive" });
    } finally {
      setUploadingPlanId(null);
    }
  };

  // Import exercises from a user-selected JSON file
  const importExercises = async (file: File) => {
    try {
      setIsImporting(true);
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/exercises/import-from-file", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "Failed to import exercises");
      }
      toast({ title: "Success", description: data.message || `${data.count} exercises imported successfully` });
      queryClient.invalidateQueries({ queryKey: ["/api/exercises"] });
      invalidateMediaStats();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to import exercises",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  // ── Form helpers ───────────────────────────────────────────────────────
  const resetPlanForm = () => {
    setPlanFormData({ title: "", description: "", category: "general", difficulty: "beginner", duration: 60, equipment: "", tier: "free", isPurchasable: false, priceInCents: "" });
  };

  const handlePlanCreate = () => { setShowPlanCreateDialog(true); resetPlanForm(); };

  const handlePlanEdit = (plan: PreBuiltFitnessPlan) => {
    setSelectedPlan(plan);
    setPlanFormData({ title: plan.title, description: plan.description || "", category: plan.category, difficulty: plan.difficulty, duration: plan.duration, equipment: plan.equipment || "", tier: plan.tier, isPurchasable: plan.isPurchasable || false, priceInCents: plan.price ? String(plan.price / 100) : "" });
    setShowPlanEditDialog(true);
  };

  const handlePlanSubmit = () => {
    if (!planFormData.title) { toast({ title: "Error", description: "Title is required", variant: "destructive" }); return; }
    if (planFormData.isPurchasable && (!planFormData.priceInCents || isNaN(parseFloat(planFormData.priceInCents)) || parseFloat(planFormData.priceInCents) <= 0)) {
      toast({ title: "Error", description: "Enter a valid price for this purchasable plan", variant: "destructive" }); return;
    }
    const submitData = { ...planFormData, price: planFormData.isPurchasable ? Math.round(parseFloat(planFormData.priceInCents) * 100) : null };
    if (selectedPlan) { updatePlanMutation.mutate({ id: selectedPlan.id, data: submitData }); }
    else { createPlanMutation.mutate(submitData); }
  };

  const handlePlanDelete = (plan: PreBuiltFitnessPlan) => {
    if (confirm(`Are you sure you want to delete "${plan.title}"?`)) deletePlanMutation.mutate(plan.id);
  };

  const resetForm = () => { setFormData({ title: "", description: "", targetDate: "", difficulty: "beginner", duration: 30, equipment: "", category: "general", videoUrl: "" }); };

  const handleCreate = () => { setShowCreateDialog(true); resetForm(); };

  const handleEdit = (challenge: FitnessChallenge) => {
    setSelectedChallenge(challenge);
    setFormData({ title: challenge.title, description: challenge.description, targetDate: format(new Date(challenge.targetDate), "yyyy-MM-dd"), difficulty: challenge.difficulty, duration: challenge.duration, equipment: challenge.equipment || "", category: challenge.category, videoUrl: challenge.videoUrl || "" });
    setShowEditDialog(true);
  };

  const handleSubmit = () => {
    if (!formData.title || !formData.description || !formData.targetDate) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" }); return;
    }
    if (selectedChallenge) { updateChallengeMutation.mutate({ id: selectedChallenge.id, data: formData }); }
    else { createChallengeMutation.mutate(formData); }
  };

  const handleDelete = (challenge: FitnessChallenge) => {
    if (confirm(`Are you sure you want to delete "${challenge.title}"?`)) deleteChallengeMutation.mutate(challenge.id);
  };

  const handleTogglePublish = (challenge: FitnessChallenge) => togglePublishMutation.mutate(challenge.id);

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = { strength: "bg-red-100 text-red-800", cardio: "bg-blue-100 text-blue-800", flexibility: "bg-green-100 text-green-800", general: "bg-purple-100 text-purple-800" };
    return colors[category] || "bg-gray-100 text-gray-800";
  };

  const getDifficultyColor = (difficulty: string) => {
    const colors: Record<string, string> = { beginner: "bg-green-100 text-green-800", intermediate: "bg-yellow-100 text-yellow-800", advanced: "bg-red-100 text-red-800" };
    return colors[difficulty] || "bg-gray-100 text-gray-800";
  };

  const getTierColor = (tier: string) => tier !== "free" ? "bg-ministry-gold-exact/20 text-ministry-gold" : "bg-gray-100 text-gray-800";
  const getTierIcon = (tier: string) => tier !== "free" ? <Crown className="w-3 h-3 mr-1" /> : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ministry-gold"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Exercise Database Controls ─────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Exercise Database
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Media coverage stats — surface drift between DB and storage at a glance. */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4" data-testid="exercise-media-stats">
            {[
              { label: "Total Exercises", value: mediaStats?.totalExercises, testId: "stat-total-exercises" },
              { label: "With Media", value: mediaStats?.withMedia, testId: "stat-with-media" },
              { label: "Missing Media", value: mediaStats?.missingMedia, testId: "stat-missing-media" },
              { label: "Files in Storage", value: mediaStats?.filesInStorage, testId: "stat-files-in-storage" },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-md border bg-muted/40 px-3 py-2"
                data-testid={s.testId}
              >
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <div className="text-2xl font-semibold">
                  {mediaStatsLoading ? (
                    <span className="inline-block h-7 w-12 bg-muted rounded animate-pulse align-middle" />
                  ) : (
                    (s.value ?? 0).toLocaleString()
                  )}
                </div>
              </div>
            ))}
          </div>
          {!mediaStatsLoading &&
            mediaStats &&
            mediaStats.withMedia !== mediaStats.filesInStorage && (
              <p className="text-xs text-orange-600 mb-3" data-testid="text-media-drift-warning">
                Heads up: the database thinks {mediaStats.withMedia.toLocaleString()} exercise
                {mediaStats.withMedia === 1 ? " has" : "s have"} media attached, but storage actually
                holds {mediaStats.filesInStorage.toLocaleString()} file
                {mediaStats.filesInStorage === 1 ? "" : "s"}. Re‑run Bulk Import Media or check the
                JSON's <code className="font-mono">media_file</code> values.
              </p>
            )}
          <p className="text-sm text-muted-foreground mb-4">
            Upload a JSON file to replace the exercise database, or clear all exercise data including user plans and favorites.
          </p>
          <div className="flex flex-wrap gap-3">
            <input
              ref={importFileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              data-testid="input-import-exercises-file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importExercises(file);
                e.target.value = "";
              }}
            />
            <Button
              onClick={() => importFileInputRef.current?.click()}
              disabled={isImporting}
              className="bg-ministry-charcoal hover:bg-ministry-charcoal/90 text-white"
              data-testid="button-import-exercises"
            >
              {isImporting ? (
                <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />Importing…</>
              ) : (
                <><Upload className="w-4 h-4 mr-2" />Import Exercises from File</>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => bulkInputRef.current?.click()}
              disabled={bulkUploading}
              className="border-blue-500 text-blue-600 hover:bg-blue-50"
              data-testid="button-bulk-import-media"
            >
              {bulkUploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2" />
                  Uploading{bulkProgress ? ` ${bulkProgress.total} files…` : "…"}
                </>
              ) : (
                <><ImageIcon className="w-4 h-4 mr-2" />Bulk Import Media</>
              )}
            </Button>
            <input
              ref={bulkInputRef}
              type="file"
              multiple
              accept="image/*,.gif,video/mp4,video/webm,video/quicktime"
              className="hidden"
              onChange={(e) => {
                const fl = e.target.files;
                if (fl && fl.length > 0) handleBulkMediaUpload(fl);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              className="border-orange-500 text-orange-600 hover:bg-orange-50"
              onClick={() => { setClearMediaInput(""); setShowClearMediaConfirm(true); }}
              data-testid="button-clear-exercise-media"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete All Media Files
            </Button>
            <Button
              variant="outline"
              className="border-red-500 text-red-600 hover:bg-red-50"
              onClick={() => { setClearInput(""); setShowClearConfirm(true); }}
              data-testid="button-clear-exercises"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear Exercise Database
            </Button>
          </div>

          <p className="text-xs text-muted-foreground mt-3">
            <strong>Bulk Import:</strong> Select many image/GIF/MP4 files. Each file's name must match
            an existing exercise's media file (e.g. <code className="font-mono bg-muted px-1 rounded">0001_push-up.gif</code>).
            Matched files are uploaded to storage and replace the exercise's media.
          </p>
        </CardContent>
      </Card>

      {/* ── Exercise List ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Dumbbell className="w-5 h-5" />
            Exercises
            {exercises.length > 0 && (
              <Badge variant="secondary" className="ml-auto font-normal">
                {exercises.length < EX_PAGE_SIZE && exPage === 0 ? exercises.length : `page ${exPage + 1}`}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search exercises by name…"
              value={exSearch}
              onChange={(e) => setExSearch(e.target.value)}
            />
          </div>

          {/* Table */}
          {exLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-ministry-gold" />
            </div>
          ) : exercises.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {exSearch ? "No exercises match your search." : "No exercises in the database. Import to get started."}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Name</th>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground hidden sm:table-cell">Equipment</th>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground hidden md:table-cell">Body Part</th>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground hidden md:table-cell">Level</th>
                    <th className="px-3 py-2 w-24"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {exercises.map((ex) => (
                    <tr key={ex.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2 font-medium max-w-[200px] truncate">{ex.name}</td>
                      <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">{ex.equipment}</td>
                      <td className="px-3 py-2 text-muted-foreground hidden md:table-cell">{ex.bodyPart}</td>
                      <td className="px-3 py-2 hidden md:table-cell">
                        <Badge className={`text-xs ${getDifficultyColor(ex.level.toLowerCase())}`}>{ex.level}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={() => openExEdit(ex)}
                            data-testid={`edit-exercise-${ex.id}`}
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => setDeleteExConfirm(ex)}
                            data-testid={`delete-exercise-${ex.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!exLoading && (exercises.length === EX_PAGE_SIZE || exPage > 0) && (
            <div className="flex items-center justify-between pt-1">
              <Button
                variant="outline"
                size="sm"
                disabled={exPage === 0}
                onClick={() => setExPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />Prev
              </Button>
              <span className="text-xs text-muted-foreground">Page {exPage + 1}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={exercises.length < EX_PAGE_SIZE}
                onClick={() => setExPage((p) => p + 1)}
              >
                Next<ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Pre-built Plans ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ministry-charcoal">Pre-built Fitness Plans</h2>
          <p className="text-ministry-slate">Create downloadable workout plans with subscriber access</p>
        </div>
        <Button onClick={handlePlanCreate} className="bg-ministry-gold hover:bg-ministry-gold/90 text-black" data-testid="button-create-plan">
          <Plus className="w-4 h-4 mr-2" />Create Plan
        </Button>
      </div>

      {isLoadingPlans ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-ministry-gold" />
        </div>
      ) : preBuiltPlans.length === 0 ? (
        <Card className="text-center py-8">
          <CardContent>
            <FileText className="w-10 h-10 mx-auto text-ministry-steel mb-3" />
            <h3 className="text-lg font-medium text-ministry-charcoal mb-2">No Pre-built Plans Yet</h3>
            <p className="text-ministry-slate mb-4">Create downloadable workout plans for your members</p>
            <Button onClick={handlePlanCreate} className="bg-ministry-gold hover:bg-ministry-gold/90 text-black">
              <Plus className="w-4 h-4 mr-2" />Create Plan
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {preBuiltPlans.map((plan: PreBuiltFitnessPlan) => (
            <Card key={plan.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="w-12 h-12 rounded-lg bg-ministry-gold/20 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-6 h-6 text-ministry-gold" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-ministry-charcoal truncate">{plan.title}</h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <Badge className={`text-xs capitalize flex items-center ${getTierColor(plan.tier)}`}>
                          {getTierIcon(plan.tier)}{plan.tier !== "free" ? "Subscribers Only" : "Free"}
                        </Badge>
                        <Badge className={`text-xs capitalize ${getDifficultyColor(plan.difficulty)}`}>{plan.difficulty}</Badge>
                        <Badge className={`text-xs capitalize ${getCategoryColor(plan.category)}`}>{plan.category}</Badge>
                        <span className="text-xs text-ministry-slate flex items-center"><Timer className="w-3 h-3 mr-1" />{plan.duration} min</span>
                        {plan.isPublished ? <Badge className="bg-green-100 text-green-800 text-xs">Published</Badge> : <Badge variant="secondary" className="text-xs">Draft</Badge>}
                        {plan.downloadUrl && <Badge className="bg-blue-100 text-blue-800 text-xs flex items-center"><Download className="w-3 h-3 mr-1" />Has Document</Badge>}
                        {plan.isPurchasable && plan.price && <Badge className="bg-[#FCD000]/20 text-[#b8960a] text-xs">${(plan.price / 100).toFixed(2)}</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <div className="relative">
                      <input type="file" accept=".pdf,.doc,.docx" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadPlanDocument(plan.id, file); e.target.value = ""; }}
                        disabled={uploadingPlanId === plan.id} data-testid={`upload-plan-${plan.id}`} />
                      <Button variant="outline" size="sm" disabled={uploadingPlanId === plan.id} className="border-ministry-charcoal text-ministry-charcoal">
                        {uploadingPlanId === plan.id ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-ministry-charcoal" /> : <><Upload className="w-4 h-4 mr-1" />Upload</>}
                      </Button>
                    </div>
                    {plan.downloadUrl && (
                      <Button variant="outline" size="sm" className="border-blue-500 text-blue-500" onClick={() => window.open(plan.downloadUrl!, "_blank")} data-testid={`download-plan-${plan.id}`}>
                        <Download className="w-4 h-4 mr-1" />View
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => handlePlanEdit(plan)} className="border-ministry-charcoal text-ministry-charcoal" data-testid={`edit-plan-${plan.id}`}><Edit className="w-4 h-4" /></Button>
                    <Button variant="outline" size="sm" onClick={() => togglePlanPublishMutation.mutate(plan.id)} className="border-ministry-gold text-ministry-gold" disabled={togglePlanPublishMutation.isPending} data-testid={`publish-plan-${plan.id}`}>
                      {plan.isPublished ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handlePlanDelete(plan)} className="border-red-500 text-red-500" disabled={deletePlanMutation.isPending} data-testid={`delete-plan-${plan.id}`}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Fitness Challenges ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ministry-charcoal">Fitness Challenge Management</h2>
          <p className="text-ministry-slate">Create and manage daily fitness challenges</p>
        </div>
        <Button onClick={handleCreate} className="bg-ministry-gold hover:bg-ministry-gold/90 text-black">
          <Plus className="w-4 h-4 mr-2" />Create Challenge
        </Button>
      </div>

      {challenges.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Dumbbell className="w-12 h-12 mx-auto text-ministry-steel mb-4" />
            <h3 className="text-lg font-medium text-ministry-charcoal mb-2">No Fitness Challenges Yet</h3>
            <p className="text-ministry-slate mb-4">Create your first fitness challenge to get started</p>
            <Button onClick={handleCreate} className="bg-ministry-gold hover:bg-ministry-gold/90 text-black"><Plus className="w-4 h-4 mr-2" />Create Challenge</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {challenges.map((challenge: FitnessChallenge) => (
            <Card key={challenge.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="flex-shrink-0">
                      <div className="w-16 h-16 rounded-lg bg-ministry-gold-exact flex items-center justify-center">
                        <Dumbbell className="w-8 h-8 text-ministry-gold" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-lg text-ministry-charcoal mb-1">{challenge.title}</h3>
                          <div className="flex items-center space-x-3 text-sm text-ministry-slate mb-2">
                            <Badge className={`text-xs capitalize ${getCategoryColor(challenge.category)}`}>{challenge.category}</Badge>
                            <Badge className={`text-xs capitalize ${getDifficultyColor(challenge.difficulty)}`}>{challenge.difficulty}</Badge>
                            <div className="flex items-center"><Timer className="w-4 h-4 mr-1" />{challenge.duration} min</div>
                            <div className="flex items-center"><Calendar className="w-4 h-4 mr-1" />{format(new Date(challenge.targetDate), "MMM d, yyyy")}</div>
                            {challenge.isPublished ? <Badge className="bg-green-100 text-green-800">Published</Badge> : <Badge variant="secondary">Draft</Badge>}
                          </div>
                        </div>
                      </div>
                      {challenge.description && <p className="text-ministry-slate text-sm mb-3 line-clamp-2">{challenge.description}</p>}
                      {challenge.equipment && (
                        <div className="flex items-center text-sm text-ministry-slate mb-3">
                          <Activity className="w-4 h-4 mr-1" /><span className="font-medium">Equipment: </span><span className="ml-1">{challenge.equipment}</span>
                        </div>
                      )}
                      <div className="flex items-center space-x-3">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(challenge)} className="border-ministry-charcoal text-ministry-charcoal hover:bg-ministry-charcoal hover:text-white">
                          <Edit className="w-4 h-4 mr-1" />Edit
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleTogglePublish(challenge)} className="border-ministry-gold text-ministry-gold" disabled={togglePublishMutation.isPending}>
                          {challenge.isPublished ? <><EyeOff className="w-4 h-4 mr-1" />Unpublish</> : <><Eye className="w-4 h-4 mr-1" />Publish</>}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(challenge)} className="border-red-500 text-red-500 hover:bg-red-50" disabled={deleteChallengeMutation.isPending}>
                          <Trash2 className="w-4 h-4 mr-1" />Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* DIALOGS                                                         */}
      {/* ═══════════════════════════════════════════════════════════════ */}

      {/* Clear Confirm Dialog */}
      <Dialog open={showClearConfirm} onOpenChange={(o) => { if (!o) { setShowClearConfirm(false); setClearInput(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Clear Exercise Database
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              This will <strong>permanently delete</strong> every exercise, every user's custom fitness plan, all plan reminders, and all saved favorites. This cannot be undone.
            </p>
            <p className="text-sm font-medium">Type <span className="font-mono bg-red-50 text-red-700 px-1 rounded">CLEAR</span> to confirm:</p>
            <Input
              value={clearInput}
              onChange={(e) => setClearInput(e.target.value)}
              placeholder="CLEAR"
              className="font-mono"
              data-testid="input-clear-confirm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowClearConfirm(false); setClearInput(""); }}>Cancel</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={clearInput !== "CLEAR" || clearAllMutation.isPending}
              onClick={() => clearAllMutation.mutate()}
              data-testid="button-confirm-clear"
            >
              {clearAllMutation.isPending ? "Clearing…" : "Clear Everything"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear All Media Confirm Dialog */}
      <Dialog open={showClearMediaConfirm} onOpenChange={(o) => { if (!o) { setShowClearMediaConfirm(false); setClearMediaInput(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="w-5 h-5" />
              Delete All Exercise Media
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              This will <strong>permanently delete every uploaded image, GIF, and video</strong> attached to any exercise from cloud storage, and clear the media reference on every exercise. The exercises themselves stay; only their media is removed. This cannot be undone.
            </p>
            <p className="text-sm font-medium">Type <span className="font-mono bg-orange-50 text-orange-700 px-1 rounded">DELETE MEDIA</span> to confirm:</p>
            <Input
              value={clearMediaInput}
              onChange={(e) => setClearMediaInput(e.target.value)}
              placeholder="DELETE MEDIA"
              className="font-mono"
              data-testid="input-clear-media-confirm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowClearMediaConfirm(false); setClearMediaInput(""); }}>Cancel</Button>
            <Button
              className="bg-orange-600 hover:bg-orange-700 text-white"
              disabled={clearMediaInput !== "DELETE MEDIA" || clearAllMediaMutation.isPending}
              onClick={() => clearAllMediaMutation.mutate()}
              data-testid="button-confirm-clear-media"
            >
              {clearAllMediaMutation.isPending ? "Deleting…" : "Delete All Media"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exercise Edit Dialog */}
      <Dialog open={showExEdit} onOpenChange={(o) => { if (!o) { setShowExEdit(false); setSelectedEx(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Exercise — {selectedEx?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label htmlFor="ex-name">Name</Label>
                <Input id="ex-name" value={exForm.name} onChange={(e) => setExForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="ex-bodypart">Body Part</Label>
                <Input id="ex-bodypart" value={exForm.bodyPart} onChange={(e) => setExForm((f) => ({ ...f, bodyPart: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="ex-equipment">Equipment</Label>
                <Input id="ex-equipment" value={exForm.equipment} onChange={(e) => setExForm((f) => ({ ...f, equipment: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="ex-level">Level</Label>
                <Select value={exForm.level} onValueChange={(v) => setExForm((f) => ({ ...f, level: v }))}>
                  <SelectTrigger id="ex-level"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Beginner">Beginner</SelectItem>
                    <SelectItem value="Intermediate">Intermediate</SelectItem>
                    <SelectItem value="Advanced">Advanced</SelectItem>
                    <SelectItem value="Expert">Expert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="ex-hiit">HIIT Exercise</Label>
                <Select value={exForm.hiit} onValueChange={(v) => setExForm((f) => ({ ...f, hiit: v }))}>
                  <SelectTrigger id="ex-hiit"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="No">No</SelectItem>
                    <SelectItem value="Yes">Yes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="ex-stretching">Stretching Exercise</Label>
                <Select value={exForm.stretching} onValueChange={(v) => setExForm((f) => ({ ...f, stretching: v }))}>
                  <SelectTrigger id="ex-stretching"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="No">No</SelectItem>
                    <SelectItem value="Yes">Yes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="ex-short">Short Instructions</Label>
                <Textarea id="ex-short" rows={2} value={exForm.shortInstructions} onChange={(e) => setExForm((f) => ({ ...f, shortInstructions: e.target.value }))} placeholder="Brief one-line description" />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="ex-instructions">Full Instructions</Label>
                <Textarea id="ex-instructions" rows={5} value={exForm.instructions} onChange={(e) => setExForm((f) => ({ ...f, instructions: e.target.value }))} />
              </div>
            </div>

            {/* Media Control */}
            <div className="border rounded-lg p-4 space-y-3">
              <Label className="block text-sm font-semibold">Media File</Label>
              {exForm.mediaFile ? (
                <div className="space-y-2">
                  {isMediaPreviewable(exForm.mediaFile) ? (
                    /\.(mp4|webm|mov)(\?|$)/i.test(exForm.mediaFile) ? (
                      <video
                        src={exForm.mediaFile}
                        className="h-40 rounded border bg-muted/20"
                        controls
                        muted
                      />
                    ) : (
                      <img
                        src={exForm.mediaFile}
                        alt="exercise media"
                        className="h-40 object-contain rounded border bg-muted/20"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    )
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 rounded p-2">
                      <ImageIcon className="w-4 h-4" />
                      <span className="truncate font-mono text-xs">{exForm.mediaFile}</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-500 border-red-300 hover:bg-red-50"
                      disabled={removeMediaMutation.isPending}
                      onClick={() => selectedEx && removeMediaMutation.mutate(selectedEx.id)}
                    >
                      <X className="w-3.5 h-3.5 mr-1" />{removeMediaMutation.isPending ? "Removing…" : "Remove"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={uploadingMedia}
                      onClick={() => mediaInputRef.current?.click()}
                    >
                      <Upload className="w-3.5 h-3.5 mr-1" />{uploadingMedia ? "Uploading…" : "Replace"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">No media file attached.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={uploadingMedia}
                    onClick={() => mediaInputRef.current?.click()}
                  >
                    <Upload className="w-3.5 h-3.5 mr-1" />{uploadingMedia ? "Uploading…" : "Upload File"}
                  </Button>
                </div>
              )}
              <input
                ref={mediaInputRef}
                type="file"
                accept="image/*,.gif"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleMediaUpload(f);
                  e.target.value = "";
                }}
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => { setShowExEdit(false); setSelectedEx(null); }}>Cancel</Button>
            <Button
              className="bg-ministry-gold hover:bg-ministry-gold/90 text-black"
              disabled={patchExerciseMutation.isPending}
              onClick={handleExSave}
              data-testid="button-save-exercise"
            >
              {patchExerciseMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Single Exercise Confirm */}
      <Dialog open={!!deleteExConfirm} onOpenChange={(o) => { if (!o) setDeleteExConfirm(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Delete Exercise
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Delete <strong>"{deleteExConfirm?.name}"</strong>? It will also be removed from any user plans and saved favorites.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteExConfirm(null)}>Cancel</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleteExerciseMutation.isPending}
              onClick={() => deleteExConfirm && deleteExerciseMutation.mutate(deleteExConfirm.id)}
              data-testid="button-confirm-delete-exercise"
            >
              {deleteExerciseMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pre-built Plan Create/Edit Dialog */}
      <Dialog open={showPlanCreateDialog || showPlanEditDialog} onOpenChange={(open) => {
        if (!open) { setShowPlanCreateDialog(false); setShowPlanEditDialog(false); setSelectedPlan(null); resetPlanForm(); }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedPlan ? "Edit Fitness Plan" : "Create New Fitness Plan"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="plan-title">Title *</Label>
              <Input id="plan-title" value={planFormData.title} onChange={(e) => setPlanFormData({ ...planFormData, title: e.target.value })} placeholder="Plan title" />
            </div>
            <div>
              <Label htmlFor="plan-description">Description</Label>
              <Textarea id="plan-description" value={planFormData.description} onChange={(e) => setPlanFormData({ ...planFormData, description: e.target.value })} placeholder="Plan description" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="plan-tier">Access Level *</Label>
                <Select value={planFormData.tier} onValueChange={(value: any) => setPlanFormData({ ...planFormData, tier: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free - Everyone</SelectItem>
                    <SelectItem value="premium">Subscribers Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="plan-duration">Duration (minutes)</Label>
                <Input id="plan-duration" type="number" min="1" value={planFormData.duration} onChange={(e) => setPlanFormData({ ...planFormData, duration: parseInt(e.target.value) || 60 })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="plan-category">Category</Label>
                <Select value={planFormData.category} onValueChange={(value: any) => setPlanFormData({ ...planFormData, category: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="strength">Strength</SelectItem>
                    <SelectItem value="cardio">Cardio</SelectItem>
                    <SelectItem value="flexibility">Flexibility</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="plan-difficulty">Difficulty</Label>
                <Select value={planFormData.difficulty} onValueChange={(value: any) => setPlanFormData({ ...planFormData, difficulty: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="plan-equipment">Equipment (optional)</Label>
              <Input id="plan-equipment" value={planFormData.equipment} onChange={(e) => setPlanFormData({ ...planFormData, equipment: e.target.value })} placeholder="Required equipment" />
            </div>
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center gap-3">
                <input type="checkbox" id="plan-purchasable" checked={planFormData.isPurchasable} onChange={(e) => setPlanFormData({ ...planFormData, isPurchasable: e.target.checked, priceInCents: e.target.checked ? planFormData.priceInCents : "" })} className="w-4 h-4 accent-[#FCD000]" />
                <Label htmlFor="plan-purchasable" className="cursor-pointer">Sell this plan individually (Stripe checkout)</Label>
              </div>
              {planFormData.isPurchasable && (
                <div>
                  <Label htmlFor="plan-price">Price (USD)</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-2.5 text-gray-500 text-sm">$</span>
                    <Input id="plan-price" type="number" min="0.50" step="0.01" value={planFormData.priceInCents} onChange={(e) => setPlanFormData({ ...planFormData, priceInCents: e.target.value })} placeholder="9.99" className="pl-7" />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Users who are fitness members will see it as included. Non-members can purchase it individually.</p>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => { setShowPlanCreateDialog(false); setShowPlanEditDialog(false); setSelectedPlan(null); resetPlanForm(); }}>Cancel</Button>
            <Button onClick={handlePlanSubmit} disabled={createPlanMutation.isPending || updatePlanMutation.isPending} className="bg-ministry-gold hover:bg-ministry-gold/90 text-black">
              {createPlanMutation.isPending || updatePlanMutation.isPending ? "Saving..." : selectedPlan ? "Update Plan" : "Create Plan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Challenge Create/Edit Dialog */}
      <Dialog open={showCreateDialog || showEditDialog} onOpenChange={(open) => {
        if (!open) { setShowCreateDialog(false); setShowEditDialog(false); setSelectedChallenge(null); resetForm(); }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedChallenge ? "Edit Fitness Challenge" : "Create New Fitness Challenge"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input id="title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="Challenge title" />
            </div>
            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Challenge description" rows={3} />
            </div>
            <div>
              <Label htmlFor="targetDate">Target Date *</Label>
              <Input id="targetDate" type="date" value={formData.targetDate} onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Category</Label>
                <Select value={formData.category} onValueChange={(value: any) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="strength">Strength</SelectItem>
                    <SelectItem value="cardio">Cardio</SelectItem>
                    <SelectItem value="flexibility">Flexibility</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="difficulty">Difficulty</Label>
                <Select value={formData.difficulty} onValueChange={(value: any) => setFormData({ ...formData, difficulty: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input id="duration" type="number" value={formData.duration} onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 30 })} />
              </div>
              <div>
                <Label htmlFor="equipment">Equipment</Label>
                <Input id="equipment" value={formData.equipment} onChange={(e) => setFormData({ ...formData, equipment: e.target.value })} placeholder="e.g., Dumbbells" />
              </div>
            </div>
            <div>
              <Label htmlFor="videoUrl">Video URL</Label>
              <Input id="videoUrl" value={formData.videoUrl} onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })} placeholder="https://..." />
            </div>
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); setShowEditDialog(false); setSelectedChallenge(null); resetForm(); }}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createChallengeMutation.isPending || updateChallengeMutation.isPending} className="bg-ministry-gold hover:bg-ministry-gold/90 text-black">
              {createChallengeMutation.isPending || updateChallengeMutation.isPending ? "Saving..." : selectedChallenge ? "Update Challenge" : "Create Challenge"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
