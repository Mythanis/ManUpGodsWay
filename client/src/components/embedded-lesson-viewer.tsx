import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { sanitizeHtml } from "@/lib/sanitize";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useRefTagger } from "@/hooks/useRefTagger";
import { ChevronLeft, ChevronRight, CheckCircle, Circle, Printer, StickyNote, Save, Loader2, Trophy, ArrowRight, BookOpen, Lock, Clock } from "lucide-react";

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
  isLocked?: boolean;
  unlocksAt?: string | null;
}

interface LessonProgress {
  id?: string;
  userId: string;
  lessonId: string;
  completedAt: Date | null;
  answers?: Record<string, string>;
  notes?: string;
}

interface EmbeddedLessonViewerProps {
  studyId: string;
  totalDays?: number;
  userId: string;
}

interface NextStudySuggestion {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  totalDays?: number;
  seriesTitle?: string;
}

export function EmbeddedLessonViewer({ studyId, totalDays, userId }: EmbeddedLessonViewerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<string>("");
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [nextStudySuggestion, setNextStudySuggestion] = useState<NextStudySuggestion | null>(null);
  
  const contentRef = useRefTagger([currentDayIndex]);

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

  // Auto-advance to the first unlocked incomplete lesson when data loads
  const [hasAutoAdvanced, setHasAutoAdvanced] = useState(false);
  useEffect(() => {
    if (hasAutoAdvanced || lessonsLoading || lessons.length === 0 || lessonProgressData === undefined) return;
    // Find first lesson that is unlocked AND incomplete
    const firstUnlockedIncomplete = lessons.findIndex(
      (lesson) =>
        !lesson.isLocked &&
        !lessonProgressData.find((p) => p.lessonId === lesson.id && p.completedAt)
    );
    if (firstUnlockedIncomplete > 0) {
      setCurrentDayIndex(firstUnlockedIncomplete);
    } else if (firstUnlockedIncomplete === -1) {
      // All unlocked lessons are done — stay on last completed unlocked lesson
      const lastUnlocked = [...lessons].reverse().findIndex(l => !l.isLocked);
      if (lastUnlocked >= 0) {
        setCurrentDayIndex(lessons.length - 1 - lastUnlocked);
      }
    }
    setHasAutoAdvanced(true);
  }, [lessons, lessonProgressData, lessonsLoading, hasAutoAdvanced]);

  const currentLesson = lessons[currentDayIndex];
  const currentProgress = lessonProgressData.find(p => p.lessonId === currentLesson?.id);
  const isCompleted = !!currentProgress?.completedAt;
  const isCurrentLessonLocked = !!currentLesson?.isLocked;

  // Format unlock time for display
  const formatUnlockTime = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "tomorrow";
    const unlockDate = new Date(dateStr);
    const now = new Date();
    const msRemaining = unlockDate.getTime() - now.getTime();
    if (msRemaining <= 0) return "now";
    const hoursRemaining = Math.ceil(msRemaining / (1000 * 60 * 60));
    if (hoursRemaining <= 1) {
      const minutesRemaining = Math.ceil(msRemaining / (1000 * 60));
      return `in ${minutesRemaining} minute${minutesRemaining !== 1 ? "s" : ""}`;
    }
    if (hoursRemaining < 24) return `in ${hoursRemaining} hour${hoursRemaining !== 1 ? "s" : ""}`;
    return "tomorrow";
  };

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
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}/lesson-progress`] });
      queryClient.invalidateQueries({ queryKey: [`/api/studies/${studyId}/progress`] });
      setAnswers({});
      if (data?.studyCompleted) {
        setNextStudySuggestion(data.nextStudy || null);
        setShowCompleteModal(true);
      } else {
        toast({
          title: "Lesson Completed!",
          description: `You've completed Day ${currentLesson.dayNumber}`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mark lesson as complete",
        variant: "destructive",
      });
    },
  });

  // Save notes mutation
  const saveNotesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/studies/${studyId}/lessons/${currentLesson.id}/notes`, {
        notes: notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}/lesson-progress`] });
      toast({
        title: "Notes Saved",
        description: "Your study notes have been saved",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save notes",
        variant: "destructive",
      });
    },
  });

  // Track "Start a Study" activity when user first views the study
  const [hasTrackedStudyStart, setHasTrackedStudyStart] = useState(false);
  
  const trackStartMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/studies/${studyId}/track-start`);
    },
    onSuccess: (data: any) => {
      setHasTrackedStudyStart(true);
      if (data?.rationsAwarded > 0) {
        toast({
          title: "Mission Started!",
          description: `You earned ${data.rationsAwarded} rations for starting this study`,
        });
      }
    },
    onError: () => {
      // Mark as attempted to avoid infinite retry loops
      // This is a non-critical tracking feature - user can still use the study normally
      setHasTrackedStudyStart(true);
    },
  });

  // Track study start only once when lessons are loaded and userId is available
  useEffect(() => {
    if (!hasTrackedStudyStart && !trackStartMutation.isPending && lessons.length > 0 && !lessonsLoading && userId) {
      trackStartMutation.mutate();
    }
  }, [hasTrackedStudyStart, lessons.length, lessonsLoading, userId, trackStartMutation.isPending]);

  // Load existing notes and answers when lesson changes
  useEffect(() => {
    if (currentProgress) {
      setNotes(currentProgress.notes || "");
      if (currentProgress.answers) {
        setAnswers(currentProgress.answers);
      }
    } else {
      setNotes("");
      setAnswers({});
    }
  }, [currentLesson?.id, currentProgress]);

  const handlePrint = () => {
    window.print();
  };

  const goToPreviousDay = () => {
    if (currentDayIndex > 0) {
      setCurrentDayIndex(currentDayIndex - 1);
    }
  };

  const nextLesson = lessons[currentDayIndex + 1];
  const isNextLessonLocked = !!nextLesson?.isLocked;

  const goToNextDay = () => {
    if (currentDayIndex < lessons.length - 1 && !isNextLessonLocked) {
      setCurrentDayIndex(currentDayIndex + 1);
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
      
      <div ref={contentRef} className="space-y-4 print:space-y-2" data-testid="embedded-lesson-viewer">
      {/* Lesson Navigation */}
      <div className="bg-[#FCD000] text-black border-2 border-black rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] p-3 print:hidden">
        <div className="flex items-center justify-between gap-2 relative z-10">
          <Button
            size="sm"
            onClick={goToPreviousDay}
            disabled={currentDayIndex === 0}
            className="bg-black text-white rounded-sm font-black uppercase text-[10px] hover:bg-gray-800 disabled:opacity-30 px-3 py-1 h-8 min-w-0 border-2 border-white"
            data-testid="button-previous-lesson"
          >
            <ChevronLeft className="w-4 h-4 text-white" />
            <span className="hidden sm:inline ml-1 text-white">Prev</span>
          </Button>
          
          <div className="flex flex-col items-center gap-1 flex-1">
            <span className="text-xs font-black text-black uppercase tracking-wide" data-testid="badge-day-indicator">
              Day {currentLesson.dayNumber} of {totalDays || lessons.length}
            </span>
            {isCompleted && (
              <span className="text-[10px] font-bold text-green-700 uppercase tracking-wide flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Completed
              </span>
            )}
          </div>

          <Button
            size="sm"
            onClick={goToNextDay}
            disabled={currentDayIndex === lessons.length - 1 || isNextLessonLocked}
            title={isNextLessonLocked ? `Unlocks ${formatUnlockTime(nextLesson?.unlocksAt)}` : undefined}
            className="bg-black text-white rounded-sm font-black uppercase text-[10px] hover:bg-gray-800 disabled:opacity-30 px-3 py-1 h-8 min-w-0 border-2 border-white"
            data-testid="button-next-lesson"
          >
            {isNextLessonLocked
              ? <Lock className="w-4 h-4 text-white" />
              : (
                <>
                  <span className="hidden sm:inline mr-1 text-white">Next</span>
                  <ChevronRight className="w-4 h-4 text-white" />
                </>
              )
            }
          </Button>
        </div>
      </div>

      {/* Lesson Content */}
      <Card className="lesson-print-content liquid-black border-2 border-black rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <CardHeader className="print:pb-2 relative z-10">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="mb-1" data-testid="text-lesson-title">
                <span className="text-lg font-bold text-[#FCD000] tracking-wide">Day {currentLesson.dayNumber}:</span>
                <CardTitle className="text-2xl font-black text-white tracking-tight mt-1">
                  {currentLesson.title}
                </CardTitle>
              </div>
              {currentLesson.estimatedMinutes && (
                <p className="text-sm text-[#FCD000] font-bold">
                  ⏱️ {currentLesson.estimatedMinutes} min read
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrint}
              className="print:hidden text-white hover:bg-white/20"
              data-testid="button-print-lesson"
            >
              <Printer className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 relative z-10">
          {/* Lock Banner */}
          {isCurrentLessonLocked && (
            <div className="flex items-center gap-3 p-4 bg-zinc-900 border-2 border-zinc-600 rounded-sm">
              <div className="w-10 h-10 flex-shrink-0 bg-zinc-800 border-2 border-zinc-600 rounded-sm flex items-center justify-center">
                <Lock className="w-5 h-5 text-zinc-400" />
              </div>
              <div>
                <p className="text-sm font-black text-zinc-300 uppercase tracking-wide">Lesson Locked</p>
                <p className="text-xs text-zinc-500 font-medium flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3" />
                  Unlocks {formatUnlockTime(currentLesson.unlocksAt)}
                </p>
              </div>
            </div>
          )}

          {/* Scripture Reference */}
          {currentLesson.scripture && (
            <div className="p-4 bg-[#FCD000] rounded-sm border-l-4 border-black">
              <p className="text-xs font-black text-black mb-1 uppercase tracking-wide">Scripture</p>
              <p className="font-serif text-base text-black" data-testid="text-scripture">
                {currentLesson.scripture}
              </p>
            </div>
          )}

          {/* Main Content */}
          <div
            className="prose prose-base max-w-none prose-invert prose-headings:font-black prose-headings:uppercase prose-headings:tracking-tight prose-p:text-gray-200 prose-p:text-base prose-strong:text-[#FCD000] prose-strong:font-bold prose-em:italic prose-em:text-gray-300 prose-ul:list-disc prose-ul:pl-4 prose-ol:list-decimal prose-ol:pl-4 prose-li:text-gray-200 prose-li:text-base prose-blockquote:border-l-4 prose-blockquote:border-[#FCD000] prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-gray-300 prose-a:text-[#FCD000] prose-a:underline"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(currentLesson.content) }}
            data-testid="content-lesson-body"
          />

          {/* Key Takeaway */}
          {currentLesson.keyTakeaway && (
            <div className="p-4 bg-[#FCD000] rounded-sm border-2 border-black">
              <p className="text-xs font-black text-black mb-2 uppercase tracking-wide">
                💡 Key Takeaway
              </p>
              <p className="text-base text-black font-medium" data-testid="text-key-takeaway">
                {currentLesson.keyTakeaway}
              </p>
            </div>
          )}

          {/* Personal Study Notes */}
          <div className="border-2 border-[#FCD000] rounded-sm print:hidden bg-black/50">
            <button
              onClick={() => setNotesExpanded(!notesExpanded)}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-white/10 transition-colors"
              data-testid="button-toggle-notes"
            >
              <div className="flex items-center gap-2">
                <StickyNote className="w-5 h-5 text-[#FCD000]" />
                <span className="font-black text-white uppercase tracking-wide text-sm">My Study Notes</span>
                {notes && <Badge className="text-xs bg-[#FCD000] text-black font-bold rounded-sm">Notes Added</Badge>}
              </div>
              <ChevronRight className={`w-4 h-4 text-[#FCD000] transition-transform ${notesExpanded ? 'rotate-90' : ''}`} />
            </button>
            {notesExpanded && (
              <div className="px-4 pb-4 space-y-3">
                <Textarea
                  placeholder="Write your personal notes, thoughts, and reflections here..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={6}
                  className="resize-y bg-white text-black border-2 border-black rounded-sm font-medium"
                  data-testid="textarea-study-notes"
                />
                <Button
                  size="sm"
                  onClick={() => saveNotesMutation.mutate()}
                  disabled={saveNotesMutation.isPending}
                  className="bg-[#FCD000] hover:bg-yellow-400 text-black font-black uppercase tracking-wide border-2 border-black rounded-sm"
                  data-testid="button-save-notes"
                >
                  {saveNotesMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Notes
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Reflection Questions */}
          {currentLesson.questions && currentLesson.questions.length > 0 && (
            <div className="space-y-4 print:break-inside-avoid">
              <h3 className="font-black text-lg text-[#FCD000] uppercase tracking-tight">Reflection Questions</h3>
              {currentLesson.questions.map((q, index) => {
                const isFillInBlank = q.type?.toLowerCase() === 'fill_in_blank' || q.type?.toLowerCase() === 'fill-in-blank' || q.type?.toLowerCase() === 'fillinblank';
                
                // Parse fill-in-blank question to find blanks (marked with ___ or [blank])
                const renderFillInBlank = () => {
                  const parts = q.question.split(/(___|___+|\[blank\]|\[___\])/gi);
                  let blankIndex = 0;
                  
                  return (
                    <div className="text-sm text-white font-medium leading-relaxed">
                      {parts.map((part, partIdx) => {
                        if (part.match(/^_+$|^\[blank\]$|^\[___\]$/i)) {
                          const currentBlankIndex = blankIndex;
                          const blankKey = `${q.id}_blank_${currentBlankIndex}`;
                          blankIndex++;
                          
                          if (isCompleted && currentProgress?.answers?.[blankKey]) {
                            return (
                              <span key={partIdx} className="inline-block mx-1 px-2 py-0.5 bg-[#FCD000] text-black font-bold border-b-2 border-black min-w-[80px] text-center">
                                {currentProgress.answers[blankKey]}
                              </span>
                            );
                          }
                          
                          return (
                            <input
                              key={partIdx}
                              type="text"
                              placeholder="________"
                              value={answers[blankKey] || ""}
                              onChange={(e) => handleAnswerChange(blankKey, e.target.value)}
                              className="inline-block mx-1 px-2 py-0.5 bg-white text-black border-b-2 border-[#FCD000] min-w-[100px] max-w-[200px] font-medium focus:outline-none focus:border-black"
                              disabled={isCompleted}
                              data-testid={`input-blank-${index}-${currentBlankIndex}`}
                            />
                          );
                        }
                        return <span key={partIdx}>{part}</span>;
                      })}
                    </div>
                  );
                };
                
                return (
                  <div key={q.id} className="space-y-2">
                    <div className="flex items-start gap-2">
                      <Badge className="mt-1 bg-[#FCD000] text-black font-bold rounded-sm uppercase text-xs shrink-0">
                        {isFillInBlank ? 'Fill In' : q.type}
                      </Badge>
                      {isFillInBlank ? (
                        <div className="flex-1" data-testid={`question-text-${index}`}>
                          <span className="text-white font-bold mr-1">{index + 1}.</span>
                          {renderFillInBlank()}
                        </div>
                      ) : (
                        <p className="text-sm flex-1 font-bold text-white" data-testid={`question-text-${index}`}>
                          {index + 1}. {q.question}
                        </p>
                      )}
                    </div>
                    {!isFillInBlank && !isCompleted && (
                      <Textarea
                        placeholder="Type your reflection here..."
                        value={answers[q.id] || ""}
                        onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                        rows={3}
                        className="print:hidden bg-white text-black border-2 border-black rounded-sm font-medium"
                        data-testid={`textarea-answer-${index}`}
                      />
                    )}
                    {!isFillInBlank && isCompleted && currentProgress?.answers?.[q.id] && (
                      <div className="p-3 bg-[#FCD000] rounded-sm border-2 border-black">
                        <p className="text-xs text-black/70 mb-1 font-bold uppercase">Your answer:</p>
                        <p className="text-sm text-black font-medium">{currentProgress.answers[q.id]}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Mark Complete Button */}
          {!isCompleted && (
            <div className="flex flex-col items-center gap-2 pt-4 print:hidden">
              {isCurrentLessonLocked ? (
                <div className="flex items-center gap-2 px-6 py-3 bg-zinc-800 border-2 border-zinc-600 rounded-sm">
                  <Lock className="w-4 h-4 text-zinc-500" />
                  <span className="text-zinc-400 font-black uppercase tracking-wide text-sm">
                    Unlocks {formatUnlockTime(currentLesson.unlocksAt)}
                  </span>
                </div>
              ) : (
                <Button
                  onClick={() => markCompleteMutation.mutate()}
                  disabled={markCompleteMutation.isPending}
                  className="bg-[#FCD000] hover:bg-yellow-400 text-black font-black uppercase tracking-wide border-2 border-black rounded-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all px-6 py-3"
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
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lesson Navigation Dots */}
      <div className="flex justify-center gap-2 print:hidden flex-wrap p-2 bg-black/50 border-2 border-[#FCD000] rounded-sm">
        {lessons.map((lesson, index) => {
          const progress = lessonProgressData.find(p => p.lessonId === lesson.id);
          const completed = !!progress?.completedAt;
          const locked = !!lesson.isLocked;
          return (
            <button
              key={lesson.id}
              onClick={() => {
                setCurrentDayIndex(index);
                setAnswers({});
              }}
              className={`p-1 transition-all border-2 ${
                index === currentDayIndex
                  ? "bg-[#FCD000] border-black scale-110"
                  : completed
                  ? "bg-green-600 border-green-800"
                  : locked
                  ? "bg-zinc-800 border-zinc-600 opacity-60"
                  : "bg-gray-600 border-gray-500 hover:bg-gray-500"
              }`}
              title={`Day ${lesson.dayNumber}: ${lesson.title}${completed ? " (Completed)" : locked ? " (Locked)" : ""}`}
              data-testid={`nav-dot-${index}`}
            >
              {completed ? (
                <CheckCircle className="w-4 h-4 text-white" />
              ) : locked ? (
                <Lock className={`w-4 h-4 ${index === currentDayIndex ? 'text-black' : 'text-zinc-400'}`} />
              ) : (
                <Circle className={`w-4 h-4 ${index === currentDayIndex ? 'text-black' : 'text-white'}`} />
              )}
            </button>
          );
        })}
      </div>
      </div>

      {/* Study Complete Modal */}
      <Dialog open={showCompleteModal} onOpenChange={setShowCompleteModal}>
        <DialogContent className="bg-[#1a1a1a] border-2 border-[#FCD000] text-white max-w-md mx-auto">
          <DialogHeader>
            <div className="flex flex-col items-center text-center gap-3 pt-2">
              <div className="bg-[#FCD000] rounded-full p-4">
                <Trophy className="w-8 h-8 text-black" />
              </div>
              <DialogTitle className="text-2xl font-black text-[#FCD000] uppercase tracking-wide">
                Study Complete!
              </DialogTitle>
              <p className="text-gray-300 text-sm">
                Well done, soldier. You've finished this study. Keep pushing forward.
              </p>
            </div>
          </DialogHeader>

          {nextStudySuggestion ? (
            <div className="mt-2">
              <p className="text-xs text-gray-400 uppercase tracking-widest mb-3 text-center font-bold">
                {nextStudySuggestion.seriesTitle ? `Next in ${nextStudySuggestion.seriesTitle}` : "Suggested Next Study"}
              </p>
              <div className="border-2 border-gray-700 rounded-sm overflow-hidden">
                {nextStudySuggestion.thumbnailUrl && (
                  <img
                    src={nextStudySuggestion.thumbnailUrl}
                    alt={nextStudySuggestion.title}
                    className="w-full h-32 object-cover"
                  />
                )}
                <div className="p-3 bg-[#111]">
                  <div className="flex items-center gap-2 mb-1">
                    <BookOpen className="w-4 h-4 text-[#FCD000]" />
                    <span className="font-bold text-white text-sm">{nextStudySuggestion.title}</span>
                  </div>
                  {nextStudySuggestion.totalDays && (
                    <p className="text-xs text-gray-400">{nextStudySuggestion.totalDays}-day study</p>
                  )}
                  {nextStudySuggestion.description && (
                    <p className="text-xs text-gray-300 mt-1 line-clamp-2">{nextStudySuggestion.description}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800"
                  onClick={() => setShowCompleteModal(false)}
                >
                  Stay Here
                </Button>
                <Button
                  className="flex-1 bg-[#FCD000] hover:bg-yellow-400 text-black font-black uppercase"
                  onClick={() => {
                    setShowCompleteModal(false);
                    setLocation(`/studies/${nextStudySuggestion.id}`);
                  }}
                >
                  Start Next <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex flex-col gap-3">
              <Button
                className="w-full bg-[#FCD000] hover:bg-yellow-400 text-black font-black uppercase"
                onClick={() => {
                  setShowCompleteModal(false);
                  setLocation("/studies");
                }}
              >
                Browse More Studies <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
              <Button
                variant="outline"
                className="w-full border-gray-600 text-gray-300 hover:bg-gray-800"
                onClick={() => setShowCompleteModal(false)}
              >
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
