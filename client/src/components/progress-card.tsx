import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";

interface ProgressCardProps {
  study: any;
  progress: any;
}

export default function ProgressCard({ study, progress }: ProgressCardProps) {
  const progressPercent = Math.round((progress.completedLessons / (study.lessonCount || 1)) * 100);

  return (
    <Card className="shadow-sm border border-gray-100" data-testid="progress-card">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-ministry-charcoal" data-testid="text-study-title">
              {study.title}
            </h3>
            <p className="text-sm text-ministry-slate" data-testid="text-study-info">
              {study.lessonCount}-lesson study series
            </p>
          </div>
          <div className="text-right">
            <p className="text-ministry-steel font-bold text-lg" data-testid="text-progress-percent">
              {progressPercent}%
            </p>
            <p className="text-xs text-ministry-slate" data-testid="text-progress-fraction">
              {progress.completedLessons} of {study.lessonCount} complete
            </p>
          </div>
        </div>
        
        <div className="mb-4">
          <Progress value={progressPercent} className="h-2 mb-2" data-testid="progress-bar" />
        </div>
        
        <Link href={`/studies/${study.id}`}>
          <Button 
            className="w-full bg-ministry-navy text-white py-3 rounded-xl font-medium hover:bg-ministry-charcoal"
            data-testid="button-continue-study"
          >
            Continue Study
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
