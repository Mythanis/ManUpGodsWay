import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
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
  Star
} from "lucide-react";
import { format } from "date-fns";

interface FitnessChallenge {
  id: string;
  title: string;
  description: string;
  targetDate: string;
  videoId?: string;
  videoUrl?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: number;
  equipment?: string;
  category: 'strength' | 'cardio' | 'flexibility' | 'general';
  isPublished: boolean;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface FitnessChallengeFormData {
  title: string;
  description: string;
  targetDate: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: number;
  equipment: string;
  category: 'strength' | 'cardio' | 'flexibility' | 'general';
  videoUrl: string;
}

interface PreBuiltFitnessPlan {
  id: string;
  title: string;
  description?: string;
  category: 'strength' | 'cardio' | 'flexibility' | 'general';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: number;
  equipment?: string;
  tier: 'free' | 'premium' | 'vip';
  thumbnailUrl?: string;
  downloadUrl?: string;
  downloadFileName?: string;
  isPublished: boolean;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface PreBuiltPlanFormData {
  title: string;
  description: string;
  category: 'strength' | 'cardio' | 'flexibility' | 'general';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: number;
  equipment: string;
  tier: 'free' | 'premium' | 'vip';
}

export default function FitnessManagement() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState<FitnessChallenge | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  
  // Pre-built plans state
  const [showPlanCreateDialog, setShowPlanCreateDialog] = useState(false);
  const [showPlanEditDialog, setShowPlanEditDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PreBuiltFitnessPlan | null>(null);
  const [planFormData, setPlanFormData] = useState<PreBuiltPlanFormData>({
    title: '',
    description: '',
    category: 'general',
    difficulty: 'beginner',
    duration: 60,
    equipment: '',
    tier: 'free'
  });
  const [uploadingPlanId, setUploadingPlanId] = useState<string | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Import exercises from JSON file
  const importExercises = async () => {
    try {
      setIsImporting(true);
      const response = await fetch('/api/exercises/import-from-file', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to import exercises');
      }

      const data = await response.json();
      toast({
        title: "Success",
        description: data.message || `${data.count} exercises imported successfully`,
      });
      
      // Invalidate exercises queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['api', 'exercises'] });
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

  const [formData, setFormData] = useState<FitnessChallengeFormData>({
    title: '',
    description: '',
    targetDate: '',
    difficulty: 'beginner',
    duration: 30,
    equipment: '',
    category: 'general',
    videoUrl: ''
  });

  // Fetch all fitness challenges (admin view - includes unpublished)
  const { data: challenges = [], isLoading } = useQuery({
    queryKey: ['api', 'admin', 'fitness-challenges'],
    queryFn: async () => {
      const response = await fetch('/api/admin/fitness-challenges', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch fitness challenges');
      return response.json();
    },
  });

  // Create fitness challenge mutation
  const createChallengeMutation = useMutation({
    mutationFn: async (data: FitnessChallengeFormData) => {
      const response = await fetch('/api/fitness-challenges', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create fitness challenge');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api', 'admin', 'fitness-challenges'] });
      queryClient.invalidateQueries({ queryKey: ['api', 'fitness-challenges'] });
      setShowCreateDialog(false);
      resetForm();
      toast({
        title: "Success",
        description: "Fitness challenge created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create fitness challenge",
        variant: "destructive",
      });
    },
  });

  // Update fitness challenge mutation
  const updateChallengeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FitnessChallengeFormData }) => {
      const response = await fetch(`/api/fitness-challenges/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update fitness challenge');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api', 'admin', 'fitness-challenges'] });
      queryClient.invalidateQueries({ queryKey: ['api', 'fitness-challenges'] });
      setShowEditDialog(false);
      setSelectedChallenge(null);
      resetForm();
      toast({
        title: "Success",
        description: "Fitness challenge updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update fitness challenge",
        variant: "destructive",
      });
    },
  });

  // Delete fitness challenge mutation
  const deleteChallengeMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/fitness-challenges/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete fitness challenge');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api', 'admin', 'fitness-challenges'] });
      queryClient.invalidateQueries({ queryKey: ['api', 'fitness-challenges'] });
      toast({
        title: "Success",
        description: "Fitness challenge deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete fitness challenge",
        variant: "destructive",
      });
    },
  });

  // Publish/unpublish fitness challenge mutation
  const togglePublishMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/fitness-challenges/${id}/publish`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update publication status');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api', 'admin', 'fitness-challenges'] });
      queryClient.invalidateQueries({ queryKey: ['api', 'fitness-challenges'] });
      toast({
        title: "Success",
        description: "Fitness challenge publication status updated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update publication status",
        variant: "destructive",
      });
    },
  });

  // ============================================
  // PRE-BUILT FITNESS PLANS QUERIES & MUTATIONS
  // ============================================

  // Fetch all pre-built fitness plans (admin view)
  const { data: preBuiltPlans = [], isLoading: isLoadingPlans } = useQuery({
    queryKey: ['api', 'admin', 'pre-built-fitness-plans'],
    queryFn: async () => {
      const response = await fetch('/api/admin/pre-built-fitness-plans', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch pre-built fitness plans');
      return response.json();
    },
  });

  // Create pre-built plan mutation
  const createPlanMutation = useMutation({
    mutationFn: async (data: PreBuiltPlanFormData) => {
      const response = await fetch('/api/pre-built-fitness-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create plan');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api', 'admin', 'pre-built-fitness-plans'] });
      setShowPlanCreateDialog(false);
      resetPlanForm();
      toast({ title: "Success", description: "Fitness plan created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Update pre-built plan mutation
  const updatePlanMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: PreBuiltPlanFormData }) => {
      const response = await fetch(`/api/pre-built-fitness-plans/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update plan');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api', 'admin', 'pre-built-fitness-plans'] });
      setShowPlanEditDialog(false);
      setSelectedPlan(null);
      resetPlanForm();
      toast({ title: "Success", description: "Fitness plan updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Delete pre-built plan mutation
  const deletePlanMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/pre-built-fitness-plans/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete plan');
      return;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api', 'admin', 'pre-built-fitness-plans'] });
      toast({ title: "Success", description: "Fitness plan deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Toggle publish status for pre-built plan
  const togglePlanPublishMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/pre-built-fitness-plans/${id}/publish`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to update publication status');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api', 'admin', 'pre-built-fitness-plans'] });
      toast({ title: "Success", description: "Publication status updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Upload document for pre-built plan
  const uploadPlanDocument = async (planId: string, file: File) => {
    try {
      setUploadingPlanId(planId);
      const formData = new FormData();
      formData.append('document', file);
      
      const response = await fetch(`/api/pre-built-fitness-plans/${planId}/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      
      if (!response.ok) throw new Error('Failed to upload document');
      
      queryClient.invalidateQueries({ queryKey: ['api', 'admin', 'pre-built-fitness-plans'] });
      toast({ title: "Success", description: "Document uploaded successfully" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to upload document", variant: "destructive" });
    } finally {
      setUploadingPlanId(null);
    }
  };

  const resetPlanForm = () => {
    setPlanFormData({
      title: '',
      description: '',
      category: 'general',
      difficulty: 'beginner',
      duration: 60,
      equipment: '',
      tier: 'free'
    });
  };

  const handlePlanCreate = () => {
    setShowPlanCreateDialog(true);
    resetPlanForm();
  };

  const handlePlanEdit = (plan: PreBuiltFitnessPlan) => {
    setSelectedPlan(plan);
    setPlanFormData({
      title: plan.title,
      description: plan.description || '',
      category: plan.category,
      difficulty: plan.difficulty,
      duration: plan.duration,
      equipment: plan.equipment || '',
      tier: plan.tier
    });
    setShowPlanEditDialog(true);
  };

  const handlePlanSubmit = () => {
    if (!planFormData.title) {
      toast({ title: "Error", description: "Title is required", variant: "destructive" });
      return;
    }
    if (selectedPlan) {
      updatePlanMutation.mutate({ id: selectedPlan.id, data: planFormData });
    } else {
      createPlanMutation.mutate(planFormData);
    }
  };

  const handlePlanDelete = (plan: PreBuiltFitnessPlan) => {
    if (confirm(`Are you sure you want to delete "${plan.title}"?`)) {
      deletePlanMutation.mutate(plan.id);
    }
  };

  const getTierColor = (tier: string) => {
    if (tier !== 'free') {
      return 'bg-ministry-gold-exact/20 text-ministry-gold';
    }
    return 'bg-gray-100 text-gray-800';
  };

  const getTierIcon = (tier: string) => {
    if (tier !== 'free') return <Crown className="w-3 h-3 mr-1" />;
    return null;
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      targetDate: '',
      difficulty: 'beginner',
      duration: 30,
      equipment: '',
      category: 'general',
      videoUrl: ''
    });
  };

  const handleCreate = () => {
    setShowCreateDialog(true);
    resetForm();
  };

  const handleEdit = (challenge: FitnessChallenge) => {
    setSelectedChallenge(challenge);
    setFormData({
      title: challenge.title,
      description: challenge.description,
      targetDate: format(new Date(challenge.targetDate), 'yyyy-MM-dd'),
      difficulty: challenge.difficulty,
      duration: challenge.duration,
      equipment: challenge.equipment || '',
      category: challenge.category,
      videoUrl: challenge.videoUrl || ''
    });
    setShowEditDialog(true);
  };

  const handleSubmit = () => {
    if (!formData.title || !formData.description || !formData.targetDate) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (selectedChallenge) {
      updateChallengeMutation.mutate({ id: selectedChallenge.id, data: formData });
    } else {
      createChallengeMutation.mutate(formData);
    }
  };

  const handleDelete = (challenge: FitnessChallenge) => {
    if (confirm(`Are you sure you want to delete "${challenge.title}"?`)) {
      deleteChallengeMutation.mutate(challenge.id);
    }
  };

  const handleTogglePublish = (challenge: FitnessChallenge) => {
    togglePublishMutation.mutate(challenge.id);
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      strength: 'bg-red-100 text-red-800',
      cardio: 'bg-blue-100 text-blue-800',
      flexibility: 'bg-green-100 text-green-800',
      general: 'bg-purple-100 text-purple-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const getDifficultyColor = (difficulty: string) => {
    const colors: Record<string, string> = {
      beginner: 'bg-green-100 text-green-800',
      intermediate: 'bg-yellow-100 text-yellow-800',
      advanced: 'bg-red-100 text-red-800',
    };
    return colors[difficulty] || 'bg-gray-100 text-gray-800';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ministry-gold"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Exercise Database Import */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Exercise Database
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-ministry-slate mb-4">
            Import the exercise database from the JSON file. This will replace all existing exercises with the data from the file.
          </p>
          <Button
            onClick={importExercises}
            disabled={isImporting}
            className="bg-ministry-charcoal hover:bg-ministry-charcoal/90 text-white"
            data-testid="button-import-exercises"
          >
            {isImporting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Importing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Import Exercises from File
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* ============================================ */}
      {/* PRE-BUILT FITNESS PLANS SECTION */}
      {/* ============================================ */}
      
      {/* Pre-built Plans Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ministry-charcoal">Pre-built Fitness Plans</h2>
          <p className="text-ministry-slate">Create downloadable workout plans with subscriber access</p>
        </div>
        <Button 
          onClick={handlePlanCreate}
          className="bg-ministry-gold hover:bg-ministry-gold/90 text-black"
          data-testid="button-create-plan"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Plan
        </Button>
      </div>

      {/* Pre-built Plans List */}
      {isLoadingPlans ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-ministry-gold"></div>
        </div>
      ) : preBuiltPlans.length === 0 ? (
        <Card className="text-center py-8">
          <CardContent>
            <FileText className="w-10 h-10 mx-auto text-ministry-steel mb-3" />
            <h3 className="text-lg font-medium text-ministry-charcoal mb-2">No Pre-built Plans Yet</h3>
            <p className="text-ministry-slate mb-4">Create downloadable workout plans for your members</p>
            <Button onClick={handlePlanCreate} className="bg-ministry-gold hover:bg-ministry-gold/90 text-black">
              <Plus className="w-4 h-4 mr-2" />
              Create Plan
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
                          {getTierIcon(plan.tier)}
                          {plan.tier !== 'free' ? 'Subscribers Only' : 'Free'}
                        </Badge>
                        <Badge className={`text-xs capitalize ${getDifficultyColor(plan.difficulty)}`}>
                          {plan.difficulty}
                        </Badge>
                        <Badge className={`text-xs capitalize ${getCategoryColor(plan.category)}`}>
                          {plan.category}
                        </Badge>
                        <span className="text-xs text-ministry-slate flex items-center">
                          <Timer className="w-3 h-3 mr-1" />
                          {plan.duration} min
                        </span>
                        {plan.isPublished ? (
                          <Badge className="bg-green-100 text-green-800 text-xs">Published</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Draft</Badge>
                        )}
                        {plan.downloadUrl && (
                          <Badge className="bg-blue-100 text-blue-800 text-xs flex items-center">
                            <Download className="w-3 h-3 mr-1" />
                            Has Document
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    {/* Upload Document Button */}
                    <div className="relative">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadPlanDocument(plan.id, file);
                          e.target.value = '';
                        }}
                        disabled={uploadingPlanId === plan.id}
                        data-testid={`upload-plan-${plan.id}`}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={uploadingPlanId === plan.id}
                        className="border-ministry-charcoal text-ministry-charcoal"
                      >
                        {uploadingPlanId === plan.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-ministry-charcoal" />
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-1" />
                            Upload
                          </>
                        )}
                      </Button>
                    </div>
                    
                    {/* Download Link */}
                    {plan.downloadUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-blue-500 text-blue-500"
                        onClick={() => window.open(plan.downloadUrl!, '_blank')}
                        data-testid={`download-plan-${plan.id}`}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        View
                      </Button>
                    )}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePlanEdit(plan)}
                      className="border-ministry-charcoal text-ministry-charcoal"
                      data-testid={`edit-plan-${plan.id}`}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => togglePlanPublishMutation.mutate(plan.id)}
                      className="border-ministry-gold text-ministry-gold"
                      disabled={togglePlanPublishMutation.isPending}
                      data-testid={`publish-plan-${plan.id}`}
                    >
                      {plan.isPublished ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePlanDelete(plan)}
                      className="border-red-500 text-red-500"
                      disabled={deletePlanMutation.isPending}
                      data-testid={`delete-plan-${plan.id}`}
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

      {/* Pre-built Plan Create/Edit Dialog */}
      <Dialog open={showPlanCreateDialog || showPlanEditDialog} onOpenChange={(open) => {
        if (!open) {
          setShowPlanCreateDialog(false);
          setShowPlanEditDialog(false);
          setSelectedPlan(null);
          resetPlanForm();
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedPlan ? 'Edit Fitness Plan' : 'Create New Fitness Plan'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="plan-title">Title *</Label>
              <Input
                id="plan-title"
                value={planFormData.title}
                onChange={(e) => setPlanFormData({ ...planFormData, title: e.target.value })}
                placeholder="Plan title"
              />
            </div>

            <div>
              <Label htmlFor="plan-description">Description</Label>
              <Textarea
                id="plan-description"
                value={planFormData.description}
                onChange={(e) => setPlanFormData({ ...planFormData, description: e.target.value })}
                placeholder="Plan description"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="plan-tier">Access Level *</Label>
                <Select value={planFormData.tier} onValueChange={(value: any) => setPlanFormData({ ...planFormData, tier: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free - Everyone</SelectItem>
                    <SelectItem value="premium">Subscribers Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="plan-duration">Duration (minutes)</Label>
                <Input
                  id="plan-duration"
                  type="number"
                  min="1"
                  value={planFormData.duration}
                  onChange={(e) => setPlanFormData({ ...planFormData, duration: parseInt(e.target.value) || 60 })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="plan-category">Category</Label>
                <Select value={planFormData.category} onValueChange={(value: any) => setPlanFormData({ ...planFormData, category: value })}>
                  <SelectTrigger>
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
                <Label htmlFor="plan-difficulty">Difficulty</Label>
                <Select value={planFormData.difficulty} onValueChange={(value: any) => setPlanFormData({ ...planFormData, difficulty: value })}>
                  <SelectTrigger>
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

            <div>
              <Label htmlFor="plan-equipment">Equipment (optional)</Label>
              <Input
                id="plan-equipment"
                value={planFormData.equipment}
                onChange={(e) => setPlanFormData({ ...planFormData, equipment: e.target.value })}
                placeholder="Required equipment"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowPlanCreateDialog(false);
                setShowPlanEditDialog(false);
                setSelectedPlan(null);
                resetPlanForm();
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handlePlanSubmit}
              disabled={createPlanMutation.isPending || updatePlanMutation.isPending}
              className="bg-ministry-gold hover:bg-ministry-gold/90 text-black"
            >
              {createPlanMutation.isPending || updatePlanMutation.isPending 
                ? 'Saving...' 
                : selectedPlan ? 'Update Plan' : 'Create Plan'
              }
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============================================ */}
      {/* FITNESS CHALLENGES SECTION */}
      {/* ============================================ */}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ministry-charcoal">Fitness Challenge Management</h2>
          <p className="text-ministry-slate">Create and manage daily fitness challenges</p>
        </div>
        <Button 
          onClick={handleCreate}
          className="bg-ministry-gold hover:bg-ministry-gold/90 text-black"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Challenge
        </Button>
      </div>

      {/* Challenges List */}
      {challenges.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Dumbbell className="w-12 h-12 mx-auto text-ministry-steel mb-4" />
            <h3 className="text-lg font-medium text-ministry-charcoal mb-2">No Fitness Challenges Yet</h3>
            <p className="text-ministry-slate mb-4">Create your first fitness challenge to get started</p>
            <Button 
              onClick={handleCreate}
              className="bg-ministry-gold hover:bg-ministry-gold/90 text-black"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Challenge
            </Button>
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
                          <h3 className="font-semibold text-lg text-ministry-charcoal mb-1">
                            {challenge.title}
                          </h3>
                          <div className="flex items-center space-x-3 text-sm text-ministry-slate mb-2">
                            <Badge className={`text-xs capitalize ${getCategoryColor(challenge.category)}`}>
                              {challenge.category}
                            </Badge>
                            <Badge className={`text-xs capitalize ${getDifficultyColor(challenge.difficulty)}`}>
                              {challenge.difficulty}
                            </Badge>
                            <div className="flex items-center">
                              <Timer className="w-4 h-4 mr-1" />
                              {challenge.duration} min
                            </div>
                            <div className="flex items-center">
                              <Calendar className="w-4 h-4 mr-1" />
                              {format(new Date(challenge.targetDate), 'MMM d, yyyy')}
                            </div>
                            {challenge.isPublished ? (
                              <Badge className="bg-green-100 text-green-800">Published</Badge>
                            ) : (
                              <Badge variant="secondary">Draft</Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {challenge.description && (
                        <p className="text-ministry-slate text-sm mb-3 line-clamp-2">
                          {challenge.description}
                        </p>
                      )}

                      {challenge.equipment && (
                        <div className="flex items-center text-sm text-ministry-slate mb-3">
                          <Activity className="w-4 h-4 mr-1" />
                          <span className="font-medium">Equipment: </span>
                          <span className="ml-1">{challenge.equipment}</span>
                        </div>
                      )}

                      <div className="flex items-center space-x-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(challenge)}
                          className="border-ministry-charcoal text-ministry-charcoal hover:bg-ministry-charcoal hover:text-white"
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTogglePublish(challenge)}
                          className={`border-ministry-gold text-ministry-gold hover:bg-ministry-gold hover:text-black ${
                            togglePublishMutation.isPending ? 'opacity-50' : ''
                          }`}
                          disabled={togglePublishMutation.isPending}
                        >
                          {challenge.isPublished ? (
                            <>
                              <EyeOff className="w-4 h-4 mr-1" />
                              Unpublish
                            </>
                          ) : (
                            <>
                              <Eye className="w-4 h-4 mr-1" />
                              Publish
                            </>
                          )}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(challenge)}
                          className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                          disabled={deleteChallengeMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
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

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog || showEditDialog} onOpenChange={(open) => {
        if (!open) {
          setShowCreateDialog(false);
          setShowEditDialog(false);
          setSelectedChallenge(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedChallenge ? 'Edit Fitness Challenge' : 'Create New Fitness Challenge'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Challenge title"
                />
              </div>

              <div>
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Challenge description and instructions"
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="targetDate">Target Date *</Label>
                  <Input
                    id="targetDate"
                    type="date"
                    value={formData.targetDate}
                    onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="1"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 30 })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select value={formData.category} onValueChange={(value: any) => setFormData({ ...formData, category: value })}>
                    <SelectTrigger>
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
                  <Label htmlFor="difficulty">Difficulty</Label>
                  <Select value={formData.difficulty} onValueChange={(value: any) => setFormData({ ...formData, difficulty: value })}>
                    <SelectTrigger>
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

              <div>
                <Label htmlFor="equipment">Equipment (optional)</Label>
                <Input
                  id="equipment"
                  value={formData.equipment}
                  onChange={(e) => setFormData({ ...formData, equipment: e.target.value })}
                  placeholder="Required equipment (e.g., dumbbells, resistance bands)"
                />
              </div>

              <div>
                <Label htmlFor="videoUrl">Video URL (optional)</Label>
                <Input
                  id="videoUrl"
                  value={formData.videoUrl}
                  onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                  placeholder="YouTube or video URL for the challenge"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                setShowEditDialog(false);
                setSelectedChallenge(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createChallengeMutation.isPending || updateChallengeMutation.isPending}
              className="bg-ministry-gold hover:bg-ministry-gold/90 text-black"
            >
              {createChallengeMutation.isPending || updateChallengeMutation.isPending 
                ? 'Saving...' 
                : selectedChallenge ? 'Update Challenge' : 'Create Challenge'
              }
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}