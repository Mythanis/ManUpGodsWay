import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, BookOpen, ChevronRight, Layers, CalendarDays, Lock, Play, CheckCircle } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { BackButton } from "@/components/BackButton";
import { getDefaultThumbnail } from "@/lib/default-thumbnail";

// ─── Categories ──────────────────────────────────────────────────────────────
const categories = [
  { id: "all",        label: "All" },
  { id: "leadership", label: "Leadership" },
  { id: "marriage",   label: "Marriage" },
  { id: "fatherhood", label: "Fatherhood" },
  { id: "character",  label: "Character" },
  { id: "faith",      label: "Faith" },
];

// ─── Types ───────────────────────────────────────────────────────────────────
interface BiblePlan {
  id: string;
  name: string;
  description: string;
  planType: string;
  totalDays: number;
}

interface StudySeries {
  id: string;
  title: string;
  description: string;
  category: string;
  thumbnailUrl: string | null;
  studyCount: number;
  totalLessons: number;
}

interface Study {
  id: string;
  title: string;
  description: string;
  category: string;
  requiredTier: string;
  thumbnailUrl: string | null;
  totalDays: number;
}

// ─── Progress bar ────────────────────────────────────────────────────────────
function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.4)" }}>
          Day {value} of {max}
        </span>
        <span className="text-[10px] font-bold" style={{ color: "#FDD000" }}>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: "#FDD000" }}
        />
      </div>
    </div>
  );
}

