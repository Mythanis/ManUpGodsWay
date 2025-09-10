import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { apiRequest } from "@/lib/queryClient";
import { Edit, Trash2, Plus, Book, Users, Crown, Gem } from "lucide-react";

interface Study {
  id: string;
  title: string;
  description: string;
  category: string;
  requiredTier: string;
  videoUrl?: string;
  duration: number;
  lessonCount?: number;
  freeLessonCount?: number;
  lessons: any[];
  tags: string[];
  author: string;
  isActive: boolean;
  requiresPurchase?: boolean;
  price?: string;
  purchaseRequiredTiers?: string[];
  createdAt: string;
  updatedAt: string;
}

interface FormData {
  title: string;
  description: string;
  category: string;
  requiredTier: string;
  videoUrl: string;
  duration: number;
  lessonCount: number;
  freeLessonCount: number;
  author: string;
  tags: string;
  lessons: string;
  requiresPurchase: boolean;
  price: string;
  purchaseRequiredTiers: string[];
}

export default function StudyManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingStudy, setEditingStudy] = useState<Study | null>(null);
  const [formData, setFormData] = useState<FormData>({
    title: "",
    description: "",
    category: "",
    requiredTier: "free",
    videoUrl: "",
    duration: 0,
    lessonCount: 1,
    freeLessonCount: 0,
    author: "",
    tags: "",
    lessons: "",
    requiresPurchase: false,
    price: "",
    purchaseRequiredTiers: [],
  });

  // Fetch all studies
  const { data: studies = [], isLoading, refetch } = useQuery<Study[]>({
    queryKey: ["/api/studies"],
    retry: false,
  });


  // Update study mutation
  const updateStudyMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<Study> }) => {
      return await apiRequest("PATCH", `/api/studies/${data.id}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/studies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setShowEditDialog(false);
      setEditingStudy(null);
      toast({
        title: "Success",
        description: "Study updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update study",
        variant: "destructive",
      });
    },
  });

  // Delete study mutation
  const deleteStudyMutation = useMutation({
    mutationFn: async (studyId: string) => {
      return await apiRequest("DELETE", `/api/studies/${studyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/studies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({
        title: "Success",
        description: "Study deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete study",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (study: Study) => {
    setEditingStudy(study);
    setFormData({
      title: study.title,
      description: study.description,
      category: study.category,
      requiredTier: study.requiredTier,
      videoUrl: study.videoUrl || "",
      duration: study.duration,
      lessonCount: study.lessonCount || 1,
      freeLessonCount: study.freeLessonCount || 0,
      author: study.author,
      tags: study.tags.join(", "),
      lessons: JSON.stringify(study.lessons, null, 2),
      requiresPurchase: study.requiresPurchase || false,
      price: study.price || "",
      purchaseRequiredTiers: study.purchaseRequiredTiers || [],
    });
    setShowEditDialog(true);
  };

  const handleUpdate = () => {
    if (!editingStudy) return;

    const updates = {
      title: formData.title,
      description: formData.description,
      category: formData.category,
      requiredTier: formData.requiredTier,
      videoUrl: formData.videoUrl || undefined,
      duration: formData.duration,
      lessonCount: formData.lessonCount,
      freeLessonCount: formData.freeLessonCount,
      author: formData.author,
      tags: formData.tags.split(",").map(tag => tag.trim()).filter(Boolean),
      lessons: formData.lessons ? JSON.parse(formData.lessons) : [],
      requiresPurchase: formData.requiresPurchase,
      price: formData.requiresPurchase && formData.price ? formData.price : undefined,
      purchaseRequiredTiers: formData.requiresPurchase ? formData.purchaseRequiredTiers : [],
    };

    updateStudyMutation.mutate({ id: editingStudy.id, updates });
  };

  const handleDelete = (studyId: string) => {
    if (confirm("Are you sure you want to delete this study? This action cannot be undone.")) {
      deleteStudyMutation.mutate(studyId);
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case "premium":
        return <Crown className="w-4 h-4 text-yellow-600" />;
      case "vip":
        return <Gem className="w-4 h-4 text-purple-600" />;
      default:
        return <Users className="w-4 h-4 text-black" />;
    }
  };

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case "premium":
        return "bg-yellow-100 text-yellow-800";
      case "vip":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-white text-black border border-gray-300";
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ministry-navy"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Studies List */}
      {studies.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Book className="w-12 h-12 text-ministry-slate mx-auto mb-4" />
            <p className="text-muted-foreground">No studies created yet</p>
            <p className="text-sm text-muted-foreground">Use the Content tab to add your first study</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {studies.map((study) => (
            <Card key={study.id} className="border-gray-200">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg text-foreground mb-2">
                      {study.title}
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <Badge variant="secondary" className="text-xs">
                        {study.category}
                      </Badge>
                      <Badge className={`text-xs ${getTierBadgeColor(study.requiredTier)}`}>
                        <span className="flex items-center gap-1">
                          {getTierIcon(study.requiredTier)}
                          {study.requiredTier.toUpperCase()}
                        </span>
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {study.duration} min
                      </span>
                      {study.requiresPurchase && study.price && (
                        <Badge className="text-xs bg-ministry-gold text-black">
                          ${parseFloat(String(study.price)).toFixed(2)}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {study.description}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(study)}
                      data-testid={`button-edit-study-${study.id}`}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(study.id)}
                      disabled={deleteStudyMutation.isPending}
                      data-testid={`button-delete-study-${study.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>By {study.author}</span>
                  <span>•</span>
                  <span>{study.lessons.length} lessons</span>
                  <span>•</span>
                  <span>Created {new Date(study.createdAt).toLocaleDateString()}</span>
                  {study.tags.length > 0 && (
                    <>
                      <span>•</span>
                      <span>Tags: {study.tags.join(", ")}</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Study Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Study</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Study title"
                  data-testid="input-edit-title"
                />
              </div>
              <div>
                <Label htmlFor="edit-author">Author</Label>
                <Input
                  id="edit-author"
                  value={formData.author}
                  onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                  placeholder="Author name"
                  data-testid="input-edit-author"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Study description"
                rows={3}
                data-testid="input-edit-description"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="edit-category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger data-testid="select-edit-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leadership">Leadership</SelectItem>
                    <SelectItem value="marriage">Marriage</SelectItem>
                    <SelectItem value="fatherhood">Fatherhood</SelectItem>
                    <SelectItem value="character">Character</SelectItem>
                    <SelectItem value="faith">Faith</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-tier">Required Tier</Label>
                <Select
                  value={formData.requiredTier}
                  onValueChange={(value) => setFormData({ ...formData, requiredTier: value })}
                >
                  <SelectTrigger data-testid="select-edit-tier">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="vip">VIP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-duration">Duration (minutes)</Label>
                <Input
                  id="edit-duration"
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 0 })}
                  placeholder="Duration"
                  data-testid="input-edit-duration"
                />
              </div>
            </div>

            {/* Lesson Count Section */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-lesson-count">Total Lessons</Label>
                <Input
                  id="edit-lesson-count"
                  type="number"
                  min="1"
                  value={formData.lessonCount}
                  onChange={(e) => {
                    const newCount = parseInt(e.target.value) || 1;
                    setFormData({ 
                      ...formData, 
                      lessonCount: newCount,
                      // Reset free lessons if it exceeds new total
                      freeLessonCount: Math.min(formData.freeLessonCount, newCount)
                    });
                  }}
                  placeholder="Total number of lessons"
                  data-testid="input-edit-lesson-count"
                />
              </div>
              {(formData.requiredTier === 'premium' || formData.requiredTier === 'vip') && (
                <div>
                  <Label htmlFor="edit-free-lesson-count">Free Preview Lessons</Label>
                  <Input
                    id="edit-free-lesson-count"
                    type="number"
                    min="0"
                    max={formData.lessonCount}
                    value={formData.freeLessonCount}
                    onChange={(e) => setFormData({ ...formData, freeLessonCount: parseInt(e.target.value) || 0 })}
                    placeholder="Number of free lessons for preview"
                    data-testid="input-edit-free-lesson-count"
                  />
                  <p className="text-xs text-ministry-slate mt-1">
                    Allow free users to preview first {formData.freeLessonCount} lessons
                  </p>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="edit-video-url">Video URL (Optional)</Label>
              <Input
                id="edit-video-url"
                value={formData.videoUrl}
                onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                placeholder="https://..."
                data-testid="input-edit-video-url"
              />
            </div>

            {/* Purchase Options Section - HIGHLY VISIBLE */}
            <div className="flex items-center justify-between rounded-lg border-4 border-red-500 p-6 bg-red-100">
              <div className="space-y-0.5">
                <Label className="text-xl font-bold text-red-900">🔴 REQUIRES PURCHASE - TEST VISIBILITY</Label>
                <div className="text-lg font-bold text-red-900">
                  Make this study available for purchase
                </div>
              </div>
              <Switch
                checked={formData.requiresPurchase}
                onCheckedChange={(checked) => setFormData({ ...formData, requiresPurchase: checked, price: checked ? formData.price : "" })}
                data-testid="switch-edit-requires-purchase"
              />
            </div>

            {/* Price field - only show when requiresPurchase is true */}
            {formData.requiresPurchase && (
              <div>
                <Label htmlFor="edit-price">Price ($)</Label>
                <Input
                  id="edit-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0.00"
                  data-testid="input-edit-price"
                />
              </div>
            )}

            {/* Tier checkboxes - only show when requiresPurchase is true */}
            {formData.requiresPurchase && (
              <div>
                <Label>Purchase Required For</Label>
                <div className="space-y-2">
                  {/* All selection checkbox */}
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="edit-all-tiers"
                      checked={formData.purchaseRequiredTiers.length === 3}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, purchaseRequiredTiers: ['free', 'premium', 'vip'] });
                        } else {
                          setFormData({ ...formData, purchaseRequiredTiers: [] });
                        }
                      }}
                      className="rounded border-ministry-steel"
                      data-testid="checkbox-edit-all-tiers"
                    />
                    <label htmlFor="edit-all-tiers" className="text-sm font-medium">
                      All Tiers
                    </label>
                  </div>
                  
                  {/* Individual tier checkboxes */}
                  {[{ id: 'free', label: 'Free' }, { id: 'premium', label: 'Premium' }, { id: 'vip', label: 'VIP' }].map((tier) => (
                    <div key={tier.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`edit-tier-${tier.id}`}
                        checked={formData.purchaseRequiredTiers.includes(tier.id)}
                        onChange={(e) => {
                          const currentTiers = [...formData.purchaseRequiredTiers];
                          if (e.target.checked) {
                            if (!currentTiers.includes(tier.id)) {
                              currentTiers.push(tier.id);
                            }
                          } else {
                            const index = currentTiers.indexOf(tier.id);
                            if (index > -1) {
                              currentTiers.splice(index, 1);
                            }
                          }
                          setFormData({ ...formData, purchaseRequiredTiers: currentTiers });
                        }}
                        className="rounded border-ministry-steel"
                        data-testid={`checkbox-edit-tier-${tier.id}`}
                      />
                      <label htmlFor={`edit-tier-${tier.id}`} className="text-sm">
                        {tier.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="edit-tags">Tags (comma-separated)</Label>
              <Input
                id="edit-tags"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="tag1, tag2, tag3"
                data-testid="input-edit-tags"
              />
            </div>

            <div>
              <Label htmlFor="edit-lessons">Lessons (JSON format)</Label>
              <Textarea
                id="edit-lessons"
                value={formData.lessons}
                onChange={(e) => setFormData({ ...formData, lessons: e.target.value })}
                placeholder="JSON array of lessons"
                rows={8}
                className="font-mono text-sm"
                data-testid="input-edit-lessons"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowEditDialog(false)}
                data-testid="button-cancel-edit"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={updateStudyMutation.isPending || !formData.title.trim()}
                className="bg-ministry-navy hover:bg-ministry-charcoal"
                data-testid="button-save-edit"
              >
                {updateStudyMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}