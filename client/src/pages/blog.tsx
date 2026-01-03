import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, User, Search, Star, FileText, Share2, Mail, Link2 } from "lucide-react";
import { SiFacebook, SiX, SiWhatsapp } from "react-icons/si";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { BlogPost } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { BackButton } from "@/components/BackButton";

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
      <div className="liquid-header text-white px-6 pt-12 pb-6 border-b-4 border-ministry-gold-exact">
        <div className="max-w-4xl mx-auto">
          <BackButton />
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
              <Card key={i} className="liquid-gold-card border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <CardContent className="p-3 relative z-10">
                  <div className="animate-pulse flex gap-3">
                    <div className="w-20 h-20 bg-black/20 flex-shrink-0"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-black/20 w-3/4"></div>
                      <div className="h-3 bg-black/20 w-full"></div>
                      <div className="h-3 bg-black/20 w-1/2"></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredBlogs.length === 0 ? (
          <Card className="liquid-gold-card border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-center py-8 overflow-hidden">
            <CardContent className="relative z-10">
              <h3 className="text-lg font-black uppercase tracking-tighter mb-2 text-black">No Blog Posts Found</h3>
              <p className="text-black/80 font-medium text-sm">
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
  const { toast } = useToast();

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/blog/${blog.slug}`;
    const shareText = `${blog.title} - Check out this article from Man Up God's Way, a faith-based platform helping men grow in their walk with Christ.`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: blog.title,
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
    }
  };

  return (
    <Card 
      className={`border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all overflow-hidden ${
        featured ? 'liquid-black text-white' : 'liquid-gold-card text-black'
      }`}
      onClick={() => navigate(`/blog/${blog.slug}`)}
      data-testid={`card-blog-${blog.id}`}
    >
      <CardContent className="p-0">
        <div className="flex flex-row relative z-10">
          <div className={`w-20 h-20 flex-shrink-0 border-r-2 border-black overflow-hidden ${
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
                <FileText className={`w-8 h-8 ${featured ? 'text-black/30' : 'text-white/30'}`} />
              </div>
            )}
          </div>
          <div className="p-3 flex-1 min-w-0">
            <div className="flex flex-wrap gap-2 mb-2">
              <span className={`text-xs font-black uppercase px-2 py-0.5 rounded-none ${
                featured 
                  ? 'bg-ministry-gold-exact text-black' 
                  : 'bg-black text-white'
              }`}>
                {blog.category}
              </span>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className={`text-xs font-bold uppercase px-2 py-1 flex items-center gap-1 hover:opacity-80 ${
                      featured 
                        ? 'bg-white/20 text-white' 
                        : 'bg-black/20 text-black'
                    }`}
                    data-testid={`button-share-blog-${blog.id}`}
                  >
                    <Share2 className="w-3 h-3" />
                    Share
                  </button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-auto p-2 bg-black border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex gap-2">
                    <a
                      href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${window.location.origin}/blog/${blog.slug}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-[#1877F2] text-white rounded-none hover:opacity-80 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <SiFacebook className="w-5 h-5" />
                    </a>
                    <a
                      href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${blog.title} - Check out this article from Man Up God's Way!`)}&url=${encodeURIComponent(`${window.location.origin}/blog/${blog.slug}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-black text-white border border-white rounded-none hover:opacity-80 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <SiX className="w-5 h-5" />
                    </a>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(`${blog.title} - Check out this article from Man Up God's Way! ${window.location.origin}/blog/${blog.slug}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-[#25D366] text-white rounded-none hover:opacity-80 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <SiWhatsapp className="w-5 h-5" />
                    </a>
                    <a
                      href={`mailto:?subject=${encodeURIComponent(blog.title)}&body=${encodeURIComponent(`Check out this article from Man Up God's Way:\n\n${blog.title}\n\n${window.location.origin}/blog/${blog.slug}`)}`}
                      className="p-2 bg-gray-600 text-white rounded-none hover:opacity-80 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Mail className="w-5 h-5" />
                    </a>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(`${window.location.origin}/blog/${blog.slug}`);
                        toast({ title: "Link copied!", description: "The link has been copied to your clipboard" });
                      }}
                      className="p-2 bg-ministry-gold-exact text-black rounded-none hover:opacity-80 transition-opacity"
                    >
                      <Link2 className="w-5 h-5" />
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            
            <h3 className={`text-base font-black uppercase tracking-tight mb-1 truncate ${
              featured ? 'text-white' : 'text-black'
            }`}>
              {blog.title}
            </h3>
            
            {blog.excerpt && (
              <p className={`text-xs mb-2 line-clamp-1 ${
                featured ? 'text-white/80' : 'text-black/70'
              }`}>
                {blog.excerpt}
              </p>
            )}
            
            <div className={`flex flex-wrap items-center gap-3 text-xs ${
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
