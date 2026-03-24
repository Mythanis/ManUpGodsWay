import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "wouter";
import {
  CheckCircle2, Circle, BookOpen, ChevronLeft, Flame, Trophy, Calendar, X, Loader2,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

// ─── Bible book name → API abbreviation ───────────────────────────────────────
const BOOK_ABBREV: Record<string, string> = {
  "Genesis": "GEN", "Exodus": "EXO", "Leviticus": "LEV", "Numbers": "NUM",
  "Deuteronomy": "DEU", "Joshua": "JOS", "Judges": "JDG", "Ruth": "RUT",
  "1 Samuel": "1SA", "2 Samuel": "2SA", "1 Kings": "1KI", "2 Kings": "2KI",
  "1 Chronicles": "1CH", "2 Chronicles": "2CH", "Ezra": "EZR", "Nehemiah": "NEH",
  "Esther": "EST", "Job": "JOB", "Psalms": "PSA", "Proverbs": "PRO",
  "Ecclesiastes": "ECC", "Song of Solomon": "SNG", "Isaiah": "ISA",
  "Jeremiah": "JER", "Lamentations": "LAM", "Ezekiel": "EZK", "Daniel": "DAN",
  "Hosea": "HOS", "Joel": "JOL", "Amos": "AMO", "Obadiah": "OBA",
  "Jonah": "JON", "Micah": "MIC", "Nahum": "NAM", "Habakkuk": "HAB",
  "Zephaniah": "ZEP", "Haggai": "HAG", "Zechariah": "ZEC", "Malachi": "MAL",
  "Matthew": "MAT", "Mark": "MRK", "Luke": "LUK", "John": "JHN",
  "Acts": "ACT", "Romans": "ROM", "1 Corinthians": "1CO", "2 Corinthians": "2CO",
  "Galatians": "GAL", "Ephesians": "EPH", "Philippians": "PHP", "Colossians": "COL",
  "1 Thessalonians": "1TH", "2 Thessalonians": "2TH", "1 Timothy": "1TI",
  "2 Timothy": "2TI", "Titus": "TIT", "Philemon": "PHM", "Hebrews": "HEB",
  "James": "JAS", "1 Peter": "1PE", "2 Peter": "2PE", "1 John": "1JN",
  "2 John": "2JN", "3 John": "3JN", "Jude": "JUD", "Revelation": "REV",
};

// Parse "Genesis 1–3; Exodus 1" → ["GEN.1","GEN.2","GEN.3","EXO.1"]
function parsePassages(passagesStr: string): string[] {
  if (!passagesStr || passagesStr === "Review & Reflection") return [];
  const ids: string[] = [];
  const segments = passagesStr.split(";").map(s => s.trim());
  for (const seg of segments) {
    const match = seg.match(/^(.*?)\s+(\d+)(?:[–\-](\d+))?$/);
    if (!match) continue;
    const bookName = match[1].trim();
    const start = parseInt(match[2], 10);
    const end = match[3] ? parseInt(match[3], 10) : start;
    const abbrev = BOOK_ABBREV[bookName];
    if (!abbrev) continue;
    for (let ch = start; ch <= end; ch++) {
      ids.push(`${abbrev}.${ch}`);
    }
  }
  return ids;
}

function parseVerses(content: string): { verse: number; text: string }[] {
  if (!content) return [];
  const lines = content.split(/\[(\d+)\]/).filter(Boolean);
  const verses: { verse: number; text: string }[] = [];
  for (let i = 0; i < lines.length; i += 2) {
    const verseNum = parseInt(lines[i]);
    const text = lines[i + 1]?.trim() || "";
    if (!isNaN(verseNum) && text) verses.push({ verse: verseNum, text });
  }
  if (verses.length === 0 && content) return [{ verse: 1, text: content }];
  return verses;
}

// ─── Passage reader sheet ─────────────────────────────────────────────────────
interface ChapterContent {
  id: string;
  reference: string;
  content: string;
  copyright?: string;
}

interface PassageSheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  passagesStr: string;
  dayLabel: string;
  versionId: string;
}

