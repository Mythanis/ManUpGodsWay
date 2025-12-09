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
      <div className="min-h-screen bg-background text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Please sign in to view events</h1>
          <p className="text-gray-400">You need to be logged in to access the events page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header - matching War Room style */}
      <div className="bg-gradient-to-r from-ministry-navy to-ministry-charcoal dark:from-header-dark dark:to-ministry-navy text-white px-6 pt-12 pb-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-black mb-2 tracking-tight">Ministry Events</h1>
          <p className="text-ministry-gold-exact text-sm font-semibold">Join Us For Special Events And Gatherings</p>
        </div>
      </div>

      <div className="px-6 py-6 max-w-2xl mx-auto">
        {eventsLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="bg-black border-2 border-black">
                <CardHeader>
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="animate-pulse space-y-2">
                    <div className="h-3 bg-gray-700 rounded w-full"></div>
                    <div className="h-3 bg-gray-700 rounded w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : events.length === 0 ? (
          <Card className="bg-black border-2 border-black text-center py-12">
            <CardContent>
              <Calendar className="mx-auto mb-4 h-16 w-16 text-ministry-gold" />
              <h3 className="text-xl font-semibold mb-2 text-white">No Events Scheduled</h3>
              <p className="text-gray-400">
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
                <Card key={event.id} className="bg-black border-2 border-black">
                  <CardHeader>
                    <div className="flex items-start justify-between flex-wrap gap-2">
                      <div className="flex-1">
                        <CardTitle className="text-xl mb-2 text-white">
                          {event.title}
                        </CardTitle>
                        <div className="flex flex-wrap gap-3 text-sm text-gray-400">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4 text-ministry-gold" />
                            <span>{formatDate(event.eventDate)}</span>
                          </div>
                          {event.eventTime && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4 text-ministry-gold" />
                              <span>{formatTime(event.eventTime)}</span>
                            </div>
                          )}
                          {event.location && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-4 w-4 text-ministry-gold" />
                              <span className="truncate max-w-48">{event.location}</span>
                            </div>
                          )}
                          {event.requiresPurchase && event.price && (
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-4 w-4 text-ministry-gold" />
                              <span>${event.price}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {isPastEvent && (
                          <Badge className="bg-gray-700 text-gray-300">
                            Past Event
                          </Badge>
                        )}
                        {isRegistered && (
                          <Badge className="bg-ministry-gold-exact text-black font-semibold">
                            <Users className="h-3 w-3 mr-1" />
                            Registered
                          </Badge>
                        )}
                        {event.requiresPurchase && !isPastEvent && (
                          <Badge className="bg-ministry-gold-exact text-black font-semibold">
                            Paid Event
                          </Badge>
                        )}
                        {!event.requiresPurchase && !isPastEvent && (
                          <Badge className="bg-ministry-gold-exact text-black font-semibold">
                            Free Event
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  
                  {event.description && (
                    <CardContent className="pt-0">
                      <CardDescription className="text-gray-300 leading-relaxed">
                        {event.description}
                      </CardDescription>
                    </CardContent>
                  )}
                  
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-3">
                      {event.eventUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="border-gray-600 text-gray-300 hover:bg-gray-800"
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
                          className="bg-ministry-gold-exact text-black hover:bg-ministry-gold-exact/90 font-bold"
                          size="sm"
                          data-testid={`button-register-${event.id}`}
                        >
                          {registerMutation.isPending ? 'Registering...' : 'Register for Free'}
                        </Button>
                      )}
                      
                      {!isPastEvent && !isRegistered && event.requiresPurchase && (
                        <Button
                          className="bg-ministry-gold-exact text-black hover:bg-ministry-gold-exact/90 font-bold"
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
