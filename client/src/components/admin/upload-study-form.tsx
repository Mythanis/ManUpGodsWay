import { useState, useEffect, useCallback } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/hooks/useTheme";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertStudySchema } from "@shared/schema";
import { Plus, Layers, FileText, Upload, Check, Loader2, CalendarClock } from "lucide-react";
import { z } from "zod";
import { format } from "date-fns";

interface StudySeries {
  id: string;
  title: string;
  description?: string;
  category?: string;
}

const categories = [
  { id: 'leadership', label: 'Leadership' },
  { id: 'marriage', label: 'Marriage' },
  { id: 'fatherhood', label: 'Fatherhood' },
  { id: 'character', label: 'Character' },
  { id: 'faith', label: 'Faith' },
  { id: 'discipleship', label: 'Discipleship' },
];

const difficulties = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
];

const tiers = [
  { id: 'free', label: 'Free' },
  { id: 'premium', label: 'Premium' },
  { id: 'vip', label: 'VIP' },
];

const createStudySchema = insertStudySchema.extend({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  content: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  videoId: z.string().optional(),
  requiresPurchase: z.boolean().default(false),
  price: z.string().optional(),
  purchaseRequiredTiers: z.array(z.enum(["free", "premium", "vip"])).default([]),
  scheduledPublishDate: z.string().optional(),
});

