import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  BookOpen, 
  Users, 
  Target, 
  Shield, 
  Play, 
  Headphones, 
  Trophy, 
  Flame,
  ChevronRight,
  ChevronLeft,
  X
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface WelcomeIntroProps {
  open: boolean;
  onClose: () => void;
}

const features = [
  {
    icon: BookOpen,
    title: "Bible Studies",
    description: "Dive deep into Scripture with structured, day-by-day lessons designed to build biblical masculinity and leadership.",
    color: "bg-blue-500"
  },
  {
    icon: Target,
    title: "Weekly Challenges",
    description: "Push yourself with weekly challenges that put your faith into action. Complete them to earn rations and grow stronger.",
    color: "bg-green-500"
  },
  {
    icon: Shield,
    title: "War Room",
    description: "Bring your battles to God. Share prayer requests and stand together with brothers who will pray for you.",
    color: "bg-red-500"
  },
  {
    icon: Users,
    title: "War Groups",
    description: "Join or start a local group of men committed to growing together. Find accountability and brotherhood in your city.",
    color: "bg-purple-500"
  },
  {
    icon: Flame,
    title: "Daily Devotionals",
    description: "Start each day with powerful devotionals that sharpen your mind and strengthen your spirit.",
    color: "bg-orange-500"
  },
  {
    icon: Play,
    title: "Video Library",
    description: "Access teaching videos on leadership, marriage, fatherhood, and character from seasoned men of God.",
    color: "bg-indigo-500"
  },
  {
    icon: Headphones,
    title: "Podcasts",
    description: "Listen to real conversations about real struggles. Grow your faith on the go with our podcast library.",
    color: "bg-teal-500"
  },
  {
    icon: Trophy,
    title: "Rations & Ranks",
    description: "Earn rations for completing missions across the platform. Rise through the ranks from Recruit to Elder.",
    color: "bg-yellow-500"
  }
];

export function WelcomeIntro({ open, onClose }: WelcomeIntroProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const totalPages = 3;

  const markSeenMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/user/welcome-seen");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    }
  });

  const handleClose = () => {
    markSeenMutation.mutate();
    onClose();
  };

  const nextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    } else {
      handleClose();
    }
  };

  const prevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden bg-black border-4 border-[#FCD000]">
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 z-50 text-white/70 hover:text-white"
          data-testid="button-close-welcome"
        >
          <X className="w-6 h-6" />
        </button>

        {currentPage === 0 && (
          <div className="p-8 text-center">
            <div className="mb-6">
              <div className="w-24 h-24 mx-auto mb-4 bg-[#FCD000] rounded-full flex items-center justify-center">
                <Shield className="w-12 h-12 text-black" />
              </div>
              <h1 className="text-3xl font-black text-white mb-2">
                WELCOME, SOLDIER
              </h1>
              <p className="text-[#FCD000] text-lg font-bold">
                MAN UP GOD'S WAY
              </p>
            </div>
            
            <p className="text-gray-300 text-lg mb-8 leading-relaxed">
              You've just joined a brotherhood of men committed to becoming who God created them to be. 
              This platform is your training ground for biblical masculinity, spiritual growth, and iron-sharpening-iron accountability.
            </p>

            <div className="bg-[#FCD000]/10 border-2 border-[#FCD000] p-6 mb-8">
              <p className="text-[#FCD000] font-bold text-lg">
                "As iron sharpens iron, so one man sharpens another."
              </p>
              <p className="text-gray-400 mt-2">— Proverbs 27:17</p>
            </div>

            <p className="text-gray-400 text-sm">
              Let's show you what's waiting for you...
            </p>
          </div>
        )}

        {currentPage === 1 && (
          <div className="p-8">
            <h2 className="text-2xl font-black text-white mb-2 text-center">
              YOUR ARSENAL
            </h2>
            <p className="text-gray-400 text-center mb-6">
              Everything you need to grow as a man of God
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              {features.slice(0, 4).map((feature, index) => (
                <div 
                  key={index}
                  className="bg-white/5 border border-white/10 p-4 hover:border-[#FCD000]/50 transition-colors"
                >
                  <div className={`w-10 h-10 ${feature.color} flex items-center justify-center mb-3`}>
                    <feature.icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-white font-bold mb-1">{feature.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentPage === 2 && (
          <div className="p-8">
            <h2 className="text-2xl font-black text-white mb-2 text-center">
              MORE TOOLS
            </h2>
            <p className="text-gray-400 text-center mb-6">
              Keep pushing forward with these resources
            </p>
            
            <div className="grid grid-cols-2 gap-4 mb-8">
              {features.slice(4).map((feature, index) => (
                <div 
                  key={index}
                  className="bg-white/5 border border-white/10 p-4 hover:border-[#FCD000]/50 transition-colors"
                >
                  <div className={`w-10 h-10 ${feature.color} flex items-center justify-center mb-3`}>
                    <feature.icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-white font-bold mb-1">{feature.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>

            <div className="bg-[#FCD000] p-6 text-center">
              <h3 className="text-black font-black text-xl mb-2">
                READY TO BEGIN?
              </h3>
              <p className="text-black/70 mb-4">
                Start your journey and become the man God created you to be.
              </p>
              <Button
                onClick={handleClose}
                className="bg-black hover:bg-gray-900 text-white font-bold px-8 py-3 text-lg"
                data-testid="button-start-journey"
              >
                LET'S GO
              </Button>
            </div>
          </div>
        )}

        <div className="bg-black/50 px-8 py-4 flex items-center justify-between border-t border-white/10">
          <Button
            variant="ghost"
            onClick={prevPage}
            disabled={currentPage === 0}
            className="text-white hover:text-[#FCD000] disabled:opacity-30"
            data-testid="button-prev-page"
          >
            <ChevronLeft className="w-5 h-5 mr-1" />
            Back
          </Button>

          <div className="flex gap-2">
            {Array.from({ length: totalPages }).map((_, index) => (
              <div
                key={index}
                className={`w-3 h-3 rounded-full transition-colors ${
                  index === currentPage ? "bg-[#FCD000]" : "bg-white/30"
                }`}
              />
            ))}
          </div>

          <Button
            onClick={nextPage}
            className="bg-[#FCD000] hover:bg-yellow-400 text-black font-bold"
            data-testid="button-next-page"
          >
            {currentPage === totalPages - 1 ? "Get Started" : "Next"}
            {currentPage < totalPages - 1 && <ChevronRight className="w-5 h-5 ml-1" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
