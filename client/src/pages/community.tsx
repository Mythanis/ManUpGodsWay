import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { triggerRefTagger } from "@/hooks/useRefTagger";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  MentionTextarea,
  MentionDropdown,
  useMentionDropdown,
  findActiveMention,
} from "@/components/mention-textarea";
import DiscussionCard from "@/components/discussion-card";
import { DiscussionErrorBoundary } from "@/components/discussion-error-boundary";
import { BackButton } from "@/components/BackButton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import {
  Plus, MessageCircle, Search, X, Send,
  Image, Video, Trash2, Bold, Italic, Underline,
  Strikethrough, BarChart2, Loader2,
} from "lucide-react";
import { z } from "zod";

const PAGE_LIMIT = 15;

// ─── Schema ───────────────────────────────────────────────────────────────────
const createDiscussionSchema = z.object({
  title:       z.string().optional(),
  content:     z.string().min(1, "Content is required"),
  category:    z.string().optional(),
  mediaUrls:   z.array(z.string()).optional(),
  mediaTypes:  z.array(z.string()).optional(),
  postType:    z.string().optional(),
  pollOptions: z.array(z.object({ id: z.string(), text: z.string() })).optional(),
});

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Community() {
  const { user }        = useAuth();
  const { toast }       = useToast();
  const queryClient     = useQueryClient();

  // ── UI state ──────────────────────────────────────────────────────────────
  const [sortBy, setSortBy]                 = useState<"recent" | "likes" | "replies">("recent");
  const [dialogOpen, setDialogOpen]         = useState(false);
  const [searchInput, setSearchInput]       = useState("");
  const [searchQuery, setSearchQuery]       = useState("");
  const [highlightedDiscussion, setHighlightedDiscussion] = useState<string | null>(null);

  // ── Compose state ─────────────────────────────────────────────────────────
  const [uploadedMedia, setUploadedMedia]   = useState<{ urls: string[]; types: string[] }>({ urls: [], types: [] });
  const [isUploading, setIsUploading]       = useState(false);
  const fileInputRef                        = useRef<HTMLInputElement>(null);
  const [isPollMode, setIsPollMode]         = useState(false);
  const [pollOptions, setPollOptions]       = useState(["", ""]);

  // ── URL deep-link params (read once) ─────────────────────────────────────
  const [targetDiscussionId] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get("discussion")
  );
  const [targetReplyId] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get("reply")
  );

  // ── Paginated feed state ──────────────────────────────────────────────────
  const [allDiscussions, setAllDiscussions] = useState<any[]>([]);
  const [nextOffset, setNextOffset]         = useState(0);
  const [hasMore, setHasMore]               = useState(true);
  const [isFetching, setIsFetching]         = useState(false);
  const [initialLoaded, setInitialLoaded]   = useState(false);
  const [loadError, setLoadError]           = useState(false);
  const isFetchingRef                       = useRef(false);
  const sentinelRef                         = useRef<HTMLDivElement>(null);

  // ── Debounce search — 350 ms ──────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (targetDiscussionId) setHighlightedDiscussion(targetDiscussionId);
  }, [targetDiscussionId]);

  // ── Core fetch function ───────────────────────────────────────────────────
  const fetchPage = useCallback(async (pageOffset: number, currentSortBy: string, currentSearch: string) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsFetching(true);
    try {
      const params = new URLSearchParams({ sortBy: currentSortBy, offset: String(pageOffset), limit: String(PAGE_LIMIT) });
      if (currentSearch) params.append("search", currentSearch);
      const res = await fetch(`/api/discussions?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      const { discussions: newPosts, hasMore: more, nextOffset: next } = await res.json();
      if (pageOffset === 0) {
        setAllDiscussions(newPosts);
      } else {
        setAllDiscussions(prev => [...prev, ...newPosts]);
      }
      setHasMore(more);
      setNextOffset(next);
      setInitialLoaded(true);
    } catch (e) {
      console.error("Failed to load discussions", e);
      if (pageOffset === 0) setLoadError(true);
      setInitialLoaded(true);
    } finally {
      isFetchingRef.current = false;
      setIsFetching(false);
    }
  }, []);

  // ── Reset + reload when filters change ───────────────────────────────────
  useEffect(() => {
    setAllDiscussions([]);
    setNextOffset(0);
    setHasMore(true);
    setInitialLoaded(false);
    setLoadError(false);
    isFetchingRef.current = false;
    fetchPage(0, sortBy, searchQuery);
  }, [sortBy, searchQuery, fetchPage]);

  // ── IntersectionObserver — load next page when sentinel is visible ────────
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isFetchingRef.current) {
          fetchPage(nextOffset, sortBy, searchQuery);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, nextOffset, sortBy, searchQuery, fetchPage]);

  // ── RefTagger after new posts appear ──────────────────────────────────────
  useEffect(() => {
    if (allDiscussions.length > 0) triggerRefTagger();
  }, [allDiscussions]);

  // ── Scroll to deep-linked discussion ──────────────────────────────────────
  useEffect(() => {
    if (!targetDiscussionId || allDiscussions.length === 0) return;
    const t = setTimeout(() => {
      document
        .querySelector(`[data-discussion-id="${targetDiscussionId}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    return () => clearTimeout(t);
  }, [targetDiscussionId, allDiscussions]);

  // ── Listen for discussion deletions from DiscussionCard ───────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail?.id;
      if (id) setAllDiscussions(prev => prev.filter(d => d.id !== id));
    };
    window.addEventListener("discussion:deleted", handler);
    return () => window.removeEventListener("discussion:deleted", handler);
  }, []);

  // ── Listen for discussion edits from DiscussionCard ───────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const { id, patch } = (e as CustomEvent<{ id: string; patch: Record<string, any> }>).detail ?? {};
      if (id && patch) setAllDiscussions(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d));
    };
    window.addEventListener("discussion:updated", handler);
    return () => window.removeEventListener("discussion:updated", handler);
  }, []);

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: communityStats } = useQuery<{
    totalMembers: number;
    activeToday: number;
    newPosts: number;
  }>({
    queryKey: ["/api/community/stats"],
    retry: false,
    staleTime: 60_000,
  });

  // ── Admin rich-text editor helpers ────────────────────────────────────────
  const isAdmin          = (user as any)?.role === "admin" || (user as any)?.role === "owner";
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const normalizeHtml    = (html: string) =>
    html.replace(/&nbsp;/g, " ").replace(/\u00a0/g, " ").trim();

  const applyFormat = (command: string) => {
    contentEditableRef.current?.focus();
    document.execCommand(command, false);
    form.setValue("content", normalizeHtml(contentEditableRef.current?.innerHTML || ""), {
      shouldValidate: true,
    });
  };

  const [editorMention, setEditorMention] = useState<{ start: number; query: string } | null>(null);

  const getCaretOffset = (root: HTMLElement): number | null => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!root.contains(range.startContainer)) return null;
    const pre = range.cloneRange();
    pre.selectNodeContents(root);
    pre.setEnd(range.startContainer, range.startOffset);
    return pre.toString().length;
  };

  const detectEditorMention = () => {
    const root = contentEditableRef.current;
    if (!root) return;
    const caret = getCaretOffset(root);
    if (caret == null) { setEditorMention(null); return; }
    setEditorMention(findActiveMention(root.textContent ?? "", caret));
  };

  const insertEditorMention = (display: string, token: string) => {
    const root = contentEditableRef.current;
    if (!root || !editorMention) return;
    const caret = getCaretOffset(root);
    if (caret == null) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let startNode: Text | null = null, startOffsetInNode = 0;
    let endNode: Text | null = null,   endOffsetInNode = 0;
    let consumed = 0;
    let node: Node | null = walker.nextNode();
    while (node) {
      const t = node as Text;
      const len = t.data.length;
      if (!startNode && editorMention.start <= consumed + len) {
        startNode = t; startOffsetInNode = editorMention.start - consumed;
      }
      if (!endNode && caret <= consumed + len) {
        endNode = t; endOffsetInNode = caret - consumed;
      }
      if (startNode && endNode) break;
      consumed += len;
      node = walker.nextNode();
    }
    if (!startNode || !endNode) return;
    const range = document.createRange();
    range.setStart(startNode, startOffsetInNode);
    range.setEnd(endNode, endOffsetInNode);
    range.deleteContents();
    const textNode = document.createTextNode(`@[${display}](mention:${token}) `);
    range.insertNode(textNode);
    const newRange = document.createRange();
    newRange.setStartAfter(textNode);
    newRange.collapse(true);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(newRange);
    form.setValue("content", normalizeHtml(root.innerHTML), { shouldValidate: true });
    setEditorMention(null);
  };

  const editorMentionDropdown = useMentionDropdown(editorMention, insertEditorMention);

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (editorMention) {
      if (editorMentionDropdown.onKeyNav(e)) return;
      if (e.key === "Escape") { e.preventDefault(); setEditorMention(null); }
    }
  };

  // ── Form ──────────────────────────────────────────────────────────────────
  const form = useForm({
    resolver: zodResolver(createDiscussionSchema),
    defaultValues: { title: "", content: "", category: "miscellaneous" },
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createDiscussion = useMutation({
    mutationFn: (data: z.infer<typeof createDiscussionSchema>) =>
      apiRequest("POST", "/api/discussions", data),
    onSuccess: () => {
      toast({ title: "Posted!", description: "Your post is live in the community." });
      closeAndReset();
      // Reset feed to top so the new post appears
      setAllDiscussions([]);
      setNextOffset(0);
      setHasMore(true);
      setInitialLoaded(false);
      isFetchingRef.current = false;
      fetchPage(0, sortBy, searchQuery);
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Session expired", description: "Logging you back in...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to post. Please try again.", variant: "destructive" });
    },
  });

  const createDirectConversation = useMutation({
    mutationFn: (targetUserId: string) =>
      apiRequest("POST", "/api/conversations/direct", { targetUserId }),
    onSuccess: () =>
      toast({ title: "DM started", description: "Check your Messages page." }),
    onError: (error: any) =>
      toast({ title: "Error", description: error.message || "Failed to start conversation", variant: "destructive" }),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  const closeAndReset = () => {
    setDialogOpen(false);
    form.reset();
    if (contentEditableRef.current) contentEditableRef.current.innerHTML = "";
    setUploadedMedia({ urls: [], types: [] });
    setIsPollMode(false);
    setPollOptions(["", ""]);
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setIsUploading(true);
    const formData = new FormData();
    Array.from(files).forEach((f) => formData.append("media", f));
    try {
      const res = await fetch("/api/community/upload-media", {
        method: "POST", credentials: "include", body: formData,
      });
      if (!res.ok) throw new Error();
      const result = await res.json();
      setUploadedMedia((prev) => ({
        urls:  [...prev.urls,  ...result.mediaUrls],
        types: [...prev.types, ...result.mediaTypes],
      }));
    } catch {
      toast({ title: "Upload failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeMedia = (idx: number) => {
    setUploadedMedia((prev) => ({
      urls:  prev.urls.filter((_, i) => i !== idx),
      types: prev.types.filter((_, i) => i !== idx),
    }));
  };

  const onSubmit = async (data: { title?: string; content: string; category?: string }) => {
    if (!(user as any)?.id) {
      toast({ title: "Sign in required", variant: "destructive" });
      return;
    }
    if (isPollMode && pollOptions.filter((o) => o.trim()).length < 2) {
      toast({ title: "Add at least 2 poll options", variant: "destructive" });
      return;
    }
    const plain     = data.content.replace(/<[^>]+>/g, "").trim();
    const autoTitle = plain.slice(0, 60) + (plain.length > 60 ? "..." : "") || "Post";
    const validPoll = isPollMode
      ? pollOptions.filter((o) => o.trim()).map((text, i) => ({ id: String(i), text }))
      : undefined;
    createDiscussion.mutate({
      title:      autoTitle,
      content:    normalizeHtml(data.content),
      category:   "miscellaneous",
      mediaUrls:  uploadedMedia.urls.length  > 0 ? uploadedMedia.urls  : undefined,
      mediaTypes: uploadedMedia.types.length > 0 ? uploadedMedia.types : undefined,
      postType:   isPollMode ? "poll" : uploadedMedia.urls.length > 0 ? "media" : "text",
      pollOptions: validPoll,
    } as any);
  };

  const stats = {
    totalMembers: communityStats?.totalMembers ?? 0,
    activeToday:  communityStats?.activeToday  ?? 0,
    newPosts:     communityStats?.newPosts     ?? 0,
  };

  const isLoading = !initialLoaded && isFetching;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="pb-20">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="liquid-header text-white px-6 pt-12 pb-6">
        <BackButton />
        <h1
          className="text-4xl font-black mb-2 tracking-tighter uppercase"
          data-testid="text-community-title"
        >
          Community
        </h1>
        <p
          className="text-[#FDD000] text-xs font-bold tracking-widest uppercase"
          data-testid="text-community-subtitle"
        >
          Iron Sharpens Iron Among Brothers
        </p>
      </div>

      {/* ── STATS STRIP ────────────────────────────────────────────────────── */}
      <div className="px-4 -mt-3 relative z-10 mb-4">
        <div
          className="grid grid-cols-3 gap-0 overflow-hidden rounded-sm"
          style={{ border: "1px solid #222" }}
          data-testid="card-stats"
        >
          {[
            { value: stats.totalMembers.toLocaleString(), label: "Members",    testId: "text-total-members" },
            { value: stats.activeToday.toString(),        label: "Active Today", testId: "text-active-today" },
            { value: stats.newPosts.toString(),           label: "Posts Today", testId: "text-new-posts" },
          ].map((s, i) => (
            <div
              key={s.label}
              className="flex flex-col items-center py-3 px-2"
              style={{ background: "#0d0d0d", borderRight: i < 2 ? "1px solid #222" : "none" }}
            >
              <span
                className="font-black text-lg leading-tight text-[#FDD000]"
                data-testid={s.testId}
              >
                {s.value}
              </span>
              <span className="text-[10px] text-white/40 text-center leading-tight mt-0.5 uppercase tracking-wide font-bold">
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── COMPOSE TRIGGER ────────────────────────────────────────────────── */}
      <div className="px-4 mb-4">
        <button
          onClick={() => setDialogOpen(true)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-sm text-left transition-all"
          style={{
            background: "#111",
            border: "2px solid rgba(253,208,0,0.3)",
            boxShadow: "3px 3px 0px 0px rgba(253,208,0,0.15)",
          }}
          data-testid="button-quick-post"
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(253,208,0,0.12)" }}
          >
            <Plus className="w-4 h-4 text-[#FDD000]" />
          </div>
          <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>
            How is God shaping you right now?
          </span>
        </button>
      </div>

      {/* ── SEARCH + SORT PILLS ────────────────────────────────────────────── */}
      <div className="px-4 mb-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black" />
            <Input
              placeholder="SEARCH..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 border-2 border-black bg-[#FDD000] rounded-sm text-black placeholder:text-black/50 placeholder:font-medium placeholder:text-xs placeholder:tracking-wide font-medium text-sm"
            />
            {searchInput && (
              <button
                onClick={() => { setSearchInput(""); setSearchQuery(""); }}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-3.5 h-3.5 text-black/60" />
              </button>
            )}
          </div>
          <div className="flex gap-1">
            {([ 
              { value: "recent",  label: "New"  },
              { value: "likes",   label: "Top"  },
              { value: "replies", label: "Hot"  },
            ] as const).map((opt) => (
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
      </div>

      {/* ── FEED HEADING ───────────────────────────────────────────────────── */}
      <div className="px-4 mb-3 flex items-center gap-3">
        <div className="w-1 h-5 bg-[#FDD000] rounded-full flex-shrink-0" />
        <span className="text-sm font-black text-white uppercase tracking-[0.15em]">
          {searchQuery ? `"${searchQuery}"` : "All Posts"}
        </span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      {/* ── FEED ───────────────────────────────────────────────────────────── */}
      <div className="px-4">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FDD000] mx-auto mb-4" />
            <p className="text-white/40 text-sm">Loading posts...</p>
          </div>
        ) : loadError && allDiscussions.length === 0 ? (
          <div
            className="text-center py-12 rounded-sm"
            style={{ background: "#0d0d0d", border: "1px solid #222" }}
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: "rgba(253,208,0,0.08)" }}
            >
              <MessageCircle className="w-7 h-7 text-[#FDD000]" />
            </div>
            <h3 className="text-white font-black text-lg uppercase tracking-tight mb-2">
              Connection Issue
            </h3>
            <p className="text-sm max-w-xs mx-auto mb-5" style={{ color: "rgba(255,255,255,0.4)" }}>
              Couldn't load posts. Check your connection and try again.
            </p>
            <button
              onClick={() => {
                setLoadError(false);
                setInitialLoaded(false);
                fetchPage(0, sortBy, searchQuery);
              }}
              className="px-6 py-2.5 rounded-sm font-black uppercase tracking-wide text-black text-sm"
              style={{ background: "#FDD000", border: "2px solid #000" }}
            >
              Retry
            </button>
          </div>
        ) : allDiscussions.length === 0 && initialLoaded ? (
          <div
            className="text-center py-12 rounded-sm"
            style={{ background: "#0d0d0d", border: "1px solid #222" }}
            data-testid="empty-discussions"
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: "rgba(253,208,0,0.1)" }}
            >
              <MessageCircle className="w-7 h-7 text-[#FDD000]" />
            </div>
            <h3 className="text-white font-black text-lg uppercase tracking-tight mb-2">
              {searchQuery ? "No Results" : "Be the First"}
            </h3>
            <p className="text-sm max-w-xs mx-auto mb-5" style={{ color: "rgba(255,255,255,0.4)" }}>
              {searchQuery
                ? `No posts match "${searchQuery}".`
                : "Start the conversation. Share how God is working in your life right now."}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setDialogOpen(true)}
                className="px-6 py-2.5 rounded-sm font-black uppercase tracking-wide text-black text-sm"
                style={{ background: "#FDD000", border: "2px solid #000" }}
              >
                Post First
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {allDiscussions.map((discussion: any) => (
              <div
                key={discussion.id}
                data-discussion-id={discussion.id}
                className={
                  highlightedDiscussion === discussion.id
                    ? "ring-2 ring-[#FDD000]/50 rounded-sm"
                    : ""
                }
              >
                <DiscussionErrorBoundary discussionId={discussion.id}>
                  <DiscussionCard
                    discussion={discussion}
                    onStartDirectMessage={(userId: string) =>
                      createDirectConversation.mutate(userId)
                    }
                    currentUserTier={(user as any)?.subscriptionTier || "free"}
                    currentUserSubscriptionStatus={(user as any)?.subscriptionStatus || "trial"}
                    autoOpenReplies={!!targetReplyId && discussion.id === targetDiscussionId}
                    highlightReplyId={
                      discussion.id === targetDiscussionId ? targetReplyId ?? undefined : undefined
                    }
                    data-testid={`discussion-${discussion.id}`}
                  />
                </DiscussionErrorBoundary>
              </div>
            ))}

            {/* ── SENTINEL + BOTTOM STATE ──────────────────────────────────── */}
            <div ref={sentinelRef} className="py-2">
              {isFetching && allDiscussions.length > 0 && (
                <div className="flex items-center justify-center gap-2 py-4">
                  <Loader2 className="w-5 h-5 text-[#FDD000] animate-spin" />
                  <span className="text-white/40 text-xs font-bold uppercase tracking-wide">
                    Loading more...
                  </span>
                </div>
              )}
              {!hasMore && allDiscussions.length > 0 && (
                <div className="text-center py-6">
                  <p className="text-white/30 text-xs font-bold uppercase tracking-widest">
                    You're all caught up
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── COMPOSE DIALOG ─────────────────────────────────────────────────── */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => { if (!open) closeAndReset(); else setDialogOpen(true); }}
      >
        <DialogContent
          className="max-w-md mx-auto rounded-sm overflow-hidden flex flex-col max-h-[90vh]"
          style={{
            background: "#FDD000",
            border: "2px solid #000",
            boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)",
          }}
          data-testid="dialog-new-discussion"
        >
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-black text-xl font-black uppercase tracking-tight">
              Create Post
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col flex-1 min-h-0"
            >
              <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">

                {/* Content field */}
                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div>
                          {/* Admin formatting toolbar */}
                          {isAdmin && (
                            <div className="flex items-center gap-1 mb-1.5 p-1 bg-black/10 rounded-sm border border-black/20">
                              {(
                                [
                                  { cmd: "bold",          Icon: Bold,          title: "Bold"          },
                                  { cmd: "italic",        Icon: Italic,        title: "Italic"        },
                                  { cmd: "underline",     Icon: Underline,     title: "Underline"     },
                                  { cmd: "strikeThrough", Icon: Strikethrough, title: "Strikethrough" },
                                ] as const
                              ).map(({ cmd, Icon, title }) => (
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
                              <span className="ml-auto text-[10px] text-black/40 font-bold uppercase tracking-wide pr-1">
                                Admin
                              </span>
                            </div>
                          )}

                          {/* Admin: contentEditable with mentions */}
                          {isAdmin ? (
                            <div className="relative">
                              <div
                                ref={contentEditableRef}
                                contentEditable
                                suppressContentEditableWarning
                                onInput={() => {
                                  form.setValue(
                                    "content",
                                    normalizeHtml(contentEditableRef.current?.innerHTML || ""),
                                    { shouldValidate: true }
                                  );
                                  detectEditorMention();
                                }}
                                onKeyDown={handleEditorKeyDown}
                                onKeyUp={detectEditorMention}
                                onClick={detectEditorMention}
                                onBlur={() => setTimeout(() => setEditorMention(null), 150)}
                                data-placeholder="Share your thoughts... Type @ to mention a brother."
                                className="min-h-[120px] max-h-[40vh] overflow-y-auto bg-white border-2 border-black text-black rounded-sm p-2.5 text-sm leading-relaxed focus:outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
                                data-testid="div-discussion-content"
                              />
                              <MentionDropdown
                                active={editorMention}
                                items={editorMentionDropdown.items}
                                highlight={editorMentionDropdown.highlight}
                                setHighlight={editorMentionDropdown.setHighlight}
                                isFetching={editorMentionDropdown.isFetching}
                                onPickIndex={(idx) => editorMentionDropdown.pick(idx)}
                              />
                            </div>
                          ) : (
                            /* Standard: MentionTextarea */
                            <MentionTextarea
                              placeholder="Share your thoughts... Type @ to mention a brother."
                              className="min-h-[120px] max-h-[40vh] bg-white border-2 border-black text-black placeholder:text-gray-500 rounded-sm resize-none"
                              value={field.value || ""}
                              onChange={field.onChange}
                              name={field.name}
                              onBlur={field.onBlur}
                              data-testid="textarea-discussion-content"
                            />
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Media/Poll toggle buttons */}
                <div className="flex gap-2 flex-wrap">
                  <Button
                    type="button" size="sm"
                    onClick={() => { setIsPollMode(!isPollMode); if (!isPollMode) setPollOptions(["", ""]); }}
                    className={`rounded-sm font-bold uppercase border-2 text-xs ${
                      isPollMode
                        ? "bg-blue-600 border-blue-700 text-white"
                        : "bg-black border-black text-white"
                    }`}
                    data-testid="button-toggle-poll"
                  >
                    <BarChart2 className="w-3.5 h-3.5 mr-1.5" /> Poll
                  </Button>
                  {!isPollMode && (
                    <>
                      <Button
                        type="button" size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="bg-black border-2 border-black text-white rounded-sm font-bold uppercase text-xs"
                        data-testid="button-add-photo"
                      >
                        <Image className="w-3.5 h-3.5 mr-1.5" /> Photo
                      </Button>
                      <Button
                        type="button" size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="bg-black border-2 border-black text-white rounded-sm font-bold uppercase text-xs"
                        data-testid="button-add-video"
                      >
                        <Video className="w-3.5 h-3.5 mr-1.5" /> Video
                      </Button>
                    </>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleMediaUpload}
                  accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm"
                  multiple
                  className="hidden"
                  data-testid="input-media-upload"
                />

                {/* Poll options editor */}
                {isPollMode && (
                  <div className="space-y-2">
                    <p className="text-xs font-black text-black uppercase tracking-wide">Poll Options</p>
                    {pollOptions.map((opt, i) => (
                      <div key={i} className="flex gap-1 items-center">
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const next = [...pollOptions];
                            next[i] = e.target.value;
                            setPollOptions(next);
                          }}
                          placeholder={`Option ${i + 1}`}
                          className="flex-1 bg-white border-2 border-black text-black text-xs rounded-sm px-2 py-1.5 placeholder:text-gray-400 focus:outline-none"
                        />
                        {pollOptions.length > 2 && (
                          <button
                            type="button"
                            onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))}
                            className="text-black/50 hover:text-red-600 p-1"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                    {pollOptions.length < 6 && (
                      <button
                        type="button"
                        onClick={() => setPollOptions([...pollOptions, ""])}
                        className="flex items-center gap-1 text-xs font-bold text-black/60 hover:text-black"
                      >
                        <Plus className="w-3 h-3" /> Add option
                      </button>
                    )}
                  </div>
                )}

                {/* Upload progress */}
                {isUploading && (
                  <div className="flex items-center gap-2 text-black/70 text-xs">
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-black" />
                    Uploading...
                  </div>
                )}

                {/* Media previews */}
                {uploadedMedia.urls.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {uploadedMedia.urls.map((url, i) => (
                      <div key={i} className="relative group rounded-sm overflow-hidden border-2 border-black">
                        {uploadedMedia.types[i] === "video" ? (
                          <video src={url} className="w-full h-20 object-cover" />
                        ) : (
                          <img src={url} alt={`Upload ${i + 1}`} className="w-full h-20 object-cover" />
                        )}
                        <button
                          type="button"
                          onClick={() => removeMedia(i)}
                          className="absolute top-1 right-1 bg-red-600 text-white p-0.5 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity"
                          data-testid={`button-remove-media-${i}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Dialog footer */}
              <div className="flex gap-2 flex-shrink-0 pt-3 mt-3 border-t border-black/20">
                <Button
                  type="button"
                  onClick={closeAndReset}
                  className="flex-1 bg-white border-2 border-black text-black hover:bg-gray-100 rounded-sm font-black uppercase tracking-wide"
                  data-testid="button-cancel-discussion"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createDiscussion.isPending || isUploading}
                  className="flex-1 bg-black text-white font-black uppercase tracking-wide rounded-sm border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50"
                  data-testid="button-create-discussion"
                >
                  <Send className="w-3.5 h-3.5 mr-2" />
                  {createDiscussion.isPending ? "Posting..." : "Post"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
