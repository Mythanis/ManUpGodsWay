import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useLocation } from "wouter";

interface ProgressCardProps {
  study: any;
  progress: any;
}

export default function ProgressCard({ study, progress }: ProgressCardProps) {
  const [, navigate] = useLocation();
  const isStudyCompleted = progress.status === 'completed';
  
  // Calculate progress percentage based on completed lessons
  // Use progress.totalLessons (actual lesson count) with fallback to study.totalDays
  const totalLessons = progress.totalLessons || study.totalDays || 0;
  const completedLessons = progress.completedLessons || 0;
  const progressPercent = isStudyCompleted 
    ? 100 
    : totalLessons > 0 
      ? Math.round((completedLessons / totalLessons) * 100)
      : 0;

  return (
    <Card className="border-2 border-ministry-gold-exact liquid-black-white rounded-sm shadow-[4px_4px_0px_0px_rgba(252,208,0,1)] overflow-hidden" data-testid="progress-card">
      <CardContent className="p-6 relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-black text-white text-lg mb-1 uppercase tracking-tight" data-testid="text-study-title">
              {study.title}
            </h3>
            {(study.totalDays || study.estimatedHours) && (
              <p className="text-sm text-ministry-gold-exact font-bold mt-1 uppercase tracking-wide" data-testid="text-study-info">
                {study.totalDays ? `${study.totalDays} Day Study` : `${study.estimatedHours}h Study`}
              </p>
            )}
            <p className="text-sm text-white/70 font-medium mt-1">
              {isStudyCompleted 
                ? "Study completed" 
                : "In progress"
              }
            </p>
          </div>
          <div className="text-right">
            <div className="bg-ministry-gold-exact text-black px-3 py-1 rounded-sm text-xs font-black uppercase tracking-wide border-2 border-black" data-testid="text-progress-status">
              {isStudyCompleted ? 'Completed' : 'In Progress'}
            </div>
          </div>
        </div>
        
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-white/70 mb-2 font-bold uppercase">
            <span>{completedLessons} of {totalLessons} lessons</span>
            <span>{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-3 bg-white/20 border-2 border-ministry-gold-exact rounded-sm [&>div]:bg-ministry-gold-exact [&>div]:rounded-sm" data-testid="progress-bar" />
        </div>
        
        <Button 
          className="w-full bg-ministry-gold-exact text-black py-3 rounded-sm font-black uppercase tracking-wide hover:bg-yellow-400 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          data-testid="button-continue-study"
          onClick={() => navigate(`/studies/${study.id}`)}
        >
          {isStudyCompleted ? 'Review Study' : 'Continue Study'}
        </Button>
      </CardContent>
    </Card>
  );
}
