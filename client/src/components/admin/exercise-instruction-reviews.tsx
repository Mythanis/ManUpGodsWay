import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle, RotateCcw, RefreshCw, ChevronLeft, ChevronRight, Search, Play, AlertTriangle } from "lucide-react";

type View = "corrections" | "matched" | "rejected";

interface ReviewRow {
  id: number;
  exerciseId: number;
  exerciseName: string;
  oldInstructions: string;
  newInstructions: string | null;
  needsReview: boolean;
  status: string;
  processedAt: string | null;
  rawModelResponse: string | null;
  mediaFile: string | null;
  currentInstructions: string | null;
}

interface ReviewResponse {
  rows: ReviewRow[];
  total: number;
  limit: number;
  offset: number;
}

const PAGE_SIZE = 25;

const VIEW_LABELS: Record<View, string> = {
  corrections: "AI Corrections Applied",
  matched: "Already Matched",
  rejected: "Rejected / Failed",
};

const VIEW_DESCRIPTIONS: Record<View, string> = {
  corrections: "Claude flagged these instructions as mismatched and applied a correction. Review each one — click Revert to restore the original, or Keep to accept the AI's change.",
  matched: "Claude confirmed these instructions already matched the demo video. No changes were applied.",
  rejected: "These exercises could not be audited — either the video file path is invalid, or the request hit the API rate limit. Click Re-queue to have them picked up on the next audit run.",
};

function InstructionDiff({ old: oldText, updated }: { old: string; updated: string }) {
  return (
    <div className="grid grid-cols-2 gap-3 mt-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1">Original</p>
        <div className="bg-gray-50 border border-gray-200 rounded p-2.5 text-xs text-gray-700 leading-relaxed min-h-[60px]">
          {oldText}
        </div>
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-amber-600 mb-1">AI Correction</p>
        <div className="bg-amber-50 border border-amber-300 rounded p-2.5 text-xs text-gray-800 leading-relaxed min-h-[60px]">
          {updated}
        </div>
      </div>
    </div>
  );
}

function VideoPlayer({ mediaFile }: { mediaFile: string | null }) {
  const isPlayable =
    !!mediaFile &&
    (mediaFile.startsWith("/api/media/") || mediaFile.startsWith("http") || mediaFile.startsWith("/"));

  if (!isPlayable) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-2">
        <AlertTriangle className="h-3.5 w-3.5" />
        <span>No valid video path</span>
        {mediaFile && <span className="font-mono truncate max-w-[200px]">{mediaFile}</span>}
      </div>
    );
  }

  return (
    <video
      src={mediaFile}
      controls
      className="w-full max-w-xs rounded border border-gray-200 mt-2"
      style={{ maxHeight: 180 }}
      preload="metadata"
    />
  );
}

