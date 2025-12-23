import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Edit, Trash2, Layers, BookOpen, GripVertical, X, Check } from "lucide-react";

interface StudySeries {
  id: string;
  title: string;
  description: string;
  category: string;
  thumbnailUrl: string | null;
  displayOrder: number;
  createdAt: string;
  studyCount?: number;
  totalLessons?: number;
}

interface Study {
  id: string;
  title: string;
  description: string;
  category: string;
  requiredTier: string;
  seriesId: string | null;
  seriesOrder: number | null;
}

const categories = [
  { id: 'leadership', label: 'Leadership' },
  { id: 'marriage', label: 'Marriage' },
  { id: 'fatherhood', label: 'Fatherhood' },
  { id: 'character', label: 'Character' },
  { id: 'faith', label: 'Faith' },
  { id: 'holy-spirit', label: 'Holy Spirit' },
];

export default function SeriesManagement() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [editingSeries, setEditingSeries] = useState<StudySeries | null>(null);
  const [assigningSeries, setAssigningSeries] = useState<StudySeries | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    thumbnailUrl: "",
    displayOrder: 0,
  });

  const { data: seriesList = [], isLoading } = useQuery<StudySeries[]>({
    queryKey: ["/api/study-series"],
    queryFn: async () => {
      const res = await fetch("/api/study-series");
      if (!res.ok) throw new Error("Failed to fetch series");
      return res.json();
    },
  });

  const { data: allStudies = [] } = useQuery<Study[]>({
    queryKey: ["/api/studies"],
    queryFn: async () => {
      const res = await fetch("/api/studies");
      if (!res.ok) throw new Error("Failed to fetch studies");
      return res.json();
    },
  });

  const { data: seriesStudies = [] } = useQuery<Study[]>({
    queryKey: ["/api/study-series", assigningSeries?.id, "studies"],
    queryFn: async () => {
      if (!assigningSeries) return [];
      const res = await fetch(`/api/study-series/${assigningSeries.id}/studies`);
      if (!res.ok) throw new Error("Failed to fetch series studies");
      return res.json();
    },
    enabled: !!assigningSeries,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await apiRequest("POST", "/api/admin/study-series", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/study-series"] });
      setShowCreateDialog(false);
      resetForm();
      toast({ title: "Success", description: "Series created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create series", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; updates: typeof formData }) => {
      return await apiRequest("PUT", `/api/admin/study-series/${data.id}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/study-series"] });
      setShowEditDialog(false);
      setEditingSeries(null);
      resetForm();
      toast({ title: "Success", description: "Series updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update series", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/admin/study-series/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/study-series"] });
      queryClient.invalidateQueries({ queryKey: ["/api/studies"] });
      toast({ title: "Success", description: "Series deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete series", variant: "destructive" });
    },
  });

  const assignStudyMutation = useMutation({
    mutationFn: async (data: { studyId: string; seriesId: string | null; seriesOrder?: number }) => {
      return await apiRequest("PUT", `/api/admin/studies/${data.studyId}/series`, {
        seriesId: data.seriesId,
        seriesOrder: data.seriesOrder,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/study-series"] });
      queryClient.invalidateQueries({ queryKey: ["/api/studies"] });
      toast({ title: "Success", description: "Study assignment updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update study assignment", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      category: "",
      thumbnailUrl: "",
      displayOrder: 0,
    });
  };

  const handleCreate = () => {
    createMutation.mutate(formData);
  };

  const handleEdit = (series: StudySeries) => {
    setEditingSeries(series);
    setFormData({
      title: series.title,
      description: series.description || "",
      category: series.category || "",
      thumbnailUrl: series.thumbnailUrl || "",
      displayOrder: series.displayOrder || 0,
    });
    setShowEditDialog(true);
  };

  const handleUpdate = () => {
    if (!editingSeries) return;
    updateMutation.mutate({ id: editingSeries.id, updates: formData });
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this series? Studies in this series will become individual studies.")) {
      deleteMutation.mutate(id);
    }
  };

  const handleManageStudies = (series: StudySeries) => {
    setAssigningSeries(series);
    setShowAssignDialog(true);
  };

  const handleAddStudyToSeries = (studyId: string) => {
    if (!assigningSeries) return;
    const nextOrder = seriesStudies.length + 1;
    assignStudyMutation.mutate({ 
      studyId, 
      seriesId: assigningSeries.id, 
      seriesOrder: nextOrder 
    });
  };

  const handleRemoveStudyFromSeries = (studyId: string) => {
    assignStudyMutation.mutate({ studyId, seriesId: null });
  };

  const availableStudies = allStudies.filter(
    (s) => !s.seriesId || s.seriesId === assigningSeries?.id
  );
  const unassignedStudies = allStudies.filter((s) => !s.seriesId);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-gray-600">Create and manage study series to group related Bible studies together.</p>
        <Button
          onClick={() => {
            resetForm();
            setShowCreateDialog(true);
          }}
          className="bg-ministry-gold-exact text-black hover:bg-yellow-500"
          data-testid="button-create-series"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Series
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ministry-gold-exact mx-auto"></div>
        </div>
      ) : seriesList.length === 0 ? (
        <Card className="bg-gray-50 border-dashed">
          <CardContent className="py-8 text-center">
            <Layers className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No series created yet. Create your first series to group related studies.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {seriesList.map((series) => (
            <Card key={series.id} className="bg-white" data-testid={`series-item-${series.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="flex-shrink-0 w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                      {series.thumbnailUrl ? (
                        <img
                          src={series.thumbnailUrl}
                          alt={series.title}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <Layers className="w-8 h-8 text-ministry-gold-exact" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg text-gray-900">{series.title}</h3>
                      <p className="text-gray-600 text-sm line-clamp-2 mb-2">{series.description}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="bg-gray-100 px-2 py-1 rounded">{series.category || "No category"}</span>
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-3.5 h-3.5" />
                          {series.studyCount || 0} Studies
                        </span>
                        <span>{series.totalLessons || 0} Lessons</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleManageStudies(series)}
                      data-testid={`button-manage-studies-${series.id}`}
                    >
                      <BookOpen className="w-4 h-4 mr-1" />
                      Manage Studies
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(series)}
                      data-testid={`button-edit-series-${series.id}`}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(series.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      data-testid={`button-delete-series-${series.id}`}
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

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Series</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Holy Spirit Series"
                data-testid="input-series-title"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of this series..."
                rows={3}
                data-testid="input-series-description"
              />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={formData.category} onValueChange={(val) => setFormData({ ...formData, category: val })}>
                <SelectTrigger data-testid="select-series-category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="thumbnailUrl">Thumbnail URL (optional)</Label>
              <Input
                id="thumbnailUrl"
                value={formData.thumbnailUrl}
                onChange={(e) => setFormData({ ...formData, thumbnailUrl: e.target.value })}
                placeholder="https://..."
                data-testid="input-series-thumbnail"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={!formData.title || createMutation.isPending}
              className="bg-ministry-gold-exact text-black hover:bg-yellow-500"
              data-testid="button-save-series"
            >
              {createMutation.isPending ? "Creating..." : "Create Series"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Series</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                data-testid="input-edit-series-title"
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                data-testid="input-edit-series-description"
              />
            </div>
            <div>
              <Label htmlFor="edit-category">Category</Label>
              <Select value={formData.category} onValueChange={(val) => setFormData({ ...formData, category: val })}>
                <SelectTrigger data-testid="select-edit-series-category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-thumbnailUrl">Thumbnail URL (optional)</Label>
              <Input
                id="edit-thumbnailUrl"
                value={formData.thumbnailUrl}
                onChange={(e) => setFormData({ ...formData, thumbnailUrl: e.target.value })}
                data-testid="input-edit-series-thumbnail"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button
              onClick={handleUpdate}
              disabled={!formData.title || updateMutation.isPending}
              className="bg-ministry-gold-exact text-black hover:bg-yellow-500"
              data-testid="button-update-series"
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Manage Studies in "{assigningSeries?.title}"</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-6">
            <div>
              <h4 className="font-medium mb-3 text-gray-700">Studies in this Series</h4>
              {seriesStudies.length === 0 ? (
                <p className="text-gray-500 text-sm py-4 text-center bg-gray-50 rounded-lg">
                  No studies assigned to this series yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {seriesStudies.map((study, index) => (
                    <div
                      key={study.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      data-testid={`assigned-study-${study.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 bg-ministry-gold-exact text-black rounded-full flex items-center justify-center text-sm font-bold">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-medium text-gray-900">{study.title}</p>
                          <p className="text-xs text-gray-500">{study.category} • {study.requiredTier}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveStudyFromSeries(study.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        data-testid={`button-remove-study-${study.id}`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h4 className="font-medium mb-3 text-gray-700">Available Studies (Not in any series)</h4>
              {unassignedStudies.length === 0 ? (
                <p className="text-gray-500 text-sm py-4 text-center bg-gray-50 rounded-lg">
                  All studies are already assigned to series.
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {unassignedStudies.map((study) => (
                    <div
                      key={study.id}
                      className="flex items-center justify-between p-3 bg-white border rounded-lg hover:border-ministry-gold-exact transition-colors"
                      data-testid={`available-study-${study.id}`}
                    >
                      <div>
                        <p className="font-medium text-gray-900">{study.title}</p>
                        <p className="text-xs text-gray-500">{study.category} • {study.requiredTier}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddStudyToSeries(study.id)}
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        data-testid={`button-add-study-${study.id}`}
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Add
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowAssignDialog(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
