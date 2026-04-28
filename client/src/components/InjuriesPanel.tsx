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
import { Textarea } from "@/components/ui/textarea";
import { X, Plus, AlertTriangle } from "lucide-react";
import type { UserInjury } from "@shared/schema";

const BODY_AREAS = [
  "Abs",
  "Adductors",
  "Back",
  "Biceps",
  "Calves",
  "Chest",
  "Core",
  "Forearms",
  "Full Body",
  "Glutes",
  "Hamstrings",
  "Hip Flexors",
  "IT Band",
  "Knees",
  "Lats",
  "Legs",
  "Lower Back",
  "Neck",
  "Obliques",
  "Quads",
  "Shoulders",
  "Triceps",
  "Upper Back",
];

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

export default function InjuriesPanel() {
  const [hasInjuries, setHasInjuries] = useState<boolean | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bodyArea, setBodyArea] = useState("");
  const [injuryType, setInjuryType] = useState<string>("");
  const [note, setNote] = useState("");

  const { data: injuries = [], isLoading } = useQuery<UserInjury[]>({
    queryKey: ["/api/user/injuries"],
  });

  const noInjuries = !isLoading && injuries.length === 0;
  const showYes = hasInjuries === true || injuries.length > 0;

  const addMutation = useMutation({
    mutationFn: async (data: { bodyArea: string; injuryType: string; note?: string }) =>
      apiRequest("POST", "/api/user/injuries", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/injuries"] });
      setDialogOpen(false);
      setBodyArea("");
      setInjuryType("");
      setNote("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/user/injuries/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/injuries"] });
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => apiRequest("DELETE", "/api/user/injuries/clear"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/injuries"] });
      setHasInjuries(false);
    },
  });

  function openAddDialog() {
    setBodyArea("");
    setInjuryType("");
    setNote("");
    setDialogOpen(true);
  }

  function handleSave() {
    if (!bodyArea || !injuryType) return;
    addMutation.mutate({ bodyArea, injuryType, note: note.trim() || undefined });
  }

  function handleYes() {
    setHasInjuries(true);
    openAddDialog();
  }

  function handleNo() {
    setHasInjuries(false);
  }

  const effectiveAnswer = injuries.length > 0 ? true : hasInjuries;

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

      {isLoading && (
        <div className="flex items-center gap-2 py-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#FDD000]" />
          <span className="text-xs text-zinc-400">Loading...</span>
        </div>
      )}

      {!isLoading && injuries.length > 0 && (
        <div className="space-y-2">
          {injuries.map((injury) => (
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
          ))}

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
        </div>
      )}

      {!isLoading && injuries.length === 0 && effectiveAnswer === true && (
        <p className="text-xs text-zinc-500 italic">No injuries recorded yet — add one below.</p>
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
                  <SelectValue placeholder="Select area" />
                </SelectTrigger>
                <SelectContent>
                  {BODY_AREAS.map((area) => (
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
              <div className="grid grid-cols-1 gap-2">
                {(
                  [
                    { value: "currently_injured", label: "Currently Injured" },
                    { value: "long_term_limitation", label: "Long Term Limitation" },
                    { value: "recovery", label: "Recovery" },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setInjuryType(option.value)}
                    className={`px-3 py-2 rounded-sm text-sm font-semibold border-2 text-left transition-colors ${
                      injuryType === option.value
                        ? "bg-[#FDD000] border-[#FDD000] text-black"
                        : "bg-transparent border-zinc-600 text-zinc-300 hover:border-zinc-400"
                    }`}
                    data-testid={`injury-type-${option.value}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

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
