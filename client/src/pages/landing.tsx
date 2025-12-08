import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Users, BookOpen, Video, MessageCircle } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-black">
      {/* Hero Section */}
      <div className="bg-black text-white px-6 pt-16 pb-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4 text-[#FCD000]" data-testid="hero-title">
            Man Up God's Way
          </h1>
          <p className="text-xl text-white mb-8" data-testid="hero-subtitle">
            Strengthen your faith, character, and leadership through biblical masculinity
          </p>
          <Button 
            onClick={() => window.location.href = '/api/login'}
            className="bg-[#FCD000] text-black hover:bg-[#FCD000]/90 text-lg px-8 py-3 rounded-xl font-bold"
            data-testid="button-login"
          >
            Start Your Journey
          </Button>
        </div>
      </div>

      {/* Features Section */}
      <div className="px-6 py-12 bg-black">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-[#FCD000] mb-4" data-testid="features-title">
            Everything You Need to Grow
          </h2>
          <p className="text-white text-lg" data-testid="features-description">
            Comprehensive tools for spiritual growth and biblical masculinity
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <Card className="border border-[#FCD000] shadow-lg bg-black" data-testid="card-bible-studies">
            <CardContent className="p-8">
              <div className="text-[#FCD000] mb-4">
                <BookOpen size={48} />
              </div>
              <h3 className="text-xl font-bold text-[#FCD000] mb-3">Bible Studies</h3>
              <p className="text-white">
                Comprehensive study series on biblical masculinity, leadership, marriage, and fatherhood
              </p>
            </CardContent>
          </Card>

          <Card className="border border-[#FCD000] shadow-lg bg-black" data-testid="card-video-content">
            <CardContent className="p-8">
              <div className="text-[#FCD000] mb-4">
                <Video size={48} />
              </div>
              <h3 className="text-xl font-bold text-[#FCD000] mb-3">Video Content</h3>
              <p className="text-white">
                High-quality video teachings and discussions to complement your study experience
              </p>
            </CardContent>
          </Card>

          <Card className="border border-[#FCD000] shadow-lg bg-black" data-testid="card-community">
            <CardContent className="p-8">
              <div className="text-[#FCD000] mb-4">
                <MessageCircle size={48} />
              </div>
              <h3 className="text-xl font-bold text-[#FCD000] mb-3">Community</h3>
              <p className="text-white">
                Connect with like-minded men, share insights, and encourage one another
              </p>
            </CardContent>
          </Card>

          <Card className="border border-[#FCD000] shadow-lg bg-black" data-testid="card-progress">
            <CardContent className="p-8">
              <div className="text-[#FCD000] mb-4">
                <Users size={48} />
              </div>
              <h3 className="text-xl font-bold text-[#FCD000] mb-3">Progress Tracking</h3>
              <p className="text-white">
                Track your spiritual journey and celebrate milestones in your growth
              </p>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <Card className="bg-black border-[#FCD000]" data-testid="card-cta">
            <CardContent className="p-8 text-white">
              <h3 className="text-2xl font-bold mb-4 text-[#FCD000]">Ready to Begin?</h3>
              <p className="text-white mb-6">
                Join thousands of men walking in God's strength and purpose
              </p>
              <Button 
                onClick={() => window.location.href = '/api/login'}
                className="bg-[#FCD000] text-black hover:bg-[#FCD000]/90 text-lg px-8 py-3 rounded-xl font-bold"
                data-testid="button-join"
              >
                Join the Community
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
