import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, XCircle, ChevronLeft, ChevronRight, Search, AlertTriangle, ChevronDown, ChevronUp, ArrowUpDown } from "lucide-react";

type Status = "pending" | "approved" | "rejected";
type SidednessValue = "bilateral" | "unilateral" | "alternating";
type SortBy = "exerciseId" | "exerciseName" | "proposedSidedness" | "confidence";
type SortDir = "asc" | "desc";

interface ReviewRow {
  id: number;
  exerciseId: number;
  exerciseName: string;
  proposedSidedness: SidednessValue;
  reasoning: string;
  confidence: "high" | "low";
  status: Status;
  approvedSidedness: SidednessValue | null;
  currentSidedness: string | null;
  instructions: string | null;
  processedAt: string | null;
  reviewedAt: string | null;
}

interface ReviewResponse {
  rows: ReviewRow[];
  total: number;
  limit: number;
  offset: number;
  counts: { pending: number; approved: number; rejected: number };
}

const PAGE_SIZE = 30;

const SIDEDNESS_COLORS: Record<SidednessValue, string> = {
  bilateral: "bg-blue-100 text-blue-800 border-blue-300",
  unilateral: "bg-orange-100 text-orange-800 border-orange-300",
  alternating: "bg-purple-100 text-purple-800 border-purple-300",
};

function SidednessBadge({ value, size = "sm" }: { value: SidednessValue | string; size?: "sm" | "xs" }) {
  const base = SIDEDNESS_COLORS[value as SidednessValue] ?? "bg-gray-100 text-gray-800 border-gray-300";
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 font-semibold capitalize ${
        size === "xs" ? "text-[10px] py-0" : "text-xs py-0.5"
      } ${base}`}
    >
      {value}
    </span>
  );
}

function SortButton({
  label,
  field,
  current,
  direction,
  onClick,
}: {
  label: string;
  field: SortBy;
  current: SortBy;
  direction: SortDir;
  onClick: (f: SortBy) => void;
}) {
  const isActive = current === field;
  return (
    <button
      onClick={() => onClick(field)}
      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border transition-all ${
        isActive
          ? "bg-black text-white border-black"
          : "bg-white text-gray-600 border-gray-300 hover:border-gray-500"
      }`}
    >
      {label}
      {isActive ? (
        direction === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );
}

