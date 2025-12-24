import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, BookOpen, ChevronRight, Layers } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";

const categories = [
  { id: 'all', label: 'All Content' },
  { id: 'leadership', label: 'Leadership' },
  { id: 'marriage', label: 'Marriage' },
  { id: 'fatherhood', label: 'Fatherhood' },
  { id: 'character', label: 'Character' },
  { id: 'faith', label: 'Faith' },
];

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

export default function Library() {
  const { effectiveTheme } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { user, isAuthenticated } = useAuth();

  const { data: series = [], isLoading: seriesLoading } = useQuery<StudySeries[]>({
    queryKey: ["/api/study-series", selectedCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory && selectedCategory !== 'all') {
        params.append('category', selectedCategory);
      }
      const res = await fetch(`/api/study-series?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch series');
      return res.json();
    },
    retry: false,
    refetchInterval: 8000,
    refetchIntervalInBackground: true,
  });

  const { data: individualStudies = [], isLoading: studiesLoading } = useQuery<Study[]>({
    queryKey: ["/api/studies", "individual", selectedCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('individual', 'true');
      if (selectedCategory && selectedCategory !== 'all') {
        params.append('category', selectedCategory);
      }
      const res = await fetch(`/api/studies?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch studies');
      return res.json();
    },
    retry: false,
    refetchInterval: 8000,
    refetchIntervalInBackground: true,
  });

  const { data: userProgress = [] } = useQuery({
    queryKey: ["/api/progress"],
    enabled: isAuthenticated,
    retry: false,
  });

  const isLoading = seriesLoading || studiesLoading;

  const filteredSeries = series.filter((s) => {
    if (!searchQuery) return true;
    return s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
           s.description.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredStudies = individualStudies.filter((s) => {
    if (!searchQuery) return true;
    return s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
           s.description.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const hasContent = filteredSeries.length > 0 || filteredStudies.length > 0;

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-ministry-navy to-ministry-charcoal dark:from-header-dark dark:to-ministry-navy text-white px-6 pt-12 pb-6">
        <h1 className="text-4xl font-black mb-2 tracking-tighter uppercase" data-testid="text-library-title"><span className="text-white">Study</span> <span className="text-ministry-gold-exact">Library</span></h1>
        <p className="text-ministry-gold-exact text-xs font-bold tracking-widest uppercase" data-testid="text-library-subtitle">
          Grow Stronger In Faith And Character
        </p>
      </div>

      {/* Search Bar */}
      <div className="px-6 -mt-3 relative z-10 mb-6">
        <Card className="shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-ministry-gold-exact border-2 border-black rounded-none" data-testid="card-search">
          <CardContent className="p-4">
            <div className="relative">
              <Input
                type="text"
                placeholder="SEARCH STUDIES..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border-2 border-black rounded-none pl-10 pr-4 py-3 text-sm text-black placeholder:text-black/50 placeholder:font-medium placeholder:text-xs placeholder:tracking-wide focus:ring-2 focus:ring-black font-medium"
                data-testid="input-search"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-black" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Categories Filter - Dropdown */}
      <div className="px-6 mb-6">
        <label className="text-xs font-black text-white mb-2 block uppercase tracking-wide">
          Category
        </label>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full md:w-64 bg-ministry-gold-exact border-2 border-black text-black font-bold rounded-none" data-testid="select-category">
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id} data-testid={`option-category-${category.id}`}>
                {category.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      <div className="px-6 space-y-6">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ministry-gold-exact mx-auto mb-4"></div>
            <p className="text-gray-400">Loading...</p>
          </div>
        ) : !hasContent ? (
          <div className="text-center py-8" data-testid="empty-library">
            <Layers className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">
              {searchQuery || selectedCategory !== 'all' 
                ? 'No content found for your filters.' 
                : 'No studies available yet.'}
            </p>
          </div>
        ) : (
          <>
            {/* Series Section */}
            {filteredSeries.length > 0 && (
              <div>
                <h2 className="text-white font-black text-lg mb-4 flex items-center gap-2 tracking-tight uppercase">
                  <Layers className="w-5 h-5 text-ministry-gold-exact" />
                  Study Series
                </h2>
                <div className="space-y-4">
                  {filteredSeries.map((s) => (
                    <Link key={s.id} href={`/series/${s.id}`}>
                      <Card 
                        className="bg-black border-2 border-ministry-gold-exact/50 hover:border-ministry-gold-exact hover:shadow-[4px_4px_0px_0px_rgba(252,208,0,0.3)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all cursor-pointer rounded-none"
                        data-testid={`series-card-${s.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-16 h-16 bg-gray-800 rounded-none flex items-center justify-center overflow-hidden border border-ministry-gold-exact/30">
                              {s.thumbnailUrl ? (
                                <img 
                                  src={s.thumbnailUrl} 
                                  alt={s.title}
                                  className="w-full h-full object-cover grayscale-[30%] contrast-[1.1]"
                                />
                              ) : (
                                <Layers className="w-8 h-8 text-ministry-gold-exact" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <h3 className="text-white font-black text-lg mb-1 line-clamp-1 tracking-tight" data-testid={`text-series-title-${s.id}`}>
                                {s.title}
                              </h3>
                              <p className="text-gray-400 text-sm mb-3 line-clamp-2">
                                {s.description}
                              </p>
                              <div className="flex items-center gap-4 text-xs text-gray-400 font-medium">
                                <span className="flex items-center gap-1 bg-white/10 px-2 py-0.5">
                                  <BookOpen className="w-3.5 h-3.5" />
                                  {s.studyCount} {s.studyCount === 1 ? 'Study' : 'Studies'}
                                </span>
                                <span className="bg-white/10 px-2 py-0.5">
                                  {s.totalLessons} {s.totalLessons === 1 ? 'Lesson' : 'Lessons'}
                                </span>
                              </div>
                            </div>

                            <div className="flex-shrink-0 self-center">
                              <ChevronRight className="w-5 h-5 text-ministry-gold-exact" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Individual Studies Section */}
            {filteredStudies.length > 0 && (
              <div>
                <h2 className="text-white font-black text-lg mb-4 flex items-center gap-2 tracking-tight uppercase">
                  <BookOpen className="w-5 h-5 text-ministry-gold-exact" />
                  Individual Studies
                </h2>
                <div className="space-y-4">
                  {filteredStudies.map((study: Study) => {
                    const progress = (userProgress as any[]).find((p: any) => p.studyId === study.id);
                    const isCompleted = progress?.isCompleted || false;
                    const hasStarted = !!progress && !isCompleted;
                    
                    const getTierBadge = (tier: string) => {
                      switch (tier) {
                        case 'premium':
                          return <span className="text-xs bg-ministry-steel/20 text-ministry-steel px-2 py-0.5 rounded-none font-bold uppercase tracking-wide">Premium</span>;
                        case 'vip':
                          return <span className="text-xs bg-ministry-gold-exact text-black px-2 py-0.5 rounded-none font-black uppercase tracking-wide">VIP</span>;
                        default:
                          return <span className="text-xs bg-white/10 text-gray-400 px-2 py-0.5 rounded-none font-bold uppercase tracking-wide">Free</span>;
                      }
                    };
                    
                    return (
                      <Link key={study.id} href={`/studies/${study.id}`}>
                        <Card 
                          className="bg-black border-2 border-ministry-gold-exact/50 hover:border-ministry-gold-exact hover:shadow-[4px_4px_0px_0px_rgba(252,208,0,0.3)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all cursor-pointer rounded-none"
                          data-testid={`study-card-${study.id}`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-4">
                              <div className="flex-shrink-0 w-16 h-16 bg-gray-800 rounded-none flex items-center justify-center overflow-hidden border border-ministry-gold-exact/30">
                                {study.thumbnailUrl ? (
                                  <img 
                                    src={study.thumbnailUrl} 
                                    alt={study.title}
                                    className="w-full h-full object-cover grayscale-[30%] contrast-[1.1]"
                                  />
                                ) : (
                                  <BookOpen className="w-8 h-8 text-ministry-gold-exact" />
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <h3 className="text-white font-black text-lg mb-1 line-clamp-1 tracking-tight" data-testid={`text-study-title-${study.id}`}>
                                  {study.title}
                                </h3>
                                <p className="text-gray-400 text-sm mb-3 line-clamp-2">
                                  {study.description}
                                </p>
                                <div className="flex items-center gap-4 text-xs text-gray-400 font-medium">
                                  <span className="flex items-center gap-1">
                                    <BookOpen className="w-3.5 h-3.5" />
                                    {study.totalDays} {study.totalDays === 1 ? 'Day' : 'Days'}
                                  </span>
                                  {getTierBadge(study.requiredTier)}
                                  {isCompleted && (
                                    <span className="text-ministry-gold-exact font-medium">✓ Completed</span>
                                  )}
                                  {hasStarted && !isCompleted && (
                                    <span className="text-ministry-gold-exact font-medium">In Progress</span>
                                  )}
                                </div>
                              </div>

                              <div className="flex-shrink-0 self-center">
                                <ChevronRight className="w-5 h-5 text-gray-500" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
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
