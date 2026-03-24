import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "wouter";
import { CheckCircle2, Circle, BookOpen, ChevronLeft, Flame, Trophy, Calendar } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

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

export default function BibleReadingPlanPage() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "remaining" | "completed">("all");

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

  const filteredDays = useMemo(() => {
    if (filter === "remaining") return days.filter(d => !completedSet.has(d.dayNumber));
    if (filter === "completed") return days.filter(d => completedSet.has(d.dayNumber));
    return days;
  }, [days, completedSet, filter]);

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

        {/* Progress bar */}
        <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-[#FCD000] transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Today's reading CTA */}
      {nextDay && isAuthenticated && (
        <div className="px-6 mb-5">
          <div
            className="rounded-sm border-2 border-[#FCD000]/40 p-4 flex items-center gap-4"
            style={{ background: "#0f0f0f" }}
          >
            <Calendar className="w-8 h-8 text-[#FCD000] flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FCD000] mb-0.5">Up Next — Day {nextDay}</p>
              <p className="text-white text-xs font-bold leading-tight truncate">
                {days.find(d => d.dayNumber === nextDay)?.passages ?? ""}
              </p>
            </div>
            <Button
              size="sm"
              className="bg-[#FCD000] hover:bg-[#e6bc00] text-black font-black text-xs uppercase tracking-wide rounded-sm flex-shrink-0"
              onClick={() => completeMutation.mutate(nextDay)}
              disabled={completeMutation.isPending}
            >
              {completeMutation.isPending ? "…" : "Done"}
            </Button>
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
                <button
                  onClick={() => !done && isAuthenticated && completeMutation.mutate(day.dayNumber)}
                  disabled={done || !isAuthenticated || completeMutation.isPending}
                  className="flex-shrink-0 transition-transform active:scale-90"
                  aria-label={done ? "Completed" : "Mark complete"}
                >
                  {done ? (
                    <CheckCircle2 className="w-6 h-6 text-[#FCD000]" />
                  ) : (
                    <Circle className={`w-6 h-6 ${isNext ? "text-[#FCD000]/70" : "text-white/20"}`} />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <span className={`text-[10px] font-black uppercase tracking-wide ${done ? "text-[#FCD000]" : isNext ? "text-[#FCD000]/60" : "text-white/30"}`}>
                    Day {day.dayNumber}
                  </span>
                  <p className={`text-sm font-bold leading-tight truncate ${done ? "text-white/50 line-through" : "text-white"}`}>
                    {day.passages}
                  </p>
                </div>
                {done && (
                  <CheckCircle2 className="w-4 h-4 text-[#FCD000]/50 flex-shrink-0" />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
