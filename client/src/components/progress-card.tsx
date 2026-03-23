import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { CheckCircle2, BookOpen } from "lucide-react";

interface ProgressCardProps {
  study: any;
  progress: any;
}

export default function ProgressCard({ study, progress }: ProgressCardProps) {
  const [, navigate] = useLocation();
  const isStudyCompleted = progress.status === 'completed';

  const totalLessons = progress.totalLessons || study.totalDays || 0;
  const completedLessons = progress.completedLessons || 0;
  const progressPercent = isStudyCompleted
    ? 100
    : totalLessons > 0
      ? Math.round((completedLessons / totalLessons) * 100)
      : 0;

  return (
    <Card className="overflow-hidden rounded-sm border-2 border-[#FCD000] shadow-[4px_4px_0px_0px_rgba(252,208,0,1)]" style={{ background: '#0a0a0a' }} data-testid="progress-card">
      {/* Gold status bar */}
      <div className="bg-[#FCD000] px-4 py-2 flex items-center justify-between border-b-2 border-black">
        <div className="flex items-center gap-1.5">
          {isStudyCompleted
            ? <CheckCircle2 className="w-3.5 h-3.5 text-black" />
            : <BookOpen className="w-3.5 h-3.5 text-black" />
          }
          <span className="text-xs font-black uppercase tracking-[0.15em] text-black">
            {isStudyCompleted ? 'Completed' : 'In Progress'}
          </span>
        </div>
        <span className="text-xs font-black text-black tabular-nums">{progressPercent}%</span>
      </div>

      <CardContent className="p-4 space-y-4">
        {/* Study info */}
        <div>
          <h3 className="font-black text-white text-base leading-tight uppercase tracking-tight" data-testid="text-study-title">
            {study.title}
          </h3>
          {(study.totalDays || study.estimatedHours) && (
            <p className="text-[#FCD000] font-bold text-xs uppercase tracking-[0.15em] mt-1" data-testid="text-study-info">
              {study.totalDays ? `${study.totalDays}-Day Study` : `${study.estimatedHours}h Study`}
            </p>
          )}
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/50">Lessons</span>
            <span className="text-xs font-black text-white tabular-nums" data-testid="text-progress-status">
              {completedLessons} <span className="text-white/40">/</span> {totalLessons}
            </span>
          </div>
          <div className="h-3 bg-white/10 rounded-sm border border-white/10 overflow-hidden">
            <div
              className="h-full bg-[#FCD000] rounded-sm transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
              data-testid="progress-bar"
            />
          </div>
        </div>

        {/* CTA button */}
        <Button
          className="w-full bg-[#FCD000] text-black rounded-sm font-black uppercase tracking-widest hover:bg-yellow-300 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] h-11 text-sm"
          data-testid="button-continue-study"
          onClick={() => navigate(`/studies/${study.id}`)}
        >
          {isStudyCompleted ? 'Review Study' : 'Continue Study →'}
        </Button>
      </CardContent>
    </Card>
  );
}