// ─── Section header ──────────────────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-1 h-6 bg-[#FDD000] rounded-full flex-shrink-0" />
      <h2 className="text-xl font-coalition text-white uppercase tracking-widest">{title}</h2>
      <div className="flex-1 h-px bg-white/10" />
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function Library() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery]           = useState("");
  const { user, isAuthenticated }               = useAuth();

  // Bible plans — stable content, no need for refetch
  const { data: bibleReadingPlans = [] } = useQuery<BiblePlan[]>({
    queryKey: ["/api/bible-plans"],
    retry: false,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  // Series — content changes rarely, 10-minute stale time is plenty
  const { data: series = [], isLoading: seriesLoading } = useQuery<StudySeries[]>({
    queryKey: ["/api/study-series", selectedCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory && selectedCategory !== "all") {
        params.append("category", selectedCategory);
      }
      const res = await fetch(`/api/study-series?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch series");
      return res.json();
    },
    retry: false,
    staleTime: 1000 * 60 * 10, // 10 minutes — was 8 seconds, no need to hammer server
  });

  // Individual studies — same
  const { data: individualStudies = [], isLoading: studiesLoading } = useQuery<Study[]>({
    queryKey: ["/api/studies", "individual", selectedCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("individual", "true");
      if (selectedCategory && selectedCategory !== "all") {
        params.append("category", selectedCategory);
      }
      const res = await fetch(`/api/studies?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch studies");
      return res.json();
    },
    retry: false,
    staleTime: 1000 * 60 * 10,
  });

  // User progress — still needs to be fresh but not every 8 seconds
  const { data: userProgress = [] } = useQuery({
    queryKey: ["/api/progress"],
    enabled: isAuthenticated,
    retry: false,
    staleTime: 1000 * 30, // 30 seconds is plenty
  });

  // Active studies
  const { data: activeStudyInfo } = useQuery<{
    activeSeriesId: string | null;
    activeTopicalStudyId: string | null;
  }>({
    queryKey: ["/api/user/active-studies"],
    enabled: isAuthenticated,
    retry: false,
    staleTime: 1000 * 30,
  });

  const isLoading = seriesLoading || studiesLoading;

  // ── Derive active/in-progress studies for "Continue" section ───────────────
  const inProgressStudies = (userProgress as any[]).filter(
    (p: any) => p && !p.isCompleted && p.currentDay > 0
  );

  const activeSeriesProgress   = inProgressStudies.find((p: any) =>
    series.some((s) => s.id === p.studyId || /* series might use different id */ false)
  );

  const activeTopicalProgress = inProgressStudies.find((p: any) =>
    individualStudies.some((s) => s.id === p.studyId)
  );

  const hasActiveStudies = inProgressStudies.length > 0;

  // ── Filtered content ────────────────────────────────────────────────────────
  const filteredSeries = series.filter((s) => {
    if (!searchQuery) return true;
    return (
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const filteredStudies = individualStudies.filter((s) => {
    if (!searchQuery) return true;
    return (
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const hasContent = filteredSeries.length > 0 || filteredStudies.length > 0 || bibleReadingPlans.length > 0;

  return (
    <div className="pb-20">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="liquid-header text-white px-6 pt-12 pb-6">
        <BackButton />
        <h1
          className="text-4xl font-black mb-2 tracking-tighter uppercase"
          data-testid="text-library-title"
        >
          <span className="text-white">Study</span>{" "}
          <span className="text-ministry-gold-exact">Library</span>
        </h1>
        <p
          className="text-ministry-gold-exact text-xs font-bold tracking-widest uppercase"
          data-testid="text-library-subtitle"
        >
          Grow Stronger in Faith and Character
        </p>
      </div>

      {/* ── SEARCH ─────────────────────────────────────────────────────────── */}
      <div className="px-6 -mt-3 relative z-10 mb-4">
        <div
          className="flex items-center gap-2 px-3 rounded-sm"
          style={{ background: "#FDD000", border: "2px solid #000", boxShadow: "3px 3px 0px 0px rgba(0,0,0,1)" }}
        >
          <Search className="w-4 h-4 text-black flex-shrink-0" />
          <Input
            type="text"
            placeholder="SEARCH STUDIES..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-0 bg-transparent text-black placeholder:text-black/50 placeholder:text-xs placeholder:tracking-wide placeholder:font-medium font-medium text-sm focus-visible:ring-0 focus-visible:ring-offset-0 py-3 px-0"
            data-testid="input-search"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="text-black/50 hover:text-black text-xs font-bold">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── CATEGORY PILLS ─────────────────────────────────────────────────── */}
      <div className="px-6 mb-5">
        <div className="flex gap-2 flex-wrap pb-1 justify-center">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              data-testid={`option-category-${cat.id}`}
              className="flex-shrink-0 px-4 py-2 rounded-full text-xs font-black uppercase tracking-wide transition-all"
              style={{
                background: selectedCategory === cat.id ? "#FDD000" : "rgba(255,255,255,0.07)",
                color:      selectedCategory === cat.id ? "#000"    : "rgba(255,255,255,0.5)",
                border:     selectedCategory === cat.id ? "2px solid #000" : "2px solid transparent",
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── CONTENT ────────────────────────────────────────────────────────── */}
      <div className="px-6 space-y-8">

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FDD000] mx-auto mb-4" />
            <p className="text-white/40 text-sm">Loading your library...</p>
          </div>
        ) : !hasContent ? (
          <div className="text-center py-12" data-testid="empty-library">
            <Layers className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <p className="text-white/40 text-sm">
              {searchQuery || selectedCategory !== "all"
                ? "No content found for your filters."
                : "No studies available yet."}
            </p>
          </div>
        ) : (
          <>
            {/* ── CONTINUE WHERE YOU LEFT OFF ──────────────────────────────── */}
            {hasActiveStudies && !searchQuery && selectedCategory === "all" && (
              <div>
                <SectionHeader title="Continue" />
                <div className="space-y-3">
                  {inProgressStudies.slice(0, 3).map((progress: any) => {
                    // Find the matching study or series
                    const matchedStudy = individualStudies.find((s) => s.id === progress.studyId);
                    const matchedSeries = series.find((s) =>
                      s.id === progress.studyId || progress.seriesId === s.id
                    );
                    const item = matchedStudy || matchedSeries;
                    if (!item) return null;

                    const href = matchedStudy
                      ? `/studies/${item.id}`
                      : `/series/${item.id}`;

                    const totalDays = matchedStudy
                      ? (matchedStudy as Study).totalDays
                      : (matchedSeries as StudySeries)?.totalLessons || 0;

                    return (
                      <Link key={progress.studyId} href={href}>
                        <div
                          className="flex items-stretch rounded-sm overflow-hidden transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] cursor-pointer"
                          style={{ background: "#0f0f0f", border: "2px solid rgba(253,208,0,0.5)", boxShadow: "3px 3px 0px 0px rgba(253,208,0,0.2)" }}
                        >
                          {/* Thumbnail */}
                          <div className="w-20 flex-shrink-0 bg-black flex items-center justify-center overflow-hidden self-stretch">
                            {item.thumbnailUrl ? (
                              <img src={getDefaultThumbnail(item.thumbnailUrl)} alt={item.title} className="h-full w-full object-cover" />
                            ) : (
                              <Play className="w-7 h-7 text-[#FDD000]" />
                            )}
                          </div>
                          {/* Content */}
                          <div className="flex-1 px-4 py-3 min-w-0">
                            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FDD000]">
                              ▶ Continue
                            </span>
                            <p className="font-black text-white text-sm leading-tight uppercase tracking-tight line-clamp-1 mt-0.5">
                              {item.title}
                            </p>
                            {totalDays > 0 && (
                              <ProgressBar value={progress.currentDay || 0} max={totalDays} />
                            )}
                          </div>
                          <div className="flex items-center pr-4">
                            <ChevronRight className="w-5 h-5 text-[#FDD000]" />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── START HERE (for new users with no progress) ──────────────── */}
            {!hasActiveStudies && !searchQuery && selectedCategory === "all" && (
              (() => {
                // Show the first free study as a "Start Here" recommendation
                const starterStudy = individualStudies.find((s) => s.requiredTier === "free") || individualStudies[0];
                if (!starterStudy) return null;
                return (
                  <div>
                    <SectionHeader title="Start Here" />
                    <Link href={`/studies/${starterStudy.id}`}>
                      <div
                        className="flex items-stretch rounded-sm overflow-hidden transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] cursor-pointer"
                        style={{ background: "#0f0f0f", border: "2px solid #FDD000", boxShadow: "4px 4px 0px 0px rgba(253,208,0,0.3)" }}
                      >
                        <div className="w-20 flex-shrink-0 bg-black flex items-center justify-center overflow-hidden self-stretch">
                          {starterStudy.thumbnailUrl ? (
                            <img src={getDefaultThumbnail(starterStudy.thumbnailUrl)} alt={starterStudy.title} className="h-full w-full object-cover" />
                          ) : (
                            <BookOpen className="w-7 h-7 text-[#FDD000]" />
                          )}
                        </div>
                        <div className="flex-1 px-4 py-3 min-w-0">
                          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FDD000]">
                            ⚔️ Recommended for New Members
                          </span>
                          <p className="font-black text-white text-sm leading-tight uppercase tracking-tight line-clamp-2 mt-0.5">
                            {starterStudy.title}
                          </p>
                          {starterStudy.totalDays > 0 && (
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="text-[10px] font-bold text-white/40 uppercase tracking-wide">
                                {starterStudy.totalDays} Days · Free to Start
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center pr-4">
                          <ChevronRight className="w-5 h-5 text-[#FDD000]" />
                        </div>
                      </div>
                    </Link>
                  </div>
                );
              })()
            )}

            {/* ── STUDY SERIES ─────────────────────────────────────────────── */}
            {filteredSeries.length > 0 && (
              <div>
                <SectionHeader title="Study Series" />
                <div className="space-y-3">
                  {filteredSeries.map((s) => {
                    const isSeriesLocked =
                      isAuthenticated &&
                      !!activeStudyInfo?.activeSeriesId &&
                      activeStudyInfo.activeSeriesId !== s.id;

                    const card = (
                      <div
                        className={`flex items-stretch rounded-sm border-2 overflow-hidden transition-all ${
                          isSeriesLocked
                            ? "border-white/10 opacity-50 cursor-not-allowed"
                            : "border-white/10 hover:border-[#FDD000]/40 hover:translate-x-[-1px] hover:translate-y-[-1px] cursor-pointer"
                        }`}
                        style={{ background: "#0f0f0f" }}
                        data-testid={`series-card-${s.id}`}
                      >
                        {/* Thumbnail */}
                        <div className="w-20 flex-shrink-0 bg-black flex items-center justify-center overflow-hidden self-stretch relative">
                          {s.thumbnailUrl ? (
                            <img src={s.thumbnailUrl} alt={s.title} className="h-full w-full object-cover" />
                          ) : (
                            <Layers className="w-7 h-7 text-[#FDD000]" />
                          )}
                          {isSeriesLocked && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                              <Lock className="w-5 h-5 text-[#FDD000]" />
                            </div>
                          )}
                        </div>
                        {/* Content */}
                        <div className="flex-1 px-4 py-3 min-w-0">
                          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FDD000]">
                            {isSeriesLocked ? "Complete Current Series First" : "Series"}
                          </span>
                          <p
                            className="font-black text-white text-sm leading-tight mt-0.5 uppercase tracking-tight line-clamp-2"
                            data-testid={`text-series-title-${s.id}`}
                          >
                            {s.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] font-bold text-white/40 uppercase tracking-wide">
                              {s.studyCount} {s.studyCount === 1 ? "Study" : "Studies"}
                            </span>
                            <span className="text-white/20 text-[10px]">•</span>
                            <span className="text-[10px] font-bold text-white/40 uppercase tracking-wide">
                              {s.totalLessons} Lessons
                            </span>
                          </div>
                        </div>
                        {/* Arrow */}
                        <div className="flex items-center pr-4">
                          {isSeriesLocked
                            ? <Lock className="w-4 h-4 text-white/20" />
                            : <ChevronRight className="w-5 h-5 text-[#FDD000]" />
                          }
                        </div>
                      </div>
                    );

                    return isSeriesLocked ? (
                      <div key={s.id}>{card}</div>
                    ) : (
                      <Link key={s.id} href={`/series/${s.id}`}>{card}</Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── INDIVIDUAL STUDIES ───────────────────────────────────────── */}
            {filteredStudies.length > 0 && (
              <div>
                <SectionHeader title="Individual Studies" />
                <div className="space-y-3">
                  {filteredStudies.map((study: Study) => {
                    const progress    = (userProgress as any[]).find((p: any) => p.studyId === study.id);
                    const isCompleted = progress?.isCompleted || false;
                    const hasStarted  = !!progress && !isCompleted;
                    const currentDay  = progress?.currentDay || 0;
                    const isFree      = study.requiredTier === "free";

                    const isTopicalLocked =
                      isAuthenticated &&
                      !isCompleted &&
                      !!activeStudyInfo?.activeTopicalStudyId &&
                      activeStudyInfo.activeTopicalStudyId !== study.id;

                    const card = (
                      <div
                        className={`flex items-stretch rounded-sm border-2 overflow-hidden transition-all ${
                          isTopicalLocked
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:translate-x-[-1px] hover:translate-y-[-1px] cursor-pointer"
                        }`}
                        style={{
                          background: "#0f0f0f",
                          borderColor: isCompleted
                            ? "rgba(253,208,0,0.5)"
                            : isTopicalLocked
                            ? "rgba(255,255,255,0.08)"
                            : "rgba(255,255,255,0.1)",
                        }}
                        data-testid={`study-card-${study.id}`}
                      >
                        {/* Thumbnail */}
                        <div className="w-20 flex-shrink-0 bg-black flex items-center justify-center overflow-hidden self-stretch relative">
                          {study.thumbnailUrl ? (
                            <img src={getDefaultThumbnail(study.thumbnailUrl)} alt={study.title} className="h-full w-full object-cover" />
                          ) : (
                            <BookOpen className="w-7 h-7 text-[#FDD000]" />
                          )}
                          {isCompleted && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <CheckCircle className="w-7 h-7 text-[#FDD000]" />
                            </div>
                          )}
                          {isTopicalLocked && !isCompleted && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                              <Lock className="w-5 h-5 text-[#FDD000]" />
                            </div>
                          )}
                        </div>
                        {/* Content */}
                        <div className="flex-1 px-4 py-3 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#FDD000]">
                              {isTopicalLocked
                                ? "Complete Current Study First"
                                : isCompleted
                                ? "✓ Completed"
                                : hasStarted
                                ? "In Progress"
                                : isFree
                                ? "Free"
                                : "Members"}
                            </span>
                          </div>
                          <p
                            className="font-black text-white text-sm leading-tight uppercase tracking-tight line-clamp-2"
                            data-testid={`text-study-title-${study.id}`}
                          >
                            {study.title}
                          </p>
                          {/* Progress bar for in-progress studies */}
                          {hasStarted && study.totalDays > 0 ? (
                            <ProgressBar value={currentDay} max={study.totalDays} />
                          ) : (
                            study.totalDays > 0 && (
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-[10px] font-bold text-white/40 uppercase tracking-wide">
                                  {study.totalDays} {study.totalDays === 1 ? "Day" : "Days"}
                                </span>
                              </div>
                            )
                          )}
                        </div>
                        {/* Arrow */}
                        <div className="flex items-center pr-4">
                          {isTopicalLocked
                            ? <Lock className="w-4 h-4 text-white/20" />
                            : <ChevronRight className="w-5 h-5 text-[#FDD000]" />
                          }
                        </div>
                      </div>
                    );

                    return isTopicalLocked ? (
                      <div key={study.id}>{card}</div>
                    ) : (
                      <Link key={study.id} href={`/studies/${study.id}`}>{card}</Link>
                    );
                  })}
                </div>
              </div>
            )}
            {/* ── BIBLE READING PLANS ──────────────────────────────────────── */}
            {bibleReadingPlans.length > 0 && !searchQuery && selectedCategory === "all" && (
              <div>
                <SectionHeader title="Bible Reading Plans" />
                <div className="space-y-3">
                  {bibleReadingPlans.map((plan) => {
                    const planProgress = (userProgress as any[]).find(
                      (p: any) => p.planId === plan.id || p.studyId === plan.id
                    );
                    const currentDay = planProgress?.currentDay || 0;

                    return (
                      <Link key={plan.id} href={`/bible-plans/${plan.id}`}>
                        <div
                          className="flex items-stretch rounded-sm border-2 border-white/10 overflow-hidden hover:border-[#FDD000]/40 hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all cursor-pointer"
                          style={{ background: "#0f0f0f" }}
                        >
                          <div className="w-20 flex-shrink-0 bg-black flex items-center justify-center self-stretch">
                            <CalendarDays className="w-7 h-7 text-[#FDD000]" />
                          </div>
                          <div className="flex-1 px-4 py-3 min-w-0">
                            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FDD000]">
                              {plan.planType === "chronological" ? "Chronological" : "365-Day Plan"}
                            </span>
                            <p className="font-black text-white text-sm leading-tight mt-0.5 uppercase tracking-tight line-clamp-2">
                              {plan.name}
                            </p>
                            {currentDay > 0 ? (
                              <ProgressBar value={currentDay} max={plan.totalDays} />
                            ) : (
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-[10px] font-bold text-white/40 uppercase tracking-wide">
                                  {plan.totalDays} Days · All 66 Books
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center pr-4">
                            <ChevronRight className="w-5 h-5 text-[#FDD000]" />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
