import { useState, useCallback, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"; 
import { Plus, Upload, FileText, Book, Layers, Video, Image, Trash2, Edit, Eye, Check, Loader2, ChevronDown, ChevronUp, X, CalendarClock } from "lucide-react";
import { format } from "date-fns";

interface Study {
  id: string;
  title: string;
  description: string;
  category: string;
  requiredTier: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  totalDays?: number;
  seriesId?: string | null;
  seriesOrder?: number | null;
  isPublished?: boolean;
  requiresPurchase?: boolean;
  price?: string;
  difficulty?: string;
  duration?: number;
  wordOriginalName?: string | null;
  wordFilename?: string | null;
}

interface StudySeries {
  id: string;
  title: string;
  description: string;
  category: string;
  thumbnailUrl?: string;
  displayOrder?: number;
  studyCount?: number;
  requiredTier?: string;
  isPublished?: boolean;
  requiresConsecutiveCompletion?: boolean;
}

interface ParsedLesson {
  dayNumber: number;
  title: string;
  content: string;
  scripture?: string;
  keyTakeaway?: string;
}

const categories = [
  { id: 'leadership', label: 'Leadership' },
  { id: 'marriage', label: 'Marriage' },
  { id: 'fatherhood', label: 'Fatherhood' },
  { id: 'character', label: 'Character' },
  { id: 'faith', label: 'Faith' },
  { id: 'discipleship', label: 'Discipleship' },
  { id: 'holy-spirit', label: 'Holy Spirit' },
];

const tiers = [
  { id: 'free', label: 'Free - Everyone' },
  { id: 'premium', label: 'Subscribers Only' },
];

export default function StudyBuilder() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [contentType, setContentType] = useState<"study" | "series">("study");
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    requiredTier: "free",
    thumbnailUrl: "",
    videoUrl: "",
    seriesId: "",
    seriesOrder: 1,
    requiresPurchase: false,
    price: "",
    isPublished: true,
    scheduledPublishDate: "",
  });
  
  const [scheduleForLater, setScheduleForLater] = useState(false);
  
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [wordFile, setWordFile] = useState<File | null>(null);
  const [parsedLessons, setParsedLessons] = useState<ParsedLesson[]>([]);
  const [parsingWord, setParsingWord] = useState(false);
  const [wordUploadFailed, setWordUploadFailed] = useState(false); // Track failed uploads
  const [uploading, setUploading] = useState(false);
  
  const [editingStudy, setEditingStudy] = useState<Study | null>(null);
  const [editingSeries, setEditingSeries] = useState<StudySeries | null>(null);
  const [expandedStudy, setExpandedStudy] = useState<string | null>(null);

  const { data: studies = [], isLoading: studiesLoading } = useQuery<Study[]>({
    queryKey: ["/api/studies"],
  });

  const { data: seriesList = [], isLoading: seriesLoading } = useQuery<StudySeries[]>({
    queryKey: ["/api/admin/study-series"],
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      category: "",
      requiredTier: "free",
      thumbnailUrl: "",
      videoUrl: "",
      seriesId: "",
      seriesOrder: 1,
      requiresPurchase: false,
      price: "",
      isPublished: true,
      scheduledPublishDate: "",
    });
    setScheduleForLater(false);
    setThumbnailFile(null);
    setVideoFile(null);
    setWordFile(null);
    setParsedLessons([]);
    setWordUploadFailed(false);
  };

  const handleWordFileChange = async (file: File | null) => {
    setWordFile(file);
    setParsedLessons([]);
    setWordUploadFailed(false); // Clear failed state when new file selected
    
    if (!file) return;
    
    setParsingWord(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('word', file);
      
      const response = await fetch('/api/parse-word-lessons', {
        method: 'POST',
        body: formDataUpload,
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setParsedLessons(data.lessons || []);
        if (data.lessons?.length > 0) {
          toast({
            title: "Document Parsed",
            description: `Found ${data.lessons.length} daily lessons with formatting preserved`,
          });
        } else {
          toast({
            title: "No Lessons Found",
            description: "Make sure each day starts with 'Day 1:', 'Day 2:', etc.",
            variant: "destructive",
          });
        }
      } else {
        // Handle parse errors (like wrong file format)
        const errorData = await response.json().catch(() => ({}));
        toast({
          title: "Document Format Error",
          description: errorData.message || "Only .docx files are supported. Please save your document as .docx format and try again.",
          variant: "destructive",
        });
        setWordFile(null); // Clear the file so user can try again
        setWordUploadFailed(true); // Mark that upload failed
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to parse Word document. Please ensure it's a .docx file.",
        variant: "destructive",
      });
      setWordFile(null);
      setWordUploadFailed(true); // Mark that upload failed
    } finally {
      setParsingWord(false);
    }
  };

  const createStudyMutation = useMutation({
    mutationFn: async (data: typeof formData & { lessons?: ParsedLesson[] }) => {
      const study = await apiRequest('POST', '/api/studies', {
        ...data,
        seriesId: data.seriesId || null,
        price: data.requiresPurchase && data.price ? data.price : null,
        scheduledPublishDate: data.scheduledPublishDate 
          ? new Date(data.scheduledPublishDate).toISOString() 
          : null,
      });
      return study;
    },
    onSuccess: async (study) => {
      setUploading(true);
      try {
        if (thumbnailFile) {
          const formDataUpload = new FormData();
          formDataUpload.append('thumbnail', thumbnailFile);
          const thumbRes = await fetch(`/api/studies/${study.id}/upload-thumbnail`, {
            method: 'POST',
            body: formDataUpload,
            credentials: 'include',
          });
          if (!thumbRes.ok) {
            toast({
              title: "Thumbnail Upload Failed",
              description: "Study was created but the thumbnail could not be saved. You can add it later via Edit.",
              variant: "destructive",
            });
          }
        }
        
        if (videoFile) {
          const formDataUpload = new FormData();
          formDataUpload.append('video', videoFile);
          const vidRes = await fetch(`/api/studies/${study.id}/upload-video`, {
            method: 'POST',
            body: formDataUpload,
            credentials: 'include',
          });
          if (!vidRes.ok) {
            toast({
              title: "Video Upload Failed",
              description: "Study was created but the video could not be saved. You can add it later via Edit.",
              variant: "destructive",
            });
          }
        }
        
        if (parsedLessons.length > 0) {
          for (const lesson of parsedLessons) {
            await apiRequest('POST', `/api/studies/${study.id}/lessons`, {
              ...lesson,
              displayOrder: lesson.dayNumber,
              estimatedMinutes: 15,
            });
          }
        }
        
        toast({
          title: "Success",
          description: `Study created${parsedLessons.length > 0 ? ` with ${parsedLessons.length} lessons` : ''}!`,
        });
      } catch (error) {
        toast({
          title: "Warning",
          description: "Study created but some files failed to upload",
          variant: "destructive",
        });
      } finally {
        setUploading(false);
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/studies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/study-series"] });
      resetForm();
      setShowCreateForm(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create study",
        variant: "destructive",
      });
    },
  });

  const createSeriesMutation = useMutation({
    mutationFn: async (data: typeof formData & { lessons?: ParsedLesson[] }) => {
      return await apiRequest('POST', '/api/admin/study-series', data);
    },
    onSuccess: async (series) => {
      setUploading(true);
      try {
        if (thumbnailFile) {
          const formDataUpload = new FormData();
          formDataUpload.append('thumbnail', thumbnailFile);
          const thumbRes = await fetch(`/api/study-series/${series.id}/upload-thumbnail`, {
            method: 'POST',
            body: formDataUpload,
            credentials: 'include',
          });
          if (!thumbRes.ok) {
            toast({ title: 'Thumbnail upload failed', description: 'Series was created but the thumbnail could not be saved. Upload it via Edit.', variant: 'destructive' });
          }
        }
        
        // If lessons were parsed from Word document, create a study with those lessons
        if (parsedLessons.length > 0) {
          // Create a study within this series with the same title
          const study = await apiRequest('POST', '/api/studies', {
            title: formData.title,
            description: formData.description,
            category: formData.category,
            requiredTier: formData.requiredTier,
            seriesId: series.id,
            seriesOrder: 1,
            isPublished: formData.isPublished,
          });
          
          // Add lessons to the study
          for (const lesson of parsedLessons) {
            await apiRequest('POST', `/api/studies/${study.id}/lessons`, {
              ...lesson,
              displayOrder: lesson.dayNumber,
              estimatedMinutes: 15,
            });
          }
        }
        
        toast({
          title: "Success",
          description: parsedLessons.length > 0 
            ? `Series created with study and ${parsedLessons.length} lessons!`
            : "Series created successfully!",
        });
      } catch (error) {
        toast({
          title: "Warning",
          description: "Series created but some content failed to add",
          variant: "destructive",
        });
      } finally {
        setUploading(false);
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/admin/study-series"] });
      queryClient.invalidateQueries({ queryKey: ["/api/study-series"] });
      queryClient.invalidateQueries({ queryKey: ["/api/studies"] });
      resetForm();
      setShowCreateForm(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create series",
        variant: "destructive",
      });
    },
  });

  const deleteStudyMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/studies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/studies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/progress"] });
      queryClient.invalidateQueries({ queryKey: ["/api/study-series"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/study-series"] });
      toast({ title: "Study deleted" });
    },
  });

  const deleteSeriesMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/admin/study-series/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/study-series"] });
      queryClient.invalidateQueries({ queryKey: ["/api/study-series"] });
      toast({ title: "Series deleted" });
    },
  });

  const togglePublishMutation = useMutation({
    mutationFn: async ({ id, isPublished }: { id: string; isPublished: boolean }) => {
      return await apiRequest('PATCH', `/api/studies/${id}`, { isPublished });
    },
    onSuccess: (_, { isPublished }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/studies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/study-series"] });
      toast({ title: isPublished ? "Study published" : "Study unpublished" });
    },
  });

  const handleSubmit = () => {
    if (!formData.title || !formData.description || !formData.category) {
      toast({
        title: "Validation Error",
        description: "Please fill in title, description, and category",
        variant: "destructive",
      });
      return;
    }
    
    if (contentType === "study") {
      // If a Word file was selected but no lessons were parsed, block submission
      if (wordFile && parsedLessons.length === 0) {
        toast({
          title: "Word Document Error",
          description: "The Word document could not be parsed. Please make sure it's a .docx file (not .doc).",
          variant: "destructive",
        });
        return;
      }
      // If a Word upload was attempted but failed, block submission
      if (wordUploadFailed) {
        toast({
          title: "Word Upload Failed",
          description: "Please upload a valid .docx file before creating the study.",
          variant: "destructive",
        });
        return;
      }
      createStudyMutation.mutate({ ...formData, lessons: parsedLessons });
    } else {
      createSeriesMutation.mutate(formData);
    }
  };

  const isLoading = createStudyMutation.isPending || createSeriesMutation.isPending || uploading;

  const cancelEdit = () => {
    setEditingStudy(null);
    setEditingSeries(null);
  };

  return (
    <div className="space-y-6">
      {/* Inline edit panel — shown instead of list when editing */}
      {(editingStudy || editingSeries) && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={cancelEdit} className="flex items-center gap-1 px-2">
                <X className="w-4 h-4" /> Back to list
              </Button>
              <CardTitle className="text-base flex items-center gap-2">
                {editingStudy ? <Book className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
                Editing: {editingStudy?.title ?? editingSeries?.title}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {editingStudy && (
              <EditStudyForm
                study={editingStudy}
                seriesList={seriesList}
                onSave={async (data) => {
                  await apiRequest('PATCH', `/api/studies/${editingStudy.id}`, data);
                  queryClient.invalidateQueries({ queryKey: ["/api/studies"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/admin/study-series"] });
                  toast({ title: "Study updated" });
                  setEditingStudy(null);
                }}
                onCancel={cancelEdit}
              />
            )}
            {editingSeries && (
              <EditSeriesForm
                series={editingSeries}
                onSave={async (data) => {
                  await apiRequest('PATCH', `/api/admin/study-series/${editingSeries.id}`, data);
                  queryClient.invalidateQueries({ queryKey: ["/api/admin/study-series"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/study-series"] });
                  toast({ title: "Series updated" });
                  setEditingSeries(null);
                }}
                onCancel={cancelEdit}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Create / list view — hidden while editing */}
      {!editingStudy && !editingSeries && (
        <>
      <Button
        onClick={() => { setShowCreateForm(!showCreateForm); if (showCreateForm) resetForm(); }}
        variant={showCreateForm ? "outline" : "default"}
        className="w-full"
        data-testid="btn-toggle-create"
      >
        {showCreateForm ? (
          <><X className="w-4 h-4 mr-2" />Cancel</>
        ) : (
          <><Plus className="w-4 h-4 mr-2" />New Study / Series</>
        )}
      </Button>

      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {contentType === "study" ? <Book className="w-5 h-5" /> : <Layers className="w-5 h-5" />}
              Create {contentType === "study" ? "Study" : "Series"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
              <div className="flex gap-2 mb-4">
                <Button
                  type="button"
                  variant={contentType === "study" ? "default" : "outline"}
                  onClick={() => setContentType("study")}
                  data-testid="btn-type-study"
                >
                  <Book className="w-4 h-4 mr-2" />
                  Individual Study
                </Button>
                <Button
                  type="button"
                  variant={contentType === "series" ? "default" : "outline"}
                  onClick={() => setContentType("series")}
                  data-testid="btn-type-series"
                >
                  <Layers className="w-4 h-4 mr-2" />
                  Study Series
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  placeholder={contentType === "study" ? "Study title" : "Series title"}
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  data-testid="input-title"
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="Brief description..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="min-h-[100px]"
                  data-testid="input-description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(v) => setFormData({ ...formData, category: v })}
                  >
                    <SelectTrigger data-testid="select-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Access Tier</Label>
                  <Select
                    value={formData.requiredTier}
                    onValueChange={(v) => setFormData({ ...formData, requiredTier: v })}
                  >
                    <SelectTrigger data-testid="select-tier">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {tiers.map((tier) => (
                        <SelectItem key={tier.id} value={tier.id}>{tier.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {contentType === "study" && seriesList.length > 0 && (
                <div className="space-y-2">
                  <Label>Add to Series (optional)</Label>
                  <Select
                    value={formData.seriesId || "_none"}
                    onValueChange={(v) => setFormData({ ...formData, seriesId: v === "_none" ? "" : v })}
                  >
                    <SelectTrigger data-testid="select-series">
                      <SelectValue placeholder="None (standalone study)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">None (standalone study)</SelectItem>
                      {seriesList.map((series) => (
                        <SelectItem key={series.id} value={series.id}>{series.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {contentType === "study" && formData.seriesId && (
                <div className="space-y-2">
                  <Label>Study Number in Series</Label>
                  <p className="text-xs text-gray-500">The position of this study in the series (1 = first, 2 = second, etc.)</p>
                  <Input
                    type="number"
                    min={1}
                    value={formData.seriesOrder}
                    onChange={(e) => setFormData({ ...formData, seriesOrder: parseInt(e.target.value) || 1 })}
                    placeholder="e.g. 1"
                    data-testid="input-series-order"
                  />
                </div>
              )}

              <div className="border rounded-lg p-4 space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Image className="w-4 h-4" />
                  Thumbnail
                </h4>
                <div className="space-y-2">
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-3">
                    <input
                      type="file"
                      accept="image/*"
                      className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-yellow-400 file:text-black hover:file:bg-yellow-500 cursor-pointer"
                      onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
                      data-testid="input-thumbnail-file"
                    />
                    <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF — optional, shown in the library</p>
                  </div>
                  {thumbnailFile && (
                    <p className="text-xs text-green-600 dark:text-green-400">✓ {thumbnailFile.name}</p>
                  )}
                </div>
              </div>

              {contentType === "series" && (
                <div className="border rounded-lg p-4 space-y-4 bg-blue-50 dark:bg-blue-950/30">
                  <h4 className="font-medium flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Bulk Import Studies from Word
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Upload a Word document with daily lessons. Format each day as "Day 1: Title" etc.
                    Bold, italic, and paragraph formatting will be preserved. Studies will be created and added to this series.
                  </p>
                  <Input
                    type="file"
                    accept=".docx,.doc"
                    onChange={(e) => handleWordFileChange(e.target.files?.[0] || null)}
                    data-testid="input-word-file-series"
                  />
                  
                  {parsingWord && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Parsing document...
                    </div>
                  )}
                  
                  {parsedLessons.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-green-600">
                        <Check className="w-4 h-4" />
                        Found {parsedLessons.length} lessons
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1 border rounded p-2">
                        {parsedLessons.map((lesson, idx) => (
                          <div key={idx} className="text-sm flex items-center gap-2">
                            <Badge variant="outline">Day {lesson.dayNumber}</Badge>
                            <span className="truncate">{lesson.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {contentType === "study" && (
                <>
                  <div className="border rounded-lg p-4 space-y-4 bg-blue-50 dark:bg-blue-950/30">
                    <h4 className="font-medium flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Import Lessons from Word (optional)
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Upload a Word document with daily lessons. Format each day as "Day 1: Title" etc.
                      Bold, italic, and paragraph formatting will be preserved.
                    </p>
                    <Input
                      type="file"
                      accept=".docx,.doc"
                      onChange={(e) => handleWordFileChange(e.target.files?.[0] || null)}
                      data-testid="input-word-file-study"
                    />
                    
                    {parsingWord && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Parsing document...
                      </div>
                    )}
                    
                    {parsedLessons.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-green-600">
                          <Check className="w-4 h-4" />
                          Found {parsedLessons.length} lessons
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-1 border rounded p-2">
                          {parsedLessons.map((lesson, idx) => (
                            <div key={idx} className="text-sm flex items-center gap-2">
                              <Badge variant="outline">Day {lesson.dayNumber}</Badge>
                              <span className="truncate">{lesson.title}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border rounded-lg p-4 space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <Video className="w-4 h-4" />
                      Video (optional)
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Upload Video</Label>
                        <Input
                          type="file"
                          accept="video/*"
                          onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                          data-testid="input-video-file"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Or Video URL</Label>
                        <Input
                          placeholder="https://..."
                          value={formData.videoUrl}
                          onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                          data-testid="input-video-url"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Publishing Options Section */}
                  <div className="border-2 border-ministry-gold rounded-lg p-4 space-y-4 bg-ministry-gold/10">
                    <h4 className="font-semibold text-ministry-charcoal flex items-center gap-2">
                      <CalendarClock className="w-5 h-5" />
                      Publishing Options
                    </h4>
                    
                    <div className="flex items-center justify-between border rounded-lg p-3 bg-white dark:bg-gray-900">
                      <div>
                        <Label>Publish Now</Label>
                        <p className="text-sm text-muted-foreground">Make this study visible immediately</p>
                      </div>
                      <Switch
                        checked={formData.isPublished}
                        onCheckedChange={(v) => {
                          setFormData({ ...formData, isPublished: v });
                          if (v) {
                            setScheduleForLater(false);
                            setFormData(prev => ({ ...prev, isPublished: v, scheduledPublishDate: "" }));
                          }
                        }}
                        disabled={scheduleForLater}
                        data-testid="switch-is-published"
                      />
                    </div>

                    <div className="flex items-center justify-between border rounded-lg p-3 bg-white dark:bg-gray-900">
                      <div>
                        <Label className="flex items-center gap-2">
                          Schedule for Later
                        </Label>
                        <p className="text-sm text-muted-foreground">Automatically publish at a future date</p>
                      </div>
                      <Switch
                        checked={scheduleForLater}
                        onCheckedChange={(v) => {
                          setScheduleForLater(v);
                          if (v) {
                            setFormData(prev => ({ ...prev, isPublished: false }));
                          } else {
                            setFormData(prev => ({ ...prev, scheduledPublishDate: "" }));
                          }
                        }}
                        data-testid="switch-schedule-later"
                      />
                    </div>

                    {scheduleForLater && (
                      <div className="space-y-2 border rounded-lg p-3 bg-white dark:bg-gray-900">
                        <Label>Publish Date & Time</Label>
                        <Input
                          type="datetime-local"
                          min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                          value={formData.scheduledPublishDate}
                          onChange={(e) => setFormData({ ...formData, scheduledPublishDate: e.target.value })}
                          data-testid="input-scheduled-date"
                        />
                        <p className="text-xs text-muted-foreground">
                          Study will automatically become visible at this date and time
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between border rounded-lg p-4">
                    <div>
                      <Label>Requires Purchase</Label>
                      <p className="text-sm text-muted-foreground">Make this a paid study</p>
                    </div>
                    <Switch
                      checked={formData.requiresPurchase}
                      onCheckedChange={(v) => setFormData({ ...formData, requiresPurchase: v })}
                      data-testid="switch-requires-purchase"
                    />
                  </div>

                  {formData.requiresPurchase && (
                    <div className="space-y-2">
                      <Label>Price ($)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="9.99"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        data-testid="input-price"
                      />
                    </div>
                  )}
                </>
              )}

              <Button
                onClick={handleSubmit}
                disabled={isLoading}
                className="w-full"
                data-testid="btn-submit"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Create {contentType === "study" ? "Study" : "Series"}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
      )}

      <Tabs defaultValue="studies">
            <TabsList className="w-full">
              <TabsTrigger value="studies" className="flex-1">
                <Book className="w-4 h-4 mr-2" />
                Individual Studies ({studies.filter(s => !s.seriesId).length})
              </TabsTrigger>
              <TabsTrigger value="series" className="flex-1">
                <Layers className="w-4 h-4 mr-2" />
                Series ({seriesList.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="studies" className="space-y-2">
              {studiesLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : studies.filter(s => !s.seriesId).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No individual studies yet. Studies in a series are shown under the Series tab.</div>
              ) : (
                studies.filter(s => !s.seriesId).map((study) => (
                  <Card key={study.id} className={!study.isPublished ? "opacity-60" : ""}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {study.thumbnailUrl ? (
                            <img src={study.thumbnailUrl} alt="" className="w-12 h-12 rounded object-cover" />
                          ) : (
                            <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                              <Book className="w-6 h-6 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <h4 className="font-medium flex items-center gap-2">
                              {study.title}
                              {!study.isPublished && (
                                <Badge variant="outline" className="text-orange-600 border-orange-300">Draft</Badge>
                              )}
                            </h4>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Badge variant="outline">{study.category}</Badge>
                              <Badge variant={study.requiredTier === 'free' ? 'secondary' : 'default'}>
                                {study.requiredTier}
                              </Badge>
                              {study.totalDays && (
                                <span>{study.totalDays} days</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant={study.isPublished ? "outline" : "default"}
                            size="sm"
                            onClick={() => togglePublishMutation.mutate({ id: study.id, isPublished: !study.isPublished })}
                            disabled={togglePublishMutation.isPending}
                            data-testid={`btn-toggle-publish-${study.id}`}
                          >
                            {study.isPublished ? (
                              <>
                                <Eye className="w-4 h-4 mr-1" />
                                Published
                              </>
                            ) : (
                              <>
                                <Check className="w-4 h-4 mr-1" />
                                Publish
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              setEditingStudy(study);
                              setShowCreateForm(false);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            data-testid={`btn-edit-study-${study.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="text-destructive"
                            onClick={() => {
                              if (confirm("Delete this study?")) {
                                deleteStudyMutation.mutate(study.id);
                              }
                            }}
                            data-testid={`btn-delete-study-${study.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="series" className="space-y-2">
              {seriesLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : seriesList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No series yet</div>
              ) : (
                seriesList.map((series) => (
                  <Card key={series.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {series.thumbnailUrl ? (
                            <img src={series.thumbnailUrl} alt="" className="w-12 h-12 rounded object-cover" />
                          ) : (
                            <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                              <Layers className="w-6 h-6 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <h4 className="font-medium">{series.title}</h4>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Badge variant="outline">{series.category}</Badge>
                              {series.studyCount !== undefined && (
                                <span>{series.studyCount} studies</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              setEditingSeries(series);
                              setShowCreateForm(false);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            data-testid={`btn-edit-series-${series.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="text-destructive"
                            onClick={() => {
                              if (confirm("Delete this series? Studies will become standalone.")) {
                                deleteSeriesMutation.mutate(series.id);
                              }
                            }}
                            data-testid={`btn-delete-series-${series.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
      </Tabs>
        </>
      )}
    </div>
  );
}

function EditStudyForm({ study, seriesList, onSave, onCancel }: {
  study: Study;
  seriesList: StudySeries[];
  onSave: (data: Partial<Study>) => Promise<void>;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [formData, setFormData] = useState({
    title: study.title,
    description: study.description,
    category: study.category,
    requiredTier: study.requiredTier || 'free',
    difficulty: study.difficulty || 'beginner',
    duration: study.duration || 0,
    thumbnailUrl: study.thumbnailUrl || '',
    videoUrl: study.videoUrl || '',
    seriesId: study.seriesId || '',
    seriesOrder: study.seriesOrder || 1,
    isPublished: study.isPublished ?? false,
    requiresPurchase: study.requiresPurchase ?? false,
    price: study.price || '',
  });
  const [saving, setSaving] = useState(false);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [wordReimportFile, setWordReimportFile] = useState<File | null>(null);
  const [parsedLessons, setParsedLessons] = useState<Array<{ dayNumber: number; title: string; content: string; scripture?: string; keyTakeaway?: string }>>([]);
  const [parsing, setParsing] = useState(false);
  const [reimporting, setReimporting] = useState(false);

  const parseWordDocForReimport = async () => {
    if (!wordReimportFile) return;
    setParsing(true);
    setParsedLessons([]);
    try {
      const fd = new FormData();
      fd.append('word', wordReimportFile);
      const res = await fetch('/api/parse-word-lessons', { method: 'POST', body: fd, credentials: 'include' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Parse failed');
      }
      const data = await res.json();
      const lessons = data.lessons || [];
      if (lessons.length === 0) {
        toast({ title: 'No lessons found', description: 'The document did not contain any recognizable Day/Lesson markers. Check that each lesson starts with "Day N:", "Lesson N:", "Week N:", or "Session N:".', variant: 'destructive' });
      } else {
        setParsedLessons(lessons);
        toast({ title: `Found ${lessons.length} lesson${lessons.length === 1 ? '' : 's'}`, description: 'Review the list below, then click "Replace All Lessons" to apply.' });
      }
    } catch (e: any) {
      toast({ title: 'Parse error', description: e.message, variant: 'destructive' });
    } finally {
      setParsing(false);
    }
  };

  const reimportLessons = async () => {
    if (!wordReimportFile || parsedLessons.length === 0) return;
    if (!confirm(`This will DELETE all existing lessons for this study and replace them with ${parsedLessons.length} lessons from the new document. This cannot be undone. Continue?`)) return;
    setReimporting(true);
    try {
      const clearRes = await fetch(`/api/studies/${study.id}/lessons`, { method: 'DELETE', credentials: 'include' });
      if (!clearRes.ok) throw new Error('Failed to clear existing lessons');

      const wordFd = new FormData();
      wordFd.append('word', wordReimportFile);
      const wordRes = await fetch(`/api/studies/${study.id}/upload-word`, { method: 'POST', body: wordFd, credentials: 'include' });
      if (!wordRes.ok) throw new Error('Failed to save document reference');

      for (let i = 0; i < parsedLessons.length; i++) {
        const lesson = parsedLessons[i];
        const lessonRes = await fetch(`/api/studies/${study.id}/lessons`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            dayNumber: lesson.dayNumber,
            title: lesson.title,
            content: lesson.content,
            scripture: lesson.scripture || '',
            keyTakeaway: lesson.keyTakeaway || '',
            displayOrder: i + 1,
            estimatedMinutes: 15,
            rationReward: 25,
          }),
        });
        if (!lessonRes.ok) throw new Error(`Failed to create lesson ${lesson.dayNumber}`);
      }

      qc.invalidateQueries({ queryKey: ['/api/studies'] });
      qc.invalidateQueries({ queryKey: ['/api/admin/studies'] });
      setWordReimportFile(null);
      setParsedLessons([]);
      toast({ title: `${parsedLessons.length} lessons imported`, description: 'All lessons have been replaced successfully.' });
    } catch (e: any) {
      toast({ title: 'Import failed', description: e.message, variant: 'destructive' });
    } finally {
      setReimporting(false);
    }
  };

  const uploadStudyThumbnail = async (file: File) => {
    setUploadingThumb(true);
    try {
      const fd = new FormData();
      fd.append('thumbnail', file);
      const res = await fetch(`/api/studies/${study.id}/upload-thumbnail`, { method: 'POST', body: fd, credentials: 'include' });
      if (!res.ok) throw new Error('Upload failed');
      const updated = await res.json();
      setFormData(prev => ({ ...prev, thumbnailUrl: updated.thumbnailUrl || '' }));
      setThumbFile(null);
      qc.invalidateQueries({ queryKey: ['/api/studies'] });
      toast({ title: 'Thumbnail uploaded' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setUploadingThumb(false);
    }
  };

  const deleteStudyThumbnail = async () => {
    if (!confirm('Remove thumbnail?')) return;
    try {
      const res = await fetch(`/api/studies/${study.id}/delete-thumbnail`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Delete failed');
      setFormData(prev => ({ ...prev, thumbnailUrl: '' }));
      qc.invalidateQueries({ queryKey: ['/api/studies'] });
      toast({ title: 'Thumbnail removed' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await onSave({
        ...formData,
        seriesId: formData.seriesId || undefined,
        difficulty: formData.difficulty,
        duration: formData.duration,
        price: formData.requiresPurchase && formData.price ? formData.price : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Title</Label>
        <Input
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Access Tier</Label>
          <Select value={formData.requiredTier} onValueChange={(v) => setFormData({ ...formData, requiredTier: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {tiers.map((tier) => (
                <SelectItem key={tier.id} value={tier.id}>{tier.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Difficulty</Label>
          <Select value={formData.difficulty} onValueChange={(v) => setFormData({ ...formData, difficulty: v })}>
            <SelectTrigger><SelectValue placeholder="Select difficulty" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="beginner">Beginner</SelectItem>
              <SelectItem value="intermediate">Intermediate</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Duration (minutes)</Label>
          <Input
            type="number"
            value={formData.duration}
            onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 0 })}
            placeholder="Duration in minutes"
          />
        </div>
      </div>
      {seriesList.length > 0 && (
        <div className="space-y-2">
          <Label>Series</Label>
          <Select 
            value={formData.seriesId || "_none"} 
            onValueChange={(v) => setFormData({ ...formData, seriesId: v === "_none" ? "" : v })}
          >
            <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">None (standalone)</SelectItem>
              {seriesList.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {formData.seriesId && (
        <div className="space-y-2">
          <Label>Study Number in Series</Label>
          <p className="text-xs text-gray-500">The position of this study in the series (1 = first, 2 = second, etc.)</p>
          <Input
            type="number"
            min={1}
            value={formData.seriesOrder}
            onChange={(e) => setFormData({ ...formData, seriesOrder: parseInt(e.target.value) || 1 })}
            placeholder="e.g. 2"
          />
        </div>
      )}
      <div className="space-y-2">
        <Label>Thumbnail Image</Label>
        {formData.thumbnailUrl ? (
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
            <div className="flex items-center gap-3">
              <img src={formData.thumbnailUrl} alt="Thumbnail" className="w-14 h-14 rounded object-cover border" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Current thumbnail</span>
            </div>
            <Button size="sm" variant="destructive" type="button" onClick={deleteStudyThumbnail}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-3">
              <input
                type="file"
                accept="image/*"
                className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-yellow-400 file:text-black hover:file:bg-yellow-500 cursor-pointer"
                onChange={(e) => setThumbFile(e.target.files?.[0] || null)}
              />
              <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF — shown as the study icon in the library</p>
            </div>
            {thumbFile && (
              <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                <span className="text-xs text-green-700 dark:text-green-300 truncate flex-1 mr-2">✓ {thumbFile.name}</span>
                <Button size="sm" type="button" disabled={uploadingThumb} onClick={() => uploadStudyThumbnail(thumbFile)} className="bg-yellow-400 text-black hover:bg-yellow-500 flex-shrink-0">
                  {uploadingThumb ? 'Uploading…' : 'Upload Now'}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="space-y-2">
        <Label>Video URL</Label>
        <Input
          value={formData.videoUrl}
          onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
          placeholder="https://..."
        />
      </div>
      <div className="flex items-center justify-between border rounded-lg p-3">
        <Label>Published</Label>
        <Switch
          checked={formData.isPublished}
          onCheckedChange={(v) => setFormData({ ...formData, isPublished: v })}
        />
      </div>
      <div className="flex items-center justify-between border rounded-lg p-3">
        <Label>Requires Purchase</Label>
        <Switch
          checked={formData.requiresPurchase}
          onCheckedChange={(v) => setFormData({ ...formData, requiresPurchase: v })}
        />
      </div>
      {formData.requiresPurchase && (
        <div className="space-y-2">
          <Label>Price ($)</Label>
          <Input
            type="number"
            step="0.01"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
          />
        </div>
      )}
      <div className="space-y-3 border-t pt-4">
        <Label className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="w-4 h-4" /> Lesson Import (Word Document)
        </Label>
        {study.wordOriginalName && (
          <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200 truncate">{study.wordOriginalName}</p>
              <p className="text-xs text-blue-600 dark:text-blue-400">{study.totalDays || 0} lesson{(study.totalDays || 0) !== 1 ? 's' : ''} currently imported</p>
            </div>
          </div>
        )}
        {!study.wordOriginalName && (
          <p className="text-xs text-gray-500 dark:text-gray-400">No Word document attached. Upload a .docx file below to import or re-import lessons.</p>
        )}
        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-3">
          <input
            type="file"
            accept=".docx"
            className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-yellow-400 file:text-black hover:file:bg-yellow-500 cursor-pointer"
            onChange={(e) => { setWordReimportFile(e.target.files?.[0] || null); setParsedLessons([]); }}
          />
          <p className="text-xs text-gray-500 mt-1">Only .docx files — lessons must start with "Day N:", "Lesson N:", "Week N:", or "Session N:"</p>
        </div>
        {wordReimportFile && (
          <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <span className="text-xs text-yellow-800 dark:text-yellow-200 truncate flex-1">{wordReimportFile.name}</span>
            <Button size="sm" type="button" disabled={parsing} onClick={parseWordDocForReimport} className="bg-yellow-400 text-black hover:bg-yellow-500 flex-shrink-0">
              {parsing ? <><Loader2 className="w-3 h-3 animate-spin mr-1" />Parsing…</> : 'Preview Lessons'}
            </Button>
          </div>
        )}
        {parsedLessons.length > 0 && (
          <div className="space-y-2 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-sm font-medium text-green-800 dark:text-green-200">{parsedLessons.length} lesson{parsedLessons.length !== 1 ? 's' : ''} found in document:</p>
            <ul className="space-y-1 max-h-36 overflow-y-auto">
              {parsedLessons.map((l) => (
                <li key={l.dayNumber} className="text-xs text-green-700 dark:text-green-300 flex items-start gap-1">
                  <span className="font-medium flex-shrink-0">Day {l.dayNumber}:</span>
                  <span className="truncate">{l.title}</span>
                </li>
              ))}
            </ul>
            <Button
              size="sm"
              type="button"
              variant="destructive"
              disabled={reimporting}
              onClick={reimportLessons}
              className="w-full mt-2"
            >
              {reimporting ? <><Loader2 className="w-3 h-3 animate-spin mr-1" />Importing…</> : `Replace All Lessons (${parsedLessons.length} new)`}
            </Button>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}

function EditSeriesForm({ series, onSave, onCancel }: {
  series: StudySeries;
  onSave: (data: Partial<StudySeries>) => Promise<void>;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [formData, setFormData] = useState({
    title: series.title,
    description: series.description,
    category: series.category,
    requiredTier: series.requiredTier || 'free',
    thumbnailUrl: series.thumbnailUrl || '',
    isPublished: series.isPublished ?? false,
    requiresConsecutiveCompletion: series.requiresConsecutiveCompletion ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [uploadingThumb, setUploadingThumb] = useState(false);

  const uploadSeriesThumbnail = async (file: File) => {
    setUploadingThumb(true);
    try {
      const fd = new FormData();
      fd.append('thumbnail', file);
      const res = await fetch(`/api/study-series/${series.id}/upload-thumbnail`, { method: 'POST', body: fd, credentials: 'include' });
      if (!res.ok) throw new Error('Upload failed');
      const updated = await res.json();
      setFormData(prev => ({ ...prev, thumbnailUrl: updated.thumbnailUrl || '' }));
      setThumbFile(null);
      qc.invalidateQueries({ queryKey: ['/api/study-series'] });
      qc.invalidateQueries({ queryKey: ['/api/admin/study-series'] });
      toast({ title: 'Thumbnail uploaded' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setUploadingThumb(false);
    }
  };

  const deleteSeriesThumbnail = async () => {
    if (!confirm('Remove thumbnail?')) return;
    try {
      const res = await fetch(`/api/study-series/${series.id}/delete-thumbnail`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Delete failed');
      setFormData(prev => ({ ...prev, thumbnailUrl: '' }));
      qc.invalidateQueries({ queryKey: ['/api/study-series'] });
      qc.invalidateQueries({ queryKey: ['/api/admin/study-series'] });
      toast({ title: 'Thumbnail removed' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await onSave(formData);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Title</Label>
        <Input
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Access Tier</Label>
          <Select value={formData.requiredTier} onValueChange={(v) => setFormData({ ...formData, requiredTier: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {tiers.map((tier) => (
                <SelectItem key={tier.id} value={tier.id}>{tier.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Thumbnail Image</Label>
        {formData.thumbnailUrl ? (
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
            <div className="flex items-center gap-3">
              <img src={formData.thumbnailUrl} alt="Thumbnail" className="w-14 h-14 rounded object-cover border" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Current thumbnail</span>
            </div>
            <Button size="sm" variant="destructive" type="button" onClick={deleteSeriesThumbnail}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-3">
              <input
                type="file"
                accept="image/*"
                className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-yellow-400 file:text-black hover:file:bg-yellow-500 cursor-pointer"
                onChange={(e) => setThumbFile(e.target.files?.[0] || null)}
              />
              <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF — shown as the series icon in the library</p>
            </div>
            {thumbFile && (
              <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                <span className="text-xs text-green-700 dark:text-green-300 truncate flex-1 mr-2">✓ {thumbFile.name}</span>
                <Button size="sm" type="button" disabled={uploadingThumb} onClick={() => uploadSeriesThumbnail(thumbFile)} className="bg-yellow-400 text-black hover:bg-yellow-500 flex-shrink-0">
                  {uploadingThumb ? 'Uploading…' : 'Upload Now'}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between border rounded-lg p-3">
        <Label>Published</Label>
        <Switch
          checked={formData.isPublished}
          onCheckedChange={(v) => setFormData({ ...formData, isPublished: v })}
        />
      </div>
      <div className="flex items-center justify-between border rounded-lg p-3">
        <div>
          <Label>Requires Consecutive Completion</Label>
          <p className="text-xs text-gray-500">Studies must be completed in order</p>
        </div>
        <Switch
          checked={formData.requiresConsecutiveCompletion}
          onCheckedChange={(v) => setFormData({ ...formData, requiresConsecutiveCompletion: v })}
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
