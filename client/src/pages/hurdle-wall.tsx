import React, { useState } from 'react';
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
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, HandHeart, Plus, Trash2, Search, Filter, SortDesc } from 'lucide-react';
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
  
  const handleDeletePost = (postId: string) => {
    if (window.confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
      deletePostMutation.mutate(postId);
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
            <p className="text-ministry-gold-exact text-sm font-semibold">A Sacred Space For Prayer Requests</p>
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
          <p className="text-ministry-gold-exact text-sm font-semibold">A Sacred Space For Prayer Requests</p>
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
                <SelectItem value="all">All Requests</SelectItem>
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
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}