function PassageSheet({ open, onOpenChange, passagesStr, dayLabel, versionId }: PassageSheetProps) {
  const chapterIds = useMemo(() => parsePassages(passagesStr), [passagesStr]);
  const isSpecial = passagesStr === "Review & Reflection" || chapterIds.length === 0;

  const { data: chapters, isLoading, error } = useQuery<ChapterContent[]>({
    queryKey: ["/api/bible/passages", versionId, passagesStr],
    queryFn: async () => {
      const results = await Promise.all(
        chapterIds.map(chId =>
          fetch(`/api/bible/${versionId}/chapters/${chId}`)
            .then(r => { if (!r.ok) throw new Error(`Failed: ${chId}`); return r.json(); })
        )
      );
      return results;
    },
    enabled: open && !!versionId && !isSpecial && chapterIds.length > 0,
    staleTime: 1000 * 60 * 10,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[90svh] p-0 border-t-2 border-[#FCD000]/40 rounded-t-lg flex flex-col"
        style={{ background: "#0a0a0a" }}
      >
        {/* Sheet header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/10 flex-shrink-0">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FCD000]">{dayLabel}</p>
            <p className="text-white font-bold text-sm mt-0.5 leading-tight">{passagesStr}</p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="text-white/50 hover:text-white transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-8">
          {isSpecial && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <BookOpen className="w-10 h-10 text-[#FCD000]/50 mb-4" />
              <p className="text-white/60 text-sm font-semibold">Review & Reflection</p>
              <p className="text-white/30 text-xs mt-2">
                Use this day to catch up, re-read favourite passages, or journal what you've learned.
              </p>
            </div>
          )}

          {!isSpecial && isLoading && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-[#FCD000] animate-spin mb-3" />
              <p className="text-white/50 text-sm">Loading scripture…</p>
            </div>
          )}

          {!isSpecial && error && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-red-400 text-sm font-semibold">Could not load passage</p>
              <p className="text-white/30 text-xs mt-2">Check your connection and try again.</p>
            </div>
          )}

          {!isSpecial && chapters && chapters.map((chapter) => {
            const verses = parseVerses(chapter.content);
            return (
              <div key={chapter.id}>
                <h3 className="text-[#FCD000] font-black text-xs uppercase tracking-[0.2em] mb-4 pb-2 border-b border-[#FCD000]/20">
                  {chapter.reference}
                </h3>
                <div className="space-y-2">
                  {verses.map(({ verse, text }) => (
                    <p key={verse} className="text-white/90 text-[17px] leading-relaxed">
                      <sup className="text-[#FCD000] font-bold text-[11px] mr-1 align-super">{verse}</sup>
                      {text}
                    </p>
                  ))}
                </div>
              </div>
            );
          })}

          {!isSpecial && chapters && chapters[0]?.copyright && (
            <p className="text-white/20 text-[9px] text-center pt-4 border-t border-white/5">
              {chapters[0].copyright}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Bible version hook ────────────────────────────────────────────────────────
function useBibleVersionId() {
  const cached = typeof window !== "undefined" ? localStorage.getItem("preferredBibleVersionId") : null;
  const { data: versions } = useQuery<{ id: string; abbreviation: string; name: string }[]>({
    queryKey: ["/api/bible/versions"],
    enabled: !cached,
    staleTime: Infinity,
  });
  if (cached) return cached;
  if (!versions) return "";
  const v =
    versions.find(v => v.abbreviation?.toLowerCase() === "nasb1995") ||
    versions.find(v => v.name?.toLowerCase().includes("new american standard 1995")) ||
    versions.find(v => v.abbreviation?.toLowerCase() === "nasb") ||
    versions[0];
  if (v) {
    localStorage.setItem("preferredBibleVersionId", v.id);
    return v.id;
  }
  return "";
}

// ─── Types ─────────────────────────────────────────────────────────────────────
interface PlanDay {
  id: string;
  planId: string;
  dayNumber: number;
  title: string;
  passages: string;
}

interface Progress {
  id: string;
  userId: string;
  planId: string;
  dayNumber: number;
  completedAt: string;
}

interface Plan {
  id: string;
  name: string;
  description: string;
  planType: string;
  totalDays: number;
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function BibleReadingPlanPage() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "remaining" | "completed">("all");
  const [readerDay, setReaderDay] = useState<PlanDay | null>(null);
  const versionId = useBibleVersionId();

  const { data: plans = [] } = useQuery<Plan[]>({ queryKey: ["/api/bible-plans"] });
  const plan = plans.find(p => p.id === id);

  const { data: days = [], isLoading: daysLoading } = useQuery<PlanDay[]>({
    queryKey: ["/api/bible-plans", id, "days"],
    queryFn: () => fetch(`/api/bible-plans/${id}/days`).then(r => r.json()),
    enabled: !!id,
  });

  const { data: progress = [] } = useQuery<Progress[]>({
    queryKey: ["/api/bible-plans", id, "progress"],
    queryFn: () => fetch(`/api/bible-plans/${id}/progress`).then(r => r.json()),
    enabled: !!id && isAuthenticated,
  });

  const completedSet = useMemo(
    () => new Set(progress.map(p => p.dayNumber)),
    [progress]
  );

  const completedCount = completedSet.size;
  const pct = days.length > 0 ? Math.round((completedCount / days.length) * 100) : 0;

  const streak = useMemo(() => {
    if (progress.length === 0) return 0;
    const sorted = [...progress].sort((a, b) => b.dayNumber - a.dayNumber);
    let s = 0;
    let check = sorted[0].dayNumber;
    const set = new Set(sorted.map(p => p.dayNumber));
    while (set.has(check)) { s++; check--; }
    return s;
  }, [progress]);

  const nextDay = useMemo(() => {
    for (let d = 1; d <= (plan?.totalDays ?? 365); d++) {
      if (!completedSet.has(d)) return d;
    }
    return null;
  }, [completedSet, plan]);

  const completeMutation = useMutation({
    mutationFn: (dayNumber: number) =>
      apiRequest("POST", `/api/bible-plans/${id}/days/${dayNumber}/complete`),
    onSuccess: (data: any, dayNumber) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bible-plans", id, "progress"] });
      const msg = data?.rationMessage ? ` ${data.rationMessage}` : "";
      toast({ title: `Day ${dayNumber} complete!${msg}`, description: "Keep going — every chapter counts." });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not mark day complete.", variant: "destructive" });
    },
  });

  const uncompleteMutation = useMutation({
    mutationFn: (dayNumber: number) =>
      apiRequest("DELETE", `/api/bible-plans/${id}/days/${dayNumber}/complete`),
    onSuccess: (_data: any, dayNumber) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bible-plans", id, "progress"] });
      toast({ title: `Day ${dayNumber} unchecked`, description: "Tap the circle again to re-complete it." });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not unmark day.", variant: "destructive" });
    },
  });

  const filteredDays = useMemo(() => {
    if (filter === "remaining") return days.filter(d => !completedSet.has(d.dayNumber));
    if (filter === "completed") return days.filter(d => completedSet.has(d.dayNumber));
    return days;
  }, [days, completedSet, filter]);

  const nextDayObj = nextDay ? days.find(d => d.dayNumber === nextDay) : null;

  if (!plan && !daysLoading) {
    return (
      <div className="pb-20 flex flex-col items-center justify-center min-h-[60vh] px-6">
        <BookOpen className="w-12 h-12 text-gray-600 mb-4" />
        <p className="text-white font-bold">Plan not found.</p>
        <Link href="/library"><Button className="mt-4" variant="outline">Back to Library</Button></Link>
      </div>
    );
  }

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="liquid-header text-white px-6 pt-12 pb-6">
        <Link href="/library">
          <button className="flex items-center gap-1 text-white/70 hover:text-white text-xs font-bold uppercase tracking-wide mb-3 transition-colors">
            <ChevronLeft className="w-4 h-4" />
            Library
          </button>
        </Link>
        <h1 className="text-2xl font-black uppercase tracking-tight leading-tight text-white mb-1">
          {plan?.name ?? "Loading…"}
        </h1>
        {plan && (
          <p className="text-ministry-gold-exact text-[10px] font-bold tracking-widest uppercase">
            {plan.planType === "chronological" ? "Chronological Order" : "Genesis — Revelation"}
          </p>
        )}
      </div>

      {/* Stats Bar */}
      <div className="px-6 mb-5">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Completed", value: completedCount, icon: <CheckCircle2 className="w-4 h-4 text-[#FCD000]" /> },
            { label: "Streak", value: streak, icon: <Flame className="w-4 h-4 text-orange-400" /> },
            { label: "Progress", value: `${pct}%`, icon: <Trophy className="w-4 h-4 text-[#FCD000]" /> },
          ].map(stat => (
            <div key={stat.label} className="rounded-sm border border-white/10 p-3 flex flex-col items-center gap-1" style={{ background: "#0f0f0f" }}>
              {stat.icon}
              <span className="text-white font-black text-lg leading-none">{stat.value}</span>
              <span className="text-white/40 text-[9px] font-bold uppercase tracking-wide">{stat.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-[#FCD000] transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Today's reading CTA */}
      {nextDayObj && isAuthenticated && (
        <div className="px-6 mb-5">
          <div
            className="rounded-sm border-2 border-[#FCD000]/40 p-4"
            style={{ background: "#0f0f0f" }}
          >
            <div className="flex items-start gap-3 mb-3">
              <Calendar className="w-7 h-7 text-[#FCD000] flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FCD000] mb-0.5">
                  Up Next — Day {nextDay}
                </p>
                <p className="text-white text-xs font-bold leading-tight">
                  {nextDayObj.passages}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 border-[#FCD000]/40 text-[#FCD000] hover:bg-[#FCD000]/10 font-black text-xs uppercase tracking-wide rounded-sm"
                onClick={() => setReaderDay(nextDayObj)}
              >
                <BookOpen className="w-3 h-3 mr-1.5" />
                Read
              </Button>
              <Button
                size="sm"
                className="flex-1 bg-[#FCD000] hover:bg-[#e6bc00] text-black font-black text-xs uppercase tracking-wide rounded-sm"
                onClick={() => completeMutation.mutate(nextDay!)}
                disabled={completeMutation.isPending}
              >
                {completeMutation.isPending ? "…" : "Done"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="px-6 mb-4 flex gap-2">
        {(["all", "remaining", "completed"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-sm border transition-all ${
              filter === f
                ? "bg-[#FCD000] text-black border-[#FCD000]"
                : "bg-transparent text-white/50 border-white/20 hover:border-white/40"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Day list */}
      <div className="px-6 space-y-2">
        {daysLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FCD000] mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Loading plan…</p>
          </div>
        ) : (
          filteredDays.map(day => {
            const done = completedSet.has(day.dayNumber);
            const isNext = day.dayNumber === nextDay;
            const canRead = day.passages !== "Review & Reflection";
            return (
              <div
                key={day.dayNumber}
                className={`flex items-center gap-3 rounded-sm border p-3 transition-all ${
                  done
                    ? "border-[#FCD000]/30 bg-[#FCD000]/5"
                    : isNext
                    ? "border-[#FCD000]/50 bg-[#0f0f0f]"
                    : "border-white/8 bg-[#0a0a0a]"
                }`}
              >
                {/* Complete / uncomplete circle */}
                <button
                  onClick={() => {
                    if (!isAuthenticated) return;
                    if (done) {
                      uncompleteMutation.mutate(day.dayNumber);
                    } else {
                      completeMutation.mutate(day.dayNumber);
                    }
                  }}
                  disabled={!isAuthenticated || completeMutation.isPending || uncompleteMutation.isPending}
                  className="flex-shrink-0 transition-transform active:scale-90"
                  aria-label={done ? "Tap to uncheck" : "Mark complete"}
                  title={done ? "Tap to uncheck" : "Mark complete"}
                >
                  {done ? (
                    <CheckCircle2 className="w-6 h-6 text-[#FCD000]" />
                  ) : (
                    <Circle className={`w-6 h-6 ${isNext ? "text-[#FCD000]/70" : "text-white/20"}`} />
                  )}
                </button>

                {/* Day label + passages */}
                <div className="flex-1 min-w-0">
                  <span className={`text-[10px] font-black uppercase tracking-wide ${done ? "text-[#FCD000]" : isNext ? "text-[#FCD000]/60" : "text-white/30"}`}>
                    Day {day.dayNumber}
                  </span>
                  <p className={`text-sm font-bold leading-tight truncate ${done ? "text-white/50 line-through" : "text-white"}`}>
                    {day.passages}
                  </p>
                </div>

                {/* Read button */}
                {canRead && (
                  <button
                    onClick={() => setReaderDay(day)}
                    className="flex-shrink-0 text-white/30 hover:text-[#FCD000] transition-colors p-1"
                    aria-label="Read passage"
                  >
                    <BookOpen className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Passage reader sheet */}
      <PassageSheet
        open={!!readerDay}
        onOpenChange={open => { if (!open) setReaderDay(null); }}
        passagesStr={readerDay?.passages ?? ""}
        dayLabel={readerDay ? `Day ${readerDay.dayNumber}` : ""}
        versionId={versionId}
      />
    </div>
  );
}
