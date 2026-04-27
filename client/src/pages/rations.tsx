import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Coins, Medal, TrendingUp, Trophy, ArrowLeft, Clock, Plus, Minus, Crown, Target, Flame, Users, ShoppingBag, BookOpen, Star, Zap, CheckCircle2, Info } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { BackButton } from "@/components/BackButton";

const RANK_CONFIG: Record<string, { color: string; bgColor: string; borderColor: string }> = {
  recruit: { color: "text-zinc-400", bgColor: "bg-zinc-800", borderColor: "border-zinc-600" },
  warrior: { color: "text-amber-600", bgColor: "bg-amber-950", borderColor: "border-amber-700" },
  shepherd: { color: "text-ministry-gold", bgColor: "bg-yellow-950", borderColor: "border-ministry-gold" },
  watchman: { color: "text-cyan-400", bgColor: "bg-cyan-950", borderColor: "border-cyan-600" },
  elder: { color: "text-purple-400", bgColor: "bg-purple-950", borderColor: "border-purple-600" },
};

const RANK_THRESHOLDS = [
  { rank: "recruit", label: "Recruit", min: 0, max: 999 },
  { rank: "warrior", label: "Warrior", min: 1000, max: 4999 },
  { rank: "shepherd", label: "Shepherd", min: 5000, max: 14999 },
  { rank: "watchman", label: "Watchman", min: 15000, max: 29999 },
  { rank: "elder", label: "Elder", min: 30000, max: Infinity },
];

interface RationsInfo {
  balance: number;
  rank: string;
  rankLabel: string;
  nextRank: string | null;
  progressToNextRank: number;
  rationsToNextRank: number;
}

interface Transaction {
  id: string;
  userId: string;
  amount: number;
  type: string;
  category: string;
  missionType: string;
  description: string;
  balanceAfter: number;
  createdAt: string;
}

interface LeaderboardEntry {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  rations: number;
  rank: string;
}

