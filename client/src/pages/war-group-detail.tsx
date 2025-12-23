import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Users, User, Calendar, ChevronLeft, LogOut, CheckCircle2, XCircle, UserPlus } from "lucide-react";
import { useLocation } from "wouter";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";

interface WarGroup {
  id: string;
  name: string;
  city: string;
  state: string;
  description: string | null;
  memberCount: number;
  meetingInfo: string | null;
  leader: {
    id: string;
    firstName: string;
    lastName: string;
    profileImageUrl: string | null;
  };
}

interface GroupMembership {
  id: string;
  groupId: string;
  userId: string;
  status: string;
  role: string;
}

interface PendingRequest {
  id: string;
  groupId: string;
  userId: string;
  status: string;
  requestedAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    profileImageUrl: string | null;
    email: string;
  };
}

export default function WarGroupDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: group, isLoading } = useQuery<WarGroup>({
    queryKey: [`/api/war-groups/${id}`],
  });

  const { data: membership } = useQuery<GroupMembership | null>({
    queryKey: [`/api/war-groups/${id}/membership`],
    enabled: !!id,
  });

  const { data: myGroups = [] } = useQuery<WarGroup[]>({
    queryKey: ['/api/user/war-groups'],
  });

  const joinMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/war-groups/${id}/join`, {});
    },
    onSuccess: () => {
      toast({
        title: "Request Sent",
        description: "Your request to join this group has been sent to the leader",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/war-groups/${id}/membership`] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send join request",
        variant: "destructive",
      });
    },
  });

  const leaveMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/war-groups/${id}/leave`, {});
    },
    onSuccess: () => {
      toast({
        title: "Left Group",
        description: "You have left this war group",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user/war-groups'] });
      queryClient.invalidateQueries({ queryKey: [`/api/war-groups/${id}/membership`] });
      queryClient.invalidateQueries({ queryKey: [`/api/war-groups/${id}`] });
      navigate('/war-groups');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to leave group",
        variant: "destructive",
      });
    },
  });

  const isMember = myGroups.some(g => g.id === id);
  const isLeader = group?.leader?.id === membership?.userId;

  // Fetch pending requests (only for leaders)
  const { data: pendingRequests = [] } = useQuery<PendingRequest[]>({
    queryKey: [`/api/war-groups/${id}/pending-requests`],
    enabled: !!id && isLeader,
  });

  const approveMutation = useMutation({
    mutationFn: async (memberId: string) => {
      return apiRequest('POST', `/api/war-groups/${id}/members/${memberId}/approve`, {});
    },
    onSuccess: () => {
      toast({
        title: "Member Approved",
        description: "The member has been added to the group",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/war-groups/${id}/pending-requests`] });
      queryClient.invalidateQueries({ queryKey: [`/api/war-groups/${id}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve member",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (memberId: string) => {
      return apiRequest('POST', `/api/war-groups/${id}/members/${memberId}/reject`, {});
    },
    onSuccess: () => {
      toast({
        title: "Request Rejected",
        description: "The membership request has been declined",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/war-groups/${id}/pending-requests`] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject request",
        variant: "destructive",
      });
    },
  });

  const hasPendingRequest = membership?.status === 'pending';

  if (isLoading) {
    return (
      <div className="pb-20">
        <div className="bg-gradient-to-r from-ministry-navy to-ministry-charcoal dark:from-header-dark dark:to-ministry-navy text-white px-6 pt-12 pb-6">
          <div className="max-w-4xl mx-auto">
            <div className="animate-pulse">
              <div className="h-8 bg-ministry-gold-exact rounded w-2/3 mb-2"></div>
              <div className="h-4 bg-ministry-gold-exact rounded w-1/3"></div>
            </div>
          </div>
        </div>
        <div className="max-w-4xl mx-auto p-4">
          <div className="animate-pulse space-y-4">
            <div className="h-32 bg-ministry-gold-exact rounded"></div>
            <div className="h-48 bg-ministry-gold-exact rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="pb-20">
        <div className="bg-gradient-to-r from-ministry-navy to-ministry-charcoal dark:from-header-dark dark:to-ministry-navy text-white px-6 pt-12 pb-6">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl font-black mb-2 tracking-tight">Group Not Found</h1>
          </div>
        </div>
        <div className="max-w-4xl mx-auto p-4">
          <Card className="bg-ministry-gold-exact border-2 border-black">
            <CardContent className="text-center py-12">
              <p className="text-black font-semibold mb-4">This war group could not be found</p>
              <Link href="/war-groups">
                <Button className="bg-black text-white hover:bg-gray-900">
                  Back to Groups
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-ministry-navy to-ministry-charcoal dark:from-header-dark dark:to-ministry-navy text-white px-6 pt-12 pb-6">
        <div className="max-w-4xl mx-auto">
          <Link href="/war-groups">
            <Button variant="ghost" className="text-white hover:text-ministry-gold-exact mb-4 -ml-2">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Groups
            </Button>
          </Link>
          <h1 className="text-4xl font-black mb-2 tracking-tight">{group.name}</h1>
          <div className="flex items-center gap-4 text-ministry-gold-exact text-sm font-semibold">
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {group.city}, {group.state}
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {group.memberCount} members
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Join/Status Card */}
        {!isMember && (
          <Card className="bg-ministry-gold-exact border-2 border-black">
            <CardContent className="pt-6">
              {hasPendingRequest ? (
                <div className="text-center">
                  <Badge className="bg-black text-white mb-4">Pending Request</Badge>
                  <p className="text-black font-semibold">Your request to join is pending approval from the group leader</p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-black font-semibold mb-4">Join this war group to connect with local brothers</p>
                  <Button 
                    onClick={() => joinMutation.mutate()}
                    disabled={joinMutation.isPending}
                    className="bg-black text-white hover:bg-gray-900"
                    data-testid="button-join-group"
                  >
                    {joinMutation.isPending ? 'Sending Request...' : 'Request to Join'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {isMember && (
          <Card className="bg-ministry-gold-exact border-2 border-black">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge className="bg-black text-white">{isLeader ? 'Leader' : 'Member'}</Badge>
                  <p className="text-black font-semibold">You are a {isLeader ? 'leader' : 'member'} of this group</p>
                </div>
                {!isLeader && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => leaveMutation.mutate()}
                    disabled={leaveMutation.isPending}
                    className="border-red-600 text-red-600 hover:bg-red-50"
                    data-testid="button-leave-group"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    {leaveMutation.isPending ? 'Leaving...' : 'Leave Group'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pending Requests (Leader Only) */}
        {isLeader && pendingRequests.length > 0 && (
          <Card className="bg-black border-2 border-ministry-gold-exact">
            <CardHeader>
              <CardTitle className="text-ministry-gold-exact flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Pending Membership Requests
                <Badge className="bg-red-500 text-white ml-2">{pendingRequests.length}</Badge>
              </CardTitle>
              <CardDescription className="text-white/70">
                Review and approve members who want to join your group
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingRequests.map((request) => (
                <div key={request.id} className="flex items-center justify-between bg-white/10 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    {request.user.profileImageUrl ? (
                      <img 
                        src={request.user.profileImageUrl} 
                        alt={request.user.firstName}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-ministry-gold-exact flex items-center justify-center">
                        <User className="h-5 w-5 text-black" />
                      </div>
                    )}
                    <div>
                      <p className="text-white font-semibold">
                        {request.user.firstName} {request.user.lastName}
                      </p>
                      <p className="text-white/60 text-xs">{request.user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => approveMutation.mutate(request.id)}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      className="bg-green-600 hover:bg-green-700 text-white"
                      data-testid={`button-approve-${request.id}`}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => rejectMutation.mutate(request.id)}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      className="border-red-500 text-red-500 hover:bg-red-500/10"
                      data-testid={`button-reject-${request.id}`}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Group Info */}
        <Card className="bg-ministry-gold-exact border-2 border-black">
          <CardHeader>
            <CardTitle className="text-black">About This Group</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {group.description && (
              <div>
                <p className="text-black">{group.description}</p>
              </div>
            )}
            
            <div>
              <div className="flex items-center gap-2 mb-2">
                <User className="h-4 w-4 text-black" />
                <span className="text-black font-bold">Group Leader</span>
              </div>
              <p className="text-black">{group.leader.firstName} {group.leader.lastName}</p>
            </div>

            {group.meetingInfo && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-black" />
                  <span className="text-black font-bold">Meeting Info</span>
                </div>
                <p className="text-black">{group.meetingInfo}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs for Community, War Room, Challenges (Coming Soon) */}
        {isMember && (
          <Card className="bg-ministry-gold-exact border-2 border-black">
            <CardContent className="pt-6">
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="w-full bg-black">
                  <TabsTrigger value="overview" className="flex-1 text-white data-[state=active]:bg-ministry-gold-exact data-[state=active]:text-black">Overview</TabsTrigger>
                  <TabsTrigger value="community" className="flex-1 text-white data-[state=active]:bg-ministry-gold-exact data-[state=active]:text-black" disabled>Community</TabsTrigger>
                  <TabsTrigger value="war-room" className="flex-1 text-white data-[state=active]:bg-ministry-gold-exact data-[state=active]:text-black" disabled>War Room</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="mt-4">
                  <div className="text-center py-12">
                    <p className="text-black font-semibold">Welcome to {group.name}!</p>
                    <p className="text-sm text-black mt-2">Group features coming soon...</p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
