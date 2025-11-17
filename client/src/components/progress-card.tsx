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
  const totalLessons = study.totalDays || 0;
  const completedLessons = progress.completedLessons || 0;
  const progressPercent = isStudyCompleted 
    ? 100 
    : totalLessons > 0 
      ? Math.round((completedLessons / totalLessons) * 100)
      : 0;

  return (
    <Card className="shadow-sm border border-ministry-charcoal bg-ministry-gold-exact" data-testid="progress-card">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-black" data-testid="text-study-title">
              {study.title}
            </h3>
            <p className="text-sm text-black" data-testid="text-study-info">
              {study.estimatedHours}h study
            </p>
            <p className="text-xs text-black mt-1">
              {isStudyCompleted 
                ? "Study completed" 
                : "In progress"
              }
            </p>
          </div>
          <div className="text-right">
            <p className="text-black font-bold text-lg" data-testid="text-progress-status">
              {isStudyCompleted ? 'Completed' : 'In Progress'}
            </p>
          </div>
        </div>
        
        <div className="mb-4">
          <Progress value={progressPercent} className="h-2 mb-2" data-testid="progress-bar" />
        </div>
        
        <Link href={`/studies/${study.id}`}>
          <Button 
            className="w-full bg-black text-white py-3 rounded-xl font-medium hover:bg-gray-900"
            data-testid="button-continue-study"
          >
            {isStudyCompleted ? 'Review Study' : 'Continue Study'}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
