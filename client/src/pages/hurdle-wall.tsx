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
import { MessageSquare, HandHeart, Plus, Trash2, Search, Filter, SortDesc, Send, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'wouter';
import { BackButton } from "@/components/BackButton";

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
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [commentContent, setCommentContent] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'prayer_request'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  
  // Get current user
  const { data: currentUser } = useQuery<{ id: string }>({ queryKey: ['/api/auth/user'] });
  
  // Set up real-time WebSocket connection
  useWebSocket(currentUser?.id);

  // Fetch hurdle wall posts
  const { data: allPosts = [], isLoading } = useQuery<HurdleWallPost[]>({
    queryKey: ['/api/hurdle-wall'],
  });
  
  useEffect(() => {
    if (allPosts.length > 0) {
      triggerRefTagger();
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
        
        {/* Search and Filter Controls */}
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
          <div className="flex gap-2">
            <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
              <SelectTrigger className="w-40 border-2 border-black bg-ministry-gold-exact text-black font-bold rounded-sm">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Requests</SelectItem>
                <SelectItem value="prayer_request">Prayer Requests</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="w-36 border-2 border-black bg-ministry-gold-exact text-black font-bold rounded-sm">
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
        <Card className="bg-ministry-gold-exact border-2 border-black rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <CardHeader>
            <CardTitle className="text-black flex items-center gap-2 text-2xl font-black tracking-tighter uppercase">
              <Plus className="h-6 w-6" />
              Share Your Heart
            </CardTitle>
            <CardDescription className="text-black text-base font-medium leading-relaxed">
              A place for men to bring their battles to God and stand together in prayer. Share your needs, lift up your brothers, and fight on your knees. This is where warriors seek the Lord and find strength.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Content */}
            <div className="space-y-2">
              <Label htmlFor="content" className="text-black font-semibold">
                Prayer Request
              </Label>
              <Textarea
                id="content"
                placeholder="Share what you'd like prayer for..."
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                className="min-h-[100px]"
                data-testid="textarea-prayer-request"
              />
            </div>

            <Button 
              onClick={handleCreatePost}
              disabled={createPostMutation.isPending || !newPostContent.trim()}
              className="w-full bg-black hover:bg-gray-900 text-white font-black text-lg py-6 rounded-sm shadow-lg border-2 border-black transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] uppercase tracking-wide"
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
            posts.map((post) => (
              <Card key={post.id} className="bg-black border-2 border-black rounded-sm shadow-[4px_4px_0px_0px_rgba(252,208,0,0.3)]">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {renderUserName(post.user, post.isAnonymous)}
                        <Badge 
                          className="bg-ministry-gold-exact text-black font-semibold"
                        >
                          Prayer Request
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
                      data-testid={`button-prayer-${post.id}`}
                    >
                      <HandHeart className={`h-4 w-4 ${post.userHasPrayed ? 'fill-current' : ''}`} />
                      {post.prayerCount} {post.prayerCount === 1 ? 'Prayer' : 'Prayers'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedPost(expandedPost === post.id ? null : post.id)}
                      className="flex items-center gap-2 text-gray-400 hover:text-white"
                      data-testid={`button-toggle-comments-${post.id}`}
                    >
                      <MessageSquare className="h-4 w-4" />
                      {post.replyCount} {post.replyCount === 1 ? 'Comment' : 'Comments'}
                    </Button>
                  </div>

                  {/* Comments Section */}
                  {expandedPost === post.id && (
                    <div className="space-y-4 pt-4 border-t border-gray-700">
                      {/* Existing Comments */}
                      {post.replies && post.replies.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="text-white font-medium">Comments</h4>
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
                                      onClick={() => handleDeleteComment(reply.id)}
                                      className="text-red-400 hover:text-red-300 hover:bg-red-900/20 p-1 h-auto"
                                      disabled={deleteCommentMutation.isPending}
                                      data-testid={`button-delete-comment-${reply.id}`}
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
                      
                      {/* Comment Form */}
                      <div className="space-y-3">
                        <Textarea
                          placeholder="Add a comment..."
                          value={commentContent[post.id] || ''}
                          onChange={(e) => setCommentContent(prev => ({
                            ...prev,
                            [post.id]: e.target.value
                          }))}
                          className="bg-gray-800 text-white border-gray-700"
                          data-testid={`textarea-comment-${post.id}`}
                        />
                        <Button
                          onClick={() => handleCreateComment(post.id)}
                          disabled={createCommentMutation.isPending || !commentContent[post.id]?.trim()}
                          size="sm"
                          className="bg-ministry-gold-exact text-black hover:bg-yellow-400"
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
            ))
          )}
        </div>
      </div>
    </div>
  );
}