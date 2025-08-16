import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DiscussionCard from "@/components/discussion-card";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertDiscussionSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Plus, Users, BookOpen, Heart, MessageCircle, Lightbulb, ArrowUpDown, Search, X } from "lucide-react";
import { z } from "zod";

const categories = [
  { id: 'leadership', label: 'Leadership', icon: BookOpen },
  { id: 'marriage', label: 'Marriage', icon: Heart },
  { id: 'parenting', label: 'Parenting', icon: Users },
  { id: 'faith', label: 'Faith', icon: Lightbulb },
  { id: 'studies', label: 'Study Discussions', icon: MessageCircle },
];

const createDiscussionSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  category: z.string().min(1, "Category is required"),
});

export default function Community() {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('recent');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showNewGroupDialog, setShowNewGroupDialog] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedDiscussion, setHighlightedDiscussion] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Handle discussion query parameter from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const discussionId = urlParams.get('discussion');
    if (discussionId) {
      setHighlightedDiscussion(discussionId);
      // Scroll to the highlighted discussion after discussions load
      setTimeout(() => {
        const element = document.querySelector(`[data-discussion-id="${discussionId}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 1000);
    }
  }, []);

  const { data: discussions = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/discussions", selectedCategory || undefined, sortBy, searchQuery || undefined],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory) params.append('category', selectedCategory);
      if (sortBy) params.append('sortBy', sortBy);
      if (searchQuery) params.append('search', searchQuery);
      
      const url = `/api/discussions${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      
      if (!response.ok) {
        throw new Error('Failed to fetch discussions');
      }
      
      return response.json();
    },
    retry: false,
  });

  const form = useForm({
    resolver: zodResolver(createDiscussionSchema),
    defaultValues: {
      title: '',
      content: '',
      category: 'leadership',
    },
  });

  const createDiscussion = useMutation({
    mutationFn: async (data: z.infer<typeof createDiscussionSchema>) => {
      const response = await apiRequest('POST', '/api/discussions', data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discussions"] });
      toast({
        title: "Success",
        description: "Discussion created successfully!",
      });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      console.error("Discussion creation error:", error);
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
      toast({
        title: "Error",
        description: `Failed to create discussion: ${error.message || 'Please try again.'}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: { title: string; content: string; category: string }) => {
    if (!(user as any)?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to create a discussion",
        variant: "destructive",
      });
      return;
    }
    
    const discussionData = {
      title: data.title.trim(),
      content: data.content.trim(),
      category: data.category,
      userId: (user as any).id,
    };
    
    await createDiscussion.mutateAsync(discussionData);
  };

  // Create direct conversation mutation for profile interactions
  const createDirectConversationMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      return await apiRequest("POST", "/api/conversations/direct", { targetUserId });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Direct message started successfully! Check your Messages page.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start conversation",
        variant: "destructive",
      });
    },
  });

  // Create group conversation mutation
  const createGroupConversationMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; participantIds: string[] }) => {
      return await apiRequest("POST", "/api/conversations/group", data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Group chat created successfully! Check your Messages page.",
      });
      setShowNewGroupDialog(false);
      setGroupName("");
      setGroupDescription("");
      setSelectedUsers([]);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create group",
        variant: "destructive",
      });
    },
  });

  const handleStartDirectMessage = (userId: string) => {
    createDirectConversationMutation.mutate(userId);
  };

  const handleAddToGroup = (userId: string) => {
    if (!selectedUsers.includes(userId)) {
      setSelectedUsers([...selectedUsers, userId]);
    }
    setShowNewGroupDialog(true);
  };

  const handleCreateGroup = () => {
    if (!groupName.trim() || selectedUsers.length === 0) {
      toast({
        title: "Error",
        description: "Please provide a group name and select at least one member",
        variant: "destructive",
      });
      return;
    }

    createGroupConversationMutation.mutate({
      name: groupName,
      description: groupDescription,
      participantIds: selectedUsers,
    });
  };

  // Mock community stats
  const stats = {
    totalMembers: 1247,
    activeToday: 456,
    newPosts: 23,
  };

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-ministry-navy to-ministry-charcoal text-white px-6 pt-12 pb-6">
        <h1 className="text-2xl font-bold mb-2" data-testid="text-community-title">Community</h1>
        <p className="text-blue-200 text-sm" data-testid="text-community-subtitle">
          Iron sharpens iron among brothers
        </p>
      </div>

      {/* Community Stats */}
      <div className="px-6 -mt-3 relative z-10 mb-6">
        <Card className="shadow-lg" data-testid="card-stats">
          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-ministry-navy" data-testid="text-total-members">
                  {stats.totalMembers.toLocaleString()}
                </p>
                <p className="text-xs text-ministry-slate">Members</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-ministry-steel" data-testid="text-active-today">
                  {stats.activeToday}
                </p>
                <p className="text-xs text-ministry-slate">Active Today</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-ministry-success" data-testid="text-new-posts">
                  {stats.newPosts}
                </p>
                <p className="text-xs text-ministry-slate">New Posts</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="px-6 mb-6">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="w-full bg-ministry-gold text-ministry-navy py-4 rounded-2xl font-bold shadow-lg hover:bg-ministry-gold/90 flex items-center justify-center space-x-2"
              data-testid="button-new-discussion"
            >
              <Plus className="w-5 h-5" />
              <span>Start New Discussion</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md mx-auto" data-testid="dialog-new-discussion">
            <DialogHeader>
              <DialogTitle>Start New Discussion</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form 
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="What would you like to discuss?"
                          {...field}
                          data-testid="input-discussion-title"
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
                          <SelectTrigger data-testid="select-discussion-category">
                            <SelectValue placeholder="Select a category" />
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

                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Content</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Share your thoughts..."
                          className="min-h-[100px]"
                          {...field}
                          data-testid="textarea-discussion-content"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    className="flex-1"
                    data-testid="button-cancel-discussion"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createDiscussion.isPending}
                    className="flex-1 bg-ministry-navy hover:bg-ministry-charcoal"
                    data-testid="button-create-discussion"
                  >
                    {createDiscussion.isPending ? "Creating..." : "Create"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Discussion Categories */}
      <div className="px-6 mb-6">
        <h2 className="text-lg font-bold text-ministry-charcoal mb-4">Popular Topics</h2>
        
        <div className="grid grid-cols-2 gap-3">
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <Button
                key={category.id}
                variant="outline"
                onClick={() => setSelectedCategory(selectedCategory === category.id ? '' : category.id)}
                className={`h-auto p-4 border-gray-100 hover:shadow-sm ${
                  selectedCategory === category.id ? 'bg-ministry-steel/10 border-ministry-steel' : ''
                }`}
                data-testid={`button-category-${category.id}`}
              >
                <div className="flex items-center space-x-3 w-full">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    selectedCategory === category.id ? 'bg-ministry-steel/20' : 'bg-ministry-steel/20'
                  }`}>
                    <Icon className="w-5 h-5 text-ministry-steel" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-sm text-ministry-charcoal">{category.label}</h3>
                    <p className="text-xs text-ministry-slate">
                      {Math.floor(Math.random() * 200) + 50} posts
                    </p>
                  </div>
                </div>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-6 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-ministry-slate w-4 h-4" />
          <Input
            placeholder="Search discussions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Recent Discussions */}
      <div className="px-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-ministry-charcoal">
            {searchQuery ? `Search Results for "${searchQuery}"` : 'Recent Discussions'}
          </h2>
          <div className="flex items-center space-x-2">
            <ArrowUpDown className="w-4 h-4 text-ministry-slate" />
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-32" data-testid="select-sort-by">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Recent</SelectItem>
                <SelectItem value="likes">Most Liked</SelectItem>
                <SelectItem value="replies">Most Replies</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ministry-navy mx-auto mb-4"></div>
            <p className="text-ministry-slate">Loading discussions...</p>
          </div>
        ) : discussions.length === 0 ? (
          <div className="text-center py-8" data-testid="empty-discussions">
            <MessageCircle className="w-12 h-12 text-ministry-slate mx-auto mb-4" />
            <p className="text-ministry-slate mb-4">No discussions yet</p>
            <p className="text-sm text-ministry-slate">Be the first to start a conversation!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {discussions.map((discussion: any) => (
              <div 
                key={discussion.id}
                data-discussion-id={discussion.id}
                className={highlightedDiscussion === discussion.id ? 'ring-2 ring-ministry-gold ring-opacity-50 rounded-lg' : ''}
              >
                <DiscussionCard 
                  discussion={discussion}
                  onStartDirectMessage={handleStartDirectMessage}
                  onAddToGroup={handleAddToGroup}
                  currentUserTier={(user as any)?.subscriptionTier || 'free'}
                  data-testid={`discussion-${discussion.id}`}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
