import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, MapPin, ExternalLink, DollarSign, Users, Navigation, CalendarRange, Ticket, Layers, ArrowLeft, CreditCard, CheckCircle, Loader2, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { BackButton } from "@/components/BackButton";
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = (() => {
  const key = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
  if (!key) return null;
  return loadStripe(key);
})();

interface EventTier {
  id: string;
  eventId: string;
  name: string;
  price: string;
  url: string;
  sortOrder: number;
}

interface Event {
  id: string;
  title: string;
  description: string | null;
  eventDate: string;
  eventTime: string | null;
  endDate: string | null;
  endTime: string | null;
  location: string | null;
  address: string | null;
  url: string | null;
  requiresPurchase: boolean;
  purchaseUrl: string | null;
  multiTier: boolean;
  price: string | null;
  tiers: EventTier[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface EventRegistration {
  id: string;
  eventId: string;
  userId: string;
  registrationType: 'free' | 'paid';
  paymentStatus: 'pending' | 'completed' | 'failed';
  stripePaymentIntentId: string | null;
  registeredAt: string;
  event: Event;
}

interface PurchaseModalState {
  eventId: string;
  eventTitle: string;
  tierName?: string;
  amount: number;
  clientSecret: string;
}

function parsePriceAmount(priceStr: string): number {
  return parseFloat(priceStr.replace(/[^0-9.]/g, '')) || 0;
}

function EventPaymentForm({
  eventId,
  amount,
  eventTitle,
  tierName,
  purchaserName,
  onSuccess,
  onCancel,
}: {
  eventId: string;
  amount: number;
  eventTitle: string;
  tierName?: string;
  purchaserName: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [processing, setProcessing] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {},
        redirect: 'if_required',
      });
      if (error) {
        toast({ title: 'Payment Failed', description: error.message, variant: 'destructive' });
      } else if (paymentIntent?.status === 'succeeded') {
        try {
          await apiRequest('POST', `/api/events/${eventId}/confirm-purchase`, {
            paymentIntentId: paymentIntent.id,
            amountPaid: amount,
            tierName,
          });
          queryClient.invalidateQueries({ queryKey: ['/api/events/registrations/my'] });
        } catch {
        }
        setSucceeded(true);
      } else {
        try {
          await apiRequest('POST', `/api/events/${eventId}/confirm-purchase`, {
            paymentIntentId: paymentIntent?.id,
            amountPaid: amount,
            tierName,
          });
          queryClient.invalidateQueries({ queryKey: ['/api/events/registrations/my'] });
        } catch {
        }
        setSucceeded(true);
      }
    } catch (err: any) {
      toast({ title: 'Payment Error', description: err.message || 'An unexpected error occurred.', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  if (succeeded) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <div className="w-20 h-20 rounded-full bg-[#FCD000]/20 border-2 border-[#FCD000] flex items-center justify-center mb-6">
          <CheckCircle className="h-10 w-10 text-[#FCD000]" />
        </div>
        <h2 className="text-3xl font-black text-[#FCD000] uppercase tracking-wider mb-2" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
          You're In!
        </h2>
        <p className="text-white/70 text-sm mb-2">{eventTitle}</p>
        {tierName && <p className="text-[#FCD000] font-bold text-sm mb-6">{tierName}</p>}
        <p className="text-white/50 text-xs mb-8">Your ticket purchase was successful. Check your email for confirmation.</p>
        <Button
          onClick={onSuccess}
          className="bg-[#FCD000] text-black hover:bg-[#FCD000]/90 font-black uppercase tracking-wide"
        >
          Back to Events
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 px-6 pb-8">
      <div className="bg-white/5 border border-[#FCD000]/30 rounded-sm p-4 space-y-3">
        <p className="text-white/50 text-xs uppercase tracking-wide font-bold">Order Summary</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-bold text-sm">{eventTitle}</p>
            {tierName && <p className="text-[#FCD000] text-xs font-semibold">{tierName}</p>}
          </div>
          <p className="text-[#FCD000] font-black text-2xl" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            ${amount.toFixed(2)}
          </p>
        </div>
        <div className="border-t border-[#FCD000]/20 pt-2">
          <p className="text-white/40 text-xs">
            Purchasing as: <span className="text-white/70 font-semibold">{purchaserName}</span>
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 text-white/40">
          <Shield className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="text-xs">Secured with 256-bit SSL encryption</span>
        </div>
        <PaymentElement
          options={{
            layout: 'tabs',
          }}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={processing}
          className="flex-1 border-white/20 text-white/60 hover:text-white hover:border-white/40 rounded-sm font-bold uppercase tracking-wide text-sm"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!stripe || processing}
          className="flex-1 bg-[#FCD000] text-black hover:bg-[#FCD000]/90 font-black uppercase tracking-wide rounded-sm"
        >
          {processing ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</>
          ) : (
            <><CreditCard className="h-4 w-4 mr-2" />Pay ${amount.toFixed(2)}</>
          )}
        </Button>
      </div>
    </form>
  );
}

