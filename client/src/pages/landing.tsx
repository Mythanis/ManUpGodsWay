import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Users, BookOpen, Video, MessageCircle, Shield, Target, Flame, ChevronRight, Dumbbell, PlayCircle, ClipboardList, Activity, Utensils, Heart } from "lucide-react";
import logoUrl from "@assets/Man_Up_Logo-Gods_way-White-Yellow_copy_1766440697541.png";
import warGroupsImageUrl from "@assets/image_1767068818932.png";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950">
      {/* War Groups Banner */}
      <div className="w-full">
        <img 
          src={warGroupsImageUrl} 
          alt="War Groups - Step Up & Lead" 
          className="w-full h-auto object-cover"
          data-testid="war-groups-banner"
        />
      </div>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23FCD000' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>
        
        {/* Golden accent glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#FDD000]/10 blur-[120px] rounded-full" />
        
        <div className="relative px-6 pt-20 pb-16 max-w-4xl mx-auto">
          <div className="text-center">
            {/* Eyebrow text */}
            <p className="text-[#FDD000]/80 text-sm font-semibold tracking-[0.2em] uppercase mb-2" data-testid="hero-eyebrow">
              Biblical Masculinity
            </p>
            <p className="text-[#FDD000]/80 text-sm font-semibold tracking-[0.2em] uppercase mb-6">
              Faith • Leadership
            </p>
            
            {/* Logo */}
            <div className="mb-6" data-testid="hero-logo">
              <img 
                src={logoUrl} 
                alt="Man Up God's Way" 
                className="w-64 md:w-80 h-auto mx-auto"
              />
            </div>
            
            <p 
              className="text-xl md:text-2xl text-zinc-300 mb-10 max-w-2xl mx-auto leading-relaxed font-light"
              data-testid="hero-subtitle"
            >
              Strengthen your <span className="text-[#FDD000] font-medium">Faith</span>, build your{" "}
              <span className="text-[#FDD000] font-medium">character</span>, and rise as the{" "}
              <span className="text-[#FDD000] font-medium">leader</span> God designed you to be.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <Button 
                onClick={() => window.location.href = '/api/login'}
                className="bg-[#FDD000] text-zinc-950 hover:bg-[#FDD000]/90 text-lg px-10 py-6 rounded-xl font-bold shadow-lg shadow-[#FDD000]/20 transition-all hover:shadow-xl hover:shadow-[#FDD000]/30 hover:scale-[1.02]"
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
      <div className="px-6 py-10 max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-[#FDD000] text-sm font-semibold tracking-[0.15em] uppercase mb-4">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <Card 
            className="group border-0 bg-zinc-900/50 backdrop-blur-sm hover:bg-zinc-800/60 transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-[#FDD000]/5 rounded-2xl overflow-hidden" 
            data-testid="card-bible-studies"
          >
            <CardContent className="p-8">
              <div className="w-14 h-14 rounded-xl bg-[#FDD000]/10 flex items-center justify-center mb-5 group-hover:bg-[#FDD000]/20 transition-colors">
                <BookOpen className="w-7 h-7 text-[#FDD000]" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3 tracking-tight">Bible Studies</h3>
              <p className="text-zinc-400 leading-relaxed">
                Comprehensive study series on biblical masculinity, leadership, marriage, and fatherhood
              </p>
            </CardContent>
          </Card>

          <Card 
            className="group border-0 bg-zinc-900/50 backdrop-blur-sm hover:bg-zinc-800/60 transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-[#FDD000]/5 rounded-2xl overflow-hidden" 
            data-testid="card-video-content"
          >
            <CardContent className="p-8">
              <div className="w-14 h-14 rounded-xl bg-[#FDD000]/10 flex items-center justify-center mb-5 group-hover:bg-[#FDD000]/20 transition-colors">
                <Video className="w-7 h-7 text-[#FDD000]" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3 tracking-tight">Video Content</h3>
              <p className="text-zinc-400 leading-relaxed">
                High-quality video teachings and discussions to complement your study experience
              </p>
            </CardContent>
          </Card>

          <Card 
            className="group border-0 bg-zinc-900/50 backdrop-blur-sm hover:bg-zinc-800/60 transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-[#FDD000]/5 rounded-2xl overflow-hidden" 
            data-testid="card-community"
          >
            <CardContent className="p-8">
              <div className="w-14 h-14 rounded-xl bg-[#FDD000]/10 flex items-center justify-center mb-5 group-hover:bg-[#FDD000]/20 transition-colors">
                <MessageCircle className="w-7 h-7 text-[#FDD000]" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3 tracking-tight">Brotherhood</h3>
              <p className="text-zinc-400 leading-relaxed">
                Connect with like-minded men, share insights, and encourage one another in faith
              </p>
            </CardContent>
          </Card>

          <Card 
            className="group border-0 bg-zinc-900/50 backdrop-blur-sm hover:bg-zinc-800/60 transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-[#FDD000]/5 rounded-2xl overflow-hidden" 
            data-testid="card-progress"
          >
            <CardContent className="p-8">
              <div className="w-14 h-14 rounded-xl bg-[#FDD000]/10 flex items-center justify-center mb-5 group-hover:bg-[#FDD000]/20 transition-colors">
                <Target className="w-7 h-7 text-[#FDD000]" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3 tracking-tight">Progress Tracking</h3>
              <p className="text-zinc-400 leading-relaxed">
                Track your spiritual journey and celebrate milestones in your growth
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Additional Features Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="text-center p-6">
            <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-6 h-6 text-[#FDD000]" />
            </div>
            <h4 className="text-white font-semibold mb-2">War Room</h4>
            <p className="text-zinc-500 text-sm">Private prayer and support space</p>
          </div>
          <div className="text-center p-6">
            <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
              <Users className="w-6 h-6 text-[#FDD000]" />
            </div>
            <h4 className="text-white font-semibold mb-2">War Groups</h4>
            <p className="text-zinc-500 text-sm">Local discipleship communities</p>
          </div>
          <div className="text-center p-6">
            <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
              <Flame className="w-6 h-6 text-[#FDD000]" />
            </div>
            <h4 className="text-white font-semibold mb-2">Weekly Challenges</h4>
            <p className="text-zinc-500 text-sm">Grow through action and accountability</p>
          </div>
        </div>

        {/* Fitness Features & Benefits Section */}
        <div className="h-px bg-gradient-to-r from-transparent via-[#FDD000]/20 to-transparent my-8" />

        <div className="text-center mb-10">
          <p className="text-[#FDD000] text-sm font-semibold tracking-[0.15em] uppercase mb-4">
            Fitness & Training
          </p>
          <h2
            className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-tight"
            style={{ fontFamily: "'Inter', 'DM Sans', sans-serif" }}
            data-testid="fitness-section-title"
          >
            Train Your Body. Strengthen Your Spirit.
          </h2>
          <p className="text-zinc-400 text-lg max-w-xl mx-auto">
            A complete fitness system built on biblical principles — from your first rep to your hundredth.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10" data-testid="fitness-benefits-grid">
          <Card className="group border-0 bg-zinc-900/50 backdrop-blur-sm hover:bg-zinc-800/60 transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-[#FDD000]/5 rounded-2xl overflow-hidden">
            <CardContent className="p-6">
              <div className="w-12 h-12 rounded-xl bg-[#FDD000]/10 flex items-center justify-center mb-4 group-hover:bg-[#FDD000]/20 transition-colors">
                <Dumbbell className="w-6 h-6 text-[#FDD000]" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2 tracking-tight">Guided Workout Plans</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Pre-built programs for every level — Beginner to Advanced — with step-by-step video demonstrations for every movement.
              </p>
            </CardContent>
          </Card>

          <Card className="group border-0 bg-zinc-900/50 backdrop-blur-sm hover:bg-zinc-800/60 transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-[#FDD000]/5 rounded-2xl overflow-hidden">
            <CardContent className="p-6">
              <div className="w-12 h-12 rounded-xl bg-[#FDD000]/10 flex items-center justify-center mb-4 group-hover:bg-[#FDD000]/20 transition-colors">
                <PlayCircle className="w-6 h-6 text-[#FDD000]" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2 tracking-tight">Live Workout Player</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Real-time rep counters, rest timers, and automatic left/right guidance so you train both sides equally and with purpose.
              </p>
            </CardContent>
          </Card>

          <Card className="group border-0 bg-zinc-900/50 backdrop-blur-sm hover:bg-zinc-800/60 transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-[#FDD000]/5 rounded-2xl overflow-hidden">
            <CardContent className="p-6">
              <div className="w-12 h-12 rounded-xl bg-[#FDD000]/10 flex items-center justify-center mb-4 group-hover:bg-[#FDD000]/20 transition-colors">
                <ClipboardList className="w-6 h-6 text-[#FDD000]" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2 tracking-tight">Custom Plan Builder</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Design your own plan from 1,600+ exercises filtered by muscle group, equipment, and difficulty — then schedule it day by day.
              </p>
            </CardContent>
          </Card>

          <Card className="group border-0 bg-zinc-900/50 backdrop-blur-sm hover:bg-zinc-800/60 transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-[#FDD000]/5 rounded-2xl overflow-hidden">
            <CardContent className="p-6">
              <div className="w-12 h-12 rounded-xl bg-[#FDD000]/10 flex items-center justify-center mb-4 group-hover:bg-[#FDD000]/20 transition-colors">
                <Activity className="w-6 h-6 text-[#FDD000]" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2 tracking-tight">Health Dashboard</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Track steps, heart rate, sleep, and weight. Spot trends with clear charts that keep you honest and progressing.
              </p>
            </CardContent>
          </Card>

          <Card className="group border-0 bg-zinc-900/50 backdrop-blur-sm hover:bg-zinc-800/60 transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-[#FDD000]/5 rounded-2xl overflow-hidden">
            <CardContent className="p-6">
              <div className="w-12 h-12 rounded-xl bg-[#FDD000]/10 flex items-center justify-center mb-4 group-hover:bg-[#FDD000]/20 transition-colors">
                <Utensils className="w-6 h-6 text-[#FDD000]" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2 tracking-tight">Nutrition & Calorie Tracking</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Know your daily targets with a science-backed calorie calculator, then log every meal to stay on track.
              </p>
            </CardContent>
          </Card>

          <Card className="group border-0 bg-zinc-900/50 backdrop-blur-sm hover:bg-zinc-800/60 transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-[#FDD000]/5 rounded-2xl overflow-hidden">
            <CardContent className="p-6">
              <div className="w-12 h-12 rounded-xl bg-[#FDD000]/10 flex items-center justify-center mb-4 group-hover:bg-[#FDD000]/20 transition-colors">
                <Heart className="w-6 h-6 text-[#FDD000]" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2 tracking-tight">Fitness Brotherhood</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Share wins, encourage brothers, and stay accountable in a dedicated fitness community built for men of faith.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mb-10">
          <Button
            onClick={() => window.location.href = '/fitness'}
            variant="outline"
            className="border-2 border-[#FDD000] text-[#FDD000] bg-transparent hover:bg-[#FDD000] hover:text-zinc-950 text-base px-8 py-5 rounded-xl font-bold transition-all hover:scale-[1.02]"
            data-testid="button-start-training"
          >
            Start Training
            <ChevronRight className="ml-2 w-5 h-5" />
          </Button>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-[#FDD000]/20 to-transparent mb-12" />

        {/* CTA Section */}
        <div className="relative">
          {/* Subtle glow behind CTA */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#FDD000]/5 via-[#FDD000]/10 to-[#FDD000]/5 blur-3xl rounded-3xl" />
          
          <Card 
            className="relative border border-zinc-800 bg-zinc-900/80 backdrop-blur-sm rounded-2xl overflow-hidden"
            data-testid="card-cta"
          >
            <CardContent className="p-12 text-center">
              <p className="text-[#FDD000] text-sm font-semibold tracking-[0.15em] uppercase mb-4">
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
                className="bg-[#FDD000] text-zinc-950 hover:bg-[#FDD000]/90 text-lg px-10 py-6 rounded-xl font-bold shadow-lg shadow-[#FDD000]/20 transition-all hover:shadow-xl hover:shadow-[#FDD000]/30 hover:scale-[1.02]"
                data-testid="button-join"
              >
                Join the Community
                <ChevronRight className="ml-2 w-5 h-5" />
              </Button>
              
              {/* Trust badges */}
              <div className="flex flex-wrap justify-center gap-6 mt-8 text-zinc-500 text-sm">
                <span className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FDD000]" />
                  100% Free to Start
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FDD000]" />
                  Private & Secure
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FDD000]" />
                  Faith-Based Community
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Footer accent */}
      <div className="h-1 bg-gradient-to-r from-transparent via-[#FDD000]/30 to-transparent" />
    </div>
  );
}
