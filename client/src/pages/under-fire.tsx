import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MentionTextarea, MentionText } from '@/components/mention-textarea';
import { Separator } from '@/components/ui/separator';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useWebSocket } from '@/hooks/useWebSocket';
import { triggerRefTagger } from '@/hooks/useRefTagger';
import { formatDistanceToNow } from 'date-fns';
import {
  Trash2, Search, Shield, HandHelping, CheckCircle,
  MessageSquare, Send, Pencil, Flame, User, Plus, X,
  ChevronDown, ChevronUp, AlertTriangle, EyeOff, Eye
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Link, useLocation } from 'wouter';
import { BackButton } from "@/components/BackButton";
import { ReactorList } from '@/components/reactor-list';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AccountabilityRequest {
  id: string;
  userId: string;
  content: string;
  isAnonymous?: boolean;
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
      <button onClick={onConfirm} className="text-xs font-black text-red-400 hover:text-red-300 uppercase tracking-wide">
        {label}
      </button>
      <button onClick={onCancel} className="text-xs text-white/40 hover:text-white/70">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// ─── Reaction button ──────────────────────────────────────────────────────────
function ReactionBtn({ active, onClick, disabled, children, activeStyle }: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  activeStyle?: React.CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border-2 border-black text-xs font-bold transition-all disabled:opacity-50"
      style={active
        ? { background: "#FDD000", color: "#000", boxShadow: "2px 2px 0px 0px rgba(0,0,0,1)", ...activeStyle }
        : { background: "transparent", color: "rgba(255,255,255,0.6)", boxShadow: "2px 2px 0px 0px rgba(0,0,0,1)" }
      }
    >
      {children}
    </button>
  );
}

// ─── CommentsSection (top-level to prevent re-mount on parent render) ─────────
interface CommentsSectionProps {
  requestId: string;
  currentUserId?: string;
  isMod: boolean;
}

