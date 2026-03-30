import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { formatLocalDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Eye, Ban, UserCheck, Shield, CreditCard, Mail, Calendar, Activity, Trash2, AlertTriangle, Dumbbell, X, Bell, BellOff } from "lucide-react";

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  role: string;
  subscriptionTier: string;
  subscriptionStatus: string;
  streakDays: number;
  allowDirectMessages: boolean;
  allowGroupInvites: boolean;
  isBanned: boolean;
  bannedAt?: string;
  bannedReason?: string;
  hasFitnessAccess: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface UserManagementProps {
  subscriptionFilter?: string | null;
  onClearSubscriptionFilter?: () => void;
  currentUserRole?: string;
}

export default function UserManagement({ subscriptionFilter, onClearSubscriptionFilter, currentUserRole }: UserManagementProps = {}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [showBanDialog, setShowBanDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [editedUser, setEditedUser] = useState<Partial<User>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [stripeSubInput, setStripeSubInput] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["/api/admin/users"],
    retry: false,
  });

  const { data: pushStatus } = useQuery<{ enabled: boolean; deviceCount: number }>({
    queryKey: ["/api/admin/users", selectedUser?.id, "push-status"],
    queryFn: () =>
      fetch(`/api/admin/users/${selectedUser!.id}/push-status`, { credentials: "include" }).then(r => r.json()),
    enabled: !!selectedUser,
  });

  const updateUserRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to update user role');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "User role updated successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Cannot Change Role",
        description: error.message || "Failed to update user role. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateUserSubscription = useMutation({
    mutationFn: async ({ userId, subscriptionStatus }: { userId: string; subscriptionStatus: string }) => {
      await apiRequest('PUT', `/api/admin/users/${userId}/subscription`, { subscriptionStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      // Also invalidate user auth cache for real-time tier updates
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Success",
        description: "User subscription updated successfully!",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update user subscription. Please try again.",
        variant: "destructive",
      });
    },
  });

  const banUser = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
      await apiRequest('PUT', `/api/admin/users/${userId}/ban`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setShowBanDialog(false);
      setShowUserDialog(false);
      setBanReason('');
      toast({
        title: "Success",
        description: "User banned successfully!",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to ban user. Please try again.",
        variant: "destructive",
      });
    },
  });

  const unbanUser = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest('PUT', `/api/admin/users/${userId}/unban`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setSelectedUser(prev => prev ? { ...prev, isBanned: false, bannedAt: undefined, bannedReason: undefined } : null);
      toast({
        title: "Success",
        description: "User unbanned successfully!",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to unban user. Please try again.",
        variant: "destructive",
      });
    },
  });

  const setFitnessAccess = useMutation({
    mutationFn: async ({ userId, hasAccess }: { userId: string; hasAccess: boolean }) => {
      await apiRequest('PUT', `/api/admin/users/${userId}/fitness-access`, { hasAccess });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setSelectedUser(prev => prev ? { ...prev, hasFitnessAccess: variables.hasAccess } : null);
      toast({
        title: "Success",
        description: variables.hasAccess ? "Fitness access granted." : "Fitness access revoked.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update fitness access.",
        variant: "destructive",
      });
    },
  });

  const linkStripeSubscription = useMutation({
    mutationFn: async ({ userId, stripeSubscriptionId }: { userId: string; stripeSubscriptionId: string }) => {
      return await apiRequest('PUT', `/api/admin/users/${userId}/link-stripe-subscription`, { stripeSubscriptionId });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setSelectedUser(prev => prev ? { ...prev, stripeSubscriptionId: data.stripeSubscriptionId, stripeCustomerId: data.stripeCustomerId, subscriptionStatus: 'active', subscriptionTier: 'subscriber' } : null);
      setStripeSubInput('');
      toast({ title: "Subscription Linked", description: "The Stripe subscription has been linked to this user." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to link subscription.", variant: "destructive" });
    },
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest('DELETE', `/api/admin/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setShowDeleteDialog(false);
      setShowUserDialog(false);
      setSelectedUser(null);
      toast({
        title: "User Deleted",
        description: "The user and all their data have been permanently deleted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete user. Please try again.",
        variant: "destructive",
      });
    },
  });

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const filteredUsers = users.filter((user: any) => {
    const matchesSearch =
      `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    // Prop-based quick filter (from dashboard stat cards)
    if (subscriptionFilter === 'active' && user.subscriptionStatus !== 'active') return false;
    if (subscriptionFilter === 'cancelled' && !(user.subscriptionStatus === 'cancelled' && new Date(user.createdAt) <= sevenDaysAgo)) return false;
    if (subscriptionFilter === 'non-subscriber' && !((user.subscriptionStatus === 'trial' || user.subscriptionStatus === 'expired') && new Date(user.createdAt) <= sevenDaysAgo)) return false;

    // Inline dropdown status filter
    if (statusFilter !== 'all' && user.subscriptionStatus !== statusFilter) return false;

    return true;
  });

  const handleSaveChanges = async () => {
    if (!selectedUser || !hasUnsavedChanges) return;

    try {
      const promises = [];
      
      // Save role change if it was modified
      if (editedUser.role && editedUser.role !== selectedUser.role) {
        // Block downgrading the last owner on the client side before hitting the server
        if (selectedUser.role === 'owner' && editedUser.role !== 'owner') {
          const ownerCount = (users as any[]).filter((u: any) => u.role === 'owner').length;
          if (ownerCount <= 1) {
            toast({
              title: "Cannot Change Role",
              description: "This is the last owner. Appoint another owner first before changing their role.",
              variant: "destructive",
            });
            return;
          }
        }
        promises.push(updateUserRole.mutateAsync({ userId: selectedUser.id, role: editedUser.role }));
      }
      
      // Save subscription change if it was modified
      if (editedUser.subscriptionStatus && editedUser.subscriptionStatus !== selectedUser.subscriptionStatus) {
        promises.push(updateUserSubscription.mutateAsync({ userId: selectedUser.id, subscriptionStatus: editedUser.subscriptionStatus }));
      }
      
      // Wait for all changes to be saved
      await Promise.all(promises);
      
      // Update the selected user with the new values
      setSelectedUser(prev => prev ? { 
        ...prev, 
        role: editedUser.role || prev.role,
        subscriptionStatus: editedUser.subscriptionStatus || prev.subscriptionStatus
      } : null);
      
      // Clear edited state
      setEditedUser({});
      setHasUnsavedChanges(false);
      
      toast({
        title: "Success",
        description: "User changes saved successfully!",
      });
    } catch (error) {
      toast({
        title: "Error", 
        description: "Failed to save changes. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getTierBadge = (_tier: string, subscriptionStatus: string) => {
    if (subscriptionStatus === 'active') {
      return <Badge className="bg-[#FCD000] text-black text-[10px] font-black uppercase border-2 border-black rounded-sm px-1.5 py-0">Sub</Badge>;
    }
    return null;
  };

  const getRoleBadge = (role: string) => {
    if (role === 'owner') {
      return <Badge className="bg-black text-[#FCD000] text-[10px] font-black uppercase border-2 border-[#FCD000] rounded-sm px-1.5 py-0">Owner</Badge>;
    }
    if (role === 'admin') {
      return <Badge className="bg-black text-white text-[10px] font-black uppercase border-2 border-black rounded-sm px-1.5 py-0">Admin</Badge>;
    }
    if (role === 'moderator') {
      return <Badge className="bg-black text-white text-[10px] font-black uppercase border border-white/30 rounded-sm px-1.5 py-0">Mod</Badge>;
    }
    return null;
  };

  const getLastActive = (date: string) => {
    const now = new Date();
    const lastActive = new Date(date);
    const diffInHours = Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Active now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ministry-navy mx-auto mb-4"></div>
        <p className="text-ministry-slate">Loading users...</p>
      </div>
    );
  }

  return (
    <Card className="border-gray-100 overflow-hidden" data-testid="card-user-management">
      <CardContent className="p-0">
        {/* Search Users */}
        <div className="p-4 border-b border-gray-100 space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-50 rounded-lg pl-10 pr-4 py-2 text-sm text-black border-0 focus:ring-2 focus:ring-ministry-steel focus:bg-white placeholder:text-gray-400"
                data-testid="input-search-users"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ministry-slate" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 text-sm text-black bg-gray-50 border-0 focus:ring-2 focus:ring-ministry-steel">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="past_due">Past Due</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {subscriptionFilter && (
              <>
                <span className="text-xs text-gray-500">Quick filter:</span>
                <button
                  onClick={onClearSubscriptionFilter}
                  className="flex items-center gap-1 bg-[#FCD000] text-black text-xs font-bold px-2 py-0.5 rounded-full hover:bg-yellow-400 transition-colors"
                >
                  {subscriptionFilter === 'active' && 'Active Subscribers'}
                  {subscriptionFilter === 'cancelled' && 'Cancelled'}
                  {subscriptionFilter === 'non-subscriber' && 'Never Subscribed'}
                  <X className="w-3 h-3 ml-0.5" />
                </button>
              </>
            )}
            <span className="text-xs text-gray-400 ml-auto">{filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        
        {/* User List */}
        <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
          {filteredUsers.length === 0 ? (
            <div className="p-8 text-center" data-testid="empty-users">
              <p className="text-ministry-slate">No users found</p>
            </div>
          ) : (
            filteredUsers.map((user: any) => (
              <div key={user.id} className="p-4 flex items-center justify-between" data-testid={`user-row-${user.id}`}>
                <div className="flex items-center space-x-3 flex-1">
                  <img 
                    src={user.profileImageUrl || `https://ui-avatars.com/api/?name=${user.firstName}+${user.lastName}&background=FCD000&color=000`}
                    alt={`${user.firstName} ${user.lastName}`}
                    className="w-10 h-10 rounded-full object-cover"
                    data-testid="img-user-avatar"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <p className="font-black text-sm uppercase tracking-[0.12em] text-white truncate" data-testid="text-user-name">
                        {user.firstName} {user.lastName}
                      </p>
                      {getRoleBadge(user.role)}
                      {getTierBadge(user.subscriptionTier, user.subscriptionStatus)}
                    </div>
                    <p className="text-xs text-gray-500 truncate" data-testid="text-user-email">
                      {user.email} • {getLastActive(user.updatedAt)}
                    </p>
                    {user.subscriptionStatus === 'active' && user.role !== 'owner' && user.subscriptionExpiresAt && (
                      <p className="text-xs text-green-600 dark:text-green-400">
                        Renews {new Date(user.subscriptionExpiresAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center ml-3">
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedUser(user);
                      setEditedUser({});
                      setHasUnsavedChanges(false);
                      setShowUserDialog(true);
                    }}
                    className="bg-[#FCD000] text-black border-2 border-black font-black uppercase text-xs rounded-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-yellow-400 hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all"
                    data-testid={`view-user-${user.id}`}
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    View
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>

      {/* User Detail Dialog */}
      <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-3">
              <img 
                src={selectedUser?.profileImageUrl || `https://ui-avatars.com/api/?name=${selectedUser?.firstName}+${selectedUser?.lastName}&background=FCD000&color=000`}
                alt={`${selectedUser?.firstName} ${selectedUser?.lastName}`}
                className="w-12 h-12 rounded-full object-cover"
              />
              <div>
                <h2 className="text-xl font-bold text-foreground">
                  {selectedUser?.firstName} {selectedUser?.lastName}
                </h2>
                <p className="text-sm text-ministry-slate">{selectedUser?.email}</p>
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-6">
              {/* User Status */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <Shield className="w-5 h-5 text-ministry-steel" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Role</p>
                        {selectedUser.role === 'owner' && currentUserRole !== 'owner' ? (
                          <p className="text-sm font-semibold text-foreground capitalize mt-1">Owner</p>
                        ) : (
                          <Select
                            value={editedUser.role || selectedUser.role}
                            onValueChange={(role) => {
                              setEditedUser(prev => ({ ...prev, role }));
                              setHasUnsavedChanges(true);
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="moderator">Moderator</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                              {currentUserRole === 'owner' && (
                                <SelectItem value="owner">Owner</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <CreditCard className="w-5 h-5 text-ministry-gold" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Subscription Status</p>
                        <Select
                          value={editedUser.subscriptionStatus || selectedUser.subscriptionStatus || 'expired'}
                          onValueChange={(subscriptionStatus) => {
                            setEditedUser(prev => ({ ...prev, subscriptionStatus }));
                            setHasUnsavedChanges(true);
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active (Subscriber)</SelectItem>
                            <SelectItem value="trial">Trial</SelectItem>
                            <SelectItem value="expired">Expired (Free)</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                            <SelectItem value="past_due">Past Due (Payment Failed)</SelectItem>
                          </SelectContent>
                        </Select>
                        {selectedUser.subscriptionStatus === 'active' && selectedUser.role !== 'owner' && selectedUser.subscriptionExpiresAt && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                            Renews: {new Date(selectedUser.subscriptionExpiresAt).toLocaleDateString()}
                          </p>
                        )}
                        {selectedUser.subscriptionStatus === 'cancelled' && selectedUser.subscriptionExpiresAt && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                            Access ends: {new Date(selectedUser.subscriptionExpiresAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* User Information */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <Mail className="w-4 h-4 text-ministry-slate" />
                    <div>
                      <p className="text-xs text-ministry-slate">Email</p>
                      <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Activity className="w-4 h-4 text-ministry-slate" />
                    <div>
                      <p className="text-xs text-ministry-slate">Streak Days</p>
                      <p className="text-sm text-muted-foreground">{selectedUser.streakDays} days</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <Calendar className="w-4 h-4 text-ministry-slate" />
                    <div>
                      <p className="text-xs text-ministry-slate">Joined</p>
                      <p className="text-sm text-muted-foreground">{formatLocalDateTime(selectedUser.createdAt)}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Calendar className="w-4 h-4 text-ministry-slate" />
                    <div>
                      <p className="text-xs text-ministry-slate">Last Active</p>
                      <p className="text-sm text-muted-foreground">{formatLocalDateTime(selectedUser.updatedAt)}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    {pushStatus?.enabled
                      ? <Bell className="w-4 h-4 text-green-500" />
                      : <BellOff className="w-4 h-4 text-ministry-slate" />
                    }
                    <div>
                      <p className="text-xs text-ministry-slate">Push Notifications</p>
                      {pushStatus === undefined ? (
                        <p className="text-sm text-muted-foreground">Loading…</p>
                      ) : pushStatus.enabled ? (
                        <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                          Enabled ({pushStatus.deviceCount} {pushStatus.deviceCount === 1 ? 'device' : 'devices'})
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">Not enabled</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Privacy Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Privacy Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground">Allow Direct Messages</span>
                    <Badge variant={selectedUser.allowDirectMessages ? "default" : "secondary"}>
                      {selectedUser.allowDirectMessages ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground">Allow Group Invites</span>
                    <Badge variant={selectedUser.allowGroupInvites ? "default" : "secondary"}>
                      {selectedUser.allowGroupInvites ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Fitness Access */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <Dumbbell className="w-5 h-5 text-ministry-gold" />
                    <span>Fitness Access</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-foreground">Fitness Community ($4.99/mo add-on)</p>
                      <p className="text-xs text-ministry-slate">Grant or revoke manual fitness access for this user</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={selectedUser.hasFitnessAccess ? "default" : "secondary"}>
                        {selectedUser.hasFitnessAccess ? "Granted" : "No Access"}
                      </Badge>
                      {selectedUser.hasFitnessAccess ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-300 hover:bg-red-50"
                          onClick={() => setFitnessAccess.mutate({ userId: selectedUser.id, hasAccess: false })}
                          disabled={setFitnessAccess.isPending}
                        >
                          Revoke
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="bg-ministry-gold hover:bg-yellow-500 text-black"
                          onClick={() => setFitnessAccess.mutate({ userId: selectedUser.id, hasAccess: true })}
                          disabled={setFitnessAccess.isPending}
                        >
                          Grant Access
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Stripe Subscription Linking */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <CreditCard className="w-5 h-5 text-ministry-gold" />
                    <span>Stripe Subscription</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedUser.stripeSubscriptionId ? (
                    <div className="space-y-1">
                      <p className="text-xs text-ministry-slate">Linked Subscription ID</p>
                      <p className="text-sm font-mono text-green-600 dark:text-green-400 break-all">{selectedUser.stripeSubscriptionId}</p>
                      {selectedUser.stripeCustomerId && (
                        <>
                          <p className="text-xs text-ministry-slate mt-2">Customer ID</p>
                          <p className="text-sm font-mono text-muted-foreground break-all">{selectedUser.stripeCustomerId}</p>
                        </>
                      )}
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">Cancel button on the user's profile page will work correctly.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">No Stripe subscription linked — cancellation won't work until one is linked.</p>
                      <p className="text-xs text-ministry-slate">Find the subscription ID in Stripe Dashboard (starts with <span className="font-mono">sub_</span>) and paste it below.</p>
                      <div className="flex gap-2">
                        <Input
                          placeholder="sub_..."
                          value={stripeSubInput}
                          onChange={(e) => setStripeSubInput(e.target.value)}
                          className="font-mono text-sm"
                        />
                        <Button
                          size="sm"
                          className="bg-ministry-gold hover:bg-yellow-500 text-black whitespace-nowrap"
                          disabled={!stripeSubInput.startsWith('sub_') || linkStripeSubscription.isPending}
                          onClick={() => linkStripeSubscription.mutate({ userId: selectedUser.id, stripeSubscriptionId: stripeSubInput.trim() })}
                        >
                          {linkStripeSubscription.isPending ? "Linking…" : "Link"}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Ban Status */}
              {selectedUser.isBanned && (
                <Card className="border-red-200">
                  <CardHeader>
                    <CardTitle className="text-lg text-red-600 flex items-center space-x-2">
                      <Ban className="w-5 h-5" />
                      <span>User Banned</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Banned Date</p>
                      <p className="text-sm text-ministry-slate">{selectedUser.bannedAt ? formatLocalDateTime(selectedUser.bannedAt) : 'Unknown'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Reason</p>
                      <p className="text-sm text-ministry-slate">{selectedUser.bannedReason || 'No reason provided'}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Bottom Button Layout */}
              <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                {/* Ban/Unban and Delete Buttons - Bottom Left */}
                <div className="flex space-x-2">
                  {selectedUser.role === 'owner' ? (
                    <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-300 rounded-md">
                      <Shield className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                      <p className="text-xs text-yellow-800 font-medium">Owner accounts cannot be banned or deleted</p>
                    </div>
                  ) : (
                    <>
                      {selectedUser.isBanned ? (
                        <Button
                          onClick={() => unbanUser.mutate(selectedUser.id)}
                          className="bg-green-600 hover:bg-green-700 text-white"
                          disabled={unbanUser.isPending}
                        >
                          <UserCheck className="w-4 h-4 mr-2" />
                          Unban User
                        </Button>
                      ) : (
                        <Button
                          variant="destructive"
                          onClick={() => setShowBanDialog(true)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          <Ban className="w-4 h-4 mr-2" />
                          Ban User
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        onClick={() => setShowDeleteDialog(true)}
                        className="bg-red-800 hover:bg-red-900"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete User
                      </Button>
                    </>
                  )}
                </div>

                {/* Save Button - Bottom Right */}
                <div>
                  <Button
                    onClick={() => handleSaveChanges()}
                    disabled={!hasUnsavedChanges || updateUserRole.isPending || updateUserSubscription.isPending}
                    className="bg-ministry-navy hover:bg-ministry-charcoal text-white"
                  >
                    {(updateUserRole.isPending || updateUserSubscription.isPending) ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Ban User Dialog */}
      <Dialog open={showBanDialog} onOpenChange={setShowBanDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Ban User</DialogTitle>
            <DialogDescription>
              Are you sure you want to ban {selectedUser?.firstName} {selectedUser?.lastName}? 
              This will prevent them from accessing the platform.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="ban-reason" className="text-sm font-medium">
                Reason for ban (required)
              </Label>
              <Textarea
                id="ban-reason"
                placeholder="Enter the reason for banning this user..."
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                className="mt-1"
                rows={3}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowBanDialog(false);
                  setBanReason('');
                }}
                className="border-ministry-steel text-ministry-charcoal hover:bg-ministry-steel/10"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (selectedUser && banReason.trim()) {
                    banUser.mutate({ userId: selectedUser.id, reason: banReason.trim() });
                  }
                }}
                disabled={!banReason.trim() || banUser.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {banUser.isPending ? "Banning..." : "Ban User"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5" />
              <span>Delete User Permanently</span>
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. All user data will be permanently deleted.
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-4">
              <div className="flex items-center space-x-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <img 
                  src={selectedUser.profileImageUrl || `https://ui-avatars.com/api/?name=${selectedUser.firstName}+${selectedUser.lastName}&background=FCD000&color=000`}
                  alt={`${selectedUser.firstName} ${selectedUser.lastName}`}
                  className="w-16 h-16 rounded-full object-cover border-2 border-red-300"
                />
                <div>
                  <h3 className="text-lg font-bold text-red-800">
                    {selectedUser.firstName} {selectedUser.lastName}
                  </h3>
                  <p className="text-sm text-red-600">{selectedUser.email}</p>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800 font-medium">
                  The following will be permanently deleted:
                </p>
                <ul className="text-xs text-yellow-700 mt-2 space-y-1 list-disc list-inside">
                  <li>User profile and account settings</li>
                  <li>All messages and conversations</li>
                  <li>Testimonies and prayer requests</li>
                  <li>Study progress and lesson completions</li>
                  <li>Discussion posts and replies</li>
                  <li>War group memberships</li>
                  <li>All other user data</li>
                </ul>
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteDialog(false)}
                  className="border-ministry-steel text-ministry-charcoal hover:bg-ministry-steel/10"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (selectedUser) {
                      deleteUser.mutate(selectedUser.id);
                    }
                  }}
                  disabled={deleteUser.isPending}
                  className="bg-red-800 hover:bg-red-900"
                >
                  {deleteUser.isPending ? "Deleting..." : "Delete User Permanently"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
