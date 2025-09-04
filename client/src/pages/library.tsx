import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StudyCard from "@/components/study-card";
import { Search, Star, Filter } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";

const categories = [
  { id: 'all', label: 'All Studies' },
  { id: 'leadership', label: 'Leadership' },
  { id: 'marriage', label: 'Marriage' },
  { id: 'fatherhood', label: 'Fatherhood' },
  { id: 'character', label: 'Character' },
];

export default function Library() {
  const { effectiveTheme } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [hoursFilter, setHoursFilter] = useState('all');
  const [lessonsFilter, setLessonsFilter] = useState('all');
  const [videoFilter, setVideoFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Add mouse wheel horizontal scroll support
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Prevent default vertical scroll
      e.preventDefault();
      // Scroll horizontally instead
      container.scrollLeft += e.deltaY;
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  const { user, isAuthenticated } = useAuth();

  const { data: studies = [], isLoading } = useQuery({
    queryKey: ["/api/studies"],
    retry: false,
    refetchInterval: 8000, // Real-time updates every 8 seconds for new studies
    refetchIntervalInBackground: true,
  });

  const { data: searchResults = [] } = useQuery({
    queryKey: ["/api/studies/search", searchQuery],
    enabled: searchQuery.length > 2,
    retry: false,
    refetchInterval: 8000, // Real-time updates for search results
    refetchIntervalInBackground: true,
  });

  // Fetch user progress data
  const { data: userProgress = [] } = useQuery({
    queryKey: ["/api/progress"],
    enabled: isAuthenticated,
    retry: false,
    refetchInterval: 10000, // Update user progress every 10 seconds
    refetchIntervalInBackground: true,
  });

  // Fetch user purchases to determine tier badge visibility
  const { data: userPurchases = [] } = useQuery({
    queryKey: ["/api/purchases"],
    enabled: isAuthenticated,
    retry: false,
    refetchInterval: 10000, // Update user purchases every 10 seconds
    refetchIntervalInBackground: true,
  });

  // Filter studies based on all criteria
  const allStudies = (searchQuery.length > 2 ? searchResults : studies) as any[];
  const filteredStudies = allStudies.filter((study: any) => {
    const categoryMatch = selectedCategory === 'all' || study.category === selectedCategory;
    const difficultyMatch = difficultyFilter === 'all' || study.difficulty === difficultyFilter;
    const hoursMatch = hoursFilter === 'all' || 
      (hoursFilter === '1-2' && study.estimatedHours >= 1 && study.estimatedHours <= 2) ||
      (hoursFilter === '3-5' && study.estimatedHours >= 3 && study.estimatedHours <= 5) ||
      (hoursFilter === '6+' && study.estimatedHours >= 6);
    const lessonsMatch = lessonsFilter === 'all' ||
      (lessonsFilter === '1-5' && study.lessonCount >= 1 && study.lessonCount <= 5) ||
      (lessonsFilter === '6-10' && study.lessonCount >= 6 && study.lessonCount <= 10) ||
      (lessonsFilter === '11+' && study.lessonCount >= 11);
    const videoMatch = videoFilter === 'all' ||
      (videoFilter === 'with-video' && study.videoUrl && study.videoUrl.trim() !== '') ||
      (videoFilter === 'without-video' && (!study.videoUrl || study.videoUrl.trim() === ''));
    
    return categoryMatch && difficultyMatch && hoursMatch && lessonsMatch && videoMatch;
  });

  const featuredStudy = (studies as any[]).find((study: any) => study.isFeatured);

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-ministry-navy to-ministry-charcoal dark:from-header-dark dark:to-ministry-navy text-white px-6 pt-12 pb-6">
        <h1 className="text-2xl font-bold mb-2" data-testid="text-library-title">Study Library</h1>
        <p className="text-blue-200 text-sm" data-testid="text-library-subtitle">
          Grow stronger in faith and character
        </p>
      </div>

      {/* Search Bar */}
      <div className="px-6 -mt-3 relative z-10 mb-6">
        <Card className="shadow-lg bg-ministry-gold-exact/20" data-testid="card-search">
          <CardContent className="p-4">
            <div className="relative">
              <Input
                type="text"
                placeholder="Search studies, topics, or verses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-muted rounded-xl pl-10 pr-4 py-3 text-sm border-0 focus:ring-2 focus:ring-ministry-steel focus:bg-background"
                data-testid="input-search"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-ministry-slate" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Categories Filter - Horizontal Scroll */}
      <div className="px-6 mb-4">
        <div 
          ref={scrollContainerRef}
          className="flex space-x-3 overflow-x-auto scrollbar-hide horizontal-scroll pb-2"
        >
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              style={{
                backgroundColor: selectedCategory === category.id 
                  ? 'hsl(0 0% 0%)' 
                  : effectiveTheme === 'dark' 
                    ? 'hsl(220 8% 26%)' 
                    : 'hsl(240 1.9608% 90%)',
                color: selectedCategory === category.id 
                  ? 'white' 
                  : effectiveTheme === 'dark' 
                    ? 'hsl(0 0% 95%)' 
                    : 'hsl(210 25% 7.8431%)',
                borderColor: selectedCategory === category.id 
                  ? 'hsl(0 0% 0%)' 
                  : effectiveTheme === 'dark' 
                    ? 'hsl(210 5.2632% 14.9020%)' 
                    : 'hsl(201.4286 30.4348% 90.9804%)'
              }}
              className="px-6 py-2 rounded-full text-sm font-medium whitespace-nowrap flex-shrink-0 snap-start border cursor-pointer transition-colors"
              data-testid={`button-category-${category.id}`}
            >
              {category.label}
            </button>
          ))}
        </div>
      </div>

      {/* Additional Filters */}
      <div className="px-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-ministry-slate">Filters</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="text-ministry-navy"
          >
            <Filter className="w-4 h-4 mr-1" />
            {showFilters ? 'Hide' : 'Show'} Filters
          </Button>
        </div>
        
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-medium text-ministry-slate mb-1 block">
                Difficulty Level
              </label>
              <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
                <SelectTrigger className="w-full h-8 text-sm">
                  <SelectValue placeholder="Any level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any level</SelectItem>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-xs font-medium text-ministry-slate mb-1 block">
                Estimated Hours
              </label>
              <Select value={hoursFilter} onValueChange={setHoursFilter}>
                <SelectTrigger className="w-full h-8 text-sm">
                  <SelectValue placeholder="Any duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any duration</SelectItem>
                  <SelectItem value="1-2">1-2 hours</SelectItem>
                  <SelectItem value="3-5">3-5 hours</SelectItem>
                  <SelectItem value="6+">6+ hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-xs font-medium text-ministry-slate mb-1 block">
                Number of Lessons
              </label>
              <Select value={lessonsFilter} onValueChange={setLessonsFilter}>
                <SelectTrigger className="w-full h-8 text-sm">
                  <SelectValue placeholder="Any count" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any count</SelectItem>
                  <SelectItem value="1-5">1-5 lessons</SelectItem>
                  <SelectItem value="6-10">6-10 lessons</SelectItem>
                  <SelectItem value="11+">11+ lessons</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-xs font-medium text-ministry-slate mb-1 block">
                Video Content
              </label>
              <Select value={videoFilter} onValueChange={setVideoFilter}>
                <SelectTrigger className="w-full h-8 text-sm">
                  <SelectValue placeholder="Any type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any type</SelectItem>
                  <SelectItem value="with-video">With video</SelectItem>
                  <SelectItem value="without-video">Without video</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Featured Study */}
      {featuredStudy && selectedCategory === 'all' && (
        <div className="px-6 mb-6">
          <Card className="bg-gradient-to-br from-ministry-steel to-ministry-navy dark:from-featured-dark dark:to-featured-dark-secondary text-white relative overflow-hidden" data-testid="card-featured">
            <CardContent className="p-6">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
              <div className="relative z-10">
                <div className="inline-flex items-center bg-ministry-gold-exact/20 text-black px-3 py-1 rounded-full text-xs font-medium mb-3">
                  <Star className="w-3 h-3 mr-1 text-black" fill="currentColor" />
                  Featured
                </div>
                <h3 className="text-lg font-bold mb-2" data-testid="text-featured-title">
                  {featuredStudy.title}
                </h3>
                <p className="text-blue-100 text-sm mb-4" data-testid="text-featured-description">
                  {featuredStudy.description}
                </p>
                <Link href={`/studies/${featuredStudy.id}`}>
                  <Button 
                    className="bg-card text-foreground hover:bg-muted"
                    data-testid="button-start-featured"
                  >
                    Start Study
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Study List */}
      <div className="px-6 space-y-4">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ministry-navy mx-auto mb-4"></div>
            <p className="text-ministry-slate">Loading studies...</p>
          </div>
        ) : filteredStudies.length === 0 ? (
          <div className="text-center py-8" data-testid="empty-studies">
            <p className="text-ministry-slate">
              {searchQuery.length > 2 || difficultyFilter !== 'all' || hoursFilter !== 'all' || lessonsFilter !== 'all' || videoFilter !== 'all' || selectedCategory !== 'all' 
                ? 'No studies found for your filters.' 
                : 'No studies available.'}
            </p>
          </div>
        ) : (
          filteredStudies.map((study: any) => {
            // Find completion status for this study
            const progress = (userProgress as any[]).find((p: any) => p.studyId === study.id);
            const isCompleted = progress?.isCompleted || false;
            const completedAt = progress?.completedAt;
            
            // Check if user has purchased this study
            const hasPurchased = (userPurchases as any[]).some((p: any) => p.studyId === study.id && p.status === 'completed');
            
            // Hide tier badge if study requires purchase for current user's tier and they haven't purchased it
            const shouldHideTierBadge = study.requiresPurchase && 
              study.purchaseRequiredTiers?.includes(user?.subscriptionTier || 'free') && 
              !hasPurchased;
            
            return (
              <StudyCard 
                key={study.id} 
                study={study} 
                isCompleted={isCompleted}
                completedAt={completedAt}
                hideTierBadge={shouldHideTierBadge}
                data-testid={`study-card-${study.id}`}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
