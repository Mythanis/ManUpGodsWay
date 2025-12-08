import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useWebSocket } from '@/hooks/useWebSocket';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, HandHeart, Send, Plus, Trash2, Search, Filter, SortDesc, MessageCircle, Heart } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'wouter';

interface HurdleWallPost {
  id: string;
  userId: string;
  content: string;
  isAnonymous: boolean;
  postType: 'discussion' | 'prayer_request';
  prayerCount: number;
  replyCount: number;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
  };
  userHasPrayed?: boolean;
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
  const [newPostType, setNewPostType] = useState<'discussion' | 'prayer_request'>('discussion');
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState<Record<string, string>>({});
  const [replyAnonymous, setReplyAnonymous] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'discussion' | 'prayer_request'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  
  // Get current user
  const { data: currentUser } = useQuery<{ id: string }>({ queryKey: ['/api/auth/user'] });
  
  // Set up real-time WebSocket connection
  useWebSocket(currentUser?.id);

  // Fetch hurdle wall posts
  const { data: allPosts = [], isLoading } = useQuery<HurdleWallPost[]>({
    queryKey: ['/api/hurdle-wall'],
  });
  
  // Filter and sort posts
  const posts = React.useMemo(() => {
    let filtered = allPosts;
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(post => 
        post.content.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(post => post.postType === filterType);
    }
    
    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
    });
    
    return filtered;
  }, [allPosts, searchTerm, filterType, sortBy]);

  // Create post mutation
  const createPostMutation = useMutation({
    mutationFn: async (postData: { content: string; isAnonymous: boolean; postType: string }) => {
      return apiRequest('POST', '/api/hurdle-wall', postData);
    },
    onSuccess: () => {
      toast({
        title: "Post Created",
        description: "Your post has been shared on the War Room",
      });
      setNewPostContent('');
      setNewPostType('discussion');
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

  // Create reply mutation
  const createReplyMutation = useMutation({
    mutationFn: async ({ postId, content, isAnonymous }: { postId: string; content: string; isAnonymous: boolean }) => {
      return apiRequest('POST', `/api/hurdle-wall/${postId}/replies`, { content, isAnonymous });
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Reply Added",
        description: "Your reply has been posted",
      });
      setReplyContent(prev => ({ ...prev, [variables.postId]: '' }));
      setReplyAnonymous(prev => ({ ...prev, [variables.postId]: true }));
      queryClient.invalidateQueries({ queryKey: ['/api/hurdle-wall'] });
      queryClient.invalidateQueries({ queryKey: [`/api/hurdle-wall/${variables.postId}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to create reply",
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
  
  // Delete reply mutation
  const deleteReplyMutation = useMutation({
    mutationFn: async (replyId: string) => {
      return apiRequest('DELETE', `/api/hurdle-wall/replies/${replyId}`);
    },
    onSuccess: () => {
      toast({
        title: "Reply Deleted",
        description: "Your reply has been removed",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/hurdle-wall'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to delete reply",
        variant: "destructive",
      });
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
      postType: newPostType,
    });
  };

  const handleCreateReply = (postId: string) => {
    const content = replyContent[postId]?.trim();
    if (!content) {
      toast({
        title: "Error",
        description: "Please enter some content for your reply",
        variant: "destructive",
      });
      return;
    }

    createReplyMutation.mutate({
      postId,
      content,
      isAnonymous: false, // Always use real name for replies
    });
    
    // Clear the reply content after submission
    setReplyContent(prev => ({
      ...prev,
      [postId]: ''
    }));
  };
  
  const handleDeletePost = (postId: string) => {
    if (window.confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
      deletePostMutation.mutate(postId);
    }
  };
  
  const handleDeleteReply = (replyId: string) => {
    if (window.confirm('Are you sure you want to delete this reply? This action cannot be undone.')) {
      deleteReplyMutation.mutate(replyId);
    }
  };

  const handlePrayer = (postId: string, currentlyPrayed?: boolean) => {
    prayerMutation.mutate({
      postId,
      action: currentlyPrayed ? 'remove' : 'add',
    });
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
        <div className="bg-gradient-to-r from-ministry-navy to-ministry-charcoal dark:from-header-dark dark:to-ministry-navy text-white px-6 pt-12 pb-6">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-4xl font-black mb-2 tracking-tight">War Room</h1>
            <p className="text-ministry-gold-exact text-sm font-semibold">Share Your Struggles And Prayer Requests</p>
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
      <div className="bg-gradient-to-r from-ministry-navy to-ministry-charcoal dark:from-header-dark dark:to-ministry-navy text-white px-6 pt-12 pb-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-black mb-2 tracking-tight">War Room</h1>
          <p className="text-ministry-gold-exact text-sm font-semibold">Share your struggles and prayer requests</p>
        </div>
      </div>
      
      <div className="max-w-2xl mx-auto p-4 space-y-6">
        
        {/* Search and Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ministry-slate" />
            <Input
              placeholder="Search posts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-white"
            />
          </div>
          <div className="flex gap-2">
            <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
              <SelectTrigger className="w-40 border-white">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Posts</SelectItem>
                <SelectItem value="discussion">Discussions</SelectItem>
                <SelectItem value="prayer_request">Prayer Requests</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="w-36 border-white">
                <SortDesc className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* New Post Form */}
        <Card className="bg-ministry-gold-exact border-2 border-black">
          <CardHeader>
            <CardTitle className="text-black flex items-center gap-2 text-2xl font-bold tracking-tight">
              <Plus className="h-6 w-6" />
              Share Your Heart
            </CardTitle>
            <CardDescription className="text-black text-base font-medium leading-relaxed">
              A place for men to bring their battles to God and stand together in prayer. Share your needs, lift up your brothers, and fight on your knees. This is where warriors seek the Lord and find strength.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Post Type Selection */}
            <div className="space-y-2">
              <Label className="text-black font-semibold">Post Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewPostType('discussion')}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border-2 transition-all font-medium text-sm ${
                    newPostType === 'discussion'
                      ? 'bg-black text-white border-black shadow-md'
                      : 'bg-white text-black border-black hover:bg-gray-100'
                  }`}
                  data-testid="button-discussion-type"
                >
                  <MessageCircle className="h-4 w-4" />
                  Open Discussion
                </button>
                <button
                  type="button"
                  onClick={() => setNewPostType('prayer_request')}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border-2 transition-all font-medium text-sm ${
                    newPostType === 'prayer_request'
                      ? 'bg-black text-white border-black shadow-md'
                      : 'bg-white text-black border-black hover:bg-gray-100'
                  }`}
                  data-testid="button-prayer-type"
                >
                  <Heart className="h-4 w-4" />
                  Prayer Request
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="space-y-2">
              <Label htmlFor="content" className="text-black">
                {newPostType === 'prayer_request' ? 'Prayer Request' : 'Discussion Topic'}
              </Label>
              <Textarea
                id="content"
                placeholder={
                  newPostType === 'prayer_request' 
                    ? "Share what you'd like prayer for..."
                    : "Share what's on your heart or start a discussion..."
                }
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                className="min-h-[100px]"
              />
            </div>

            <Button 
              onClick={handleCreatePost}
              disabled={createPostMutation.isPending || !newPostContent.trim()}
              className="w-full bg-black hover:bg-gray-900 text-white font-bold text-lg py-6 rounded-xl shadow-lg border-2 border-black transition-all hover:scale-[1.02]"
              data-testid="button-share-post"
            >
              {createPostMutation.isPending ? 'Posting...' : 'Share Post'}
            </Button>
          </CardContent>
        </Card>

        {/* Posts List */}
        <div className="space-y-4">
          {posts.length === 0 ? (
            <Card className="bg-ministry-gold-exact">
              <CardContent className="text-center py-12">
                <MessageSquare className="h-12 w-12 text-ministry-steel mx-auto mb-4" />
                <p className="text-black">No posts yet. Be the first to share!</p>
              </CardContent>
            </Card>
          ) : (
            posts.map((post) => (
              <Card key={post.id} className="bg-black border-2 border-black">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {renderUserName(post.user, post.isAnonymous)}
                        <Badge 
                          className="bg-ministry-gold-exact text-black font-semibold"
                        >
                          {post.postType === 'prayer_request' ? 'Prayer Request' : 'Discussion'}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-400">{formatTimeAgo(post.createdAt)}</p>
                    </div>
                    {currentUser?.id === post.userId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeletePost(post.id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20 p-1 h-auto"
                        disabled={deletePostMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-white leading-relaxed">{post.content}</p>
                  
                  <Separator className="bg-gray-700" />
                  
                  <div className="flex items-center gap-4">
                    {post.postType === 'prayer_request' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePrayer(post.id, post.userHasPrayed)}
                        className={`flex items-center gap-2 ${
                          post.userHasPrayed 
                            ? 'text-ministry-gold-exact hover:text-yellow-300' 
                            : 'text-gray-400 hover:text-ministry-gold-exact'
                        }`}
                        disabled={prayerMutation.isPending}
                      >
                        <HandHeart className={`h-4 w-4 ${post.userHasPrayed ? 'fill-current' : ''}`} />
                        {post.prayerCount} {post.prayerCount === 1 ? 'Prayer' : 'Prayers'}
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedPost(expandedPost === post.id ? null : post.id)}
                        className="flex items-center gap-2 text-gray-400 hover:text-white"
                      >
                        <MessageSquare className="h-4 w-4" />
                        {post.replyCount} {post.replyCount === 1 ? 'Reply' : 'Replies'}
                      </Button>
                    )}
                  </div>

                  {/* Reply Section for Discussions */}
                  {post.postType === 'discussion' && expandedPost === post.id && (
                    <div className="space-y-4 pt-4 border-t border-gray-700">
                      {/* Existing Replies */}
                      {post.replies && post.replies.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="text-white font-medium">Replies</h4>
                          {post.replies.map((reply) => (
                            <div key={reply.id} className="bg-gray-800 rounded-lg p-3 border-l-2 border-ministry-gold-exact">
                              <div className="flex items-start justify-between mb-2">
                                <span className="text-sm">
                                  {renderUserName(reply.user, reply.isAnonymous)}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-400 text-xs">
                                    {formatTimeAgo(reply.createdAt)}
                                  </span>
                                  {currentUser?.id === reply.userId && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteReply(reply.id)}
                                      className="text-red-400 hover:text-red-300 hover:bg-red-900/20 p-1 h-auto"
                                      disabled={deleteReplyMutation.isPending}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                              <p className="text-white text-sm leading-relaxed">{reply.content}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Reply Form */}
                      <div className="space-y-3">
                        <Textarea
                          placeholder="Share your thoughts..."
                          value={replyContent[post.id] || ''}
                          onChange={(e) => setReplyContent(prev => ({
                            ...prev,
                            [post.id]: e.target.value
                          }))}
                          className="bg-gray-800 text-white border-gray-700"
                        />
                        <Button
                          onClick={() => handleCreateReply(post.id)}
                          disabled={createReplyMutation.isPending || !replyContent[post.id]?.trim()}
                          size="sm"
                          className="bg-ministry-gold-exact text-black hover:bg-yellow-400"
                        >
                          <Send className="h-4 w-4 mr-2" />
                          Reply
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}