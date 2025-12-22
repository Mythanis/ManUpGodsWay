import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Users, BookOpen, Video, MessageCircle, Shield, Target, Flame, ChevronRight } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23FCD000' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>
        
        {/* Golden accent glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#FCD000]/10 blur-[120px] rounded-full" />
        
        <div className="relative px-6 pt-20 pb-16 max-w-4xl mx-auto">
          <div className="text-center">
            {/* Eyebrow text */}
            <p className="text-[#FCD000]/80 text-sm font-semibold tracking-[0.2em] uppercase mb-6" data-testid="hero-eyebrow">
              Biblical Masculinity • Faith • Leadership
            </p>
            
            <h1 
              className="text-5xl md:text-6xl font-black tracking-tight mb-6 bg-gradient-to-r from-white via-white to-zinc-400 bg-clip-text text-transparent leading-[1.1]"
              style={{ fontFamily: "'Inter', 'DM Sans', sans-serif" }}
              data-testid="hero-title"
            >
              Man Up God's Way
            </h1>
            
            <p 
              className="text-xl md:text-2xl text-zinc-300 mb-10 max-w-2xl mx-auto leading-relaxed font-light"
              data-testid="hero-subtitle"
            >
              Strengthen your <span className="text-[#FCD000] font-medium">Faith</span>, build your{" "}
              <span className="text-[#FCD000] font-medium">character</span>, and rise as the leader{" "}
              God designed you to be.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <Button 
                onClick={() => window.location.href = '/api/login'}
                className="bg-[#FCD000] text-zinc-950 hover:bg-[#FCD000]/90 text-lg px-10 py-6 rounded-xl font-bold shadow-lg shadow-[#FCD000]/20 transition-all hover:shadow-xl hover:shadow-[#FCD000]/30 hover:scale-[1.02]"
                data-testid="button-login"
              >
                Start Your Journey
                <ChevronRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
            
            {/* Trust indicator */}
            <div className="flex items-center justify-center gap-2 text-zinc-500 text-sm">
              <div className="flex -space-x-2">
                <div className="w-8 h-8 rounded-full bg-zinc-700 border-2 border-zinc-900 flex items-center justify-center text-xs text-zinc-300">M</div>
                <div className="w-8 h-8 rounded-full bg-zinc-700 border-2 border-zinc-900 flex items-center justify-center text-xs text-zinc-300">J</div>
                <div className="w-8 h-8 rounded-full bg-zinc-700 border-2 border-zinc-900 flex items-center justify-center text-xs text-zinc-300">D</div>
              </div>
              <span>Join men walking in God's purpose</span>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="px-6 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-[#FCD000] text-sm font-semibold tracking-[0.15em] uppercase mb-4">
            Your Growth Toolkit
          </p>
          <h2 
            className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-tight"
            style={{ fontFamily: "'Inter', 'DM Sans', sans-serif" }}
            data-testid="features-title"
          >
            Everything You Need to Grow
          </h2>
          <p className="text-zinc-400 text-lg max-w-xl mx-auto" data-testid="features-description">
            Comprehensive tools designed for your spiritual growth and biblical masculinity journey
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          <Card 
            className="group border-0 bg-zinc-900/50 backdrop-blur-sm hover:bg-zinc-800/60 transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-[#FCD000]/5 rounded-2xl overflow-hidden" 
            data-testid="card-bible-studies"
          >
            <CardContent className="p-8">
              <div className="w-14 h-14 rounded-xl bg-[#FCD000]/10 flex items-center justify-center mb-5 group-hover:bg-[#FCD000]/20 transition-colors">
                <BookOpen className="w-7 h-7 text-[#FCD000]" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3 tracking-tight">Bible Studies</h3>
              <p className="text-zinc-400 leading-relaxed">
                Comprehensive study series on biblical masculinity, leadership, marriage, and fatherhood
              </p>
            </CardContent>
          </Card>

          <Card 
            className="group border-0 bg-zinc-900/50 backdrop-blur-sm hover:bg-zinc-800/60 transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-[#FCD000]/5 rounded-2xl overflow-hidden" 
            data-testid="card-video-content"
          >
            <CardContent className="p-8">
              <div className="w-14 h-14 rounded-xl bg-[#FCD000]/10 flex items-center justify-center mb-5 group-hover:bg-[#FCD000]/20 transition-colors">
                <Video className="w-7 h-7 text-[#FCD000]" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3 tracking-tight">Video Content</h3>
              <p className="text-zinc-400 leading-relaxed">
                High-quality video teachings and discussions to complement your study experience
              </p>
            </CardContent>
          </Card>

          <Card 
            className="group border-0 bg-zinc-900/50 backdrop-blur-sm hover:bg-zinc-800/60 transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-[#FCD000]/5 rounded-2xl overflow-hidden" 
            data-testid="card-community"
          >
            <CardContent className="p-8">
              <div className="w-14 h-14 rounded-xl bg-[#FCD000]/10 flex items-center justify-center mb-5 group-hover:bg-[#FCD000]/20 transition-colors">
                <MessageCircle className="w-7 h-7 text-[#FCD000]" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3 tracking-tight">Brotherhood</h3>
              <p className="text-zinc-400 leading-relaxed">
                Connect with like-minded men, share insights, and encourage one another in faith
              </p>
            </CardContent>
          </Card>

          <Card 
            className="group border-0 bg-zinc-900/50 backdrop-blur-sm hover:bg-zinc-800/60 transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-[#FCD000]/5 rounded-2xl overflow-hidden" 
            data-testid="card-progress"
          >
            <CardContent className="p-8">
              <div className="w-14 h-14 rounded-xl bg-[#FCD000]/10 flex items-center justify-center mb-5 group-hover:bg-[#FCD000]/20 transition-colors">
                <Target className="w-7 h-7 text-[#FCD000]" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3 tracking-tight">Progress Tracking</h3>
              <p className="text-zinc-400 leading-relaxed">
                Track your spiritual journey and celebrate milestones in your growth
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Additional Features Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          <div className="text-center p-6">
            <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-6 h-6 text-[#FCD000]" />
            </div>
            <h4 className="text-white font-semibold mb-2">War Room</h4>
            <p className="text-zinc-500 text-sm">Private prayer and support space</p>
          </div>
          <div className="text-center p-6">
            <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
              <Users className="w-6 h-6 text-[#FCD000]" />
            </div>
            <h4 className="text-white font-semibold mb-2">War Groups</h4>
            <p className="text-zinc-500 text-sm">Local discipleship communities</p>
          </div>
          <div className="text-center p-6">
            <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
              <Flame className="w-6 h-6 text-[#FCD000]" />
            </div>
            <h4 className="text-white font-semibold mb-2">Weekly Challenges</h4>
            <p className="text-zinc-500 text-sm">Grow through action and accountability</p>
          </div>
        </div>

        {/* CTA Section */}
        <div className="relative">
          {/* Subtle glow behind CTA */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#FCD000]/5 via-[#FCD000]/10 to-[#FCD000]/5 blur-3xl rounded-3xl" />
          
          <Card 
            className="relative border border-zinc-800 bg-zinc-900/80 backdrop-blur-sm rounded-2xl overflow-hidden"
            data-testid="card-cta"
          >
            <CardContent className="p-12 text-center">
              <p className="text-[#FCD000] text-sm font-semibold tracking-[0.15em] uppercase mb-4">
                Your Journey Awaits
              </p>
              <h3 
                className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-tight"
                style={{ fontFamily: "'Inter', 'DM Sans', sans-serif" }}
              >
                Ready to Step Into Your Calling?
              </h3>
              <p className="text-zinc-400 text-lg mb-8 max-w-lg mx-auto">
                Join a community of men committed to walking in God's strength and purpose
              </p>
              <Button 
                onClick={() => window.location.href = '/api/login'}
                className="bg-[#FCD000] text-zinc-950 hover:bg-[#FCD000]/90 text-lg px-10 py-6 rounded-xl font-bold shadow-lg shadow-[#FCD000]/20 transition-all hover:shadow-xl hover:shadow-[#FCD000]/30 hover:scale-[1.02]"
                data-testid="button-join"
              >
                Join the Community
                <ChevronRight className="ml-2 w-5 h-5" />
              </Button>
              
              {/* Trust badges */}
              <div className="flex flex-wrap justify-center gap-6 mt-8 text-zinc-500 text-sm">
                <span className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FCD000]" />
                  100% Free to Start
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FCD000]" />
                  Private & Secure
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FCD000]" />
                  Faith-Based Community
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Footer accent */}
      <div className="h-1 bg-gradient-to-r from-transparent via-[#FCD000]/30 to-transparent" />
    </div>
  );
}
