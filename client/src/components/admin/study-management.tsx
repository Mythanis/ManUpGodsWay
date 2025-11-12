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
  author: string;
  tags: string;
  requiresPurchase: boolean;
  price: string;
  purchaseRequiredTiers: string[];
}

export default function StudyManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingStudy, setEditingStudy] = useState<Study | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [wordFile, setWordFile] = useState<File | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadingWord, setUploadingWord] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    title: "",
    description: "",
    category: "",
    requiredTier: "free",
    videoUrl: "",
    duration: 0,
    author: "",
    tags: "",
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
      author: study.author,
      tags: study.tags.join(", "),
      requiresPurchase: study.requiresPurchase || false,
      price: study.price || "",
      purchaseRequiredTiers: study.purchaseRequiredTiers || [],
    });
    setShowEditDialog(true);
  };

  const handleUpdate = async () => {
    if (!editingStudy) return;

    // First, upload any selected files
    if (pdfFile) {
      await handleFileUpload(pdfFile, 'pdf');
    }
    if (wordFile) {
      await handleFileUpload(wordFile, 'word');
    }

    const updates = {
      title: formData.title,
      description: formData.description,
      category: formData.category,
      requiredTier: formData.requiredTier,
      videoUrl: formData.videoUrl || undefined,
      duration: formData.duration,
      author: formData.author,
      tags: formData.tags.split(",").map(tag => tag.trim()).filter(Boolean),
      requiresPurchase: formData.requiresPurchase,
      price: formData.requiresPurchase && formData.price && formData.price.trim() !== '' ? formData.price : null,
      purchaseRequiredTiers: formData.requiresPurchase ? formData.purchaseRequiredTiers : [],
    };

    updateStudyMutation.mutate({ id: editingStudy.id, updates });
  };

  const handleDelete = (studyId: string) => {
    if (confirm("Are you sure you want to delete this study? This action cannot be undone.")) {
      deleteStudyMutation.mutate(studyId);
    }
  };

  const handleFileUpload = async (file: File, type: 'pdf' | 'word') => {
    if (!editingStudy) return;

    const formData = new FormData();
    formData.append(type, file);

    const setUploading = type === 'pdf' ? setUploadingPdf : setUploadingWord;
    
    try {
      setUploading(true);
      const response = await fetch(`/api/studies/${editingStudy.id}/upload-${type}`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to upload ${type} file`);
      }

      toast({
        title: "Success",
        description: `${type.toUpperCase()} file uploaded successfully`,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/studies"] });
      queryClient.invalidateQueries({ queryKey: [`/api/studies/${editingStudy.id}`] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || `Failed to upload ${type} file`,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (type === 'pdf') setPdfFile(null);
      if (type === 'word') setWordFile(null);
    }
  };

  const handleFileDelete = async (type: 'pdf' | 'word') => {
    if (!editingStudy) return;

    if (!confirm(`Are you sure you want to delete this ${type.toUpperCase()} file?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/studies/${editingStudy.id}/delete-${type}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete ${type} file`);
      }

      toast({
        title: "Success",
        description: `${type.toUpperCase()} file deleted successfully`,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/studies"] });
      queryClient.invalidateQueries({ queryKey: [`/api/studies/${editingStudy.id}`] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || `Failed to delete ${type} file`,
        variant: "destructive",
      });
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case "premium":
        return <Crown className="w-4 h-4 text-yellow-600" />;
      case "vip":
        return <Gem className="w-4 h-4 text-ministry-gold" />;
      default:
        return <Users className="w-4 h-4 text-black" />;
    }
  };

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case "premium":
        return "bg-yellow-100 text-yellow-800";
      case "vip":
        return "bg-ministry-gold-exact text-black";
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

            {/* PDF File Management */}
            <div className="space-y-2">
              <Label>PDF Document</Label>
              {editingStudy && (editingStudy as any).pdfFilename ? (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded bg-red-100 flex items-center justify-center">
                      <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                      </svg>
                    </div>
                    <span className="text-sm text-gray-700">{(editingStudy as any).pdfOriginalName || 'PDF Document'}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleFileDelete('pdf')}
                    data-testid="button-delete-pdf"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    id="edit-pdf-file"
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                    data-testid="input-edit-pdf"
                  />
                  {pdfFile && (
                    <p className="text-xs text-green-600">
                      Selected: {pdfFile.name} - will upload when you save changes
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Word File Management */}
            <div className="space-y-2">
              <Label>Word Document (.doc/.docx)</Label>
              {editingStudy && (editingStudy as any).wordFilename ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center">
                        <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                        </svg>
                      </div>
                      <span className="text-sm text-gray-700">{(editingStudy as any).wordOriginalName || 'Word Document'}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleFileDelete('word')}
                      data-testid="button-delete-word"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  {!(editingStudy as any).wordOriginalName?.toLowerCase().endsWith('.doc') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowEditDialog(false);
                        setTimeout(() => {
                          window.location.href = `/admin/studies/${editingStudy.id}/edit-word`;
                        }, 100);
                      }}
                      className="w-full"
                      data-testid="button-edit-sections"
                    >
                      Mark Editable Sections
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    id="edit-word-file"
                    type="file"
                    accept=".doc,.docx"
                    onChange={(e) => setWordFile(e.target.files?.[0] || null)}
                    data-testid="input-edit-word"
                  />
                  <p className="text-xs text-gray-500">
                    .docx files can be viewed in browser. .doc files are download-only.
                  </p>
                  {wordFile && (
                    <p className="text-xs text-green-600">
                      Selected: {wordFile.name} - will upload when you save changes
                    </p>
                  )}
                </div>
              )}
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
                className="bg-ministry-gold hover:bg-ministry-gold/90 text-ministry-charcoal font-semibold"
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