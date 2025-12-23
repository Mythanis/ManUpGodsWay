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
import StudyCard from "@/components/study-card";

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
        <h1 className="text-4xl font-black mb-2 tracking-tight" data-testid="text-library-title">Study Library</h1>
        <p className="text-ministry-gold-exact text-sm font-semibold" data-testid="text-library-subtitle">
          Grow Stronger In Faith And Character
        </p>
      </div>

      {/* Search Bar */}
      <div className="px-6 -mt-3 relative z-10 mb-6">
        <Card className="shadow-lg bg-black border-2 border-black" data-testid="card-search">
          <CardContent className="p-4">
            <div className="relative">
              <Input
                type="text"
                placeholder="Search studies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-800 border-gray-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-400 focus:ring-2 focus:ring-ministry-gold-exact focus:bg-gray-800"
                data-testid="input-search"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Categories Filter - Dropdown */}
      <div className="px-6 mb-6">
        <label className="text-xs font-medium text-gray-400 mb-1 block">
          Category
        </label>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full md:w-64 bg-gray-800 border-gray-700 text-white" data-testid="select-category">
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
                <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-ministry-gold-exact" />
                  Study Series
                </h2>
                <div className="space-y-4">
                  {filteredSeries.map((s) => (
                    <Link key={s.id} href={`/series/${s.id}`}>
                      <Card 
                        className="bg-black border border-gray-800 hover:border-ministry-gold-exact transition-colors cursor-pointer"
                        data-testid={`series-card-${s.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-16 h-16 bg-gray-800 rounded-lg flex items-center justify-center">
                              {s.thumbnailUrl ? (
                                <img 
                                  src={s.thumbnailUrl} 
                                  alt={s.title}
                                  className="w-full h-full object-cover rounded-lg"
                                />
                              ) : (
                                <Layers className="w-8 h-8 text-ministry-gold-exact" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <h3 className="text-white font-bold text-lg mb-1 line-clamp-1" data-testid={`text-series-title-${s.id}`}>
                                {s.title}
                              </h3>
                              <p className="text-gray-400 text-sm mb-3 line-clamp-2">
                                {s.description}
                              </p>
                              <div className="flex items-center gap-4 text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                  <BookOpen className="w-3.5 h-3.5" />
                                  {s.studyCount} {s.studyCount === 1 ? 'Study' : 'Studies'}
                                </span>
                                <span>
                                  {s.totalLessons} {s.totalLessons === 1 ? 'Lesson' : 'Lessons'}
                                </span>
                              </div>
                            </div>

                            <div className="flex-shrink-0 self-center">
                              <ChevronRight className="w-5 h-5 text-gray-500" />
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
                <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-ministry-gold-exact" />
                  Individual Studies
                </h2>
                <div className="space-y-4">
                  {filteredStudies.map((study: any) => {
                    const progress = (userProgress as any[]).find((p: any) => p.studyId === study.id);
                    const isCompleted = progress?.isCompleted || false;
                    const completedAt = progress?.completedAt;
                    const hasStarted = !!progress && !isCompleted;
                    
                    return (
                      <StudyCard 
                        key={study.id} 
                        study={study} 
                        isCompleted={isCompleted}
                        completedAt={completedAt}
                        hasStarted={hasStarted}
                        data-testid={`study-card-${study.id}`}
                      />
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
