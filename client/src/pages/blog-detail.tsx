import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, User, ExternalLink, Share2, FileText } from "lucide-react";
import type { BlogPost } from "@shared/schema";

export default function BlogDetail() {
  const { slug } = useParams();
  const [, navigate] = useLocation();

  const { data: blog, isLoading, error } = useQuery<BlogPost>({
    queryKey: ['/api/blogs', slug],
    queryFn: async () => {
      const response = await fetch(`/api/blogs/${slug}`);
      if (!response.ok) throw new Error('Blog not found');
      return response.json();
    },
    enabled: !!slug,
  });

  const formatDate = (date: string | Date | null) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: blog?.title,
          text: blog?.excerpt || '',
          url: window.location.href,
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-ministry-light-gray pb-20">
        <div className="bg-black text-white px-6 pt-12 pb-6 border-b-4 border-ministry-gold-exact">
          <div className="max-w-3xl mx-auto">
            <div className="animate-pulse">
              <div className="h-8 bg-white/20 rounded-none w-3/4 mb-4"></div>
              <div className="h-4 bg-white/10 rounded-none w-1/2"></div>
            </div>
          </div>
        </div>
        <div className="px-6 py-6 max-w-3xl mx-auto">
          <Card className="bg-ministry-gold-exact border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <CardContent className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-black/20 rounded-none w-full"></div>
                <div className="h-4 bg-black/20 rounded-none w-full"></div>
                <div className="h-4 bg-black/20 rounded-none w-3/4"></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !blog) {
    return (
      <div className="min-h-screen bg-ministry-light-gray pb-20">
        <div className="bg-black text-white px-6 pt-12 pb-6 border-b-4 border-ministry-gold-exact">
          <div className="max-w-3xl mx-auto">
            <Button
              variant="ghost"
              onClick={() => navigate('/blog')}
              className="text-ministry-gold-exact hover:bg-white/10 mb-4 rounded-none font-bold uppercase"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Blog
            </Button>
          </div>
        </div>
        <div className="px-6 py-6 max-w-3xl mx-auto">
          <Card className="bg-ministry-gold-exact border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-center py-12">
            <CardContent>
              <h3 className="text-xl font-black uppercase tracking-tighter mb-2 text-black">Blog Post Not Found</h3>
              <p className="text-black/80 font-medium mb-4">
                This blog post may have been removed or doesn't exist.
              </p>
              <Button
                onClick={() => navigate('/blog')}
                className="bg-black text-white rounded-none border-2 border-black font-bold uppercase hover:bg-gray-800"
              >
                View All Posts
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ministry-light-gray pb-20">
      <div className="bg-black text-white px-6 pt-12 pb-6 border-b-4 border-ministry-gold-exact">
        <div className="max-w-3xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate('/blog')}
            className="text-ministry-gold-exact hover:bg-white/10 mb-4 rounded-none font-bold uppercase"
            data-testid="button-back-blog"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Blog
          </Button>
          
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="text-xs font-black uppercase px-2 py-1 bg-ministry-gold-exact text-black">
              {blog.category}
            </span>
            {blog.externalUrl && (
              <a 
                href={blog.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold uppercase px-2 py-1 bg-white/20 text-white flex items-center gap-1 hover:bg-white/30"
              >
                <ExternalLink className="w-3 h-3" />
                View Original
              </a>
            )}
          </div>
          
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase mb-4">
            {blog.title}
          </h1>
          
          <div className="flex flex-wrap items-center gap-4 text-sm text-white/70">
            {blog.authorName && (
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" />
                <span className="font-medium">{blog.authorName}</span>
              </div>
            )}
            {blog.publishedAt && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(blog.publishedAt)}</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleShare}
              className="text-ministry-gold-exact hover:bg-white/10 rounded-none font-bold uppercase"
              data-testid="button-share-blog"
            >
              <Share2 className="w-4 h-4 mr-1" />
              Share
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 -mt-4">
        <div className="border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
          {blog.coverImageUrl ? (
            <img
              src={blog.coverImageUrl}
              alt={blog.title}
              className="w-full h-64 md:h-96 object-cover"
            />
          ) : (
            <div className="w-full h-48 md:h-64 bg-black flex items-center justify-center">
              <FileText className="w-24 h-24 text-ministry-gold-exact/30" />
            </div>
          )}
        </div>
      </div>

      <div className="px-6 py-6 max-w-3xl mx-auto">
        <Card className="bg-white border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <CardContent className="p-6 md:p-8">
            <div 
              className="prose prose-lg max-w-none text-black prose-headings:font-black prose-headings:uppercase prose-headings:tracking-tight prose-a:text-black prose-a:underline prose-strong:text-black"
              dangerouslySetInnerHTML={{ __html: blog.content }}
            />
          </CardContent>
        </Card>

        <div className="mt-6 flex justify-between items-center">
          <Button
            variant="outline"
            onClick={() => navigate('/blog')}
            className="rounded-none border-2 border-black bg-black text-white hover:bg-gray-800 font-bold uppercase"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            More Posts
          </Button>
          
          {blog.externalUrl && (
            <a
              href={blog.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-ministry-gold-exact text-black border-2 border-black rounded-none font-bold uppercase hover:bg-yellow-400 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
            >
              <ExternalLink className="w-4 h-4" />
              Original Source
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
