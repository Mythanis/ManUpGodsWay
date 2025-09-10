import { useState, useEffect } from 'react';
import { useStripe, Elements, PaymentElement, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, CreditCard, Shield, BookOpen } from 'lucide-react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';

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
  studyId?: string;
  studyTitle?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const PurchaseForm = ({ amount, description, studyId, studyTitle, onSuccess, onCancel }: PurchaseFormProps) => {
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
          return_url: studyId 
            ? `${window.location.origin}/studies/${studyId}?purchased=true`
            : `${window.location.origin}/purchase?success=true`,
        },
      });

      if (error) {
        toast({
          title: "Payment Failed",
          description: error.message || "An unknown error occurred",
          variant: "destructive",
        });
      } else {
        // Payment succeeded, now complete the purchase on the backend
        try {
          const urlParams = new URLSearchParams(window.location.search);
          const paymentIntentId = urlParams.get('payment_intent');
          
          if (paymentIntentId && studyId) {
            // Complete the study purchase
            const response = await apiRequest("POST", "/api/purchases/complete", {
              paymentIntentId
            });
            
            if (response.ok) {
              toast({
                title: "Purchase Complete",
                description: "Study purchased successfully! You now have access.",
              });
            } else {
              const data = await response.json();
              console.warn("Purchase completion warning:", data.message);
              toast({
                title: "Payment Successful",
                description: "Your payment was processed. If you don't see access, please contact support.",
              });
            }
          } else {
            toast({
              title: "Payment Successful",
              description: "Thank you for your purchase!",
            });
          }
        } catch (error) {
          console.error("Error completing purchase:", error);
          toast({
            title: "Payment Successful",
            description: "Your payment was processed. If you don't see access, please contact support.",
          });
        }
        
        onSuccess();
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      
      // Extract better error message if available
      let errorMessage = "An unexpected error occurred. Please try again.";
      
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Payment Error",
        description: errorMessage,
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

      <div className="flex gap-3 pb-24">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isProcessing}
          className="flex-1 text-white border-white hover:bg-white hover:text-black"
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
  
  // Extract study ID from URL path
  const currentPath = window.location.pathname;
  const studyId = currentPath.includes('/purchase/') ? currentPath.split('/purchase/')[1] : null;
  
  // Fetch study details if study ID is provided
  const { data: study, isLoading: studyLoading } = useQuery<any>({
    queryKey: studyId ? ["/api/studies", studyId] : ["/api/studies"],
    queryFn: studyId 
      ? () => fetch(`/api/studies/${studyId}`).then(res => res.json())
      : undefined,
    enabled: !!studyId,
    retry: false,
  });

  // Initialize form with study data when study is loaded
  useEffect(() => {
    if (study && studyId) {
      const studyPrice = study.price ? parseFloat(study.price) : 0;
      if (studyPrice > 0) {
        setAmount(studyPrice);
        setDescription(`Study: ${study.title}`);
      }
    }
  }, [study, studyId]);
  
  // Check for success parameter in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      toast({
        title: "Payment Successful!",
        description: "Thank you for your purchase. Your payment has been processed successfully.",
      });
      // Clear the success parameter
      window.history.replaceState({}, '', studyId ? `/purchase/${studyId}` : '/purchase');
    }
  }, [toast, studyId]);

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
      // Use study purchase endpoint if this is a study purchase
      const endpoint = studyId 
        ? "/api/purchases/create-payment-intent"
        : "/api/payments/create-payment-intent";
        
      const payload = studyId 
        ? { studyId, amount }
        : { 
            amount,
            metadata: { 
              description,
              timestamp: new Date().toISOString()
            }
          };
      
      const data = await apiRequest("POST", endpoint, payload);
      
      setClientSecret(data.clientSecret);
      setPaymentIntentId(data.paymentIntentId);
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
      description: studyId ? "Study purchased successfully! You now have access." : "Your payment was processed successfully!",
    });
    
    // Redirect to study if this was a study purchase
    if (studyId) {
      setTimeout(() => {
        setLocation(`/studies/${studyId}`);
      }, 2000);
    }
  };

  const handleCancel = () => {
    setClientSecret("");
    setPaymentIntentId(null);
  };

  const goBack = () => {
    if (studyId) {
      setLocation('/library');
    } else {
      setLocation('/home');
    }
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
                  studyId={studyId || undefined}
                  studyTitle={study?.title}
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
            <CardTitle className="text-center flex items-center justify-center gap-2">
              {studyId ? <BookOpen className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
              {studyId ? 'Purchase Study' : 'Make a Purchase'}
            </CardTitle>
            <CardDescription className="text-center">
              {studyId ? `Complete your purchase to access "${study?.title}"` : 'Support "Man Up God\'s Way" ministry'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {studyId && study ? (
              <div className="bg-ministry-charcoal/5 p-4 rounded-lg border">
                <h3 className="font-semibold text-ministry-charcoal mb-2">Study Details</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-ministry-slate">Title:</span>
                    <span className="font-medium">{study.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ministry-slate">Category:</span>
                    <span>{study.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ministry-slate">Lessons:</span>
                    <span>{study.lessonCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-ministry-slate">Price:</span>
                    <span className="font-bold text-xl text-ministry-charcoal">${amount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <>
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
              </>
            )}

            {!stripePromise && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <p className="text-sm text-yellow-800">
                  Payment system is not configured yet. Please contact the administrator.
                </p>
              </div>
            )}

            <div className="flex gap-3 pb-24">
              <Button
                variant="outline"
                onClick={goBack}
                className="flex-1 text-white border-white hover:bg-white hover:text-black"
                data-testid="button-back"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={createPaymentIntent}
                disabled={isCreatingIntent || !amount || !stripePromise || (!!studyId && studyLoading)}
                className="flex-1 bg-ministry-gold text-black hover:bg-ministry-gold-exact/90"
                data-testid="button-continue-purchase"
              >
                {isCreatingIntent ? 'Setting up...' : (studyId ? `Purchase for $${amount.toFixed(2)}` : 'Continue to Payment')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}