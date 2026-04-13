import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ChevronLeft, ChevronRight } from "lucide-react";

const DISCIPLINES = [
  { key: "V", label: "Vision" },
  { key: "A", label: "Accountability" },
  { key: "T", label: "Truth" },
  { key: "M", label: "Meditation" },
  { key: "E", label: "Exercise" },
  { key: "B", label: "Bible" },
  { key: "O", label: "Obedience" },
  { key: "P", label: "Prayer" },
] as const;

type DisciplineKey = typeof DISCIPLINES[number]["key"];

const WEEKS = Array.from({ length: 52 }, (_, i) => i + 1);

function getWeekLabel(week: number, year: number): string {
  const jan1 = new Date(year, 0, 1);
  const dayOfWeek = jan1.getDay();
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const firstMonday = new Date(jan1);
  firstMonday.setDate(jan1.getDate() + daysToMonday);
  const target = new Date(firstMonday);
  target.setDate(firstMonday.getDate() + (week - 1) * 7);
  return target.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getCurrentWeek(): number {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000);
  return Math.min(Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7), 52);
}

function cellColor(state: number, isCurrent: boolean): string {
  if (state === 2) return "bg-green-500 border-green-400";
  if (state === 1) return "bg-amber-400 border-amber-300";
  if (isCurrent) return "bg-zinc-700 border-ministry-gold-exact/60";
  return "bg-zinc-800 border-zinc-700";
}

export function VatmebopChart() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const currentWeek = getCurrentWeek();
  const queryClient = useQueryClient();

  const { data: checks = [] } = useQuery<{ week: number; discipline: string; state: number }[]>({
    queryKey: ["/api/vatmebop", year],
    queryFn: () => apiRequest("GET", `/api/vatmebop?year=${year}`),
  });

  const stateMap = new Map<string, number>();
  for (const c of checks) {
    stateMap.set(`${c.week}-${c.discipline}`, c.state);
  }

  const mutation = useMutation({
    mutationFn: (payload: { year: number; week: number; discipline: string; state: number }) =>
      apiRequest("POST", "/api/vatmebop", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vatmebop", year] });
    },
  });

  const handleCellClick = useCallback(
    (week: number, discipline: DisciplineKey) => {
      const current = stateMap.get(`${week}-${discipline}`) ?? 0;
      const next = (current + 1) % 3;
      mutation.mutate({ year, week, discipline, state: next });
    },
    [stateMap, year, mutation],
  );

  return (
    <div className="px-6 mt-6 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-1 h-6 bg-[#FCD000] rounded-full flex-shrink-0" />
        <h2 className="text-lg font-black text-white tracking-tight uppercase">
          VATMEBOP Accountability
        </h2>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      {/* Legend + year nav */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3 text-xs font-bold text-white/60 uppercase tracking-wide">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm inline-block bg-green-500" />
            Accomplished
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm inline-block bg-amber-400" />
            Repented
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setYear((y) => y - 1)}
            className="w-7 h-7 flex items-center justify-center rounded-sm bg-zinc-800 border border-zinc-700 text-white/70 hover:text-white hover:bg-zinc-700 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-black text-white w-12 text-center">{year}</span>
          <button
            onClick={() => setYear((y) => y + 1)}
            className="w-7 h-7 flex items-center justify-center rounded-sm bg-zinc-800 border border-zinc-700 text-white/70 hover:text-white hover:bg-zinc-700 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable grid */}
      <div className="border-2 border-ministry-gold-exact rounded-sm overflow-hidden shadow-[4px_4px_0px_0px_rgba(252,208,0,1)] bg-zinc-900">
        {/* Month labels row */}
        <div className="overflow-x-auto">
          <div className="flex min-w-max">
            {/* discipline label column spacer */}
            <div className="w-8 flex-shrink-0" />
            {/* week header */}
            <div className="flex gap-0.5 px-1 pt-2 pb-0">
              {WEEKS.map((w) => (
                <div
                  key={w}
                  className={`w-5 h-4 flex items-center justify-center text-[7px] font-bold flex-shrink-0 ${
                    w === currentWeek && year === new Date().getFullYear()
                      ? "text-ministry-gold-exact"
                      : "text-zinc-600"
                  }`}
                >
                  {w % 4 === 1 ? w : ""}
                </div>
              ))}
            </div>
          </div>

          {/* Discipline rows */}
          {DISCIPLINES.map(({ key, label }) => (
            <div key={key} className="flex min-w-max items-center">
              {/* Discipline letter label */}
              <div
                className="w-8 flex-shrink-0 flex items-center justify-center text-xs font-black text-ministry-gold-exact py-0.5"
                title={label}
              >
                {key}
              </div>
              {/* Week cells */}
              <div className="flex gap-0.5 px-1 py-0.5">
                {WEEKS.map((w) => {
                  const state = stateMap.get(`${w}-${key}`) ?? 0;
                  const isCurrent = w === currentWeek && year === new Date().getFullYear();
                  return (
                    <button
                      key={w}
                      onClick={() => handleCellClick(w, key as DisciplineKey)}
                      title={`Week ${w} – ${label}\n${getWeekLabel(w, year)}`}
                      className={`w-5 h-5 flex-shrink-0 rounded-sm border transition-all active:scale-90 ${cellColor(state, isCurrent)} ${
                        isCurrent ? "ring-1 ring-ministry-gold-exact" : ""
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          ))}

          {/* Bottom padding */}
          <div className="h-2" />
        </div>
      </div>

      <p className="text-xs text-white/30 mt-2 font-bold text-center uppercase tracking-wide">
        Tap a cell to cycle: blank → repented → accomplished
      </p>
    </div>
  );
}
