import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Edit, Trash2, Plus, Eye, EyeOff, Rss, ExternalLink, Star, Upload, X, FileText, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { BlogPost } from "@shared/schema";

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

const IGNITE_CHURCH_RSS_URL = "https://ignitechurchstl.church/blog/rss";

const CATEGORIES = [
  { value: "general", label: "General" },
  { value: "faith", label: "Faith" },
  { value: "leadership", label: "Leadership" },
  { value: "marriage", label: "Marriage" },
  { value: "fatherhood", label: "Fatherhood" },
  { value: "character", label: "Character" },
  { value: "devotional", label: "Devotional" },
];

export default function BlogManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [showRssDialog, setShowRssDialog] = useState(false);
  const [editingBlog, setEditingBlog] = useState<BlogPost | null>(null);
  const [rssUrl, setRssUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    coverImageUrl: "",
    category: "general",
    isPublished: false,
    isFeatured: false,
  });

  const { data: blogs = [], isLoading } = useQuery<BlogPost[]>({
    queryKey: ['/api/admin/blogs'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await fetch('/api/admin/blogs', {
        method: 'POST',
        credentials: 'include',
        body: data,
      });
      if (!res.ok) throw new Error('Failed to create blog post');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/blogs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/blogs'] });
      toast({ title: "Success", description: "Blog post created successfully" });
      setShowDialog(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create blog post", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormData }) => {
      const res = await fetch(`/api/admin/blogs/${id}`, {
        method: 'PUT',
        credentials: 'include',
        body: data,
      });
      if (!res.ok) throw new Error('Failed to update blog post');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/blogs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/blogs'] });
      toast({ title: "Success", description: "Blog post updated successfully" });
      setShowDialog(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update blog post", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/admin/blogs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/blogs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/blogs'] });
      toast({ title: "Success", description: "Blog post deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete blog post", variant: "destructive" });
    },
  });

  const importRssMutation = useMutation({
    mutationFn: (feedUrl: string) => apiRequest('POST', '/api/admin/blogs/import-rss', { feedUrl }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/blogs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/blogs'] });
      toast({ 
        title: "RSS Import Complete", 
        description: `Imported ${data.imported} posts, skipped ${data.skipped}` 
      });
      setShowRssDialog(false);
      setRssUrl("");
    },
    onError: (error: any) => {
      toast({ 
        title: "Import Failed", 
        description: error.message || "Failed to import RSS feed", 
        variant: "destructive" 
      });
    },
  });

  const syncThumbnailsMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/admin/blogs/sync-thumbnails', {}),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/blogs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/blogs'] });
      toast({ 
        title: "Thumbnails Synced", 
        description: `Updated ${data.updated} blogs, skipped ${data.skipped}` 
      });
      setShowRssDialog(false);
      setRssUrl("");
    },
    onError: (error: any) => {
      toast({ 
        title: "Sync Failed", 
        description: error.message || "Failed to sync thumbnails", 
        variant: "destructive" 
      });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      slug: "",
      excerpt: "",
      content: "",
      coverImageUrl: "",
      category: "general",
      isPublished: false,
      isFeatured: false,
    });
    setEditingBlog(null);
    setImageFile(null);
    setImagePreview(null);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: "Please upload a JPEG, PNG, WebP, or GIF image",
          variant: "destructive",
        });
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setFormData({ ...formData, coverImageUrl: "" });
  };

  const handleEdit = (blog: BlogPost) => {
    setEditingBlog(blog);
    setFormData({
      title: blog.title,
      slug: blog.slug,
      excerpt: blog.excerpt || "",
      content: blog.content,
      coverImageUrl: blog.coverImageUrl || "",
      category: blog.category || "general",
      isPublished: blog.isPublished || false,
      isFeatured: blog.isFeatured || false,
    });
    setImageFile(null);
    setImagePreview(blog.coverImageUrl || null);
    setShowDialog(true);
  };

  const handleSubmit = () => {
    if (!formData.title || !formData.content) {
      toast({ title: "Validation Error", description: "Title and content are required", variant: "destructive" });
      return;
    }

    const data = new FormData();
    data.append('title', formData.title);
    data.append('slug', formData.slug);
    data.append('excerpt', formData.excerpt);
    data.append('content', formData.content);
    data.append('category', formData.category);
    data.append('isPublished', String(formData.isPublished));
    data.append('isFeatured', String(formData.isFeatured));
    
    if (imageFile) {
      data.append('thumbnail', imageFile);
    } else if (formData.coverImageUrl) {
      data.append('coverImageUrl', formData.coverImageUrl);
    }

    if (editingBlog) {
      updateMutation.mutate({ id: editingBlog.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "Not published";
    return new Date(date).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tighter">
            <span className="text-white">Blog</span> <span className="text-ministry-gold-exact">Management</span>
          </h2>
          <p className="text-sm text-white/70 font-medium">Create and manage blog posts</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => setShowRssDialog(true)}
            variant="outline"
            className="bg-ministry-gold-exact text-black border-2 border-black rounded-none font-bold uppercase tracking-wide hover:bg-yellow-400"
            data-testid="button-import-rss"
          >
            <Rss className="w-4 h-4 mr-2" />
            Import RSS
          </Button>
          <Button
            onClick={() => syncThumbnailsMutation.mutate()}
            variant="outline"
            disabled={syncThumbnailsMutation.isPending}
            className="bg-ministry-gold-exact text-black border-2 border-black rounded-none font-bold uppercase tracking-wide hover:bg-yellow-400"
            data-testid="button-sync-thumbnails"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncThumbnailsMutation.isPending ? 'animate-spin' : ''}`} />
            {syncThumbnailsMutation.isPending ? 'Syncing...' : 'Sync Thumbnails'}
          </Button>
          <Button
            onClick={() => {
              resetForm();
              setShowDialog(true);
            }}
            className="bg-black text-white border-2 border-black rounded-none font-bold uppercase tracking-wide hover:bg-gray-800 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.3)]"
            data-testid="button-add-blog"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Blog Post
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="bg-ministry-gold-exact border-2 border-black rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <CardContent className="p-3 flex items-center gap-4">
                <div className="w-16 h-16 bg-black/20 animate-pulse flex-shrink-0"></div>
                <div className="flex-1 animate-pulse space-y-2">
                  <div className="h-4 bg-black/20 w-1/2"></div>
                  <div className="h-3 bg-black/20 w-1/3"></div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <div className="h-8 w-16 bg-black/20 animate-pulse"></div>
                  <div className="h-8 w-8 bg-black/20 animate-pulse"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : blogs.length === 0 ? (
        <Card className="bg-ministry-gold-exact border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-center py-12">
          <CardContent>
            <h3 className="text-xl font-black uppercase tracking-tighter mb-2 text-black">No Blog Posts Yet</h3>
            <p className="text-black/80 font-medium mb-4">
              Create your first blog post or import from an RSS feed.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {blogs.map((blog) => (
            <Card 
              key={blog.id} 
              className={`border-2 border-black rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] ${
                blog.isPublished ? 'bg-ministry-gold-exact' : 'bg-black text-white'
              }`}
            >
              <CardContent className="p-3 flex items-center gap-4">
                <div className={`relative w-16 h-16 flex-shrink-0 overflow-hidden border-2 border-black ${
                  !blog.coverImageUrl ? (blog.isPublished ? 'bg-black' : 'bg-ministry-gold-exact') : ''
                }`}>
                  {blog.coverImageUrl ? (
                    <img
                      src={blog.coverImageUrl}
                      alt={blog.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FileText className={`w-8 h-8 ${blog.isPublished ? 'text-ministry-gold-exact/50' : 'text-black/50'}`} />
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={`font-black text-sm uppercase tracking-tight truncate ${
                      blog.isPublished ? 'text-black' : 'text-white'
                    }`}>
                      {blog.title}
                    </h3>
                    {blog.isFeatured && (
                      <Star className="w-4 h-4 text-black flex-shrink-0" fill="currentColor" />
                    )}
                    {!blog.isPublished && (
                      <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-none font-bold uppercase flex-shrink-0">
                        Draft
                      </span>
                    )}
                  </div>
                  <div className={`text-xs flex items-center gap-3 ${
                    blog.isPublished ? 'text-black/60' : 'text-white/60'
                  }`}>
                    <span className="font-bold uppercase">{blog.category}</span>
                    <span>{formatDate(blog.publishedAt)}</span>
                    {blog.externalSource && (
                      <span className="flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" />
                        RSS
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    onClick={() => handleEdit(blog)}
                    className={`rounded-none border-2 font-bold ${
                      blog.isPublished 
                        ? 'border-black bg-black text-white hover:bg-gray-800' 
                        : 'border-white bg-white text-black hover:bg-gray-200'
                    }`}
                    data-testid={`button-edit-blog-${blog.id}`}
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this blog post?")) {
                        deleteMutation.mutate(blog.id);
                      }
                    }}
                    className="rounded-none border-2 border-black bg-red-600 hover:bg-red-700 text-white"
                    data-testid={`button-delete-blog-${blog.id}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-ministry-gold-exact border-2 border-black rounded-none">
          <DialogHeader>
            <DialogTitle className="font-black text-2xl uppercase tracking-tighter text-black">
              {editingBlog ? "Edit Blog Post" : "Create Blog Post"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="blog-title" className="font-bold uppercase text-black">Title *</Label>
              <Input
                id="blog-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter blog title"
                className="rounded-none border-2 border-black"
                data-testid="input-blog-title"
              />
            </div>

            <div>
              <Label htmlFor="blog-slug" className="font-bold uppercase text-black">Slug (URL path)</Label>
              <Input
                id="blog-slug"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="Auto-generated from title if empty"
                className="rounded-none border-2 border-black"
                data-testid="input-blog-slug"
              />
            </div>

            <div>
              <Label htmlFor="blog-excerpt" className="font-bold uppercase text-black">Excerpt</Label>
              <Textarea
                id="blog-excerpt"
                value={formData.excerpt}
                onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                placeholder="Brief description (shown in previews)"
                rows={2}
                className="rounded-none border-2 border-black"
                data-testid="input-blog-excerpt"
              />
            </div>

            <div>
              <Label htmlFor="blog-content" className="font-bold uppercase text-black">Content *</Label>
              <Textarea
                id="blog-content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Write your blog content here..."
                rows={10}
                className="rounded-none border-2 border-black font-mono"
                data-testid="input-blog-content"
              />
            </div>

            <div>
              <Label htmlFor="blog-thumbnail" className="font-bold uppercase text-black">Thumbnail Image</Label>
              <div className="space-y-3">
                {(imagePreview || formData.coverImageUrl) && (
                  <div className="relative w-full h-40 border-2 border-black overflow-hidden">
                    <img
                      src={imagePreview || formData.coverImageUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={removeImage}
                      className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-none border-2 border-black p-1 h-8 w-8"
                      data-testid="button-remove-thumbnail"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Input
                    id="blog-thumbnail"
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                    onChange={handleImageChange}
                    className="rounded-none border-2 border-black file:mr-2 file:py-1 file:px-3 file:rounded-none file:border-0 file:font-bold file:bg-black file:text-white file:uppercase file:text-xs"
                    data-testid="input-blog-thumbnail"
                  />
                </div>
                {editingBlog && !imageFile && formData.coverImageUrl && (
                  <p className="text-xs text-black/60">Leave empty to keep current image</p>
                )}
                <p className="text-xs text-black/60">Accepted formats: JPEG, PNG, WebP, GIF</p>
              </div>
            </div>

            <div>
              <Label htmlFor="blog-category" className="font-bold uppercase text-black">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger id="blog-category" className="rounded-none border-2 border-black" data-testid="select-blog-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between gap-4 bg-black/10 p-4 rounded-none border-2 border-black">
              <div className="flex items-center space-x-3">
                <Switch
                  id="blog-published"
                  checked={formData.isPublished}
                  onCheckedChange={(checked) => setFormData({ ...formData, isPublished: checked })}
                  data-testid="switch-blog-published"
                />
                <Label htmlFor="blog-published" className="font-bold uppercase text-black">Published</Label>
              </div>
              <div className="flex items-center space-x-3">
                <Switch
                  id="blog-featured"
                  checked={formData.isFeatured}
                  onCheckedChange={(checked) => setFormData({ ...formData, isFeatured: checked })}
                  data-testid="switch-blog-featured"
                />
                <Label htmlFor="blog-featured" className="font-bold uppercase text-black">Featured</Label>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              className="rounded-none border-2 border-black text-black hover:bg-black hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-black text-white rounded-none border-2 border-black hover:bg-gray-800 shadow-[3px_3px_0px_0px_rgba(252,208,0,1)]"
              data-testid="button-save-blog"
            >
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save Blog Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRssDialog} onOpenChange={setShowRssDialog}>
        <DialogContent className="bg-ministry-gold-exact border-2 border-black rounded-none">
          <DialogHeader>
            <DialogTitle className="font-black text-2xl uppercase tracking-tighter text-black">
              Import From RSS Feed
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-black/70 font-medium">
              Import blog posts from Ignite Church RSS feed. Duplicate posts (by GUID) will be skipped.
            </p>
            
            <div className="bg-black/10 p-3 border-2 border-black">
              <Label className="font-bold uppercase text-black text-xs">Ignite Church Feed (Default)</Label>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-xs bg-white px-2 py-1 border border-black flex-1 truncate">
                  {IGNITE_CHURCH_RSS_URL}
                </code>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setRssUrl(IGNITE_CHURCH_RSS_URL)}
                  className="bg-black text-white rounded-none text-xs hover:bg-gray-800"
                  data-testid="button-use-ignite-rss"
                >
                  Use This
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="rss-url" className="font-bold uppercase text-black">RSS Feed URL *</Label>
              <Input
                id="rss-url"
                value={rssUrl}
                onChange={(e) => setRssUrl(e.target.value)}
                placeholder="https://example.com/feed.xml"
                className="rounded-none border-2 border-black"
                data-testid="input-rss-url"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowRssDialog(false)}
              className="rounded-none border-2 border-black text-black hover:bg-black hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={() => importRssMutation.mutate(rssUrl)}
              disabled={!rssUrl || importRssMutation.isPending}
              className="bg-black text-white rounded-none border-2 border-black hover:bg-gray-800 shadow-[3px_3px_0px_0px_rgba(252,208,0,1)]"
              data-testid="button-import-rss-confirm"
            >
              {importRssMutation.isPending ? "Importing..." : "Import Posts"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
