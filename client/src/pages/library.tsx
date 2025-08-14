import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StudyCard from "@/components/study-card";
import { Search, Star } from "lucide-react";
import { Link } from "wouter";

const categories = [
  { id: 'all', label: 'All Studies' },
  { id: 'leadership', label: 'Leadership' },
  { id: 'marriage', label: 'Marriage' },
  { id: 'fatherhood', label: 'Fatherhood' },
  { id: 'character', label: 'Character' },
];

export default function Library() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: studies = [], isLoading } = useQuery({
    queryKey: ["/api/studies", selectedCategory !== 'all' ? selectedCategory : undefined],
    retry: false,
  });

  const { data: searchResults = [] } = useQuery({
    queryKey: ["/api/studies/search", searchQuery],
    enabled: searchQuery.length > 2,
    retry: false,
  });

  const displayStudies = searchQuery.length > 2 ? searchResults : studies;
  const featuredStudy = studies.find((study: any) => study.category === 'character');

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-ministry-navy to-ministry-charcoal text-white px-6 pt-12 pb-6">
        <h1 className="text-2xl font-bold mb-2" data-testid="text-library-title">Study Library</h1>
        <p className="text-blue-200 text-sm" data-testid="text-library-subtitle">
          Grow stronger in faith and character
        </p>
      </div>

      {/* Search Bar */}
      <div className="px-6 -mt-3 relative z-10 mb-6">
        <Card className="shadow-lg" data-testid="card-search">
          <CardContent className="p-4">
            <div className="relative">
              <Input
                type="text"
                placeholder="Search studies, topics, or verses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-50 rounded-xl pl-10 pr-4 py-3 text-sm border-0 focus:ring-2 focus:ring-ministry-steel focus:bg-white"
                data-testid="input-search"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-ministry-slate" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Categories Filter */}
      <div className="px-6 mb-6">
        <div className="flex space-x-3 overflow-x-auto scrollbar-hide">
          {categories.map((category) => (
            <Button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              variant={selectedCategory === category.id ? "default" : "outline"}
              className={`px-6 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                selectedCategory === category.id
                  ? "bg-ministry-navy text-white"
                  : "bg-gray-100 text-ministry-slate hover:bg-gray-200"
              }`}
              data-testid={`button-category-${category.id}`}
            >
              {category.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Featured Study */}
      {featuredStudy && selectedCategory === 'all' && (
        <div className="px-6 mb-6">
          <Card className="bg-gradient-to-br from-ministry-steel to-ministry-navy text-white relative overflow-hidden" data-testid="card-featured">
            <CardContent className="p-6">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
              <div className="relative z-10">
                <div className="inline-flex items-center bg-ministry-gold/20 text-ministry-gold px-3 py-1 rounded-full text-xs font-medium mb-3">
                  <Star className="w-3 h-3 mr-1" fill="currentColor" />
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
                    className="bg-white text-ministry-navy hover:bg-gray-100"
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
        ) : displayStudies.length === 0 ? (
          <div className="text-center py-8" data-testid="empty-studies">
            <p className="text-ministry-slate">
              {searchQuery.length > 2 ? 'No studies found for your search.' : 'No studies available.'}
            </p>
          </div>
        ) : (
          displayStudies.map((study: any) => (
            <StudyCard 
              key={study.id} 
              study={study} 
              data-testid={`study-card-${study.id}`}
            />
          ))
        )}
      </div>
    </div>
  );
}
