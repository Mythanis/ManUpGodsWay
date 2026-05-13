import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { MentionTextarea, MentionText } from '@/components/mention-textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useWebSocket } from '@/hooks/useWebSocket';
import { triggerRefTagger } from '@/hooks/useRefTagger';
import { formatDistanceToNow } from 'date-fns';
import {
  MessageSquare, HandHeart, Plus, Trash2, Search,
  Send, Pencil, Star, EyeOff, Eye, ChevronDown, ChevronUp,
  X, AlertTriangle
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Link } from 'wouter';
import { BackButton } from "@/components/BackButton";
import { ReactorList } from "@/components/reactor-list";

// ─── Cross icon ───────────────────────────────────────────────────────────────
function ChristianCross({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M11 2h2v6h6v2h-6v12h-2V10H5V8h6V2z" />
    </svg>
  );
}

// ─── Inline delete confirmation ───────────────────────────────────────────────
function DeleteConfirm({ onConfirm, onCancel, label = "Delete" }: {
  onConfirm: () => void;
  onCancel: () => void;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-2 bg-red-950 border border-red-500/40 rounded-sm px-3 py-1.5">
      <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
      <span className="text-red-300 text-xs font-medium">Are you sure?</span>
      <button
        onClick={onConfirm}
        className="text-xs font-black text-red-400 hover:text-red-300 uppercase tracking-wide"
      >
        {label}
      </button>
      <button
        onClick={onCancel}
        className="text-xs text-white/40 hover:text-white/70"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
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
  user: { id: string; firstName: string; lastName: string; };
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
  user: { id: string; firstName: string; lastName: string; };
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function HurdleWall() {
  const { toast }       = useToast();
  const queryClient     = useQueryClient();
  const formRef         = useRef<HTMLDivElement>(null);

  const [newPostContent, setNewPostContent]     = useState('');
  const [isAnonymous, setIsAnonymous]           = useState(false);
  const [expandedPost, setExpandedPost]         = useState<string | null>(null);
  const [commentContent, setCommentContent]     = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm]             = useState('');
  const [sortBy, setSortBy]                     = useState<'newest' | 'oldest' | 'mine' | 'praised'>('newest');
  const [editingReplyId, setEditingReplyId]     = useState<string | null>(null);
  const [editReplyContent, setEditReplyContent] = useState('');
  const [highlightedPost, setHighlightedPost]   = useState<string | null>(null);
  const [praiseInputOpen, setPraiseInputOpen]   = useState<Record<string, boolean>>({});
  const [praiseContent, setPraiseContent]       = useState<Record<string, string>>({});
  const [praiseEditOpen, setPraiseEditOpen]     = useState<Record<string, boolean>>({});
  const [praiseEditContent, setPraiseEditContent] = useState<Record<string, string>>({});
  const [optimisticAmens, setOptimisticAmens]   = useState<Record<string, { count: number; hasAmened: boolean }>>({});
  const [pendingAmenPosts, setPendingAmenPosts] = useState<Set<string>>(new Set());
  const [pendingPraisePosts, setPendingPraisePosts] = useState<Set<string>>(new Set());
  // Inline delete confirmation state
  const [confirmDeletePostId, setConfirmDeletePostId]       = useState<string | null>(null);
  const [confirmDeleteCommentId, setConfirmDeleteCommentId] = useState<string | null>(null);
  const [showComposeForm, setShowComposeForm]   = useState(false);

  const { data: currentUser } = useQuery<{ id: string; role?: string }>({
    queryKey: ['/api/auth/user']
  });

  useWebSocket(currentUser?.id);

  const { data: allPosts = [], isLoading } = useQuery<HurdleWallPost[]>({
    queryKey: ['/api/hurdle-wall'],
    refetchOnMount: 'always',
    staleTime: 0,
  });

  useEffect(() => {
    if (allPosts.length > 0) triggerRefTagger();
  }, [allPosts]);

  // Deep-link ?post= support
  useEffect(() => {
    const postId = new URLSearchParams(window.location.search).get('post');
    if (postId) {
      setHighlightedPost(postId);
      setTimeout(() => {
        document.querySelector(`[data-post-id="${postId}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 800);
    }
  }, [allPosts]);

  // ── Filter & sort ─────────────────────────────────────────────────────────
  const posts = React.useMemo(() => {
    let filtered = allPosts;
    if (searchTerm) {
      filtered = filtered.filter(p =>
        p.content.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (sortBy === 'mine' && currentUser?.id) {
      filtered = filtered.filter(p => p.userId === currentUser.id);
    } else if (sortBy === 'praised') {
      filtered = filtered.filter(p => p.praise !== null);
    }
    return [...filtered].sort((a, b) => {
      const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return sortBy === 'oldest' ? -diff : diff;
    });
  }, [allPosts, searchTerm, sortBy, currentUser?.id]);

  const getAmenDisplay = (post: HurdleWallPost) =>
    optimisticAmens[post.id] ?? { count: post.amenCount ?? 0, hasAmened: post.userHasAmened ?? false };

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createPostMutation = useMutation({
    mutationFn: (data: { content: string; isAnonymous: boolean; postType: string }) =>
      apiRequest('POST', '/api/hurdle-wall', data),
    onSuccess: () => {
      toast({ title: "Prayer Request Posted", description: "Your request has been shared in the War Room." });
      setNewPostContent('');
      setIsAnonymous(false);
      setShowComposeForm(false);
      queryClient.invalidateQueries({ queryKey: ['/api/hurdle-wall'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.response?.data?.message || "Failed to create post", variant: "destructive" });
    },
  });

  const prayerMutation = useMutation({
    mutationFn: ({ postId, action }: { postId: string; action: 'add' | 'remove' }) =>
      action === 'add'
        ? apiRequest('POST', `/api/hurdle-wall/${postId}/pray`)
        : apiRequest('DELETE', `/api/hurdle-wall/${postId}/pray`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/hurdle-wall'] }),
    onError: () => toast({ title: "Error", description: "Failed to update prayer", variant: "destructive" }),
  });

  const amenMutation = useMutation({
    mutationFn: ({ postId, action }: { postId: string; action: 'add' | 'remove' }) =>
      action === 'add'
        ? apiRequest('POST', `/api/hurdle-wall/${postId}/amen`)
        : apiRequest('DELETE', `/api/hurdle-wall/${postId}/amen`),
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/hurdle-wall'] }),
    onSettled: (_, __, { postId }) => {
      setPendingAmenPosts(prev => { const s = new Set(prev); s.delete(postId); return s; });
      setOptimisticAmens(prev => { const n = { ...prev }; delete n[postId]; return n; });
    },
  });

  const praiseMutation = useMutation({
    mutationFn: ({ postId, content }: { postId: string; content: string }) =>
      apiRequest('POST', `/api/hurdle-wall/${postId}/praise`, { content }),
    onMutate: ({ postId }) => setPendingPraisePosts(prev => new Set(prev).add(postId)),
    onSuccess: (_, { postId }) => {
      toast({ title: "Praise Shared!", description: "God is good. Your praise has been added." });
      setPraiseInputOpen(prev => ({ ...prev, [postId]: false }));
      setPraiseContent(prev => ({ ...prev, [postId]: '' }));
      queryClient.invalidateQueries({ queryKey: ['/api/hurdle-wall'] });
    },
    onError: () => toast({ title: "Error", description: "Failed to add praise", variant: "destructive" }),
    onSettled: (_, __, { postId }) => setPendingPraisePosts(prev => { const s = new Set(prev); s.delete(postId); return s; }),
  });

  const editPraiseMutation = useMutation({
    mutationFn: ({ postId, content }: { postId: string; content: string }) =>
      apiRequest('PATCH', `/api/hurdle-wall/${postId}/praise`, { content }),
    onMutate: ({ postId }) => setPendingPraisePosts(prev => new Set(prev).add(postId)),
    onSuccess: (_, { postId }) => {
      toast({ title: "Praise Updated" });
      setPraiseEditOpen(prev => ({ ...prev, [postId]: false }));
      queryClient.invalidateQueries({ queryKey: ['/api/hurdle-wall'] });
    },
    onError: () => toast({ title: "Error", description: "Failed to update praise", variant: "destructive" }),
    onSettled: (_, __, { postId }) => setPendingPraisePosts(prev => { const s = new Set(prev); s.delete(postId); return s; }),
  });

  const deletePraiseMutation = useMutation({
    mutationFn: (postId: string) => apiRequest('DELETE', `/api/hurdle-wall/${postId}/praise`),
    onMutate: (postId) => setPendingPraisePosts(prev => new Set(prev).add(postId)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/hurdle-wall'] }),
    onError: () => toast({ title: "Error", description: "Failed to remove praise", variant: "destructive" }),
    onSettled: (_, __, postId) => setPendingPraisePosts(prev => { const s = new Set(prev); s.delete(postId); return s; }),
  });

  const deletePostMutation = useMutation({
    mutationFn: (postId: string) => apiRequest('DELETE', `/api/hurdle-wall/posts/${postId}`),
    onSuccess: () => {
      toast({ title: "Post Deleted" });
      setConfirmDeletePostId(null);
      queryClient.invalidateQueries({ queryKey: ['/api/hurdle-wall'] });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete post", variant: "destructive" }),
  });

  const createCommentMutation = useMutation({
    mutationFn: ({ postId, content }: { postId: string; content: string }) =>
      apiRequest('POST', `/api/hurdle-wall/${postId}/replies`, { content, isAnonymous: false }),
    onSuccess: (_, { postId }) => {
      setCommentContent(prev => ({ ...prev, [postId]: '' }));
      queryClient.invalidateQueries({ queryKey: ['/api/hurdle-wall'] });
    },
    onError: () => toast({ title: "Error", description: "Failed to post comment", variant: "destructive" }),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => apiRequest('DELETE', `/api/hurdle-wall/replies/${commentId}`),
    onSuccess: () => {
      setConfirmDeleteCommentId(null);
      queryClient.invalidateQueries({ queryKey: ['/api/hurdle-wall'] });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete comment", variant: "destructive" }),
  });

  const editCommentMutation = useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) =>
      apiRequest('PATCH', `/api/hurdle-wall/replies/${commentId}`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/hurdle-wall'] });
      setEditingReplyId(null);
      setEditReplyContent('');
    },
    onError: () => toast({ title: "Error", description: "Failed to update comment", variant: "destructive" }),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleCreatePost = () => {
    if (!newPostContent.trim()) {
      toast({ title: "Error", description: "Please enter your prayer request", variant: "destructive" });
      return;
    }
    createPostMutation.mutate({ content: newPostContent, isAnonymous, postType: 'prayer_request' });
  };

  const handleCreateComment = (postId: string) => {
    const content = commentContent[postId]?.trim();
    if (!content) return;
    createCommentMutation.mutate({ postId, content });
  };

  const handlePrayer = (postId: string, currentlyPrayed?: boolean) => {
    prayerMutation.mutate({ postId, action: currentlyPrayed ? 'remove' : 'add' });
  };

  const handleAmen = (post: HurdleWallPost) => {
    const { hasAmened } = getAmenDisplay(post);
    amenMutation.mutate({ postId: post.id, action: hasAmened ? 'remove' : 'add' });
  };

  const renderUserName = (user: HurdleWallPost['user'], isAnon: boolean) => {
    if (isAnon) return <span className="text-white font-medium">Anonymous</span>;
    return (
      <Link href={`/users/${user.id}`}>
        <span className="text-white font-medium hover:text-[#FDD000] cursor-pointer transition-colors">
          {user.firstName} {user.lastName}
        </span>
      </Link>
    );
  };

  const formatTimeAgo = (d: string) => formatDistanceToNow(new Date(d), { addSuffix: true });

  // ── Loading state ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="pb-20">
        <div className="liquid-header text-white px-6 pt-8 pb-6">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-4xl font-black tracking-tighter uppercase mt-2">War Room</h1>
            <p className="text-[#FDD000] text-xs font-bold tracking-widest uppercase mt-1">
              A Sacred Space For Prayer Requests
            </p>
          </div>
        </div>
        <div className="max-w-2xl mx-auto p-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-sm animate-pulse" style={{ background: "#111", border: "1px solid #222", height: "100px" }} />
          ))}
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="pb-20">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="liquid-header text-white px-6 pt-8 pb-6">
        <div className="max-w-2xl mx-auto">
          <BackButton />
          <h1 className="text-4xl font-black tracking-tighter uppercase mt-2">War Room</h1>
          <p className="text-[#FDD000] text-xs font-bold tracking-widest uppercase mt-1">
            A Sacred Space For Prayer Requests
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 space-y-5">

        {/* ── COMPOSE FORM ───────────────────────────────────────────────── */}
        <div ref={formRef}>
          {/* Collapsed trigger */}
          {!showComposeForm ? (
            <button
              onClick={() => setShowComposeForm(true)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-sm text-left transition-all"
              style={{ background: "#111", border: "2px solid rgba(253,208,0,0.3)", boxShadow: "3px 3px 0px 0px rgba(253,208,0,0.15)" }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(253,208,0,0.12)" }}
              >
                <Plus className="w-4 h-4 text-[#FDD000]" />
              </div>
              <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>
                Share a prayer request with your brothers...
              </span>
            </button>
          ) : (
            /* Expanded form */
            <div
              className="rounded-sm overflow-hidden"
              style={{ background: "#0d0d0d", border: "2px solid #FDD000", boxShadow: "4px 4px 0px 0px rgba(253,208,0,0.3)" }}
            >
              {/* Form header */}
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ background: "#FDD000" }}
              >
                <span className="font-black text-black text-sm uppercase tracking-widest">
                  Share Your Heart
                </span>
                <button onClick={() => setShowComposeForm(false)}>
                  <X className="w-4 h-4 text-black" />
                </button>
              </div>

              {/* Textarea */}
              <div className="p-4 space-y-3">
                <MentionTextarea
                  placeholder="What would you like your brothers to pray for? Type @ to mention someone."
                  value={newPostContent}
                  onChange={setNewPostContent}
                  className="min-h-[100px] bg-white text-black border-2 border-black placeholder:text-black/40"
                  data-testid="textarea-prayer-request"
                />

                {/* Anonymous toggle */}
                <button
                  onClick={() => setIsAnonymous(prev => !prev)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-sm w-full transition-all"
                  style={{
                    background: isAnonymous ? "rgba(253,208,0,0.1)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${isAnonymous ? "rgba(253,208,0,0.4)" : "rgba(255,255,255,0.1)"}`,
                  }}
                >
                  {isAnonymous
                    ? <EyeOff className="w-4 h-4 text-[#FDD000] flex-shrink-0" />
                    : <Eye className="w-4 h-4 text-white/40 flex-shrink-0" />
                  }
                  <div className="flex-1 text-left">
                    <p className="text-xs font-bold" style={{ color: isAnonymous ? "#FDD000" : "rgba(255,255,255,0.5)" }}>
                      {isAnonymous ? "Posting Anonymously" : "Post with Your Name"}
                    </p>
                    <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                      {isAnonymous
                        ? "Your name won't be shown — your brothers will still pray for you"
                        : "Tap to post anonymously if you prefer"
                      }
                    </p>
                  </div>
                  <div
                    className="w-8 h-4 rounded-full flex-shrink-0 relative transition-colors"
                    style={{ background: isAnonymous ? "#FDD000" : "rgba(255,255,255,0.15)" }}
                  >
                    <div
                      className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all"
                      style={{ left: isAnonymous ? "calc(100% - 14px)" : "2px" }}
                    />
                  </div>
                </button>

                <Button
                  onClick={handleCreatePost}
                  disabled={createPostMutation.isPending || !newPostContent.trim()}
                  className="w-full font-black uppercase tracking-wide rounded-sm text-black disabled:opacity-40"
                  style={{ background: "#FDD000", border: "2px solid #000", boxShadow: "3px 3px 0px 0px rgba(0,0,0,1)" }}
                  data-testid="button-share-post"
                >
                  {createPostMutation.isPending ? "Posting..." : "Post Prayer Request"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ── SEARCH + SORT ───────────────────────────────────────────────── */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black" />
            <Input
              placeholder="SEARCH..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 border-2 border-black bg-[#FDD000] rounded-sm text-black placeholder:text-black/50 placeholder:font-medium placeholder:text-xs placeholder:tracking-wide font-medium text-sm"
            />
          </div>
          <div className="flex gap-1">
            {(["newest", "oldest", "mine", "praised"] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setSortBy(opt)}
                className="px-3 py-2 rounded-sm text-[10px] font-black uppercase tracking-wide transition-all flex-shrink-0"
                style={{
                  background: sortBy === opt ? "#FDD000" : "rgba(255,255,255,0.07)",
                  color: sortBy === opt ? "#000" : "rgba(255,255,255,0.4)",
                  border: sortBy === opt ? "1px solid #000" : "1px solid transparent",
                }}
              >
                {opt === "newest" ? "New" : opt === "oldest" ? "Old" : opt === "mine" ? "Mine" : "⭐"}
              </button>
            ))}
          </div>
        </div>

        {/* ── POSTS ──────────────────────────────────────────────────────── */}
        <div className="space-y-4">
          {posts.length === 0 ? (
            <div
              className="text-center py-12 rounded-sm"
              style={{ background: "#0d0d0d", border: "1px solid #222" }}
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: "rgba(253,208,0,0.1)" }}
              >
                <HandHeart className="w-7 h-7 text-[#FDD000]" />
              </div>
              <h3 className="text-white font-black text-lg uppercase tracking-tight mb-2">
                The War Room is Ready
              </h3>
              <p className="text-sm max-w-xs mx-auto mb-5" style={{ color: "rgba(255,255,255,0.4)" }}>
                Be the first to bring a request to your brothers. You can post with your name or anonymously.
              </p>
              <button
                onClick={() => { setShowComposeForm(true); formRef.current?.scrollIntoView({ behavior: 'smooth' }); }}
                className="px-6 py-2.5 rounded-sm font-black uppercase tracking-wide text-black text-sm"
                style={{ background: "#FDD000", border: "2px solid #000" }}
              >
                Post First Request
              </button>
            </div>
          ) : (
            posts.map((post) => {
              const { count: amenCount, hasAmened } = getAmenDisplay(post);
              const isOwner  = currentUser?.id === post.userId;
              const isMod    = ['admin', 'moderator', 'owner'].includes(currentUser?.role || '');
              const hasPraise = !!post.praise;

              return (
                <div
                  key={post.id}
                  data-post-id={post.id}
                  className="rounded-sm overflow-hidden"
                  style={{
                    background: "#0d0d0d",
                    border: highlightedPost === post.id
                      ? "2px solid #FDD000"
                      : "1px solid #1e1e1e",
                    boxShadow: highlightedPost === post.id
                      ? "0 0 20px rgba(253,208,0,0.2)"
                      : "none",
                  }}
                >
                  {/* Post header */}
                  <div className="px-4 pt-4 pb-2 flex items-start justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      {renderUserName(post.user, post.isAnonymous)}
                      <span
                        className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(253,208,0,0.1)", color: "#FDD000" }}
                      >
                        {hasPraise ? "⭐ Answered Prayer" : "Prayer Request"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                        {formatTimeAgo(post.createdAt)}
                      </span>
                      {(isOwner || isMod) && confirmDeletePostId !== post.id && (
                        <button
                          onClick={() => setConfirmDeletePostId(post.id)}
                          className="p-1 text-red-400/50 hover:text-red-400 transition-colors ml-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Delete confirmation */}
                  {confirmDeletePostId === post.id && (
                    <div className="px-4 pb-2">
                      <DeleteConfirm
                        label="Delete Post"
                        onConfirm={() => deletePostMutation.mutate(post.id)}
                        onCancel={() => setConfirmDeletePostId(null)}
                      />
                    </div>
                  )}

                  {/* Post content */}
                  <div className="px-4 pb-3">
                    <div
                      className="rounded-sm p-3"
                      style={{ background: "#fff", border: "2px solid #000" }}
                    >
                      <p className="text-black leading-relaxed whitespace-pre-wrap text-sm">
                        <MentionText text={post.content} />
                      </p>
                    </div>
                  </div>

                  {/* Praise section */}
                  {isOwner && !hasPraise && (
                    <div className="px-4 pb-3">
                      {praiseInputOpen[post.id] ? (
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-[#FDD000] uppercase tracking-wide">
                            Share How God Answered This Prayer
                          </p>
                          <Textarea
                            placeholder="How did God come through for you?"
                            value={praiseContent[post.id] || ''}
                            onChange={(e) => setPraiseContent(prev => ({ ...prev, [post.id]: e.target.value }))}
                            className="bg-white text-black border-2 border-black placeholder:text-black/40 min-h-[80px] text-sm"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                if (!praiseContent[post.id]?.trim()) return;
                                praiseMutation.mutate({ postId: post.id, content: praiseContent[post.id] });
                              }}
                              disabled={pendingPraisePosts.has(post.id) || !praiseContent[post.id]?.trim()}
                              className="text-black font-black border-2 border-black text-xs"
                              style={{ background: "#FDD000" }}
                            >
                              <Star className="w-3 h-3 mr-1" />
                              {pendingPraisePosts.has(post.id) ? 'Sharing...' : 'Share Praise'}
                            </Button>
                            <Button
                              size="sm" variant="ghost"
                              className="text-white/40 hover:text-white text-xs"
                              onClick={() => { setPraiseInputOpen(prev => ({ ...prev, [post.id]: false })); setPraiseContent(prev => ({ ...prev, [post.id]: '' })); }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setPraiseInputOpen(prev => ({ ...prev, [post.id]: true }))}
                          className="flex items-center gap-1.5 text-xs font-bold text-[#FDD000]/60 hover:text-[#FDD000] transition-colors"
                        >
                          <Star className="w-3.5 h-3.5" />
                          Prayer Answered? Share Your Praise
                        </button>
                      )}
                    </div>
                  )}

                  {hasPraise && (
                    <div className="px-4 pb-3">
                      <div
                        className="rounded-sm p-3"
                        style={{ background: "#fff", border: "2px solid #000" }}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-black uppercase tracking-widest text-black flex items-center gap-1">
                            <Star className="w-3 h-3 fill-current text-[#FDD000]" />
                            Answered Prayer
                          </span>
                          {isOwner && !praiseEditOpen[post.id] && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => { setPraiseEditContent(prev => ({ ...prev, [post.id]: post.praise!.content })); setPraiseEditOpen(prev => ({ ...prev, [post.id]: true })); }}
                                className="text-black/40 hover:text-black p-1"
                                disabled={pendingPraisePosts.has(post.id)}
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => deletePraiseMutation.mutate(post.id)}
                                className="text-red-500 hover:text-red-400 p-1"
                                disabled={pendingPraisePosts.has(post.id)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                        {praiseEditOpen[post.id] ? (
                          <div className="space-y-2">
                            <Textarea
                              value={praiseEditContent[post.id] ?? ''}
                              onChange={e => setPraiseEditContent(prev => ({ ...prev, [post.id]: e.target.value }))}
                              className="text-sm text-black border-black min-h-[70px]"
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => editPraiseMutation.mutate({ postId: post.id, content: praiseEditContent[post.id] })}
                                disabled={pendingPraisePosts.has(post.id)} className="text-black text-xs font-black" style={{ background: "#FDD000", border: "2px solid #000" }}>
                                Save
                              </Button>
                              <Button size="sm" variant="ghost" className="text-black/60 text-xs" onClick={() => setPraiseEditOpen(prev => ({ ...prev, [post.id]: false }))}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-black text-sm leading-relaxed">{post.praise!.content}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Amen (only when praise exists) */}
                  {hasPraise && (
                    <div className="px-4 pb-2">
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => handleAmen(post)}
                        disabled={pendingAmenPosts.has(post.id)}
                        className={`flex items-center gap-2 font-semibold text-sm ${hasAmened ? 'text-[#FDD000]' : 'text-white/50 hover:text-[#FDD000]'}`}
                      >
                        <ChristianCross className={`h-4 w-4 ${hasAmened ? 'opacity-100' : 'opacity-50'}`} />
                        {amenCount > 0 && (
                          <ReactorList
                            endpointUrl={`/api/hurdle-wall/${post.id}/ameners`}
                            queryKey={['/api/hurdle-wall', post.id, 'ameners']}
                            label="Said Amen"
                            count={amenCount}
                          >
                            <span>{amenCount}</span>
                          </ReactorList>
                        )}
                        Amen
                      </Button>
                    </div>
                  )}

                  {/* Action bar */}
                  <div className="px-4 py-2 flex items-center gap-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <button
                      onClick={() => handlePrayer(post.id, post.userHasPrayed)}
                      disabled={prayerMutation.isPending}
                      className={`flex items-center gap-1.5 text-sm font-semibold transition-colors ${post.userHasPrayed ? 'text-[#FDD000]' : 'text-white/50 hover:text-[#FDD000]'}`}
                    >
                      <HandHeart className={`w-4 h-4 ${post.userHasPrayed ? 'fill-current' : ''}`} />
                      {post.prayerCount} {post.prayerCount === 1 ? 'Prayer' : 'Prayers'}
                    </button>
                    <button
                      onClick={() => setExpandedPost(expandedPost === post.id ? null : post.id)}
                      className="flex items-center gap-1.5 text-sm font-semibold text-white/50 hover:text-white transition-colors"
                    >
                      <MessageSquare className="w-4 h-4" />
                      {post.replyCount} {post.replyCount === 1 ? 'Comment' : 'Comments'}
                      {expandedPost === post.id
                        ? <ChevronUp className="w-3 h-3" />
                        : <ChevronDown className="w-3 h-3" />
                      }
                    </button>
                  </div>

                  {/* Comments */}
                  {expandedPost === post.id && (
                    <div className="px-4 pb-4 space-y-3 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                      {post.replies?.map((reply) => (
                        <div key={reply.id} className="rounded-sm p-3" style={{ background: "#fff", border: "2px solid #000" }}>
                          <div className="flex items-start justify-between mb-1.5">
                            <span className="text-sm font-bold text-black">
                              {reply.isAnonymous ? 'Anonymous' : `${reply.user.firstName} ${reply.user.lastName}`}
                            </span>
                            <div className="flex items-center gap-1">
                              <span className="text-black/40 text-xs">{formatTimeAgo(reply.createdAt)}</span>
                              {currentUser?.id === reply.userId && (
                                <button
                                  onClick={() => { setEditingReplyId(reply.id); setEditReplyContent(reply.content); }}
                                  className="text-black/30 hover:text-black p-1"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              )}
                              {(currentUser?.id === reply.userId || isMod) && confirmDeleteCommentId !== reply.id && (
                                <button
                                  onClick={() => setConfirmDeleteCommentId(reply.id)}
                                  className="text-red-500/50 hover:text-red-500 p-1"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                          {confirmDeleteCommentId === reply.id && (
                            <div className="mb-2">
                              <DeleteConfirm
                                label="Delete"
                                onConfirm={() => deleteCommentMutation.mutate(reply.id)}
                                onCancel={() => setConfirmDeleteCommentId(null)}
                              />
                            </div>
                          )}
                          {editingReplyId === reply.id ? (
                            <div className="space-y-1.5">
                              <MentionTextarea
                                value={editReplyContent}
                                onChange={setEditReplyContent}
                                className="bg-white text-black border-2 border-black text-sm min-h-[60px]"
                                autoFocus
                              />
                              <div className="flex gap-2">
                                <Button size="sm" className="h-7 px-3 text-xs bg-black text-white"
                                  onClick={() => editCommentMutation.mutate({ commentId: reply.id, content: editReplyContent })}
                                  disabled={editCommentMutation.isPending || !editReplyContent.trim()}>
                                  Save
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 px-3 text-xs text-black/50"
                                  onClick={() => { setEditingReplyId(null); setEditReplyContent(''); }}>
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-black text-sm leading-relaxed whitespace-pre-wrap">
                              <MentionText text={reply.content} />
                            </p>
                          )}
                        </div>
                      ))}

                      {/* Comment form */}
                      <div className="space-y-2 pt-1">
                        <MentionTextarea
                          placeholder="Encourage your brother... Type @ to mention someone."
                          value={commentContent[post.id] || ''}
                          onChange={(value) => setCommentContent(prev => ({ ...prev, [post.id]: value }))}
                          className="bg-white text-black border-2 border-black placeholder:text-black/40 text-sm"
                        />
                        <Button
                          onClick={() => handleCreateComment(post.id)}
                          disabled={createCommentMutation.isPending || !commentContent[post.id]?.trim()}
                          size="sm"
                          className="font-black text-black border-2 border-black text-xs disabled:opacity-40"
                          style={{ background: "#FDD000", boxShadow: "2px 2px 0px 0px rgba(0,0,0,1)" }}
                        >
                          <Send className="w-3.5 h-3.5 mr-1.5" />
                          Post Comment
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── FLOATING COMPOSE BUTTON (mobile) ───────────────────────────────── */}
      {!showComposeForm && (
        <button
          onClick={() => {
            setShowComposeForm(true);
            setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
          }}
          className="fixed bottom-24 right-4 w-14 h-14 rounded-full flex items-center justify-center z-40 shadow-lg transition-all active:scale-95 md:hidden"
          style={{ background: "#FDD000", border: "3px solid #000", boxShadow: "3px 3px 0px 0px rgba(0,0,0,1)" }}
          aria-label="Post prayer request"
        >
          <Plus className="w-6 h-6 text-black" strokeWidth={3} />
        </button>
      )}
    </div>
  );
}