export default function ExerciseInstructionReviews() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [view, setView] = useState<View>("corrections");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [keptIds, setKeptIds] = useState<Set<number>>(new Set());
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(0);
    const t = setTimeout(() => setDebouncedSearch(value), 300);
    return () => clearTimeout(t);
  };

  const handleViewChange = (v: View) => {
    setView(v);
    setPage(0);
    setSearch("");
    setDebouncedSearch("");
    setKeptIds(new Set());
    setExpandedId(null);
  };

  const queryKey = ["/api/admin/exercise-instruction-reviews", view, debouncedSearch, page];

  const { data, isLoading } = useQuery<ReviewResponse>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({
        view,
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/admin/exercise-instruction-reviews?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load reviews");
      return res.json();
    },
  });

  const revertMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/exercise-instruction-reviews/${id}/revert`),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/exercise-instruction-reviews"] });
      toast({ title: "Instructions Reverted", description: "Original instructions restored." });
      setExpandedId(null);
    },
    onError: (err: any) => {
      toast({ title: "Revert Failed", description: err.message || "Could not revert instructions", variant: "destructive" });
    },
  });

  const requeueMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/exercise-instruction-reviews/${id}/requeue`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/exercise-instruction-reviews"] });
      toast({ title: "Exercise Re-queued", description: "It will be picked up on the next audit run." });
    },
    onError: (err: any) => {
      toast({ title: "Re-queue Failed", description: err.message || "Could not re-queue exercise", variant: "destructive" });
    },
  });

  const handleKeep = (id: number) => {
    setKeptIds((prev) => new Set(prev).add(id));
    if (expandedId === id) setExpandedId(null);
  };

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const visibleRows = view === "corrections" ? rows.filter((r) => !keptIds.has(r.id)) : rows;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const viewCounts: Partial<Record<View, number>> = {};

  return (
    <div className="space-y-4">
      {/* View tabs */}
      <div className="flex gap-2 flex-wrap">
        {(["corrections", "matched", "rejected"] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => handleViewChange(v)}
            className={`px-3 py-1.5 text-xs font-bold rounded border-2 transition-all ${
              view === v
                ? "bg-black text-white border-black"
                : "bg-white text-black border-black hover:bg-gray-100"
            }`}
          >
            {VIEW_LABELS[v]}
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-500">{VIEW_DESCRIPTIONS[view]}</p>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
        <Input
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search by exercise name…"
          className="pl-8 h-9 text-sm"
        />
      </div>

      {/* Count */}
      {!isLoading && (
        <p className="text-xs text-gray-500">
          {total.toLocaleString()} exercise{total !== 1 ? "s" : ""}
          {search ? ` matching "${search}"` : ""}
          {view === "corrections" && keptIds.size > 0 ? ` · ${keptIds.size} kept this session` : ""}
        </p>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && visibleRows.length === 0 && (
        <div className="text-center py-12 text-sm text-gray-400 italic">
          {search ? "No exercises match your search" : `No ${VIEW_LABELS[view].toLowerCase()} rows`}
        </div>
      )}

      {/* Rows */}
      <div className="space-y-3">
        {visibleRows.map((row) => {
          const isExpanded = expandedId === row.id;
          const isBusy =
            (revertMutation.isPending && revertMutation.variables === row.id) ||
            (requeueMutation.isPending && requeueMutation.variables === row.id);

          return (
            <Card key={row.id} className={`border-2 ${isBusy ? "opacity-60" : ""}`}>
              <CardHeader
                className="pb-2 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : row.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm font-bold truncate">
                      #{row.exerciseId} — {row.exerciseName}
                    </CardTitle>
                    {row.processedAt && (
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Reviewed {new Date(row.processedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {view === "corrections" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs border-2 border-black hover:bg-gray-100"
                          onClick={(e) => { e.stopPropagation(); handleKeep(row.id); }}
                          disabled={isBusy}
                        >
                          <CheckCircle className="h-3 w-3 mr-1 text-green-600" />
                          Keep
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 px-2 text-xs bg-red-600 hover:bg-red-700 text-white border-2 border-red-700"
                          onClick={(e) => { e.stopPropagation(); revertMutation.mutate(row.id); }}
                          disabled={isBusy}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Revert
                        </Button>
                      </>
                    )}
                    {view === "rejected" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs border-2 border-black hover:bg-gray-100"
                        onClick={(e) => { e.stopPropagation(); requeueMutation.mutate(row.id); }}
                        disabled={isBusy}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Re-queue
                      </Button>
                    )}
                    <span className="text-gray-400 text-xs">{isExpanded ? "▲" : "▼"}</span>
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0">
                  <VideoPlayer mediaFile={row.mediaFile} />

                  {view === "corrections" && row.newInstructions && (
                    <InstructionDiff old={row.oldInstructions} updated={row.newInstructions} />
                  )}

                  {view === "matched" && (
                    <div className="mt-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1">Instructions</p>
                      <div className="bg-green-50 border border-green-200 rounded p-2.5 text-xs text-gray-700 leading-relaxed">
                        {row.oldInstructions}
                      </div>
                    </div>
                  )}

                  {view === "rejected" && (
                    <div className="mt-3 space-y-2">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1">Current Instructions</p>
                        <div className="bg-gray-50 border border-gray-200 rounded p-2.5 text-xs text-gray-700 leading-relaxed">
                          {row.currentInstructions || row.oldInstructions}
                        </div>
                      </div>
                      {row.rawModelResponse && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1">Rejection Reason</p>
                          <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700 font-mono break-words">
                            {row.rawModelResponse}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || isLoading}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <span className="text-xs text-gray-500">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1 || isLoading}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
