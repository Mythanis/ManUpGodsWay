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
import { Plus } from "lucide-react";
import { z } from "zod";

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
  content: z.string().min(50, "Content must be at least 50 characters"),
  category: z.string().min(1, "Category is required"),
  videoId: z.string().optional(),
});

const lessonSchema = z.object({
  title: z.string().min(1, "Lesson title is required"),
  content: z.string().min(1, "Lesson content is required"),
  estimatedMinutes: z.number().min(1).default(30),
  videoId: z.string().optional(),
});

export default function UploadStudyForm() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [titleExists, setTitleExists] = useState(false);
  const [checkingTitle, setCheckingTitle] = useState(false);
  const [lessons, setLessons] = useState<Array<{
    title: string;
    content: string;
    estimatedMinutes: number;
    videoId?: string;
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

  const form = useForm({
    resolver: zodResolver(createStudySchema),
    defaultValues: {
      title: '',
      description: '',
      content: '',
      category: '',
      difficulty: 'beginner',
      estimatedHours: 1,
      lessonCount: 1,
      thumbnailUrl: '',
      videoUrl: '',
      videoId: 'none',
      requiredTier: 'free',
      isPublished: false,
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

  const createStudy = useMutation({
    mutationFn: async (data: z.infer<typeof createStudySchema>) => {
      const study = await apiRequest('POST', '/api/studies', data);
      return study;
    },
    onSuccess: async (study) => {
      // Create lessons if any were defined
      if (lessons.length > 0) {
        try {
          for (let i = 0; i < lessons.length; i++) {
            const lesson = lessons[i];
            await apiRequest('POST', `/api/studies/${study.id}/lessons`, {
              ...lesson,
              lessonNumber: i + 1,
            });
          }
        } catch (error) {
          console.error('Error creating lessons:', error);
          toast({
            title: "Warning",
            description: "Study created but some lessons failed to save. Please edit the study to add lessons.",
            variant: "destructive",
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/studies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({
        title: "Success",
        description: lessons.length > 0 
          ? `Study with ${lessons.length} lessons created successfully!`
          : "Study created successfully!",
      });
      setDialogOpen(false);
      form.reset();
      setLessons([]);
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
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
    // Update lesson count based on actual lessons
    const submitData = {
      ...data,
      lessonCount: lessons.length > 0 ? lessons.length : 1,
      videoId: data.videoId === 'none' ? undefined : data.videoId,
      content: lessons.length > 0 ? data.content || 'See individual lessons for content.' : data.content
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="lessonCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lessons</FormLabel>
                    <FormControl>
                      <Input 
                        type="number"
                        min="1"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                        data-testid="input-lesson-count"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
            </div>

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

            {lessons.length === 0 && (
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Study Overview Content</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Overview content (optional if using individual lessons)"
                        className="min-h-[120px]"
                        {...field}
                        data-testid="textarea-study-content"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Lesson Management Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Lessons</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setLessons([...lessons, {
                      title: `Lesson ${lessons.length + 1}`,
                      content: '',
                      estimatedMinutes: 30,
                    }]);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Lesson
                </Button>
              </div>

              {lessons.map((lesson, index) => (
                <Card key={index} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Lesson {index + 1}</h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setLessons(lessons.filter((_, i) => i !== index));
                        }}
                        className="text-red-500 hover:text-red-700"
                      >
                        Remove
                      </Button>
                    </div>
                    
                    <Input
                      placeholder="Lesson title"
                      value={lesson.title}
                      onChange={(e) => {
                        const newLessons = [...lessons];
                        newLessons[index].title = e.target.value;
                        setLessons(newLessons);
                      }}
                    />
                    
                    <Textarea
                      placeholder="Lesson content"
                      className="min-h-[100px]"
                      value={lesson.content}
                      onChange={(e) => {
                        const newLessons = [...lessons];
                        newLessons[index].content = e.target.value;
                        setLessons(newLessons);
                      }}
                    />
                    
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        type="number"
                        placeholder="Est. minutes"
                        value={lesson.estimatedMinutes}
                        onChange={(e) => {
                          const newLessons = [...lessons];
                          newLessons[index].estimatedMinutes = parseInt(e.target.value) || 30;
                          setLessons(newLessons);
                        }}
                      />
                      
                      <Select
                        value={lesson.videoId || 'none'}
                        onValueChange={(value) => {
                          const newLessons = [...lessons];
                          newLessons[index].videoId = value === 'none' ? undefined : value;
                          setLessons(newLessons);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select video" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No video</SelectItem>
                          {videos.filter(video => video.processingStatus === 'completed').map((video) => (
                            <SelectItem key={video.id} value={video.id}>
                              {video.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <FormField
              control={form.control}
              name="isPublished"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Publish Study
                    </FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Make this study visible to users
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-publish-study"
                    />
                  </FormControl>
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
                className="flex-1 bg-ministry-navy hover:bg-ministry-charcoal disabled:opacity-50"
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
