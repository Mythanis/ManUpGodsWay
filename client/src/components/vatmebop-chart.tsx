import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

type DisciplineKey = "v" | "a" | "t" | "m" | "e" | "b" | "o" | "p";

const DISCIPLINES: { key: DisciplineKey; letter: string; name: string; scripture: string }[] = [
  { key: "v", letter: "V", name: "Viewing", scripture: "Stayed away from inappropriate content (2 Tim 2:22)" },
  { key: "a", letter: "A", name: "Action", scripture: "Did not act on temptation — sex, envy, greed, gossip" },
  { key: "t", letter: "T", name: "Thoughts", scripture: "Controlled thoughts; turned head from temptation (Matt 5:28)" },
  { key: "m", letter: "M", name: "Memorization", scripture: "Memorized or practiced a scripture this week (Ps 119:11)" },
  { key: "e", letter: "E", name: "Exercise", scripture: "Did physical exercise (1 Cor 9:24-27)" },
  { key: "b", letter: "B", name: "Bible", scripture: "Had a daily devotion (Acts 18:5)" },
  { key: "o", letter: "O", name: "Outside Reading", scripture: "Read something beyond the Bible" },
  { key: "p", letter: "P", name: "Prayer", scripture: "Prayed daily (Acts 6:4)" },
];

const WEEKS = Array.from({ length: 52 }, (_, i) => i + 1);

function getCurrentWeek(): number {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000);
  return Math.min(Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7), 52);
}

function cellBorderClass(state: number): string {
  if (state === 2) return "border-green-400";
  if (state === 1) return "border-amber-300";
  return "border-zinc-700";
}

// Inline style for the cell background — state 1 is half-filled (bottom half amber, top half dark)
function cellBg(state: number): { background: string } {
  if (state === 2) return { background: "#22c55e" }; // green-500
  if (state === 1) return { background: "linear-gradient(to top, #fbbf24 50%, #27272a 50%)" }; // half amber
  return { background: "#27272a" }; // zinc-800
}

interface WeekRow {
  week: number;
  v: number; a: number; t: number; m: number; e: number; b: number; o: number; p: number;
}

