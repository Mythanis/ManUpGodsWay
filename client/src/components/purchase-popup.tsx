import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, X } from "lucide-react";

interface Study {
  id: string;
  title: string;
  price?: string;
  description?: string;
  estimatedHours?: number;
  category?: string;
}

interface PurchasePopupProps {
  isOpen: boolean;
  onClose: () => void;
  study: Study;
  onPurchase: (studyId: string) => void;
}

export function PurchasePopup({ isOpen, onClose, study, onPurchase }: PurchasePopupProps) {
  const [isPurchasing, setIsPurchasing] = useState(false);

  const handlePurchase = async () => {
    setIsPurchasing(true);
    try {
      await onPurchase(study.id);
    } finally {
      setIsPurchasing(false);
    }
  };

  const formatPrice = (price?: string) => {
    if (!price) return "$0.00";
    const numPrice = parseFloat(price);
    return `$${numPrice.toFixed(2)}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold text-ministry-charcoal">
              Purchase Study
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-6 w-6 p-0"
              data-testid="button-close-purchase"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Study Info */}
          <div className="bg-ministry-gold-exact/10 rounded-lg p-4">
            <h3 className="font-semibold text-ministry-charcoal mb-2" data-testid="text-study-title">
              {study.title}
            </h3>
            {study.description && (
              <p className="text-sm text-ministry-slate mb-3" data-testid="text-study-description">
                {study.description}
              </p>
            )}
            <div className="flex items-center space-x-2">
              {study.category && (
                <Badge variant="secondary" className="text-xs">
                  {study.category}
                </Badge>
              )}
              {study.estimatedHours && (
                <span className="text-xs text-ministry-slate">
                  {study.estimatedHours}h
                </span>
              )}
            </div>
          </div>

          {/* Price */}
          <div className="flex items-center justify-between p-4 bg-white border border-ministry-steel/20 rounded-lg">
            <span className="font-medium text-ministry-charcoal">Study Price:</span>
            <span className="text-2xl font-bold text-ministry-charcoal" data-testid="text-study-price">
              {formatPrice(study.price)}
            </span>
          </div>

          {/* Purchase Message */}
          <div className="text-center py-2">
            <p className="text-sm text-ministry-slate">
              After purchase, you'll have lifetime access to this study and all its lessons.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3 pt-4">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 border-ministry-steel text-ministry-charcoal hover:bg-ministry-steel/10"
            disabled={isPurchasing}
            data-testid="button-cancel-purchase"
          >
            Cancel
          </Button>
          <Button
            onClick={handlePurchase}
            disabled={isPurchasing}
            className="flex-1 bg-ministry-gold text-ministry-navy hover:bg-ministry-gold/90"
            data-testid="button-confirm-purchase"
          >
            <CreditCard className="w-4 h-4 mr-2" />
            {isPurchasing ? "Processing..." : `Purchase ${formatPrice(study.price)}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}