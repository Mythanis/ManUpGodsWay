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
import { Plus, Upload, FileText, Book, Layers, Video, Image, Trash2, Edit, Eye, Check, Loader2, ChevronDown, ChevronUp, X } from "lucide-react";

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
}

interface StudySeries {
  id: string;
  title: string;
  description: string;
  category: string;
  thumbnailUrl?: string;
  displayOrder?: number;
  studyCount?: number;
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
  { id: 'free', label: 'Free' },
  { id: 'premium', label: 'Premium' },
  { id: 'vip', label: 'VIP' },
];

export default function StudyBuilder() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState<"create" | "manage">("create");
  const [contentType, setContentType] = useState<"study" | "series">("study");
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    requiredTier: "free",
    thumbnailUrl: "",
    videoUrl: "",
    seriesId: "",
    requiresPurchase: false,
    price: "",
    isPublished: true,
  });
  
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [wordFile, setWordFile] = useState<File | null>(null);
  const [parsedLessons, setParsedLessons] = useState<ParsedLesson[]>([]);
  const [parsingWord, setParsingWord] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [editingStudy, setEditingStudy] = useState<Study | null>(null);
  const [editingSeries, setEditingSeries] = useState<StudySeries | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
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
      requiresPurchase: false,
      price: "",
      isPublished: true,
    });
    setThumbnailFile(null);
    setVideoFile(null);
    setWordFile(null);
    setParsedLessons([]);
  };

  const handleWordFileChange = async (file: File | null) => {
    setWordFile(file);
    setParsedLessons([]);
    
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
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to parse Word document",
        variant: "destructive",
      });
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
      });
      return study;
    },
    onSuccess: async (study) => {
      setUploading(true);
      try {
        if (thumbnailFile) {
          const formDataUpload = new FormData();
          formDataUpload.append('thumbnail', thumbnailFile);
          await fetch(`/api/studies/${study.id}/upload-thumbnail`, {
            method: 'POST',
            body: formDataUpload,
            credentials: 'include',
          });
        }
        
        if (videoFile) {
          const formDataUpload = new FormData();
          formDataUpload.append('video', videoFile);
          await fetch(`/api/studies/${study.id}/upload-video`, {
            method: 'POST',
            body: formDataUpload,
            credentials: 'include',
          });
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
          await fetch(`/api/admin/study-series/${series.id}/upload-thumbnail`, {
            method: 'POST',
            body: formDataUpload,
            credentials: 'include',
          });
        }
        
        // If lessons were parsed from Word document, create a study with those lessons
        if (parsedLessons.length > 0) {
          // Create a study within this series with the same title
          const study = await apiRequest('POST', '/api/studies', {
            title: formData.title,
            description: formData.description,
            category: formData.category,
            requiredTier: 'free',
            seriesId: series.id,
            seriesOrder: 1,
            isPublished: true,
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
      if (parsedLessons.length === 0 && !formData.description) {
        toast({
          title: "Validation Error",
          description: "Please provide content via Word document or description",
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

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="create" data-testid="tab-create">
            <Plus className="w-4 h-4 mr-2" />
            Create New
          </TabsTrigger>
          <TabsTrigger value="manage" data-testid="tab-manage">
            <Book className="w-4 h-4 mr-2" />
            Manage
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-4">
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

                {contentType === "study" && (
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
                )}
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

              <div className="border rounded-lg p-4 space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Image className="w-4 h-4" />
                  Thumbnail
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Upload Image</Label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
                      data-testid="input-thumbnail-file"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Or Image URL</Label>
                    <Input
                      placeholder="https://..."
                      value={formData.thumbnailUrl}
                      onChange={(e) => setFormData({ ...formData, thumbnailUrl: e.target.value })}
                      data-testid="input-thumbnail-url"
                    />
                  </div>
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

                  <div className="flex items-center justify-between border rounded-lg p-4 bg-green-50 dark:bg-green-950/30">
                    <div>
                      <Label>Publish Immediately</Label>
                      <p className="text-sm text-muted-foreground">Make this study visible to users</p>
                    </div>
                    <Switch
                      checked={formData.isPublished}
                      onCheckedChange={(v) => setFormData({ ...formData, isPublished: v })}
                      data-testid="switch-is-published"
                    />
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
        </TabsContent>

        <TabsContent value="manage" className="space-y-4">
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
                              setShowEditDialog(true);
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
                              setShowEditDialog(true);
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
        </TabsContent>
      </Tabs>

      {/* Edit Study Dialog */}
      <Dialog open={showEditDialog && editingStudy !== null} onOpenChange={(open) => {
        if (!open) {
          setShowEditDialog(false);
          setEditingStudy(null);
        }
      }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Study</DialogTitle>
          </DialogHeader>
          {editingStudy && (
            <EditStudyForm 
              study={editingStudy} 
              seriesList={seriesList}
              onSave={async (data) => {
                await apiRequest('PATCH', `/api/studies/${editingStudy.id}`, data);
                queryClient.invalidateQueries({ queryKey: ["/api/studies"] });
                queryClient.invalidateQueries({ queryKey: ["/api/admin/study-series"] });
                toast({ title: "Study updated" });
                setShowEditDialog(false);
                setEditingStudy(null);
              }}
              onCancel={() => {
                setShowEditDialog(false);
                setEditingStudy(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Series Dialog */}
      <Dialog open={showEditDialog && editingSeries !== null} onOpenChange={(open) => {
        if (!open) {
          setShowEditDialog(false);
          setEditingSeries(null);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Series</DialogTitle>
          </DialogHeader>
          {editingSeries && (
            <EditSeriesForm 
              series={editingSeries}
              onSave={async (data) => {
                await apiRequest('PATCH', `/api/admin/study-series/${editingSeries.id}`, data);
                queryClient.invalidateQueries({ queryKey: ["/api/admin/study-series"] });
                queryClient.invalidateQueries({ queryKey: ["/api/study-series"] });
                toast({ title: "Series updated" });
                setShowEditDialog(false);
                setEditingSeries(null);
              }}
              onCancel={() => {
                setShowEditDialog(false);
                setEditingSeries(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditStudyForm({ study, seriesList, onSave, onCancel }: {
  study: Study;
  seriesList: StudySeries[];
  onSave: (data: Partial<Study>) => Promise<void>;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    title: study.title,
    description: study.description,
    category: study.category,
    requiredTier: study.requiredTier || 'free',
    thumbnailUrl: study.thumbnailUrl || '',
    videoUrl: study.videoUrl || '',
    seriesId: study.seriesId || '',
    isPublished: study.isPublished ?? false,
    requiresPurchase: study.requiresPurchase ?? false,
    price: study.price || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await onSave({
        ...formData,
        seriesId: formData.seriesId || undefined,
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
      <div className="space-y-2">
        <Label>Thumbnail URL</Label>
        <Input
          value={formData.thumbnailUrl}
          onChange={(e) => setFormData({ ...formData, thumbnailUrl: e.target.value })}
          placeholder="https://..."
        />
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
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
        </Button>
      </DialogFooter>
    </div>
  );
}

function EditSeriesForm({ series, onSave, onCancel }: {
  series: StudySeries;
  onSave: (data: Partial<StudySeries>) => Promise<void>;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    title: series.title,
    description: series.description,
    category: series.category,
    thumbnailUrl: series.thumbnailUrl || '',
  });
  const [saving, setSaving] = useState(false);

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
        <Label>Thumbnail URL</Label>
        <Input
          value={formData.thumbnailUrl}
          onChange={(e) => setFormData({ ...formData, thumbnailUrl: e.target.value })}
          placeholder="https://..."
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
        </Button>
      </DialogFooter>
    </div>
  );
}
