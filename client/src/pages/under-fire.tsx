import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { Trash2, Search, SortDesc, Shield, HandHelping, CheckCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link, useLocation } from 'wouter';
import { BackButton } from "@/components/BackButton";

interface AccountabilityRequest {
  id: string;
  userId: string;
  content: string;
  assistedById: string | null;
  assistedAt: string | null;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    profileImageUrl?: string;
  };
  assister: {
    id: string;
    firstName: string;
    lastName: string;
    profileImageUrl?: string;
  } | null;
}

export default function UnderFire() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [newRequestContent, setNewRequestContent] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  
  const { data: currentUser } = useQuery<{ id: string }>({ queryKey: ['/api/auth/user'] });
  
  const { data: allRequests = [], isLoading } = useQuery<AccountabilityRequest[]>({
    queryKey: ['/api/accountability-requests'],
  });
  
  const requests = React.useMemo(() => {
    let filtered = allRequests;
    
    if (searchTerm) {
      filtered = filtered.filter(request => 
        request.content.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    filtered = [...filtered].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
    });
    
    return filtered;
  }, [allRequests, searchTerm, sortBy]);

  const createRequestMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest('POST', '/api/accountability-requests', { content });
    },
    onSuccess: () => {
      toast({
        title: "Request Posted",
        description: "Your accountability request has been shared",
      });
      setNewRequestContent('');
      queryClient.invalidateQueries({ queryKey: ['/api/accountability-requests'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to create request",
        variant: "destructive",
      });
    },
  });

  const assistMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return apiRequest('POST', `/api/accountability-requests/${requestId}/assist`);
    },
    onSuccess: (data: any) => {
      toast({
        title: "Accountability Accepted!",
        description: "A direct message has been created. Check your messages to connect.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/accountability-requests'] });
      if (data.conversationId) {
        setLocation(`/messages?conversation=${data.conversationId}`);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to assist with request",
        variant: "destructive",
      });
    },
  });

  const deleteRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return apiRequest('DELETE', `/api/accountability-requests/${requestId}`);
    },
    onSuccess: () => {
      toast({
        title: "Request Deleted",
        description: "Your accountability request has been removed",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/accountability-requests'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to delete request",
        variant: "destructive",
      });
    },
  });

  const unassistMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return apiRequest('POST', `/api/accountability-requests/${requestId}/unassist`);
    },
    onSuccess: () => {
      toast({
        title: "Unassisted",
        description: "You are no longer assisting this request. It is now open for others.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/accountability-requests'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to unassist",
        variant: "destructive",
      });
    },
  });

  const handleCreateRequest = () => {
    if (!newRequestContent.trim()) {
      toast({
        title: "Error",
        description: "Please enter your accountability request",
        variant: "destructive",
      });
      return;
    }
    createRequestMutation.mutate(newRequestContent);
  };

  const handleAssist = (requestId: string) => {
    assistMutation.mutate(requestId);
  };

  const handleDeleteRequest = (requestId: string) => {
    if (window.confirm('Are you sure you want to delete this request? This action cannot be undone.')) {
      deleteRequestMutation.mutate(requestId);
    }
  };

  const handleUnassist = (requestId: string) => {
    if (window.confirm('Are you sure you want to stop assisting? This will allow others to assist.')) {
      unassistMutation.mutate(requestId);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

  if (isLoading) {
    return (
      <div className="pb-20">
        <div className="liquid-header text-white px-6 pt-8 pb-6">
          <div className="max-w-2xl mx-auto">
            <BackButton />
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-black tracking-tight">Under Fire</h1>
            </div>
            <p className="text-ministry-gold-exact text-sm font-semibold">Request Accountability</p>
          </div>
        </div>
        <div className="max-w-2xl mx-auto p-4">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-ministry-gold-exact rounded"></div>
            <div className="h-32 bg-ministry-gold-exact rounded"></div>
            <div className="h-24 bg-ministry-gold-exact rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20">
      <div className="liquid-header text-white px-6 pt-8 pb-6">
        <div className="max-w-2xl mx-auto">
          <BackButton />
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-4xl font-black tracking-tighter uppercase">Under Fire</h1>
          </div>
          <p className="text-ministry-gold-exact text-xs font-bold tracking-widest uppercase">Request Accountability</p>
        </div>
      </div>
      
      <div className="max-w-2xl mx-auto p-4 space-y-6">
        
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-black" />
            <Input
              placeholder="SEARCH REQUESTS..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-2 border-black bg-ministry-gold-exact rounded-none text-black placeholder:text-black/50 placeholder:font-medium placeholder:text-xs placeholder:tracking-wide font-medium"
            />
          </div>
          <div className="flex gap-2">
            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="w-36 border-2 border-black bg-ministry-gold-exact text-black font-bold rounded-none">
                <SortDesc className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card className="bg-ministry-gold-exact border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <CardHeader>
            <CardTitle className="text-black flex items-center gap-2 text-2xl font-black tracking-tighter uppercase">
              <Shield className="h-6 w-6" />
              Request Accountability
            </CardTitle>
            <CardDescription className="text-black text-base font-medium leading-relaxed">
              A place for men to request accountability. This accountability can be for you to grow closer to God by reading your Bible more, praying more. It can be to be healthier by exercising or eating healthier. It can be a sin you are struggling to get rid of in your life that you need someone to hold you accountable for. Whatever you need to be held accountable for this is the space. Submit your request below and someone within the community can volunteer to hold you accountable. When they offer, a direct message will be created between you and them to communicate directly. From there you are free to share your information to better hold accountability.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="content" className="text-black font-semibold">
                Accountability Request
              </Label>
              <Textarea
                id="content"
                placeholder="Share what you need accountability for..."
                value={newRequestContent}
                onChange={(e) => setNewRequestContent(e.target.value)}
                className="min-h-[100px]"
                data-testid="textarea-accountability-request"
              />
            </div>

            <Button 
              onClick={handleCreateRequest}
              disabled={createRequestMutation.isPending || !newRequestContent.trim()}
              className="w-full bg-black hover:bg-gray-900 text-white font-black text-lg py-6 rounded-none shadow-lg border-2 border-black transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] uppercase tracking-wide"
              data-testid="button-share-request"
            >
              {createRequestMutation.isPending ? 'Posting...' : 'Share Request'}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {requests.length === 0 ? (
            <Card className="bg-ministry-gold-exact border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <CardContent className="text-center py-12">
                <Shield className="h-12 w-12 text-black mx-auto mb-4" />
                <p className="text-black font-medium">No accountability requests yet. Be the first to share!</p>
              </CardContent>
            </Card>
          ) : (
            requests.map((request) => (
              <Card key={request.id} className="bg-black border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(252,208,0,0.3)]">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Link href={`/users/${request.user.id}`}>
                          <span className="text-white font-medium hover:text-ministry-gold-exact cursor-pointer transition-colors">
                            {request.user.firstName} {request.user.lastName}
                          </span>
                        </Link>
                        <Badge className="bg-ministry-gold-exact text-black font-semibold">
                          Accountability Request
                        </Badge>
                        {request.assistedById && (
                          <Badge className="bg-ministry-gold-exact text-black font-semibold">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Assisted
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-400">{formatTimeAgo(request.createdAt)}</p>
                    </div>
                    {currentUser?.id === request.userId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteRequest(request.id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20 p-1 h-auto"
                        disabled={deleteRequestMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-white leading-relaxed">{request.content}</p>
                  
                  <Separator className="bg-gray-700" />
                  
                  <div className="flex items-center gap-4 flex-wrap">
                    {request.assistedById ? (
                      <>
                        <div className="flex items-center gap-2 text-white">
                          <CheckCircle className="h-4 w-4 text-ministry-gold-exact" />
                          <span className="text-sm font-medium">
                            Accountability accepted by {request.assister?.firstName} {request.assister?.lastName}
                          </span>
                        </div>
                        {currentUser?.id === request.assistedById && (
                          <Button
                            onClick={() => handleUnassist(request.id)}
                            disabled={unassistMutation.isPending}
                            variant="outline"
                            size="sm"
                            className="text-red-400 border-red-400 hover:bg-red-900/20 rounded-none"
                          >
                            {unassistMutation.isPending ? 'Processing...' : 'Unassist'}
                          </Button>
                        )}
                      </>
                    ) : currentUser?.id !== request.userId ? (
                      <Button
                        onClick={() => handleAssist(request.id)}
                        disabled={assistMutation.isPending}
                        className="bg-ministry-gold-exact text-black hover:bg-yellow-400 font-bold rounded-none"
                        data-testid={`button-assist-${request.id}`}
                      >
                        <HandHelping className="h-4 w-4 mr-2" />
                        {assistMutation.isPending ? 'Processing...' : 'Assist'}
                      </Button>
                    ) : (
                      <span className="text-gray-400 text-sm italic">Waiting for someone to assist...</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
