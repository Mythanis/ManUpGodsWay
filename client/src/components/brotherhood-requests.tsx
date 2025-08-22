import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { UserPlus, Check, X, Clock } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface BrotherhoodRequest {
  id: string;
  requesterId: string;
  recipientId: string;
  status: string;
  message: string | null;
  createdAt: string;
  requester: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
  };
}

export default function BrotherhoodRequests() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: requests, isLoading } = useQuery<BrotherhoodRequest[]>({
    queryKey: ['/api/brotherhood-requests'],
    refetchInterval: 5000, // Refresh every 5 seconds for real-time updates
    refetchIntervalInBackground: true,
  });

  const respondMutation = useMutation({
    mutationFn: async ({ requestId, response }: { requestId: string; response: 'approved' | 'denied' }) => {
      return apiRequest('POST', `/api/brotherhood-requests/${requestId}/respond`, { response });
    },
    onSuccess: (_, { response }) => {
      toast({
        title: response === 'approved' ? "Brotherhood Approved" : "Request Denied",
        description: response === 'approved' 
          ? "You are now brothers in faith!" 
          : "Brotherhood request has been denied.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/brotherhood-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/brothers'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to respond to request",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-ministry-gold" />
            Brotherhood Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center space-x-3 animate-pulse">
                <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-32"></div>
                  <div className="h-3 bg-gray-200 rounded w-24"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!requests || requests.length === 0) {
    return null; // Don't show the card if no requests
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-ministry-gold" />
          Brotherhood Requests
          <span className="ml-2 bg-ministry-gold text-black text-xs px-2 py-1 rounded-full font-semibold">
            {requests.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {requests.map((request) => (
            <div
              key={request.id}
              className="flex items-start space-x-4 p-4 border rounded-lg bg-muted/50"
              data-testid={`brotherhood-request-${request.id}`}
            >
              <Avatar>
                <AvatarFallback className="bg-ministry-gold text-black font-semibold">
                  {request.requester.firstName?.[0]}{request.requester.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <div>
                  <h4 className="font-semibold">
                    {request.requester.firstName} {request.requester.lastName}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    @{request.requester.username}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    wants to be your brother in faith
                  </p>
                  {request.message && (
                    <p className="text-sm mt-2 italic">
                      "{request.message}"
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(request.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  size="sm"
                  onClick={() => respondMutation.mutate({ 
                    requestId: request.id, 
                    response: 'approved' 
                  })}
                  disabled={respondMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  data-testid={`button-approve-${request.id}`}
                >
                  <Check className="w-4 h-4 mr-1" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => respondMutation.mutate({ 
                    requestId: request.id, 
                    response: 'denied' 
                  })}
                  disabled={respondMutation.isPending}
                  className="border-red-200 text-red-600 hover:bg-red-50"
                  data-testid={`button-deny-${request.id}`}
                >
                  <X className="w-4 h-4 mr-1" />
                  Deny
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}