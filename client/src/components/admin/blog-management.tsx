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
import { Edit, Trash2, Plus, Eye, EyeOff, Rss, ExternalLink, Star } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { BlogPost } from "@shared/schema";

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
    mutationFn: (data: any) => apiRequest('POST', '/api/admin/blogs', data),
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
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      apiRequest('PUT', `/api/admin/blogs/${id}`, data),
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
    setShowDialog(true);
  };

  const handleSubmit = () => {
    if (!formData.title || !formData.content) {
      toast({ title: "Validation Error", description: "Title and content are required", variant: "destructive" });
      return;
    }

    if (editingBlog) {
      updateMutation.mutate({ id: editingBlog.id, data: formData });
    } else {
      createMutation.mutate(formData);
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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tighter text-black">Blog Management</h2>
          <p className="text-sm text-black/70 font-medium">Create and manage blog posts</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowRssDialog(true)}
            variant="outline"
            className="bg-black text-white border-2 border-black rounded-none font-bold uppercase tracking-wide hover:bg-gray-800"
            data-testid="button-import-rss"
          >
            <Rss className="w-4 h-4 mr-2" />
            Import RSS
          </Button>
          <Button
            onClick={() => {
              resetForm();
              setShowDialog(true);
            }}
            className="bg-ministry-gold-exact text-black border-2 border-black rounded-none font-bold uppercase tracking-wide hover:bg-yellow-400 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
            data-testid="button-add-blog"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Blog Post
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="bg-ministry-gold-exact border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <CardContent className="p-4">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-black/20 rounded-none w-3/4"></div>
                  <div className="h-3 bg-black/20 rounded-none w-full"></div>
                  <div className="h-3 bg-black/20 rounded-none w-2/3"></div>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {blogs.map((blog) => (
            <Card 
              key={blog.id} 
              className={`border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${
                blog.isPublished ? 'bg-ministry-gold-exact' : 'bg-black text-white'
              }`}
            >
              {blog.coverImageUrl && (
                <div className="relative h-32 overflow-hidden border-b-2 border-black">
                  <img
                    src={blog.coverImageUrl}
                    alt={blog.title}
                    className="w-full h-full object-cover"
                  />
                  {blog.isFeatured && (
                    <div className="absolute top-2 right-2 bg-ministry-gold-exact text-black px-2 py-1 rounded-none text-xs font-black uppercase border border-black">
                      <Star className="w-3 h-3 inline mr-1" />
                      Featured
                    </div>
                  )}
                </div>
              )}
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className={`font-black text-lg uppercase tracking-tight line-clamp-2 ${
                    blog.isPublished ? 'text-black' : 'text-white'
                  }`}>
                    {blog.title}
                  </h3>
                  {!blog.isPublished && (
                    <span className="text-xs bg-white/20 text-white px-2 py-1 rounded-none font-bold uppercase">
                      Draft
                    </span>
                  )}
                </div>
                
                {blog.excerpt && (
                  <p className={`text-sm mb-3 line-clamp-2 ${
                    blog.isPublished ? 'text-black/70' : 'text-white/70'
                  }`}>
                    {blog.excerpt}
                  </p>
                )}
                
                <div className={`text-xs mb-3 space-y-1 ${
                  blog.isPublished ? 'text-black/60' : 'text-white/60'
                }`}>
                  <div>Category: <span className="font-bold uppercase">{blog.category}</span></div>
                  <div>Published: {formatDate(blog.publishedAt)}</div>
                  {blog.externalSource && (
                    <div className="flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" />
                      <span>Imported from RSS</span>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(blog)}
                    className={`rounded-none border-2 ${
                      blog.isPublished 
                        ? 'border-black text-black hover:bg-black hover:text-white' 
                        : 'border-white text-white hover:bg-white hover:text-black'
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
                    className="rounded-none border-2 border-black bg-red-600 hover:bg-red-700"
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
              <Label htmlFor="blog-cover" className="font-bold uppercase text-black">Cover Image URL</Label>
              <Input
                id="blog-cover"
                value={formData.coverImageUrl}
                onChange={(e) => setFormData({ ...formData, coverImageUrl: e.target.value })}
                placeholder="https://example.com/image.jpg"
                className="rounded-none border-2 border-black"
                data-testid="input-blog-cover"
              />
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
              Enter an RSS feed URL to import blog posts. Duplicate posts (by GUID) will be skipped.
            </p>
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