function EventPurchaseModal({
  modal,
  purchaserName,
  onClose,
}: {
  modal: PurchaseModalState;
  purchaserName: string;
  onClose: () => void;
}) {
  return createPortal(
    <div className="fixed inset-0 bg-black overflow-y-auto" style={{ zIndex: 9999 }}>
      <div className="min-h-full flex flex-col">
        <div className="flex items-center gap-3 px-4 py-4 border-b border-[#FCD000]/30">
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors p-1"
            aria-label="Close"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="w-8 h-8 bg-[#FCD000] rounded-sm flex items-center justify-center flex-shrink-0">
            <Ticket className="h-4 w-4 text-black" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[#FCD000] font-black uppercase tracking-tight text-sm leading-tight truncate">
              {modal.eventTitle}
            </p>
            {modal.tierName && (
              <p className="text-white/50 text-xs font-semibold truncate">{modal.tierName}</p>
            )}
          </div>
          <p className="text-[#FCD000] font-black text-xl flex-shrink-0" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            ${modal.amount.toFixed(2)}
          </p>
        </div>

        <div className="flex-1 max-w-lg mx-auto w-full pt-6">
          {stripePromise ? (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret: modal.clientSecret,
                appearance: {
                  theme: 'night',
                  variables: {
                    colorPrimary: '#FCD000',
                    colorBackground: '#1a1a1a',
                    colorText: '#ffffff',
                    colorDanger: '#ef4444',
                    borderRadius: '2px',
                  },
                },
              }}
            >
              <EventPaymentForm
                eventId={modal.eventId}
                amount={modal.amount}
                eventTitle={modal.eventTitle}
                tierName={modal.tierName}
                purchaserName={purchaserName}
                onSuccess={onClose}
                onCancel={onClose}
              />
            </Elements>
          ) : (
            <div className="px-6 py-12 text-center">
              <p className="text-white/50 text-sm">Payment system not configured.</p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function TierSelectionModal({
  event,
  onSelectTier,
  onClose,
  loading,
}: {
  event: Event;
  onSelectTier: (tier: EventTier) => void;
  onClose: () => void;
  loading?: boolean;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-black border-2 border-[#FCD000] rounded-sm max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#FCD000]/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FCD000] rounded-sm flex items-center justify-center flex-shrink-0">
              <Layers className="h-5 w-5 text-black" />
            </div>
            <div>
              <DialogTitle className="text-[#FCD000] font-black uppercase tracking-tight text-lg leading-tight">
                Select Your Ticket
              </DialogTitle>
              <p className="text-white/60 text-xs font-semibold mt-0.5">{event.title}</p>
            </div>
          </div>
        </DialogHeader>
        <div className="px-6 py-4 space-y-3">
          {event.tiers.map((tier) => (
            <div
              key={tier.id}
              className="flex items-center justify-between p-4 border-2 border-[#FCD000]/30 rounded-sm bg-[#FCD000]/5 hover:bg-[#FCD000]/10 transition-colors"
            >
              <div>
                <p className="text-white font-black uppercase tracking-wide text-sm">{tier.name}</p>
                <p className="text-[#FCD000] font-bold text-lg">{tier.price.startsWith('$') ? tier.price : `$${tier.price}`}</p>
              </div>
              <Button
                onClick={() => onSelectTier(tier)}
                disabled={loading}
                className="bg-[#FCD000] text-black hover:bg-[#FCD000]/90 font-black uppercase tracking-wide rounded-sm border-2 border-[#FCD000] text-xs"
              >
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Ticket className="h-3 w-3 mr-1.5" />Purchase</>}
              </Button>
            </div>
          ))}
        </div>
        <div className="px-6 pb-5">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="w-full border-2 border-white/20 text-white/60 hover:text-white hover:border-white/40 rounded-sm font-bold uppercase tracking-wide text-xs"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ExternalTierModalState {
  eventId: string;
  eventTitle: string;
  tier: EventTier;
}

function ExternalTierPurchaseModal({
  modal,
  onClose,
  onConfirm,
  confirming,
}: {
  modal: ExternalTierModalState;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  confirming: boolean;
}) {
  const price = modal.tier.price.startsWith('$') ? modal.tier.price : `$${modal.tier.price}`;

  const openPaymentLink = () => {
    window.open(modal.tier.url, '_blank', 'noopener,noreferrer');
  };

  return createPortal(
    <div className="fixed inset-0 bg-black flex flex-col" style={{ zIndex: 9999 }}>
      <div className="flex items-center gap-3 px-4 py-4 border-b border-[#FCD000]/30 flex-shrink-0">
        <button
          onClick={onClose}
          className="text-white/60 hover:text-white transition-colors p-1"
          aria-label="Close"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="w-8 h-8 bg-[#FCD000] rounded-sm flex items-center justify-center flex-shrink-0">
          <Ticket className="h-4 w-4 text-black" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[#FCD000] font-black uppercase tracking-tight text-sm leading-tight truncate">
            {modal.eventTitle}
          </p>
          <p className="text-white/50 text-xs font-semibold truncate">{modal.tier.name}</p>
        </div>
        <p className="text-[#FCD000] font-black text-xl flex-shrink-0" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
          {price}
        </p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-6">
        <div className="w-20 h-20 bg-[#FCD000]/10 border-2 border-[#FCD000]/30 rounded-full flex items-center justify-center">
          <Shield className="h-10 w-10 text-[#FCD000]" />
        </div>
        <div>
          <p className="text-white font-black uppercase tracking-tight text-xl mb-2">Secure Checkout</p>
          <p className="text-white/60 text-sm font-medium leading-relaxed">
            Your payment is processed securely by Stripe. Tap the button below to open the checkout page, then return here once your purchase is complete.
          </p>
        </div>
        <div className="w-full max-w-sm bg-[#FCD000]/5 border border-[#FCD000]/20 rounded-sm px-4 py-3">
          <p className="text-[#FCD000] font-bold text-sm uppercase tracking-wide">{modal.tier.name}</p>
          <p className="text-white font-black text-2xl" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{price}</p>
        </div>
        <button
          onClick={openPaymentLink}
          className="w-full max-w-sm py-3 bg-[#FCD000] text-black font-black uppercase tracking-wide rounded-sm border-2 border-[#FCD000] text-sm flex items-center justify-center gap-2"
        >
          <ExternalLink className="h-4 w-4" />
          Open Secure Checkout
        </button>
      </div>

      <div className="flex-shrink-0 px-4 py-4 border-t border-[#FCD000]/30 bg-black space-y-2">
        <button
          onClick={onConfirm}
          disabled={confirming}
          className="w-full py-3 bg-[#FCD000]/10 text-[#FCD000] font-black uppercase tracking-wide rounded-sm border-2 border-[#FCD000]/50 text-sm disabled:opacity-60 flex items-center justify-center gap-2 hover:bg-[#FCD000]/20 transition-colors"
        >
          {confirming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <><CheckCircle className="h-4 w-4" />I've Completed My Purchase</>
          )}
        </button>
        <button
          onClick={onClose}
          disabled={confirming}
          className="w-full py-2.5 bg-transparent text-white/50 font-bold uppercase tracking-wide text-xs border border-white/20 rounded-sm hover:border-white/40 hover:text-white/70 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>,
    document.body
  );
}

export default function Events() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [tierModalEvent, setTierModalEvent] = useState<Event | null>(null);
  const [purchaseModal, setPurchaseModal] = useState<PurchaseModalState | null>(null);
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [externalTierModal, setExternalTierModal] = useState<ExternalTierModalState | null>(null);
  const [confirmingExternalPurchase, setConfirmingExternalPurchase] = useState(false);

  const { data: events = [], isLoading: eventsLoading } = useQuery<Event[]>({
    queryKey: ['/api/events'],
    enabled: !!user,
  });

  const { data: userRegistrations = [] } = useQuery<EventRegistration[]>({
    queryKey: ['/api/events/registrations/my'],
    enabled: !!user,
  });

  const registerMutation = useMutation({
    mutationFn: async (eventId: string) => {
      return await apiRequest('POST', `/api/events/${eventId}/register`);
    },
    onSuccess: () => {
      toast({ title: 'Registration Successful', description: 'You have been registered for this event!' });
      queryClient.invalidateQueries({ queryKey: ['/api/events/registrations/my'] });
    },
    onError: (error: any) => {
      toast({ title: 'Registration Failed', description: error.message || 'An error occurred.', variant: 'destructive' });
    },
  });

  const openPaymentModal = async (eventId: string, eventTitle: string, amount: number, tierName?: string) => {
    if (!amount || amount <= 0) {
      toast({ title: 'Invalid Price', description: 'This event does not have a valid price configured.', variant: 'destructive' });
      return;
    }
    setLoadingPayment(true);
    try {
      const data = await apiRequest('POST', `/api/events/${eventId}/payment-intent`, { amount, tierName });
      setPurchaseModal({ eventId, eventTitle, tierName, amount, clientSecret: data.clientSecret });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Could not set up payment. Please try again.', variant: 'destructive' });
    } finally {
      setLoadingPayment(false);
    }
  };

  const handlePurchaseClick = async (event: Event) => {
    if (event.multiTier && event.tiers && event.tiers.length > 0) {
      setTierModalEvent(event);
    } else if (event.price) {
      const amount = parsePriceAmount(event.price);
      await openPaymentModal(event.id, event.title, amount);
    }
  };

  const handleTierSelect = async (tier: EventTier) => {
    if (!tierModalEvent) return;
    setTierModalEvent(null);
    if (tier.url) {
      setExternalTierModal({ eventId: tierModalEvent.id, eventTitle: tierModalEvent.title, tier });
    } else {
      const amount = parsePriceAmount(tier.price);
      await openPaymentModal(tierModalEvent.id, tierModalEvent.title, amount, tier.name);
    }
  };

  const handleConfirmExternalPurchase = async () => {
    if (!externalTierModal) return;
    setConfirmingExternalPurchase(true);
    try {
      await apiRequest('POST', `/api/events/${externalTierModal.eventId}/register-external-purchase`, {
        tierName: externalTierModal.tier.name,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/events/registrations/my'] });
      setExternalTierModal(null);
      toast({ title: "You're Registered!", description: `Your ${externalTierModal.tier.name} ticket has been confirmed.` });
    } catch (err: any) {
      if (err.message?.includes('409') || err.message?.includes('Already registered')) {
        setExternalTierModal(null);
        toast({ title: 'Already Registered', description: 'You are already registered for this event.' });
      } else {
        toast({ title: 'Error', description: err.message || 'Could not confirm registration. Please contact support.', variant: 'destructive' });
      }
    } finally {
      setConfirmingExternalPurchase(false);
    }
  };

  const isRegisteredForEvent = (eventId: string) =>
    userRegistrations.some(reg => reg.eventId === eventId && reg.paymentStatus === 'completed');

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
    return format(new Date(year, month - 1, day), 'EEEE, MMMM d, yyyy');
  };
  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return format(date, 'h:mm a');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-ministry-light-gray flex items-center justify-center px-6">
        <div className="text-center liquid-black border-2 border-[#FCD000]/30 rounded-sm shadow-[4px_4px_0px_0px_rgba(252,208,0,0.3)] p-8">
          <h1 className="text-2xl font-black uppercase tracking-tighter mb-4 text-[#FCD000] relative z-10">Please Sign In</h1>
          <p className="text-white/70 font-medium relative z-10">You need to be logged in to access the events page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ministry-light-gray pb-20">
      {purchaseModal && (
        <EventPurchaseModal
          modal={purchaseModal}
          purchaserName={
            user?.firstName && user?.lastName
              ? `${user.firstName} ${user.lastName}`
              : user?.email || 'Your Account'
          }
          onClose={() => setPurchaseModal(null)}
        />
      )}

      {externalTierModal && (
        <ExternalTierPurchaseModal
          modal={externalTierModal}
          onClose={() => setExternalTierModal(null)}
          onConfirm={handleConfirmExternalPurchase}
          confirming={confirmingExternalPurchase}
        />
      )}

      {tierModalEvent && !purchaseModal && !externalTierModal && (
        <TierSelectionModal
          event={tierModalEvent}
          onSelectTier={handleTierSelect}
          onClose={() => setTierModalEvent(null)}
          loading={loadingPayment}
        />
      )}

      <div className="liquid-header text-white px-6 pt-12 pb-6 border-b-4 border-ministry-gold-exact">
        <div className="max-w-2xl mx-auto">
          <BackButton />
          <h1 className="text-4xl font-black mb-2 tracking-tighter uppercase">
            <span className="text-white">Ministry</span> <span className="text-ministry-gold-exact">Events</span>
          </h1>
          <p className="text-ministry-gold-exact text-sm font-bold uppercase tracking-wide">Join Us For Special Events And Gatherings</p>
        </div>
      </div>

      <div className="px-6 py-6 max-w-2xl mx-auto">
        {eventsLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="liquid-black border-2 border-[#FCD000]/30 rounded-sm shadow-[4px_4px_0px_0px_rgba(252,208,0,0.3)] overflow-hidden">
                <CardHeader className="relative">
                  <div className="flex items-start gap-4 relative z-10">
                    <div className="w-16 h-16 bg-gray-800 flex-shrink-0 border-2 border-[#FCD000]/30 animate-pulse rounded-sm"></div>
                    <div className="flex-1 animate-pulse">
                      <div className="h-5 bg-gray-700 rounded-sm w-3/4 mb-3"></div>
                      <div className="h-3 bg-gray-700 rounded-sm w-1/2"></div>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : events.length === 0 ? (
          <Card className="liquid-black border-2 border-[#FCD000]/30 rounded-sm shadow-[4px_4px_0px_0px_rgba(252,208,0,0.3)] text-center py-12 overflow-hidden">
            <CardContent className="relative">
              <Calendar className="mx-auto mb-4 h-16 w-16 text-[#FCD000] relative z-10" />
              <h3 className="text-xl font-black uppercase tracking-tighter mb-2 text-[#FCD000] relative z-10">No Events Scheduled</h3>
              <p className="text-white/70 font-medium relative z-10">
                There are no upcoming events at this time. Check back soon for new announcements!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {events.map((event) => {
              const isRegistered = isRegisteredForEvent(event.id);
              const isPastEvent = new Date(event.eventDate) < new Date();
              const hasPurchaseAction = event.requiresPurchase &&
                (event.multiTier
                  ? (event.tiers && event.tiers.length > 0)
                  : !!event.price);

              return (
                <Card key={event.id} className={`liquid-black border-2 border-[#FCD000]/30 rounded-sm shadow-[4px_4px_0px_0px_rgba(252,208,0,0.3)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(252,208,0,0.3)] transition-all duration-200 overflow-hidden ${isPastEvent ? 'opacity-70' : ''}`}>
                  <CardHeader className="relative">
                    <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-[#FCD000] flex-shrink-0 flex items-center justify-center rounded-sm">
                          <Calendar className="h-6 w-6 text-black" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg font-black uppercase tracking-tighter text-[#FCD000] leading-tight">
                            {event.title}
                          </CardTitle>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mb-3">
                        {isPastEvent && (
                          <Badge className="bg-gray-700 text-gray-300 font-bold uppercase tracking-wide text-xs rounded-sm border border-gray-600">
                            Past Event
                          </Badge>
                        )}
                        {isRegistered && (
                          <Badge className="font-bold uppercase tracking-wide text-xs rounded-sm border border-[#FCD000]/50 bg-[#FCD000]/20 text-[#FCD000]">
                            <Users className="h-3 w-3 mr-1" />
                            Registered
                          </Badge>
                        )}
                        {event.requiresPurchase && !isPastEvent && (
                          <Badge className="bg-[#FCD000]/20 text-[#FCD000] font-bold uppercase tracking-wide text-xs rounded-sm border border-[#FCD000]/50">
                            {event.multiTier ? (
                              <><Layers className="h-3 w-3 mr-1" />Multi-Tier</>
                            ) : 'Paid Event'}
                          </Badge>
                        )}
                        {!event.requiresPurchase && !isPastEvent && (
                          <Badge className="bg-[#FCD000]/20 text-[#FCD000] font-bold uppercase tracking-wide text-xs rounded-sm border border-[#FCD000]/50">
                            Free Event
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-1.5 text-sm font-bold text-white">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-[#FCD000] flex-shrink-0" />
                          <span>{formatDate(event.eventDate)}{event.eventTime ? ` at ${formatTime(event.eventTime)}` : ''}</span>
                        </div>
                        {event.endDate && (
                          <div className="flex items-center gap-2">
                            <CalendarRange className="h-4 w-4 text-[#FCD000] flex-shrink-0" />
                            <span>Ends {formatDate(event.endDate)}{event.endTime ? ` at ${formatTime(event.endTime)}` : ''}</span>
                          </div>
                        )}
                        {event.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-[#FCD000] flex-shrink-0" />
                            <span>{event.location}</span>
                          </div>
                        )}
                        {event.requiresPurchase && !event.multiTier && event.price && (
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-[#FCD000] flex-shrink-0" />
                            <span>${event.price}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  {event.description && (
                    <CardContent className="pt-0 relative">
                      <CardDescription className="leading-relaxed font-semibold relative z-10 text-white/90">
                        {event.description}
                      </CardDescription>
                    </CardContent>
                  )}

                  <CardContent className="pt-0 relative">
                    <div className="flex flex-wrap gap-3 relative z-10">
                      {event.address && (
                        <Button variant="outline" size="sm" asChild className="border-2 border-[#FCD000]/50 rounded-sm font-bold uppercase tracking-wide shadow-[2px_2px_0px_0px_rgba(252,208,0,0.2)] bg-[#FCD000] text-black hover:bg-[#FCD000]/90">
                          <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(event.address)}`} target="_blank" rel="noopener noreferrer">
                            <Navigation className="h-4 w-4 mr-2" />
                            Get Directions
                          </a>
                        </Button>
                      )}
                      {event.url && (
                        <Button variant="outline" size="sm" asChild className="border-2 border-[#FCD000]/50 rounded-sm font-bold uppercase tracking-wide shadow-[2px_2px_0px_0px_rgba(252,208,0,0.2)] bg-[#FCD000] text-black hover:bg-[#FCD000]/90">
                          <a href={event.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Event Details
                          </a>
                        </Button>
                      )}

                      {!isPastEvent && !isRegistered && !event.requiresPurchase && (
                        <Button
                          onClick={() => registerMutation.mutate(event.id)}
                          disabled={registerMutation.isPending}
                          className="bg-[#FCD000] text-black hover:bg-[#FCD000]/90 font-black uppercase tracking-wide rounded-sm border-2 border-[#FCD000] shadow-[3px_3px_0px_0px_rgba(252,208,0,0.3)] hover:shadow-[4px_4px_0px_0px_rgba(252,208,0,0.3)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all"
                          size="sm"
                          data-testid={`button-register-${event.id}`}
                        >
                          {registerMutation.isPending ? 'Registering...' : 'Register for Free'}
                        </Button>
                      )}

                      {!isPastEvent && !isRegistered && hasPurchaseAction && (
                        <Button
                          onClick={() => handlePurchaseClick(event)}
                          disabled={loadingPayment}
                          className="bg-[#FCD000] text-black hover:bg-[#FCD000]/90 font-black uppercase tracking-wide rounded-sm border-2 border-[#FCD000] shadow-[3px_3px_0px_0px_rgba(252,208,0,0.3)] hover:shadow-[4px_4px_0px_0px_rgba(252,208,0,0.3)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all"
                          size="sm"
                          data-testid={`button-purchase-${event.id}`}
                        >
                          {loadingPayment ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Ticket className="h-4 w-4 mr-2" />
                              {event.multiTier
                                ? 'Purchase Ticket'
                                : `Purchase Ticket${event.price ? ` - $${event.price}` : ''}`}
                            </>
                          )}
                        </Button>
                      )}

                      {!isPastEvent && !isRegistered && event.requiresPurchase && !hasPurchaseAction && (
                        <Button
                          disabled
                          className="bg-[#FCD000]/50 text-black font-black uppercase tracking-wide rounded-sm border-2 border-[#FCD000]/50 cursor-not-allowed"
                          size="sm"
                        >
                          <Ticket className="h-4 w-4 mr-2" />
                          Purchase Ticket{event.price ? ` - $${event.price}` : ''}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