export function VatmebopChart() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [activeHeader, setActiveHeader] = useState<DisciplineKey | null>(null);
  const currentWeek = getCurrentWeek();
  const currentWeekRef = useRef<HTMLTableRowElement | null>(null);
  const queryClient = useQueryClient();

  const { data: rows = [], isLoading } = useQuery<WeekRow[]>({
    queryKey: ["/api/vatmebop", year],
    queryFn: () => apiRequest("GET", `/api/vatmebop?year=${year}`),
  });

  // Build a map: week → row data
  const weekMap = new Map<number, WeekRow>();
  for (const row of rows) {
    weekMap.set(row.week, row);
  }

  const getState = useCallback(
    (week: number, key: DisciplineKey): number => weekMap.get(week)?.[key] ?? 0,
    [weekMap],
  );

  const mutation = useMutation({
    mutationFn: (payload: { year: number; week: number; disciplines: Partial<Record<DisciplineKey, number>> }) =>
      apiRequest("POST", "/api/vatmebop", payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ["/api/vatmebop", year] });
      const prev = queryClient.getQueryData<WeekRow[]>(["/api/vatmebop", year]);
      queryClient.setQueryData<WeekRow[]>(["/api/vatmebop", year], (old = []) => {
        const existing = old.find((r) => r.week === payload.week);
        if (existing) {
          return old.map((r) =>
            r.week === payload.week ? { ...r, ...payload.disciplines } : r,
          );
        }
        return [
          ...old,
          { week: payload.week, year: payload.year, id: 0, userId: "", v: 0, a: 0, t: 0, m: 0, e: 0, b: 0, o: 0, p: 0, ...payload.disciplines } as WeekRow,
        ];
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["/api/vatmebop", year], ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vatmebop", year] });
    },
  });

  const handleCellClick = useCallback(
    (week: number, key: DisciplineKey) => {
      const current = getState(week, key);
      const next = (current + 1) % 3;
      mutation.mutate({ year, week, disciplines: { [key]: next } });
    },
    [getState, year, mutation],
  );

  // Auto-scroll current week into view on mount / year change
  useEffect(() => {
    if (year === new Date().getFullYear() && currentWeekRef.current) {
      currentWeekRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [year, isLoading]);

  const activeDisc = activeHeader ? DISCIPLINES.find((d) => d.key === activeHeader) : null;

  return (
    <div className="px-6 mt-6 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-1 h-6 bg-[#FCD000] rounded-full flex-shrink-0" />
        <h2 className="text-lg font-black text-white tracking-tight uppercase">
          My Accountability
        </h2>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      {/* Year selector — current year ±1 */}
      <div className="flex items-center justify-center gap-3 mb-4">
        <button
          onClick={() => setYear((y) => y - 1)}
          disabled={year <= new Date().getFullYear() - 1}
          className="w-8 h-8 flex items-center justify-center rounded-sm bg-zinc-800 border border-zinc-700 text-white/70 hover:text-white hover:bg-zinc-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Previous year"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-black text-white tracking-wide">{year}</span>
        <button
          onClick={() => setYear((y) => y + 1)}
          disabled={year >= new Date().getFullYear() + 1}
          className="w-8 h-8 flex items-center justify-center rounded-sm bg-zinc-800 border border-zinc-700 text-white/70 hover:text-white hover:bg-zinc-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Next year"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Discipline header tooltip / sheet */}
      {activeDisc && (
        <div className="mb-3 bg-zinc-900 border-2 border-ministry-gold-exact rounded-sm p-3 relative">
          <button
            onClick={() => setActiveHeader(null)}
            className="absolute top-2 right-2 text-white/40 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
          <p className="font-black text-ministry-gold-exact text-base uppercase tracking-wide">
            {activeDisc.letter} — {activeDisc.name}
          </p>
          <p className="text-sm text-white/70 mt-1">{activeDisc.scripture}</p>
        </div>
      )}

      {/* Grid card */}
      <div className="border-2 border-ministry-gold-exact rounded-sm overflow-hidden shadow-[4px_4px_0px_0px_rgba(252,208,0,1)] bg-zinc-900">
        {/* Scrollable container */}
        <div className="overflow-y-auto max-h-[480px]">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-zinc-950">
              <tr>
                {/* Week # column header */}
                <th className="w-10 py-2 text-center text-xs font-black text-zinc-500 uppercase tracking-wide border-b border-zinc-800">
                  Wk
                </th>
                {/* Discipline column headers — tappable */}
                {DISCIPLINES.map(({ key, letter }) => (
                  <th key={key} className="py-2 text-center border-b border-zinc-800">
                    <button
                      onClick={() => setActiveHeader(activeHeader === key ? null : key)}
                      className={`w-full h-7 flex items-center justify-center text-xs font-black uppercase rounded-sm transition-colors mx-auto
                        ${activeHeader === key
                          ? "bg-ministry-gold-exact text-black"
                          : "text-ministry-gold-exact hover:bg-zinc-800"}`}
                    >
                      {letter}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WEEKS.map((week) => {
                const isCurrentWeek = week === currentWeek && year === new Date().getFullYear();
                return (
                  <tr
                    key={week}
                    ref={isCurrentWeek ? currentWeekRef : null}
                    className={`border-b border-zinc-800/50 ${isCurrentWeek ? "bg-yellow-950/40" : ""}`}
                  >
                    {/* Week number */}
                    <td className={`text-center text-xs font-bold py-1 w-10 ${isCurrentWeek ? "text-ministry-gold-exact font-black" : "text-zinc-500"}`}>
                      {week}
                    </td>
                    {/* 8 discipline cells */}
                    {DISCIPLINES.map(({ key }) => {
                      const state = getState(week, key);
                      return (
                        <td key={key} className="text-center py-1">
                          <button
                            onClick={() => handleCellClick(week, key)}
                            style={cellBg(state)}
                            className={`w-7 h-7 rounded-sm border transition-all active:scale-90 mx-auto block ${cellBorderClass(state)} ${
                              isCurrentWeek ? "ring-1 ring-ministry-gold-exact/50" : ""
                            }`}
                            title={`Week ${week} – ${DISCIPLINES.find(d => d.key === key)?.name} (${state === 0 ? "blank" : state === 1 ? "repented" : "accomplished"})`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 py-3 border-t border-zinc-800 bg-zinc-950">
          <span className="flex items-center gap-1.5 text-xs font-bold text-white/50 uppercase tracking-wide">
            <span className="w-4 h-4 rounded-sm inline-block border border-zinc-700" style={{ background: "#27272a" }} />
            Blank
          </span>
          <span className="flex items-center gap-1.5 text-xs font-bold text-white/50 uppercase tracking-wide">
            <span className="w-4 h-4 rounded-sm inline-block border border-amber-300" style={{ background: "linear-gradient(to top, #fbbf24 50%, #27272a 50%)" }} />
            Repented
          </span>
          <span className="flex items-center gap-1.5 text-xs font-bold text-white/50 uppercase tracking-wide">
            <span className="w-4 h-4 rounded-sm inline-block border border-green-400" style={{ background: "#22c55e" }} />
            Accomplished
          </span>
        </div>
      </div>

      <p className="text-xs text-white/30 mt-2 font-bold text-center uppercase tracking-wide">
        Tap a column letter for details · Tap a cell to cycle states
      </p>
    </div>
  );
}
