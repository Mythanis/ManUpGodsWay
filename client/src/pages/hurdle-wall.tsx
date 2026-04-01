import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useWebSocket } from '@/hooks/useWebSocket';
import { triggerRefTagger } from '@/hooks/useRefTagger';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, HandHeart, Plus, Trash2, Search, SortDesc, Send, ArrowLeft, Pencil, Star } from 'lucide-react';

function ChristianCross({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M11 2h2v6h6v2h-6v12h-2V10H5V8h6V2z" />
    </svg>
  );
}
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'wouter';
import { BackButton } from "@/components/BackButton";

interface HurdleWallPraise {
  id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: string;
}

interface HurdleWallPost {
  id: string;
  userId: string;
  content: string;
  isAnonymous: boolean;
  postType: 'discussion' | 'prayer_request';
  prayerCount: number;
  replyCount: number;
  amenCount: number;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
  };
  userHasPrayed?: boolean;
  userHasAmened?: boolean;
  praise: HurdleWallPraise | null;
  replies: HurdleWallReply[];
}

interface HurdleWallReply {
  id: string;
  postId: string;
  userId: string;
  content: string;
  isAnonymous: boolean;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export default function HurdleWall() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newPostContent, setNewPostContent] = useState('');
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [commentContent, setCommentContent] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'mine' | 'praised'>('newest');
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editReplyContent, setEditReplyContent] = useState('');
  const [highlightedPost, setHighlightedPost] = useState<string | null>(null);
  const [praiseInputOpen, setPraiseInputOpen] = useState<Record<string, boolean>>({});
  const [praiseContent, setPraiseContent] = useState<Record<string, string>>({});
  // optimistic amen counts: postId -> { count, hasAmened }
  const [optimisticAmens, setOptimisticAmens] = useState<Record<string, { count: number; hasAmened: boolean }>>({});
  const [pendingAmenPosts, setPendingAmenPosts] = useState<Set<string>>(new Set());
  const [pendingPraisePosts, setPendingPraisePosts] = useState<Set<string>>(new Set());
  const [praiseEditOpen, setPraiseEditOpen] = useState<Record<string, boolean>>({});
  const [praiseEditContent, setPraiseEditContent] = useState<Record<string, string>>({});

  // Get current user
  const { data: currentUser } = useQuery<{ id: string; role?: string }>({ queryKey: ['/api/auth/user'] });

  // Set up real-time WebSocket connection
  useWebSocket(currentUser?.id);

  // Fetch hurdle wall posts
  const { data: allPosts = [], isLoading } = useQuery<HurdleWallPost[]>({
    queryKey: ['/api/hurdle-wall'],
    refetchOnMount: 'always',
    staleTime: 0,
  });

  useEffect(() => {
    if (allPosts.length > 0) {
      triggerRefTagger();
    }
  }, [allPosts]);

  // Handle deep-link ?post= query param
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('post');
    if (postId) {
      setHighlightedPost(postId);
      setTimeout(() => {
        const element = document.querySelector(`[data-post-id="${postId}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 800);
    }
  }, [allPosts]);

  // Filter and sort posts
  const posts = React.useMemo(() => {
    let filtered = allPosts;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(post =>
        post.content.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply sort/filter options
    if (sortBy === 'mine' && currentUser?.id) {
      filtered = filtered.filter(post => post.userId === currentUser.id);
    } else if (sortBy === 'praised') {
      filtered = filtered.filter(post => post.praise !== null);
    }

    // Apply date sorting (mine/praised still sort by newest by default)
    filtered = [...filtered].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortBy === 'oldest' ? dateA - dateB : dateB - dateA;
    });

    return filtered;
  }, [allPosts, searchTerm, sortBy, currentUser?.id]);

  // Resolve amen display values (optimistic or server)
  const getAmenDisplay = (post: HurdleWallPost) => {
    const opt = optimisticAmens[post.id];
    if (opt !== undefined) return opt;
    return { count: post.amenCount ?? 0, hasAmened: post.userHasAmened ?? false };
  };

  // Create post mutation
  const createPostMutation = useMutation({
    mutationFn: async (postData: { content: string; isAnonymous: boolean; postType: string }) => {
      return apiRequest('POST', '/api/hurdle-wall', postData);
    },
    onSuccess: () => {
      toast({
        title: "Prayer Request Posted",
        description: "Your prayer request has been shared on the War Room",
      });
      setNewPostContent('');
      queryClient.invalidateQueries({ queryKey: ['/api/hurdle-wall'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to create post",
        variant: "destructive",
      });
    },
  });

  // Prayer mutation
  const prayerMutation = useMutation({
    mutationFn: async ({ postId, action }: { postId: string; action: 'add' | 'remove' }) => {
      if (action === 'add') {
        return apiRequest('POST', `/api/hurdle-wall/${postId}/pray`);
      } else {
        return apiRequest('DELETE', `/api/hurdle-wall/${postId}/pray`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/hurdle-wall'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to update prayer",
        variant: "destructive",
      });
    },
  });

  // Praise mutation (per-post pending tracking)
  const praiseMutation = useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      return apiRequest('POST', `/api/hurdle-wall/${postId}/praise`, { content });
    },
    onMutate: ({ postId }) => {
      setPendingPraisePosts(prev => new Set(prev).add(postId));
    },
    onSuccess: (_, variables) => {
      toast({ title: "Praise Shared", description: "Your praise has been added to your prayer request" });
      setPraiseInputOpen(prev => ({ ...prev, [variables.postId]: false }));
      setPraiseContent(prev => ({ ...prev, [variables.postId]: '' }));
      queryClient.invalidateQueries({ queryKey: ['/api/hurdle-wall'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.response?.data?.message || "Failed to add praise", variant: "destructive" });
    },
    onSettled: (_, __, { postId }) => {
      setPendingPraisePosts(prev => { const s = new Set(prev); s.delete(postId); return s; });
    },
  });

  // Delete praise mutation (per-post pending tracking)
  const deletePraiseMutation = useMutation({
    mutationFn: async (postId: string) => {
      return apiRequest('DELETE', `/api/hurdle-wall/${postId}/praise`);
    },
    onMutate: (postId) => {
      setPendingPraisePosts(prev => new Set(prev).add(postId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/hurdle-wall'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.response?.data?.message || "Failed to remove praise", variant: "destructive" });
    },
    onSettled: (_, __, postId) => {
      setPendingPraisePosts(prev => { const s = new Set(prev); s.delete(postId); return s; });
    },
  });

  // Edit praise mutation (per-post pending tracking)
  const editPraiseMutation = useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      return apiRequest('PATCH', `/api/hurdle-wall/${postId}/praise`, { content });
    },
    onMutate: ({ postId }) => {
      setPendingPraisePosts(prev => new Set(prev).add(postId));
    },
    onSuccess: (_, variables) => {
      toast({ title: "Praise Updated", description: "Your praise has been updated" });
      setPraiseEditOpen(prev => ({ ...prev, [variables.postId]: false }));
      queryClient.invalidateQueries({ queryKey: ['/api/hurdle-wall'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.response?.data?.message || "Failed to update praise", variant: "destructive" });
    },
    onSettled: (_, __, { postId }) => {
      setPendingPraisePosts(prev => { const s = new Set(prev); s.delete(postId); return s; });
    },
  });

  // Amen mutation (optimistic, per-post pending tracking)
  const amenMutation = useMutation({
    mutationFn: async ({ postId, action }: { postId: string; action: 'add' | 'remove' }) => {
      if (action === 'add') return apiRequest('POST', `/api/hurdle-wall/${postId}/amen`);
      return apiRequest('DELETE', `/api/hurdle-wall/${postId}/amen`);
    },
    onMutate: ({ postId, action }) => {
      setPendingAmenPosts(prev => new Set(prev).add(postId));
      const post = allPosts.find(p => p.id === postId);
      const current = optimisticAmens[postId] ?? { count: post?.amenCount ?? 0, hasAmened: post?.userHasAmened ?? false };
      const next = action === 'add'
        ? { count: current.count + 1, hasAmened: true }
        : { count: Math.max(0, current.count - 1), hasAmened: false };
      setOptimisticAmens(prev => ({ ...prev, [postId]: next }));
      return { prev: current };
    },
    onError: (_, { postId }, ctx) => {
      setOptimisticAmens(prev => ({ ...prev, [postId]: ctx!.prev }));
      toast({ title: "Error", description: "Failed to update Amen", variant: "destructive" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/hurdle-wall'] });
    },
    onSettled: (_, __, { postId }) => {
      setPendingAmenPosts(prev => { const s = new Set(prev); s.delete(postId); return s; });
      setOptimisticAmens(prev => {
        const next = { ...prev };
        delete next[postId];
        return next;
      });
    },
  });

  // Delete post mutation
  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      return apiRequest('DELETE', `/api/hurdle-wall/posts/${postId}`);
    },
    onSuccess: () => {
      toast({
        title: "Post Deleted",
        description: "Your post has been removed from the War Room",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/hurdle-wall'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to delete post",
        variant: "destructive",
      });
    },
  });

  // Create comment mutation
  const createCommentMutation = useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      return apiRequest('POST', `/api/hurdle-wall/${postId}/replies`, { content, isAnonymous: false });
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Comment Added",
        description: "Your comment has been posted",
      });
      setCommentContent(prev => ({ ...prev, [variables.postId]: '' }));
      queryClient.invalidateQueries({ queryKey: ['/api/hurdle-wall'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to post comment",
        variant: "destructive",
      });
    },
  });

  // Delete comment mutation
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      return apiRequest('DELETE', `/api/hurdle-wall/replies/${commentId}`);
    },
    onSuccess: () => {
      toast({
        title: "Comment Deleted",
        description: "Your comment has been removed",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/hurdle-wall'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to delete comment",
        variant: "destructive",
      });
    },
  });

  const editCommentMutation = useMutation({
    mutationFn: async ({ commentId, content }: { commentId: string; content: string }) => {
      return apiRequest('PATCH', `/api/hurdle-wall/replies/${commentId}`, { content });
    },
    onSuccess: () => {
      toast({ title: "Updated", description: "Comment updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/hurdle-wall'] });
      setEditingReplyId(null);
      setEditReplyContent('');
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update comment", variant: "destructive" });
    },
  });

  const handleCreatePost = () => {
    if (!newPostContent.trim()) {
      toast({
        title: "Error",
        description: "Please enter some content for your post",
        variant: "destructive",
      });
      return;
    }

    createPostMutation.mutate({
      content: newPostContent,
      isAnonymous: false,
      postType: 'prayer_request',
    });
  };

  const handleCreateComment = (postId: string) => {
    const content = commentContent[postId]?.trim();
    if (!content) {
      toast({
        title: "Error",
        description: "Please enter a comment",
        variant: "destructive",
      });
      return;
    }

    createCommentMutation.mutate({ postId, content });
  };

  const handleDeletePost = (postId: string) => {
    if (window.confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
      deletePostMutation.mutate(postId);
    }
  };

  const handleDeleteComment = (commentId: string) => {
    if (window.confirm('Are you sure you want to delete this comment? This action cannot be undone.')) {
      deleteCommentMutation.mutate(commentId);
    }
  };

  const handlePrayer = (postId: string, currentlyPrayed?: boolean) => {
    prayerMutation.mutate({
      postId,
      action: currentlyPrayed ? 'remove' : 'add',
    });
  };

  const handleAmen = (post: HurdleWallPost) => {
    const { hasAmened } = getAmenDisplay(post);
    amenMutation.mutate({ postId: post.id, action: hasAmened ? 'remove' : 'add' });
  };

  const getUserDisplayName = (user: HurdleWallPost['user'], isAnonymous: boolean) => {
    if (isAnonymous) {
      return 'Anonymous';
    }
    return `${user.firstName} ${user.lastName}`;
  };

  const renderUserName = (user: HurdleWallPost['user'], isAnonymous: boolean) => {
    if (isAnonymous) {
      return <span className="text-white font-medium">Anonymous</span>;
    }

    return (
      <Link href={`/users/${user.id}`}>
        <span className="text-white font-medium hover:text-ministry-gold-exact cursor-pointer transition-colors">
          {user.firstName} {user.lastName}
        </span>
      </Link>
    );
  };

  const formatTimeAgo = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

  if (isLoading) {
    return (
      <div className="pb-20">
        <div className="liquid-header text-white px-6 pt-8 pb-6">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-2">
              <Link href="/">
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 rounded-sm" data-testid="back-button">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <h1 className="text-4xl font-black tracking-tight">War Room</h1>
            </div>
            <p className="text-ministry-gold-exact text-sm font-semibold ml-11">A Sacred Space For Prayer Requests</p>
          </div>
        </div>
        <div className="max-w-2xl mx-auto p-4">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-ministry-gold-exact rounded"></div>
            <div className="h-32 bg-ministry-gold-exact rounded"></div>
            <div className="h-24 bg-ministry-gold-exact rounded"></div>
            <div className="h-24 bg-ministry-gold-exact rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="liquid-header text-white px-6 pt-8 pb-6">
        <div className="max-w-2xl mx-auto">
          <BackButton />
          <div className="flex items-center gap-3 mb-2">
            <Link href="/">
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 rounded-sm" data-testid="back-button">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-4xl font-black tracking-tighter uppercase">War Room</h1>
          </div>
          <p className="text-ministry-gold-exact text-xs font-bold tracking-widest uppercase ml-11">A Sacred Space For Prayer Requests</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">

        {/* Search and Sort Controls */}
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-black" />
            <Input
              placeholder="SEARCH POSTS..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-2 border-black bg-ministry-gold-exact rounded-sm text-black placeholder:text-black/50 placeholder:font-medium placeholder:text-xs placeholder:tracking-wide font-medium"
            />
          </div>
          <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
            <SelectTrigger className="w-48 border-2 border-black bg-ministry-gold-exact text-black font-bold rounded-sm">
              <SortDesc className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="mine">My Prayer Requests</SelectItem>
              <SelectItem value="praised">Praised Requests</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* New Post Form */}
        <Card className="liquid-black-white border-2 border-ministry-gold-exact rounded-sm shadow-[4px_4px_0px_0px_rgba(252,208,0,1)]">
          <CardHeader className="relative z-10">
            <CardTitle className="text-white flex items-center gap-2 text-2xl font-black tracking-tighter uppercase">
              <Plus className="h-6 w-6 text-ministry-gold-exact" />
              Share Your Heart
            </CardTitle>
            <CardDescription className="text-white/80 text-base font-medium leading-relaxed">
              A place for men to bring their battles to God and stand together in prayer. Share your needs, lift up your brothers, and fight on your knees. This is where warriors seek the Lord and find strength.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 relative z-10">
            {/* Content */}
            <div className="space-y-2">
              <Label htmlFor="content" className="text-white font-semibold">
                Prayer Request
              </Label>
              <Textarea
                id="content"
                placeholder="Share what you'd like prayer for..."
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                className="min-h-[100px] bg-white text-black border-2 border-black placeholder:text-black/50"
                data-testid="textarea-prayer-request"
              />
            </div>

            <Button
              onClick={handleCreatePost}
              disabled={createPostMutation.isPending || !newPostContent.trim()}
              className="w-full bg-ministry-gold-exact hover:bg-yellow-400 text-black font-black text-lg py-6 rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] border-2 border-black transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] uppercase tracking-wide"
              data-testid="button-share-post"
            >
              {createPostMutation.isPending ? 'Posting...' : 'Share Post'}
            </Button>
          </CardContent>
        </Card>

        {/* Posts List */}
        <div className="space-y-4">
          {posts.length === 0 ? (
            <Card className="bg-ministry-gold-exact border-2 border-black rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <CardContent className="text-center py-12">
                <MessageSquare className="h-12 w-12 text-black mx-auto mb-4" />
                <p className="text-black font-medium">No posts yet. Be the first to share!</p>
              </CardContent>
            </Card>
          ) : (
            posts.map((post) => {
              const { count: amenCount, hasAmened } = getAmenDisplay(post);
              const isOwner = currentUser?.id === post.userId;
              const isMod = currentUser?.role === 'admin' || currentUser?.role === 'moderator' || currentUser?.role === 'owner';
              const hasPraise = !!post.praise;

              return (
                <Card
                  key={post.id}
                  data-post-id={post.id}
                  className={`liquid-black-white border-2 rounded-sm shadow-[4px_4px_0px_0px_rgba(252,208,0,1)] ${highlightedPost === post.id ? 'border-[#FCD000] ring-2 ring-[#FCD000] ring-opacity-70' : 'border-ministry-gold-exact'}`}
                >
                  <CardHeader className="relative z-10">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {renderUserName(post.user, post.isAnonymous)}
                          <Badge className="bg-ministry-gold-exact text-black font-semibold">
                            Prayer Request
                          </Badge>
                          {hasPraise && (
                            <Badge className="bg-ministry-gold-exact text-black font-semibold flex items-center gap-1">
                              <Star className="h-3 w-3 fill-current" />
                              Praised
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-white/50">{formatTimeAgo(post.createdAt)}</p>
                      </div>
                      {(isOwner || isMod) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePost(post.id)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-900/20 p-1 h-auto"
                          disabled={deletePostMutation.isPending}
                          title="Delete post"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 relative z-10">
                    {/* Prayer request text box */}
                    <div className="bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-sm p-3">
                      <p className="text-black leading-relaxed">{post.content}</p>
                    </div>

                    {/* Praise input (owner only, when no praise yet) */}
                    {isOwner && !hasPraise && (
                      <div>
                        {praiseInputOpen[post.id] ? (
                          <div className="space-y-2">
                            <Label className="text-white font-semibold text-sm">Share Your Praise</Label>
                            <Textarea
                              placeholder="Share how God answered your prayer..."
                              value={praiseContent[post.id] || ''}
                              onChange={(e) => setPraiseContent(prev => ({ ...prev, [post.id]: e.target.value }))}
                              className="bg-white text-black border-2 border-black placeholder:text-black/50 min-h-[80px]"
                              autoFocus
                              data-testid={`textarea-praise-${post.id}`}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => {
                                  if (!praiseContent[post.id]?.trim()) return;
                                  praiseMutation.mutate({ postId: post.id, content: praiseContent[post.id] });
                                }}
                                disabled={pendingPraisePosts.has(post.id) || !praiseContent[post.id]?.trim()}
                                className="bg-ministry-gold-exact text-black hover:bg-yellow-400 font-bold border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                data-testid={`button-submit-praise-${post.id}`}
                              >
                                <Star className="h-3 w-3 mr-1" />
                                {pendingPraisePosts.has(post.id) ? 'Sharing...' : 'Share Praise'}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-white/60 hover:text-white"
                                onClick={() => {
                                  setPraiseInputOpen(prev => ({ ...prev, [post.id]: false }));
                                  setPraiseContent(prev => ({ ...prev, [post.id]: '' }));
                                }}
                                data-testid={`button-cancel-praise-${post.id}`}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPraiseInputOpen(prev => ({ ...prev, [post.id]: true }))}
                            className="text-ministry-gold-exact hover:text-yellow-300 font-semibold flex items-center gap-1"
                            data-testid={`button-open-praise-${post.id}`}
                          >
                            <Star className="h-4 w-4" />
                            Praise
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Praise display box (visible to everyone if praise exists) */}
                    {hasPraise && (
                      <div className="bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-sm p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black uppercase tracking-widest text-black flex items-center gap-1">
                            <Star className="h-3 w-3 fill-current text-ministry-gold-exact" />
                            Praise
                          </span>
                          {isOwner && !praiseEditOpen[post.id] && (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setPraiseEditContent(prev => ({ ...prev, [post.id]: post.praise!.content }));
                                  setPraiseEditOpen(prev => ({ ...prev, [post.id]: true }));
                                }}
                                className="text-black/50 hover:text-black p-1 h-auto text-xs"
                                disabled={pendingPraisePosts.has(post.id)}
                                data-testid={`button-edit-praise-${post.id}`}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (window.confirm('Remove your praise?')) deletePraiseMutation.mutate(post.id);
                                }}
                                className="text-red-500 hover:text-red-400 p-1 h-auto text-xs"
                                disabled={pendingPraisePosts.has(post.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                        {praiseEditOpen[post.id] ? (
                          <div className="space-y-2">
                            <Textarea
                              value={praiseEditContent[post.id] ?? ''}
                              onChange={e => setPraiseEditContent(prev => ({ ...prev, [post.id]: e.target.value }))}
                              className="text-sm text-black border-black min-h-[80px]"
                              placeholder="Share how God answered this prayer..."
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => {
                                  if (!praiseEditContent[post.id]?.trim()) return;
                                  editPraiseMutation.mutate({ postId: post.id, content: praiseEditContent[post.id] });
                                }}
                                disabled={pendingPraisePosts.has(post.id) || !praiseEditContent[post.id]?.trim()}
                                className="bg-ministry-gold-exact text-black hover:bg-yellow-400 font-bold border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                data-testid={`button-save-praise-edit-${post.id}`}
                              >
                                <Star className="h-3 w-3 mr-1" />
                                {pendingPraisePosts.has(post.id) ? 'Saving...' : 'Save'}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-black/60 hover:text-black"
                                onClick={() => setPraiseEditOpen(prev => ({ ...prev, [post.id]: false }))}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-black leading-relaxed text-sm">{post.praise!.content}</p>
                        )}
                      </div>
                    )}

                    {/* Amen button (only visible when there's a praise) */}
                    {hasPraise && (
                      <div className="flex items-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAmen(post)}
                          disabled={pendingAmenPosts.has(post.id)}
                          className={`flex items-center gap-2 font-semibold ${
                            hasAmened
                              ? 'text-ministry-gold-exact hover:text-yellow-300'
                              : 'text-white/60 hover:text-ministry-gold-exact'
                          }`}
                          data-testid={`button-amen-${post.id}`}
                        >
                          <ChristianCross className={`h-4 w-4 ${hasAmened ? 'opacity-100' : 'opacity-60'}`} />
                          {amenCount > 0 && <span>{amenCount}</span>}
                          Amen
                        </Button>
                      </div>
                    )}

                    <Separator className="bg-ministry-gold-exact/30" />

                    <div className="flex items-center gap-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePrayer(post.id, post.userHasPrayed)}
                        className={`flex items-center gap-2 ${
                          post.userHasPrayed
                            ? 'text-ministry-gold-exact hover:text-yellow-300'
                            : 'text-white/60 hover:text-ministry-gold-exact'
                        }`}
                        disabled={prayerMutation.isPending}
                        data-testid={`button-prayer-${post.id}`}
                      >
                        <HandHeart className={`h-4 w-4 ${post.userHasPrayed ? 'fill-current' : ''}`} />
                        {post.prayerCount} {post.prayerCount === 1 ? 'Prayer' : 'Prayers'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedPost(expandedPost === post.id ? null : post.id)}
                        className="flex items-center gap-2 text-white/60 hover:text-white"
                        data-testid={`button-toggle-comments-${post.id}`}
                      >
                        <MessageSquare className="h-4 w-4" />
                        {post.replyCount} {post.replyCount === 1 ? 'Comment' : 'Comments'}
                      </Button>
                    </div>

                    {/* Comments Section */}
                    {expandedPost === post.id && (
                      <div className="space-y-4 pt-4 border-t border-ministry-gold-exact/30">
                        {/* Existing Comments */}
                        {post.replies && post.replies.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="text-white font-bold text-sm uppercase tracking-wide">Comments</h4>
                            {post.replies.map((reply) => (
                              <div key={reply.id} className="bg-white rounded-sm p-3 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                <div className="flex items-start justify-between mb-2">
                                  <span className="text-sm font-bold text-black">
                                    {reply.isAnonymous ? 'Anonymous' : `${reply.user.firstName} ${reply.user.lastName}`}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-black/50 text-xs">
                                      {formatTimeAgo(reply.createdAt)}
                                    </span>
                                    <div className="flex items-center gap-1">
                                      {currentUser?.id === reply.userId && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => { setEditingReplyId(reply.id); setEditReplyContent(reply.content); }}
                                          className="text-black/40 hover:text-black p-1 h-auto"
                                          data-testid={`button-edit-comment-${reply.id}`}
                                          title="Edit comment"
                                        >
                                          <Pencil className="h-3 w-3" />
                                        </Button>
                                      )}
                                      {(currentUser?.id === reply.userId || isMod) && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDeleteComment(reply.id)}
                                          className="text-red-600 hover:text-red-500 hover:bg-red-100 p-1 h-auto"
                                          disabled={deleteCommentMutation.isPending}
                                          data-testid={`button-delete-comment-${reply.id}`}
                                          title="Delete comment"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                {editingReplyId === reply.id ? (
                                  <div>
                                    <Textarea
                                      value={editReplyContent}
                                      onChange={(e) => setEditReplyContent(e.target.value)}
                                      className="bg-white text-black border-2 border-black text-sm min-h-[60px] resize-none"
                                      autoFocus
                                    />
                                    <div className="flex gap-2 mt-1.5">
                                      <Button size="sm" className="h-7 px-3 text-xs bg-black text-white hover:bg-black/80"
                                        onClick={() => editCommentMutation.mutate({ commentId: reply.id, content: editReplyContent })}
                                        disabled={editCommentMutation.isPending || !editReplyContent.trim()}>
                                        Save
                                      </Button>
                                      <Button size="sm" variant="ghost" className="h-7 px-3 text-xs text-black/60 hover:text-black"
                                        onClick={() => { setEditingReplyId(null); setEditReplyContent(''); }}>
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-black text-sm leading-relaxed">{reply.content}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Comment Form */}
                        <div className="space-y-3">
                          <Textarea
                            placeholder="Add a comment..."
                            value={commentContent[post.id] || ''}
                            onChange={(e) => setCommentContent(prev => ({
                              ...prev,
                              [post.id]: e.target.value
                            }))}
                            className="bg-white text-black border-2 border-black placeholder:text-black/50"
                            data-testid={`textarea-comment-${post.id}`}
                          />
                          <Button
                            onClick={() => handleCreateComment(post.id)}
                            disabled={createCommentMutation.isPending || !commentContent[post.id]?.trim()}
                            size="sm"
                            className="bg-ministry-gold-exact text-black hover:bg-yellow-400 font-bold border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                            data-testid={`button-post-comment-${post.id}`}
                          >
                            <Send className="h-4 w-4 mr-2" />
                            Post Comment
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
