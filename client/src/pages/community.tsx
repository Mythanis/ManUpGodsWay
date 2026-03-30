import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { triggerRefTagger } from "@/hooks/useRefTagger";
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
import { BackButton } from "@/components/BackButton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertDiscussionSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { getTierDisplayName } from "@/lib/utils";
import { Plus, Users, Heart, MessageCircle, ArrowUpDown, Search, X, Send, Image, Video, Trash2, Bold, Italic, Underline, Strikethrough } from "lucide-react";
import { HonorButton } from "@/components/honor-button";
import { z } from "zod";
import { DiscussionSubscriptionButton } from "@/components/discussion-subscription-button";


const createDiscussionSchema = z.object({
  title: z.string().optional(),
  content: z.string().min(1, "Content is required"),
  category: z.string().optional(),
  mediaUrls: z.array(z.string()).optional(),
  mediaTypes: z.array(z.string()).optional(),
  postType: z.string().optional(),
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
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-ministry-gold-exact mx-auto mb-2"></div>
        <p className="text-xs text-white/50">Loading replies...</p>
      </div>
    );
  }

  if (replies.length === 0) {
    return (
      <div className="text-center py-4">
        <MessageCircle className="w-6 h-6 text-white/30 mx-auto mb-1" />
        <p className="text-white/50 text-xs">No replies yet</p>
        <p className="text-xs text-ministry-gold-exact">Be the first to reply!</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {replies.map((reply: any) => (
        <div key={reply.id} className="flex items-start space-x-2 p-2 bg-white rounded-sm border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <img 
            src={reply.user?.profileImageUrl || `https://ui-avatars.com/api/?name=${reply.user?.firstName}+${reply.user?.lastName}&background=000&color=FCD000&size=32`}
            alt={`${reply.user?.firstName} ${reply.user?.lastName}`}
            className="w-7 h-7 rounded-sm object-cover border-2 border-black"
          />
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <span className="font-bold text-xs text-black uppercase">
                {reply.user?.firstName} {reply.user?.lastName?.charAt(0)}.
              </span>
              <span className="text-xs text-black/50">
                • {getTimeAgo(reply.createdAt)}
              </span>
            </div>
            <p className="text-xs text-black">{reply.content}</p>
            <div className="mt-1">
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
function DiscussionReplyForm({ discussionId, currentUserSubscriptionStatus, discussion }: { 
  discussionId: string; 
  currentUserSubscriptionStatus: string; 
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
    
    if (discussion.studyId && discussion.study?.requiredTier && discussion.study.requiredTier !== 'free') {
      if (currentUserSubscriptionStatus !== 'active') {
        toast({
          title: "Access Restricted",
          description: "This study discussion requires an active subscription to participate.",
          variant: "destructive",
        });
        return;
      }
    }
    
    await createReply.mutateAsync(data);
  };

  // Check if user has access to reply
  const hasReplyAccess = discussion.studyId && discussion.study?.requiredTier && discussion.study.requiredTier !== 'free' ?
    currentUserSubscriptionStatus === 'active' : true;

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
                  placeholder={hasReplyAccess ? "Write your reply..." : "Subscription required to reply"}
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
  const [sortBy, setSortBy] = useState<string>('recent');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showNewGroupDialog, setShowNewGroupDialog] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedDiscussion, setHighlightedDiscussion] = useState<string | null>(null);
  const [uploadedMedia, setUploadedMedia] = useState<{ urls: string[]; types: string[] }>({ urls: [], types: [] });
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    queryKey: ["/api/discussions", sortBy, searchQuery || undefined],
    queryFn: async () => {
      const params = new URLSearchParams();
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
  
  useEffect(() => {
    if (discussions.length > 0) {
      triggerRefTagger();
    }
  }, [discussions]);

  const isAdmin = (user as any)?.role === 'admin' || (user as any)?.role === 'owner';
  const contentEditableRef = useRef<HTMLDivElement>(null);

  const normalizeHtml = (html: string) =>
    html.replace(/&nbsp;/g, ' ').replace(/\u00a0/g, ' ').trim();

  const applyFormat = (command: string) => {
    contentEditableRef.current?.focus();
    document.execCommand(command, false);
    const html = normalizeHtml(contentEditableRef.current?.innerHTML || '');
    form.setValue('content', html, { shouldValidate: true });
  };

  const form = useForm({
    resolver: zodResolver(createDiscussionSchema),
    defaultValues: {
      title: '',
      content: '',
      category: 'miscellaneous',
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

  // Handle media file upload
  const handleMediaUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    setIsUploading(true);
    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('media', file);
    });
    
    try {
      const response = await fetch('/api/community/upload-media', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      
      if (!response.ok) throw new Error('Failed to upload media');
      
      const result = await response.json();
      setUploadedMedia({
        urls: [...uploadedMedia.urls, ...result.mediaUrls],
        types: [...uploadedMedia.types, ...result.mediaTypes],
      });
      toast({
        title: "Success",
        description: `${files.length} file(s) uploaded successfully!`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to upload media. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  const removeMedia = (index: number) => {
    setUploadedMedia({
      urls: uploadedMedia.urls.filter((_, i) => i !== index),
      types: uploadedMedia.types.filter((_, i) => i !== index),
    });
  };

  const onSubmit = async (data: { title?: string; content: string; category?: string }) => {
    if (!(user as any)?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to create a discussion",
        variant: "destructive",
      });
      return;
    }

    const plainContent = data.content.replace(/<[^>]+>/g, '').trim();
    const autoTitle = plainContent.slice(0, 60) + (plainContent.length > 60 ? '...' : '') || 'Post';
    
    const discussionData = {
      title: autoTitle,
      content: normalizeHtml(data.content),
      category: 'miscellaneous',
      userId: (user as any).id,
      mediaUrls: uploadedMedia.urls.length > 0 ? uploadedMedia.urls : undefined,
      mediaTypes: uploadedMedia.types.length > 0 ? uploadedMedia.types : undefined,
      postType: uploadedMedia.urls.length > 0 ? 'media' : 'text',
    };
    
    await createDiscussion.mutateAsync(discussionData);
    setUploadedMedia({ urls: [], types: [] });
    if (contentEditableRef.current) contentEditableRef.current.innerHTML = '';
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
      <div className="liquid-header text-white px-6 pt-12 pb-6">
        <BackButton />
        <h1 className="text-4xl font-black mb-2 tracking-tighter uppercase" data-testid="text-community-title">Community</h1>
        <p className="text-[#FCD000] text-xs font-bold tracking-widest uppercase" data-testid="text-community-subtitle">
          Iron Sharpens Iron Among Brothers
        </p>
      </div>

      {/* Community Stats */}
      <div className="px-6 -mt-3 relative z-10 mb-4">
        <Card className="shadow-[3px_3px_0px_0px_rgba(252,208,0,1)] liquid-black-white border-2 border-ministry-gold-exact rounded-sm" data-testid="card-stats">
          <CardContent className="p-3 relative z-10">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="border-r border-ministry-gold-exact/30">
                <p className="text-xl font-black text-ministry-gold-exact" data-testid="text-total-members">
                  {stats.totalMembers.toLocaleString()}
                </p>
                <p className="text-xs text-white font-bold uppercase tracking-wide">Members</p>
              </div>
              <div className="border-r border-ministry-gold-exact/30">
                <p className="text-xl font-black text-ministry-gold-exact" data-testid="text-active-today">
                  {stats.activeToday}
                </p>
                <p className="text-xs text-white font-bold uppercase tracking-wide">Active</p>
              </div>
              <div>
                <p className="text-xl font-black text-ministry-gold-exact" data-testid="text-new-posts">
                  {stats.newPosts}
                </p>
                <p className="text-xs text-white font-bold uppercase tracking-wide">Posts</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Facebook-style Quick Post Card */}
      <div className="px-6 mb-4">
        <Card className="shadow-[4px_4px_0px_0px_rgba(252,208,0,0.5)] liquid-black border-2 border-ministry-gold-exact rounded-sm" data-testid="card-quick-post">
          <CardContent className="p-3">
            <div className="flex items-center gap-0">
              <button
                onClick={() => setDialogOpen(true)}
                className="w-full text-left px-4 py-2.5 rounded-sm bg-white text-gray-500 hover:bg-gray-100 transition-colors text-sm font-medium uppercase tracking-wide border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                data-testid="button-quick-post"
              >
                <span className="block text-black font-black">Post Here</span>
                <span className="block text-gray-400 text-xs">How is God shaping you right now?</span>
              </button>
            </div>
            <div className="flex justify-between mt-3 pt-3 border-t-2 border-gray-700">
              <button 
                onClick={() => { setDialogOpen(true); }}
                className="flex items-center gap-2 px-4 py-1.5 rounded-sm hover:bg-gray-800 transition-colors text-gray-300 text-xs font-bold uppercase tracking-wide"
                data-testid="button-quick-photo"
              >
                <Image className="w-5 h-5 text-green-500" />
                <span>Photo</span>
              </button>
              <button 
                onClick={() => { setDialogOpen(true); }}
                className="flex items-center gap-2 px-4 py-1.5 rounded-sm hover:bg-gray-800 transition-colors text-gray-300 text-xs font-bold uppercase tracking-wide"
                data-testid="button-quick-video"
              >
                <Video className="w-5 h-5 text-red-500" />
                <span>Video</span>
              </button>
              <button 
                onClick={() => setDialogOpen(true)}
                className="flex items-center gap-2 px-4 py-1.5 rounded-sm hover:bg-gray-800 transition-colors text-gray-300 text-xs font-bold uppercase tracking-wide"
                data-testid="button-quick-post-btn"
              >
                <Plus className="w-5 h-5 text-ministry-gold" />
                <span>Post</span>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>


      {/* Post Dialog */}
      <div className="px-6">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md mx-auto bg-[#FCD000] border-2 border-black rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-visible" data-testid="dialog-new-discussion">
            <DialogHeader>
              <DialogTitle className="text-black text-xl font-black uppercase tracking-tight">Create Post</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form 
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div>
                          {isAdmin && (
                            <div className="flex items-center gap-1 mb-1.5 p-1 bg-black/10 rounded-sm border border-black/20">
                              {[
                                { cmd: 'bold', Icon: Bold, title: 'Bold' },
                                { cmd: 'italic', Icon: Italic, title: 'Italic' },
                                { cmd: 'underline', Icon: Underline, title: 'Underline' },
                                { cmd: 'strikeThrough', Icon: Strikethrough, title: 'Strikethrough' },
                              ].map(({ cmd, Icon, title }) => (
                                <button
                                  key={cmd}
                                  type="button"
                                  title={title}
                                  onMouseDown={(e) => { e.preventDefault(); applyFormat(cmd); }}
                                  className="p-1.5 rounded hover:bg-black/15 text-black/70 hover:text-black transition-colors"
                                  data-testid={`button-format-${cmd}`}
                                >
                                  <Icon className="w-3.5 h-3.5" />
                                </button>
                              ))}
                              <span className="ml-auto text-[10px] text-black/40 font-bold uppercase tracking-wide pr-1">Admin Styling</span>
                            </div>
                          )}
                          {isAdmin ? (
                            <div
                              ref={contentEditableRef}
                              contentEditable
                              suppressContentEditableWarning
                              onInput={() => {
                                const html = normalizeHtml(contentEditableRef.current?.innerHTML || '');
                                form.setValue('content', html, { shouldValidate: true });
                              }}
                              data-placeholder="Share your thoughts, photos, videos, or memes..."
                              className="min-h-[100px] bg-white border-2 border-black text-black rounded-sm p-2.5 text-sm leading-relaxed focus:outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
                              data-testid="div-discussion-content"
                            />
                          ) : (
                            <Textarea
                              placeholder="Share your thoughts, photos, videos, or memes..."
                              className="min-h-[100px] bg-white border-2 border-black text-black placeholder:text-gray-500 rounded-sm"
                              {...field}
                              data-testid="textarea-discussion-content"
                            />
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Media Upload Section */}
                <div className="space-y-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleMediaUpload}
                    accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm"
                    multiple
                    className="hidden"
                    data-testid="input-media-upload"
                  />
                  
                  {/* Media Upload Buttons */}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="bg-black border-2 border-black text-white hover:bg-gray-800 rounded-sm font-bold uppercase"
                      data-testid="button-add-photo"
                    >
                      <Image className="w-4 h-4 mr-2" />
                      Photo
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="bg-black border-2 border-black text-white hover:bg-gray-800 rounded-sm font-bold uppercase"
                      data-testid="button-add-video"
                    >
                      <Video className="w-4 h-4 mr-2" />
                      Video
                    </Button>
                  </div>
                  
                  {/* Uploading indicator */}
                  {isUploading && (
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-ministry-gold"></div>
                      Uploading...
                    </div>
                  )}
                  
                  {/* Media Preview */}
                  {uploadedMedia.urls.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {uploadedMedia.urls.map((url, index) => (
                        <div key={index} className="relative group">
                          {uploadedMedia.types[index] === 'video' ? (
                            <video 
                              src={url} 
                              className="w-full h-20 object-cover rounded-lg"
                            />
                          ) : (
                            <img 
                              src={url} 
                              alt={`Upload ${index + 1}`}
                              className="w-full h-20 object-cover rounded-lg"
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => removeMedia(index)}
                            className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            data-testid={`button-remove-media-${index}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                          <span className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-1 rounded">
                            {uploadedMedia.types[index]}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setDialogOpen(false);
                      setUploadedMedia({ urls: [], types: [] });
                    }}
                    className="flex-1 bg-white border-2 border-black text-black hover:bg-gray-100 rounded-sm font-black uppercase tracking-wide"
                    data-testid="button-cancel-discussion"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createDiscussion.isPending || isUploading}
                    className="flex-1 bg-black text-white hover:bg-gray-800 font-black uppercase tracking-wide rounded-sm border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                    data-testid="button-create-discussion"
                  >
                    {createDiscussion.isPending ? "Creating..." : "Post"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search + Sort bar */}
      <div className="px-4 mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 w-4 h-4" />
          <Input
            placeholder="Search discussions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-8 h-9 bg-white/10 border border-white/15 text-white placeholder:text-white/35 text-sm rounded-full focus:border-[#FCD000]/50 [&]:bg-white/10"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-white/40" />
            </button>
          )}
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger
            className="w-28 h-9 border border-white/15 text-white text-xs font-bold rounded-full"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
            data-testid="select-sort-by"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] border border-white/15 text-white">
            <SelectItem value="recent" className="text-white focus:bg-white/10 focus:text-white">Recent</SelectItem>
            <SelectItem value="likes" className="text-white focus:bg-white/10 focus:text-white">Top Liked</SelectItem>
            <SelectItem value="replies" className="text-white focus:bg-white/10 focus:text-white">Most Replies</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Feed heading */}
      <div className="px-4 mb-3 flex items-center gap-3">
        <div className="w-1 h-5 bg-[#FCD000] rounded-full flex-shrink-0" />
        <span className="text-sm font-black text-white uppercase tracking-[0.15em]">
          {searchQuery ? `"${searchQuery}"` : 'All Posts'}
        </span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      {/* Recent Discussions */}
      <div className="px-4">
        
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
                className={`w-full ${highlightedDiscussion === discussion.id ? 'ring-2 ring-ministry-gold ring-opacity-50 rounded-lg' : ''}`}
              >
                <DiscussionCard 
                  discussion={discussion}
                  onStartDirectMessage={handleStartDirectMessage}
                  onAddToGroup={handleAddToGroup}
                  currentUserTier={(user as any)?.subscriptionTier || 'free'}
                  currentUserSubscriptionStatus={(user as any)?.subscriptionStatus || 'trial'}
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
