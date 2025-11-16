import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useTheme } from "@/hooks/useTheme";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatLocalDate, getCurrentLocalDate, parseDateSafely } from "@/lib/utils";
import { CalendarDays, Plus, Edit, Trash, Upload, X, Image as ImageIcon } from "lucide-react";
import { insertDevotionalSchema } from "@shared/schema";

// Create form schema based on insertDevotionalSchema
const devotionalFormSchema = insertDevotionalSchema.extend({
  date: z.string().min(1, "Date is required"),
});

type DevotionalFormData = z.infer<typeof devotionalFormSchema>;

interface Devotional {
  id: string;
  title: string;
  verse: string;
  verseReference: string;
  content: string;
  imageUrl?: string;
  date: string;
  createdAt: string;
}

export default function DevotionalManagement() {
  const [showForm, setShowForm] = useState(false);
  const [editingDevotional, setEditingDevotional] = useState<Devotional | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string>("");
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const { toast } = useToast();
  const { effectiveTheme } = useTheme();
  const queryClient = useQueryClient();

  const form = useForm<DevotionalFormData>({
    resolver: zodResolver(devotionalFormSchema),
    defaultValues: {
      title: "",
      verse: "",
      verseReference: "",
      content: "",
      imageUrl: "",
      date: getCurrentLocalDate(), // Today's date in user's timezone
    },
  });

  // Fetch devotionals
  const { data: devotionals = [], isLoading } = useQuery<Devotional[]>({
    queryKey: ["/api/devotionals"],
    retry: false,
  });

  // Create devotional mutation
  const createMutation = useMutation({
    mutationFn: async (data: DevotionalFormData) => {
      const { imageUrl, ...devotionalData } = data;
      const finalData = {
        ...devotionalData,
        date: new Date(data.date + 'T00:00:00Z'),
      };
      return await apiRequest("POST", "/api/devotionals", finalData);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create devotional",
        variant: "destructive",
      });
    },
  });

  // Update devotional mutation
  const updateMutation = useMutation({
    mutationFn: async (data: DevotionalFormData & { id: string }) => {
      const { imageUrl, ...devotionalData } = data;
      const finalData = {
        ...devotionalData,
        date: new Date(data.date + 'T00:00:00Z'),
      };
      return await apiRequest("PUT", `/api/devotionals/${data.id}`, finalData);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update devotional",
        variant: "destructive",
      });
    },
  });

  // Delete devotional mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/devotionals/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/devotionals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/devotionals/today"] });
      toast({
        title: "Success",
        description: "Devotional deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete devotional",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: DevotionalFormData) => {
    try {
      if (editingDevotional) {
        await updateMutation.mutateAsync({ ...data, id: editingDevotional.id });
        if (thumbnailFile) {
          await handleThumbnailUpload(editingDevotional.id);
        }
        queryClient.invalidateQueries({ queryKey: ["/api/devotionals"] });
        queryClient.invalidateQueries({ queryKey: ["/api/devotionals/today"] });
        toast({
          title: "Success",
          description: "Devotional updated successfully",
        });
      } else {
        const result: any = await createMutation.mutateAsync(data);
        if (thumbnailFile && result?.id) {
          await handleThumbnailUpload(result.id);
        }
        queryClient.invalidateQueries({ queryKey: ["/api/devotionals"] });
        queryClient.invalidateQueries({ queryKey: ["/api/devotionals/today"] });
        toast({
          title: "Success",
          description: "Devotional created successfully",
        });
      }
      
      // Only close form and reset after everything succeeds
      setShowForm(false);
      setEditingDevotional(null);
      setThumbnailFile(null);
      setThumbnailPreview("");
      form.reset();
    } catch (error) {
      console.error("Error submitting devotional:", error);
      // Error toasts are already handled by mutations and handleThumbnailUpload
    }
  };

  const handleEdit = (devotional: Devotional) => {
    setEditingDevotional(devotional);
    form.reset({
      title: devotional.title,
      verse: devotional.verse,
      verseReference: devotional.verseReference,
      content: devotional.content,
      imageUrl: devotional.imageUrl || "",
      date: parseDateSafely(devotional.date).toISOString().split('T')[0],
    });
    setThumbnailPreview(devotional.imageUrl || "");
    setThumbnailFile(null);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this devotional?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingDevotional(null);
    setThumbnailFile(null);
    setThumbnailPreview("");
    form.reset();
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setThumbnailFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setThumbnailPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleThumbnailUpload = async (devotionalId: string) => {
    if (!thumbnailFile) return;

    setUploadingThumbnail(true);
    try {
      const formData = new FormData();
      formData.append('thumbnail', thumbnailFile);

      const response = await fetch(`/api/devotionals/${devotionalId}/upload-thumbnail`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to upload thumbnail');
      }

      queryClient.invalidateQueries({ queryKey: ["/api/devotionals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/devotionals/today"] });
      toast({
        title: "Success",
        description: "Thumbnail uploaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to upload thumbnail",
        variant: "destructive",
      });
    } finally {
      setUploadingThumbnail(false);
    }
  };

  const handleThumbnailRemove = async () => {
    if (editingDevotional?.id && editingDevotional.imageUrl) {
      try {
        await apiRequest("DELETE", `/api/devotionals/${editingDevotional.id}/delete-thumbnail`);
        queryClient.invalidateQueries({ queryKey: ["/api/devotionals"] });
        queryClient.invalidateQueries({ queryKey: ["/api/devotionals/today"] });
        setThumbnailPreview("");
        setThumbnailFile(null);
        toast({
          title: "Success",
          description: "Thumbnail removed successfully",
        });
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to remove thumbnail",
          variant: "destructive",
        });
      }
    } else {
      setThumbnailPreview("");
      setThumbnailFile(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ministry-navy"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <CalendarDays className="w-5 h-5" />
              <span>Daily Devotional Management</span>
            </CardTitle>
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 rounded-lg transition-colors flex items-center cursor-pointer bg-ministry-gold hover:bg-ministry-gold/80 text-ministry-charcoal"
              data-testid="button-add-devotional"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Devotional
            </button>
          </div>
        </CardHeader>

        {showForm && (
          <CardContent className="border-t">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    {...form.register("title")}
                    placeholder="Devotional title"
                    data-testid="input-devotional-title"
                  />
                  {form.formState.errors.title && (
                    <p className="text-sm text-red-600 mt-1">
                      {form.formState.errors.title.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    {...form.register("date")}
                    data-testid="input-devotional-date"
                  />
                  {form.formState.errors.date && (
                    <p className="text-sm text-red-600 mt-1">
                      {form.formState.errors.date.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="verse">Bible Verse</Label>
                  <Textarea
                    id="verse"
                    {...form.register("verse")}
                    placeholder="Enter the Bible verse"
                    rows={3}
                    data-testid="input-devotional-verse"
                  />
                  {form.formState.errors.verse && (
                    <p className="text-sm text-red-600 mt-1">
                      {form.formState.errors.verse.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="verseReference">Verse Reference</Label>
                  <Input
                    id="verseReference"
                    {...form.register("verseReference")}
                    placeholder="e.g., John 3:16"
                    data-testid="input-devotional-reference"
                  />
                  {form.formState.errors.verseReference && (
                    <p className="text-sm text-red-600 mt-1">
                      {form.formState.errors.verseReference.message}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="content">Devotional Content</Label>
                <Textarea
                  id="content"
                  {...form.register("content")}
                  placeholder="Write the devotional content..."
                  rows={6}
                  data-testid="input-devotional-content"
                />
                {form.formState.errors.content && (
                  <p className="text-sm text-red-600 mt-1">
                    {form.formState.errors.content.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="thumbnail">Thumbnail Image (Optional)</Label>
                <p className="text-xs text-gray-500 mb-2">Recommended: 16:9 aspect ratio, max 5MB</p>
                
                {thumbnailPreview ? (
                  <div className="relative inline-block">
                    <img 
                      src={thumbnailPreview} 
                      alt="Thumbnail preview" 
                      className="w-48 h-27 object-cover rounded-lg border-2 border-ministry-gold"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={handleThumbnailRemove}
                      data-testid="button-remove-thumbnail"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="file"
                      id="thumbnail"
                      accept="image/*"
                      onChange={handleThumbnailChange}
                      className="hidden"
                      data-testid="input-devotional-thumbnail"
                    />
                    <label
                      htmlFor="thumbnail"
                      className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-ministry-steel rounded-lg cursor-pointer hover:bg-ministry-gold/10 transition-colors"
                    >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-8 h-8 mb-2 text-ministry-steel" />
                        <p className="text-sm text-ministry-charcoal">Click to upload thumbnail</p>
                        <p className="text-xs text-ministry-slate">PNG, JPG up to 5MB</p>
                      </div>
                    </label>
                  </div>
                )}
              </div>

              <div className="flex space-x-2">
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="bg-ministry-navy text-white hover:bg-ministry-charcoal"
                  data-testid="button-save-devotional"
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : null}
                  {editingDevotional ? "Update" : "Create"} Devotional
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  className="border-ministry-steel text-ministry-charcoal hover:bg-ministry-steel/10"
                  data-testid="button-cancel-devotional"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        )}
      </Card>

      {/* Devotionals List */}
      <Card>
        <CardHeader>
          <CardTitle>Existing Devotionals ({devotionals.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {devotionals.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No devotionals created yet. Create your first devotional above.
            </p>
          ) : (
            <div className="space-y-4">
              {(devotionals as Devotional[]).map((devotional: Devotional) => (
                <div
                  key={devotional.id}
                  className="border rounded-lg p-4 space-y-2"
                  data-testid={`devotional-item-${devotional.id}`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground">
                      {devotional.title}
                    </h3>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(devotional)}
                        className="border-ministry-steel text-ministry-charcoal hover:bg-ministry-steel/10"
                        data-testid={`button-edit-${devotional.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(devotional.id)}
                        className="border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700"
                        data-testid={`button-delete-${devotional.id}`}
                      >
                        <Trash className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <strong>{devotional.verseReference}:</strong> {devotional.verse}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {devotional.content.substring(0, 150)}
                    {devotional.content.length > 150 ? "..." : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Date: {formatLocalDate(devotional.date)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}