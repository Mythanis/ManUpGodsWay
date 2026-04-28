import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { X, Plus, AlertTriangle, Sparkles } from "lucide-react";
import type { UserInjury } from "@shared/schema";
import {
  computeRecoveryWeek,
  UMBRELLA_BODY_AREAS,
  type InjuryRecommendation,
} from "@shared/injuryFilter";

const INJURY_TYPE_LABELS: Record<string, string> = {
  currently_injured: "Currently Injured",
  long_term_limitation: "Long Term Limitation",
  recovery: "Recovery",
};

const INJURY_TYPE_COLORS: Record<string, string> = {
  currently_injured: "bg-red-900/60 border-red-700 text-red-200",
  long_term_limitation: "bg-orange-900/60 border-orange-700 text-orange-200",
  recovery: "bg-blue-900/60 border-blue-700 text-blue-200",
};

// Today as YYYY-MM-DD for the date input default.
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function InjuriesPanel() {
  const [hasInjuries, setHasInjuries] = useState<boolean | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bodyArea, setBodyArea] = useState("");
  const [injuryType, setInjuryType] = useState<string>("");
  const [note, setNote] = useState("");
  const [startedAt, setStartedAt] = useState<string>("");

  const { data: injuries = [], isLoading: injuriesLoading } = useQuery<UserInjury[]>({
    queryKey: ["/api/user/injuries"],
  });

  const { data: bodyAreas = [], isLoading: bodyAreasLoading } = useQuery<string[]>({
    queryKey: ["/api/exercises/body-parts"],
  });

  const { data: recommendations = [] } = useQuery<InjuryRecommendation[]>({
    queryKey: ["/api/user/injuries/recommendations"],
    enabled: injuries.length > 0,
  });

  const effectiveAnswer = injuries.length > 0 ? true : hasInjuries;

  const addMutation = useMutation({
    mutationFn: async (data: { bodyArea: string; injuryType: string; note?: string; startedAt?: string }) =>
      apiRequest("POST", "/api/user/injuries", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/injuries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/injuries/recommendations"] });
      setDialogOpen(false);
      setBodyArea("");
      setInjuryType("");
      setNote("");
      setStartedAt("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/user/injuries/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/injuries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/injuries/recommendations"] });
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => apiRequest("DELETE", "/api/user/injuries/clear"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/injuries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/injuries/recommendations"] });
      setHasInjuries(false);
    },
  });

  function openAddDialog() {
    setBodyArea("");
    setInjuryType("");
    setNote("");
    setStartedAt("");
    setDialogOpen(true);
  }

  function handleSave() {
    if (!bodyArea || !injuryType) return;
    addMutation.mutate({
      bodyArea,
      injuryType,
      note: note.trim() || undefined,
      // Only send a start date when the injury is in recovery.
      startedAt: injuryType === "recovery" && startedAt ? startedAt : undefined,
    });
  }

  function handleYes() {
    setHasInjuries(true);
    openAddDialog();
  }

  function handleNo() {
    setHasInjuries(false);
  }

  // Merge the umbrella body areas (Hips, Wrists, Ankles) — which the spec
  // groups multiple specific body parts under — into the existing list of
  // body parts pulled from the exercises table, deduped and alphabetized.
  const sortedBodyAreas = Array.from(new Set([...bodyAreas, ...UMBRELLA_BODY_AREAS])).sort();

  return (
    <div className="px-4 py-4">
      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3">
        Do you currently have any injuries?
      </p>

      <div className="flex gap-2 mb-3">
        <button
          onClick={handleYes}
          className={`flex-1 py-2 rounded-sm text-sm font-black uppercase tracking-wider border-2 transition-colors ${
            effectiveAnswer === true
              ? "bg-[#FDD000] border-[#FDD000] text-black"
              : "bg-transparent border-zinc-600 text-zinc-400 hover:border-zinc-400"
          }`}
          data-testid="injuries-yes-button"
        >
          Yes
        </button>
        <button
          onClick={handleNo}
          className={`flex-1 py-2 rounded-sm text-sm font-black uppercase tracking-wider border-2 transition-colors ${
            effectiveAnswer === false
              ? "bg-[#FDD000] border-[#FDD000] text-black"
              : "bg-transparent border-zinc-600 text-zinc-400 hover:border-zinc-400"
          }`}
          data-testid="injuries-no-button"
        >
          No
        </button>
      </div>

      {injuriesLoading && (
        <div className="flex items-center gap-2 py-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#FDD000]" />
          <span className="text-xs text-zinc-400">Loading...</span>
        </div>
      )}

      {!injuriesLoading && injuries.length === 0 && (
        <p className="text-xs text-zinc-500 italic">No injuries recorded — tap Yes to add.</p>
      )}

      {!injuriesLoading && injuries.length > 0 && (
        <div className="space-y-2">
          {injuries.map((injury) => {
            const week = injury.injuryType === "recovery"
              ? computeRecoveryWeek(injury.startedAt)
              : null;
            return (
              <div
                key={injury.id}
                className={`flex items-start justify-between gap-2 px-3 py-2 rounded-sm border text-sm ${
                  INJURY_TYPE_COLORS[injury.injuryType] ?? "bg-zinc-800 border-zinc-600 text-zinc-200"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <span className="font-black">{injury.bodyArea}</span>
                  <span className="mx-1.5 opacity-50">·</span>
                  <span className="text-xs font-semibold opacity-80">
                    {INJURY_TYPE_LABELS[injury.injuryType] ?? injury.injuryType}
                  </span>
                  {week !== null && (
                    <span className="ml-1.5 text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-blue-700/60 border border-blue-500">
                      Week {week}
                    </span>
                  )}
                  {injury.note && (
                    <p className="text-xs opacity-70 mt-0.5 truncate">{injury.note}</p>
                  )}
                </div>
                <button
                  onClick={() => deleteMutation.mutate(injury.id)}
                  disabled={deleteMutation.isPending}
                  className="shrink-0 p-0.5 opacity-60 hover:opacity-100 transition-opacity"
                  aria-label="Remove injury"
                  data-testid={`remove-injury-${injury.id}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}

          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              onClick={openAddDialog}
              className="bg-[#FDD000] text-black font-black hover:bg-[#FDD000]/90 text-xs px-3 h-7"
              data-testid="add-another-injury-button"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add Another
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => clearMutation.mutate()}
              disabled={clearMutation.isPending}
              className="text-zinc-400 hover:text-white text-xs h-7"
              data-testid="clear-injuries-button"
            >
              Clear All
            </Button>
          </div>

          {recommendations.length > 0 && (
            <div className="mt-4 space-y-2" data-testid="injury-recommendations">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#FDD000]" />
                Always include for your injury
              </p>
              {recommendations.map((rec) => (
                <div
                  key={rec.bodyArea}
                  className="px-3 py-2 rounded-sm border border-[#FDD000]/40 bg-zinc-900/60"
                >
                  <p className="text-xs font-black uppercase tracking-wider text-[#FDD000] mb-1">
                    {rec.bodyArea}
                  </p>
                  <ul className="space-y-1">
                    {rec.recommendations.map((r) => (
                      <li key={r.name} className="text-xs">
                        <span className="font-black text-white">{r.name}</span>
                        <span className="text-zinc-400"> — {r.why}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-wide text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#FDD000]" />
              Add Injury
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                Body Area / Muscle Group
              </label>
              <Select value={bodyArea} onValueChange={setBodyArea}>
                <SelectTrigger
                  className="bg-black border-zinc-600 text-white w-full"
                  data-testid="injury-body-area-select"
                >
                  <SelectValue placeholder={bodyAreasLoading ? "Loading areas..." : "Select area"} />
                </SelectTrigger>
                <SelectContent>
                  {sortedBodyAreas.map((area) => (
                    <SelectItem key={area} value={area}>
                      {area}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                Type
              </label>
              <RadioGroup
                value={injuryType}
                onValueChange={(v) => {
                  setInjuryType(v);
                  // Auto-fill recovery start date with today the first time
                  // the user picks Recovery — they can adjust it.
                  if (v === "recovery" && !startedAt) setStartedAt(todayStr());
                }}
                className="grid grid-cols-1 gap-2"
              >
                {(
                  [
                    { value: "currently_injured", label: "Currently Injured" },
                    { value: "long_term_limitation", label: "Long Term Limitation" },
                    { value: "recovery", label: "Recovery" },
                  ] as const
                ).map((option) => (
                  <label
                    key={option.value}
                    htmlFor={`injury-type-${option.value}`}
                    className={`flex items-center gap-3 px-3 py-2 rounded-sm text-sm font-semibold border-2 cursor-pointer transition-colors ${
                      injuryType === option.value
                        ? "bg-[#FDD000] border-[#FDD000] text-black"
                        : "bg-transparent border-zinc-600 text-zinc-300 hover:border-zinc-400"
                    }`}
                  >
                    <RadioGroupItem
                      value={option.value}
                      id={`injury-type-${option.value}`}
                      data-testid={`injury-type-${option.value}`}
                      className="border-current text-current"
                    />
                    {option.label}
                  </label>
                ))}
              </RadioGroup>
            </div>

            {/* Recovery start date — drives the per-week reintroduction
               schedule defined in shared/injuryFilter.ts. Only shown when
               the user picks Recovery. */}
            {injuryType === "recovery" && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                  Recovery started on
                </label>
                <Input
                  type="date"
                  value={startedAt}
                  max={todayStr()}
                  onChange={(e) => setStartedAt(e.target.value)}
                  className="bg-black border-zinc-600 text-white w-full"
                  data-testid="injury-started-at-input"
                />
                <p className="text-[10px] text-zinc-500">
                  Used to unlock exercises week-by-week as you heal.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                Notes (optional)
              </label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Brief description of the injury..."
                className="bg-black border-zinc-600 text-white placeholder:text-zinc-500 resize-none h-20"
                data-testid="injury-note-textarea"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              className="text-zinc-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!bodyArea || !injuryType || addMutation.isPending}
              className="bg-[#FDD000] text-black font-black hover:bg-[#FDD000]/90"
              data-testid="save-injury-button"
            >
              {addMutation.isPending ? "Saving..." : "Save Injury"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
