import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MentionTextarea, MentionText } from '@/components/mention-textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useWebSocket } from '@/hooks/useWebSocket';
import { triggerRefTagger } from '@/hooks/useRefTagger';
import { formatDistanceToNow } from 'date-fns';
import { Trash2, Search, SortDesc, Shield, HandHelping, CheckCircle, MessageSquare, Send, Pencil, Flame, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link, useLocation } from 'wouter';
import { BackButton } from "@/components/BackButton";
import { ReactorList } from '@/components/reactor-list';

interface AccountabilityRequest {
  id: string;
  userId: string;
  content: string;
  assistedById: string | null;
  assistedAt: string | null;
  createdAt: string;
  supportCount: number;
  gotYour6ByMe: boolean;
  amenCount: number;
  amenedByMe: boolean;
  ohMeCount: number;
  ohMeByMe: boolean;
  commentCount: number;
  user: { id: string; firstName: string; lastName: string; profileImageUrl?: string };
  assister: { id: string; firstName: string; lastName: string; profileImageUrl?: string } | null;
}

interface Comment {
  id: string;
  requestId: string;
  userId: string;
  content: string;
  parentCommentId: string | null;
  createdAt: string;
  authorName: string;
  authorProfilePicture?: string;
}

// ─── CommentsSection is a TOP-LEVEL component (outside UnderFire) ─────────────
// This prevents React from seeing it as a new component type on every render
// of the parent, which would cause inputs to lose focus on every keystroke.
interface CommentsSectionProps {
  requestId: string;
  currentUserId?: string;
  isMod: boolean;
}

