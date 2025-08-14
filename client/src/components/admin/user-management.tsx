import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

export default function UserManagement() {
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["/api/admin/users"],
    retry: false,
  });

  const updateUserRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      await apiRequest('PUT', `/api/admin/users/${userId}/role`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "User role updated successfully!",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update user role. Please try again.",
        variant: "destructive",
      });
    },
  });

  const filteredUsers = users.filter((user: any) =>
    `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'vip':
        return <Badge className="bg-ministry-gold/20 text-ministry-gold text-xs">VIP</Badge>;
      case 'premium':
        return <Badge className="bg-ministry-steel/20 text-ministry-steel text-xs">Premium</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">Free</Badge>;
    }
  };

  const getRoleBadge = (role: string) => {
    return role === 'admin' 
      ? <Badge className="bg-red-100 text-red-800 text-xs">Admin</Badge>
      : <Badge variant="secondary" className="text-xs">User</Badge>;
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
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 rounded-lg pl-10 pr-4 py-2 text-sm border-0 focus:ring-2 focus:ring-ministry-steel focus:bg-white"
              data-testid="input-search-users"
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ministry-slate" />
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
                    src={user.profileImageUrl || `https://ui-avatars.com/api/?name=${user.firstName}+${user.lastName}&background=4A90B8&color=fff`}
                    alt={`${user.firstName} ${user.lastName}`}
                    className="w-10 h-10 rounded-full object-cover"
                    data-testid="img-user-avatar"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <p className="font-medium text-sm text-ministry-charcoal truncate" data-testid="text-user-name">
                        {user.firstName} {user.lastName}
                      </p>
                      {getRoleBadge(user.role)}
                      {getTierBadge(user.subscriptionTier)}
                    </div>
                    <p className="text-xs text-ministry-slate truncate" data-testid="text-user-email">
                      {user.email} • {getLastActive(user.updatedAt)}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 ml-4">
                  <Select
                    value={user.role}
                    onValueChange={(role) => updateUserRole.mutate({ userId: user.id, role })}
                    disabled={updateUserRole.isPending}
                  >
                    <SelectTrigger className="w-20 h-8 text-xs" data-testid={`select-role-${user.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Button 
                    variant="ghost"
                    size="sm"
                    className="text-ministry-steel text-xs hover:text-ministry-navy px-2 py-1"
                    data-testid={`button-manage-${user.id}`}
                  >
                    View
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