export default function ExerciseSidednessReviews() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<Status>("pending");
  const [lowConfidenceOnly, setLowConfidenceOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState<SortBy>("exerciseId");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [overrides, setOverrides] = useState<Record<number, SidednessValue>>({});

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(0);
    if (debounceTimer.current !== null) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedSearch(value), 300);
  };

  const handleStatusChange = (v: Status) => {
    setStatus(v);
    setPage(0);
    setSearch("");
    setDebouncedSearch("");
    setOverrides({});
    setExpandedId(null);
  };

  const handleSort = (field: SortBy) => {
    if (field === sortBy) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
    setPage(0);
  };

  const queryKey = ["/api/admin/exercise-sidedness-reviews", status, lowConfidenceOnly, debouncedSearch, page, sortBy, sortDir];

  const { data, isLoading } = useQuery<ReviewResponse>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({
        status,
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
        sortBy,
        sortDir,
      });
      if (lowConfidenceOnly) params.set("confidence", "low");
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/admin/exercise-sidedness-reviews?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load reviews");
      return res.json();
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, sidedness }: { id: number; sidedness: SidednessValue }) =>
      apiRequest("POST", `/api/admin/exercise-sidedness-reviews/${id}/approve`, { sidedness }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/exercise-sidedness-reviews"] });
      toast({ title: "Approved", description: "Sidedness written to exercise." });
    },
    onError: (err: any) =>
      toast({ title: "Approve failed", description: err.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("POST", `/api/admin/exercise-sidedness-reviews/${id}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/exercise-sidedness-reviews"] });
      toast({ title: "Rejected", description: "Review marked as rejected. Re-run the classifier script to re-queue." });
    },
    onError: (err: any) =>
      toast({ title: "Reject failed", description: err.message, variant: "destructive" }),
  });

  const bulkApproveMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/admin/exercise-sidedness-reviews/bulk-approve", {
        confidence: lowConfidenceOnly ? "low" : undefined,
        search: debouncedSearch || undefined,
      }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/exercise-sidedness-reviews"] });
      toast({
        title: "Bulk approved",
        description: `${res?.approved ?? "?"} exercises updated.`,
      });
      setOverrides({});
    },
    onError: (err: any) =>
      toast({ title: "Bulk approve failed", description: err.message, variant: "destructive" }),
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const counts = data?.counts ?? { pending: 0, approved: 0, rejected: 0 };
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Status tabs */}
      <div className="flex gap-2 flex-wrap">
        {(["pending", "approved", "rejected"] as Status[]).map((s) => (
          <button
            key={s}
            onClick={() => handleStatusChange(s)}
            className={`px-3 py-1.5 text-xs font-bold rounded border-2 transition-all capitalize ${
              status === s
                ? "bg-black text-white border-black"
                : "bg-white text-black border-black hover:bg-gray-100"
            }`}
          >
            {s}
            <span className={`ml-1.5 text-[10px] font-normal ${status === s ? "text-gray-300" : "text-gray-500"}`}>
              ({counts[s].toLocaleString()})
            </span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search exercise name…"
            className="pl-8 h-9 text-sm"
          />
        </div>

        <button
          onClick={() => {
            setLowConfidenceOnly((v) => !v);
            setPage(0);
          }}
          className={`px-3 py-1.5 text-xs font-bold rounded border-2 transition-all ${
            lowConfidenceOnly
              ? "bg-amber-500 text-white border-amber-600"
              : "bg-white text-black border-black hover:bg-gray-100"
          }`}
        >
          <AlertTriangle className="inline h-3 w-3 mr-1" />
          {lowConfidenceOnly ? "Low confidence only" : "All confidence"}
        </button>

        {status === "pending" && total > 0 && (
          <Button
            size="sm"
            className="h-9 text-xs bg-green-700 hover:bg-green-800 text-white"
            onClick={() => {
              if (window.confirm(`Approve all ${total.toLocaleString()} pending rows using Claude's proposed value? This writes to exercises.sidedness.`)) {
                bulkApproveMutation.mutate();
              }
            }}
            disabled={bulkApproveMutation.isPending}
          >
            <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
            {bulkApproveMutation.isPending ? "Approving…" : `Bulk approve ${total.toLocaleString()}`}
          </Button>
        )}
      </div>

      {/* Sort controls */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] text-gray-400 font-medium">Sort:</span>
        {(["exerciseId", "exerciseName", "proposedSidedness", "confidence"] as SortBy[]).map((field) => (
          <SortButton
            key={field}
            label={
              field === "exerciseId" ? "ID"
              : field === "exerciseName" ? "Name"
              : field === "proposedSidedness" ? "Sidedness"
              : "Confidence"
            }
            field={field}
            current={sortBy}
            direction={sortDir}
            onClick={handleSort}
          />
        ))}
      </div>

      {/* Count */}
      {!isLoading && (
        <p className="text-xs text-gray-500">
          {total.toLocaleString()} exercise{total !== 1 ? "s" : ""}
          {debouncedSearch ? ` matching "${debouncedSearch}"` : ""}
          {lowConfidenceOnly ? " · low confidence" : ""}
        </p>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
        </div>
      )}

      {/* Empty */}
      {!isLoading && rows.length === 0 && (
        <div className="text-center py-12 text-sm text-gray-400 italic">
          {status === "pending"
            ? "No pending reviews. Run the classify-exercise-sidedness script to populate the queue."
            : `No ${status} reviews.`}
        </div>
      )}

      {/* Rows */}
      <div className="space-y-2">
        {rows.map((row) => {
          const override = overrides[row.id];
          const chosenSidedness: SidednessValue = override ?? row.proposedSidedness;
          const isExpanded = expandedId === row.id;
          const isBusy =
            (approveMutation.isPending && (approveMutation.variables as any)?.id === row.id) ||
            (rejectMutation.isPending && rejectMutation.variables === row.id);

          return (
            <Card key={row.id} className={`border ${isBusy ? "opacity-60" : ""}`}>
              <CardHeader
                className="py-2.5 px-4 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : row.id)}
              >
                <div className="flex items-start gap-3 flex-wrap">
                  {/* Name + reasoning */}
                  <div className="flex-1 min-w-[180px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">
                        #{row.exerciseId} — {row.exerciseName}
                      </span>
                      {row.confidence === "low" && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 font-semibold">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          Ambiguous
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                      {row.reasoning}
                    </p>
                  </div>

                  {/* Current & proposed */}
                  <div className="flex items-center gap-2 text-xs text-gray-500 shrink-0">
                    <span>Was:</span>
                    <SidednessBadge value={row.currentSidedness ?? "bilateral"} size="xs" />
                    <span>→</span>
                    <span>Proposed:</span>
                    <SidednessBadge value={row.proposedSidedness} size="xs" />
                    {isExpanded
                      ? <ChevronUp className="h-3.5 w-3.5 text-gray-400 ml-1" />
                      : <ChevronDown className="h-3.5 w-3.5 text-gray-400 ml-1" />}
                  </div>

                  {/* Pending actions */}
                  {status === "pending" && (
                    <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={chosenSidedness}
                        onValueChange={(v) =>
                          setOverrides((prev) => ({ ...prev, [row.id]: v as SidednessValue }))
                        }
                      >
                        <SelectTrigger className="h-7 w-[130px] text-xs border-2 border-gray-300">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bilateral">bilateral</SelectItem>
                          <SelectItem value="unilateral">unilateral</SelectItem>
                          <SelectItem value="alternating">alternating</SelectItem>
                        </SelectContent>
                      </Select>

                      <Button
                        size="sm"
                        className="h-7 px-2 text-xs bg-green-700 hover:bg-green-800 text-white"
                        onClick={() => approveMutation.mutate({ id: row.id, sidedness: chosenSidedness })}
                        disabled={isBusy}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs border-2 border-red-400 text-red-600 hover:bg-red-50"
                        onClick={() => rejectMutation.mutate(row.id)}
                        disabled={isBusy}
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        Reject
                      </Button>
                    </div>
                  )}

                  {/* Approved view */}
                  {status === "approved" && (
                    <div className="flex items-center gap-2 text-xs text-green-700 font-semibold shrink-0">
                      <CheckCircle className="h-3.5 w-3.5" />
                      <SidednessBadge value={row.approvedSidedness ?? row.proposedSidedness} size="xs" />
                      {row.reviewedAt && (
                        <span className="text-gray-400 font-normal">
                          {new Date(row.reviewedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Rejected view */}
                  {status === "rejected" && (
                    <div className="flex items-center gap-2 text-xs text-red-600 font-semibold shrink-0">
                      <XCircle className="h-3.5 w-3.5" />
                      Rejected — re-run classifier script to re-queue
                    </div>
                  )}
                </div>
              </CardHeader>

              {/* Expanded: exercise instructions */}
              {isExpanded && row.instructions && (
                <CardContent className="pt-0 pb-3 px-4">
                  <div className="border-t pt-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1">
                      Exercise Instructions
                    </p>
                    <div className="bg-gray-50 border border-gray-200 rounded p-2.5 text-xs leading-relaxed text-gray-700 whitespace-pre-wrap">
                      {row.instructions}
                    </div>
                  </div>
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
