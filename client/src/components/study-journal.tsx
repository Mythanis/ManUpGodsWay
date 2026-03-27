import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { PenLine, Calendar, BookOpen, Trash2, Plus, Save, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { useLocation } from "wouter";

interface JournalEntry {
  id: string;
  content: string;
  createdAt: string;
  dayNumber?: number;
  lessonTitle?: string;
  studyId?: string;
  studyTitle?: string;
  type: "lesson_note" | "journal_entry";
}

interface StudyJournalProps {
  studyId: string;
  studyTitle: string;
}

export function StudyJournal({ studyId, studyTitle }: StudyJournalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [newEntry, setNewEntry] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [expanded, setExpanded] = useState(true);

  // Fetch ALL notes from ALL studies — the full journal collection
  const { data: allEntries = [], isLoading } = useQuery<JournalEntry[]>({
    queryKey: ["/api/journal"],
  });

  const addEntryMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/studies/${studyId}/journal-entries`, { content: newEntry }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal"] });
      setNewEntry("");
      setShowAddForm(false);
      toast({ title: "Added to Journal", description: "Your journal entry has been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save journal entry.", variant: "destructive" });
    },
  });

  const deleteEntryMutation = useMutation({
    mutationFn: (entryId: string) => apiRequest("DELETE", `/api/journal-entries/${entryId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal"] });
      toast({ title: "Deleted", description: "Journal entry removed." });
    },
  });

  const formatDate = (dateStr: string) =>
    dateStr
      ? new Date(dateStr).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone: "UTC",
        })
      : "Unknown date";

  return (
    <div
      className="border-2 border-[#FCD000] rounded-sm shadow-[4px_4px_0px_0px_rgba(252,208,0,0.4)]"
      style={{ background: "#111" }}
    >
      {/* Header */}
      <button
        className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="bg-[#FCD000] rounded-sm border-2 border-black p-2">
            <PenLine className="w-4 h-4 text-black" />
          </div>
          <div className="text-left">
            <p className="font-black text-white uppercase tracking-tight text-sm">My Journal</p>
            <p className="text-xs text-gray-400 font-bold">
              All notes &amp; entries — {allEntries.length}{" "}
              {allEntries.length === 1 ? "entry" : "entries"} total
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-[#FCD000]" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[#FCD000]" />
        )}
      </button>

      {expanded && (
        <div className="border-t-2 border-[#FCD000]/40">
          {/* Add Entry */}
          <div className="p-4 border-b border-white/10">
            {showAddForm ? (
              <div className="space-y-3">
                <Textarea
                  placeholder="Write a journal entry..."
                  value={newEntry}
                  onChange={(e) => setNewEntry(e.target.value)}
                  rows={4}
                  className="resize-y bg-white text-black border-2 border-black rounded-sm font-medium text-base"
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => addEntryMutation.mutate()}
                    disabled={addEntryMutation.isPending || !newEntry.trim()}
                    className="bg-[#FCD000] hover:bg-yellow-400 text-black font-black uppercase tracking-wide border-2 border-black rounded-sm"
                  >
                    {addEntryMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" /> Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-1" /> Save Entry
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowAddForm(false);
                      setNewEntry("");
                    }}
                    className="text-gray-400 hover:text-white font-bold"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={() => setShowAddForm(true)}
                className="bg-black hover:bg-gray-900 text-[#FCD000] font-black uppercase tracking-wide border-2 border-[#FCD000] rounded-sm w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Journal Entry
              </Button>
            )}
          </div>

          {/* All entries */}
          <div className="p-4 space-y-4">
            {isLoading && (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-[#FCD000]" />
              </div>
            )}

            {!isLoading && allEntries.length === 0 && (
              <div className="text-center py-6">
                <PenLine className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-400 text-sm font-bold uppercase tracking-wide">
                  No journal entries yet
                </p>
                <p className="text-gray-600 text-xs mt-1">
                  Save notes on any lesson or add an entry above — they'll appear here.
                </p>
              </div>
            )}

            {!isLoading &&
              allEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="border-2 border-white/10 rounded-sm overflow-hidden"
                >
                  {/* Entry header */}
                  <div
                    className={`px-3 py-2 flex items-start justify-between gap-2 ${
                      entry.type === "lesson_note"
                        ? "bg-[#FCD000]/10 border-b border-[#FCD000]/20"
                        : "bg-white/5 border-b border-white/10"
                    }`}
                  >
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => entry.studyId && setLocation(`/studies/${entry.studyId}`)}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        {entry.type === "lesson_note" ? (
                          <BookOpen className="w-3 h-3 text-[#FCD000] shrink-0" />
                        ) : (
                          <PenLine className="w-3 h-3 text-gray-400 shrink-0" />
                        )}
                        <span
                          className={`font-black text-xs uppercase tracking-wide truncate ${
                            entry.type === "lesson_note" ? "text-[#FCD000]" : "text-gray-300"
                          }`}
                        >
                          {entry.studyTitle || studyTitle}
                        </span>
                        {entry.type === "lesson_note" && entry.dayNumber != null && (
                          <Badge className="bg-[#FCD000]/20 text-[#FCD000] border border-[#FCD000]/40 text-xs font-bold px-1.5 py-0 rounded-sm shrink-0">
                            Day {entry.dayNumber}
                          </Badge>
                        )}
                        {entry.type === "journal_entry" && (
                          <Badge className="bg-white/10 text-gray-300 border border-white/20 text-xs font-bold px-1.5 py-0 rounded-sm shrink-0">
                            Entry
                          </Badge>
                        )}
                      </div>
                      {entry.type === "lesson_note" && entry.lessonTitle && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{entry.lessonTitle}</p>
                      )}
                      <div className="flex items-center gap-1 mt-1">
                        <Calendar className="w-3 h-3 text-gray-500" />
                        <span className="text-xs text-gray-500 font-medium">
                          {formatDate(entry.createdAt)}
                        </span>
                      </div>
                    </div>
                    {entry.type === "journal_entry" && (
                      <button
                        onClick={() => deleteEntryMutation.mutate(entry.id)}
                        disabled={deleteEntryMutation.isPending}
                        className="text-gray-500 hover:text-red-400 transition-colors p-1 shrink-0 mt-0.5"
                        title="Delete entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-3">
                    <p className="text-gray-200 text-base leading-relaxed whitespace-pre-wrap">
                      {entry.content}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
