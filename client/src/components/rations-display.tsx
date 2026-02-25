import { useQuery } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Coins, TrendingUp, ChevronRight, Medal, Flame } from "lucide-react";

const RANK_ICONS: Record<string, { icon: typeof Medal; color: string }> = {
  recruit: { icon: Medal, color: "text-zinc-400" },
  warrior: { icon: Medal, color: "text-amber-600" },
  shepherd: { icon: Medal, color: "text-ministry-gold" },
  watchman: { icon: Medal, color: "text-cyan-400" },
  elder: { icon: Medal, color: "text-purple-400" },
};

const RANK_LABELS: Record<string, string> = {
  recruit: "Recruit",
  warrior: "Warrior",
  shepherd: "Shepherd",
  watchman: "Watchman",
  elder: "Elder",
};

interface RationsInfo {
  balance: number;
  rank: string;
  rankLabel: string;
  nextRank: string | null;
  progressToNextRank: number;
  rationsToNextRank: number;
}

export function RationsDisplay() {
  const { data: rations, isLoading } = useQuery<RationsInfo>({
    queryKey: ["/api/rations"],
    retry: false,
    staleTime: 30000,
  });

  if (isLoading || !rations) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-900/80 border border-zinc-700 rounded-sm">
        <Coins className="w-4 h-4 text-ministry-gold animate-pulse" />
        <span className="text-sm font-bold text-zinc-500">...</span>
      </div>
    );
  }

  const rankConfig = RANK_ICONS[rations.rank] || RANK_ICONS.recruit;
  const RankIcon = rankConfig.icon;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-1.5 px-2 py-1 h-auto bg-[#FCD000] border-2 border-black rounded-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#e6bc00] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
          data-testid="rations-display"
        >
          <Coins className="w-4 h-4 text-black" />
          <span className="text-sm font-black text-black tracking-tight">
            {rations.balance.toLocaleString()}
          </span>
          <RankIcon className="w-4 h-4 text-black" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-72 p-0 bg-zinc-900 border-2 border-black rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
        align="end"
        data-testid="rations-popover"
      >
        <div className="p-4 border-b-2 border-black bg-ministry-gold/10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-ministry-gold" />
              <span className="text-xl font-black text-ministry-gold">
                {rations.balance.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 bg-black rounded-sm border border-ministry-gold">
              <RankIcon className={`w-4 h-4 ${rankConfig.color}`} />
              <span className={`text-xs font-bold uppercase ${rankConfig.color}`}>
                {rations.rankLabel}
              </span>
            </div>
          </div>
          <p className="text-xs text-zinc-400 uppercase tracking-wide font-bold">
            Rations Earned
          </p>
        </div>

        {rations.nextRank && (
          <div className="p-4 border-b-2 border-black">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-zinc-400 uppercase font-bold">
                Progress to {RANK_LABELS[rations.nextRank] || rations.nextRank}
              </span>
              <span className="text-xs font-bold text-ministry-gold">
                {rations.progressToNextRank}%
              </span>
            </div>
            <Progress 
              value={rations.progressToNextRank} 
              className="h-2 bg-zinc-800 rounded-sm"
            />
            <p className="text-xs text-zinc-500 mt-1">
              {rations.rationsToNextRank.toLocaleString()} rations needed
            </p>
          </div>
        )}

        <div className="p-2">
          <Link href="/rations">
            <Button 
              variant="ghost" 
              className="w-full justify-between h-10 px-3 rounded-sm bg-zinc-800/50 hover:bg-ministry-gold/20 hover:text-ministry-gold border border-zinc-700"
              data-testid="view-rations-history"
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm font-bold uppercase">View History</span>
              </div>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function RationsCompact() {
  const { data: rations, isLoading } = useQuery<RationsInfo>({
    queryKey: ["/api/rations"],
    retry: false,
    staleTime: 30000,
  });

  if (isLoading || !rations) {
    return null;
  }

  const rankConfig = RANK_ICONS[rations.rank] || RANK_ICONS.recruit;
  const RankIcon = rankConfig.icon;

  return (
    <Link href="/rations">
      <div 
        className="flex items-center gap-1 px-2 py-1 bg-zinc-900/60 border border-zinc-800 rounded-sm cursor-pointer hover:bg-zinc-800 transition-colors"
        data-testid="rations-compact"
      >
        <Coins className="w-3.5 h-3.5 text-ministry-gold" />
        <span className="text-xs font-bold text-ministry-gold">
          {rations.balance.toLocaleString()}
        </span>
        <RankIcon className={`w-3 h-3 ${rankConfig.color}`} />
      </div>
    </Link>
  );
}
