import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, Send, Plus, Eye, EyeOff } from 'lucide-react';
import prayerHandsIcon from '@assets/53-535374_hands-praying-pray-icon-png_1756847787696.png';

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
  const [newPostAnonymous, setNewPostAnonymous] = useState(true);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState<Record<string, string>>({});
  const [replyAnonymous, setReplyAnonymous] = useState<Record<string, boolean>>({});

  // Fetch hurdle wall posts
  const { data: posts = [], isLoading } = useQuery<HurdleWallPost[]>({
    queryKey: ['/api/hurdle-wall'],
  });

  // Create post mutation
  const createPostMutation = useMutation({
    mutationFn: async (postData: { content: string; isAnonymous: boolean; postType: string }) => {
      return apiRequest('POST', '/api/hurdle-wall', postData);
    },
    onSuccess: () => {
      toast({
        title: "Post Created",
        description: "Your post has been shared on the Hurdle Wall",
      });
      setNewPostContent('');
      setNewPostType('discussion');
      setNewPostAnonymous(true);
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
      isAnonymous: newPostAnonymous,
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
      isAnonymous: replyAnonymous[postId] !== false, // Default to true
    });
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

  const formatTimeAgo = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white p-4">
        <div className="max-w-2xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-800 rounded"></div>
            <div className="h-32 bg-gray-800 rounded"></div>
            <div className="h-24 bg-gray-800 rounded"></div>
            <div className="h-24 bg-gray-800 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-white">Hurdle Wall</h1>
          <p className="text-gray-400">Share your struggles and prayer requests anonymously</p>
        </div>

        {/* New Post Form */}
        <Card className="bg-gray-900 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Share Your Heart
            </CardTitle>
            <CardDescription className="text-gray-400">
              Share your thoughts, struggles, or prayer requests with the community
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Post Type Selection */}
            <div className="space-y-3">
              <Label className="text-white">Post Type</Label>
              <RadioGroup 
                value={newPostType} 
                onValueChange={(value: 'discussion' | 'prayer_request') => setNewPostType(value)}
                className="flex gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="discussion" id="discussion" />
                  <Label htmlFor="discussion" className="text-white">Open Discussion</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="prayer_request" id="prayer_request" />
                  <Label htmlFor="prayer_request" className="text-white">Prayer Request</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Content */}
            <div className="space-y-2">
              <Label htmlFor="content" className="text-white">
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
                className="min-h-[100px] bg-gray-800 border-gray-600 text-white placeholder-gray-400"
              />
            </div>

            {/* Anonymous Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {newPostAnonymous ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <Label htmlFor="anonymous" className="text-white">
                  {newPostAnonymous ? 'Posting Anonymously' : 'Posting with Name'}
                </Label>
              </div>
              <Switch
                id="anonymous"
                checked={newPostAnonymous}
                onCheckedChange={setNewPostAnonymous}
              />
            </div>

            <Button 
              onClick={handleCreatePost}
              disabled={createPostMutation.isPending || !newPostContent.trim()}
              className="w-full bg-yellow-600 hover:bg-yellow-700 text-black font-medium"
            >
              {createPostMutation.isPending ? 'Posting...' : 'Share Post'}
            </Button>
          </CardContent>
        </Card>

        {/* Posts List */}
        <div className="space-y-4">
          {posts.length === 0 ? (
            <Card className="bg-gray-900 border-gray-700">
              <CardContent className="text-center py-12">
                <MessageSquare className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No posts yet. Be the first to share!</p>
              </CardContent>
            </Card>
          ) : (
            posts.map((post) => (
              <Card key={post.id} className="bg-gray-900 border-gray-700">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">
                          {getUserDisplayName(post.user, post.isAnonymous)}
                        </span>
                        <Badge 
                          variant={post.postType === 'prayer_request' ? 'default' : 'secondary'}
                          className={post.postType === 'prayer_request' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-700 text-gray-300'
                          }
                        >
                          {post.postType === 'prayer_request' ? 'Prayer Request' : 'Discussion'}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-400">{formatTimeAgo(post.createdAt)}</p>
                    </div>
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
                            ? 'text-red-400 hover:text-red-300' 
                            : 'text-gray-400 hover:text-red-400'
                        }`}
                        disabled={prayerMutation.isPending}
                      >
                        <img 
                          src={prayerHandsIcon} 
                          alt="Prayer hands" 
                          className={`h-4 w-4 ${post.userHasPrayed ? 'brightness-0 invert' : 'opacity-70'}`} 
                        />
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
                      {/* Reply Form */}
                      <div className="space-y-3">
                        <Textarea
                          placeholder="Share your thoughts..."
                          value={replyContent[post.id] || ''}
                          onChange={(e) => setReplyContent(prev => ({
                            ...prev,
                            [post.id]: e.target.value
                          }))}
                          className="bg-gray-800 border-gray-600 text-white placeholder-gray-400"
                        />
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            {replyAnonymous[post.id] !== false ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            <Label className="text-white text-sm">
                              {replyAnonymous[post.id] !== false ? 'Replying Anonymously' : 'Replying with Name'}
                            </Label>
                          </div>
                          <Switch
                            checked={replyAnonymous[post.id] !== false}
                            onCheckedChange={(checked) => setReplyAnonymous(prev => ({
                              ...prev,
                              [post.id]: checked
                            }))}
                          />
                        </div>
                        <Button
                          onClick={() => handleCreateReply(post.id)}
                          disabled={createReplyMutation.isPending || !replyContent[post.id]?.trim()}
                          size="sm"
                          className="bg-yellow-600 hover:bg-yellow-700 text-black"
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