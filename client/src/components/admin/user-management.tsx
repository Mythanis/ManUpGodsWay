import { useState, useEffect } from "react";
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
import { Search, Eye, Ban, UserCheck, Shield, CreditCard, Mail, Calendar, Activity, Trash2, AlertTriangle, Dumbbell, X, Bell, BellOff, ChevronLeft, ChevronRight, ArrowUpDown, BookOpen, CheckCircle, Circle, Unlock, Lock, ChevronDown, Clock } from "lucide-react";

const PAGE_SIZE = 100;

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
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [showBanDialog, setShowBanDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showStudyProgress, setShowStudyProgress] = useState(false);
  const [expandedStudies, setExpandedStudies] = useState<Set<string>>(new Set());
  const [banReason, setBanReason] = useState('');
  const [editedUser, setEditedUser] = useState<Partial<User>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [stripeSubInput, setStripeSubInput] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => { setPage(1); }, [statusFilter, sortBy, subscriptionFilter]);

  const queryParams = new URLSearchParams({
    page: String(page),
    pageSize: String(PAGE_SIZE),
    sortBy,
    search: debouncedSearch,
    statusFilter,
    ...(subscriptionFilter ? { subscriptionFilter } : {}),
  }).toString();

  const { data: pageData, isLoading } = useQuery<{ users: User[]; total: number }>({
    queryKey: ["/api/admin/users", page, PAGE_SIZE, sortBy, debouncedSearch, statusFilter, subscriptionFilter ?? ''],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users?${queryParams}`, { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) throw new Error('Unauthorized');
        throw new Error(`Failed to fetch users (${res.status})`);
      }
      return res.json();
    },
    retry: false,
  });

  const pagedUsers: User[] = pageData?.users ?? [];
  const total: number = pageData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
    mutationFn: async ({ userId, subscriptionStatus, subscriptionExpiresAt }: { userId: string; subscriptionStatus: string; subscriptionExpiresAt?: string | null }) => {
      await apiRequest('PUT', `/api/admin/users/${userId}/subscription`, { subscriptionStatus, subscriptionExpiresAt });
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


  type LessonDetail = { id: string; title: string; dayNumber: number | null; displayOrder: number | null; isCompleted: boolean; completedAt: string | null; dripBypassed: boolean; isLocked: boolean; unlocksAt: string | null };
  type StudyInProgress = { id: string; title: string; seriesOrder: number | null; totalLessons: number; completedLessons: number; isComplete: boolean; lessons: LessonDetail[] };
  type SeriesProgress = { id: string; title: string; studies: StudyInProgress[] };
  const { data: studyProgress, isLoading: studyProgressLoading, refetch: refetchStudyProgress } = useQuery<SeriesProgress[]>({
    queryKey: ["/api/admin/users", selectedUser?.id, "study-progress"],
    queryFn: async () => {
      const tz = encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York');
      const res = await fetch(`/api/admin/users/${selectedUser!.id}/study-progress?timezone=${tz}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch study progress');
      return res.json();
    },
    enabled: showStudyProgress && !!selectedUser,
  });

  const unlockStudy = useMutation({
    mutationFn: async ({ userId, studyId }: { userId: string; studyId: string }) => {
      return await apiRequest('POST', `/api/admin/users/${userId}/unlock-study/${studyId}`);
    },
    onSuccess: () => {
      refetchStudyProgress();
      toast({ title: "Day 1 Opened", description: "The previous week is marked complete. Day 1 is now accessible and the drip schedule continues normally." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to unlock study.", variant: "destructive" });
    },
  });

  const invalidateLessonCaches = (userId: string) => {
    queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}/lesson-progress`] });
    queryClient.invalidateQueries({ queryKey: ["/api/study-series"] });
    // Invalidate all /api/studies/:id/lessons caches (drives isLocked state in the lesson viewer)
    queryClient.invalidateQueries({
      predicate: (query) =>
        Array.isArray(query.queryKey) &&
        typeof query.queryKey[0] === 'string' &&
        (query.queryKey[0] as string).includes('/lessons'),
    });
  };

  const resetLesson = useMutation({
    mutationFn: async ({ userId, lessonId }: { userId: string; lessonId: string }) => {
      return await apiRequest('POST', `/api/admin/users/${userId}/lessons/${lessonId}/reset`);
    },
    onSuccess: (_, { userId }) => {
      refetchStudyProgress();
      invalidateLessonCaches(userId);
      toast({ title: "Lesson Reset", description: "Lesson cleared — the user can redo it from scratch." });
    },
    onError: () => { toast({ title: "Error", description: "Failed to reset lesson.", variant: "destructive" }); },
  });

  const completeLesson = useMutation({
    mutationFn: async ({ userId, lessonId }: { userId: string; lessonId: string }) => {
      return await apiRequest('POST', `/api/admin/users/${userId}/lessons/${lessonId}/complete`);
    },
    onSuccess: (_, { userId }) => {
      refetchStudyProgress();
      invalidateLessonCaches(userId);
      toast({ title: "Lesson Completed", description: "Lesson marked complete." });
    },
    onError: () => { toast({ title: "Error", description: "Failed to complete lesson.", variant: "destructive" }); },
  });

  const unlockLesson = useMutation({
    mutationFn: async ({ userId, lessonId }: { userId: string; lessonId: string }) => {
      return await apiRequest('POST', `/api/admin/users/${userId}/lessons/${lessonId}/unlock`);
    },
    onSuccess: (_, { userId }) => {
      refetchStudyProgress();
      invalidateLessonCaches(userId);
      toast({ title: "Lesson Unlocked", description: "Drip wait bypassed — lesson is now accessible." });
    },
    onError: () => { toast({ title: "Error", description: "Failed to unlock lesson.", variant: "destructive" }); },
  });

  const relockLesson = useMutation({
    mutationFn: async ({ userId, lessonId }: { userId: string; lessonId: string }) => {
      return await apiRequest('POST', `/api/admin/users/${userId}/lessons/${lessonId}/relock`);
    },
    onSuccess: (_, { userId }) => {
      refetchStudyProgress();
      invalidateLessonCaches(userId);
      toast({ title: "Lesson Relocked", description: "Drip bypass removed — lesson is drip-gated again." });
    },
    onError: () => { toast({ title: "Error", description: "Failed to relock lesson.", variant: "destructive" }); },
  });

  const handleSaveChanges = async () => {
    if (!selectedUser || !hasUnsavedChanges) return;

    try {
      const promises = [];
      
      // Save role change if it was modified
      if (editedUser.role && editedUser.role !== selectedUser.role) {
        promises.push(updateUserRole.mutateAsync({ userId: selectedUser.id, role: editedUser.role }));
      }
      
      // Save subscription change if status or expiry date was modified
      const statusChanged = editedUser.subscriptionStatus !== undefined && editedUser.subscriptionStatus !== selectedUser.subscriptionStatus;
      const expiryChanged = editedUser.subscriptionExpiresAt !== undefined && editedUser.subscriptionExpiresAt !== (selectedUser.subscriptionExpiresAt ? new Date(selectedUser.subscriptionExpiresAt).toISOString().split('T')[0] : '');
      if (statusChanged || expiryChanged) {
        const effectiveStatus = editedUser.subscriptionStatus || selectedUser.subscriptionStatus;
        const effectiveExpiry = expiryChanged ? (editedUser.subscriptionExpiresAt || null) : undefined;
        promises.push(updateUserSubscription.mutateAsync({ userId: selectedUser.id, subscriptionStatus: effectiveStatus, subscriptionExpiresAt: effectiveExpiry }));
      }
      
      // Wait for all changes to be saved
      await Promise.all(promises);
      
      // Update the selected user with the new values
      const newExpiresAt = editedUser.subscriptionExpiresAt !== undefined
        ? (editedUser.subscriptionExpiresAt ? new Date(editedUser.subscriptionExpiresAt).toISOString() : undefined)
        : selectedUser.subscriptionExpiresAt;
      setSelectedUser(prev => prev ? { 
        ...prev, 
        role: editedUser.role || prev.role,
        subscriptionStatus: editedUser.subscriptionStatus || prev.subscriptionStatus,
        subscriptionExpiresAt: newExpiresAt,
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
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full bg-gray-50 rounded-lg pl-10 pr-4 py-2 text-sm text-black border-0 focus:ring-2 focus:ring-ministry-steel focus:bg-white placeholder:text-gray-400"
                data-testid="input-search-users"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ministry-slate" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32 text-sm text-black bg-gray-50 border-0 focus:ring-2 focus:ring-ministry-steel">
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
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40 text-sm text-black bg-gray-50 border-0 focus:ring-2 focus:ring-ministry-steel" data-testid="select-sort-users">
                <ArrowUpDown className="w-3.5 h-3.5 mr-1 text-gray-500 flex-shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest Joined</SelectItem>
                <SelectItem value="oldest">Oldest Joined</SelectItem>
                <SelectItem value="recent-online">Most Recent Online</SelectItem>
                <SelectItem value="longest-offline">Longest Offline</SelectItem>
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
            <span className="text-xs text-gray-400 ml-auto">{total} user{total !== 1 ? 's' : ''}</span>
          </div>
        </div>
        
        {/* User List */}
        <div className="divide-y divide-gray-100">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-ministry-navy mx-auto mb-3"></div>
              <p className="text-ministry-slate text-sm">Loading users...</p>
            </div>
          ) : pagedUsers.length === 0 ? (
            <div className="p-8 text-center" data-testid="empty-users">
              <p className="text-ministry-slate">No users found</p>
            </div>
          ) : (
            pagedUsers.map((user: any) => (
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
                      setShowStudyProgress(false);
                      setExpandedStudies(new Set());
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="text-xs font-bold text-black border-gray-300 hover:bg-gray-50"
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" />
              Previous
            </Button>
            <span className="text-xs text-gray-500 font-medium">
              Page {page} of {totalPages} · {total} users
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="text-xs font-bold text-black border-gray-300 hover:bg-gray-50"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        )}
      </CardContent>

      {/* User Detail Dialog */}
      <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
        <DialogContent className="max-w-2xl">
          {selectedUser && (
            <div className="space-y-5">

              {/* ── Header ── */}
              <div className="flex items-center gap-4 pb-4 border-b">
                <img
                  src={selectedUser.profileImageUrl || `https://ui-avatars.com/api/?name=${selectedUser.firstName}+${selectedUser.lastName}&background=FCD000&color=000`}
                  alt={`${selectedUser.firstName} ${selectedUser.lastName}`}
                  className="w-16 h-16 rounded-full object-cover flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-bold text-foreground leading-tight">
                    {selectedUser.firstName} {selectedUser.lastName}
                  </h2>
                  <p className="text-sm text-muted-foreground truncate">{selectedUser.email}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    <Badge variant="outline" className="text-xs capitalize">{selectedUser.role}</Badge>
                    {selectedUser.isBanned && (
                      <Badge variant="destructive" className="text-xs">Banned</Badge>
                    )}
                    <Badge
                      className={`text-xs ${selectedUser.subscriptionStatus === 'active' ? 'bg-green-100 text-green-800 border-green-200' : selectedUser.subscriptionStatus === 'trial' ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}
                      variant="outline"
                    >
                      {selectedUser.subscriptionStatus}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* ── Stats strip ── */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-muted/40 rounded-lg p-2.5">
                  <p className="text-xs text-muted-foreground mb-0.5">Joined</p>
                  <p className="text-xs font-semibold text-foreground leading-tight">{new Date(selectedUser.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-2.5">
                  <p className="text-xs text-muted-foreground mb-0.5">Last Active</p>
                  <p className="text-xs font-semibold text-foreground leading-tight">{new Date(selectedUser.updatedAt).toLocaleDateString()}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-2.5">
                  <p className="text-xs text-muted-foreground mb-0.5">Streak</p>
                  <p className="text-xs font-semibold text-foreground">{selectedUser.streakDays}d</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-2.5">
                  <p className="text-xs text-muted-foreground mb-0.5">Push</p>
                  {pushStatus === undefined ? (
                    <p className="text-xs text-muted-foreground">…</p>
                  ) : pushStatus.enabled ? (
                    <p className="text-xs font-semibold text-green-600">{pushStatus.deviceCount} device{pushStatus.deviceCount !== 1 ? 's' : ''}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Off</p>
                  )}
                </div>
              </div>

              {/* ── Role & Subscription ── */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1 mb-1.5">
                    <Shield className="w-3 h-3" /> Role
                  </Label>
                  {selectedUser.role === 'owner' && currentUserRole !== 'owner' ? (
                    <p className="text-sm font-semibold text-foreground px-3 py-2 bg-muted/40 rounded-md">Owner</p>
                  ) : (
                    <Select
                      value={editedUser.role || selectedUser.role}
                      onValueChange={(role) => { setEditedUser(prev => ({ ...prev, role })); setHasUnsavedChanges(true); }}
                    >
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="moderator">Moderator</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        {currentUserRole === 'owner' && <SelectItem value="owner">Owner</SelectItem>}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1 mb-1.5">
                    <CreditCard className="w-3 h-3" /> Subscription
                  </Label>
                  <Select
                    value={editedUser.subscriptionStatus || selectedUser.subscriptionStatus || 'expired'}
                    onValueChange={(subscriptionStatus) => { setEditedUser(prev => ({ ...prev, subscriptionStatus })); setHasUnsavedChanges(true); }}
                  >
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active (Subscriber)</SelectItem>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="expired">Expired (Free)</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="past_due">Past Due</SelectItem>
                    </SelectContent>
                  </Select>
                  {(() => {
                    const currentStatus = editedUser.subscriptionStatus || selectedUser.subscriptionStatus;
                    if (currentStatus === 'active' || currentStatus === 'cancelled') {
                      const rawExpiry = editedUser.subscriptionExpiresAt !== undefined
                        ? editedUser.subscriptionExpiresAt
                        : (selectedUser.subscriptionExpiresAt ? new Date(selectedUser.subscriptionExpiresAt).toISOString().split('T')[0] : '');
                      return (
                        <div className="mt-2 space-y-1">
                          <p className="text-xs text-muted-foreground">
                            {currentStatus === 'cancelled' ? 'Access ends' : 'Renews'}
                          </p>
                          <input
                            type="date"
                            value={rawExpiry}
                            onChange={(e) => {
                              setEditedUser(prev => ({ ...prev, subscriptionExpiresAt: e.target.value }));
                              setHasUnsavedChanges(true);
                            }}
                            className="w-full h-8 px-2 text-xs rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>

              {/* ── Settings row: Privacy + Fitness ── */}
              <div className="grid grid-cols-2 gap-4">
                <div className="border rounded-lg p-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Privacy</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-foreground">Direct Messages</span>
                    <Badge variant={selectedUser.allowDirectMessages ? "default" : "secondary"} className="text-xs">
                      {selectedUser.allowDirectMessages ? "On" : "Off"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-foreground">Group Invites</span>
                    <Badge variant={selectedUser.allowGroupInvites ? "default" : "secondary"} className="text-xs">
                      {selectedUser.allowGroupInvites ? "On" : "Off"}
                    </Badge>
                  </div>
                </div>
                <div className="border rounded-lg p-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Dumbbell className="w-3 h-3 text-ministry-gold" /> Fitness Access
                  </p>
                  <div className="flex items-center justify-between">
                    <Badge variant={selectedUser.hasFitnessAccess ? "default" : "secondary"} className="text-xs">
                      {selectedUser.hasFitnessAccess ? "Granted" : "No Access"}
                    </Badge>
                    {selectedUser.hasFitnessAccess ? (
                      <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-300 hover:bg-red-50"
                        onClick={() => setFitnessAccess.mutate({ userId: selectedUser.id, hasAccess: false })}
                        disabled={setFitnessAccess.isPending}>Revoke</Button>
                    ) : (
                      <Button size="sm" className="h-7 text-xs bg-ministry-gold hover:bg-yellow-500 text-black"
                        onClick={() => setFitnessAccess.mutate({ userId: selectedUser.id, hasAccess: true })}
                        disabled={setFitnessAccess.isPending}>Grant</Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">$4.99/mo add-on</p>
                </div>
              </div>

              {/* ── Stripe ── */}
              <div className="border rounded-lg p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1 mb-2">
                  <CreditCard className="w-3 h-3 text-ministry-gold" /> Stripe Subscription
                </p>
                {selectedUser.stripeSubscriptionId ? (
                  <div className="space-y-1">
                    <p className="text-xs font-mono text-green-600 break-all">{selectedUser.stripeSubscriptionId}</p>
                    {selectedUser.stripeCustomerId && (
                      <p className="text-xs font-mono text-muted-foreground break-all">{selectedUser.stripeCustomerId}</p>
                    )}
                    <p className="text-xs text-green-600">Cancellation will work correctly.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-amber-600 font-medium">No subscription linked — cancellation won't work until linked.</p>
                    <div className="flex gap-2">
                      <Input placeholder="sub_..." value={stripeSubInput} onChange={(e) => setStripeSubInput(e.target.value)} className="font-mono text-xs h-8" />
                      <Button size="sm" className="h-8 text-xs bg-ministry-gold hover:bg-yellow-500 text-black whitespace-nowrap"
                        disabled={!stripeSubInput.startsWith('sub_') || linkStripeSubscription.isPending}
                        onClick={() => linkStripeSubscription.mutate({ userId: selectedUser.id, stripeSubscriptionId: stripeSubInput.trim() })}>
                        {linkStripeSubscription.isPending ? "Linking…" : "Link"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Study Progress ── */}
              <div className="border rounded-lg overflow-hidden">
                <button
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/30 transition-colors"
                  onClick={() => setShowStudyProgress(prev => !prev)}
                >
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <BookOpen className="w-3 h-3 text-ministry-gold" /> Study Progress
                  </p>
                  <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${showStudyProgress ? 'rotate-180' : ''}`} />
                </button>
                {showStudyProgress && (
                  <div className="border-t p-3 space-y-3">
                    {studyProgressLoading ? (
                      <div className="flex items-center gap-2 py-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-ministry-navy" />
                        <span className="text-xs text-muted-foreground">Loading progress…</span>
                      </div>
                    ) : !studyProgress || studyProgress.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-1">No series studies found.</p>
                    ) : (
                      studyProgress.map((series) => (
                        <div key={series.id}>
                          <p className="text-xs font-bold text-foreground mb-1.5">{series.title}</p>
                          <div className="space-y-1 pr-1">
                            {series.studies.map((study, idx) => {
                              const isExpanded = expandedStudies.has(study.id);
                              const anyPending = resetLesson.isPending || completeLesson.isPending || unlockLesson.isPending || relockLesson.isPending || unlockStudy.isPending;
                              return (
                                <div key={study.id} className="border border-muted/40 rounded-md overflow-hidden">
                                  {/* Week header row */}
                                  <div
                                    className="w-full flex items-center justify-between gap-2 px-2 py-1.5 hover:bg-muted/20 transition-colors cursor-pointer select-none"
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedStudies(prev => { const next = new Set(prev); next.has(study.id) ? next.delete(study.id) : next.add(study.id); return next; }); } }}
                                    onClick={() => setExpandedStudies(prev => {
                                      const next = new Set(prev);
                                      next.has(study.id) ? next.delete(study.id) : next.add(study.id);
                                      return next;
                                    })}
                                  >
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      {study.isComplete
                                        ? <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                                        : <Circle className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                      }
                                      <span className="text-xs text-foreground truncate font-medium">
                                        {idx + 1}. {study.title}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                                        {study.totalLessons > 0 ? `${study.completedLessons}/${study.totalLessons}` : study.isComplete ? 'Done' : 'Not started'}
                                      </span>
                                      {!study.isComplete && idx > 0 && (
                                        <Button
                                          size="sm"
                                          className="h-5 text-[10px] px-1.5 bg-ministry-gold hover:bg-yellow-500 text-black font-bold"
                                          disabled={anyPending}
                                          title="Completes the previous week so Day 1 of this week opens."
                                          onClick={(e) => { e.stopPropagation(); unlockStudy.mutate({ userId: selectedUser.id, studyId: study.id }); }}
                                        >
                                          <Unlock className="w-2 h-2 mr-0.5" />
                                          Open D1
                                        </Button>
                                      )}
                                      <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                                    </div>
                                  </div>

                                  {/* Lesson rows (expandable) */}
                                  {isExpanded && study.lessons && study.lessons.length > 0 && (
                                    <div className="border-t border-muted/30 bg-muted/10">
                                      {study.lessons.map((lesson, li) => (
                                        <div key={lesson.id} className="flex items-center gap-2 px-3 py-1.5 border-b border-muted/20 last:border-0">
                                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                            {lesson.isCompleted
                                              ? <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                                              : lesson.dripBypassed
                                                ? <Unlock className="w-3 h-3 text-amber-500 flex-shrink-0" title="Drip bypassed — accessible now" />
                                                : lesson.isLocked
                                                  ? <Clock className="w-3 h-3 text-blue-400 flex-shrink-0" title="Drip-locked — not yet accessible" />
                                                  : <Circle className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                            }
                                            <span className="text-[11px] text-foreground truncate">
                                              Day {lesson.dayNumber ?? li + 1}. {lesson.title}
                                            </span>
                                            {lesson.completedAt && (
                                              <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                                                {new Date(lesson.completedAt).toLocaleDateString()}
                                              </span>
                                            )}
                                            {lesson.isLocked && lesson.unlocksAt && (
                                              <span className="text-[9px] text-blue-400 whitespace-nowrap flex-shrink-0 font-medium">
                                                unlocks {new Date(lesson.unlocksAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                              </span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-1 flex-shrink-0">
                                            {lesson.isCompleted && (
                                              <Button size="sm"
                                                className="h-5 text-[9px] px-1.5 bg-red-100 hover:bg-red-200 text-red-700 border border-red-200 font-medium"
                                                disabled={anyPending}
                                                title="Clear completion — user can redo this day"
                                                onClick={() => resetLesson.mutate({ userId: selectedUser.id, lessonId: lesson.id })}
                                              >Reset</Button>
                                            )}
                                            {!lesson.isCompleted && (
                                              <Button size="sm"
                                                className="h-5 text-[9px] px-1.5 bg-green-100 hover:bg-green-200 text-green-700 border border-green-200 font-medium"
                                                disabled={anyPending}
                                                title="Mark this day as complete"
                                                onClick={() => completeLesson.mutate({ userId: selectedUser.id, lessonId: lesson.id })}
                                              >Done</Button>
                                            )}
                                            {!lesson.isCompleted && !lesson.dripBypassed && (
                                              <Button size="sm"
                                                className="h-5 text-[9px] px-1.5 bg-amber-100 hover:bg-amber-200 text-amber-700 border border-amber-200 font-medium"
                                                disabled={anyPending}
                                                title="Bypass 24-hr wait — makes this day accessible now"
                                                onClick={() => unlockLesson.mutate({ userId: selectedUser.id, lessonId: lesson.id })}
                                              ><Unlock className="w-2 h-2 mr-0.5" />Unlock</Button>
                                            )}
                                            {!lesson.isCompleted && lesson.dripBypassed && (
                                              <Button size="sm"
                                                className="h-5 text-[9px] px-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-medium"
                                                disabled={anyPending}
                                                title="Re-apply the drip gate — lesson will be locked until its scheduled unlock time"
                                                onClick={() => relockLesson.mutate({ userId: selectedUser.id, lessonId: lesson.id })}
                                              ><Lock className="w-2 h-2 mr-0.5" />Relock</Button>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* ── Ban info (only when banned) ── */}
              {selectedUser.isBanned && (
                <div className="border border-red-200 bg-red-50 rounded-lg p-3 space-y-1">
                  <p className="text-xs font-semibold text-red-600 uppercase tracking-wide flex items-center gap-1">
                    <Ban className="w-3 h-3" /> Banned
                  </p>
                  <p className="text-xs text-red-700">
                    <span className="font-medium">Date:</span> {selectedUser.bannedAt ? formatLocalDateTime(selectedUser.bannedAt) : 'Unknown'}
                  </p>
                  <p className="text-xs text-red-700">
                    <span className="font-medium">Reason:</span> {selectedUser.bannedReason || 'No reason provided'}
                  </p>
                </div>
              )}

              {/* ── Action bar ── */}
              <div className="flex justify-between items-center pt-3 border-t">
                <div className="flex gap-2">
                  {selectedUser.role === 'owner' ? (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 border border-yellow-300 rounded-md">
                      <Shield className="w-3.5 h-3.5 text-yellow-600 flex-shrink-0" />
                      <p className="text-xs text-yellow-800 font-medium">Owner — cannot be banned or deleted</p>
                    </div>
                  ) : (
                    <>
                      {selectedUser.isBanned ? (
                        <Button size="sm" onClick={() => unbanUser.mutate(selectedUser.id)}
                          className="bg-green-600 hover:bg-green-700 text-white" disabled={unbanUser.isPending}>
                          <UserCheck className="w-3.5 h-3.5 mr-1.5" /> Unban
                        </Button>
                      ) : (
                        <Button size="sm" variant="destructive" onClick={() => setShowBanDialog(true)} className="bg-red-600 hover:bg-red-700">
                          <Ban className="w-3.5 h-3.5 mr-1.5" /> Ban User
                        </Button>
                      )}
                      <Button size="sm" variant="destructive" onClick={() => setShowDeleteDialog(true)} className="bg-red-800 hover:bg-red-900">
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
                      </Button>
                    </>
                  )}
                </div>
                <Button
                  onClick={() => handleSaveChanges()}
                  disabled={!hasUnsavedChanges || updateUserRole.isPending || updateUserSubscription.isPending}
                  className="bg-ministry-navy hover:bg-ministry-charcoal text-white"
                >
                  {(updateUserRole.isPending || updateUserSubscription.isPending) ? "Saving…" : "Save Changes"}
                </Button>
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
