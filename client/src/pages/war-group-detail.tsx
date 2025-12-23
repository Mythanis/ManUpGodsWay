import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { MapPin, Users, User, Calendar, ChevronLeft, LogOut, CheckCircle2, XCircle, UserPlus, Heart, MessageCircle, Pin, Trash2, Send } from "lucide-react";
import { useLocation } from "wouter";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";

interface WarGroup {
  id: string;
  name: string;
  city: string;
  state: string;
  description: string | null;
  memberCount: number;
  meetingInfo: string | null;
  leader: {
    id: string;
    firstName: string;
    lastName: string;
    profileImageUrl: string | null;
  };
}

interface GroupMembership {
  id: string;
  groupId: string;
  userId: string;
  status: string;
  role: string;
}

interface PendingRequest {
  id: string;
  groupId: string;
  userId: string;
  status: string;
  requestedAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    profileImageUrl: string | null;
    email: string;
  };
}

interface GroupPost {
  id: string;
  groupId: string;
  userId: string;
  content: string;
  postType: string;
  likes: number;
  replyCount: number;
  isPinned: boolean;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    profileImageUrl: string | null;
  } | null;
}

interface GroupReply {
  id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    profileImageUrl: string | null;
  } | null;
}

export default function WarGroupDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: group, isLoading } = useQuery<WarGroup>({
    queryKey: [`/api/war-groups/${id}`],
  });

  const { data: membership } = useQuery<GroupMembership | null>({
    queryKey: [`/api/war-groups/${id}/membership`],
    enabled: !!id,
  });

  const { data: myGroups = [] } = useQuery<WarGroup[]>({
    queryKey: ['/api/user/war-groups'],
  });

  const joinMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/war-groups/${id}/join`, {});
    },
    onSuccess: () => {
      toast({
        title: "Request Sent",
        description: "Your request to join this group has been sent to the leader",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/war-groups/${id}/membership`] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send join request",
        variant: "destructive",
      });
    },
  });

  const leaveMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/war-groups/${id}/leave`, {});
    },
    onSuccess: () => {
      toast({
        title: "Left Group",
        description: "You have left this war group",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user/war-groups'] });
      queryClient.invalidateQueries({ queryKey: [`/api/war-groups/${id}/membership`] });
      queryClient.invalidateQueries({ queryKey: [`/api/war-groups/${id}`] });
      navigate('/war-groups');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to leave group",
        variant: "destructive",
      });
    },
  });

  const isMember = myGroups.some(g => g.id === id);
  const isLeader = group?.leader?.id === membership?.userId;

  // Fetch pending requests (only for leaders)
  const { data: pendingRequests = [] } = useQuery<PendingRequest[]>({
    queryKey: [`/api/war-groups/${id}/pending-requests`],
    enabled: !!id && isLeader,
  });

  const approveMutation = useMutation({
    mutationFn: async (memberId: string) => {
      return apiRequest('POST', `/api/war-groups/${id}/members/${memberId}/approve`, {});
    },
    onSuccess: () => {
      toast({
        title: "Member Approved",
        description: "The member has been added to the group",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/war-groups/${id}/pending-requests`] });
      queryClient.invalidateQueries({ queryKey: [`/api/war-groups/${id}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve member",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (memberId: string) => {
      return apiRequest('POST', `/api/war-groups/${id}/members/${memberId}/reject`, {});
    },
    onSuccess: () => {
      toast({
        title: "Request Rejected",
        description: "The membership request has been declined",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/war-groups/${id}/pending-requests`] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject request",
        variant: "destructive",
      });
    },
  });

  const hasPendingRequest = membership?.status === 'pending';

  // Discussion Board State
  const [newPostContent, setNewPostContent] = useState("");
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());
  const [replyContent, setReplyContent] = useState<{ [postId: string]: string }>({});

  // Fetch group posts (only for members)
  const { data: posts = [], isLoading: postsLoading } = useQuery<GroupPost[]>({
    queryKey: [`/api/war-groups/${id}/posts`],
    enabled: !!id && isMember,
  });

  // Create post mutation
  const createPostMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/war-groups/${id}/posts`, { content: newPostContent, postType: 'discussion' });
    },
    onSuccess: () => {
      toast({ title: "Posted", description: "Your post has been shared" });
      setNewPostContent("");
      queryClient.invalidateQueries({ queryKey: [`/api/war-groups/${id}/posts`] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create post", variant: "destructive" });
    },
  });

  // Like post mutation
  const likePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      return apiRequest('POST', `/api/war-groups/${id}/posts/${postId}/like`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/war-groups/${id}/posts`] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to like post", variant: "destructive" });
    },
  });

  // Delete post mutation
  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      return apiRequest('DELETE', `/api/war-groups/${id}/posts/${postId}`, {});
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Post has been removed" });
      queryClient.invalidateQueries({ queryKey: [`/api/war-groups/${id}/posts`] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete post", variant: "destructive" });
    },
  });

  // Pin post mutation
  const pinPostMutation = useMutation({
    mutationFn: async (postId: string) => {
      return apiRequest('POST', `/api/war-groups/${id}/posts/${postId}/pin`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/war-groups/${id}/posts`] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to pin post", variant: "destructive" });
    },
  });

  // Create reply mutation
  const createReplyMutation = useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      return apiRequest('POST', `/api/war-groups/${id}/posts/${postId}/replies`, { content });
    },
    onSuccess: (_, { postId }) => {
      toast({ title: "Replied", description: "Your reply has been posted" });
      setReplyContent(prev => ({ ...prev, [postId]: "" }));
      queryClient.invalidateQueries({ queryKey: [`/api/war-groups/${id}/posts`] });
      queryClient.invalidateQueries({ queryKey: [`/api/war-groups/${id}/posts/${postId}/replies`] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to post reply", variant: "destructive" });
    },
  });

  const toggleReplies = (postId: string) => {
    setExpandedPosts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  };

  if (isLoading) {
    return (
      <div className="pb-20">
        <div className="bg-gradient-to-r from-ministry-navy to-ministry-charcoal dark:from-header-dark dark:to-ministry-navy text-white px-6 pt-12 pb-6">
          <div className="max-w-4xl mx-auto">
            <div className="animate-pulse">
              <div className="h-8 bg-ministry-gold-exact rounded w-2/3 mb-2"></div>
              <div className="h-4 bg-ministry-gold-exact rounded w-1/3"></div>
            </div>
          </div>
        </div>
        <div className="max-w-4xl mx-auto p-4">
          <div className="animate-pulse space-y-4">
            <div className="h-32 bg-ministry-gold-exact rounded"></div>
            <div className="h-48 bg-ministry-gold-exact rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="pb-20">
        <div className="bg-gradient-to-r from-ministry-navy to-ministry-charcoal dark:from-header-dark dark:to-ministry-navy text-white px-6 pt-12 pb-6">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl font-black mb-2 tracking-tight">Group Not Found</h1>
          </div>
        </div>
        <div className="max-w-4xl mx-auto p-4">
          <Card className="bg-ministry-gold-exact border-2 border-black">
            <CardContent className="text-center py-12">
              <p className="text-black font-semibold mb-4">This war group could not be found</p>
              <Link href="/war-groups">
                <Button className="bg-black text-white hover:bg-gray-900">
                  Back to Groups
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-ministry-navy to-ministry-charcoal dark:from-header-dark dark:to-ministry-navy text-white px-6 pt-12 pb-6">
        <div className="max-w-4xl mx-auto">
          <Link href="/war-groups">
            <Button variant="ghost" className="text-white hover:text-ministry-gold-exact mb-4 -ml-2 font-semibold uppercase tracking-wide text-xs">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Groups
            </Button>
          </Link>
          <h1 className="text-5xl lg:text-6xl font-black mb-3 tracking-tight leading-tight">{group.name}</h1>
          <div className="flex items-center gap-6 text-ministry-gold-exact font-semibold uppercase tracking-widest text-xs">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {group.city}, {group.state}
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              {group.memberCount} members
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Join/Status Card */}
        {!isMember && (
          <Card className="bg-black/90 border-2 border-ministry-gold-exact shadow-[0_0_20px_rgba(252,208,0,0.15)]">
            <CardContent className="pt-6">
              {hasPendingRequest ? (
                <div className="text-center">
                  <Badge className="bg-ministry-gold-exact text-black font-black uppercase tracking-widest text-xs mb-4">Pending Request</Badge>
                  <p className="text-white font-semibold">Your request to join is pending approval from the group leader</p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-white font-semibold mb-4">Join this war group to connect with local brothers</p>
                  <Button 
                    onClick={() => joinMutation.mutate()}
                    disabled={joinMutation.isPending}
                    className="bg-ministry-gold-exact text-black hover:bg-ministry-gold-exact/90 font-black uppercase tracking-widest text-xs"
                    data-testid="button-join-group"
                  >
                    {joinMutation.isPending ? 'Sending Request...' : 'Request to Join'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {isMember && (
          <Card className="bg-black/90 border-2 border-ministry-gold-exact shadow-[0_0_20px_rgba(252,208,0,0.15)]">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge className="bg-ministry-gold-exact text-black font-black uppercase tracking-widest text-xs">{isLeader ? 'Leader' : 'Member'}</Badge>
                  <p className="text-white font-semibold">You are a {isLeader ? 'leader' : 'member'} of this group</p>
                </div>
                {!isLeader && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => leaveMutation.mutate()}
                    disabled={leaveMutation.isPending}
                    className="border-red-500 text-red-500 hover:bg-red-500/10 font-semibold uppercase tracking-wide text-xs"
                    data-testid="button-leave-group"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    {leaveMutation.isPending ? 'Leaving...' : 'Leave Group'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pending Requests (Leader Only) */}
        {isLeader && pendingRequests.length > 0 && (
          <Card className="bg-black border-2 border-ministry-gold-exact shadow-[0_0_20px_rgba(252,208,0,0.1)]">
            <CardHeader>
              <CardTitle className="text-ministry-gold-exact flex items-center gap-2 text-xl font-black uppercase tracking-tight">
                <UserPlus className="h-5 w-5" />
                Pending Requests
                <Badge className="bg-red-500 text-white ml-2 font-bold">{pendingRequests.length}</Badge>
              </CardTitle>
              <CardDescription className="text-white/70 font-medium">
                Review and approve members who want to join your group
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingRequests.map((request) => (
                <div key={request.id} className="flex items-center justify-between bg-white/10 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    {request.user.profileImageUrl ? (
                      <img 
                        src={request.user.profileImageUrl} 
                        alt={request.user.firstName}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-ministry-gold-exact flex items-center justify-center">
                        <User className="h-5 w-5 text-black" />
                      </div>
                    )}
                    <div>
                      <p className="text-white font-semibold">
                        {request.user.firstName} {request.user.lastName}
                      </p>
                      <p className="text-white/60 text-xs">{request.user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => approveMutation.mutate(request.id)}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      className="bg-green-600 hover:bg-green-700 text-white"
                      data-testid={`button-approve-${request.id}`}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => rejectMutation.mutate(request.id)}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      className="border-red-500 text-red-500 hover:bg-red-500/10"
                      data-testid={`button-reject-${request.id}`}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Group Info */}
        <Card className="bg-black border-2 border-ministry-gold-exact shadow-[0_0_20px_rgba(252,208,0,0.1)]">
          <CardHeader>
            <CardTitle className="text-2xl font-black uppercase tracking-tight text-ministry-gold-exact">About This Group</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {group.description && (
              <div>
                <p className="text-white/90 font-medium leading-relaxed">{group.description}</p>
              </div>
            )}
            
            <div>
              <div className="flex items-center gap-2 mb-2">
                <User className="h-4 w-4 text-ministry-gold-exact" />
                <span className="text-ministry-gold-exact font-bold uppercase tracking-widest text-xs">Group Leader</span>
              </div>
              <p className="text-white font-semibold text-lg">{group.leader.firstName} {group.leader.lastName}</p>
            </div>

            {group.meetingInfo && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-ministry-gold-exact" />
                  <span className="text-ministry-gold-exact font-bold uppercase tracking-widest text-xs">Meeting Info</span>
                </div>
                <p className="text-white font-semibold text-lg">{group.meetingInfo}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs for Community */}
        {isMember && (
          <Tabs defaultValue="community" className="w-full">
            <TabsList className="w-full bg-transparent p-0 gap-2">
              <TabsTrigger value="community" className="flex-1 font-bold uppercase tracking-wide text-sm data-[state=active]:bg-black data-[state=active]:text-white data-[state=inactive]:bg-white data-[state=inactive]:border-2 data-[state=inactive]:border-black data-[state=inactive]:text-black data-[state=inactive]:hover:bg-gray-100">Community</TabsTrigger>
              <TabsTrigger value="info" className="flex-1 font-bold uppercase tracking-wide text-sm data-[state=active]:bg-black data-[state=active]:text-white data-[state=inactive]:bg-white data-[state=inactive]:border-2 data-[state=inactive]:border-black data-[state=inactive]:text-black data-[state=inactive]:hover:bg-gray-100">Info</TabsTrigger>
            </TabsList>

            <TabsContent value="community" className="mt-4 space-y-4">
              {/* Create Post */}
              <Card className="bg-black/90 border-2 border-ministry-gold-exact shadow-[0_0_20px_rgba(252,208,0,0.1)]">
                <CardContent className="pt-4">
                  <Textarea
                    placeholder="SHARE SOMETHING WITH YOUR GROUP..."
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    className="bg-white/10 border-white/20 text-white font-medium placeholder:text-white/40 placeholder:text-xs placeholder:tracking-widest placeholder:uppercase resize-none"
                    rows={3}
                    data-testid="input-new-post"
                  />
                  <div className="flex justify-end mt-3">
                    <Button
                      onClick={() => createPostMutation.mutate()}
                      disabled={!newPostContent.trim() || createPostMutation.isPending}
                      className="bg-ministry-gold-exact text-black hover:bg-ministry-gold-exact/90 font-black uppercase tracking-widest text-xs"
                      data-testid="button-create-post"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Post
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Posts List */}
              {postsLoading ? (
                <div className="animate-pulse space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-32 bg-black/50 rounded-lg"></div>
                  ))}
                </div>
              ) : posts.length === 0 ? (
                <Card className="bg-black border-2 border-ministry-gold-exact">
                  <CardContent className="text-center py-12">
                    <MessageCircle className="h-12 w-12 text-ministry-gold-exact mx-auto mb-4" />
                    <p className="text-white font-semibold">No posts yet</p>
                    <p className="text-white/60 text-sm mt-1">Be the first to share something!</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {posts.map((post) => (
                    <PostCard 
                      key={post.id} 
                      post={post} 
                      groupId={id!}
                      isLeader={isLeader}
                      currentUserId={membership?.userId}
                      onLike={() => likePostMutation.mutate(post.id)}
                      onDelete={() => deletePostMutation.mutate(post.id)}
                      onPin={() => pinPostMutation.mutate(post.id)}
                      isExpanded={expandedPosts.has(post.id)}
                      onToggleReplies={() => toggleReplies(post.id)}
                      replyContent={replyContent[post.id] || ""}
                      onReplyContentChange={(content) => setReplyContent(prev => ({ ...prev, [post.id]: content }))}
                      onSubmitReply={() => createReplyMutation.mutate({ postId: post.id, content: replyContent[post.id] || "" })}
                      isSubmittingReply={createReplyMutation.isPending}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="info" className="mt-4">
              <Card className="bg-black border-2 border-ministry-gold-exact shadow-[0_0_20px_rgba(252,208,0,0.1)]">
                <CardHeader>
                  <CardTitle className="text-2xl font-black uppercase tracking-tight text-ministry-gold-exact">About This Group</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {group.description && (
                    <div>
                      <p className="text-white/90 font-medium leading-relaxed">{group.description}</p>
                    </div>
                  )}
                  
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-4 w-4 text-ministry-gold-exact" />
                      <span className="text-ministry-gold-exact font-bold uppercase tracking-widest text-xs">Group Leader</span>
                    </div>
                    <p className="text-white font-semibold text-lg">{group.leader.firstName} {group.leader.lastName}</p>
                  </div>

                  {group.meetingInfo && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="h-4 w-4 text-ministry-gold-exact" />
                        <span className="text-ministry-gold-exact font-bold uppercase tracking-widest text-xs">Meeting Info</span>
                      </div>
                      <p className="text-white font-semibold text-lg">{group.meetingInfo}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

// PostCard Component
interface PostCardProps {
  post: GroupPost;
  groupId: string;
  isLeader: boolean;
  currentUserId: string | undefined;
  onLike: () => void;
  onDelete: () => void;
  onPin: () => void;
  isExpanded: boolean;
  onToggleReplies: () => void;
  replyContent: string;
  onReplyContentChange: (content: string) => void;
  onSubmitReply: () => void;
  isSubmittingReply: boolean;
}

function PostCard({
  post,
  groupId,
  isLeader,
  currentUserId,
  onLike,
  onDelete,
  onPin,
  isExpanded,
  onToggleReplies,
  replyContent,
  onReplyContentChange,
  onSubmitReply,
  isSubmittingReply,
}: PostCardProps) {
  const canDelete = post.userId === currentUserId || isLeader;

  // Fetch replies when expanded
  const { data: replies = [] } = useQuery<GroupReply[]>({
    queryKey: [`/api/war-groups/${groupId}/posts/${post.id}/replies`],
    enabled: isExpanded,
  });

  return (
    <Card className="bg-black/90 border-2 border-ministry-gold-exact shadow-[0_0_20px_rgba(252,208,0,0.1)]" data-testid={`post-${post.id}`}>
      <CardContent className="p-6">
        {/* Post Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {post.user?.profileImageUrl ? (
              <img 
                src={post.user.profileImageUrl} 
                alt={post.user.firstName || "User"}
                className="h-10 w-10 rounded-full object-cover ring-2 ring-ministry-gold-exact/30"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-ministry-gold-exact flex items-center justify-center">
                <User className="h-5 w-5 text-black" />
              </div>
            )}
            <div>
              <p className="text-ministry-gold-exact font-bold uppercase tracking-wide text-sm">
                {post.user?.firstName} {post.user?.lastName}
              </p>
              <p className="text-white/50 text-xs font-medium tracking-wide">
                {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {post.isPinned && (
              <Badge className="bg-ministry-gold-exact text-black font-bold uppercase tracking-wide text-xs">
                <Pin className="h-3 w-3 mr-1" />
                Pinned
              </Badge>
            )}
            {isLeader && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onPin}
                className="text-white/60 hover:text-ministry-gold-exact hover:bg-white/10"
                data-testid={`button-pin-${post.id}`}
              >
                <Pin className="h-4 w-4" />
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onDelete}
                className="text-white/60 hover:text-red-500 hover:bg-white/10"
                data-testid={`button-delete-${post.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Post Content */}
        <p className="text-white/90 font-medium leading-relaxed mb-4 whitespace-pre-wrap">{post.content}</p>

        {/* Post Actions */}
        <div className="flex items-center gap-4 pt-4 border-t border-white/10">
          <Button
            variant="ghost"
            size="sm"
            onClick={onLike}
            className="text-white/60 hover:text-ministry-gold-exact hover:bg-white/10 font-semibold uppercase tracking-wide text-xs"
            data-testid={`button-like-${post.id}`}
          >
            <Heart className="h-4 w-4 mr-1" />
            {post.likes > 0 && post.likes}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleReplies}
            className="text-white/60 hover:text-ministry-gold-exact hover:bg-white/10 font-semibold uppercase tracking-wide text-xs"
            data-testid={`button-replies-${post.id}`}
          >
            <MessageCircle className="h-4 w-4 mr-1" />
            {post.replyCount > 0 && post.replyCount}
          </Button>
        </div>

        {/* Replies Section */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-white/10">
            {/* Reply Input */}
            <div className="flex gap-2 mb-4">
              <Textarea
                placeholder="WRITE A REPLY..."
                value={replyContent}
                onChange={(e) => onReplyContentChange(e.target.value)}
                className="bg-white/10 border-white/20 text-white font-medium placeholder:text-white/40 placeholder:text-xs placeholder:tracking-widest placeholder:uppercase resize-none flex-1"
                rows={2}
                data-testid={`input-reply-${post.id}`}
              />
              <Button
                onClick={onSubmitReply}
                disabled={!replyContent.trim() || isSubmittingReply}
                className="bg-ministry-gold-exact text-black hover:bg-ministry-gold-exact/90 self-end font-bold"
                data-testid={`button-submit-reply-${post.id}`}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>

            {/* Replies List */}
            {replies.length > 0 && (
              <div className="space-y-3">
                {replies.map((reply) => (
                  <div key={reply.id} className="flex gap-3 bg-white/5 rounded-lg p-3" data-testid={`reply-${reply.id}`}>
                    {reply.user?.profileImageUrl ? (
                      <img 
                        src={reply.user.profileImageUrl} 
                        alt={reply.user.firstName || "User"}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-ministry-gold-exact flex items-center justify-center flex-shrink-0">
                        <User className="h-4 w-4 text-black" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-ministry-gold-exact font-bold uppercase tracking-wide text-xs">
                          {reply.user?.firstName} {reply.user?.lastName}
                        </span>
                        <span className="text-white/50 text-xs font-medium tracking-wide">
                          {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-white/80 text-sm font-medium leading-relaxed mt-1">{reply.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
