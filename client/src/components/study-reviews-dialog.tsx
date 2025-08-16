import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar } from "@/components/ui/avatar";
import { Star } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface StudyReviewsDialogProps {
  studyId: string;
  studyTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

interface Review {
  id: string;
  rating: number;
  review: string;
  createdAt: string;
  user: {
    firstName: string;
    lastName: string;
    profileImageUrl?: string;
  };
}

export function StudyReviewsDialog({ studyId, studyTitle, isOpen, onClose }: StudyReviewsDialogProps) {
  const { data: reviews = [], isLoading } = useQuery<Review[]>({
    queryKey: ["/api/studies", studyId, "reviews"],
    enabled: isOpen,
  });

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < rating
            ? "text-ministry-gold fill-current"
            : "text-gray-300"
        }`}
      />
    ));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Reviews for {studyTitle}</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh] pr-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ministry-navy"></div>
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-8 text-ministry-slate">
              No reviews yet for this study.
            </div>
          ) : (
            <div className="space-y-6">
              {reviews.map((review) => (
                <div key={review.id} className="border-b border-gray-100 pb-6 last:border-b-0">
                  <div className="flex items-start space-x-4">
                    <img
                      src={
                        review.user.profileImageUrl ||
                        `https://ui-avatars.com/api/?name=${review.user.firstName}+${review.user.lastName}&background=4A90B8&color=fff&size=40`
                      }
                      alt={`${review.user.firstName} ${review.user.lastName}`}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-ministry-charcoal">
                            {review.user.firstName} {review.user.lastName}
                          </span>
                          <div className="flex items-center">
                            {renderStars(review.rating)}
                          </div>
                        </div>
                        <span className="text-sm text-ministry-slate">
                          {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-ministry-slate leading-relaxed">
                        {review.review}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}