import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Search,
  Save,
  X,
  ArrowRight,
  AlertTriangle,
  Video as VideoIcon,
  FilterX,
} from "lucide-react";

type SidednessValue = "bilateral" | "unilateral" | "alternating";

interface Exercise {
  id: number;
  name: string;
  bodyPart: string;
  equipment: string;
  level: string;
  instructions: string;
  shortInstructions: string | null;
  mediaFile: string;
  sidedness: SidednessValue;
  hiit: string;
  stretching: string;
}

const SIDEDNESS_COLORS: Record<SidednessValue, string> = {
  bilateral: "bg-blue-100 text-blue-800 border-blue-300",
  unilateral: "bg-orange-100 text-orange-800 border-orange-300",
  alternating: "bg-purple-100 text-purple-800 border-purple-300",
};

function SidednessBadge({ value }: { value: string }) {
  const base =
    SIDEDNESS_COLORS[value as SidednessValue] ??
    "bg-gray-100 text-gray-800 border-gray-300";
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0 text-[10px] font-semibold capitalize ${base}`}
    >
      {value || "bilateral"}
    </span>
  );
}

function isPlayableMedia(url: string | null | undefined) {
  return (
    !!url &&
    (url.startsWith("/api/media/") ||
      url.startsWith("http") ||
      url.startsWith("/"))
  );
}

export default function ExerciseReviews() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeId, setActiveId] = useState<number | null>(null);

  // Filters — "all" means no filter for that field
  const [filterEquipment, setFilterEquipment] = useState<string>("all");
  const [filterBodyPart, setFilterBodyPart] = useState<string>("all");
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [filterHiit, setFilterHiit] = useState<string>("all");
  const [filterStretching, setFilterStretching] = useState<string>("all");

  const hasActiveFilters =
    filterEquipment !== "all" ||
    filterBodyPart !== "all" ||
    filterLevel !== "all" ||
    filterHiit !== "all" ||
    filterStretching !== "all";

  const clearFilters = () => {
    setFilterEquipment("all");
    setFilterBodyPart("all");
    setFilterLevel("all");
    setFilterHiit("all");
    setFilterStretching("all");
  };

  // Drafts for the active exercise being reviewed
  const [draftSidedness, setDraftSidedness] =
    useState<SidednessValue>("bilateral");
  const [draftInstructions, setDraftInstructions] = useState("");
  const [draftShortInstructions, setDraftShortInstructions] = useState("");

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceTimer.current !== null) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedSearch(value), 300);
  };

  const { data: rows = [], isLoading } = useQuery<Exercise[]>({
    queryKey: [
      "/api/exercises",
      debouncedSearch,
      filterEquipment,
      filterBodyPart,
      filterLevel,
      filterHiit,
      filterStretching,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (filterEquipment !== "all") params.set("equipment", filterEquipment);
      if (filterBodyPart !== "all") params.set("bodyPart", filterBodyPart);
      if (filterLevel !== "all") params.set("level", filterLevel);
      if (filterHiit !== "all") params.set("hiit", filterHiit);
      if (filterStretching !== "all") params.set("stretching", filterStretching);
      const url = `/api/exercises${params.toString() ? "?" + params : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load exercises");
      return res.json();
    },
  });

  // Filter option lists (independent of current filters so they don't shrink)
  const { data: equipmentTypes = [] } = useQuery<string[]>({
    queryKey: ["/api/exercises/equipment-types"],
  });
  const { data: bodyParts = [] } = useQuery<string[]>({
    queryKey: ["/api/exercises/body-parts"],
  });
  const { data: fitnessLevels = [] } = useQuery<string[]>({
    queryKey: ["/api/exercises/fitness-levels"],
  });

  // Sort by id for stable navigation order
  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => a.id - b.id),
    [rows],
  );

  const activeIndex = useMemo(
    () => (activeId === null ? -1 : sortedRows.findIndex((r) => r.id === activeId)),
    [activeId, sortedRows],
  );
  const activeExercise = activeIndex >= 0 ? sortedRows[activeIndex] : null;

  // Sync drafts whenever the active exercise changes
  useEffect(() => {
    if (activeExercise) {
      setDraftSidedness(
        (activeExercise.sidedness as SidednessValue) ?? "bilateral",
      );
      setDraftInstructions(activeExercise.instructions ?? "");
      setDraftShortInstructions(activeExercise.shortInstructions ?? "");
    }
  }, [activeExercise?.id]);

  // Restart playback whenever the video source changes
  useEffect(() => {
    if (videoRef.current && activeExercise) {
      const v = videoRef.current;
      v.load();
      v.play().catch(() => {
        /* autoplay can be blocked; muted videos should still autoplay */
      });
    }
  }, [activeExercise?.id, activeExercise?.mediaFile]);

  const isDirty = useMemo(() => {
    if (!activeExercise) return false;
    return (
      draftSidedness !== (activeExercise.sidedness ?? "bilateral") ||
      draftInstructions !== (activeExercise.instructions ?? "") ||
      draftShortInstructions !== (activeExercise.shortInstructions ?? "")
    );
  }, [activeExercise, draftSidedness, draftInstructions, draftShortInstructions]);

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, any> }) =>
      apiRequest("PATCH", `/api/admin/exercises/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exercises"] });
    },
    onError: (err: any) => {
      toast({
        title: "Update failed",
        description: err?.message || "Could not save exercise.",
        variant: "destructive",
      });
    },
  });

  const saveCurrent = async (): Promise<boolean> => {
    if (!activeExercise) return false;
    const trimmedInstructions = draftInstructions.trim();
    if (!trimmedInstructions) {
      toast({
        title: "Cannot save",
        description: "Instructions cannot be empty.",
        variant: "destructive",
      });
      return false;
    }
    try {
      await updateMutation.mutateAsync({
        id: activeExercise.id,
        payload: {
          sidedness: draftSidedness,
          instructions: trimmedInstructions,
          shortInstructions: draftShortInstructions.trim() || null,
        },
      });
      toast({
        title: "Saved",
        description: `"${activeExercise.name}" updated.`,
      });
      return true;
    } catch {
      return false;
    }
  };

  const goToIndex = (idx: number) => {
    if (idx < 0 || idx >= sortedRows.length) return;
    setActiveId(sortedRows[idx].id);
  };

  const handleUpdateAndNext = async () => {
    const ok = isDirty ? await saveCurrent() : true;
    if (!ok) return;
    if (activeIndex < sortedRows.length - 1) {
      goToIndex(activeIndex + 1);
    } else {
      toast({
        title: "End of list",
        description: "You're on the last exercise.",
      });
    }
  };

  const handleSaveAndClose = async () => {
    const ok = isDirty ? await saveCurrent() : true;
    if (!ok) return;
    setActiveId(null);
  };

  const handleClose = () => {
    setActiveId(null);
  };

  const handleNext = () => {
    if (activeIndex < sortedRows.length - 1) goToIndex(activeIndex + 1);
  };

  const handlePrev = () => {
    if (activeIndex > 0) goToIndex(activeIndex - 1);
  };

  // ── Detail view ────────────────────────────────────────────────────────
  if (activeExercise) {
    const playable = isPlayableMedia(activeExercise.mediaFile);
    return (
      <div className="space-y-4">
        {/* Top bar with position + close */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="h-8 border-2 border-black hover:bg-gray-100"
              onClick={handleClose}
              data-testid="button-back-to-list"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to list
            </Button>
            <span className="text-xs text-gray-500">
              Reviewing exercise{" "}
              <span className="font-bold text-black">
                {activeIndex + 1}
              </span>{" "}
              of {sortedRows.length}
            </span>
            {isDirty && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-300 rounded px-2 py-0.5">
                <AlertTriangle className="h-3 w-3" />
                Unsaved changes
              </span>
            )}
          </div>
        </div>

        <Card className="border-2 border-black">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <CardTitle className="text-base font-bold">
                  #{activeExercise.id} — {activeExercise.name}
                </CardTitle>
                <div className="flex items-center gap-2 flex-wrap mt-1.5 text-[11px] text-gray-500">
                  <span className="capitalize">{activeExercise.bodyPart}</span>
                  <span>·</span>
                  <span className="capitalize">{activeExercise.equipment}</span>
                  <span>·</span>
                  <span className="capitalize">{activeExercise.level}</span>
                  {activeExercise.hiit === "Yes" && (
                    <>
                      <span>·</span>
                      <span className="font-bold text-red-600">HIIT</span>
                    </>
                  )}
                  {activeExercise.stretching === "Yes" && (
                    <>
                      <span>·</span>
                      <span className="font-bold text-green-700">Stretching</span>
                    </>
                  )}
                </div>
              </div>
              <SidednessBadge value={activeExercise.sidedness} />
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Auto-loop video */}
            <div>
              <Label className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1.5 block">
                Demo Video
              </Label>
              {playable ? (
                <video
                  ref={videoRef}
                  key={activeExercise.id}
                  src={activeExercise.mediaFile}
                  autoPlay
                  loop
                  muted
                  playsInline
                  controls
                  preload="metadata"
                  className="w-full max-h-[420px] rounded border-2 border-gray-300 bg-black"
                  data-testid="video-exercise-review"
                />
              ) : (
                <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded p-3">
                  <VideoIcon className="h-4 w-4" />
                  <span>No playable video for this exercise.</span>
                  {activeExercise.mediaFile && (
                    <span className="font-mono text-[10px] truncate max-w-[260px]">
                      {activeExercise.mediaFile}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Sidedness */}
            <div>
              <Label
                htmlFor="review-sidedness"
                className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1.5 block"
              >
                Sidedness
              </Label>
              <Select
                value={draftSidedness}
                onValueChange={(v) => setDraftSidedness(v as SidednessValue)}
              >
                <SelectTrigger
                  id="review-sidedness"
                  className="h-9 border-2 border-gray-300 max-w-xs"
                  data-testid="select-sidedness"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bilateral">bilateral</SelectItem>
                  <SelectItem value="unilateral">unilateral</SelectItem>
                  <SelectItem value="alternating">alternating</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-gray-400 mt-1">
                bilateral = both sides together · unilateral = one side at a time
                with reposition · alternating = sides alternate within a set.
              </p>
            </div>

            {/* Short instructions */}
            <div>
              <Label
                htmlFor="review-short"
                className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1.5 block"
              >
                Short Instructions
              </Label>
              <Textarea
                id="review-short"
                rows={2}
                value={draftShortInstructions}
                onChange={(e) => setDraftShortInstructions(e.target.value)}
                placeholder="Brief one-line description (optional)"
                className="text-sm border-2 border-gray-300"
                data-testid="textarea-short-instructions"
              />
            </div>

            {/* Full instructions */}
            <div>
              <Label
                htmlFor="review-instructions"
                className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1.5 block"
              >
                Full Instructions
              </Label>
              <Textarea
                id="review-instructions"
                rows={8}
                value={draftInstructions}
                onChange={(e) => setDraftInstructions(e.target.value)}
                placeholder="Step-by-step instructions for performing this exercise…"
                className="text-sm leading-relaxed border-2 border-gray-300 font-normal"
                data-testid="textarea-instructions"
              />
            </div>
          </CardContent>
        </Card>

        {/* Action bar */}
        <div className="sticky bottom-0 z-10 bg-white border-2 border-black rounded p-3 shadow-md flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="h-9 border-2 border-black hover:bg-gray-100"
            onClick={handlePrev}
            disabled={activeIndex <= 0 || updateMutation.isPending}
            data-testid="button-prev"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 border-2 border-black hover:bg-gray-100"
            onClick={handleNext}
            disabled={
              activeIndex >= sortedRows.length - 1 || updateMutation.isPending
            }
            data-testid="button-next"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>

          <div className="flex-1" />

          <Button
            size="sm"
            className="h-9 bg-blue-600 hover:bg-blue-700 text-white border-2 border-blue-700"
            onClick={handleUpdateAndNext}
            disabled={
              updateMutation.isPending ||
              activeIndex >= sortedRows.length - 1
            }
            data-testid="button-update"
          >
            <ArrowRight className="h-4 w-4 mr-1" />
            {updateMutation.isPending ? "Updating…" : "Update & Next"}
          </Button>
          <Button
            size="sm"
            className="h-9 bg-green-600 hover:bg-green-700 text-white border-2 border-green-700"
            onClick={handleSaveAndClose}
            disabled={updateMutation.isPending}
            data-testid="button-save"
          >
            <Save className="h-4 w-4 mr-1" />
            {updateMutation.isPending ? "Saving…" : "Save"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 border-2 border-gray-400 hover:bg-gray-100"
            onClick={handleClose}
            disabled={updateMutation.isPending}
            data-testid="button-close"
          >
            <X className="h-4 w-4 mr-1" />
            Close
          </Button>
        </div>
      </div>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────
  const sortedEquipment = [...equipmentTypes].sort();
  const sortedBodyParts = [...bodyParts].sort();
  // Order difficulty Beginner → Intermediate → Advanced when those values are present
  const levelOrder: Record<string, number> = {
    Beginner: 0,
    Intermediate: 1,
    Advanced: 2,
  };
  const sortedLevels = [...fitnessLevels].sort(
    (a, b) => (levelOrder[a] ?? 99) - (levelOrder[b] ?? 99) || a.localeCompare(b),
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
        <Input
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search exercise name…"
          className="pl-8 h-9 text-sm"
          data-testid="input-search-exercises"
        />
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        <div>
          <Label className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1 block">
            Equipment
          </Label>
          <Select value={filterEquipment} onValueChange={setFilterEquipment}>
            <SelectTrigger
              className="h-8 text-xs border-2 border-gray-300"
              data-testid="filter-equipment"
            >
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All equipment</SelectItem>
              {sortedEquipment.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1 block">
            Body Part
          </Label>
          <Select value={filterBodyPart} onValueChange={setFilterBodyPart}>
            <SelectTrigger
              className="h-8 text-xs border-2 border-gray-300"
              data-testid="filter-body-part"
            >
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All body parts</SelectItem>
              {sortedBodyParts.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1 block">
            Difficulty
          </Label>
          <Select value={filterLevel} onValueChange={setFilterLevel}>
            <SelectTrigger
              className="h-8 text-xs border-2 border-gray-300"
              data-testid="filter-level"
            >
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All levels</SelectItem>
              {sortedLevels.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1 block">
            HIIT
          </Label>
          <Select value={filterHiit} onValueChange={setFilterHiit}>
            <SelectTrigger
              className="h-8 text-xs border-2 border-gray-300"
              data-testid="filter-hiit"
            >
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="Yes">HIIT only</SelectItem>
              <SelectItem value="No">Non-HIIT</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1 block">
            Stretching
          </Label>
          <Select value={filterStretching} onValueChange={setFilterStretching}>
            <SelectTrigger
              className="h-8 text-xs border-2 border-gray-300"
              data-testid="filter-stretching"
            >
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="Yes">Stretching only</SelectItem>
              <SelectItem value="No">Non-stretching</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {hasActiveFilters && (
        <div className="flex items-center justify-between gap-2 bg-amber-50 border-2 border-amber-300 rounded px-2.5 py-1.5">
          <span className="text-[11px] font-semibold text-amber-900">
            Filters are active — Next/Previous/Update will only navigate within
            the filtered list.
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs border-2 border-amber-700 text-amber-900 hover:bg-amber-100"
            onClick={clearFilters}
            data-testid="button-clear-filters"
          >
            <FilterX className="h-3.5 w-3.5 mr-1" />
            Clear filters
          </Button>
        </div>
      )}

      {!isLoading && (
        <p className="text-xs text-gray-500">
          {sortedRows.length.toLocaleString()} exercise
          {sortedRows.length !== 1 ? "s" : ""}
          {debouncedSearch ? ` matching "${debouncedSearch}"` : ""} · click any
          row to review
        </p>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
        </div>
      )}

      {!isLoading && sortedRows.length === 0 && (
        <div className="text-center py-12 text-sm text-gray-400 italic">
          {debouncedSearch
            ? "No exercises match your search"
            : "No exercises found"}
        </div>
      )}

      <div className="space-y-1.5">
        {sortedRows.map((row) => {
          const playable = isPlayableMedia(row.mediaFile);
          return (
            <button
              key={row.id}
              onClick={() => setActiveId(row.id)}
              className="w-full text-left bg-white border-2 border-gray-200 hover:border-black hover:bg-gray-50 rounded px-3 py-2 transition-all flex items-center gap-3"
              data-testid={`row-exercise-${row.id}`}
            >
              <span className="text-[11px] font-mono text-gray-400 w-12 shrink-0">
                #{row.id}
              </span>
              <span className="text-sm font-semibold text-black flex-1 truncate">
                {row.name}
              </span>
              <span className="hidden sm:inline text-[11px] text-gray-500 capitalize truncate max-w-[120px]">
                {row.bodyPart}
              </span>
              <SidednessBadge value={row.sidedness} />
              {!playable && (
                <span
                  title="No playable video"
                  className="text-amber-600"
                  aria-label="No playable video"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                </span>
              )}
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
