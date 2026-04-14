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

function cellBg(state: number): { background: string } {
  if (state === 2) return { background: "#22c55e" };
  if (state === 1) return { background: "linear-gradient(to top, #fbbf24 50%, #27272a 50%)" };
  return { background: "#27272a" };
}

interface WeekRow {
  week: number;
  v: number; a: number; t: number; m: number; e: number; b: number; o: number; p: number;
}

// Header: py-2 (8px each side) + h-7 button (28px) + border-b (1px) ≈ 45px
// Each data row: py-1 (4px each side) + h-7 cell (28px) + border-b (1px) ≈ 37px
// Show header + 2 rows: 45 + 2×37 = 119px
const WINDOW_HEIGHT = 119;

// Row height for manual scroll positioning
const ROW_HEIGHT = 37;

export function VatmebopChart() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [activeHeader, setActiveHeader] = useState<DisciplineKey | null>(null);
  const currentWeek = getCurrentWeek();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();

  const { data: rows = [], isLoading } = useQuery<WeekRow[]>({
    queryKey: ["/api/vatmebop", year],
    queryFn: () => apiRequest("GET", `/api/vatmebop?year=${year}`),
  });

  const weekMap = new Map<number, WeekRow>();
  for (const row of rows) weekMap.set(row.week, row);

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
          return old.map((r) => r.week === payload.week ? { ...r, ...payload.disciplines } : r);
        }
        return [...old, { week: payload.week, v: 0, a: 0, t: 0, m: 0, e: 0, b: 0, o: 0, p: 0, ...payload.disciplines }];
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["/api/vatmebop", year], ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["/api/vatmebop", year] }),
  });

  const handleCellClick = useCallback(
    (week: number, key: DisciplineKey) => {
      mutation.mutate({ year, week, disciplines: { [key]: (getState(week, key) + 1) % 3 } });
    },
    [getState, year, mutation],
  );

  // Scroll so current week is centered in the 4-row viewport
  // The sticky header takes ~45px; data rows start after that inside the scroll container.
  useEffect(() => {
    if (!scrollRef.current) return;
    const targetWeek = year === new Date().getFullYear() ? currentWeek : 1;
    // Center the target row: move scrollTop so the row is ~2 rows from the top
    const headerHeight = 45;
    const rowTop = headerHeight + (targetWeek - 1) * ROW_HEIGHT;
    const center = rowTop - Math.floor(1 * ROW_HEIGHT);
    scrollRef.current.scrollTop = Math.max(0, center);
  }, [year, isLoading]);

  const activeDisc = activeHeader ? DISCIPLINES.find((d) => d.key === activeHeader) : null;

  return (
    <div className="mt-5">
      {/* Sub-section label + year picker */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#FCD000]">
          My Accountability
        </span>
        <div className="flex-1 h-px bg-white/10" />
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setYear((y) => y - 1)}
            disabled={year <= new Date().getFullYear() - 1}
            className="w-6 h-6 flex items-center justify-center rounded-sm bg-zinc-800 border border-zinc-700 text-white/70 hover:text-white hover:bg-zinc-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Previous year"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
          <span className="text-xs font-black text-white tabular-nums">{year}</span>
          <button
            onClick={() => setYear((y) => y + 1)}
            disabled={year >= new Date().getFullYear() + 1}
            className="w-6 h-6 flex items-center justify-center rounded-sm bg-zinc-800 border border-zinc-700 text-white/70 hover:text-white hover:bg-zinc-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Next year"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Discipline tooltip */}
      {activeDisc && (
        <div className="mb-3 bg-zinc-900 border-2 border-ministry-gold-exact rounded-sm p-3 relative">
          <button onClick={() => setActiveHeader(null)} className="absolute top-2 right-2 text-white/40 hover:text-white">
            <X className="w-4 h-4" />
          </button>
          <p className="font-black text-ministry-gold-exact text-sm uppercase tracking-wide">
            {activeDisc.letter} — {activeDisc.name}
          </p>
          <p className="text-xs text-white/70 mt-1">{activeDisc.scripture}</p>
        </div>
      )}

      {/* Grid card */}
      <div className="border-2 border-ministry-gold-exact rounded-sm overflow-hidden shadow-[4px_4px_0px_0px_rgba(252,208,0,1)] bg-zinc-900">
        {/* Single scrollable container — sticky thead keeps header fixed, tbody scrolls beneath */}
        <div
          ref={scrollRef}
          className="overflow-y-auto"
          style={{ height: `${WINDOW_HEIGHT}px` }}
        >
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-zinc-950">
              <tr>
                <th className="w-10 py-2 text-center text-xs font-black text-zinc-500 uppercase tracking-wide border-b border-zinc-800">
                  Wk
                </th>
                {DISCIPLINES.map(({ key, letter }) => (
                  <th key={key} className="py-2 text-center border-b border-zinc-800">
                    <button
                      onClick={() => setActiveHeader(activeHeader === key ? null : key)}
                      className={`w-full h-7 flex items-center justify-center text-xs font-black uppercase rounded-sm transition-colors mx-auto
                        ${activeHeader === key ? "bg-ministry-gold-exact text-black" : "text-ministry-gold-exact hover:bg-zinc-800"}`}
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
                    className={`border-b border-zinc-800/50 ${isCurrentWeek ? "bg-yellow-950/40" : ""}`}
                  >
                    <td className={`text-center text-xs font-bold py-1 w-10 ${isCurrentWeek ? "text-ministry-gold-exact font-black" : "text-zinc-500"}`}>
                      {week}
                    </td>
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
                            title={`Week ${week} – ${DISCIPLINES.find(d => d.key === key)?.name}`}
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
        <div className="flex items-center justify-center gap-4 py-2.5 border-t border-zinc-800 bg-zinc-950">
          <span className="flex items-center gap-1.5 text-xs font-bold text-white/50 uppercase tracking-wide">
            <span className="w-3.5 h-3.5 rounded-sm inline-block border border-zinc-700" style={{ background: "#27272a" }} />
            Blank
          </span>
          <span className="flex items-center gap-1.5 text-xs font-bold text-white/50 uppercase tracking-wide">
            <span className="w-3.5 h-3.5 rounded-sm inline-block border border-amber-300" style={{ background: "linear-gradient(to top, #fbbf24 50%, #27272a 50%)" }} />
            Repented
          </span>
          <span className="flex items-center gap-1.5 text-xs font-bold text-white/50 uppercase tracking-wide">
            <span className="w-3.5 h-3.5 rounded-sm inline-block border border-green-400" style={{ background: "#22c55e" }} />
            Done
          </span>
        </div>
      </div>

      <p className="text-[10px] text-white/30 mt-1.5 font-bold text-center uppercase tracking-wide">
        Tap column letter for details · tap cell to cycle · scroll to see all 52 weeks
      </p>
    </div>
  );
}
