import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users, CheckCircle, Clock, XCircle, Mail, Download } from 'lucide-react';
import { format } from 'date-fns';

interface Registrant {
  registrationId: string;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  registrationType: string;
  paymentStatus: string;
  amountPaid: string | null;
  registeredAt: string | null;
}

interface Event {
  id: string;
  title: string;
  eventDate: string;
  location: string | null;
}

function PaymentBadge({ status, type }: { status: string; type: string }) {
  if (type === 'free') {
    return (
      <Badge className="bg-blue-600/20 text-blue-400 border border-blue-600/40 text-xs font-bold uppercase">
        Free
      </Badge>
    );
  }
  if (status === 'completed') {
    return (
      <Badge className="bg-green-600/20 text-green-400 border border-green-600/40 text-xs font-bold uppercase">
        <CheckCircle className="h-3 w-3 mr-1" />
        Paid
      </Badge>
    );
  }
  if (status === 'pending') {
    return (
      <Badge className="bg-yellow-600/20 text-yellow-400 border border-yellow-600/40 text-xs font-bold uppercase">
        <Clock className="h-3 w-3 mr-1" />
        Pending
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-600/20 text-red-400 border border-red-600/40 text-xs font-bold uppercase">
      <XCircle className="h-3 w-3 mr-1" />
      {status}
    </Badge>
  );
}

export default function AdminEventRegistrants() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const eventId = params.id;

  const isAdmin = user?.role === 'admin' || user?.role === 'owner';

  if (!isAdmin) {
    navigate('/');
    return null;
  }

  const { data: registrants = [], isLoading: registrantsLoading } = useQuery<Registrant[]>({
    queryKey: ['/api/admin/events', eventId, 'registrations'],
    queryFn: async () => {
      const res = await fetch(`/api/admin/events/${eventId}/registrations`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch registrants');
      return res.json();
    },
    enabled: !!eventId && isAdmin,
  });

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ['/api/events'],
    enabled: !!user,
  });

  const event = events.find(e => e.id === eventId);

  const paidCount = registrants.filter(r => r.paymentStatus === 'completed' || r.registrationType === 'free').length;
  const pendingCount = registrants.filter(r => r.registrationType !== 'free' && r.paymentStatus !== 'completed').length;

  const exportCsv = () => {
    const header = 'First Name,Last Name,Email,Type,Payment Status,Amount Paid,Registered At';
    const rows = registrants.map(r => [
      r.firstName || '',
      r.lastName || '',
      r.email || '',
      r.registrationType,
      r.paymentStatus,
      r.amountPaid ? `$${r.amountPaid}` : 'N/A',
      r.registeredAt ? format(new Date(r.registeredAt), 'yyyy-MM-dd HH:mm') : '',
    ].map(v => `"${v}"`).join(','));
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event?.title || 'event'}-registrants.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-950 pb-20">
      <div className="bg-gray-900 border-b border-gray-700 px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin')}
            className="text-gray-400 hover:text-white mb-3 -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Admin
          </Button>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 bg-[#FCD000] rounded-sm flex items-center justify-center flex-shrink-0">
                  <Users className="h-4 w-4 text-black" />
                </div>
                <h1 className="text-xl font-black text-white uppercase tracking-tight">
                  Registrants
                </h1>
              </div>
              {event && (
                <p className="text-[#FCD000] font-bold text-sm ml-10">{event.title}</p>
              )}
            </div>
            {registrants.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={exportCsv}
                className="border-gray-600 text-gray-300 hover:bg-gray-700 flex-shrink-0"
              >
                <Download className="h-4 w-4 mr-1.5" />
                Export CSV
              </Button>
            )}
          </div>

          {!registrantsLoading && registrants.length > 0 && (
            <div className="flex gap-4 mt-4 ml-10">
              <div className="text-center">
                <p className="text-2xl font-black text-white">{registrants.length}</p>
                <p className="text-gray-400 text-xs uppercase tracking-wide">Total</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-green-400">{paidCount}</p>
                <p className="text-gray-400 text-xs uppercase tracking-wide">Confirmed</p>
              </div>
              {pendingCount > 0 && (
                <div className="text-center">
                  <p className="text-2xl font-black text-yellow-400">{pendingCount}</p>
                  <p className="text-gray-400 text-xs uppercase tracking-wide">Pending</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-6 max-w-4xl mx-auto">
        {registrantsLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="bg-gray-900 border-gray-700">
                <CardContent className="py-4">
                  <div className="animate-pulse flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-700 rounded w-36"></div>
                      <div className="h-3 bg-gray-700 rounded w-48"></div>
                    </div>
                    <div className="h-6 bg-gray-700 rounded w-16"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : registrants.length === 0 ? (
          <Card className="bg-gray-900 border-gray-700 text-center py-16">
            <CardContent>
              <Users className="mx-auto mb-4 h-16 w-16 text-gray-600" />
              <h3 className="text-xl font-bold text-white mb-2">No Registrants Yet</h3>
              <p className="text-gray-400">No one has registered for this event yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {registrants.map((r) => {
              const fullName = [r.firstName, r.lastName].filter(Boolean).join(' ') || 'Unknown User';
              return (
                <Card key={r.registrationId} className="bg-gray-900 border-gray-700 hover:border-gray-600 transition-colors">
                  <CardContent className="py-4 px-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-sm truncate">{fullName}</p>
                        {r.email && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Mail className="h-3 w-3 text-gray-500 flex-shrink-0" />
                            <p className="text-gray-400 text-xs truncate">{r.email}</p>
                          </div>
                        )}
                        {r.registeredAt && (
                          <p className="text-gray-600 text-xs mt-1">
                            Registered {format(new Date(r.registeredAt), 'MMM d, yyyy')}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {r.amountPaid && r.registrationType !== 'free' && (
                          <span className="text-[#FCD000] font-bold text-sm">${parseFloat(r.amountPaid).toFixed(2)}</span>
                        )}
                        <PaymentBadge status={r.paymentStatus} type={r.registrationType} />
                      </div>
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
