import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";

interface ProgressCardProps {
  study: any;
  progress: any;
}

export default function ProgressCard({ study, progress }: ProgressCardProps) {
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
    <Card className="border-2 border-black liquid-gold-card glow-gold rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" data-testid="progress-card">
      <CardContent className="p-6 relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-black text-xl text-black uppercase tracking-tight" data-testid="text-study-title">
              {study.title}
            </h3>
            <p className="text-sm text-black font-bold mt-1 uppercase tracking-wide" data-testid="text-study-info">
              {study.estimatedHours}h study
            </p>
            <p className="text-sm text-black/70 font-medium mt-1">
              {isStudyCompleted 
                ? "Study completed" 
                : "In progress"
              }
            </p>
          </div>
          <div className="text-right">
            <div className="bg-black text-white px-3 py-1 rounded-none text-xs font-black uppercase tracking-wide" data-testid="text-progress-status">
              {isStudyCompleted ? 'Completed' : 'In Progress'}
            </div>
          </div>
        </div>
        
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-black/70 mb-2 font-bold uppercase">
            <span>{completedLessons} of {totalLessons} lessons</span>
            <span>{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-3 bg-white border-2 border-black rounded-none [&>div]:bg-black [&>div]:rounded-none" data-testid="progress-bar" />
        </div>
        
        <Link href={`/studies/${study.id}`}>
          <Button 
            className="w-full bg-black text-white py-3 rounded-none font-black uppercase tracking-wide hover:bg-gray-900 border-2 border-black"
            data-testid="button-continue-study"
          >
            {isStudyCompleted ? 'Review Study' : 'Continue Study'}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
