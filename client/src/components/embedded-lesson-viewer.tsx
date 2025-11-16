import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, CheckCircle, Circle, Printer } from "lucide-react";

interface StudyLesson {
  id: string;
  studyId: string;
  dayNumber: number;
  title: string;
  content: string;
  scripture?: string;
  questions?: Array<{ id: string; question: string; type: string }>;
  keyTakeaway?: string;
  displayOrder: number;
  estimatedMinutes?: number;
}

interface LessonProgress {
  id?: string;
  userId: string;
  lessonId: string;
  completedAt: Date | null;
  answers?: Record<string, string>;
}

interface EmbeddedLessonViewerProps {
  studyId: string;
  totalDays?: number;
  userId: string;
}

export function EmbeddedLessonViewer({ studyId, totalDays, userId }: EmbeddedLessonViewerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Fetch all lessons for this study
  const { data: lessons = [], isLoading: lessonsLoading } = useQuery<StudyLesson[]>({
    queryKey: [`/api/studies/${studyId}/lessons`],
  });

  // Fetch user's overall progress for this study
  const { data: studyProgress } = useQuery({
    queryKey: [`/api/studies/${studyId}/progress`],
  });

  // Fetch user's lesson completion data
  const { data: lessonProgressData = [] } = useQuery<LessonProgress[]>({
    queryKey: [`/api/users/${userId}/lesson-progress`],
    enabled: !!userId,
  });

  const currentLesson = lessons[currentDayIndex];
  const currentProgress = lessonProgressData.find(p => p.lessonId === currentLesson?.id);
  const isCompleted = !!currentProgress?.completedAt;

  // Calculate overall progress
  const completedLessons = lessonProgressData.filter(p => p.completedAt).length;
  const progressPercentage = lessons.length > 0 ? (completedLessons / lessons.length) * 100 : 0;

  // Mark lesson as complete mutation
  const markCompleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/studies/${studyId}/lessons/${currentLesson.id}/complete`, {
        answers: Object.keys(answers).length > 0 ? answers : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}/lesson-progress`] });
      queryClient.invalidateQueries({ queryKey: [`/api/studies/${studyId}/progress`] });
      toast({
        title: "Lesson Completed!",
        description: `You've completed Day ${currentLesson.dayNumber}`,
      });
      setAnswers({});
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mark lesson as complete",
        variant: "destructive",
      });
    },
  });

  const handlePrint = () => {
    window.print();
  };

  const goToPreviousDay = () => {
    if (currentDayIndex > 0) {
      setCurrentDayIndex(currentDayIndex - 1);
      setAnswers({});
    }
  };

  const goToNextDay = () => {
    if (currentDayIndex < lessons.length - 1) {
      setCurrentDayIndex(currentDayIndex + 1);
      setAnswers({});
    }
  };

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value,
    }));
  };

  if (lessonsLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ministry-navy"></div>
      </div>
    );
  }

  if (lessons.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">No lessons available for this study yet.</p>
        </CardContent>
      </Card>
    );
  }

  if (!currentLesson) {
    return null;
  }

  return (
    <>
      {/* Print Watermark - Only visible when printing */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          /* Hide everything first */
          body * {
            visibility: hidden;
          }
          
          /* Show only the lesson content */
          .lesson-print-content,
          .lesson-print-content * {
            visibility: visible;
          }
          
          /* Clean print layout - remove all card styling */
          .lesson-print-content {
            position: absolute;
            left: 0 !important;
            top: 0 !important;
            width: 100%;
            background: white !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          /* Remove all card/container styling */
          .lesson-print-content > *,
          .lesson-print-content div[class*="card"],
          .lesson-print-content div[class*="Card"] {
            background: white !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          
          /* Professional print typography */
          .lesson-print-content * {
            color: black !important;
            font-family: Georgia, 'Times New Roman', serif !important;
          }
          
          /* Lesson title - prominent */
          .lesson-print-content [data-testid="text-lesson-title"] {
            font-size: 16pt !important;
            font-weight: bold !important;
            margin-bottom: 6pt !important;
            margin-top: 0 !important;
            padding: 0 !important;
            border-bottom: 1.5pt solid black !important;
            padding-bottom: 3pt !important;
          }
          
          /* Scripture section */
          .lesson-print-content [data-testid="text-scripture"] {
            font-size: 10pt !important;
            font-style: italic !important;
            margin: 6pt 0 !important;
            padding: 6pt !important;
            border-left: 2pt solid #ccc !important;
            background: #f9f9f9 !important;
          }
          
          /* Main content - readable typography */
          .lesson-print-content [data-testid="content-lesson-body"] {
            font-size: 10pt !important;
            line-height: 1.3 !important;
            margin: 6pt 0 !important;
            padding: 0 !important;
          }
          
          .lesson-print-content [data-testid="content-lesson-body"] p {
            margin: 4pt 0 !important;
            padding: 0 !important;
          }
          
          /* Key takeaway */
          .lesson-print-content [data-testid="text-key-takeaway"] {
            font-size: 9pt !important;
            margin: 6pt 0 !important;
            padding: 6pt !important;
            background: #f0f0f0 !important;
            border: 1pt solid #ccc !important;
          }
          
          /* Questions section */
          .lesson-print-content [data-testid^="question-text"] {
            font-size: 9pt !important;
            font-weight: bold !important;
            margin: 6pt 0 3pt 0 !important;
            padding: 0 !important;
          }
          
          /* Section headings */
          .lesson-print-content h1,
          .lesson-print-content h2,
          .lesson-print-content h3 {
            font-size: 12pt !important;
            font-weight: bold !important;
            margin: 8pt 0 4pt 0 !important;
            padding: 0 !important;
          }
          
          /* Watermark */
          .lesson-print-content::before {
            content: "Man Up God's Way";
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 80px;
            font-weight: bold;
            color: rgba(252, 208, 0, 0.15);
            z-index: 9999;
            pointer-events: none;
            white-space: nowrap;
            visibility: visible;
          }
          
          /* Page settings - 1 inch margins */
          @page {
            margin: 1in;
            size: letter;
          }
          
          /* Prevent awkward page breaks */
          h1, h2, h3, h4, h5, h6 {
            page-break-after: avoid;
          }
          
          p {
            orphans: 3;
            widows: 3;
          }
        }
      `}} />
      
      <div className="space-y-4 print:space-y-2" data-testid="embedded-lesson-viewer">
        {/* Progress Bar */}
        <Card className="print:hidden">
        <CardContent className="p-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Study Progress</span>
              <span className="text-muted-foreground">
                {completedLessons} of {lessons.length} completed
              </span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Lesson Navigation */}
      <div className="flex items-center justify-between print:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={goToPreviousDay}
          disabled={currentDayIndex === 0}
          data-testid="button-previous-lesson"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Previous
        </Button>
        
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm" data-testid="badge-day-indicator">
            Day {currentLesson.dayNumber} of {totalDays || lessons.length}
          </Badge>
          {isCompleted && (
            <Badge variant="default" className="bg-green-600 text-white">
              <CheckCircle className="w-3 h-3 mr-1" />
              Completed
            </Badge>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={goToNextDay}
          disabled={currentDayIndex === lessons.length - 1}
          data-testid="button-next-lesson"
        >
          Next
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      {/* Lesson Content */}
      <Card className="lesson-print-content">
        <CardHeader className="print:pb-2">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-xl mb-1" data-testid="text-lesson-title">
                {currentLesson.title}
              </CardTitle>
              {currentLesson.estimatedMinutes && (
                <p className="text-sm text-muted-foreground">
                  ⏱️ {currentLesson.estimatedMinutes} min read
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrint}
              className="print:hidden"
              data-testid="button-print-lesson"
            >
              <Printer className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Scripture Reference */}
          {currentLesson.scripture && (
            <div className="p-4 bg-ministry-gold/10 rounded-lg border-l-4 border-ministry-gold">
              <p className="text-sm font-medium text-ministry-gold mb-1">Scripture</p>
              <p className="font-serif text-base" data-testid="text-scripture">
                {currentLesson.scripture}
              </p>
            </div>
          )}

          {/* Main Content */}
          <div
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: currentLesson.content }}
            data-testid="content-lesson-body"
          />

          {/* Key Takeaway */}
          {currentLesson.keyTakeaway && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
                💡 Key Takeaway
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-200" data-testid="text-key-takeaway">
                {currentLesson.keyTakeaway}
              </p>
            </div>
          )}

          {/* Reflection Questions */}
          {currentLesson.questions && currentLesson.questions.length > 0 && (
            <div className="space-y-4 print:break-inside-avoid">
              <h3 className="font-semibold text-lg">Reflection Questions</h3>
              {currentLesson.questions.map((q, index) => (
                <div key={q.id} className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="mt-1">
                      {q.type}
                    </Badge>
                    <p className="text-sm flex-1 font-medium" data-testid={`question-text-${index}`}>
                      {index + 1}. {q.question}
                    </p>
                  </div>
                  {!isCompleted && (
                    <Textarea
                      placeholder="Type your reflection here..."
                      value={answers[q.id] || ""}
                      onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                      rows={3}
                      className="print:hidden"
                      data-testid={`textarea-answer-${index}`}
                    />
                  )}
                  {isCompleted && currentProgress?.answers?.[q.id] && (
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded border">
                      <p className="text-sm text-muted-foreground mb-1">Your answer:</p>
                      <p className="text-sm">{currentProgress.answers[q.id]}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Mark Complete Button */}
          {!isCompleted && (
            <div className="flex justify-center pt-4 print:hidden">
              <Button
                onClick={() => markCompleteMutation.mutate()}
                disabled={markCompleteMutation.isPending}
                className="bg-ministry-gold hover:bg-ministry-gold/90 text-ministry-charcoal font-semibold"
                data-testid="button-mark-complete"
              >
                {markCompleteMutation.isPending ? (
                  "Marking Complete..."
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Mark as Complete
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lesson Navigation Dots */}
      <div className="flex justify-center gap-2 print:hidden">
        {lessons.map((lesson, index) => {
          const progress = lessonProgressData.find(p => p.lessonId === lesson.id);
          const completed = !!progress?.completedAt;
          return (
            <button
              key={lesson.id}
              onClick={() => {
                setCurrentDayIndex(index);
                setAnswers({});
              }}
              className={`p-1 rounded-full transition-colors ${
                index === currentDayIndex
                  ? "bg-ministry-gold"
                  : completed
                  ? "bg-green-600"
                  : "bg-gray-300 dark:bg-gray-600"
              }`}
              title={`Day ${lesson.dayNumber}: ${lesson.title}${completed ? " (Completed)" : ""}`}
              data-testid={`nav-dot-${index}`}
            >
              {completed ? (
                <CheckCircle className="w-4 h-4 text-white" />
              ) : (
                <Circle className="w-4 h-4 text-white" />
              )}
            </button>
          );
        })}
      </div>
      </div>
    </>
  );
}
