import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, MapPin, ExternalLink, DollarSign, Users, Navigation, CalendarRange, Ticket, Layers } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { BackButton } from "@/components/BackButton";

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


function TierSelectionModal({
  event,
  onSelectTier,
  onClose,
}: {
  event: Event;
  onSelectTier: (tier: EventTier) => void;
  onClose: () => void;
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
                className="bg-[#FCD000] text-black hover:bg-[#FCD000]/90 font-black uppercase tracking-wide rounded-sm border-2 border-[#FCD000] shadow-[2px_2px_0px_0px_rgba(252,208,0,0.3)] hover:shadow-[3px_3px_0px_0px_rgba(252,208,0,0.3)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all text-xs"
              >
                <Ticket className="h-3 w-3 mr-1.5" />
                Purchase
              </Button>
            </div>
          ))}
        </div>
        <div className="px-6 pb-5">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full border-2 border-white/20 text-white/60 hover:text-white hover:border-white/40 rounded-sm font-bold uppercase tracking-wide text-xs"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Events() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [tierModalEvent, setTierModalEvent] = useState<Event | null>(null);

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
      toast({ title: "Registration Successful", description: "You have been registered for this event!" });
      queryClient.invalidateQueries({ queryKey: ['/api/events/registrations/my'] });
    },
    onError: (error: any) => {
      toast({ title: "Registration Failed", description: error.message || "An error occurred while registering for the event.", variant: "destructive" });
    },
  });

  const isRegisteredForEvent = (eventId: string) =>
    userRegistrations.some(reg => reg.eventId === eventId && reg.paymentStatus === 'completed');

  const formatDate = (dateString: string) => format(new Date(dateString), 'EEEE, MMMM d, yyyy');
  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return format(date, 'h:mm a');
  };

  const handlePurchaseClick = (event: Event) => {
    if (event.multiTier && event.tiers && event.tiers.length > 0) {
      setTierModalEvent(event);
    } else if (event.purchaseUrl) {
      window.open(event.purchaseUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleTierSelect = (tier: EventTier) => {
    setTierModalEvent(null);
    window.open(tier.url, '_blank', 'noopener,noreferrer');
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
      {tierModalEvent && (
        <TierSelectionModal
          event={tierModalEvent}
          onSelectTier={handleTierSelect}
          onClose={() => setTierModalEvent(null)}
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
                (event.multiTier ? (event.tiers && event.tiers.length > 0) : !!event.purchaseUrl);

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
                          className="bg-[#FCD000] text-black hover:bg-[#FCD000]/90 font-black uppercase tracking-wide rounded-sm border-2 border-[#FCD000] shadow-[3px_3px_0px_0px_rgba(252,208,0,0.3)] hover:shadow-[4px_4px_0px_0px_rgba(252,208,0,0.3)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all"
                          size="sm"
                          data-testid={`button-purchase-${event.id}`}
                        >
                          <Ticket className="h-4 w-4 mr-2" />
                          {event.multiTier
                            ? 'Purchase Ticket'
                            : `Purchase Ticket${event.price ? ` - $${event.price}` : ''}`}
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
