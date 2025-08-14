import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Users, BookOpen, Video, MessageCircle } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-ministry-navy to-ministry-charcoal text-white px-6 pt-16 pb-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4" data-testid="hero-title">
            Man Up God's Way
          </h1>
          <p className="text-xl text-blue-200 mb-8" data-testid="hero-subtitle">
            Strengthen your faith, character, and leadership through biblical masculinity
          </p>
          <Button 
            onClick={() => window.location.href = '/api/login'}
            className="bg-ministry-gold text-ministry-navy hover:bg-ministry-gold/90 text-lg px-8 py-3 rounded-xl font-bold"
            data-testid="button-login"
          >
            Start Your Journey
          </Button>
        </div>
      </div>

      {/* Features Section */}
      <div className="px-6 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-ministry-charcoal mb-4" data-testid="features-title">
            Everything You Need to Grow
          </h2>
          <p className="text-ministry-slate text-lg" data-testid="features-description">
            Comprehensive tools for spiritual growth and biblical masculinity
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <Card className="border-none shadow-lg" data-testid="card-bible-studies">
            <CardContent className="p-8">
              <div className="text-ministry-steel mb-4">
                <BookOpen size={48} />
              </div>
              <h3 className="text-xl font-bold text-ministry-charcoal mb-3">Bible Studies</h3>
              <p className="text-ministry-slate">
                Comprehensive study series on biblical masculinity, leadership, marriage, and fatherhood
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg" data-testid="card-video-content">
            <CardContent className="p-8">
              <div className="text-ministry-steel mb-4">
                <Video size={48} />
              </div>
              <h3 className="text-xl font-bold text-ministry-charcoal mb-3">Video Content</h3>
              <p className="text-ministry-slate">
                High-quality video teachings and discussions to complement your study experience
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg" data-testid="card-community">
            <CardContent className="p-8">
              <div className="text-ministry-steel mb-4">
                <MessageCircle size={48} />
              </div>
              <h3 className="text-xl font-bold text-ministry-charcoal mb-3">Community</h3>
              <p className="text-ministry-slate">
                Connect with like-minded men, share insights, and encourage one another
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg" data-testid="card-progress">
            <CardContent className="p-8">
              <div className="text-ministry-steel mb-4">
                <Users size={48} />
              </div>
              <h3 className="text-xl font-bold text-ministry-charcoal mb-3">Progress Tracking</h3>
              <p className="text-ministry-slate">
                Track your spiritual journey and celebrate milestones in your growth
              </p>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <Card className="bg-gradient-to-r from-ministry-steel to-ministry-navy border-none" data-testid="card-cta">
            <CardContent className="p-8 text-white">
              <h3 className="text-2xl font-bold mb-4">Ready to Begin?</h3>
              <p className="text-blue-100 mb-6">
                Join thousands of men walking in God's strength and purpose
              </p>
              <Button 
                onClick={() => window.location.href = '/api/login'}
                className="bg-ministry-gold text-ministry-navy hover:bg-ministry-gold/90 text-lg px-8 py-3 rounded-xl font-bold"
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
