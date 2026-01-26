import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
// Card is used for search bar only
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, BookOpen, ChevronRight, Layers } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { BackButton } from "@/components/BackButton";

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
      <div className="liquid-header text-white px-6 pt-12 pb-6">
        <BackButton />
        <h1 className="text-4xl font-black mb-2 tracking-tighter uppercase" data-testid="text-library-title"><span className="text-white">Study</span> <span className="text-ministry-gold-exact">Library</span></h1>
        <p className="text-ministry-gold-exact text-xs font-bold tracking-widest uppercase" data-testid="text-library-subtitle">
          Grow Stronger In Faith And Character
        </p>
      </div>

      {/* Search Bar */}
      <div className="px-6 -mt-3 relative z-10 mb-6">
        <Card className="shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] liquid-gold-card border-2 border-black rounded-sm" data-testid="card-search">
          <CardContent className="p-4 relative z-10">
            <div className="relative">
              <Input
                type="text"
                placeholder="SEARCH STUDIES..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border-2 border-black rounded-sm pl-10 pr-4 py-3 text-sm text-black placeholder:text-black/50 placeholder:font-medium placeholder:text-xs placeholder:tracking-wide focus:ring-2 focus:ring-black font-medium"
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
        <div className="liquid-gold-card border-2 border-black rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] w-full md:w-64">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full bg-transparent border-0 text-black font-bold rounded-sm relative z-10" data-testid="select-category">
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
                <div className="space-y-2">
                  {filteredSeries.map((s) => (
                    <Link key={s.id} href={`/series/${s.id}`}>
                      <Button 
                        variant="outline"
                        className="h-16 w-full flex items-center justify-between liquid-gold-card hover:bg-yellow-400 border-2 border-black p-0 overflow-hidden rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all glow-gold"
                        data-testid={`series-card-${s.id}`}
                      >
                        <div className="h-full w-16 liquid-black flex items-center justify-center flex-shrink-0">
                          <Layers className="w-6 h-6 text-white relative z-10" />
                        </div>
                        <div className="flex-1 text-left px-4">
                          <span className="font-black text-sm text-black uppercase tracking-wide relative z-10 line-clamp-1" data-testid={`text-series-title-${s.id}`}>{s.title}</span>
                          <div className="flex items-center gap-2 text-xs text-black/70 font-medium mt-0.5">
                            <span>{s.studyCount} {s.studyCount === 1 ? 'Study' : 'Studies'}</span>
                            <span>•</span>
                            <span>{s.totalLessons} Lessons</span>
                          </div>
                        </div>
                        <div className="pr-4">
                          <ChevronRight className="w-6 h-6 text-black" />
                        </div>
                      </Button>
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
                <div className="space-y-2">
                  {filteredStudies.map((study: Study) => {
                    const progress = (userProgress as any[]).find((p: any) => p.studyId === study.id);
                    const isCompleted = progress?.isCompleted || false;
                    const hasStarted = !!progress && !isCompleted;
                    
                    const getTierLabel = (tier: string) => {
                      switch (tier) {
                        case 'premium': return 'Premium';
                        case 'vip': return 'VIP';
                        default: return 'Free';
                      }
                    };
                    
                    return (
                      <Link key={study.id} href={`/studies/${study.id}`}>
                        <Button 
                          variant="outline"
                          className="h-16 w-full flex items-center justify-between liquid-gold-card hover:bg-yellow-400 border-2 border-black p-0 overflow-hidden rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all glow-gold"
                          data-testid={`study-card-${study.id}`}
                        >
                          <div className="h-full w-16 liquid-black flex items-center justify-center flex-shrink-0">
                            <BookOpen className="w-6 h-6 text-white relative z-10" />
                          </div>
                          <div className="flex-1 text-left px-4">
                            <span className="font-black text-sm text-black uppercase tracking-wide relative z-10 line-clamp-1" data-testid={`text-study-title-${study.id}`}>{study.title}</span>
                            <div className="flex items-center gap-2 text-xs text-black/70 font-medium mt-0.5">
                              <span>{study.totalDays} {study.totalDays === 1 ? 'Day' : 'Days'}</span>
                              <span>•</span>
                              <span>{getTierLabel(study.requiredTier)}</span>
                              {isCompleted && <span className="text-green-700 font-bold">✓</span>}
                              {hasStarted && !isCompleted && <span className="text-black/50">In Progress</span>}
                            </div>
                          </div>
                          <div className="pr-4">
                            <ChevronRight className="w-6 h-6 text-black" />
                          </div>
                        </Button>
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