function CommentsSection({ requestId, currentUserId, isMod }: CommentsSectionProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [commentText, setCommentText] = useState('');
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');

  const { data: comments = [], isLoading } = useQuery<Comment[]>({
    queryKey: ['/api/accountability-requests', requestId, 'comments'],
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({ content, parentCommentId }: { content: string; parentCommentId?: string }) =>
      apiRequest('POST', `/api/accountability-requests/${requestId}/comments`, { content, parentCommentId }),
    onSuccess: () => {
      setCommentText('');
      setReplyToId(null);
      setReplyText('');
      queryClient.invalidateQueries({ queryKey: ['/api/accountability-requests', requestId, 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/accountability-requests'] });
    },
    onError: (error: any) => toast({ title: "Error", description: error.response?.data?.message || "Failed to post comment", variant: "destructive" }),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => apiRequest('DELETE', `/api/accountability-requests/comments/${commentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/accountability-requests', requestId, 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/accountability-requests'] });
    },
    onError: (error: any) => toast({ title: "Error", description: error.response?.data?.message || "Failed to delete comment", variant: "destructive" }),
  });

  const editCommentMutation = useMutation({
    mutationFn: async ({ commentId, content }: { commentId: string; content: string }) =>
      apiRequest('PATCH', `/api/accountability-requests/comments/${commentId}`, { content }),
    onSuccess: () => {
      setEditingCommentId(null);
      setEditCommentText('');
      queryClient.invalidateQueries({ queryKey: ['/api/accountability-requests', requestId, 'comments'] });
    },
    onError: (error: any) => toast({ title: "Error", description: error.response?.data?.message || "Failed to edit comment", variant: "destructive" }),
  });

  const topLevel = comments.filter(c => !c.parentCommentId);
  const repliesMap: Record<string, Comment[]> = {};
  comments.filter(c => c.parentCommentId).forEach(c => {
    if (!repliesMap[c.parentCommentId!]) repliesMap[c.parentCommentId!] = [];
    repliesMap[c.parentCommentId!].push(c);
  });

  const formatTimeAgo = (d: string) => formatDistanceToNow(new Date(d), { addSuffix: true });

  const renderComment = (c: Comment, isReply = false) => (
    <div key={c.id} className={`flex items-start gap-2 ${isReply ? 'ml-8 mt-1' : ''}`}>
      {c.authorProfilePicture ? (
        <img src={c.authorProfilePicture} alt="" className="w-7 h-7 rounded-full object-cover border-2 border-black flex-shrink-0" />
      ) : (
        <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0">
          <User className="w-3.5 h-3.5 text-zinc-400" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1 flex-wrap">
          <span className="text-white text-xs font-black">{c.authorName}</span>
          <span className="text-white/40 text-[10px]">{formatTimeAgo(c.createdAt)}</span>
        </div>
        {editingCommentId === c.id ? (
          <div className="flex gap-1 mt-1">
            <input
              type="text"
              value={editCommentText}
              onChange={e => setEditCommentText(e.target.value)}
              autoFocus
              className="flex-1 bg-zinc-800 border border-zinc-600 rounded-sm text-white text-xs px-2 py-1 focus:outline-none"
            />
            <button
              onClick={() => editCommentMutation.mutate({ commentId: c.id, content: editCommentText })}
              disabled={!editCommentText.trim() || editCommentMutation.isPending}
              className="text-[#FDD000] text-xs font-black disabled:opacity-50"
            >Save</button>
            <button onClick={() => setEditingCommentId(null)} className="text-zinc-500 text-xs">Cancel</button>
          </div>
        ) : (
          <p className="text-white/80 text-xs break-words whitespace-pre-wrap">{c.content}</p>
        )}
        {!isReply && editingCommentId !== c.id && (
          <button
            onClick={() => { setReplyToId(replyToId === c.id ? null : c.id); setReplyText(''); }}
            className="text-white/40 hover:text-white/70 text-[10px] mt-0.5 font-medium"
          >
            Reply
          </button>
        )}
      </div>
      {editingCommentId !== c.id && (c.userId === currentUserId || isMod) && (
        <div className="flex gap-1 flex-shrink-0">
          {c.userId === currentUserId && (
            <button
              onClick={() => { setEditingCommentId(c.id); setEditCommentText(c.content); }}
              className="text-zinc-600 hover:text-zinc-300"
              title="Edit"
            >
              <Pencil className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={() => deleteCommentMutation.mutate(c.id)}
            className="text-zinc-600 hover:text-red-400"
            title="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="border-t-2 border-ministry-gold-exact/30 pt-4 space-y-3">
      {isLoading ? (
        <p className="text-white/40 text-xs">Loading comments…</p>
      ) : topLevel.length === 0 ? (
        <p className="text-white/40 text-xs">No comments yet. Be the first!</p>
      ) : (
        <div className="space-y-3">
          {topLevel.map(c => (
            <div key={c.id}>
              {renderComment(c)}
              {(repliesMap[c.id] || []).map(r => renderComment(r, true))}
              {replyToId === c.id && (
                <div className="flex gap-1 ml-8 mt-1">
                  <input
                    type="text"
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter' && replyText.trim())
                        addCommentMutation.mutate({ content: replyText.trim(), parentCommentId: c.id });
                    }}
                    placeholder={`Reply to ${c.authorName}…`}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-sm text-white text-xs px-2 py-1 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
                  />
                  <button
                    onClick={() => addCommentMutation.mutate({ content: replyText.trim(), parentCommentId: c.id })}
                    disabled={!replyText.trim() || addCommentMutation.isPending}
                    className="bg-[#FDD000] text-black font-black text-xs px-2 py-1 rounded-sm disabled:opacity-50"
                  >
                    <Send className="w-3 h-3" />
                  </button>
                  <button onClick={() => setReplyToId(null)} className="text-zinc-500 text-xs px-1">✕</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={commentText}
          onChange={e => setCommentText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && commentText.trim())
              addCommentMutation.mutate({ content: commentText.trim() });
          }}
          placeholder="Write a comment…"
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-sm text-white text-xs px-3 py-1.5 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
        />
        <button
          onClick={() => addCommentMutation.mutate({ content: commentText.trim() })}
          disabled={!commentText.trim() || addCommentMutation.isPending}
          className="bg-[#FDD000] text-black font-black text-xs px-3 py-1.5 rounded-sm border-2 border-black disabled:opacity-50 flex items-center gap-1"
        >
          <Send className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

export default function UnderFire() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [newRequestContent, setNewRequestContent] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'my_posts' | 'my_assisted'>('newest');
  const [highlightedRequest, setHighlightedRequest] = useState<string | null>(null);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());

  const { data: currentUser } = useQuery<{ id: string; role?: string }>({ queryKey: ['/api/auth/user'] });
  const isMod = ['admin', 'moderator', 'owner'].includes((currentUser as any)?.role || '');

  useWebSocket(currentUser?.id);

  const { data: allRequests = [], isLoading } = useQuery<AccountabilityRequest[]>({
    queryKey: ['/api/accountability-requests'],
    refetchOnMount: 'always',
    staleTime: 0,
  });

  useEffect(() => {
    if (allRequests.length > 0) triggerRefTagger();
  }, [allRequests]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const requestId = urlParams.get('request');
    if (requestId) {
      setHighlightedRequest(requestId);
      setTimeout(() => {
        const element = document.querySelector(`[data-request-id="${requestId}"]`);
        if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 800);
    }
  }, [allRequests]);

  const requests = React.useMemo(() => {
    let filtered = allRequests;
    if (searchTerm) filtered = filtered.filter(r => r.content.toLowerCase().includes(searchTerm.toLowerCase()));
    if (sortBy === 'my_posts') {
      filtered = filtered.filter(r => r.userId === currentUser?.id);
    } else if (sortBy === 'my_assisted') {
      filtered = filtered.filter(r => r.assistedById === currentUser?.id);
    } else {
      filtered = [...filtered].sort((a, b) => {
        const da = new Date(a.createdAt).getTime();
        const db2 = new Date(b.createdAt).getTime();
        return sortBy === 'newest' ? db2 - da : da - db2;
      });
    }
    return filtered;
  }, [allRequests, searchTerm, sortBy, currentUser?.id]);

  const createRequestMutation = useMutation({
    mutationFn: async (content: string) => apiRequest('POST', '/api/accountability-requests', { content }),
    onSuccess: () => {
      toast({ title: "Request Posted", description: "Your accountability request has been shared" });
      setNewRequestContent('');
      queryClient.invalidateQueries({ queryKey: ['/api/accountability-requests'] });
    },
    onError: (error: any) => toast({ title: "Error", description: error.response?.data?.message || "Failed to create request", variant: "destructive" }),
  });

  const assistMutation = useMutation({
    mutationFn: async (requestId: string) => apiRequest('POST', `/api/accountability-requests/${requestId}/assist`),
    onSuccess: (data: any) => {
      toast({ title: "Accountability Accepted!", description: "A direct message has been created. Check your messages to connect." });
      queryClient.invalidateQueries({ queryKey: ['/api/accountability-requests'] });
      if (data.conversationId) setLocation(`/messages?conversation=${data.conversationId}`);
    },
    onError: (error: any) => toast({ title: "Error", description: error.response?.data?.message || "Failed to assist with request", variant: "destructive" }),
  });

  const deleteRequestMutation = useMutation({
    mutationFn: async (requestId: string) => apiRequest('DELETE', `/api/accountability-requests/${requestId}`),
    onSuccess: () => {
      toast({ title: "Request Deleted", description: "Your accountability request has been removed" });
      queryClient.invalidateQueries({ queryKey: ['/api/accountability-requests'] });
    },
    onError: (error: any) => toast({ title: "Error", description: error.response?.data?.message || "Failed to delete request", variant: "destructive" }),
  });

  const unassistMutation = useMutation({
    mutationFn: async (requestId: string) => apiRequest('POST', `/api/accountability-requests/${requestId}/unassist`),
    onSuccess: () => {
      toast({ title: "Unassisted", description: "You are no longer assisting this request." });
      queryClient.invalidateQueries({ queryKey: ['/api/accountability-requests'] });
    },
    onError: (error: any) => toast({ title: "Error", description: error.response?.data?.message || "Failed to unassist", variant: "destructive" }),
  });

  const supportMutation = useMutation({
    mutationFn: async (requestId: string) => apiRequest('POST', `/api/accountability-requests/${requestId}/support`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/accountability-requests'] }),
    onError: (error: any) => toast({ title: "Error", description: error.response?.data?.message || "Failed to toggle support", variant: "destructive" }),
  });

  const amenMutation = useMutation({
    mutationFn: async (requestId: string) => apiRequest('POST', `/api/accountability-requests/${requestId}/amen`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/accountability-requests'] }),
    onError: (error: any) => toast({ title: "Error", description: error.response?.data?.message || "Failed to toggle amen", variant: "destructive" }),
  });

  const ohMeMutation = useMutation({
    mutationFn: async (requestId: string) => apiRequest('POST', `/api/accountability-requests/${requestId}/oh-me`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/accountability-requests'] }),
    onError: (error: any) => toast({ title: "Error", description: error.response?.data?.message || "Failed to toggle oh-me", variant: "destructive" }),
  });

  const toggleComments = (requestId: string) => {
    setExpandedComments(prev => {
      const next = new Set(prev);
      if (next.has(requestId)) next.delete(requestId); else next.add(requestId);
      return next;
    });
  };

  const formatTimeAgo = (d: string) => formatDistanceToNow(new Date(d), { addSuffix: true });

  if (isLoading) {
    return (
      <div className="pb-20">
        <div className="liquid-header text-white px-6 pt-8 pb-6">
          <div className="max-w-2xl mx-auto">
            <BackButton />
            <h1 className="text-4xl font-black tracking-tight">Under Fire</h1>
            <p className="text-ministry-gold-exact text-sm font-semibold">Request Accountability</p>
          </div>
        </div>
        <div className="max-w-2xl mx-auto p-4">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-ministry-gold-exact rounded"></div>
            <div className="h-32 bg-ministry-gold-exact rounded"></div>
            <div className="h-24 bg-ministry-gold-exact rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20">
      <div className="liquid-header text-white px-6 pt-8 pb-6">
        <div className="max-w-2xl mx-auto">
          <BackButton />
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-4xl font-black tracking-tighter uppercase">Under Fire</h1>
          </div>
          <p className="text-ministry-gold-exact text-xs font-bold tracking-widest uppercase">Request Accountability</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">

        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-black" />
            <Input
              placeholder="SEARCH REQUESTS..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-2 border-black bg-ministry-gold-exact rounded-sm text-black placeholder:text-black/50 placeholder:font-medium placeholder:text-xs placeholder:tracking-wide font-medium"
            />
          </div>
          <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
            <SelectTrigger className="w-44 border-2 border-black bg-ministry-gold-exact text-black font-bold rounded-sm">
              <SortDesc className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="my_posts">Requests I Posted</SelectItem>
              <SelectItem value="my_assisted">Requests I Assisted With</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card className="liquid-black-white border-2 border-ministry-gold-exact rounded-sm shadow-[4px_4px_0px_0px_rgba(253,208,0,1)]">
          <CardHeader className="relative z-10">
            <CardTitle className="text-white flex items-center gap-2 text-2xl font-black tracking-tighter uppercase">
              <Shield className="h-6 w-6 text-ministry-gold-exact" />
              Request Accountability
            </CardTitle>
            <p className="text-white/80 text-base font-medium leading-relaxed">
              A place for men to request accountability. This can be growing closer to God, health goals, or a sin you're struggling with. Submit your request and a brother can volunteer to hold you accountable — a direct message will be created between you both.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 relative z-10">
            <div className="space-y-2">
              <Label htmlFor="content" className="text-white font-semibold">Accountability Request</Label>
              <MentionTextarea
                id="content"
                placeholder="Share what you need accountability for... Type @ to mention a brother."
                value={newRequestContent}
                onChange={setNewRequestContent}
                className="min-h-[100px] bg-white text-black border-2 border-black placeholder:text-black/50"
                data-testid="textarea-accountability-request"
              />
            </div>
            <Button
              onClick={() => {
                if (!newRequestContent.trim()) {
                  toast({ title: "Error", description: "Please enter your accountability request", variant: "destructive" });
                  return;
                }
                createRequestMutation.mutate(newRequestContent);
              }}
              disabled={createRequestMutation.isPending || !newRequestContent.trim()}
              className="w-full bg-ministry-gold-exact hover:bg-yellow-400 text-black font-black text-lg py-6 rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] border-2 border-black transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] uppercase tracking-wide"
              data-testid="button-share-request"
            >
              {createRequestMutation.isPending ? 'Posting...' : 'Share Request'}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {requests.length === 0 ? (
            <Card className="bg-ministry-gold-exact border-2 border-black rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <CardContent className="text-center py-12">
                <Shield className="h-12 w-12 text-black mx-auto mb-4" />
                <p className="text-black font-medium">No accountability requests yet. Be the first to share!</p>
              </CardContent>
            </Card>
          ) : (
            requests.map((request) => (
              <Card
                key={request.id}
                data-request-id={request.id}
                className={`liquid-black-white border-2 rounded-sm shadow-[4px_4px_0px_0px_rgba(253,208,0,1)] ${
                  highlightedRequest === request.id
                    ? 'border-[#FDD000] ring-2 ring-[#FDD000] ring-opacity-70'
                    : 'border-ministry-gold-exact'
                }`}
              >
                <CardHeader className="relative z-10">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/users/${request.user.id}`}>
                          <span className="text-white font-medium hover:text-ministry-gold-exact cursor-pointer transition-colors">
                            {request.user.firstName} {request.user.lastName}
                          </span>
                        </Link>
                        <Badge className="bg-ministry-gold-exact text-black font-semibold">Accountability Request</Badge>
                        {request.assistedById && (
                          <Badge className="bg-ministry-gold-exact text-black font-semibold">
                            <CheckCircle className="h-3 w-3 mr-1" />Assisted
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-white/50">{formatTimeAgo(request.createdAt)}</p>
                    </div>
                    {(currentUser?.id === request.userId || isMod) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (window.confirm('Delete this request? This cannot be undone.'))
                            deleteRequestMutation.mutate(request.id);
                        }}
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20 p-1 h-auto"
                        disabled={deleteRequestMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 relative z-10">
                  <div className="bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-sm p-3">
                    <p className="text-black leading-relaxed whitespace-pre-wrap">
                      <MentionText text={request.content} />
                    </p>
                  </div>

                  <Separator className="bg-ministry-gold-exact/30" />

                  {/* Assist row */}
                  <div className="flex items-center gap-3 flex-wrap">
                    {request.assistedById ? (
                      <>
                        <div className="flex items-center gap-2 text-white">
                          <CheckCircle className="h-4 w-4 text-ministry-gold-exact" />
                          <span className="text-sm font-medium">
                            Accountability accepted by{' '}
                            {request.assister
                              ? `${request.assister.firstName || ''} ${request.assister.lastName || ''}`.trim()
                              : 'a brother'}
                          </span>
                        </div>
                        {currentUser?.id === request.assistedById && (
                          <Button
                            onClick={() => unassistMutation.mutate(request.id)}
                            disabled={unassistMutation.isPending}
                            size="sm"
                            className="bg-ministry-gold-exact text-black hover:bg-yellow-400 font-bold rounded-sm border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                          >
                            {unassistMutation.isPending ? 'Processing...' : 'Unassist'}
                          </Button>
                        )}
                      </>
                    ) : currentUser?.id !== request.userId ? (
                      <Button
                        onClick={() => assistMutation.mutate(request.id)}
                        disabled={assistMutation.isPending}
                        className="bg-ministry-gold-exact text-black hover:bg-yellow-400 font-bold rounded-sm border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                        data-testid={`button-assist-${request.id}`}
                      >
                        <HandHelping className="h-4 w-4 mr-2" />
                        {assistMutation.isPending ? 'Processing...' : 'Assist'}
                      </Button>
                    ) : (
                      <span className="text-white/60 text-sm italic">Waiting for someone to assist...</span>
                    )}
                  </div>

                  <Separator className="bg-ministry-gold-exact/20" />

                  {/* Reactions row */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {/* Amen */}
                    <button
                      onClick={() => amenMutation.mutate(request.id)}
                      disabled={amenMutation.isPending}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm border-2 border-black text-xs font-bold transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                        request.amenedByMe
                          ? 'bg-ministry-gold-exact text-black'
                          : 'bg-transparent text-white hover:bg-ministry-gold-exact hover:text-black'
                      }`}
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill={request.amenedByMe ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                        <path d="M12 2L8 8H4l4 4-1.5 6L12 15l5.5 3L16 12l4-4h-4L12 2z" />
                      </svg>
                      {request.amenCount > 0 && (
                        <ReactorList
                          endpointUrl={`/api/accountability-requests/${request.id}/ameners`}
                          queryKey={['/api/accountability-requests', request.id, 'ameners']}
                          label="Said Amen"
                          count={request.amenCount}
                        >
                          <span>{request.amenCount}</span>
                        </ReactorList>
                      )}
                      Amen
                    </button>

                    {/* Oh Me */}
                    <button
                      onClick={() => ohMeMutation.mutate(request.id)}
                      disabled={ohMeMutation.isPending}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm border-2 border-black text-xs font-bold transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                        request.ohMeByMe
                          ? 'bg-red-500 text-white border-red-700'
                          : 'bg-transparent text-white hover:bg-red-500 hover:text-white hover:border-red-700'
                      }`}
                    >
                      <Flame className={`w-3.5 h-3.5 ${request.ohMeByMe ? 'fill-current' : ''}`} />
                      {request.ohMeCount > 0 && (
                        <ReactorList
                          endpointUrl={`/api/accountability-requests/${request.id}/oh-mers`}
                          queryKey={['/api/accountability-requests', request.id, 'oh-mers']}
                          label="Said Oh Me"
                          count={request.ohMeCount}
                        >
                          <span>{request.ohMeCount}</span>
                        </ReactorList>
                      )}
                      Oh Me
                    </button>

                    {/* Got Your 6 (only when assisted and not your own post) */}
                    {request.assistedById && currentUser?.id !== request.userId && (
                      <button
                        onClick={() => supportMutation.mutate(request.id)}
                        disabled={supportMutation.isPending}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm border-2 border-black text-xs font-bold transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                          request.gotYour6ByMe
                            ? 'bg-ministry-gold-exact text-black'
                            : 'bg-transparent text-white hover:bg-ministry-gold-exact hover:text-black'
                        }`}
                      >
                        <Shield className="h-3.5 w-3.5" />
                        <span>Got Your 6</span>
                        {(request.supportCount ?? 0) > 0 && (
                          <span className="opacity-80">{request.supportCount}</span>
                        )}
                      </button>
                    )}

                    {/* Comments toggle */}
                    <button
                      onClick={() => toggleComments(request.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border-2 border-black text-xs font-bold bg-transparent text-white hover:bg-white/10 transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ml-auto"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      {request.commentCount} {request.commentCount === 1 ? 'Comment' : 'Comments'}
                    </button>
                  </div>

                  {/* Comments section — stable top-level component, no focus loss */}
                  {expandedComments.has(request.id) && (
                    <CommentsSection
                      requestId={request.id}
                      currentUserId={currentUser?.id}
                      isMod={isMod}
                    />
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
