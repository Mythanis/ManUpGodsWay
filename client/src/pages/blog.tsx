import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Calendar, User, ExternalLink, Search, Star, FileText } from "lucide-react";
import type { BlogPost } from "@shared/schema";

const CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "general", label: "General" },
  { value: "faith", label: "Faith" },
  { value: "leadership", label: "Leadership" },
  { value: "marriage", label: "Marriage" },
  { value: "fatherhood", label: "Fatherhood" },
  { value: "character", label: "Character" },
  { value: "devotional", label: "Devotional" },
];

export default function Blog() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const { data: blogs = [], isLoading } = useQuery<BlogPost[]>({
    queryKey: ['/api/blogs'],
  });

  const filteredBlogs = blogs.filter(blog => {
    const matchesSearch = blog.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (blog.excerpt && blog.excerpt.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === "all" || blog.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const featuredBlogs = filteredBlogs.filter(blog => blog.isFeatured);
  const regularBlogs = filteredBlogs.filter(blog => !blog.isFeatured);

  const formatDate = (date: string | Date | null) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  return (
    <div className="min-h-screen bg-ministry-light-gray pb-20">
      <div className="bg-black text-white px-6 pt-12 pb-6 border-b-4 border-ministry-gold-exact">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-black mb-2 tracking-tighter uppercase">
            <span className="text-white">Ministry</span> <span className="text-ministry-gold-exact">Blog</span>
          </h1>
          <p className="text-ministry-gold-exact text-sm font-bold uppercase tracking-wide">
            Insights, Devotionals, And Encouragement For Men Of Faith
          </p>
        </div>
      </div>

      <div className="px-6 py-6 max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-black/50" />
            <Input
              placeholder="Search blog posts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 rounded-none border-2 border-black bg-ministry-gold-exact text-black placeholder:text-black/50 font-medium"
              data-testid="input-blog-search"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger 
              className="w-full sm:w-48 rounded-none border-2 border-black bg-ministry-gold-exact text-black font-bold uppercase"
              data-testid="select-blog-category"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="bg-ministry-gold-exact border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <CardContent className="p-6">
                  <div className="animate-pulse space-y-3">
                    <div className="h-6 bg-black/20 rounded-none w-3/4"></div>
                    <div className="h-4 bg-black/20 rounded-none w-full"></div>
                    <div className="h-4 bg-black/20 rounded-none w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredBlogs.length === 0 ? (
          <Card className="bg-ministry-gold-exact border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-center py-12">
            <CardContent>
              <h3 className="text-xl font-black uppercase tracking-tighter mb-2 text-black">No Blog Posts Found</h3>
              <p className="text-black/80 font-medium">
                {searchQuery || selectedCategory !== "all" 
                  ? "Try adjusting your search or filter criteria."
                  : "Check back soon for new content!"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {featuredBlogs.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-black uppercase tracking-tighter text-black flex items-center gap-2">
                  <Star className="w-5 h-5 text-ministry-gold-exact fill-ministry-gold-exact" />
                  Featured Posts
                </h2>
                {featuredBlogs.map((blog) => (
                  <BlogCard key={blog.id} blog={blog} featured formatDate={formatDate} />
                ))}
              </div>
            )}

            {regularBlogs.length > 0 && (
              <div className="space-y-4">
                {featuredBlogs.length > 0 && (
                  <h2 className="text-lg font-black uppercase tracking-tighter text-black">
                    All Posts
                  </h2>
                )}
                {regularBlogs.map((blog) => (
                  <BlogCard key={blog.id} blog={blog} formatDate={formatDate} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function BlogCard({ blog, featured, formatDate }: { 
  blog: BlogPost; 
  featured?: boolean;
  formatDate: (date: string | Date | null) => string;
}) {
  const [, navigate] = useLocation();

  return (
    <Card 
      className={`border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-shadow ${
        featured ? 'bg-black text-white' : 'bg-ministry-gold-exact text-black'
      }`}
      onClick={() => navigate(`/blog/${blog.slug}`)}
      data-testid={`card-blog-${blog.id}`}
    >
      <CardContent className="p-0">
        <div className="flex flex-col md:flex-row">
          <div className={`w-full md:w-48 h-48 md:h-auto min-h-[120px] flex-shrink-0 border-b-2 md:border-b-0 md:border-r-2 border-black overflow-hidden ${
            !blog.coverImageUrl ? (featured ? 'bg-ministry-gold-exact' : 'bg-black') : ''
          }`}>
            {blog.coverImageUrl ? (
              <img
                src={blog.coverImageUrl}
                alt={blog.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <FileText className={`w-16 h-16 ${featured ? 'text-black/30' : 'text-white/30'}`} />
              </div>
            )}
          </div>
          <div className="p-6 flex-1">
            <div className="flex flex-wrap gap-2 mb-3">
              <span className={`text-xs font-black uppercase px-2 py-1 ${
                featured 
                  ? 'bg-ministry-gold-exact text-black' 
                  : 'bg-black text-white'
              }`}>
                {blog.category}
              </span>
              {blog.externalUrl && (
                <span className={`text-xs font-bold uppercase px-2 py-1 flex items-center gap-1 ${
                  featured 
                    ? 'bg-white/20 text-white' 
                    : 'bg-black/20 text-black'
                }`}>
                  <ExternalLink className="w-3 h-3" />
                  External
                </span>
              )}
            </div>
            
            <h3 className={`text-xl font-black uppercase tracking-tight mb-2 ${
              featured ? 'text-white' : 'text-black'
            }`}>
              {blog.title}
            </h3>
            
            {blog.excerpt && (
              <p className={`text-sm mb-4 line-clamp-2 ${
                featured ? 'text-white/80' : 'text-black/70'
              }`}>
                {blog.excerpt}
              </p>
            )}
            
            <div className={`flex flex-wrap items-center gap-4 text-xs ${
              featured ? 'text-white/60' : 'text-black/60'
            }`}>
              {blog.authorName && (
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  <span className="font-medium">{blog.authorName}</span>
                </div>
              )}
              {blog.publishedAt && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>{formatDate(blog.publishedAt)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
