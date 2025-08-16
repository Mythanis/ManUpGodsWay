import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, Star, MessageSquare, Video } from "lucide-react";
import { Link } from "wouter";
import { StudyReviewsDialog } from "@/components/study-reviews-dialog";

interface StudyCardProps {
  study: any;
}

export default function StudyCard({ study }: StudyCardProps) {
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
    <Card className="shadow-sm border border-gray-100 overflow-hidden" data-testid="study-card">
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
                  <h3 className="font-semibold text-ministry-charcoal text-sm" data-testid="text-study-title">
                    {study.title}
                  </h3>
                  {study.videoUrl && (
                    <Video className="w-3 h-3 text-ministry-steel flex-shrink-0" title="Includes video content" />
                  )}
                </div>
                <p className="text-xs text-ministry-slate" data-testid="text-study-lessons">
                  {study.lessonCount} lessons • {study.estimatedHours}h
                </p>
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
                  className="text-ministry-steel text-xs font-medium hover:text-ministry-navy p-1"
                  data-testid="button-view-study"
                >
                  {study.requiredTier === 'free' ? 'Start' : 'View'}
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
