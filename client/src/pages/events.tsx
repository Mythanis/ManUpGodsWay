import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, ExternalLink, DollarSign, Users } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface Event {
  id: string;
  title: string;
  description: string | null;
  eventDate: string;
  eventTime: string | null;
  location: string | null;
  eventUrl: string | null;
  requiresPurchase: boolean;
  price: string | null;
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

export default function Events() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch events
  const { data: events = [], isLoading: eventsLoading } = useQuery<Event[]>({
    queryKey: ['/api/events'],
    enabled: !!user,
  });

  // Fetch user's registrations
  const { data: userRegistrations = [] } = useQuery<EventRegistration[]>({
    queryKey: ['/api/events/registrations/my'],
    enabled: !!user,
  });

  // Register for free event mutation
  const registerMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const response = await apiRequest('POST', `/api/events/${eventId}/register`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Registration Successful",
        description: "You have been registered for this event!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/events/registrations/my'] });
    },
    onError: (error: any) => {
      toast({
        title: "Registration Failed",
        description: error.message || "An error occurred while registering for the event.",
        variant: "destructive",
      });
    },
  });

  const isRegisteredForEvent = (eventId: string) => {
    return userRegistrations.some(
      reg => reg.eventId === eventId && reg.paymentStatus === 'completed'
    );
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'EEEE, MMMM d, yyyy');
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
        <div className="text-center bg-white border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-8">
          <h1 className="text-2xl font-black uppercase tracking-tighter mb-4 text-black">Please Sign In</h1>
          <p className="text-black/70 font-medium">You need to be logged in to access the events page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ministry-light-gray pb-20">
      {/* Header - neo-brutalist style */}
      <div className="liquid-header text-white px-6 pt-12 pb-6 border-b-4 border-ministry-gold-exact">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-black mb-2 tracking-tighter uppercase"><span className="text-white">Ministry</span> <span className="text-ministry-gold-exact">Events</span></h1>
          <p className="text-ministry-gold-exact text-sm font-bold uppercase tracking-wide">Join Us For Special Events And Gatherings</p>
        </div>
      </div>

      <div className="px-6 py-6 max-w-2xl mx-auto">
        {eventsLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="liquid-gold-card border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <CardHeader className="relative">
                  <div className="flex items-start gap-4 relative z-10">
                    <div className="w-16 h-16 liquid-black flex-shrink-0 border-2 border-black animate-pulse"></div>
                    <div className="flex-1 animate-pulse">
                      <div className="h-5 bg-black/20 rounded-none w-3/4 mb-3"></div>
                      <div className="h-3 bg-black/20 rounded-none w-1/2"></div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="relative">
                  <div className="animate-pulse space-y-2 relative z-10">
                    <div className="h-3 bg-black/20 rounded-none w-full"></div>
                    <div className="h-3 bg-black/20 rounded-none w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : events.length === 0 ? (
          <Card className="liquid-gold-card border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-center py-12 overflow-hidden">
            <CardContent className="relative">
              <Calendar className="mx-auto mb-4 h-16 w-16 text-black relative z-10" />
              <h3 className="text-xl font-black uppercase tracking-tighter mb-2 text-black relative z-10">No Events Scheduled</h3>
              <p className="text-black/80 font-medium relative z-10">
                There are no upcoming events at this time. Check back soon for new announcements!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {events.map((event) => {
              const isRegistered = isRegisteredForEvent(event.id);
              const eventDate = new Date(event.eventDate);
              const isPastEvent = eventDate < new Date();
              
              return (
                <Card key={event.id} className={`${isPastEvent ? 'liquid-black' : 'liquid-gold-card'} border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all duration-200 overflow-hidden`}>
                  <CardHeader className="relative">
                    <div className="flex items-start gap-4 relative z-10">
                      {/* Icon Box - like Popular section */}
                      <div className={`w-16 h-16 ${isPastEvent ? 'liquid-gold-card' : 'liquid-black'} flex-shrink-0 flex items-center justify-center border-2 border-black`}>
                        <Calendar className={`h-7 w-7 ${isPastEvent ? 'text-black' : 'text-white'} relative z-10`} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between flex-wrap gap-2">
                          <CardTitle className={`text-xl mb-2 font-black uppercase tracking-tighter ${isPastEvent ? 'text-white' : 'text-black'}`}>
                            {event.title}
                          </CardTitle>
                          <div className="flex items-center gap-2 flex-wrap">
                            {isPastEvent && (
                              <Badge className="bg-ministry-gold-exact text-black font-bold uppercase tracking-wide text-xs rounded-none border-2 border-black">
                                Past Event
                              </Badge>
                            )}
                            {isRegistered && (
                              <Badge className={`font-bold uppercase tracking-wide text-xs rounded-none border-2 border-black ${isPastEvent ? 'bg-ministry-gold-exact text-black' : 'bg-black text-white'}`}>
                                <Users className="h-3 w-3 mr-1" />
                                Registered
                              </Badge>
                            )}
                            {event.requiresPurchase && !isPastEvent && (
                              <Badge className="bg-black text-ministry-gold-exact font-bold uppercase tracking-wide text-xs rounded-none border-2 border-black">
                                Paid Event
                              </Badge>
                            )}
                            {!event.requiresPurchase && !isPastEvent && (
                              <Badge className="bg-black text-ministry-gold-exact font-bold uppercase tracking-wide text-xs rounded-none border-2 border-black">
                                Free Event
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className={`flex flex-wrap gap-3 text-sm font-medium ${isPastEvent ? 'text-gray-300' : 'text-black/70'}`}>
                          <div className="flex items-center gap-1">
                            <Calendar className={`h-4 w-4 ${isPastEvent ? 'text-ministry-gold-exact' : 'text-black'}`} />
                            <span>{formatDate(event.eventDate)}</span>
                          </div>
                          {event.eventTime && (
                            <div className="flex items-center gap-1">
                              <Clock className={`h-4 w-4 ${isPastEvent ? 'text-ministry-gold-exact' : 'text-black'}`} />
                              <span>{formatTime(event.eventTime)}</span>
                            </div>
                          )}
                          {event.location && (
                            <div className="flex items-center gap-1">
                              <MapPin className={`h-4 w-4 ${isPastEvent ? 'text-ministry-gold-exact' : 'text-black'}`} />
                              <span className="truncate max-w-48">{event.location}</span>
                            </div>
                          )}
                          {event.requiresPurchase && event.price && (
                            <div className="flex items-center gap-1">
                              <DollarSign className={`h-4 w-4 ${isPastEvent ? 'text-ministry-gold-exact' : 'text-black'}`} />
                              <span>${event.price}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  
                  {event.description && (
                    <CardContent className="pt-0 relative">
                      <CardDescription className={`leading-relaxed font-medium relative z-10 ${isPastEvent ? 'text-gray-300' : 'text-black/70'}`}>
                        {event.description}
                      </CardDescription>
                    </CardContent>
                  )}
                  
                  <CardContent className="pt-0 relative">
                    <div className="flex flex-wrap gap-3 relative z-10">
                      {event.eventUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className={`border-2 border-black rounded-none font-bold uppercase tracking-wide shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${isPastEvent ? 'bg-ministry-gold-exact text-black hover:bg-yellow-400' : 'bg-white text-black hover:bg-gray-100'}`}
                        >
                          <a href={event.eventUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Event Link
                          </a>
                        </Button>
                      )}
                      
                      {!isPastEvent && !isRegistered && !event.requiresPurchase && (
                        <Button
                          onClick={() => registerMutation.mutate(event.id)}
                          disabled={registerMutation.isPending}
                          className="bg-black text-ministry-gold-exact hover:bg-gray-900 font-black uppercase tracking-wide rounded-none border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all"
                          size="sm"
                          data-testid={`button-register-${event.id}`}
                        >
                          {registerMutation.isPending ? 'Registering...' : 'Register for Free'}
                        </Button>
                      )}
                      
                      {!isPastEvent && !isRegistered && event.requiresPurchase && (
                        <Button
                          className="bg-black text-ministry-gold-exact hover:bg-gray-900 font-black uppercase tracking-wide rounded-none border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all"
                          size="sm"
                          data-testid={`button-purchase-${event.id}`}
                        >
                          Purchase Ticket - ${event.price}
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