export default function RationsPage() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();

  const { data: rations, isLoading: rationsLoading } = useQuery<RationsInfo>({
    queryKey: ["/api/rations"],
    retry: false,
  });

  const { data: history = [], isLoading: historyLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/rations/history"],
    retry: false,
  });

  const { data: leaderboard = [], isLoading: leaderboardLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/rations/leaderboard"],
    retry: false,
  });

  const rankConfig = RANK_CONFIG[rations?.rank || "recruit"] || RANK_CONFIG.recruit;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-ministry-gold">Loading...</div>
      </div>
    );
  }

  return (
    <div className="pb-20 bg-background min-h-screen">
      <div className="liquid-header text-white px-4 pt-8 pb-6">
        <BackButton />
        <div className="flex items-center gap-3 mb-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 rounded-sm">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-black uppercase tracking-tighter">Rations</h1>
        </div>

        {rations && (
          <Card className={`${rankConfig.bgColor} border-2 ${rankConfig.borderColor} rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 bg-[#FDD000] text-black border-2 border-black rounded-sm flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <Coins className="w-8 h-8 text-black" />
                  </div>
                  <div>
                    <p className="text-3xl font-black text-ministry-gold tracking-tight">
                      {rations.balance.toLocaleString()}
                    </p>
                    <p className="text-xs text-zinc-400 uppercase font-bold tracking-wide">
                      Total Rations
                    </p>
                  </div>
                </div>
                <div className={`flex flex-col items-center px-3 py-2 bg-black/50 border ${rankConfig.borderColor} rounded-sm`}>
                  <Medal className={`w-8 h-8 ${rankConfig.color}`} />
                  <span className={`text-xs font-black uppercase ${rankConfig.color}`}>
                    {rations.rankLabel}
                  </span>
                </div>
              </div>

              {rations.nextRank && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-zinc-400 uppercase font-bold">
                      Next: {RANK_THRESHOLDS.find(r => r.rank === rations.nextRank)?.label || rations.nextRank}
                    </span>
                    <span className="text-xs font-bold text-ministry-gold">
                      {rations.rationsToNextRank.toLocaleString()} to go
                    </span>
                  </div>
                  <Progress value={rations.progressToNextRank} className="h-3 bg-black/50 rounded-sm" />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Link href="/rations-store">
          <Button 
            className="w-full mt-4 bg-ministry-gold text-black font-bold uppercase tracking-wide hover:bg-yellow-500 rounded-sm border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] py-6"
          >
            <ShoppingBag className="w-5 h-5 mr-2" />
            Visit Rations Store
          </Button>
        </Link>
      </div>

      <div className="px-4 -mt-2 relative z-10">
        <Tabs defaultValue="history" className="w-full">
          <TabsList className="w-full bg-zinc-900 border-2 border-black rounded-sm h-12 p-1 mb-4">
            <TabsTrigger 
              value="history" 
              className="flex-1 rounded-sm data-[state=active]:bg-ministry-gold data-[state=active]:text-black font-bold uppercase text-[10px]"
              data-testid="tab-history"
            >
              <Clock className="w-3.5 h-3.5 mr-0.5" />
              History
            </TabsTrigger>
            <TabsTrigger 
              value="leaderboard" 
              className="flex-1 rounded-sm data-[state=active]:bg-ministry-gold data-[state=active]:text-black font-bold uppercase text-[10px]"
              data-testid="tab-leaderboard"
            >
              <Trophy className="w-3.5 h-3.5 mr-0.5" />
              Board
            </TabsTrigger>
            <TabsTrigger 
              value="ranks" 
              className="flex-1 rounded-sm data-[state=active]:bg-ministry-gold data-[state=active]:text-black font-bold uppercase text-[10px]"
              data-testid="tab-ranks"
            >
              <Medal className="w-3.5 h-3.5 mr-0.5" />
              Ranks
            </TabsTrigger>
            <TabsTrigger 
              value="earn" 
              className="flex-1 rounded-sm data-[state=active]:bg-ministry-gold data-[state=active]:text-black font-bold uppercase text-[10px]"
              data-testid="tab-earn"
            >
              <Zap className="w-3.5 h-3.5 mr-0.5" />
              Earn
            </TabsTrigger>
          </TabsList>

          <TabsContent value="history" className="mt-0">
            <Card className="bg-zinc-900 border-2 border-black rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <CardHeader className="border-b border-zinc-800 py-3 px-4">
                <CardTitle className="text-sm font-black uppercase tracking-wide text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-ministry-gold" />
                  Recent Missions
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {historyLoading ? (
                  <div className="p-6 text-center text-zinc-500">Loading...</div>
                ) : history.length === 0 ? (
                  <div className="p-6 text-center">
                    <Target className="w-12 h-12 text-zinc-700 mx-auto mb-2" />
                    <p className="text-zinc-500 text-sm">No missions completed yet</p>
                    <p className="text-zinc-600 text-xs mt-1">Complete studies, devotionals, and challenges to earn rations!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-800">
                    {history.slice(0, 20).map((transaction) => (
                      <div 
                        key={transaction.id} 
                        className="flex items-center justify-between p-3 hover:bg-zinc-800/50"
                        data-testid={`transaction-${transaction.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-sm flex items-center justify-center ${
                            transaction.amount > 0 ? "bg-green-900/50 border border-green-700" : "bg-red-900/50 border border-red-700"
                          }`}>
                            {transaction.amount > 0 ? (
                              <Plus className="w-4 h-4 text-green-400" />
                            ) : (
                              <Minus className="w-4 h-4 text-red-400" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">{transaction.description}</p>
                            <p className="text-xs text-zinc-500">
                              {formatDistanceToNow(new Date(transaction.createdAt), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`font-black ${transaction.amount > 0 ? "text-green-400" : "text-red-400"}`}>
                            {transaction.amount > 0 ? "+" : ""}{transaction.amount}
                          </span>
                          <p className="text-xs text-zinc-500">{transaction.balanceAfter.toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leaderboard" className="mt-0">
            <Card className="bg-zinc-900 border-2 border-black rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <CardHeader className="border-b border-zinc-800 py-3 px-4">
                <CardTitle className="text-sm font-black uppercase tracking-wide text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-ministry-gold" />
                  Top Soldiers
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {leaderboardLoading ? (
                  <div className="p-6 text-center text-zinc-500">Loading...</div>
                ) : leaderboard.length === 0 ? (
                  <div className="p-6 text-center">
                    <Trophy className="w-12 h-12 text-zinc-700 mx-auto mb-2" />
                    <p className="text-zinc-500 text-sm">No soldiers on the leaderboard yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-800">
                    {leaderboard.map((entry, index) => {
                      const entryRankConfig = RANK_CONFIG[entry.rank] || RANK_CONFIG.recruit;
                      const isCurrentUser = entry.userId === user?.id;
                      
                      return (
                        <div 
                          key={entry.userId} 
                          className={`flex items-center justify-between p-3 ${isCurrentUser ? "bg-ministry-gold/10" : "hover:bg-zinc-800/50"}`}
                          data-testid={`leaderboard-${index + 1}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 flex items-center justify-center font-black ${
                              index === 0 ? "bg-ministry-gold text-black" :
                              index === 1 ? "bg-zinc-400 text-black" :
                              index === 2 ? "bg-amber-700 text-white" :
                              "bg-zinc-800 text-zinc-400"
                            } rounded-sm border-2 border-black`}>
                              {index < 3 ? <Crown className="w-4 h-4" /> : index + 1}
                            </div>
                            <img
                              src={entry.profileImageUrl || `https://ui-avatars.com/api/?name=${entry.firstName}+${entry.lastName}&background=4A90B8&color=fff&size=40`}
                              alt={`${entry.firstName || ""} ${entry.lastName || ""}`}
                              className="w-10 h-10 rounded-sm border border-zinc-700 object-cover"
                            />
                            <div>
                              <p className={`text-sm font-bold ${isCurrentUser ? "text-ministry-gold" : "text-white"}`}>
                                {entry.firstName} {entry.lastName}
                                {isCurrentUser && <span className="text-xs ml-1">(You)</span>}
                              </p>
                              <div className="flex items-center gap-1">
                                <Medal className={`w-3 h-3 ${entryRankConfig.color}`} />
                                <span className={`text-xs font-bold ${entryRankConfig.color}`}>
                                  {RANK_THRESHOLDS.find(r => r.rank === entry.rank)?.label || entry.rank}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Coins className="w-4 h-4 text-ministry-gold" />
                            <span className="font-black text-ministry-gold">
                              {entry.rations.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ranks" className="mt-0">
            <Card className="bg-zinc-900 border-2 border-black rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <CardHeader className="border-b border-zinc-800 py-3 px-4">
                <CardTitle className="text-sm font-black uppercase tracking-wide text-white flex items-center gap-2">
                  <Flame className="w-4 h-4 text-ministry-gold" />
                  Rank Progression
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-zinc-800">
                  {RANK_THRESHOLDS.map((tier) => {
                    const tierConfig = RANK_CONFIG[tier.rank] || RANK_CONFIG.recruit;
                    const isCurrentRank = rations?.rank === tier.rank;
                    const isAchieved = rations && rations.balance >= tier.min;
                    
                    return (
                      <div 
                        key={tier.rank} 
                        className={`p-4 ${isCurrentRank ? "bg-ministry-gold/10" : ""}`}
                        data-testid={`rank-${tier.rank}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-sm flex items-center justify-center ${tierConfig.bgColor} border ${tierConfig.borderColor}`}>
                              <Medal className={`w-6 h-6 ${tierConfig.color}`} />
                            </div>
                            <div>
                              <p className={`font-black text-base ${isCurrentRank ? "text-ministry-gold" : isAchieved ? "text-white" : "text-zinc-500"}`}>
                                {tier.label}
                                {isCurrentRank && <span className="text-xs text-ministry-gold ml-2">(Current)</span>}
                              </p>
                              <p className="text-xs text-zinc-500">
                                {tier.max === Infinity 
                                  ? `${tier.min.toLocaleString()}+ rations`
                                  : `${tier.min.toLocaleString()} - ${tier.max.toLocaleString()} rations`
                                }
                              </p>
                            </div>
                          </div>
                          {isAchieved && (
                            <div className="px-2 py-1 bg-green-900/30 border border-green-700 rounded-sm">
                              <span className="text-xs font-bold text-green-400 uppercase">Achieved</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="earn" className="mt-0 space-y-4">
            {/* What are Rations */}
            <Card className="bg-zinc-900 border-2 border-black rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <CardHeader className="border-b border-zinc-800 py-3 px-4">
                <CardTitle className="text-sm font-black uppercase tracking-wide text-white flex items-center gap-2">
                  <Info className="w-4 h-4 text-ministry-gold" />
                  What Are Rations?
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <p className="text-sm text-zinc-300 leading-relaxed">
                  In the military, rations are what keeps a soldier strong and ready for battle. Here, <span className="text-ministry-gold font-bold">Rations</span> are your reward for showing up — in Scripture, in prayer, in brotherhood, and in service.
                </p>
                <p className="text-sm text-zinc-300 leading-relaxed">
                  Every time you engage with the platform, you complete a <span className="text-white font-bold">Mission</span> and earn rations. These rations build toward higher <span className="text-ministry-gold font-bold">Ranks</span> — from Recruit all the way to Elder — and can be spent in the <span className="text-ministry-gold font-bold">Rations Store</span> on rewards and gear.
                </p>
                <div className="flex items-start gap-2 p-3 bg-ministry-gold/10 border border-ministry-gold/30 rounded-sm">
                  <Star className="w-4 h-4 text-ministry-gold flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    <span className="font-bold text-ministry-gold">Pro tip:</span> Stay consistent in Studies, Devotionals, and Challenges. Every completion counts — rations add up fast when you show up daily.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Mission Categories — only what is actually wired up and working */}
            {[
              {
                label: "Studies",
                icon: BookOpen,
                color: "text-blue-400",
                bg: "bg-blue-950",
                border: "border-blue-700",
                missions: [
                  { name: "Complete a lesson", rations: 25 },
                  { name: "Complete a full study", rations: 100, bonus: true },
                ],
              },
              {
                label: "Devotionals",
                icon: Target,
                color: "text-amber-400",
                bg: "bg-amber-950",
                border: "border-amber-700",
                missions: [
                  { name: "Complete daily devotional", rations: 20 },
                  { name: "Submit a reflection", rations: 5 },
                ],
              },
              {
                label: "Challenges",
                icon: CheckCircle2,
                color: "text-green-400",
                bg: "bg-green-950",
                border: "border-green-700",
                missions: [
                  { name: "Join a challenge", rations: 25 },
                  { name: "Complete a challenge", rations: 75, bonus: true },
                ],
              },
            ].map(({ label, icon: Icon, color, bg, border, missions }) => (
              <Card key={label} className="bg-zinc-900 border-2 border-black rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <CardHeader className="border-b border-zinc-800 py-2.5 px-4">
                  <CardTitle className="text-xs font-black uppercase tracking-wide text-white flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-sm flex items-center justify-center ${bg} border ${border}`}>
                      <Icon className={`w-3.5 h-3.5 ${color}`} />
                    </div>
                    {label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-zinc-800">
                    {missions.map((m) => (
                      <div key={m.name} className="flex items-center justify-between px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          {m.bonus && <Flame className="w-3 h-3 text-orange-400 flex-shrink-0" />}
                          <span className={`text-sm ${m.bonus ? 'text-white font-semibold' : 'text-zinc-300'}`}>{m.name}</span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                          <Coins className="w-3.5 h-3.5 text-ministry-gold" />
                          <span className="font-black text-ministry-gold text-sm">+{m.rations}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Grace Bonus */}
            <Card className="bg-zinc-900 border-2 border-ministry-gold/40 rounded-sm shadow-[4px_4px_0px_0px_rgba(253,208,0,0.3)]">
              <CardContent className="p-4 flex items-start gap-3">
                <div className="w-10 h-10 bg-ministry-gold/10 border border-ministry-gold/40 rounded-sm flex items-center justify-center flex-shrink-0">
                  <Star className="w-5 h-5 text-ministry-gold" />
                </div>
                <div>
                  <p className="font-black text-ministry-gold uppercase tracking-wide text-sm">Grace Bonus — +100 Rations</p>
                  <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                    Been away for <span className="text-white font-bold">14 or more days</span>? When you return, God's grace meets you right where you are. Log back in and you'll automatically receive a <span className="text-ministry-gold font-bold">+100 ration grace bonus</span> to help you get back in the fight. Welcome back, soldier.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="pb-4" />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
