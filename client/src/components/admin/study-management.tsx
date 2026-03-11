import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Edit, Trash2, Plus, Book, Users, Crown, Gem, List, ChevronUp, ChevronDown, Layers, X, Check, BookOpen, CalendarClock } from "lucide-react";
import { format } from "date-fns";

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
  isPublished?: boolean;
  requiresPurchase?: boolean;
  price?: string;
  purchaseRequiredTiers?: string[];
  totalDays?: number;
  seriesId?: string | null;
  seriesOrder?: number | null;
  scheduledPublishDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StudySeries {
  id: string;
  title: string;
  description: string;
  category: string;
  thumbnailUrl?: string | null;
  requiredTier?: string;
  isPublished?: boolean;
  requiresConsecutiveCompletion?: boolean;
  studyCount?: number;
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
  difficulty: string;
  videoUrl: string;
  duration: number;
  author: string;
  tags: string;
  requiresPurchase: boolean;
  price: string;
  purchaseRequiredTiers: string[];
  seriesId: string;
  isPublished: boolean;
  scheduledPublishDate: string;
}

export default function StudyManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingStudy, setEditingStudy] = useState<Study | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [wordFile, setWordFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [seriesThumbnailFile, setSeriesThumbnailFile] = useState<File | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadingWord, setUploadingWord] = useState(false);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [uploadingSeriesThumbnail, setUploadingSeriesThumbnail] = useState(false);
  const [showLessonsDialog, setShowLessonsDialog] = useState(false);
  const [managingLessonsStudy, setManagingLessonsStudy] = useState<Study | null>(null);
  const [editingLesson, setEditingLesson] = useState<StudyLesson | null>(null);
  const [showBulkImportDialog, setShowBulkImportDialog] = useState(false);
  const [bulkImportText, setBulkImportText] = useState("");
  const [parsedLessons, setParsedLessons] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [bulkImportMode, setBulkImportMode] = useState<"text" | "word">("text");
  const [wordImportFile, setWordImportFile] = useState<File | null>(null);
  const [isParsingWord, setIsParsingWord] = useState(false);
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
    difficulty: "beginner",
    videoUrl: "",
    duration: 0,
    author: "",
    tags: "",
    requiresPurchase: false,
    price: "",
    purchaseRequiredTiers: [],
    seriesId: "",
    isPublished: false,
    scheduledPublishDate: "",
  });
  
  // Scheduling state for edit dialog
  const [scheduleForLater, setScheduleForLater] = useState(false);

  // Series management state
  const [activeView, setActiveView] = useState<"all" | "series" | "individual">("all");
  const [showCreateSeriesDialog, setShowCreateSeriesDialog] = useState(false);
  const [showEditSeriesDialog, setShowEditSeriesDialog] = useState(false);
  const [editingSeriesData, setEditingSeriesData] = useState<StudySeries | null>(null);
  const [showManageSeriesStudiesDialog, setShowManageSeriesStudiesDialog] = useState(false);
  const [managingSeriesStudies, setManagingSeriesStudies] = useState<StudySeries | null>(null);
  const [seriesFormData, setSeriesFormData] = useState({
    title: "",
    description: "",
    category: "",
    requiredTier: "free",
    thumbnailUrl: "",
    isPublished: false,
    requiresConsecutiveCompletion: false,
  });
  
  // Bulk series upload state
  const [bulkSeriesMode, setBulkSeriesMode] = useState(false);
  const [bulkSeriesText, setBulkSeriesText] = useState("");
  const [parsedSeries, setParsedSeries] = useState<Array<{ title: string; description: string; category: string }>>([]);
  const [isCreatingBulkSeries, setIsCreatingBulkSeries] = useState(false);

  // Fetch all studies
  const { data: studies = [], isLoading, refetch } = useQuery<Study[]>({
    queryKey: ["/api/studies"],
    retry: false,
  });

  // Fetch all series for admin (including unpublished)
  const { data: allSeries = [] } = useQuery<StudySeries[]>({
    queryKey: ["/api/admin/study-series"],
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

  // Series mutations
  const createSeriesMutation = useMutation({
    mutationFn: async (data: typeof seriesFormData) => {
      return await apiRequest("POST", "/api/admin/study-series", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/study-series"] });
      setShowCreateSeriesDialog(false);
      resetSeriesForm();
      toast({ title: "Success", description: "Series created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create series", variant: "destructive" });
    },
  });

  const updateSeriesMutation = useMutation({
    mutationFn: async (data: { id: string; updates: typeof seriesFormData }) => {
      return await apiRequest("PUT", `/api/admin/study-series/${data.id}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/study-series"] });
      setShowEditSeriesDialog(false);
      setEditingSeriesData(null);
      resetSeriesForm();
      toast({ title: "Success", description: "Series updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update series", variant: "destructive" });
    },
  });

  const deleteSeriesMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/admin/study-series/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/study-series"] });
      queryClient.invalidateQueries({ queryKey: ["/api/studies"] });
      toast({ title: "Success", description: "Series deleted. Studies are now individual." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete series", variant: "destructive" });
    },
  });

  const assignStudyToSeriesMutation = useMutation({
    mutationFn: async (data: { studyId: string; seriesId: string | null; seriesOrder?: number }) => {
      return await apiRequest("PUT", `/api/admin/studies/${data.studyId}/series`, {
        seriesId: data.seriesId,
        seriesOrder: data.seriesOrder,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/study-series"] });
      queryClient.invalidateQueries({ queryKey: ["/api/studies"] });
      toast({ title: "Success", description: "Study assignment updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update study", variant: "destructive" });
    },
  });

  const resetSeriesForm = () => {
    setSeriesFormData({ title: "", description: "", category: "", thumbnailUrl: "" });
  };

  // Parse bulk series text
  const parseBulkSeriesText = (text: string) => {
    const entries = text.split(/---+/).filter(entry => entry.trim());
    const parsed: Array<{ title: string; description: string; category: string }> = [];
    
    entries.forEach(entry => {
      const lines = entry.trim().split('\n');
      let title = "";
      let description = "";
      let category = "";
      
      lines.forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine.toLowerCase().startsWith('title:')) {
          title = trimmedLine.substring(6).trim();
        } else if (trimmedLine.toLowerCase().startsWith('description:')) {
          description = trimmedLine.substring(12).trim();
        } else if (trimmedLine.toLowerCase().startsWith('category:')) {
          category = trimmedLine.substring(9).trim().toLowerCase();
        }
      });
      
      if (title) {
        parsed.push({ title, description, category: category || "leadership" });
      }
    });
    
    return parsed;
  };

  // Handle bulk series text change
  const handleBulkSeriesTextChange = (text: string) => {
    setBulkSeriesText(text);
    const parsed = parseBulkSeriesText(text);
    setParsedSeries(parsed);
  };

  // Handle bulk series create
  const handleBulkSeriesCreate = async () => {
    if (parsedSeries.length === 0) return;
    
    setIsCreatingBulkSeries(true);
    let successCount = 0;
    let errorCount = 0;
    
    for (const series of parsedSeries) {
      try {
        await apiRequest("POST", "/api/admin/study-series", series);
        successCount++;
      } catch (error) {
        errorCount++;
        console.error("Failed to create series:", series.title, error);
      }
    }
    
    setIsCreatingBulkSeries(false);
    queryClient.invalidateQueries({ queryKey: ["/api/admin/study-series"] });
    
    if (successCount > 0) {
      toast({
        title: "Bulk Import Complete",
        description: `Created ${successCount} series${errorCount > 0 ? `, ${errorCount} failed` : ""}`,
      });
    }
    
    if (errorCount === 0) {
      setShowCreateSeriesDialog(false);
      setBulkSeriesMode(false);
      setBulkSeriesText("");
      setParsedSeries([]);
    }
  };

  const handleEditSeries = (series: StudySeries) => {
    setEditingSeriesData(series);
    setSeriesFormData({
      title: series.title,
      description: series.description || "",
      category: series.category || "",
      requiredTier: series.requiredTier || "free",
      thumbnailUrl: series.thumbnailUrl || "",
      isPublished: series.isPublished || false,
      requiresConsecutiveCompletion: series.requiresConsecutiveCompletion || false,
    });
    setShowEditSeriesDialog(true);
  };

  const handleManageSeriesStudies = (series: StudySeries) => {
    setManagingSeriesStudies(series);
    setShowManageSeriesStudiesDialog(true);
  };

  const handleAddStudyToSeries = (studyId: string) => {
    if (!managingSeriesStudies) return;
    const seriesStudiesCount = studies.filter(s => s.seriesId === managingSeriesStudies.id).length;
    assignStudyToSeriesMutation.mutate({ 
      studyId, 
      seriesId: managingSeriesStudies.id, 
      seriesOrder: seriesStudiesCount + 1 
    });
  };

  const handleRemoveStudyFromSeries = (studyId: string) => {
    assignStudyToSeriesMutation.mutate({ studyId, seriesId: null });
  };

  // Computed values for views
  const seriesWithStudies = allSeries.map(series => ({
    ...series,
    studies: studies.filter(s => s.seriesId === series.id),
  }));
  const individualStudies = studies.filter(s => !s.seriesId);
  const unassignedStudies = studies.filter(s => !s.seriesId);

  const handleEdit = (study: Study) => {
    setEditingStudy(study);
    // Format scheduled date for datetime-local input in local timezone
    let scheduledDate = "";
    if (study.scheduledPublishDate) {
      const date = new Date(study.scheduledPublishDate);
      // Format as local datetime string for datetime-local input
      scheduledDate = format(date, "yyyy-MM-dd'T'HH:mm");
    }
    setFormData({
      title: study.title,
      description: study.description,
      category: study.category,
      requiredTier: study.requiredTier,
      difficulty: study.difficulty || "beginner",
      videoUrl: study.videoUrl || "",
      duration: study.duration,
      author: study.author,
      tags: study.tags ? study.tags.join(", ") : "",
      requiresPurchase: study.requiresPurchase || false,
      price: study.price || "",
      purchaseRequiredTiers: study.purchaseRequiredTiers || [],
      seriesId: study.seriesId || "",
      isPublished: study.isPublished || false,
      scheduledPublishDate: scheduledDate,
    });
    setScheduleForLater(!!study.scheduledPublishDate);
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
      difficulty: formData.difficulty,
      videoUrl: formData.videoUrl || undefined,
      duration: formData.duration,
      author: formData.author,
      tags: formData.tags.split(",").map(tag => tag.trim()).filter(Boolean),
      requiresPurchase: formData.requiresPurchase,
      price: formData.requiresPurchase && formData.price && formData.price.trim() !== '' ? formData.price : undefined,
      purchaseRequiredTiers: formData.requiresPurchase ? formData.purchaseRequiredTiers : [],
      seriesId: formData.seriesId || null,
      isPublished: scheduleForLater ? false : formData.isPublished,
      scheduledPublishDate: scheduleForLater && formData.scheduledPublishDate 
        ? new Date(formData.scheduledPublishDate).toISOString() 
        : null,
    };

    updateStudyMutation.mutate({ id: editingStudy.id, updates });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/study-series"] });
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

  const handleSeriesThumbnailUpload = async (file: File, seriesId: string): Promise<string | null> => {
    const formData = new FormData();
    formData.append('thumbnail', file);
    try {
      setUploadingSeriesThumbnail(true);
      const response = await fetch(`/api/study-series/${seriesId}/upload-thumbnail`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to upload thumbnail');
      const updated = await response.json();
      const newUrl = updated.thumbnailUrl || null;
      // Update form state so the subsequent PUT doesn't overwrite with empty string
      setSeriesFormData(prev => ({ ...prev, thumbnailUrl: newUrl || "" }));
      queryClient.invalidateQueries({ queryKey: ["/api/admin/study-series"] });
      queryClient.invalidateQueries({ queryKey: ["/api/study-series"] });
      return newUrl;
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to upload thumbnail", variant: "destructive" });
      return null;
    } finally {
      setUploadingSeriesThumbnail(false);
      setSeriesThumbnailFile(null);
    }
  };

  const handleSeriesThumbnailDelete = async (seriesId: string) => {
    if (!confirm('Are you sure you want to remove this thumbnail?')) return;
    try {
      const response = await fetch(`/api/study-series/${seriesId}/delete-thumbnail`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete thumbnail');
      toast({ title: "Success", description: "Thumbnail removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/study-series"] });
      queryClient.invalidateQueries({ queryKey: ["/api/study-series"] });
      setSeriesFormData(prev => ({ ...prev, thumbnailUrl: "" }));
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to remove thumbnail", variant: "destructive" });
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

  // Parse Word document for lesson import
  const handleWordFileParse = async () => {
    if (!wordImportFile || !managingLessonsStudy) return;
    setIsParsingWord(true);
    try {
      const formData = new FormData();
      formData.append('word', wordImportFile);
      const response = await fetch('/api/parse-word-lessons', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to parse Word document');
      }
      const data = await response.json();
      const maxDisplayOrder = lessons.length > 0 ? Math.max(...lessons.map(l => l.displayOrder)) : 0;
      const mapped = (data.lessons || []).map((l: any, i: number) => ({
        dayNumber: l.dayNumber || i + 1,
        title: l.title || `Lesson ${i + 1}`,
        content: l.content || '',
        scripture: l.scripture || '',
        keyTakeaway: l.keyTakeaway || '',
        displayOrder: maxDisplayOrder + i + 1,
        estimatedMinutes: l.estimatedMinutes || 15,
        questions: l.questions || [],
      }));
      setParsedLessons(mapped);
      toast({ title: "Success", description: `Parsed ${mapped.length} lessons from Word document` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || 'Failed to parse Word document', variant: 'destructive' });
    } finally {
      setIsParsingWord(false);
    }
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
    if (tier !== 'free') {
      return <Crown className="w-4 h-4 text-ministry-gold" />;
    }
    return <Users className="w-4 h-4 text-black" />;
  };

  const getTierBadgeColor = (tier: string) => {
    if (tier !== 'free') {
      return "bg-ministry-gold-exact text-black";
    }
    return "bg-white text-black border border-gray-300";
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ministry-navy"></div>
      </div>
    );
  }

  const renderStudyCard = (study: Study) => (
    <Card key={study.id} className="border-gray-200">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${study.isPublished ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                {study.isPublished ? '● Published' : '○ Draft'}
              </span>
              <Badge variant="secondary" className="text-xs capitalize">{study.category}</Badge>
              <Badge className={`text-xs ${getTierBadgeColor(study.requiredTier)}`}>
                <span className="flex items-center gap-1">
                  {getTierIcon(study.requiredTier)}
                  {study.requiredTier.toUpperCase()}
                </span>
              </Badge>
              {study.totalDays != null && study.totalDays > 0 && (
                <Badge variant="outline" className="text-xs">
                  <Book className="w-3 h-3 mr-1" />
                  {study.totalDays} {study.totalDays === 1 ? 'lesson' : 'lessons'}
                </Badge>
              )}
              {study.requiresPurchase && study.price && (
                <Badge className="text-xs bg-ministry-gold text-black">
                  ${parseFloat(String(study.price)).toFixed(2)}
                </Badge>
              )}
              {study.seriesId && (
                <Badge className="text-xs bg-blue-100 text-blue-800 border border-blue-300">
                  {allSeries.find(s => s.id === study.seriesId)?.title || 'In Series'}
                </Badge>
              )}
            </div>
            <h3 className="font-semibold text-base text-foreground mb-1 leading-tight">{study.title}</h3>
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{study.description}</p>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span>By {study.author}</span>
              <span>•</span>
              <span>{study.duration} min</span>
              <span>•</span>
              <span>{new Date(study.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <Button
              size="sm"
              onClick={() => handleManageLessons(study)}
              className="bg-ministry-gold hover:bg-ministry-gold/90 text-ministry-charcoal text-xs"
              data-testid={`button-manage-lessons-${study.id}`}
            >
              <List className="w-3 h-3 mr-1" />
              Lessons
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleEdit(study)}
              className="text-xs"
              data-testid={`button-edit-study-${study.id}`}
            >
              <Edit className="w-3 h-3 mr-1" />
              Edit
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleDelete(study.id)}
              disabled={deleteStudyMutation.isPending}
              className="text-xs"
              data-testid={`button-delete-study-${study.id}`}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Delete
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const categories = [
    { id: 'leadership', label: 'Leadership' },
    { id: 'marriage', label: 'Marriage' },
    { id: 'fatherhood', label: 'Fatherhood' },
    { id: 'character', label: 'Character' },
    { id: 'faith', label: 'Faith' },
    { id: 'holy-spirit', label: 'Holy Spirit' },
  ];

  return (
    <div className="space-y-4">
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)} className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <TabsList className="w-full sm:w-auto overflow-x-auto">
            <TabsTrigger value="all" data-testid="tab-all-studies" className="text-xs sm:text-sm">
              All ({studies.length})
            </TabsTrigger>
            <TabsTrigger value="series" data-testid="tab-series" className="text-xs sm:text-sm">
              Series ({allSeries.length})
            </TabsTrigger>
            <TabsTrigger value="individual" data-testid="tab-individual" className="text-xs sm:text-sm">
              Individual ({individualStudies.length})
            </TabsTrigger>
          </TabsList>
          {activeView === "series" && (
            <Button
              onClick={() => {
                resetSeriesForm();
                setShowCreateSeriesDialog(true);
              }}
              className="bg-ministry-gold-exact text-black hover:bg-yellow-500 w-full sm:w-auto"
              data-testid="button-create-series"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Series
            </Button>
          )}
        </div>

        <TabsContent value="all" className="space-y-4">
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
              {studies.map(renderStudyCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="series" className="space-y-6">
          {allSeries.length === 0 ? (
            <Card className="border-gray-200">
              <CardContent className="py-8 text-center">
                <Layers className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No series created yet.</p>
                <p className="text-sm text-muted-foreground">A series groups 2 or more related studies together.</p>
              </CardContent>
            </Card>
          ) : (
            seriesWithStudies.map((series) => (
              <Card key={series.id} className="border-gray-200" data-testid={`series-card-${series.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-ministry-gold-exact/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Layers className="w-5 h-5 text-ministry-gold-exact" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg text-foreground">{series.title}</CardTitle>
                        <p className="text-sm text-muted-foreground">{series.category || 'No category'} • {series.studies.length} studies</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleManageSeriesStudies(series)}
                        className="bg-ministry-gold hover:bg-ministry-gold/90 text-ministry-charcoal border-0"
                        data-testid={`button-manage-series-${series.id}`}
                      >
                        <BookOpen className="w-4 h-4 mr-1" />
                        Manage Studies
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditSeries(series)}
                        data-testid={`button-edit-series-${series.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm("Delete this series? Studies will become individual studies.")) {
                            deleteSeriesMutation.mutate(series.id);
                          }
                        }}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        data-testid={`button-delete-series-${series.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  {series.description && (
                    <p className="text-sm text-muted-foreground mb-3">{series.description}</p>
                  )}
                  {series.studies.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No studies assigned yet. Click "Manage Studies" to add studies.</p>
                  ) : (
                    <div className="space-y-2">
                      {series.studies.map((study, index) => (
                        <div key={study.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="w-6 h-6 bg-ministry-gold-exact text-black text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0">
                              {index + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-medium text-foreground truncate">{study.title}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${study.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                  {study.isPublished ? 'Published' : 'Draft'}
                                </span>
                                {study.totalDays != null && study.totalDays > 0 && (
                                  <span className="text-xs text-muted-foreground">{study.totalDays} lessons</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleManageLessons(study)}
                              className="text-ministry-gold hover:text-ministry-gold/80 hover:bg-ministry-gold/10 h-7 px-2 text-xs"
                            >
                              <List className="w-3 h-3 mr-1" />
                              Lessons
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleEdit(study)} className="h-7 w-7 p-0">
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => handleRemoveStudyFromSeries(study.id)}
                              className="text-red-500 hover:text-red-700 h-7 w-7 p-0"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="individual" className="space-y-4">
          {individualStudies.length === 0 ? (
            <Card className="border-gray-200">
              <CardContent className="py-8 text-center">
                <Book className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No individual studies.</p>
                <p className="text-sm text-muted-foreground">All studies are currently part of a series.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {individualStudies.map(renderStudyCard)}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Series Dialog */}
      <Dialog open={showCreateSeriesDialog} onOpenChange={(open) => {
        setShowCreateSeriesDialog(open);
        if (!open) {
          setBulkSeriesMode(false);
          setBulkSeriesText("");
          setParsedSeries([]);
        }
      }}>
        <DialogContent className={bulkSeriesMode ? "sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" : "sm:max-w-md"}>
          <DialogHeader>
            <DialogTitle>Create New Series</DialogTitle>
          </DialogHeader>
          
          {/* Mode Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-gray-50">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Bulk Upload Mode</Label>
              <p className="text-xs text-muted-foreground">Create multiple series at once</p>
            </div>
            <Switch
              checked={bulkSeriesMode}
              onCheckedChange={setBulkSeriesMode}
              data-testid="switch-bulk-series-mode"
            />
          </div>

          {!bulkSeriesMode ? (
            <>
              {/* Single Series Form */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="series-title">Title</Label>
                  <Input
                    id="series-title"
                    value={seriesFormData.title}
                    onChange={(e) => setSeriesFormData({ ...seriesFormData, title: e.target.value })}
                    placeholder="e.g., Holy Spirit Series"
                    data-testid="input-series-title"
                  />
                </div>
                <div>
                  <Label htmlFor="series-description">Description</Label>
                  <Textarea
                    id="series-description"
                    value={seriesFormData.description}
                    onChange={(e) => setSeriesFormData({ ...seriesFormData, description: e.target.value })}
                    placeholder="Brief description..."
                    rows={3}
                    data-testid="input-series-description"
                  />
                </div>
                <div>
                  <Label htmlFor="series-category">Category</Label>
                  <Select value={seriesFormData.category} onValueChange={(val) => setSeriesFormData({ ...seriesFormData, category: val })}>
                    <SelectTrigger data-testid="select-series-category">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateSeriesDialog(false)}>Cancel</Button>
                <Button
                  onClick={() => createSeriesMutation.mutate(seriesFormData)}
                  disabled={!seriesFormData.title || createSeriesMutation.isPending}
                  className="bg-ministry-gold-exact text-black hover:bg-yellow-500"
                  data-testid="button-save-series"
                >
                  {createSeriesMutation.isPending ? "Creating..." : "Create Series"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              {/* Bulk Series Form */}
              <div className="flex-1 overflow-y-auto space-y-4">
                <div>
                  <Label>Bulk Series Text</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Enter series using the format below. Separate each series with --- 
                  </p>
                  <Textarea
                    value={bulkSeriesText}
                    onChange={(e) => handleBulkSeriesTextChange(e.target.value)}
                    placeholder={`Title: Holy Spirit Series\nDescription: A deep dive into the Holy Spirit\nCategory: leadership\n---\nTitle: Marriage Series\nDescription: Biblical principles for marriage\nCategory: marriage\n---\nTitle: Fatherhood Series\nDescription: Being a godly father\nCategory: fatherhood`}
                    rows={8}
                    className="font-mono text-sm"
                    data-testid="textarea-bulk-series"
                  />
                </div>

                {/* Preview Section */}
                {parsedSeries.length > 0 && (
                  <div>
                    <Label className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500" />
                      Preview ({parsedSeries.length} series found)
                    </Label>
                    <div className="mt-2 max-h-48 overflow-y-auto border rounded-lg divide-y">
                      {parsedSeries.map((series, index) => (
                        <div key={index} className="p-3 bg-gray-50">
                          <div className="font-medium">{series.title}</div>
                          <div className="text-sm text-muted-foreground">{series.description || "No description"}</div>
                          <Badge variant="outline" className="mt-1 text-xs">{series.category}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {bulkSeriesText && parsedSeries.length === 0 && (
                  <p className="text-sm text-amber-600">No valid series found. Make sure each entry has a Title: line.</p>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setBulkSeriesMode(false);
                  setBulkSeriesText("");
                  setParsedSeries([]);
                }}>Cancel</Button>
                <Button
                  onClick={handleBulkSeriesCreate}
                  disabled={parsedSeries.length === 0 || isCreatingBulkSeries}
                  className="bg-ministry-gold-exact text-black hover:bg-yellow-500"
                  data-testid="button-bulk-create-series"
                >
                  {isCreatingBulkSeries ? "Creating..." : `Create ${parsedSeries.length} Series`}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Series Dialog */}
      <Dialog open={showEditSeriesDialog} onOpenChange={setShowEditSeriesDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Edit Series</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto flex-1 pr-1">
            <div>
              <Label htmlFor="edit-series-title">Title</Label>
              <Input
                id="edit-series-title"
                value={seriesFormData.title}
                onChange={(e) => setSeriesFormData({ ...seriesFormData, title: e.target.value })}
                data-testid="input-edit-series-title"
              />
            </div>
            <div>
              <Label htmlFor="edit-series-description">Description</Label>
              <Textarea
                id="edit-series-description"
                value={seriesFormData.description}
                onChange={(e) => setSeriesFormData({ ...seriesFormData, description: e.target.value })}
                rows={3}
                data-testid="input-edit-series-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-series-category">Category</Label>
                <Select value={seriesFormData.category} onValueChange={(val) => setSeriesFormData({ ...seriesFormData, category: val })}>
                  <SelectTrigger data-testid="select-edit-series-category">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-series-tier">Access Level</Label>
                <Select value={seriesFormData.requiredTier} onValueChange={(val) => setSeriesFormData({ ...seriesFormData, requiredTier: val })}>
                  <SelectTrigger data-testid="select-edit-series-tier">
                    <SelectValue placeholder="Select access" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free - Everyone</SelectItem>
                    <SelectItem value="premium">Subscribers Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Series Thumbnail Upload */}
            <div className="space-y-2">
              <Label>Thumbnail Image</Label>
              {seriesFormData.thumbnailUrl && !seriesThumbnailFile ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded overflow-hidden bg-gray-100 dark:bg-gray-900 flex-shrink-0">
                        <img
                          src={seriesFormData.thumbnailUrl}
                          alt="Thumbnail"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="text-sm text-gray-700 dark:text-gray-300">Current Thumbnail</span>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => editingSeriesData && handleSeriesThumbnailDelete(editingSeriesData.id)}
                      data-testid="button-delete-series-thumbnail"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">Delete to replace with a new image</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    id="edit-series-thumbnail"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setSeriesThumbnailFile(e.target.files?.[0] || null)}
                    data-testid="input-edit-series-thumbnail"
                  />
                  {seriesThumbnailFile && (
                    <p className="text-xs text-green-600 dark:text-green-400">
                      Selected: {seriesThumbnailFile.name} — will upload when you save
                    </p>
                  )}
                  <p className="text-xs text-gray-500">Upload an image — shown as the series icon in the library</p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between border rounded-lg p-3">
              <Label>Published</Label>
              <Switch
                checked={seriesFormData.isPublished}
                onCheckedChange={(checked) => setSeriesFormData({ ...seriesFormData, isPublished: checked })}
                data-testid="switch-edit-series-published"
              />
            </div>
            <div className="flex items-center justify-between border rounded-lg p-3">
              <div>
                <Label>Requires Consecutive Completion</Label>
                <p className="text-xs text-gray-500">Studies must be completed in order</p>
              </div>
              <Switch
                checked={seriesFormData.requiresConsecutiveCompletion}
                onCheckedChange={(checked) => setSeriesFormData({ ...seriesFormData, requiresConsecutiveCompletion: checked })}
                data-testid="switch-edit-series-consecutive"
              />
            </div>
          </div>
          <DialogFooter className="flex-shrink-0 pt-2">
            <Button variant="outline" onClick={() => setShowEditSeriesDialog(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!editingSeriesData) return;
                let thumbnailUrl = seriesFormData.thumbnailUrl;
                if (seriesThumbnailFile) {
                  const uploadedUrl = await handleSeriesThumbnailUpload(seriesThumbnailFile, editingSeriesData.id);
                  if (uploadedUrl) thumbnailUrl = uploadedUrl;
                }
                updateSeriesMutation.mutate({
                  id: editingSeriesData.id,
                  updates: { ...seriesFormData, thumbnailUrl },
                });
              }}
              disabled={!seriesFormData.title || updateSeriesMutation.isPending || uploadingSeriesThumbnail}
              className="bg-ministry-gold-exact text-black hover:bg-yellow-500"
              data-testid="button-update-series"
            >
              {uploadingSeriesThumbnail ? "Uploading..." : updateSeriesMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Series Studies Dialog */}
      <Dialog open={showManageSeriesStudiesDialog} onOpenChange={setShowManageSeriesStudiesDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Manage Studies in "{managingSeriesStudies?.title}"</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-6">
            <div>
              <h4 className="font-medium mb-3 text-gray-700">Studies in this Series</h4>
              {(() => {
                const seriesStudiesList = studies.filter(s => s.seriesId === managingSeriesStudies?.id);
                return seriesStudiesList.length === 0 ? (
                  <p className="text-gray-500 text-sm py-4 text-center bg-gray-50 rounded-lg">
                    No studies assigned to this series yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {seriesStudiesList.map((study, index) => (
                      <div key={study.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
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
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div>
              <h4 className="font-medium mb-3 text-gray-700">Available Individual Studies</h4>
              {unassignedStudies.length === 0 ? (
                <p className="text-gray-500 text-sm py-4 text-center bg-gray-50 rounded-lg">
                  All studies are already assigned to series.
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {unassignedStudies.map((study) => (
                    <div key={study.id} className="flex items-center justify-between p-3 bg-white border rounded-lg hover:border-ministry-gold-exact transition-colors">
                      <div>
                        <p className="font-medium text-gray-900">{study.title}</p>
                        <p className="text-xs text-gray-500">{study.category} • {study.requiredTier}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddStudyToSeries(study.id)}
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
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
            <Button onClick={() => setShowManageSeriesStudiesDialog(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                <Label htmlFor="edit-tier">Access Level</Label>
                <Select
                  value={formData.requiredTier}
                  onValueChange={(value) => setFormData({ ...formData, requiredTier: value })}
                >
                  <SelectTrigger data-testid="select-edit-tier">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free - Everyone</SelectItem>
                    <SelectItem value="premium">Subscribers Only</SelectItem>
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-difficulty">Difficulty</Label>
                <Select
                  value={formData.difficulty}
                  onValueChange={(value) => setFormData({ ...formData, difficulty: value })}
                >
                  <SelectTrigger data-testid="select-edit-difficulty">
                    <SelectValue placeholder="Select difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between border rounded-lg p-3 h-full">
                <Label>Published</Label>
                <Switch
                  checked={formData.isPublished}
                  onCheckedChange={(checked) => setFormData({ ...formData, isPublished: checked })}
                  data-testid="switch-edit-published"
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

            {/* Series Assignment */}
            <div className="rounded-lg border border-ministry-gold-exact/30 p-4 bg-yellow-50">
              <Label htmlFor="edit-series" className="text-sm font-medium text-gray-700">Study Series (Optional)</Label>
              <p className="text-xs text-gray-500 mb-2">Assign this study to a series or leave empty for individual study</p>
              <Select
                value={formData.seriesId || "none"}
                onValueChange={(value) => setFormData({ ...formData, seriesId: value === "none" ? "" : value })}
              >
                <SelectTrigger data-testid="select-edit-series">
                  <SelectValue placeholder="Select a series (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Series (Individual Study)</SelectItem>
                  {allSeries.map((series) => (
                    <SelectItem key={series.id} value={series.id}>
                      {series.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Purchase Options Section */}
            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4 bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
              <div className="space-y-0.5">
                <Label className="font-medium">Requires Purchase</Label>
                <p className="text-xs text-muted-foreground">Make this study available for purchase separately</p>
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
                          setFormData({ ...formData, purchaseRequiredTiers: ['free', 'premium'] });
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
                  {[{ id: 'free', label: 'Free Users' }, { id: 'premium', label: 'Subscribers' }].map((tier) => (
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
              {editingStudy && (editingStudy as any).thumbnailUrl ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded overflow-hidden bg-gray-100 dark:bg-gray-900 flex-shrink-0">
                        <img 
                          src={(editingStudy as any).thumbnailUrl} 
                          alt="Thumbnail" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="text-sm text-gray-700 dark:text-gray-300">Current Thumbnail</span>
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
                    Delete to upload a new image
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
                    Upload an image — shown as the study icon in the library
                  </p>
                  {thumbnailFile && (
                    <p className="text-xs text-green-600 dark:text-green-400">
                      Selected: {thumbnailFile.name} — will upload when you save
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

            {/* Publish Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div>
                <Label htmlFor="edit-published" className="font-medium">Publish Study</Label>
                <p className="text-xs text-muted-foreground">Published studies are visible in the library</p>
              </div>
              <Switch
                id="edit-published"
                checked={formData.isPublished}
                onCheckedChange={(checked) => {
                  setFormData({ ...formData, isPublished: checked });
                  if (checked) {
                    setScheduleForLater(false);
                    setFormData(prev => ({ ...prev, isPublished: checked, scheduledPublishDate: "" }));
                  }
                }}
                disabled={scheduleForLater}
                data-testid="switch-publish-study"
              />
            </div>

            {/* Schedule for Later */}
            <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
              <div>
                <Label htmlFor="edit-schedule" className="font-medium flex items-center gap-2">
                  <CalendarClock className="w-4 h-4" />
                  Schedule for Later
                </Label>
                <p className="text-xs text-muted-foreground">Automatically publish at a future date</p>
              </div>
              <Switch
                id="edit-schedule"
                checked={scheduleForLater}
                onCheckedChange={(checked) => {
                  setScheduleForLater(checked);
                  if (checked) {
                    setFormData(prev => ({ ...prev, isPublished: false }));
                  } else {
                    setFormData(prev => ({ ...prev, scheduledPublishDate: "" }));
                  }
                }}
                data-testid="switch-schedule-later"
              />
            </div>

            {/* Schedule Date Picker */}
            {scheduleForLater && (
              <div className="space-y-2">
                <Label htmlFor="edit-scheduled-date">Publish Date & Time</Label>
                <Input
                  id="edit-scheduled-date"
                  type="datetime-local"
                  min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                  value={formData.scheduledPublishDate}
                  onChange={(e) => setFormData({ ...formData, scheduledPublishDate: e.target.value })}
                  data-testid="input-scheduled-date"
                />
                <p className="text-xs text-muted-foreground">
                  Study will be automatically published at this date and time
                </p>
              </div>
            )}

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
                        ref={(el) => {
                          if (el && el.innerHTML !== lessonFormData.content) {
                            const selection = window.getSelection();
                            const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
                            const offset = range?.startOffset || 0;
                            const startContainer = range?.startContainer;
                            
                            el.innerHTML = lessonFormData.content;
                            
                            // Restore cursor position
                            if (startContainer && el.contains(startContainer)) {
                              try {
                                const newRange = document.createRange();
                                newRange.setStart(startContainer, Math.min(offset, startContainer.textContent?.length || 0));
                                newRange.collapse(true);
                                selection?.removeAllRanges();
                                selection?.addRange(newRange);
                              } catch (e) {
                                // Cursor restoration failed, that's ok
                              }
                            }
                          }
                        }}
                        contentEditable
                        suppressContentEditableWarning
                        className="min-h-[150px] p-3 focus:outline-none"
                        onInput={(e) => {
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
          setWordImportFile(null);
          setBulkImportMode("text");
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Bulk Import Lessons — {managingLessonsStudy?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Mode Toggle */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => { setBulkImportMode("text"); setParsedLessons([]); }}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${bulkImportMode === "text" ? "bg-ministry-gold text-ministry-charcoal" : "bg-white text-muted-foreground hover:bg-gray-50"}`}
              >
                Paste Text
              </button>
              <button
                onClick={() => { setBulkImportMode("word"); setParsedLessons([]); }}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${bulkImportMode === "word" ? "bg-ministry-gold text-ministry-charcoal" : "bg-white text-muted-foreground hover:bg-gray-50"}`}
              >
                Upload Word Doc
              </button>
            </div>

            {bulkImportMode === "text" ? (
              <>
                {/* Instructions */}
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h4 className="font-semibold text-sm mb-2">Formatting Instructions</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Paste your study content below. Start each lesson with a day heading:
                  </p>
                  <div className="text-xs font-mono bg-white dark:bg-gray-900 p-3 rounded border border-blue-100 dark:border-blue-800 space-y-1">
                    <div className="font-semibold text-blue-700 dark:text-blue-300">Day 1: Foundation of Biblical Manhood</div>
                    <div className="text-gray-500">Scripture: Genesis 2:15-18</div>
                    <div>Content goes here. Write as much as you need.</div>
                    <div className="text-gray-500">Key Takeaway: God created man with purpose</div>
                    <div className="mt-2 font-semibold text-blue-700 dark:text-blue-300">Day 2: Leadership in the Home</div>
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
                      setParsedLessons([]);
                    }}
                    placeholder="Paste your study content here..."
                    rows={12}
                    className="font-mono text-sm"
                    data-testid="textarea-bulk-import"
                  />
                </div>

                <Button
                  onClick={() => parseBulkContent(bulkImportText)}
                  disabled={!bulkImportText.trim()}
                  className="w-full bg-ministry-gold hover:bg-ministry-gold/90 text-ministry-charcoal"
                  data-testid="button-parse-content"
                >
                  Parse Content into Lessons
                </Button>
              </>
            ) : (
              <>
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h4 className="font-semibold text-sm mb-1">Upload a Word Document (.docx)</h4>
                  <p className="text-sm text-muted-foreground">
                    Format your Word doc with headings like <strong>Day 1: Lesson Title</strong> at the start of each lesson, followed by the content. Optional labels <strong>Scripture:</strong> and <strong>Key Takeaway:</strong> are supported.
                  </p>
                </div>

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    accept=".docx"
                    id="word-import-input"
                    className="hidden"
                    onChange={(e) => {
                      setWordImportFile(e.target.files?.[0] || null);
                      setParsedLessons([]);
                    }}
                  />
                  <label htmlFor="word-import-input" className="cursor-pointer">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                      <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                      </svg>
                    </div>
                    {wordImportFile ? (
                      <p className="text-sm font-medium text-green-700">{wordImportFile.name}</p>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-gray-700">Click to choose a .docx file</p>
                        <p className="text-xs text-muted-foreground mt-1">Only .docx files are supported</p>
                      </>
                    )}
                  </label>
                </div>

                <Button
                  onClick={handleWordFileParse}
                  disabled={!wordImportFile || isParsingWord}
                  className="w-full bg-ministry-gold hover:bg-ministry-gold/90 text-ministry-charcoal"
                  data-testid="button-parse-word"
                >
                  {isParsingWord ? "Parsing..." : "Parse Word Document"}
                </Button>
              </>
            )}

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