import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { Plus, Users, BookOpen, Heart, MessageCircle, Lightbulb, ArrowUpDown, Search, X, Send, Hash } from "lucide-react";
import { HonorButton } from "@/components/honor-button";
import { z } from "zod";
import { DiscussionSubscriptionButton } from "@/components/discussion-subscription-button";

// Categories for display/filtering (includes all categories)
const allCategories = [
  { id: 'leadership', label: 'Leadership', icon: BookOpen },
  { id: 'marriage', label: 'Marriage', icon: Heart },
  { id: 'parenting', label: 'Parenting', icon: Users },
  { id: 'faith', label: 'Faith', icon: Lightbulb },
  { id: 'studies', label: 'Study Discussions', icon: MessageCircle },
  { id: 'miscellaneous', label: 'Miscellaneous', icon: Hash },
];

// Categories for discussion creation (excludes study discussions)
const creationCategories = [
  { id: 'leadership', label: 'Leadership', icon: BookOpen },
  { id: 'marriage', label: 'Marriage', icon: Heart },
  { id: 'parenting', label: 'Parenting', icon: Users },
  { id: 'faith', label: 'Faith', icon: Lightbulb },
  { id: 'miscellaneous', label: 'Miscellaneous', icon: Hash },
];

const createDiscussionSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  category: z.string().min(1, "Category is required"),
});

const replySchema = z.object({
  content: z.string().min(1, "Reply content is required"),
});

