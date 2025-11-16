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
import { Edit, Trash2, Plus, Book, Users, Crown, Gem, List, ChevronUp, ChevronDown } from "lucide-react";

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
  totalDays?: number;
  createdAt: string;
  updatedAt: string;
}

interface StudyLesson {
  id: string;
  studyId: string;
  dayNumber: number;
  title: string;
  content: string;
  scripture?: string;
  questions?: any[];
  keyTakeaway?: string;
  displayOrder: number;
  estimatedMinutes?: number;
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
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadingWord, setUploadingWord] = useState(false);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [showLessonsDialog, setShowLessonsDialog] = useState(false);
  const [managingLessonsStudy, setManagingLessonsStudy] = useState<Study | null>(null);
  const [editingLesson, setEditingLesson] = useState<StudyLesson | null>(null);
  const [showBulkImportDialog, setShowBulkImportDialog] = useState(false);
  const [bulkImportText, setBulkImportText] = useState("");
  const [parsedLessons, setParsedLessons] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [lessonFormData, setLessonFormData] = useState({
    dayNumber: 1,
    title: "",
    content: "",
    scripture: "",
    keyTakeaway: "",
    displayOrder: 1,
    estimatedMinutes: 15,
    questions: [] as Array<{ id: string; question: string; type: string }>,
  });
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

  // Fetch lessons for a study
  const { data: lessons = [], isLoading: lessonsLoading } = useQuery<StudyLesson[]>({
    queryKey: [`/api/studies/${managingLessonsStudy?.id}/lessons`],
    enabled: !!managingLessonsStudy,
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

  // Lesson mutations
  const createLessonMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", `/api/studies/${managingLessonsStudy?.id}/lessons`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/studies/${managingLessonsStudy?.id}/lessons`] });
      setEditingLesson(null);
      resetLessonForm();
      toast({
        title: "Success",
        description: "Lesson created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create lesson",
        variant: "destructive",
      });
    },
  });

  const updateLessonMutation = useMutation({
    mutationFn: async (data: { lessonId: string; updates: any }) => {
      return await apiRequest("PATCH", `/api/studies/${managingLessonsStudy?.id}/lessons/${data.lessonId}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/studies/${managingLessonsStudy?.id}/lessons`] });
      setEditingLesson(null);
      resetLessonForm();
      toast({
        title: "Success",
        description: "Lesson updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update lesson",
        variant: "destructive",
      });
    },
  });

  const deleteLessonMutation = useMutation({
    mutationFn: async (lessonId: string) => {
      return await apiRequest("DELETE", `/api/studies/${managingLessonsStudy?.id}/lessons/${lessonId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/studies/${managingLessonsStudy?.id}/lessons`] });
      toast({
        title: "Success",
        description: "Lesson deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete lesson",
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
    if (thumbnailFile) {
      await handleThumbnailUpload(thumbnailFile);
    }
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
      price: formData.requiresPurchase && formData.price && formData.price.trim() !== '' ? formData.price : undefined,
      purchaseRequiredTiers: formData.requiresPurchase ? formData.purchaseRequiredTiers : [],
    };

    updateStudyMutation.mutate({ id: editingStudy.id, updates });
  };

  const handleDelete = (studyId: string) => {
    if (confirm("Are you sure you want to delete this study? This action cannot be undone.")) {
      deleteStudyMutation.mutate(studyId);
    }
  };

  const handleManageLessons = (study: Study) => {
    setManagingLessonsStudy(study);
    setShowLessonsDialog(true);
  };

  const handleAddLesson = () => {
    const nextOrder = lessons.length > 0 ? Math.max(...lessons.map(l => l.displayOrder)) + 1 : 1;
    const nextDay = lessons.length > 0 ? Math.max(...lessons.map(l => l.dayNumber)) + 1 : 1;
    setLessonFormData({
      dayNumber: nextDay,
      title: "",
      content: "",
      scripture: "",
      keyTakeaway: "",
      displayOrder: nextOrder,
      estimatedMinutes: 15,
      questions: [],
    });
    setEditingLesson(null);
  };

  const handleEditLesson = (lesson: StudyLesson) => {
    setEditingLesson(lesson);
    setLessonFormData({
      dayNumber: lesson.dayNumber,
      title: lesson.title,
      content: lesson.content,
      scripture: lesson.scripture || "",
      keyTakeaway: lesson.keyTakeaway || "",
      displayOrder: lesson.displayOrder,
      estimatedMinutes: lesson.estimatedMinutes || 15,
      questions: lesson.questions || [],
    });
  };

  const handleDeleteLesson = (lessonId: string) => {
    if (confirm("Are you sure you want to delete this lesson? This action cannot be undone.")) {
      deleteLessonMutation.mutate(lessonId);
    }
  };

  const handleSaveLesson = () => {
    if (!lessonFormData.title.trim()) {
      toast({
        title: "Error",
        description: "Title is required",
        variant: "destructive",
      });
      return;
    }

    if (!lessonFormData.content.trim()) {
      toast({
        title: "Error",
        description: "Content is required",
        variant: "destructive",
      });
      return;
    }

    if (lessonFormData.dayNumber < 1) {
      toast({
        title: "Error",
        description: "Day number must be at least 1",
        variant: "destructive",
      });
      return;
    }

    // Ensure numbers are properly formatted
    const validatedData = {
      dayNumber: parseInt(String(lessonFormData.dayNumber)),
      title: lessonFormData.title.trim(),
      content: lessonFormData.content.trim(),
      scripture: lessonFormData.scripture?.trim() || undefined,
      keyTakeaway: lessonFormData.keyTakeaway?.trim() || undefined,
      displayOrder: parseInt(String(lessonFormData.displayOrder)),
      estimatedMinutes: parseInt(String(lessonFormData.estimatedMinutes)),
      questions: lessonFormData.questions.length > 0 ? lessonFormData.questions : undefined,
    };

    if (editingLesson) {
      updateLessonMutation.mutate({
        lessonId: editingLesson.id,
        updates: validatedData,
      });
    } else {
      createLessonMutation.mutate(validatedData);
    }
  };

  const resetLessonForm = () => {
    setLessonFormData({
      dayNumber: 1,
      title: "",
      content: "",
      scripture: "",
      keyTakeaway: "",
      displayOrder: 1,
      estimatedMinutes: 15,
      questions: [],
    });
  };

  const handleAddQuestion = () => {
    const newQuestion = {
      id: `q-${Date.now()}`,
      question: "",
      type: "reflection"
    };
    setLessonFormData({
      ...lessonFormData,
      questions: [...lessonFormData.questions, newQuestion]
    });
  };

  const handleUpdateQuestion = (id: string, field: string, value: string) => {
    setLessonFormData({
      ...lessonFormData,
      questions: lessonFormData.questions.map(q => 
        q.id === id ? { ...q, [field]: value } : q
      )
    });
  };

  const handleDeleteQuestion = (id: string) => {
    setLessonFormData({
      ...lessonFormData,
      questions: lessonFormData.questions.filter(q => q.id !== id)
    });
  };

  const handleReorderLesson = async (lessonId: string, direction: 'up' | 'down') => {
    const currentIndex = lessons.findIndex(l => l.id === lessonId);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= lessons.length) return;

    const currentLesson = lessons[currentIndex];
    const swapLesson = lessons[newIndex];

    try {
      // Update both lessons' display orders
      await Promise.all([
        apiRequest("PATCH", `/api/studies/${managingLessonsStudy?.id}/lessons/${currentLesson.id}`, {
          displayOrder: swapLesson.displayOrder
        }),
        apiRequest("PATCH", `/api/studies/${managingLessonsStudy?.id}/lessons/${swapLesson.id}`, {
          displayOrder: currentLesson.displayOrder
        })
      ]);

      queryClient.invalidateQueries({ queryKey: [`/api/studies/${managingLessonsStudy?.id}/lessons`] });
      toast({
        title: "Success",
        description: "Lesson order updated",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reorder lessons",
        variant: "destructive",
      });
    }
  };

  const applyFormatting = (command: string, value?: string) => {
    document.execCommand(command, false, value);
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

  const handleThumbnailUpload = async (file: File) => {
    if (!editingStudy) return;

    const formData = new FormData();
    formData.append('thumbnail', file);

    try {
      setUploadingThumbnail(true);
      const response = await fetch(`/api/studies/${editingStudy.id}/upload-thumbnail`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to upload thumbnail');
      }

      toast({
        title: "Success",
        description: "Thumbnail uploaded successfully",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/studies"] });
      queryClient.invalidateQueries({ queryKey: [`/api/studies/${editingStudy.id}`] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to upload thumbnail",
        variant: "destructive",
      });
    } finally {
      setUploadingThumbnail(false);
      setThumbnailFile(null);
    }
  };

  const handleThumbnailDelete = async () => {
    if (!editingStudy) return;

    if (!confirm('Are you sure you want to delete this thumbnail? The logo will be shown instead.')) {
      return;
    }

    try {
      const response = await fetch(`/api/studies/${editingStudy.id}/delete-thumbnail`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete thumbnail');
      }

      toast({
        title: "Success",
        description: "Thumbnail deleted successfully. Logo will be shown.",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/studies"] });
      queryClient.invalidateQueries({ queryKey: [`/api/studies/${editingStudy.id}`] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete thumbnail",
        variant: "destructive",
      });
    }
  };

  // Parse bulk imported content into lessons
  const parseBulkContent = (text: string) => {
    // Clear previous parsed lessons
    setParsedLessons([]);
    
    if (!text.trim()) {
      toast({
        title: "Error",
        description: "Please paste some content to import",
        variant: "destructive",
      });
      return;
    }

    // Enhanced pattern to support more heading styles:
    // - "Day X:" or "Day X -"
    // - "# Day X", "## Day X", "### Day X", etc. (Markdown)
    // - Allows optional leading/trailing whitespace
    const dayPattern = /(?:^|\n)\s*(?:#{1,6}\s*)?Day\s+(\d+)\s*[:\-\—]?\s*(.*?)(?=\n\s*(?:#{1,6}\s*)?Day\s+\d+\s*[:\-\—]?|$)/gis;
    const matches = [...text.matchAll(dayPattern)];
    
    if (matches.length === 0) {
      toast({
        title: "No lessons found",
        description: "Content should be formatted with 'Day 1:', '# Day 1', '## Day 1', or 'Day 1 -' style headings",
        variant: "destructive",
      });
      return;
    }

    // Get maximum display order to ensure new lessons append after existing ones
    const maxDisplayOrder = lessons.length > 0 
      ? Math.max(...lessons.map(l => l.displayOrder))
      : 0;
    
    const parsed = matches.map((match, index) => {
      const dayNum = parseInt(match[1]);
      const titleAndContent = match[2] || "";
      
      // Try to extract title from first line and content from rest
      const lines = titleAndContent.trim().split('\n');
      const title = lines[0]?.trim() || `Lesson ${dayNum}`;
      const content = lines.slice(1).join('\n').trim();
      
      // Try to extract scripture references (look for patterns like "John 3:16" or "1 Corinthians 13:4-8")
      const scripturePattern = /(?:^|\n)(?:Scripture|Reference|Read):\s*([^\n]+)/i;
      const scriptureMatch = titleAndContent.match(scripturePattern);
      const scripture = scriptureMatch ? scriptureMatch[1].trim() : "";
      
      // Try to extract key takeaway
      const takeawayPattern = /(?:^|\n)(?:Key Takeaway|Summary|Main Point):\s*([^\n]+)/i;
      const takeawayMatch = titleAndContent.match(takeawayPattern);
      const keyTakeaway = takeawayMatch ? takeawayMatch[1].trim() : "";
      
      return {
        dayNumber: dayNum,
        title: title || `Day ${dayNum}`,
        content: content || titleAndContent,
        scripture: scripture || "",
        keyTakeaway: keyTakeaway || "",
        displayOrder: maxDisplayOrder + index + 1, // Append after highest existing order
        estimatedMinutes: 15,
        questions: [],
      };
    });

    setParsedLessons(parsed);
    toast({
      title: "Success",
      description: `Parsed ${parsed.length} lessons from the content`,
    });
  };

  // Bulk import lessons
  const handleBulkImport = async () => {
    if (!managingLessonsStudy || parsedLessons.length === 0) {
      return;
    }

    setIsImporting(true);
    try {
      // Create lessons in batch
      for (const lesson of parsedLessons) {
        await apiRequest("POST", `/api/studies/${managingLessonsStudy.id}/lessons`, lesson);
      }

      toast({
        title: "Success",
        description: `Imported ${parsedLessons.length} lessons successfully`,
      });

      // Reset and close
      setBulkImportText("");
      setParsedLessons([]);
      setShowBulkImportDialog(false);
      
      // Refresh lessons list
      queryClient.invalidateQueries({ queryKey: [`/api/studies/${managingLessonsStudy.id}/lessons`] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to import lessons",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
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
                      onClick={() => handleManageLessons(study)}
                      className="bg-ministry-gold hover:bg-ministry-gold/90 text-ministry-charcoal"
                      data-testid={`button-manage-lessons-${study.id}`}
                    >
                      <List className="w-4 h-4 mr-1" />
                      Lessons
                    </Button>
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
                  {study.tags && study.tags.length > 0 && (
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

            {/* Thumbnail Image Management */}
            <div className="space-y-2">
              <Label>Thumbnail Image</Label>
              {editingStudy && (editingStudy as any).thumbnailFilename ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded overflow-hidden bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
                        <img 
                          src={(editingStudy as any).thumbnailUrl} 
                          alt="Thumbnail" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="text-sm text-gray-700 dark:text-gray-300">Custom Thumbnail</span>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleThumbnailDelete}
                      data-testid="button-delete-thumbnail"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Delete thumbnail to show logo instead
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    id="edit-thumbnail-file"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
                    data-testid="input-edit-thumbnail"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Upload a custom thumbnail or logo will be shown by default
                  </p>
                  {thumbnailFile && (
                    <p className="text-xs text-green-600 dark:text-green-400">
                      Selected: {thumbnailFile.name} - will upload when you save changes
                    </p>
                  )}
                </div>
              )}
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
              <Label>Word Document (.docx only)</Label>
              {editingStudy && (editingStudy as any).wordFilename ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                        <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                        </svg>
                      </div>
                      <span className="text-sm text-gray-700 dark:text-gray-300">{(editingStudy as any).wordOriginalName || 'Word Document'}</span>
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
                  {(editingStudy as any).wordOriginalName?.toLowerCase().endsWith('.docx') && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        setShowEditDialog(false);
                        setTimeout(() => {
                          window.location.href = `/admin/studies/${editingStudy.id}/edit-word`;
                        }, 100);
                      }}
                      className="w-full bg-ministry-gold hover:bg-ministry-gold/90 text-ministry-charcoal font-bold shadow-md"
                      data-testid="button-edit-sections"
                    >
                      📝 Mark Editable Sections
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    id="edit-word-file"
                    type="file"
                    accept=".docx"
                    onChange={(e) => setWordFile(e.target.files?.[0] || null)}
                    data-testid="input-edit-word"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Only .docx files are supported for interactive viewing.
                  </p>
                  {wordFile && (
                    <p className="text-xs text-green-600 dark:text-green-400">
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

      {/* Lesson Management Dialog */}
      <Dialog open={showLessonsDialog} onOpenChange={(open) => {
        setShowLessonsDialog(open);
        if (!open) {
          setManagingLessonsStudy(null);
          setEditingLesson(null);
          resetLessonForm();
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Manage Lessons - {managingLessonsStudy?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Add New Lesson and Bulk Import Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={handleAddLesson}
                className="bg-ministry-gold hover:bg-ministry-gold/90 text-ministry-charcoal"
                data-testid="button-add-lesson"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add New Lesson
              </Button>
              <Button
                onClick={() => setShowBulkImportDialog(true)}
                variant="outline"
                className="border-ministry-gold text-ministry-gold hover:bg-ministry-gold/10"
                data-testid="button-bulk-import"
              >
                <List className="w-4 h-4 mr-2" />
                Bulk Import
              </Button>
            </div>

            {/* Lesson Form (shown when adding or editing) */}
            {(editingLesson || lessonFormData.title || lessonFormData.content) && (
              <Card className="border-ministry-gold">
                <CardHeader>
                  <CardTitle className="text-base">
                    {editingLesson ? `Edit Lesson ${editingLesson.dayNumber}` : 'New Lesson'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Day Number</Label>
                      <Input
                        type="number"
                        value={lessonFormData.dayNumber}
                        onChange={(e) => setLessonFormData({...lessonFormData, dayNumber: parseInt(e.target.value) || 1})}
                        data-testid="input-lesson-day"
                      />
                    </div>
                    <div>
                      <Label>Display Order</Label>
                      <Input
                        type="number"
                        value={lessonFormData.displayOrder}
                        onChange={(e) => setLessonFormData({...lessonFormData, displayOrder: parseInt(e.target.value) || 1})}
                        data-testid="input-lesson-order"
                      />
                    </div>
                    <div>
                      <Label>Estimated Minutes</Label>
                      <Input
                        type="number"
                        value={lessonFormData.estimatedMinutes}
                        onChange={(e) => setLessonFormData({...lessonFormData, estimatedMinutes: parseInt(e.target.value) || 15})}
                        data-testid="input-lesson-minutes"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Lesson Title *</Label>
                    <Input
                      value={lessonFormData.title}
                      onChange={(e) => setLessonFormData({...lessonFormData, title: e.target.value})}
                      placeholder="e.g., The Foundation of Biblical Manhood"
                      data-testid="input-lesson-title"
                    />
                  </div>
                  <div>
                    <Label>Content * (Rich Text)</Label>
                    <div className="border rounded-md">
                      <div className="flex flex-wrap gap-1 p-2 border-b bg-gray-50">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => applyFormatting('bold')}
                          className="h-8 px-2"
                          data-testid="button-format-bold"
                        >
                          <strong>B</strong>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => applyFormatting('italic')}
                          className="h-8 px-2"
                          data-testid="button-format-italic"
                        >
                          <em>I</em>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => applyFormatting('underline')}
                          className="h-8 px-2"
                          data-testid="button-format-underline"
                        >
                          <u>U</u>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => applyFormatting('formatBlock', '<h3>')}
                          className="h-8 px-3"
                          data-testid="button-format-heading"
                        >
                          H3
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => applyFormatting('insertUnorderedList')}
                          className="h-8 px-2"
                          data-testid="button-format-list"
                        >
                          • List
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => applyFormatting('insertOrderedList')}
                          className="h-8 px-2"
                          data-testid="button-format-numbered"
                        >
                          1. List
                        </Button>
                      </div>
                      <div
                        contentEditable
                        className="min-h-[150px] p-3 focus:outline-none"
                        dangerouslySetInnerHTML={{ __html: lessonFormData.content }}
                        onInput={(e) => {
                          const content = e.currentTarget.innerHTML;
                          setLessonFormData({...lessonFormData, content});
                        }}
                        onBlur={(e) => {
                          const content = e.currentTarget.innerHTML;
                          setLessonFormData({...lessonFormData, content});
                        }}
                        data-testid="richtext-lesson-content"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Scripture Reference</Label>
                    <Input
                      value={lessonFormData.scripture}
                      onChange={(e) => setLessonFormData({...lessonFormData, scripture: e.target.value})}
                      placeholder="e.g., Ephesians 5:25-33"
                      data-testid="input-lesson-scripture"
                    />
                  </div>
                  <div>
                    <Label>Key Takeaway</Label>
                    <Textarea
                      value={lessonFormData.keyTakeaway}
                      onChange={(e) => setLessonFormData({...lessonFormData, keyTakeaway: e.target.value})}
                      placeholder="Main point or summary"
                      rows={2}
                      data-testid="textarea-lesson-takeaway"
                    />
                  </div>

                  {/* Question Builder */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Reflection Questions</Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleAddQuestion}
                        data-testid="button-add-question"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add Question
                      </Button>
                    </div>
                    {lessonFormData.questions.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No questions yet. Click "Add Question" to create reflection questions.</p>
                    ) : (
                      <div className="space-y-2">
                        {lessonFormData.questions.map((q, index) => (
                          <Card key={q.id} className="p-3">
                            <div className="space-y-2">
                              <div className="flex items-start gap-2">
                                <span className="text-xs font-semibold text-muted-foreground mt-2">Q{index + 1}</span>
                                <div className="flex-1 space-y-2">
                                  <Input
                                    value={q.question}
                                    onChange={(e) => handleUpdateQuestion(q.id, 'question', e.target.value)}
                                    placeholder="Enter your question..."
                                    data-testid={`input-question-${index}`}
                                  />
                                  <Select
                                    value={q.type}
                                    onValueChange={(value) => handleUpdateQuestion(q.id, 'type', value)}
                                  >
                                    <SelectTrigger data-testid={`select-question-type-${index}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="reflection">Reflection</SelectItem>
                                      <SelectItem value="application">Application</SelectItem>
                                      <SelectItem value="discussion">Discussion</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteQuestion(q.id)}
                                  data-testid={`button-delete-question-${index}`}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleSaveLesson}
                      disabled={createLessonMutation.isPending || updateLessonMutation.isPending}
                      className="bg-ministry-gold hover:bg-ministry-gold/90 text-ministry-charcoal"
                      data-testid="button-save-lesson"
                    >
                      {editingLesson ? 'Update Lesson' : 'Save Lesson'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditingLesson(null);
                        resetLessonForm();
                      }}
                      data-testid="button-cancel-lesson"
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Lessons List */}
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Existing Lessons ({lessons.length})</h3>
              {lessonsLoading ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-ministry-navy"></div>
                </div>
              ) : lessons.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center text-muted-foreground">
                    <Book className="w-8 h-8 mx-auto mb-2 text-ministry-slate" />
                    <p>No lessons yet. Add your first lesson above.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {lessons.map((lesson, index) => (
                    <Card key={lesson.id} className="border-gray-200">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="secondary" className="text-xs">
                                Day {lesson.dayNumber}
                              </Badge>
                              <h4 className="font-semibold text-sm">{lesson.title}</h4>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {lesson.content.replace(/<[^>]*>/g, '')}
                            </p>
                            {lesson.scripture && (
                              <p className="text-xs text-ministry-gold mt-1">
                                📖 {lesson.scripture}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 ml-4">
                            <div className="flex flex-col gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleReorderLesson(lesson.id, 'up')}
                                disabled={index === 0}
                                className="h-6 w-6 p-0"
                                data-testid={`button-reorder-up-${lesson.id}`}
                              >
                                <ChevronUp className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleReorderLesson(lesson.id, 'down')}
                                disabled={index === lessons.length - 1}
                                className="h-6 w-6 p-0"
                                data-testid={`button-reorder-down-${lesson.id}`}
                              >
                                <ChevronDown className="w-3 h-3" />
                              </Button>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditLesson(lesson)}
                              data-testid={`button-edit-lesson-${lesson.id}`}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteLesson(lesson.id)}
                              disabled={deleteLessonMutation.isPending}
                              data-testid={`button-delete-lesson-${lesson.id}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Import Dialog */}
      <Dialog open={showBulkImportDialog} onOpenChange={(open) => {
        setShowBulkImportDialog(open);
        if (!open) {
          setBulkImportText("");
          setParsedLessons([]);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Bulk Import Lessons - {managingLessonsStudy?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Instructions */}
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-semibold text-sm mb-2">Formatting Instructions</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Paste your study content below. Use one of these formats for each day:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                <li><code>Day 1: Title of Lesson</code> or <code>### Day 1: Title</code></li>
                <li>Include <code>Scripture: John 3:16</code> for scripture references</li>
                <li>Include <code>Key Takeaway: Summary text</code> for takeaways</li>
              </ul>
              <div className="mt-3 text-xs font-mono bg-white dark:bg-gray-900 p-2 rounded">
                <div>Day 1: Foundation of Biblical Manhood</div>
                <div>Scripture: Genesis 2:15-18</div>
                <div>Content goes here...</div>
                <div>Key Takeaway: God created man with purpose</div>
                <div className="mt-2">Day 2: Leadership in the Home</div>
                <div>Content for day 2...</div>
              </div>
            </div>

            {/* Paste Area */}
            <div>
              <Label>Paste Study Content</Label>
              <Textarea
                value={bulkImportText}
                onChange={(e) => {
                  setBulkImportText(e.target.value);
                  setParsedLessons([]); // Clear preview when text changes
                }}
                placeholder="Paste your study content here..."
                rows={12}
                className="font-mono text-sm"
                data-testid="textarea-bulk-import"
              />
            </div>

            {/* Parse Button */}
            <Button
              onClick={() => parseBulkContent(bulkImportText)}
              disabled={!bulkImportText.trim()}
              className="w-full bg-ministry-gold hover:bg-ministry-gold/90 text-ministry-charcoal"
              data-testid="button-parse-content"
            >
              Parse Content into Lessons
            </Button>

            {/* Preview Parsed Lessons */}
            {parsedLessons.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">
                    Preview ({parsedLessons.length} lessons)
                  </h4>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setParsedLessons([])}
                  >
                    Clear
                  </Button>
                </div>
                <div className="max-h-[300px] overflow-y-auto space-y-2">
                  {parsedLessons.map((lesson, index) => (
                    <Card key={index} className="border-ministry-steel/20">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between mb-2">
                          <Badge variant="secondary" className="text-xs">
                            Day {lesson.dayNumber}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            ~{lesson.estimatedMinutes} min
                          </span>
                        </div>
                        <h5 className="font-semibold text-sm mb-1">{lesson.title}</h5>
                        {lesson.scripture && (
                          <p className="text-xs text-muted-foreground mb-1">
                            📖 {lesson.scripture}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {lesson.content.substring(0, 150)}...
                        </p>
                        {lesson.keyTakeaway && (
                          <p className="text-xs text-ministry-gold mt-1">
                            💡 {lesson.keyTakeaway}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Import Button */}
                <Button
                  onClick={handleBulkImport}
                  disabled={isImporting}
                  className="w-full bg-ministry-gold hover:bg-ministry-gold/90 text-ministry-charcoal font-semibold"
                  data-testid="button-confirm-import"
                >
                  {isImporting ? "Importing..." : `Import ${parsedLessons.length} Lessons`}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}