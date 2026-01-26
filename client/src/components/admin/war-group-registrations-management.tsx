import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { CheckCircle2, XCircle, MapPin, Mail, Phone, FileText, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface WarGroupRegistration {
  registration: {
    id: string;
    name: string;
    city: string;
    state: string;
    description: string | null;
    meetingInfo: string | null;
    contactEmail: string;
    contactPhone: string | null;
    leadershipExperience: string | null;
    motivation: string | null;
    status: string;
    createdAt: string;
  };
  requester: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    profileImageUrl: string | null;
  };
}

export default function WarGroupRegistrationsManagement() {
  const { toast } = useToast();
  const [selectedRegistration, setSelectedRegistration] = useState<WarGroupRegistration | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected">("pending");

  const { data: registrations = [], isLoading } = useQuery<WarGroupRegistration[]>({
    queryKey: ['/api/admin/war-groups/registrations', statusFilter],
    queryFn: async () => {
      const response = await fetch(`/api/admin/war-groups/registrations?status=${statusFilter}`);
      if (!response.ok) throw new Error('Failed to fetch registrations');
      return response.json();
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (registrationId: string) => {
      const response = await fetch(`/api/admin/war-groups/registrations/${registrationId}/approve`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to approve registration");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/war-groups/registrations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/war-groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/war-groups"] });
      setShowApproveDialog(false);
      setSelectedRegistration(null);
      toast({
        title: "Registration Approved",
        description: "The war group has been created and the requester has been made the leader.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve registration",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ registrationId, reason }: { registrationId: string; reason: string }) => {
      const response = await fetch(`/api/admin/war-groups/registrations/${registrationId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) throw new Error("Failed to reject registration");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/war-groups/registrations"] });
      setShowRejectDialog(false);
      setSelectedRegistration(null);
      setRejectionReason("");
      toast({
        title: "Registration Rejected",
        description: "The registration has been rejected.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject registration",
        variant: "destructive",
      });
    },
  });

  const handleApprove = (registration: WarGroupRegistration) => {
    setSelectedRegistration(registration);
    setShowApproveDialog(true);
  };

  const handleReject = (registration: WarGroupRegistration) => {
    setSelectedRegistration(registration);
    setShowRejectDialog(true);
  };

  if (isLoading) {
    return <div className="text-white">Loading registrations...</div>;
  }

  return (
    <div className="space-y-6">
      <Card className="bg-charcoal-light border-gold/20">
        <CardHeader>
          <CardTitle className="text-white">War Group Registrations</CardTitle>
          <CardDescription className="text-slate-light">
            Review and approve/reject war group registration requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)} className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pending" data-testid="tab-pending">
                Pending ({registrations.filter(r => r.registration.status === 'pending').length})
              </TabsTrigger>
              <TabsTrigger value="approved" data-testid="tab-approved">
                Approved
              </TabsTrigger>
              <TabsTrigger value="rejected" data-testid="tab-rejected">
                Rejected
              </TabsTrigger>
            </TabsList>

            <div className="space-y-4">
              {registrations.length === 0 ? (
                <p className="text-slate-light text-center py-8">
                  No {statusFilter} registrations found.
                </p>
              ) : (
                registrations.map((reg) => (
                  <Card key={reg.registration.id} className="bg-charcoal border-slate">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-white">{reg.registration.name}</CardTitle>
                          <CardDescription className="text-slate-light flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            {reg.registration.city}, {reg.registration.state}
                          </CardDescription>
                        </div>
                        <Badge
                          variant={reg.registration.status === 'pending' ? 'default' : reg.registration.status === 'approved' ? 'secondary' : 'destructive'}
                          data-testid={`status-${reg.registration.id}`}
                        >
                          {reg.registration.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-semibold text-gold mb-1">Requester</h4>
                          <p className="text-white">
                            {reg.requester.firstName} {reg.requester.lastName}
                          </p>
                          <p className="text-slate-light text-sm">{reg.requester.email}</p>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-gold mb-1">Contact</h4>
                          <div className="space-y-1">
                            <p className="text-white text-sm flex items-center gap-2">
                              <Mail className="h-3 w-3" />
                              {reg.registration.contactEmail}
                            </p>
                            {reg.registration.contactPhone && (
                              <p className="text-white text-sm flex items-center gap-2">
                                <Phone className="h-3 w-3" />
                                {reg.registration.contactPhone}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {reg.registration.description && (
                        <div>
                          <h4 className="text-sm font-semibold text-gold mb-1">Description</h4>
                          <p className="text-slate-light text-sm">{reg.registration.description}</p>
                        </div>
                      )}

                      {reg.registration.meetingInfo && (
                        <div>
                          <h4 className="text-sm font-semibold text-gold mb-1">Meeting Information</h4>
                          <p className="text-slate-light text-sm">{reg.registration.meetingInfo}</p>
                        </div>
                      )}

                      {reg.registration.leadershipExperience && (
                        <div>
                          <h4 className="text-sm font-semibold text-gold mb-1">Leadership Experience</h4>
                          <p className="text-slate-light text-sm">{reg.registration.leadershipExperience}</p>
                        </div>
                      )}

                      {reg.registration.motivation && (
                        <div>
                          <h4 className="text-sm font-semibold text-gold mb-1">Motivation</h4>
                          <p className="text-slate-light text-sm">{reg.registration.motivation}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-slate-light text-sm">
                        <Clock className="h-3 w-3" />
                        Submitted {formatDistanceToNow(new Date(reg.registration.createdAt))} ago
                      </div>

                      {reg.registration.status === 'pending' && (
                        <div className="flex gap-2 pt-2">
                          <Button
                            onClick={() => handleApprove(reg)}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                            data-testid={`button-approve-${reg.registration.id}`}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Approve
                          </Button>
                          <Button
                            onClick={() => handleReject(reg)}
                            variant="destructive"
                            className="flex-1"
                            data-testid={`button-reject-${reg.registration.id}`}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="bg-charcoal border-gold/20">
          <DialogHeader>
            <DialogTitle className="text-white">Approve Registration</DialogTitle>
            <DialogDescription className="text-slate-light">
              This will create a new war group and assign {selectedRegistration?.requester.firstName}{" "}
              {selectedRegistration?.requester.lastName} as the leader.
            </DialogDescription>
          </DialogHeader>
          {selectedRegistration && (
            <div className="space-y-2 text-white">
              <p>
                <strong>Group:</strong> {selectedRegistration.registration.name}
              </p>
              <p>
                <strong>Location:</strong> {selectedRegistration.registration.city},{" "}
                {selectedRegistration.registration.state}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)} data-testid="button-cancel-approve">
              Cancel
            </Button>
            <Button
              onClick={() => selectedRegistration && approveMutation.mutate(selectedRegistration.registration.id)}
              disabled={approveMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
              data-testid="button-confirm-approve"
            >
              {approveMutation.isPending ? "Approving..." : "Confirm Approval"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="bg-charcoal border-gold/20">
          <DialogHeader>
            <DialogTitle className="text-white">Reject Registration</DialogTitle>
            <DialogDescription className="text-slate-light">
              Please provide a reason for rejecting this registration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="rejection-reason" className="text-white">
                Rejection Reason
              </Label>
              <Textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why this registration is being rejected..."
                className="bg-white border-2 border-black text-black mt-2 rounded-sm font-medium placeholder:text-black/50"
                data-testid="input-rejection-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)} data-testid="button-cancel-reject">
              Cancel
            </Button>
            <Button
              onClick={() =>
                selectedRegistration &&
                rejectionReason.trim() &&
                rejectMutation.mutate({
                  registrationId: selectedRegistration.registration.id,
                  reason: rejectionReason,
                })
              }
              disabled={rejectMutation.isPending || !rejectionReason.trim()}
              variant="destructive"
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