export default function UploadStudyForm() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [titleExists, setTitleExists] = useState(false);
  const [checkingTitle, setCheckingTitle] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [wordFile, setWordFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadingWord, setUploadingWord] = useState(false);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [addToSeries, setAddToSeries] = useState(false);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>("");
  
  // Scheduling state
  const [scheduleForLater, setScheduleForLater] = useState(false);
  
  // Bulk import state
  const [bulkImportMode, setBulkImportMode] = useState(false);
  const [bulkWordFile, setBulkWordFile] = useState<File | null>(null);
  const [parsingWordFile, setParsingWordFile] = useState(false);
  const [parsedLessons, setParsedLessons] = useState<Array<{
    dayNumber: number;
    title: string;
    content: string;
    scripture?: string;
    keyTakeaway?: string;
  }>>([]);
  
  const { toast } = useToast();
  const { effectiveTheme } = useTheme();
  const queryClient = useQueryClient();

  const { data: videos = [] } = useQuery<Array<{
    id: string;
    title: string;
    processingStatus: string;
  }>>({
    queryKey: ["/api/admin/videos"],
    retry: false,
  });

  const { data: allSeries = [] } = useQuery<StudySeries[]>({
    queryKey: ["/api/admin/study-series"],
    retry: false,
  });

  const form = useForm({
    resolver: zodResolver(createStudySchema),
    defaultValues: {
      title: '',
      description: '',
      content: '',
      category: '',
      difficulty: 'beginner',
      estimatedHours: 1,
      thumbnailUrl: '',
      videoUrl: '',
      videoId: 'none',
      requiredTier: 'free',
      requiresPurchase: false,
      price: '',
      purchaseRequiredTiers: [],
      isPublished: false,
      scheduledPublishDate: '',
    },
  });

  // Debounced title validation
  const checkTitleExists = useCallback(async (title: string) => {
    if (!title || title.trim().length < 3) {
      setTitleExists(false);
      return;
    }

    setCheckingTitle(true);
    try {
      const response = await fetch(`/api/check-title/${encodeURIComponent(title.trim())}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setTitleExists(data.exists);
      }
    } catch (error) {
      console.error('Error checking title:', error);
    } finally {
      setCheckingTitle(false);
    }
  }, []);

  // Watch title field for changes
  const watchedTitle = form.watch('title');
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      checkTitleExists(watchedTitle);
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [watchedTitle, checkTitleExists]);

  // Parse Word file for bulk import
  const handleBulkWordFileChange = async (file: File | null) => {
    setBulkWordFile(file);
    setParsedLessons([]);
    
    if (!file) return;
    
    setParsingWordFile(true);
    try {
      const formData = new FormData();
      formData.append('word', file);
      
      const response = await fetch('/api/parse-word-lessons', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setParsedLessons(data.lessons || []);
        if (data.lessons?.length > 0) {
          toast({
            title: "Document Parsed",
            description: `Found ${data.lessons.length} daily lessons`,
          });
        } else {
          toast({
            title: "No Lessons Found",
            description: "Could not find daily lessons in the document. Make sure each day starts with 'Day 1:', 'Day 2:', etc.",
            variant: "destructive",
          });
        }
      } else {
        throw new Error('Failed to parse document');
      }
    } catch (error) {
      console.error('Error parsing Word file:', error);
      toast({
        title: "Error",
        description: "Failed to parse Word document",
        variant: "destructive",
      });
    } finally {
      setParsingWordFile(false);
    }
  };

  const createStudy = useMutation({
    mutationFn: async (data: z.infer<typeof createStudySchema>) => {
      const study = await apiRequest('POST', '/api/studies', data);
      return study;
    },
    onSuccess: async (study) => {
      // Upload files if any are selected
      const uploadPromises: Promise<any>[] = [];

      if (thumbnailFile) {
        setUploadingThumbnail(true);
        const formData = new FormData();
        formData.append('thumbnail', thumbnailFile);
        uploadPromises.push(
          fetch(`/api/studies/${study.id}/upload-thumbnail`, {
            method: 'POST',
            body: formData,
            credentials: 'include',
          }).finally(() => setUploadingThumbnail(false))
        );
      }

      if (pdfFile) {
        setUploadingPdf(true);
        const formData = new FormData();
        formData.append('pdf', pdfFile);
        uploadPromises.push(
          fetch(`/api/studies/${study.id}/upload-pdf`, {
            method: 'POST',
            body: formData,
            credentials: 'include',
          }).finally(() => setUploadingPdf(false))
        );
      }

      if (wordFile) {
        setUploadingWord(true);
        const formData = new FormData();
        formData.append('word', wordFile);
        uploadPromises.push(
          fetch(`/api/studies/${study.id}/upload-word`, {
            method: 'POST',
            body: formData,
            credentials: 'include',
          }).finally(() => setUploadingWord(false))
        );
      }

      if (uploadPromises.length > 0) {
        try {
          await Promise.all(uploadPromises);
        } catch (error) {
          console.error('Error uploading files:', error);
          toast({
            title: "Warning",
            description: "Study created but some files failed to upload. You can upload them later.",
            variant: "destructive",
          });
        }
      }

      // If bulk import mode, create all the lessons
      if (bulkImportMode && parsedLessons.length > 0) {
        let lessonCount = 0;
        for (const lesson of parsedLessons) {
          try {
            await apiRequest('POST', `/api/studies/${study.id}/lessons`, {
              ...lesson,
              displayOrder: lesson.dayNumber,
              estimatedMinutes: 15,
            });
            lessonCount++;
          } catch (error) {
            console.error('Error creating lesson:', error);
          }
        }
        toast({
          title: "Success",
          description: `Study created with ${lessonCount} daily lessons!`,
        });
      } else {
        toast({
          title: "Success",
          description: "Study created successfully!",
        });
      }

      queryClient.invalidateQueries({ queryKey: ["/api/studies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/study-series"] });
      setDialogOpen(false);
      form.reset();
      setPdfFile(null);
      setWordFile(null);
      setThumbnailFile(null);
      setAddToSeries(false);
      setSelectedSeriesId("");
      setScheduleForLater(false);
      setBulkImportMode(false);
      setBulkWordFile(null);
      setParsedLessons([]);
    },
    onError: (error: any) => {
      console.error('Study creation error:', error);
      
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized", 
          description: "You need admin access to create studies. Please log in as an admin.",
          variant: "destructive",
        });
        return;
      }
      
      // Extract error message from API response
      let errorMessage = "Failed to create study. Please try again.";
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: any) => {
    // Validate that either content is provided, documents are uploaded, or lessons are parsed
    const hasDocuments = pdfFile || wordFile;
    const hasParsedLessons = bulkImportMode && parsedLessons.length > 0;
    if ((!data.content || data.content.trim().length < 50) && !hasDocuments && !hasParsedLessons) {
      toast({
        title: "Validation Error",
        description: "Please provide either study content (50+ characters), upload a document, or import lessons from a Word file.",
        variant: "destructive",
      });
      return;
    }

    const submitData = {
      ...data,
      videoId: data.videoId === 'none' ? undefined : data.videoId,
      // Convert price to proper format - null if not required for purchase, or empty/invalid
      price: data.requiresPurchase && data.price && data.price.trim() !== '' ? data.price : null,
      // Add seriesId if adding to a series
      seriesId: addToSeries && selectedSeriesId ? selectedSeriesId : null,
      // Convert scheduled date to ISO string, or null if not scheduling
      scheduledPublishDate: scheduleForLater && data.scheduledPublishDate 
        ? new Date(data.scheduledPublishDate).toISOString() 
        : null,
      // If scheduling for later, don't publish immediately
      isPublished: scheduleForLater ? false : data.isPublished,
    };
    createStudy.mutate(submitData);
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <button 
          className="p-4 rounded-2xl transition-colors flex items-center space-x-3 w-full justify-center cursor-pointer bg-ministry-navy hover:bg-ministry-charcoal text-white border-none"
          data-testid="button-upload-study"
        >
          <Plus className="w-6 h-6" />
          <span className="font-medium">Upload New Study</span>
        </button>
      </DialogTrigger>
      
      <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto" data-testid="dialog-upload-study">
        <DialogHeader>
          <DialogTitle>Upload New Study</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter study title"
                      {...field}
                      data-testid="input-study-title"
                    />
                  </FormControl>
                  <FormMessage />
                  {titleExists && (
                    <p className="text-red-500 text-sm mt-1">Title exists</p>
                  )}
                  {checkingTitle && (
                    <p className="text-muted-foreground text-sm mt-1">Checking title...</p>
                  )}
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Brief description of the study"
                      className="min-h-[80px]"
                      {...field}
                      data-testid="textarea-study-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-study-category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="difficulty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Difficulty</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-study-difficulty">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {difficulties.map((difficulty) => (
                          <SelectItem key={difficulty.id} value={difficulty.id}>
                            {difficulty.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="requiredTier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Access Tier</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-study-tier">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {tiers.map((tier) => (
                          <SelectItem key={tier.id} value={tier.id}>
                            {tier.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Publishing Options - Grouped Together */}
            <div className="space-y-4 rounded-lg border-2 border-ministry-gold p-4 bg-ministry-gold/10">
              <h3 className="font-semibold text-ministry-charcoal flex items-center gap-2">
                <CalendarClock className="w-5 h-5" />
                Publishing Options
              </h3>
              
              {/* Publish Now */}
              <FormField
                control={form.control}
                name="isPublished"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border bg-white dark:bg-gray-900 p-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base font-medium">
                        Publish Now
                      </FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Make this study visible immediately
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          field.onChange(checked);
                          if (checked) {
                            setScheduleForLater(false);
                            form.setValue('scheduledPublishDate', '');
                          }
                        }}
                        disabled={scheduleForLater}
                        data-testid="switch-publish-study"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Schedule for Later */}
              <div className="flex flex-row items-center justify-between rounded-lg border bg-white dark:bg-gray-900 p-3">
                <div className="space-y-0.5">
                  <div className="text-base font-medium">
                    Schedule for Later
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Automatically publish at a future date
                  </div>
                </div>
                <Switch
                  checked={scheduleForLater}
                  onCheckedChange={(checked) => {
                    setScheduleForLater(checked);
                    if (checked) {
                      form.setValue('isPublished', false);
                    } else {
                      form.setValue('scheduledPublishDate', '');
                    }
                  }}
                  data-testid="switch-schedule-later"
                />
              </div>

              {/* Schedule Date Picker - shows when scheduling is enabled */}
              {scheduleForLater && (
                <FormField
                  control={form.control}
                  name="scheduledPublishDate"
                  render={({ field }) => (
                    <FormItem className="bg-white dark:bg-gray-900 p-3 rounded-lg border">
                      <FormLabel className="font-medium">Publish Date & Time</FormLabel>
                      <FormControl>
                        <Input 
                          type="datetime-local"
                          min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                          className="mt-2"
                          {...field}
                          data-testid="input-scheduled-date"
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground mt-1">
                        Study will automatically become visible at this date and time
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Add to Series Section */}
            {allSeries.length > 0 && (
              <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    Add to Series
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Include this study in an existing series
                  </div>
                </div>
                <Switch
                  checked={addToSeries}
                  onCheckedChange={(checked) => {
                    setAddToSeries(checked);
                    if (!checked) setSelectedSeriesId("");
                  }}
                  data-testid="switch-add-to-series"
                />
              </div>
            )}

            {/* Series Dropdown - only show when addToSeries is true */}
            {addToSeries && allSeries.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Series</label>
                <Select value={selectedSeriesId} onValueChange={setSelectedSeriesId}>
                  <SelectTrigger data-testid="select-study-series">
                    <SelectValue placeholder="Choose a series" />
                  </SelectTrigger>
                  <SelectContent>
                    {allSeries.map((series) => (
                      <SelectItem key={series.id} value={series.id}>
                        {series.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Purchase Options Section */}
            <FormField
              control={form.control}
              name="requiresPurchase"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Requires Purchase
                    </FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Make this study available for purchase
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-requires-purchase"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Price field - only show when requiresPurchase is true */}
            {form.watch('requiresPurchase') && (
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price ($)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        {...field}
                        data-testid="input-study-price"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Tier checkboxes - only show when requiresPurchase is true */}
            {form.watch('requiresPurchase') && (
              <FormField
                control={form.control}
                name="purchaseRequiredTiers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase Required For</FormLabel>
                    <div className="space-y-2">
                      {/* All selection checkbox */}
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="all-tiers"
                          checked={field.value.length === 3}
                          onChange={(e) => {
                            if (e.target.checked) {
                              field.onChange(['free', 'premium', 'vip']);
                            } else {
                              field.onChange([]);
                            }
                          }}
                          className="rounded border-ministry-steel"
                          data-testid="checkbox-all-tiers"
                        />
                        <label htmlFor="all-tiers" className="text-sm font-medium">
                          All Tiers
                        </label>
                      </div>
                      
                      {/* Individual tier checkboxes */}
                      {tiers.map((tier) => (
                        <div key={tier.id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`tier-${tier.id}`}
                            checked={field.value.includes(tier.id as 'free' | 'premium' | 'vip')}
                            onChange={(e) => {
                              const currentTiers = [...field.value];
                              if (e.target.checked) {
                                if (!currentTiers.includes(tier.id as 'free' | 'premium' | 'vip')) {
                                  currentTiers.push(tier.id as 'free' | 'premium' | 'vip');
                                }
                              } else {
                                const index = currentTiers.indexOf(tier.id as 'free' | 'premium' | 'vip');
                                if (index > -1) {
                                  currentTiers.splice(index, 1);
                                }
                              }
                              field.onChange(currentTiers);
                            }}
                            className="rounded border-ministry-steel"
                            data-testid={`checkbox-tier-${tier.id}`}
                          />
                          <label htmlFor={`tier-${tier.id}`} className="text-sm">
                            {tier.label}
                          </label>
                        </div>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="estimatedHours"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Est. Hours</FormLabel>
                  <FormControl>
                    <Input 
                      type="number"
                      min="1"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                      data-testid="input-estimated-hours"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="thumbnailUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Thumbnail URL (optional)</FormLabel>
                  <FormControl>
                    <Input 
                      type="url"
                      placeholder="https://example.com/image.jpg"
                      {...field}
                      data-testid="input-thumbnail-url"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Bulk Import from Word Document */}
            <div className="flex flex-row items-center justify-between rounded-lg border p-4 bg-blue-50 dark:bg-blue-950">
              <div className="space-y-0.5">
                <div className="text-sm font-medium flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Bulk Import Daily Lessons
                </div>
                <div className="text-xs text-muted-foreground">
                  Upload a Word doc with daily lessons (Day 1:, Day 2:, etc.)
                </div>
              </div>
              <Switch
                checked={bulkImportMode}
                onCheckedChange={(checked) => {
                  setBulkImportMode(checked);
                  if (!checked) {
                    setBulkWordFile(null);
                    setParsedLessons([]);
                  }
                }}
                data-testid="switch-bulk-import-mode"
              />
            </div>

            {/* Bulk Import Word Upload */}
            {bulkImportMode && (
              <div className="space-y-4 border rounded-lg p-4 bg-blue-50/50 dark:bg-blue-950/50">
                <div className="space-y-2">
                  <FormLabel className="flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    Upload Word Document with Daily Lessons
                  </FormLabel>
                  <Input
                    type="file"
                    accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(e) => handleBulkWordFileChange(e.target.files?.[0] || null)}
                    data-testid="input-bulk-word-file"
                  />
                  <p className="text-xs text-muted-foreground">
                    Format each day as: <strong>Day 1: Title</strong> followed by content. 
                    The system will split lessons where it finds "Day X:" patterns.
                  </p>
                </div>

                {parsingWordFile && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Parsing document...
                  </div>
                )}

                {parsedLessons.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                      <Check className="w-4 h-4" />
                      Found {parsedLessons.length} daily lessons
                    </div>
                    <div className="max-h-48 overflow-y-auto border rounded-lg divide-y bg-white dark:bg-gray-900">
                      {parsedLessons.map((lesson, index) => (
                        <div key={index} className="p-3">
                          <div className="font-medium text-sm">Day {lesson.dayNumber}: {lesson.title}</div>
                          <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
                            {lesson.content.substring(0, 150)}...
                          </div>
                          {lesson.scripture && (
                            <div className="text-xs text-blue-600 mt-1">Scripture: {lesson.scripture}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {bulkWordFile && !parsingWordFile && parsedLessons.length === 0 && (
                  <p className="text-sm text-amber-600">
                    No daily lessons found. Make sure each day starts with "Day 1:", "Day 2:", etc.
                  </p>
                )}
              </div>
            )}

            {/* Standard File Uploads - hidden in bulk mode */}
            {!bulkImportMode && (
              <div className="space-y-4 border rounded-lg p-4 bg-muted/10">
                <h3 className="font-semibold text-sm">File Uploads</h3>
                
                <div className="space-y-2">
                  <FormLabel>Thumbnail Image (replaces URL if provided)</FormLabel>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
                    data-testid="input-thumbnail-file"
                  />
                  {thumbnailFile && (
                    <p className="text-sm text-muted-foreground">
                      Selected: {thumbnailFile.name}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <FormLabel>PDF Document (optional)</FormLabel>
                  <Input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                    data-testid="input-pdf-file"
                  />
                  {pdfFile && (
                    <p className="text-sm text-muted-foreground">
                      Selected: {pdfFile.name}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <FormLabel>Word Document (.docx only, optional)</FormLabel>
                  <Input
                    type="file"
                    accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(e) => setWordFile(e.target.files?.[0] || null)}
                    data-testid="input-word-file"
                  />
                  <p className="text-xs text-muted-foreground">
                    Only .docx files are supported for interactive viewing.
                  </p>
                  {wordFile && (
                    <p className="text-sm text-muted-foreground">
                      Selected: {wordFile.name}
                    </p>
                  )}
                </div>
              </div>
            )}

            <FormField
              control={form.control}
              name="videoId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Associated Video</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} value={field.value || 'none'}>
                      <SelectTrigger data-testid="select-video">
                        <SelectValue placeholder="Select a video (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No video</SelectItem>
                        {videos.map((video) => (
                          <SelectItem key={video.id} value={video.id}>
                            {video.title} ({video.processingStatus === 'completed' ? 'Ready' : 'Processing'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="videoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Video URL (external, optional)</FormLabel>
                  <FormControl>
                    <Input 
                      type="url"
                      placeholder="https://example.com/video.mp4"
                      {...field}
                      data-testid="input-video-url"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Study Overview Content (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Overview content (optional if using documents)"
                      className="min-h-[120px]"
                      {...field}
                      data-testid="textarea-study-content"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="flex-1 border-ministry-steel text-ministry-charcoal hover:bg-ministry-steel/10"
                data-testid="button-cancel-study"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createStudy.isPending || titleExists || checkingTitle}
                className="flex-1 bg-ministry-gold hover:bg-ministry-gold/90 text-ministry-charcoal font-semibold disabled:opacity-50"
                data-testid="button-create-study"
              >
                {createStudy.isPending ? "Creating..." : "Create Study"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
