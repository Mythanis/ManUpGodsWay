import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import DiscussionCard from "@/components/discussion-card";
import { X, MessageCircle, ArrowLeft } from "lucide-react";
import type { Lesson as LessonType } from "@shared/schema";

export default function Lesson() {
  const [match, params] = useRoute("/study/:studyId/lesson/:lessonNumber");
  const [, setLocation] = useLocation();
  const [showDiscussionDialog, setShowDiscussionDialog] = useState(false);
  const { user } = useAuth();

  if (!match || !params) {
    return <div>Lesson not found</div>;
  }

  const studyId = params.studyId as string;
  const lessonNumber = params.lessonNumber as string;

  // Fetch lesson data
  const { data: lesson, isLoading: lessonLoading } = useQuery<LessonType>({
    queryKey: ["/api/lessons", studyId, lessonNumber],
    retry: false,
  });

  // Fetch study data for the discussion
  const { data: study } = useQuery({
    queryKey: ["/api/studies", studyId],
    retry: false,
  });

  // Fetch study discussions
  const { data: discussions = [] } = useQuery<any[]>({
    queryKey: ["/api/discussions", "study", studyId],
    enabled: showDiscussionDialog,
    retry: false,
  });

  const handleClose = () => {
    setLocation(`/studies/${studyId}`);
  };

  const handleShowDiscussions = () => {
    setShowDiscussionDialog(true);
  };

  if (lessonLoading || !lesson) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ministry-navy mx-auto mb-4"></div>
          <p className="text-ministry-slate">Loading lesson...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header with Navigation */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between p-4">
          {/* Message Button (Top Left) */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleShowDiscussions}
            className="flex items-center space-x-2"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Discussion</span>
          </Button>

          {/* Lesson Title (Center) */}
          <div className="flex-1 text-center">
            <h1 className="text-lg font-bold text-ministry-charcoal dark:text-white">
              {lesson.title}
            </h1>
            <p className="text-sm text-ministry-slate">
              Lesson {lesson.lessonNumber} • {lesson.estimatedMinutes} minutes
            </p>
          </div>

          {/* Close Button (Top Right) */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="flex items-center space-x-2"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Lesson Content */}
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardContent className="p-8">
            {/* Video Section */}
            {(lesson.videoId || lesson.videoUrl) && (
              <div className="mb-8">
                <div className="aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                  {lesson.videoUrl ? (
                    lesson.videoUrl.startsWith('http') ? (
                      // External video URL
                      <video
                        controls
                        className="w-full h-full object-cover"
                        preload="metadata"
                        crossOrigin="anonymous"
                        onError={(e) => {
                          console.error('Video playback error:', e);
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      >
                        <source src={lesson.videoUrl} type="video/mp4" />
                        <source src={lesson.videoUrl} type="video/webm" />
                        <source src={lesson.videoUrl} type="video/ogg" />
                        Your browser does not support the video tag.
                      </video>
                    ) : (
                      // Uploaded video ID - use streaming endpoint
                      <video
                        controls
                        className="w-full h-full object-cover"
                        preload="metadata"
                        crossOrigin="anonymous"
                        onError={(e) => {
                          console.error('Video stream error:', e);
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                        onLoadStart={() => console.log('Video loading started')}
                        onCanPlay={() => console.log('Video can play')}
                        onLoadedData={() => console.log('Video data loaded')}
                      >
                        <source src={`/api/videos/${lesson.videoUrl}/stream?fromLesson=true`} type="video/mp4" />
                        Your browser does not support the video tag.
                      </video>
                    )
                  ) : lesson.videoId ? (
                    // Video ID reference
                    <video
                      controls
                      className="w-full h-full object-cover"
                      preload="metadata"
                      crossOrigin="anonymous"
                      onError={(e) => {
                        console.error('Video ID stream error:', e);
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                      onLoadStart={() => console.log('Video loading started')}
                      onCanPlay={() => console.log('Video can play')}
                      onLoadedData={() => console.log('Video data loaded')}
                    >
                      <source src={`/api/videos/${lesson.videoId}/stream?fromLesson=true`} type="video/mp4" />
                      Your browser does not support the video tag.
                    </video>
                  ) : (
                    <div className="text-center text-ministry-slate flex items-center justify-center h-full">
                      <div>
                        <div className="text-4xl mb-2">🎥</div>
                        <p>Video content will be available soon</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Fallback error message (hidden by default) */}
                  <div 
                    className="text-center text-ministry-slate flex items-center justify-center h-full"
                    style={{ display: 'none' }}
                  >
                    <div>
                      <div className="text-4xl mb-2">⚠️</div>
                      <p>Video cannot be played at this time</p>
                      <p className="text-sm mt-2">Please check your connection or try again later</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Lesson Content */}
            <div className="prose prose-lg max-w-none dark:prose-invert">
              <div className="whitespace-pre-wrap text-ministry-charcoal dark:text-gray-300 leading-relaxed">
                {lesson.content}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Navigation Footer */}
        <div className="flex items-center justify-between mt-8">
          <Button
            variant="outline"
            onClick={handleClose}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Study</span>
          </Button>

          <div className="flex items-center space-x-4">
            {/* Previous/Next lesson buttons could go here */}
          </div>
        </div>
      </div>

      {/* Discussion Dialog */}
      <Dialog open={showDiscussionDialog} onOpenChange={setShowDiscussionDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <MessageCircle className="w-5 h-5 text-ministry-navy" />
              <span>Study Discussions</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {discussions.length > 0 ? (
              discussions.map((discussion: any) => (
                <DiscussionCard
                  key={discussion.id}
                  discussion={discussion}
                  currentUserTier={(user as any)?.subscriptionTier || 'free'}
                />
              ))
            ) : (
              <div className="text-center py-8">
                <MessageCircle className="w-12 h-12 text-ministry-slate mx-auto mb-4" />
                <p className="text-ministry-slate">No discussions yet for this study</p>
                <p className="text-sm text-ministry-slate">
                  Start a conversation in the Community section!
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}