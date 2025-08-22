import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, Star, MessageSquare, Video, CheckCircle } from "lucide-react";
import { Link } from "wouter";
import { StudyReviewsDialog } from "@/components/study-reviews-dialog";

interface StudyCardProps {
  study: any;
  isCompleted?: boolean;
  completedAt?: string;
}

export default function StudyCard({ study, isCompleted = false, completedAt }: StudyCardProps) {
  const [showReviews, setShowReviews] = useState(false);
  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'premium':
        return 'bg-ministry-steel/20 text-ministry-steel';
      case 'vip':
        return 'bg-ministry-gold/20 text-ministry-gold';
      default:
        return 'bg-ministry-success/20 text-ministry-success';
    }
  };

  const getTierLabel = (tier: string) => {
    return tier.charAt(0).toUpperCase() + tier.slice(1);
  };

  return (
    <Card className={`shadow-sm border overflow-hidden transition-all ${
      isCompleted 
        ? 'border-ministry-success/30 bg-ministry-success/5' 
        : 'border-gray-100 bg-ministry-gold/20'
    }`} data-testid="study-card">
      <CardContent className="p-0">
        <div className="flex">
          <img 
            src={study.thumbnailUrl || `https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&h=120`}
            alt={study.title}
            className="w-24 h-20 object-cover"
            data-testid="img-study-thumbnail"
          />
          <div className="flex-1 p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <h3 className={`font-semibold text-sm ${
                    isCompleted ? 'text-ministry-success' : 'text-ministry-charcoal'
                  }`} data-testid="text-study-title">
                    {study.title}
                  </h3>
                  {isCompleted && (
                    <CheckCircle className="w-4 h-4 text-ministry-success flex-shrink-0" />
                  )}
                  {study.videoUrl && (
                    <Video className="w-3 h-3 text-ministry-steel flex-shrink-0" />
                  )}
                </div>
                <div className="text-xs text-ministry-slate" data-testid="text-study-lessons">
                  {isCompleted && completedAt ? (
                    <p className="text-ministry-success font-medium mb-1">
                      ✓ Completed {new Date(completedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                  ) : null}
                  <p>{study.lessonCount} lessons • {study.estimatedHours}h</p>
                </div>
              </div>
              {study.rating > 0 && (
                <div className="flex items-center ml-2 space-x-2" data-testid="rating-display">
                  <div className="flex items-center">
                    <Star className="w-3 h-3 text-ministry-gold fill-current mr-1" />
                    <span className="text-xs text-ministry-slate">{study.rating}</span>
                  </div>
                  {study.ratingCount > 0 && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowReviews(true);
                      }}
                      className="flex items-center text-xs text-ministry-steel hover:text-ministry-navy transition-colors"
                      data-testid="button-view-reviews"
                    >
                      <MessageSquare className="w-3 h-3 mr-1" />
                      <span>({study.ratingCount})</span>
                    </button>
                  )}
                </div>
              )}
            </div>
            
            <p className="text-xs text-ministry-slate mb-3 line-clamp-2" data-testid="text-study-description">
              {study.description}
            </p>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Badge className={`${getTierColor(study.requiredTier)} text-xs px-2 py-1`} data-testid="badge-tier">
                  {getTierLabel(study.requiredTier)}
                </Badge>
                <div className="flex items-center space-x-1 text-xs text-ministry-slate">
                  <Users className="w-3 h-3" />
                  <span>{study.difficulty}</span>
                </div>
              </div>
              <Link href={`/studies/${study.id}`}>
                <Button
                  variant="ghost"
                  className={`text-xs font-medium p-1 ${
                    isCompleted 
                      ? 'text-ministry-success hover:text-ministry-success/80'
                      : 'text-ministry-steel hover:text-ministry-navy'
                  }`}
                  data-testid="button-view-study"
                >
                  {isCompleted ? 'Review' : (study.requiredTier === 'free' ? 'Start' : 'View')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </CardContent>
      <StudyReviewsDialog 
        studyId={study.id}
        studyTitle={study.title}
        isOpen={showReviews}
        onClose={() => setShowReviews(false)}
      />
    </Card>
  );
}
