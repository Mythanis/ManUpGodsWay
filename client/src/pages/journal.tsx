import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, PenLine, Calendar } from "lucide-react";
import { BackButton } from "@/components/BackButton";

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

export default function Journal() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  const { data: entries = [], isLoading } = useQuery<JournalEntry[]>({
    queryKey: ["/api/journal"],
    enabled: !!user,
  });

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0a" }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FCD000]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: "#0a0a0a" }}>
      <div className="max-w-md mx-auto px-4 pt-4">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <BackButton />
          <div className="flex-1">
            <h1 className="text-2xl font-black text-white uppercase tracking-tight">
              My Journal
            </h1>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-bold">
              All Study Notes &amp; Entries
            </p>
          </div>
          <div className="bg-[#FCD000] rounded-sm border-2 border-black p-2">
            <PenLine className="w-5 h-5 text-black" />
          </div>
        </div>

        {/* Count badge */}
        {entries.length > 0 && (
          <div className="mb-4">
            <Badge className="bg-[#FCD000] text-black font-black uppercase text-xs border-2 border-black rounded-sm px-3 py-1">
              {entries.length} {entries.length === 1 ? "Entry" : "Entries"}
            </Badge>
          </div>
        )}

        {/* Empty state */}
        {entries.length === 0 && (
          <Card className="border-2 border-gray-700 rounded-sm" style={{ background: "#111" }}>
            <CardContent className="p-8 flex flex-col items-center text-center gap-3">
              <div className="bg-gray-800 rounded-sm border-2 border-gray-600 p-4">
                <PenLine className="w-8 h-8 text-gray-500" />
              </div>
              <p className="text-white font-black uppercase tracking-wide">No Journal Entries Yet</p>
              <p className="text-gray-400 text-sm">
                Save notes on any lesson or add entries from within a study — they'll all appear here.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Journal entries */}
        <div className="space-y-4">
          {entries.map((entry) => (
            <Card
              key={entry.id}
              className="border-2 border-black rounded-sm shadow-[3px_3px_0px_0px_rgba(252,208,0,0.4)] overflow-hidden"
              style={{ background: "#111" }}
            >
              {/* Entry header */}
              <div className={`px-4 py-3 border-b-2 border-black ${entry.type === "lesson_note" ? "bg-[#FCD000]" : "bg-white/10"}`}>
                <div
                  className="flex items-start gap-2 cursor-pointer"
                  onClick={() => entry.studyId && setLocation(`/studies/${entry.studyId}`)}
                >
                  {entry.type === "lesson_note" ? (
                    <BookOpen className="w-4 h-4 text-black shrink-0 mt-0.5" />
                  ) : (
                    <PenLine className="w-4 h-4 text-[#FCD000] shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`font-black uppercase tracking-tight text-sm leading-tight truncate ${entry.type === "lesson_note" ? "text-black" : "text-white"}`}>
                      {entry.studyTitle || "Study"}
                    </p>
                    {entry.type === "lesson_note" && entry.dayNumber && (
                      <p className="text-xs text-black/70 font-bold mt-0.5">
                        Day {entry.dayNumber}{entry.lessonTitle ? `: ${entry.lessonTitle}` : ""}
                      </p>
                    )}
                    {entry.type === "journal_entry" && (
                      <p className="text-xs text-gray-400 font-bold mt-0.5">Journal Entry</p>
                    )}
                  </div>
                  {entry.type === "lesson_note" && (
                    <Badge className="bg-black text-[#FCD000] font-bold text-xs border border-black rounded-sm shrink-0">
                      Note
                    </Badge>
                  )}
                  {entry.type === "journal_entry" && (
                    <Badge className="bg-[#FCD000]/20 text-[#FCD000] font-bold text-xs border border-[#FCD000]/40 rounded-sm shrink-0">
                      Entry
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-2">
                  <Calendar className={`w-3 h-3 ${entry.type === "lesson_note" ? "text-black/60" : "text-gray-500"}`} />
                  <span className={`text-xs font-bold ${entry.type === "lesson_note" ? "text-black/60" : "text-gray-500"}`}>
                    {entry.createdAt
                      ? new Date(entry.createdAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          timeZone: "UTC",
                        })
                      : "Date unknown"}
                  </span>
                </div>
              </div>

              {/* Note content */}
              <CardContent className="p-4">
                <p className="text-gray-200 text-base leading-relaxed whitespace-pre-wrap">
                  {entry.content}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
