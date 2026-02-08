import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Clock, MapPin, DollarSign, Plus, Edit, Trash2, ExternalLink, Navigation, CalendarRange } from 'lucide-react';
import { format } from 'date-fns';

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
  eventUrl: string | null;
  requiresPurchase: boolean;
  price: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export default function EventManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    eventDate: '',
    eventTime: '',
    endDate: '',
    endTime: '',
    location: '',
    address: '',
    eventUrl: '',
    requiresPurchase: false,
    price: '',
  });

  // Fetch events
  const { data: events = [], isLoading } = useQuery<Event[]>({
    queryKey: ['/api/events'],
  });

  // Create event mutation
  const createEventMutation = useMutation({
    mutationFn: async (eventData: any) => {
      return await apiRequest('POST', '/api/events', eventData);
    },
    onSuccess: () => {
      toast({
        title: "Event Created",
        description: "The event has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      setShowCreateDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create event.",
        variant: "destructive",
      });
    },
  });

  // Update event mutation
  const updateEventMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest('PUT', `/api/events/${id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Event Updated",
        description: "The event has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      setEditingEvent(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update event.",
        variant: "destructive",
      });
    },
  });

  // Delete event mutation
  const deleteEventMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/events/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Event Deleted",
        description: "The event has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete event.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      eventDate: '',
      eventTime: '',
      endDate: '',
      endTime: '',
      location: '',
      address: '',
      eventUrl: '',
      requiresPurchase: false,
      price: '',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.eventDate) {
      toast({
        title: "Validation Error",
        description: "Title and event date are required.",
        variant: "destructive",
      });
      return;
    }

    const eventData = {
      ...formData,
      description: formData.description.trim() || null,
      eventTime: formData.eventTime || null,
      endDate: formData.endDate || null,
      endTime: formData.endTime || null,
      location: formData.location.trim() || null,
      address: formData.address.trim() || null,
      eventUrl: formData.eventUrl.trim() || null,
      price: formData.requiresPurchase ? formData.price : null,
    };

    if (editingEvent) {
      updateEventMutation.mutate({ id: editingEvent.id, data: eventData });
    } else {
      createEventMutation.mutate(eventData);
    }
  };

  const handleEdit = (event: Event) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description || '',
      eventDate: event.eventDate.split('T')[0],
      eventTime: event.eventTime || '',
      endDate: event.endDate ? event.endDate.split('T')[0] : '',
      endTime: event.endTime || '',
      location: event.location || '',
      address: event.address || '',
      eventUrl: event.eventUrl || '',
      requiresPurchase: event.requiresPurchase,
      price: event.price || '',
    });
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
      deleteEventMutation.mutate(id);
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'EEEE, MMMM d, yyyy');
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return null;
    const [hours, minutes] = timeString.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return format(date, 'h:mm a');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Event Management</h2>
          <p className="text-gray-400">Create and manage ministry events</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-[rgb(251,208,0)] text-black hover:bg-[rgb(251,208,0)]/90">
              <Plus className="w-4 h-4 mr-2" />
              Create Event
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-gray-900 border-gray-700 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-white">Create New Event</DialogTitle>
              <DialogDescription className="text-gray-400">
                Create a new ministry event. Required fields are marked with an asterisk.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="title" className="text-white">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Event title"
                    className="bg-gray-800 border-gray-600 text-white"
                    required
                    data-testid="input-event-title"
                  />
                </div>
                
                <div>
                  <Label htmlFor="eventDate" className="text-white">Start Date *</Label>
                  <Input
                    id="eventDate"
                    type="date"
                    value={formData.eventDate}
                    onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                    className="bg-gray-800 border-gray-600 text-white"
                    required
                    data-testid="input-event-date"
                  />
                </div>
                
                <div>
                  <Label htmlFor="eventTime" className="text-white">Start Time</Label>
                  <Input
                    id="eventTime"
                    type="time"
                    value={formData.eventTime}
                    onChange={(e) => setFormData({ ...formData, eventTime: e.target.value })}
                    className="bg-gray-800 border-gray-600 text-white"
                    data-testid="input-event-time"
                  />
                </div>

                <div>
                  <Label htmlFor="endDate" className="text-white">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="bg-gray-800 border-gray-600 text-white"
                    data-testid="input-event-end-date"
                  />
                </div>

                <div>
                  <Label htmlFor="endTime" className="text-white">End Time</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="bg-gray-800 border-gray-600 text-white"
                    data-testid="input-event-end-time"
                  />
                </div>
                
                <div className="col-span-2">
                  <Label htmlFor="location" className="text-white">Location Name</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g. Grace Community Church"
                    className="bg-gray-800 border-gray-600 text-white"
                    data-testid="input-event-location"
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="address" className="text-white flex items-center gap-1">
                    <Navigation className="w-3 h-3" /> Address (for map directions)
                  </Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="e.g. 123 Main St, City, State 12345"
                    className="bg-gray-800 border-gray-600 text-white"
                    data-testid="input-event-address"
                  />
                  <p className="text-xs text-gray-500 mt-1">Users will see a "Get Directions" button linking to Google Maps</p>
                </div>
                
                <div className="col-span-2">
                  <Label htmlFor="eventUrl" className="text-white">Event URL</Label>
                  <Input
                    id="eventUrl"
                    type="url"
                    value={formData.eventUrl}
                    onChange={(e) => setFormData({ ...formData, eventUrl: e.target.value })}
                    placeholder="https://example.com/event"
                    className="bg-gray-800 border-gray-600 text-white"
                    data-testid="input-event-url"
                  />
                </div>
                
                <div className="col-span-2">
                  <Label htmlFor="description" className="text-white">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Event description"
                    className="bg-gray-800 border-gray-600 text-white min-h-20"
                    data-testid="textarea-event-description"
                  />
                </div>
                
                <div className="col-span-2 flex items-center space-x-2">
                  <Switch
                    checked={formData.requiresPurchase}
                    onCheckedChange={(checked) => setFormData({ ...formData, requiresPurchase: checked })}
                    data-testid="switch-requires-purchase"
                  />
                  <Label className="text-white">Requires Purchase</Label>
                </div>
                
                {formData.requiresPurchase && (
                  <div className="col-span-2">
                    <Label htmlFor="price" className="text-white">Price ($)</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      placeholder="0.00"
                      className="bg-gray-800 border-gray-600 text-white"
                      data-testid="input-event-price"
                    />
                  </div>
                )}
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreateDialog(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createEventMutation.isPending}
                  className="bg-[rgb(251,208,0)] text-black hover:bg-[rgb(251,208,0)]/90"
                  data-testid="button-create-event"
                >
                  {createEventMutation.isPending ? 'Creating...' : 'Create Event'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Event Dialog */}
      <Dialog open={!!editingEvent} onOpenChange={(open) => !open && setEditingEvent(null)}>
        <DialogContent className="bg-gray-900 border-gray-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Event</DialogTitle>
            <DialogDescription className="text-gray-400">
              Update event details. Required fields are marked with an asterisk.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="edit-title" className="text-white">Title *</Label>
                <Input
                  id="edit-title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Event title"
                  className="bg-gray-800 border-gray-600 text-white"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="edit-eventDate" className="text-white">Start Date *</Label>
                <Input
                  id="edit-eventDate"
                  type="date"
                  value={formData.eventDate}
                  onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                  className="bg-gray-800 border-gray-600 text-white"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="edit-eventTime" className="text-white">Start Time</Label>
                <Input
                  id="edit-eventTime"
                  type="time"
                  value={formData.eventTime}
                  onChange={(e) => setFormData({ ...formData, eventTime: e.target.value })}
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>

              <div>
                <Label htmlFor="edit-endDate" className="text-white">End Date</Label>
                <Input
                  id="edit-endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>

              <div>
                <Label htmlFor="edit-endTime" className="text-white">End Time</Label>
                <Input
                  id="edit-endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>
              
              <div className="col-span-2">
                <Label htmlFor="edit-location" className="text-white">Location Name</Label>
                <Input
                  id="edit-location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g. Grace Community Church"
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="edit-address" className="text-white flex items-center gap-1">
                  <Navigation className="w-3 h-3" /> Address (for map directions)
                </Label>
                <Input
                  id="edit-address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="e.g. 123 Main St, City, State 12345"
                  className="bg-gray-800 border-gray-600 text-white"
                />
                <p className="text-xs text-gray-500 mt-1">Users will see a "Get Directions" button linking to Google Maps</p>
              </div>
              
              <div className="col-span-2">
                <Label htmlFor="edit-eventUrl" className="text-white">Event URL</Label>
                <Input
                  id="edit-eventUrl"
                  type="url"
                  value={formData.eventUrl}
                  onChange={(e) => setFormData({ ...formData, eventUrl: e.target.value })}
                  placeholder="https://example.com/event"
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>
              
              <div className="col-span-2">
                <Label htmlFor="edit-description" className="text-white">Description</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Event description"
                  className="bg-gray-800 border-gray-600 text-white min-h-20"
                />
              </div>
              
              <div className="col-span-2 flex items-center space-x-2">
                <Switch
                  checked={formData.requiresPurchase}
                  onCheckedChange={(checked) => setFormData({ ...formData, requiresPurchase: checked })}
                />
                <Label className="text-white">Requires Purchase</Label>
              </div>
              
              {formData.requiresPurchase && (
                <div className="col-span-2">
                  <Label htmlFor="edit-price" className="text-white">Price ($)</Label>
                  <Input
                    id="edit-price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="0.00"
                    className="bg-gray-800 border-gray-600 text-white"
                  />
                </div>
              )}
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingEvent(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateEventMutation.isPending}
                className="bg-[rgb(251,208,0)] text-black hover:bg-[rgb(251,208,0)]/90"
              >
                {updateEventMutation.isPending ? 'Updating...' : 'Update Event'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Events List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="bg-gray-900 border-gray-700">
                <CardHeader>
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : events.length === 0 ? (
          <Card className="bg-gray-900 border-gray-700 text-center py-12">
            <CardContent>
              <Calendar className="mx-auto mb-4 h-16 w-16 text-gray-500" />
              <h3 className="text-xl font-semibold mb-2 text-white">No Events Found</h3>
              <p className="text-gray-400">
                No events have been created yet. Click "Create Event" to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          events.map((event) => (
            <Card key={event.id} className="bg-gray-900 border-gray-700">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-xl mb-2 text-white">
                      {event.title}
                    </CardTitle>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(event.eventDate)}</span>
                        {event.eventTime && (
                          <span>at {formatTime(event.eventTime)}</span>
                        )}
                      </div>
                      {event.endDate && (
                        <div className="flex items-center gap-1">
                          <CalendarRange className="h-4 w-4" />
                          <span>Ends {formatDate(event.endDate)}</span>
                          {event.endTime && (
                            <span>at {formatTime(event.endTime)}</span>
                          )}
                        </div>
                      )}
                      {event.location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          <span className="truncate max-w-48">{event.location}</span>
                        </div>
                      )}
                      {event.address && (
                        <div className="flex items-center gap-1">
                          <Navigation className="h-4 w-4" />
                          <span className="truncate max-w-48">{event.address}</span>
                        </div>
                      )}
                      {event.requiresPurchase && event.price && (
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4" />
                          <span>${event.price}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {event.eventUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="border-gray-600 text-gray-300 hover:bg-gray-700"
                      >
                        <a href={event.eventUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(event)}
                      className="border-gray-600 text-gray-300 hover:bg-gray-700"
                      data-testid={`button-edit-${event.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(event.id)}
                      className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
                      data-testid={`button-delete-${event.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
            </Card>
          ))
        )}
      </div>
    </div>
  );
}