function CommentsSection({ requestId, currentUserId, isMod }: CommentsSectionProps) {
  const queryClient = useQueryClient();
  const { toast }   = useToast();
  const [commentText, setCommentText]         = useState('');
  const [replyToId, setReplyToId]             = useState<string | null>(null);
  const [replyText, setReplyText]             = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data: comments = [], isLoading } = useQuery<Comment[]>({
    queryKey: ['/api/accountability-requests', requestId, 'comments'],
  });

  const addCommentMutation = useMutation({
    mutationFn: ({ content, parentCommentId }: { content: string; parentCommentId?: string }) =>
      apiRequest('POST', `/api/accountability-requests/${requestId}/comments`, { content, parentCommentId }),
    onSuccess: () => {
      setCommentText(''); setReplyToId(null); setReplyText('');
      queryClient.invalidateQueries({ queryKey: ['/api/accountability-requests', requestId, 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/accountability-requests'] });
    },
    onError: () => toast({ title: "Error", description: "Failed to post comment", variant: "destructive" }),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => apiRequest('DELETE', `/api/accountability-requests/comments/${commentId}`),
    onSuccess: () => {
      setConfirmDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ['/api/accountability-requests', requestId, 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/accountability-requests'] });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete comment", variant: "destructive" }),
  });

  const editCommentMutation = useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) =>
      apiRequest('PATCH', `/api/accountability-requests/comments/${commentId}`, { content }),
    onSuccess: () => {
      setEditingCommentId(null); setEditCommentText('');
      queryClient.invalidateQueries({ queryKey: ['/api/accountability-requests', requestId, 'comments'] });
    },
    onError: () => toast({ title: "Error", description: "Failed to edit comment", variant: "destructive" }),
  });

  const topLevel   = comments.filter(c => !c.parentCommentId);
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
        {confirmDeleteId === c.id && (
          <div className="mt-1">
            <DeleteConfirm
              onConfirm={() => deleteCommentMutation.mutate(c.id)}
              onCancel={() => setConfirmDeleteId(null)}
            />
          </div>
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
      {editingCommentId !== c.id && confirmDeleteId !== c.id && (c.userId === currentUserId || isMod) && (
        <div className="flex gap-1 flex-shrink-0">
          {c.userId === currentUserId && (
            <button
              onClick={() => { setEditingCommentId(c.id); setEditCommentText(c.content); }}
              className="text-zinc-600 hover:text-zinc-300"
            >
              <Pencil className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={() => setConfirmDeleteId(c.id)}
            className="text-zinc-600 hover:text-red-400"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="pt-4 space-y-3" style={{ borderTop: "1px solid rgba(253,208,0,0.2)" }}>
      {isLoading ? (
        <p className="text-white/40 text-xs">Loading comments…</p>
      ) : topLevel.length === 0 ? (
        <p className="text-white/40 text-xs">No comments yet — be the first to encourage this brother.</p>
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
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-sm text-white text-xs px-2 py-1 placeholder:text-zinc-600 focus:outline-none"
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
          placeholder="Encourage your brother…"
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-sm text-white text-xs px-3 py-1.5 placeholder:text-zinc-600 focus:outline-none"
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

// ─── Main Component ───────────────────────────────────────────────────────────
export default function UnderFire() {
  const { toast }     = useToast();
  const queryClient   = useQueryClient();
  const [, setLocation] = useLocation();
  const formRef       = useRef<HTMLDivElement>(null);

  const [newRequestContent, setNewRequestContent] = useState('');
  const [isAnonymous, setIsAnonymous]             = useState(false);
  const [showComposeForm, setShowComposeForm]     = useState(false);
  const [searchTerm, setSearchTerm]               = useState('');
  const [sortBy, setSortBy]                       = useState<'newest' | 'oldest' | 'my_posts' | 'my_assisted'>('newest');
  const [highlightedRequest, setHighlightedRequest] = useState<string | null>(null);
  const [expandedComments, setExpandedComments]   = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId]     = useState<string | null>(null);

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
    const requestId = new URLSearchParams(window.location.search).get('request');
    if (requestId) {
      setHighlightedRequest(requestId);
      setTimeout(() => {
        document.querySelector(`[data-request-id="${requestId}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 800);
    }
  }, [allRequests]);

  const requests = React.useMemo(() => {
    let filtered = allRequests;
    if (searchTerm) filtered = filtered.filter(r => r.content.toLowerCase().includes(searchTerm.toLowerCase()));
    if (sortBy === 'my_posts')    filtered = filtered.filter(r => r.userId === currentUser?.id);
    else if (sortBy === 'my_assisted') filtered = filtered.filter(r => r.assistedById === currentUser?.id);
    else filtered = [...filtered].sort((a, b) => {
      const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return sortBy === 'newest' ? diff : -diff;
    });
    return filtered;
  }, [allRequests, searchTerm, sortBy, currentUser?.id]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createRequestMutation = useMutation({
    mutationFn: (data: { content: string; isAnonymous: boolean }) =>
      apiRequest('POST', '/api/accountability-requests', data),
    onSuccess: () => {
      toast({ title: "Request Posted", description: "Your request is live. A brother will step up." });
      setNewRequestContent(''); setIsAnonymous(false); setShowComposeForm(false);
      queryClient.invalidateQueries({ queryKey: ['/api/accountability-requests'] });
    },
    onError: () => toast({ title: "Error", description: "Failed to create request", variant: "destructive" }),
  });

  const assistMutation = useMutation({
    mutationFn: (requestId: string) => apiRequest('POST', `/api/accountability-requests/${requestId}/assist`),
    onSuccess: (data: any) => {
      toast({ title: "You're In, Brother!", description: "A direct message has been created. Head to Messages to connect." });
      queryClient.invalidateQueries({ queryKey: ['/api/accountability-requests'] });
      if (data.conversationId) setLocation(`/messages?conversation=${data.conversationId}`);
    },
    onError: () => toast({ title: "Error", description: "Failed to accept request", variant: "destructive" }),
  });

  const unassistMutation = useMutation({
    mutationFn: (requestId: string) => apiRequest('POST', `/api/accountability-requests/${requestId}/unassist`),
    onSuccess: () => {
      toast({ title: "Unassisted" });
      queryClient.invalidateQueries({ queryKey: ['/api/accountability-requests'] });
    },
    onError: () => toast({ title: "Error", description: "Failed to unassist", variant: "destructive" }),
  });

  const deleteRequestMutation = useMutation({
    mutationFn: (requestId: string) => apiRequest('DELETE', `/api/accountability-requests/${requestId}`),
    onSuccess: () => {
      toast({ title: "Request Deleted" });
      setConfirmDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ['/api/accountability-requests'] });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete request", variant: "destructive" }),
  });

  const supportMutation = useMutation({
    mutationFn: (requestId: string) => apiRequest('POST', `/api/accountability-requests/${requestId}/support`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/accountability-requests'] }),
    onError: () => toast({ title: "Error", description: "Failed to toggle support", variant: "destructive" }),
  });

  const amenMutation = useMutation({
    mutationFn: (requestId: string) => apiRequest('POST', `/api/accountability-requests/${requestId}/amen`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/accountability-requests'] }),
    onError: () => toast({ title: "Error", description: "Failed to toggle amen", variant: "destructive" }),
  });

  const ohMeMutation = useMutation({
    mutationFn: (requestId: string) => apiRequest('POST', `/api/accountability-requests/${requestId}/oh-me`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/accountability-requests'] }),
    onError: () => toast({ title: "Error", description: "Failed to toggle oh-me", variant: "destructive" }),
  });

  const toggleComments = (requestId: string) => {
    setExpandedComments(prev => {
      const next = new Set(prev);
      next.has(requestId) ? next.delete(requestId) : next.add(requestId);
      return next;
    });
  };

  const formatTimeAgo = (d: string) => formatDistanceToNow(new Date(d), { addSuffix: true });

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="pb-20">
        <div className="liquid-header text-white px-6 pt-8 pb-6">
          <div className="max-w-2xl mx-auto">
            <BackButton />
            <h1 className="text-4xl font-black tracking-tighter uppercase mt-2">Under Fire</h1>
            <p className="text-[#FDD000] text-xs font-bold tracking-widest uppercase mt-1">Request Accountability</p>
          </div>
        </div>
        <div className="max-w-2xl mx-auto p-4 space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-sm animate-pulse" style={{ background: "#111", border: "1px solid #222", height: "110px" }} />
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
          <h1 className="text-4xl font-black tracking-tighter uppercase mt-2">Under Fire</h1>
          <p className="text-[#FDD000] text-xs font-bold tracking-widest uppercase mt-1">
            Request Accountability
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 space-y-5">

        {/* ── COMPOSE FORM ───────────────────────────────────────────────── */}
        <div ref={formRef}>
          {!showComposeForm ? (
            <button
              onClick={() => setShowComposeForm(true)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-sm text-left transition-all"
              style={{ background: "#111", border: "2px solid rgba(253,208,0,0.3)", boxShadow: "3px 3px 0px 0px rgba(253,208,0,0.15)" }}
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(253,208,0,0.12)" }}>
                <Plus className="w-4 h-4 text-[#FDD000]" />
              </div>
              <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>
                Request accountability from your brothers...
              </span>
            </button>
          ) : (
            <div className="rounded-sm overflow-hidden" style={{ background: "#0d0d0d", border: "2px solid #FDD000", boxShadow: "4px 4px 0px 0px rgba(253,208,0,0.3)" }}>
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3" style={{ background: "#FDD000" }}>
                <span className="font-black text-black text-sm uppercase tracking-widest">Request Accountability</span>
                <button onClick={() => setShowComposeForm(false)}><X className="w-4 h-4 text-black" /></button>
              </div>

              <div className="p-4 space-y-3">
                <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                  Share what you need accountability for — a goal, a struggle, or a sin. A brother will volunteer to come alongside you privately.
                </p>

                <MentionTextarea
                  placeholder="What do you need accountability for? Type @ to mention a brother."
                  value={newRequestContent}
                  onChange={setNewRequestContent}
                  className="min-h-[100px] bg-white text-black border-2 border-black placeholder:text-black/40"
                  data-testid="textarea-accountability-request"
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
                        ? "Your name won't be shown — a brother can still step up to help"
                        : "Tap to post anonymously for sensitive requests"
                      }
                    </p>
                  </div>
                  <div className="w-8 h-4 rounded-full flex-shrink-0 relative transition-colors" style={{ background: isAnonymous ? "#FDD000" : "rgba(255,255,255,0.15)" }}>
                    <div className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all" style={{ left: isAnonymous ? "calc(100% - 14px)" : "2px" }} />
                  </div>
                </button>

                <Button
                  onClick={() => {
                    if (!newRequestContent.trim()) {
                      toast({ title: "Error", description: "Please enter your accountability request", variant: "destructive" });
                      return;
                    }
                    createRequestMutation.mutate({ content: newRequestContent, isAnonymous });
                  }}
                  disabled={createRequestMutation.isPending || !newRequestContent.trim()}
                  className="w-full font-black uppercase tracking-wide rounded-sm text-black disabled:opacity-40"
                  style={{ background: "#FDD000", border: "2px solid #000", boxShadow: "3px 3px 0px 0px rgba(0,0,0,1)" }}
                  data-testid="button-share-request"
                >
                  {createRequestMutation.isPending ? 'Posting...' : 'Post Accountability Request'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ── SEARCH + SORT PILLS ─────────────────────────────────────────── */}
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
            {([
              { value: 'newest',      label: 'New' },
              { value: 'oldest',      label: 'Old' },
              { value: 'my_posts',    label: 'Mine' },
              { value: 'my_assisted', label: 'Helped' },
            ] as const).map(opt => (
              <button
                key={opt.value}
                onClick={() => setSortBy(opt.value)}
                className="px-3 py-2 rounded-sm text-[10px] font-black uppercase tracking-wide transition-all flex-shrink-0"
                style={{
                  background: sortBy === opt.value ? "#FDD000" : "rgba(255,255,255,0.07)",
                  color:      sortBy === opt.value ? "#000"    : "rgba(255,255,255,0.4)",
                  border:     sortBy === opt.value ? "1px solid #000" : "1px solid transparent",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── REQUESTS ───────────────────────────────────────────────────── */}
        <div className="space-y-4">
          {requests.length === 0 ? (
            <div className="text-center py-12 rounded-sm" style={{ background: "#0d0d0d", border: "1px solid #222" }}>
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(253,208,0,0.1)" }}>
                <Shield className="w-7 h-7 text-[#FDD000]" />
              </div>
              <h3 className="text-white font-black text-lg uppercase tracking-tight mb-2">Stand in the Gap</h3>
              <p className="text-sm max-w-xs mx-auto mb-5" style={{ color: "rgba(255,255,255,0.4)" }}>
                No requests yet. Every man has battles. Be the first to bring yours here — your brothers will show up.
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
            requests.map((request) => {
              const isOwner  = currentUser?.id === request.userId;
              const isAssister = currentUser?.id === request.assistedById;

              return (
                <div
                  key={request.id}
                  data-request-id={request.id}
                  className="rounded-sm overflow-hidden"
                  style={{
                    background: "#0d0d0d",
                    border: highlightedRequest === request.id ? "2px solid #FDD000" : "1px solid #1e1e1e",
                    boxShadow: highlightedRequest === request.id ? "0 0 20px rgba(253,208,0,0.2)" : "none",
                  }}
                >
                  {/* Post header */}
                  <div className="px-4 pt-4 pb-2 flex items-start justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      {request.isAnonymous ? (
                        <span className="text-white font-medium">Anonymous</span>
                      ) : (
                        <Link href={`/users/${request.user.id}`}>
                          <span className="text-white font-medium hover:text-[#FDD000] cursor-pointer transition-colors">
                            {request.user.firstName} {request.user.lastName}
                          </span>
                        </Link>
                      )}
                      <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: "rgba(253,208,0,0.1)", color: "#FDD000" }}>
                        {request.assistedById ? "✓ Being Helped" : "Needs Accountability"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                        {formatTimeAgo(request.createdAt)}
                      </span>
                      {(isOwner || isMod) && confirmDeleteId !== request.id && (
                        <button onClick={() => setConfirmDeleteId(request.id)} className="p-1 text-red-400/50 hover:text-red-400 transition-colors ml-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Delete confirmation */}
                  {confirmDeleteId === request.id && (
                    <div className="px-4 pb-2">
                      <DeleteConfirm
                        label="Delete Request"
                        onConfirm={() => deleteRequestMutation.mutate(request.id)}
                        onCancel={() => setConfirmDeleteId(null)}
                      />
                    </div>
                  )}

                  {/* Content */}
                  <div className="px-4 pb-3">
                    <div className="rounded-sm p-3" style={{ background: "#fff", border: "2px solid #000" }}>
                      <p className="text-black leading-relaxed whitespace-pre-wrap text-sm">
                        <MentionText text={request.content} />
                      </p>
                    </div>
                  </div>

                  {/* Assist row */}
                  <div className="px-4 pb-3">
                    {request.assistedById ? (
                      <div className="flex items-center gap-3 flex-wrap">
                        <div
                          className="flex items-center gap-2 px-3 py-2 rounded-sm flex-1"
                          style={{ background: "rgba(253,208,0,0.08)", border: "1px solid rgba(253,208,0,0.2)" }}
                        >
                          <CheckCircle className="w-4 h-4 text-[#FDD000] flex-shrink-0" />
                          <span className="text-sm font-medium text-white">
                            {isAssister
                              ? "You're holding this brother accountable"
                              : `${request.assister ? `${request.assister.firstName} ${request.assister.lastName}`.trim() : 'A brother'} is holding him accountable`
                            }
                          </span>
                        </div>
                        {isAssister && (
                          <button
                            onClick={() => unassistMutation.mutate(request.id)}
                            disabled={unassistMutation.isPending}
                            className="text-xs font-bold text-white/40 hover:text-white/70 transition-colors"
                          >
                            Unassist
                          </button>
                        )}
                      </div>
                    ) : isOwner ? (
                      <div
                        className="flex items-center gap-2 px-3 py-2 rounded-sm"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-[#FDD000] animate-pulse flex-shrink-0" />
                        <span className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                          Your brothers see this — someone will step up soon.
                        </span>
                      </div>
                    ) : (
                      <Button
                        onClick={() => assistMutation.mutate(request.id)}
                        disabled={assistMutation.isPending}
                        className="w-full font-black text-black rounded-sm border-2 border-black uppercase tracking-wide"
                        style={{ background: "#FDD000", boxShadow: "3px 3px 0px 0px rgba(0,0,0,1)" }}
                        data-testid={`button-assist-${request.id}`}
                      >
                        <HandHelping className="w-4 h-4 mr-2" />
                        {assistMutation.isPending ? 'Processing...' : 'Step Up — I Got Him'}
                      </Button>
                    )}
                  </div>

                  {/* Reactions */}
                  <div className="px-4 pb-3 flex items-center gap-2 flex-wrap" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "12px" }}>

                    {/* Amen */}
                    <ReactionBtn active={request.amenedByMe} onClick={() => amenMutation.mutate(request.id)} disabled={amenMutation.isPending}>
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
                      <span>Amen</span>
                    </ReactionBtn>

                    {/* Oh Me — "I'm struggling with this too" */}
                    <ReactionBtn
                      active={request.ohMeByMe}
                      onClick={() => ohMeMutation.mutate(request.id)}
                      disabled={ohMeMutation.isPending}
                      activeStyle={{ background: "#ef4444", color: "#fff", borderColor: "#b91c1c" }}
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
                      <span title="I'm struggling with this too">Oh Me</span>
                    </ReactionBtn>

                    {/* Got Your 6 — only when assisted */}
                    {request.assistedById && currentUser?.id !== request.userId && (
                      <ReactionBtn active={request.gotYour6ByMe} onClick={() => supportMutation.mutate(request.id)} disabled={supportMutation.isPending}>
                        <Shield className="w-3.5 h-3.5" />
                        {(request.supportCount ?? 0) > 0 && <span>{request.supportCount}</span>}
                        <span title="I support this partnership">Got Your 6</span>
                      </ReactionBtn>
                    )}

                    {/* Comments */}
                    <button
                      onClick={() => toggleComments(request.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border-2 border-black text-xs font-bold text-white/50 hover:text-white hover:bg-white/10 transition-all ml-auto"
                      style={{ boxShadow: "2px 2px 0px 0px rgba(0,0,0,1)" }}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      {request.commentCount} {request.commentCount === 1 ? 'Comment' : 'Comments'}
                      {expandedComments.has(request.id)
                        ? <ChevronUp className="w-3 h-3" />
                        : <ChevronDown className="w-3 h-3" />
                      }
                    </button>
                  </div>

                  {/* Comments section */}
                  {expandedComments.has(request.id) && (
                    <div className="px-4 pb-4">
                      <CommentsSection
                        requestId={request.id}
                        currentUserId={currentUser?.id}
                        isMod={isMod}
                      />
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
          aria-label="Post accountability request"
        >
          <Plus className="w-6 h-6 text-black" strokeWidth={3} />
        </button>
      )}
    </div>
  );
}