// Component for displaying discussion replies
function DiscussionReplies({ discussionId }: { discussionId: string }) {
  const { data: replies = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/discussions", discussionId, "replies"],
    retry: false,
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
  });

  if (isLoading) {
    return (
      <div className="text-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-ministry-navy mx-auto mb-2"></div>
        <p className="text-sm text-ministry-slate">Loading replies...</p>
      </div>
    );
  }

  if (replies.length === 0) {
    return (
      <div className="text-center py-8">
        <MessageCircle className="w-8 h-8 text-ministry-slate mx-auto mb-2" />
        <p className="text-ministry-slate">No replies yet</p>
        <p className="text-sm text-ministry-slate">Be the first to reply!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {replies.map((reply: any) => (
        <div key={reply.id} className="flex items-start space-x-3 p-3 bg-ministry-gold-exact/10 rounded-lg">
          <img 
            src={reply.user?.profileImageUrl || `https://ui-avatars.com/api/?name=${reply.user?.firstName}+${reply.user?.lastName}&background=4A90B8&color=fff&size=32`}
            alt={`${reply.user?.firstName} ${reply.user?.lastName}`}
            className="w-8 h-8 rounded-full object-cover"
          />
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <span className="font-medium text-sm text-ministry-charcoal">
                {reply.user?.firstName} {reply.user?.lastName?.charAt(0)}.
              </span>
              <span className="text-xs text-ministry-slate">
                • {getTimeAgo(reply.createdAt)}
              </span>
            </div>
            <p className="text-sm text-ministry-slate">{reply.content}</p>
            <div className="mt-2">
              <HonorButton
                type="reply"
                id={reply.id}
                initialCount={reply.likes || 0}
                variant="ghost"
                size="sm"
                showText={true}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Component for adding new replies
function DiscussionReplyForm({ discussionId, currentUserTier, discussion }: { 
  discussionId: string; 
  currentUserTier: string; 
  discussion: any;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm({
    resolver: zodResolver(replySchema),
    defaultValues: {
      content: '',
    },
  });

  const createReply = useMutation({
    mutationFn: async (data: z.infer<typeof replySchema>) => {
      const response = await apiRequest('POST', `/api/discussions/${discussionId}/replies`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discussions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/discussions", discussionId, "replies"] });
      toast({
        title: "Success",
        description: "Reply posted successfully!",
      });
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to post reply: ${error.message || 'Please try again.'}`,
        variant: "destructive",
      });
    },
  });

  const onSubmitReply = async (data: z.infer<typeof replySchema>) => {
    if (!(user as any)?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to reply",
        variant: "destructive",
      });
      return;
    }
    
    // Check tier access for study discussions
    if (discussion.studyId && discussion.study?.requiredTier && discussion.study.requiredTier !== 'free') {
      const hasAccess = (discussion.study.requiredTier === 'premium' && ['premium', 'vip'].includes(currentUserTier)) ||
                       (discussion.study.requiredTier === 'vip' && currentUserTier === 'vip');
      
      if (!hasAccess) {
        toast({
          title: "Access Restricted",
          description: `This study discussion requires ${discussion.study.requiredTier} subscription to participate.`,
          variant: "destructive",
        });
        return;
      }
    }
    
    await createReply.mutateAsync(data);
  };

  // Check if user has access to reply
  const hasReplyAccess = discussion.studyId && discussion.study?.requiredTier && discussion.study.requiredTier !== 'free' ?
    ((discussion.study.requiredTier === 'premium' && ['premium', 'vip'].includes(currentUserTier)) ||
     (discussion.study.requiredTier === 'vip' && currentUserTier === 'vip')) : true;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmitReply)} className="space-y-3">
        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Textarea
                  placeholder={hasReplyAccess ? "Write your reply..." : `${discussion.study?.requiredTier || 'Premium'} subscription required to reply`}
                  className="min-h-[80px] resize-none"
                  disabled={!hasReplyAccess || createReply.isPending}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={createReply.isPending || !hasReplyAccess}
            style={{
              backgroundColor: 'hsl(0 0% 0%)',
              color: 'white',
              border: '1px solid hsl(0 0% 0%)',
              borderRadius: '0.375rem',
              padding: '0.375rem 0.75rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              cursor: (createReply.isPending || !hasReplyAccess) ? 'default' : 'pointer',
              opacity: (createReply.isPending || !hasReplyAccess) ? 0.6 : 1,
              transition: 'opacity 0.2s'
            }}
          >
            <Send className="w-3 h-3" />
            {createReply.isPending ? "Posting..." : "Post Reply"}
          </button>
        </div>
      </form>
    </Form>
  );
}

// Helper function for time formatting (moved to top level)
function getTimeAgo(date: string) {
  const now = new Date();
  const posted = new Date(date);
  const diffInHours = Math.floor((now.getTime() - posted.getTime()) / (1000 * 60 * 60));
  
  if (diffInHours < 1) return 'Just now';
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
}

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

  // Fetch real community stats with live updates
  const { data: communityStats } = useQuery<{
    totalMembers: number;
    activeToday: number;
    newPosts: number;
    categoryStats: { [key: string]: number };
  }>({
    queryKey: ["/api/community/stats"],
    retry: false,
    refetchInterval: 10000, // Refetch every 10 seconds for live updates
    refetchIntervalInBackground: true, // Continue refetching when tab is not focused
  });

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
    refetchInterval: 5000, // Real-time updates every 5 seconds
    refetchIntervalInBackground: true,
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

  // Use real community stats
  const stats = {
    totalMembers: communityStats?.totalMembers || 0,
    activeToday: communityStats?.activeToday || 0,
    newPosts: communityStats?.newPosts || 0,
  };

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-ministry-navy to-ministry-charcoal dark:from-header-dark dark:to-ministry-navy text-white px-6 pt-12 pb-6">
        <h1 className="text-2xl font-bold mb-2" data-testid="text-community-title">Community</h1>
        <p className="text-blue-200 text-sm" data-testid="text-community-subtitle">
          Iron sharpens iron among brothers
        </p>
      </div>

      {/* Community Stats */}
      <div className="px-6 -mt-3 relative z-10 mb-6">
        <Card className="shadow-lg bg-ministry-gold-exact" data-testid="card-stats">
          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-black" data-testid="text-total-members">
                  {stats.totalMembers.toLocaleString()}
                </p>
                <p className="text-xs text-black">Members</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-black" data-testid="text-active-today">
                  {stats.activeToday}
                </p>
                <p className="text-xs text-black">Active Today</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-black" data-testid="text-new-posts">
                  {stats.newPosts}
                </p>
                <p className="text-xs text-black">New Posts</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="px-6 mb-6">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <button 
              className="w-full py-4 rounded-2xl font-bold shadow-lg flex items-center justify-center space-x-2"
              data-testid="button-new-discussion"
              style={{
                backgroundColor: 'hsl(49 100% 49%)', // ministry-gold
                color: 'black',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'hsl(49 100% 44%)'; // hover effect
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'hsl(49 100% 49%)'; // back to normal
              }}
            >
              <Plus className="w-5 h-5" />
              <span>Start New Discussion</span>
            </button>
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
                          {creationCategories.map((category) => (
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
        <h2 className="text-lg font-bold text-white mb-4">Popular Topics</h2>
        
        <div className="grid grid-cols-2 gap-3">
          {allCategories.map((category) => {
            const Icon = category.icon;
            return (
              <Button
                key={category.id}
                variant="outline"
                onClick={() => setSelectedCategory(selectedCategory === category.id ? '' : category.id)}
                className={`h-auto p-4 bg-ministry-gold-exact hover:bg-ministry-gold-exact/30 hover:shadow-md transition-all border-0 ${
                  selectedCategory === category.id ? 'ring-2 ring-ministry-gold bg-ministry-gold-exact/30' : ''
                }`}
                data-testid={`button-category-${category.id}`}
              >
                <div className="flex items-center space-x-3 w-full">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    selectedCategory === category.id ? 'bg-ministry-gold' : 'bg-ministry-gold-exact/40'
                  }`}>
                    <Icon className="w-5 h-5 text-black" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-sm text-black">{category.label}</h3>
                    <p className="text-xs text-black">
                      {communityStats?.categoryStats[category.id] || 0} posts
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
            className="pl-10 pr-10 border-white"
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
          <h2 className="text-lg font-bold text-white">
            {searchQuery ? `Search Results for "${searchQuery}"` : 'Recent Discussions'}
          </h2>
          <div className="flex items-center space-x-2">
            <ArrowUpDown className="w-4 h-4 text-ministry-slate" />
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-32 border-white" data-testid="select-sort-by">
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
                className={`${highlightedDiscussion === discussion.id ? 'ring-2 ring-ministry-gold ring-opacity-50 rounded-lg' : ''}`}
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
