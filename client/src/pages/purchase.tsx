import { useState, useEffect } from 'react';
import { useStripe, Elements, PaymentElement, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, CreditCard, Shield } from 'lucide-react';
import { useLocation } from 'wouter';

// Load Stripe with error handling
const stripePromise = (() => {
  const publicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
  if (!publicKey) {
    console.warn('Stripe public key not configured');
    return null;
  }
  return loadStripe(publicKey);
})();

interface PurchaseFormProps {
  amount: number;
  description: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const PurchaseForm = ({ amount, description, onSuccess, onCancel }: PurchaseFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      toast({
        title: "Payment System Unavailable",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/purchase?success=true`,
        },
      });

      if (error) {
        toast({
          title: "Payment Failed",
          description: error.message || "An unknown error occurred",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Payment Successful",
          description: "Thank you for your purchase!",
        });
        onSuccess();
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: "Payment Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" data-testid="form-purchase">
      <div className="bg-ministry-charcoal/5 p-4 rounded-lg border">
        <h3 className="font-semibold text-ministry-charcoal mb-2">Purchase Summary</h3>
        <div className="flex justify-between items-center">
          <span className="text-ministry-slate">{description}</span>
          <span className="font-bold text-xl text-ministry-charcoal">${amount.toFixed(2)}</span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 text-ministry-slate">
          <Shield className="h-4 w-4" />
          <span className="text-sm">Your payment is secured with 256-bit SSL encryption</span>
        </div>
        <PaymentElement />
      </div>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isProcessing}
          className="flex-1"
          data-testid="button-cancel-payment"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!stripe || isProcessing}
          className="flex-1 bg-ministry-gold text-black hover:bg-ministry-gold-exact/90"
          data-testid="button-complete-payment"
        >
          <CreditCard className="h-4 w-4 mr-2" />
          {isProcessing ? 'Processing...' : `Pay $${amount.toFixed(2)}`}
        </Button>
      </div>
    </form>
  );
};

export default function Purchase() {
  const [, setLocation] = useLocation();
  const [clientSecret, setClientSecret] = useState("");
  const [amount, setAmount] = useState(10);
  const [description, setDescription] = useState("Ministry Donation");
  const [isCreatingIntent, setIsCreatingIntent] = useState(false);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const { toast } = useToast();

  // Check for success parameter in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      toast({
        title: "Payment Successful!",
        description: "Thank you for your purchase. Your payment has been processed successfully.",
      });
      // Clear the success parameter
      window.history.replaceState({}, '', '/purchase');
    }
  }, [toast]);

  const createPaymentIntent = async () => {
    if (!amount || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount greater than $0.",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingIntent(true);
    try {
      const response = await apiRequest("POST", "/api/payments/create-payment-intent", { 
        amount,
        metadata: { 
          description,
          timestamp: new Date().toISOString()
        }
      });
      
      const data = await response.json();
      if (response.ok) {
        setClientSecret(data.clientSecret);
        setPaymentIntentId(data.paymentIntentId);
      } else {
        throw new Error(data.message || 'Failed to create payment');
      }
    } catch (error: any) {
      console.error('Error creating payment intent:', error);
      toast({
        title: "Payment Setup Failed",
        description: error.message || "Unable to set up payment. Please try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingIntent(false);
    }
  };

  const handleSuccess = () => {
    setClientSecret("");
    setPaymentIntentId(null);
    toast({
      title: "Payment Complete",
      description: "Your payment was processed successfully!",
    });
  };

  const handleCancel = () => {
    setClientSecret("");
    setPaymentIntentId(null);
  };

  const goBack = () => {
    setLocation('/home');
  };

  // Show payment form if client secret is available
  if (clientSecret && stripePromise) {
    return (
      <div className="min-h-screen bg-black text-white p-4">
        <div className="max-w-md mx-auto pt-8">
          <Card className="bg-white text-black">
            <CardHeader>
              <CardTitle className="text-center flex items-center justify-center gap-2">
                <CreditCard className="h-5 w-5" />
                Complete Your Purchase
              </CardTitle>
              <CardDescription className="text-center">
                Enter your payment information to complete the transaction
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Elements 
                stripe={stripePromise} 
                options={{ 
                  clientSecret,
                  appearance: {
                    theme: 'stripe',
                  }
                }}
              >
                <PurchaseForm
                  amount={amount}
                  description={description}
                  onSuccess={handleSuccess}
                  onCancel={handleCancel}
                />
              </Elements>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show purchase setup form
  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="max-w-md mx-auto pt-8">
        <Card className="bg-white text-black">
          <CardHeader>
            <CardTitle className="text-center">Make a Purchase</CardTitle>
            <CardDescription className="text-center">
              Support "Man Up God's Way" ministry
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount ($)</Label>
              <Input
                id="amount"
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                placeholder="Enter amount"
                data-testid="input-amount"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this for?"
                data-testid="input-description"
              />
            </div>

            {!stripePromise && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <p className="text-sm text-yellow-800">
                  Payment system is not configured yet. Please contact the administrator.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={goBack}
                className="flex-1"
                data-testid="button-back"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={createPaymentIntent}
                disabled={isCreatingIntent || !amount || !stripePromise}
                className="flex-1 bg-ministry-gold text-black hover:bg-ministry-gold-exact/90"
                data-testid="button-continue-purchase"
              >
                {isCreatingIntent ? 'Setting up...' : 'Continue to Payment'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}